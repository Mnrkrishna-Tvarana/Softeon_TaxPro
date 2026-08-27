/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */

/**
 * Script Name               : CLI TSS TDS New
 * Script Author             : MNR Krishna
 * Script Type               : Client Script
 * Script Version            : 2.1
 * Script Created date       : 11/11/2024
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  
 */


define(['N/search', 'N/currentRecord', 'N/record', 'N/format', 'N/ui/dialog'],
    /**
     * @param{search} search
     */
    function (search, currentRecord, record, format, dialog) {


        //Global Variables defining......
        var operationType;
        var vendor
        var g_subisidiary = new Array();
        var g_tdsCode;
        var g_tdsRoundMethod;
        var g_TDS_Calculate;
        var tdsLinesVisibleFeature = false; // Assuming the feature is enabled. You can replace this with an actual check if needed.

        var isTDStobeDefault = true; // Assuming TDS is to be defaulted. You can replace this with false if you don't want auto defaulting.
        var g_tdsRel // Global variable to store TDS Relation for the vendor


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
                operationType = scriptContext.mode;
                if (operationType == 'edit') {
                    vendor = current_record.getValue({ fieldId: "entity" });
                }
                var GlobalRecId = SearchGlobalParameter();
                if (_logValidation(GlobalRecId)) {

                    var GlobalRec = record.load({ type: 'customrecord_tss_global_parameter', id: GlobalRecId, });
                    g_subisidiary = GlobalRec.getValue('custrecord_tss_gp_subsidiary');
                    log.debug("g_subisidiary", g_subisidiary);
                    g_tdsCode = GlobalRec.getValue('custrecord_tss_gp_tdscode');
                    log.debug("g_tdsCode", g_tdsCode);
                } // end if (_logValidation(GlobalRecId))

                var rec_subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                var Flag = 0;
                Flag = inArray(rec_subsidiary, g_subisidiary);
                if (Flag == parseInt(1)) {
                    if (operationType == 'copy') {
                        current_record.setValue({
                            fieldId: 'custbody_tss_it_tds_overrideline',
                            value: false,
                            ignoreFieldChange: true,
                        });
                        //Setting the Applied TDS object as empty in field
                        current_record.setValue({
                            fieldId: 'custbody_tss_applied_tds_obj',
                            value: '{}'
                        });

                        //Setting the VPP TDS Amt object as empty in field
                        current_record.setValue({
                            fieldId: 'custbody_tss_it_vpp_appld_tds',
                            value: '{}'
                        });
                    }

                    current_record.setValue({
                        fieldId: 'custbody_tss_isvalidsubsidiary',
                        value: true
                    });
                    var tdsOverrideField = current_record.getField({ fieldId: 'custbody_tss_it_tds_overrideline' });
                    log.debug("tdsOverrideField in pageInit", JSON.stringify(tdsOverrideField));
                    if (operationType == 'copy' || ((!_logValidation(tdsOverrideField) || tdsOverrideField.isDisplay == false) && !tdsLinesVisibleFeature)) {

                        setTimeout(function () {
                            var Item_Count = current_record.getLineCount({ sublistId: 'item' });
                            log.debug("Item_Count in pageInit", Item_Count);
                            for (var i = Item_Count - 1; i >= 0; i--) {
                                var Tdscheck = current_record.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_tss_tdsline',
                                    line: i
                                });
                                //log.debug("Tdscheck",Tdscheck);
                                if (isTrue(Tdscheck)) {
                                    current_record.removeLine({
                                        sublistId: 'item',
                                        line: i,
                                        // ignoreRecalc: true
                                    });
                                } // end if(isTrue(Tdscheck))
                            } // end for (var i = Item_Count-1; i >= 0; i--)

                            var Expense_Count = current_record.getLineCount({ sublistId: 'expense' });
                            log.debug("Expense_Count in pageInit", Expense_Count);
                            for (var i = Expense_Count - 1; i >= 0; i--) {
                                var Tdscheck = current_record.getSublistValue({
                                    sublistId: 'expense',
                                    fieldId: 'custcol_tss_tdsline',
                                    line: i
                                });
                                if (isTrue(Tdscheck)) {
                                    current_record.removeLine({
                                        sublistId: 'expense',
                                        line: i,
                                    });
                                } // end if(isTrue(Tdscheck))
                            } // end for (var i = 0; i < Expense_Count; i++)
                        }, 1000);
                    }
                    if (_logValidation(tdsOverrideField) && tdsOverrideField.isDisplay == true) {
                        var overrideTDS = current_record.getValue({ fieldId: 'custbody_tss_it_tds_overrideline' });
                        toggleOverrideColumn(current_record, overrideTDS, false);
                    }

                    //Getting TDS Relation if only one is available
                    if (isTDStobeDefault) {
                        var rec_vendor = current_record.getValue({ fieldId: "entity" });
                        if (rec_vendor) {
                            var rec_date = current_record.getValue({ fieldId: "trandate" });
                            getTDSrel(rec_vendor, rec_date)
                        }
                    }
                }
                else {
                    current_record.setValue({
                        fieldId: 'custbody_tss_isvalidsubsidiary',
                        value: false
                    });
                }

            }// end try
            catch (e) {
                alert("Error in CLI_TSS_VendorBill_TDS pageInit" + e);
                log.error("Error i pageInit", e);
            }
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
                var s_recordType = current_record.type;
                var sublistName = scriptContext.sublistId;
                var fieldName = scriptContext.fieldId;

                if (scriptContext.fieldId == 'custbody_tss_it_tds_overrideline') {
                    var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                    if (isTrue(Flag)) {
                        var overrideTDS = current_record.getValue({ fieldId: 'custbody_tss_it_tds_overrideline' });
                        toggleOverrideColumn(current_record, overrideTDS, true);

                        // ← ADD THIS: When unchecked, clear all line-level override checkboxes
                        // if (!isTrue(overrideTDS)) {
                        //     var expenseCount = current_record.getLineCount({ sublistId: 'expense' });
                        //     for (var i = 0; i < expenseCount; i++) {
                        //         var isOverride = current_record.getSublistValue({ sublistId: 'expense', fieldId: 'custcol_tss_it_tds_override', line: i });
                        //         if (isTrue(isOverride)) {
                        //             current_record.selectLine({ sublistId: 'expense', line: i });
                        //             current_record.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'custcol_tss_it_tds_override', value: false });
                        //             current_record.commitLine({ sublistId: 'expense' });
                        //         }
                        //     }

                        //     var itemCount = current_record.getLineCount({ sublistId: 'item' });
                        //     for (var j = 0; j < itemCount; j++) {
                        //         var isOverride = current_record.getSublistValue({ sublistId: 'item', fieldId: 'custcol_tss_it_tds_override', line: j });
                        //         if (isTrue(isOverride)) {
                        //             current_record.selectLine({ sublistId: 'item', line: j });
                        //             current_record.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_tss_it_tds_override', value: false });
                        //             current_record.commitLine({ sublistId: 'item' });
                        //         }
                        //     }
                        // }
                    }
                }

                if (operationType == 'edit' && scriptContext.fieldId == 'entity') {
                    var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                    var rec_vendor = current_record.getValue({ fieldId: "entity" });
                    if (isTrue(Flag) && rec_vendor != vendor) {
                        alert("Sorry you can't change the vendor.");
                        current_record.setValue({
                            fieldId: 'entity',
                            value: vendor,
                            ignoreFieldChange: true,
                            forceSyncSourcing: true
                        });
                    } // end if (isTrue(Flag))
                    else if (isTrue(Flag) && isTDStobeDefault) {
                        var rec_date = current_record.getValue({ fieldId: "trandate" });
                        getTDSrel(rec_vendor, rec_date)
                    }
                } // end  if (operationType == 'edit' && scriptContext.fieldId == 'entity')

                // TDS Line Overrride TDS Amounts validations based on rate and baseamount
                // if ((fieldName == 'custcol_tss_tdspercent' || fieldName == 'custcol_tss_baseamount') && (sublistName == 'item' || sublistName == 'expense')) {
                //     var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                //     if (isTrue(Flag)) {
                //         var tdsLineFlag = current_record.getCurrentSublistValue({sublistId: sublistName, fieldId: "custcol_tss_tdsline"});
                //         var overrideTDS = current_record.getCurrentSublistValue({ sublistId: sublistName, fieldId: 'custcol_tss_it_tds_override' });
                //         if (isTrue(tdsLineFlag) && isTrue(overrideTDS)) {
                //             var tdsPercentage = current_record.getCurrentSublistValue({ sublistId: sublistName, fieldId: "custcol_tss_tdspercent" });
                //             var tdsBaseAmt = current_record.getCurrentSublistValue({ sublistId: sublistName, fieldId: "custcol_tss_baseamount" });
                //             var calculatedTdsAmt = (tdsPercentage / 100) * tdsBaseAmt;
                //             var roundedTdsAmt = applyTdsRoundMethod(g_tdsRoundMethod, calculatedTdsAmt);
                //             current_record.setCurrentSublistValue({ sublistId: sublistName, fieldId: "custcol_tss_tdsline", value: roundedTdsAmt, ignoreFieldChange: true });
                //         }
                //     }
                // }

                // Validation on TDS Relation based on transaction date and valid from and valid to date of TDS relation

                if (fieldName == 'custcol_tss_tds_relation_type') {
                    var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                    if (isTrue(Flag)) {
                        var tdsRel = current_record.getCurrentSublistValue({
                            sublistId: sublistName,
                            fieldId: "custcol_tss_tds_relation_type",
                        });
                        if (tdsRel) {
                            var tdsRelObj = search.lookupFields({
                                type: 'customrecord_tss_tdsrelation',
                                id: tdsRel,
                                columns: ['custrecord_tss_tds_relation_valid_from', 'custrecord_tss_tds_relation_valid_until']
                            });
                            var valid_from = tdsRelObj.custrecord_tss_tds_relation_valid_from;
                            var valid_until = tdsRelObj.custrecord_tss_tds_relation_valid_until;
                            log.debug("valid_from in fieldChanged", valid_from);
                            log.debug("valid_until in fieldChanged - " + typeof (valid_until), valid_until);
                            var rec_date = current_record.getValue({ fieldId: "trandate" });
                            // Parse safely using N/format
                            valid_from = valid_from ? format.parse({ value: valid_from, type: format.Type.DATE }) : null;
                            valid_until = valid_until ? format.parse({ value: valid_until, type: format.Type.DATE }) : null;
                            rec_date = rec_date ? format.parse({ value: rec_date, type: format.Type.DATE }) : null;

                            log.debug("valid_from in fieldChanged", valid_from);
                            log.debug("valid_until in fieldChanged", valid_until);
                            log.debug("rec_date in fieldChanged", rec_date);
                            if (rec_date) {
                                if ((valid_from && rec_date < valid_from) || (valid_until && rec_date > valid_until)) {
                                    // Date is outside the valid range
                                    alert("The selected TDS relation type is not valid for the transaction date. Please select a valid TDS relation type.");
                                    current_record.setCurrentSublistValue({
                                        sublistId: sublistName,
                                        fieldId: "custcol_tss_tds_relation_type",
                                        value: '',
                                        ignoreFieldChange: true,
                                        forceSyncSourcing: true
                                    });
                                }
                            }
                            else {
                                alert("Please enter transaction date to validate the TDS relation type.");
                                current_record.setCurrentSublistValue({
                                    sublistId: sublistName,
                                    fieldId: "custcol_tss_tds_relation_type",
                                    value: '',
                                    ignoreFieldChange: true,
                                    forceSyncSourcing: true
                                });
                            }
                        }
                    }
                }

                // End of validation on TDS relation based on transaction date and valid from and valid to date of TDS relation


            }// end try
            catch (e) {
                log.error("Error in fieldChanged", e);
            }
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
            try {
                var current_record = scriptContext.currentRecord;
                var sublistName = scriptContext.sublistId;
                var fieldName = scriptContext.fieldId;
                if (sublistName == 'item' || fieldName == 'item') {
                    // alert("yes")
                    var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                    if (isTrue(Flag) && isTDStobeDefault) {
                        // alert("yes1")
                        var tdsRel = current_record.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: "custcol_tss_tds_relation_type",
                        });
                        // alert(g_tdsRel)
                        if (!tdsRel && g_tdsRel) {
                            // alert(g_tdsRel)
                            current_record.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: "custcol_tss_tds_relation_type",
                                value: g_tdsRel
                            });
                        }
                    }
                }
                if (sublistName == 'expense' || fieldName == 'account') {
                    // alert("yes")
                    var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                    if (isTrue(Flag) && isTDStobeDefault) {
                        // alert("yes1")
                        var tdsRel = current_record.getCurrentSublistValue({
                            sublistId: 'expense',
                            fieldId: "custcol_tss_tds_relation_type",
                        });
                        // alert(g_tdsRel)
                        if (!tdsRel && g_tdsRel) {
                            // alert(g_tdsRel)
                            current_record.setCurrentSublistValue({
                                sublistId: 'expense',
                                fieldId: "custcol_tss_tds_relation_type",
                                value: g_tdsRel
                            });
                        }
                    }
                }
            } // end try
            catch (e) {
                log.error("Error in postSourcing", e);
            } // end catch(e)
        } // end function postSourcing(scriptContext)

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
            try {
                var current_record = scriptContext.currentRecord;
                var sublistName = scriptContext.sublistId;
                if (sublistName == 'item' || sublistName == 'expense') {
                    var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                    var tdsApply = current_record.getCurrentSublistValue({
                        sublistId: sublistName,
                        fieldId: 'custcol_tss_tdsline'
                    });
                    if (isTrue(Flag) && isTrue(tdsApply)) {
                        alert("You can't modify TDS Line");
                        current_record.cancelLine({
                            sublistId: sublistName
                        });
                    }
                } // end if(sublistName == 'item' || sublistName == 'expense')

            } // end try
            catch (e) {
                log.error("Error in lineInit", e);
            } // end catch(e)

        } // end function lineInit(scriptContext)

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
            try {
                var current_record = scriptContext.currentRecord;
                var sublistName = scriptContext.sublistId;
                var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });

                if (!isTrue(Flag)) return true;

                if (sublistName !== 'item' && sublistName !== 'expense') return true;

                var tdsLineFlag = current_record.getCurrentSublistValue({
                    sublistId: sublistName,
                    fieldId: "custcol_tss_tdsline"
                });
                var overrideTDS = current_record.getCurrentSublistValue({ sublistId: sublistName, fieldId: 'custcol_tss_it_tds_override' });

                // Skip if not TDS Line 
                if (!tdsLineFlag) {
                    if (isTrue(overrideTDS)) {
                        alert("Override TDS is only applicable on TDS Lines.");
                        return false;
                    }
                    var tdsType = current_record.getCurrentSublistValue({ sublistId: sublistName, fieldId: "custcol_tss_itb_tdsmaster", })
                    var tdsPercent = current_record.getCurrentSublistValue({ sublistId: sublistName, fieldId: "custcol_tss_tdspercent", })
                    var tdsBaseAmount = current_record.getCurrentSublistValue({ sublistId: sublistName, fieldId: "custcol_tss_baseamount", })
                    var tdsRefId = current_record.getCurrentSublistValue({ sublistId: sublistName, fieldId: "custcol_tss_it_tds_ref_id", })
                    var tdsVEnum = current_record.getCurrentSublistValue({ sublistId: sublistName, fieldId: "custcol_tss_ve_certificate_no", })

                    if (_logValidation(tdsType) || _logValidation(tdsPercent) || _logValidation(tdsBaseAmount) || _logValidation(tdsRefId) || _logValidation(tdsVEnum)) {
                        current_record.setCurrentSublistValue({ sublistId: sublistName, fieldId: "custcol_tss_itb_tdsmaster", value: '', ignoreFieldChange: true });
                        current_record.setCurrentSublistValue({ sublistId: sublistName, fieldId: "custcol_tss_tdspercent", value: '', ignoreFieldChange: true });
                        current_record.setCurrentSublistValue({ sublistId: sublistName, fieldId: "custcol_tss_baseamount", value: '', ignoreFieldChange: true });
                        current_record.setCurrentSublistValue({ sublistId: sublistName, fieldId: "custcol_tss_it_tds_ref_id", value: '', ignoreFieldChange: true });
                        current_record.setCurrentSublistValue({ sublistId: sublistName, fieldId: "custcol_tss_ve_certificate_no", value: '', ignoreFieldChange: true });
                    }
                }

                //If TDS Line, then validate the below fields
                if (isTrue(tdsLineFlag)) {
                    var tdsRelationType = current_record.getCurrentSublistValue({ sublistId: sublistName, fieldId: 'custcol_tss_tds_relation_type' });
                    if (_logValidation(tdsRelationType)) {
                        current_record.setCurrentSublistValue({ sublistId: sublistName, fieldId: 'custcol_tss_tds_relation_type', value: '' });
                    }
                    var tdsAmt = current_record.getCurrentSublistValue({ sublistId: sublistName, fieldId: 'amount' });
                    if (_logValidation(tdsAmt) && tdsAmt > 0) {
                        alert("Amount must be zero or negative for a TDS line. The entered value will be converted to negative.");
                        current_record.setCurrentSublistValue({ sublistId: sublistName, fieldId: 'amount', value: -tdsAmt });
                        // return false;
                    }

                    var tdsType = current_record.getCurrentSublistValue({
                        sublistId: sublistName,
                        fieldId: "custcol_tss_itb_tdsmaster",
                    })
                    var tdsPercentage = current_record.getCurrentSublistValue({
                        sublistId: sublistName,
                        fieldId: "custcol_tss_tdspercent",
                    })
                    var tdsBaseAmt = current_record.getCurrentSublistValue({
                        sublistId: sublistName,
                        fieldId: "custcol_tss_baseamount",
                    })

                    var refId = current_record.getCurrentSublistValue({
                        sublistId: sublistName,
                        fieldId: "custcol_tss_it_tds_ref_id",
                    })
                    log.debug("TDS values", { tdsType: tdsType, tdsPercentage: tdsPercentage, tdsBaseAmt: tdsBaseAmt, tdsAmt: tdsAmt, refId: refId })
                    var missingFields = [];
                    if (!_logValidation(tdsType)) missingFields.push("TDS Section");
                    if (!_logValidation(tdsPercentage)) missingFields.push("TDS Percentage");
                    if (!_logValidation(tdsBaseAmt)) {
                        // missingFields.push("TDS Base Amount");
                        current_record.setCurrentSublistValue({ sublistId: sublistName, fieldId: 'custcol_tss_baseamount', value: 0 });
                    }
                    if (!_logValidation(refId)) missingFields.push("TDS Reference ID");

                    log.debug("missingFields", missingFields)

                    if (missingFields.length > 0) {

                        dialog.alert({
                            title: 'TDS Validation',
                            message: 'Please provide:\n\n ' + missingFields.join('\n, ')
                        });
                        return false;
                    }

                    if (!isTrue(overrideTDS)) return true; // If not override TDS, then no need to validate the below fields as they will be auto calculated

                    //Check TDS is calculated correctly based on percentage and base amount
                    var calculatedTdsAmt = (tdsPercentage / 100) * tdsBaseAmt;
                    if (-parseFloat(tdsAmt) != parseFloat(calculatedTdsAmt)) {
                        dialog.alert({
                            title: 'TDS Validation',
                            message: 'The TDS Amount is not calculated correctly based on the TDS Percentage and TDS Base Amount. Please verify.'
                        });
                        // return false;
                    }
                }
                return true;
            }
            catch (e) {
                log.error("error in validateLine", e);
                alert("Error in CLI TSS TDS validateLine: " + e);
                // return true;
            }
            //log.debug("data",scriptContext);

        }// end function validateLine(scriptContext)




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
                var s_recordType = current_record.type;
                return true;
            } // end try
            catch (e) {
                log.error("Error in saveRecord", e);
            } // end catch(e)
        } // end function saveRecord(scriptContext)


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


        function _nullValidation(value) {
            if (value == null || value == undefined || value == '') {
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

        function toggleOverrideColumn(currentRecord, isEnabled, madeFalse) {
            try {
                // Handle expense sublist
                var expenseCount = currentRecord.getLineCount({ sublistId: 'expense' });
                if (expenseCount > 0) {
                    for (var i = 0; i < expenseCount; i++) {
                        var sublistField = currentRecord.getSublistField({
                            sublistId: 'expense',
                            fieldId: 'custcol_tss_it_tds_override',
                            line: i
                        })
                        if (sublistField) sublistField.isDisabled = !isEnabled;
                        if (!_logValidation(isEnabled) && madeFalse == true) {
                            var isOverride = currentRecord.getSublistValue({ sublistId: 'expense', fieldId: 'custcol_tss_it_tds_override', line: i });
                            if (isTrue(isOverride)) {
                                currentRecord.selectLine({ sublistId: 'expense', line: i });
                                currentRecord.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'custcol_tss_it_tds_override', value: false });
                                currentRecord.commitLine({ sublistId: 'expense' });
                            }
                        }
                    }
                }

                // Handle item sublist
                var itemCount = currentRecord.getLineCount({ sublistId: 'item' });
                if (itemCount > 0) {
                    for (var j = 0; j < itemCount; j++) {
                        var sublistField = currentRecord.getSublistField({
                            sublistId: 'item',
                            fieldId: 'custcol_tss_it_tds_override',
                            line: j
                        })
                        if (sublistField) sublistField.isDisabled = !isEnabled;
                        if (!_logValidation(isEnabled) && madeFalse == true) {
                            var isOverride = currentRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_tss_it_tds_override', line: j });
                            if (isTrue(isOverride)) {
                                currentRecord.selectLine({ sublistId: 'item', line: j });
                                currentRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_tss_it_tds_override', value: false });
                                currentRecord.commitLine({ sublistId: 'item' });
                            }
                        }
                    }
                }
            }
            catch (e) {
                log.error("Error in toggleOverrideColumn function", e)
            }

        }

        function getTDSrel(rec_vendor, rec_date) {
            // alert(vendor)
            if (rec_vendor && rec_date) {
                var a_filters = new Array();
                var a_column = new Array();
                a_filters.push(search.createFilter({
                    name: 'isinactive',
                    operator: 'is',
                    values: 'F'
                }));
                a_filters.push(search.createFilter({
                    name: 'custrecord_tss_tds_vendorname',
                    operator: 'anyof',
                    values: rec_vendor
                }));
                a_column.push(search.createColumn({
                    name: 'internalid',
                }));
                a_column.push(search.createColumn({
                    name: 'custrecord_tss_tds_relation_valid_from',
                }));
                a_column.push(search.createColumn({
                    name: 'custrecord_tss_tds_relation_valid_until',
                }));
                var tdsrel_search = search.create({
                    type: 'customrecord_tss_tdsrelation',
                    filters: a_filters,
                    columns: a_column
                });
                var tdsrel_searchh_result = tdsrel_search.run().getRange(0, 100);
                if (_logValidation(tdsrel_searchh_result)) {
                    // alert(tdsrel_searchh_result.length + '-' + typeof (tdsrel_searchh_result.length))
                    if (tdsrel_searchh_result.length == 1) {
                        var valid_from = tdsrel_searchh_result[0].getValue({ name: 'custrecord_tss_tds_relation_valid_from' })
                        var valid_until = tdsrel_searchh_result[0].getValue({ name: 'custrecord_tss_tds_relation_valid_until' })
                        log.debug("valid_from", valid_from)
                        log.debug("valid_until", valid_until)
                        // Parse safely using N/format
                        valid_from = valid_from ? format.parse({ value: valid_from, type: format.Type.DATE }) : null;
                        valid_until = valid_until ? format.parse({ value: valid_until, type: format.Type.DATE }) : null;
                        rec_date = rec_date ? format.parse({ value: rec_date, type: format.Type.DATE }) : null;

                        if (((valid_from && rec_date >= valid_from) || !valid_from) && ((valid_until && rec_date <= valid_until) || !valid_until)) {
                            g_tdsRel = tdsrel_searchh_result[0].getValue({ name: 'internalid' });
                            // alert(g_tdsRel)
                        }
                    }
                    else if (tdsrel_searchh_result.length > 1) {
                        for (var i = 0; i < tdsrel_searchh_result.length; i++) {
                            var valid_from = tdsrel_searchh_result[i].getValue({ name: 'custrecord_tss_tds_relation_valid_from' })
                            var valid_until = tdsrel_searchh_result[i].getValue({ name: 'custrecord_tss_tds_relation_valid_until' })
                            log.debug("valid_from - " + i, valid_from)
                            log.debug("valid_until - " + i, valid_until)
                            // Parse safely using N/format
                            valid_from = valid_from ? format.parse({ value: valid_from, type: format.Type.DATE }) : null;
                            valid_until = valid_until ? format.parse({ value: valid_until, type: format.Type.DATE }) : null;
                            rec_date = rec_date ? format.parse({ value: rec_date, type: format.Type.DATE }) : null;
                            if (((valid_from && rec_date >= valid_from) || !valid_from) && ((valid_until && rec_date <= valid_until) || !valid_until)) {
                                g_tdsRel = tdsrel_searchh_result[i].getValue({ name: 'internalid' });
                                // alert(g_tdsRel)
                                break;
                            }
                        }
                    }
                }
            }
            return true;
        }



        return {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            postSourcing: postSourcing,
            //    sublistChanged: sublistChanged,
            // lineInit: lineInit,
            //    validateField: validateField,
            validateLine: validateLine,
            //    validateInsert: validateInsert,
            //    validateDelete: validateDelete,
            // saveRecord: saveRecord
        };

    });