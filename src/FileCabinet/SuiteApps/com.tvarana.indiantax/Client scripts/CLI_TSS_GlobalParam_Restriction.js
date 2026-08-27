/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
/**
 * Script Name               : CLI TSS GlobalParam Restrictions
 * Script Author             : MNR Krishna
 * Script Type               : Client Script
 * Script Version            : 2.0
 * Script Created date       : 12/06/2023
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        : 
 */


define(['N/search'],
    /**
     * @param{search} search
     */
    function (search) {

        var Event_Type = '';





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

            Event_Type = scriptContext.mode;

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
            try {

                return true;


            }
            catch (e) {
                log.error("Error in validateLine", e);
            }

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
                var rec_subsidiary = current_record.getValue({ fieldId: "custrecord_tss_gp_subsidiary" });
                var global_param_search = search.create({
                    type: 'customrecord_tss_global_parameter',
                    filters: search.createFilter({
                        name: 'isinactive',
                        operator: 'is',
                        values: 'F'
                    }),
                    columns: search.createColumn({ name: 'custrecord_tss_gp_subsidiary' })
                });
                var s_Global_Subsidiary = '';
                global_param_search.run().each(function (result) {
                    s_Global_Subsidiary = result.getValue({
                        name: 'custrecord_tss_gp_subsidiary'
                    });
                    return true;
                });
                log.debug("s_Global_Subsidiary in saveRecord", s_Global_Subsidiary);
                if ((Event_Type == 'create') && (_logValidation(s_Global_Subsidiary)) && (rec_subsidiary == s_Global_Subsidiary)) {
                    alert('Indian Tax Global Parameter Record Is already Existing.');
                    return false;
                }
                else {
                    var vnr = current_record.getValue({ fieldId: "custrecord_tss_gp_rcm_applicable" });
                    log.debug("VNR Applicable in saveRecord", vnr);
                    if (vnr == true) {
                        var vnr_instate = current_record.getValue({ fieldId: "custrecordtss_gp_vnr_taxgroup_instate" });
                        var vnr_outstate = current_record.getValue({ fieldId: "custrecord_tss_gp_vnr_taxgroup_outstate" });
                        if (_logValidation(vnr_instate) && _logValidation(vnr_outstate)) {
                            return true;
                        }
                        else {
                            alert('Kindly Enter VNR IN State and VNR OUT State TaxGroups');
                            return false;
                        }

                    }
                    else {
                        return true;
                    }
                }

            }
            catch (e) {
                log.error("Error in saveRecord", e);
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
            //    fieldChanged: fieldChanged,
            //    postSourcing: postSourcing,
            //    sublistChanged: sublistChanged,
            //    lineInit: lineInit,
            //    validateField: validateField,
            // validateLine: validateLine,
            //    validateInsert: validateInsert,
            //    validateDelete: validateDelete,
            saveRecord: saveRecord
        };

    });
