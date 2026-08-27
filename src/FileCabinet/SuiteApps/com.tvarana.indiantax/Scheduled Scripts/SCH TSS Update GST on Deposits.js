/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
/**
 * Script Name               : SCH TSS Update GST on Deposits
 * Script Author             : MNR Krishna
 * Script Type               : Scheduled Script 
 * Script Version            : 2.1
 * Script Created date       : 15/10/2025
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        : This script will update customer Deposit Application transaction with valid GST fields data when Customer refund applies to deposit/deposit Application
 */
define(['N/record', 'N/search', 'N/runtime', 'N/transaction'],
    /**
 * @param{record} record
 * @param{search} search
 */
    (record, search, runtime, transaction) => {

        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        const execute = (scriptContext) => {
            try {
                var toBeSchedule = runtime.getCurrentScript().getParameter({ name: 'custscript_update_cda' });
                log.debug("toBeSchedule", toBeSchedule)
                var refundIdArr = runtime.getCurrentScript().getParameter({ name: 'custscript_cr_id' }) || [];
                refundIdArr = JSON.parse(refundIdArr)
                var refundId = refundIdArr[0]
                log.debug("refundId", refundId)
                if (toBeSchedule && refundId) {
                    var refundRec = record.load({
                        type: 'customerrefund',
                        id: refundId
                    });
                    var appliLineCount = refundRec.getLineCount({ sublistId: 'apply' });
                    log.debug("appliLineCount ", appliLineCount)
                    for (var j = 0; j < appliLineCount; j++) {
                        var isApplied = refundRec.getSublistValue({
                            sublistId: 'apply',
                            fieldId: 'apply',
                            line: j
                        });
                        if (isApplied) {
                            var lineTranId = refundRec.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'trantype',
                                line: j
                            });
                            var cdaId = refundRec.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'doc',
                                line: j
                            });
                            log.debug("lineTranId", lineTranId)
                            if (lineTranId == 'DepAppl') {
                                log.debug("yes, need to update deposit application", cdaId)
                                // Calling the function to update customer deposit application
                                updateCDA(cdaId)
                            }
                        }
                    }

                    // Updating un applied deposit applications
                    for (var i = 0; i < refundIdArr[1].length; i++) {
                        log.debug("yes unapplied, need to update deposit application", refundIdArr[1][i])
                        // Calling the function to update customer deposit application
                        updateCDA(refundIdArr[1][i])
                    }

                }
            } catch (error) {
                log.error("Error in scheduled script SCH TSS Update GST on Deposits ", error)
            }
        }

        // Custom Functions
        function applyGstSplit(depositRec, gstCode, taxAmount) {
            if (gstCode.toUpperCase().includes("IGST")) {
                depositRec.setValue({ fieldId: 'custbody_tss_it_igst_amount', value: parseFloat(taxAmount).toFixed(2), ignoreFieldChange: true });
                depositRec.setValue({ fieldId: 'custbody_tss_cgst_amount', value: '', ignoreFieldChange: true });
                depositRec.setValue({ fieldId: 'custbody_tss_it_sgst_amount', value: '', ignoreFieldChange: true });
            } else if (gstCode.toUpperCase().includes("GST")) {
                let half = parseFloat(taxAmount / 2).toFixed(2);
                var half2 = (taxAmount - half).toFixed(2)
                log.debug("split amts", half + '-' + half2)
                depositRec.setValue({ fieldId: 'custbody_tss_it_sgst_amount', value: Math.max(half, half2), ignoreFieldChange: true });
                depositRec.setValue({ fieldId: 'custbody_tss_cgst_amount', value: Math.min(half, half2), ignoreFieldChange: true });
                depositRec.setValue({ fieldId: 'custbody_tss_it_igst_amount', value: '', ignoreFieldChange: true });
            }
        }

        function updateCDA(cdaId) {
            var depositRec = record.load({
                type: 'depositapplication',
                id: cdaId
            });
            var appliedAmt = depositRec.getValue({ fieldId: 'applied' }) || 0
            if (parseFloat(appliedAmt) > 0) {
                var gstObj = depositRec.getValue({ fieldId: 'custbody_tss_it_appliedamt_withouttax' })
                log.debug("GST JSON", gstObj)
                if (gstObj) {
                    gstObj = JSON.parse(gstObj.replace(/'/g, '"'));
                } else {
                    gstObj = { gstamt: 0, gstinvoice: {}, gstrefund: {} };
                }
                log.debug("gstObj", gstObj)
                var taxRate = depositRec.getValue({ fieldId: 'custbody_tss_it_taxrate' })
                var taxCode = depositRec.getValue({ fieldId: 'custbody_tss_it_tax_code' })
                log.debug("taxCode", taxCode)
                var gstCode = ''
                if (taxCode) {
                    let result = search.create({
                        type: "taxgroup",
                        filters: [["internalid", "anyof", taxCode]],
                        columns: [search.createColumn({ name: "taxtype" })]
                    }).run().getRange({ start: 0, end: 1 })[0];
                    gstCode = result ? result.getText({ name: 'taxtype' }) : '';
                }

                var appliedLines = 0

                var appliLineCount1 = depositRec.getLineCount({ sublistId: 'apply' });
                log.debug("appliLineCount1", appliLineCount1)
                if (appliLineCount1 > 0) {
                    var gstAmtTotal = 0;
                    var taxAmtTotal = 0
                    var gstinvoice = {}
                    var gstrefund = {}
                    var gstObjNew = {}
                    for (var i = 0; i < appliLineCount1; i++) {
                        var isApplied1 = depositRec.getSublistValue({
                            sublistId: 'apply',
                            fieldId: 'apply',
                            line: i
                        });
                        if (isApplied1) {
                            var lineTranId1 = depositRec.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'doc',
                                line: i
                            });
                            log.debug("lineTranId1", lineTranId1)
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
                            var baseAmt = (parseFloat(amount) / (1 + parseFloat(taxRate) / 100)).toFixed(2) || 0
                            log.debug("baseAmt", baseAmt)
                            var invTaxAmt = (parseFloat(amount) - parseFloat(baseAmt)).toFixed(2) || 0;
                            log.debug("invTaxAmt", invTaxAmt)
                            if (tranType == 'CustRfnd') {
                                gstrefund[lineTranId1] = { taxamt: invTaxAmt, baseamt: baseAmt }
                            }
                            else if (tranType == 'CustInvc') {
                                gstinvoice[lineTranId1] = { taxamt: invTaxAmt, baseamt: baseAmt }
                            }
                            log.debug("gstrefund", gstrefund)
                            log.debug("gstinvoice", gstinvoice)
                            taxAmtTotal = (parseFloat(taxAmtTotal) + parseFloat(invTaxAmt)).toFixed(2)
                            gstAmtTotal = (parseFloat(gstAmtTotal) + parseFloat(baseAmt)).toFixed(2)
                            appliedLines++
                        }

                    }
                    log.debug("taxAmtTotal", taxAmtTotal)
                    log.debug("gstAmtTotal", gstAmtTotal)
                    log.debug("appliedLines", appliedLines)
                    //Checking whether current record to be update with tax fields are not
                    if (parseFloat(gstObj.gstamt) != parseFloat(gstAmtTotal) || appliedLines == 1) {

                        //Getting Amount Without Tax from Custpomer Deposit
                        var depositID = depositRec.getValue({ fieldId: 'deposit' })
                        var amtWthoutTax = search.lookupFields({
                            type: "customerdeposit",
                            id: depositID,
                            columns: ['custbody_tss_it_amount_withouttax']
                        });

                        //Updating the Amount Without Tax field
                        depositRec.setValue({
                            fieldId: 'custbody_tss_it_amount_withouttax',
                            value: parseFloat(amtWthoutTax.custbody_tss_it_amount_withouttax).toFixed(2),
                            ignoreFieldChange: true
                        });


                        gstObjNew = { gstamt: parseFloat(gstAmtTotal).toFixed(2), gstinvoice: gstinvoice, gstrefund: gstrefund };

                        //Updating the Deposit Application trasnaction tax fields
                        depositRec.setValue({
                            fieldId: 'custbody_tss_it_appliedamt_withouttax',
                            value: JSON.stringify(gstObjNew),
                            // ignoreFieldChange: true
                        });
                        applyGstSplit(depositRec, gstCode, taxAmtTotal)
                        depositRec.setValue({
                            fieldId: 'custbody_tss_it_taxamount',
                            value: taxAmtTotal,
                            ignoreFieldChange: true
                        });

                        var depositAppId = depositRec.save({
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        });
                        log.debug("Updated the tax fields in deposit Application, ID - ", depositAppId)
                    }
                }
                else {
                    // Void the Customer Deposit Application if there is no transactions applied
                    // var voidcda = transaction.void({
                    //     type: 'depositapplication', //disable Void Transactions Using Reversing Journals in Account Pref
                    //     id: cdaId
                    // });
                    //Actually not able to void this transcation in script.
                }
            }
            else {
                // Void the Customer Deposit Application if there is no transactions applied
                // var voidcda = transaction.void({
                //     type: 'depositapplication', //disable Void Transactions Using Reversing Journals in Account Pref
                //     id: cdaId
                // });
            }
        }
        return { execute }

    });
