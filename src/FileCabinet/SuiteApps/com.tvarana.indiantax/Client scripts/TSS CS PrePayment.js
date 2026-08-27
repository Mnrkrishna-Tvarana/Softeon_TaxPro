/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/currentRecord', 'N/search', 'N/runtime'],

    function (record, currentRecord, search, runtime) {
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
         * Function to be executed after page is initialized.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
         *
         * @since 2015.2
         */
        var cachedGlobalSubsidiary = null;
        function pageInit(scriptContext) {
            try {
                cachedGlobalSubsidiary = GettingGlobalParameter();


                /**Making the fields has disabled in page load */
                var currentRec = scriptContext.currentRecord;
                var rec_subsidiary = currentRec.getValue({ fieldId: "subsidiary" });
                var Flag = 0;
                Flag = inArray(rec_subsidiary, cachedGlobalSubsidiary);
                if (Flag == 1) {
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
                        var rec_form = currentRec.getValue({ fieldId: "customform" });
                        if ((rec_form != customFormsObj[currentRec.type]) && (_logValidation(customFormsObj[currentRec.type]))) {
                            currentRec.setValue({ fieldId: "customform", value: customFormsObj[currentRec.type] });
                        }
                    }
                    var status = currentRec.getValue({ fieldId: 'status' });
                    log.debug("status", status)
                    if (status == 'E' || status == 'F') {
                        var gstFieldsConfig = [
                            { id: 'custbody_tss_it_amount_withouttax' },
                            { id: 'custbody_tss_it_tax_code' },
                            { id: 'custbody_tss_it_taxrate' },
                            { id: 'custbody_tss_it_taxamount' },
                            { id: 'custbody_tss_it_igst_amount' },
                            { id: 'custbody_tss_it_sgst_amount' },
                            { id: 'custbody_tss_cgst_amount' },
                            { id: 'custbody_tss_it_apply_gst' },

                            { id: 'custbody_tss_tds_relation' }

                        ];
                        gstFieldsConfig.forEach(function (field) {
                            var fld = currentRec.getField({ fieldId: field.id });
                            fld.isDisabled = true;
                        });

                    } else {


                        var applyGst = currentRec.getValue({ fieldId: 'custbody_tss_it_apply_gst' });
                        log.debug("applyGst", applyGst)

                        var gstFieldsConfig = [
                            { id: 'custbody_tss_it_amount_withouttax', mandatory: true },
                            { id: 'custbody_tss_it_tax_code', mandatory: false },
                            { id: 'custbody_tss_it_taxrate', mandatory: false },
                            { id: 'custbody_tss_it_taxamount', mandatory: false },
                            { id: 'custbody_tss_tds_relation', mandatory: false },


                        ];

                        gstFieldsConfig.forEach(function (field) {
                            var fld = currentRec.getField({ fieldId: field.id });
                            if (scriptContext.mode === 'create') {

                                if (field.id != 'custbody_tss_it_taxrate' || field.id != 'custbody_tss_it_taxamount') {
                                    fld.isDisabled = !applyGst;
                                }

                                if (field.mandatory) {
                                    fld.isMandatory = applyGst;
                                }
                            }
                            if (scriptContext.mode === 'edit') {
                                if (field.id == 'custbody_tss_it_taxrate' || field.id == 'custbody_tss_it_taxamount') {
                                    fld.isDisabled = true;
                                }
                                if (field.mandatory) {
                                    fld.isMandatory = field.mandatory;
                                }
                            }


                        });
                    }
                    if (scriptContext.mode === 'edit') {
                        var paymentField = currentRec.getField({ fieldId: 'payment' });
                        paymentField.isDisabled = applyGst;
                    }
                    if (scriptContext.mode === 'copy') {
                        currentRec.setValue({
                            fieldId: 'custbody_tss_it_apply_gst',
                            value: false
                        });
                    }
                }

                /**Making the fields has disabled in page load */
            } catch (e) {
                log.error("error in page init", e)
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

                // var GlobalSubsidiary = GettingGlobalParameter();
                var currentrecordsubsidiary = currentRec.getValue({ fieldId: "subsidiary" });
                var Flag = 0;
                Flag = inArray(currentrecordsubsidiary, cachedGlobalSubsidiary);
                if (Flag == parseInt(1)) {

                    if (scriptContext.fieldId === 'payment') {
                        var Payment = currentRec.getValue({ fieldId: 'payment' });
                        if (currentRec.getValue({ fieldId: 'custbody_tss_it_apply_gst' }) == true && !currentRec.getValue({ fieldId: 'custbody_tss_it_amount_withouttax' })) {
                            currentRec.setValue({ fieldId: 'custbody_tss_it_amount_withouttax', value: Payment });
                        }

                    }
                    /**Making the fields has disabled in if the Apply GST Checkbox is checked */
                    if (scriptContext.fieldId === 'custbody_tss_it_apply_gst') {
                        var applyGst = currentRec.getValue({ fieldId: 'custbody_tss_it_apply_gst' });
                        log.debug("applyGst", applyGst)

                        var Payment = currentRec.getValue({ fieldId: 'payment' });
                        if (applyGst && !currentRec.getValue({ fieldId: 'custbody_tss_it_amount_withouttax' })) {
                            currentRec.setValue({ fieldId: 'custbody_tss_it_amount_withouttax', value: Payment });
                        }

                        var gstFieldsConfig = [
                            { id: 'custbody_tss_it_amount_withouttax', mandatory: true },
                            { id: 'custbody_tss_it_tax_code', mandatory: false },
                            { id: 'custbody_tss_it_taxrate', mandatory: false },
                            { id: 'custbody_tss_it_taxamount', mandatory: false },
                            { id: 'custbody_tss_it_igst_amount', mandatory: false },
                            { id: 'custbody_tss_it_sgst_amount', mandatory: false },
                            { id: 'custbody_tss_cgst_amount', mandatory: false },
                            { id: 'custbody_tss_tds_relation', mandatory: false }

                        ];
                        var alwaysEnabled = [
                            'custbody_tss_it_taxrate',
                            'custbody_tss_cgst_amount',
                            'custbody_tss_it_sgst_amount',
                            'custbody_tss_it_igst_amount',
                            'custbody_tss_it_taxamount'
                        ];

                        // gstFieldsConfig.forEach(function (field) {
                        //     var fld = currentRec.getField({ fieldId: field.id });
                        //     if (!alwaysEnabled.includes(field.id)) {
                        //         fld.isDisabled = !applyGst;
                        //     }



                        //     if (applyGst) {
                        //         fld.isMandatory = field.mandatory;
                        //     } else {
                        //         fld.isMandatory = false;
                        //     }
                        //     if (!applyGst) {
                        //         // if (field.id != 'custbody_tss_tds_relation') {
                        //         //     currentRec.setValue({
                        //         //         fieldId: field.id,
                        //         //         value: '',
                        //         //         ignoreFieldChange: true
                        //         //     });
                        //         // }
                        //         if (field.id == 'custbody_tss_it_amount_withouttax') {

                        //         }
                        //         else {
                        //             currentRec.setValue({
                        //                 fieldId: field.id,
                        //                 value: '',
                        //                 ignoreFieldChange: false
                        //             });
                        //         }
                        //     }
                        // });
                        gstFieldsConfig.forEach(function (field) {
                            var fld = currentRec.getField({ fieldId: field.id });

                            if (!alwaysEnabled.includes(field.id)) {

                                fld.isDisabled = !applyGst;
                            }

                            if (applyGst) {
                                fld.isMandatory = field.mandatory;
                            } else {
                                fld.isMandatory = false;
                            }
                            if (!applyGst) {

                                clearGstFields(currentRec)

                            }
                        });


                        var paymentField = currentRec.getField({ fieldId: 'payment' });
                        paymentField.isDisabled = applyGst;
                        paymentField.isMandatory = applyGst;

                        if (!applyGst) {
                            var AmountwithoutTaxvalue = currentRec.getValue({ fieldId: 'custbody_tss_it_amount_withouttax' });
                            log.debug("AmountwithoutTaxvalue", AmountwithoutTaxvalue)
                            if (AmountwithoutTaxvalue) {
                                currentRec.setValue({ fieldId: 'payment', value: AmountwithoutTaxvalue });
                                currentRec.setValue({
                                    fieldId: "custbody_tss_it_amount_withouttax",
                                    value: '',

                                });
                            } else {
                                currentRec.setValue({
                                    fieldId: 'payment',
                                    value: '',
                                    ignoreFieldChange: true
                                });
                            }
                        }
                    }
                    /**Making the fields has disabled in if the Apply GST Checkbox is checked */

                    /**If the tax code is change if it GST and IGST Tax code then getting the rate and setting 
                     * in the tax rate and making it as diasabled  and and checking if the amount is given then
                     *  calucating the tax and setting it 
                     * if the tax code is not group then setting the all the values to empty 
                     */

                    if (scriptContext.fieldId === 'custbody_tss_it_tax_code') {
                        var gstFieldsConfig = [
                            { id: 'custbody_tss_it_amount_withouttax', mandatory: true },
                            { id: 'custbody_tss_it_tax_code', mandatory: false },
                            { id: 'custbody_tss_it_taxrate', mandatory: true },
                            { id: 'custbody_tss_it_taxamount', mandatory: true },


                        ];
                        gstFieldsConfig.forEach(function (field) {
                            var fld = currentRec.getField({ fieldId: field.id });
                            if (field.id == 'custbody_tss_it_tax_code' || field.id == 'custbody_tss_it_amount_withouttax') {
                                fld.isDisabled = false;
                            } else {
                                fld.isDisabled = true;
                            }
                            if (field.mandatory) {
                                fld.isMandatory = field.mandatory;
                            }


                        });

                        var gstCodetext = currentRec.getText({ fieldId: 'custbody_tss_it_tax_code' })
                        log.debug("gstCodetext", gstCodetext)
                        if (gstCodetext.includes("GST Group") || gstCodetext.includes("IGST Group")) {
                            var gstCode = currentRec.getValue({ fieldId: 'custbody_tss_it_tax_code' });
                            var Taxrate = GetTaxRatefromTaxCode(gstCode);

                            if (Taxrate) {
                                currentRec.getField({ fieldId: 'custbody_tss_it_taxrate' }).isDisabled = true;
                                currentRec.setValue({
                                    fieldId: 'custbody_tss_it_taxrate',
                                    value: Taxrate
                                });
                                Settingvalues(currentRec, true);
                            } else {
                                clearGstFields(currentRec);
                            }
                        }
                        else if (gstCodetext == '') {
                            currentRec.getField("custbody_tss_it_taxrate").isMandatory = false;
                            currentRec.getField("custbody_tss_it_taxamount").isMandatory = false;
                            currentRec.setValue({
                                fieldId: 'payment',
                                value: currentRec.getValue({ fieldId: 'custbody_tss_it_amount_withouttax' })
                            });
                            clearGstFields(currentRec);
                        } else {
                            alert("Selected Tax Code is not GST Group or IGST Group. Please select a valid tax code.");
                            clearGstFields(currentRec);
                            return;
                        }




                    }
                    /**If the tax code is change if it GST and IGST Tax code then getting the rate and setting 
                    * in the tax rate and making it as diasabled  and and checking if the amount is given then
                    *  calucating the tax and setting it 
                    * if the tax code is not group then setting the all the values to empty 
                    */



                    /**If the amount is given then caluculatin the tax and setting in the repsective fields and making it as disabling 
                     * and setting the tax amount in the field and sum of amount and tax amount is set in the payment field 
                     */

                    if (scriptContext.fieldId === 'custbody_tss_it_amount_withouttax' || scriptContext.fieldId === 'custbody_tss_it_taxamount') {
                        var value = parseFloat(currentRec.getValue({ fieldId: scriptContext.fieldId })) || 0;

                        if (value < 0) {
                            alert('Negative values are not allowed for this field.');
                            currentRec.setValue({
                                fieldId: scriptContext.fieldId,
                                value: '',
                                ignoreFieldChange: true
                            });
                        }
                        Settingvalues(currentRec, false)

                    }

                    /**If the amount is given then caluculatin the tax and setting in the repsective fields and making it as disabling 
                  * and setting the tax amount in the field and sum of amount and tax amount is set in the payment field 
                  */
                }
            } catch (e) {
                log.error("Error in Field Changed ", e)
            }
        }
        /**
         * Function to be executed when field is slaved.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         *
         * @since 2015.2
         */
        function postSourcing(scriptContext) {
            try {
                if (scriptContext.fieldId === 'subsidiary' || scriptContext.fieldId === 'entity') {
                    var currentRec = scriptContext.currentRecord;
                    var currentrecordsubsidiary = currentRec.getValue({ fieldId: "subsidiary" });
                    var Flag = 0;
                    Flag = inArray(currentrecordsubsidiary, cachedGlobalSubsidiary);
                    if (Flag == parseInt(1)) {
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
                            var rec_form = currentRec.getValue({ fieldId: "customform" });
                            if ((rec_form != customFormsObj[currentRec.type]) && (_logValidation(customFormsObj[currentRec.type]))) {
                                currentRec.setValue({ fieldId: "customform", value: customFormsObj[currentRec.type] });
                            }
                        }
                    }
                }
            } catch (error) {
                log.error("Error in post sourcing", error)
            }
        }
        function saveRecord(scriptContext) {
            try {

                var currentRec = scriptContext.currentRecord;
                var currentrecordsubsidiary = currentRec.getValue({ fieldId: "subsidiary" });
                var Flag = 0;
                Flag = inArray(currentrecordsubsidiary, cachedGlobalSubsidiary);
                if (Flag == parseInt(1)) {

                    var applyGst = currentRec.getValue({ fieldId: 'custbody_tss_it_apply_gst' });

                    if (applyGst) {
                        var amountWithoutTax = currentRec.getValue({ fieldId: 'custbody_tss_it_amount_withouttax' });
                        var taxCode = currentRec.getValue({ fieldId: 'custbody_tss_it_tax_code' });
                        var taxRate = currentRec.getValue({ fieldId: 'custbody_tss_it_taxrate' });
                        var taxAmount = currentRec.getValue({ fieldId: 'custbody_tss_it_taxamount' });

                        // Amount Without Tax is always mandatory
                        if (!amountWithoutTax) {
                            alert('Please enter a value for Amount Without Tax');
                            return false;
                        }

                        // If Tax Code exists, then Tax Rate and Tax Amount also become mandatory
                        if (taxCode) {
                            if (!taxRate) {
                                alert('Please enter a value for Tax Rate');
                                return false;
                            }
                            if (!taxAmount) {
                                alert('Please enter a value for Tax Amount');
                                return false;
                            }
                        }
                    }
                }


                return true;
            } catch (e) {
                log.error('Error in saveRecord', e);
                return true;
            }
        }









        function clearGstFields(currentRec) {
            var gstFields = [
                'custbody_tss_it_tax_code',
                'custbody_tss_it_taxrate',
                'custbody_tss_it_taxamount',
                'custbody_tss_it_igst_amount',
                'custbody_tss_it_sgst_amount',
                'custbody_tss_cgst_amount'
            ];
            gstFields.forEach(function (fieldId) {
                currentRec.setValue({
                    fieldId: fieldId,
                    value: '',
                    ignoreFieldChange: true
                });
            });
        }





        function Settingvalues(currentRec, taxcodechange) {
            if (taxcodechange) {
                currentRec.setValue({ fieldId: 'custbody_tss_cgst_amount', value: 0, ignoreFieldChange: true });
                currentRec.setValue({ fieldId: 'custbody_tss_it_sgst_amount', value: 0, ignoreFieldChange: true });
                currentRec.setValue({ fieldId: 'custbody_tss_it_igst_amount', value: 0, ignoreFieldChange: true });
                currentRec.setValue({ fieldId: 'custbody_tss_it_taxamount', value: '', ignoreFieldChange: true });
            }

            var gstAmount = parseFloat(currentRec.getValue({ fieldId: 'custbody_tss_it_amount_withouttax' })) || 0;
            var gstRate = parseFloat(currentRec.getValue({ fieldId: 'custbody_tss_it_taxrate' })) || 0;
            var gstTaxAmount = parseFloat(currentRec.getValue({ fieldId: 'custbody_tss_it_taxamount' }));
            log.debug("gstTaxAmount", gstTaxAmount)


            var gstCode = currentRec.getText({ fieldId: 'custbody_tss_it_tax_code' })
            var taxAmount = 0;



            // taxAmount = gstAmount * (gstRate / 100);
            // log.debug("tax in else ", taxAmount)

            var taxAmount = parseFloat((gstAmount * (gstRate / 100)).toFixed(2));
            log.debug("taxAmount", taxAmount);

            var TotalAmount = parseFloat((gstAmount + taxAmount).toFixed(2));
            // log.debug("taxAmount", taxAmount)
            // var TotalAmount = gstAmount + taxAmount

            if (gstCode.toUpperCase().includes("GST") && !gstCode.toUpperCase().includes("IGST")) {
                var half = taxAmount / 2;

                var cgst = Math.floor(half * 100) / 100;
                var sgst = parseFloat((taxAmount - cgst).toFixed(2));
                // var halfTax = taxAmount / 2;
                currentRec.setValue({ fieldId: 'custbody_tss_cgst_amount', value: cgst, ignoreFieldChange: true });
                currentRec.setValue({ fieldId: 'custbody_tss_it_sgst_amount', value: sgst, ignoreFieldChange: true });
                currentRec.setValue({ fieldId: 'custbody_tss_it_igst_amount', value: '', ignoreFieldChange: true });


            }


            if (gstCode.toUpperCase().includes("IGST")) {
                currentRec.setValue({ fieldId: 'custbody_tss_it_igst_amount', value: taxAmount, ignoreFieldChange: true });
                currentRec.setValue({ fieldId: 'custbody_tss_cgst_amount', value: '', ignoreFieldChange: true });
                currentRec.setValue({ fieldId: 'custbody_tss_it_sgst_amount', value: '', ignoreFieldChange: true });


            }
            currentRec.getField({ fieldId: 'custbody_tss_cgst_amount' }).isDisabled = true;
            currentRec.getField({ fieldId: 'custbody_tss_it_sgst_amount' }).isDisabled = true;
            currentRec.getField({ fieldId: 'custbody_tss_it_igst_amount' }).isDisabled = true;


            currentRec.setValue({
                fieldId: 'custbody_tss_it_taxamount',
                value: taxAmount,
                ignoreFieldChange: true
            });

            currentRec.setValue({
                fieldId: 'payment',
                value: TotalAmount,
                ignoreFieldChange: true
            });

        }

        function GetTaxRatefromTaxCode(taxcodeInternalid) {
            var taxRate = ''
            if (taxcodeInternalid) {
                var salestaxitemSearchObj = search.create({
                    type: "taxgroup",
                    filters:
                        [
                            ["internalid", "anyof", taxcodeInternalid], "AND",
                            ["isinactive", "is", "F"],
                            // "AND",

                            // ["taxtype", "anyof", "5", "4"]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "name", label: "Name" }),
                            search.createColumn({ name: "rate", label: "Rate" }),

                        ]
                });
                var salestaxitemSearchResults = salestaxitemSearchObj.run().getRange({ start: 0, end: 1000 });
            }
            if (salestaxitemSearchResults.length > 0) {
                taxRate = salestaxitemSearchResults[0].getValue({ name: 'rate' });
            }
            else {
                return alert("Selected Tax Code is not GST Group or IGST Group. Please select a valid tax code.");

            }


            return taxRate
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
            postSourcing: postSourcing,
            saveRecord: saveRecord

        };

    });