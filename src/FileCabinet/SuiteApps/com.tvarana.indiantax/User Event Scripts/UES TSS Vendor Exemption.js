/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

/**
 * Script Name               : UES TSS Vendor Exemption
 * Script Author             : MNR Krishna
 * Script Type               : User Event Script
 * Script Version            : 2.1
 * Script Created date       : 08/08/2024
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  
 */


/** 
 * * Version      Name              Date          Notes
 * 1.0         MNR Krishna       08/08/2024       Initial version 
 * 
 */


define(['N/search', 'N/ui/serverWidget'],
    /**
 * @param{search} search
 * @param{serverWidget} serverWidget
 */
    (search, serverWidget) => {
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
            try {
                var Form = scriptContext.form
                var current_record = scriptContext.newRecord;
                // log.debug("scriptContext.type", scriptContext.type)
                if (scriptContext.type == 'view') {
                    var schedType = current_record.getValue({ fieldId: 'custrecord_tss_ve_schedule' });
                    // log.debug("schedType", schedType)
                    var amountField = Form.getField({ id: 'custrecord_tss_ve_amount' })
                    // log.debug("amountField", amountField)
                    if (schedType == 2) {
                        amountField.updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.HIDDEN
                        });
                    }
                }
                if (scriptContext.type == 'edit') {
                    // Disabling the fields if Exemption deducted on any transactions
                    var exemptAmt = current_record.getValue({ fieldId: 'custrecord_tss_ve_tax_amt' }) || 0;
                    // log.debug("exemptAmt", exemptAmt)
                    if (parseFloat(exemptAmt) > 0) {
                        // var exemptTdsField = Form.getField({ id: 'custrecord_tss_ve_tax_amt' });
                        // log.debug("exemptTdsField", exemptTdsField)
                        // exemptTdsField.isDisabled = true;
                        Form.getField({ id: 'custrecordtss_ve_vendorname' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        Form.getField({ id: 'custrecord_tss_ve_tdsrelation' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        Form.getField({ id: 'custrecord_tss_ve_subsidiary' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        Form.getField({ id: 'custrecord_tss_ve_certificate' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        Form.getField({ id: 'custrecord_tss_ve_schedule' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        Form.getField({ id: 'custrecord_tss_ve_from' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        Form.getField({ id: 'custrecord_tss_ve_to' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        Form.getField({ id: 'custrecord_tss_ve_amount' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        Form.getField({ id: 'custrecord_tss_ve_rate' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        // Form.getField({ id: 'custrecord_tss_ve_tax_amt' }).updateDisplayType({
                        //     displayType: serverWidget.FieldDisplayType.DISABLED
                        // });
                        // Form.getField({ id: 'custrecord_tss_ve_tax_amt' }).updateDisplayType({
                        //     displayType: serverWidget.FieldDisplayType.DISABLED
                        // });
                    }
                }

            } catch (error) {
                log.error("Error in beforeLoad", error)
            }
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
            try {
                // log.debug("mode",scriptContext.type)
            } catch (error) {
                log.error("Error in beforeSubmit", error);
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

        return {
            beforeLoad,
            // beforeSubmit,
            // afterSubmit
        }

    });
