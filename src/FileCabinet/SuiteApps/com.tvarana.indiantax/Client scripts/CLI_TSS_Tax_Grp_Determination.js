/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
/**
 * Script Name               : CLI TSS Tax Grp Determination
 * Script Author             : MNR Krishna
 * Script Type               : Client Script
 * Script Version            : 2.0
 * Script Created date       : 21/06/2023
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  This script will not allow user to enter tax code in tax group field also will not allow user to create duplicate records.
 */


define(['N/search', 'N/record'],
    /**
     * @param{search} search
     */
    function (search, record) {

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
                // GST Tax Group Validations started.......................................
                if (scriptContext.fieldId == 'custrecord_tss_its_in_state_tax_group') {
                    var current_record = scriptContext.currentRecord;
                    var rec_InState = current_record.getValue({ fieldId: "custrecord_tss_its_in_state_tax_group" });
                    if (_logValidation(rec_InState)) {
                        try {
                            var recordObj = record.load({
                                type: 'taxgroup',
                                id: rec_InState
                            });
                        }
                        catch (error) {
                            if (error.name == "RCRD_DSNT_EXIST") {
                                alert('User has not entered Tax Group, Kindly enter Tax Group');
                                current_record.setText({
                                    fieldId: "custrecord_tss_its_in_state_tax_group",
                                    text: "",
                                    //ignoreFieldChange: true
                                });
                            }
                        }
                    }

                } // end if(scriptContext.fieldId == 'custrecord_tss_its_in_state_tax_group')

                if (scriptContext.fieldId == 'custrecord_tss_its_out_state_tax_group') {
                    var current_record = scriptContext.currentRecord;
                    var rec_OutState = current_record.getValue({ fieldId: "custrecord_tss_its_out_state_tax_group" });
                    if (_logValidation(rec_OutState)) {
                        try {
                            var recordObj = record.load({
                                type: 'taxgroup',
                                id: rec_OutState
                            });
                        }
                        catch (error) {
                            if (error.name == "RCRD_DSNT_EXIST") {
                                alert('User has not entered Tax Group, Kindly enter Tax Group');
                                current_record.setText({
                                    fieldId: "custrecord_tss_its_out_state_tax_group",
                                    text: "",
                                    //ignoreFieldChange: true
                                });
                            }
                        }
                    }

                } // end if(scriptContext.fieldId == 'custrecord_tss_its_out_state_tax_group')

                // RCM Tax Group Validations started.......................................

                if (scriptContext.fieldId == 'custrecord_tss_its_rcm_in_state_taxgroup') {
                    var current_record = scriptContext.currentRecord;
                    var rec_InState = current_record.getValue({ fieldId: "custrecord_tss_its_rcm_in_state_taxgroup" });
                    if (_logValidation(rec_InState)) {
                        try {
                            var recordObj = record.load({
                                type: 'taxgroup',
                                id: rec_InState
                            });
                        }
                        catch (error) {
                            if (error.name == "RCRD_DSNT_EXIST") {
                                alert('User has not entered Tax Group, Kindly enter Tax Group');
                                current_record.setText({
                                    fieldId: "custrecord_tss_its_rcm_in_state_taxgroup",
                                    text: "",
                                    //ignoreFieldChange: true
                                });
                            }
                        }
                    }

                } // end if(scriptContext.fieldId == 'custrecord_tss_its_rcm_in_state_taxgroup')


                if (scriptContext.fieldId == 'custrecord_tss_its_rcm_out_state_taxgrp') {
                    var current_record = scriptContext.currentRecord;
                    var rec_OutState = current_record.getValue({ fieldId: "custrecord_tss_its_rcm_out_state_taxgrp" });
                    if (_logValidation(rec_OutState)) {
                        try {
                            var recordObj = record.load({
                                type: 'taxgroup',
                                id: rec_OutState
                            });
                        }
                        catch (error) {
                            if (error.name == "RCRD_DSNT_EXIST") {
                                alert('User has not entered Tax Group, Kindly enter Tax Group');
                                current_record.setText({
                                    fieldId: "custrecord_tss_its_rcm_out_state_taxgrp",
                                    text: "",
                                    //ignoreFieldChange: true
                                });
                            }
                        }
                    }

                } // end if(scriptContext.fieldId == 'custrecord_tss_its_rcm_out_state_taxgrp')


            }// end try
            catch (e) {
                log.error("Error in fieldChanged", e);
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
                var rec_id = current_record.id;
                var rec_Item = current_record.getValue({ fieldId: "custrecord_tss_its_item" });
                var rec_Expense_Category = current_record.getValue({ fieldId: "custrecord_tss_its_expense_category" });
                var rec_Account = current_record.getValue({ fieldId: "custrecord_tss_its_expense_account" });
                var rec_InState = current_record.getValue({ fieldId: "custrecord_tss_its_in_state_tax_group" });
                var rec_OutState = current_record.getValue({ fieldId: "custrecord_tss_its_out_state_tax_group" });
                var rec_RCM_InState = current_record.getValue({ fieldId: "custrecord_tss_its_rcm_in_state_taxgroup" });
                var rec_RCM_OutState = current_record.getValue({ fieldId: "custrecord_tss_its_rcm_out_state_taxgrp" });
                if ((_logValidation(rec_Item) && _logValidation(rec_Expense_Category)) || (_logValidation(rec_Item) && _logValidation(rec_Account)) || (_logValidation(rec_Expense_Category) && _logValidation(rec_Account))) {
                    alert('Kindly Enter Item or Expense Category or Expense Account, Only one of them can be accepted');
                    return false
                }
                if (!_logValidation(rec_Item) && !_logValidation(rec_Expense_Category) && !_logValidation(rec_Account)) {
                    alert('Kindly Enter atleast Item or Expense Category or Expense Account, Only one of them can be accepted');
                    return false;
                }
                var a_filters = new Array();
                var a_column = new Array();
                a_filters.push(search.createFilter({
                    name: 'isinactive',
                    operator: 'is',
                    values: 'F'
                }));
                if (_logValidation(rec_Item)) {
                    a_filters.push(search.createFilter({
                        name: 'custrecord_tss_its_item',
                        operator: 'anyof',
                        values: rec_Item
                    }));
                }
                else {
                    a_filters.push(search.createFilter({
                        name: 'custrecord_tss_its_item',
                        operator: 'anyof',
                        values: '@NONE@'
                    }));
                }
                if (_logValidation(rec_Expense_Category)) {
                    a_filters.push(search.createFilter({
                        name: 'custrecord_tss_its_expense_category',
                        operator: 'anyof',
                        values: rec_Expense_Category
                    }));
                }
                else {
                    a_filters.push(search.createFilter({
                        name: 'custrecord_tss_its_expense_category',
                        operator: 'anyof',
                        values: '@NONE@'
                    }));
                }
                if (_logValidation(rec_Account)) {
                    a_filters.push(search.createFilter({
                        name: 'custrecord_tss_its_expense_account',
                        operator: 'anyof',
                        values: rec_Account
                    }));
                }
                else {
                    a_filters.push(search.createFilter({
                        name: 'custrecord_tss_its_expense_account',
                        operator: 'anyof',
                        values: '@NONE@'
                    }));
                }
                //log.debug("Existing record search filters",a_filters);
                a_column.push(search.createColumn({ name: 'internalid' }));
                var taxgroup_search = search.create({
                    type: 'customrecord_tss_its_tax_group_deter',
                    filters: a_filters,
                    columns: a_column
                });
                var taxgroup_search_result = taxgroup_search.run().getRange(0, 100);
                log.debug("Existing record search count", taxgroup_search_result.length);
                if (taxgroup_search_result.length > 0) {
                    for (var i = 0; i < taxgroup_search_result.length; i++) {
                        var taxgroupId = taxgroup_search_result[i].getValue({ name: 'internalid' });
                        if (taxgroupId != rec_id) {
                            alert('The combination of Item, Expense Category, and Expense Account Fields on the current record already exists, Kindly check once and change accordingly');
                            return false;
                        }
                    }

                } // end if(taxgroup_search_result.length > 0)
                if (_logValidation(rec_Item)) {
                    var hsnCategoryObj = search.lookupFields({
                        type: 'item',
                        id: rec_Item,
                        columns: ['custitem_tss_its_hsncategory']
                    });
                    log.debug("hsnCategory object in saveRecord", hsnCategoryObj);
                    if (hsnCategoryObj.custitem_tss_its_hsncategory.length > 0) {
                        log.debug("Entered")
                        var hsnCategory = hsnCategoryObj.custitem_tss_its_hsncategory[0].value;
                        log.debug("Item hsnCategory from Item record", hsnCategory);
                    }

                }
                if (_logValidation(rec_Expense_Category)) {
                    var hsnCategoryObj = search.lookupFields({
                        type: 'expensecategory',
                        id: rec_Expense_Category,
                        columns: ['custrecord_tss_its_exp_hsncategory']
                    });
                    if (hsnCategoryObj.custrecord_tss_its_exp_hsncategory.length > 0) {
                        var hsnCategory = hsnCategoryObj.custrecord_tss_its_exp_hsncategory[0].value;
                        log.debug("Category hsnCategory from Expense Category record", hsnCategory);
                    }

                }
                log.debug("Item hsnCategory in saveRecord is null", _logValidation(hsnCategory));

                if (_logValidation(rec_Account)) {
                    var hsnCategoryObj = search.lookupFields({
                        type: 'account',
                        id: rec_Account,
                        columns: ['custrecord_tss_its_act_hsncategory']
                    });
                    if (hsnCategoryObj.custrecord_tss_its_act_hsncategory.length > 0) {
                        var hsnCategory = hsnCategoryObj.custrecord_tss_its_act_hsncategory[0].value;
                        log.debug("Account hsnCategory from Account record", hsnCategory);
                    }

                }

                if (_logValidation(hsnCategory)) {
                    var taxrateHsnObj = search.lookupFields({
                        type: 'customrecord_tss_gst_rate_master',
                        id: hsnCategory,
                        columns: ['custrecord_tss_tax_rate']
                    });
                    if (_logValidation(taxrateHsnObj)) {
                        var taxrateHsn = taxrateHsnObj.custrecord_tss_tax_rate;
                    }

                }
                if (_logValidation(rec_InState)) {
                    var InStateRateOnj = search.lookupFields({
                        type: 'taxgroup',
                        id: rec_InState,
                        columns: ['rate', 'taxtype']
                    });
                    if (_logValidation(InStateRateOnj)) {
                        var InStateRate = InStateRateOnj.rate;
                        /*
                        if (InStateRateOnj.taxtype[0].text != 'GST') {
                            alert("In State Tax Group Should be GST. Please make change accordingly");
                            return false;
                        }
                        */
                    }
                }

                if (_logValidation(rec_OutState)) {
                    var OutStateRateObj = search.lookupFields({
                        type: 'taxgroup',
                        id: rec_OutState,
                        columns: ['rate', 'taxtype']
                    });
                    if (_logValidation(OutStateRateObj)) {
                        var OutStateRate = OutStateRateObj.rate;
                        /*
                        if (OutStateRateObj.taxtype[0].text != 'IGST') {
                            alert("Out State Tax Group Should be IGST. Please make change accordingly");
                            return false;
                        }
                        */
                    }
                }

                if (_logValidation(rec_RCM_InState)) {
                    var InStateRateOnj = search.lookupFields({
                        type: 'taxgroup',
                        id: rec_RCM_InState,
                        columns: ['rate', 'taxtype']
                    });
                    if (_logValidation(InStateRateOnj)) {
                        var RCMinStateRate = InStateRateOnj.rate;
                        /*
                        if (InStateRateOnj.taxtype[0].text != 'RCM') {
                            alert("RCM In State Tax Group Should be RCM. Please make change accordingly");
                            //return false;
                        }
                        */
                    }
                }

                if (_logValidation(rec_RCM_OutState)) {
                    var InStateRateOnj = search.lookupFields({
                        type: 'taxgroup',
                        id: rec_RCM_OutState,
                        columns: ['rate', 'taxtype']
                    });
                    if (_logValidation(InStateRateOnj)) {
                        var RCMoutStateRate = InStateRateOnj.rate;
                        /*
                        if (InStateRateOnj.taxtype[0].text != 'RCM') {
                            alert("RCM Out State Tax Group Should be RCM. Please make change accordingly");
                            //return false;
                        }
                        */
                    }
                }

                if (_logValidation(rec_InState) && _logValidation(rec_OutState) && _logValidation(taxrateHsn) && _logValidation(rec_RCM_InState) && _logValidation(rec_RCM_OutState)) {
                    if (parseFloat(taxrateHsn) != parseFloat(InStateRate)) {
                        var resp = confirm('Selected In State Tax rate :- ' + InStateRate + ' is not as per HSN Master Tax Rate :- ' + taxrateHsn);
                        if (resp == false || resp == 'false') {
                            return false;
                        }
                    }

                    if (parseFloat(taxrateHsn) != parseFloat(OutStateRate)) {
                        var resp1 = confirm('Selected Out State Tax rate :- ' + OutStateRate + ' is not as per HSN Master Tax Rate :- ' + taxrateHsn);
                        if (resp1 == false || resp1 == 'false') {
                            return false;
                        }
                    }


                    if (parseFloat(taxrateHsn) != parseFloat(RCMinStateRate)) {
                        var resp = confirm('Selected RCM In State Tax rate :- ' + RCMinStateRate + ' is not as per HSN Master Tax Rate :- ' + taxrateHsn);
                        if (resp == false || resp == 'false') {
                            return false;
                        }
                    }


                    if (parseFloat(taxrateHsn) != parseFloat(RCMoutStateRate)) {
                        var resp1 = confirm('Selected RCM Out State Tax rate :- ' + RCMoutStateRate + ' is not as per HSN Master Tax Rate :- ' + taxrateHsn);
                        if (resp1 == false || resp1 == 'false') {
                            return false;
                        }
                    }
                }


                return true
            }// end try
            catch (e) {
                log.error("Error in saveRecord", e);
            }// end catch(e)
        }


        function _logValidation(value) {
            if (value != 'null' && value != null && value != null && value != '' && value != undefined && value != undefined && value != 'undefined' && value != 'undefined' && value != 'NaN' && value != NaN) {
                return true;
            }
            else {
                return false;
            }
        } // end function _logValidation(value)


        function _nullValidation(value) {
            if (value == null || value == undefined || value == '') {
                return true;
            }
            else {
                return false;
            }
        } // end function _nullValidation(value)



        return {
            //    pageInit: pageInit,
            fieldChanged: fieldChanged,
            //    postSourcing: postSourcing,
            //    sublistChanged: sublistChanged,
            //    lineInit: lineInit,
            //    validateField: validateField,
            //    validateLine: validateLine,
            //    validateInsert: validateInsert,
            //    validateDelete: validateDelete,
            saveRecord: saveRecord
        };

    });
