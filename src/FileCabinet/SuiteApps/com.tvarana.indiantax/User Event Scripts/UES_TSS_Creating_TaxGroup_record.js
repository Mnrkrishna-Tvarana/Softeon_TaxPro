/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
/**
 * Script Name               : UES TSS Creating TaxGroup record
 * Script Author             : MNR Krishna
 * Script Type               : User Event Script
 * Script Version            : 2.1
 * Script Created date       : 01/08/2023
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  Script create/update Tax Group Determination Custom record on create/update the Item, Expense Category and ExpenseAccount record.
 */


/** 
 * * Version      Name              Date          Notes
 * 1.0         MNR Krishna       01/08/2023       Initial version 
 * 
 */


define(['N/record', 'N/search', '/SuiteApps/com.tvarana.indiantax/Other Files/TSS TaxPro Server Helper'],
    /**
 * @param{record} record
 * @param{search} search
 * @param{serverHelper} serverHelper
 */
    (record, search, serverHelper) => {
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
                if (scriptContext.type == 'edit' || scriptContext.type == 'create' || scriptContext.type == 'xedit') {
                    var intraTaxCode;
                    var interTaxCode;
                    var intraTaxCodeRCM;
                    var interTaxCodeRCM;
                    var haveTaxGroupDetermination = true;
                    var recordId = scriptContext.newRecord.id;
                    log.debug("recordId", recordId);
                    var recordType = scriptContext.newRecord.type;
                    log.debug("recordType", recordType);
                    var current_record = record.load({ type: recordType, id: recordId, isDynamic: true });
                    if (recordType == 'expensecategory') {
                        var cur_hsn = current_record.getValue({ fieldId: "custrecord_tss_its_exp_hsncategory" });
                    }
                    else if (recordType == 'account') {
                        var cur_hsn = current_record.getValue({ fieldId: "custrecord_tss_its_act_hsncategory" });
                    }
                    else {
                        var cur_hsn = current_record.getValue({ fieldId: "custitem_tss_its_hsncategory" });
                    }

                    log.debug("cur_hsn in afterSubmit", cur_hsn);
                    if (_logValidation(cur_hsn)) {
                        var TaxRateObj = search.lookupFields({
                            type: 'customrecord_tss_gst_rate_master',
                            id: cur_hsn,
                            columns: ['custrecord_tss_tax_rate']
                        });
                        var TaxRate = TaxRateObj.custrecord_tss_tax_rate;
                        log.debug("TaxRate in afterSubmit", parseInt(TaxRate));

                        var filters1 = new Array();
                        var columns1 = new Array();
                        filters1.push(search.createFilter({
                            name: 'country',
                            operator: 'anyof',
                            values: 'IN'
                        }));
                        filters1.push(search.createFilter({
                            name: 'rate',
                            operator: 'equalto',
                            values: parseInt(TaxRate)
                        }));
                        filters1.push(search.createFilter({
                            name: 'isinactive',
                            operator: 'is',
                            values: 'F'
                        }));
                        columns1.push(search.createColumn({ name: 'internalid' }));
                        columns1.push(search.createColumn({ name: 'taxtype' }));
                        columns1.push(search.createColumn({ name: 'rate' }));
                        var TaxGroupSearch = search.create({
                            type: 'taxgroup',
                            filters: filters1,
                            columns: columns1
                        });
                        var TaxGroupSearchResults = TaxGroupSearch.run().getRange(0, 100);
                        var intraFlag = 0;
                        var interFlag = 0;
                        var intraFlagRCM = 0;
                        var interFlagRCM = 0;
                        log.debug("TaxGroupSearchResults", TaxGroupSearchResults)
                        for (var i = 0; i < TaxGroupSearchResults.length; i++) {
                            var taxType = TaxGroupSearchResults[i].getText({
                                name: 'taxtype'
                            });
                            var taxGroupId = TaxGroupSearchResults[i].getValue({
                                name: 'internalid'
                            });
                            if (intraFlag == 0 && (taxType == 'GST')) {
                                intraTaxCode = taxGroupId;
                                intraFlag = 1;
                            }
                            if (interFlag == 0 && (taxType == 'IGST')) {
                                interTaxCode = taxGroupId;
                                interFlag = 1;
                            }
                            if (intraFlagRCM == 0 && (taxType == 'RCM')) {
                                var taxgrpobj = record.load({ type: 'taxgroup', id: taxGroupId, });
                                var taxgrplineitemcount = taxgrpobj.getLineCount({ sublistId: 'taxitem' });
                                var isIGST = 0;
                                for (var j = 0; j < taxgrplineitemcount; j++) {
                                    var taxtype = taxgrpobj.getSublistValue({
                                        sublistId: 'taxitem',
                                        fieldId: 'taxtype',
                                        line: j
                                    });
                                    //log.audit("taxtype",taxtype);
                                    if (taxtype == 'RCM IGST') {
                                        isIGST = 1;
                                        break;
                                    }

                                } // end for (var j = 0; j < taxgrplineitemcount; j++)
                                if (isIGST == 0) {
                                    intraTaxCodeRCM = taxGroupId;
                                    intraFlagRCM = 1;
                                }

                            }
                            if (interFlagRCM == 0 && (taxType == 'RCM')) {
                                var taxgrpobj = record.load({ type: 'taxgroup', id: taxGroupId, });
                                var taxgrplineitemcount = taxgrpobj.getLineCount({ sublistId: 'taxitem' });
                                var isGST = 0;
                                for (var j = 0; j < taxgrplineitemcount; j++) {
                                    var taxtype = taxgrpobj.getSublistValue({
                                        sublistId: 'taxitem',
                                        fieldId: 'taxtype',
                                        line: j
                                    });
                                    //log.audit("taxtype",taxtype);
                                    if (taxtype == 'RCM CGST' || taxtype == 'RCM SGST' || taxtype == 'RCM GST') {
                                        isGST = 1;
                                        break;
                                    }

                                } // end for (var j = 0; j < taxgrplineitemcount; j++)
                                if (isGST == 0) {
                                    interTaxCodeRCM = taxGroupId;
                                    interFlagRCM = 1;
                                }
                            }



                            if (intraFlag == 1 && interFlag == 1 && intraFlagRCM == 1 && interFlagRCM == 1) {
                                break;
                            }
                        } // end for(var i=0;i<TaxGroupSearchResults.length; i++)
                    } // end if(_logValidation(cur_hsn))

                    log.debug("intraTaxCode in afterSubmit", intraTaxCode);
                    log.debug("interTaxCode in afterSubmit", interTaxCode);
                    log.debug("intraTaxCodeRCM in afterSubmit", intraTaxCodeRCM);
                    log.debug("interTaxCodeRCM in afterSubmit", interTaxCodeRCM);

                    if (scriptContext.type == 'edit' || scriptContext.type == 'xedit') {

                        var oldRecord = scriptContext.oldRecord;
                        var old_hsn;
                        var filters = new Array();
                        var columns = new Array();

                        if (recordType == 'expensecategory') {
                            old_hsn = oldRecord.getValue({ fieldId: "custrecord_tss_its_exp_hsncategory" });
                        }
                        else if (recordType == 'account') {
                            old_hsn = oldRecord.getValue({ fieldId: "custrecord_tss_its_act_hsncategory" });
                        }
                        else {
                            old_hsn = oldRecord.getValue({ fieldId: "custitem_tss_its_hsncategory" });

                        }

                        if (old_hsn != cur_hsn || !_logValidation(cur_hsn)) {
                            filters.push(search.createFilter({
                                name: 'isinactive',
                                operator: 'is',
                                values: 'F'
                            }));
                            if (recordType == 'expensecategory') {
                                filters.push(search.createFilter({
                                    name: 'custrecord_tss_its_expense_category',
                                    operator: 'anyOf',
                                    values: recordId
                                }));
                            }
                            else if (recordType == 'account') {
                                filters.push(search.createFilter({
                                    name: 'custrecord_tss_its_expense_account',
                                    operator: 'anyOf',
                                    values: recordId
                                }));
                            }
                            else {
                                filters.push(search.createFilter({
                                    name: 'custrecord_tss_its_item',
                                    operator: 'anyOf',
                                    values: recordId
                                }));
                            }

                            columns.push(search.createColumn({ name: 'internalid' }));
                            var TaxGroup_search = search.create({
                                type: 'customrecord_tss_its_tax_group_deter',
                                filters: filters,
                                columns: columns
                            });
                            var TaxGroup_search_result = TaxGroup_search.run().getRange(0, 100);
                            if (TaxGroup_search_result.length > 0) {
                                var taxGroupDetermId = TaxGroup_search_result[0].getValue({
                                    name: 'internalid'
                                });
                                if (_logValidation(intraTaxCode) && _logValidation(interTaxCode) && _logValidation(intraTaxCodeRCM) && _logValidation(interTaxCodeRCM)) {
                                    var updatedId = record.submitFields({
                                        type: 'customrecord_tss_its_tax_group_deter',
                                        id: taxGroupDetermId,
                                        values: {
                                            'custrecord_tss_its_in_state_tax_group': intraTaxCode,
                                            'custrecord_tss_its_out_state_tax_group': interTaxCode,
                                            'custrecord_tss_its_rcm_in_state_taxgroup': intraTaxCodeRCM,
                                            'custrecord_tss_its_rcm_out_state_taxgrp': interTaxCodeRCM
                                        },
                                        options: {
                                            enableSourcing: false,
                                            ignoreMandatoryFields: true
                                        }
                                    });
                                    log.debug("Tax Group Determination updates Id", updatedId);
                                } // end if(_logValidation(intraTaxCode) && _logValidation(interTaxCode) && _logValidation(intraTaxCodeRCM) && _logValidation(interTaxCodeRCM))
                                else {
                                    var DeletedRecord = record.delete({
                                        type: 'customrecord_tss_its_tax_group_deter',
                                        id: taxGroupDetermId,
                                    });
                                    log.debug("DeletedRecord in afterSubmit", DeletedRecord);
                                }
                            }
                            else {
                                haveTaxGroupDetermination = false;
                            }
                        } // end if (old_hsn != cur_hsn || !_logValidation(cur_hsn))

                    } // end if (scriptContext.type == 'edit')
                    if (_logValidation(intraTaxCode) && _logValidation(interTaxCode) && _logValidation(intraTaxCodeRCM) && _logValidation(interTaxCodeRCM)) {
                        if (scriptContext.type == 'create' || haveTaxGroupDetermination == false) {
                            var newTaxGroupDeterm = record.create({
                                type: 'customrecord_tss_its_tax_group_deter'
                            });
                            newTaxGroupDeterm.setValue({
                                fieldId: 'custrecord_tss_its_in_state_tax_group',
                                value: intraTaxCode
                            });
                            newTaxGroupDeterm.setValue({
                                fieldId: 'custrecord_tss_its_out_state_tax_group',
                                value: interTaxCode
                            });
                            newTaxGroupDeterm.setValue({
                                fieldId: 'custrecord_tss_its_rcm_in_state_taxgroup',
                                value: intraTaxCodeRCM
                            });
                            newTaxGroupDeterm.setValue({
                                fieldId: 'custrecord_tss_its_rcm_out_state_taxgrp',
                                value: interTaxCodeRCM
                            });

                            if (recordType == 'expensecategory') {
                                newTaxGroupDeterm.setValue({
                                    fieldId: 'custrecord_tss_its_expense_category',
                                    value: recordId
                                });
                            }
                            else if (recordType == 'account') {
                                newTaxGroupDeterm.setValue({
                                    fieldId: 'custrecord_tss_its_expense_account',
                                    value: recordId
                                });
                            }
                            else {
                                newTaxGroupDeterm.setValue({
                                    fieldId: 'custrecord_tss_its_item',
                                    value: recordId
                                });
                            }
                            var recordId = newTaxGroupDeterm.save({
                                enableSourcing: true,
                                ignoreMandatoryFields: false
                            });
                            log.debug("Tax Group Determination ID is", recordId);
                        } // end if(scriptContext.type == 'create')
                    } // end if(_logValidation(intraTaxCode) && _logValidation(interTaxCode) && _logValidation(intraTaxCodeRCM) && _logValidation(interTaxCodeRCM))
                } // end if (scriptContext.type == 'edit' || scriptContext.type == 'create')
            } // end try
            catch (e) {
                log.error("Error in afterSubmit", e);
            }
        } // end const afterSubmit = (scriptContext)


        function _logValidation(value) {
            if (value != 'null' && value != null && value != null && value != '' && value != undefined && value != undefined && value != 'undefined' && value != 'undefined' && value != 'NaN' && value != NaN) {
                return true;
            }
            else {
                return false;
            }
        }

        return {
            // beforeLoad,
            // beforeSubmit,
            afterSubmit
        }

    });
