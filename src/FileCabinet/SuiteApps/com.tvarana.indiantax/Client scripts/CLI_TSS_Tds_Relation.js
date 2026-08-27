/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */

/**
 * Script Name               : CLI TSS TDS Relation
 * Script Author             : MNR Krishna
 * Script Type               : Client Script
 * Script Version            : 2.0
 * Script Created date       : 23/06/2023
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
            try {
                if (scriptContext.fieldId == 'custrecord_tss_vedtdstype') {
                    var current_record = scriptContext.currentRecord;
                    var tdsType = current_record.getValue({ fieldId: "custrecord_tss_vedtdstype" });
                    log.debug("tdsType in fieldChanged", tdsType);
                    if (_logValidation(tdsType)) {
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
                        log.debug("Tds_Master_search_result.length in fieldChanged", Tds_Master_search_result.length);
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

                            log.debug("name in search result in fieldChanged", name);
                            //log.debug("empty_vedpan in search result in fieldChanged",empty_vedpan);



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

                    } // end if(_logValidation(tdsType))
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
                } // end if(scriptContext.fieldId == 'custrecord_tss_vedtdstype')

                if (scriptContext.fieldId == 'custrecord_tss_tds_vendorname') {
                    var current_record = scriptContext.currentRecord;
                    var vend = current_record.getValue({ fieldId: "custrecord_tss_tds_vendorname" });
                    log.debug("vend in fieldChanged", vend);
                    if (_logValidation(vend)) {
                        current_record.setValue({
                            fieldId: 'custrecord_tss_tds_entity',
                            value: vend,
                        });
                    } // end if(_logValidation(vend))
                } // end if(scriptContext.fieldId == 'custrecord_tss_tds_vendorname')
            }// end try
            catch (e) {
                log.error("Error in fieldChanged", e);
            }
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
                var vendorId = current_record.getValue({ fieldId: "custrecord_tss_tds_vendorname" });
                var tdsType = current_record.getValue({ fieldId: "custrecord_tss_vedtdstype" });

                if (_logValidation(vendorId)) {
                    var assesse;
                    try {
                        var vnr_Obj = search.lookupFields({
                            type: 'vendor',
                            id: vendorId,
                            columns: ['isperson']
                        });
                        assesse = vnr_Obj.isperson;
                        log.debug("assesse in saveRecord", assesse);
                    }
                    catch (e) {
                        if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {
                            var s_Record_Type = 'vendorbill';
                            var resposeObject = '';
                            resposeObject = https.requestSuitelet({
                                scriptId: "customscript_sut_tss_get_entity_data",
                                deploymentId: "customdeploy_sut_tss_get_entity_data",
                                // external: true,
                                urlParams: {
                                    's_entiry_id': vendorId,
                                    's_record_type': s_Record_Type
                                }
                            });
                            log.debug("resposeObject from suitelet", resposeObject);
                            if (_logValidation(resposeObject)) {
                                var respBody = JSON.parse(resposeObject.body);
                                log.debug("respBody from suitelet", respBody);
                                if (_logValidation(respBody) && respBody.length > 0) {
                                    assesse = respBody[0].assesse;
                                    log.debug("assesse from suitelet", assesse);
                                }
                            } // end if(_logValidation(resposeObject))
                        }
                    } // end catch (e)
                    if (isTrue(assesse)) {
                        var asseesseName = 'Individual';
                        assesse = 1
                    }
                    else {
                        var asseesseName = 'Company';
                        assesse = 2;
                    }

                    var rec_assesse = current_record.getValue({ fieldId: "custrecord_tss_tds_vedassesseecode" });
                    var rec_assesse_name = current_record.getText({ fieldId: "custrecord_tss_tds_vedassesseecode" });
                    if (assesse != rec_assesse) {
                        alert("Assesse code - " + rec_assesse_name + " is not matching with Vendor Assesse code - " + asseesseName + ". Please change it accordingly.");
                        return false;
                    }

                } // end  if(_logValidation(vendorId))

                if (_logValidation(vendorId) && _logValidation(tdsType)) {
                    var filters = new Array();
                    var columns = new Array();
                    filters.push(search.createFilter({
                        name: 'isinactive',
                        operator: 'is',
                        values: 'F'
                    }));
                    filters.push(search.createFilter({
                        name: 'custrecord_tss_tds_vendorname',
                        operator: 'anyof',
                        values: vendorId
                    }));
                    filters.push(search.createFilter({
                        name: 'custrecord_tss_vedtdstype',
                        operator: 'is',
                        values: tdsType
                    }));
                    columns.push(search.createColumn({ name: 'internalid' }));
                    var TDSrelation_search = search.create({
                        type: 'customrecord_tss_tdsrelation',
                        filters: filters,
                        columns: columns
                    });
                    var TDSrelation_search_result = TDSrelation_search.run().getRange(0, 100);
                    var isValid = true;
                    if (TDSrelation_search_result.length > 0) {
                        var rec_id = current_record.id;
                        for (var i = 0; i < TDSrelation_search_result.length; i++) {
                            internalid = TDSrelation_search_result[i].getValue({ name: 'internalid' });
                            if (_logValidation(rec_id)) {
                                if (rec_id != internalid) {
                                    isValid = false;
                                }
                            }
                            else {
                                if (_logValidation(internalid)) {
                                    isValid = false;
                                }
                            }
                        }


                    }
                    //log.debug("TDSrelation_search_result.length",TDSrelation_search_result.length);
                    //log.debug("isValid",isValid);
                    if (isValid == false) {
                        alert("The TDS Type and TDS Vendor Name combination is already exists. Please change it accordingly.");
                        return false;
                    }
                } // end if(_logValidation(vendorId) && _logValidation(tdsType))


                return true;
            }// end try
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

        function isTrue(value) {
            if (value == 'T' || value == true || value == 'true') {
                return true;
            }
            else {
                return false;
            }
        }


        return {
            //    pageInit: pageInit,
            fieldChanged: fieldChanged,
            //    postSourcing: postSourcing,
            //    sublistChanged: sublistChanged,
            //    lineInit: lineInit,
            //    validateField: validateField,
            //    validateLine: validateLine,
            //    validateInsert: validateInsert,
            //    validateDelete: validateDelete,
            saveRecord: saveRecord
        };

    });
