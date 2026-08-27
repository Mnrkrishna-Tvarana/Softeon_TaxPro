/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/currentRecord', 'N/record', 'N/search', 'N/ui/dialog'],

    function (currentRecord, record, search, dialog) {

        /**
         * Function to be executed after page is initialized.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
         *
         * @since 2015.2
         */
        var Previousfieldvalue = '';
        var cachedGlobalSubsidiary = null;
        var gstCode = ''

        function pageInit(scriptContext) {
            try {
                var currentRec = scriptContext.currentRecord;
                var currentRecId = currentRec.id;
                cachedGlobalSubsidiary = GettingGlobalParameter();
                var gstCodevalue = currentRec.getValue({ fieldId: 'custbody_tss_it_tax_code' })
                if (gstCodevalue) {
                    var taxgroupSearchObj = search.create({
                        type: "taxgroup",
                        filters:
                            [
                                ["internalid", "anyof", gstCodevalue]
                            ],
                        columns:
                            [
                                search.createColumn({ name: "itemid", label: "Name" }),
                                search.createColumn({ name: "rate", label: "Rate" }),
                                search.createColumn({ name: "country", label: "Country" }),
                                search.createColumn({ name: "taxtype", label: "Tax Type" })
                            ]
                    });
                    var taxgroupSearchObjResults = taxgroupSearchObj.run().getRange({ start: 0, end: 1000 });
                    if (taxgroupSearchObjResults.length > 0) {
                        gstCode = taxgroupSearchObjResults[0].getText({ name: 'taxtype' });
                        log.debug("gstCode", gstCode)

                    }

                }

                window.setTimeout(function () {
                    var autoApplyBtn = document.querySelector('input[name="autoapply"]');
                    if (autoApplyBtn) {
                        autoApplyBtn.addEventListener("click", function () {
                            console.log("Auto Apply button clicked!");

                            // small delay so NetSuite applies bills first
                            setTimeout(function () {
                                handleAutoApply(currentRec);
                            }, 500);
                        });
                    }

                    var clearBtn = document.querySelector('input[name="clear"]');
                    if (clearBtn) {
                        clearBtn.addEventListener("click", function () {
                            console.log("Clear button clicked!");
                            setTimeout(function () {
                                resetGST(currentRec);
                            }, 500);
                        });
                    }
                }, 1000);
                /* Disabling the field in page load */
                var gstFieldsConfig = [
                    { id: 'custbody_tss_it_amount_withouttax' },
                    { id: 'custbody_tss_it_apply_gst' },
                    { id: 'custbody_tss_it_tax_code' },
                    { id: 'custbody_tss_it_taxrate' },
                    { id: 'custbody_tss_it_taxamount' },
                    { id: 'custbody_tss_it_igst_amount' },
                    { id: 'custbody_tss_it_sgst_amount' },
                    { id: 'custbody_tss_cgst_amount' }
                ];

                gstFieldsConfig.forEach(function (field) {
                    var fld = currentRec.getField({ fieldId: field.id });
                    fld.isDisabled = true;

                });
                /* Disabling the field in page load */


                var prepaymentId = currentRec.getValue({ fieldId: 'vendorprepayment' });
                console.log('Vendor Prepayment ID', prepaymentId);
                var filters;
                if (currentRecId) {
                    filters = [
                        ['internalid', 'noneof', currentRecId], "AND",
                        ['appliedtotransaction', 'is', prepaymentId],
                        "AND",
                        ['appliedtotransaction.type', 'anyof', ['VPrep']]

                    ]
                } else {
                    filters = [
                        ['appliedtotransaction', 'is', prepaymentId],
                        "AND",
                        ['appliedtotransaction.type', 'anyof', ['VPrep']]
                    ]
                }
                if (prepaymentId) {
                    var totalBaseAmt = 0;
                    var prepaymentSearch = search.create({
                        type: 'vendorprepaymentapplication',
                        filters: filters,
                        columns: [
                            search.createColumn({ name: 'custbody_tss_it_appliedamt_withouttax' })
                        ]
                    });
                    var foundResults = false;
                    prepaymentSearch.run().each(function (result) {
                        foundResults = true;
                        var rawValue = result.getValue('custbody_tss_it_appliedamt_withouttax');
                        log.debug("rawValue", rawValue)
                        var parsed, baseAmt = 0;
                        if (rawValue) {
                            parsed = JSON.parse(rawValue.replace(/'/g, '"'));
                            Previousfieldvalue = JSON.stringify(parsed)
                        } else {
                            parsed = { gstamt: 0, gstbills: {} };
                            Previousfieldvalue = JSON.stringify(parsed)
                        }
                        if (parsed.gstamt) {
                            baseAmt = parseFloat(parsed.gstamt) || 0;
                        }
                        totalBaseAmt += baseAmt;
                        return true;
                    });
                    console.log('totalBaseAmt', totalBaseAmt);
                    if (!foundResults) {
                        var parsed = { gstamt: 0, gstbills: {} };
                        Previousfieldvalue = JSON.stringify(parsed)
                    }
                    if (totalBaseAmt > 0) {
                        prevPrepaymentApplicationAmount = totalBaseAmt;
                    }
                }

            } catch (e) {
                log.error("Error in page init", e)
            }

        }

        /**
         * Function to be executed when field is changed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @since 2015.2
         */
        function fieldChanged(scriptContext) {
            try {
                var currentRec = scriptContext.currentRecord;

                var currentrecordsubsidiary = currentRec.getValue({ fieldId: "subsidiary" });
                var Flag = 0;
                Flag = inArray(currentrecordsubsidiary, cachedGlobalSubsidiary);
                if (Flag == parseInt(1)) {


                    appliedAmount = currentRec.getValue({ fieldId: 'applied' });

                    var CompareTaxcode = currentRec.getValue({ fieldId: "custbody_tss_it_tax_code" });
                    var CompareTaxRate = currentRec.getValue({ fieldId: "custbody_tss_it_taxrate" });
                    var CompareAmount = currentRec.getValue({ fieldId: "custbody_tss_it_amount_withouttax" });
                    var tdsRate = parseFloat(currentRec.getValue({ fieldId: "custbody_tss_tds_percentage" }) || 0);


                    console.log("CompareTaxData", { CompareTaxcode: CompareTaxcode, CompareTaxRate: CompareTaxRate, CompareAmount: CompareAmount })

                    if (CompareTaxcode) {
                        if (scriptContext.sublistId === 'bill' && (scriptContext.fieldId === 'apply' || scriptContext.fieldId === 'amount')) {

                            var line = scriptContext.line;
                            var isApplied = currentRec.getCurrentSublistValue({
                                sublistId: 'bill',
                                fieldId: 'apply'
                            });
                            var billId = currentRec.getSublistValue({
                                sublistId: 'bill',
                                fieldId: 'doc',
                                line: line
                            });
                            console.log("isApplied", isApplied)
                            console.log("billId", billId)

                            if (isApplied) {

                                if (billId) {
                                    try {
                                        var billRec = record.load({
                                            type: record.Type.VENDOR_BILL,
                                            id: billId
                                        });
                                        var lineCount = billRec.getLineCount({ sublistId: 'item' });
                                        var itemAmount = 0;
                                        var expenseAmount = 0;
                                        var allMatch = true;
                                        for (var i = 0; i < lineCount; i++) {
                                            var taxCode = billRec.getSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'taxcode',
                                                line: i
                                            });
                                            var taxRate = billRec.getSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'taxrate1',
                                                line: i
                                            });
                                            var taxline = billRec.getSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'custcol_tss_tdsline',
                                                line: i
                                            });
                                            if (taxline == 'F' || taxline == false || taxline == 'false') {

                                                var Amount = billRec.getSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'amount',
                                                    line: i
                                                });


                                                itemAmount += Amount
                                                if (isApplied) {
                                                    if (taxCode != CompareTaxcode) {
                                                        allMatch = false;
                                                        console.log("allMatch in item", allMatch)
                                                    }
                                                }

                                            }



                                            console.log('Bill Line ' + (i + 1) + ' → Tax Code: ' + taxCode + ', Tax Amount: ' + Amount);
                                        }
                                        var ExpenselineCount = billRec.getLineCount({ sublistId: 'expense' })
                                        for (var j = 0; j < ExpenselineCount; j++) {

                                            var taxCode = billRec.getSublistValue({
                                                sublistId: 'expense',
                                                fieldId: 'taxcode',
                                                line: j
                                            });
                                            var taxRate = billRec.getSublistValue({
                                                sublistId: 'expense',
                                                fieldId: 'taxrate1',
                                                line: j
                                            });
                                            var taxline = billRec.getSublistValue({
                                                sublistId: 'expense',
                                                fieldId: 'custcol_tss_tdsline',
                                                line: j
                                            });
                                            if (taxline == 'F' || taxline == false || taxline == 'false') {

                                                var ExpAmount = billRec.getSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'amount',
                                                    line: j
                                                });

                                                expenseAmount += ExpAmount
                                                if (isApplied) {
                                                    if (taxCode != CompareTaxcode) {
                                                        allMatch = false;

                                                    }
                                                }
                                            }



                                            console.log('Bill Line  in expense ' + (j + 1) + ' → Tax Code: ' + taxCode + ', Tax Rate: ' + taxRate + ', Tax Amount: ' + ExpAmount);
                                        }
                                        console.log("allMatch", allMatch)
                                        if (!allMatch) {
                                            dialog.alert({
                                                title: 'Alert',
                                                message: 'GST Tax Code is not matching with the Bill. Please Apply to the Valid Bill ',
                                            })
                                            currentRec.setCurrentSublistValue({
                                                sublistId: 'bill',
                                                fieldId: 'apply',
                                                value: false,
                                                // ignoreFieldChange: true
                                            });
                                            currentRec.setCurrentSublistValue({
                                                sublistId: 'bill',
                                                fieldId: 'amount',
                                                value: '',
                                                // ignoreFieldChange: true
                                            });
                                        } else {
                                            console.log("allMatch in else", allMatch)
                                            var FinalAmount = 0;
                                            console.log("itemAmount", itemAmount);
                                            console.log("expenseAmount", expenseAmount);
                                            // var total = parseFloat(itemAmount) + parseFloat(expenseAmount)
                                            // console.log("total", total)



                                            var fieldValue = Previousfieldvalue;
                                            console.log("fieldValue", fieldValue)

                                            var existingData = {};
                                            if (fieldValue) {

                                                existingData = JSON.parse(fieldValue);

                                            }
                                            log.debug("existingData", existingData)


                                            var Totalamount = parseFloat(existingData.gstamt) || 0;
                                            console.log("Totalamount", Totalamount)

                                            var AmountRemaining = CompareAmount - Totalamount
                                            console.log("AmountRemaining", AmountRemaining)
                                            var total = currentRec.getCurrentSublistValue({
                                                sublistId: 'bill',
                                                fieldId: 'amount'
                                            });
                                            console.log("total", total)

                                            if (AmountRemaining > 0) {

                                                // linebase = Math.min(total, AmountRemaining);
                                                // console.log("linebase", linebase)
                                                // var gstRate = parseFloat(currentRec.getValue({ fieldId: 'custbody_tss_it_taxrate' })) || 0;
                                                // var taxAmount = linebase * (gstRate / 100);
                                                // console.log("taxAmount", taxAmount)
                                                var gstCode = currentRec.getText({ fieldId: 'custbody_tss_it_tax_code' })





                                                var fieldValue = currentRec.getValue({ fieldId: 'custbody_tss_it_appliedamt_withouttax' });
                                                var existingData = {};

                                                if (fieldValue) {
                                                    try {
                                                        existingData = JSON.parse(fieldValue.replace(/'/g, '"'));
                                                    } catch (e) {
                                                        log.debug("JSON parse error, resetting", e);
                                                        existingData = { gstamt: 0, gstbills: {} };
                                                    }
                                                } else {
                                                    existingData = { gstamt: 0, gstbills: {} };
                                                }

                                                var prevTotal = parseFloat(existingData.gstamt) || 0;
                                                // var GSTAmount = prevTotal + (parseFloat(linebase) || 0);
                                                console.log("prevTotal", prevTotal)
                                                // console.log("GSTAmount", GSTAmount)


                                                var billInternalId = billId;

                                                // if (GSTAmount <= CompareAmount) {
                                                //     existingData.gstbills[billInternalId] = linebase;
                                                //     existingData.gstamt = GSTAmount;
                                                // } else {
                                                //     var allowedAmt = CompareAmount - prevTotal;
                                                //     console.log("allowedAmt", allowedAmt)


                                                //     if (allowedAmt > 0) {
                                                //         existingData.gstbills[billInternalId] = allowedAmt;
                                                //         existingData.gstamt = prevTotal + allowedAmt;

                                                //     }
                                                // }
                                                // console.log("linebase", linebase);
                                                console.log("CompareTaxRate", CompareTaxRate)
                                                var BillbaseAmt = (parseFloat(total) / (1 + parseFloat(CompareTaxRate - tdsRate) / 100)).toFixed(2)
                                                console.log("BillbaseAmt", BillbaseAmt)
                                                BillbaseAmt = Math.min(BillbaseAmt, AmountRemaining)
                                                console.log("BillbaseAmt final", BillbaseAmt)
                                                var billTaxAmt = ((parseFloat(CompareTaxRate) * parseFloat(BillbaseAmt)) / 100).toFixed(2);
                                                console.log("billTaxAmt", billTaxAmt)

                                                existingData.gstbills[billInternalId] = { "taxamt": parseFloat(billTaxAmt), "baseamt": parseFloat(BillbaseAmt) };

                                                // existingData.gstbills[billInternalId] = parseFloat(linebase) || 0;

                                                var newTotal = 0;
                                                for (var key in existingData.gstbills) {
                                                    if (existingData.gstbills.hasOwnProperty(key)) {
                                                        newTotal += parseFloat(existingData.gstbills[key]['baseamt']) || 0;

                                                        // newTotal += parseFloat(existingData.gstbills[key]) || 0;
                                                    }
                                                }
                                                existingData.gstamt = Math.min(newTotal, CompareAmount);



                                                currentRec.setValue({
                                                    fieldId: 'custbody_tss_it_appliedamt_withouttax',
                                                    value: JSON.stringify(existingData),
                                                    ignoreFieldChange: true
                                                });
                                                // var gstRate = parseFloat(currentRec.getValue({ fieldId: 'custbody_tss_it_taxrate' })) || 0;
                                                console.log(" existingData.gstamt", existingData.gstamt)
                                                var taxAmount = ((parseFloat(CompareTaxRate) * parseFloat(existingData.gstamt)) / 100).toFixed(2);

                                                currentRec.setValue({
                                                    fieldId: 'custbody_tss_it_taxamount',
                                                    value: taxAmount,
                                                    ignoreFieldChange: true
                                                });

                                                if (gstCode.toUpperCase().includes("GST") && !gstCode.toUpperCase().includes("IGST")) {
                                                    var halfTax = taxAmount / 2;
                                                    currentRec.setValue({ fieldId: 'custbody_tss_cgst_amount', value: halfTax, ignoreFieldChange: true });
                                                    currentRec.setValue({ fieldId: 'custbody_tss_it_sgst_amount', value: halfTax, ignoreFieldChange: true });
                                                    currentRec.setValue({ fieldId: 'custbody_tss_it_igst_amount', value: '', ignoreFieldChange: true });
                                                }


                                                if (gstCode.toUpperCase().includes("IGST")) {
                                                    currentRec.setValue({ fieldId: 'custbody_tss_it_igst_amount', value: taxAmount, ignoreFieldChange: true });
                                                    currentRec.setValue({ fieldId: 'custbody_tss_cgst_amount', value: '', ignoreFieldChange: true });
                                                    currentRec.setValue({ fieldId: 'custbody_tss_it_sgst_amount', value: '', ignoreFieldChange: true });


                                                }


                                            } else {
                                                currentRec.setValue({
                                                    fieldId: 'custbody_tss_it_taxamount',
                                                    value: 0,
                                                    ignoreFieldChange: true
                                                });
                                            }







                                        }

                                    } catch (e) {
                                        log.error("error in bill record ", e)
                                    }

                                }


                            }
                            if (!isApplied && billId) {
                                // ✅ Remove this bill from gstbills and re-calc gstamt
                                var fieldValue = currentRec.getValue({ fieldId: 'custbody_tss_it_appliedamt_withouttax' });
                                console.log("fieldValue", fieldValue)
                                var existingData = {};

                                if (fieldValue) {
                                    try {
                                        existingData = JSON.parse(fieldValue.replace(/'/g, '"'));
                                    } catch (e) {
                                        log.debug("JSON parse error, resetting", e);
                                        existingData = { gstamt: 0, gstbills: {} };
                                    }
                                } else {
                                    existingData = { gstamt: 0, gstbills: {} };
                                }

                                if (existingData.gstbills && existingData.gstbills[billId]) {
                                    // Subtract the removed bill’s value
                                    var removedAmt = parseFloat(existingData.gstbills[billId]['baseamt']) || 0;
                                    console.log("removedAmt", removedAmt)
                                    delete existingData.gstbills[billId];
                                    existingData.gstamt = Math.max(0, (parseFloat(existingData.gstamt) || 0) - removedAmt);
                                }
                                console.log("existingData in unapply", existingData)
                                // Save back to body field
                                currentRec.setValue({
                                    fieldId: 'custbody_tss_it_appliedamt_withouttax',
                                    value: JSON.stringify(existingData),
                                    ignoreFieldChange: true
                                });

                                // Also reset tax fields if nothing remains
                                if (existingData.gstamt <= 0) {
                                    currentRec.setValue({ fieldId: 'custbody_tss_it_taxamount', value: 0, ignoreFieldChange: true });
                                    currentRec.setValue({ fieldId: 'custbody_tss_it_igst_amount', value: '', ignoreFieldChange: true });
                                    currentRec.setValue({ fieldId: 'custbody_tss_cgst_amount', value: '', ignoreFieldChange: true });
                                    currentRec.setValue({ fieldId: 'custbody_tss_it_sgst_amount', value: '', ignoreFieldChange: true });
                                }
                            }

                        }
                    }
                }
            } catch (e) {
                log.error('Error in fieldchange ', e);
            }

        }



        /**
         * Validation function to be executed when record is saved.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @returns {boolean} Return true if record is valid
         *
         * @since 2015.2
         */
        function saveRecord(scriptContext) {

        }

        //     function handleAutoApply(currentRec) {
        //         try {

        //             var CompareTaxcode = currentRec.getValue({ fieldId: "custbody_tss_it_tax_code" });
        //             var CompareTaxRate = currentRec.getValue({ fieldId: "custbody_tss_it_taxrate" });

        //             if (CompareTaxcode) {
        //                 var lineCount = currentRec.getLineCount({ sublistId: 'bill' });
        //                 var existingData = { gstamt: 0, gstbills: {} };
        //                 var remainingAmt = parseFloat(currentRec.getValue({ fieldId: 'custbody_tss_it_amount_withouttax' }) || 0)
        //                 log.debug("remainingAmt in handleAutoApply", remainingAmt)
        //                 console.log("lineCount",lineCount)
        //                 for (var i = 0; i < lineCount; i++) {
        //                     var isApplied = currentRec.getSublistValue({
        //                         sublistId: 'bill',
        //                         fieldId: 'apply',
        //                         line: i
        //                     });
        //                     console.log("isApplied",isApplied)
        //  var allMatch = true;
        //                     if (isApplied) {
        //                         var billId = currentRec.getSublistValue({
        //                             sublistId: 'bill',
        //                             fieldId: 'doc',
        //                             line: i
        //                         });
        //                         var amount = currentRec.getSublistValue({
        //                             sublistId: 'bill',
        //                             fieldId: 'amount',
        //                             line: i
        //                         });

        //                         if (billId && amount) {
        //                     console.log("billId",billId)

        //                             var billRec = record.load({
        //                                 type: record.Type.VENDOR_BILL,
        //                                 id: billId
        //                             });
        //                             var lineCount = billRec.getLineCount({ sublistId: 'item' });
        //                             var itemAmount = 0;
        //                             var expenseAmount = 0;

        //                             for (var k = 0; k < lineCount; k++) {
        //                                 var taxCode = billRec.getSublistValue({
        //                                     sublistId: 'item',
        //                                     fieldId: 'taxcode',
        //                                     line: k
        //                                 });
        //                                 var taxRate = billRec.getSublistValue({
        //                                     sublistId: 'item',
        //                                     fieldId: 'taxrate1',
        //                                     line: k
        //                                 });
        //                                 var taxline = billRec.getSublistValue({
        //                                     sublistId: 'item',
        //                                     fieldId: 'custcol_tss_tdsline',
        //                                     line: k
        //                                 });
        //                                 if (taxline == 'F' || taxline == false || taxline == 'false') {

        //                                     var Amount = billRec.getSublistValue({
        //                                         sublistId: 'item',
        //                                         fieldId: 'amount',
        //                                         line: k
        //                                     });


        //                                     itemAmount += Amount
        //                                     if (isApplied) {
        //                                                                 console.log("taxCode",taxCode)

        //                                                                                         console.log("CompareTaxcode",CompareTaxcode)

        //                                         if (taxCode != CompareTaxcode) {
        //                                             allMatch = false;
        //                                         }
        //                                     }

        //                                 }
        //                             }
        //                             var ExpenselineCount = billRec.getLineCount({ sublistId: 'expense' })
        //                             for (var j = 0; j < ExpenselineCount; j++) {

        //                                 var taxCode = billRec.getSublistValue({
        //                                     sublistId: 'expense',
        //                                     fieldId: 'taxcode',
        //                                     line: j
        //                                 });
        //                                 var taxRate = billRec.getSublistValue({
        //                                     sublistId: 'expense',
        //                                     fieldId: 'taxrate1',
        //                                     line: j
        //                                 });
        //                                 var taxline = billRec.getSublistValue({
        //                                     sublistId: 'expense',
        //                                     fieldId: 'custcol_tss_tdsline',
        //                                     line: j
        //                                 });
        //                                 if (taxline == 'F' || taxline == false || taxline == 'false') {

        //                                     var ExpAmount = billRec.getSublistValue({
        //                                         sublistId: 'expense',
        //                                         fieldId: 'amount',
        //                                         line: j
        //                                     });

        //                                     expenseAmount += ExpAmount
        //                                     if (isApplied) {
        //                                         if (taxCode != CompareTaxcode) {

        //                                             allMatch = false;
        //                                         }
        //                                     }
        //                                 }

        //                             }
        //                             if (!allMatch) {
        //                                 dialog.alert({
        //                                     title: 'Alert',
        //                                     message: 'GST Tax Code is not matching with the Bill. Please Apply to the Valid Bill ',
        //                                 })
        //                                 currentRec.selectLine({
        //                                     sublistId: 'bill',
        //                                     line: i
        //                                 });

        //                                 currentRec.setCurrentSublistValue({
        //                                     sublistId: 'bill',
        //                                     fieldId: 'apply',
        //                                     value: false,
        //                                     ignoreFieldChange: true
        //                                 });

        //                                 currentRec.setCurrentSublistValue({
        //                                     sublistId: 'bill',
        //                                     fieldId: 'amount',
        //                                     value: '',
        //                                     ignoreFieldChange: true
        //                                 });

        //                                 currentRec.commitLine({
        //                                     sublistId: 'bill'
        //                                 });
        //                                  continue; 

        //                             } else {

        //                                 var lineAmt = amount

        //                                 var billbaseAmt = (parseFloat(lineAmt) / (1 + parseFloat(CompareTaxRate) / 100)).toFixed(2)
        //                                 var billTaxAmt = (parseFloat(lineAmt) - parseFloat(billbaseAmt)).toFixed(2)
        //                                 existingData.gstbills[billId] = { "taxamt": parseFloat(billTaxAmt) || 0, "baseamt": parseFloat(billbaseAmt) || 0 };


        //                                 // existingData.gstbills[billId] = parseFloat(amount) || 0;
        //                                 if (remainingAmt < parseFloat(parseFloat(amount) + existingData.gstamt)) {
        //                                     existingData.gstamt = remainingAmt
        //                                 }
        //                                 else {
        //                                     existingData.gstamt += parseFloat(billbaseAmt) || 0;
        //                                 }
        //                                                                      // continue; 

        //                             }
        //                         }
        //                     }
        //                 }

        //                 currentRec.setValue({
        //                     fieldId: 'custbody_tss_it_appliedamt_withouttax',
        //                     value: JSON.stringify(existingData),
        //                     ignoreFieldChange: true
        //                 });
        //                 var linebase = existingData.gstamt
        //                 var gstRate = parseFloat(currentRec.getValue({ fieldId: 'custbody_tss_it_taxrate' })) || 0;
        //                 var taxAmount = linebase * (gstRate / 100);
        //                 console.log("taxAmount", taxAmount)
        //                 // var gstCode = currentRec.getText({ fieldId: 'custbody_tss_it_tax_code' })

        //                 if (gstCode.toUpperCase().includes("GST") && !gstCode.toUpperCase().includes("IGST")) {
        //                     var halfTax = taxAmount / 2;
        //                     currentRec.setValue({ fieldId: 'custbody_tss_cgst_amount', value: halfTax, ignoreFieldChange: true });
        //                     currentRec.setValue({ fieldId: 'custbody_tss_it_sgst_amount', value: halfTax, ignoreFieldChange: true });
        //                     currentRec.setValue({ fieldId: 'custbody_tss_it_igst_amount', value: '', ignoreFieldChange: true });
        //                 }


        //                 if (gstCode.toUpperCase().includes("IGST")) {
        //                     currentRec.setValue({ fieldId: 'custbody_tss_it_igst_amount', value: taxAmount, ignoreFieldChange: true });
        //                     currentRec.setValue({ fieldId: 'custbody_tss_cgst_amount', value: '', ignoreFieldChange: true });
        //                     currentRec.setValue({ fieldId: 'custbody_tss_it_sgst_amount', value: '', ignoreFieldChange: true });


        //                 }
        //                 currentRec.setValue({
        //                     fieldId: 'custbody_tss_it_taxamount',
        //                     value: taxAmount,
        //                     ignoreFieldChange: true
        //                 });


        //                 console.log("GST updated after Auto Apply", existingData);
        //             }

        //         } catch (e) {
        //             log.error("Error in handleAutoApply", e);
        //         }

        //     }

        function handleAutoApply(currentRec) {
            try {

                var CompareTaxcode = currentRec.getValue({ fieldId: "custbody_tss_it_tax_code" });
                var CompareTaxRate = currentRec.getValue({ fieldId: "custbody_tss_it_taxrate" });
                var tdsRate = parseFloat(currentRec.getValue({ fieldId: "custbody_tss_tds_percentage" }) || 0);

                if (!CompareTaxcode) return;

                var lineCount = currentRec.getLineCount({ sublistId: 'bill' });
                var existingData = { gstamt: 0, gstbills: {} };
                var remainingAmt = parseFloat(currentRec.getValue({ fieldId: 'custbody_tss_it_amount_withouttax' }) || 0);

                console.log("Starting Auto Apply | lines:", lineCount);

                processBillLine(0);


                function processBillLine(i) {

                    if (i >= lineCount) {
                        finalizeGST();
                        return;
                    }

                    var isApplied = currentRec.getSublistValue({
                        sublistId: 'bill',
                        fieldId: 'apply',
                        line: i
                    });

                    var allMatch = true;

                    if (isApplied) {

                        var billId = currentRec.getSublistValue({
                            sublistId: 'bill',
                            fieldId: 'doc',
                            line: i
                        });

                        var amount = currentRec.getSublistValue({
                            sublistId: 'bill',
                            fieldId: 'amount',
                            line: i
                        });

                        if (billId && amount) {

                            var billRec = record.load({
                                type: record.Type.VENDOR_BILL,
                                id: billId
                            });

                            // Check item & expense tax codes
                            allMatch = validateBillTax(billRec, CompareTaxcode);

                            // ❌ If mismatch → uncheck line & continue after alert
                            if (!allMatch) {
                                dialog.alert({
                                    title: "Alert",
                                    message: "GST Tax Code is not matching with the Bill. Please Apply to the Valid Bill."
                                }).then(function () {

                                    currentRec.selectLine({
                                        sublistId: 'bill',
                                        line: i
                                    });

                                    currentRec.setCurrentSublistValue({
                                        sublistId: 'bill',
                                        fieldId: 'apply',
                                        value: false,
                                        ignoreFieldChange: true
                                    });

                                    currentRec.setCurrentSublistValue({
                                        sublistId: 'bill',
                                        fieldId: 'amount',
                                        value: '',
                                        ignoreFieldChange: true
                                    });

                                    currentRec.commitLine({ sublistId: 'bill' });

                                    processBillLine(i + 1); // continue next line
                                });

                                return; // stop here until user clicks OK
                            }

                            // ✔ Valid → Calculate GST amounts
                            var baseAmt = (parseFloat(amount) / (1 + parseFloat(CompareTaxRate - tdsRate) / 100)).toFixed(2);
                            var taxAmt = ((parseFloat(CompareTaxRate) * parseFloat(baseAmt)) / 100).toFixed(2);

                            existingData.gstbills[billId] = {
                                baseamt: parseFloat(baseAmt),
                                taxamt: parseFloat(taxAmt)
                            };

                            existingData.gstamt += parseFloat(baseAmt);
                        }
                    }

                    // Move to next line
                    processBillLine(i + 1);
                }


                function validateBillTax(billRec, CompareTaxcode) {

                    var allMatch = true;

                    var itemCount = billRec.getLineCount({ sublistId: 'item' });
                    for (var k = 0; k < itemCount; k++) {

                        var taxCode = billRec.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'taxcode',
                            line: k
                        });

                        var taxline = billRec.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_tss_tdsline',
                            line: k
                        });

                        if (!taxline && taxCode != CompareTaxcode) {
                            allMatch = false;
                        }
                    }

                    var expCount = billRec.getLineCount({ sublistId: 'expense' });
                    for (var j = 0; j < expCount; j++) {

                        var taxCode = billRec.getSublistValue({
                            sublistId: 'expense',
                            fieldId: 'taxcode',
                            line: j
                        });

                        var taxline = billRec.getSublistValue({
                            sublistId: 'expense',
                            fieldId: 'custcol_tss_tdsline',
                            line: j
                        });

                        if (!taxline && taxCode != CompareTaxcode) {
                            allMatch = false;
                        }
                    }

                    return allMatch;
                }

                function finalizeGST() {

                    currentRec.setValue({
                        fieldId: 'custbody_tss_it_appliedamt_withouttax',
                        value: JSON.stringify(existingData),
                        ignoreFieldChange: true
                    });

                    var gstRate = parseFloat(currentRec.getValue({ fieldId: 'custbody_tss_it_taxrate' })) || 0;
                    var totalBase = existingData.gstamt;
                    var taxAmount = totalBase * (gstRate / 100);

                    var gstCode = currentRec.getText({ fieldId: 'custbody_tss_it_tax_code' }) || "";

                    if (gstCode.includes("GST") && !gstCode.includes("IGST")) {
                        var half = taxAmount / 2;
                        currentRec.setValue({ fieldId: 'custbody_tss_cgst_amount', value: half });
                        currentRec.setValue({ fieldId: 'custbody_tss_it_sgst_amount', value: half });
                        currentRec.setValue({ fieldId: 'custbody_tss_it_igst_amount', value: '' });
                    } else {
                        currentRec.setValue({ fieldId: 'custbody_tss_it_igst_amount', value: taxAmount });
                        currentRec.setValue({ fieldId: 'custbody_tss_cgst_amount', value: '' });
                        currentRec.setValue({ fieldId: 'custbody_tss_it_sgst_amount', value: '' });
                    }

                    currentRec.setValue({
                        fieldId: 'custbody_tss_it_taxamount',
                        value: taxAmount
                    });

                    console.log("GST updated:", existingData);
                }

            } catch (e) {
                log.error("Error in handleAutoApply", e);
            }
        }


        function resetGST(currentRec) {
            var CompareTaxcode = currentRec.getValue({ fieldId: "custbody_tss_it_tax_code" });
            if (CompareTaxcode) {
                var existingData = { gstamt: 0, gstbills: {} };
                currentRec.setValue({
                    fieldId: 'custbody_tss_it_appliedamt_withouttax',
                    value: JSON.stringify(existingData),
                    ignoreFieldChange: true
                });
                currentRec.setValue({ fieldId: 'custbody_tss_it_taxamount', value: 0, ignoreFieldChange: true });
                currentRec.setValue({ fieldId: 'custbody_tss_it_igst_amount', value: '', ignoreFieldChange: true });
                currentRec.setValue({ fieldId: 'custbody_tss_cgst_amount', value: '', ignoreFieldChange: true });
                currentRec.setValue({ fieldId: 'custbody_tss_it_sgst_amount', value: '', ignoreFieldChange: true });
            }
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

        return {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            // saveRecord: saveRecord
        };

    });