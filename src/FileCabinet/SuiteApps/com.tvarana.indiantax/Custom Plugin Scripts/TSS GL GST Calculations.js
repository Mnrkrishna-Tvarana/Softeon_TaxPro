/**
 * @NApiVersion 2.1
 * @NScriptType CustomGLPlugin
 */
define(['N/record', 'N/search', 'N/log', '/SuiteApps/com.tvarana.indiantax/Other Files/TSS TaxPro Server Helper'], (record, search, log, serverHelper) => {

    function customizeGlImpact(context) {
        try {
            // Always first line — checks subscription
            if (!serverHelper.checkSubscription()) {
                log.debug("TaxPro GST Calculation Plugin", "Subscription check failed - blocking execution");
                return true;
            }
            log.debug("context ", context)
            //search on previous prepayments if yes then calculate the amount and display alert
            log.debug('Custom GL Impact', 'Started');

            var transactionRecord = context.transactionRecord;
            var recordType = transactionRecord.type;
            var isGst = transactionRecord.getValue({ fieldId: 'custbody_tss_it_apply_gst' });
            var transSubsidiary = transactionRecord.getValue({ fieldId: 'subsidiary' });
            var indianTaxGlobalParamId
            var entityId;
            var advancesPaidGstAccountId = transactionRecord.getValue({ fieldId: 'prepaymentaccount' });
            var categoryId = 3;

            // var categoryName = 'Tax agency';

            // // search to get vendor category internal ID
            // var categorySearch = search.create({
            //     type: "vendorcategory",
            //     filters: [
            //         ["name", "is", categoryName],
            //         "AND",
            //         ["isinactive", "is", "F"]
            //     ],
            //     columns: [
            //         search.createColumn({ name: "internalid" }),
            //         search.createColumn({ name: "name" })
            //     ]
            // });

            // var resultSet = categorySearch.run().getRange({ start: 0, end: 1 });
            // if (resultSet && resultSet.length > 0) {
            //     categoryId = resultSet[0].getValue({ name: "internalid" });
            //     var categoryLabel = resultSet[0].getValue({ name: "name" });

            //     log.debug("Vendor Category Found", "ID: " + categoryId + " | Name: " + categoryLabel);
            // } else {
            //     log.debug("Vendor Category Search", "No category found with name: " + categoryName);
            // }


            //search to get vendor internal ID (Default Tax Agency IN)
            var vendorSearchObj = search.create({
                type: "vendor",
                filters: [
                    ["category", "anyof", categoryId],
                    "AND",
                    ["subsidiary", "anyof", transSubsidiary],
                    "AND",
                    ["isinactive", "is", "F"]
                ],
                columns: [
                    search.createColumn({ name: "internalid" }),
                    search.createColumn({ name: "entityid" })
                ]
            });

            var searchResult = vendorSearchObj.run().getRange({ start: 0, end: 1 });
            if (searchResult && searchResult.length > 0) {
                entityId = searchResult[0].getValue({ name: "internalid" });
                var vendorName = searchResult[0].getValue({ name: "entityid" });

                log.debug("Vendor Found", "ID: " + entityId + " | Name: " + vendorName);
            } else {
                log.debug("Vendor Search", "No vendor found for subsidiary " + transSubsidiary);
            }


            //search to get global parameter internal ID
            var customrecord_tss_global_parameterSearchObj = search.create({
                type: "customrecord_tss_global_parameter",
                filters: [
                    ["isinactive", "is", "F"]
                ],
                columns: [
                    search.createColumn({ name: "internalid", label: "Internal ID" })
                ]
            });

            var results = customrecord_tss_global_parameterSearchObj.run().getRange({ start: 0, end: 1 });

            if (results && results.length > 0) {
                indianTaxGlobalParamId = results[0].getValue({ name: "internalid" });
                log.debug("indianTaxGlobalParamId", indianTaxGlobalParamId);
            } else {
                log.debug("No Results Found for subsidiary in global parameters record");
            }

            //Lookup to get allowed subsidiary from Global Parameters
            var globalParams = search.lookupFields({
                type: 'customrecord_tss_global_parameter',
                id: indianTaxGlobalParamId,
                columns: ['custrecord_tss_gp_subsidiary']
            });
            log.debug("globalParams", globalParams);
            //   var allowedSubsidiary = globalParams.custrecord_tss_gp_subsidiary.length
            //     ? globalParams.custrecord_tss_gp_subsidiary[0].value
            //     : null;

            var gpSubsList = globalParams.custrecord_tss_gp_subsidiary || [];

            var allowedSubsidiary = null;

            gpSubsList.forEach(function (sub) {
                if (sub && sub.value == transSubsidiary) {
                    allowedSubsidiary = sub.value;
                }
            });

            log.debug("Details", {
                recordType: recordType,
                isGst: isGst,
                transSubsidiary: transSubsidiary,
                allowedSubsidiary: allowedSubsidiary,
                advancesPaidGstAccountId: advancesPaidGstAccountId
            });

            if ((isGst == 'T' || isGst == 'true' || isGst == true) && (allowedSubsidiary && transSubsidiary == allowedSubsidiary)) {
                var taxGroup = transactionRecord.getValue({ fieldId: 'custbody_tss_it_tax_code' });
                var memo = 'VAT'
                log.debug("Tax Group", taxGroup);
                if (taxGroup) {

                    var taxGroup = record.load({
                        type: 'taxgroup',
                        id: taxGroup
                    })
                    var taxItemLineCount = taxGroup.getLineCount({
                        sublistId: 'taxitem'
                    })
                    var taxItemsArray = [];
                    for (var i = 0; i < taxItemLineCount; i++) {
                        var taxItemId = taxGroup.getSublistValue({
                            sublistId: 'taxitem',
                            fieldId: 'taxname',
                            line: i
                        })
                        var taxType = taxGroup.getSublistText({
                            sublistId: 'taxitem',
                            fieldId: 'taxtype',
                            line: i
                        })
                        if (taxItemId) {
                            taxItemsArray.push({
                                taxItemId: taxItemId,
                                taxType: taxType
                            });
                        }
                    }


                    // Lookup Tax Code record
                    taxItemsArray.forEach(function (item) {
                        var taxItemDetails = search.lookupFields({
                            type: "salestaxitem",
                            id: item.taxItemId,
                            columns: ['purchaseaccount'] //  account field on sales tax item
                        });

                        var accountId = taxItemDetails.purchaseaccount[0].value || 0;
                        item.accountId = accountId;
                    });
                    log.debug("Final Tax Items with Accounts", taxItemsArray);

                    // var advancesPaidGstAccountId = context.standardLines.getLine({ index: 1 }).accountId
                    var totalGstAmout = 0;
                    var accountInternalId;
                    var stdLine = context.standardLines.getLine({ index: 0 });
                    var entityIdAdvPaidAccount = stdLine.entityId;

                    // Loop through your tax items array
                    taxItemsArray.forEach(function (taxItem) {
                        if (taxItem.taxType.includes("IGST")) {
                            var igstAmount = roundAmount(transactionRecord.getValue({ fieldId: 'custbody_tss_it_igst_amount' }));
                            if (igstAmount > 0 && taxItem.accountId) {
                                var igstLine = context.customLines.addNewLine();
                                igstLine.accountId = taxItem.accountId
                                if (entityId) { igstLine.entityId = entityId }
                                if (memo) { igstLine.memo = memo }
                                if (recordType == 'vendorprepayment') {
                                    igstLine.debitAmount = igstAmount
                                } else {
                                    igstLine.creditAmount = igstAmount
                                }
                                totalGstAmout += roundAmount(igstAmount);

                                log.debug("IGST Line Added", taxItem);
                            }

                        } else if (taxItem.taxType.includes("CGST")) {
                            var cgstAmt = transactionRecord.getValue({ fieldId: 'custbody_tss_cgst_amount' });
                            if (cgstAmt > 0 && taxItem.accountId) {
                                var cgstLine = context.customLines.addNewLine();
                                cgstLine.accountId = taxItem.accountId
                                if (entityId) { cgstLine.entityId = entityId }
                                if (memo) { cgstLine.memo = memo }
                                if (recordType == 'vendorprepayment') {
                                    cgstLine.debitAmount = cgstAmt
                                } else {
                                    cgstLine.creditAmount = cgstAmt
                                }
                                totalGstAmout += roundAmount(cgstAmt);
                                log.debug("CGST Line Added", taxItem);
                            }

                        } else if (taxItem.taxType.includes("SGST")) {
                            var sgstAmt = transactionRecord.getValue({ fieldId: 'custbody_tss_it_sgst_amount' });
                            if (sgstAmt > 0 && taxItem.accountId) {
                                var sgstLine = context.customLines.addNewLine();
                                sgstLine.accountId = taxItem.accountId
                                if (entityId) { sgstLine.entityId = entityId }
                                if (memo) { sgstLine.memo = memo }
                                if (recordType == 'vendorprepayment') {
                                    sgstLine.debitAmount = sgstAmt
                                } else {
                                    sgstLine.creditAmount = sgstAmt
                                }
                                totalGstAmout += roundAmount(sgstAmt);
                                log.debug("SGST Line Added", taxItem);
                            }
                        }
                    });
                    if (totalGstAmout > 0) {
                        var advGstLine = context.customLines.addNewLine();
                        advGstLine.accountId = advancesPaidGstAccountId;
                        if (entityIdAdvPaidAccount) { advGstLine.entityId = entityIdAdvPaidAccount };
                        if (memo) { advGstLine.memo = memo };
                        if (recordType == 'vendorprepayment') {
                            advGstLine.creditAmount = totalGstAmout;
                        } else {
                            advGstLine.debitAmount = totalGstAmout;
                        }
                        log.debug("Advance GST Line Added", advancesPaidGstAccountId);

                    }

                } else {
                    log.debug("No tax group found on transaction.");
                }

            }

            log.debug('Custom GL Impact', 'Completed');

        } catch (error) {
            log.error('Error in customizeGlImpact', error);
        }
    }


    function roundAmount(value) {
        return Math.round(parseFloat(value || 0) * 100) / 100;
    }

    return {
        customizeGlImpact
    };
});