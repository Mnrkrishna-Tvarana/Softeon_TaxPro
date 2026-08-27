/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */

/**
 * Script Name               : CLI TSS TDS On VPP
 * Script Author             : MNR Krishna
 * Script Type               : Client Script
 * Script Version            : 2.0
 * Script Created date       : 7/08/2025
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  
 */

/** 
 * * Version      Name              Date          Notes
 * 1.0         MNR Krishna       7/08/2025      Initial version 
 * 
 */


define(['N/record', 'N/search', 'N/currentRecord'],
    /**
     * @param{record} record
     * @param{search} search
     */
    function (record, search, currentRecord) {

        //Global Variables defining......
        var operationType;
        var vendor
        var g_subisidiary = new Array();
        var g_tdsCode;
        var g_tdsRoundMethod;
        var g_TDS_Calculate;
        var pan;
        var TDSrelObj = {}
        var prevTDSamt = 0;
        var vppBaseAmt = 0;
        var vppTaxAmt = 0;
        var vppAmt = 0;
        var vppaAmt = 0;
        var prevTDSDeductedAmt = 0;


        /**
         * Function to be executed after page is initialized.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
         *
         * @since 2015.2
         */
        function pageInit(scriptContext) {
            try {
                var current_record = scriptContext.currentRecord;
                var GlobalRecId = SearchGlobalParameter();
                if (_logValidation(GlobalRecId)) {
                    var GlobalRec = record.load({ type: 'customrecord_tss_global_parameter', id: GlobalRecId, });
                    g_subisidiary = GlobalRec.getValue('custrecord_tss_gp_subsidiary');
                    log.debug("g_subisidiary", g_subisidiary);
                    g_tdsCode = GlobalRec.getValue('custrecord_tss_gp_tdscode');
                    log.debug("g_tdsCode", g_tdsCode);

                } // end if (_logValidation(GlobalRecId))

                //current_record.getField("custbody_tss_tds_relation").isDisabled = true;
                // current_record.getField("custbody_tss_tds_account").isDisabled = true;
                // current_record.getField("custbody_tss_tds_amount").isDisabled = true;


                var Subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                var Flag = inArray(Subsidiary, g_subisidiary);
                if (parseInt(Flag) == parseInt(1)) {
                    //Removing TDS in copy context
                    if (scriptContext.mode === 'copy') {
                        current_record.setValue({
                            fieldId: 'custbody_tss_tds_relation',
                            value: ''
                        });
                    }

                    // Getting Vendor PAN
                    var rec_vendor = current_record.getValue({ fieldId: "entity" });
                    var vendorObj = search.lookupFields({
                        type: 'vendor',
                        id: rec_vendor,
                        columns: ['custentitytss_pan']
                    });
                    log.debug("vendorObj in pageInit", vendorObj)
                    pan = vendorObj.custentitytss_pan;

                    //Field Validations
                    var TdsType = current_record.getValue({ fieldId: "custbody_tss_tds_relation" });
                    if (_logValidation(TdsType)) {
                        // Getting TDS Relation details
                        TDSrelObj = search.lookupFields({
                            type: 'customrecord_tss_tdsrelation',
                            id: TdsType,
                            columns: ['custrecord_tss_tds_vedtdsaccount', 'custrecord_tss_tds_vednetper', 'custrecord_tss_tds_vedempty_pan_tdsper', 'custrecord_tss_tds_section', 'custrecord_tss_tds_calculate', 'custrecord_tss_tds_rounding']
                        });
                        if (current_record.type == 'vendorprepayment') {
                            current_record.getField("custbody_tss_tds_amount").isMandatory = true;
                            current_record.getField("custbody_tss_tds_baseamt").isMandatory = true;
                            current_record.getField("custbody_tss_tds_percentage").isMandatory = true;
                            var status = current_record.getValue({ fieldId: 'status' });
                            log.debug("status in pageinit", status)
                            if (status != 'E' && status != 'F') {
                                current_record.getField("custbody_tss_tds_amount").isDisabled = false;
                                current_record.getField("custbody_tss_tds_baseamt").isDisabled = false;
                                current_record.getField("custbody_tss_tds_percentage").isDisabled = false;
                            }
                        }
                        log.debug("Mode in VPPA pageinit", scriptContext.mode)

                        if (current_record.type == 'vendorprepaymentapplication') {
                            //Adding functions to the Auto Apply and Clear Buttons
                            window.setTimeout(function () {
                                var autoApplyBtn = document.querySelector('input[name="autoapply"]');
                                if (autoApplyBtn) {
                                    autoApplyBtn.addEventListener("click", function () {
                                        console.log("Auto Apply button clicked in TDS Script!");

                                        // small delay so NetSuite applies bills first
                                        setTimeout(function () {
                                            tdsAutoApply(current_record);
                                        }, 500);
                                    });
                                }

                                var clearBtn = document.querySelector('input[name="clear"]');
                                if (clearBtn) {
                                    clearBtn.addEventListener("click", function () {
                                        console.log("Clear button clicked in TDS Script!");
                                        setTimeout(function () {
                                            clearTDS(current_record);
                                        }, 500);
                                    });
                                }
                            }, 1000);

                            // Getting the previous tds base amount from Vendor prepayment Application
                            var vppaFilters = []
                            vppaFilters.push(['appliedtotransaction.type', 'anyof', ['VPrep']]);
                            vppaFilters.push('AND')
                            vppaFilters.push(['appliedtotransaction.internalid', 'anyof', current_record.getValue({ fieldId: "vendorprepayment" })])
                            if (_logValidation(current_record.id)) {
                                vppaFilters.push('AND')
                                vppaFilters.push(['internalid', 'noneof', current_record.id])
                            }

                            var vppaSearch = search.create({
                                type: 'vendorprepaymentapplication',
                                filters: vppaFilters,
                                columns: ['internalid', 'appliedtotransaction.type', 'custbody_tss_it_appliedamt_withouttax', 'custbody_tss_tds_amount', 'appliedtotransaction.custbody_tss_tds_baseamt', 'appliedtotransaction.custbody_tss_tds_amount', 'fxamount', 'appliedtotransaction.fxamount']
                            });

                            var vppaSearch_result = vppaSearch.run().getRange(0, 100);
                            if (vppaSearch_result.length > 0) {
                                for (var i = 0; i < vppaSearch_result.length; i++) {
                                    var vppaId = vppaSearch_result[i].getValue({ name: 'internalid' });
                                    var appliedType = vppaSearch_result[i].getValue({ name: 'type', join: 'appliedtotransaction' });
                                    var vppaTaxObj = vppaSearch_result[i].getValue({ name: 'custbody_tss_it_appliedamt_withouttax' }) || '{}';
                                    var vppaBaseAmt = vppaTaxObj ? JSON.parse(vppaTaxObj).tdsamt || 0 : 0
                                    prevTDSamt += parseFloat(vppaBaseAmt)
                                    prevTDSDeductedAmt += parseFloat(vppaSearch_result[i].getValue({ name: 'custbody_tss_tds_amount' }) || 0)
                                    vppAmt = parseFloat(vppaSearch_result[i].getValue({ name: 'fxamount', join: 'appliedtotransaction' }) || 0)
                                    vppaAmt += -(parseFloat(vppaSearch_result[i].getValue({ name: 'fxamount' }))) || 0
                                    // log.debug("vppAmt in VPPA pageinit" + (i + 1), vppAmt)
                                    // log.debug("vppaAmt in VPPA pageinit" + (i + 1), vppaAmt)

                                    log.debug("vppaSearch_result", vppaSearch_result[i])
                                    vppBaseAmt = vppaSearch_result[i].getValue({ name: 'custbody_tss_tds_baseamt', join: 'appliedtotransaction' }) || 0;
                                    vppTaxAmt = vppaSearch_result[i].getValue({ name: 'custbody_tss_tds_amount', join: 'appliedtotransaction' });
                                    log.debug("vppaId", vppaId + '-' + appliedType + '-' + vppBaseAmt + '-' + vppTaxAmt + '-' + '-' + vppaTaxObj + vppaBaseAmt + '-' + prevTDSamt)
                                }
                            }
                            else {
                                vppObj = search.lookupFields({
                                    type: 'vendorprepayment',
                                    id: current_record.getValue({ fieldId: "vendorprepayment" }),
                                    columns: ['custbody_tss_tds_baseamt', 'fxamount']
                                })
                                vppBaseAmt = vppObj.custbody_tss_tds_baseamt
                                vppAmt = -parseFloat(vppObj.fxamount)
                                log.debug("vppBaseAmt in else cond", vppBaseAmt)
                                log.debug("vppAmt in else cond", vppAmt)
                                // vppBaseAmt = current_record.getValue({ fieldId: "custbody_tss_tds_baseamt" }) || 0;
                            }
                            log.debug("vppAmt in VPPA pageinit", vppAmt)
                            log.debug("vppaAmt in VPPA pageinit", vppaAmt)
                            // var appliedAmt = current_record.getValue({ fieldId: "applied" }) || 0;
                            // log.debug("appliedAmt in VPPA pageinit", appliedAmt)
                            // if (parseFloat(appliedAmt) <= 0) {

                            if (!_logValidation(current_record.id)) {
                                // var BaseAmtObj = current_record.getValue({ fieldId: "custbody_tss_it_appliedamt_withouttax" }) || '{}';
                                //  BaseAmt = BaseAmtObj ? JSON.parse(BaseAmtObj).tdsamt : 0
                                // if (_logValidation(BaseAmt)) {
                                //     var TDSrate = current_record.getValue({ fieldId: "custbody_tss_tds_percentage" });
                                //     var taxAmt = current_record.getValue({ fieldId: "custbody_tss_it_taxamount" }) || 0;
                                //     TDSrelObj = search.lookupFields({
                                //         type: 'customrecord_tss_tdsrelation',
                                //         id: TdsType,
                                //         columns: ['custrecord_tss_tds_vedtdsaccount', 'custrecord_tss_tds_vednetper', 'custrecord_tss_tds_vedempty_pan_tdsper', 'custrecord_tss_tds_section', 'custrecord_tss_tds_calculate', 'custrecord_tss_tds_rounding']
                                //     });
                                //     // TDS Base amount to be include GST amount or not
                                //     var tdsBaseAmt = (TDSrelObj.custrecord_tss_tds_calculate[0].value == 2) ? (parseFloat(BaseAmt) + parseFloat(taxAmt)) : parseFloat(BaseAmt);

                                //     var tdsAmt = (parseFloat(TDSrate) * parseFloat(tdsBaseAmt)) / 100;
                                //     tdsAmt = applyTdsRoundMethod(TDSrelObj.custrecord_tss_tds_rounding[0].value, tdsAmt);
                                //     log.debug("TDS Amount in VPPA pageinit", tdsAmt)
                                //     //Setting TDS Amount
                                //     current_record.setValue({
                                //         fieldId: 'custbody_tss_tds_amount',
                                //         value: parseFloat(tdsAmt),
                                //         ignoreFieldChange: true
                                //     });

                                // }
                                // else {
                                // current_record.setValue({
                                //     fieldId: 'custbody_tss_tds_amount',
                                //     value: 0,
                                //     ignoreFieldChange: true
                                // });
                                // }

                                current_record.setValue({
                                    fieldId: 'custbody_tss_tds_amount',
                                    value: 0,
                                    ignoreFieldChange: true
                                });
                            }
                        }
                    }
                } // end if(parseInt(Flag) == parseInt(1)){


            }// end try
            catch (e) {
                log.error("Error in pageInit", e);
            } // end catch(e)
        } // end function pageInit(scriptContext)

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
                var current_record = scriptContext.currentRecord;
                var fieldName = scriptContext.fieldId;

                // Start Vendor Prepayment Code
                if (current_record.type == 'vendorprepayment') {
                    if (fieldName == 'entity') {
                        // Getting Vendor PAN
                        var rec_vendor = current_record.getValue({ fieldId: "entity" });
                        var vendorObj = search.lookupFields({
                            type: 'vendor',
                            id: rec_vendor,
                            columns: ['custentitytss_pan']
                        });
                        log.debug("vendorObj in fieldChanged", vendorObj)
                        pan = vendorObj.custentitytss_pan;
                    }
                    if (fieldName == 'custbody_tss_tds_relation') {
                        var Subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                        var Flag = inArray(Subsidiary, g_subisidiary);
                        if (Flag == parseInt(1)) {
                            var TdsType = current_record.getValue({ fieldId: "custbody_tss_tds_relation" });
                            if (_logValidation(TdsType)) {
                                current_record.getField("custbody_tss_tds_amount").isMandatory = true;
                                current_record.getField("custbody_tss_tds_amount").isDisabled = false;
                                current_record.getField("custbody_tss_tds_baseamt").isMandatory = true;
                                current_record.getField("custbody_tss_tds_baseamt").isDisabled = false;
                                current_record.getField("custbody_tss_tds_percentage").isMandatory = true;
                                current_record.getField("custbody_tss_tds_percentage").isDisabled = false;

                                // Getting TDS Relation details
                                TDSrelObj = search.lookupFields({
                                    type: 'customrecord_tss_tdsrelation',
                                    id: TdsType,
                                    columns: ['custrecord_tss_tds_vedtdsaccount', 'custrecord_tss_tds_vednetper', 'custrecord_tss_tds_vedempty_pan_tdsper', 'custrecord_tss_tds_section', 'custrecord_tss_tds_calculate', 'custrecord_tss_tds_rounding']
                                });

                                current_record.setValue({
                                    fieldId: 'custbody_tss_tds_section',
                                    value: TDSrelObj.custrecord_tss_tds_section
                                });

                                current_record.setValue({
                                    fieldId: 'custbody_tss_tds_account',
                                    value: TDSrelObj.custrecord_tss_tds_vedtdsaccount[0].value
                                });

                                var TDSrate = _logValidation(pan) ? TDSrelObj.custrecord_tss_tds_vednetper : TDSrelObj.custrecord_tss_tds_vedempty_pan_tdsper
                                log.debug("TDSrate", TDSrate)

                                current_record.setValue({
                                    fieldId: 'custbody_tss_tds_percentage',
                                    value: parseFloat(TDSrate)
                                });

                                // Calculating the TDS and Updating the Payment field amount and TDS Amount values
                                var baseAmt = current_record.getValue({ fieldId: "custbody_tss_it_amount_withouttax" }) || 0;
                                var taxAmt = current_record.getValue({ fieldId: "custbody_tss_it_taxamount" }) || 0;
                                // TDS Base amount to be include GST amount or not
                                var tdsBaseAmt = (TDSrelObj.custrecord_tss_tds_calculate[0].value == 2) ? (parseFloat(baseAmt) + parseFloat(taxAmt)) : parseFloat(baseAmt);

                                var tdsAmt = (parseFloat(TDSrate) * parseFloat(tdsBaseAmt)) / 100;
                                tdsAmt = applyTdsRoundMethod(TDSrelObj.custrecord_tss_tds_rounding[0].value, tdsAmt);

                                //Setting TDS Base Amount
                                current_record.setValue({
                                    fieldId: 'custbody_tss_tds_baseamt',
                                    value: parseFloat(tdsBaseAmt),
                                    ignoreFieldChange: true
                                });

                                //Setting TDS Amount
                                current_record.setValue({
                                    fieldId: 'custbody_tss_tds_amount',
                                    value: parseFloat(tdsAmt).toFixed(2),
                                    ignoreFieldChange: true
                                });

                                // Setting Payment Amount
                                current_record.setValue({
                                    fieldId: 'payment',
                                    value: (parseFloat(baseAmt) - parseFloat(tdsAmt) + parseFloat(taxAmt)).toFixed(2)
                                });


                            } // end if(isTrue(applyTds))
                            else {
                                TDSrelObj = {}
                                current_record.getField("custbody_tss_tds_amount").isMandatory = false;
                                current_record.getField("custbody_tss_tds_amount").isDisabled = true;
                                current_record.getField("custbody_tss_tds_baseamt").isMandatory = false;
                                current_record.getField("custbody_tss_tds_baseamt").isDisabled = true;
                                current_record.getField("custbody_tss_tds_percentage").isMandatory = false;
                                current_record.getField("custbody_tss_tds_percentage").isDisabled = true;

                                current_record.setValue({
                                    fieldId: 'custbody_tss_tds_section',
                                    value: ''
                                });
                                current_record.setValue({
                                    fieldId: 'custbody_tss_tds_account',
                                    value: ''
                                });
                                current_record.setValue({
                                    fieldId: 'custbody_tss_tds_amount',
                                    value: ''
                                });
                                current_record.setValue({
                                    fieldId: 'custbody_tss_tds_percentage',
                                    value: ''
                                });
                                current_record.setValue({
                                    fieldId: 'custbody_tss_tds_baseamt',
                                    value: ''
                                });

                            }
                        }
                    } // end if(fieldName == 'custbody_tss_apply_tds')


                    if (fieldName == 'custbody_tss_it_amount_withouttax' || fieldName == 'custbody_tss_it_taxamount' || fieldName == 'custbody_tss_it_tax_code') {
                        var Subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                        var Flag = inArray(Subsidiary, g_subisidiary);
                        if (Flag == parseInt(1)) {
                            var TdsType = current_record.getValue({ fieldId: "custbody_tss_tds_relation" });
                            var baseAmt = current_record.getValue({ fieldId: "custbody_tss_it_amount_withouttax" }) || 0;
                            if (_logValidation(TdsType) && (parseFloat(baseAmt) > 0)) {

                                var TDSrate = current_record.getValue({ fieldId: 'custbody_tss_tds_percentage' });

                                // Calculating the TDS and Updating the Payment field amount and TDS Amount values
                                var taxAmt = current_record.getValue({ fieldId: "custbody_tss_it_taxamount" }) || 0;
                                // TDS Base amount to be include GST amount or not
                                log.debug("TDSrelObj in fieldChanged", TDSrelObj)
                                var tdsBaseAmt = (TDSrelObj.custrecord_tss_tds_calculate[0].value == 2) ? (parseFloat(baseAmt) + parseFloat(taxAmt)) : parseFloat(baseAmt);

                                var tdsAmt = (parseFloat(TDSrate) * parseFloat(tdsBaseAmt)) / 100;
                                tdsAmt = applyTdsRoundMethod(TDSrelObj.custrecord_tss_tds_rounding[0].value, tdsAmt);

                                //Setting TDS Base Amount
                                current_record.setValue({
                                    fieldId: 'custbody_tss_tds_baseamt',
                                    value: parseFloat(tdsBaseAmt),
                                    ignoreFieldChange: true
                                });

                                //Setting TDS Amount
                                current_record.setValue({
                                    fieldId: 'custbody_tss_tds_amount',
                                    value: parseFloat(tdsAmt).toFixed(2),
                                    ignoreFieldChange: true
                                });

                                // Setting Payment Amount
                                current_record.setValue({
                                    fieldId: 'payment',
                                    value: (parseFloat(baseAmt) - parseFloat(tdsAmt) + parseFloat(taxAmt)).toFixed(2)
                                });

                            }
                        }
                    }

                    if (fieldName == 'custbody_tss_tds_amount') {
                        var Subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                        var Flag = inArray(Subsidiary, g_subisidiary);
                        if (Flag == parseInt(1)) {
                            // var TdsType = current_record.getValue({ fieldId: "custbody_tss_tds_relation" });
                            // if (_logValidation(TdsType)) {
                            var tdsAmt = current_record.getValue({ fieldId: "custbody_tss_tds_amount" }) || 0;
                            var baseAmt = current_record.getValue({ fieldId: "custbody_tss_it_amount_withouttax" }) || 0;
                            var taxAmt = current_record.getValue({ fieldId: "custbody_tss_it_taxamount" }) || 0;
                            current_record.setValue({
                                fieldId: 'payment',
                                value: (parseFloat(baseAmt) - parseFloat(tdsAmt) + parseFloat(taxAmt))
                            });
                            // }
                        }
                    }

                    if (fieldName == 'custbody_tss_tds_baseamt' || fieldName == 'custbody_tss_tds_percentage') {
                        var Subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                        var Flag = inArray(Subsidiary, g_subisidiary);
                        if (Flag == parseInt(1)) {
                            var tdsBaseAmt = current_record.getValue({ fieldId: "custbody_tss_tds_baseamt" }) || 0;
                            var tdsRate = current_record.getValue({ fieldId: "custbody_tss_tds_percentage" }) || 0;
                            var tdsAmt = (parseFloat(tdsRate) * parseFloat(tdsBaseAmt)) / 100;
                            var baseAmt = current_record.getValue({ fieldId: "custbody_tss_it_amount_withouttax" }) || 0;
                            var taxAmt = current_record.getValue({ fieldId: "custbody_tss_it_taxamount" }) || 0;

                            //Setting TDS Amount
                            current_record.setValue({
                                fieldId: 'custbody_tss_tds_amount',
                                value: parseFloat(tdsAmt).toFixed(2),
                                ignoreFieldChange: true
                            });

                            current_record.setValue({
                                fieldId: 'payment',
                                value: (parseFloat(baseAmt) - parseFloat(tdsAmt) + parseFloat(taxAmt)).toFixed(2)
                            });
                        }
                    }

                }// End Vendor Prepayment code

                // Start Vendor Prepayment Application Code
                if (current_record.type == 'vendorprepaymentapplication') {
                    if (fieldName == 'apply' || fieldName == 'amount') {
                        // if (fieldName == 'amount' && scriptContext.sublistId == 'bill') {
                        log.debug("fieldName in fieldChanged VPPA", fieldName)
                        var Subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                        var Flag = inArray(Subsidiary, g_subisidiary);
                        if (Flag == parseInt(1)) {
                            // alert("FieldCHanged " + fieldName)
                            var TdsType = current_record.getValue({ fieldId: "custbody_tss_tds_relation" });
                            if (_logValidation(TdsType)) {
                                var BaseAmtObj = JSON.parse(current_record.getValue({ fieldId: "custbody_tss_it_appliedamt_withouttax" }) || '{}');
                                var currBaseAmt = BaseAmtObj ? BaseAmtObj.tdsamt || 0 : 0
                                // var billId = current_record.getCurrentSublistValue({ sublistId: 'bill', fieldId: 'doc' });
                                var currIndex = current_record.getCurrentSublistIndex({ sublistId: 'bill' });
                                var billId = current_record.getSublistValue({ sublistId: 'bill', fieldId: 'doc', line: currIndex });
                                log.debug("billId in fieldChanged VPPA", billId)
                                var isApplied = current_record.getCurrentSublistValue({ sublistId: 'bill', fieldId: 'apply' });
                                log.debug("isApplied in fieldChanged VPPA", isApplied)
                                var finalTdsBaseAmt = 0;
                                var TdsRate = parseFloat(current_record.getValue({ fieldId: "custbody_tss_tds_percentage" }) || 0);
                                if (isTrue(isApplied)) {
                                    var billTdsObj1 = search.lookupFields({
                                        type: 'vendorbill',
                                        id: billId,
                                        columns: ['custbody_tss_applied_tds_obj', 'custbody_tss_it_vpp_appld_tds']
                                    })
                                    var billTdsObj = billTdsObj1.custbody_tss_applied_tds_obj || '{}';
                                    billTdsObj = JSON.parse(billTdsObj);
                                    var billtdsAmt = 0;
                                    var billtdsBaseAmt = 0;
                                    for (var tdsRel in billTdsObj) {
                                        if (TdsType == tdsRel) {
                                            billtdsAmt = parseFloat(billTdsObj[tdsRel].tdsamt || 0) + parseFloat(billTdsObj[tdsRel].vetdsamt || 0)
                                            billtdsBaseAmt = parseFloat(billTdsObj[tdsRel].tdsbaseamt || 0) + parseFloat(billTdsObj[tdsRel].vetdsbaseamt || 0)
                                            break;
                                        }
                                    }
                                    log.debug("billtdsAmt in vppa fieldchanged", billtdsAmt)
                                    log.debug("billtdsBaseAmt in vppa fieldchanged", billtdsBaseAmt)
                                    if (billtdsBaseAmt > 0) {
                                        var billtdsBaseAmtTemp = billtdsBaseAmt
                                        //Checking Applied vpp tds amounts
                                        var billIDObj = JSON.parse(billTdsObj1.custbody_tss_it_vpp_appld_tds || '{}')
                                        log.debug("billIDObj in vppa fieldchanged", billIDObj)
                                        var billIDObjamt = billIDObj[TdsType] ? billIDObj[TdsType] : {}
                                        var billIDObjamtTtl = parseFloat(billIDObj[TdsType] ? (billIDObj[TdsType]['tdsbaseamount'] ? billIDObj[TdsType]['tdsbaseamount'] || 0 : 0) : 0)
                                        log.debug("billIDObjamtTtl in vppa fieldchanged", billIDObjamtTtl)
                                        if (billIDObjamtTtl > 0) {
                                            if (current_record.id) {
                                                billIDObjamt = parseFloat(billIDObj[TdsType]['tdsvppa'] ? billIDObj[TdsType]['tdsvppa'][current_record.id] || 0 : 0)
                                            }
                                            else {
                                                billIDObjamt = 0;
                                            }
                                            log.debug("billIDObjamt in vppa fieldchanged", billIDObjamt)
                                            billtdsBaseAmt = billtdsBaseAmt - billIDObjamtTtl + billIDObjamt
                                            log.debug("billtdsBaseAmt final in vppa fieldchanged", billtdsBaseAmt)
                                        }
                                        //If Still bill has pending TDS Amount to reverse
                                        if (billtdsBaseAmt <= billtdsBaseAmtTemp || (billIDObjamtTtl == 0 && billtdsBaseAmt > 0)) {
                                            // var remainingTdsAmt = (parseFloat(vppBaseAmt) - parseFloat(vppTaxAmt)) - (parseFloat(prevTDSamt) - prevTDSDeductedAmt)
                                            var remainingTdsAmt = parseFloat(vppBaseAmt) - parseFloat(prevTDSamt)
                                            // log.debug("vppaId", vppaId + '-' + appliedType + '-' + vppBaseAmt + '-' + vppTaxAmt + '-' + '-' + vppaTaxObj + vppaBaseAmt + '-' + prevTDSamt)
                                            log.debug("remainingTdsAmt in vppa fieldchanged", remainingTdsAmt)
                                            var currAmt = parseFloat(current_record.getCurrentSublistValue({ sublistId: 'bill', fieldId: 'amount' }) || 0);
                                            log.debug("currAmt in vppa fieldchanged", currAmt)
                                            var GstTaxCode = current_record.getValue({ fieldId: "custbody_tss_it_tax_code" });
                                            var finalTaxRate = -TdsRate
                                            // log.debug("finalTaxRate ", finalTaxRate)
                                            if (GstTaxCode) {
                                                var GstTaxRate = parseFloat(current_record.getValue({ fieldId: "custbody_tss_it_taxrate" }) || 0);
                                                finalTaxRate = GstTaxRate - TdsRate
                                                // log.debug("GstTaxRate in vppa fieldchanged", GstTaxRate)
                                            }
                                            log.debug("finalTaxRate in vppa fieldchanged", finalTaxRate)
                                            currAmt = (finalTaxRate != 0) ? (currAmt / (1 + finalTaxRate / 100)) : parseFloat(currAmt);
                                            log.debug("currAmt after removing GST in vppa fieldchanged", currAmt)
                                            //Taking minimum of bill tds base amount and applied line bill amount
                                            billtdsBaseAmt = billtdsBaseAmt < currAmt ? billtdsBaseAmt : currAmt
                                            log.debug("billtdsBaseAmt after checking min of line and bill base", billtdsBaseAmt)
                                            //Taking minimum of vpp tds base amount and (minimum of bill tds base amount and applied line bill amount)
                                            billtdsBaseAmt = billtdsBaseAmt < remainingTdsAmt ? billtdsBaseAmt : remainingTdsAmt
                                            log.debug("billtdsBaseAmt after checking min of remaining tdsamt and (min of line and bill base)", billtdsBaseAmt)
                                            if (remainingTdsAmt > 0) {
                                                if (!BaseAmtObj['tdsbills']) {
                                                    BaseAmtObj['tdsbills'] = {};
                                                }
                                                var oldbiltds = parseFloat(BaseAmtObj['tdsbills'][billId] || 0)
                                                log.debug("oldbiltds in vppa fieldchanged", oldbiltds)
                                                if (oldbiltds > 0) {
                                                    BaseAmtObj['tdsamt'] = (parseFloat(BaseAmtObj['tdsamt'] || 0)) > 0 ? (parseFloat(BaseAmtObj['tdsamt'] || 0) - oldbiltds).toFixed(2) : 0;
                                                    BaseAmtObj['tdsbills'][billId] = 0;
                                                }

                                                if (remainingTdsAmt >= (billtdsBaseAmt)) {
                                                    // var toBeApplyAmt = parseFloat(remainingTdsAmt) - parseFloat(currBaseAmt)
                                                    // current_record.setCurrentSublistValue({ sublistId: 'bill', fieldId: 'amount', value: toBeApplyAmt });

                                                    // var oldbasetds = parseFloat(BaseAmtObj['tdsamt'] || 0);
                                                    log.debug("billtdsBaseAmt in vppa fieldchanged", billtdsBaseAmt)
                                                    var finalbilltdstobeupdate = billtdsBaseAmt;
                                                    log.debug('final bill tds to be update after amount change in VPPA fieldchanged', finalbilltdstobeupdate)
                                                    //Getting the Base amount after TDS and GST
                                                    // var GstTaxCode = current_record.getValue({ fieldId: "custbody_tss_it_tax_code" });
                                                    // var finalTaxRate = -TdsRate
                                                    // // log.debug("finalTaxRate ", finalTaxRate)
                                                    // if (GstTaxCode) {
                                                    //     var GstTaxRate = parseFloat(current_record.getValue({ fieldId: "custbody_tss_it_taxrate" }) || 0);
                                                    //     finalTaxRate = GstTaxRate - TdsRate
                                                    //     // log.debug("GstTaxRate in vppa fieldchanged", GstTaxRate)
                                                    // }
                                                    // log.debug("finalTaxRate in vppa fieldchanged", finalTaxRate)
                                                    // var finalBaseAmt = (finalTaxRate != 0) ? (finalbilltdstobeupdate / (1 + finalTaxRate / 100)) : parseFloat(finalbilltdstobeupdate);
                                                    BaseAmtObj['tdsamt'] = (parseFloat(BaseAmtObj['tdsamt'] || 0) + finalbilltdstobeupdate).toFixed(2)
                                                    log.debug("BaseAmtObj in vppa fieldchanged", BaseAmtObj)
                                                    finalTdsBaseAmt = BaseAmtObj['tdsamt']
                                                    BaseAmtObj['tdsbills'][billId] = finalbilltdstobeupdate.toFixed(2);
                                                    // BaseAmtObj['tdsbills'] = tdsbillsObj
                                                    log.debug("BaseAmtObj1 in vppa fieldchanged", BaseAmtObj)
                                                    log.debug("BaseAmtObj strigify in vppa fieldchanged", JSON.stringify(BaseAmtObj))
                                                    current_record.setValue({ fieldId: "custbody_tss_it_appliedamt_withouttax", value: JSON.stringify(BaseAmtObj) });
                                                    log.debug("setting Done!")

                                                }
                                                else {
                                                    log.debug("entered in else")
                                                    var toBeApplyAmt = parseFloat(remainingTdsAmt)
                                                    log.debug("toBeApplyAmt in fieldChanged", toBeApplyAmt)
                                                    if (parseFloat(toBeApplyAmt) > 0) {
                                                        // current_record.setCurrentSublistValue({ sublistId: 'bill', fieldId: 'amount', value: toBeApplyAmt });
                                                        if (billtdsBaseAmt > 0) {
                                                            var tobeapplytds = 0
                                                            if (toBeApplyAmt >= billtdsBaseAmt) {
                                                                tobeapplytds = toBeApplyAmt
                                                            }
                                                            else {
                                                                tobeapplytds = billtdsBaseAmt
                                                            }
                                                            var GstTaxCode = current_record.getValue({ fieldId: "custbody_tss_it_tax_code" });
                                                            var finalTaxRate = -TdsRate
                                                            if (GstTaxCode) {
                                                                var GstTaxRate = parseFloat(current_record.getValue({ fieldId: "custbody_tss_it_taxrate" }) || 0);
                                                                finalTaxRate = GstTaxRate - TdsRate
                                                            }
                                                            var finalBaseAmt = (finalTaxRate != 0) ? (tobeapplytds / (1 + finalTaxRate / 100)) : parseFloat(tobeapplytds);

                                                            BaseAmtObj['tdsamt'] = (parseFloat(BaseAmtObj['tdsamt'] || 0) + finalBaseAmt).toFixed(2)
                                                            finalTdsBaseAmt = BaseAmtObj['tdsamt']
                                                            if (!BaseAmtObj['tdsbills']) {
                                                                BaseAmtObj['tdsbills'] = {};
                                                            }
                                                            BaseAmtObj['tdsbills'][billId] = finalBaseAmt.toFixed(2)
                                                            current_record.setValue({ fieldId: "custbody_tss_it_appliedamt_withouttax", value: JSON.stringify(BaseAmtObj) });
                                                        }

                                                    }
                                                }
                                            }
                                            else {
                                                // BaseAmtObj['tdsbills'][billId] = currAmt
                                                log.debug("Entered in else part, As TDS amount reversed in earlier Applications no tds impacted on this transaction")
                                            }
                                        }
                                    }
                                    else {
                                        alert("TDS is not matching for this bill, So cannot apply this bill");
                                        finalTdsBaseAmt = parseFloat(BaseAmtObj['tdsamt'] || 0)
                                        // alert(finalTdsBaseAmt)
                                        log.debug("finalTdsBaseAmt in vppa fieldchanged when TDS is not matched", finalTdsBaseAmt)
                                        current_record.setCurrentSublistValue({ sublistId: 'bill', fieldId: 'apply', value: false });

                                    }
                                }
                                else { // If User Un Applying the Bill in Vendor Prepayment Application
                                    // var currAmt = current_record.getCurrentSublistValue({ sublistId: 'bill', fieldId: 'amount' });
                                    // log.debug("entered in Apply when False, currAmt - ", currAmt)
                                    log.debug("entered in Apply when False")
                                    var currTds = parseFloat(BaseAmtObj['tdsamt'] || 0)
                                    if (currTds > 0) {
                                        if (!BaseAmtObj['tdsbills']) {
                                            BaseAmtObj['tdsbills'] = {};
                                        }
                                        var currbillTds = parseFloat(BaseAmtObj['tdsbills'][billId] || 0)
                                        if (currbillTds > 0) {
                                            BaseAmtObj['tdsbills'][billId] = 0;
                                            BaseAmtObj['tdsamt'] = (currTds - currbillTds).toFixed(2)
                                            current_record.setValue({ fieldId: "custbody_tss_it_appliedamt_withouttax", value: JSON.stringify(BaseAmtObj) });
                                        }
                                    }
                                    finalTdsBaseAmt = parseFloat(BaseAmtObj['tdsamt'] || 0)
                                }

                                //Setting the TDS Base Amount and TDS Amounts
                                //Setting TDS Base Amount in application
                                current_record.setValue({
                                    fieldId: 'custbody_tss_tds_baseamt',
                                    value: parseFloat(finalTdsBaseAmt),
                                    ignoreFieldChange: true
                                });
                                var finalTdsAmt = (parseFloat(TdsRate) * parseFloat(finalTdsBaseAmt)) / 100;
                                finalTdsAmt = applyTdsRoundMethod(TDSrelObj.custrecord_tss_tds_rounding[0].value, finalTdsAmt);
                                //Setting TDS Amount in application
                                current_record.setValue({
                                    fieldId: 'custbody_tss_tds_amount',
                                    value: parseFloat(finalTdsAmt).toFixed(2),
                                    ignoreFieldChange: true
                                });

                            }
                        }
                    }
                }// End Vendor Prepayment Application Code

            }// end try
            catch (e) {
                log.error("Error in fieldChanged", e);
            } // end catch(e)
        } // end function fieldChanged(scriptContext)

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
            if (scriptContext.fieldId == 'apply' || scriptContext.fieldId == 'amount') {
                // alert("postsource")
            }
        }

        /**
         * Function to be executed after sublist is inserted, removed, or edited.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @since 2015.2
         */
        function sublistChanged(scriptContext) {

        }

        /**
         * Function to be executed after line is selected.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @since 2015.2
         */
        function lineInit(scriptContext) {

        }

        /**
         * Validation function to be executed when field is changed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @returns {boolean} Return true if field is valid
         *
         * @since 2015.2
         */
        function validateField(scriptContext) {

        }

        /**
         * Validation function to be executed when sublist line is committed.
         * 
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateLine(scriptContext) {

        }

        /**
         * Validation function to be executed when sublist line is inserted.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateInsert(scriptContext) {

        }

        /**
         * Validation function to be executed when record is deleted.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateDelete(scriptContext) {

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
            try {
                var current_record = scriptContext.currentRecord;
                var Subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                var Flag = inArray(Subsidiary, g_subisidiary);
                if (Flag == parseInt(1)) {
                    var TdsType = current_record.getValue({ fieldId: "custbody_tss_tds_relation" });
                    if (_logValidation(TdsType)) {
                        if (current_record.type == 'vendorprepayment') {
                            var TdsAmt = current_record.getValue({ fieldId: "custbody_tss_tds_amount" });
                            if (!_logValidation(TdsAmt)) {
                                alert("Please Enter TDS Amount..")
                                return false;
                            }
                            var TdsRate = current_record.getValue({ fieldId: "custbody_tss_tds_percentage" });
                            if (!_logValidation(TdsRate)) {
                                alert("Please Enter TDS% ")
                                return false;
                            }
                            var TdsBaseAmt = current_record.getValue({ fieldId: "custbody_tss_tds_baseamt" });
                            if (!_logValidation(TdsBaseAmt)) {
                                alert("Please Enter TDS Base Amount..")
                                return false;
                            }
                        }
                        if (current_record.type == 'vendorprepaymentapplication') {
                            var BaseAmtObj = JSON.parse(current_record.getValue({ fieldId: "custbody_tss_it_appliedamt_withouttax" }) || '{}');
                            log.debug("BaseAmtObj n saverecord", BaseAmtObj)
                            // Updating the Applied Amounts Without Tax field in vppa by removing zero bills
                            // if (parseFloat(BaseAmtObj['tdsamt'] || 0) > 0) {
                            for (var billID in BaseAmtObj['tdsbills']) {
                                if (BaseAmtObj['tdsbills'].hasOwnProperty(billID) && BaseAmtObj['tdsbills'][billID] === 0) {
                                    delete BaseAmtObj['tdsbills'][billID];
                                }
                            }

                            // }
                            log.debug("BaseAmtObj filtered in saverecord", BaseAmtObj)
                            var isBaseAmtObjSet = false;
                            log.debug("vppBaseAmt - prevTDSamt in saverecord", vppBaseAmt + '-' + prevTDSamt)
                            if (vppBaseAmt > prevTDSamt) {

                                var currBaseAmt = BaseAmtObj ? BaseAmtObj.tdsamt || 0 : 0
                                var remainingTdsAmt = parseFloat(vppBaseAmt) - parseFloat(prevTDSamt)
                                var appliedAmt = parseFloat(current_record.getValue({ fieldId: "applied" }))
                                log.debug("currBaseAmt in saverecord", currBaseAmt)
                                log.debug("appliedAmt in saverecord", appliedAmt)
                                if (parseFloat(currBaseAmt) > 0) {
                                    var lastTdsBaseAmt = (remainingTdsAmt - parseFloat(currBaseAmt))
                                    log.debug("lastTdsBaseAmt in saverecord", lastTdsBaseAmt)
                                    if (lastTdsBaseAmt > 0) {
                                        //Checking the Any TDS Bill has selected otherwise throw error
                                        var TDSbillsApplied = BaseAmtObj ? BaseAmtObj.tdsbills || {} : {}
                                        log.debug("TDSbillsAppliedin saveRecord", TDSbillsApplied)
                                        if (!TDSbillsApplied || Object.keys(TDSbillsApplied).length === 0) {
                                            alert("Please select atleast one Vendor Bill with same TDS Section")
                                            return false;
                                        }
                                        log.debug("vppAmt - vppaAmt in saverecord", vppAmt + '-' + vppaAmt)
                                        lastTdsBaseAmt += parseFloat(currBaseAmt)
                                        // log.debug("parseFloat(appliedAmt) in saverecord", parseFloat(appliedAmt))
                                        // log.debug("parseFloat(vppAmt) - parseFloat(vppaAmt) in saverecord", parseFloat(vppAmt) - parseFloat(vppaAmt))
                                        if ((parseFloat(vppAmt) - parseFloat(vppaAmt)).toFixed(2) == parseFloat(appliedAmt).toFixed(2)) {
                                            log.debug("Reversing the all remaining TDS in this application, As last application", lastTdsBaseAmt);
                                            BaseAmtObj['tdsamt'] = lastTdsBaseAmt.toFixed(2);
                                            current_record.setValue({ fieldId: "custbody_tss_it_appliedamt_withouttax", value: JSON.stringify(BaseAmtObj) });
                                            isBaseAmtObjSet = true;
                                            // //Setting TDS Amount in application
                                            // current_record.setValue({
                                            //     fieldId: 'custbody_tss_tds_amount',
                                            //     value: parseFloat(lastTdsBaseAmt),
                                            //     ignoreFieldChange: true
                                            // });

                                            //Setting the TDS Base Amount and TDS Amounts
                                            //Setting TDS Base Amount in application
                                            current_record.setValue({
                                                fieldId: 'custbody_tss_tds_baseamt',
                                                value: parseFloat(lastTdsBaseAmt).toFixed(2),
                                                ignoreFieldChange: true
                                            });
                                            var TdsRate = current_record.getValue({ fieldId: "custbody_tss_tds_percentage" }) || 0;
                                            var finalTdsAmt = (parseFloat(TdsRate) * parseFloat(lastTdsBaseAmt)) / 100;
                                            finalTdsAmt = applyTdsRoundMethod(TDSrelObj.custrecord_tss_tds_rounding[0].value, finalTdsAmt);
                                            //Setting TDS Amount in application
                                            current_record.setValue({
                                                fieldId: 'custbody_tss_tds_amount',
                                                value: parseFloat(finalTdsAmt),
                                                ignoreFieldChange: true
                                            });
                                        }
                                    }
                                }
                                else {
                                    log.debug("vppAmt - vppaAmt -  appliedAmt", vppAmt + '-' + vppaAmt + '-' + appliedAmt)
                                    if (vppAmt - vppaAmt == appliedAmt) {
                                        alert("TDS Section not matched/deducted with applied bills");
                                        return false;
                                    }
                                }
                            }
                            else {
                                log.debug("Already TDS is reversed in previous Applications")
                            }
                            log.debug("isFalse(isBaseAmtObjSet) in saverecord", isFalse(isBaseAmtObjSet))
                            if (isFalse(isBaseAmtObjSet)) {
                                current_record.setValue({ fieldId: "custbody_tss_it_appliedamt_withouttax", value: JSON.stringify(BaseAmtObj) });
                            }

                        }
                    }

                } // end if (Flag == parseInt(1))

                return true;

            } catch (error) {
                log.error("Error in saveRecord", error);
                alert("Error in CLI TSS TDS On VPP script - " + error)
                return false;
            }
        }

        // Custom functions are defined below....

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

        } // end function inArray(needle,haystack)

        function isTrue(value) {
            if (value == 'T' || value == true || value == 'true') {
                return true;
            }
            else {
                return false;
            }
        }

        function isFalse(value) {
            if (value == 'F' || value == false || value == 'false') {
                return true;
            }
            else {
                return false;
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

        function getTDSitem(tdsType) {
            var tdsItem1;
            var tdsItem = search.lookupFields({
                type: 'customrecord_tss_tdsrelation',
                id: tdsType,
                columns: ['custrecord_tss_tds_vedtdsitem']
            });
            log.debug("tdsItem in getTDSitem function", tdsItem);
            if (tdsItem.custrecord_tss_tds_vedtdsitem.length > 0) {
                tdsItem1 = tdsItem.custrecord_tss_tds_vedtdsitem[0].value;
            }
            return tdsItem1
        } // end function getTDSitem(tdsType)

        function getTDSaccount(tdsType) {
            var tdsAccount1;
            var tdsAccount = search.lookupFields({
                type: 'customrecord_tss_tdsrelation',
                id: tdsType,
                columns: ['custrecord_tss_tds_vedtdsaccount']
            });
            if (tdsAccount.custrecord_tss_tds_vedtdsaccount.length > 0) {
                tdsAccount1 = tdsAccount.custrecord_tss_tds_vedtdsaccount[0].value;
            }
            return tdsAccount1;
        } // end function getTDSaccount(tdsType)

        function SearchGlobalParameter() {
            var a_filters = new Array();
            var a_column = new Array();
            var global_sub;
            a_filters.push(search.createFilter({
                name: 'isinactive',
                operator: 'is',
                values: 'F'
            }));
            a_column.push(search.createColumn({
                name: 'internalid',
            }));
            var global_param_search = search.create({
                type: 'customrecord_tss_global_parameter',
                filters: a_filters,
                columns: a_column
            });
            var global_param_search_result = global_param_search.run().getRange(0, 100);
            if (_logValidation(global_param_search_result)) {
                global_sub = global_param_search_result[0].getValue({ name: 'internalid' });
            }
            return global_sub;
        } // end function SearchGlobalParameter()


        function applyTdsRoundMethod(tdsRoundMethod, tdsAmount) {
            var roundedtdsAmount = tdsAmount;
            if (tdsRoundMethod == 2) {
                roundedtdsAmount = Math.ceil(tdsAmount)
            }
            if (tdsRoundMethod == 3) {
                roundedtdsAmount = Math.round(tdsAmount / 10) * 10;
            }
            if (tdsRoundMethod == 4) {
                if (tdsAmount < 50) {
                    var tdsamt = tdsAmount + 50;
                    roundedtdsAmount = Math.round(tdsamt / 100) * 100;
                }
                else {
                    roundedtdsAmount = Math.round(tdsAmount / 100) * 100;
                }
            }

            return roundedtdsAmount;
        } // end function applyTdsRoundMethod(tdsRoundMethod,tdsAmount)

        function clearTDS(currentRec) {

            currentRec.setValue({ fieldId: 'custbody_tss_tds_amount', value: 0, ignoreFieldChange: true });
            currentRec.setValue({ fieldId: 'custbody_tss_tds_baseamt', value: '', ignoreFieldChange: true });
            var CompareTaxcode = currentRec.getValue({ fieldId: "custbody_tss_it_tax_code" });
            if (!CompareTaxcode) {
                var existingData = { tdsamt: 0, tdsbills: {} };
                currentRec.setValue({
                    fieldId: 'custbody_tss_it_appliedamt_withouttax',
                    value: JSON.stringify(existingData),
                    ignoreFieldChange: true
                });
            }
        }

        function tdsAutoApply(current_record) {
            try {
                var TdsType = current_record.getValue({ fieldId: "custbody_tss_tds_relation" });
                if (_logValidation(TdsType)) {
                    var BaseAmtObj = JSON.parse(current_record.getValue({ fieldId: "custbody_tss_it_appliedamt_withouttax" }) || '{}');
                    log.debug("BaseAmtObj in autoapply before/after gst vppa", BaseAmtObj)
                    // var BaseAmtObj = { 'tdsamt': 0, 'tdsbills': {} }
                    var lineCount = current_record.getLineCount({ sublistId: 'bill' });
                    //Getting the Base amount after TDS and GST
                    var TdsRate = parseFloat(current_record.getValue({ fieldId: "custbody_tss_tds_percentage" }) || 0);
                    var GstTaxCode = current_record.getValue({ fieldId: "custbody_tss_it_tax_code" });
                    var finalTaxRate = -TdsRate
                    if (GstTaxCode) {
                        var GstTaxRate = parseFloat(current_record.getValue({ fieldId: "custbody_tss_it_taxrate" }) || 0);
                        finalTaxRate = GstTaxRate - TdsRate
                    }


                    for (var i = 0; i < lineCount; i++) {
                        var isApplied = current_record.getSublistValue({
                            sublistId: 'bill',
                            fieldId: 'apply',
                            line: i
                        });

                        if (isApplied) {
                            var billId = current_record.getSublistValue({
                                sublistId: 'bill',
                                fieldId: 'doc',
                                line: i
                            });
                            var currAmt = current_record.getSublistValue({
                                sublistId: 'bill',
                                fieldId: 'amount',
                                line: i
                            });

                            if (billId && currAmt) {
                                var currBaseAmt = BaseAmtObj ? BaseAmtObj.tdsamt || 0 : 0
                                var billTdsObj1 = search.lookupFields({
                                    type: 'vendorbill',
                                    id: billId,
                                    columns: ['custbody_tss_applied_tds_obj', 'custbody_tss_it_vpp_appld_tds']
                                })
                                var billTdsObj = billTdsObj1.custbody_tss_applied_tds_obj || '{}';
                                billTdsObj = JSON.parse(billTdsObj);
                                var billtdsAmt = 0;
                                var billtdsBaseAmt = 0;
                                for (var tdsRel in billTdsObj) {
                                    if (TdsType == tdsRel) {
                                        billtdsAmt = parseFloat(billTdsObj[tdsRel].tdsamt || 0) + parseFloat(billTdsObj[tdsRel].vetdsamt || 0)
                                        billtdsBaseAmt = parseFloat(billTdsObj[tdsRel].tdsbaseamt || 0) + parseFloat(billTdsObj[tdsRel].vetdsbaseamt || 0)
                                        break;
                                    }
                                }
                                log.debug("billtdsAmt in vppa autoapply", billtdsAmt)
                                log.debug("billtdsBaseAmt in vppa autoapply", billtdsBaseAmt)
                                var billtdsBaseAmtTemp = billtdsBaseAmt
                                //Checking Applied vpp tds amounts
                                var billIDObj = JSON.parse(billTdsObj1.custbody_tss_it_vpp_appld_tds || '{}')
                                log.debug("billIDObj in vppa autoapply", billIDObj)
                                var billIDObjamt = billIDObj[TdsType] ? billIDObj[TdsType] : {}
                                var billIDObjamtTtl = parseFloat(billIDObj[TdsType] ? (billIDObj[TdsType]['tdsbaseamount'] ? billIDObj[TdsType]['tdsbaseamount'] || 0 : 0) : 0)
                                log.debug("billIDObjamtTtl in vppa autoapply", billIDObjamtTtl)
                                if (billIDObjamtTtl > 0) {
                                    if (current_record.id) {
                                        billIDObjamt = parseFloat(billIDObj[TdsType]['tdsvppa'] ? billIDObj[TdsType]['tdsvppa'][current_record.id] || 0 : 0)
                                    }
                                    else {
                                        billIDObjamt = 0;
                                    }
                                    log.debug("billIDObjamt in vppa autoapply", billIDObjamt)
                                    billtdsBaseAmt = billtdsBaseAmt - billIDObjamtTtl + billIDObjamt
                                    log.debug("billtdsBaseAmt final in vppa autoapply", billtdsBaseAmt)
                                }
                                //If Still bill has pending TDS Amount to reverse
                                if (billtdsBaseAmt <= billtdsBaseAmtTemp || (billIDObjamtTtl == 0 && billtdsBaseAmt > 0)) {
                                    var remainingTdsAmt = parseFloat(vppBaseAmt) - parseFloat(prevTDSamt)
                                    log.debug("remainingTdsAmt in vppa autoapply", remainingTdsAmt)
                                    log.debug("currAmt in vppa autoapply", currAmt)
                                    currAmt = (finalTaxRate != 0) ? (currAmt / (1 + finalTaxRate / 100)) : parseFloat(currAmt);
                                    log.debug("currAmt after removing GST in vppa fieldchanged", currAmt)
                                    billtdsBaseAmt = billtdsBaseAmt < currAmt ? billtdsBaseAmt : currAmt
                                    if (remainingTdsAmt > 0) {
                                        if (!BaseAmtObj['tdsbills']) {
                                            BaseAmtObj['tdsbills'] = {};
                                        }
                                        log.debug("billtdsBaseAmt in vppa autoapply", billtdsBaseAmt)
                                        if (remainingTdsAmt >= (billtdsBaseAmt + parseFloat(currBaseAmt))) {
                                            log.debug("billtdsBaseAmt).toFixed(2)", billtdsBaseAmt.toFixed(2))
                                            // BaseAmtObj['tdsamt'] = (parseFloat(BaseAmtObj['tdsamt'] || 0) + billtdsBaseAmt).toFixed(2)
                                            // BaseAmtObj['tdsbills'][billId] = billtdsBaseAmt.toFixed(2);
                                            // var finalBaseAmt = (finalTaxRate != 0) ? (billtdsBaseAmt / (1 + (finalTaxRate / 100))) : parseFloat(billtdsBaseAmt);
                                            BaseAmtObj['tdsamt'] = (parseFloat(BaseAmtObj['tdsamt'] || 0) + billtdsBaseAmt).toFixed(2)
                                            BaseAmtObj['tdsbills'][billId] = billtdsBaseAmt.toFixed(2);
                                        }
                                        else {
                                            var toBeApplyAmt = parseFloat(remainingTdsAmt) - parseFloat(currBaseAmt)
                                            if (parseFloat(toBeApplyAmt) > 0) {
                                                if (billtdsBaseAmt > 0) {
                                                    var tobeapplytds = 0
                                                    if (toBeApplyAmt >= billtdsBaseAmt) {
                                                        tobeapplytds = toBeApplyAmt
                                                    }
                                                    else {
                                                        tobeapplytds = billtdsBaseAmt
                                                    }
                                                    // BaseAmtObj['tdsamt'] = (parseFloat(BaseAmtObj['tdsamt'] || 0) + tobeapplytds).toFixed(2)
                                                    // if (!BaseAmtObj['tdsbills']) {
                                                    //     BaseAmtObj['tdsbills'] = {};
                                                    // }
                                                    // BaseAmtObj['tdsbills'][billId] = tobeapplytds.toFixed(2)
                                                    // var finalBaseAmt = (finalTaxRate != 0) ? (tobeapplytds / (1 + (finalTaxRate / 100))) : parseFloat(tobeapplytds);
                                                    BaseAmtObj['tdsamt'] = (parseFloat(BaseAmtObj['tdsamt'] || 0) + tobeapplytds).toFixed(2)
                                                    if (!BaseAmtObj['tdsbills']) {
                                                        BaseAmtObj['tdsbills'] = {};
                                                    }
                                                    BaseAmtObj['tdsbills'][billId] = tobeapplytds.toFixed(2)

                                                }
                                            }
                                        }
                                    }
                                }

                                current_record.setValue({ fieldId: "custbody_tss_it_appliedamt_withouttax", value: JSON.stringify(BaseAmtObj) });

                                //Setting the TDS Base Amount and TDS Amounts
                                //Setting TDS Base Amount in application
                                current_record.setValue({
                                    fieldId: 'custbody_tss_tds_baseamt',
                                    value: parseFloat(BaseAmtObj['tdsamt']),
                                    ignoreFieldChange: true
                                });
                                var finalTdsAmt = (parseFloat(TdsRate) * parseFloat(BaseAmtObj['tdsamt'])) / 100;
                                finalTdsAmt = applyTdsRoundMethod(TDSrelObj.custrecord_tss_tds_rounding[0].value, finalTdsAmt);
                                //Setting TDS Amount in application
                                current_record.setValue({
                                    fieldId: 'custbody_tss_tds_amount',
                                    value: parseFloat(finalTdsAmt),
                                    ignoreFieldChange: true
                                });

                            }
                        }
                    }

                }

                console.log("GST updated after Auto Apply", BaseAmtObj);

            } catch (e) {
                log.error("Error in tdsAutoApply", e);
            }
        }

        // end Custom Functions............

        return {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            // postSourcing: postSourcing,
            //sublistChanged: sublistChanged,
            //lineInit: lineInit,
            //validateField: validateField,
            //validateLine: validateLine,
            //validateInsert: validateInsert,
            //validateDelete: validateDelete,
            saveRecord: saveRecord
        };

    });
