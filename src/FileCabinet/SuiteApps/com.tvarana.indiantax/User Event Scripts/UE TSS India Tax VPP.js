/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
/**
 * Script Name               : UE TSS India Tax VPP
 * Script Author             : MNR Krishna
 * Script Type               : User Event Script
 * Script Version            : 2.1
 * Script Created date       : 15/05/2026
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  It is the User Event Script for GST and TDS computation on Vendor Prepayments in Tvarana Indian TaxPro.
 */
define(['./TSS UE Vendor Prepayment', './TSS UE TDS VPP', '/SuiteApps/com.tvarana.indiantax/Other Files/TSS TaxPro Server Helper'],

    (TSS_VPP, TSS_TDS, serverHelper) => {
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
            if (TSS_VPP.beforeSubmit && scriptContext.newRecord.type == 'vendorprepayment') {
                TSS_VPP.beforeSubmit(scriptContext);
            }
            if (TSS_TDS.beforeSubmit && scriptContext.newRecord.type == 'vendorprepaymentapplication') {
                TSS_TDS.beforeSubmit(scriptContext);
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
            if (!serverHelper.checkSubscription()) {
                log.debug("TaxPro UE afterSubmit", "Subscription check failed - blocking execution");
                return true;
            }
            if (TSS_TDS.afterSubmit && scriptContext.newRecord.type == 'vendorprepaymentapplication') {
                TSS_TDS.afterSubmit(scriptContext);
            }
        }

        return {
            // beforeLoad, 
            beforeSubmit,
            afterSubmit
        }

    });
