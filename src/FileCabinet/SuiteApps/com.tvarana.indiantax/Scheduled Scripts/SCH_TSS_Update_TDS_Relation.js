/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */

/**
 * Script Name               : SCH TSS Update TDS Relation
 * Script Author             : MNR Krishna
 * Script Type               : Scheduled Script 
 * Script Version            : 2.1
 * Script Created date       : 22/06/2023
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  If user make changes in TDS Master, then script will also change the TDS Relation records accordingly. If more TDS Relation records are to be affected, then it calls from  User Event script(UES_TSS_TDS_Master_Record) with TDS Relation record Id as parameter.
 */


define(['N/search', 'N/runtime', 'N/record'],
    /**
 * @param{search} search
 */
    (search, runtime, record) => {

        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        const execute = (scriptContext) => {
            try {
                var currentScript = runtime.getCurrentScript();
                var TDS_MasterId = currentScript.getParameter({
                    name: 'custscript_tds_master_id'
                });
                log.debug('TDS_MasterId parameter', TDS_MasterId);
                if (TDS_MasterId != null && TDS_MasterId != '' && TDS_MasterId != undefined) {
                    var current_record = record.load({ type: 'customrecord_tss_its_tdsmaster', id: TDS_MasterId });

                    var cur_name = current_record.getValue({ fieldId: "name" });
                    var cur_assessee_code = current_record.getValue({ fieldId: "custrecord_tss_its_assessee_code" });
                    var cur_TDS_threshold = current_record.getValue({ fieldId: "custrecord_tss_its_tds_threshold" });
                    var cur_TDS_account = current_record.getValue({ fieldId: "custrecord_tss_its_tdsaccount" });
                    var cur_TDS_percent = current_record.getValue({ fieldId: "custrecord_tss_its_netperc" });
                    var cur_TDS_section = current_record.getText({ fieldId: "custrecord_tss_its_sectioncode" });
                    var cur_TDS_pan_emptyrate = current_record.getValue({ fieldId: "custrecord_tss_its_panempty_per" });
                    var cur_paymentCode = current_record.getValue({ fieldId: "custrecord_tss_its_paymentcode" });
                    var cur_TDS_item = current_record.getValue({ fieldId: "custrecord_tss_its_tdsitem" });
                    var cur_calculate = current_record.getValue({ fieldId: "custrecord_tss_its_calculate" });
                    var cur_rounding = current_record.getValue({ fieldId: "custrecord_tss_its_rounding" });
                    var cur_retro = current_record.getValue({ fieldId: "custrecord_tss_its_retrospective" });
                    var cur_inactive = current_record.getValue({ fieldId: "isinactive" });
                    var cur_validUpto = current_record.getValue({ fieldId: "custrecord_tss_its_valid_until" });
                    var cur_validFrom = current_record.getValue({ fieldId: "custrecord_tss_its_valid_from" });

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
                        values: TDS_MasterId
                    }));
                    columns.push(search.createColumn({ name: 'internalid' }));
                    columns.push(search.createColumn({ name: 'isperson', join: 'custrecord_tss_tds_vendorname' }))
                    var Tds_Relation_search = search.create({
                        type: 'customrecord_tss_tdsrelation',
                        filters: filters,
                        columns: columns
                    });
                    var Tds_Relation_search_result = Tds_Relation_search.run().getRange(0, 100);
                    if (Tds_Relation_search_result.length > 0) {
                        for (var i = 0; i < Tds_Relation_search_result.length; i++) {
                            var tds_relationId = Tds_Relation_search_result[i].getValue({ name: 'internalid' });
                            var tds_relationIsPerson = Tds_Relation_search_result[i].getValue({ name: 'isperson', join: 'custrecord_tss_tds_vendorname' });

                            if ((isTrue(tds_relationIsPerson) && cur_assessee_code == 1) || (!isTrue(tds_relationIsPerson) && cur_assessee_code == 2)) {
                                try {


                                    var updatedId = record.submitFields({
                                        type: 'customrecord_tss_tdsrelation',
                                        id: tds_relationId,
                                        values: {
                                            'name': cur_name,
                                            'custrecord_tss_tds_section': cur_TDS_section,
                                            'custrecord_tss_tds_vedassesseecode': cur_assessee_code,
                                            'custrecord_tss_tds_paymentcode': cur_paymentCode,
                                            'custrecord_tss_tds_threshold': cur_TDS_threshold,
                                            'custrecord_tss_tds_vedtdsaccount': cur_TDS_account,
                                            'custrecord_tss_tds_vedempty_pan_tdsper': cur_TDS_pan_emptyrate,
                                            'custrecord_tss_tds_vednetper': cur_TDS_percent,
                                            'custrecord_tss_tds_vedtdsitem': cur_TDS_item,
                                            'custrecord_tss_tds_rounding': cur_rounding,
                                            'custrecord_tss_tds_calculate': cur_calculate,
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
                                    log.debug("TDS Relation updated Id", updatedId);
                                }
                                catch (e) {
                                    log.error("Error while updating TDS Relation record", e);
                                }
                            } // end if ((isTrue(tds_relationIsPerson) && cur_assessee_code == 1) || (!isTrue(tds_relationIsPerson) && cur_assessee_code == 2))
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
                    } // end if(Tds_Relation_search_result.length > 0)

                } // end if (TDS_MasterId != null && TDS_MasterId != '' && TDS_MasterId != undefined)

            } // end try
            catch (e) {
                log.error("Error Occured", e);
            }// end catch(e)
        }

        function isTrue(value) {
            if (value == 'T' || value == true || value == 'true') {
                return true;
            }
            else {
                return false;
            }
        }

        return { execute }

    });
