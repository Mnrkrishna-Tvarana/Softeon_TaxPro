/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */


/**
 * Script Name               : UES_TSS_Set_Codes_on_Check
 * Script Author             : MNR Krishna
 * Script Type               : User Event Script
 * Script Version            : 2.1
 * Script Created date       : 20/07/2023
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  
 */

/** 
 * *    Version         Name              Date             Notes
 *       1.0         MNR KRISHNA       07/07/2023       Initial version 
 * 
 */



define(['N/record', 'N/search', 'N/runtime', 'N/https', 'N/ui/serverWidget', 'N/url'],
    /**
 * @param{record} record
 * @param{search} search
 */
    (record, search, runtime, https, ui, url) => {
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
                var GlobalRecId = SearchGlobalParameter();
                if (_logValidation(GlobalRecId)) {

                    var GlobalRec = record.load({ type: 'customrecord_tss_global_parameter', id: GlobalRecId, });
                    var g_subisidiary = GlobalRec.getValue('custrecord_tss_gp_subsidiary');
                    log.debug("g_subisidiary in beforeLoad GST_UE", g_subisidiary);
                }
                var current_record = scriptContext.newRecord;
                var rec_subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                var Flag = inArray(rec_subsidiary, g_subisidiary);
                log.debug("Flag in beforeLoad GST_UE", Flag);

                if (scriptContext.type == scriptContext.UserEventType.VIEW) {
                    // var GlobalRecId = SearchGlobalParameter();
                    // if (_logValidation(GlobalRecId)) {

                    //     var GlobalRec = record.load({ type: 'customrecord_tss_global_parameter', id: GlobalRecId, });
                    //     var g_subisidiary = GlobalRec.getValue('custrecord_tss_gp_subsidiary');
                    //     log.debug("g_subisidiary in beforeLoad GST_UE", g_subisidiary);
                    // }
                    // var current_record = scriptContext.newRecord;
                    // var rec_subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                    // var Flag = inArray(rec_subsidiary, g_subisidiary);
                    if (Flag == parseInt(1)) {
                        var s_Record_Type = current_record.type;
                        if (s_Record_Type == 'invoice') {
                            var isExport = current_record.getValue({ fieldId: "custbody_tss_export_gst" });
                            var isJournalLinked = current_record.getValue({ fieldId: "custbody_tss_lut_journal_invoice" });
                            var i_Export_ReasonL = current_record.getValue({ fieldId: "custbody_tss_gst_payment_under" });



                            if (isTrue(isExport) && !_logValidation(isJournalLinked) && i_Export_ReasonL == 1) {
                                var RecForm = scriptContext.form;
                                const suiteletUrl = url.resolveScript({
                                    scriptId: 'customscript_sut_tss_gst_journal_creatio',
                                    deploymentId: 'customdeploy1',
                                    params: { invoiceId: current_record.id, s_Record_Type: s_Record_Type }
                                });
                                log.debug("suiteletUrl in beforeLoad GST_UE", suiteletUrl)
                                // Add custom button
                                RecForm.addButton({
                                    id: 'custpage_gst_journal',
                                    label: 'Create GST Journal',
                                    functionName: 'window.open("' + suiteletUrl + '", "_self")'
                                });
                            }
                        }
                    }
                }
            } // end try
            catch (e) {
                log.error("Error in beforeLoad GST_UE", e);
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
            // log.debug("beforeSubmit context for xedit GST_UE", scriptContext);
            log.debug("beforeSubmit context for xedit type GST_UE", scriptContext.type);



            try {
                var current_record = scriptContext.newRecord;
                var s_Record_Type = current_record.type;
                var checkType = '';
                if (s_Record_Type == 'invoice' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'creditmemo' || s_Record_Type == 'cashsale') {
                    var g_recType = 'sales';
                }
                else if (s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit') {
                    var g_recType = 'purchase';
                }
                else if (s_Record_Type == 'check') {
                    var ent_Type = current_record.getValue({ fieldId: "custbody_tss_payye_type" });
                    if (ent_Type == 'Vendor' || ent_Type == 'vendor') {
                        checkType = 'purchase'
                    }
                    else if (ent_Type == 'Customer' || ent_Type == 'customer') {
                        checkType = 'sales'
                    }
                }

                var currentContext = runtime.executionContext;
                log.debug("currentContext in beforeSubmit GST_UE", currentContext);

                var rec_subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                log.debug("rec_subsidiary in beforeSubmit in new record GST_UE", rec_subsidiary);
                log.debug("scriptcontext New record GST_UE", scriptContext.newRecord);
                log.debug("scriptcontext New record Fields GST_UE", scriptContext.newRecord.fields);
                // log.debug("scriptcontext oldRecord GST_UE", scriptContext.oldRecord);

                if (currentContext != 'USERINTERFACE') {

                    var g_subisidiary = new Array;
                    var g_sezCode;
                    var g_taxcode;
                    var g_taxcodeIGST;
                    var g_igstItem;
                    var vnr_Flag = ' ';
                    var Cust_gst_flag = ' ';
                    var VNR_RCM_applicable;
                    var g_VNR_InState = ' ';
                    var g_VNR_OutState = ' ';
                    var g_useAccExpGSTAuto = false;


                    var GlobalRecId = SearchGlobalParameter();
                    if (_logValidation(GlobalRecId)) {

                        var GlobalRec = record.load({ type: 'customrecord_tss_global_parameter', id: GlobalRecId, });
                        g_subisidiary = GlobalRec.getValue('custrecord_tss_gp_subsidiary');
                        log.debug("g_subisidiary GST_UE", g_subisidiary);
                        g_sezCode = GlobalRec.getValue('custrecord_tss_gp_sez_taxcode');
                        log.debug("g_sezCode GST_UE", g_sezCode);
                        g_taxcode = GlobalRec.getValue('custrecord_tss_gp_taxcode');
                        log.debug("g_taxcode GST_UE", g_taxcode);
                        g_taxcodeIGST = GlobalRec.getValue('custrecord_tss_gp_taxcode_igst');
                        log.debug("g_taxcodeIGST GST_UE", g_taxcodeIGST);
                        g_igstItem = GlobalRec.getValue('custrecord_tss_gp_igst_item');
                        log.debug("g_taxcode GST_UE", g_igstItem);
                        g_VNR_InState = GlobalRec.getValue('custrecordtss_gp_vnr_taxgroup_instate');
                        log.debug("g_VNR_InState GST_UE", g_VNR_InState);
                        g_VNR_OutState = GlobalRec.getValue('custrecord_tss_gp_vnr_taxgroup_outstate');
                        log.debug("g_VNR_OutState GST_UE", g_VNR_OutState);
                        VNR_RCM_applicable = GlobalRec.getValue('custrecord_tss_gp_rcm_applicable');
                        log.debug("VNR_RCM_applicable GST_UE", VNR_RCM_applicable);
                        g_useAccExpGSTAuto = GlobalRec.getValue('custrecord_tss_use_acc_exp_gst_auto');
                        log.debug("g_useAccExpGSTAuto GST_UE", g_useAccExpGSTAuto);


                    } // end if (_logValidation(GlobalRecId))

                    var rec_subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                    log.debug("rec_subsidiary in beforeSubmit in new record GST_UE", rec_subsidiary);
                    var current_record = scriptContext.newRecord; // Make sure this is defined
                    var inlineFields = current_record.getFields() || [];


                    if (scriptContext.type == 'xedit' && !_logValidation(rec_subsidiary)) {
                        if (!inlineFields.includes("subsidiary")) {
                            rec_subsidiary = scriptContext.oldRecord.getValue({ fieldId: "subsidiary" });

                        }
                    }
                    log.debug("rec_subsidiary in beforeSubmit in old record GST_UE", rec_subsidiary);


                    var Flag = inArray(rec_subsidiary, g_subisidiary);
                    log.debug("Flag in beforeSubmit GST_UE", Flag);
                    if (Flag == parseInt(1)) {
                        current_record.setValue({
                            fieldId: 'custbody_tss_isvalidsubsidiary',
                            value: true,
                        });
                    }
                    else if (Flag != parseInt(1)) {
                        current_record.setValue({
                            fieldId: 'custbody_tss_isvalidsubsidiary',
                            value: false,
                        });
                    }

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
                        // ========== XEDIT RESTRICTION FOR GST FIELDS ==========
                        if (scriptContext.type === 'xedit') {

                            log.debug("inlineFields in beforeSubmit GST_UE", inlineFields);

                            var restrictedFields = [
                                'location',
                                'entity',
                                'custbody_tss_placeof_supply',
                                'custbody_tss_place_of_service',
                                'custbody_tss_transaction_gstin_uid',
                                'custbody_tss_import_gst',
                                'custbody_tss_export_gst',
                                'custbody_tss_gst_payment_under',
                                'payeeaddresslist',
                                'billaddresslist'
                            ];

                            var fieldLabels = {
                                'location': 'Location',
                                'entity': 'Entity',
                                'custbody_tss_placeof_supply': 'PLACE OF SUPPLY',
                                'custbody_tss_place_of_service': 'PLACE OF SERVICE',
                                'custbody_tss_transaction_gstin_uid': 'TRANSACTION GSTIN',
                                'custbody_tss_import_gst': 'IMPORT',
                                'custbody_tss_export_gst': 'EXPORT',
                                'custbody_tss_gst_payment_under': 'GST PAYMENT UNDER',
                                'payeeaddresslist': 'PAYEE ADDRESS',
                                'billaddresslist': 'BILL ADDRESS'
                            };

                            // Filter restricted fields that were edited
                            var editedRestrictedFields = restrictedFields.filter(function (fld) {
                                return inlineFields.indexOf(fld) !== -1; // Use indexOf for better compatibility
                            });
                            log.debug("editedRestrictedFields GST_UE", editedRestrictedFields)

                            if (editedRestrictedFields.length > 0) {
                                // Map field IDs to their labels
                                var fieldNames = editedRestrictedFields.map(function (fld) {
                                    return fieldLabels[fld] || fld;
                                });

                                log.error("XEDIT_BLOCKED", "User attempted to inline edit restricted fields: GST_UE " + fieldNames.join(', '));

                                var err = {
                                    name: "INLINE_EDIT_NOT_ALLOWED",
                                    message: "Indian Tax Pro Suite app does not allow change of the field(s) " + fieldNames.join(", ") + " in inline edit.",
                                    notifyOff: false
                                };
                                throw err;
                            }
                        }
                        // ========== END XEDIT RESTRICTION ==========

                        // Place Of Service Sourcing into Intercompany Sales Order from Purchase Order Place of supply
                        if (s_Record_Type == 'salesorder') {
                            var intercompnyPO = current_record.getValue({ fieldId: "intercotransaction" });
                            if (scriptContext.type == 'xedit' && !_logValidation(intercompnyPO)) {
                                if (!inlineFields.includes("intercotransaction")) {
                                    intercompnyPO = scriptContext.oldRecord.getValue({ fieldId: "intercotransaction" });

                                }
                            }
                            if (_logValidation(intercompnyPO)) {
                                var SO_POS = current_record.getValue({ fieldId: "custbody_tss_place_of_service" });
                                if (scriptContext.type == 'xedit' && !_logValidation(SO_POS)) {
                                    if (!inlineFields.includes("custbody_tss_place_of_service")) {
                                        SO_POS = scriptContext.oldRecord.getValue({ fieldId: "custbody_tss_place_of_service" });
                                    }
                                }
                                if (!_logValidation(SO_POS)) {
                                    var poObj = search.lookupFields({
                                        type: 'purchaseorder',
                                        id: intercompnyPO,
                                        columns: ['custbody_tss_placeof_supply']
                                    })
                                    var poState = poObj.custbody_tss_placeof_supply && poObj.custbody_tss_placeof_supply.length > 0 ? poObj.custbody_tss_placeof_supply[0].value : '';
                                    if (poState) {
                                        current_record.setValue({ fieldId: "custbody_tss_place_of_service", value: poState });
                                    }

                                }
                            }
                        }
                        //End Place Of Service Sourcing into Intercompany Sales Order from Purchase Order Place of supply

                        var b_Export_Import = 0;
                        var entityId = current_record.getValue({ fieldId: "entity" });
                        if (scriptContext.type == 'xedit' && !_logValidation(entityId)) {
                            if (!inlineFields.includes("entity")) {
                                entityId = scriptContext.oldRecord.getValue({ fieldId: "entity" });
                            }
                        }

                        log.debug("entity GST_UE", entityId)

                        if (_logValidation(entityId)) {
                            try {
                                var venObj = record.load({
                                    type: 'vendor',
                                    id: entityId
                                })
                                vnr_Flag = venObj.getValue({ fieldId: "custentity_tss_gst_liable" });
                                log.debug("vnr_Flag in beforeSubmit GST_UE", vnr_Flag);
                                var rec_type = 'vendorbill';
                                var ent_type = 'vendor';
                            }
                            catch (e) {
                                //log.error("Error in vendor lookup beforeSubmit GST_UE",e);
                                if (e.name == 'RCRD_DSNT_EXIST') {
                                    var custObj = record.load({
                                        type: 'customer',
                                        id: entityId
                                    })
                                    Cust_gst_flag = custObj.getValue({ fieldId: "custentity_tss_gst_liable" });
                                    log.debug("Cust_gst_flag in beforeSubmit GST_UE", Cust_gst_flag);
                                    var rec_type = 'invoice';
                                    var ent_type = 'customer';
                                }
                            }
                        } // end if (_logValidation(entityId))


                        var b_Import = current_record.getValue({ fieldId: "custbody_tss_import_gst" });

                        if (scriptContext.type == 'xedit' && !_logValidation(b_Import)) {

                            if (!inlineFields.includes("custbody_tss_import_gst")) {
                                b_Import = scriptContext.oldRecord.getValue({ fieldId: "custbody_tss_import_gst" });
                            }

                        }

                        log.debug("b_Import GST_UE", b_Import)
                        if (isTrue(b_Import)) {
                            b_Export_Import = 1;
                        }
                        else {
                            b_Export_Import = 0;
                        }
                        var b_Export = current_record.getValue({ fieldId: "custbody_tss_export_gst" });
                        if (scriptContext.type == 'xedit' && !_logValidation(b_Export)) {
                            if (!inlineFields.includes("custbody_tss_export_gst")) {
                                b_Export = scriptContext.oldRecord.getValue({ fieldId: "custbody_tss_export_gst" });
                            }
                        }
                        log.debug("b_Export GST_UE (xedits)", b_Export);


                        if (isTrue(b_Export)) {
                            b_Export_Import = 1;
                        }
                        else {
                            b_Export_Import = 0;
                        }
                        log.debug("b_Export_Import GST_UE", b_Export_Import)

                        var rec_Location = current_record.getValue({ fieldId: "location" });
                        var i_Place_Of_Service = current_record.getValue({ fieldId: "custbody_tss_place_of_service" });
                        var i_State = current_record.getValue({ fieldId: "custbody_tss_placeof_supply" });

                        if (scriptContext.type == 'xedit' && !_logValidation(rec_Location)) {
                            if (!inlineFields.includes("location")) {
                                rec_Location = scriptContext.oldRecord.getValue({ fieldId: "location" });
                            }

                        }
                        if (scriptContext.type == 'xedit' && !_logValidation(i_Place_Of_Service)) {
                            if (!inlineFields.includes("custbody_tss_place_of_service")) {
                                i_Place_Of_Service = scriptContext.oldRecord.getValue({ fieldId: "custbody_tss_place_of_service" });
                            }

                        }

                        if (scriptContext.type == 'xedit' && !_logValidation(i_State)) {
                            if (!inlineFields.includes("custbody_tss_placeof_supply")) {
                                i_State = scriptContext.oldRecord.getValue({ fieldId: "custbody_tss_placeof_supply" });
                            }

                        }

                        var GSTIN_UID = current_record.getValue({ fieldId: "custbody_tss_transaction_gstin_uid" });
                        if (scriptContext.type == 'xedit' && !_logValidation(GSTIN_UID)) {
                            if (!inlineFields.includes("custbody_tss_transaction_gstin_uid")) {
                                GSTIN_UID = scriptContext.oldRecord.getValue({ fieldId: "custbody_tss_transaction_gstin_uid" });
                            }
                        }

                        log.debug("i_State in beforeSubmit GST_UE", {
                            rec_Location: rec_Location,
                            i_Place_Of_Service: i_Place_Of_Service,
                            i_State: i_State,
                            GSTIN_UID: GSTIN_UID
                        });

                        //Sourcing Location State to POS
                        if (_logValidation(rec_Location)) {
                            var recLoc_obj = search.lookupFields({
                                type: 'location',
                                id: rec_Location,
                                columns: ['custrecord_tss_its_location_statename', 'custrecord_tss_gst_type_location', 'custrecord_tss_gstin']
                            });
                            if (recLoc_obj.custrecord_tss_its_location_statename.length > 0) {
                                var recLocation_State = recLoc_obj.custrecord_tss_its_location_statename[0].value;
                                log.debug("recLocation_State in beforeSubmit GST_UE", recLocation_State);
                                if (recLocation_State) {
                                    var posId = (g_recType == 'purchase' || checkType == 'purchase') ? 'custbody_tss_placeof_supply' : (g_recType == 'sales' || checkType == 'sales') ? 'custbody_tss_place_of_service' : null;
                                    if (posId) {
                                        var posIdValue = (posId == 'custbody_tss_placeof_supply') ? i_State : (posId == 'custbody_tss_place_of_service') ? i_Place_Of_Service : null;
                                        if (!posIdValue) {
                                            current_record.setValue({
                                                fieldId: posId,
                                                value: recLocation_State,
                                            });
                                        }
                                    }
                                }

                            }
                        }

                        var old_s_Ship_To;
                        if (!_logValidation(i_State) || !_logValidation(i_Place_Of_Service) || !_logValidation(GSTIN_UID)) {
                            if (s_Record_Type == 'check') {
                                var s_Ship_To = current_record.getValue({ fieldId: "payeeaddresslist" });
                                if (scriptContext.type == 'xedit' && !_logValidation(s_Ship_To)) {
                                    if (!inlineFields.includes("payeeaddresslist")) {
                                        s_Ship_To = scriptContext.oldRecord.getValue({ fieldId: "payeeaddresslist" });
                                    }
                                }
                                if (scriptContext.oldRecord) {
                                    old_s_Ship_To = scriptContext.oldRecord.getValue({ fieldId: "payeeaddresslist" });
                                }
                            }
                            else {
                                var s_Ship_To = current_record.getValue({ fieldId: "billaddresslist" });
                                if (scriptContext.type == 'xedit' && !_logValidation(i_Place_Of_Service)) {
                                    if (!inlineFields.includes("billaddresslist")) {
                                        s_Ship_To = scriptContext.oldRecord.getValue({ fieldId: "billaddresslist" });
                                    }

                                }
                                if (scriptContext.oldRecord) {
                                    old_s_Ship_To = scriptContext.oldRecord.getValue({ fieldId: "billaddresslist" });
                                }


                            }
                            log.debug("s_Ship_To GST_UE", s_Ship_To)

                            if (_logValidation(entityId) && _logValidation(s_Ship_To) && s_Ship_To != old_s_Ship_To) {

                                var resposeObject = https.requestSuitelet({
                                    scriptId: "customscript_sut_tss_getstate_fromaddres",
                                    deploymentId: "customdeploy1",
                                    // external: true,
                                    urlParams: {
                                        's_entiry_id': entityId,
                                        's_record_type': rec_type,
                                        's_Ship_To': s_Ship_To
                                    }
                                });
                                //log.debug("resposeObject from suitelet GST_UE", resposeObject);
                                if (_logValidation(resposeObject)) {
                                    var respBody = JSON.parse(resposeObject.body);
                                    log.debug("respBody from suitelet GST_UE", respBody);
                                    if (_logValidation(respBody) && respBody.length > 0) {
                                        var resp_state = respBody[0].state;
                                        log.debug("resp_state from SUT_TSS_GetState_fromAddress GST_UE", resp_state);
                                        var resp_gstin = respBody[0].gstinuid;
                                        log.debug("resp_gstin from SUT_TSS_GetState_fromAddress GST_UE", resp_gstin);
                                        if (GSTIN_UID != resp_gstin && !_logValidation(resp_gstin)) {
                                            current_record.setValue({
                                                fieldId: 'custbody_tss_transaction_gstin_uid',
                                                value: resp_gstin,
                                            });
                                        }
                                        if (g_recType == 'sales' || checkType == 'sales') {
                                            if (i_State != resp_state && !_logValidation(i_State)) {
                                                current_record.setValue({
                                                    fieldId: 'custbody_tss_placeof_supply',
                                                    value: resp_state,
                                                });
                                            } // end if(i_State != resp_state)
                                        }
                                        else if (g_recType == 'purchase' || checkType == 'purchase') {
                                            if (i_Place_Of_Service != resp_state && !_logValidation(i_Place_Of_Service)) {
                                                current_record.setValue({
                                                    fieldId: 'custbody_tss_place_of_service',
                                                    value: resp_state,
                                                });
                                            } // end if(i_State != resp_state)
                                        }

                                    }
                                } // end if(_logValidation(resposeObject))
                            } // endif (_logValidation(entityId) && _logValidation(s_Ship_To))
                        } // end if(!_logValidation(i_State) || !_logValidation(i_Place_Of_Service) || !_logValidation(GSTIN_UID))

                        i_State = current_record.getValue({ fieldId: "custbody_tss_placeof_supply" });
                        if (scriptContext.type == 'xedit' && !_logValidation(i_State)) {
                            if (!inlineFields.includes("custbody_tss_placeof_supply")) {
                                i_State = scriptContext.oldRecord.getValue({ fieldId: "custbody_tss_placeof_supply" });
                            }

                        }

                        i_Place_Of_Service = current_record.getValue({ fieldId: "custbody_tss_place_of_service" });
                        if (scriptContext.type == 'xedit' && !_logValidation(i_Place_Of_Service)) {
                            if (!inlineFields.includes("custbody_tss_place_of_service")) {
                                i_Place_Of_Service = scriptContext.oldRecord.getValue({ fieldId: "custbody_tss_place_of_service" });
                            }
                        }

                        GSTIN_UID = current_record.getValue({ fieldId: "custbody_tss_transaction_gstin_uid" });
                        if (scriptContext.type == 'xedit' && !_logValidation(GSTIN_UID)) {
                            if (!inlineFields.includes("custbody_tss_transaction_gstin_uid")) {
                                GSTIN_UID = scriptContext.oldRecord.getValue({ fieldId: "custbody_tss_transaction_gstin_uid" });
                            }
                        }

                        // Place of Supply Validation
                        if (g_recType == 'sales' || checkType == 'sales') {
                            if (!_logValidation(i_State)) {
                                var emptyFieldError = new Error('Please Enter Value For Field :  PLACE OF SUPPLY (Indian Tax Pro Suite app).');
                                emptyFieldError.name = 'PLACE_OF_SUPPLY_REQUIRED';
                                throw emptyFieldError;
                            }
                        }

                        // Place of Service Validation
                        if (g_recType == 'purchase' || checkType == 'purchase') {
                            if (!_logValidation(i_Place_Of_Service)) {
                                var emptyFieldError = new Error('Please Enter Value For Field :  PLACE OF SERVICE (Indian Tax Pro Suite app).');
                                emptyFieldError.name = 'PLACE_OF_SERVICE_REQUIRED';
                                throw emptyFieldError;
                            }
                        }


                        var iStateCompare = (g_recType == 'purchase' || checkType == 'purchase') ? i_Place_Of_Service : (g_recType == 'sales' || checkType == 'sales') ? i_State : null;

                        if (_logValidation(iStateCompare)) {
                            var stateObj = search.lookupFields({
                                type: 'customrecord_tss_gst_state_master',
                                id: iStateCompare,
                                columns: ['custrecord_tss_tin']
                            });
                            var stateCode = stateObj.custrecord_tss_tin;
                            log.debug("stateCode from state master GST_UE", stateCode);
                            if (stateCode != GSTIN_UID.slice(0, 2)) {
                                // var stateMismatchError = new Error('Place of Supply/Place of Service does not match with GSTIN entered. Please correct the Place of Supply/Place of Service or GSTIN (Indian Tax Pro Suite app).');
                                // stateMismatchError.name = 'STATE_GSTIN_MISMATCH';
                                // throw stateMismatchError;
                                current_record.setValue({
                                    fieldId: 'custbody_tss_transaction_gstin_uid',
                                    value: '',
                                });
                            }

                        }

                        var i_Expense_Line_Count = current_record.getLineCount({ sublistId: 'expense' });
                        var i_Item_Line_Count = current_record.getLineCount({ sublistId: 'item' });





                        for (var i = 0; i < i_Expense_Line_Count; i++) {
                            var i_Category = current_record.getSublistValue({
                                sublistId: 'expense',
                                fieldId: 'category',
                                line: i
                            });
                            var i_Account = current_record.getSublistValue({
                                sublistId: 'expense',
                                fieldId: 'account',
                                line: i
                            });

                            var L_Category_Name;
                            var L_Account;

                            // For edit and xedit context
                            if (scriptContext.type == 'edit' || scriptContext.type == 'xedit') {
                                L_Category_Name = current_record.getSublistText({
                                    sublistId: 'expense',
                                    fieldId: 'category',
                                    line: i
                                });
                                L_Account = current_record.getSublistText({
                                    sublistId: 'expense',
                                    fieldId: 'account',
                                    line: i
                                });
                            } else {
                                // For other contexts 
                                if (i_Category) {
                                    L_Category_Name = search.lookupFields({
                                        type: search.Type.EXPENSE_CATEGORY,
                                        id: i_Category,
                                        columns: ['name']
                                    }).name;
                                }
                                if (i_Account) {
                                    L_Account = search.lookupFields({
                                        type: 'item',
                                        id: i_Account,
                                        columns: ['name']
                                    }).name;
                                }
                            }
                            log.debug("L_Category_Name GST_UE", L_Category_Name);
                            log.debug("L_Account GST_UE", L_Account);

                            if ((g_useAccExpGSTAuto && _logValidation(i_Account)) || (!g_useAccExpGSTAuto && _logValidation(i_Category))) {
                                if (s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'check') {
                                    if (g_useAccExpGSTAuto) {
                                        var expenseObj = search.lookupFields({
                                            type: 'account',
                                            id: i_Account,
                                            columns: ['custrecord_tss_its_act_hsn', 'custrecord_tss_tax_act_liable', 'custrecord_tss_act_rcm', 'custrecord_tss_act_itc_ineligible']
                                        });
                                        var rcm_Applicable_Expense;
                                        if (_logValidation(expenseObj)) {
                                            var s_HSN_SAC = expenseObj.custrecord_tss_its_act_hsn;
                                            if (expenseObj.custrecord_tss_tax_act_liable.length > 0) {
                                                var i_Tax_Liable = expenseObj.custrecord_tss_tax_act_liable[0].value;
                                            }
                                            rcm_Applicable_Expense = expenseObj.custrecord_tss_act_rcm;
                                            var s_ITC = expenseObj.custrecord_tss_act_itc_ineligible;
                                            if (isTrue(s_ITC)) {
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "custcol_tss_itc_ineligible",
                                                    value: s_ITC,
                                                    line: i
                                                });
                                            }
                                            if (_logValidation(s_HSN_SAC)) {
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "custcol_tss_hsn_sac_expense_line",
                                                    value: s_HSN_SAC,
                                                    line: i
                                                });
                                            }
                                            if (_logValidation(i_Tax_Liable)) {
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "custcol_tss_tax_liable_expenseline",
                                                    value: i_Tax_Liable,
                                                    line: i
                                                });
                                            }
                                        }
                                    }
                                    else {
                                        var expenseObj = search.lookupFields({
                                            type: 'expensecategory',
                                            id: i_Category,
                                            columns: ['custrecord_tss_its_exp_hsn', 'custrecord_tss_tax_liable', 'custrecord_tss_rcm', 'custrecord_tss_itc_ineligible']
                                        });
                                        var rcm_Applicable_Expense;
                                        if (_logValidation(expenseObj)) {
                                            var s_HSN_SAC = expenseObj.custrecord_tss_its_exp_hsn;
                                            if (expenseObj.custrecord_tss_tax_liable.length > 0) {
                                                var i_Tax_Liable = expenseObj.custrecord_tss_tax_liable[0].value;
                                            }
                                            rcm_Applicable_Expense = expenseObj.custrecord_tss_rcm;
                                            var s_ITC = expenseObj.custrecord_tss_itc_ineligible;
                                            if (isTrue(s_ITC)) {
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "custcol_tss_itc_ineligible",
                                                    value: s_ITC,
                                                    line: i
                                                });
                                            }
                                            if (_logValidation(s_HSN_SAC)) {
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "custcol_tss_hsn_sac_expense_line",
                                                    value: s_HSN_SAC,
                                                    line: i
                                                });
                                            }
                                            if (_logValidation(i_Tax_Liable)) {
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "custcol_tss_tax_liable_expenseline",
                                                    value: i_Tax_Liable,
                                                    line: i
                                                });
                                            }
                                        }

                                    }
                                } // end if(s_Record_Type == 'vendorbill' || s_Record_Type == 'vendorcredit' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'check')


                                //default ITC Inelible as True for all as per preference.
                                if (inelibleITCdefault) {
                                    current_record.setSublistValue({
                                        sublistId: 'expense',
                                        fieldId: "custcol_tss_itc_ineligible",
                                        value: true,
                                        line: i
                                    });
                                }

                                var i_Location_State;
                                var i_Location_Type;
                                var line_location = current_record.getSublistValue({
                                    sublistId: 'expense',
                                    fieldId: "location",
                                    line: i
                                });


                                if (_nullValidation(line_location)) {
                                    current_record.setSublistValue({
                                        sublistId: 'expense',
                                        fieldId: "location",
                                        value: rec_Location,
                                        line: i
                                    });
                                    line_location = rec_Location
                                }

                                if (_logValidation(line_location)) {
                                    if (line_location != rec_Location) {
                                        var loc_obj = search.lookupFields({
                                            type: 'location',
                                            id: line_location,
                                            columns: ['custrecord_tss_its_location_statename', 'custrecord_tss_gst_type_location', 'custrecord_tss_gstin']
                                        });
                                    }
                                    else {
                                        var loc_obj = recLoc_obj
                                    }

                                    if (loc_obj.custrecord_tss_gst_type_location.length > 0) {
                                        i_Location_Type = loc_obj.custrecord_tss_gst_type_location[0].text;
                                        log.debug("i_Location_Type in beforeSubmit GST_UE", i_Location_Type);
                                    }
                                    if (loc_obj.custrecord_tss_its_location_statename.length > 0) {
                                        i_Location_State = loc_obj.custrecord_tss_its_location_statename[0].value;
                                        log.debug("i_Location_State in beforeSubmit GST_UE", i_Location_State);
                                    }
                                    current_record.setSublistValue({
                                        sublistId: 'expense',
                                        fieldId: "custcol_tss_loc_gstin",
                                        value: loc_obj.custrecord_tss_gstin,
                                        line: i
                                    });
                                }
                                else {
                                    i_Location_State = (g_recType == 'purchase' || checkType == 'purchase') ? i_State : (g_recType == 'sales' || checkType == 'sales') ? i_Place_Of_Service : null;
                                }
                                log.debug("i_Location_State after assignment in beforeSubmit GST_UE", i_Location_State);
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
                                        values: '@NONE@'
                                    }));
                                    if (g_useAccExpGSTAuto) {
                                        a_Filters.push(search.createFilter({
                                            name: 'custrecord_tss_its_expense_account',
                                            operator: 'anyof',
                                            values: i_Account
                                        }));
                                    }
                                    else {
                                        a_Filters.push(search.createFilter({
                                            name: 'custrecord_tss_its_expense_category',
                                            operator: 'anyof',
                                            values: i_Category
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

                                    if (i_Location_State == iStateCompare && i_Location_Type != 'SEZ' && !isTrue(b_Export_Import)) {
                                        if (taxGroupsearch_result.length > 0) {
                                            var i_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_in_state_tax_group' });
                                            if (_logValidation(i_Tax_Group)) {

                                                if ((!isTrue(vnr_Flag) || isTrue(rcm_Applicable_Expense)) && ent_type == 'vendor') {
                                                    var rcm_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_rcm_in_state_taxgroup' });
                                                    var rcm_Tax_Group_rate = getTaxGroupRate(rcm_Tax_Group);
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "taxcode",
                                                        value: g_VNR_InState,
                                                        line: i
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "custcol_tss_rcm_tax_code",
                                                        value: rcm_Tax_Group,
                                                        line: i
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "custcol_tss_rcm_apply",
                                                        value: true,
                                                        line: i
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "custcol_tss_rcm_rate",
                                                        value: parseFloat(rcm_Tax_Group_rate),
                                                        line: i
                                                    });

                                                    //RCM Tax code validation - expense
                                                    var rcmApply = current_record.getSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: 'custcol_tss_rcm_apply',
                                                        line: i
                                                    });
                                                    // log.debug("Rcm apply for code GST_UE", rcmApply);

                                                    if (isTrue(rcmApply)) {
                                                        var rcmTaxCode = current_record.getSublistValue({
                                                            sublistId: 'expense',
                                                            fieldId: 'custcol_tss_rcm_tax_code',
                                                            line: i
                                                        });
                                                        // log.debug("Rcm tax code for code GST_UE", rcmTaxCode);


                                                        if (!_logValidation(rcmTaxCode)) {
                                                            var rcmError = new Error('Please Enter Value For Field : RCM TAX CODE field in expense line ' + (i + 1) + ' where RCM is applicable (Indian Tax Pro Suite app).');
                                                            rcmError.name = 'RCM_TAX_CODE_REQUIRED';
                                                            throw rcmError;
                                                        }
                                                    }
                                                }

                                                else {
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "taxcode",
                                                        value: i_Tax_Group,
                                                        line: i
                                                    });
                                                }
                                            } // end if (_logValidation(i_Tax_Group))
                                        }
                                        else {
                                            log.debug("You are not created Tax Group Determination record for Current line Expense Category/Account GST_UE - ", L_Category_Name + "/" + L_Account);
                                            current_record.setSublistValue({
                                                sublistId: 'expense',
                                                fieldId: "taxcode",
                                                value: g_taxcode,
                                                line: i
                                            });
                                        }
                                    } // end if (i_Location_State == iStateCompare && i_Location_Type != 'SEZ')
                                    else {
                                        if (taxGroupsearch_result.length > 0) {
                                            var i_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_out_state_tax_group' });
                                            log.debug("i_Tax_Group", i_Tax_Group);
                                            if (_logValidation(i_Tax_Group)) {

                                                if (i_Location_Type == 'SEZ') {
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "taxcode",
                                                        value: g_sezCode,
                                                        line: i
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "custcol_tss_sez",
                                                        value: true,
                                                        line: i
                                                    });
                                                    if (ent_type == 'vendor') {
                                                        if (sezLiableDefault) {
                                                            current_record.setSublistValue({
                                                                sublistId: 'expense',
                                                                fieldId: "custcol_tss_sez_tax_liable",
                                                                line: i,
                                                                value: true
                                                            });
                                                        }
                                                        var sezLiable = current_record.getSublistValue({
                                                            sublistId: 'expense',
                                                            fieldId: "custcol_tss_sez_tax_liable",
                                                            line: i
                                                        });
                                                        if (sezLiable) {
                                                            current_record.setSublistValue({
                                                                sublistId: 'expense',
                                                                fieldId: "taxcode",
                                                                value: i_Tax_Group,
                                                                line: i
                                                            });
                                                        }
                                                    }
                                                }
                                                else if ((!isTrue(vnr_Flag) || isTrue(rcm_Applicable_Expense)) && ent_type == 'vendor') {
                                                    var rcm_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_rcm_out_state_taxgrp' });
                                                    var rcm_Tax_Group_rate = getTaxGroupRate(rcm_Tax_Group);
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "taxcode",
                                                        value: g_VNR_OutState,
                                                        line: i
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "custcol_tss_rcm_tax_code",
                                                        value: rcm_Tax_Group,
                                                        line: i
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "custcol_tss_rcm_apply",
                                                        value: true,
                                                        line: i
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "custcol_tss_rcm_rate",
                                                        value: parseFloat(rcmRate_Tax_Group),
                                                        line: i
                                                    });
                                                    //RCM Tax code validation - expense
                                                    var rcmApply = current_record.getSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: 'custcol_tss_rcm_apply',
                                                        line: i
                                                    });
                                                    log.debug("Rcm apply for code GST_UE", rcmApply);

                                                    if (isTrue(rcmApply)) {
                                                        var rcmTaxCode = current_record.getSublistValue({
                                                            sublistId: 'expense',
                                                            fieldId: 'custcol_tss_rcm_tax_code',
                                                            line: i
                                                        });
                                                        log.debug("Rcm tax code for code GST_UE", rcmTaxCode);

                                                        if (!_logValidation(rcmTaxCode)) {
                                                            var rcmError = new Error('Please Enter Value For Field : RCM TAX CODE field in expense line ' + (i + 1) + ' where RCM is applicable (Indian Tax Pro Suite app).');
                                                            rcmError.name = 'RCM_TAX_CODE_REQUIRED';
                                                            throw rcmError;
                                                        }
                                                    }
                                                }

                                                else {
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "taxcode",
                                                        value: i_Tax_Group,
                                                        line: i
                                                    });
                                                }
                                            } // end if (_logValidation(i_Tax_Group))
                                        }
                                        else {
                                            if (i_Location_Type == 'SEZ') {
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "taxcode",
                                                    value: g_sezCode,
                                                    line: i
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "custcol_tss_sez",
                                                    value: true,
                                                    line: i
                                                });
                                                if (sezLiableDefault) {
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: "custcol_tss_sez_tax_liable",
                                                        line: i,
                                                        value: true
                                                    });
                                                }
                                            }
                                            else {
                                                log.debug("You are not created Tax Group Determination record for Current line Expense Category/Account GST_UE - ", L_Category_Name + "/" + L_Account);
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: "taxcode",
                                                    value: g_taxcodeIGST,
                                                    line: i
                                                });
                                            }

                                        }
                                    } // end else
                                } // if (_logValidation(i_Location_State) && _logValidation(iStateCompare))

                            } // end if(_logValidation(i_Category))


                        } // for (var i = 0; i < i_Expense_Line_Count; i++)

                        for (var i = 0; i < i_Item_Line_Count; i++) {
                            var rcm_applicable_item;
                            var i_Item = current_record.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'item',
                                line: i
                            });

                            if (_logValidation(i_Item)) {
                                var loc_obj = search.lookupFields({
                                    type: 'item',
                                    id: i_Item,
                                    columns: ['custitem_tss_its_hsn', 'custitem_tss_tax_liable', 'custitem_tss_item_rcm_applicable', 'custitem_tss_itc_ineligible']
                                });
                                if (loc_obj.custitem_tss_tax_liable.length > 0) {
                                    var i_Tax_Liable = loc_obj.custitem_tss_tax_liable[0].value;
                                    log.debug("i_Tax_Liable in beforeSubmit GST_UE", i_Tax_Liable);
                                }
                                if (_logValidation(i_Tax_Liable)) {
                                    current_record.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: "custcol_tss_tax_liable",
                                        value: i_Tax_Liable,
                                        line: i
                                    });
                                }
                                var s_HSN_SAC = loc_obj.custitem_tss_its_hsn;
                                if (_logValidation(s_HSN_SAC)) {
                                    current_record.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: "custcol_tss_transaction_hsn_sac",
                                        value: s_HSN_SAC,
                                        line: i
                                    });

                                }
                                var s_ITC = loc_obj.custitem_tss_itc_ineligible;
                                if (isTrue(s_ITC)) {
                                    current_record.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: "custcol_tss_itc_ineligible",
                                        value: s_ITC,
                                        line: i
                                    });
                                }

                                //default ITC Inelible as True for all as per preference.
                                if (inelibleITCdefault) {
                                    current_record.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: "custcol_tss_itc_ineligible",
                                        value: true,
                                        line: i
                                    });
                                }

                                rcm_applicable_item = loc_obj.custitem_tss_item_rcm_applicable;

                                var i_Location_State;
                                var i_Location_Type;
                                var line_location = current_record.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: "location",
                                    line: i
                                });
                                if (_nullValidation(line_location)) {
                                    current_record.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: "location",
                                        value: rec_Location,
                                        line: i
                                    });
                                    line_location = rec_Location
                                }

                                if (_logValidation(line_location)) {
                                    if (line_location != rec_Location) {
                                        var loc_obj = search.lookupFields({
                                            type: 'location',
                                            id: line_location,
                                            columns: ['custrecord_tss_its_location_statename', 'custrecord_tss_gst_type_location', 'custrecord_tss_gstin']
                                        });
                                    }
                                    else {
                                        var loc_obj = recLoc_obj
                                    }
                                    //log.audit("loc_obj in item loop GST_UE",loc_obj);
                                    if (loc_obj.custrecord_tss_gst_type_location.length > 0) {
                                        i_Location_Type = loc_obj.custrecord_tss_gst_type_location[0].text;
                                        log.debug("i_Location_Type in beforeSubmit GST_UE", i_Location_Type);
                                    }
                                    if (loc_obj.custrecord_tss_its_location_statename.length > 0) {
                                        i_Location_State = loc_obj.custrecord_tss_its_location_statename[0].value;
                                        log.debug("i_Location_State in beforeSubmit GST_UE", i_Location_State);
                                    }
                                    current_record.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: "custcol_tss_loc_gstin",
                                        value: loc_obj.custrecord_tss_gstin,
                                        line: i
                                    });
                                }
                                else {
                                    i_Location_State = (g_recType == 'purchase' || checkType == 'purchase') ? i_State : (g_recType == 'sales' || checkType == 'sales') ? i_Place_Of_Service : null;
                                }
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
                                        values: i_Item
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

                                    if (i_Location_State == iStateCompare && i_Location_Type != 'SEZ' && !isTrue(b_Export_Import)) {
                                        if (taxGroupsearch_result.length > 0) {
                                            var i_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_in_state_tax_group' });
                                            if (_logValidation(i_Tax_Group)) {

                                                if ((!isTrue(vnr_Flag) || isTrue(rcm_applicable_item)) && g_recType == "purchase") {
                                                    var rcm_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_rcm_in_state_taxgroup' });
                                                    var rcm_Tax_Group_rate = getTaxGroupRate(rcm_Tax_Group);
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "taxcode",
                                                        value: g_VNR_InState,
                                                        line: i
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "custcol_tss_rcm_tax_code",
                                                        value: rcm_Tax_Group,
                                                        line: i
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "custcol_tss_rcm_apply",
                                                        value: true,
                                                        line: i
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "custcol_tss_rcm_rate",
                                                        value: parseFloat(rcm_Tax_Group_rate),
                                                        line: i
                                                    });
                                                    //RCM Validation for item
                                                    var rcmApply = current_record.getSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'custcol_tss_rcm_apply',
                                                        line: i
                                                    });
                                                    log.debug("Rcm apply for code GST_UE", rcmApply);


                                                    if (isTrue(rcmApply)) {
                                                        var rcmTaxCode = current_record.getSublistValue({
                                                            sublistId: 'item',
                                                            fieldId: 'custcol_tss_rcm_tax_code',
                                                            line: i
                                                        });
                                                        log.debug("Rcm tax code for code GST_UE", rcmTaxCode);


                                                        if (!_logValidation(rcmTaxCode)) {
                                                            var rcmError = new Error('Please Enter Value For Field : RCM TAX CODE field in item line ' + (i + 1) + ' where RCM is applicable (Indian Tax Pro Suite app).');
                                                            rcmError.name = 'RCM_TAX_CODE_REQUIRED';
                                                            throw rcmError;
                                                        }
                                                    }

                                                }
                                                else {
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "taxcode",
                                                        value: i_Tax_Group,
                                                        line: i
                                                    });
                                                }

                                            } // end if (_logValidation(i_Tax_Group))
                                        } // end if (taxGroupsearch_result.length > 0)
                                        else {
                                            log.debug("You are not created Tax Group Determination record for Current line Item Number GST_UE - ", i + 1);
                                            current_record.setSublistValue({
                                                sublistId: 'item',
                                                fieldId: "taxcode",
                                                value: g_taxcode,
                                                line: i
                                            });
                                        }
                                    } // end if (i_Location_State == iStateCompare && i_Location_Type != 'SEZ')
                                    else {
                                        if (taxGroupsearch_result.length > 0) {
                                            var i_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_out_state_tax_group' });
                                            if (_logValidation(i_Tax_Group)) {

                                                if (g_recType == "purchase" && i_Location_Type == 'SEZ') {
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "taxcode",
                                                        value: g_sezCode,
                                                        line: i
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "custcol_tss_sez",
                                                        value: true,
                                                        line: i
                                                    });
                                                    if (sezLiableDefault) {
                                                        current_record.setSublistValue({
                                                            sublistId: 'item',
                                                            fieldId: "custcol_tss_sez_tax_liable",
                                                            line: i,
                                                            value: true
                                                        });
                                                    }
                                                    var sezLiable = current_record.getSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "custcol_tss_sez_tax_liable",
                                                        line: i
                                                    });
                                                    if (sezLiable) {
                                                        current_record.setSublistValue({
                                                            sublistId: 'item',
                                                            fieldId: "taxcode",
                                                            value: i_Tax_Group,
                                                            line: i
                                                        });
                                                    }
                                                }
                                                else if ((!isTrue(vnr_Flag) || isTrue(rcm_applicable_item)) && g_recType == "purchase") {
                                                    var rcm_Tax_Group = taxGroupsearch_result[0].getValue({ name: 'custrecord_tss_its_rcm_out_state_taxgrp' });
                                                    var rcm_Tax_Group_rate = getTaxGroupRate(rcm_Tax_Group);

                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "taxcode",
                                                        value: g_VNR_OutState,
                                                        line: i
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "custcol_tss_rcm_tax_code",
                                                        value: rcm_Tax_Group,
                                                        line: i
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "custcol_tss_rcm_apply",
                                                        value: true,
                                                        line: i
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "custcol_tss_rcm_rate",
                                                        value: parseFloat(rcm_Tax_Group_rate),
                                                        line: i
                                                    });

                                                    //RCM Validation - item
                                                    var rcmApply = current_record.getSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'custcol_tss_rcm_apply',
                                                        line: i
                                                    });
                                                    log.debug("Rcm apply for code GST_UE", rcmApply);


                                                    if (isTrue(rcmApply)) {
                                                        var rcmTaxCode = current_record.getSublistValue({
                                                            sublistId: 'item',
                                                            fieldId: 'custcol_tss_rcm_tax_code',
                                                            line: i
                                                        });
                                                        log.debug("Rcm tax code for code GST_UE", rcmTaxCode);


                                                        if (!_logValidation(rcmTaxCode)) {
                                                            var rcmError = new Error('Please Enter Value For Field : RCM TAX CODE field in item line ' + (i + 1) + ' where RCM is applicable (Indian Tax Pro Suite app).');
                                                            rcmError.name = 'RCM_TAX_CODE_REQUIRED';
                                                            throw rcmError;
                                                        }
                                                    }


                                                }
                                                else {
                                                    if (g_recType == 'sales' && isTrue(b_Export)) {
                                                        var i_Export_ReasonL = current_record.getValue({ fieldId: "custbody_tss_gst_payment_under" });
                                                        if (_logValidation(b_Export) && b_Export == true && !_logValidation(i_Export_ReasonL)) {

                                                            var exportError = new Error('Please Enter Value For Field : PAYMENT OF GST UNDER EXPORT (Indian Tax Pro Suite app).');
                                                            exportError.name = 'EXPORT_REASON_REQUIRED';
                                                            throw exportError;
                                                        }

                                                        if (i_Export_ReasonL == 1) {
                                                            current_record.setSublistValue({
                                                                sublistId: 'item',
                                                                fieldId: "taxcode",
                                                                value: g_taxcodeIGST,
                                                                line: i
                                                            });
                                                            var lut_Tax_Group_rate = getTaxGroupRate(i_Tax_Group);
                                                            current_record.setSublistValue({
                                                                sublistId: 'item',
                                                                fieldId: "custcol_tss_lut_taxcode",
                                                                value: i_Tax_Group,
                                                                line: i
                                                            });
                                                            current_record.setSublistValue({
                                                                sublistId: 'item',
                                                                fieldId: "taxcode",
                                                                value: parseFloat(lut_Tax_Group_rate),
                                                                line: i
                                                            });

                                                        }
                                                        else if (i_Export_ReasonL == 2) {
                                                            current_record.setSublistValue({
                                                                sublistId: 'item',
                                                                fieldId: "taxcode",
                                                                value: g_taxcodeIGST,
                                                                line: i
                                                            });
                                                        }
                                                    }
                                                    else {
                                                        current_record.setSublistValue({
                                                            sublistId: 'item',
                                                            fieldId: "taxcode",
                                                            value: i_Tax_Group,
                                                            line: i
                                                        });
                                                    }
                                                }

                                            } // end if (_logValidation(i_Tax_Group))
                                        } // end if (taxGroupsearch_result.length > 0)
                                        else {
                                            if (g_recType == "purchase" && i_Location_Type == 'SEZ') {
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: "taxcode",
                                                    value: g_sezCode,
                                                    line: i
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: "custcol_tss_sez",
                                                    value: true,
                                                    line: i
                                                });
                                                if (sezLiableDefault) {
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: "custcol_tss_sez_tax_liable",
                                                        line: i,
                                                        value: true
                                                    });
                                                }
                                            }
                                            else {
                                                log.debug("You are not created Tax Group Determination record for Current line Item Number GST_UE - ", i + 1);
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: "taxcode",
                                                    value: g_taxcodeIGST,
                                                    line: i
                                                });
                                            }

                                        } // end else
                                    } // end else
                                } // end if (_logValidation(i_Location_State) && _logValidation(iStateCompare))

                            }// end if(_logValidation(i_Item))
                        } // end for (var i = 0; i < i_Item_Line_Count; i++)





                        log.debug("grectype GST_UE", {
                            rectype: g_recType,
                            enttype: ent_type
                        });


                    }
                } // end if (currentContext != 'USERINTERFACE')

            } // end try
            catch (e) {
                log.error("Error in beforeSubmit GST_UE", e);
                if (e.name === "INLINE_EDIT_NOT_ALLOWED") {
                    throw e;
                }
                if (e.name === "PLACE_OF_SUPPLY_REQUIRED") {
                    throw e;
                }
                if (e.name === "PLACE_OF_SERVICE_REQUIRED") {
                    throw e;
                }
                if (e.name === "EXPORT_REASON_REQUIRED") {
                    throw e;
                }
                if (e.name === "RCM_TAX_CODE_REQUIRED") {
                    throw e;
                }
            } // end catch(e)
        } // end const beforeSubmit = (scriptContext) =>

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



        // Custom functions started...........

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
            var global_param_search = search.create({
                type: 'customrecord_tss_global_parameter',
                filters: a_filters,
                columns: a_column
            });
            var global_param_search_result = global_param_search.run().getRange(0, 100);
            if (_logValidation(global_param_search_result)) {
                global_sub = global_param_search_result[0].getValue({ name: 'internalid' });
            }
            return global_sub;
        } // end function SearchGlobalParameter()

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
        function getTaxGroupRate(taxcode) {
            var TaxRate = 0;
            try {
                var tax_obj = search.lookupFields({
                    type: 'taxgroup',
                    id: taxcode,
                    columns: ['rate']
                });
                TaxRate = parseInt(tax_obj.rate);
            } // end try
            catch (e) {
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
                    //log.debug("resposeObject from SUT TSS Tax Group Data GST_UE", resposeObject);
                    if (_logValidation(resposeObject)) {
                        var respBody = JSON.parse(resposeObject.body);
                        log.debug("respBody from SUT TSS Tax Group Data GST_UE", respBody);
                        TaxRate = respBody;
                    }
                }
            } // end catch(e) 
            return TaxRate;

        } // end function getTaxGroupRate(taxcode)

        return {
            beforeLoad,
            beforeSubmit,
            //afterSubmit
        }

    });