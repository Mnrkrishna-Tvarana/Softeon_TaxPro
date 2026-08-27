/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
/**
 * Script Name               : UE TSS GST On Cust Refund
 * Script Author             : MNR Krishna
 * Script Type               : User Event Script
 * Script Version            : 2.1
 * Script Created date       : 15/10/2025
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  
/** 
 * * Version      Name              Date          Notes
 * 1.0         MNR Krishna       15/10/2025      Initial version 
 * 
 */
define(['N/task', 'N/url', 'N/search', 'N/runtime', '/SuiteApps/com.tvarana.indiantax/Other Files/TSS TaxPro Server Helper'],

    (task, url, search, runtime, serverHelper) => {

        var formSetFlag = true;
        var customFormsObjSb = {
            'purchaseorder': 201, 'vendorprepayment': 203, 'vendorbill': 193, 'vendorreturnauthorization': '', 'vendorcredit': 194, 'billpayment': '',
            'salesorder': 202, 'invoice': 199, 'returnauthorization': '', 'creditmemo': 197, 'customerpayments': '', 'cashsale': 195, 'customerrefund': 176, 'customerdeposit': 204
        }
        var customFormsObjProd = {
            'purchaseorder': 201, 'vendorprepayment': 203, 'vendorbill': 193, 'vendorreturnauthorization': '', 'vendorcredit': 194, 'billpayment': '',
            'salesorder': 202, 'invoice': 199, 'returnauthorization': '', 'creditmemo': 197, 'customerpayments': '', 'cashsale': 195, 'customerrefund': 176, 'customerdeposit': 204
        }

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
            try {
                if (!serverHelper.checkSubscription()) {
                    log.debug("TaxPro UE beforeSubmit", "Subscription check failed - blocking execution");
                    return true;
                }
                var globalParRec = GettingGlobalParameter()
                var refundRec = scriptContext.newRecord;
                var recSub = refundRec.getValue({ fieldId: 'subsidiary' })
                if (inArray(recSub, globalParRec[0]) == parseInt(1)) {
                    if (formSetFlag) {
                        var customFormsObj = ''
                        var accountId = runtime.accountId;
                        log.debug('Account ID', accountId);
                        if (accountId.endsWith('_SB1')) {
                            customFormsObj = customFormsObjSb// SB3
                        }
                        else if (runtime.envType === runtime.EnvType.PRODUCTION) {
                            customFormsObj = customFormsObjProd
                            // console.log('Production');
                        }
                        var rec_form = refundRec.getValue({ fieldId: "customform" });
                        if ((rec_form != customFormsObj[refundRec.type]) && (_logValidation(customFormsObj[refundRec.type]))) {
                            refundRec.setValue({ fieldId: "customform", value: customFormsObj[refundRec.type] });
                        }
                    }
                }
            } catch (error) {
                log.debug("Error in beforeSubmit", error)
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
            try {
                if (!serverHelper.checkSubscription()) {
                    log.debug("TaxPro UE afterSubmit", "Subscription check failed - blocking execution");
                    return true;
                }
                var globalParRec = GettingGlobalParameter()
                var refundRec = scriptContext.newRecord;
                refundRec = record.load({
                    type: refundRec.type,
                    id: refundRec.id
                })
                var recSub = refundRec.getValue({ fieldId: 'subsidiary' })
                log.debug("recSub afterSubmit", recSub);
                log.debug("inArray(recSub, globalParRec[0]) afterSubmit", inArray(recSub, globalParRec[0]));
                if (inArray(recSub, globalParRec[0]) == parseInt(1)) {
                    //Defining Old record and New Record applied deposit Applications 
                    var oldCDA = []
                    var newCDA = []
                    //Old record data fetching
                    var refundOldRec = scriptContext.oldRecord;
                    if (refundOldRec && scriptContext.type == 'edit') {
                        var applyTaxOld = refundOldRec.getValue({ fieldId: 'custbody_tss_it_apply_gst' })
                        log.debug("applyTaxOld aftersubmit", applyTaxOld)
                        var taxCodeOld = refundOldRec.getValue({ fieldId: 'custbody_tss_it_tax_code' })
                        log.debug("taxCodeOld aftersubmit", taxCodeOld)
                        if (applyTaxOld && taxCodeOld) {
                            var appliLineCountOld = refundOldRec.getLineCount({ sublistId: 'apply' });
                            log.debug("appliLineCountOld aftersubmit", appliLineCountOld)
                            for (var i = 0; i < appliLineCountOld; i++) {
                                var isAppliedOld = refundOldRec.getSublistValue({
                                    sublistId: 'apply',
                                    fieldId: 'apply',
                                    line: i
                                });
                                if (isAppliedOld) {
                                    var trantypeOld = refundOldRec.getSublistValue({
                                        sublistId: 'apply',
                                        fieldId: 'trantype',
                                        line: i
                                    });
                                    log.debug("trantypeOld", trantypeOld)
                                    if (trantypeOld == 'DepAppl') {
                                        var lineTranIdOld = refundOldRec.getSublistValue({
                                            sublistId: 'apply',
                                            fieldId: 'doc',
                                            line: i
                                        });
                                        // var lineTranAmtOld = refundOldRec.getSublistValue({
                                        //     sublistId: 'apply',
                                        //     fieldId: 'amount',
                                        //     line: i
                                        // });
                                        oldCDA.push(lineTranIdOld)
                                    }


                                }
                            }
                        }
                    }

                    //End of old record data
                    var applyTax = refundRec.getValue({ fieldId: 'custbody_tss_it_apply_gst' })
                    log.debug("applyTax aftersubmit", applyTax)
                    var taxCode = refundRec.getValue({ fieldId: 'custbody_tss_it_tax_code' })
                    log.debug("taxCode aftersubmit", taxCode)
                    if (taxCode && applyTax) {
                        var toBeSchedule = false;
                        var appliLineCount = refundRec.getLineCount({ sublistId: 'apply' });
                        log.debug("appliLineCount aftersubmit", appliLineCount)
                        for (var i = 0; i < appliLineCount; i++) {
                            var isApplied = refundRec.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'apply',
                                line: i
                            });
                            if (isApplied) {
                                var lineTranId = refundRec.getSublistValue({
                                    sublistId: 'apply',
                                    fieldId: 'trantype',
                                    line: i
                                });
                                log.debug("lineTranId", lineTranId)
                                if (lineTranId == 'DepAppl') {
                                    log.debug("yes it is time to call scheduled script")
                                    toBeSchedule = true;
                                    newCDA.push(lineTranIdOld)
                                }
                            }
                        }

                        var appliLineCount1 = refundRec.getLineCount({ sublistId: 'deposit' });
                        log.debug("appliLineCount1 aftersubmit", appliLineCount1)
                        for (var i = 0; i < appliLineCount1; i++) {
                            var isApplied = refundRec.getSublistValue({
                                sublistId: 'deposit',
                                fieldId: 'apply',
                                line: i
                            });
                            if (isApplied) {
                                // var lineTranId = refundRec.getSublistValue({
                                //     sublistId: 'deposit',
                                //     fieldId: 'trantype',
                                //     line: i
                                // });
                                // log.debug("lineTranId", lineTranId)
                                // if (lineTranId == 'DepAppl' || lineTranId == 'CustDep') {
                                log.debug("yes it is time to call scheduled script")
                                toBeSchedule = true;
                                // }
                            }
                        }

                        // defining the array of deposit applications which have unapplied in edit, these also need to update tax fields
                        var unappliedCDA = []
                        if (scriptContext.type == 'edit') {
                            unappliedCDA = oldCDA.filter(function (el) {
                                return !newCDA.includes(el);
                            });
                            log.debug("unappliedCDA", unappliedCDA)
                            if (unappliedCDA.length > 0) {
                                toBeSchedule = true
                            }
                        }

                        if (toBeSchedule) {
                            //Calling scheduled script to create & upload the payment file.
                            var scriptTask = task.create({
                                taskType: task.TaskType.SCHEDULED_SCRIPT
                            });

                            // Set the script ID and deployment ID of the scheduled script
                            scriptTask.scriptId = 'customscript_sch_tss_update_gst_on_depos';
                            scriptTask.deploymentId = 'customdeploy1';

                            // Add any parameters if necessary
                            scriptTask.params = {
                                // custscript_pbf_action: 'create',
                                custscript_cr_id: [refundRec.id, unappliedCDA],
                                custscript_update_cda: toBeSchedule
                            };
                            log.debug("scriptTask", scriptTask)
                            // Submit the scheduled script task
                            var taskId = scriptTask.submit();
                            log.debug('Scheduled script task submitted aftersubmit', 'Task ID: ' + taskId);
                        }
                    }
                    // log.debug("apply sublist", processSublistLines(refundRec, 'apply'))
                    // log.debug("deposit sublist", processSublistLines(refundRec, 'deposit'))
                }


            } catch (error) {
                log.debug("Error in afterSubmit", error)
            }
        }

        function GettingGlobalParameter() {
            var GlobalSubsidiary = ''
            var GlobalGSTpaid = ''

            var GlobalParameterSearch = search.create({
                type: "customrecord_tss_global_parameter",
                filters: [["isinactive", "is", "F"]],
                columns: [
                    search.createColumn({ name: "internalid", label: "Internalid" }),
                    search.createColumn({ name: "custrecord_tss_gp_subsidiary", label: "Internalid" }),
                    search.createColumn({ name: "custrecord_tss_gp_lut_gstrefund", label: "Internalid" }),

                ]
            });
            var GlobalParameterSearchResults = GlobalParameterSearch.run().getRange({ start: 0, end: 1000 });
            if (GlobalParameterSearchResults.length > 0) {
                GlobalSubsidiary = GlobalParameterSearchResults[0].getValue({ name: 'custrecord_tss_gp_subsidiary' });
                GlobalGSTpaid = GlobalParameterSearchResults[0].getValue({ name: 'custrecord_tss_gp_lut_gstrefund' });

            }
            return [GlobalSubsidiary, GlobalGSTpaid]

        }

        // Custom Functions
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

        }
        function _logValidation(value) {
            if (value != 'null' && value != null && value != null && value != '' && value != undefined && value != undefined && value != 'undefined' && value != 'undefined' && value != 'NaN' && value != NaN) {
                return true;
            }
            else {
                return false;
            }
        }

        function processSublistLines(rec, sublistId) {


            var lineCount = rec.getLineCount({
                sublistId: sublistId
            });

            var allSublistData = [];

            for (var i = 0; i < lineCount; i++) {
                // rec.selectLine({
                //     sublistId: sublistId,
                //     line: i
                // });

                var lineData = {};
                // Get all fields on the current line
                var sublistFields = rec.getSublistFields({
                    sublistId: sublistId,
                    line: i
                });
                log.debug("sublistFields", sublistFields)

                sublistFields.forEach(function (fieldId) {
                    try {
                        var fieldValue = rec.getSublistValue({
                            sublistId: sublistId,
                            fieldId: fieldId,
                            line: i
                        });
                        lineData[fieldId] = fieldValue;
                    } catch (e) {
                        // Handle cases where a field might not be accessible or has no value on a specific line
                        log.debug('Error getting field value for ' + fieldId + ' on line ' + i, e.message);
                    }
                });
                allSublistData.push(lineData);
            }
            return allSublistData;
        }
        return { beforeLoad, beforeSubmit, afterSubmit }

    });
