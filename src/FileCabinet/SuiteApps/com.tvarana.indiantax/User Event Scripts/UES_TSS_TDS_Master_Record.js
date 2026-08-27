/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

/**
 * Script Name               : UES TSS TDS Master Record
 * Script Author             : MNR Krishna
 * Script Type               : User Event Script
 * Script Version            : 2.1
 * Script Created date       : 22/06/2023
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  If user make changes in TDS Master, then script will also change the TDS Relation records accordingly. If more TDS Relation records are to be affected, then it calls the scheduled script(SCH_TSS_Update_TDS_Relation) with TDS Relation record Id as parameter.
 */


define(['N/search', 'N/record', 'N/task', 'N/ui/serverWidget', 'N/query'],
    /**
 * @param{search} search
 */
    (search, record, task, serverWidget, query) => {
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
                var current_record = scriptContext.form;
                if (scriptContext.type == 'edit') {

                    var billRelQuery = `
                    SELECT
                        customrecord_tss_accumulated_tds_tax.isInactive,
                        customrecord_tss_accumulated_tds_tax.id,

                    FROM
                        customrecord_tss_accumulated_tds_tax
                    WHERE
                        customrecord_tss_accumulated_tds_tax.custrecord_tss_acc_tax_section = ${scriptContext.newRecord.id} 
                        AND 
                        customrecord_tss_accumulated_tds_tax.isInactive = 'F'
                    `
                    var billRelRes = query.runSuiteQL({
                        query: billRelQuery
                    });

                    billRelRes = billRelRes.results
                    log.debug("billRelRes length", billRelRes.length);
                    if (billRelRes.length > 0) {
                        var compField = current_record.getField({ id: 'custrecord_tss_its_assessee_code' });
                        // log.debug("compField", compField)
                        compField.updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        current_record.getField({ id: 'custrecord_tss_its_tds_threshold' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        current_record.getField({ id: 'custrecord_tss_its_tdsaccount' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        current_record.getField({ id: 'custrecord_tss_its_netperc' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        current_record.getField({ id: 'custrecord_tss_its_cummulativethreshold' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        current_record.getField({ id: 'custrecord_tss_its_tdsitem' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        current_record.getField({ id: 'custrecord_tss_its_sectioncode' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        current_record.getField({ id: 'custrecord_tss_its_panempty_per' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        current_record.getField({ id: 'custrecord_tss_its_paymentcode' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        current_record.getField({ id: 'custrecord_tss_its_rounding' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        current_record.getField({ id: 'custrecord_tss_its_calculate' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        current_record.getField({ id: 'custrecord_tss_its_retrospective' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                    }
                }
            } catch (error) {
                log.error("Error in beforeLoad", error);
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
            // try {



            // }
            // catch (e) {
            //     log.error("Error in beforeSubmit", e);
            // }
            var current_record = scriptContext.newRecord
            var cur_TDS_cum_thre = current_record.getValue({ fieldId: "custrecord_tss_its_cummulativethreshold" });
            var cur_TDS_threshold = current_record.getValue({ fieldId: "custrecord_tss_its_tds_threshold" });

            if (parseFloat(cur_TDS_cum_thre) < 0 || parseFloat(cur_TDS_threshold) < 0) {
                throw "Threshold Amounts should be graeter than 0";
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
                var recordId = scriptContext.newRecord.id;
                log.debug("recordId", recordId);
                var recordType = scriptContext.newRecord.type;
                log.debug("recordType", recordType);
                var current_record = record.load({ type: recordType, id: recordId, isDynamic: true });


                if (scriptContext.type == 'edit' || scriptContext.type == 'xedit') {
                    var oldRecord = scriptContext.oldRecord;

                    var old_TDS_name = oldRecord.getValue({ fieldId: "name" });
                    var old_assessee_code = oldRecord.getValue({ fieldId: "custrecord_tss_its_assessee_code" });
                    var old_TDS_threshold = oldRecord.getValue({ fieldId: "custrecord_tss_its_tds_threshold" });
                    var old_TDS_account = oldRecord.getValue({ fieldId: "custrecord_tss_its_tdsaccount" });
                    var old_TDS_percent = oldRecord.getValue({ fieldId: "custrecord_tss_its_netperc" });
                    var old_TDS_cum_thre = oldRecord.getValue({ fieldId: "custrecord_tss_its_cummulativethreshold" });
                    var old_TDS_item = oldRecord.getValue({ fieldId: "custrecord_tss_its_tdsitem" });
                    var old_TDS_section = oldRecord.getValue({ fieldId: "custrecord_tss_its_sectioncode" });
                    var old_TDS_pan_emptyrate = oldRecord.getValue({ fieldId: "custrecord_tss_its_panempty_per" });
                    var old_paymentCode = oldRecord.getValue({ fieldId: "custrecord_tss_its_paymentcode" });
                    var old_calculate = oldRecord.getValue({ fieldId: "custrecord_tss_its_calculate" });
                    var old_rounding = oldRecord.getValue({ fieldId: "custrecord_tss_its_rounding" });
                    var old_retro = oldRecord.getValue({ fieldId: "custrecord_tss_its_retrospective" });
                    var old_inactive = oldRecord.getValue({ fieldId: "isinactive" });
                    var old_validUpto = oldRecord.getValue({ fieldId: "custrecord_tss_its_valid_until" });
                    var old_validFrom = oldRecord.getValue({ fieldId: "custrecord_tss_its_valid_from" });


                    var cur_TDS_name = current_record.getValue({ fieldId: "name" });
                    var cur_assessee_code = current_record.getValue({ fieldId: "custrecord_tss_its_assessee_code" });
                    var cur_TDS_threshold = current_record.getValue({ fieldId: "custrecord_tss_its_tds_threshold" });
                    var cur_TDS_account = current_record.getValue({ fieldId: "custrecord_tss_its_tdsaccount" });
                    var cur_TDS_percent = current_record.getValue({ fieldId: "custrecord_tss_its_netperc" });
                    var cur_TDS_cum_thre = current_record.getValue({ fieldId: "custrecord_tss_its_cummulativethreshold" });
                    var cur_TDS_item = current_record.getValue({ fieldId: "custrecord_tss_its_tdsitem" });
                    var cur_TDS_section = current_record.getValue({ fieldId: "custrecord_tss_its_sectioncode" });
                    var cur_TDS_section_name = current_record.getText({ fieldId: "custrecord_tss_its_sectioncode" });
                    var cur_TDS_pan_emptyrate = current_record.getValue({ fieldId: "custrecord_tss_its_panempty_per" });
                    var cur_paymentCode = current_record.getValue({ fieldId: "custrecord_tss_its_paymentcode" });
                    var cur_calculate = current_record.getValue({ fieldId: "custrecord_tss_its_calculate" });
                    var cur_rounding = current_record.getValue({ fieldId: "custrecord_tss_its_rounding" });
                    var cur_retro = current_record.getValue({ fieldId: "custrecord_tss_its_retrospective" });
                    var cur_inactive = current_record.getValue({ fieldId: "isinactive" });
                    var cur_validUpto = current_record.getValue({ fieldId: "custrecord_tss_its_valid_until" });
                    var cur_validFrom = current_record.getValue({ fieldId: "custrecord_tss_its_valid_from" });

                    var flag = parseInt(0);

                    if (old_TDS_name != cur_TDS_name) {
                        flag = parseInt(1);
                    }

                    if (old_assessee_code != cur_assessee_code) {
                        flag = parseInt(1);
                    }
                    if (old_TDS_threshold != cur_TDS_threshold) {
                        flag = parseInt(1);
                    }
                    if (old_TDS_account != cur_TDS_account) {
                        flag = parseInt(1);
                    }
                    if (old_TDS_percent != cur_TDS_percent) {
                        flag = parseInt(1);
                    }
                    if (old_TDS_cum_thre != cur_TDS_cum_thre) {
                        flag = parseInt(1);
                    }
                    if (old_TDS_section != cur_TDS_section) {
                        flag = parseInt(1);
                    }
                    if (old_TDS_pan_emptyrate != cur_TDS_pan_emptyrate) {
                        flag = parseInt(1);
                    }
                    if (old_paymentCode != cur_paymentCode) {
                        flag = parseInt(1);
                    }
                    if (old_TDS_item != cur_TDS_item) {
                        flag = parseInt(1);
                    }
                    if (old_calculate != cur_calculate) {
                        flag = parseInt(1);
                    }
                    if (old_rounding != cur_rounding) {
                        flag = parseInt(1);
                    }
                    if (old_retro != cur_retro) {
                        flag = parseInt(1);
                    }
                    if (old_inactive != cur_inactive) {
                        if (isTrue(cur_inactive)) {
                            flag = parseInt(1);
                        }
                    }
                    if (old_validUpto != cur_validUpto) {
                        flag = parseInt(1);
                    }
                    if (old_validFrom != cur_validFrom) {
                        flag = parseInt(1);
                    }

                    log.debug("flag in afterSubmit", flag);

                    if (parseInt(flag) == parseInt(1)) {
                        var filters = new Array();
                        var columns = new Array();
                        // filters.push(search.createFilter({
                        //     name: 'isinactive',
                        //     operator: 'is',
                        //     values: 'F'
                        // }));
                        filters.push(search.createFilter({
                            name: 'custrecord_tss_vedtdstype',
                            operator: 'anyOf',
                            values: recordId
                        }));
                        columns.push(search.createColumn({ name: 'internalid' }));
                        columns.push(search.createColumn({ name: 'custrecord_tss_tds_vendorname' }));
                        columns.push(search.createColumn({ name: 'isperson', join: 'custrecord_tss_tds_vendorname' }))
                        var Tds_Relation_search = search.create({
                            type: 'customrecord_tss_tdsrelation',
                            filters: filters,
                            columns: columns
                        });
                        var Tds_Relation_search_result = Tds_Relation_search.run().getRange(0, 100);
                        if (Tds_Relation_search_result.length > 0) {
                            var counter = parseInt(Tds_Relation_search_result.length);
                            if (parseInt(counter) <= parseInt(90)) {
                                for (var i = 0; i < Tds_Relation_search_result.length; i++) {
                                    var tds_relationId = Tds_Relation_search_result[i].getValue({ name: 'internalid' });
                                    var tds_relationVendor = Tds_Relation_search_result[i].getValue({ name: 'custrecord_tss_tds_vendorname' });
                                    var tds_relationIsPerson = Tds_Relation_search_result[i].getValue({ name: 'isperson', join: 'custrecord_tss_tds_vendorname' });

                                    if ((isTrue(tds_relationIsPerson) && cur_assessee_code == 1) || (!isTrue(tds_relationIsPerson) && cur_assessee_code == 2)) {

                                        try {
                                            var updatedId = record.submitFields({
                                                type: 'customrecord_tss_tdsrelation',
                                                id: tds_relationId,
                                                values: {
                                                    'name': cur_TDS_name,
                                                    'custrecord_tss_tds_section': cur_TDS_section_name,
                                                    'custrecord_tss_tds_vedassesseecode': cur_assessee_code,
                                                    'custrecord_tss_tds_paymentcode': cur_paymentCode,
                                                    'custrecord_tss_tds_threshold': cur_TDS_threshold,
                                                    'custrecord_tss_tds_vedtdsaccount': cur_TDS_account,
                                                    'custrecord_tss_tds_vedempty_pan_tdsper': cur_TDS_pan_emptyrate,
                                                    'custrecord_tss_tds_vednetper': cur_TDS_percent,
                                                    'custrecord_tss_tds_vedtdsitem': cur_TDS_item,
                                                    'custrecord_tss_tds_rounding': cur_rounding,
                                                    'custrecord_tss_its_calculate': cur_calculate,
                                                    'custrecord_tss_tds_vedsurchargethreshold': cur_TDS_cum_thre,
                                                    'custrecord_tss_tds_retrospective': cur_retro,
                                                    'isinactive': cur_inactive,
                                                    'custrecord_tss_tds_relation_valid_until': cur_validUpto,
                                                    'custrecord_tss_tds_relation_valid_from': cur_validFrom
                                                },
                                                options: {
                                                    enableSourcing: false,
                                                    ignoreMandatoryFields: true
                                                }
                                            });
                                            log.debug("TDS Relation updates Id", updatedId);
                                        }
                                        catch (e) {
                                            log.error("Error in updating TDS Relation record", e);
                                        }
                                    } // if (isTrue(tds_relationIsPerson) && cur_assessee_code == 1)
                                    else {
                                        try {
                                            var updatedId = record.submitFields({
                                                type: 'customrecord_tss_tdsrelation',
                                                id: tds_relationId,
                                                values: {
                                                    'isinactive': true
                                                },
                                                options: {
                                                    enableSourcing: false,
                                                    ignoreMandatoryFields: true
                                                }
                                            });
                                            log.debug("TDS Relation Inactive Id(Assessee Code is not matched)", updatedId);
                                        } catch (error) {
                                            log.error("Error in Inactive the TDS Relation(Assessee Code is not matched)", error);
                                        }
                                    } // else
                                }
                            } // end if (parseInt(counter) <= parseInt(300))
                            else {
                                var Task = task.create({
                                    taskType: task.TaskType.SCHEDULED_SCRIPT,
                                    scriptId: 'customscript_sch_tss_update_tds_relation',
                                    deploymentId: 'customdeploy_sch_tss_update_tds_relation',
                                    params: {
                                        'custscript_tds_master_id': recordId
                                    }

                                });
                                log.debug("Task in calling schedule script", Task);
                                var taskId = Task.submit();
                                log.debug("taskId in afterSave", taskId);
                            }

                        } // end if(Tds_Relation_search_result.length > 0)
                    }// end if (parseInt(flag) == parseInt(1)) 


                }

                var rec_TDS_section = current_record.getText({ fieldId: "custrecord_tss_its_sectioncode" });
                //log.debug("rec_TDS_section in afterSubmit",rec_TDS_section);
                current_record.setValue({
                    fieldId: "custrecord_tss_its_section",
                    value: rec_TDS_section
                });

                var rec_name = current_record.getValue({ fieldId: "name" });
                var individ_flag = rec_name.includes("(Individual)");
                var company_flag = rec_name.includes("(Company)");
                log.debug("individ_flag", individ_flag);
                log.debug("company_flag", company_flag);
                if (individ_flag || company_flag) {
                    var rec_assesse = current_record.getText({ fieldId: "custrecord_tss_its_assessee_code" });
                    if (individ_flag) {
                        // rec_name = rec_name.replace(/[(Individual)]/g, '');
                        rec_name = rec_name.replace('(Individual)', '');
                    }
                    if (company_flag) {
                        // rec_name = rec_name.replace(/[(Company)]/g, '');
                        rec_name = rec_name.replace('(Company)', '');
                    }
                    rec_name = rec_name.trim();
                    rec_name = rec_name + ' (' + rec_assesse + ')'
                    current_record.setValue({
                        fieldId: "name",
                        value: rec_name
                    });
                }
                else {
                    var rec_assesse = current_record.getText({ fieldId: "custrecord_tss_its_assessee_code" });
                    rec_name = rec_name.trim();
                    rec_name = rec_name + ' (' + rec_assesse + ')';
                    current_record.setValue({
                        fieldId: "name",
                        value: rec_name
                    });
                }



                current_record.save();
            }// end try
            catch (e) {
                log.error("Error in afterSubmit", e);
            }
        } // end const afterSubmit = (scriptContext) =>


        function _logValidation(value) {
            if (value != 'null' && value != null && value != null && value != '' && value != undefined && value != undefined && value != 'undefined' && value != 'undefined' && value != 'NaN' && value != NaN) {
                return true;
            }
            else {
                return false;
            }
        }
        function isTrue(value) {
            if (value == 'T' || value == true || value == 'true') {
                return true;
            }
            else {
                return false;
            }
        }

        return {
            beforeLoad,
            beforeSubmit,
            afterSubmit
        }

    });
