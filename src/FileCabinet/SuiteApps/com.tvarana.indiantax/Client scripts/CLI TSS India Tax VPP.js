/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
/**
 * Script Name               : CLI TSS India Tax VPP
 * Script Author             : MNR Krishna
 * Script Type               : Client Script
 * Script Version            : 2.1
 * Script Created date       : 18/11/2025
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  It is the client Script for GST and TDS computation for Vendor Prepayment in Tvarana Indian TaxPro.
 */
define(['./TSS CS PrePayment', './TSS CS Prepayment Application', './CLI TSS TDS On VPP', 'N/search'],

    function (TSS_GST, TSS_GST_Application, TSS_TDS, search) {
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

            if (TSS_GST.pageInit && scriptContext.currentRecord.type == 'vendorprepayment') {
                TSS_GST.pageInit(scriptContext);
            }

            if (TSS_GST_Application.pageInit && scriptContext.currentRecord.type == 'vendorprepaymentapplication') {
                TSS_GST_Application.pageInit(scriptContext);
            }
            if (TSS_TDS.pageInit) {
                TSS_TDS.pageInit(scriptContext);
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
            if (TSS_GST.fieldChanged && scriptContext.currentRecord.type == 'vendorprepayment') {
                TSS_GST.fieldChanged(scriptContext);
            }
            if (TSS_GST_Application.fieldChanged && scriptContext.currentRecord.type == 'vendorprepaymentapplication') {
                TSS_GST_Application.fieldChanged(scriptContext);
            }
            if (TSS_TDS.fieldChanged) {
                TSS_TDS.fieldChanged(scriptContext);
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
            if (TSS_GST.postSourcing && scriptContext.currentRecord.type == 'vendorprepayment') {
                TSS_GST.postSourcing(scriptContext);
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
            if (isExpired) {
                var recSub = scriptContext.currentRecord.getValue({ fieldId: 'subsidiary' });
                if (inArray(recSub, global_sub) == parseInt(1)) {
                    alert('TaxPro SuiteApp subscription needs renewal. Please contact your administrator.');
                }
                return true
            }
            var saveRecordResp = true
            if (TSS_GST.saveRecord && scriptContext.currentRecord.type == 'vendorprepayment') {
                saveRecordResp = TSS_GST.saveRecord(scriptContext);
                if (saveRecordResp == 'false' || saveRecordResp == 'F' || saveRecordResp == false) {
                    return false;
                }
            }
            if (TSS_TDS.saveRecord) {
                saveRecordResp = TSS_TDS.saveRecord(scriptContext);
            }
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
            // lineInit: lineInit,
            // validateField: validateField,
            // validateLine: validateLine,
            // validateInsert: validateInsert,
            // validateDelete: validateDelete,
            saveRecord: saveRecord
        };

    });
