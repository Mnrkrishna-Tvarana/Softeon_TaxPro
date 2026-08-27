/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
/**
 * Script Name               : CLI TSS Set GST Codes
 * Script Author             : MNR Krishna
 * Script Type               : Client Script
 * Script Version            : 2.0
 * Script Created date       : 15/06/2023
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  
 */

define(['N/search', 'N/record', 'N/https', 'N/runtime'],
    /**
     * @param{search} search
     */
    function (search, record, https, runtime) {

        //  Initializing  Global Variables

        var g_subisidiary = new Array;
        var g_sezCode;   //i_vatCode in TSS
        var g_taxcode;
        var g_taxcodeIGST;
        var rec_Location;
        var global_Type;
        var vnr_Flag = ' ';
        var Cust_gst_flag = ' ';
        var g_VNR_InState = ' ';
        var g_VNR_OutState = ' ';
        var g_VNR_RCM_applicable;
        var g_useAccExpGSTAuto = false;

        var formSetFlag = true;
        var customFormsObjSb = {
            'purchaseorder': 201, 'vendorprepayment': 203, 'vendorbill': 193, 'vendorreturnauthorization': '', 'vendorcredit': 194, 'billpayment': '',
            'salesorder': 202, 'invoice': 199, 'returnauthorization': '', 'creditmemo': 197, 'customerpayments': '', 'cashsale': 195, 'customerrefund': 176, 'customerdeposit': 204
        }
        var customFormsObjProd = {
            'purchaseorder': 201, 'vendorprepayment': 203, 'vendorbill': 193, 'vendorreturnauthorization': '', 'vendorcredit': 194, 'billpayment': '',
            'salesorder': 202, 'invoice': 199, 'returnauthorization': '', 'creditmemo': 197, 'customerpayments': '', 'cashsale': 195, 'customerrefund': 176, 'customerdeposit': 204
        }

        var sezLiableDefault = true;
        var inelibleITCdefault = true;



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
            try {
                global_Type = scriptContext.mode;
                // Loading the Indian Tax Global Parameter record
                var GlobalRecId = SearchGlobalParameter();
                //log.debug("GlobalRecId in pageInit",GlobalRecId);

                var current_record = scriptContext.currentRecord;
                var rec_subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                var Flag = 0;
                Flag = inArray(rec_subsidiary, g_subisidiary);
                if (Flag == 1) {
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
                        var rec_form = current_record.getValue({ fieldId: "customform" });
                        if ((rec_form != customFormsObj[current_record.type]) && (_logValidation(customFormsObj[current_record.type]))) {
                            current_record.setValue({ fieldId: "customform", value: customFormsObj[current_record.type] });
                        }
                    }

                    current_record.setValue({
                        fieldId: 'custbody_tss_isvalidsubsidiary',
                        value: true,
                    });
                    var rec_type = current_record.type;
                    var checkType = ''
                    if (rec_type == 'check') {
                        var ent_Type = current_record.getValue({ fieldId: "custbody_tss_payye_type" });
                        if (ent_Type == 'Vendor' || ent_Type == 'vendor') {
                            checkType = 'purchase'
                            current_record.getField("custbody_tss_export_gst").isDisabled = true;
                        }
                        else if (ent_Type == 'Customer' || ent_Type == 'customer') {
                            checkType = 'sales'
                            current_record.getField("custbody_tss_import_gst").isDisabled = true;
                        }
                        else {
                            current_record.getField("custbody_tss_import_gst").isDisabled = true;
                            current_record.getField("custbody_tss_export_gst").isDisabled = true;
                        }
                    }
                    // Getting GST Liable value from Vendor record
                    if (rec_type == 'purchaseorder' || rec_type == 'vendorbill' || rec_type == 'vendorcredit' || checkType == 'purchase') {
                        current_record.getField("custbody_tss_place_of_service").isMandatory = true;
                        var rec_vendor = current_record.getValue({ fieldId: "entity" });
                        log.debug("Vendor Id in pageInit", rec_vendor);
                        if (_logValidation(rec_vendor)) {
                            try {
                                vnr_Flag = search.lookupFields({
                                    type: 'vendor',
                                    id: rec_vendor,
                                    columns: ['custentity_tss_gst_liable']
                                });
                                vnr_Flag = vnr_Flag.custentity_tss_gst_liable;
                                log.debug("vnr_Flag in pageInit", vnr_Flag);

                            } // end try
                            catch (e) {
                                var recType = rec_type;
                                if (rec_type == 'check') {
                                    recType = 'purchaseorder'
                                }
                                var resposeObject = '';
                                resposeObject = https.requestSuitelet({
                                    scriptId: "customscript_sut_tss_get_entity_data",
                                    deploymentId: "customdeploy1",
                                    // external: true,
                                    urlParams: {
                                        's_entiry_id': rec_vendor,
                                        's_record_type': recType
                                    }
                                });
                                log.debug("resposeObject from suitelet", resposeObject);
                                if (_logValidation(resposeObject)) {
                                    var respBody = JSON.parse(resposeObject.body);
                                    log.debug("respBody from suitelet", respBody);
                                    if (_logValidation(respBody) && respBody.length > 0) {
                                        vnr_Flag = respBody[0].vnr_Flag;
                                        log.debug("vnr_Flag from suitelet", vnr_Flag);
                                    }
                                } // end if(_logValidation(resposeObject))

                            }// end catch(e)

                        } // end if(_logValidation(rec_customer))

                    } // end if(rec_type == 'purchaseorder' || rec_type == 'vendorbill' || rec_type == 'vendorcredit')

                    /*
                    // Getting GST Liable value from Customer record
                    else if (rec_type == 'salesorder' || rec_type == 'invoice' || rec_type == 'creditmemo' || rec_type == 'cashsale' || rec_type == 'estimate'|| checkType == 'sales') {
                        var rec_customer = current_record.getValue({ fieldId: "entity" });
                        log.debug("Customer Id in pageInit", rec_customer);
                        if (_logValidation(rec_customer)) {
                            try {
                                Cust_gst_flag = search.lookupFields({
                                    type: 'customer',
                                    id: rec_customer,
                                    columns: ['custentity_tss_gst_liable']
                                });
                                Cust_gst_flag = Cust_gst_flag.custentity_tss_gst_liable;
                                log.debug("Cust_gst_flag in pageInit", Cust_gst_flag);

                            }// end try
                            catch (e) {
                                var recType = rec_type;
                                if(rec_type == 'check'){
                                    recType = 'salesorder'
                                }
                                var resposeObject = '';
                                resposeObject = https.requestSuitelet({
                                    scriptId: "customscript_sut_tss_get_entity_data",
                                    deploymentId: "customdeploy1",
                                    // external: true,
                                    urlParams: {
                                        's_entiry_id': rec_customer,
                                        's_record_type': recType
                                    }
                                });
                                log.debug("resposeObject from suitelet", resposeObject);
                                if (_logValidation(resposeObject)) {
                                    var respBody = JSON.parse(resposeObject.body);
                                    log.debug("respBody from suitelet", respBody);
                                    if (_logValidation(respBody) && respBody.length > 0) {
                                        Cust_gst_flag = respBody[0].cust_Flag;
                                        log.debug("Cust_gst_flag from suitelet", Cust_gst_flag);
                                    }
                                } // end if(_logValidation(resposeObject))
                            } // end catch(e)

                        } // end if(_logValidation(rec_customer))

                    } // end else if(rec_type == 'salesorder' || rec_type == 'invoice' || rec_type == 'creditmemo' || rec_type == 'cashsale')

                    */
                    // Set the Place of Supply and GSTIN from Bill To / Vendor Select address field
                    var i_Entity = current_record.getValue({ fieldId: "entity" });
                    log.debug("i_Entity in pageInit", i_Entity);
                    var i_Place_Of_Supply = current_record.getValue({ fieldId: "custbody_tss_placeof_supply" });
                    log.debug("i_Place_Of_Supply in pageInit", i_Place_Of_Supply);
                    var i_Place_Of_Service = current_record.getValue({ fieldId: "custbody_tss_place_of_service" });
                    log.debug("i_Place_Of_Service in pageInit", i_Place_Of_Service);
                    var i_gstin_uid = current_record.getValue({ fieldId: "custbody_tss_transaction_gstin_uid" });
                    var s_Ship_To = '';
                    if (rec_type == 'check') {
                        s_Ship_To = current_record.getValue({ fieldId: "payeeaddresslist" });
                    }
                    else {
                        s_Ship_To = current_record.getValue({ fieldId: "billaddresslist" });
                    }
                    log.debug("s_Ship_To in pageInit", s_Ship_To);

                    if (_logValidation(i_Entity) && _logValidation(s_Ship_To)) {

                        var resposeObject = https.requestSuitelet({
                            scriptId: "customscript_sut_tss_getstate_fromaddres",
                            deploymentId: "customdeploy1",
                            // external: true,
                            urlParams: {
                                's_entiry_id': i_Entity,
                                's_record_type': rec_type,
                                's_Ship_To': s_Ship_To
                            }
                        });
                        log.debug("resposeObject from suitelet", resposeObject);
                        if (_logValidation(resposeObject)) {
                            var respBody = JSON.parse(resposeObject.body);
                            log.debug("respBody from suitelet", respBody);
                            if (_logValidation(respBody) && respBody.length > 0) {
                                var resp_state = respBody[0].state;
                                log.debug("resp_state from SUT_TSS_GetState_fromAddress", resp_state);
                                var resp_gstin = respBody[0].gstinuid;
                                log.debug("resp_gstin from SUT_TSS_GetState_fromAddress", resp_gstin);

                                if (rec_type == 'purchaseorder' || rec_type == 'vendorbill' || rec_type == 'vendorcredit' || checkType == 'purchase') {
                                    // if (i_Place_Of_Service != resp_state) {
                                    if (!_logValidation(i_Place_Of_Service) && _logValidation(resp_state)) {
                                        current_record.setValue({
                                            fieldId: 'custbody_tss_place_of_service',
                                            value: resp_state,
                                        });
                                    } // end if(i_Place_Of_Supply != resp_state)
                                }
                                else {
                                    // if (i_Place_Of_Supply != resp_state) {
                                    if (!_logValidation(i_Place_Of_Supply) && _logValidation(resp_state)) {
                                        current_record.setValue({
                                            fieldId: 'custbody_tss_placeof_supply',
                                            value: resp_state,
                                        });
                                    } // end if(i_Place_Of_Supply != resp_state)
                                }
                                if (!_logValidation(i_gstin_uid)) {
                                    current_record.setValue({
                                        fieldId: 'custbody_tss_transaction_gstin_uid',
                                        value: resp_gstin,
                                    });
                                }
                            }
                        } // end if(_logValidation(resposeObject))




                    } // end if(_logValidation(i_Entity) && _logValidation(s_Ship_To))

                    // else if (!_logValidation(s_Ship_To) && _logValidation(i_Entity)) {

                    //     current_record.setValue({
                    //         fieldId: 'custbody_tss_placeof_supply',
                    //         value: '',
                    //     });
                    //     current_record.setValue({
                    //         fieldId: 'custbody_tss_transaction_gstin_uid',
                    //         value: '',
                    //     });
                    // } // end else if(!_logValidation(s_Ship_To) && _logValidation(i_Entity))

                    // Validations for Export in Sales transactions
                    if (rec_type == 'salesorder' || rec_type == 'invoice' || rec_type == 'creditmemo' || rec_type == 'cashsale' || rec_type == 'estimate' || checkType == 'sales') {
                        current_record.getField("custbody_tss_placeof_supply").isMandatory = true;
                        var isExport = current_record.getValue({
                            fieldId: 'custbody_tss_export_gst',
                        });
                        if (isTrue(isExport)) {
                            var exportReason = current_record.getField("custbody_tss_gst_payment_under")
                            exportReason.isMandatory = true;
                            exportReason.isDisabled = false;
                        }
                        var hasJE = current_record.getValue({
                            fieldId: 'custbody_tss_lut_journal_invoice',
                        });
                        if (_logValidation(hasJE)) {
                            current_record.getField("custbody_tss_export_gst").isDisabled = true;
                            current_record.getField("custbody_tss_gst_payment_under").isDisabled = true;
                        }
                    }


                } // end if (Flag == 1)


            }
            catch (e) {
                log.error("Error in pageInit..", e);
            }

        } // end function pageInit(scriptContext)

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

                if (scriptContext.fieldId == 'subsidiary' || scriptContext.fieldId == 'entity') {
                    var current_record = scriptContext.currentRecord;
                    var s_Record_Type = current_record.type;
                    var rec_subsid = current_record.getValue({ fieldId: "subsidiary" });
                    var Flag = 0;
                    Flag = inArray(rec_subsid, g_subisidiary);
                    if (Flag == parseInt(1)) {
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
                            var rec_form = current_record.getValue({ fieldId: "customform" });
                            if ((rec_form != customFormsObj[current_record.type]) && (_logValidation(customFormsObj[current_record.type]))) {
                                current_record.setValue({ fieldId: "customform", value: customFormsObj[current_record.type] });
                            }
                        }

                        current_record.setValue({
                            fieldId: 'custbody_tss_isvalidsubsidiary',
                            value: true,
                        });
                        if (s_Record_Type == 'check') {
                            var ent_Type = current_record.getValue({ fieldId: "custbody_tss_payye_type" });
                            if (ent_Type == 'Customer' || ent_Type == 'customer') {
                                current_record.getField("custbody_tss_import_gst").isDisabled = true;
                            }
                            else if (ent_Type == 'Vendor' || ent_Type == 'vendor') {
                                current_record.getField("custbody_tss_export_gst").isDisabled = true;
                            }
                            else {
                                current_record.getField("custbody_tss_import_gst").isDisabled = true;
                                current_record.getField("custbody_tss_export_gst").isDisabled = true;
                            }
                        }
                        if (s_Record_Type == 'salesorder' || s_Record_Type == 'invoice' || s_Record_Type == 'creditmemo' || s_Record_Type == 'cashsale' || s_Record_Type == 'estimate' || (s_Record_Type == 'check' && ent_Type == 'Customer')) {
                            current_record.getField("custbody_tss_placeof_supply").isMandatory = true;
                        }
                        if (s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || (s_Record_Type == 'check' && ent_Type == 'Vendor')) {
                            current_record.getField("custbody_tss_place_of_service").isMandatory = true;
                        }
                    }
                    else if (Flag != parseInt(1)) {
                        current_record.getField("custbody_tss_placeof_supply").isMandatory = false;
                        current_record.getField("custbody_tss_place_of_service").isMandatory = false;
                        current_record.setValue({
                            fieldId: 'custbody_tss_isvalidsubsidiary',
                            value: false,
                        });
                    } // end else if(Flag != parseInt(1))
                }
                //var Flag = current_record.getValue({fieldId:"custbody_tss_isvalidsubsidiary"});

                /*
                // If Subsidiary Changed
                if (scriptContext.fieldId == 'subsidiary' || scriptContext.fieldId == 'entity') {
                    try {
                        var current_record = scriptContext.currentRecord;
                        var s_Record_Type = current_record.type;
                        var rec_subsid = current_record.getValue({ fieldId: "subsidiary" });
                        var Flag = 0;
                        Flag = inArray(rec_subsid, g_subisidiary);
                        if (Flag == parseInt(1)) {
                            current_record.getField("custbody_tss_placeof_supply").isMandatory = true;
                            current_record.setValue({
                                fieldId: 'custbody_tss_isvalidsubsidiary',
                                value: true,
                            });
                            var checkType = ''
                            if (s_Record_Type == 'check') {
                                var ent_Type = current_record.getValue({ fieldId: "custbody_tss_payye_type" });
                                if (ent_Type == 'Vendor' || ent_Type == 'vendor') {
                                    checkType = 'purchase'
                                }
                                else if (ent_Type == 'Customer' || ent_Type == 'customer') {
                                    checkType = 'sales'
                                }
                            }
                            alert(checkType +' - '+ent_Type)
                            if (s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || checkType == 'purchase') {
                                var rec_vendor = current_record.getValue({ fieldId: "entity" });
                                log.debug("vendId in Subsidiary FieldChanged", rec_vendor)
                                if (_logValidation(rec_vendor)) {
                                    try {
                                        vnr_Flag = search.lookupFields({
                                            type: 'vendor',
                                            id: rec_vendor,
                                            columns: ['custentity_tss_gst_liable']
                                        });
                                        vnr_Flag = vnr_Flag.custentity_tss_gst_liable;
                                        log.debug("vnr_Flag in subsidiary fieldChanged", vnr_Flag);
                                    }
                                    catch (e) {
                                        if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {
                                            var recType = s_Record_Type;
                                            if (s_Record_Type == 'check') {
                                                recType = 'purchaseorder'
                                            }
                                            var resposeObject = '';
                                            resposeObject = https.requestSuitelet({
                                                scriptId: "customscript_sut_tss_get_entity_data",
                                                deploymentId: "customdeploy1",
                                                // external: true,
                                                urlParams: {
                                                    's_entiry_id': rec_vendor,
                                                    's_record_type': recType
                                                }
                                            });
                                            log.debug("resposeObject from suitelet", resposeObject);
                                            if (_logValidation(resposeObject)) {
                                                var respBody = JSON.parse(resposeObject.body);
                                                log.debug("respBody from suitelet", respBody);
                                                if (_logValidation(respBody) && respBody.length > 0) {
                                                    vnr_Flag = respBody[0].vnr_Flag;
                                                    log.debug("vnr_Flag from suitelet", vnr_Flag);
                                                }
                                            } // end if(_logValidation(resposeObject))
                                        }
                                    }
                                }// end if(_logValidation(rec_vendor))
                            } // end if(s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit')

                            else if (s_Record_Type == 'salesorder' || s_Record_Type == 'invoice' || s_Record_Type == 'creditmemo' || s_Record_Type == 'cashsale' || s_Record_Type == 'estimate') {
                                var rec_cust = current_record.getValue({ fieldId: "entity" });
                                if (_logValidation(rec_cust)) {
                                    try {
                                        Cust_gst_flag = search.lookupFields({
                                            type: 'customer',
                                            id: rec_cust,
                                            columns: ['custentity_tss_gst_liable']
                                        });
                                        Cust_gst_flag = Cust_gst_flag.custentity_tss_gst_liable;
                                        log.debug("Cust_gst_flag in pageInit", Cust_gst_flag);

                                    }// end try
                                    catch (e) {
                                        var recType = s_Record_Type;
                                        if (s_Record_Type == 'check') {
                                            recType = 'salesorder'
                                        }
                                        var resposeObject = '';
                                        resposeObject = https.requestSuitelet({
                                            scriptId: "customscript_sut_tss_get_entity_data",
                                            deploymentId: "customdeploy1",
                                            // external: true,
                                            urlParams: {
                                                's_entiry_id': rec_cust,
                                                's_record_type': recType
                                            }
                                        });
                                        log.debug("resposeObject from suitelet", resposeObject);
                                        if (_logValidation(resposeObject)) {
                                            var respBody = JSON.parse(resposeObject.body);
                                            log.debug("respBody from suitelet", respBody);
                                            if (_logValidation(respBody) && respBody.length > 0) {
                                                Cust_gst_flag = respBody[0].cust_Flag;
                                                log.debug("Cust_gst_flag from suitelet", Cust_gst_flag);
                                            }
                                        } // end if(_logValidation(resposeObject))
                                    } // end catch(e)
                                }
                            } // end else if(s_Record_Type == 'salesorder' || s_Record_Type == 'invoice' || s_Record_Type == 'creditmemo'  || s_Record_Type == 'cashsale')


                        } // end if(Flag == parseInt(1))

                        else if (Flag != parseInt(1)) {
                            current_record.getField("custbody_tss_placeof_supply").isMandatory = false;
                            current_record.setValue({
                                fieldId: 'custbody_tss_isvalidsubsidiary',
                                value: false,
                            });
                        } // end else if(Flag != parseInt(1))
                    }// end try
                    catch (err) {
                        log.error("Error in Subsidiary fieldChanged", err);
                    }// end catch(err)

                } // end if(scriptContext.fieldId == 'subsidiary'  || scriptContext.fieldId == 'entity')
                */
                if (scriptContext.fieldId == 'custcol_tss_rcm_apply') {
                    var current_record = scriptContext.currentRecord;
                    var s_Record_Type = current_record.type;
                    var rec_subsid = current_record.getValue({ fieldId: "subsidiary" });
                    var Flag = 0;
                    Flag = inArray(rec_subsid, g_subisidiary);
                    if (Flag == parseInt(1)) {
                        var checkType = ''
                        if (s_Record_Type == 'check') {
                            var ent_Type = current_record.getValue({ fieldId: "custbody_tss_payye_type" });
                            if (ent_Type == 'Vendor' || ent_Type == 'vendor') {
                                checkType = 'purchase'
                            }
                            else if (ent_Type == 'Customer' || ent_Type == 'customer') {
                                checkType = 'sales'
                            }
                        }
                        if (s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || checkType == 'purchase') {



                            var ApplyRCM = current_record.getCurrentSublistValue({
                                sublistId: scriptContext.sublistId,
                                fieldId: 'custcol_tss_rcm_apply',
                            });
                            var ApplySEZ = current_record.getCurrentSublistValue({
                                sublistId: scriptContext.sublistId,
                                fieldId: 'custcol_tss_sez',
                            });
                            var sezLiable = current_record.getCurrentSublistValue({
                                sublistId: scriptContext.sublistId,
                                fieldId: 'custcol_tss_sez_tax_liable',
                            });
                            if (!isTrue(ApplySEZ) || (isTrue(ApplySEZ) && isTrue(sezLiable))) {
                                var sublistObj = current_record.getSublist({ sublistId: scriptContext.sublistId });

                                if (isTrue(ApplyRCM)) {
                                    sublistObj.getColumn({
                                        fieldId: 'custcol_tss_rcm_tax_code',
                                    }).isDisabled = false;

                                    sublistObj.getColumn({
                                        fieldId: 'custcol_tss_rcm_tax_code',
                                    }).isMandatory = true;
                                    var TaxAmt = current_record.getCurrentSublistValue({
                                        sublistId: scriptContext.sublistId,
                                        fieldId: 'tax1amt',
                                    });
                                    // if (parseInt(TaxAmt) != 0) {
                                    var TaxCode = current_record.getCurrentSublistValue({
                                        sublistId: scriptContext.sublistId,
                                        fieldId: 'taxcode',
                                    });
                                    var TaxType;
                                    try {
                                        var TaxObj = search.lookupFields({
                                            type: 'salestaxitem',
                                            id: TaxCode,
                                            columns: ['taxtype']
                                        });
                                        if (Object.keys(TaxObj).length > 0) {
                                        }
                                        else {
                                            var TaxObj = search.lookupFields({
                                                type: 'taxgroup',
                                                id: TaxCode,
                                                columns: ['taxtype']
                                            });
                                        }

                                        TaxType = TaxObj.taxtype[0].text;
                                        log.debug("TaxType", TaxType);
                                    }
                                    catch (e) {
                                        log.debug("Error in taxcode lookup", e);
                                        if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {
                                            var resposeObject = '';
                                            resposeObject = https.requestSuitelet({
                                                scriptId: "customscript_sut_tss_tax_group_data",
                                                deploymentId: "customdeploy1",
                                                // external: true,
                                                urlParams: {
                                                    'taxcode': TaxCode,
                                                    'operationType': 'typeoftax'
                                                }
                                            });
                                            log.debug("resposeObject from SUT TSS Tax Group Data", resposeObject);
                                            if (_logValidation(resposeObject)) {
                                                TaxType = resposeObject.body;
                                            }
                                        }
                                    }
                                    if (TaxType == 'IGST') {
                                        current_record.setCurrentSublistValue({
                                            sublistId: scriptContext.sublistId,
                                            fieldId: "taxcode",
                                            value: g_VNR_OutState
                                        });
                                    }
                                    else {
                                        current_record.setCurrentSublistValue({
                                            sublistId: scriptContext.sublistId,
                                            fieldId: "taxcode",
                                            value: g_VNR_InState
                                        });
                                    }
                                    // }
                                }
                                else {
                                    current_record.setCurrentSublistValue({
                                        sublistId: scriptContext.sublistId,
                                        fieldId: "custcol_tss_rcm_tax_code",
                                        value: ''
                                    });
                                    current_record.setCurrentSublistValue({
                                        sublistId: scriptContext.sublistId,
                                        fieldId: "custcol_tss_rcm_rate",
                                        value: '',
                                    });

                                    sublistObj.getColumn({
                                        fieldId: 'custcol_tss_rcm_tax_code',
                                    }).isDisabled = true;
                                    sublistObj.getColumn({
                                        fieldId: 'custcol_tss_rcm_tax_code',
                                    }).isMandatory = false;

                                    var LineLocField = sublistObj.getColumn({
                                        fieldId: 'location'
                                    });
                                    //log.audit("LineLocField in Item postSourcing",LineLocField);
                                    var rec_LocationLine = current_record.getCurrentSublistValue({
                                        sublistId: scriptContext.sublistId,
                                        fieldId: 'location',
                                    });
                                    if (_logValidation(LineLocField) && _logValidation(rec_LocationLine)) {
                                        current_record.setCurrentSublistValue({
                                            sublistId: scriptContext.sublistId,
                                            fieldId: 'location',
                                            value: rec_LocationLine
                                        });
                                    }
                                }
                            } // end if(!isTrue(ApplySEZ))
                            else if (isTrue(ApplyRCM)) {
                                current_record.setCurrentSublistValue({
                                    sublistId: scriptContext.sublistId,
                                    fieldId: 'custcol_tss_rcm_apply',
                                    value: false,
                                    ignoreFieldChange: true
                                });
                                alert("Current line has aplied SEZ. You can't apply RCM for current line.")
                            }


                        } // end  if(s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || checkType == 'purchase')
                    } // if (Flag == parseInt(1))
                } // end if (scriptContext.fieldId == 'custcol_tss_rcm_apply')

                if (scriptContext.fieldId == 'custcol_tss_rcm_tax_code') {
                    var current_record = scriptContext.currentRecord;
                    var RCM_code = current_record.getCurrentSublistValue({
                        sublistId: scriptContext.sublistId,
                        fieldId: 'custcol_tss_rcm_tax_code',
                    });
                    if (_logValidation(RCM_code)) {
                        // var Rcm_Rate = getTaxGroupRate(RCM_code);
                        var RcmObj = getTaxGroupRateType(RCM_code);
                        var Rcm_Rate = RcmObj.taxRate;
                        var Rcm_Type = RcmObj.taxType;
                        if (Rcm_Type == 'RCM' && _logValidation(Rcm_Rate)) {
                            current_record.setCurrentSublistValue({
                                sublistId: scriptContext.sublistId,
                                fieldId: "custcol_tss_rcm_rate",
                                value: Rcm_Rate,
                            });
                        }
                        else {
                            alert('Please select valid RCM Tax Group in RCM Tax Code field');
                            current_record.setCurrentSublistValue({
                                sublistId: scriptContext.sublistId,
                                fieldId: "custcol_tss_rcm_rate",
                                value: '',
                            });
                            current_record.setCurrentSublistValue({
                                sublistId: scriptContext.sublistId,
                                fieldId: "custcol_tss_rcm_tax_code",
                                value: '',
                                ignoreFieldChange: true
                            });
                        }
                    }
                    else {
                        current_record.setCurrentSublistValue({
                            sublistId: scriptContext.sublistId,
                            fieldId: "custcol_tss_rcm_rate",
                            value: '',
                        });
                    }
                } // end if (scriptContext.fieldId == 'custcol_tss_rcm_tax_code')


                if (scriptContext.fieldId == 'item' || (!g_useAccExpGSTAuto && scriptContext.fieldId == 'category') || (g_useAccExpGSTAuto && scriptContext.fieldId == 'account' && scriptContext.sublistId == 'expense')) {
                    try {
                        var current_record = scriptContext.currentRecord;
                        var s_Record_Type = current_record.type;
                        var checkType;
                        if (s_Record_Type == 'check') {
                            var ent_Type = current_record.getValue({ fieldId: "custbody_tss_payye_type" });
                            if (ent_Type == 'Vendor' || ent_Type == 'vendor') {
                                checkType = 'purchase'
                            }
                        }
                        if (s_Record_Type == 'vendorcredit' || s_Record_Type == 'vendorbill' || s_Record_Type == 'purchaseorder' || checkType == 'purchase') {
                            var ApplyRCM = current_record.getCurrentSublistValue({
                                sublistId: scriptContext.sublistId,
                                fieldId: 'custcol_tss_rcm_apply',
                            });
                            if (isTrue(ApplyRCM)) {
                                current_record.setCurrentSublistValue({
                                    sublistId: scriptContext.sublistId,
                                    fieldId: "custcol_tss_rcm_apply",
                                    value: false,
                                });
                            } // end if(isTrue(ApplyRCM))
                        }


                    } // end try
                    catch (e) {
                        log.error("Error in Item fieldChanged", e);
                    }
                } // end if (scriptContext.fieldId == 'item' || scriptContext.fieldId == 'category' || (g_useAccExpGSTAuto && scriptContext.fieldId == 'account' && scriptContext.sublistId == 'expense'))

                if (scriptContext.fieldId == 'custbody_tss_transaction_gstin_uid') {
                    var current_record = scriptContext.currentRecord;
                    var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                    if (isTrue(Flag)) {
                        var s_Record_Type = current_record.type;
                        var gstin = current_record.getValue({ fieldId: "custbody_tss_transaction_gstin_uid" });
                        if (_logValidation(gstin)) {
                            var POS = current_record.getValue({ fieldId: "custbody_tss_placeof_supply" });
                            // var b_Check = new RegExp("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$");
                            var b_Check = new RegExp("^[0-9]{2}([A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]|[0-9]{2}[A-Z]{3}[0-9]{5}UN[0-9A-Z])$"); // This is used for both GSTIN and UIN Validation
                            if (!b_Check.test(gstin)) {
                                var isAttemptingUIN = gstin.toUpperCase().substring(12, 14) === 'UN';
                                if (isAttemptingUIN) {
                                    alert(
                                        'Please enter a valid UIN Number.\n\n' +
                                        '--- UIN Format (15 Characters) ---\n' +
                                        ' * First 2 digits     : State Code (0-9)\n' +
                                        ' * Next 2 digits      : Year of Issue (0-9)\n' +
                                        ' * Next 3 characters  : Organisation Code (A to Z)\n' +
                                        ' * Next 5 digits      : Serial Number (0 to 9)\n' +
                                        ' * Next 2 characters  : Always UN\n' +
                                        ' * Last 1 character   : A to Z or 0 to 9\n'
                                    );
                                } else {
                                    alert(
                                        'Please enter a valid GSTIN Number.\n\n' +
                                        '--- GSTIN Format (15 Characters) ---\n' +
                                        ' * First 2 digits     : State Code (0-9)\n' +
                                        ' * Next 5 characters  : A to Z\n' +
                                        ' * Next 4 digits      : 0 to 9\n' +
                                        ' * Next 1 character   : A to Z\n' +
                                        ' * Next 1 character   : A to Z or 1 to 9\n' +
                                        ' * Next 1 character   : Always Z\n' +
                                        ' * Last 1 character   : A to Z or 0 to 9\n'
                                    );
                                }
                                // alert('Please enter The valid GSTIN No ,\n * GSTIN Number Length 15 Character \n * First Two Numeric 0 to 9 \n * Five Character from A to Z \n * Four Numeric 0 to 9 \n * One Character from A to Z \n *One Alpha Numeric A to Z or 0 to 9 \n * One Character Z \n * One Alpha Numeric A to Z or 0 to 9');
                                current_record.setValue({
                                    fieldId: 'custbody_tss_transaction_gstin_uid',
                                    value: '',
                                    ignoreFieldChange: true
                                });
                            }
                            var checkType;
                            if (s_Record_Type == 'check') {
                                var ent_Type = current_record.getValue({ fieldId: "custbody_tss_payye_type" });
                                if (ent_Type == 'Vendor' || ent_Type == 'vendor') {
                                    checkType = 'purchase'
                                }
                            }
                            if (s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || checkType == 'purchase') {
                                var rec_vendor1 = current_record.getValue({ fieldId: "entity" });
                                var pan;
                                try {
                                    if (_logValidation(rec_vendor1)) {
                                        var vendorObj = search.lookupFields({
                                            type: 'vendor',
                                            id: rec_vendor1,
                                            columns: ['custentitytss_pan']
                                        });
                                        //log.debug("vendorObj", vendorObj)
                                        pan = vendorObj.custentitytss_pan;
                                    }
                                }
                                catch (e) {
                                    var recType = s_Record_Type;
                                    if (s_Record_Type == 'check') {
                                        recType = 'purchaseorder'
                                    }
                                    var resposeObject = '';
                                    resposeObject = https.requestSuitelet({
                                        scriptId: "customscript_sut_tss_get_entity_data",
                                        deploymentId: "customdeploy1",
                                        // external: true,
                                        urlParams: {
                                            's_entiry_id': rec_vendor1,
                                            's_record_type': recType
                                        }
                                    });
                                    //log.debug("resposeObject from suitelet", resposeObject);
                                    if (_logValidation(resposeObject)) {

                                        var respBody = JSON.parse(resposeObject.body);
                                        log.debug("respBody from suitelet in GSTIN fieldChanged", respBody);
                                        if (_logValidation(respBody) && respBody.length > 0) {
                                            pan = respBody[0].Pan;
                                            log.debug("pan from suitelet in GSTIN fieldChanged", pan);
                                        }
                                    }
                                }// end catch(e)
                                if (_logValidation(pan)) {
                                    var i_Pan_subString = gstin.substring(2, 12);
                                    if (i_Pan_subString != pan) {
                                        alert('please check Vendor PAN is not matched with GSTIN. Enter correct GSTIN');
                                        current_record.setValue({
                                            fieldId: 'custbody_tss_transaction_gstin_uid',
                                            value: '',
                                            ignoreFieldChange: true
                                        });
                                    }
                                }
                            }
                            var POSname = 'Place of Supply';
                            if (s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || checkType == 'purchase') {
                                POS = current_record.getValue({ fieldId: "custbody_tss_place_of_service" });
                                POSname = 'Place of Service';
                            }
                            else {
                                POSname = 'Place of Supply';
                            }
                            if (_logValidation(POS)) {
                                var stateObj = search.lookupFields({
                                    type: 'customrecord_tss_gst_state_master',
                                    id: POS,
                                    columns: ['custrecord_tss_tin']
                                });
                                var stateCode = stateObj.custrecord_tss_tin;
                                if (stateCode != gstin.slice(0, 2)) {
                                    current_record.setValue({
                                        fieldId: 'custbody_tss_transaction_gstin_uid',
                                        value: '',
                                        ignoreFieldChange: true
                                    });
                                    alert("GSTIN/UID is not matched with " + POSname + ", So please Enter Valid GSTIN accordingly");
                                }
                            }
                        }

                    } // end if(isTrue(Flag))
                } // end if (scriptContext.fieldId == 'custbody_tss_transaction_gstin_uid')



                // Place of Supply field changed code
                if (scriptContext.fieldId == 'custbody_tss_placeof_supply' || scriptContext.fieldId == 'custbody_tss_place_of_service') {   //&& global_Type != 'copy'
                    try {
                        var current_record = scriptContext.currentRecord;
                        var s_Record_Type = current_record.type;
                        var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                        if ((s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'cashsale' || s_Record_Type == 'invoice' || s_Record_Type == 'vendorbill' || s_Record_Type == 'creditmemo' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'check') && isTrue(Flag)) {
                            // if (scriptContext.fieldId == 'custbody_tss_placeof_supply') {
                            var checkType;
                            if (s_Record_Type == 'check') {
                                var ent_Type = current_record.getValue({ fieldId: "custbody_tss_payye_type" });
                                if (ent_Type == 'Vendor' || ent_Type == 'vendor') {
                                    checkType = 'purchase'
                                }
                            }
                            if (s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || checkType == 'purchase') {
                                var POS = current_record.getValue({ fieldId: "custbody_tss_place_of_service" });
                            }
                            else {
                                var POS = current_record.getValue({ fieldId: "custbody_tss_placeof_supply" });
                            }
                            var gstin = current_record.getValue({ fieldId: "custbody_tss_transaction_gstin_uid" });
                            if (_logValidation(gstin) && _logValidation(POS)) {
                                //log.audit("gstin 2 chars",gstin.slice(0,2));
                                //log.audit("gstin 2 chars",gstin.substr(0, 2));
                                var stateObj = search.lookupFields({
                                    type: 'customrecord_tss_gst_state_master',
                                    id: POS,
                                    columns: ['custrecord_tss_tin']
                                });
                                var stateCode = stateObj.custrecord_tss_tin;
                                if (stateCode != gstin.slice(0, 2)) {
                                    current_record.setValue({
                                        fieldId: 'custbody_tss_transaction_gstin_uid',
                                        value: '',
                                        ignoreFieldChange: true
                                    });
                                    alert("GSTIN/UID is not matched with Place of Supply, So please Enter Valid GSTIN accordingly");
                                }
                            }
                            // }
                            var Item_Count = current_record.getLineCount({ sublistId: 'item' });
                            var sublistObj = current_record.getSublist({ sublistId: 'item' });
                            var LineLocField = sublistObj.getColumn({
                                fieldId: 'location'
                            });
                            var Expense_Count = 0;
                            if (s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'check') {
                                Expense_Count = current_record.getLineCount({ sublistId: 'expense' });
                                var sublistObjExp = current_record.getSublist({ sublistId: 'expense' });
                                var LineLocFieldExp = sublistObjExp.getColumn({
                                    fieldId: 'location'
                                });
                            }
                            if (Item_Count > 0 && Expense_Count <= 0) {
                                if (LineLocField) {
                                    alert('Kindly change the Location on each Line Item or Clear All Line and Enter Item again');
                                }
                                else {
                                    alert('Kindly Clear All Item Lines and Re-Enter Items again');
                                }
                            }
                            else if (Expense_Count > 0 && Item_Count <= 0) {
                                if (LineLocFieldExp) {
                                    alert('Kindly change the Location on each Expense Line or Clear All Line and Enter Expense again');
                                }
                                else {
                                    alert('Kindly Clear All Expense Lines and Re-Enter Expenses again');
                                }
                            }
                            else if (Expense_Count > 0 && Item_Count > 0) {
                                if (LineLocField && LineLocFieldExp) {
                                    alert('Kindly change the Location on each Expense Line and Item Line or Clear All Line and Enter Expense and Item again');
                                }
                                else if (LineLocField) {
                                    alert('Kindly change the Location on each Line Item or Clear All Line and Enter Item again');
                                }
                                else if (LineLocFieldExp) {
                                    alert('Kindly change the Location on each Expense Line or Clear All Line and Enter Expense again');
                                }
                                else {
                                    alert('Kindly Clear All Item & Expense Lines and Re-Enter Expenses and Items again');
                                }
                            }
                        }
                    } // end try
                    catch (err) {
                        log.error("Error in Place Of Supply fieldChanged", err);
                    } // end catch(err)
                } // end if(scriptContext.fieldId == 'custbody_tss_placeof_supply' && global_Type != 'copy')

                // code for Body level Location changed
                if ((scriptContext.sublistId != 'item' && scriptContext.fieldId == 'location') && (scriptContext.sublistId != 'expense' && scriptContext.fieldId == 'location')) {   //&& (global_Type != 'copy')

                    try {
                        var current_record = scriptContext.currentRecord;
                        var s_Record_Type = current_record.type;
                        var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                        if ((s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'cashsale' || s_Record_Type == 'invoice' || s_Record_Type == 'vendorbill' || s_Record_Type == 'creditmemo' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'check') && isTrue(Flag)) {
                            var rec_loc = current_record.getValue({ fieldId: "location" });
                            var Item_Count = current_record.getLineCount({ sublistId: 'item' });
                            var Expense_Count = 0;
                            if (s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'check') {
                                Expense_Count = current_record.getLineCount({ sublistId: 'expense' });
                            }
                            if (Item_Count > 0 && Expense_Count <= 0) {
                                alert('Kindly change the Location on each Line Item or Clear All Line and Enter Item again');
                            }
                            else if (Expense_Count > 0 && Item_Count <= 0) {
                                alert('Kindly change the Location on each Expense Line or Clear All Line and Enter Expense again');
                            }
                            else if (Item_Count > 0 && Expense_Count > 0) {
                                alert('Kindly change the Location on each Expense Line and Item Line or Clear All Line and Enter Expense and Item again');
                            }

                            //Getting GST State from Location to set POS in transaction
                            if (_logValidation(rec_loc)) {
                                var Location_State = ''
                                try {
                                    var loc_obj = search.lookupFields({
                                        type: 'location',
                                        id: rec_loc,
                                        columns: ['custrecord_tss_its_location_statename', 'custrecord_tss_gst_type_location', 'custrecord_tss_gstin']
                                    });
                                    if (loc_obj.custrecord_tss_its_location_statename.length > 0) {
                                        Location_State = loc_obj.custrecord_tss_its_location_statename[0].value;
                                        log.debug("Location_State in location fieldChanged", Location_State);
                                    }
                                }
                                catch (e) {
                                    if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {
                                        var resposeObject = https.requestSuitelet({
                                            scriptId: "customscript_sut_tss_get_location_data",
                                            deploymentId: "customdeploy1",
                                            // external: true,
                                            urlParams: {
                                                's_Location': rec_loc
                                            }
                                        });
                                        //log.debug("resposeObject of SUT_TSS_Get_Location_Data",resposeObject);
                                        var respBody = JSON.parse(resposeObject.body);
                                        if (_logValidation(respBody) && respBody.length > 0) {
                                            Location_State = respBody[0].Location_State;
                                            log.debug("Location_State from SUT_TSS_Get_Location_Data", Location_State);
                                        }
                                    }

                                }// end catch(e)

                                if (_logValidation(Location_State)) {
                                    if (s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit') {
                                        current_record.setValue({
                                            fieldId: 'custbody_tss_placeof_supply',
                                            value: Location_State,
                                            ignoreFieldChange: true
                                        });
                                    }
                                    if (s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'cashsale' || s_Record_Type == 'invoice' || s_Record_Type == 'creditmemo') {
                                        current_record.setValue({
                                            fieldId: 'custbody_tss_place_of_service',
                                            value: Location_State,
                                            ignoreFieldChange: true
                                        });
                                    }
                                } // end if(_logValidation(Location_State))

                            } // end  if(_logValidation(rec_loc))
                        } // end if((s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'cashsale' || s_Record_Type == 'invoice' || s_Record_Type == 'vendorbill' || s_Record_Type == 'creditmemo' || s_Record_Type == 'vendorcredit') && isTrue(Flag))
                    } // end try
                    catch (err) {
                        log.error("Error in Location fieldChanged", err);
                    }

                } // end if((scriptContext.sublistId != 'item' && scriptContext.fieldId == 'location') && (scriptContext.sublistId != 'expense' && scriptContext.fieldId == 'location') && (global_Type != 'copy'))


                if (scriptContext.fieldId == 'custbody_tss_import_gst') {     //&& global_Type != 'copy'
                    try {
                        var current_record = scriptContext.currentRecord;
                        var s_Record_Type = current_record.type;
                        var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                        if ((s_Record_Type == 'vendorbill' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'check') && isTrue(Flag)) {
                            var b_Import = current_record.getValue({ fieldId: "custbody_tss_import_gst" });
                            if (isTrue(b_Import)) {
                                var Item_Count = current_record.getLineCount({ sublistId: 'item' });
                                var Expense_Count = current_record.getLineCount({ sublistId: 'expense' });

                                if (Item_Count > 0 && Expense_Count <= 0) {
                                    alert('Kindly Ensure that all Item Lines should have IGST Tax Code as Import Field is changed');
                                }
                                else if (Expense_Count > 0 && Item_Count <= 0) {
                                    alert('Kindly Ensure that all Expense Lines should have IGST Tax Code as Import Field is changed');
                                }
                                else if (Item_Count > 0 && Expense_Count > 0) {
                                    alert('Kindly Ensure that all Expense Line and Item Line should have IGST Tax Code as Import Field is changed');
                                }
                            } // end if(isTrue(b_Import))
                        } // end if((s_Record_Type == 'vendorbill' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorcredit') && isTrue(Flag))
                    }
                    catch (e) {
                        log.error("Error in Import FieldChanged", e);
                    }
                } // end if(scriptContext.fieldId == 'custbody_tss_import_gst' && global_Type != 'copy')



                if (scriptContext.fieldId == 'custbody_tss_export_gst') {        // && global_Type != 'copy'
                    try {
                        var current_record = scriptContext.currentRecord;
                        var s_Record_Type = current_record.type;
                        var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                        var checkType;
                        if (s_Record_Type == 'check') {
                            var ent_Type = current_record.getValue({ fieldId: "custbody_tss_payye_type" });
                            if (ent_Type == 'Customer' || ent_Type == 'customer') {
                                checkType = 'sale'
                            }
                        }
                        if ((s_Record_Type == 'invoice' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'cashsale' || s_Record_Type == 'creditmemo' || checkType == 'sale') && isTrue(Flag)) {
                            var b_Export = current_record.getValue({ fieldId: "custbody_tss_export_gst" });
                            var exportReason = current_record.getField("custbody_tss_gst_payment_under")
                            if (isTrue(b_Export)) {
                                exportReason.isMandatory = true;
                                exportReason.isDisabled = false;
                                var i_Export_Reason = current_record.getValue({ fieldId: "custbody_tss_gst_payment_under" });
                                if (_logValidation(i_Export_Reason) && i_Export_Reason == 1) {
                                    var Item_Count = current_record.getLineCount({ sublistId: 'item' });
                                    if (Item_Count > 0) {
                                        alert('Kindly Ensure that all Item Lines should have IGST Tax Code as Export Field is changed');
                                    }
                                } // end if(_logValidation(i_Export_Reason) && i_Export_Reason == 1)
                                else if (_logValidation(i_Export_Reason) && i_Export_Reason == 2) {
                                    var Item_Count = current_record.getLineCount({ sublistId: 'item' });
                                    if (Item_Count > 0) {
                                        alert('Kindly Ensure that all Item Line should have Zero IGST Tax Code as Export Field is changed');
                                    }
                                }
                            } // end if(isTrue(b_Export))
                            else {
                                exportReason.isMandatory = false;
                                exportReason.isDisabled = true;
                                current_record.setValue({ fieldId: "custbody_tss_gst_payment_under", value: '' });
                            }
                            var Item_Count = current_record.getLineCount({ sublistId: 'item' });
                            if (Item_Count > 0) {
                                alert("Kindly Clear All Item Lines and Re-Enter Items again")
                            }
                        } // end if ((s_Record_Type == 'invoice' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'cashsale' || s_Record_Type == 'creditmemo') && isTrue(Flag))
                    }
                    catch (e) {
                        log.error("Error in Export fieldChanged", e);
                    }
                } // end if(scriptContext.fieldId == 'custbody_tss_export_gst' && global_Type != 'copy')




                if (scriptContext.fieldId == 'custbody_tss_gst_payment_under') {           //&& global_Type != 'copy'
                    try {
                        var current_record = scriptContext.currentRecord;
                        var s_Record_Type = current_record.type;
                        var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                        var checkType;
                        if (s_Record_Type == 'check') {
                            var ent_Type = current_record.getValue({ fieldId: "custbody_tss_payye_type" });
                            if (ent_Type == 'Customer' || ent_Type == 'customer') {
                                checkType = 'sale'
                            }
                        }
                        if ((s_Record_Type == 'invoice' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'cashsale' || s_Record_Type == 'creditmemo' || checkType == 'sale') && isTrue(Flag)) {
                            var b_Export = current_record.getValue({ fieldId: "custbody_tss_export_gst" });
                            if (isTrue(b_Export)) {
                                var i_Export_Reason = current_record.getValue({ fieldId: "custbody_tss_gst_payment_under" });
                                if (_logValidation(i_Export_Reason) && i_Export_Reason == 1) {
                                    var Item_Count = current_record.getLineCount({ sublistId: 'item' });

                                    if (Item_Count > 0) {
                                        alert('Kindly Ensure that all Item Lines should have IGST Tax Code as Payment of GST Under Export Field is changed');
                                    }
                                } // end if(_logValidation(i_Export_Reason) && i_Export_Reason == 1)

                                if (_logValidation(i_Export_Reason) && i_Export_Reason == 2) {
                                    var Item_Count = current_record.getLineCount({ sublistId: 'item' });

                                    if (Item_Count > 0) {
                                        alert('Kindly Ensure that all Item Line should have Zero IGST Tax Code as Payment of GST Under Export Field is changed');
                                    }
                                }// end if(_logValidation(i_Export_Reason) && i_Export_Reason == 2)

                            } // end if(isTrue(b_Export))
                        } // end if ((s_Record_Type == 'invoice' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'cashsale' || s_Record_Type == 'creditmemo') && isTrue(Flag))
                    }
                    catch (e) {
                        log.error("Error in Payment of GST Under Export fieldChanged", e);
                    }
                } // end if(scriptContext.fieldId == 'custbody_tss_gst_payment_under' && global_Type != 'copy')


                if (scriptContext.fieldId == 'billaddresslist' || scriptContext.fieldId == 'payeeaddresslist') {
                    try {
                        var current_record = scriptContext.currentRecord;
                        var s_Record_Type = current_record.type;
                        var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                        if (s_Record_Type == 'purchaseorder' && !isTrue(Flag)) {
                            var Sub = current_record.getValue({ fieldId: "subsidiary" });
                            // log.debug("Entered in bill To fieldChanged", Sub + '_' + Flag)
                            Flag = inArray(Sub, g_subisidiary);
                        }
                        if (isTrue(Flag)) {
                            var rec_POS = current_record.getValue({ fieldId: "custbody_tss_placeof_supply" });
                            var rec_entity = current_record.getValue({ fieldId: "entity" });
                            var recType = s_Record_Type;
                            log.debug("s_Record_Type in billaddr fieldchanged", s_Record_Type)
                            if (s_Record_Type == 'check') {
                                var rec_Ship_To = current_record.getValue({ fieldId: "payeeaddresslist" });
                                var ent_Type = current_record.getValue({ fieldId: "custbody_tss_payye_type" });
                                // log.debug("ent_Type in billaddr fieldchanged", ent_Type)
                                if (_logValidation(ent_Type)) {

                                }
                                else {
                                    try {
                                        var a_Filters = new Array();
                                        var a_Columns = new Array();
                                        a_Filters.push(search.createFilter({
                                            name: 'internalid',
                                            operator: 'anyof',
                                            values: rec_entity
                                        }));
                                        a_Columns.push(search.createColumn({ name: 'type' }));
                                        var entTypesearch = search.create({
                                            type: 'entity',
                                            filters: a_Filters,
                                            columns: a_Columns
                                        });
                                        var entTypesearch_result = entTypesearch.run().getRange(0, 100);
                                        // log.debug("taxGroupsearch_result in location fieldChanged", entTypesearch_result);
                                        ent_Type = entTypesearch_result[0].getText({ name: 'type' });
                                    }
                                    catch (e) {
                                        var resposeObject1 = https.requestSuitelet({
                                            scriptId: "customscript_sut_tss_get_entity_data",
                                            deploymentId: "customdeploy1",
                                            // external: true,
                                            urlParams: {
                                                's_entiry_id': rec_entity,
                                                's_getEntType': true
                                            }
                                        });
                                        // log.debug("rec_entity in resp sut",rec_entity)
                                        // log.debug("resposeObject1 in resp sut",resposeObject1)
                                        if (_logValidation(resposeObject1)) {
                                            var respBody = JSON.parse(resposeObject1.body);
                                            // log.debug("respBody from suitelet entity type", respBody);
                                            if (_logValidation(respBody) && respBody.length > 0) {
                                                var ent_Type = respBody[0].ent_Type;
                                            }
                                        }
                                    }
                                }
                                if (ent_Type == 'Vendor' || ent_Type == 'vendor') {
                                    recType = 'purchaseorder'
                                }
                                else if (ent_Type == 'Customer' || ent_Type == 'customer') {
                                    recType = 'salesorder'
                                }
                            }
                            else {
                                var rec_Ship_To = current_record.getValue({ fieldId: "billaddresslist" });
                            }

                            // log.debug("rec_entity in billaddr fieldchanged", rec_entity)
                            // log.debug("rec_Ship_To in billaddr fieldchanged", rec_Ship_To)
                            if (_logValidation(rec_entity) && _logValidation(rec_Ship_To)) {
                                var resposeObject = https.requestSuitelet({
                                    scriptId: "customscript_sut_tss_getstate_fromaddres",
                                    deploymentId: "customdeploy1",
                                    // external: true,
                                    urlParams: {
                                        's_entiry_id': rec_entity,
                                        's_record_type': recType,
                                        's_Ship_To': rec_Ship_To
                                    }
                                });
                                // log.debug("resposeObject from suitelet ship/bill to", resposeObject);
                                if (_logValidation(resposeObject)) {
                                    var respBody = JSON.parse(resposeObject.body);
                                    // log.debug("respBody from suitelet ship/bill to", respBody);
                                    if (_logValidation(respBody) && respBody.length > 0) {
                                        var resp_state = respBody[0].state;
                                        log.debug("resp_state from SUT_TSS_GetState_fromAddress in Ship To / Bill To fieldchanged", resp_state);
                                        var resp_gstin = respBody[0].gstinuid;
                                        log.debug("resp_gstin from SUT_TSS_GetState_fromAddress in Ship To / Bill To fieldchanged", resp_gstin);
                                        if (recType == 'purchaseorder' || recType == 'vendorbill' || recType == 'vendorcredit' || recType == 'check') {
                                            rec_POS = current_record.getValue({ fieldId: "custbody_tss_place_of_service" });
                                            if (rec_POS != resp_state) {
                                                current_record.setValue({
                                                    fieldId: 'custbody_tss_place_of_service',
                                                    value: resp_state,
                                                });
                                            }
                                        }
                                        else {
                                            if (rec_POS != resp_state) {
                                                current_record.setValue({
                                                    fieldId: 'custbody_tss_placeof_supply',
                                                    value: resp_state,
                                                });
                                            } // end if(i_Place_Of_Supply != resp_state)
                                        }
                                        current_record.setValue({
                                            fieldId: 'custbody_tss_transaction_gstin_uid',
                                            value: resp_gstin,
                                        });
                                    }
                                } // end if(_logValidation(resposeObject))
                            } // END if(_logValidation(rec_entity) && _logValidation(rec_Ship_To))

                            else if (!_logValidation(rec_Ship_To) && _logValidation(rec_entity)) {

                                current_record.setValue({
                                    fieldId: 'custbody_tss_placeof_supply',
                                    value: '',
                                });
                                current_record.setValue({
                                    fieldId: 'custbody_tss_transaction_gstin_uid',
                                    value: '',
                                });
                            } // end else if(!_logValidation(rec_Ship_To) && _logValidation(rec_entity))
                        } // end if(isTrue(Flag))
                    }
                    catch (e) {
                        log.error("Error in Ship To / Bill To fieldChanged", e);
                    }
                } // END if(scriptContext.fieldId == 'billaddresslist' && (s_Record_Type == 'cashsale' || s_Record_Type == 'invoice' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'creditmemo' || s_Record_Type == 'vendorbill' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorcredit'))







                if (scriptContext.fieldId == 'location' && scriptContext.sublistId == 'item') {
                    try {
                        var current_record = scriptContext.currentRecord;

                        var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                        var Item = current_record.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: "item"
                        });
                        var Item_name = current_record.getCurrentSublistText({
                            sublistId: 'item',
                            fieldId: "item"
                        });
                        var rcm_applicable_item = '';
                        if (_logValidation(Item) && isTrue(Flag)) {
                            var rec_location = current_record.getValue({ fieldId: 'location' });
                            var s_Record_Type = current_record.type;
                            var g_recType;
                            if (s_Record_Type == 'check') {
                                var ent_Type = current_record.getValue({ fieldId: "custbody_tss_payye_type" });
                                if (ent_Type == 'Vendor' || ent_Type == 'vendor') {
                                    g_recType = 'purchase'
                                }
                                else if (ent_Type == 'Customer' || ent_Type == 'customer') {
                                    g_recType = 'sales'
                                }
                            }
                            else if (s_Record_Type == 'invoice' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'cashsale' || s_Record_Type == 'creditmemo') {
                                g_recType = 'sales';
                            }
                            else if (s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit') {
                                g_recType = 'purchase';
                            }

                            var i_Location_State;
                            var i_Location_Type;
                            var i_State;
                            var i_Location = current_record.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'location',
                            });
                            if (!_logValidation(i_Location)) {
                                i_Location = rec_location
                            }


                            var L_Item_Type = current_record.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'itemtype',
                            });
                            log.debug("L_Item_Type in location fieldChanged", L_Item_Type);
                            var s_item_rec_type = '';
                            switch (L_Item_Type) { // Compare item type to its record type counterpart 
                                case 'InvtPart':
                                    s_item_rec_type = 'inventoryitem';
                                    break;
                                case 'NonInvtPart':
                                    s_item_rec_type = 'noninventoryitem';
                                    break;
                                case 'Service':
                                    s_item_rec_type = 'serviceitem';
                                    break;
                                case 'Assembly':
                                    s_item_rec_type = 'assemblyitem';//serializedassemblyitem
                                    break;
                                case 'Kit':
                                    s_item_rec_type = 'kititem';
                                    break;
                                case 'OthCharge':
                                    s_item_rec_type = 'otherchargeitem';
                                    break;
                                case 'GiftCert':
                                    s_item_rec_type = 'giftcertificateitem';
                                    break;
                                case 'Group':
                                    s_item_rec_type = 'itemgroup';
                                    break;
                                case 'Payment':
                                    s_item_rec_type = 'paymentitem';
                                    break;
                                default:
                            } // end switch (L_Item_Type)

                            try {
                                var rcm_applicable_itemObj = search.lookupFields({
                                    type: s_item_rec_type,
                                    id: Item,
                                    columns: ['custitem_tss_item_rcm_applicable']
                                });
                                if (_logValidation(rcm_applicable_itemObj)) {
                                    rcm_applicable_item = rcm_applicable_itemObj.custitem_tss_item_rcm_applicable;
                                    log.debug("rcm_applicable_item in fieldChanged", rcm_applicable_item);
                                }
                            }
                            catch (e) {
                                if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {

                                    var resposeObject = '';
                                    resposeObject = https.requestSuitelet({
                                        scriptId: "customscript_sut_tss_exp_item_data",
                                        deploymentId: "customdeploy1",
                                        // external: true,
                                        urlParams: {
                                            's_item': Item,
                                            's_itemType': s_item_rec_type
                                        }
                                    });
                                    log.debug("resposeObject from SUT_TSS_Exp_Item_Data", resposeObject);
                                    if (_logValidation(resposeObject)) {
                                        var respBody = JSON.parse(resposeObject.body);
                                        log.debug("respBody from SUT_TSS_Exp_Item_Data", respBody);
                                        if (_logValidation(respBody) && respBody.length > 0) {
                                            rcm_applicable_item = respBody[0].s_rcm;
                                            log.debug("rcm_applicable_item from SUT_TSS_Exp_Item_Data", rcm_applicable_item);

                                        }
                                    }

                                }
                            } // end catch(e)



                            var i_State = current_record.getValue({ fieldId: "custbody_tss_placeof_supply" });
                            var rec_PlaceOfService = current_record.getValue({ fieldId: "custbody_tss_place_of_service" });
                            // if (_logValidation(rec_PlaceOfService)) {
                            //     i_Location_State = rec_PlaceOfService;
                            // }
                            if (_logValidation(i_Location)) {
                                try {
                                    var loc_obj = search.lookupFields({
                                        type: 'location',
                                        id: i_Location,
                                        columns: ['custrecord_tss_its_location_statename', 'custrecord_tss_gst_type_location', 'custrecord_tss_gstin']
                                    });
                                    if (loc_obj.custrecord_tss_its_location_statename.length > 0) {
                                        i_Location_State = loc_obj.custrecord_tss_its_location_statename[0].value;
                                        log.debug("i_Location_State in location fieldChanged", i_Location_State);
                                    }
                                    if (loc_obj.custrecord_tss_gst_type_location.length > 0) {
                                        i_Location_Type = loc_obj.custrecord_tss_gst_type_location[0].text;
                                        log.debug("i_Location_Type in location fieldChanged", i_Location_Type);
                                    }
                                    current_record.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: "custcol_tss_loc_gstin",
                                        value: loc_obj.custrecord_tss_gstin
                                    });


                                }
                                catch (e) {
                                    if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {
                                        var resposeObject = https.requestSuitelet({
                                            scriptId: "customscript_sut_tss_get_location_data",
                                            deploymentId: "customdeploy1",
                                            // external: true,
                                            urlParams: {
                                                's_Location': i_Location
                                            }
                                        });
                                        //log.debug("resposeObject of SUT_TSS_Get_Location_Data",resposeObject);
                                        var respBody = JSON.parse(resposeObject.body);
                                        if (_logValidation(respBody) && respBody.length > 0) {
                                            i_Location_State = respBody[0].i_Location_State;
                                            log.debug("i_Location_State from SUT_TSS_Get_Location_Data", i_Location_State);
                                            i_Location_Type = respBody[0].i_Location_Type;
                                            log.debug("i_Location_Type in SUT_TSS_Get_Location_Data", i_Location_Type);
                                            current_record.setCurrentSublistValue({
                                                sublistId: 'item',
                                                fieldId: "custcol_tss_loc_gstin",
                                                value: respBody[0].GstIn
                                            });
                                        }
                                    }

                                }// end catch(e)


                                // if (!_logValidation(i_Location_State)) {
                                //     i_Location_State = rec_PlaceOfService;
                                // } // end if(_logValidation(i_Location_State))

                            } // end  if(_logValidation(i_Location))
                            else {
                                // alert("Location should be entred");
                                current_record.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: "custcol_tss_loc_gstin",
                                    value: ''
                                });
                            }
                            if (!_logValidation(i_Location_State)) {
                                i_Location_State = g_recType == 'sales' ? rec_PlaceOfService : g_recType == "purchase" ? i_State : '';
                            }

                            //log.debug("i_Location_State1 in location fieldChanged", i_Location_State);
                            var iStateToCompare = g_recType == 'sales' ? i_State : g_recType == "purchase" ? rec_PlaceOfService : '';
                            var iStateToCompareType = g_recType == 'sales' ? 'Place of Supply' : g_recType == "purchase" ? 'Place of Service' : '';

                            //Here we have search on Tax Group Determination
                            if (_logValidation(i_Location_State) && _logValidation(iStateToCompare)) {
                                var a_Filters = new Array();
                                var a_Columns = new Array();
                                a_Filters.push(search.createFilter({
                                    name: 'isinactive',
                                    operator: 'is',
                                    values: 'F'
                                }));
                                a_Filters.push(search.createFilter({
                                    name: 'custrecord_tss_its_item',
                                    operator: 'anyof',
                                    values: Item
                                }));
                                a_Filters.push(search.createFilter({
                                    name: 'custrecord_tss_its_expense_category',
                                    operator: 'anyof',
                                    values: '@NONE@'
                                }));
                                a_Columns.push(search.createColumn({ name: 'custrecord_tss_its_in_state_tax_group' }));
                                a_Columns.push(search.createColumn({ name: 'custrecord_tss_its_out_state_tax_group' }));
                                a_Columns.push(search.createColumn({ name: 'custrecord_tss_its_rcm_in_state_taxgroup' }));
                                a_Columns.push(search.createColumn({ name: 'custrecord_tss_its_rcm_out_state_taxgrp' }));
                                var taxGroupsearch = search.create({
                                    type: 'customrecord_tss_its_tax_group_deter',
                                    filters: a_Filters,
                                    columns: a_Columns
                                });
                                var taxGroupsearch_result = taxGroupsearch.run().getRange(0, 100);
                                log.debug("taxGroupsearch_result in location fieldChanged", taxGroupsearch_result)

                                // Removing Apply SEZ & RCM
                                var LItemRcm = current_record.getCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_tss_rcm_apply',
                                });
                                var LItemSez = current_record.getCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_tss_sez',
                                });
                                var LItemSezLiable = current_record.getCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_tss_sez_tax_liable',
                                });
                                if (isTrue(LItemSezLiable)) {
                                    current_record.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'custcol_tss_sez_tax_liable',
                                        value: false
                                    });
                                }
                                if (isTrue(LItemSez)) {
                                    current_record.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'custcol_tss_sez',
                                        value: false
                                    });
                                }
                                if (isTrue(LItemRcm)) {
                                    current_record.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'custcol_tss_rcm_apply',
                                        value: false
                                    });
                                }
                                var b_ImportL = current_record.getValue({ fieldId: "custbody_tss_import_gst" });
                                var b_ExportL = current_record.getValue({ fieldId: "custbody_tss_export_gst" });

                                if (i_Location_State == iStateToCompare && i_Location_Type != 'SEZ' && !isTrue(b_ImportL) && !isTrue(b_ExportL)) {
                                    if (taxGroupsearch_result.length > 0) {
                                        var i_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_in_state_tax_group' });
                                        log.debug("i_Tax_Group GST in location fieldChanged", i_Tax_Group)
                                        if (_logValidation(i_Tax_Group)) {
                                            if (isTrue(g_VNR_RCM_applicable) && (!isTrue(vnr_Flag) || isTrue(rcm_applicable_item)) && g_recType == "purchase") {
                                                var rcm_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_rcm_in_state_taxgroup' });
                                                var rcm_Tax_Group_rate = getTaxGroupRate(rcm_Tax_Group);
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: "taxcode",
                                                    value: g_VNR_InState,
                                                });
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: "custcol_tss_rcm_tax_code",
                                                    value: rcm_Tax_Group,
                                                });
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: "custcol_tss_rcm_apply",
                                                    value: true
                                                });
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: "custcol_tss_rcm_rate",
                                                    value: parseFloat(rcm_Tax_Group_rate)
                                                });
                                            }
                                            else {
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: "taxcode",
                                                    value: i_Tax_Group,

                                                });
                                            }
                                        } // end if(_logValidation(i_Tax_Group))

                                    } // end if(taxGroupsearch_result.length > 0)
                                    else {
                                        //alert("You are not created Tax Group Determination record for Current line Expense Category - " + Item_name);
                                        current_record.setCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId: "taxcode",
                                            value: g_taxcode,
                                        });

                                    }

                                } // end if(i_Location_State == iStateToCompare && i_Location_Type != 'SEZ')
                                else {
                                    if (taxGroupsearch_result.length > 0) {
                                        var i_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_out_state_tax_group' });
                                        log.debug("i_Tax_Group IGST in location fieldChanged", i_Tax_Group)
                                        if (_logValidation(i_Tax_Group)) {

                                            if (g_recType == "purchase" && i_Location_Type == 'SEZ') {
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: "taxcode",
                                                    value: g_sezCode,

                                                });
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: "custcol_tss_sez",
                                                    value: true,
                                                });
                                                if (sezLiableDefault) {
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "custcol_tss_sez_tax_liable",
                                                        value: true,
                                                    });
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "taxcode",
                                                        value: i_Tax_Group,
                                                    });
                                                }

                                            }
                                            else if (isTrue(g_VNR_RCM_applicable) && (!isTrue(vnr_Flag) || isTrue(rcm_applicable_item)) && g_recType == "purchase") {
                                                // alert(vnr_Flag)
                                                var rcm_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_rcm_out_state_taxgrp' });
                                                var rcm_Tax_Group_rate = getTaxGroupRate(rcm_Tax_Group);
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: "taxcode",
                                                    value: g_VNR_OutState,
                                                });
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: "custcol_tss_rcm_tax_code",
                                                    value: rcm_Tax_Group,
                                                });
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: "custcol_tss_rcm_apply",
                                                    value: true
                                                });
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: "custcol_tss_rcm_rate",
                                                    value: parseFloat(rcm_Tax_Group_rate)
                                                });

                                            }
                                            else {
                                                if (g_recType == 'sales' && isTrue(b_ExportL)) {
                                                    var i_Export_ReasonL = current_record.getValue({ fieldId: "custbody_tss_gst_payment_under" });
                                                    if (i_Export_ReasonL == 1) {
                                                        current_record.setCurrentSublistValue({
                                                            sublistId: 'item',
                                                            fieldId: "taxcode",
                                                            value: g_taxcodeIGST,
                                                        });
                                                        var lut_Tax_Group_rate = getTaxGroupRate(i_Tax_Group);
                                                        current_record.setCurrentSublistValue({
                                                            sublistId: 'item',
                                                            fieldId: "custcol_tss_lut_taxcode",
                                                            value: i_Tax_Group,
                                                        });
                                                        current_record.setCurrentSublistValue({
                                                            sublistId: 'item',
                                                            fieldId: "custcol_tss_lut_taxrate",
                                                            value: parseFloat(lut_Tax_Group_rate)
                                                        });

                                                    }
                                                    else if (i_Export_ReasonL == 2) {
                                                        current_record.setCurrentSublistValue({
                                                            sublistId: 'item',
                                                            fieldId: "taxcode",
                                                            value: g_taxcodeIGST,

                                                        });
                                                    }
                                                }
                                                else {
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "taxcode",
                                                        value: i_Tax_Group,
                                                    });
                                                }

                                            }

                                        } // end if(_logValidation(i_Tax_Group))
                                    } // end if (taxGroupsearch_result.length > 0)
                                    else {
                                        if (g_recType == "purchase" && i_Location_Type == 'SEZ') {
                                            current_record.setCurrentSublistValue({
                                                sublistId: 'item',
                                                fieldId: "taxcode",
                                                value: g_sezCode,

                                            });
                                            current_record.setCurrentSublistValue({
                                                sublistId: 'item',
                                                fieldId: "custcol_tss_sez",
                                                value: true,
                                            });
                                            if (sezLiableDefault) {
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: "custcol_tss_sez_tax_liable",
                                                    value: true,
                                                });
                                            }

                                        }
                                        else {
                                            //alert("You are not created Tax Group Determination record for Current line Expense Category - " + Item_name);
                                            current_record.setCurrentSublistValue({
                                                sublistId: 'item',
                                                fieldId: "taxcode",
                                                value: g_taxcodeIGST,
                                            });


                                        }

                                    }
                                } // end else
                            } // end if(_logValidation(i_Location_State) && _logValidation(iStateToCompare))
                            else if (!iStateToCompare) {
                                alert("Please Enter " + iStateToCompareType + ". Re-Enter the location");
                                current_record.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: "location",
                                    value: '',
                                    ignoreFieldChange: true
                                });
                            }



                        } // end if(_logValidation(Item) && isTrue(Flag))
                    }
                    catch (e) {
                        log.eror("Error in Location in Item Sublist fieldChanged", e);
                    }

                }// end if(scriptContext.fieldId == 'location' && scriptContext.sublistId == 'item')


                if (scriptContext.fieldId == 'location' && scriptContext.sublistId == 'expense') {
                    try {
                        var current_record = scriptContext.currentRecord;
                        var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                        var L_Account = current_record.getCurrentSublistValue({
                            sublistId: 'expense',
                            fieldId: "account"
                        });
                        var L_Category = current_record.getCurrentSublistValue({
                            sublistId: 'expense',
                            fieldId: "category"
                        });
                        var L_Category_Name = current_record.getCurrentSublistText({
                            sublistId: 'expense',
                            fieldId: "category"
                        });
                        var rcm_Applicable_Expense = '';
                        if (_logValidation(L_Account) && (!g_useAccExpGSTAuto && _logValidation(L_Category)) && isTrue(Flag)) {

                            var i_State;
                            var i_Location_State;
                            var i_Location_Type;

                            try {
                                if (g_useAccExpGSTAuto) {
                                    var expenseObj = search.lookupFields({
                                        type: 'account',
                                        id: L_Account,
                                        columns: ['custrecord_tss_act_rcm']
                                    });
                                    if (_logValidation(expenseObj)) {
                                        rcm_Applicable_Expense = expenseObj.custrecord_tss_act_rcm;
                                        log.debug("rcm_Applicable_Expense in fieldChanged aactbased", rcm_Applicable_Expense);

                                    }
                                }
                                else {
                                    var expenseObj = search.lookupFields({
                                        type: 'expensecategory',
                                        id: L_Category,
                                        columns: ['custrecord_tss_rcm']
                                    });
                                    if (_logValidation(expenseObj)) {
                                        rcm_Applicable_Expense = expenseObj.custrecord_tss_rcm;
                                        log.debug("rcm_Applicable_Expense in fieldChanged", rcm_Applicable_Expense);

                                    }
                                }

                            }
                            catch (e) {

                                if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {

                                    var resposeObject = '';
                                    if (g_useAccExpGSTAuto) {
                                        resposeObject = https.requestSuitelet({
                                            scriptId: "customscript_sut_tss_exp_item_data",
                                            deploymentId: "customdeploy1",
                                            // external: true,
                                            urlParams: {
                                                's_account': L_Account
                                            }
                                        });
                                    }
                                    else {
                                        resposeObject = https.requestSuitelet({
                                            scriptId: "customscript_sut_tss_exp_item_data",
                                            deploymentId: "customdeploy1",
                                            // external: true,
                                            urlParams: {
                                                's_expense': L_Category
                                            }
                                        });
                                    }
                                    log.debug("resposeObject from SUT_TSS_Exp_Item_Data", resposeObject);
                                    if (_logValidation(resposeObject)) {
                                        var respBody = JSON.parse(resposeObject.body);
                                        log.debug("respBody from SUT_TSS_Exp_Item_Data", respBody);
                                        if (_logValidation(respBody) && respBody.length > 0) {
                                            rcm_Applicable_Expense = respBody[0].s_rcm;
                                            log.debug("rcm_Applicable_Expense from SUT_TSS_Exp_Item_Data", rcm_Applicable_Expense);

                                        }
                                    }

                                }

                            }// end catch(e)

                            // if (isTrue(Flag)) {
                            var i_Location;
                            var rec_location = current_record.getValue({ fieldId: 'location' });
                            var s_Record_Type = current_record.type;
                            // if (s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'check') {
                            i_State = current_record.getValue({ fieldId: "custbody_tss_placeof_supply" });
                            var i_Place_Of_Service = current_record.getValue({ fieldId: 'custbody_tss_place_of_service' });
                            // if (_logValidation(i_Place_Of_Service)) {
                            //     i_Location_State = i_Place_Of_Service;
                            // }
                            i_Location = current_record.getCurrentSublistValue({
                                sublistId: 'expense',
                                fieldId: 'location',
                            });
                            if (!_logValidation(i_Location)) {
                                i_Location = rec_location
                            }
                            if (_logValidation(i_Location)) {
                                try {
                                    var loc_obj = search.lookupFields({
                                        type: 'location',
                                        id: i_Location,
                                        columns: ['custrecord_tss_its_location_statename', 'custrecord_tss_gst_type_location', 'custrecord_tss_gstin']
                                    });
                                    if (loc_obj.custrecord_tss_its_location_statename.length > 0) {
                                        i_Location_State = loc_obj.custrecord_tss_its_location_statename[0].value;
                                        log.debug("i_Location_State in fieldChanged", i_Location_State);
                                    }
                                    if (loc_obj.custrecord_tss_gst_type_location.length > 0) {
                                        i_Location_Type = loc_obj.custrecord_tss_gst_type_location[0].text;
                                        log.debug("i_Location_Type in fieldChanged", i_Location_Type);
                                    }
                                    current_record.setCurrentSublistValue({
                                        sublistId: 'expense',
                                        fieldId: "custcol_tss_loc_gstin",
                                        value: loc_obj.custrecord_tss_gstin
                                    });

                                }
                                catch (e) {
                                    if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {
                                        var resposeObject = https.requestSuitelet({
                                            scriptId: "customscript_sut_tss_get_location_data",
                                            deploymentId: "customdeploy1",
                                            // external: true,
                                            urlParams: {
                                                's_Location': i_Location
                                            }
                                        });
                                        //log.debug("resposeObject of SUT_TSS_Get_Location_Data",resposeObject);
                                        var respBody = JSON.parse(resposeObject.body);
                                        if (_logValidation(respBody) && respBody.length > 0) {
                                            i_Location_State = respBody[0].i_Location_State;
                                            log.debug("i_Location_State from SUT_TSS_Get_Location_Data", i_Location_State);
                                            i_Location_Type = respBody[0].i_Location_Type;
                                            log.debug("i_Location_Type in fieldChanged", i_Location_Type);
                                            current_record.setCurrentSublistValue({
                                                sublistId: 'expense',
                                                fieldId: "custcol_tss_loc_gstin",
                                                value: respBody[0].GstIn
                                            });
                                        }
                                    }

                                }// end catch(e)


                            }// end if(_logValidation(i_Location))
                            else {
                                // alert("Location should be enter");
                                current_record.setCurrentSublistValue({
                                    sublistId: 'expense',
                                    fieldId: "custcol_tss_loc_gstin",
                                    value: ''
                                });
                            }
                            if (!_logValidation(i_Location_State)) {
                                i_Location_State = i_State;
                            }

                            // }// end if(s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'purchaseorder')
                            if (_logValidation(i_Location_State) && _logValidation(i_Place_Of_Service)) {
                                var a_Filters = new Array();
                                var a_Columns = new Array();
                                a_Filters.push(search.createFilter({
                                    name: 'isinactive',
                                    operator: 'is',
                                    values: 'F'
                                }));
                                a_Filters.push(search.createFilter({
                                    name: 'custrecord_tss_its_item',
                                    operator: 'anyof',
                                    values: '@NONE@'
                                }));
                                if (g_useAccExpGSTAuto) {
                                    a_Filters.push(search.createFilter({
                                        name: 'custrecord_tss_its_expense_account',
                                        operator: 'anyof',
                                        values: L_Account
                                    }));
                                }
                                else {
                                    a_Filters.push(search.createFilter({
                                        name: 'custrecord_tss_its_expense_category',
                                        operator: 'anyof',
                                        values: L_Category
                                    }));
                                }
                                a_Columns.push(search.createColumn({ name: 'custrecord_tss_its_in_state_tax_group' }));
                                a_Columns.push(search.createColumn({ name: 'custrecord_tss_its_out_state_tax_group' }));
                                a_Columns.push(search.createColumn({ name: 'custrecord_tss_its_rcm_in_state_taxgroup' }));
                                a_Columns.push(search.createColumn({ name: 'custrecord_tss_its_rcm_out_state_taxgrp' }));
                                var taxGroupsearch = search.create({
                                    type: 'customrecord_tss_its_tax_group_deter',
                                    filters: a_Filters,
                                    columns: a_Columns
                                });
                                var taxGroupsearch_result = taxGroupsearch.run().getRange(0, 100);

                                // Removing Apply SEZ & RCM
                                var LItemRcm = current_record.getCurrentSublistValue({
                                    sublistId: 'expense',
                                    fieldId: 'custcol_tss_rcm_apply',
                                });
                                var LItemSez = current_record.getCurrentSublistValue({
                                    sublistId: 'expense',
                                    fieldId: 'custcol_tss_sez',
                                });
                                var LItemSezLiable = current_record.getCurrentSublistValue({
                                    sublistId: 'expense',
                                    fieldId: 'custcol_tss_sez_tax_liable',
                                });
                                if (isTrue(LItemSezLiable)) {
                                    current_record.setCurrentSublistValue({
                                        sublistId: 'expense',
                                        fieldId: 'custcol_tss_sez_tax_liable',
                                        value: false
                                    });
                                }
                                if (isTrue(LItemSez)) {
                                    current_record.setCurrentSublistValue({
                                        sublistId: 'expense',
                                        fieldId: "custcol_tss_sez",
                                        value: false,
                                    });
                                }
                                if (isTrue(LItemRcm)) {
                                    current_record.setCurrentSublistValue({
                                        sublistId: 'expense',
                                        fieldId: "custcol_tss_rcm_apply",
                                        value: false
                                    });
                                }
                                var b_ImportL = current_record.getValue({ fieldId: "custbody_tss_import_gst" });
                                if (i_Location_State == i_Place_Of_Service && i_Location_Type != "SEZ" && !isTrue(b_ImportL)) {
                                    if (taxGroupsearch_result.length > 0) {
                                        var i_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_in_state_tax_group' });
                                        if (_logValidation(i_Tax_Group)) {
                                            if (isTrue(g_VNR_RCM_applicable) && (!isTrue(vnr_Flag) || isTrue(rcm_Applicable_Expense))) {
                                                var rcm_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_rcm_in_state_taxgroup' });
                                                var rcm_Tax_Group_rate = getTaxGroupRate(rcm_Tax_Group);
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "taxcode",
                                                    value: g_VNR_InState,

                                                });
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "custcol_tss_rcm_tax_code",
                                                    value: rcm_Tax_Group,

                                                });
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "custcol_tss_rcm_apply",
                                                    value: true
                                                });
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "custcol_tss_rcm_rate",
                                                    value: parseFloat(rcm_Tax_Group_rate)
                                                });

                                            }
                                            else {
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "taxcode",
                                                    value: i_Tax_Group,

                                                });

                                            }
                                        } // end if (_logValidation(i_Tax_Group))
                                    }
                                    else {
                                        //alert("You are not created Tax Group Determination record for Current line Expense Category - " + L_Category_Name);
                                        current_record.setCurrentSublistValue({
                                            sublistId: 'expense',
                                            fieldId: "taxcode",
                                            value: g_taxcode,
                                        });

                                    }

                                }// end if(i_Location_State == i_Place_Of_Service && i_Location_Type != "SEZ")

                                else {
                                    if (taxGroupsearch_result.length > 0) {
                                        var i_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_out_state_tax_group' });
                                        if (_logValidation(i_Tax_Group)) {
                                            if (i_Location_Type == 'SEZ') {
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "taxcode",
                                                    value: g_sezCode,

                                                });
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "custcol_tss_sez",
                                                    value: true,
                                                });
                                                if (sezLiableDefault) {
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "custcol_tss_sez_tax_liable",
                                                        value: true,
                                                    });
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "taxcode",
                                                        value: i_Tax_Group,

                                                    });
                                                }

                                            }
                                            else if ((isTrue(g_VNR_RCM_applicable)) && (!isTrue(vnr_Flag) || isTrue(rcm_Applicable_Expense))) {
                                                var rcm_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_rcm_out_state_taxgrp' });
                                                var rcm_Tax_Group_rate = getTaxGroupRate(rcm_Tax_Group);
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "taxcode",
                                                    value: g_VNR_OutState,
                                                });
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "custcol_tss_rcm_tax_code",
                                                    value: rcm_Tax_Group,

                                                });
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "custcol_tss_rcm_apply",
                                                    value: true
                                                });
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "custcol_tss_rcm_rate",
                                                    value: parseFloat(rcm_Tax_Group_rate)
                                                });

                                            }
                                            else {

                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "taxcode",
                                                    value: i_Tax_Group,

                                                });

                                            }
                                        } // end if (_logValidation(i_Tax_Group))
                                    } // end if (taxGroupsearch_result.length > 0)
                                    else {
                                        if (i_Location_Type == 'SEZ') {
                                            current_record.setCurrentSublistValue({
                                                sublistId: 'expense',
                                                fieldId: "taxcode",
                                                value: g_sezCode,

                                            });
                                            current_record.setCurrentSublistValue({
                                                sublistId: 'expense',
                                                fieldId: "custcol_tss_sez",
                                                value: true,
                                            });

                                            if (sezLiableDefault) {
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "custcol_tss_sez_tax_liable",
                                                    value: true,
                                                });
                                            }
                                        }
                                        else {
                                            //alert("You are not created Tax Group Determination record for Current line Expense Category - " + L_Category_Name);
                                            current_record.setCurrentSublistValue({
                                                sublistId: 'expense',
                                                fieldId: "taxcode",
                                                value: g_taxcodeIGST,
                                            });

                                        }

                                    }

                                } // end else

                            }// end if(_logValidation(i_Location_State) && _logValidation(i_Place_Of_Service))
                            else if (!i_Place_Of_Service) {
                                alert("Please Enter Place of Service. Re-Enter the location");
                                current_record.setCurrentSublistValue({
                                    sublistId: 'expense',
                                    fieldId: "location",
                                    value: '',
                                    ignoreFieldChange: true
                                });
                            }

                            // } // end if(isTrue(Flag))

                        } // END if (_logValidation(L_Account) && (!g_useAccExpGSTAuto && _logValidation(L_Category)) && isTrue(Flag)) {

                    }
                    catch (e) {
                        log.error("Error in Location in Expense Sublist fieldChanged", e);
                    }

                } // end if(scriptContext.fieldId == 'location' && scriptContext.sublistId == 'expense')


            } // end try
            catch (e) {
                log.error("Error in fieldChanged", e);
            } // end catch(e)

        } // end function fieldChanged(scriptContext) 

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
            try {
                if (scriptContext.fieldId == 'entity') {
                    try {
                        var current_record = scriptContext.currentRecord;
                        var s_Record_Type = current_record.type;
                        var rec_subsid = current_record.getValue({ fieldId: "subsidiary" });
                        var Flag = 0;
                        Flag = inArray(rec_subsid, g_subisidiary);
                        if (Flag == parseInt(1)) {
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
                                var rec_form = current_record.getValue({ fieldId: "customform" });
                                if ((rec_form != customFormsObj[current_record.type]) && (_logValidation(customFormsObj[current_record.type]))) {
                                    current_record.setValue({ fieldId: "customform", value: customFormsObj[current_record.type] });
                                }
                            }

                            current_record.setValue({
                                fieldId: 'custbody_tss_isvalidsubsidiary',
                                value: true,
                            });
                            var checkType = ''
                            if (s_Record_Type == 'check') {
                                var ent_Type = current_record.getValue({ fieldId: "custbody_tss_payye_type" });
                                if (ent_Type == 'Vendor' || ent_Type == 'vendor') {
                                    checkType = 'purchase'
                                }
                                else if (ent_Type == 'Customer' || ent_Type == 'customer') {
                                    checkType = 'sales'
                                }
                            }
                            if (s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || checkType == 'purchase') {
                                current_record.getField("custbody_tss_place_of_service").isMandatory = true;
                                var rec_vendor = current_record.getValue({ fieldId: "entity" });
                                log.debug("vendId in Subsidiary FieldChanged", rec_vendor)
                                if (_logValidation(rec_vendor)) {
                                    try {
                                        vnr_Flag = search.lookupFields({
                                            type: 'vendor',
                                            id: rec_vendor,
                                            columns: ['custentity_tss_gst_liable']
                                        });
                                        vnr_Flag = vnr_Flag.custentity_tss_gst_liable;
                                        log.debug("vnr_Flag in subsidiary fieldChanged", vnr_Flag);
                                    }
                                    catch (e) {
                                        if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {
                                            var recType = s_Record_Type;
                                            if (s_Record_Type == 'check') {
                                                recType = 'purchaseorder'
                                            }
                                            var resposeObject = '';
                                            resposeObject = https.requestSuitelet({
                                                scriptId: "customscript_sut_tss_get_entity_data",
                                                deploymentId: "customdeploy1",
                                                // external: true,
                                                urlParams: {
                                                    's_entiry_id': rec_vendor,
                                                    's_record_type': recType
                                                }
                                            });
                                            log.debug("resposeObject from suitelet", resposeObject);
                                            if (_logValidation(resposeObject)) {
                                                var respBody = JSON.parse(resposeObject.body);
                                                log.debug("respBody from suitelet", respBody);
                                                if (_logValidation(respBody) && respBody.length > 0) {
                                                    vnr_Flag = respBody[0].vnr_Flag;
                                                    log.debug("vnr_Flag from suitelet", vnr_Flag);
                                                }
                                            } // end if(_logValidation(resposeObject))
                                        }
                                    }
                                }// end if(_logValidation(rec_vendor))
                            } // end if(s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit')

                            else if (s_Record_Type == 'salesorder' || s_Record_Type == 'invoice' || s_Record_Type == 'creditmemo' || s_Record_Type == 'cashsale' || s_Record_Type == 'estimate' || checkType == 'sales') {
                                current_record.getField("custbody_tss_placeof_supply").isMandatory = true;
                                var rec_cust = current_record.getValue({ fieldId: "entity" });
                                if (_logValidation(rec_cust)) {
                                    try {
                                        Cust_gst_flag = search.lookupFields({
                                            type: 'customer',
                                            id: rec_cust,
                                            columns: ['custentity_tss_gst_liable']
                                        });
                                        Cust_gst_flag = Cust_gst_flag.custentity_tss_gst_liable;
                                        log.debug("Cust_gst_flag in pageInit", Cust_gst_flag);

                                    }// end try
                                    catch (e) {
                                        var recType = s_Record_Type;
                                        if (s_Record_Type == 'check') {
                                            recType = 'salesorder'
                                        }
                                        var resposeObject = '';
                                        resposeObject = https.requestSuitelet({
                                            scriptId: "customscript_sut_tss_get_entity_data",
                                            deploymentId: "customdeploy1",
                                            // external: true,
                                            urlParams: {
                                                's_entiry_id': rec_cust,
                                                's_record_type': recType
                                            }
                                        });
                                        log.debug("resposeObject from suitelet", resposeObject);
                                        if (_logValidation(resposeObject)) {
                                            var respBody = JSON.parse(resposeObject.body);
                                            log.debug("respBody from suitelet", respBody);
                                            if (_logValidation(respBody) && respBody.length > 0) {
                                                Cust_gst_flag = respBody[0].cust_Flag;
                                                log.debug("Cust_gst_flag from suitelet", Cust_gst_flag);
                                            }
                                        } // end if(_logValidation(resposeObject))
                                    } // end catch(e)
                                }
                            } // end else if(s_Record_Type == 'salesorder' || s_Record_Type == 'invoice' || s_Record_Type == 'creditmemo'  || s_Record_Type == 'cashsale')


                        } // end if(Flag == parseInt(1))

                        else if (Flag != parseInt(1)) {
                            current_record.getField("custbody_tss_placeof_supply").isMandatory = false;
                            current_record.getField("custbody_tss_place_of_service").isMandatory = false;
                            current_record.setValue({
                                fieldId: 'custbody_tss_isvalidsubsidiary',
                                value: false,
                            });
                        } // end else if(Flag != parseInt(1))
                    }// end try
                    catch (err) {
                        log.error("Error in Subsidiary fieldChanged", err);
                    }// end catch(err)

                } // end if(scriptContext.fieldId == 'entity')
                /*
                if (scriptContext.fieldId == 'subsidiary') {
                    
                    var current_record = scriptContext.currentRecord;
                    try {
                        var rec_subsid = current_record.getValue({ fieldId: "subsidiary" });
                        var s_Record_Type = current_record.type;
                        var Flag = inArray(rec_subsid, g_subisidiary);
                        if (Flag == parseInt(1)) {
                            current_record.setValue({
                                fieldId: 'custbody_tss_isvalidsubsidiary',
                                value: true,
                            });
                        }
                        else if (Flag != parseInt(1)) {
                            current_record.getField("custbody_tss_placeof_supply").isMandatory = false;
                            current_record.setValue({
                                fieldId: 'custbody_tss_isvalidsubsidiary',
                                value: false,
                            });
                        }
                    }
                    catch (e) {
                        log.error("Error in Subsidiary postSourcing", e);
                    }
                } // end if(scriptContext.fieldId == 'subsidiary')
                */

                if ((scriptContext.fieldId == 'item' && scriptContext.sublistId == 'item')) {
                    var current_record = scriptContext.currentRecord;
                    // || (scriptContext.fieldId == 'location' && scriptContext.sublistId == 'item') this is to be add but fieldchanged is done for location
                    var rcm_applicable_item = '';
                    try {
                        var L_Item = current_record.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: "item"
                        });
                        log.debug("L_Item in Item postSourcing", L_Item);
                        var L_Item_name = current_record.getCurrentSublistText({
                            sublistId: 'item',
                            fieldId: "item"
                        });
                        if (_logValidation(L_Item)) {
                            var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                            rcm_applicable_item = 'F';
                            var i_Location_State;
                            var i_Location_Type;
                            var i_State;

                            if (isTrue(Flag)) {
                                var L_Item_Type = current_record.getCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'itemtype',
                                });
                                log.debug("L_Item_Type in Item postSourcing", L_Item_Type);
                                var s_item_rec_type = '';
                                switch (L_Item_Type) { // Compare item type to its record type counterpart 
                                    case 'InvtPart':
                                        s_item_rec_type = 'inventoryitem';
                                        break;
                                    case 'NonInvtPart':
                                        s_item_rec_type = 'noninventoryitem';
                                        break;
                                    case 'Service':
                                        s_item_rec_type = 'serviceitem';
                                        break;
                                    case 'Assembly':
                                        s_item_rec_type = 'assemblyitem';//serializedassemblyitem
                                        break;
                                    case 'Kit':
                                        s_item_rec_type = 'kititem';
                                        break;
                                    case 'OthCharge':
                                        s_item_rec_type = 'otherchargeitem';
                                        break;
                                    case 'GiftCert':
                                        s_item_rec_type = 'giftcertificateitem';
                                        break;
                                    case 'Group':
                                        s_item_rec_type = 'itemgroup';
                                        break;
                                    case 'Payment':
                                        s_item_rec_type = 'paymentitem';
                                        break;
                                    default:
                                } // end switch (L_Item_Type)
                                var s_ITC;
                                try {
                                    var rcm_applicable_itemObj = search.lookupFields({
                                        type: s_item_rec_type,
                                        id: L_Item,
                                        columns: ['custitem_tss_item_rcm_applicable', 'custitem_tss_itc_ineligible']
                                    });
                                    if (_logValidation(rcm_applicable_itemObj)) {
                                        rcm_applicable_item = rcm_applicable_itemObj.custitem_tss_item_rcm_applicable;
                                        log.debug("rcm_applicable_item in Item postSourcing", rcm_applicable_item);
                                        s_ITC = rcm_applicable_itemObj.custitem_tss_itc_ineligible;
                                    }
                                }
                                catch (e) {
                                    //log.error("err in item postsourcing",e);
                                    if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {

                                        var resposeObject = '';
                                        resposeObject = https.requestSuitelet({
                                            scriptId: "customscript_sut_tss_exp_item_data",
                                            deploymentId: "customdeploy1",
                                            // external: true,
                                            urlParams: {
                                                's_item': L_Item,
                                                's_itemType': s_item_rec_type
                                            }
                                        });
                                        log.debug("resposeObject from SUT_TSS_Exp_Item_Data", resposeObject);
                                        if (_logValidation(resposeObject)) {
                                            var respBody = JSON.parse(resposeObject.body);
                                            log.debug("respBody from SUT_TSS_Exp_Item_Data", respBody);
                                            if (_logValidation(respBody) && respBody.length > 0) {
                                                rcm_applicable_item = respBody[0].s_rcm;
                                                log.debug("rcm_applicable_item from SUT_TSS_Exp_Item_Data", rcm_applicable_item);
                                                s_ITC = respBody[0].s_ITC;
                                                log.debug("s_ITC from SUT_TSS_Exp_Item_Data", s_ITC);
                                            }
                                        }

                                    }
                                } // end catch(e)
                                // log.debug("s_ITC in Item postSourcing", s_ITC);
                                current_record.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: "custcol_tss_itc_ineligible",
                                    value: isTrue(s_ITC)
                                });
                                if (inelibleITCdefault) {
                                    current_record.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: "custcol_tss_itc_ineligible",
                                        value: true
                                    });
                                }




                                var s_Record_Type = current_record.type;
                                var g_recType;
                                if (s_Record_Type == 'check') {
                                    var ent_Type = current_record.getValue({ fieldId: "custbody_tss_payye_type" });
                                    if (ent_Type == 'Vendor' || ent_Type == 'vendor') {
                                        g_recType = 'purchase'
                                    }
                                    else if (ent_Type == 'Customer' || ent_Type == 'customer') {
                                        g_recType = 'sale'
                                    }
                                }
                                else if (s_Record_Type == 'invoice' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'cashsale' || s_Record_Type == 'creditmemo') {
                                    g_recType = 'sales';
                                }
                                else if (s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit') {
                                    g_recType = 'purchase';
                                }
                                // if (s_Record_Type == 'cashsale' || s_Record_Type == 'invoice' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'creditmemo' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'purchaseorder') {
                                i_State = current_record.getValue({ fieldId: "custbody_tss_placeof_supply" });
                                var i_Place_Of_Service = current_record.getValue({ fieldId: "custbody_tss_place_of_service" });
                                var iStateCompareText = '';
                                var iStateCompare = '';
                                if ((s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'purchaseorder' || g_recType == 'purchase')) {
                                    i_Location_State = i_State;
                                    iStateCompareText = "Place of Supply";
                                    iStateCompare = i_Place_Of_Service
                                    if (!_logValidation(i_Place_Of_Service)) {
                                        alert("Please Enter Place of Service. Re-Enter the line data");
                                        current_record.cancelLine({ sublistId: 'item' });
                                    }
                                }
                                else if ((s_Record_Type == 'cashsale' || s_Record_Type == 'invoice' || s_Record_Type == 'salesorder' || s_Record_Type == 'creditmemo' || g_recType == 'sale')) {
                                    i_Location_State = i_Place_Of_Service;
                                    iStateCompareText = "Place of Service";
                                    iStateCompare = i_State;
                                    if (!_logValidation(i_State)) {
                                        alert("Please Enter Place of Supply. Re-Enter the line data");
                                        current_record.cancelLine({ sublistId: 'item' });
                                    }
                                }
                                var i_Location;
                                i_Location = current_record.getCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: "location"
                                });
                                //log.audit("Location in Item postSourcing",i_Location);
                                if (!_logValidation(i_Location)) {
                                    var sublistObj = current_record.getSublist({ sublistId: scriptContext.sublistId });
                                    var LineLocField = sublistObj.getColumn({
                                        fieldId: 'location'
                                    });
                                    // log.audit("LineLocField in Item postSourcing",LineLocField);
                                    var rec_Location = current_record.getValue({ fieldId: "location" });
                                    if (_logValidation(LineLocField)) {
                                        // alert(LineLocField)
                                        if (_logValidation(rec_Location)) {
                                            // alert(rec_Location)
                                            current_record.setCurrentSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'location',
                                                value: rec_Location,
                                                ignoreFieldChange: true
                                            });
                                            i_Location = rec_Location
                                        }
                                    }

                                    else if (!_logValidation(rec_Location) && !_logValidation(i_Location_State)) {
                                        alert("Please Enter Location or " + iStateCompareText + ". Re-Enter the line data");
                                        current_record.cancelLine({ sublistId: 'item' });
                                    }
                                    else {
                                        i_Location = rec_Location;
                                    }

                                }

                                if (_logValidation(i_Location)) {
                                    try {
                                        var loc_obj = search.lookupFields({
                                            type: 'location',
                                            id: i_Location,
                                            columns: ['custrecord_tss_its_location_statename', 'custrecord_tss_gst_type_location', 'custrecord_tss_gstin']
                                        });
                                        if (loc_obj.custrecord_tss_its_location_statename.length > 0) {
                                            i_Location_State = loc_obj.custrecord_tss_its_location_statename[0].value;
                                            log.debug("i_Location_State in Item/Location postSourcing", i_Location_State);
                                        }
                                        if (loc_obj.custrecord_tss_gst_type_location.length > 0) {
                                            i_Location_Type = loc_obj.custrecord_tss_gst_type_location[0].text;
                                            log.debug("i_Location_Type in Item/Location postSourcing", i_Location_Type);
                                        }
                                        current_record.setCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId: "custcol_tss_loc_gstin",
                                            value: loc_obj.custrecord_tss_gstin
                                        });

                                    }
                                    catch (e) {
                                        if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {
                                            var resposeObject = https.requestSuitelet({
                                                scriptId: "customscript_sut_tss_get_location_data",
                                                deploymentId: "customdeploy1",
                                                // external: true,
                                                urlParams: {
                                                    's_Location': i_Location
                                                }
                                            });
                                            log.audit("resposeObject of SUT_TSS_Get_Location_Data", resposeObject);
                                            var respBody = JSON.parse(resposeObject.body);
                                            if (_logValidation(respBody) && respBody.length > 0) {
                                                i_Location_State = respBody[0].i_Location_State;
                                                log.debug("i_Location_State from SUT_TSS_Get_Location_Data", i_Location_State);
                                                i_Location_Type = respBody[0].i_Location_Type;
                                                log.debug("i_Location_Type in Item/Location postSourcing suitelet", i_Location_Type);
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: "custcol_tss_loc_gstin",
                                                    value: respBody[0].GstIn
                                                });
                                            }
                                        }

                                    }// end catch(e)


                                }// end if(_logValidation(i_Location))

                                // }// end if(s_Record_Type == 'cashsale' || s_Record_Type == 'invoice' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'creditmemo' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'purchaseorder')


                                if (_logValidation(i_Location_State) && _logValidation(iStateCompare)) {
                                    var a_Filters = new Array();
                                    var a_Columns = new Array();
                                    a_Filters.push(search.createFilter({
                                        name: 'isinactive',
                                        operator: 'is',
                                        values: 'F'
                                    }));
                                    a_Filters.push(search.createFilter({
                                        name: 'custrecord_tss_its_item',
                                        operator: 'anyof',
                                        values: L_Item
                                    }));
                                    a_Filters.push(search.createFilter({
                                        name: 'custrecord_tss_its_expense_category',
                                        operator: 'anyof',
                                        values: '@NONE@'
                                    }));
                                    a_Columns.push(search.createColumn({ name: 'custrecord_tss_its_in_state_tax_group' }));
                                    a_Columns.push(search.createColumn({ name: 'custrecord_tss_its_out_state_tax_group' }));
                                    a_Columns.push(search.createColumn({ name: 'custrecord_tss_its_rcm_in_state_taxgroup' }));
                                    a_Columns.push(search.createColumn({ name: 'custrecord_tss_its_rcm_out_state_taxgrp' }));
                                    var taxGroupsearch = search.create({
                                        type: 'customrecord_tss_its_tax_group_deter',
                                        filters: a_Filters,
                                        columns: a_Columns
                                    });
                                    var taxGroupsearch_result = taxGroupsearch.run().getRange(0, 100);

                                    log.debug("i_Location_Type in Item/Location postSourcing in condition", i_Location_Type);
                                    //Removing Apply SEZ & RCM
                                    var LItemRcm = current_record.getCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'custcol_tss_rcm_apply',
                                    });
                                    var LItemSez = current_record.getCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'custcol_tss_sez',
                                    });
                                    var LItemSezLiable = current_record.getCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'custcol_tss_sez_tax_liable',
                                    });
                                    if (isTrue(LItemSezLiable)) {
                                        current_record.setCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'custcol_tss_sez_tax_liable',
                                            value: false
                                        });
                                    }
                                    if (isTrue(LItemSez)) {
                                        current_record.setCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId: "custcol_tss_sez",
                                            value: false,
                                        });
                                    }
                                    if (isTrue(LItemRcm)) {
                                        current_record.setCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId: "custcol_tss_rcm_apply",
                                            value: false
                                        });
                                    }
                                    var b_ImportL = current_record.getValue({ fieldId: "custbody_tss_import_gst" });
                                    var b_ExportL = current_record.getValue({ fieldId: "custbody_tss_export_gst" });

                                    if (i_Location_State == iStateCompare && i_Location_Type != 'SEZ' && !isTrue(b_ImportL) && !isTrue(b_ExportL)) {
                                        if (taxGroupsearch_result.length > 0) {
                                            var i_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_in_state_tax_group' });
                                            if (_logValidation(i_Tax_Group)) {

                                                if (isTrue(g_VNR_RCM_applicable) && (!isTrue(vnr_Flag) || isTrue(rcm_applicable_item)) && g_recType == "purchase") {
                                                    // if (isTrue(g_VNR_RCM_applicable) && (isTrue(rcm_applicable_item)) && g_recType == "purchase") {
                                                    var rcm_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_rcm_in_state_taxgroup' });
                                                    var rcm_Tax_Group_rate = getTaxGroupRate(rcm_Tax_Group);
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "taxcode",
                                                        value: g_VNR_InState,
                                                    });
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "custcol_tss_rcm_tax_code",
                                                        value: rcm_Tax_Group,
                                                    });
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "custcol_tss_rcm_apply",
                                                        value: true
                                                    });
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "custcol_tss_rcm_rate",
                                                        value: parseFloat(rcm_Tax_Group_rate)
                                                    });
                                                }
                                                // else if (isTrue(g_VNR_RCM_applicable) && !isTrue(vnr_Flag) && g_recType == "purchase") {
                                                //     current_record.setCurrentSublistValue({
                                                //         sublistId: 'item',
                                                //         fieldId: "taxcode",
                                                //         value: g_taxcode,
                                                //     });
                                                // }
                                                else {
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "taxcode",
                                                        value: i_Tax_Group
                                                    });

                                                }
                                            } // end if(_logValidation(i_Tax_Group))
                                        } // end if(taxGroupsearch_result.length > 0)
                                        else {
                                            //alert("You are not created Tax Group Determination record for Current line Item - " + L_Item_name);
                                            current_record.setCurrentSublistValue({
                                                sublistId: 'item',
                                                fieldId: "taxcode",
                                                value: g_taxcode,
                                            });

                                        }


                                    } // end if(i_Location_State == iStateCompare && i_Location_Type != 'SEZ')
                                    else {
                                        if (taxGroupsearch_result.length > 0) {
                                            var i_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_out_state_tax_group' });
                                            log.debug("i_Tax_Group in item postsourcing", i_Tax_Group)
                                            log.debug("g_recType - b_ExportL in item postsourcing", g_recType + '-' + b_ExportL)
                                            if (_logValidation(i_Tax_Group)) {
                                                // alert("i_Tax_Group"+i_Tax_Group)

                                                if (g_recType == "purchase" && i_Location_Type == 'SEZ') {
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "taxcode",
                                                        value: g_sezCode,
                                                    });
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "custcol_tss_sez",
                                                        value: true,
                                                    });
                                                    if (sezLiableDefault) {
                                                        current_record.setCurrentSublistValue({
                                                            sublistId: 'item',
                                                            fieldId: "custcol_tss_sez_tax_liable",
                                                            value: true,
                                                        });
                                                        current_record.setCurrentSublistValue({
                                                            sublistId: 'item',
                                                            fieldId: "taxcode",
                                                            value: i_Tax_Group
                                                        });
                                                    }

                                                }
                                                else if (isTrue(g_VNR_RCM_applicable) && (!isTrue(vnr_Flag) || isTrue(rcm_applicable_item)) && g_recType == "purchase") {
                                                    // else if (isTrue(g_VNR_RCM_applicable) && (isTrue(rcm_applicable_item)) && g_recType == "purchase") {
                                                    var rcm_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_rcm_out_state_taxgrp' });
                                                    var rcm_Tax_Group_rate = getTaxGroupRate(rcm_Tax_Group);
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "taxcode",
                                                        value: g_VNR_OutState,

                                                    });
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "custcol_tss_rcm_tax_code",
                                                        value: rcm_Tax_Group,

                                                    });
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "custcol_tss_rcm_apply",
                                                        value: true
                                                    });
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "custcol_tss_rcm_rate",
                                                        value: parseFloat(rcm_Tax_Group_rate)
                                                    });

                                                }
                                                // else if (isTrue(g_VNR_RCM_applicable) && !isTrue(vnr_Flag) && g_recType == "purchase") {
                                                //     current_record.setCurrentSublistValue({
                                                //         sublistId: 'item',
                                                //         fieldId: "taxcode",
                                                //         value: g_taxcodeIGST,
                                                //     });
                                                // }
                                                else {
                                                    // alert("yes")
                                                    if (g_recType == 'sales' && isTrue(b_ExportL)) {
                                                        var i_Export_ReasonL = current_record.getValue({ fieldId: "custbody_tss_gst_payment_under" });
                                                        log.debug("i_Export_ReasonL in item postsourcing", i_Export_ReasonL)
                                                        if (i_Export_ReasonL == 1) {
                                                            current_record.setCurrentSublistValue({
                                                                sublistId: 'item',
                                                                fieldId: "taxcode",
                                                                value: g_taxcodeIGST,
                                                            });
                                                            var lut_Tax_Group_rate = getTaxGroupRate(i_Tax_Group);
                                                            current_record.setCurrentSublistValue({
                                                                sublistId: 'item',
                                                                fieldId: "custcol_tss_lut_taxcode",
                                                                value: i_Tax_Group,
                                                            });
                                                            current_record.setCurrentSublistValue({
                                                                sublistId: 'item',
                                                                fieldId: "custcol_tss_lut_taxrate",
                                                                value: parseFloat(lut_Tax_Group_rate)
                                                            });
                                                        }
                                                        else if (i_Export_ReasonL == 2) {
                                                            current_record.setCurrentSublistValue({
                                                                sublistId: 'item',
                                                                fieldId: "taxcode",
                                                                value: g_taxcodeIGST,

                                                            });
                                                        }
                                                    }
                                                    else {
                                                        current_record.setCurrentSublistValue({
                                                            sublistId: 'item',
                                                            fieldId: "taxcode",
                                                            value: i_Tax_Group
                                                        });
                                                    }
                                                }

                                            } // end if(_logValidation(i_Tax_Group))
                                        } // end if (taxGroupsearch_result.length > 0)
                                        else {
                                            if (g_recType == "purchase" && i_Location_Type == 'SEZ') {
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: "taxcode",
                                                    value: g_sezCode,

                                                });
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: "custcol_tss_sez",
                                                    value: true,
                                                });
                                                if (sezLiableDefault) {
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "custcol_tss_sez_tax_liable",
                                                        value: true,
                                                    });
                                                }

                                            }
                                            else {
                                                // alert("You are not created Tax Group Determination record for Current line Item - " + L_Item_name);
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: "taxcode",
                                                    value: g_taxcodeIGST,

                                                });

                                            }
                                        }
                                    } // end else

                                } // end if(_logValidation(i_Location_State) && _logValidation(i_State))


                            } // end if (isTrue(Flag))
                        } // end if (_logValidation(L_Item))

                    }// end try
                    catch (e) {
                        log.error("Error in item sublist postSourcing", e);
                    }
                } // end if((scriptContext.fieldId == 'item' && scriptContext.sublistId == 'item') || (scriptContext.fieldId == 'location' && scriptContext.sublistId == 'item'))

                if (scriptContext.sublistId == 'expense' && ((!g_useAccExpGSTAuto && scriptContext.fieldId == 'category') || (g_useAccExpGSTAuto && scriptContext.fieldId == 'account'))) {
                    try {
                        var current_record = scriptContext.currentRecord;
                        // log.debug("Entered into expense postsourcing")
                        var L_Category = current_record.getCurrentSublistValue({
                            sublistId: 'expense',
                            fieldId: "category"
                        });
                        var L_Category_name = current_record.getCurrentSublistText({
                            sublistId: 'expense',
                            fieldId: "category"
                        });
                        var i_Account = current_record.getCurrentSublistValue({
                            sublistId: 'expense',
                            fieldId: "account"
                        });

                        if ((!g_useAccExpGSTAuto && _logValidation(L_Category)) || (g_useAccExpGSTAuto && _logValidation(i_Account))) {
                            var rcm_Applicable_Expense = '';
                            var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                            try {
                                if (!g_useAccExpGSTAuto) {
                                    var expenseObj = search.lookupFields({
                                        type: 'expensecategory',
                                        id: L_Category,
                                        columns: ['custrecord_tss_rcm']
                                    });
                                    if (_logValidation(expenseObj)) {
                                        rcm_Applicable_Expense = expenseObj.custrecord_tss_rcm;
                                        log.debug("rcm_Applicable_Expense in expense postSorcing", rcm_Applicable_Expense);
                                    }
                                }
                                else if (g_useAccExpGSTAuto) {
                                    var expenseObj = search.lookupFields({
                                        type: 'account',
                                        id: i_Account,
                                        columns: ['custrecord_tss_act_rcm']
                                    });
                                    if (_logValidation(expenseObj)) {
                                        rcm_Applicable_Expense = expenseObj.custrecord_tss_act_rcm;
                                        log.debug("rcm_Applicable_Expense in expense postSorcing acctbased", rcm_Applicable_Expense);
                                    }
                                }

                            }
                            catch (e) {

                                if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {

                                    var resposeObject = '';
                                    if (!g_useAccExpGSTAuto) {
                                        resposeObject = https.requestSuitelet({
                                            scriptId: "customscript_sut_tss_exp_item_data",
                                            deploymentId: "customdeploy1",
                                            urlParams: {
                                                's_expense': L_Category
                                            }
                                        });
                                    }
                                    else if (g_useAccExpGSTAuto) {
                                        resposeObject = https.requestSuitelet({
                                            scriptId: "customscript_sut_tss_exp_item_data",
                                            deploymentId: "customdeploy1",
                                            urlParams: {
                                                's_account': i_Account
                                            }
                                        });

                                    }
                                    log.debug("resposeObject from SUT_TSS_Exp_Item_Data", resposeObject);
                                    if (_logValidation(resposeObject)) {
                                        var respBody = JSON.parse(resposeObject.body);
                                        log.debug("respBody from SUT_TSS_Exp_Item_Data", respBody);
                                        if (_logValidation(respBody) && respBody.length > 0) {
                                            rcm_Applicable_Expense = respBody[0].s_rcm;
                                            log.debug("rcm_Applicable_Expense from SUT_TSS_Exp_Item_Data", rcm_Applicable_Expense);

                                        }
                                    }

                                }

                            }// end catch(e)

                            var i_State;
                            var i_Location_State;
                            var i_Location_Type;
                            var s_Record_Type = current_record.type;

                            if (_logValidation(i_Account) && isTrue(Flag)) {
                                var i_Location;
                                // if (s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'purchaseorder') {

                                i_State = current_record.getValue({ fieldId: "custbody_tss_placeof_supply" });

                                i_Location = current_record.getCurrentSublistValue({
                                    sublistId: 'expense',
                                    fieldId: "location"
                                });

                                var i_Place_Of_Service = current_record.getValue({ fieldId: "custbody_tss_place_of_service" });
                                if (!i_State) {
                                    alert("Please Enter Place of Service. Re-Enter the line data");
                                    // current_record.cancelLine({ sublistId: 'expense' });
                                }
                                i_Location_State = i_State;
                                if (!_logValidation(i_Location)) {
                                    var sublistObj = current_record.getSublist({ sublistId: scriptContext.sublistId });
                                    var LineLocField = sublistObj.getColumn({
                                        fieldId: 'location'
                                    });
                                    //log.audit("LineLocField in Item postSourcing",LineLocField);
                                    var rec_Location = current_record.getValue({ fieldId: "location" });
                                    if (_logValidation(LineLocField)) {
                                        if (_logValidation(rec_Location)) {
                                            current_record.setCurrentSublistValue({
                                                sublistId: 'expense',
                                                fieldId: 'location',
                                                value: rec_Location,
                                                ignoreFieldChange: true
                                            });
                                            i_Location = rec_Location
                                        }
                                    }

                                    else if (!_logValidation(rec_Location) && !_logValidation(i_State)) {
                                        alert("Please Enter Location or Place of Supply. Re-Enter the line data");
                                        current_record.cancelLine({ sublistId: 'expense' });
                                    }
                                    else {
                                        i_Location = rec_Location;
                                    }

                                }
                                if (_logValidation(i_Location)) {
                                    try {
                                        var locObj = search.lookupFields({
                                            type: 'location',
                                            id: i_Location,
                                            columns: ['custrecord_tss_gst_type_location', 'custrecord_tss_its_location_statename', 'custrecord_tss_gstin']
                                        });
                                        if (locObj.custrecord_tss_gst_type_location.length > 0) {
                                            i_Location_Type = locObj.custrecord_tss_gst_type_location[0].text;
                                            log.debug("i_Location_Type in postSourcing", i_Location_Type);
                                        }
                                        if (locObj.custrecord_tss_its_location_statename.length > 0) {
                                            i_Location_State = locObj.custrecord_tss_its_location_statename[0].value;
                                            log.debug("i_Location_State in postSourcing", i_Location_State);
                                        }
                                        current_record.setCurrentSublistValue({
                                            sublistId: 'expense',
                                            fieldId: "custcol_tss_loc_gstin",
                                            value: locObj.custrecord_tss_gstin
                                        });

                                    }
                                    catch (e) {
                                        if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {
                                            var resposeObject = https.requestSuitelet({
                                                scriptId: "customscript_sut_tss_get_location_data",
                                                deploymentId: "customdeploy1",
                                                // external: true,
                                                urlParams: {
                                                    's_Location': i_Location
                                                }
                                            });
                                            //log.debug("resposeObject of SUT_TSS_Get_Location_Data", resposeObject);
                                            var respBody = JSON.parse(resposeObject.body);
                                            if (_logValidation(respBody) && respBody.length > 0) {
                                                i_Location_Type = respBody[0].i_Location_Type;
                                                log.debug("i_Location_Type from SUT_TSS_Get_Location_Data", i_Location_Type);
                                                i_Location_State = respBody[0].i_Location_State;
                                                log.debug("i_Location_State from SUT_TSS_Get_Location_Data", i_Location_State);
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "custcol_tss_loc_gstin",
                                                    value: respBody[0].GstIn
                                                });
                                            }
                                        }

                                    }// end catch(e)
                                    if (!_logValidation(i_Location_State)) {
                                        i_Location_State = i_State;
                                    } // end if(_logValidation(i_Place_Of_Service))

                                }// end if(_logValidation(i_Location))

                                // }// end if(s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'purchaseorder')

                                if (_logValidation(i_Location_State) && _logValidation(i_Place_Of_Service)) {
                                    var a_Filters = new Array();
                                    var a_Columns = new Array();
                                    a_Filters.push(search.createFilter({
                                        name: 'isinactive',
                                        operator: 'is',
                                        values: 'F'
                                    }));
                                    a_Filters.push(search.createFilter({
                                        name: 'custrecord_tss_its_item',
                                        operator: 'anyof',
                                        values: '@NONE@'
                                    }));
                                    if (!g_useAccExpGSTAuto) {
                                        a_Filters.push(search.createFilter({
                                            name: 'custrecord_tss_its_expense_category',
                                            operator: 'anyof',
                                            values: L_Category
                                        }));
                                    }
                                    else if (g_useAccExpGSTAuto) {
                                        a_Filters.push(search.createFilter({
                                            name: 'custrecord_tss_its_expense_account',
                                            operator: 'anyof',
                                            values: i_Account
                                        }));

                                    }
                                    a_Columns.push(search.createColumn({ name: 'custrecord_tss_its_in_state_tax_group' }));
                                    a_Columns.push(search.createColumn({ name: 'custrecord_tss_its_out_state_tax_group' }));
                                    a_Columns.push(search.createColumn({ name: 'custrecord_tss_its_rcm_in_state_taxgroup' }));
                                    a_Columns.push(search.createColumn({ name: 'custrecord_tss_its_rcm_out_state_taxgrp' }));
                                    var taxGroupsearch = search.create({
                                        type: 'customrecord_tss_its_tax_group_deter',
                                        filters: a_Filters,
                                        columns: a_Columns
                                    });
                                    var taxGroupsearch_result = taxGroupsearch.run().getRange(0, 100);
                                    // log.debug("taxGroupsearch_result in expense postSourcing", taxGroupsearch_result);


                                    //Removing Apply SEZ & RCM
                                    var LItemRcm = current_record.getCurrentSublistValue({
                                        sublistId: 'expense',
                                        fieldId: 'custcol_tss_rcm_apply',
                                    });
                                    var LItemSez = current_record.getCurrentSublistValue({
                                        sublistId: 'expense',
                                        fieldId: 'custcol_tss_sez',
                                    });
                                    var LItemSezLiable = current_record.getCurrentSublistValue({
                                        sublistId: 'expense',
                                        fieldId: 'custcol_tss_sez_tax_liable',
                                    });
                                    if (isTrue(LItemSezLiable)) {
                                        current_record.setCurrentSublistValue({
                                            sublistId: 'expense',
                                            fieldId: 'custcol_tss_sez_tax_liable',
                                            value: false
                                        });
                                    }
                                    if (isTrue(LItemRcm)) {
                                        current_record.setCurrentSublistValue({
                                            sublistId: 'expense',
                                            fieldId: "custcol_tss_rcm_apply",
                                            value: false
                                        });
                                    }
                                    if (isTrue(LItemSez)) {
                                        current_record.setCurrentSublistValue({
                                            sublistId: 'expense',
                                            fieldId: "custcol_tss_sez",
                                            value: false,
                                        });
                                    }
                                    var b_ImportL = current_record.getValue({ fieldId: "custbody_tss_import_gst" });
                                    if (i_Location_State == i_Place_Of_Service && i_Location_Type != "SEZ" && !isTrue(b_ImportL)) {
                                        // log.debug("taxGroupsearch_result.length in expense postSourcing", taxGroupsearch_result.length);
                                        if (taxGroupsearch_result.length > 0) {
                                            var i_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_in_state_tax_group' });
                                            if (_logValidation(i_Tax_Group)) {
                                                if (isTrue(g_VNR_RCM_applicable) && (!isTrue(vnr_Flag) || isTrue(rcm_Applicable_Expense))) {
                                                    var rcm_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_rcm_in_state_taxgroup' });
                                                    var rcm_Tax_Group_rate = getTaxGroupRate(rcm_Tax_Group);
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "taxcode",
                                                        value: g_VNR_InState,
                                                    });
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "custcol_tss_rcm_tax_code",
                                                        value: rcm_Tax_Group,
                                                    });
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "custcol_tss_rcm_apply",
                                                        value: true
                                                    });
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "custcol_tss_rcm_rate",
                                                        value: parseFloat(rcm_Tax_Group_rate)
                                                    });
                                                }
                                                else {
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "taxcode",
                                                        value: i_Tax_Group
                                                    });
                                                }
                                            } // end if (_logValidation(i_Tax_Group))
                                        }
                                        else {
                                            //alert("You are not created Tax Group Determination record for Current line Expense Category - " + L_Category_name);
                                            current_record.setCurrentSublistValue({
                                                sublistId: 'expense',
                                                fieldId: "taxcode",
                                                value: g_taxcode,
                                            });
                                        }

                                    }// end if(i_Location_State == i_Place_Of_Service && i_Location_Type != "SEZ")

                                    else {
                                        if (taxGroupsearch_result.length > 0) {
                                            var i_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_out_state_tax_group' });
                                            if (_logValidation(i_Tax_Group)) {
                                                if (i_Location_Type == 'SEZ') {
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "taxcode",
                                                        value: g_sezCode,
                                                    });
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "custcol_tss_sez",
                                                        value: true,
                                                    });
                                                    if (sezLiableDefault) {
                                                        current_record.setCurrentSublistValue({
                                                            sublistId: 'expense',
                                                            fieldId: "custcol_tss_sez_tax_liable",
                                                            value: true,
                                                        });
                                                        current_record.setCurrentSublistValue({
                                                            sublistId: 'expense',
                                                            fieldId: "taxcode",
                                                            value: i_Tax_Group
                                                        });
                                                    }
                                                }
                                                else if (isTrue(g_VNR_RCM_applicable) && (!isTrue(vnr_Flag) || isTrue(rcm_Applicable_Expense))) {
                                                    var rcm_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_rcm_out_state_taxgrp' });
                                                    var rcm_Tax_Group_rate = getTaxGroupRate(rcm_Tax_Group);
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "taxcode",
                                                        value: g_VNR_OutState,
                                                    });
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "custcol_tss_rcm_tax_code",
                                                        value: rcm_Tax_Group,
                                                    });
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "custcol_tss_rcm_apply",
                                                        value: true
                                                    });
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "custcol_tss_rcm_rate",
                                                        value: parseFloat(rcm_Tax_Group_rate)
                                                    });
                                                }
                                                else {
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "taxcode",
                                                        value: i_Tax_Group
                                                    });
                                                }
                                            } // end if (_logValidation(i_Tax_Group))
                                        }
                                        else {
                                            if (i_Location_Type == 'SEZ') {
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "taxcode",
                                                    value: g_sezCode,
                                                });
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "custcol_tss_sez",
                                                    value: true,
                                                });
                                                if (sezLiableDefault) {
                                                    current_record.setCurrentSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "custcol_tss_sez_tax_liable",
                                                        value: true,
                                                    });
                                                }
                                            }
                                            else {
                                                // alert("You are not created Tax Group Determination record for Current line Expense Category - " + L_Category_name);
                                                current_record.setCurrentSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "taxcode",
                                                    value: g_taxcodeIGST,

                                                });
                                            }

                                        }

                                    } // end else
                                } // end if(_logValidation(i_Location_State) && _logValidation(i_State))

                            } // end if(_logValidation(i_Account) && isTrue(Flag))
                            if (isTrue(Flag) && (s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'check')) {
                                try {
                                    if (!g_useAccExpGSTAuto) {
                                        var values = search.lookupFields({
                                            type: 'expensecategory',
                                            id: L_Category,
                                            columns: ['custrecord_tss_tax_liable', 'custrecord_tss_its_exp_hsn', 'custrecord_tss_itc_ineligible']
                                        });
                                    }
                                    else if (g_useAccExpGSTAuto) {
                                        var values = search.lookupFields({
                                            type: 'account',
                                            id: i_Account,
                                            columns: ['custrecord_tss_tax_act_liable', 'custrecord_tss_its_act_hsn', 'custrecord_tss_act_itc_ineligible']
                                        });
                                    }
                                }
                                catch (e) {
                                    var values = {};
                                    if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {

                                        var resposeObject = '';
                                        if (!g_useAccExpGSTAuto) {
                                            resposeObject = https.requestSuitelet({
                                                scriptId: "customscript_sut_tss_exp_item_data",
                                                deploymentId: "customdeploy1",
                                                urlParams: {
                                                    's_expense': L_Category
                                                }
                                            });
                                        }
                                        else if (g_useAccExpGSTAuto) {
                                            var resposeObject = '';
                                            resposeObject = https.requestSuitelet({
                                                scriptId: "customscript_sut_tss_exp_item_data",
                                                deploymentId: "customdeploy1",
                                                urlParams: {
                                                    's_account': i_Account
                                                }
                                            });
                                        }
                                        log.debug("resposeObject from SUT_TSS_Exp_Item_Data", resposeObject);
                                        if (_logValidation(resposeObject)) {
                                            var respBody = JSON.parse(resposeObject.body);
                                            log.debug("respBody from SUT_TSS_Exp_Item_Data", respBody);
                                            if (_logValidation(respBody) && respBody.length > 0) {
                                                var ExLiab = respBody[0].taxLiable;
                                                log.debug("ExLiab from SUT_TSS_Exp_Item_Data", ExLiab);
                                                var exhsnsac = respBody[0].hsnsac;
                                                log.debug("exhsnsac from SUT_TSS_Exp_Item_Data", exhsnsac);
                                                var exITC = isTrue(respBody[0].s_ITC);
                                                log.debug("exITC from SUT_TSS_Exp_Item_Data", exITC);
                                                if (g_useAccExpGSTAuto) {
                                                    values = { 'custrecord_tss_its_act_hsn': exhsnsac, 'custrecord_tss_tax_act_liable': ExLiab, 'custrecord_tss_act_itc_ineligible': exITC }
                                                }
                                                else if (!g_useAccExpGSTAuto) {
                                                    values = { 'custrecord_tss_its_exp_hsn': exhsnsac, 'custrecord_tss_tax_liable': ExLiab, 'custrecord_tss_itc_ineligible': exITC }
                                                }
                                            }
                                        }

                                    }

                                }// end catch(e)
                                if (_logValidation(values)) {
                                    if (!g_useAccExpGSTAuto) {
                                        var s_HSN_SAC = values.custrecord_tss_its_exp_hsn;
                                        var s_ITC = values.custrecord_tss_itc_ineligible;
                                        if (values.custrecord_tss_tax_liable.length > 0) {
                                            var i_Tax_Liable = values.custrecord_tss_tax_liable[0].value;
                                        }
                                    }
                                    else if (g_useAccExpGSTAuto) {
                                        var s_HSN_SAC = values.custrecord_tss_its_act_hsn;
                                        var s_ITC = values.custrecord_tss_act_itc_ineligible;
                                        if (values.custrecord_tss_tax_act_liable.length > 0) {
                                            var i_Tax_Liable = values.custrecord_tss_tax_act_liable[0].value;
                                        }
                                    }
                                    if (_logValidation(s_HSN_SAC)) {
                                        current_record.setCurrentSublistValue({
                                            sublistId: 'expense',
                                            fieldId: "custcol_tss_hsn_sac_expense_line",
                                            value: s_HSN_SAC
                                        });
                                    }
                                    if (_logValidation(i_Tax_Liable)) {
                                        current_record.setCurrentSublistValue({
                                            sublistId: 'expense',
                                            fieldId: "custcol_tss_tax_liable_expenseline",
                                            value: i_Tax_Liable
                                        });
                                    }
                                    if (isTrue(s_ITC) || inelibleITCdefault) {
                                        current_record.setCurrentSublistValue({
                                            sublistId: 'expense',
                                            fieldId: "custcol_tss_itc_ineligible",
                                            value: true
                                        });
                                    }
                                } // end if(_logValidation(values))
                            } // end if(isTrue(Flag) && (s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'check'))


                        } // end  if ((!g_useAccExpGSTAuto && _logValidation(L_Category)) || (g_useAccExpGSTAuto && _logValidation(i_Account)))

                    } // end try
                    catch (e) {
                        log.error("Error in Expense sublist postSourcing", e);
                    }
                }

            } // end try
            catch (e) {
                log.error("Error in postSourcing", e);
            } // end catch(e)

        } // end function postSourcing(scriptContext)

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
            try {
                var current_record = scriptContext.currentRecord;
                var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                if (isTrue(Flag)) {
                    if (scriptContext.sublistId == 'item' || scriptContext.sublistId == 'expense') {
                        var RcmApply = current_record.getCurrentSublistValue({
                            sublistId: scriptContext.sublistId,
                            fieldId: "custcol_tss_rcm_apply"
                        });
                        var sublistObj = current_record.getSublist({ sublistId: scriptContext.sublistId });
                        if (isTrue(RcmApply)) {
                            sublistObj.getColumn({
                                fieldId: 'custcol_tss_rcm_tax_code',
                            }).isDisabled = false;
                            sublistObj.getColumn({
                                fieldId: 'custcol_tss_rcm_tax_code',
                            }).isMandatory = true;
                        } // end if(isTrue(RcmApply))
                        else {
                            var rectype = current_record.type;
                            if (rectype == 'purchaseorder' || rectype == 'vendorbill' || rectype == 'vendorcredit' || rectype == 'check') {
                                sublistObj.getColumn({
                                    fieldId: 'custcol_tss_rcm_tax_code',
                                }).isDisabled = true;
                                sublistObj.getColumn({
                                    fieldId: 'custcol_tss_rcm_tax_code',
                                }).isMandatory = false;
                            }

                        }
                    } // end if(scriptContext.sublistId == 'item' || scriptContext.sublistId == 'expense')
                }
            } // end try
            catch (e) {
                log.error("Error in lineInit", e);
            } // end catch(e)
        } // end function lineInit(scriptContext)

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
            try {

                if (scriptContext.sublistId == 'item' || scriptContext.sublistId == 'expense') {
                    var current_record = scriptContext.currentRecord;
                    var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                    if (isTrue(Flag)) {
                        var i_Location = current_record.getCurrentSublistValue({
                            sublistId: scriptContext.sublistId,
                            fieldId: "location"
                        });
                        //log.audit("Location in Item postSourcing",i_Location);
                        if (!_logValidation(i_Location)) {
                            var sublistObj = current_record.getSublist({ sublistId: scriptContext.sublistId });
                            var LineLocField = sublistObj.getColumn({
                                fieldId: 'location'
                            });
                            //log.audit("LineLocField in Item postSourcing",LineLocField);
                            var rec_Location = current_record.getValue({ fieldId: "location" });
                            if (_logValidation(LineLocField)) {
                                // alert(LineLocField)
                                if (_logValidation(rec_Location)) {
                                    alert("Please Enter Location in current line");
                                    return false;
                                }
                            }

                        } // if (!_logValidation(i_Location))
                    } // end if(isTrue(Flag))
                } // end if (scriptContext.sublistId == 'expense' || scriptContext.sublistId == 'expense')

                if (scriptContext.sublistId == 'expense') {
                    var current_record = scriptContext.currentRecord;
                    var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                    var s_Record_Type = current_record.type;
                    try {

                        var i_Account = current_record.getCurrentSublistValue({
                            sublistId: 'expense',
                            fieldId: "account",
                        });
                        var i_Category = current_record.getCurrentSublistValue({
                            sublistId: 'expense',
                            fieldId: "category",
                        });
                        var i_TaxCode = current_record.getCurrentSublistValue({
                            sublistId: 'expense',
                            fieldId: "taxcode",
                        });
                        var i_TaxCode_Name = current_record.getCurrentSublistText({
                            sublistId: 'expense',
                            fieldId: "taxcode",
                        });
                        var sezLiable = current_record.getCurrentSublistValue({
                            sublistId: 'expense',
                            fieldId: "custcol_tss_sez_tax_liable",
                        });
                        var b_Import = current_record.getValue({ fieldId: "custbody_tss_import_gst" });

                        if (_logValidation(i_Account) && isTrue(Flag) && ((!g_useAccExpGSTAuto && _logValidation(i_Category)) || g_useAccExpGSTAuto)) {

                            var i_Location;
                            var i_State;
                            var i_Location_State;
                            var i_Location_Type;
                            if (s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'check') {
                                i_State = current_record.getValue({ fieldId: "custbody_tss_placeof_supply" });
                                i_Location = current_record.getCurrentSublistValue({
                                    sublistId: 'expense',
                                    fieldId: "location",
                                });
                                if (_nullValidation(i_Location)) {
                                    var recLoc = current_record.getValue({ fieldId: "location" });
                                    i_Location = recLoc;
                                }
                                var i_Place_Of_Service = current_record.getValue({ fieldId: "custbody_tss_place_of_service" });
                                //i_Location_State = i_Place_Of_Service;
                                if (_logValidation(i_Location)) {
                                    //if (_nullValidation(i_Place_Of_Service)) {
                                    try {
                                        var loc_Obj = search.lookupFields({
                                            type: 'location',
                                            id: i_Location,
                                            columns: ['custrecord_tss_its_location_statename', 'custrecord_tss_gst_type_location']
                                        });
                                        if (loc_Obj.custrecord_tss_its_location_statename.length > 0) {
                                            i_Location_State = loc_Obj.custrecord_tss_its_location_statename[0].value;
                                            log.debug("i_Location_State in validateLine", i_Location_State);

                                        }
                                        if (loc_Obj.custrecord_tss_gst_type_location.length > 0) {
                                            i_Location_Type = loc_Obj.custrecord_tss_gst_type_location[0].text;
                                            log.debug("i_Location_Type in validateLine", i_Location_Type);
                                        }

                                    }
                                    catch (e) {
                                        if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {
                                            var resposeObject = https.requestSuitelet({
                                                scriptId: "customscript_sut_tss_get_location_data",
                                                deploymentId: "customdeploy1",
                                                // external: true,
                                                urlParams: {
                                                    's_Location': i_Location
                                                }
                                            });
                                            //log.debug("resposeObject of SUT_TSS_Get_Location_Data",resposeObject);
                                            var respBody = JSON.parse(resposeObject.body);
                                            if (_logValidation(respBody) && respBody.length > 0) {
                                                i_Location_State = respBody[0].i_Location_State;
                                                log.debug("i_Location_State from SUT_TSS_Get_Location_Data", i_Location_State);
                                                i_Location_Type = respBody[0].i_Location_Type;
                                                log.debug("i_Location_Type from SUT_TSS_Get_Location_Data", i_Location_Type);
                                            }
                                        }

                                    }// end catch(e)
                                    //} // end if(_nullValidation(i_Place_Of_Service))
                                } // end if(_logValidation(i_Location))
                                if (_nullValidation(i_Location_State)) {
                                    i_Location_State = i_State;
                                    if (_nullValidation(i_Location_State)) {
                                        alert('Kindly enter line level Location and also check if body Level Location or Place Of Supply is entered, if not please enter');
                                        return false;
                                    }
                                }
                                log.debug("i_Place_Of_Service in validateLine", i_Place_Of_Service);
                                if (i_Location_State != i_Place_Of_Service || i_Location_Type == 'SEZ') {
                                    log.debug("i_TaxCode in validateLine", i_TaxCode)
                                    if (_logValidation(i_TaxCode)) {
                                        var taxAccounts = getTaxaccount(i_TaxCode);
                                        for (var i = 0; i < taxAccounts.length; i++) {
                                            var s_TaxName = taxAccounts[i];
                                            if (_logValidation(s_TaxName)) {
                                                var igst_index = s_TaxName.indexOf('IGST');
                                                var cess_index = s_TaxName.indexOf('CESS');
                                                var cgst_index = s_TaxName.indexOf('CGST');
                                                var sgst_index = s_TaxName.indexOf('SGST');
                                                var gst_index = s_TaxName.indexOf('GST');
                                                if (igst_index >= 0 || cess_index >= 0) {
                                                    //return true;
                                                }
                                                else if (cgst_index >= 0 || sgst_index >= 0 || gst_index >= 0) {
                                                    if (i_Location_Type == 'SEZ') {
                                                        if (!isTrue(sezLiable)) {
                                                            alert("As SEZ applied in current line. Taxcode should be IGST Zero%");
                                                            return false;
                                                        }
                                                        else {
                                                            alert("As SEZ applied in current line. Taxcode should be IGST");
                                                            return false;
                                                        }
                                                    }
                                                    else {
                                                        alert('Kindly Check the Tax Group Determination Record for Expense Category as Inter State Tax Group should be applied. It means Inter State Tax should not be CGST/SGST/GST.');
                                                        return false;
                                                    }
                                                }
                                            }
                                            else {
                                                alert('Kindly enter Tax Type for TaxCode record - ' + i_TaxCode_Name);
                                                return false;
                                            }
                                        }

                                    }// end if(_logValidation(i_TaxCode))
                                    var l_IsRCM = current_record.getCurrentSublistValue({
                                        sublistId: 'expense',
                                        fieldId: "custcol_tss_rcm_apply",
                                    });
                                    if (isTrue(l_IsRCM) && (i_Location_Type != 'SEZ' || (i_Location_Type == 'SEZ' && isTrue(sezLiable)))) {
                                        var l_RCMcode = current_record.getCurrentSublistValue({
                                            sublistId: 'expense',
                                            fieldId: "custcol_tss_rcm_tax_code",
                                        });
                                        if (_logValidation(l_RCMcode)) {
                                            var taxAccounts = getTaxaccount(l_RCMcode);
                                            for (var i = 0; i < taxAccounts.length; i++) {
                                                var s_TaxName = taxAccounts[i];
                                                if (_logValidation(s_TaxName)) {
                                                    var igst_index = s_TaxName.indexOf('RCM IGST');
                                                    var cess_index = s_TaxName.indexOf('CESS');
                                                    var cgst_index = s_TaxName.indexOf('RCM CGST');
                                                    var sgst_index = s_TaxName.indexOf('RCM SGST');
                                                    var gst_index = s_TaxName.indexOf('RCM GST');
                                                    if (igst_index >= 0) {
                                                        //return true;
                                                    }
                                                    else if (cgst_index >= 0 || sgst_index >= 0 || gst_index >= 0) {
                                                        alert('Kindly Enter RCM IGST group in RCM Tax Code field as Inter State RCM applied. It should be RCM IGST.');
                                                        return false;
                                                    }
                                                }
                                            }
                                        } // end if (_logValidation(l_RCMcode))
                                    } // end if (isTrue(l_IsRCM))
                                } // end if(i_Location_State != i_Place_Of_Service || i_Location_Type == 'SEZ' || isTrue(b_Import))
                                else {
                                    if (!isTrue(b_Import)) {
                                        if (_logValidation(i_TaxCode)) {
                                            var taxAccounts = getTaxaccount(i_TaxCode);
                                            for (var i = 0; i < taxAccounts.length; i++) {
                                                var s_TaxName = taxAccounts[i];
                                                if (_logValidation(s_TaxName)) {
                                                    var igst_index = s_TaxName.indexOf('IGST');
                                                    var cess_index = s_TaxName.indexOf('CESS');
                                                    var cgst_index = s_TaxName.indexOf('CGST');
                                                    var sgst_index = s_TaxName.indexOf('SGST');
                                                    if (cgst_index >= 0 || sgst_index >= 0) {
                                                        //return true;
                                                    }
                                                    else if (igst_index >= 0 || cess_index >= 0)//if(igst_index < 0)
                                                    {
                                                        alert('Kindly Check the Tax Group Determination Record for Expense as Intra State Tax Group should be applied(It should be GST).');
                                                        return false;
                                                    }
                                                }
                                                else {
                                                    alert('Kindly enter Tax Type for ' + i_Tax_Code_Name);
                                                    return false;
                                                }
                                            }
                                        }// end if(_logValidation(i_TaxCode))
                                    } // end if(!isTrue(b_Import))

                                    var l_IsRCM = current_record.getCurrentSublistValue({
                                        sublistId: 'expense',
                                        fieldId: "custcol_tss_rcm_apply",
                                    });
                                    if (isTrue(l_IsRCM)) {
                                        var l_RCMcode = current_record.getCurrentSublistValue({
                                            sublistId: 'expense',
                                            fieldId: "custcol_tss_rcm_tax_code",
                                        });
                                        if (_logValidation(l_RCMcode)) {
                                            var taxAccounts = getTaxaccount(l_RCMcode);
                                            for (var i = 0; i < taxAccounts.length; i++) {
                                                var s_TaxName = taxAccounts[i];
                                                if (_logValidation(s_TaxName)) {
                                                    var igst_index = s_TaxName.indexOf('RCM IGST');
                                                    var cess_index = s_TaxName.indexOf('CESS');
                                                    var cgst_index = s_TaxName.indexOf('RCM CGST');
                                                    var sgst_index = s_TaxName.indexOf('RCM SGST');
                                                    var gst_index = s_TaxName.indexOf('RCM GST');
                                                    if (cgst_index >= 0 || sgst_index >= 0) {
                                                        //return true;
                                                        if (b_Import) {
                                                            alert('As Import/Export transactions, RCM Tax Code should be IGST.');
                                                            return false;
                                                        }
                                                    }
                                                    else if (igst_index >= 0) {
                                                        if (!b_Import) {
                                                            alert('Kindly Enter RCM GST tax group in RCM Tax Code field as Intra State RCM applied. It should not be RCM IGST.');
                                                            return false;
                                                        }
                                                    }
                                                }
                                            }
                                        } // end if (_logValidation(l_RCMcode))
                                    } // end if (isTrue(l_IsRCM))
                                } // else



                            }// end if(s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'purchaseorder')

                        } // end if (_logValidation(i_Account) && isTrue(Flag) && (!g_useAccExpGSTAuto && _logValidation(i_Category))) {

                        var i_HSN_SAC = current_record.getCurrentSublistValue({
                            sublistId: 'expense',
                            fieldId: "custcol_tss_hsn_sac_expense_line",
                        });

                        var i_Tax_Rate = current_record.getCurrentSublistValue({
                            sublistId: 'expense',
                            fieldId: "taxrate1",
                        });
                        if (_logValidation(i_HSN_SAC) && isTrue(Flag) && _logValidation(i_Tax_Rate)) {
                            if (s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'check') {
                                if (_logValidation(i_TaxCode)) {
                                    // var taxAccounts = getTaxaccount_RCM(i_TaxCode);
                                    // var b_RCM_Applicable = taxAccounts[0];
                                    var isRCM = current_record.getCurrentSublistValue({
                                        sublistId: 'expense',
                                        fieldId: "custcol_tss_rcm_apply",
                                    });

                                    var isSEZ = current_record.getCurrentSublistValue({
                                        sublistId: 'expense',
                                        fieldId: "custcol_tss_sez",
                                    });
                                    if (isTrue(isRCM)) {
                                        if (parseInt(i_Tax_Rate) > 0) {
                                            alert("Current Line has RCM applied, User should apply Zero% Taxcode");
                                            return false;
                                        }
                                    }
                                    else if (isTrue(isSEZ) && !isTrue(sezLiable)) {
                                        if (parseInt(i_Tax_Rate) > 0) {
                                            alert("Current Line has SEZ applied, User should apply Zero% Taxcode");
                                            return false;
                                        }
                                    }
                                    else {
                                        var a_Filters = new Array();
                                        var a_Columns = new Array();
                                        a_Filters.push(search.createFilter({
                                            name: 'isinactive',
                                            operator: 'is',
                                            values: 'F'
                                        }));
                                        a_Filters.push(search.createFilter({
                                            name: 'custrecord_tss_hsn_sac',
                                            operator: 'is',
                                            values: i_HSN_SAC
                                        }));

                                        a_Columns.push(search.createColumn({ name: 'custrecord_tss_tax_rate' }));

                                        var hsn_search = search.create({
                                            type: 'customrecord_tss_gst_rate_master',
                                            filters: a_Filters,
                                            columns: a_Columns
                                        });
                                        var hsn_search_results = hsn_search.run().getRange(0, 100);
                                        if (hsn_search_results.length > 0) {
                                            var i_HSN_Tax_Rate = hsn_search_results[0].getValue({ name: 'custrecord_tss_tax_rate' });
                                            if (_logValidation(i_HSN_Tax_Rate)) {
                                                if (parseFloat(i_Tax_Rate) == parseFloat(i_HSN_Tax_Rate)) {
                                                    //return true;
                                                }
                                                else if (parseFloat(i_Tax_Rate) != parseFloat(i_HSN_Tax_Rate)) {
                                                    alert('Kindly Check the HSN Number = ' + i_HSN_SAC + ' with HSN Rate = ' + i_HSN_Tax_Rate + ' do not match the Tax Code Rate = ' + i_Tax_Rate + '%');
                                                    //return false;
                                                }
                                            } // end if(_logValidation(i_HSN_Tax_Rate))

                                            else {
                                                alert('Kindly Check the HSN Number = ' + i_HSN_SAC + ' with Empty HSN Rate do not match the Tax Code Rate = ' + i_Tax_Rate + '%');
                                            }
                                        }



                                    }// end else
                                }
                            }// end if(s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'purchaseorder')
                        } // end if(_logValidation(i_HSN_SAC) && isTrue(Flag) && _logValidation(i_Tax_Rate))


                        if (_logValidation(i_TaxCode) && isTrue(b_Import) && isTrue(Flag)) {

                            if ((((_logValidation(i_Category) && !g_useAccExpGSTAuto) || (g_useAccExpGSTAuto && _logValidation(i_Account))) && _logValidation(i_TaxCode)) && s_Record_Type == 'vendorbill' || s_Record_Type == 'purchaseorder') {
                                var taxAccounts = getTaxaccount(i_TaxCode);
                                for (var i = 0; i < taxAccounts.length; i++) {
                                    var s_TaxName = taxAccounts[i];
                                    if (_logValidation(s_TaxName)) {
                                        var igst_index = s_TaxName.indexOf('IGST');
                                        var cess_index = s_TaxName.indexOf('CESS');
                                        var cgst_index = s_TaxName.indexOf('CGST');
                                        var sgst_index = s_TaxName.indexOf('SGST');
                                        if (igst_index >= 0 || cess_index >= 0) {
                                            //return true;
                                        }
                                        else if (cgst_index >= 0 || sgst_index >= 0)//if(igst_index < 0)
                                        {
                                            alert('As Import check is Applied User needs to select IGST Tax Code. Please verify the Tax Group Record', i_TaxCode);
                                            return false;
                                        }
                                    }
                                    else {
                                        alert('Kindly enter Tax Type for ' + i_TaxCode_Name);
                                        return false;
                                    }
                                }

                            } // end if ((((_logValidation(i_Category) && !g_useAccExpGSTAuto) || (g_useAccExpGSTAuto && _logValidation(i_Account))) && _logValidation(i_TaxCode)) && s_Record_Type == 'vendorbill' || s_Record_Type == 'purchaseorder') {


                        } // end if(_logValidation(i_TaxCode) && isTrue(b_Import)  && isTrue(Flag))

                    }// end try
                    catch (e) {
                        log.error("Error in Expense Sublist ValidateLine", e);
                    }
                } // end if(scriptContext.sublistId == 'expense')


                if (scriptContext.sublistId == 'item') {
                    var current_record = scriptContext.currentRecord;
                    var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                    var s_Record_Type = current_record.type;
                    try {
                        var i_Item = current_record.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: "item",
                        });
                        var i_TaxCode = current_record.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: "taxcode",
                        });
                        var i_Tax_Code_Name = current_record.getCurrentSublistText({
                            sublistId: 'item',
                            fieldId: "taxcode",
                        });
                        var i_HSN_SAC = current_record.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: "custcol_tss_transaction_hsn_sac",
                        });
                        var i_Tax_Rate = current_record.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: "taxrate1",
                        });
                        var sezLiable = current_record.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: "custcol_tss_sez_tax_liable",
                        });
                        var b_Import = current_record.getValue({ fieldId: "custbody_tss_import_gst" });
                        var b_Export = current_record.getValue({ fieldId: "custbody_tss_export_gst" });
                        var Temp_Export_Import = false;
                        if (s_Record_Type == 'cashsale' || s_Record_Type == 'invoice' || s_Record_Type == 'creditmemo' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate') {
                            if (isTrue(b_Export)) {
                                Temp_Export_Import = true;
                            }
                        }
                        else if (s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'check') {
                            if (isTrue(b_Import)) {
                                Temp_Export_Import = true;
                            }
                        }
                        var i_Location_State;
                        var i_State;
                        var i_Location_Type;
                        if (_logValidation(i_Item) && isTrue(Flag)) {
                            var i_Location;
                            // if (s_Record_Type == 'cashsale' || s_Record_Type == 'invoice' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'creditmemo' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'purchaseorder') {
                            i_Location = current_record.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: "location",
                            });
                            if (_nullValidation(i_Location)) {
                                var recLoc = current_record.getValue({ fieldId: "location" });
                                i_Location = recLoc;
                            }
                            i_State = current_record.getValue({ fieldId: "custbody_tss_placeof_supply" });
                            var i_Place_Of_Service = current_record.getValue({ fieldId: "custbody_tss_place_of_service" });
                            // if ((s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'cashsale' || s_Record_Type == 'invoice' || s_Record_Type == 'salesorder' || s_Record_Type == 'creditmemo') && _logValidation(i_Place_Of_Service)) {
                            //     i_Location_State = i_Place_Of_Service;
                            // }
                            if (_logValidation(i_Location)) {
                                //if (_nullValidation(i_Place_Of_Service)) {
                                try {
                                    var loc_Obj = search.lookupFields({
                                        type: 'location',
                                        id: i_Location,
                                        columns: ['custrecord_tss_its_location_statename', 'custrecord_tss_gst_type_location']
                                    });
                                    if (loc_Obj.custrecord_tss_its_location_statename.length > 0) {
                                        i_Location_State = loc_Obj.custrecord_tss_its_location_statename[0].value;
                                        log.debug("i_Location_State in validateLine", i_Location_State);
                                    }
                                    if (loc_Obj.custrecord_tss_gst_type_location.length > 0) {
                                        i_Location_Type = loc_Obj.custrecord_tss_gst_type_location[0].text;
                                        log.debug("i_Location_Type in validateLine", i_Location_Type);
                                    }


                                }
                                catch (e) {
                                    if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {
                                        var resposeObject = https.requestSuitelet({
                                            scriptId: "customscript_sut_tss_get_location_data",
                                            deploymentId: "customdeploy1",
                                            // external: true,
                                            urlParams: {
                                                's_Location': i_Location
                                            }
                                        });
                                        //log.debug("resposeObject of SUT_TSS_Get_Location_Data",resposeObject);
                                        var respBody = JSON.parse(resposeObject.body);
                                        if (_logValidation(respBody) && respBody.length > 0) {
                                            i_Location_State = respBody[0].i_Location_State;
                                            log.debug("i_Location_State from SUT_TSS_Get_Location_Data", i_Location_State);
                                            i_Location_Type = respBody[0].i_Location_Type;
                                            log.debug("i_Location_Type from SUT_TSS_Get_Location_Data", i_Location_Type);
                                        }
                                    }

                                }// end catch(e)

                                //} // end if(_nullValidation(i_Place_Of_Service))
                            } // end if(_logValidation(i_Location))
                            // } // end if(s_Record_Type == 'cashsale' || s_Record_Type == 'invoice' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'creditmemo' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'purchaseorder')
                            var iStateCompare = '';
                            var iStateCompareText = '';
                            if (s_Record_Type == 'cashsale' || s_Record_Type == 'invoice' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'creditmemo') {
                                iStateCompare = i_State;
                                iStateCompareText = 'Place Of Supply';
                                if (_nullValidation(i_Location_State)) {
                                    i_Location_State = i_Place_Of_Service;
                                }
                            }
                            else if (s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'purchaseorder') {
                                iStateCompare = i_Place_Of_Service;
                                iStateCompareText = 'Place Of Service';
                                if (_nullValidation(i_Location_State)) {
                                    i_Location_State = i_State;
                                }
                            }

                            if (_logValidation(i_Location_State) && _logValidation(iStateCompare)) {
                                if (i_Location_State != iStateCompare || i_Location_Type == 'SEZ') {
                                    if (_logValidation(i_TaxCode)) {
                                        var taxAccounts = getTaxaccount(i_TaxCode);
                                        for (var i = 0; i < taxAccounts.length; i++) {
                                            var s_TaxName = taxAccounts[i];
                                            if (_logValidation(s_TaxName)) {
                                                var igst_index = s_TaxName.indexOf('IGST');
                                                var cess_index = s_TaxName.indexOf('CESS');
                                                var cgst_index = s_TaxName.indexOf('CGST');
                                                var sgst_index = s_TaxName.indexOf('SGST');
                                                var gst_index = s_TaxName.indexOf('GST');
                                                if (igst_index >= 0 || cess_index >= 0) {
                                                    //return true;
                                                }
                                                else if (cgst_index >= 0 || sgst_index >= 0 || gst_index >= 0)//if(igst_index < 0)
                                                {
                                                    if (i_Location_Type == 'SEZ') {
                                                        if (!isTrue(sezLiable)) {
                                                            alert("As SEZ applied in current line. Taxcode should be IGST Zero%");
                                                            return false;
                                                        }
                                                        else {
                                                            alert("As SEZ applied in current line. Taxcode should be IGST");
                                                            return false;
                                                        }
                                                    }
                                                    else {
                                                        var igstResp = confirm('Kindly Check the Tax Group Determination Record for Item as Inter State Tax Group should be applied(It should be IGST).');
                                                        //if(igstResp != false && igstResp != 'false' && igstResp != 'F'){
                                                        return false;
                                                        //}
                                                    }

                                                }
                                            }
                                            else {
                                                alert('Kindly enter Tax Type for ' + i_Tax_Code_Name);
                                                return false;
                                            }
                                        }
                                    }// end if(_logValidation(i_TaxCode))
                                    var l_IsRCM = current_record.getCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: "custcol_tss_rcm_apply",
                                    });
                                    if (isTrue(l_IsRCM) && (i_Location_Type != 'SEZ' || (i_Location_Type == 'SEZ' && isTrue(sezLiable)))) {
                                        var l_RCMcode = current_record.getCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId: "custcol_tss_rcm_tax_code",
                                        });
                                        var taxAccounts = getTaxaccount(l_RCMcode);
                                        for (var i = 0; i < taxAccounts.length; i++) {
                                            var s_TaxName = taxAccounts[i];
                                            if (_logValidation(s_TaxName)) {
                                                var igst_index = s_TaxName.indexOf('RCM IGST');
                                                var cess_index = s_TaxName.indexOf('CESS');
                                                var cgst_index = s_TaxName.indexOf('RCM CGST');
                                                var sgst_index = s_TaxName.indexOf('RCM SGST');
                                                var gst_index = s_TaxName.indexOf('RCM GST');
                                                if (igst_index >= 0) {
                                                    //return true;
                                                }
                                                else if (cgst_index >= 0 || sgst_index >= 0 || gst_index >= 0) {
                                                    if (i_Location_Type == 'SEZ' && isTrue(sezLiable)) {
                                                        alert('Please select the "RCM IGST" Tax Group in the RCM Tax Code field when SEZ is applicable.');
                                                    }
                                                    else {
                                                        alert('Please select the "RCM IGST" Tax Group in the RCM Tax Code field for Interstate transactions.');
                                                    }
                                                    return false;
                                                }
                                            }
                                        } // end for (var i = 0; i < taxAccounts.length; i++)
                                    } // end if (isTrue(l_IsRCM) && i_Location_Type != 'SEZ')
                                }// end if (i_Location_State != iStateCompare || i_Location_Type == 'SEZ')
                                else {
                                    if (!isTrue(Temp_Export_Import)) {
                                        if (_logValidation(i_TaxCode)) {
                                            var taxAccounts = getTaxaccount(i_TaxCode);
                                            for (var i = 0; i < taxAccounts.length; i++) {
                                                var s_TaxName = taxAccounts[i];
                                                if (_logValidation(s_TaxName)) {
                                                    var igst_index = s_TaxName.indexOf('IGST');
                                                    var cess_index = s_TaxName.indexOf('CESS');
                                                    var cgst_index = s_TaxName.indexOf('CGST');
                                                    var sgst_index = s_TaxName.indexOf('SGST');
                                                    if (cgst_index >= 0 || sgst_index >= 0) {
                                                        //return true;
                                                    }
                                                    else if (igst_index >= 0 || cess_index >= 0)//if(igst_index < 0)
                                                    {
                                                        alert('Kindly Check the Tax Group Determination Record for Item as Intra State Tax Group should be applied(It should be GST).');
                                                        return false;
                                                    }
                                                }
                                                else {
                                                    alert('Kindly enter Tax Type for ' + i_Tax_Code_Name);
                                                    return false;
                                                }
                                            }
                                        }// end if(_logValidation(i_TaxCode))
                                    } // end if (!isTrue(Temp_Export_Import))
                                    var l_IsRCM = current_record.getCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: "custcol_tss_rcm_apply",
                                    });
                                    if (isTrue(l_IsRCM)) {
                                        var l_RCMcode = current_record.getCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId: "custcol_tss_rcm_tax_code",
                                        });
                                        var taxAccounts = getTaxaccount(l_RCMcode);
                                        for (var i = 0; i < taxAccounts.length; i++) {
                                            var s_TaxName = taxAccounts[i];
                                            if (_logValidation(s_TaxName)) {
                                                var igst_index = s_TaxName.indexOf('RCM IGST');
                                                var cess_index = s_TaxName.indexOf('CESS');
                                                var cgst_index = s_TaxName.indexOf('RCM CGST');
                                                var sgst_index = s_TaxName.indexOf('RCM SGST');
                                                if (cgst_index >= 0 || sgst_index >= 0) {
                                                    //return true;
                                                    if (Temp_Export_Import) {
                                                        alert('As Import/Export transactions, RCM Tax Code should be IGST.');
                                                        return false;
                                                    }
                                                }
                                                else if (igst_index >= 0) {
                                                    if (!Temp_Export_Import) {
                                                        alert('Kindly Enter RCM GST Tax Group in RCM Tax Code field as Intra State.(It should not be RCM IGST).');
                                                        return false;
                                                    }
                                                }
                                            }
                                        } // end for (var i = 0; i < taxAccounts.length; i++)
                                    } // end if (isTrue(l_IsRCM))
                                } // else
                            } // end if(_logValidation(i_Location_State) && _logValidation(iStateCompare))
                            else if (!_logValidation(i_Location_State)) {
                                alert('Kindly enter line level Location and also check if body Level Location or "' + iStateCompareText + '" is entered, if not please enter');
                                return false;
                            }
                        } // end if(_logValidation(i_Item) &&  isTrue(Flag))


                        if (_logValidation(i_HSN_SAC) && isTrue(Flag) && _logValidation(i_Tax_Rate)) {
                            var i_Export_Reason = current_record.getValue({ fieldId: "custbody_tss_gst_payment_under" });
                            if (_logValidation(i_Export_Reason) && i_Export_Reason == 2 && isTrue(b_Export)) {

                            }
                            else {
                                // if (s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'cashsale' || s_Record_Type == 'invoice' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'creditmemo') {
                                if (_logValidation(i_TaxCode)) {
                                    // var taxAccounts = getTaxaccount_RCM(i_TaxCode);
                                    // var b_RCM_Applicable = taxAccounts[0];
                                    var isRCM = current_record.getCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: "custcol_tss_rcm_apply",
                                    });
                                    var isSEZ = current_record.getCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: "custcol_tss_sez",
                                    });
                                    if (isTrue(isRCM)) {
                                        if (parseInt(i_Tax_Rate) > 0) {
                                            alert("Current Line has RCM applied, User should apply Zero% Taxcode");
                                            return false;
                                        }
                                    } // end if (isTrue(isRCM))
                                    else if (isTrue(isSEZ) && !isTrue(sezLiable)) {
                                        if (parseInt(i_Tax_Rate) > 0) {
                                            alert("Current Line has SEZ applied, User should apply Zero% Taxcode");
                                            return false;
                                        }
                                    }
                                    else {
                                        var a_Filters = new Array();
                                        var a_Columns = new Array();
                                        a_Filters.push(search.createFilter({
                                            name: 'isinactive',
                                            operator: 'is',
                                            values: 'F'
                                        }));
                                        a_Filters.push(search.createFilter({
                                            name: 'custrecord_tss_hsn_sac',
                                            operator: 'is',
                                            values: i_HSN_SAC
                                        }));
                                        a_Columns.push(search.createColumn({ name: 'custrecord_tss_tax_rate' }));
                                        var hsn_search = search.create({
                                            type: 'customrecord_tss_gst_rate_master',
                                            filters: a_Filters,
                                            columns: a_Columns
                                        });
                                        var hsn_search_results = hsn_search.run().getRange(0, 100);
                                        var i_HSN_Tax_Rate;
                                        if (hsn_search_results.length > 0) {
                                            i_HSN_Tax_Rate = hsn_search_results[0].getValue({ name: 'custrecord_tss_tax_rate' });
                                            if (_logValidation(i_HSN_Tax_Rate)) {
                                                if (parseFloat(i_Tax_Rate) == parseFloat(i_HSN_Tax_Rate)) {
                                                    //return true;
                                                }
                                                else if (parseFloat(i_Tax_Rate) != parseFloat(i_HSN_Tax_Rate)) {
                                                    alert('Kindly Check the HSN Number = ' + i_HSN_SAC + ' with HSN Rate = ' + i_HSN_Tax_Rate + ' do not match the Tax Code Rate = ' + i_Tax_Rate + '%');
                                                    //return false;
                                                }
                                            }
                                            else {
                                                alert('Kindly Check the HSN Number = ' + i_HSN_SAC + ' with Empty HSN Rate do not match the Tax Code Rate = ' + i_Tax_Rate + '%');
                                                //return false;
                                            }
                                        }
                                    }
                                } // end if(_logValidation(i_TaxCode))
                                // } // end if(s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'cashsale' || s_Record_Type == 'invoice' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'creditmemo')
                            }

                        } // end if(_logValidation(i_HSN_SAC) && isTrue(Flag) && _logValidation(i_Tax_Rate))

                        if (_logValidation(i_TaxCode) && isTrue(b_Export) && isTrue(Flag)) {
                            if (s_Record_Type == 'invoice' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'creditmemo' || s_Record_Type == 'cashsale') {
                                var i_Export_Reason = current_record.getValue({ fieldId: "custbody_tss_gst_payment_under" });
                                // Start Payment of GST Under Export == with Payment of GST
                                if (_logValidation(i_Export_Reason) && i_Export_Reason == 1) {
                                    var taxAccounts = getTaxaccount(i_TaxCode);
                                    for (var i = 0; i < taxAccounts.length; i++) {
                                        var s_TaxName = taxAccounts[i];
                                        if (_logValidation(s_TaxName)) {
                                            var igst_index = s_TaxName.indexOf('IGST');
                                            var cess_index = s_TaxName.indexOf('CESS');
                                            var cgst_index = s_TaxName.indexOf('CGST');
                                            var sgst_index = s_TaxName.indexOf('SGST');
                                            if (igst_index >= 0 || cess_index >= 0) {
                                                //return true;
                                            }
                                            else if (cgst_index >= 0 || sgst_index >= 0)//if(igst_index < 0)
                                            {
                                                alert('As Export check is Applied User needs to select IGST Tax Code. Please verify Tax Group ' + i_Tax_Code_Name + ' should have IGST Tax codes');
                                                return false;
                                            }
                                        }
                                        else {
                                            alert('Kindly enter Tax Type for ' + i_Tax_Code_Name);
                                            return false;
                                        }
                                    }
                                } // end if(_logValidation(i_Export_Reason) && i_Export_Reason == 1)
                                // End Payment of GST Under Export == with Payment of GST


                                // Start Payment of GST Under Export == without Payment of GST
                                if (_logValidation(i_Export_Reason) && i_Export_Reason == 2) {
                                    var taxAccounts = getTaxaccount_Export(i_TaxCode);
                                    for (var i = 0; i < taxAccounts.length; i = 2 + parseInt(i)) {
                                        var s_TaxName = taxAccounts[i];
                                        var i_Rate = taxAccounts[i + 1];

                                        //alert(i_Rate);
                                        if (_logValidation(s_TaxName)) {
                                            var igst_index = s_TaxName.indexOf('IGST');
                                            if (igst_index >= 0 && i_Rate == 0) {
                                                //return true;
                                            }
                                            else if (igst_index < 0 && i_Rate != 0) {
                                                alert('As Export is Applied under Without Payment of IGST. So, User needs to select Zero IGST Tax Code');
                                                return false;
                                            }
                                        }
                                        else {
                                            alert('Kindly enter Tax Type for ' + i_Tax_Code_Name);
                                            return false;
                                        }
                                    }
                                } // END if(_logValidation(i_Export_Reason) && i_Export_Reason == 2)
                                // End Payment of GST Under Export == without Payment of GST


                            } // end if(s_Record_Type == 'invoice' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'creditmemo' || s_Record_Type == 'cashsale')
                        } // end if(_logValidation(i_TaxCode) && isTrue(b_Export) && isTrue(Flag))

                        if (_logValidation(i_TaxCode) && isTrue(b_Import) && isTrue(Flag)) {
                            if (s_Record_Type == 'vendorbill' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'check') {
                                var taxAccounts = getTaxaccount(i_TaxCode);
                                for (var i = 0; i < taxAccounts.length; i++) {
                                    var s_TaxName = taxAccounts[i];
                                    if (_logValidation(s_TaxName)) {
                                        var igst_index = s_TaxName.indexOf('IGST');
                                        var cess_index = s_TaxName.indexOf('CESS');
                                        var cgst_index = s_TaxName.indexOf('CGST');
                                        var sgst_index = s_TaxName.indexOf('SGST');
                                        if (igst_index >= 0 || cess_index >= 0) {
                                            //return true;
                                        }
                                        else if (cgst_index >= 0 || sgst_index >= 0)//if(igst_index < 0)
                                        {
                                            alert('As Import is Applied User needs to select IGST Tax Code. Plaese verify Tax Group - ' + i_Tax_Code_Name);
                                            return false;
                                        }
                                    }
                                    else {
                                        alert('Kindly enter Tax Type for ' + i_Tax_Code_Name);
                                        return false;
                                    }
                                }
                            }
                        }

                    }// end try
                    catch (e) {
                        log.error("Error in Item Sublist ValidateLine", e);
                    }
                }


                return true;

            } // end try
            catch (e) {
                log.error("Error in validateLine", e);
            }
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
                var Flag = current_record.getValue({ fieldId: "custbody_tss_isvalidsubsidiary" });
                var s_Record_Type = current_record.type;

                if (isTrue(Flag)) {
                    var POSval = current_record.getValue({ fieldId: "custbody_tss_placeof_supply" });
                    if (!POSval) {
                        alert("Please enter Place Of Supply.");
                        return false;
                    }
                    var b_Export = current_record.getValue({ fieldId: "custbody_tss_export_gst" });
                    //log.debug("b_Export in saveRecord",b_Export);
                    var b_Import = current_record.getValue({ fieldId: "custbody_tss_import_gst" });
                    var Item_Count = current_record.getLineCount({ sublistId: 'item' });
                    var Expense_Count = current_record.getLineCount({ sublistId: 'expense' });
                    log.debug("Expense_Count in saveRecord", Expense_Count);
                    var RCM_Flag = 'F';
                    var Expns_Out = 'F';
                    rec_Location = current_record.getValue({ fieldId: "location" });
                    log.debug("rec_Location in saveRecord", rec_Location);
                    var checkType;
                    if (s_Record_Type == 'check') {
                        var ent_Type = current_record.getValue({ fieldId: "custbody_tss_payye_type" });
                        if (ent_Type == 'Vendor' || ent_Type == 'vendor') {
                            checkType = 'purchase'
                        }
                        else if (ent_Type == 'Customer' || ent_Type == 'customer') {
                            checkType = 'sales'
                        }
                    }
                    if (s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'purchaseorder' || checkType == 'purchase') {
                        var POServiceVal = current_record.getValue({ fieldId: "custbody_tss_place_of_service" });
                        if (!POServiceVal) {
                            alert("Please enter Place Of Service.");
                            return false;
                        }
                    }
                    /*
                    if (s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || checkType == 'purchase') {
                        if (_logValidation(rec_Location)) {

                            var i_Location_Type;
                            try {
                                var locObj = search.lookupFields({
                                    type: 'location',
                                    id: rec_Location,
                                    columns: ['custrecord_tss_gst_type_location']
                                });
                                if (locObj.custrecord_tss_gst_type_location.length > 0) {
                                    i_Location_Type = locObj.custrecord_tss_gst_type_location[0].text;
                                    log.debug("i_Location_Type in saveRecord", i_Location_Type);
                                }

                            }
                            catch (e) {
                                if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {
                                    var resposeObject = https.requestSuitelet({
                                        scriptId: "customscript_sut_tss_get_location_data",
                                        deploymentId: "customdeploy1",
                                        // external: true,
                                        urlParams: {
                                            's_Location': rec_Location
                                        }
                                    });
                                    //log.debug("resposeObject of SUT_TSS_Get_Location_Data",resposeObject);
                                    var respBody = JSON.parse(resposeObject.body);
                                    if (_logValidation(respBody) && respBody.length > 0) {
                                        i_Location_Type = respBody[0].i_Location_Type;
                                        log.debug("i_Location_Type from SUT_TSS_Get_Location_Data", i_Location_Type);
                                    }
                                }

                            }// end catch(e)


                        } // end if(_logValidation(rec_Location))

                        var rec_vendor = current_record.getValue({ fieldId: "entity" });

                        if (_logValidation(rec_vendor)) {

                            try {
                                vnr_Flag = search.lookupFields({
                                    type: 'vendor',
                                    id: rec_vendor,
                                    columns: ['custentity_tss_gst_liable']
                                });
                                vnr_Flag = vnr_Flag.custentity_tss_gst_liable;
                                log.debug("vnr_Flag in saveRecord", vnr_Flag);
                            }
                            catch (e) {
                                var resposeObject = '';
                                resposeObject = https.requestSuitelet({
                                    scriptId: "customscript_sut_tss_get_entity_data",
                                    deploymentId: "customdeploy1",
                                    // external: true,
                                    urlParams: {
                                        's_entiry_id': rec_vendor,
                                        's_record_type': s_Record_Type
                                    }
                                });
                                log.debug("resposeObject from suitelet", resposeObject);
                                if (_logValidation(resposeObject)) {
                                    var respBody = JSON.parse(resposeObject.body);
                                    log.debug("respBody from suitelet", respBody);
                                    if (_logValidation(respBody) && respBody.length > 0) {
                                        vnr_Flag = respBody[0].vnr_Flag;
                                        log.debug("vnr_Flag from suitelet", vnr_Flag);
                                    }
                                }
                            }// end catch(e)

                        } // end if(_logValidation(rec_vendor))

                        for (var i = 0; i < Expense_Count; i++) {

                            var ExpenseItem = current_record.getSublistValue({
                                sublistId: 'expense',
                                fieldId: 'category',
                                line: i
                            });
                            log.debug("ExpenseItem in saveRecord in line - ", i + ' is ' + ExpenseItem);
                            if (_logValidation(ExpenseItem)) {
                                try {
                                    var expenseObj = search.lookupFields({
                                        type: 'expensecategory',
                                        id: ExpenseItem,
                                        columns: ['custrecord_tss_rcm_expense_out', 'custrecord_tss_rcm']
                                    });
                                    if (_logValidation(expenseObj)) {
                                        RCM_Flag = expenseObj.custrecord_tss_rcm;
                                        log.debug("RCM_Flag in saveRecord", RCM_Flag);
                                        Expns_Out = expenseObj.custrecord_tss_rcm_expense_out;
                                        log.debug("Expns_Out in saveRecord", Expns_Out);
                                    }


                                }
                                catch (e) {

                                    if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {

                                        var resposeObject = '';
                                        resposeObject = https.requestSuitelet({
                                            scriptId: "customscript_sut_tss_exp_item_data",
                                            deploymentId: "customdeploy1",
                                            // external: true,
                                            urlParams: {
                                                's_expense': ExpenseItem
                                            }
                                        });
                                        log.debug("resposeObject from SUT_TSS_Exp_Item_Data", resposeObject);
                                        if (_logValidation(resposeObject)) {
                                            var respBody = JSON.parse(resposeObject.body);
                                            log.debug("respBody from SUT_TSS_Exp_Item_Data", respBody);
                                            if (_logValidation(respBody) && respBody.length > 0) {
                                                RCM_Flag = respBody[0].s_rcm;
                                                log.debug("RCM_Flag from SUT_TSS_Exp_Item_Data", RCM_Flag);
                                                Expns_Out = respBody[0].s_rcm_out;
                                                log.debug("Expns_Out from SUT_TSS_Exp_Item_Data", Expns_Out);
                                            }
                                        }

                                    }

                                }// end catch(e)

                                

                            } // end if(_logValidation(ExpenseItem))

                        } // end for(var i = 0; i<Expense_Count;i++)



                        for (var i = 0; i < Item_Count; i++) {

                            var L_Item = current_record.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'item',
                                line: i
                            });
                            var L_Item_Type = current_record.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'itemtype',
                                line: i
                            });
                            var s_item_rec_type = '';
                            switch (L_Item_Type) { // Compare item type to its record type counterpart 
                                case 'InvtPart':
                                    s_item_rec_type = 'inventoryitem';
                                    break;
                                case 'NonInvtPart':
                                    s_item_rec_type = 'noninventoryitem';
                                    break;
                                case 'Service':
                                    s_item_rec_type = 'serviceitem';
                                    break;
                                case 'Assembly':
                                    s_item_rec_type = 'assemblyitem';//serializedassemblyitem
                                    break;
                                case 'Kit':
                                    s_item_rec_type = 'kititem';
                                    break;
                                case 'OthCharge':
                                    s_item_rec_type = 'otherchargeitem';
                                    break;
                                case 'GiftCert':
                                    s_item_rec_type = 'giftcertificateitem';
                                    break;
                                case 'Group':
                                    s_item_rec_type = 'itemgroup';
                                    break;
                                case 'Payment':
                                    s_item_rec_type = 'paymentitem';
                                    break;
                                default:
                            } // end switch (L_Item_Type) 
                            if (_logValidation(L_Item)) {
                                try {

                                    var itemObj = search.lookupFields({
                                        type: s_item_rec_type,
                                        id: L_Item,
                                        columns: ['custitem_tss_item_expense_out', 'custitem_tss_item_rcm_applicable']
                                    });
                                    if (_logValidation(itemObj)) {
                                        RCM_Flag = itemObj.custitem_tss_item_rcm_applicable;
                                        log.debug("RCM_Flag in saveRecord", RCM_Flag);
                                        Expns_Out = itemObj.custitem_tss_item_expense_out;
                                        log.debug("Expns_Out in saveRecord", Expns_Out);
                                    }

                                }
                                catch (e) {

                                    if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {

                                        var resposeObject = '';
                                        resposeObject = https.requestSuitelet({
                                            scriptId: "customscript_sut_tss_exp_item_data",
                                            deploymentId: "customdeploy1",
                                            // external: true,
                                            urlParams: {
                                                's_item': L_Item,
                                                's_itemType': s_item_rec_type
                                            }
                                        });
                                        log.debug("resposeObject from SUT_TSS_Exp_Item_Data", resposeObject);
                                        if (_logValidation(resposeObject)) {
                                            var respBody = JSON.parse(resposeObject.body);
                                            log.debug("respBody from SUT_TSS_Exp_Item_Data", respBody);
                                            if (_logValidation(respBody) && respBody.length > 0) {
                                                RCM_Flag = respBody[0].s_rcm;
                                                log.debug("RCM_Flag from SUT_TSS_Exp_Item_Data", RCM_Flag);
                                                Expns_Out = respBody[0].s_rcm_out;
                                                log.debug("Expns_Out from SUT_TSS_Exp_Item_Data", Expns_Out);
                                            }
                                        }

                                    }

                                }// end catch(e)
                               
                            } // end if(_logValidation(L_Item))

                        } // end for(var i = 0; i<Item_Count; i++)



                    } // end if(s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || checkType == 'purchase')


                    else {

                        var rec_cust = current_record.getValue({ fieldId: "entity" });

                        if (_logValidation(rec_cust)) {

                            try {
                                Cust_gst_flag = search.lookupFields({
                                    type: 'customer',
                                    id: rec_cust,
                                    columns: ['custentity_tss_gst_liable']
                                });
                                Cust_gst_flag = Cust_gst_flag.custentity_tss_gst_liable;
                                log.debug("Cust_gst_flag in saveRecord", Cust_gst_flag);
                            }
                            catch (e) {
                                var resposeObject = '';
                                resposeObject = https.requestSuitelet({
                                    scriptId: "customscript_sut_tss_get_entity_data",
                                    deploymentId: "customdeploy1",
                                    // external: true,
                                    urlParams: {
                                        's_entiry_id': rec_cust,
                                        's_record_type': s_Record_Type
                                    }
                                });
                                log.debug("resposeObject from suitelet", resposeObject);
                                if (_logValidation(resposeObject)) {
                                    var respBody = JSON.parse(resposeObject.body);
                                    log.debug("respBody from suitelet", respBody);
                                    if (_logValidation(respBody) && respBody.length > 0) {
                                        Cust_gst_flag = respBody[0].cust_Flag;
                                        log.debug("Cust_gst_flag from suitelet", Cust_gst_flag);
                                    }
                                }
                            }// end catch(e)

                        } // end if(_logValidation(rec_cust))
                    } // end else
                    */


                    /*
                    for (var i = 0; i < Item_Count; i++) {
                        var i_Item_Location = current_record.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'location',
                            line: i
                        });
                        var i_Item_Name = current_record.getSublistText({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: i
                        });
                        if (rec_Location != i_Item_Location) {
                            //alert('Body Level Location and Line Level location do not match on Item Sublist, Kindly change accordingly for Item - ' + i_Item_Name);
                            //return false;
                        }
                    }

                    for (var i = 0; i < Expense_Count; i++) {
                        var i_expense_Location = current_record.getSublistValue({
                            sublistId: 'expense',
                            fieldId: 'location',
                            line: i
                        });
                        var i_exp_Name = current_record.getSublistText({
                            sublistId: 'expense',
                            fieldId: 'category',
                            line: i
                        });
                        if (rec_Location != i_expense_Location) {
                            //alert('Body Level Location and Line Level location do not match on Expense Sublist, Kindly change accordingly for Category - ' + i_exp_Name);
                            //return false;
                        }
                    }
                    */

                    var isSuiteletSearch = false;
                    var salestaxitemSearch_results;
                    try {
                        var salestaxitemSearch = search.create({
                            type: 'salestaxitem',
                            filters: [search.createFilter({
                                name: 'isinactive',
                                operator: 'is',
                                values: 'F'
                            }),
                            search.createFilter({
                                name: 'country',
                                operator: 'anyof',
                                values: 'IN'
                            })
                            ],
                            columns: [
                                search.createColumn({ name: 'name' }),
                                search.createColumn({ name: 'rate', }),
                                search.createColumn({ name: 'purchaseaccount' }),
                                search.createColumn({ name: 'saleaccount' }),
                                search.createColumn({ name: 'taxgroup' }),
                                search.createColumn({ name: 'taxtype', }),
                            ]
                        });
                        salestaxitemSearch_results = salestaxitemSearch.run().getRange(0, 1000);
                        isSuiteletSearch = false;


                    }// end try
                    catch (e) {
                        //log.error("error in getting Tax type search",e);
                        if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {
                            var resposeObject = '';
                            resposeObject = https.requestSuitelet({
                                scriptId: "customscript_sut_tss_salestaxitem_search",
                                deploymentId: "customdeploy1",
                                // external: true
                            });
                            //log.debug("resposeObject from SUT_TSS_SalesTaxItem_search",resposeObject);
                            salestaxitemSearch_results = JSON.parse(resposeObject.body);
                            //log.debug("salestaxitemSearch_results from SUT_TSS_SalesTaxItem_search",salestaxitemSearch_results);
                            isSuiteletSearch = true;

                        } // end if(e.name=='PERMISSION_VIOLATION'||e.name=='INSUFFICIENT_PERMISSION')
                        else {
                            log.error("Error in getting Tax Type search results in saveRecord", e);
                            alert("Error in getting Tax Type search results in saveRecord - " + e);
                        }

                    } // end catch(e)

                    if ((s_Record_Type == 'vendorbill' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'check') && isTrue(b_Import)) {
                        for (var i = 0; i < Item_Count; i++) {
                            var isTaxCodeValid = false;
                            var isRCMtaxCodeValid = false;
                            var i_Tax_Code = current_record.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'taxcode',
                                line: i
                            });
                            var i_Tax_CodeName = current_record.getSublistText({
                                sublistId: 'item',
                                fieldId: 'taxcode',
                                line: i
                            });
                            var is_RCMcode = current_record.getSublistValue({
                                sublistId: 'item',
                                fieldId: "custcol_tss_rcm_apply",
                                line: i
                            });
                            var l_RCMcode = current_record.getSublistValue({
                                sublistId: 'item',
                                fieldId: "custcol_tss_rcm_tax_code",
                                line: i
                            });
                            var l_RCMcodeText = current_record.getSublistText({
                                sublistId: 'item',
                                fieldId: "custcol_tss_rcm_tax_code",
                                line: i
                            });
                            var i_Item = current_record.getSublistText({
                                sublistId: 'item',
                                fieldId: 'item',
                                line: i
                            });
                            if (_logValidation(i_Tax_Code)) {
                                if (salestaxitemSearch_results.length > 0) {
                                    //log.debug("salestaxitemSearch_results in saveRecord",salestaxitemSearch_results);
                                    for (var k = 0; k < salestaxitemSearch_results.length; k++) {
                                        if (isTrue(isSuiteletSearch)) {
                                            var tax_group = salestaxitemSearch_results[k].values.taxgroup[0].value;
                                            var tax_type = salestaxitemSearch_results[k].values.taxtype[0].text;
                                        }
                                        else {
                                            var tax_group = salestaxitemSearch_results[k].getValue({ name: 'taxgroup' });
                                            var tax_type = salestaxitemSearch_results[k].getText({ name: 'taxtype' });
                                        }

                                        if (_logValidation(tax_group) && i_Tax_Code == tax_group && !isTaxCodeValid) {
                                            log.debug("tax_type in saveRecord", tax_type);
                                            if (_logValidation(tax_type)) {
                                                if (tax_type == 'IGST' || tax_type == 'CESS') {
                                                    isTaxCodeValid = true
                                                    // break;
                                                }
                                                //else if (tax_type != 'IGST' || tax_type != 'CESS') {
                                                else if (tax_type == 'CGST' || tax_type == 'SGST' || tax_type == 'GST') {
                                                    alert('As Import check is Applied User needs to select IGST Tax Code for Item - ' + i_Item);
                                                    return false;
                                                }
                                            }// end if(_logValidation(tax_type))
                                            else {
                                                alert('Kindly enter Tax Type for ' + i_Tax_CodeName);
                                                return false;
                                            }

                                        } // end if(_logValidation(tax_group) && i_Tax_Code == tax_group)

                                        if (isTrue(is_RCMcode) && _logValidation(tax_group) && l_RCMcode == tax_group && !isRCMtaxCodeValid) {
                                            log.debug("tax_type in saveRecord", tax_type);
                                            if (_logValidation(tax_type)) {
                                                if (tax_type == 'RCM IGST' || tax_type == 'RCM CESS') {
                                                    isRCMtaxCodeValid = true
                                                    // break;
                                                }
                                                //else if (tax_type != 'IGST' || tax_type != 'CESS') {
                                                else if (tax_type == 'RCM CGST' || tax_type == 'RCM SGST' || tax_type == 'RCM') {
                                                    alert('As Import check is Applied User needs to select IGST RCM Tax Code for Item - ' + i_Item);
                                                    return false;
                                                }
                                            }// end if(_logValidation(tax_type))
                                            else {
                                                alert('Kindly enter Tax Type for ' + l_RCMcodeText);
                                                return false;
                                            }

                                        } // end if(isTrue(is_RCMcode) && _logValidation(tax_group) && l_RCMcode == tax_group)
                                        if (isTrue(is_RCMcode)) {
                                            if (isRCMtaxCodeValid && isTaxCodeValid) {
                                                break;
                                            }
                                        }
                                        else {
                                            if (isTaxCodeValid) {
                                                break;
                                            }
                                        }
                                    } // end for (var k = 0; k < salestaxitemSearch_results.length; k++)
                                }// end if(salestaxitemSearch_results.length >0)

                            } // end if(_logValidation(i_Tax_Code))

                        } // end for(var i = 0; i < Item_Count; i++)

                        for (var j = 0; j < Expense_Count; j++) {
                            var isTaxCodeValid = false;
                            var isRCMtaxCodeValid = false;
                            var i_Tax_Code = current_record.getSublistValue({
                                sublistId: 'expense',
                                fieldId: 'taxcode',
                                line: j
                            });
                            var i_Tax_CodeName = current_record.getSublistText({
                                sublistId: 'expense',
                                fieldId: 'taxcode',
                                line: j
                            });
                            var is_RCMcode = current_record.getSublistValue({
                                sublistId: 'expense',
                                fieldId: "custcol_tss_rcm_apply",
                                line: j
                            });
                            var l_RCMcode = current_record.getSublistValue({
                                sublistId: 'expense',
                                fieldId: "custcol_tss_rcm_tax_code",
                                line: j
                            });
                            var l_RCMcodeText = current_record.getSublistText({
                                sublistId: 'expense',
                                fieldId: "custcol_tss_rcm_tax_code",
                                line: j
                            });
                            var i_Expense_Category = current_record.getSublistText({
                                sublistId: 'expense',
                                fieldId: 'category',
                                line: j
                            });
                            var i_Expense_Account = current_record.getSublistText({
                                sublistId: 'expense',
                                fieldId: 'account',
                                line: j
                            });
                            if (((_logValidation(i_Expense_Category) && !g_useAccExpGSTAuto) || (g_useAccExpGSTAuto && _logValidation(i_Expense_Account))) && _logValidation(i_Tax_Code)) {

                                if (salestaxitemSearch_results.length > 0) {

                                    for (var k = 0; k < salestaxitemSearch_results.length; k++) {
                                        if (isTrue(isSuiteletSearch)) {
                                            var tax_group = salestaxitemSearch_results[k].values.taxgroup[0].value;
                                            var tax_type = salestaxitemSearch_results[k].values.taxtype[0].text;
                                        }
                                        else {
                                            var tax_group = salestaxitemSearch_results[k].getValue({ name: 'taxgroup' });
                                            var tax_type = salestaxitemSearch_results[k].getText({ name: 'taxtype' });
                                        }
                                        if (_logValidation(tax_group) && i_Tax_Code == tax_group) {
                                            log.debug("tax_type in saveRecord", tax_type);

                                            if (_logValidation(tax_type)) {
                                                if (tax_type == 'IGST' || tax_type == 'CESS') {
                                                    break;
                                                }
                                                //else if (tax_type != 'IGST' || tax_type != 'CESS') {
                                                else if (tax_type == 'CGST' || tax_type == 'SGST' || tax_type == 'GST') {
                                                    if (g_useAccExpGSTAuto) {
                                                        alert('As Import check is Applied User needs to select IGST Tax Code in Expense Sublist for Account - ' + i_Expense_Account);
                                                    }
                                                    else {
                                                        alert('As Import check is Applied User needs to select IGST Tax Code in Expense Sublist for Category - ' + i_Expense_Category);
                                                    }
                                                    return false;
                                                }
                                            }// end if(_logValidation(tax_type))
                                            else {
                                                alert('Kindly enter Tax Type for ' + i_Tax_CodeName);
                                                return false;
                                            }

                                        } // end if(_logValidation(tax_group) && i_Tax_Code == tax_group)

                                        if (isTrue(is_RCMcode) && _logValidation(tax_group) && l_RCMcode == tax_group && !isRCMtaxCodeValid) {
                                            log.debug("tax_type in RCM saveRecord", tax_type);
                                            if (_logValidation(tax_type)) {
                                                if (tax_type == 'RCM IGST' || tax_type == 'RCM CESS') {
                                                    isRCMtaxCodeValid = true
                                                    // break;
                                                }
                                                //else if (tax_type != 'IGST' || tax_type != 'CESS') {
                                                else if (tax_type == 'RCM CGST' || tax_type == 'RCM SGST' || tax_type == 'RCM') {
                                                    if (g_useAccExpGSTAuto) {
                                                        alert('As Import check is Applied User needs to select IGST RCM Tax Code for Expense Account - ' + i_Expense_Account);
                                                    }
                                                    else {
                                                        alert('As Import check is Applied User needs to select IGST RCM Tax Code for Expense Category - ' + i_Expense_Category);
                                                    }
                                                    return false;
                                                }
                                            }// end if(_logValidation(tax_type))
                                            else {
                                                alert('Kindly enter Tax Type for ' + l_RCMcodeText);
                                                return false;
                                            }

                                        } // end if(isTrue(is_RCMcode) && _logValidation(tax_group) && l_RCMcode == tax_group)

                                        if (isTrue(is_RCMcode)) {
                                            if (isRCMtaxCodeValid && isTaxCodeValid) {
                                                break;
                                            }
                                        }
                                        else {
                                            if (isTaxCodeValid) {
                                                break;
                                            }
                                        }

                                    } // end for (var k = 0; k < salestaxitemSearch_results.length; k++)

                                }// end if(salestaxitemSearch_results.length >0)

                            } // end if(_logValidation(i_Expense_Category) && _logValidation(i_Tax_Code))
                        } // end for(var j = 0; j < Expense_Count; j++)

                    } // end if((s_Record_Type == 'vendorbill' || s_Record_Type == 'purchaseorder') && isTrue(b_Import))


                    if ((s_Record_Type == 'invoice' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'creditmemo' || s_Record_Type == 'cashsale') && isTrue(b_Export)) {

                        var i_Export_Reason = current_record.getValue({ fieldId: "custbody_tss_gst_payment_under" });
                        log.debug("i_Export_Reason in saveRecord", i_Export_Reason);
                        if (!i_Export_Reason) {
                            alert("As Export is applied, Please Enter Payment Of GST Under Export.");
                            return false;
                        }
                        if (_logValidation(i_Export_Reason) && i_Export_Reason == 1) {
                            for (var i = 0; i < Item_Count; i++) {
                                var i_Tax_Code = current_record.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'taxcode',
                                    line: i
                                });
                                var i_Tax_CodeName = current_record.getSublistText({
                                    sublistId: 'item',
                                    fieldId: 'taxcode',
                                    line: i
                                });
                                var i_Item = current_record.getSublistText({
                                    sublistId: 'item',
                                    fieldId: 'item',
                                    line: i
                                });
                                if (_logValidation(i_Tax_Code)) {
                                    if (salestaxitemSearch_results.length > 0) {
                                        //log.debug("salestaxitemSearch_results in saveRecord",salestaxitemSearch_results);
                                        for (var k = 0; k < salestaxitemSearch_results.length; k++) {
                                            if (isTrue(isSuiteletSearch)) {
                                                var tax_group = salestaxitemSearch_results[k].values.taxgroup[0].value;
                                                var tax_type = salestaxitemSearch_results[k].values.taxtype[0].text;
                                            }
                                            else {
                                                var tax_group = salestaxitemSearch_results[k].getValue({ name: 'taxgroup' });
                                                var tax_type = salestaxitemSearch_results[k].getText({ name: 'taxtype' });
                                            }

                                            if (_logValidation(tax_group) && i_Tax_Code == tax_group) {
                                                log.debug("tax_type in saveRecord", tax_type);
                                                if (_logValidation(tax_type)) {
                                                    if (tax_type == 'IGST' || tax_type == 'CESS') {
                                                        break;
                                                    }
                                                    //else if (tax_type != 'IGST' || tax_type != 'CESS') {
                                                    else if (tax_type == 'CGST' || tax_type == 'SGST' || tax_type == 'GST') {
                                                        alert('As Export is Applied User needs to select IGST Tax Code for Item - ' + i_Item + '\nCheck remaining Items also');
                                                        return false;
                                                    }
                                                }// end if(_logValidation(tax_type))
                                                else {
                                                    alert('Kindly enter Tax Type for ' + i_Tax_CodeName);
                                                    return false;
                                                }

                                            } // end if(_logValidation(tax_group) && i_Tax_Code == tax_group)

                                        } // end for (var k = 0; k < salestaxitemSearch_results.length; k++)
                                    }// end if(salestaxitemSearch_results.length >0)
                                }// end if(_logValidation(i_Tax_Code))
                            } // end for(var i = 0; i < Item_Count; i++)
                        } // end if(_logValidation(i_Export_Reason) && i_Export_Reason == 1)

                        if (_logValidation(i_Export_Reason) && i_Export_Reason == 2) {
                            for (var i_Temp = 0; i_Temp < Item_Count; i_Temp++) {
                                var i_Tax_Code = current_record.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'taxcode',
                                    line: i_Temp
                                });
                                var i_Tax_CodeName = current_record.getSublistText({
                                    sublistId: 'item',
                                    fieldId: 'taxcode',
                                    line: i_Temp
                                });
                                var i_Item = current_record.getSublistText({
                                    sublistId: 'item',
                                    fieldId: 'item',
                                    line: i_Temp
                                });
                                if (_logValidation(i_Tax_Code)) {
                                    var taxAccounts = getTaxaccount_Export(i_Tax_Code);
                                    if (salestaxitemSearch_results.length > 0) {
                                        //log.debug("salestaxitemSearch_results in saveRecord",salestaxitemSearch_results);
                                        for (var i = 0; i < taxAccounts.length; i = 2 + parseInt(i)) {
                                            var s_TaxName = taxAccounts[i];
                                            var i_Rate = taxAccounts[i + 1];
                                            if (_logValidation(s_TaxName)) {
                                                var igst_index = s_TaxName.indexOf('IGST');
                                                if (igst_index >= 0 && i_Rate == 0) {

                                                }
                                                else if (igst_index < 0 || i_Rate != 0) {
                                                    alert('As Export check is Applied User needs to select Zero IGST Tax Code for Item - ' + i_Item + '\nCheck remaining Items also');
                                                    return false;
                                                }
                                            } // end if(_logValidation(s_TaxName))

                                            else {
                                                alert('Kindly enter Tax Type for ' + i_Tax_CodeName);
                                                return false;
                                            }

                                        } // end for (var k = 0; k < salestaxitemSearch_results.length; k++)
                                    }// end if(salestaxitemSearch_results.length >0)
                                }// end if(_logValidation(i_Tax_Code))
                            } // end for(var i = 0; i < Item_Count; i++)
                        } // end if(_logValidation(i_Export_Reason) && i_Export_Reason == 2)


                    } // end if((s_Record_Type == 'invoice' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'creditmemo') && isTrue(b_Export))



                } // end if(isTrue(Flag))

                return true
            }// end try
            catch (e) {
                log.error("Error in saveRecord", e);
            } // end catch(e)

        } //end function saveRecord(scriptContext)


        // Custom functions are defined below....

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


        function _logValidation(value) {
            if (value != 'null' && value != null && value != null && value != '' && value != undefined && value != undefined && value != 'undefined' && value != 'undefined' && value != 'NaN' && value != NaN) {
                return true;
            }
            else {
                return false;
            }
        }


        function _nullValidation(value) {
            if (value == null || value == undefined || value == '') {
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




        function getTaxaccount_Export(taxcode) {
            var taxAccountarray = new Array();
            try {
                var taxgrpobj = record.load({ type: 'taxgroup', id: taxcode, });
                var taxgrplineitemcount = taxgrpobj.getLineCount({ sublistId: 'taxitem' });
                var p = 0;
                for (var j = 0; j < taxgrplineitemcount; j++) {
                    var taxname = taxgrpobj.getSublistValue({
                        sublistId: 'taxitem',
                        fieldId: 'taxname',
                        line: j
                    });

                    // if (_logValidation(taxname)) {
                    //     var taxcodeObj = search.lookupFields({
                    //         type: 'salestaxitem',
                    //         id: taxname,
                    //         columns: ['taxtype', 'rate']
                    //     });
                    //     if (taxcodeObj.taxtype.length > 0) {
                    //         var i_Tax_Name = taxcodeObj.taxtype[0].text;
                    //     }
                    //     var rate = taxcodeObj.rate;
                    // taxAccountarray[p++] = i_Tax_Name;
                    // taxAccountarray[p++] = parseInt(rate);
                    // }
                    taxAccountarray[p++] = taxgrpobj.getSublistValue({
                        sublistId: 'taxitem',
                        fieldId: 'taxtype',
                        line: j
                    });
                    taxAccountarray[p++] = taxgrpobj.getSublistValue({
                        sublistId: 'taxitem',
                        fieldId: 'rate',
                        line: j
                    });

                }
            }
            catch (e) {
                if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {
                    var resposeObject = '';
                    resposeObject = https.requestSuitelet({
                        scriptId: "customscript_sut_tss_tax_group_data",
                        deploymentId: "customdeploy1",
                        // external: true,
                        urlParams: {
                            'taxcode': taxcode,
                            'operationType': 'export'
                        }
                    });
                    log.debug("resposeObject from SUT TSS Tax Group Data", resposeObject);
                    if (_logValidation(resposeObject)) {
                        var respBody = JSON.parse(resposeObject.body);
                        log.debug("respBody from SUT TSS Tax Group Data", respBody);
                        taxAccountarray = respBody;
                    }
                }
            }
            return taxAccountarray;
        } // end function getTaxaccount_Export(taxcode)


        function getTaxaccount(taxcode) {
            var taxAccountarray = new Array();
            log.debug("taxcode in getTaxaccount function", taxcode)
            try {
                var taxgrpobj = record.load({ type: 'taxgroup', id: taxcode, });
                var taxgrplineitemcount = taxgrpobj.getLineCount({ sublistId: 'taxitem' });
                log.debug("taxgrplineitemcount in getTaxaccount function", taxgrplineitemcount)
                var p = 0;
                for (var j = 0; j < taxgrplineitemcount; j++) {
                    var taxname = taxgrpobj.getSublistValue({
                        sublistId: 'taxitem',
                        fieldId: 'taxname',
                        line: j
                    });
                    var i_Tax_Name = taxgrpobj.getSublistValue({
                        sublistId: 'taxitem',
                        fieldId: 'taxtype',
                        line: j
                    });
                    taxAccountarray[p] = i_Tax_Name;
                    p = p + 1;
                    // if (_logValidation(taxname)) {
                    //     try {
                    //         var taxcodeObj = search.lookupFields({
                    //             type: 'salestaxitem',
                    //             id: taxname,
                    //             columns: ['taxtype', 'rate']
                    //         });
                    //         if (taxcodeObj.taxtype.length > 0) {
                    //             var i_Tax_Name = taxcodeObj.taxtype[0].text;
                    //         }
                    //     }
                    //     catch (e) {
                    //         //call suitelet if in case insufficient permissions
                    //         //if(e.name=='PERMISSION_VIOLATION'||e.name=='INSUFFICIENT_PERMISSION'){}
                    //     }
                    //     taxAccountarray[p] = i_Tax_Name;
                    //     p = p + 1;
                    // }
                }
            }
            catch (e) {
                if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {
                    var resposeObject = '';
                    resposeObject = https.requestSuitelet({
                        scriptId: "customscript_sut_tss_tax_group_data",
                        deploymentId: "customdeploy1",
                        // external: true,
                        urlParams: {
                            'taxcode': taxcode,
                            'operationType': 'taxtype'
                        }
                    });
                    log.debug("resposeObject from SUT TSS Tax Group Data", resposeObject);
                    if (_logValidation(resposeObject)) {
                        var respBody = JSON.parse(resposeObject.body);
                        log.debug("respBody from SUT TSS Tax Group Data", respBody);
                        taxAccountarray = respBody;
                    }
                }
            }
            return taxAccountarray;
        } // end function getTaxaccount(taxcode)

        function getTaxGroupRate(taxcode) {
            var TaxRate = 0;
            try {
                var tax_obj = search.lookupFields({
                    type: 'taxgroup',
                    id: taxcode,
                    columns: ['rate']
                });
                log.debug("Tax Rate for tax code " + taxcode, tax_obj.rate);
                TaxRate = parseInt(tax_obj.rate);
            } // end try
            catch (e) {
                log.debug("Error in getting Tax Rate for tax code " + taxcode, e);
                if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {
                    var resposeObject = '';
                    resposeObject = https.requestSuitelet({
                        scriptId: "customscript_sut_tss_tax_group_data",
                        deploymentId: "customdeploy1",
                        // external: true,
                        urlParams: {
                            'taxcode': taxcode,
                            'operationType': 'taxRate'
                        }
                    });
                    log.debug("resposeObject from SUT TSS Tax Group Data", resposeObject);
                    if (_logValidation(resposeObject)) {
                        var respBody = JSON.parse(resposeObject.body);
                        log.debug("respBody from SUT TSS Tax Group Data", respBody);
                        TaxRate = respBody;
                    }
                }
            } // end catch(e)
            return TaxRate;

        } // end function getTaxGroupRate(taxcode)

        function getTaxGroupRateType(taxcode) {
            var TaxRate = 0;
            var TaxType = '';
            try {
                var tax_obj = search.lookupFields({
                    type: 'taxgroup',
                    id: taxcode,
                    columns: ['rate', 'taxtype']
                });
                log.debug("Tax Object for tax code " + taxcode, tax_obj);
                // log.debug("Tax Rate for tax code " + taxcode, tax_obj.rate);
                TaxRate = parseInt(tax_obj.rate);
                TaxType = tax_obj.taxtype ? tax_obj.taxtype[0].text : '';
                // log.debug("Tax Type for tax code " + taxcode, TaxType);
            } // end try
            catch (e) {
                log.debug("Error in getting Tax Rate for tax code " + taxcode, e);
                if (e.name == 'PERMISSION_VIOLATION' || e.name == 'INSUFFICIENT_PERMISSION') {
                    var resposeObject = '';
                    resposeObject = https.requestSuitelet({
                        scriptId: "customscript_sut_tss_tax_group_data",
                        deploymentId: "customdeploy1",
                        // external: true,
                        urlParams: {
                            'taxcode': taxcode,
                            'operationType': 'taxRateType'
                        }
                    });
                    log.debug("resposeObject from SUT TSS Tax Group Data", resposeObject);
                    if (_logValidation(resposeObject)) {
                        var respBody = JSON.parse(resposeObject.body);
                        log.debug("respBody from SUT TSS Tax Group Data", respBody);
                        TaxRate = respBody.TaxRate;
                        TaxType = respBody.TaxType;
                    }
                }
            } // end catch(e)
            return { taxRate: TaxRate, taxType: TaxType };

        } // end function getTaxGroupRateType(taxcode)


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
                name: 'custrecord_tss_gp_subsidiary',
            }));
            a_column.push(search.createColumn({
                name: 'custrecord_tss_gp_taxcode',
            }));
            a_column.push(search.createColumn({
                name: 'custrecordtss_gp_vnr_taxgroup_instate',
            }));
            a_column.push(search.createColumn({
                name: 'custrecord_tss_gp_vnr_taxgroup_outstate',
            }));
            a_column.push(search.createColumn({
                name: 'custrecord_tss_gp_rcm_applicable',
            }));
            a_column.push(search.createColumn({
                name: 'custrecord_tss_gp_sez_taxcode',
            }));
            a_column.push(search.createColumn({
                name: 'custrecord_tss_gp_taxcode_igst',
            }));
            a_column.push(search.createColumn({
                name: 'custrecord_tss_use_acc_exp_gst_auto',
            }));
            var global_param_search = search.create({
                type: 'customrecord_tss_global_parameter',
                filters: a_filters,
                columns: a_column
            });
            var global_param_search_result = global_param_search.run().getRange(0, 100);
            if (global_param_search_result.length > 0) {
                global_sub = global_param_search_result[0].getValue({ name: 'internalid' });
                g_subisidiary = global_param_search_result[0].getValue({ name: 'custrecord_tss_gp_subsidiary' });
                g_taxcode = global_param_search_result[0].getValue({ name: 'custrecord_tss_gp_taxcode' });
                g_VNR_InState = global_param_search_result[0].getValue({ name: 'custrecordtss_gp_vnr_taxgroup_instate' });
                g_VNR_OutState = global_param_search_result[0].getValue({ name: 'custrecord_tss_gp_vnr_taxgroup_outstate' });
                g_VNR_RCM_applicable = global_param_search_result[0].getValue({ name: 'custrecord_tss_gp_rcm_applicable' });
                g_taxcodeIGST = global_param_search_result[0].getValue({ name: 'custrecord_tss_gp_taxcode_igst' });
                g_sezCode = global_param_search_result[0].getValue({ name: 'custrecord_tss_gp_sez_taxcode' });
                g_useAccExpGSTAuto = global_param_search_result[0].getValue({ name: 'custrecord_tss_use_acc_exp_gst_auto' });
            }
            return global_sub;
        } // end function SearchGlobalParameter()


        // end custom functions

        return {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            postSourcing: postSourcing,
            //    sublistChanged: sublistChanged,
            lineInit: lineInit,
            //    validateField: validateField,
            validateLine: validateLine,
            //    validateInsert: validateInsert,
            //    validateDelete: validateDelete,
            saveRecord: saveRecord
        };

    });
