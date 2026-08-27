/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */

/**
 * Script Name               : CLI TSS Indian Tax Transaction
 * Script Author             : MNR Krishna
 * Script Type               : Client Script
 * Script Version            : 2.1
 * Script Created date       : 26/03/2025
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  It is the client Script for GST and TDS computation in Tvarana Indian Tax Bundle.
 */
define(['./CLI_TSS_GST', './CLI TSS TDS New', './TSS CS TDS On Sales', './TSS CS TCS On Sales', 'N/search'],

    function (TSS_GST, TSS_TDS, TSS_TDS_Sales, TSS_TCS_Sales, search) {
        //Global Variables
        var isExpired = true;
        var global_sub = '';

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
            if (SearchGlobalParameter()) {
                return true
            }
            if (TSS_GST.pageInit) {
                TSS_GST.pageInit(scriptContext);
            }
            if (TSS_TDS.pageInit && scriptContext.currentRecord.type == 'vendorbill') {
                TSS_TDS.pageInit(scriptContext);
            }
            if (TSS_TDS_Sales.pageInit && (scriptContext.currentRecord.type == 'invoice')) {
                TSS_TDS_Sales.pageInit(scriptContext);
            }
            if (TSS_TCS_Sales.pageInit && (scriptContext.currentRecord.type == 'invoice')) {
                TSS_TCS_Sales.pageInit(scriptContext);
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
            if (isExpired) {
                return true
            }
            if (TSS_GST.fieldChanged) {
                TSS_GST.fieldChanged(scriptContext);
            }
            if (TSS_TDS.fieldChanged && scriptContext.currentRecord.type == 'vendorbill') {
                TSS_TDS.fieldChanged(scriptContext);
            }
            if (TSS_TDS_Sales.fieldChanged && (scriptContext.currentRecord.type == 'invoice')) {
                TSS_TDS_Sales.fieldChanged(scriptContext);
            }
            if (TSS_TCS_Sales.fieldChanged && (scriptContext.currentRecord.type == 'invoice')) {
                TSS_TCS_Sales.fieldChanged(scriptContext);
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
            if (isExpired) {
                return true
            }
            if (TSS_GST.postSourcing) {
                TSS_GST.postSourcing(scriptContext);
            }
            if (TSS_TDS.postSourcing && scriptContext.currentRecord.type == 'vendorbill') {
                TSS_TDS.postSourcing(scriptContext);
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
            if (isExpired) {
                return true
            }
            if (TSS_GST.lineInit) {
                TSS_GST.lineInit(scriptContext);
            }
            if (TSS_TDS.lineInit) {
                TSS_TDS.lineInit(scriptContext);
            }
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
            if (isExpired) {
                return true
            }
            var validateLineResp = true
            if (TSS_GST.validateLine) {
                validateLineResp = TSS_GST.validateLine(scriptContext);
                if (validateLineResp == 'false' || validateLineResp == 'F' || validateLineResp == false) {
                    return false;
                }
            }
            if (TSS_TDS.validateLine && scriptContext.currentRecord.type == 'vendorbill') {
                validateLineResp = TSS_TDS.validateLine(scriptContext);
                if (validateLineResp == 'false' || validateLineResp == 'F' || validateLineResp == false) {
                    return false;
                }
            }
            if (TSS_TDS_Sales.validateLine && (scriptContext.currentRecord.type == 'invoice')) {
                validateLineResp = TSS_TDS_Sales.validateLine(scriptContext);
                if (validateLineResp == 'false' || validateLineResp == 'F' || validateLineResp == false) {
                    return false;
                }
            }
            if (TSS_TCS_Sales.validateLine && (scriptContext.currentRecord.type == 'invoice')) {
                validateLineResp = TSS_TCS_Sales.validateLine(scriptContext);
                if (validateLineResp == 'false' || validateLineResp == 'F' || validateLineResp == false) {
                    return false;
                }
            }
            // alert(validateLineResp)
            return validateLineResp
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
            if (isExpired) {
                var recSub = scriptContext.currentRecord.getValue({ fieldId: 'subsidiary' });
                if (inArray(recSub, global_sub) == parseInt(1)) {
                    alert('TaxPro SuiteApp subscription needs renewal. Please contact your administrator.');
                }
                return true
            }
            var saveRecordResp = true
            if (TSS_GST.saveRecord) {
                saveRecordResp = TSS_GST.saveRecord(scriptContext);
                if (saveRecordResp == 'false' || saveRecordResp == 'F' || saveRecordResp == false) {
                    return false;
                }
            }
            if (TSS_TDS.saveRecord && scriptContext.currentRecord.type == 'vendorbill') {
                saveRecordResp = TSS_TDS.saveRecord(scriptContext);
                if (saveRecordResp == 'false' || saveRecordResp == 'F' || saveRecordResp == false) {
                    return false;
                }
            }
            if (TSS_TDS_Sales.saveRecord && scriptContext.currentRecord.type == 'invoice') {
                saveRecordResp = TSS_TDS_Sales.saveRecord(scriptContext);
                if (saveRecordResp == 'false' || saveRecordResp == 'F' || saveRecordResp == false) {
                    return false;
                }
            }
            // alert(saveRecordResp)
            return saveRecordResp
        }

        function SearchGlobalParameter() {
            var a_filters = new Array();
            var a_column = new Array();
            a_filters.push(search.createFilter({
                name: 'isinactive',
                operator: 'is',
                values: 'F'
            }));
            a_column.push(search.createColumn({
                name: 'internalid',
            }));
            a_column.push(search.createColumn({
                name: 'custrecord_tss_gp_subsidiary',
            }));
            a_column.push(search.createColumn({
                name: 'custrecord_tss_gp_taxcode',
            }));
            a_column.push(search.createColumn({
                name: 'custrecordtss_gp_vnr_taxgroup_instate',
            }));
            a_column.push(search.createColumn({
                name: 'custrecord_tss_gp_vnr_taxgroup_outstate',
            }));
            a_column.push(search.createColumn({
                name: 'custrecord_tss_gp_rcm_applicable',
            }));
            a_column.push(search.createColumn({
                name: 'custrecord_tss_gp_sez_taxcode',
            }));
            a_column.push(search.createColumn({
                name: 'custrecord_tss_gp_taxcode_igst',
            }));
            a_column.push(search.createColumn({
                name: 'custrecord_tss_use_acc_exp_gst_auto',
            }));
            a_column.push(search.createColumn({
                name: 'custrecord_tss_gp_subscription_end',
            }));
            var global_param_search = search.create({
                type: 'customrecord_tss_global_parameter',
                filters: a_filters,
                columns: a_column
            });
            var global_param_search_result = global_param_search.run().getRange(0, 100);
            if (global_param_search_result.length > 0) {
                isExpired = global_param_search_result[0].getValue({ name: 'custrecord_tss_gp_subscription_end' });
                global_sub = global_param_search_result[0].getValue({ name: 'custrecord_tss_gp_subsidiary' });
            }
            return isExpired;
        } // end function SearchGlobalParameter()

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
            // sublistChanged: sublistChanged,
            lineInit: lineInit,
            // validateField: validateField,
            validateLine: validateLine,
            // validateInsert: validateInsert,
            // validateDelete: validateDelete,
            saveRecord: saveRecord
        };

    });
