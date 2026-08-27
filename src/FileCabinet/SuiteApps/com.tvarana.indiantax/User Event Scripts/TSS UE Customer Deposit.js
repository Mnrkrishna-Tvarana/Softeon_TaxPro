/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/error', 'N/runtime', './TSS UE TCS On Sales', '/SuiteApps/com.tvarana.indiantax/Other Files/TSS TaxPro Server Helper'],

    (record, search, error, runtime, serverHelper) => {

        var formSetFlag = true;
        var customFormsObjSb = {
            'purchaseorder': 201, 'vendorprepayment': 203, 'vendorbill': 193, 'vendorreturnauthorization': '', 'vendorcredit': 194, 'billpayment': '',
            'salesorder': 202, 'invoice': 199, 'returnauthorization': '', 'creditmemo': 197, 'customerpayments': '', 'cashsale': 195, 'customerrefund': 176, 'customerdeposit': 204
        }
        var customFormsObjProd = {
            'purchaseorder': 201, 'vendorprepayment': 203, 'vendorbill': 193, 'vendorreturnauthorization': '', 'vendorcredit': 194, 'billpayment': '',
            'salesorder': 202, 'invoice': 199, 'returnauthorization': '', 'creditmemo': 197, 'customerpayments': '', 'cashsale': 195, 'customerrefund': 176, 'customerdeposit': 204
        }


        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {
            try {
                // Always first line — checks subscription
                if (!serverHelper.checkSubscription()) {
                    log.debug("TaxPro UE beforeLoad", "Subscription check failed - blocking execution");
                    return true;
                }
                var recType = scriptContext.newRecord.type;
                log.debug("recType beforeLoad", recType);
                if (recType == 'customerdeposit') {
                    if (scriptContext.type == scriptContext.UserEventType.VIEW) {

                        var form = scriptContext.form;
                        var rec = scriptContext.newRecord;
                        var ApplyGST = rec.getValue({ fieldId: 'custbody_tss_it_apply_gst' });
                        if (!ApplyGST) return;

                        var isExport = rec.getValue({ fieldId: 'custbody_tss_export_gst' });
                        var paymentUnder = rec.getText({ fieldId: 'custbody_tss_gst_payment_under' });
                        var gstTransaction = rec.getValue({ fieldId: 'custbody_tss_lut_journal_invoice' });
                        log.debug('gstTransaction', gstTransaction);
                        log.debug('isExport', isExport);




                        if (isExport && paymentUnder == "Export without LUT") {
                            if ((isExport == true || isExport == 'T' || isExport == 'true') && (gstTransaction == null || gstTransaction == '')) {
                                log.debug('Inside Remove Button');
                                form.removeButton('apply');
                            }

                            // form.clientScriptModulePath = 'SuiteScripts/TSS CS Customer Deposit.js';
                            form.clientScriptFileId = getfileId('TSS CS Customer Deposit.js');

                            if (gstTransaction) {

                                var statusvalue = getGstStatus(gstTransaction)
                                log.debug('statusvalue', statusvalue);

                                if (statusvalue == 'Voided') {
                                    form.addButton({
                                        id: 'custpage_create_journal',
                                        label: 'Create Journal',
                                        functionName: 'createJournal'
                                    });

                                    form.removeButton('apply');

                                }

                            }
                            else {
                                form.addButton({
                                    id: 'custpage_create_journal',
                                    label: 'Create Journal',
                                    functionName: 'createJournal'
                                });
                            }



                        }


                    }
                }
                if (scriptContext.type == scriptContext.UserEventType.EDIT) {
                    var form = scriptContext.form;
                    var rec = scriptContext.newRecord;
                    var gstTransaction = rec.getValue({ fieldId: 'custbody_tss_lut_journal_invoice' });

                    if (!gstTransaction) return; // no GST txn linked
                    let allowVoid = false;

                    if (!gstTransaction) {
                        allowVoid = true; // no GST txn linked
                    } else if (getGstStatus(gstTransaction) == 'Voided') {
                        allowVoid = true; // GST JE is voided
                    }



                    if (!allowVoid) {

                        form.removeButton({ id: 'void' });
                    }
                }

            } catch (error) {
                log.debug("Error in before load", error);

            }
        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {
            if (!serverHelper.checkSubscription()) {
                log.debug("TaxPro UE beforeSubmit", "Subscription check failed - blocking execution");
                return true;
            }

            log.debug("scriptContext.type", scriptContext.type);

            const rec = scriptContext.newRecord;
            var recType = scriptContext.newRecord.type;
            log.debug("recType beforeSubmit", recType);

            var globalParRec = GettingGlobalParameter()
            var recSub = rec.getValue({ fieldId: 'subsidiary' })
            if (inArray(recSub, globalParRec[0]) == parseInt(1)) {
                if (formSetFlag) {
                    var customFormsObj = ''
                    var accountId = runtime.accountId;
                    log.debug('Account ID', accountId);
                    if (accountId.endsWith('_SB1')) {
                        customFormsObj = customFormsObjSb// SB3
                    }
                    else if (runtime.envType === runtime.EnvType.PRODUCTION) {
                        customFormsObj = customFormsObjProd
                        // console.log('Production');
                    }
                    var rec_form = rec.getValue({ fieldId: "customform" });
                    if ((rec_form != customFormsObj[rec.type]) && (_logValidation(customFormsObj[rec.type]))) {
                        rec.setValue({ fieldId: "customform", value: customFormsObj[rec.type] });
                    }
                }
            }



            const validateGst = (status) => {
                if (status !== 'Voided') {
                    throw error.create({
                        name: 'GST_NOT_VOIDED',
                        message: 'Journal has been linked to current Transaction, Please Void the Journal and try to delete the Transaction.'
                    });
                }
            };




            if (scriptContext.type === scriptContext.UserEventType.DELETE) {
                const gstTransaction = scriptContext.oldRecord.getValue({ fieldId: 'custbody_tss_lut_journal_invoice' });
                // if (!gstTransaction) return;
                if (gstTransaction) {
                    const status = getGstStatus(gstTransaction);
                    validateGst(status);
                }
            }

        };

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {
            try {
                if (!serverHelper.checkSubscription()) {
                    log.debug("TaxPro UE afterSubmit", "Subscription check failed - blocking execution");
                    return true;
                }
                var recType = scriptContext.newRecord.type;
                log.debug("recType afterSubmit", recType);
                log.debug("scriptContext afterSubmit", scriptContext);
                var globalParRec = GettingGlobalParameter()
                log.debug("globalParRec afterSubmit", globalParRec);
                if (recType == 'depositapplication') {
                    // var depositRec = scriptContext.newRecord;
                    var depositRec = record.load({
                        type: scriptContext.newRecord.type,
                        id: scriptContext.newRecord.id
                    })
                    var recSub = depositRec.getValue({ fieldId: 'subsidiary' })
                    log.debug("recSub afterSubmit", recSub);
                    log.debug("inArray(recSub, globalParRec[0]) afterSubmit", inArray(recSub, globalParRec[0]));
                    if (inArray(recSub, globalParRec[0]) == parseInt(1)) {
                        var depositId = depositRec.id;
                        log.debug("depositId", depositId);
                        // Creating Flag 
                        var tobeSave = false
                        var applyTax = depositRec.getValue({ fieldId: 'custbody_tss_it_apply_gst' })
                        log.debug("applyTax aftersubmit", applyTax)
                        var taxCode = depositRec.getValue({ fieldId: 'custbody_tss_it_tax_code' })
                        log.debug("taxCode aftersubmit", taxCode)
                        if (taxCode && applyTax) {
                            var gstCode = ''
                            if (taxCode) {
                                let result = search.create({
                                    type: "taxgroup",
                                    filters: [["internalid", "anyof", taxCode]],
                                    columns: [search.createColumn({ name: "taxtype" })]
                                }).run().getRange({ start: 0, end: 1 })[0];
                                gstCode = result ? result.getText({ name: 'taxtype' }) : '';
                            }

                            var totalAmt = depositRec.getValue({ fieldId: 'total' })
                            log.debug("total aftersubmit", totalAmt)
                            var appliedAmt = depositRec.getValue({ fieldId: 'applied' })
                            log.debug("applied", appliedAmt)
                            var unApplied = parseFloat(depositRec.getValue({ fieldId: 'unapplied' }) || 0)
                            log.debug("unapplied", unApplied)
                            var gstObj = depositRec.getValue({ fieldId: 'custbody_tss_it_appliedamt_withouttax' })
                            log.debug("GST JSON", gstObj)
                            if (gstObj) {
                                gstObj = JSON.parse(gstObj.replace(/'/g, '"'));
                            } else {
                                gstObj = { gstamt: 0, gstinvoice: {}, gstrefund: {} };
                            }

                            var taxRate = depositRec.getValue({ fieldId: 'custbody_tss_it_taxrate' })

                            // Line count of Apply sublist
                            var appliLineCount = depositRec.getLineCount({ sublistId: 'apply' });
                            log.debug("appliLineCount aftersubmit", appliLineCount)
                            var gstAmtTotal = 0;
                            var taxAmtTotal = 0
                            var gstinvoice = {}
                            var gstrefund = {}
                            var gstObjNew = {}
                            for (var i = 0; i < appliLineCount; i++) {
                                var isApplied = depositRec.getSublistValue({
                                    sublistId: 'apply',
                                    fieldId: 'apply',
                                    line: i
                                });
                                if (isApplied) {
                                    var lineTranId = depositRec.getSublistValue({
                                        sublistId: 'apply',
                                        fieldId: 'doc',
                                        line: i
                                    });
                                    var amount = parseFloat(depositRec.getSublistValue({
                                        sublistId: 'apply',
                                        fieldId: 'amount',
                                        line: i
                                    }) || 0);
                                    var tranType = depositRec.getSublistValue({
                                        sublistId: 'apply',
                                        fieldId: 'trantype',
                                        line: i
                                    });
                                    var baseAmt = parseFloat(amount) / (1 + parseFloat(taxRate) / 100).toFixed(2) || 0
                                    var invTaxAmt = (parseFloat(amount) - parseFloat(baseAmt)).toFixed(2) || 0;
                                    if (tranType == 'CustRfnd') {
                                        gstrefund[lineTranId] = { taxamt: invTaxAmt, baseamt: baseAmt }
                                    }
                                    else if (tranType == 'CustInvc') {
                                        gstinvoice[lineTranId] = { taxamt: invTaxAmt, baseamt: baseAmt }
                                    }
                                    taxAmtTotal += invTaxAmt
                                    gstAmtTotal += baseAmt
                                }

                            }

                            //Loading the currrent deposit application transaction 
                            var depAppRec = record.load({
                                type: 'depositapplication',
                                id: depositId,
                                isDynamic: false
                            });

                            //Checking whether current record to be update with tax fields are not
                            if (parseFloat(gstObj.gstamt) != parseFloat(gstAmtTotal)) {
                                //Need to update following fields in current tranaction
                                tobeSave = true

                                gstObjNew = { gstamt: gstAmtTotal.toFixed(2), gstinvoice: gstinvoice, gstrefund: gstrefund };

                                //Updating the Deposit Application trasnaction tax fields
                                depAppRec.setValue({
                                    fieldId: 'custbody_tss_it_appliedamt_withouttax',
                                    value: JSON.stringify(gstObjNew),
                                    // ignoreFieldChange: true
                                });
                                applyGstSplit(depAppRec, gstCode, taxAmtTotal)
                                depAppRec.setValue({
                                    fieldId: 'custbody_tss_it_taxamount',
                                    value: taxAmtTotal,
                                    ignoreFieldChange: true
                                });

                            }

                            if (scriptContext.type === scriptContext.UserEventType.CREATE) {
                                var IsExport = depositRec.getValue({ fieldId: 'custbody_tss_export_gst' });
                                log.debug("IsExport", IsExport);

                                if (IsExport) {
                                    var GSTvalue = depositRec.getValue({ fieldId: 'custbody_tss_lut_journal_invoice' });
                                    log.debug("GSTvalue", GSTvalue)
                                    if (!GSTvalue) {
                                        var jeId = ReverseJournal(depositRec, depositId);
                                        log.debug("jeId", jeId)
                                        if (jeId) {
                                            log.debug("Inside if jeId", jeId)
                                            // record.submitFields({
                                            //     type: 'depositapplication',
                                            //     id: depositId,
                                            //     values: {
                                            //         custbody_tss_lut_journal_invoice: value
                                            //     },
                                            //     options: {
                                            //         enableSourcing: false,
                                            //         ignoreMandatoryFields: true
                                            //     }
                                            // });
                                            // var depAppRec = record.load({
                                            //     type: 'depositapplication',
                                            //     id: depositId,
                                            //     isDynamic: false
                                            // });

                                            //Need to update following fields in current tranaction
                                            tobeSave = true

                                            depAppRec.setValue({
                                                fieldId: 'custbody_tss_lut_journal_invoice',
                                                value: jeId
                                            });

                                            // depAppRec.save({
                                            //     enableSourcing: false,
                                            //     ignoreMandatoryFields: true
                                            // });

                                        } else {
                                            // record.submitFields({
                                            //     type: 'depositapplication',
                                            //     id: depositId,
                                            //     values: {
                                            //         status: 'Voided' // 🔥 Make sure this is the correct field for Deposit Application status
                                            //     },
                                            //     options: {
                                            //         enableSourcing: false,
                                            //         ignoreMandatoryFields: true
                                            //     }
                                            // });
                                            // var depAppRec = record.load({
                                            //     type: 'depositapplication',
                                            //     id: depositId,
                                            //     isDynamic: false
                                            // });

                                            //Need to update following fields in current tranaction
                                            tobeSave = true

                                            depAppRec.setValue({
                                                fieldId: 'status',
                                                value: 'Voided'
                                            });

                                            // depAppRec.save({
                                            //     enableSourcing: false,
                                            //     ignoreMandatoryFields: true
                                            // });
                                            throw error.create({
                                                name: 'JE_CREATION_FAILED',
                                                message: 'Deposit Application cannot be saved because Journal Entry creation failed. ' + e.message,
                                                notifyOff: false
                                            });
                                        }
                                    }


                                }
                            }
                            if (depAppRec) {
                                depAppRec.save({
                                    enableSourcing: false,
                                    ignoreMandatoryFields: true
                                });
                            }
                        }
                    }
                }
            } catch (e) {
                log.debug("Error in after submit", e);
            }





        }

        function ReverseJournal(Customerdeposit, depositId) {
            log.debug("Customerdeposit", Customerdeposit)

            var taxGroupId = Customerdeposit.getValue({ fieldId: 'custbody_tss_it_tax_code' });
            if (taxGroupId) {
                var taxGroup = record.load({
                    type: 'taxgroup',
                    id: taxGroupId
                });

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
            }
            var GSTPaidACcount = GettingGlobalParameter()

            // Example Journal Entry creation
            var je = record.create({ type: record.Type.JOURNAL_ENTRY, isDynamic: true });
            je.setValue({ fieldId: 'subsidiary', value: Customerdeposit.getValue({ fieldId: 'subsidiary' }) });
            je.setValue({ fieldId: 'currency', value: Customerdeposit.getValue({ fieldId: 'currency' }) });

            je.setValue({ fieldId: 'custbody_tss_lut_journal_invoice', value: depositId });


            // Debit line
            je.selectNewLine({ sublistId: 'line' });
            je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'account', value: parseInt(taxAccountMap['IGST']) }); // replace with account internalid
            je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'debit', value: parseFloat(Customerdeposit.getValue({ fieldId: 'custbody_tss_it_igst_amount' })).toFixed(2) });
            je.commitLine({ sublistId: 'line' });
            // Credit line
            je.selectNewLine({ sublistId: 'line' });
            je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'account', value: GSTPaidACcount[1] }); // replace with account internalid
            je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'credit', value: parseFloat(Customerdeposit.getValue({ fieldId: 'custbody_tss_it_taxamount' })).toFixed(2) });
            je.commitLine({ sublistId: 'line' });

            var jeId = je.save();
            return jeId;


        }

        const getGstStatus = (id) => {
            const gstFields = search.lookupFields({
                type: record.Type.JOURNAL_ENTRY,
                id: id,
                columns: ['status']
            });
            return gstFields.status && gstFields.status[0] ? gstFields.status[0].text : '';
        };

        function GettingGlobalParameter() {
            var GlobalSubsidiary = ''
            var GlobalGSTpaid = ''

            var GlobalParameterSearch = search.create({
                type: "customrecord_tss_global_parameter",
                filters: [["isinactive", "is", "F"]],
                columns: [
                    search.createColumn({ name: "internalid", label: "Internalid" }),
                    search.createColumn({ name: "custrecord_tss_gp_subsidiary", label: "Internalid" }),
                    search.createColumn({ name: "custrecord_tss_gp_lut_gstrefund", label: "Internalid" }),

                ]
            });
            var GlobalParameterSearchResults = GlobalParameterSearch.run().getRange({ start: 0, end: 1000 });
            if (GlobalParameterSearchResults.length > 0) {
                GlobalSubsidiary = GlobalParameterSearchResults[0].getValue({ name: 'custrecord_tss_gp_subsidiary' });
                GlobalGSTpaid = GlobalParameterSearchResults[0].getValue({ name: 'custrecord_tss_gp_lut_gstrefund' });

            }
            return [GlobalSubsidiary, GlobalGSTpaid]

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
        function applyGstSplit(depAppRec, gstCode, taxAmount) {
            if (gstCode.toUpperCase().includes("IGST")) {
                depAppRec.setValue({ fieldId: 'custbody_tss_it_igst_amount', value: parseFloat(taxAmount).toFixed(2), ignoreFieldChange: true });
                depAppRec.setValue({ fieldId: 'custbody_tss_cgst_amount', value: '', ignoreFieldChange: true });
                depAppRec.setValue({ fieldId: 'custbody_tss_it_sgst_amount', value: '', ignoreFieldChange: true });
            } else if (gstCode.toUpperCase().includes("GST")) {
                let half = parseFloat(taxAmount / 2).toFixed(2);
                var half2 = (taxAmount - half).toFixed(2)
                console.log("split amts", half + '-' + half2)
                depAppRec.setValue({ fieldId: 'custbody_tss_it_sgst_amount', value: Math.max(half, half2), ignoreFieldChange: true });
                depAppRec.setValue({ fieldId: 'custbody_tss_cgst_amount', value: Math.min(half, half2), ignoreFieldChange: true });
                depAppRec.setValue({ fieldId: 'custbody_tss_it_igst_amount', value: '', ignoreFieldChange: true });
            }
        }

        const getfileId = (clientScript) => {
            //we can make it as function to reuse.
            var search_folder = search.create({
                type: 'folder',
                filters: [{
                    name: 'name',
                    join: 'file',
                    operator: 'is',
                    values: clientScript
                }],
                columns: [
                    {
                        name: 'internalid',
                        join: 'file'
                    },
                    {
                        name: 'url',
                        join: 'file'
                    }
                ]
            });
            var searchFolderId = '';
            search_folder.run().each(function (result) {
                searchFolderId = result.getValue({
                    name: 'internalid',
                    join: 'file'
                });
                return true;
            });
            log.debug('Client Script Id', searchFolderId)
            return searchFolderId;
        }

        return { beforeLoad, beforeSubmit, afterSubmit }

    });