/**
 * @NApiVersion 2.1
 * @NScriptType CustomGLPlugin
 */
define(['N/log', 'N/search', 'N/record', '/SuiteApps/com.tvarana.indiantax/Other Files/TSS TaxPro Server Helper'], function (log, search, record, serverHelper) {
    var tranType = ''
    var differentTaxAccountFeature = false
    var cgstExpense = '177'
    var sgstExpense = '178'
    var igstExpense = '179'
    function customizeGlImpact(context) {
        try {
            // Always first line — checks subscription
            if (!serverHelper.checkSubscription()) {
                log.debug("TaxPro Customer Deposit Plugin", "Subscription check failed - blocking execution");
                return true;
            }
            var transactionRecord = context.transactionRecord
            var Testlines = context.customLines
            tranType = transactionRecord.getValue({ fieldId: 'type' });
            var ExportGST = transactionRecord.getValue({ fieldId: 'custbody_tss_export_gst' });
            if (ExportGST) {
                return;
            }
            log.debug("tranType", tranType)
            var cachedGlobalSubsidiary = GettingGlobalParameter();
            var currentrecordsubsidiary = transactionRecord.getValue({ fieldId: "subsidiary" });
            // log.debug("currentrecordsubsidiary", currentrecordsubsidiary)
            var Flag = 0;
            Flag = inArray(currentrecordsubsidiary, cachedGlobalSubsidiary);
            if (Flag == parseInt(1)) {
                // Get header-level values
                var headerLocation = transactionRecord.getValue('location');
                var headerDepartment = transactionRecord.getValue('department');
                var headerClass = transactionRecord.getValue('class');

                var gstCode = ''
                // Load Tax Group and create a map of tax types to their corresponding accounts
                var taxGroupId = transactionRecord.getValue({ fieldId: 'custbody_tss_it_tax_code' });
                if (taxGroupId) {
                    var taxGroup = record.load({
                        type: 'taxgroup',
                        id: taxGroupId
                    });
                    gstCode = taxGroup.getText({ fieldId: 'taxtype' });

                    var taxItemLineCount = taxGroup.getLineCount({ sublistId: 'taxitem' });
                    var taxAccountMap = {};

                    for (var i = 0; i < taxItemLineCount; i++) {
                        var taxItemId = taxGroup.getSublistValue({
                            sublistId: 'taxitem',
                            fieldId: 'taxname',
                            line: i
                        });

                        var taxType = taxGroup.getSublistText({
                            sublistId: 'taxitem',
                            fieldId: 'taxtype',
                            line: i
                        });

                        if (taxItemId && taxType) {
                            var taxItemDetails = search.lookupFields({
                                type: "salestaxitem",
                                id: taxItemId,
                                columns: ['saleaccount']
                            });

                            var accountId = (taxItemDetails.saleaccount && taxItemDetails.saleaccount.length > 0)
                                ? taxItemDetails.saleaccount[0].value
                                : null;

                            taxAccountMap[taxType.toUpperCase()] = accountId;
                        }
                    }
                    log.debug("taxAccountMap", taxAccountMap);
                }

                // Only run for Customer Deposit Application
                if (tranType == 'custdep' || tranType == 'depappl' || tranType == 'custrfnd') {
                    var stdLine = context.standardLines.getLine({ index: 0 });
                    var EntityId = stdLine.entityId;
                    log.debug("EntityId", EntityId)

                    // var Vendorresult = search.create({
                    //     type: "vendor",
                    //     filters: [["subsidiary", "anyof", currentrecordsubsidiary],
                    //         "AND",
                    //     ["category", "anyof", "3"]],
                    //     columns: [search.createColumn({ name: "internalid" })]
                    // }).run().getRange({ start: 0, end: 1 })[0];

                    // var Vendorinternalid = Vendorresult ? Vendorresult.getValue({ name: 'internalid' }) : '';
                    // log.debug("Vendorinternalid", Vendorinternalid)

                    var Vendorinternalid = getTaxAgencyVendor(currentrecordsubsidiary);
                    log.debug("Tax Agency", Vendorinternalid);




                    if (gstCode && gstCode.toUpperCase().indexOf("IGST") !== -1) {

                        var IGSTAmount = parseFloat(transactionRecord.getValue({ fieldId: 'custbody_tss_it_igst_amount' }));
                        if (IGSTAmount > 0 && taxAccountMap['IGST']) {
                            var IGSTcreditLine = Testlines.addNewLine();
                            IGSTcreditLine.accountId = parseInt(taxAccountMap['IGST']);;
                            if (tranType == 'custdep') {
                                IGSTcreditLine.creditAmount = IGSTAmount;
                            }
                            if (tranType == 'depappl' || tranType == 'custrfnd') {
                                IGSTcreditLine.debitAmount = IGSTAmount;
                            }
                            IGSTcreditLine.memo = 'VAT';
                            if (Vendorinternalid) {
                                IGSTcreditLine.entityId = parseInt(Vendorinternalid);
                            }
                            if (headerLocation) {
                                IGSTcreditLine.locationId = parseInt(headerLocation);
                            }
                            if (headerDepartment) {
                                IGSTcreditLine.departmentId = parseInt(headerDepartment);
                            }
                            if (headerClass) {
                                IGSTcreditLine.classId = parseInt(headerClass);
                            }
                        }


                        var totalGST = parseFloat(transactionRecord.getValue({ fieldId: 'custbody_tss_it_taxamount' }))
                        var debitLine = Testlines.addNewLine();
                        if (tranType == 'custdep') {
                            var account = transactionRecord.getValue({ fieldId: 'account' });
                            //Added logic for differentTaxAccountFeature, Make the differentTaxAccountFeature as false this part if dont want this logic
                            if (differentTaxAccountFeature) {
                                account = igstExpense
                            }
                            //End Added logic for differentTaxAccountFeature, Make the differentTaxAccountFeature as false this part if dont want this logic
                            if (!account) {
                                var StandardAccount = getStandardDebitAccount(context)
                            }

                            debitLine.debitAmount = totalGST;
                            debitLine.accountId = parseInt(account || StandardAccount);

                        }
                        if (tranType == 'depappl') {
                            var CustDepositId = transactionRecord.getValue({ fieldId: 'deposit' });
                            var custDepositsearchobj = search.lookupFields({ type: 'customerdeposit', id: CustDepositId, columns: ['account'] });
                            var CustAccount = custDepositsearchobj.account[0].value;
                            //Added logic for differentTaxAccountFeature, Make the differentTaxAccountFeature as false this part if dont want this logic
                            if (differentTaxAccountFeature) {
                                CustAccount = igstExpense
                            }
                            //End Added logic for differentTaxAccountFeature, Make the differentTaxAccountFeature as false this part if dont want this logic
                            if (!CustAccount) {
                                var CustDepositAccount = getStandardDebitAccount(context)
                            }
                            debitLine.creditAmount = totalGST;
                            debitLine.accountId = parseInt(CustAccount || CustDepositAccount);
                        }
                        if (tranType == 'custrfnd') {
                            var StandardAccount = getStandardDebitAccount(context)
                            //Added logic for differentTaxAccountFeature, Make the differentTaxAccountFeature as false this part if dont want this logic
                            if (differentTaxAccountFeature) {
                                StandardAccount = igstExpense
                            }
                            //End Added logic for differentTaxAccountFeature, Make the differentTaxAccountFeature as false this part if dont want this logic
                            debitLine.creditAmount = totalGST;
                            debitLine.accountId = parseInt(StandardAccount);
                        }

                        if (EntityId) {
                            debitLine.entityId = parseInt(EntityId);
                        }
                        if (headerLocation) {
                            debitLine.locationId = parseInt(headerLocation);
                        }
                        if (headerDepartment) {
                            debitLine.departmentId = parseInt(headerDepartment);
                        }
                        if (headerClass) {
                            debitLine.classId = parseInt(headerClass);
                        }


                    }
                    else if (gstCode && gstCode.toUpperCase().indexOf("GST") !== -1) {
                        try {

                            var CGSTAmount = parseFloat(transactionRecord.getValue({ fieldId: 'custbody_tss_cgst_amount' }) || 0);
                            if (CGSTAmount > 0 && taxAccountMap['CGST']) {

                                var CGSTcreditLine = Testlines.addNewLine();
                                CGSTcreditLine.accountId = parseInt(taxAccountMap['CGST']);
                                if (tranType == 'custdep') {
                                    CGSTcreditLine.creditAmount = CGSTAmount;
                                }
                                if (tranType == 'depappl' || tranType == 'custrfnd') {
                                    CGSTcreditLine.debitAmount = CGSTAmount;
                                }
                                CGSTcreditLine.memo = 'VAT';
                                if (Vendorinternalid) {
                                    CGSTcreditLine.entityId = parseInt(Vendorinternalid);
                                }
                                if (headerLocation) {
                                    CGSTcreditLine.locationId = parseInt(headerLocation);
                                }
                                if (headerDepartment) {
                                    CGSTcreditLine.departmentId = parseInt(headerDepartment);
                                }
                                if (headerClass) {
                                    CGSTcreditLine.classId = parseInt(headerClass);
                                }
                            }

                            var totalGST = parseFloat(transactionRecord.getValue({ fieldId: 'custbody_tss_it_taxamount' }) || 0);
                            var SGSTAmount = (totalGST - CGSTAmount).toFixed(2)
                            if (SGSTAmount > 0 && taxAccountMap['SGST']) {

                                var SGSTcreditLine = Testlines.addNewLine();
                                SGSTcreditLine.accountId = parseInt(taxAccountMap['SGST']);;
                                if (tranType == 'custdep') {
                                    SGSTcreditLine.creditAmount = SGSTAmount;

                                }
                                if (tranType == 'depappl' || tranType == 'custrfnd') {
                                    SGSTcreditLine.debitAmount = SGSTAmount;
                                }
                                SGSTcreditLine.memo = 'VAT';
                                if (Vendorinternalid) {
                                    SGSTcreditLine.entityId = parseInt(Vendorinternalid);
                                }
                                if (headerLocation) {
                                    SGSTcreditLine.locationId = parseInt(headerLocation);
                                }
                                if (headerDepartment) {
                                    SGSTcreditLine.departmentId = parseInt(headerDepartment);
                                }
                                if (headerClass) {
                                    SGSTcreditLine.classId = parseInt(headerClass);
                                }
                            }

                            //Initialising the variable to figure out whether single line or cgst/sgst stand alone lines need to add based feature defined globally in plugin script
                            var linesTobeAdd = differentTaxAccountFeature ? 2 : 1

                            for (var i = 0; i < linesTobeAdd; i++) {

                                // var totalGST = parseFloat(CGSTAmount + SGSTAmount);
                                var debitLine = Testlines.addNewLine();

                                if (tranType == 'custdep') {
                                    var account = transactionRecord.getValue({ fieldId: 'account' });

                                    //Added logic for differentTaxAccountFeature, Make the differentTaxAccountFeature as false this part if dont want this logic
                                    if (differentTaxAccountFeature) {
                                        if (i == 0) {
                                            account = cgstExpense
                                        }
                                        else if (i == 1) {
                                            account = sgstExpense
                                        }
                                    }
                                    //End Added logic for differentTaxAccountFeature, Make the differentTaxAccountFeature as false this part if dont want this logic

                                    if (!account) {
                                        var StandardAccount = getStandardDebitAccount(context)
                                    }

                                    debitLine.debitAmount = totalGST;
                                    //Added logic for differentTaxAccountFeature, Make the differentTaxAccountFeature as false this part if dont want this logic
                                    if (differentTaxAccountFeature) {
                                        if (i == 0) {
                                            debitLine.debitAmount = CGSTAmount;
                                        }
                                        else if (i == 1) {
                                            debitLine.debitAmount = SGSTAmount;
                                        }
                                    }
                                    //End Added logic for differentTaxAccountFeature, Make the differentTaxAccountFeature as false this part if dont want this logic

                                    debitLine.accountId = Number(account || StandardAccount);

                                }
                                if (tranType == 'depappl') {
                                    var CustDepositId = transactionRecord.getValue({ fieldId: 'deposit' });
                                    var custDepositsearchobj = search.lookupFields({ type: 'customerdeposit', id: CustDepositId, columns: ['account'] });
                                    var CustAccount = custDepositsearchobj.account[0].value;
                                    //Added logic for differentTaxAccountFeature, Make the differentTaxAccountFeature as false this part if dont want this logic
                                    if (differentTaxAccountFeature) {
                                        if (i == 0) {
                                            CustAccount = cgstExpense
                                        }
                                        else if (i == 1) {
                                            CustAccount = sgstExpense
                                        }
                                    }
                                    //End Added logic for differentTaxAccountFeature, Make the differentTaxAccountFeature as false this part if dont want this logic

                                    if (!CustAccount) {
                                        var CustDepositAccount = getStandardDebitAccount(context)
                                    }
                                    debitLine.creditAmount = totalGST;
                                    //Added logic for differentTaxAccountFeature, Make the differentTaxAccountFeature as false this part if dont want this logic
                                    if (differentTaxAccountFeature) {
                                        if (i == 0) {
                                            debitLine.creditAmount = CGSTAmount;
                                        }
                                        else if (i == 1) {
                                            debitLine.creditAmount = SGSTAmount;
                                        }
                                    }
                                    //End Added logic for differentTaxAccountFeature, Make the differentTaxAccountFeature as false this part if dont want this logic

                                    debitLine.accountId = parseInt(CustAccount || CustDepositAccount);
                                }
                                if (tranType == 'custrfnd') {
                                    var StandardAccount = getStandardDebitAccount(context)
                                    //Added logic for differentTaxAccountFeature, Make the differentTaxAccountFeature as false this part if dont want this logic
                                    if (differentTaxAccountFeature) {
                                        if (i == 0) {
                                            StandardAccount = cgstExpense
                                        }
                                        else if (i == 1) {
                                            StandardAccount = sgstExpense
                                        }
                                    }
                                    //End Added logic for differentTaxAccountFeature, Make the differentTaxAccountFeature as false this part if dont want this logic

                                    debitLine.creditAmount = totalGST;
                                    //Added logic for differentTaxAccountFeature, Make the differentTaxAccountFeature as false this part if dont want this logic
                                    if (differentTaxAccountFeature) {
                                        if (i == 0) {
                                            debitLine.creditAmount = CGSTAmount;
                                        }
                                        else if (i == 1) {
                                            debitLine.creditAmount = SGSTAmount;
                                        }
                                    }
                                    //End Added logic for differentTaxAccountFeature, Make the differentTaxAccountFeature as false this part if dont want this logic

                                    debitLine.accountId = parseInt(StandardAccount);
                                }
                                if (EntityId) {
                                    debitLine.entityId = parseInt(EntityId);
                                }
                                if (headerLocation) {
                                    debitLine.locationId = parseInt(headerLocation);
                                }
                                if (headerDepartment) {
                                    debitLine.departmentId = parseInt(headerDepartment);
                                }
                                if (headerClass) {
                                    debitLine.classId = parseInt(headerClass);
                                }

                            }
                        } catch (e) {
                            log.error("Error in GST block", e);
                        }
                    }
                }
            }

        } catch (e) {
            log.error('Error in customizeGlImpact', e);
        }
    }
    function getStandardDebitAccount(context) {
        var debitAcct = null;
        var lineCount = context.standardLines.count;
        for (var i = 0; i < lineCount; i++) {
            var line = context.standardLines.getLine({ index: i });
            if (line.debitAmount && line.debitAmount > 0) {
                debitAcct = line.accountId;
                break;
            }
        }
        if (tranType == 'custrfnd') {
            debitAcct = context.transactionRecord.getValue('account');
        }
        return (debitAcct);
    }
    function GettingGlobalParameter() {
        var GlobalSubsidiary = ''

        var GlobalParameterSearch = search.create({
            type: "customrecord_tss_global_parameter",
            filters: [["isinactive", "is", "F"]],
            columns: [
                search.createColumn({ name: "internalid", label: "Internalid" }),
                search.createColumn({ name: "custrecord_tss_gp_subsidiary", label: "Internalid" }),

            ]
        });
        var GlobalParameterSearchResults = GlobalParameterSearch.run().getRange({ start: 0, end: 1000 });
        if (GlobalParameterSearchResults.length > 0) {
            GlobalSubsidiary = GlobalParameterSearchResults[0].getValue({ name: 'custrecord_tss_gp_subsidiary' });

        }
        return GlobalSubsidiary

    }

    function inArray(needle, haystack) {
        if (_logValidation(haystack)) {
            if (typeof (haystack) == 'string')
                haystack = haystack.split(',')
            var count = haystack.length;
            for (var i = 0; i < count; i++) {
                if (haystack[i] === needle) { return 1; }
            }
            return 0;
        }

    }
    function _logValidation(value) {
        if (value != 'null' && value != null && value != null && value != '' && value != undefined && value != undefined && value != 'undefined' && value != 'undefined' && value != 'NaN' && value != NaN) {
            return true;
        }
        else {
            return false;
        }
    }

    // -------------------------------------------------------------------
    // Get Tax Agency Vendor (Custom Record First → Vendor Fallback)
    // -------------------------------------------------------------------
    function getTaxAgencyVendor(subsidiary) {
        try {
            // ---------------------------------------------------------------
            // 1. Try fetching vendor from custom record mapping
            // ---------------------------------------------------------------
            try {
                var customTaxAgency = search.create({
                    type: 'customrecord_tss_ta_subsidiary_tax_agenc',
                    filters: [
                        ['custrecord_tss_ta_subsidiary', 'anyof', subsidiary],
                        'AND',
                        ['isinactive', 'is', 'F']
                    ],
                    columns: ['custrecord_tss_ta_tax_agency_id']
                }).run().getRange({ start: 0, end: 1 });

                if (customTaxAgency && customTaxAgency.length > 0) {
                    var mappedVendor = customTaxAgency[0].getValue('custrecord_tss_ta_tax_agency_id');
                    if (mappedVendor) {
                        return mappedVendor; // Return custom record vendor
                    }
                }
            }
            catch (err) {
                log.error("Error in getTaxAgencyVendor in try", err);
                if (err.name == 'INVALID_RCRD_TYPE') {
                    // ---------------------------------------------------------------
                    // 2. Fallback → Standard Vendor Search (category = 3)
                    // ---------------------------------------------------------------
                    var vendorRes = search.create({
                        type: 'vendor',
                        filters: [
                            ['subsidiary', 'anyof', subsidiary],
                            'AND',
                            ['category', 'anyof', 3]
                        ],
                        columns: ['internalid']
                    }).run().getRange({ start: 0, end: 1 });

                    return (vendorRes && vendorRes[0]) ? vendorRes[0].getValue('internalid') : null;
                }
            }

        } catch (e) {
            log.error("Error in getTaxAgencyVendor()", e);
            return null;
        }
    }

    return {
        customizeGlImpact: customizeGlImpact
    };

});