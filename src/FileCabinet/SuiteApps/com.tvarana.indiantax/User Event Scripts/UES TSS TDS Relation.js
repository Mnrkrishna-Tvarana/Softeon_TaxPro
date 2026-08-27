/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

/**
 * Script Name               : UES TSS TDS Relation
 * Script Author             : MNR Krishna
 * Script Type               : User Event Script
 * Script Version            : 2.1
 * Script Created date       : 14/08/2024
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  
 */



define(['N/search', 'N/record', 'N/task', 'N/ui/serverWidget', 'N/query', 'N/runtime'],
    /**
 * @param{search} search
 */
    (search, record, task, serverWidget, query, runtime) => {
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
                    var tdsSection = scriptContext.newRecord.getValue({ fieldId: 'custrecord_tss_vedtdstype' })
                    var billRelQuery = `
                    SELECT
                        customrecord_tss_accumulated_tds_tax.isInactive,
                        customrecord_tss_accumulated_tds_tax.id,

                    FROM
                        customrecord_tss_accumulated_tds_tax
                    WHERE
                        customrecord_tss_accumulated_tds_tax.custrecord_tss_acc_tax_section = ${tdsSection} 
                        AND 
                        customrecord_tss_accumulated_tds_tax.isInactive = 'F'
                    `
                    var billRelRes = query.runSuiteQL({
                        query: billRelQuery
                    });

                    billRelRes = billRelRes.results
                    log.debug("billRelRes length", billRelRes.length);
                    if (billRelRes.length > 0) {

                        current_record.getField({ id: 'custrecord_tss_vedtdstype' }).updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                        current_record.getField({ id: 'custrecord_tss_tds_vendorname' }).updateDisplayType({
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
            try {
                var current_record = scriptContext.newRecord;
                var vend = current_record.getValue({ fieldId: "custrecord_tss_tds_vendorname" });
                log.debug("vend in beforeSubmit", vend);
                if (vend) {
                    current_record.setValue({
                        fieldId: 'custrecord_tss_tds_entity',
                        value: vend,
                    });
                }

                // Sourcing the fields for Non UI context especially for CSV imports
                var currentContext = runtime.executionContext;
                log.debug("currentContext in beforeSubmit", currentContext);
                if (currentContext != 'USERINTERFACE') {
                    var tdsType = current_record.getValue({ fieldId: "custrecord_tss_vedtdstype" });
                    log.debug("tdsType in beforeSubmit", tdsType);
                    if (tdsType) {
                        var filters = new Array();
                        var columns = new Array();
                        filters.push(search.createFilter({
                            name: 'internalid',
                            operator: 'is',
                            values: tdsType
                        }));
                        columns.push(search.createColumn({ name: 'name' }));
                        columns.push(search.createColumn({ name: 'custrecord_tss_its_assessee_code' }));
                        columns.push(search.createColumn({ name: 'custrecord_tss_its_section' }));
                        columns.push(search.createColumn({ name: 'custrecord_tss_its_paymentcode' }));
                        columns.push(search.createColumn({ name: 'custrecord_tss_its_tds_threshold' }));
                        columns.push(search.createColumn({ name: 'custrecord_tss_its_cummulativethreshold' }));
                        columns.push(search.createColumn({ name: 'custrecord_tss_its_tdsaccount' }));
                        columns.push(search.createColumn({ name: 'custrecord_tss_its_netperc' }));
                        columns.push(search.createColumn({ name: 'custrecord_tss_its_panempty_per' }));
                        columns.push(search.createColumn({ name: 'custrecord_tss_its_tdsitem' }));
                        columns.push(search.createColumn({ name: 'custrecord_tss_its_rounding' }));
                        columns.push(search.createColumn({ name: 'custrecord_tss_its_calculate' }));
                        columns.push(search.createColumn({ name: 'custrecord_tss_its_retrospective' }));

                        var Tds_Master_search = search.create({
                            type: 'customrecord_tss_its_tdsmaster',
                            filters: filters,
                            columns: columns
                        });
                        var Tds_Master_search_result = Tds_Master_search.run().getRange(0, 100);
                        log.debug("Tds_Master_search_result.length in beforeSubmit", Tds_Master_search_result.length);
                        if (Tds_Master_search_result.length > 0) {
                            var section = Tds_Master_search_result[0].getValue({ name: 'custrecord_tss_its_section' });
                            var assessee_code = Tds_Master_search_result[0].getValue({ name: 'custrecord_tss_its_assessee_code' });
                            var payment_code = Tds_Master_search_result[0].getValue({ name: 'custrecord_tss_its_paymentcode' });
                            var tdsthamount = Tds_Master_search_result[0].getValue({ name: 'custrecord_tss_its_tds_threshold' });
                            var scthamount = Tds_Master_search_result[0].getValue({ name: 'custrecord_tss_its_cummulativethreshold' });
                            var tds_acc = Tds_Master_search_result[0].getValue({ name: 'custrecord_tss_its_tdsaccount' });
                            var net_per = Tds_Master_search_result[0].getValue({ name: 'custrecord_tss_its_netperc' });
                            var empty_vedpan = Tds_Master_search_result[0].getValue({ name: 'custrecord_tss_its_panempty_per' });
                            var name = Tds_Master_search_result[0].getValue({ name: 'name' });
                            var tdsitem = Tds_Master_search_result[0].getValue({ name: 'custrecord_tss_its_tdsitem' });
                            var tdsRounding = Tds_Master_search_result[0].getValue({ name: 'custrecord_tss_its_rounding' });
                            var tdscalculate = Tds_Master_search_result[0].getValue({ name: 'custrecord_tss_its_calculate' });
                            var cur_retro = Tds_Master_search_result[0].getValue({ name: "custrecord_tss_its_retrospective" });

                            log.debug("name in search result in beforSubmit", name);
                            //log.debug("empty_vedpan in search result in beforeSubmit",empty_vedpan);



                            current_record.setValue({
                                fieldId: 'custrecord_tss_tds_vedempty_pan_tdsper',
                                value: parseInt(empty_vedpan),
                            });
                            current_record.setValue({
                                fieldId: 'custrecord_tss_tds_vednetper',
                                value: parseInt(net_per),
                            });
                            current_record.setValue({
                                fieldId: 'custrecord_tss_tds_vedtdsaccount',
                                value: tds_acc,
                            });
                            current_record.setValue({
                                fieldId: 'custrecord_tss_tds_vedtdsitem',
                                value: tdsitem,
                            });
                            current_record.setValue({
                                fieldId: 'custrecord_tss_tds_vedsurchargethreshold',
                                value: scthamount,
                            });
                            current_record.setValue({
                                fieldId: 'custrecord_tss_tds_threshold',
                                value: tdsthamount,
                            });
                            current_record.setValue({
                                fieldId: 'custrecord_tss_tds_paymentcode',
                                value: payment_code,
                            });
                            current_record.setValue({
                                fieldId: 'custrecord_tss_tds_section',
                                value: section,
                            });
                            current_record.setValue({
                                fieldId: 'custrecord_tss_tds_vedassesseecode',
                                value: assessee_code,
                            });
                            current_record.setValue({
                                fieldId: 'custrecord_tss_tds_rounding',
                                value: tdsRounding,
                            });
                            current_record.setValue({
                                fieldId: 'custrecord_tss_tds_calculate',
                                value: tdscalculate,
                            });
                            current_record.setValue({
                                fieldId: 'custrecord_tss_tds_retrospective',
                                value: cur_retro,
                            });
                            current_record.setValue({
                                fieldId: 'name',
                                value: name,
                            });
                        }
                    }
                    else {
                        current_record.setValue({
                            fieldId: 'custrecord_tss_tds_vedempty_pan_tdsper',
                            value: '',
                        });
                        current_record.setValue({
                            fieldId: 'custrecord_tss_tds_vednetper',
                            value: '',
                        });
                        current_record.setValue({
                            fieldId: 'custrecord_tss_tds_vedtdsaccount',
                            value: '',
                        });
                        current_record.setValue({
                            fieldId: 'custrecord_tss_tds_vedtdsitem',
                            value: '',
                        });
                        current_record.setValue({
                            fieldId: 'custrecord_tss_tds_vedsurchargethreshold',
                            value: '',
                        });
                        current_record.setValue({
                            fieldId: 'custrecord_tss_tds_threshold',
                            value: '',
                        });
                        current_record.setValue({
                            fieldId: 'custrecord_tss_tds_paymentcode',
                            value: '',
                        });
                        current_record.setValue({
                            fieldId: 'custrecord_tss_tds_section',
                            value: '',
                        });
                        current_record.setValue({
                            fieldId: 'custrecord_tss_tds_vedassesseecode',
                            value: '',
                        });
                        current_record.setValue({
                            fieldId: 'custrecord_tss_tds_rounding',
                            value: '',
                        });
                        current_record.setValue({
                            fieldId: 'custrecord_tss_tds_calculate',
                            value: '',
                        });
                        current_record.setValue({
                            fieldId: 'custrecord_tss_tds_retrospective',
                            value: false,
                        });
                        current_record.setValue({
                            fieldId: 'name',
                            value: '',
                        });

                    }
                }
            } catch (error) {
                log.error("Error in beforeSubmit", error)
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
            beforeSubmit,
            // afterSubmit
        }

    });
