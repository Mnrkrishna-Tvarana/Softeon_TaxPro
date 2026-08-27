/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

/**
 * Script Name               : UE TSS Indian Tax Transaction
 * Script Author             : MNR Krishna
 * Script Type               : User Event Script
 * Script Version            : 2.1
 * Script Created date       : 26/03/2025
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  It is the User Event Script for GST and TDS computation in Tvarana Indian Tax Bundle. Which are also covering the CSV import context and more.
 */

define(['./UES_TSS_Set_Codes_on_Check', './TSS UE TDS New', './TSS UE TDS On Sales', './TSS UE TCS On Sales', '/SuiteApps/com.tvarana.indiantax/Other Files/TSS TaxPro Server Helper'],

    (TSS_GST, TSS_TDS, TSS_TDS_Sales, TSS_TCS_Sales, serverHelper) => {
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
            // Always first line — checks subscription
            if (!serverHelper.checkSubscription()) {
                log.debug("TaxPro UE beforeLoad", "Subscription check failed - blocking execution");
                return true;
            }

            if (TSS_GST.beforeLoad) {
                TSS_GST.beforeLoad(scriptContext);
            }
            if (TSS_TDS.beforeLoad && scriptContext.newRecord.type == 'vendorbill') {
                TSS_TDS.beforeLoad(scriptContext);
            }
            if (TSS_TDS_Sales.beforeLoad && (scriptContext.newRecord.type == 'creditmemo' || scriptContext.newRecord.type == 'invoice')) {
                TSS_TDS_Sales.beforeLoad(scriptContext);
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
            if (!serverHelper.checkSubscription()) {
                log.debug("TaxPro UE beforeSubmit", "Subscription check failed - blocking execution");
                return true;
            }


            if (TSS_GST.beforeSubmit) {
                TSS_GST.beforeSubmit(scriptContext);
            }
            if (TSS_TDS.beforeSubmit && scriptContext.newRecord.type == 'vendorbill') {
                TSS_TDS.beforeSubmit(scriptContext);
            }
            if (TSS_TDS_Sales.beforeSubmit && (scriptContext.newRecord.type == 'creditmemo' || scriptContext.newRecord.type == 'invoice')) {
                TSS_TDS_Sales.beforeSubmit(scriptContext);
            }
            if (TSS_TCS_Sales.beforeSubmit && (scriptContext.newRecord.type == 'invoice')) {
                TSS_TCS_Sales.beforeSubmit(scriptContext);
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


            if (TSS_TDS.afterSubmit && scriptContext.newRecord.type == 'vendorbill') {
                TSS_TDS.afterSubmit(scriptContext);
            }
            if (TSS_TDS_Sales.afterSubmit && (scriptContext.newRecord.type == 'creditmemo' || scriptContext.newRecord.type == 'invoice')) {
                TSS_TDS_Sales.afterSubmit(scriptContext);
            }
        }

        return { beforeLoad, beforeSubmit, afterSubmit }

    });
