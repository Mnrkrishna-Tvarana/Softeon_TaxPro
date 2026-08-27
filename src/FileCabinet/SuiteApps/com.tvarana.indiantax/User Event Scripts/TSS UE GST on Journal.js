/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
/**
 * Script Name               : TSS UE GST on Journal
 * Script Author             : MNR Krishna
 * Script Type               : User Event Script
 * Script Version            : 2.1
 * Script Created date       : 07/07/2025
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  
 */

/** 
 * *    Version         Name              Date             Notes
 *       1.0         MNR KRISHNA       07/07/2025       Initial version 
 * 
 */
define(['N/record', 'N/search', '/SuiteApps/com.tvarana.indiantax/Other Files/TSS TaxPro Server Helper'],
    /**
 * @param{record} record
 * @param{search} search
 * @param{serverHelper} serverHelper
 */
    (record, search, serverHelper) => {

        // Global Variables
        var g_subisidiary;


        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {

        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {
            if (!serverHelper.checkSubscription()) {
                log.debug("TaxPro UE beforeSubmit", "Subscription check failed - blocking execution");
                return true;
            }
            try {
                var jeRec = scriptContext.newRecord;
                log.debug("jeRec", jeRec)

                const voidvalue = jeRec.getValue('void');
                log.debug("void", voidvalue)
                var isVoided = jeRec.getValue('voided'); // Replace with actual field

                if (voidvalue == 'Void') {
                    isVoided = true;
                }
                log.debug("isvoided", isVoided)
                log.debug("Voided", isTrue(isVoided))
                log.debug("Type", scriptContext.type)
                log.debug("scriptContext.oldRecord", scriptContext.oldRecord)

                if (scriptContext.type === scriptContext.UserEventType.DELETE || isTrue(isVoided)) {
                    log.debug("entered")
                    var GlobalRecId = SearchGlobalParameter();

                    if (scriptContext.type === scriptContext.UserEventType.XEDIT || scriptContext.type === scriptContext.UserEventType.EDIT) {
                        var Subsidiary = scriptContext.oldRecord.getValue({ fieldId: "subsidiary" })

                    }
                    else {
                        var Subsidiary = jeRec.getValue('subsidiary');

                    }
                    log.debug("Subsidiary", Subsidiary)
                    var Flag = inArray(Subsidiary, g_subisidiary);
                    if (Flag == parseInt(1)) {
                        if (scriptContext.type === scriptContext.UserEventType.XEDIT || scriptContext.type === scriptContext.UserEventType.EDIT) {
                            var relatedInvoiceId = scriptContext.oldRecord.getValue('custbody_tss_lut_journal_invoice');

                        }
                        else {
                            var relatedInvoiceId = jeRec.getValue('custbody_tss_lut_journal_invoice');

                        }
                        // const relatedInvoiceId = jeRec.getValue('custbody_tss_lut_journal_invoice');
                        log.debug("relatedInvoiceId", relatedInvoiceId)
                        if (relatedInvoiceId) {
                            const invoiceRec = record.load({
                                type: record.Type.INVOICE,
                                id: relatedInvoiceId,
                                isDynamic: false
                            });

                            invoiceRec.setValue({
                                fieldId: 'custbody_tss_lut_journal_invoice', // Field to be emptied
                                value: ''
                            });

                            invoiceRec.save({ enableSourcing: false, ignoreMandatoryFields: true });

                            log.debug('Invoice updated', 'Cleared field on invoice ID: ' + relatedInvoiceId);
                        }
                    }
                }
            } catch (e) {
                log.error('Error clearing invoice field on JE delete/void', e);
                throw { "name": "Indian Tax SuiteApp custom Error", "message": "Error in de-link with Invoice  -  " + e }
            }
        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {


        }


        function isTrue(value) {
            if (value == 'T' || value == true || value == 'true') {
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
            a_column.push(search.createColumn({
                name: 'custrecord_tss_gp_lut_gstrefund',
            }));
            a_column.push(search.createColumn({
                name: 'custrecord_tss_gp_lut_igst_payable',
            }));
            a_column.push(search.createColumn({
                name: 'custrecord_tss_gp_subsidiary',
            }));
            var global_param_search = search.create({
                type: 'customrecord_tss_global_parameter',
                filters: a_filters,
                columns: a_column
            });
            var global_param_search_result = global_param_search.run().getRange(0, 100);
            if (_logValidation(global_param_search_result)) {
                global_sub = global_param_search_result[0].getValue({ name: 'internalid' });
                g_subisidiary = global_param_search_result[0].getValue({ name: 'custrecord_tss_gp_subsidiary' });
            }
            return global_sub;
        } // end function SearchGlobalParameter()

        return {
            // beforeLoad,
            beforeSubmit,
            //afterSubmit
        }

    });