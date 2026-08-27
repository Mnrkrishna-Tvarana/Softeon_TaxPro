/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

/**
 * Script Name               : TSS UE TDS New
 * Script Author             : MNR Krishna
 * Script Type               : User Event Script
 * Script Version            : 2.1
 * Script Created date       : 04/07/2023
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  Add TDS Lines on vendor bill on creation/edit When TDS applied and when reuired to deduct TDS. TDS override feature added
 */


define(['N/search', 'N/runtime', 'N/record', 'N/currentRecord', 'N/format', 'N/cache'],
    /**
 * @param{search} search
 */
    (search, runtime, record, currentRecord, format, cache) => {

        // Global Variables
        var toBeUpdateIdObj = {}

        // Define a global variable to hold the cache key for storing data
        var cacheKey = 'globalUpdatedObj';

        var isTDStobeDefault = true



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
                if (scriptContext.type == scriptContext.UserEventType.EDIT) {
                    var current_record = scriptContext.newRecord;
                    var g_subisidiary = new Array();

                    var GlobalRecId = SearchGlobalParameter();
                    if (_logValidation(GlobalRecId)) {
                        var GlobalRec = record.load({ type: 'customrecord_tss_global_parameter', id: GlobalRecId, });
                        g_subisidiary = GlobalRec.getValue('custrecord_tss_gp_subsidiary');
                        log.debug("g_subisidiary", g_subisidiary);

                    } // end if (_logValidation(GlobalRecId))
                    var rec_subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                    var Flag = inArray(rec_subsidiary, g_subisidiary);
                    if (Flag == 1) {
                        var isVoidHide = false;
                        //Getting last applied TDS details
                        var prevApliedTDSobj = current_record.getValue({
                            fieldId: 'custbody_tss_applied_tds_obj',
                        });
                        log.debug("prevApliedTDSobj", prevApliedTDSobj);
                        prevApliedTDSobj = _logValidation(prevApliedTDSobj) ? JSON.parse(prevApliedTDSobj) : {}
                        // log.debug("prevApliedTDSobj1", prevApliedTDSobj);
                        if (Object.keys(prevApliedTDSobj).length === 0) {

                        }
                        else {
                            isVoidHide = true
                        }
                        //Getting VPP applied TDS details
                        var ApliedTDSvppObj = current_record.getValue({
                            fieldId: 'custbody_tss_it_vpp_appld_tds',
                        });
                        log.debug("ApliedTDSvppObj in beforeLoad", ApliedTDSvppObj);
                        ApliedTDSvppObj = _logValidation(ApliedTDSvppObj) ? JSON.parse(ApliedTDSvppObj) : {}
                        if (!ApliedTDSvppObj || typeof ApliedTDSvppObj !== 'object') {
                            // Nothing to validate if null/undefined
                        }

                        for (var key in ApliedTDSvppObj) {
                            if (ApliedTDSvppObj.hasOwnProperty(key)) {
                                var entry = ApliedTDSvppObj[key];
                                if (entry && entry.tdsbaseamount && entry.tdsbaseamount > 0) {
                                    log.error("VPP TDS Base Amount is greater than zero for key: ", key);
                                    isVoidHide = true
                                }
                            }
                        }
                        if (isVoidHide) {
                            // var form = scriptContext.form;
                            // Inject inline script using form.addField()
                            var field = scriptContext.form.addField({
                                id: 'custpage_inline_script',
                                label: 'Inline Script',
                                type: 'INLINEHTML'
                            });

                            // jQuery script to hide the element
                            var script = "<script>jQuery(document).ready(function(){ jQuery('#tr_void').hide(); });</script>";

                            field.defaultValue = script;
                        }
                    }
                }

            }// end try
            catch (e) {
                log.error("Error in Before Load", e);
            } // end catch(e)
        } // end const beforeLoad = (scriptContext)

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {
            log.debug("scriptContext beforeSubmit", scriptContext);
            var current_record = scriptContext.newRecord;
            log.debug("current_record", current_record);
            var currentContext = runtime.executionContext;
            log.debug("currentContext in beforeSubmit", currentContext);

            try {
                if (current_record.type == 'vendorbill') {
                    var g_subisidiary = new Array();
                    var g_tdsCode;
                    var g_tdsRoundMethod;
                    var g_TDS_Calculate;
                    var g_VNR_RCM_applicable;
                    var GlobalRecId = SearchGlobalParameter();
                    if (_logValidation(GlobalRecId)) {

                        var GlobalRec = record.load({ type: 'customrecord_tss_global_parameter', id: GlobalRecId, });
                        g_subisidiary = GlobalRec.getValue('custrecord_tss_gp_subsidiary');
                        log.debug("g_subisidiary", g_subisidiary);
                        g_tdsCode = GlobalRec.getValue('custrecord_tss_gp_tdscode');
                        log.debug("g_tdsCode", g_tdsCode);
                        g_VNR_RCM_applicable = GlobalRec.getValue('custrecord_tss_gp_rcm_applicable');

                    } // end if (_logValidation(GlobalRecId))
                    var rec_subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                    var rec_vendor = current_record.getValue({ fieldId: "entity" });
                    var rec_date = current_record.getValue({ fieldId: "trandate" });
                    var overrideTDS = current_record.getValue({ fieldId: 'custbody_tss_it_tds_overrideline' });

                    log.debug("scriptContext.type", scriptContext.type)
                    var inlineFields = []
                    if (scriptContext.type == 'xedit') {
                        log.debug("Fields updtaed in inline edit", current_record.getFields())
                        inlineFields = current_record.getFields()
                        if (inArray("subsidiary", inlineFields) != 1) {
                            rec_subsidiary = scriptContext.oldRecord.getValue({ fieldId: "subsidiary" })
                        }
                        if (inArray("entity", inlineFields) != 1) {
                            rec_vendor = scriptContext.oldRecord.getValue({ fieldId: "entity" })
                        }
                        if (inArray("trandate", inlineFields) != 1) {
                            rec_date = scriptContext.oldRecord.getValue({ fieldId: "trandate" })
                        }
                        if (inArray("custbody_tss_it_tds_overrideline", inlineFields) != 1) {
                            overrideTDS = scriptContext.oldRecord.getValue({ fieldId: "custbody_tss_it_tds_overrideline" })
                        }
                    }
                    log.debug("rec_subsidiary in beforeSubmit ", rec_subsidiary)
                    log.debug("rec_vendor in beforeSubmit ", rec_vendor)
                    log.debug("rec_date in beforeSubmit ", rec_date)


                    var isVoided = current_record.getValue({ fieldId: "void" });

                    log.debug("isVoided in beforeSubmit ", isVoided)
                    if (isVoided == 'Void' && scriptContext.type == 'edit') {
                        log.debug("yes entered when transaction.void", scriptContext.oldRecord)
                        if (!rec_subsidiary) {
                            rec_subsidiary = scriptContext.oldRecord.getValue({ fieldId: "subsidiary" })
                        }
                        if (!rec_date) {
                            rec_date = scriptContext.oldRecord.getValue({ fieldId: "trandate" })
                        }
                    }
                    log.debug("rec_subsidiary1 in beforeSubmit ", rec_subsidiary)
                    log.debug("rec_date1 in beforeSubmit ", rec_date)

                    var Flag = inArray(rec_subsidiary, g_subisidiary);

                    // For Vendor Bill --> started the adding TDS Lines for records which are created from suitelet, csv imports and web services.
                    //if (currentContext == 'CSVIMPORT' || currentContext == 'SUITELET' || currentContext == 'WEBSERVICES' || currentContext == 'RESTWEBSERVICES') {

                    if (Flag == 1) {

                        var sublists = ['item', 'expense'];
                        var errorMessages = [];
                        var overrideObjArr = [];
                        var overrideItemObjArr = [];
                        var overrideExpObjArr = [];

                        sublists.forEach(function (sublistId) {

                            var lineCount = current_record.getLineCount({ sublistId: sublistId });
                            var overrideSections = []
                            var overrideSectionsVE = []
                            for (var i = 0; i < lineCount; i++) {

                                var tdsFlag = current_record.getSublistValue({
                                    sublistId: sublistId,
                                    fieldId: 'custcol_tss_tdsline',
                                    line: i
                                });
                                var isOverrideLine = current_record.getSublistValue({ sublistId: sublistId, fieldId: 'custcol_tss_it_tds_override', line: i });

                                if (!tdsFlag) {
                                    if (isOverrideLine) {
                                        throw { name: 'TDS_APPLIED', message: 'Override TDS is only applicable on TDS Lines.' };
                                    }
                                    var TdsType = current_record.getSublistValue({ sublistId: sublistId, fieldId: "custcol_tss_itb_tdsmaster", line: i })
                                    var TdsPercent = current_record.getSublistValue({ sublistId: sublistId, fieldId: "custcol_tss_tdspercent", line: i })
                                    var tdsBaseAmount = current_record.getSublistValue({ sublistId: sublistId, fieldId: "custcol_tss_baseamount", line: i })
                                    var tdsRefId = current_record.getSublistValue({ sublistId: sublistId, fieldId: "custcol_tss_it_tds_ref_id", line: i })
                                    var tdsVEnum = current_record.getSublistValue({ sublistId: sublistId, fieldId: "custcol_tss_ve_certificate_no", line: i })

                                    if (_logValidation(TdsType) || _logValidation(TdsPercent) || _logValidation(tdsBaseAmount) || _logValidation(tdsRefId) || _logValidation(tdsVEnum)) {
                                        current_record.setSublistValue({ sublistId: sublistId, fieldId: "custcol_tss_itb_tdsmaster", line: i, value: '' });
                                        current_record.setSublistValue({ sublistId: sublistId, fieldId: "custcol_tss_tdspercent", line: i, value: '' });
                                        current_record.setSublistValue({ sublistId: sublistId, fieldId: "custcol_tss_baseamount", line: i, value: '' });
                                        current_record.setSublistValue({ sublistId: sublistId, fieldId: "custcol_tss_it_tds_ref_id", line: i, value: '' });
                                        current_record.setSublistValue({ sublistId: sublistId, fieldId: "custcol_tss_ve_certificate_no", line: i, value: '' });
                                    }
                                    continue;
                                }

                                var TdsRel = current_record.getSublistValue({ sublistId: sublistId, fieldId: "custcol_tss_tds_relation_type", line: i })
                                if (_logValidation(TdsRel)) {
                                    current_record.setSublistValue({ sublistId: sublistId, fieldId: "custcol_tss_tds_relation_type", line: i, value: '' });
                                }
                                var TdsAmt = current_record.getSublistValue({ sublistId: sublistId, fieldId: "amount", line: i })
                                if (_logValidation(TdsAmt) && TdsAmt > 0) {
                                    throw { name: 'TDS_APPLIED', message: 'Amount should be Negative Or Zero for TDS Line.' };
                                }

                                if (isOverrideLine && overrideTDS) {
                                    var missingFields = [];
                                    var ovrdTdsAmt = current_record.getSublistValue({
                                        sublistId: sublistId,
                                        fieldId: 'amount',
                                        line: i
                                    });
                                    if (_logValidation(ovrdTdsAmt) && ovrdTdsAmt > 0) {
                                        ovrdTdsAmt = -ovrdTdsAmt
                                        current_record.setSublistValue({
                                            sublistId: sublistId,
                                            fieldId: 'amount',
                                            value: ovrdTdsAmt,
                                            line: i
                                        });
                                    }

                                    var tdsType = current_record.getSublistValue({
                                        sublistId: sublistId,
                                        fieldId: 'custcol_tss_itb_tdsmaster',
                                        line: i
                                    });

                                    var tdsPercentage = current_record.getSublistValue({
                                        sublistId: sublistId,
                                        fieldId: 'custcol_tss_tdspercent',
                                        line: i
                                    });

                                    var tdsBaseAmt = current_record.getSublistValue({
                                        sublistId: sublistId,
                                        fieldId: 'custcol_tss_baseamount',
                                        line: i
                                    }) || 0;

                                    var refId = current_record.getSublistValue({
                                        sublistId: sublistId,
                                        fieldId: 'custcol_tss_it_tds_ref_id',
                                        line: i
                                    });
                                    var veNum = current_record.getSublistValue({
                                        sublistId: sublistId,
                                        fieldId: 'custcol_tss_ve_certificate_no',
                                        line: i
                                    });
                                    log.debug("tds missing details", {
                                        tdsType: tdsType,
                                        tdsPercentage: tdsPercentage,
                                        tdsBaseAmt: tdsBaseAmt,
                                        refId: refId
                                    })

                                    if (!_logValidation(tdsType)) missingFields.push("TDS Type");
                                    if (!_logValidation(tdsPercentage)) missingFields.push("TDS Percentage");
                                    if (!_logValidation(tdsBaseAmt)) {
                                        //  missingFields.push("TDS Base Amount");
                                    }
                                    if (!_logValidation(refId)) missingFields.push("TDS Reference ID");

                                    if (missingFields.length > 0) {
                                        errorMessages.push(
                                            sublistId.toUpperCase() + " Line " + (i + 1) +
                                            " missing:\n• " + missingFields.join("\n• ")
                                        );
                                        if (errorMessages.length > 0) {

                                            throw {
                                                name: 'TDS_APPLIED',
                                                message: 'TDS validation failed:\n\n' + errorMessages.join('\n\n')
                                            };

                                        }
                                    }
                                    var tdsTypeObj = search.lookupFields({
                                        type: 'customrecord_tss_its_tdsmaster',
                                        id: tdsType,
                                        columns: ['custrecord_tss_its_rounding']
                                    });
                                    var tdsTypeRound = tdsTypeObj.custrecord_tss_its_rounding
                                    var calculatedTdsAmt = (tdsPercentage / 100) * tdsBaseAmt;
                                    calculatedTdsAmt = applyTdsRoundMethod(tdsTypeRound, calculatedTdsAmt)
                                    if (-parseFloat(ovrdTdsAmt) != parseFloat(calculatedTdsAmt)) {
                                        throw {
                                            name: 'TDS_APPLIED',
                                            message: 'The TDS Amount is not calculated correctly based on the TDS Percentage and TDS Base Amount. Please verify.'
                                        };
                                    }

                                    if (overrideSections.includes(tdsType) || overrideSectionsVE.includes(tdsType)) {
                                        throw {
                                            name: 'TDS_APPLIED',
                                            message: 'Multiple TDS or Vendor Exemption lines are not allowed for the same TDS section in the sublist.'
                                        };
                                    }
                                    else {
                                        (_logValidation(veNum)) ? overrideSectionsVE.push(tdsType) : overrideSections.push(tdsType);
                                        overrideObjArr.push({ tdsType: tdsType, ovrTdsAmt: -TdsAmt, ovrTdsBaseAmt: tdsBaseAmt, veNum: veNum })
                                        if (sublistId == 'item') {
                                            overrideItemObjArr.push({ tdsType: tdsType, ovrTdsAmt: -TdsAmt, ovrTdsBaseAmt: tdsBaseAmt, veNum: veNum })
                                        }
                                        if (sublistId == 'expense') {
                                            overrideExpObjArr.push({ tdsType: tdsType, ovrTdsAmt: -TdsAmt, ovrTdsBaseAmt: tdsBaseAmt, veNum: veNum })
                                        }

                                    }
                                }
                            }
                        });


                        //Summarizing the Override TDS amounts and VE TDS Amounts
                        log.debug("overrideItemObjArr", overrideItemObjArr)
                        log.debug("overrideExpObjArr", overrideExpObjArr)
                        log.debug("overrideObjArr", overrideObjArr)
                        var groupedOverrideItemTDSobj = groupTdsData(overrideItemObjArr)
                        log.debug("groupedOverrideItemTDSobj", JSON.stringify(groupedOverrideItemTDSobj))
                        var groupedOverrideExpTDSobj = groupTdsData(overrideExpObjArr)
                        log.debug("groupedOverrideExpTDSobj", JSON.stringify(groupedOverrideExpTDSobj))
                        var groupedOverrideTDSobj = groupTdsData(overrideObjArr)
                        log.debug("groupedOverrideTDSobj", JSON.stringify(groupedOverrideTDSobj))


                        //Removing the TDS Lines in Non UI context
                        // if (runtime.executionContext != 'USERINTERFACE' && scriptContext.type != 'xedit') {
                        if (scriptContext.type != 'xedit') {
                            var Item_Count = current_record.getLineCount({ sublistId: 'item' });
                            for (var i = Item_Count - 1; i >= 0; i--) {
                                var Tdscheck = current_record.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_tss_tdsline',
                                    line: i
                                });
                                //log.debug("Tdscheck",Tdscheck);
                                // if (isTrue(Tdscheck)) {
                                //     current_record.removeLine({
                                //         sublistId: 'item',
                                //         line: i,
                                //         // ignoreRecalc: true
                                //     });
                                // } // end if(isTrue(Tdscheck))
                                var isOverrideLine = current_record.getSublistValue({ sublistId: 'item', fieldId: 'custcol_tss_it_tds_override', line: i });
                                var itmVeCert = current_record.getSublistValue({ sublistId: 'item', fieldId: 'custcol_tss_ve_certificate_no', line: i });
                                if (isTrue(Tdscheck) && (!isTrue(isOverrideLine) || !isTrue(overrideTDS))) {
                                    current_record.removeLine({ sublistId: 'item', line: i });
                                }

                            } // end for (var i = Item_Count-1; i >= 0; i--)
                            var Expense_Count = current_record.getLineCount({ sublistId: 'expense' });
                            log.debug("Expense_Count in pageInit", Expense_Count);
                            for (var i = Expense_Count - 1; i >= 0; i--) {
                                var Tdscheck = current_record.getSublistValue({
                                    sublistId: 'expense',
                                    fieldId: 'custcol_tss_tdsline',
                                    line: i
                                });
                                // if (isTrue(Tdscheck)) {
                                //     current_record.removeLine({
                                //         sublistId: 'expense',
                                //         line: i,
                                //     });
                                // } // end if(isTrue(Tdscheck))


                                var isExpOverrideLine = current_record.getSublistValue({ sublistId: 'expense', fieldId: 'custcol_tss_it_tds_override', line: i });
                                var expVeCert = current_record.getSublistValue({ sublistId: 'expense', fieldId: 'custcol_tss_ve_certificate_no', line: i });
                                if (isTrue(Tdscheck) && (!isTrue(isExpOverrideLine) || !isTrue(overrideTDS))) {
                                    current_record.removeLine({ sublistId: 'expense', line: i });
                                }
                            } // end for (var i = 0; i < Expense_Count; i++)

                        }
                        //End of removing TDS Lines in Non UI context

                        //Getting Start and Dates of current Financial year based on bill date
                        var FYdates = getStartEndDatesFY(rec_date)
                        log.debug("FYdates", FYdates)
                        var FYstartDate = FYdates[0]
                        var FYendDate = FYdates[1]

                        // In delete context, getValue is not accessed.
                        if (scriptContext.type == 'delete' || isVoided == 'Void') {
                            current_record = scriptContext.oldRecord;
                        }
                        //Getting last applied TDS details
                        var prevApliedTDSobj = current_record.getValue({
                            fieldId: 'custbody_tss_applied_tds_obj',
                        });
                        if (scriptContext.type == 'xedit') {
                            if (inArray("custbody_tss_applied_tds_obj", inlineFields) != 1) {
                                prevApliedTDSobj = scriptContext.oldRecord.getValue({ fieldId: "custbody_tss_applied_tds_obj" })
                            }
                        }
                        log.debug("prevApliedTDSobj", prevApliedTDSobj);
                        prevApliedTDSobj = _logValidation(prevApliedTDSobj) ? JSON.parse(prevApliedTDSobj) : {}
                        // log.debug("prevApliedTDSobj1", prevApliedTDSobj);
                        var AppliedTDSobj = {};

                        // log.debug("scriptContext.type", scriptContext.type)
                        if (scriptContext.type == 'delete' || isVoided == 'Void') {
                            if (_logValidation(prevApliedTDSobj)) {
                                // log.debug("prevApliedTDSobj", prevApliedTDSobj)
                                if (Object.keys(prevApliedTDSobj).length === 0) {

                                }
                                else {
                                    log.debug("to be throw error")
                                    throw { "name": "TDS_APPLIED", "message": "You can't delete/Void this transaction. Tvarana Indian TaxPro does not allow to delete/void the transaction if already TDS applied." }
                                }
                            }

                            //Getting VPP applied TDS details
                            var ApliedTDSvppObj = current_record.getValue({
                                fieldId: 'custbody_tss_it_vpp_appld_tds',
                            });
                            log.debug("ApliedTDSvppObj", ApliedTDSvppObj);
                            ApliedTDSvppObj = _logValidation(ApliedTDSvppObj) ? JSON.parse(ApliedTDSvppObj) : {}
                            if (!ApliedTDSvppObj || typeof ApliedTDSvppObj !== 'object') {
                                // Nothing to validate if null/undefined
                            }

                            for (var key in ApliedTDSvppObj) {
                                if (ApliedTDSvppObj.hasOwnProperty(key)) {
                                    var entry = ApliedTDSvppObj[key];
                                    if (entry && entry.tdsbaseamount && entry.tdsbaseamount > 0) {
                                        log.error("VPP TDS Base Amount is greater than zero for key: ", key);
                                        throw { "name": "TDS_APPLIED", "message": "You can't delete/Void this transaction. Tvarana Indian TaxPro does not allow to delete the transaction if Bill has Vendor Prepayments with TDS. Please Detach/Void/Delete the vendor prepayment and try to to delete/Void this transaction." }
                                    }
                                }
                            }


                        }

                        //Throwing error if vendor change if already tds applied
                        if (scriptContext.type != 'create') {
                            var Old_rec_vendor = scriptContext.oldRecord.getValue({ fieldId: "entity" })
                            if (rec_vendor != Old_rec_vendor) {
                                if (_logValidation(prevApliedTDSobj)) {
                                    // log.debug("prevApliedTDSobj", prevApliedTDSobj)
                                    if (Object.keys(prevApliedTDSobj).length === 0) {

                                    }
                                    else {
                                        // log.debug("to be throw error")
                                        throw { "name": "TDS_APPLIED", "message": "You can't Change the vendor in this transaction. Tvarana Indian TaxPro does not allow you to change the vendor in transaction if already TDS applied." }
                                    }
                                }
                            }
                        }

                        // Checking Vendor has PAN or not
                        var pan;
                        if (_logValidation(rec_vendor)) {
                            var vendorObj = search.lookupFields({
                                type: 'vendor',
                                id: rec_vendor,
                                columns: ['custentitytss_pan']
                            });
                            pan = vendorObj.custentitytss_pan;
                        }

                        // Getting TAN from Subsidiary record
                        var subObj = search.lookupFields({
                            type: 'subsidiary',
                            id: rec_subsidiary,
                            columns: ['custrecord_tss_it_tan']
                        });
                        var TAN = subObj.custrecord_tss_it_tan;


                        var Expense_Count = current_record.getLineCount({ sublistId: 'expense' });
                        log.debug("Expense_Count in beforeSubmit", Expense_Count);
                        var tdsTypeArray = [];
                        for (var i = 0; i < Expense_Count; i++) {
                            var UsertdsType = current_record.getSublistValue({
                                sublistId: 'expense',
                                fieldId: 'custcol_tss_tds_relation_type',
                                line: i
                            });
                            log.debug("UsertdsType in beforeSubmit CSV/WebServices", UsertdsType)
                            var tdsType;
                            if (currentContext != 'USERINTERFACE') {
                                if (_logValidation(UsertdsType)) {
                                    var tdsFlag = checkValidTDS(rec_vendor, UsertdsType);
                                    if (isTrue(tdsFlag)) {
                                        tdsType = UsertdsType;
                                    }
                                    else {
                                        throw "The TDS type you entered is not belongs to the Vendor";
                                    }
                                } // end if(isTrue(tdsApply) && _logValidation(UsertdsType))
                                else {
                                    if (isTDStobeDefault) {
                                        var deaultTDS = getTDSrel(rec_vendor, rec_date)
                                        if (deaultTDS) {
                                            current_record.setSublistValue({
                                                sublistId: 'expense',
                                                fieldId: 'custcol_tss_tds_relation_type',
                                                value: parseInt(deaultTDS),
                                                line: i
                                            });
                                            tdsType = deaultTDS
                                        }
                                    }
                                }
                            } // end if (currentContext != 'USERINTERFACE')
                            else if (currentContext == 'USERINTERFACE') {
                                tdsType = UsertdsType;
                            } // end else if(currentContext == 'USERINTERFACE')
                            // log.audit("tdsType", tdsType)
                            if (_logValidation(tdsType)) {
                                var BaseAmount = current_record.getSublistValue({
                                    sublistId: 'expense',
                                    fieldId: 'amount',
                                    line: i
                                });
                                var GrossAmount = current_record.getSublistValue({
                                    sublistId: 'expense',
                                    fieldId: 'grossamt',
                                    line: i
                                }) || 0;
                                if (isTrue(g_VNR_RCM_applicable)) {
                                    var applyRCM = current_record.getSublistValue({
                                        sublistId: 'expense',
                                        fieldId: 'custcol_tss_rcm_apply',
                                        line: i
                                    });
                                    if (isTrue(applyRCM)) {
                                        var rateRCM = current_record.getSublistValue({
                                            sublistId: 'expense',
                                            fieldId: 'custcol_tss_rcm_rate',
                                            line: i
                                        });
                                        var taxAmt = (parseFloat(rateRCM) * parseFloat(BaseAmount)) / 100;
                                        GrossAmount = parseFloat(BaseAmount) + parseFloat(taxAmt)
                                    }
                                }
                                var location = current_record.getSublistValue({
                                    sublistId: 'expense',
                                    fieldId: 'location',
                                    line: i
                                });
                                var department = current_record.getSublistValue({
                                    sublistId: 'expense',
                                    fieldId: 'department',
                                    line: i
                                });
                                var class1 = current_record.getSublistValue({
                                    sublistId: 'expense',
                                    fieldId: 'class',
                                    line: i
                                });
                                if (parseFloat(BaseAmount) > 0) {
                                    var exp_TdsType = { 'tdstype': tdsType, 'grossamt': GrossAmount, 'amount': BaseAmount, 'location': location, 'department': department, 'class1': class1, 'line': i + 1 };
                                    tdsTypeArray.push(exp_TdsType);
                                }
                            } // end if(isTrue(tdsApply) && _logValidation(tdsType))

                        } // end for(var i=0;i<Expense_Count;i++)

                        log.debug("tdsTypeArray", tdsTypeArray);

                        const groupArrayObject = tdsTypeArray.reduce((group, arr) => {
                            const { tdstype } = arr;
                            group[tdstype] = group[tdstype] ?? [];
                            group[tdstype].push(arr);
                            return group;
                        },
                            {});
                        //console.log(groupArrayObject);
                        //log.debug("result", groupArrayObject);
                        var uniqArr = [];
                        var expenseTDSobj = {} // This used for checking the tds line to be add in expense sublist
                        for (let key in groupArrayObject) {
                            if (groupArrayObject.hasOwnProperty(key)) {

                                var tdsTotalAmt = 0;
                                var tdsTotalGrossAmt = 0;
                                value = groupArrayObject[key];
                                //log.debug("type of val", typeof (value));
                                if (value.length > 0) {
                                    var location = value[0].location;
                                    var class1 = value[0].class1;
                                    var department = value[0].department;
                                    var linesStr = ''
                                    for (var i = 0; i < value.length; i++) {
                                        tdsTotalAmt = parseFloat(tdsTotalAmt) + parseFloat(value[i].amount);
                                        tdsTotalGrossAmt = parseFloat(tdsTotalGrossAmt) + parseFloat(value[i].grossamt);
                                        if (linesStr.length != 0) {
                                            linesStr += ','
                                        }
                                        linesStr += value[i].line
                                    }
                                    var UniqObj = { 'tdstype': key, 'amount': tdsTotalAmt, 'grossamt': tdsTotalGrossAmt, 'class1': class1, 'location': location, 'department': department, 'line': linesStr };
                                    uniqArr.push(UniqObj);
                                    expenseTDSobj[key] = { 'amount': tdsTotalAmt, 'grossamt': tdsTotalGrossAmt, 'class1': class1, 'location': location, 'department': department, 'line': linesStr };
                                }
                            }
                        }
                        log.debug("uniqArr in expense sublist", uniqArr);

                        var Item_Count = current_record.getLineCount({ sublistId: 'item' });
                        log.debug("Item_Count in beforeSubmit", Item_Count);
                        var tdsTypeItemArr = [];
                        for (var i = 0; i < Item_Count; i++) {

                            var UsertdsType = current_record.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_tss_tds_relation_type',
                                line: i
                            });

                            var tdsType;
                            if (currentContext != 'USERINTERFACE') {
                                if (_logValidation(UsertdsType)) {
                                    var tdsFlag = checkValidTDS(rec_vendor, UsertdsType);
                                    if (isTrue(tdsFlag)) {
                                        tdsType = UsertdsType;
                                    }
                                    else {
                                        throw "The TDS type you entered is not belongs to the Vendor";
                                    }
                                } // end if(_logValidation(UsertdsType))
                                else {
                                    if (isTDStobeDefault) {
                                        var deaultTDS = getTDSrel(rec_vendor, rec_date)
                                        if (deaultTDS) {
                                            current_record.setSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'custcol_tss_tds_relation_type',
                                                value: parseInt(deaultTDS),
                                                line: i
                                            });
                                            tdsType = deaultTDS
                                        }
                                    }
                                }

                            } // end if (currentContext != 'USERINTERFACE')

                            else if (currentContext == 'USERINTERFACE') {
                                tdsType = UsertdsType
                            } // end else if(currentContext == 'USERINTERFACE')

                            if (_logValidation(tdsType)) {

                                var GrossAmount = current_record.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'grossamt',
                                    line: i
                                }) || 0;

                                var BaseAmount = current_record.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'amount',
                                    line: i
                                });
                                if (isTrue(g_VNR_RCM_applicable)) {
                                    var applyRCM = current_record.getSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'custcol_tss_rcm_apply',
                                        line: i
                                    });
                                    if (isTrue(applyRCM)) {
                                        var rateRCM = current_record.getSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'custcol_tss_rcm_rate',
                                            line: i
                                        });
                                        var taxAmt = (parseFloat(rateRCM) * parseFloat(BaseAmount)) / 100;
                                        GrossAmount = parseFloat(BaseAmount) + parseFloat(taxAmt)
                                    }
                                }

                                var location = current_record.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'location',
                                    line: i
                                });
                                var department = current_record.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'department',
                                    line: i
                                });
                                var class1 = current_record.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'class',
                                    line: i
                                });
                                if (parseFloat(BaseAmount) > 0) {
                                    var item_TdsType = { 'tdstype': tdsType, 'amount': BaseAmount, 'grossamt': GrossAmount, 'location': location, 'department': department, 'class1': class1, 'line': i + 1 };
                                    tdsTypeItemArr.push(item_TdsType);
                                }
                            } // end if( _logValidation(tdsType))

                        } // end for(var i=0;i<Item_Count;i++)

                        const groupArrayObject1 = tdsTypeItemArr.reduce((group, arr) => {
                            const { tdstype } = arr;
                            group[tdstype] = group[tdstype] ?? [];
                            group[tdstype].push(arr);
                            return group;
                        },
                            {});
                        log.debug("result item", groupArrayObject1);
                        var uniqItemArr = [];
                        var itemTDSobj = {} // This used for checking the tds line to be add in item sublist
                        for (let key in groupArrayObject1) {
                            if (groupArrayObject1.hasOwnProperty(key)) {

                                var tdsTotalAmt = 0;
                                var tdsTotGrossAmt = 0;
                                value = groupArrayObject1[key];
                                //log.debug("type of val", typeof (value));
                                if (value.length > 0) {
                                    var location = value[0].location;
                                    var class1 = value[0].class1;
                                    var department = value[0].department;
                                    var linesStr = ''
                                    for (var i = 0; i < value.length; i++) {
                                        tdsTotalAmt = parseFloat(tdsTotalAmt) + parseFloat(value[i].amount);
                                        tdsTotGrossAmt = parseFloat(tdsTotGrossAmt) + parseFloat(value[i].grossamt);
                                        if (linesStr.length != 0) {
                                            linesStr += ','
                                        }
                                        linesStr += value[i].line
                                    }
                                    var UniqObj = {
                                        'tdstype': key, 'grossamt': tdsTotGrossAmt, 'amount': tdsTotalAmt, 'class1': class1, 'location': location, 'department': department, 'line': linesStr
                                    };
                                    uniqItemArr.push(UniqObj);
                                    itemTDSobj[key] = {
                                        'grossamt': tdsTotGrossAmt, 'amount': tdsTotalAmt, 'class1': class1, 'location': location, 'department': department, 'line': linesStr
                                    };
                                }
                            }
                        }
                        log.debug("uniqItemArr in Item Sublist", uniqItemArr);

                        // Combine both arrays into one
                        var combinedArr = uniqArr.concat(uniqItemArr);

                        // Create an object to hold the grouped results
                        var groupedData = {};

                        // Loop through the combined array to group by tdstype
                        for (var i = 0; i < combinedArr.length; i++) {
                            var item = combinedArr[i];
                            var tdstype = item.tdstype;

                            // If tdstype is not already in the groupedData object, initialize it
                            if (!groupedData[tdstype]) {
                                groupedData[tdstype] = {
                                    amount: 0,
                                    grossamt: 0
                                };
                            }

                            // Add the values of amount and grossamt to the corresponding tdstype group
                            groupedData[tdstype].amount += item.amount;
                            groupedData[tdstype].grossamt += item.grossamt;
                        }

                        log.debug("uniqTdsArr in beforeSubmit", groupedData);



                        for (var tdstype in groupedData) {
                            if (groupedData.hasOwnProperty(tdstype)) {
                                var data = groupedData[tdstype];

                                log.debug({
                                    title: 'Grouped Data for tdstype ' + tdstype,
                                    details: 'Amount: ' + data.amount + ', Gross Amount: ' + data.grossamt
                                });

                                // Getting applied VE internalid
                                var VEprevId;
                                if (scriptContext.type == 'edit') {
                                    if (prevApliedTDSobj[tdstype]) {
                                        VEprevId = prevApliedTDSobj[tdstype]['vetdsid']
                                    }
                                }

                                var TDSObj = getTDSdetails(tdstype, rec_subsidiary, rec_date, VEprevId, scriptContext.type);
                                // log.debug("TDSObj", TDSObj)
                                log.debug("TDSObj.tdsrelation", TDSObj.tdsrelation);

                                //Validation on TDS Relation whether it is valid or not.
                                var validUptoTDSrel = TDSObj.tdsrelation.custrecord_tss_tds_relation_valid_until;
                                var validFromTDSrel = TDSObj.tdsrelation.custrecord_tss_tds_relation_valid_from;
                                // log.debug("validFromTDSrel", validFromTDSrel)
                                if (_logValidation(validFromTDSrel)) {
                                    log.debug("validFromTDSrel", validFromTDSrel)
                                    var validFromDate = validFromTDSrel ? format.parse({ value: validFromTDSrel, type: format.Type.DATE }) : null;
                                    log.debug("validFromDate", validFromDate)
                                    var currentDate = rec_date ? format.parse({ value: rec_date, type: format.Type.DATE }) : null;
                                    if (currentDate < validFromDate) {
                                        throw "The TDS relation associated with this TDS type is not yet valid. Please update the TDS relation or select another TDS type.";
                                    }
                                }
                                if (_logValidation(validUptoTDSrel)) {
                                    var validUptoDate = validUptoTDSrel ? format.parse({ value: validUptoTDSrel, type: format.Type.DATE }) : null;
                                    var currentDate = rec_date ? format.parse({ value: rec_date, type: format.Type.DATE }) : null;
                                    if (currentDate > validUptoDate) {
                                        throw "The TDS relation associated with this TDS type is expired. Please update the TDS relation or select another TDS type.";
                                    }
                                }
                                //End of Validation on TDS Relation whether it is valid or not.

                                var isBucket = checkBucketRecord(rec_vendor, rec_subsidiary, TDSObj.tdsrelation.custrecord_tss_vedtdstype, FYstartDate, FYendDate)
                                log.debug("isBucket", isBucket)

                                //Defining the TDS Relation Data
                                var tdsCalculate = TDSObj.tdsrelation.custrecord_tss_tds_calculate
                                var tdsRate = 0;
                                if (_logValidation(pan)) {
                                    tdsRate = TDSObj.tdsrelation.custrecord_tss_tds_vednetper
                                }
                                else {
                                    tdsRate = TDSObj.tdsrelation.custrecord_tss_tds_vedempty_pan_tdsper
                                }
                                var tdsRounding = TDSObj.tdsrelation.custrecord_tss_tds_rounding
                                var tdsThreshold = TDSObj.tdsrelation.custrecord_tss_tds_threshold
                                var tdsCumulatThreshold = TDSObj.tdsrelation.custrecord_tss_tds_vedsurchargethreshold
                                var tdsItem = TDSObj.tdsrelation.custrecord_tss_tds_vedtdsitem
                                var tdsAccount = TDSObj.tdsrelation.custrecord_tss_tds_vedtdsaccount
                                var tdsRetrospective = TDSObj.tdsrelation.custrecord_tss_tds_retrospective

                                // Defining Total TDS Bsse amount and Total TDS Deducted amount
                                var totalTDSamt = 0;
                                var tdsBaseAmtTemp = 0;   // This used for Invoice Base Amount storage purpose like flag
                                var tdsBaseAmt = 0; // This is used for exceeded base amount for Vendor Exemption or TDS Invoice Base amount
                                var veBaseAmt = 0;   // This is used for Base Amount for Vendor Exemption
                                var veTotaltds = 0;  // Total Amount deducted under Vendor Exemption
                                var veExpired = false; // This is using for 
                                var totaltds = 0;    // Total Amount Deducted under TDS Relation
                                var DocThresholdReached = false;
                                var isTDSreached = false;
                                var bucketAccumPrev = 0;   // This is using for Accumulated FY Taxable Amount from Bucket record
                                var bucketAccumActualPrev = 0;    // This is using for Accumulated FY Actual Tax Amount from Bucket record
                                var bucketTotalTDS = 0; // This is using for Accumulated Tax Amount from Bucket record
                                var bucketDocIds = [];
                                var nonDeductInitialBaseAmt = 0
                                var nonDeductedBills = []
                                var isNonDeducted = false;
                                var nonDeductedBillsAmt = 0
                                var nonDeductExceessAmt = 0
                                var nonDeductBaseAmt = 0;
                                var isReachedNonDeductBill = false;
                                var isReachedNonDeductAccum = 0;
                                var isVEvalidOnDateChange = true;
                                //If TDS calculate on Base Amount
                                if (tdsCalculate == 1) {
                                    tdsBaseAmtTemp = data.amount
                                }
                                //If TDS calculate on Gross Amount
                                else if (tdsCalculate == 2) {
                                    tdsBaseAmtTemp = data.grossamt
                                }
                                var isTDSoverride = false;
                                var isVeTDSoverride = false;

                                // Checking the TDS eligibility if vendor doesn't have exemptions.
                                if (Object.keys(TDSObj.exemption).length === 0 && TDSObj.exemption.constructor === Object) {
                                    log.debug("no vendor exemption", TDSObj.exemption);
                                    // Assigning tdsBaseAmtTemp to tdsBaseAmt  
                                    tdsBaseAmt = tdsBaseAmtTemp;
                                }
                                // Checking the TDS eligibility if vendor have exemptions.
                                else {
                                    log.debug("yes have vendor exemption", TDSObj.exemption);
                                    //Defining the Vendor Exemption Data
                                    var veTDSschedule = TDSObj.exemption.custrecord_tss_ve_schedule
                                    var veTDSthreshold = TDSObj.exemption.custrecord_tss_ve_amount
                                    var veTDSrate = TDSObj.exemption.custrecord_tss_ve_rate
                                    var veTaxablePrev = TDSObj.exemption.custrecord_tss_ve_taxable_amt || 0
                                    var veTaxAmt = TDSObj.exemption.custrecord_tss_ve_tax_amt || 0
                                    var veFromDate = TDSObj.exemption.custrecord_tss_ve_from
                                    var veToDate = TDSObj.exemption.custrecord_tss_ve_to
                                    var veExpiredBill = TDSObj.exemption.custrecord_tss_ve_expired_billid || '[]'
                                    veExpiredBill = JSON.parse(veExpiredBill)
                                    var isVeExpired = TDSObj.exemption.custrecord_tss_ve_expired

                                    // Getting applied VE data and reducing the prev applied amounts
                                    if (scriptContext.type == 'edit') {
                                        if (prevApliedTDSobj[tdstype]) {
                                            veTaxablePrev = parseFloat(veTaxablePrev) - parseFloat(prevApliedTDSobj[tdstype]['vetdsbaseamt'] || 0)
                                            veTaxAmt = parseFloat(veTaxAmt) - parseFloat(prevApliedTDSobj[tdstype]['vetdsamt'] || 0)
                                        }
                                    }
                                    // log.debug("veBaseAmt", veBaseAmt)
                                    // log.debug("tdsBaseAmtTemp", tdsBaseAmtTemp)
                                    // log.debug("veTaxablePrev", veTaxablePrev)
                                    // log.debug("veTDSthreshold", veTDSthreshold)

                                    //Checking Vendor Exemption is valid or not if date is changed.
                                    if (_logValidation(veFromDate)) {
                                        log.debug("veFromDate", veFromDate)
                                        var validFromDate = veFromDate ? format.parse({ value: veFromDate, type: format.Type.DATE }) : null;
                                        log.debug("validFromDate", validFromDate)
                                        var currentDate = rec_date ? format.parse({ value: rec_date, type: format.Type.DATE }) : null;
                                        if (currentDate < validFromDate) {
                                            isVEvalidOnDateChange = false;
                                        }
                                    }
                                    if (_logValidation(veToDate)) {
                                        var validUptoDate = veToDate ? format.parse({ value: veToDate, type: format.Type.DATE }) : null;
                                        var currentDate = rec_date ? format.parse({ value: rec_date, type: format.Type.DATE }) : null;
                                        if (currentDate > validUptoDate) {
                                            isVEvalidOnDateChange = false;
                                        }
                                    }
                                    //End of Validation on TDS Relation whether it is valid or not.

                                    if (veTDSschedule == 1) {
                                        if (isTrue(isVEvalidOnDateChange)) {
                                            //If TDS Applied amount is not exceeded exemption
                                            if ((parseFloat(tdsBaseAmtTemp) + parseFloat(veTaxablePrev)) < parseFloat(veTDSthreshold)) {
                                                veBaseAmt = tdsBaseAmtTemp
                                                // log.debug("veBaseAmt1", veBaseAmt)
                                            }

                                            else {
                                                veBaseAmt = parseFloat(veTDSthreshold) - parseFloat(veTaxablePrev)
                                                tdsBaseAmt = parseFloat(tdsBaseAmtTemp) - parseFloat(veBaseAmt)
                                                veExpired = true;
                                                // log.debug("veBaseAmt2", veBaseAmt)
                                            }
                                        }
                                        else {
                                            tdsBaseAmt = tdsBaseAmtTemp
                                        }

                                        // If it is Amount based and VE is Expired and not expired in current bill and TDS is not accumulated in other bill during VE period
                                        if (scriptContext.type == 'edit' && isTrue(isVeExpired)) {
                                            // if (veExpiredBill.length > 0 && !veExpiredBill.includes(current_record.id)) {
                                            if (veBaseAmt < parseFloat(prevApliedTDSobj[tdstype]['vetdsbaseamt'] || 0)) {
                                                var tdsBaseAmtOverVE = getTdsBaseAmount(veFromDate, veToDate, tdstype, current_record)
                                                if (tdsBaseAmtOverVE > 0) {
                                                    throw { "name": "TDS_APPLIED", "message": "Reduction of TDS amount is not allowed. Vendor Exemption has expired, and the TDS base amount was accumulated during the exemption period." }
                                                }
                                            }
                                            // }
                                        }
                                    }
                                    else if (veTDSschedule == 2) {
                                        if (isTrue(isVEvalidOnDateChange)) {
                                            veBaseAmt = tdsBaseAmtTemp
                                        }
                                        else {
                                            tdsBaseAmt = tdsBaseAmtTemp
                                        }
                                    }
                                    // log.debug("veBaseAmt3", veBaseAmt)

                                    veTotaltds = (parseFloat(veTDSrate) * parseFloat(veBaseAmt)) / 100;
                                    veTotaltds = applyTdsRoundMethod(tdsRounding, veTotaltds);
                                    log.debug("Actual VE TDS baseAmt - amount - IsVEexpired", veBaseAmt + '-' + veTotaltds + '-' + veExpired)

                                    var conslVeBaseAmt = veBaseAmt
                                    var conslVeTotaltds = veTotaltds
                                    var conslVeExpired = veExpired
                                    //Override VE Line data
                                    if (groupedOverrideTDSobj[TDSObj.tdsrelation.custrecord_tss_vedtdstype]) {
                                        log.debug("This TDS Type VE is override, Entered into condition")
                                        var VEcertNum = TDSObj.exemption ? TDSObj.exemption.custrecord_tss_ve_certificate : ''
                                        var ovrVEnum = groupedOverrideTDSobj[TDSObj.tdsrelation.custrecord_tss_vedtdstype]['veNum']
                                        var isVeOverride = groupedOverrideTDSobj[TDSObj.tdsrelation.custrecord_tss_vedtdstype]['isVeOverride']
                                        if (isTrue(isVeOverride) && VEcertNum == ovrVEnum) {
                                            conslVeBaseAmt = groupedOverrideTDSobj[TDSObj.tdsrelation.custrecord_tss_vedtdstype]['ovrVeTdsBaseAmt']
                                            conslVeTotaltds = groupedOverrideTDSobj[TDSObj.tdsrelation.custrecord_tss_vedtdstype]['oveVeTdsAmt']
                                            isVeTDSoverride = true;
                                        }
                                        else if (isTrue(isVeOverride)) {
                                            throw { "name": "TDS_APPLIED", "message": "Something went wrong with Vendor Exemption Certificate Number. Please check once again" }
                                        }
                                        if (veTDSschedule == 1) {
                                            conslVeExpired = false
                                            if ((parseFloat(conslVeBaseAmt) + parseFloat(veTaxablePrev)) == parseFloat(veTDSthreshold)) {
                                                conslVeExpired = true;
                                            }
                                            else if ((parseFloat(conslVeBaseAmt) + parseFloat(veTaxablePrev)) > parseFloat(veTDSthreshold)) {
                                                throw { "name": "TDS_APPLIED", "message": "You cannot exceed the threshold of " + veTDSthreshold + " defined in the amount-based TDS Vendor Exemption certificate." }

                                            }
                                        }
                                        log.debug("Override VE TDS baseAmt - amount - IsVEexpired", conslVeBaseAmt + '-' + conslVeTotaltds + '-' + veExpired)
                                    }
                                    // Updating the accumulated Taxable and Tax amounts under Exemption
                                    if (conslVeTotaltds > 0 || (!isVEvalidOnDateChange && conslVeTotaltds == 0)) {
                                        var veUpdateObj = {}
                                        if (conslVeExpired) {
                                            veUpdateObj['custrecord_tss_ve_expired'] = true;
                                        }
                                        else {
                                            veUpdateObj['custrecord_tss_ve_expired'] = false;
                                        }
                                        veUpdateObj['custrecord_tss_ve_taxable_amt'] = parseFloat(conslVeBaseAmt) + parseFloat(veTaxablePrev);
                                        veUpdateObj['custrecord_tss_ve_tax_amt'] = parseFloat(conslVeTotaltds) + parseFloat(veTaxAmt);
                                        // log.debug("conslVeBaseAmt", conslVeBaseAmt)
                                        // log.debug("veTaxablePrev", veTaxablePrev)

                                        veUpdateObj['action'] = 'vendorexemption'
                                        toBeUpdateIdObj['ve-' + TDSObj.exemption.internalid] = veUpdateObj
                                        // log.debug("toBeUpdateIdObj", toBeUpdateIdObj)
                                    }

                                }
                                log.debug("TDS Amount deducted by Vendor Exemption", veTotaltds)


                                //If already accumulated bucket record existed, getting previous accumulated data
                                if (isBucket.isAvaiable) {
                                    var bucketLookup = search.lookupFields({
                                        type: 'customrecord_tss_accumulated_tds_tax',
                                        id: isBucket.details.id,
                                        columns: ['custrecord_tss_acc_tax_period_amt', 'custrecord_tss_acc_tax_doc_taxable_amt', 'custrecord_tss_itaccumulated_tax_amt', 'custrecord_tss_it_doc_threshould_reched', 'custrecord_tss_it_doc_reach_ids', 'custrecord_tss_it_acc_nondeduct_bills', 'custrecord_tss_it_acc_nondeduct_tdsamt']
                                    });
                                    bucketDocIds = bucketLookup.custrecord_tss_it_doc_reach_ids || '[]'
                                    bucketDocIds = JSON.parse(bucketDocIds)
                                    if (scriptContext.type == 'edit') {
                                        if (bucketDocIds.length > 1 && bucketDocIds.includes(current_record.id)) {
                                            isTDSreached = true
                                        }
                                    }
                                    nonDeductedBills = bucketLookup.custrecord_tss_it_acc_nondeduct_bills || '[]'
                                    nonDeductedBills = JSON.parse(nonDeductedBills)
                                    if (scriptContext.type == 'edit') {
                                        if (nonDeductedBills.length > 0 && nonDeductedBills.includes(current_record.id)) {
                                            isNonDeducted = true
                                        }
                                    }
                                    nonDeductedBillsAmt = parseFloat(bucketLookup.custrecord_tss_it_acc_nondeduct_tdsamt || 0)
                                    bucketAccumPrev = bucketLookup.custrecord_tss_acc_tax_period_amt || 0
                                    bucketTotalTDS = bucketLookup.custrecord_tss_itaccumulated_tax_amt || 0
                                    bucketAccumActualPrev = bucketAccumPrev
                                }

                                //If it is edit mode
                                if (scriptContext.type == 'edit') {
                                    if (prevApliedTDSobj[tdstype]) {
                                        // log.audit("bucketTotalTDS",bucketTotalTDS)
                                        // log.audit("prevApliedTDSobj[tdstype]['tdsamt']",prevApliedTDSobj[tdstype]['tdsamt'])
                                        bucketAccumPrev = parseFloat(bucketAccumPrev) - parseFloat(prevApliedTDSobj[tdstype]['tdsbaseamt'])
                                        bucketTotalTDS = parseFloat(bucketTotalTDS) - parseFloat(prevApliedTDSobj[tdstype]['tdsamt'])
                                        bucketAccumActualPrev = bucketAccumPrev
                                        // log.audit("bucketTotalTDS1",bucketTotalTDS)

                                        nonDeductedBillsAmt = parseFloat(nonDeductedBillsAmt) - parseFloat(prevApliedTDSobj[tdstype]['tdsamt'])
                                        nonDeductBaseAmt = parseFloat(prevApliedTDSobj[tdstype]['nondeducttdsbaseamt'] || 0);
                                        isReachedNonDeductBill = prevApliedTDSobj[tdstype]['isreachednondeductbill'];
                                        isReachedNonDeductAccum = prevApliedTDSobj[tdstype]['isreachednondeductaccum'] || 0;
                                        if (isNonDeducted && bucketTotalTDS > 0 && isTrue(isReachedNonDeductBill)) {
                                            if (parseFloat(isReachedNonDeductAccum) > 0) {
                                                bucketAccumPrev = isReachedNonDeductAccum;
                                            }
                                        }

                                        //If TDS Amount reduced in current bill and bill is non deducted bill
                                        if (isTrue(isNonDeducted) && bucketTotalTDS > 0 && nonDeductBaseAmt > tdsBaseAmt) {
                                            throw { "name": "TDS_APPLIED", "message": "TDS has already been deducted on other bills based on the accumulated amount including this bill. Reducing the bill amount is not allowed." }
                                        }
                                        else if (isTrue(isNonDeducted) && bucketTotalTDS > 0 && nonDeductBaseAmt < tdsBaseAmt) {
                                            //As TDS deducted in other bill due to Cumulative Threshold, TDS Base Amount should be less than DocumentThreshold
                                            if (tdsBaseAmt > tdsThreshold && !isTrue(isReachedNonDeductBill)) {
                                                throw { "name": "TDS_APPLIED", "message": "Since TDS has already been deducted on another bill based on the accumulated amount including this bill, the current bill can only be increased up to the document threshold." }
                                            }
                                        }
                                    }

                                }

                                //If already TDS is deducted
                                if (parseFloat(bucketTotalTDS) > 0) {
                                    isTDSreached = true
                                }

                                //Considering current bill into non deduct if thresholde reached in current bill
                                if (parseFloat(bucketTotalTDS) == 0) {
                                    isNonDeducted = true;
                                }

                                // Checking eligibility to deduct the TDS based on TDS Relation data 
                                if (tdsBaseAmt > 0) {
                                    log.debug("TDS Taxable Amount under actual section", tdsBaseAmt)

                                    // If Applied TDS Base Amount + Accumulated Taxable Amount is reached cumulative threshold
                                    if ((parseFloat(tdsBaseAmt) + parseFloat(bucketAccumPrev)) > parseFloat(tdsCumulatThreshold)) {
                                        isTDSreached = true
                                    }

                                    //Checking whether Applied TDS Base Amount is reached document threshold
                                    // else if (tdsBaseAmt > tdsThreshold) {
                                    if (tdsBaseAmt > tdsThreshold) {
                                        DocThresholdReached = true;
                                    }

                                    // else {

                                    // }
                                    if (DocThresholdReached || isTDSreached) {
                                        //Declaring the Exceeded amount variable
                                        var tdsExessAmt = 0

                                        // Checking the TDS has Retrospective or not
                                        if (isTrue(tdsRetrospective)) {
                                            if (parseFloat(bucketTotalTDS) > 0 && (!isTrue(isNonDeducted) || (isTrue(isNonDeducted) && parseFloat(bucketTotalTDS) >= nonDeductedBillsAmt))) {
                                                tdsExessAmt = tdsBaseAmt
                                                if (isTrue(isNonDeducted) && (parseFloat(bucketAccumPrev) < parseFloat(tdsCumulatThreshold)) && (parseFloat(tdsBaseAmt) + parseFloat(bucketAccumPrev)) > parseFloat(tdsCumulatThreshold)) {
                                                    tdsExessAmt = parseFloat(tdsBaseAmt) + parseFloat(bucketAccumPrev)
                                                }
                                            }
                                            else if (isTDSreached) {
                                                tdsExessAmt = parseFloat(tdsBaseAmt) + parseFloat(bucketAccumPrev)
                                            }
                                            else if (DocThresholdReached) {
                                                tdsExessAmt = tdsBaseAmt
                                            }
                                        }
                                        else {
                                            if (parseFloat(bucketTotalTDS) > 0 && (!isTrue(isNonDeducted) || (isTrue(isNonDeducted) && parseFloat(bucketTotalTDS) >= nonDeductedBillsAmt))) {
                                                tdsExessAmt = tdsBaseAmt
                                            }
                                            else if (isTDSreached) {
                                                log.debug("tdsBaseAmt", tdsBaseAmt)
                                                log.debug("bucketAccumPrev", bucketAccumPrev)
                                                tdsExessAmt = (parseFloat(tdsBaseAmt) + parseFloat(bucketAccumPrev)) - parseFloat(tdsCumulatThreshold)
                                            }
                                            else if (DocThresholdReached) {
                                                // log.debug("tdsBaseAmt", tdsBaseAmt)
                                                // log.debug("tdsThreshold", tdsThreshold)
                                                tdsExessAmt = tdsBaseAmt
                                            }
                                        }
                                        log.debug("tdsExessAmt", tdsExessAmt)
                                        // Calculating the TDS Deduction Amount
                                        totaltds = (parseFloat(tdsRate) * parseFloat(tdsExessAmt)) / 100;
                                        if (scriptContext.type == 'edit') {
                                            if (isTrue(isNonDeducted) && bucketTotalTDS > 0 && nonDeductBaseAmt <= tdsBaseAmt && !isTrue(isReachedNonDeductBill)) {
                                                nonDeductExceessAmt = tdsBaseAmt - nonDeductBaseAmt
                                                log.debug("Excess amount in non deduct bill", nonDeductExceessAmt)
                                                totaltds = (parseFloat(tdsRate) * parseFloat(nonDeductExceessAmt)) / 100;
                                            }
                                            // else if (isTrue(isNonDeducted) && bucketTotalTDS > 0 && nonDeductBaseAmt == tdsBaseAmt && isTrue(isReachedNonDeductBill)) {
                                            //     totaltds = prevApliedTDSobj[tdstype]['tdsamt'] || 0

                                            // }
                                        }
                                        if (isNonDeducted && bucketTotalTDS == 0 && totaltds > 0) {
                                            isReachedNonDeductBill = true;
                                            isReachedNonDeductAccum = parseFloat(bucketAccumPrev)
                                        }
                                        log.debug("totaltds", totaltds)
                                        totaltds = applyTdsRoundMethod(tdsRounding, totaltds);
                                    }


                                }
                                if (groupedOverrideTDSobj[TDSObj.tdsrelation.custrecord_tss_vedtdstype]) {
                                    var isOverride = groupedOverrideTDSobj[TDSObj.tdsrelation.custrecord_tss_vedtdstype]['isOverride']
                                    if (isTrue(isOverride)) {
                                        isTDSoverride = true;
                                        tdsBaseAmt = groupedOverrideTDSobj[TDSObj.tdsrelation.custrecord_tss_vedtdstype]['ovrTdsBaseAmt']
                                        totaltds = groupedOverrideTDSobj[TDSObj.tdsrelation.custrecord_tss_vedtdstype]['ovrTdsAmt']
                                        log.debug("This TDS Type is override, Entered into condition", tdsBaseAmt)
                                        //re-initializing the threshold in override
                                        isTDSreached = false;
                                        DocThresholdReached = false;
                                        // If Override TDS Base Amount + Accumulated Taxable Amount is reached cumulative threshold
                                        if ((parseFloat(tdsBaseAmt) + parseFloat(bucketAccumPrev)) > parseFloat(tdsCumulatThreshold)) {
                                            isTDSreached = true
                                        }
                                        //Checking whether Override TDS Base Amount is reached document threshold
                                        if (tdsBaseAmt > tdsThreshold) {
                                            DocThresholdReached = true;
                                        }
                                    }
                                }
                                //Defining the initial non deduct base amount
                                if (totaltds == 0 && bucketTotalTDS == 0) {
                                    nonDeductInitialBaseAmt = tdsBaseAmt
                                }
                                else if (isNonDeducted) {
                                    nonDeductInitialBaseAmt = nonDeductBaseAmt
                                    if (totaltds > 0 && bucketTotalTDS == 0) {
                                        nonDeductInitialBaseAmt = tdsBaseAmt

                                    }
                                }
                                if (isNonDeducted && totaltds == 0) {
                                    isReachedNonDeductBill = false;
                                    isReachedNonDeductAccum = 0;
                                }


                                //If already accumulated bucket record existed, updating the accumulating data
                                if (isBucket.isAvaiable) {
                                    var bucketUpdaeObj = {}
                                    log.audit("totaltds", totaltds)
                                    log.audit("bucketTotalTDS isAvailable", bucketTotalTDS)
                                    bucketUpdaeObj['custrecord_tss_acc_tax_period_amt'] = parseFloat(tdsBaseAmt) + parseFloat(bucketAccumActualPrev)
                                    bucketUpdaeObj['custrecord_tss_itaccumulated_tax_amt'] = parseFloat(totaltds) + parseFloat(bucketTotalTDS)
                                    bucketUpdaeObj['custrecord_tss_it_doc_reach_ids'] = bucketDocIds
                                    log.debug("DocThresholdReached to check in bucket is available", DocThresholdReached)
                                    if (DocThresholdReached) {
                                        bucketUpdaeObj['custrecord_tss_it_doc_threshould_reched'] = true
                                        bucketUpdaeObj['custrecord_tss_acc_tax_doc_taxable_amt'] = tdsBaseAmt

                                        bucketUpdaeObj['action'] = 'addId'
                                    }
                                    else {
                                        if (scriptContext.type == 'edit') {
                                            if (bucketDocIds.length == 1 && bucketDocIds.includes(current_record.id)) {
                                                bucketUpdaeObj['custrecord_tss_it_doc_threshould_reched'] = false
                                            }
                                        }
                                        bucketUpdaeObj['action'] = 'no'
                                    }

                                    //Updating nonDeduction fields if eligible
                                    if (totaltds == 0 && tdsBaseAmt > 0) {
                                        bucketUpdaeObj['nondeductaction'] = 'addId'
                                        bucketUpdaeObj['custrecord_tss_it_acc_nondeduct_tdsamt'] = parseFloat(totaltds) + parseFloat(nonDeductedBillsAmt)
                                        bucketUpdaeObj['custrecord_tss_it_acc_nondeduct_bills'] = nonDeductedBills
                                    }
                                    else if ((totaltds > 0 || tdsBaseAmt == 0) && scriptContext.type == 'edit') {
                                        log.audit("totaltds", totaltds)
                                        if (isNonDeducted && tdsBaseAmt != 0) {
                                            log.audit("threshold reached non deduct tdsBaseAmt - nonDeductedBillsAmt - totaltds", tdsBaseAmt + ' - ' + nonDeductedBillsAmt + ' - ' + totaltds)
                                            bucketUpdaeObj['nondeductaction'] = 'addId'
                                            bucketUpdaeObj['custrecord_tss_it_acc_nondeduct_tdsamt'] = parseFloat(totaltds) + parseFloat(nonDeductedBillsAmt)
                                            bucketUpdaeObj['custrecord_tss_it_acc_nondeduct_bills'] = nonDeductedBills
                                        }
                                        else if (bucketTotalTDS == 0) {
                                            log.audit("bucketTotalTDS - nonDeductedBillsAmt", bucketTotalTDS + '-' + nonDeductedBillsAmt + '-' + nonDeductBaseAmt)
                                            bucketUpdaeObj['nondeductaction'] = 'no'
                                            bucketUpdaeObj['custrecord_tss_it_acc_nondeduct_tdsamt'] = parseFloat(nonDeductedBillsAmt) - totaltds
                                            bucketUpdaeObj['custrecord_tss_it_acc_nondeduct_bills'] = nonDeductedBills
                                        }
                                    }


                                    //Updating the cache with tax bucket new data
                                    toBeUpdateIdObj['acc-' + isBucket.details.id] = bucketUpdaeObj;

                                }
                                //If accumulated bucket is not available, create the record
                                else {
                                    var bucketUpdaeObjNew = {}
                                    bucketUpdaeObjNew['custrecord_tss_it_doc_reach_ids'] = []
                                    bucketUpdaeObjNew['action'] = 'no'
                                    //Creating the Accumulated Tax Bucket custom record
                                    var TaxBucktRec = record.create({
                                        type: 'customrecord_tss_accumulated_tds_tax',
                                    });
                                    TaxBucktRec.setValue({
                                        fieldId: 'custrecord_tss_acc_tax_section',
                                        value: TDSObj.tdsrelation.custrecord_tss_vedtdstype
                                    });

                                    TaxBucktRec.setValue({
                                        fieldId: 'custrecord_tss_acc_tax_vendor',
                                        value: rec_vendor
                                    })
                                    TaxBucktRec.setValue({
                                        fieldId: 'custrecord_tss_acc_tax_subsidiary',
                                        value: rec_subsidiary
                                    })
                                    TaxBucktRec.setText({
                                        fieldId: 'custrecord_tss_acc_tax__startdate',
                                        text: FYstartDate
                                    })
                                    TaxBucktRec.setText({
                                        fieldId: 'custrecord_tss_acc_tax_enddate',
                                        text: FYendDate
                                    });
                                    TaxBucktRec.setValue({
                                        fieldId: 'custrecord_tss_it_tan_1',
                                        text: TAN
                                    });

                                    TaxBucktRec.setValue({
                                        fieldId: 'custrecord_tss_acc_tax_period_amt',
                                        value: tdsBaseAmt
                                    });
                                    bucketUpdaeObjNew['custrecord_tss_acc_tax_period_amt'] = tdsBaseAmt

                                    TaxBucktRec.setValue({
                                        fieldId: 'custrecord_tss_itaccumulated_tax_amt',
                                        value: totaltds
                                    });
                                    bucketUpdaeObjNew['custrecord_tss_itaccumulated_tax_amt'] = totaltds

                                    if (DocThresholdReached) {
                                        TaxBucktRec.setValue({
                                            fieldId: 'custrecord_tss_it_doc_threshould_reched',
                                            value: true
                                        });
                                        bucketUpdaeObjNew['custrecord_tss_it_doc_threshould_reched'] = true
                                        TaxBucktRec.setValue({
                                            fieldId: 'custrecord_tss_acc_tax_doc_taxable_amt',
                                            value: tdsBaseAmt
                                        });
                                        bucketUpdaeObjNew['custrecord_tss_acc_tax_doc_taxable_amt'] = tdsBaseAmt
                                        bucketUpdaeObjNew['action'] = 'addId'
                                    }

                                    //Updating nonDeduction fields if eligible
                                    if (totaltds == 0) {
                                        bucketUpdaeObjNew['nondeductaction'] = 'addId'
                                        // bucketUpdaeObjNew['custrecord_tss_it_acc_nondeduct_tdsamt'] = parseFloat(totaltds) + parseFloat(nonDeductedBillsAmt)
                                        bucketUpdaeObjNew['custrecord_tss_it_acc_nondeduct_bills'] = nonDeductedBills
                                    }
                                    else if (totaltds > 0) {
                                        if (bucketTotalTDS == 0) {
                                            bucketUpdaeObjNew['nondeductaction'] = 'addId'
                                            bucketUpdaeObjNew['custrecord_tss_it_acc_nondeduct_tdsamt'] = parseFloat(totaltds)
                                            bucketUpdaeObjNew['custrecord_tss_it_acc_nondeduct_bills'] = nonDeductedBills
                                        }
                                    }


                                    // Saving the new accumulated tax bucket record
                                    var TaxBucketId = TaxBucktRec.save({
                                        enableSourcing: true,
                                        ignoreMandatoryFields: true
                                    });

                                    //Updating cache object
                                    toBeUpdateIdObj['acc-' + TaxBucketId] = bucketUpdaeObjNew
                                    log.debug("Accumulated Tax Bucket is created for this FY Internal Id - ", TaxBucketId)
                                }

                                AppliedTDSobj[tdstype] = { 'tdsbaseamt': tdsBaseAmt, 'tdsamt': totaltds, 'tdsdocreached': DocThresholdReached, 'tdscumulreached': isTDSreached, 'vetdsbaseamt': conslVeBaseAmt, 'vetdsamt': conslVeTotaltds, 'vetdsid': TDSObj.exemption ? TDSObj.exemption.internalid : '', 'vetdscertificate': TDSObj.exemption ? TDSObj.exemption.custrecord_tss_ve_certificate : '', 'nondeducttdsbaseamt': nonDeductInitialBaseAmt, 'isreachednondeductbill': isReachedNonDeductBill, 'isreachednondeductaccum': isReachedNonDeductAccum }

                                //Considering the valid Tds thresholds, amounts for non deducted bills
                                if (isNonDeducted && totaltds > 0) {
                                    if (bucketTotalTDS > 0 && !isTrue(isReachedNonDeductBill)) {
                                        tdsCumulatThreshold = nonDeductInitialBaseAmt;
                                        tdsRetrospective = false;
                                    }
                                }

                                // Defining the Base Amounts for both item and expense sublists individually
                                var expBaseAmt = 0;
                                var itemBaseAmt = 0;

                                //If TDS calculate on Base Amount
                                if (tdsCalculate == 1) {
                                    if (expenseTDSobj[tdstype] && expenseTDSobj[tdstype]['amount']) {
                                        expBaseAmt = expenseTDSobj[tdstype]['amount'];
                                    }
                                    if (itemTDSobj[tdstype] && itemTDSobj[tdstype]['amount']) {
                                        itemBaseAmt = itemTDSobj[tdstype]['amount'];
                                    }
                                }
                                //If TDS calculate on Gross Amount
                                else if (tdsCalculate == 2) {
                                    if (expenseTDSobj[tdstype] && expenseTDSobj[tdstype]['grossamt']) {
                                        expBaseAmt = expenseTDSobj[tdstype]['grossamt'];
                                    }
                                    if (itemTDSobj[tdstype] && itemTDSobj[tdstype]['grossamt']) {
                                        itemBaseAmt = itemTDSobj[tdstype]['grossamt'];
                                    }
                                }

                                //Updating Item and Expense BaseAmounts with Override details
                                if (groupedOverrideTDSobj[TDSObj.tdsrelation.custrecord_tss_vedtdstype]) {
                                    //Updating current TDS relation is proceessed with Override TDS Section
                                    groupedOverrideTDSobj[TDSObj.tdsrelation.custrecord_tss_vedtdstype]['isProcessed'] = true
                                    // if (groupedOverrideExpTDSobj[TDSObj.tdsrelation.custrecord_tss_vedtdstype]) {
                                    //     var expBaseAmtOverride = groupedOverrideExpTDSobj[TDSObj.tdsrelation.custrecord_tss_vedtdstype]['ovrTdsBaseAmt']
                                    //     var expBaseAmtVeOverride = groupedOverrideExpTDSobj[TDSObj.tdsrelation.custrecord_tss_vedtdstype]['ovrVeTdsBaseAmt']
                                    //     expBaseAmt = expBaseAmtOverride + expBaseAmtVeOverride
                                    // }
                                    // if (groupedOverrideItemTDSobj[TDSObj.tdsrelation.custrecord_tss_vedtdstype]) {
                                    //     var itemBaseAmtOverride = groupedOverrideItemTDSobj[TDSObj.tdsrelation.custrecord_tss_vedtdstype]['ovrTdsBaseAmt']
                                    //     var itemBaseAmtVeOverride = groupedOverrideItemTDSobj[TDSObj.tdsrelation.custrecord_tss_vedtdstype]['ovrVeTdsBaseAmt']
                                    //     itemBaseAmt = itemBaseAmtOverride + itemBaseAmtVeOverride
                                    // }
                                }
                                // Adding TDS Lines If TDS is not Override in both TDS and VE 0r any ofone override
                                if (!(isVeTDSoverride && isTDSoverride)) {
                                    // if Vendor  Exemption is applied on transaction, adding deduction lines.
                                    if (veTotaltds > 0) {
                                        // log.debug("Need to add deduct lines")

                                        //Defining TDS Vendor Exemption variables for calculations
                                        var expVEbaseAmt = 0;
                                        var itemVEbaseAmt = 0;
                                        var expVEtdsAmt = 0;
                                        var itemVEtdsAmt = 0;
                                        var expVElineStr = '';
                                        var itemVElineStr = '';
                                        var itemVEvalid = true
                                        var expVEvalid = true
                                        //Defining TDS Expense variables for calculations
                                        var expTDSstarted = false;
                                        var expTDSbaseAmt = 0;
                                        var expTDSamt = 0
                                        var expTDSlineStr = '';
                                        var exptdsReached = false;
                                        var expTdsAccumBase = 0;

                                        //Defining TDS Item variables for calculations
                                        var itemTDSstarted = false;
                                        var itemTDSbaseAmt = 0;
                                        var itemTDSamt = 0
                                        var itemTDSlineStr = '';
                                        var itemtdsReached = false;
                                        var itemTdsAccumBase = 0;


                                        // If Vendor Exemption expired in current transaction
                                        if (veExpired) {
                                            // If TDS VE is eligible for expenses
                                            if (parseFloat(expBaseAmt) > 0) {
                                                // If ve tds expired after expense in current transaction
                                                if (parseFloat(veBaseAmt) >= parseFloat(expBaseAmt)) {
                                                    expVEtdsAmt = (parseFloat(veTDSrate) * parseFloat(expBaseAmt)) / 100;
                                                    expVEtdsAmt = applyTdsRoundMethod(tdsRounding, expVEtdsAmt);
                                                    expVElineStr = expenseTDSobj[tdstype]['line'];
                                                    expVEbaseAmt = expBaseAmt
                                                }
                                                // If ve tds expired in expense of current transaction, Getting Expense Base VE TDS amount with line ID's
                                                else {
                                                    for (var ep = 0; ep < tdsTypeArray.length; ep++) {
                                                        if (tdsTypeArray[ep]['tdstype'] == tdstype) {
                                                            var expVEbaseAmtLine = 0
                                                            if (tdsCalculate == 1) {
                                                                expVEbaseAmtLine = parseFloat(tdsTypeArray[ep]['amount']);
                                                            }
                                                            if (tdsCalculate == 2) {
                                                                expVEbaseAmtLine = parseFloat(tdsTypeArray[ep]['grossamt']);
                                                            }
                                                            if ((parseFloat(expVEbaseAmtLine) + parseFloat(expVEbaseAmt)) <= parseFloat(veBaseAmt)) {
                                                                expVEbaseAmt = parseFloat(expVEbaseAmt) + parseFloat(expVEbaseAmtLine)
                                                                if (expVElineStr.length != 0) {
                                                                    expVElineStr += ','
                                                                }
                                                                expVElineStr = expVElineStr + tdsTypeArray[ep]['line']
                                                            }
                                                            else {
                                                                var expVEbaseAmtExcess = (parseFloat(expVEbaseAmtLine) + parseFloat(expVEbaseAmt)) - parseFloat(veBaseAmt)
                                                                expVEbaseAmtLine = parseFloat(expVEbaseAmtLine) - parseFloat(veBaseAmt)
                                                                expVEbaseAmt = veBaseAmt
                                                                if (expVEvalid) {
                                                                    if (expVElineStr.length != 0) {
                                                                        expVElineStr += ','
                                                                    }
                                                                    expVElineStr = expVElineStr + tdsTypeArray[ep]['line']
                                                                    expVEvalid = false;
                                                                }
                                                                log.debug("!(parseFloat(tdsBaseAmt) > 0)", !(parseFloat(tdsBaseAmt) > 0))
                                                                if (!(parseFloat(tdsBaseAmt) > 0)) {
                                                                    break;
                                                                }
                                                                else {
                                                                    if (expTDSlineStr.length != 0) {
                                                                        expTDSlineStr += ','
                                                                    }
                                                                    expTDSlineStr = expTDSlineStr + tdsTypeArray[ep]['line']
                                                                }
                                                                // If TDS is deducted and expense ve is expired
                                                                if (parseFloat(tdsBaseAmt) > 0) {
                                                                    expTdsAccumBase = parseFloat(expTdsAccumBase) + parseFloat(expVEbaseAmtExcess)
                                                                    log.debug("If TDS is deducted and expense ve is expired", expTdsAccumBase)
                                                                    //If already tds deducted in previous transactions
                                                                    if ((parseFloat(bucketTotalTDS) > 0 && (!isTrue(isNonDeducted) || (isTrue(isNonDeducted) && parseFloat(bucketTotalTDS) >= nonDeductedBillsAmt))) || exptdsReached) {
                                                                        if (expTDSlineStr.length != 0) {
                                                                            expTDSlineStr += ','
                                                                        }
                                                                        expTDSbaseAmt = parseFloat(expTDSbaseAmt) + parseFloat(expVEbaseAmtExcess)
                                                                        expTDSlineStr = expTDSlineStr + tdsTypeArray[ep]['line']
                                                                    }
                                                                    // If cumulative threshold is reached
                                                                    else if ((parseFloat(expTdsAccumBase) + parseFloat(bucketAccumPrev)) > parseFloat(tdsCumulatThreshold)) {
                                                                        exptdsReached = true;
                                                                        if (isTrue(tdsRetrospective)) {
                                                                            expTDSbaseAmt = parseFloat(expTdsAccumBase) + parseFloat(bucketAccumPrev)
                                                                        }
                                                                        else {
                                                                            expTDSbaseAmt = parseFloat(expTdsAccumBase) + parseFloat(bucketAccumPrev) - parseFloat(tdsCumulatThreshold)
                                                                        }
                                                                        log.debug("If cumulative threshold is reached", expTDSbaseAmt)
                                                                        if (expTDSlineStr.length != 0) {
                                                                            expTDSlineStr += ','
                                                                        }
                                                                        expTDSlineStr = expTDSlineStr + tdsTypeArray[ep]['line']
                                                                    }
                                                                    // If Document threshold reached in current transaction
                                                                    else if (!isTDSreached && expTdsAccumBase > tdsThreshold) {
                                                                        exptdsReached = true;
                                                                        expTDSbaseAmt = expTdsAccumBase
                                                                        log.debug("If Document threshold reached in current transaction", expTDSbaseAmt)
                                                                        if (expTDSlineStr.length != 0) {
                                                                            expTDSlineStr += ','
                                                                        }
                                                                        expTDSlineStr = expTDSlineStr + tdsTypeArray[ep]['line']
                                                                    }

                                                                    //If tds is not eligible for both doc and cumulative threshold and tds is not yet deducted
                                                                    // else {
                                                                    //     expTdsAccumBase = parseFloat(expTdsAccumBase) + parseFloat(expVEbaseAmtLine)
                                                                    // }
                                                                }

                                                            }
                                                        }
                                                    }
                                                    expVEtdsAmt = (parseFloat(veTDSrate) * parseFloat(expVEbaseAmt)) / 100;
                                                    expVEtdsAmt = applyTdsRoundMethod(tdsRounding, expVEtdsAmt);
                                                    // If TDS is deducted in current transaction expenses
                                                    if (parseFloat(expTDSbaseAmt) > 0) {
                                                        expTDSamt = (parseFloat(tdsRate) * parseFloat(expTDSbaseAmt)) / 100;
                                                        expTDSamt = applyTdsRoundMethod(tdsRounding, expTDSamt);
                                                    }
                                                }
                                            }
                                            // if (parseFloat(veBaseAmt) > parseFloat(expVEbaseAmt)) {
                                            //     itemVEbaseAmt = expVEbaseAmt;
                                            // }
                                            //If TDS is not deducted in expense sublist
                                            if (expTDSamt == 0) {
                                                itemTdsAccumBase = itemTdsAccumBase + expTdsAccumBase
                                            }
                                            log.debug("itemTdsAccumBase before item calculating", itemTdsAccumBase)
                                            // If TDS is applied for Items
                                            if (parseFloat(itemBaseAmt) > 0) {
                                                var itemVEbaseAmt1 = parseFloat(veBaseAmt) - parseFloat(expVEbaseAmt)
                                                // If ve tds is not expired in item of current transaction
                                                if (parseFloat(itemVEbaseAmt1) >= parseFloat(itemBaseAmt)) {
                                                    itemVEtdsAmt = (parseFloat(veTDSrate) * parseFloat(itemBaseAmt)) / 100;
                                                    itemVEtdsAmt = applyTdsRoundMethod(tdsRounding, itemVEtdsAmt);
                                                    itemVElineStr = itemTDSobj[tdstype]['line'];
                                                    itemVEbaseAmt = itemBaseAmt
                                                }
                                                // If ve tds expired in items of current transaction
                                                else {
                                                    log.debug("entered into else item expired", itemVEbaseAmt1)
                                                    for (var im = 0; im < tdsTypeItemArr.length; im++) {
                                                        if (tdsTypeItemArr[im]['tdstype'] == tdstype) {
                                                            var itemVEbaseAmtLine = 0
                                                            if (tdsCalculate == 1) {
                                                                // if (itemVEvalid) {
                                                                //     itemVEbaseAmtLine = parseFloat(itemVEbaseAmt) + parseFloat(tdsTypeItemArr[im]['amount']);
                                                                // }
                                                                // else {
                                                                itemVEbaseAmtLine = parseFloat(tdsTypeItemArr[im]['amount']);
                                                                // }
                                                            }
                                                            if (tdsCalculate == 2) {
                                                                // if (itemVEvalid) {
                                                                //     itemVEbaseAmtLine = parseFloat(itemVEbaseAmt) + parseFloat(tdsTypeItemArr[im]['grossamt']);
                                                                // }
                                                                // else {
                                                                itemVEbaseAmtLine = parseFloat(tdsTypeItemArr[im]['grossamt']);
                                                                // }
                                                            }
                                                            log.debug("itemVEbaseAmtLine 1st", itemVEbaseAmtLine)
                                                            if ((parseFloat(itemVEbaseAmtLine) + parseFloat(itemVEbaseAmt)) <= parseFloat(itemVEbaseAmt1)) {
                                                                if (itemVElineStr.length != 0) {
                                                                    itemVElineStr += ','
                                                                }
                                                                itemVElineStr = itemVElineStr + tdsTypeItemArr[im]['line']
                                                                itemVEbaseAmt = parseFloat(itemVEbaseAmt) + parseFloat(itemVEbaseAmtLine)
                                                            }
                                                            else {
                                                                // IF VE is expired in item current line
                                                                var itemVEbaseAmtExcess = 0
                                                                if (itemVEbaseAmt1 > 0 && itemVEvalid) {
                                                                    itemVEbaseAmtExcess = (parseFloat(itemVEbaseAmt) + parseFloat(itemVEbaseAmtLine)) - parseFloat(itemVEbaseAmt1)
                                                                    log.debug("itemVEbaseAmtLine", itemVEbaseAmtLine)
                                                                    itemVEbaseAmt = itemVEbaseAmt1
                                                                    log.debug("itemVEbaseAmt", itemVEbaseAmt)
                                                                    if (itemVElineStr.length != 0) {
                                                                        itemVElineStr += ','
                                                                    }
                                                                    itemVElineStr = itemVElineStr + tdsTypeItemArr[im]['line']
                                                                    itemVEvalid = false
                                                                }
                                                                else {
                                                                    itemVEbaseAmtExcess = itemVEbaseAmtLine
                                                                }
                                                                if (!(parseFloat(tdsBaseAmt) > 0)) {
                                                                    break;
                                                                }
                                                                // If TDS is deducted and item ve is expired
                                                                if (parseFloat(tdsBaseAmt) > 0) {
                                                                    itemTdsAccumBase = parseFloat(itemTdsAccumBase) + parseFloat(itemVEbaseAmtExcess)
                                                                    log.debug("itemTdsAccumBase1", itemTdsAccumBase)
                                                                    //If already tds deducted in previous transactions
                                                                    if ((parseFloat(bucketTotalTDS) > 0 && (!isTrue(isNonDeducted) || (isTrue(isNonDeducted) && parseFloat(bucketTotalTDS) >= nonDeductedBillsAmt))) || itemtdsReached || exptdsReached) {
                                                                        log.debug("entered in base line amt", bucketTotalTDS + '-' + exptdsReached + '-' + itemtdsReached)
                                                                        if (itemTDSlineStr.length != 0) {
                                                                            itemTDSlineStr += ','
                                                                        }
                                                                        itemTDSbaseAmt = parseFloat(itemTDSbaseAmt) + parseFloat(itemVEbaseAmtExcess)
                                                                        itemTDSlineStr = itemTDSlineStr + tdsTypeItemArr[im]['line']
                                                                    }
                                                                    // If cumulative threshold is reached
                                                                    else if ((parseFloat(itemTdsAccumBase) + parseFloat(bucketAccumPrev)) > parseFloat(tdsCumulatThreshold)) {
                                                                        log.debug("Entered in cumulative")
                                                                        itemtdsReached = true;
                                                                        if (isTrue(tdsRetrospective)) {
                                                                            itemTDSbaseAmt = parseFloat(itemTdsAccumBase) + parseFloat(bucketAccumPrev)
                                                                        }
                                                                        else {
                                                                            itemTDSbaseAmt = parseFloat(itemTdsAccumBase) - parseFloat(tdsCumulatThreshold)
                                                                        }
                                                                        if (itemTDSlineStr.length != 0) {
                                                                            itemTDSlineStr += ','
                                                                        }
                                                                        itemTDSlineStr = itemTDSlineStr + tdsTypeItemArr[im]['line']
                                                                    }
                                                                    // If Document threshold reached in current transaction
                                                                    else if (!isTDSreached && itemTdsAccumBase > tdsThreshold) {
                                                                        log.debug("Entered into item doc threshold")
                                                                        itemtdsReached = true;
                                                                        // if (isTrue(tdsRetrospective)) {
                                                                        //     itemTDSbaseAmt = parseFloat(itemTdsAccumBase) + parseFloat(bucketAccumPrev)
                                                                        // }
                                                                        // else {
                                                                        //     log.debug("non retro", itemTdsAccumBase + '-' + tdsThreshold)
                                                                        //     itemTDSbaseAmt = parseFloat(itemTdsAccumBase) - parseFloat(tdsThreshold)
                                                                        //     log.debug('itemTDSbaseAmt', itemTDSbaseAmt)
                                                                        // }
                                                                        itemTDSbaseAmt = parseFloat(itemTdsAccumBase)
                                                                        if (itemTDSlineStr.length != 0) {
                                                                            itemTDSlineStr += ','
                                                                        }
                                                                        itemTDSlineStr = itemTDSlineStr + tdsTypeItemArr[im]['line']
                                                                    }
                                                                    //If tds is not eligible for both doc and cumulative threshold and tds is not yet deducted
                                                                    else {
                                                                        log.debug("Entered in accumulation")
                                                                        if (itemTDSlineStr.length != 0) {
                                                                            itemTDSlineStr += ','
                                                                        }
                                                                        itemTDSlineStr = itemTDSlineStr + tdsTypeItemArr[im]['line']

                                                                    }
                                                                }

                                                            }
                                                        }
                                                    }
                                                    // If TDS VE is deducted in current transaction items
                                                    if (parseFloat(itemVEbaseAmt) > 0) {
                                                        itemVEtdsAmt = (parseFloat(veTDSrate) * parseFloat(itemVEbaseAmt)) / 100;
                                                        itemVEtdsAmt = applyTdsRoundMethod(tdsRounding, itemVEtdsAmt);
                                                    }
                                                    // If TDS is deducted in current transaction items
                                                    if (parseFloat(itemTDSbaseAmt) > 0) {
                                                        itemTDSamt = (parseFloat(tdsRate) * parseFloat(itemTDSbaseAmt)) / 100;
                                                        itemTDSamt = applyTdsRoundMethod(tdsRounding, itemTDSamt);
                                                    }
                                                }
                                            }

                                        }
                                        // If Vendor Exemption is not expired in current transaction
                                        else {
                                            // If TDS VE is eligible for expenses
                                            if (parseFloat(expBaseAmt) > 0) {
                                                expVEtdsAmt = (parseFloat(veTDSrate) * parseFloat(expBaseAmt)) / 100;
                                                expVEtdsAmt = applyTdsRoundMethod(tdsRounding, expVEtdsAmt);
                                                expVElineStr = expenseTDSobj[tdstype]['line'];
                                                expVEbaseAmt = expBaseAmt
                                            }

                                            // If TDS VE is eligible for Items
                                            if (parseFloat(itemBaseAmt) > 0) {
                                                itemVEtdsAmt = (parseFloat(veTDSrate) * parseFloat(itemBaseAmt)) / 100;
                                                itemVEtdsAmt = applyTdsRoundMethod(tdsRounding, itemVEtdsAmt);
                                                itemVElineStr = itemTDSobj[tdstype]['line'];
                                                itemVEbaseAmt = itemBaseAmt
                                            }
                                        }
                                        log.debug("itemTdsAccumBase", itemTdsAccumBase)
                                        log.debug("itemTDSbaseAmt - itemTDSamt", itemTDSbaseAmt + '-' + itemTDSamt)
                                        log.debug("itemTDSlineStr", itemTDSlineStr)
                                        log.debug("item ve base - vetdsamt", itemVEbaseAmt + '-' + itemVEtdsAmt)
                                        log.debug("itemVElineStr", itemVElineStr)
                                        // If TDS VE deducted in expense sublist, Adding the deducted line
                                        if (parseFloat(expVEtdsAmt) > 0) {
                                            log.debug("If TDS VE deducted in expense sublist, Adding the deducted line", expVEtdsAmt)
                                            //If TDS VE is not override
                                            if (!isVeTDSoverride) {
                                                var newline = current_record.getLineCount({ sublistId: 'expense' });
                                                current_record.insertLine({ sublistId: 'expense', line: newline });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'account',
                                                    value: parseInt(tdsAccount),
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'taxcode',
                                                    value: g_tdsCode,
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'amount',
                                                    value: -parseFloat(expVEtdsAmt),
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'grossamt',
                                                    value: -parseFloat(expVEtdsAmt),
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'custcol_tss_baseamount',
                                                    value: parseFloat(expVEbaseAmt),
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'custcol_tss_it_tds_ref_id',
                                                    value: expVElineStr,
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'custcol_tss_tdsline',
                                                    value: true,
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'custcol_tss_tdspercent',
                                                    value: parseFloat(veTDSrate),
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'location',
                                                    value: expenseTDSobj[tdstype]['location'],
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'department',
                                                    value: expenseTDSobj[tdstype]['department'],
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'class',
                                                    value: expenseTDSobj[tdstype]['class1'],
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'custcol_tss_ve_certificate_no',
                                                    value: TDSObj.exemption.custrecord_tss_ve_certificate,
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'custcol_tss_itb_tdsmaster',
                                                    value: TDSObj.tdsrelation.custrecord_tss_vedtdstype,
                                                    line: newline
                                                });
                                            }
                                        }

                                        // If TDS deducted in expense sublist, Adding the deducted line
                                        if (parseFloat(expTDSamt) > 0) {
                                            log.debug("If TDS deducted in expense sublist, Adding the deducted line", expTDSamt)
                                            //If TDS is not override
                                            if (!isTDSoverride) {
                                                var newline = current_record.getLineCount({ sublistId: 'expense' });
                                                current_record.insertLine({ sublistId: 'expense', line: newline });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'account',
                                                    value: parseInt(tdsAccount),
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'taxcode',
                                                    value: g_tdsCode,
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'amount',
                                                    value: -parseFloat(expTDSamt),
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'grossamt',
                                                    value: -parseFloat(expTDSamt),
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'custcol_tss_baseamount',
                                                    value: parseFloat(expTDSbaseAmt),
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'custcol_tss_it_tds_ref_id',
                                                    value: expTDSlineStr,
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'custcol_tss_tdsline',
                                                    value: true,
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'custcol_tss_tdspercent',
                                                    value: parseFloat(tdsRate),
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'location',
                                                    value: expenseTDSobj[tdstype]['location'],
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'department',
                                                    value: expenseTDSobj[tdstype]['department'],
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'class',
                                                    value: expenseTDSobj[tdstype]['class1'],
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'expense',
                                                    fieldId: 'custcol_tss_itb_tdsmaster',
                                                    value: TDSObj.tdsrelation.custrecord_tss_vedtdstype,
                                                    line: newline
                                                });
                                            }
                                        }

                                        //Adding VE deduction line in item sublist
                                        if (parseFloat(itemVEtdsAmt) > 0) {
                                            //If TDS VE is not override
                                            if (!isVeTDSoverride) {
                                                var newline = current_record.getLineCount({ sublistId: 'item' });
                                                current_record.insertLine({ sublistId: 'item', line: newline });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'item',
                                                    value: tdsItem,
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'taxcode',
                                                    value: g_tdsCode,
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'rate',
                                                    value: -parseFloat(itemVEtdsAmt),
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'amount',
                                                    value: -parseFloat(itemVEtdsAmt),
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'grossamt',
                                                    value: -parseFloat(itemVEtdsAmt),
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'custcol_tss_baseamount',
                                                    value: parseFloat(itemVEbaseAmt),
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'custcol_tss_it_tds_ref_id',
                                                    value: itemVElineStr,
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'custcol_tss_tdsline',
                                                    value: true,
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'custcol_tss_tdspercent',
                                                    value: parseFloat(veTDSrate),
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'location',
                                                    value: itemTDSobj[tdstype]['location'],
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'department',
                                                    value: itemTDSobj[tdstype]['department'],
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'class',
                                                    value: itemTDSobj[tdstype]['class1'],
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'custcol_tss_ve_certificate_no',
                                                    value: TDSObj.exemption.custrecord_tss_ve_certificate,
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'custcol_tss_itb_tdsmaster',
                                                    value: TDSObj.tdsrelation.custrecord_tss_vedtdstype,
                                                    line: newline
                                                });
                                            }
                                        }
                                        //Adding TDS deduction line in item sublist
                                        if (parseFloat(itemTDSamt) > 0) {
                                            log.debug("Adding TDS deduction line in item sublist", itemTDSamt)
                                            //If TDS is not override
                                            if (!isTDSoverride) {
                                                var newline = current_record.getLineCount({ sublistId: 'item' });
                                                current_record.insertLine({ sublistId: 'item', line: newline });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'item',
                                                    value: tdsItem,
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'taxcode',
                                                    value: g_tdsCode,
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'rate',
                                                    value: -parseFloat(itemTDSamt),
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'amount',
                                                    value: -parseFloat(itemTDSamt),
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'grossamt',
                                                    value: -parseFloat(itemTDSamt),
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'custcol_tss_baseamount',
                                                    value: parseFloat(itemTDSbaseAmt),
                                                    line: newline
                                                });
                                                var lineStr = itemTDSlineStr
                                                log.debug("item tds line after ve expired, expVEbaseAmtExcess - expTDSamt", expVEbaseAmtExcess + '-' + expTDSamt)
                                                if (parseFloat(expVEbaseAmtExcess) > 0 && parseFloat(expTDSamt) == 0) {
                                                    lineStr = 'Expense - ' + expTDSlineStr + ' & Items - ' + itemTDSlineStr
                                                }
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'custcol_tss_it_tds_ref_id',
                                                    value: lineStr, //itemTDSlineStr,
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'custcol_tss_tdsline',
                                                    value: true,
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'custcol_tss_tdspercent',
                                                    value: parseFloat(tdsRate),
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'location',
                                                    value: itemTDSobj[tdstype]['location'],
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'department',
                                                    value: itemTDSobj[tdstype]['department'],
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'class',
                                                    value: itemTDSobj[tdstype]['class1'],
                                                    line: newline
                                                });
                                                current_record.setSublistValue({
                                                    sublistId: 'item',
                                                    fieldId: 'custcol_tss_itb_tdsmaster',
                                                    value: TDSObj.tdsrelation.custrecord_tss_vedtdstype,
                                                    line: newline
                                                });
                                            }
                                        }
                                        log.debug("Added TDS VE deduction lines only")

                                    }
                                    // If Vendor Exemption is not applied and if TDS is deducted
                                    else if (parseFloat(totaltds) > 0) {
                                        //If TDS is not override
                                        if (!isTDSoverride) {
                                            // Adding the TDS deducted lines in transaction

                                            var expTdsAmt = 0;
                                            var isExpDocReached = false;
                                            var isExpCumReached = false;
                                            var expTDSbaseAmt = 0;
                                            var itemTdsAmt = 0;
                                            var isItemDocReached = false;
                                            var isItemCumReached = false;
                                            var itemTDSbaseAmt = 0;

                                            // Checking the eligibility of deduction in expense sublist
                                            if (expBaseAmt > 0) {
                                                if (tdsBaseAmt >= expBaseAmt) {
                                                    log.debug("Yes exceeded exp base amt", expBaseAmt)
                                                    var expBaseAmt1 = expBaseAmt
                                                    log.debug("expBaseAmt1", expBaseAmt1)
                                                    log.debug("bucketAccumPrev", bucketAccumPrev)
                                                    log.debug("tdsCumulatThreshold", tdsCumulatThreshold)
                                                    log.debug("bucketTotalTDS", bucketTotalTDS)
                                                    log.debug("isNonDeducted - nonDeductedBillsAmt", isNonDeducted + ' - ' + nonDeductedBillsAmt)

                                                    log.debug("AppliedTDSobj[tdstype]['tdscumulreached']", AppliedTDSobj[tdstype]['tdscumulreached'])
                                                    // If the TDS eligible for deduction in expenses, 
                                                    if (parseFloat(bucketTotalTDS) == 0 || (isTrue(isReachedNonDeductBill) && isTrue(isNonDeducted) && parseFloat(bucketTotalTDS) >= nonDeductedBillsAmt)) {
                                                        // if (((parseFloat(expBaseAmt1) + parseFloat(bucketAccumPrev)) > parseFloat(tdsCumulatThreshold)) || AppliedTDSobj[tdstype]['tdscumulreached']) {
                                                        if (((parseFloat(expBaseAmt1) + parseFloat(bucketAccumPrev)) > parseFloat(tdsCumulatThreshold))) {
                                                            isExpCumReached = true;
                                                            if (isTrue(tdsRetrospective)) {
                                                                expBaseAmt1 = parseFloat(expBaseAmt1) + parseFloat(bucketAccumPrev)
                                                                log.debug("expBaseAmt1", expBaseAmt1)
                                                                if (parseFloat(bucketTotalTDS) > 0 && isTrue(isNonDeducted) && parseFloat(bucketAccumPrev) > parseFloat(tdsCumulatThreshold)) {
                                                                    var bucketTotalBase = bucketTotalTDS * (100 / parseFloat(tdsRate))
                                                                    expBaseAmt1 = expBaseAmt1 - bucketTotalBase
                                                                }
                                                            }
                                                            else {
                                                                if ((expBaseAmt1 + bucketAccumPrev) > tdsCumulatThreshold) {
                                                                    expBaseAmt1 = parseFloat(expBaseAmt1) + parseFloat(bucketAccumPrev) - parseFloat(tdsCumulatThreshold)
                                                                    log.debug("expBaseAmt1 1", expBaseAmt1)
                                                                }
                                                                else {
                                                                    expBaseAmt1 = 0
                                                                }
                                                            }
                                                        }
                                                        else if (expBaseAmt1 > tdsThreshold) {
                                                            isExpDocReached = true;
                                                            log.debug("expBaseAmt1 2", expBaseAmt1)
                                                        }

                                                    }
                                                    else if (parseFloat(bucketTotalTDS) > 0) {
                                                        isExpCumReached = true
                                                        log.debug("bucketTotalTDS", bucketTotalTDS)
                                                        if (isNonDeducted && !isTrue(isReachedNonDeductBill)) {
                                                            if (expBaseAmt1 > tdsCumulatThreshold) {
                                                                expBaseAmt1 = expBaseAmt1 - tdsCumulatThreshold
                                                            }
                                                            else {
                                                                expBaseAmt1 = 0
                                                            }
                                                        }
                                                    }
                                                    if (isExpDocReached || isExpCumReached) {
                                                        expTdsAmt = (parseFloat(tdsRate) * parseFloat(expBaseAmt1)) / 100;
                                                        expTdsAmt = applyTdsRoundMethod(tdsRounding, expTdsAmt);
                                                        expTDSbaseAmt = expBaseAmt1
                                                    }
                                                    log.debug("expBaseAmt", expBaseAmt1)
                                                }
                                                else {
                                                    expTdsAmt = totaltds;
                                                    expTDSbaseAmt = expBaseAmt
                                                    log.debug("expBaseAmt1", expBaseAmt)
                                                }

                                                log.debug("expTdsAmt", expTdsAmt)

                                                // If TDS deducted in expense sublist, Adding the deducted line
                                                if (parseFloat(expTdsAmt)) {
                                                    var newline = current_record.getLineCount({ sublistId: 'expense' });
                                                    current_record.insertLine({ sublistId: 'expense', line: newline });
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: 'account',
                                                        value: parseInt(tdsAccount),
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: 'taxcode',
                                                        value: g_tdsCode,
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: 'amount',
                                                        value: -parseFloat(expTdsAmt),
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: 'grossamt',
                                                        value: -parseFloat(expTdsAmt),
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: 'custcol_tss_baseamount',
                                                        value: parseFloat(expTDSbaseAmt),
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: 'custcol_tss_it_tds_ref_id',
                                                        value: expenseTDSobj[tdstype]['line'],
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: 'custcol_tss_tdsline',
                                                        value: true,
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: 'custcol_tss_tdspercent',
                                                        value: parseFloat(tdsRate),
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: 'location',
                                                        value: expenseTDSobj[tdstype]['location'],
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: 'department',
                                                        value: expenseTDSobj[tdstype]['department'],
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: 'class',
                                                        value: expenseTDSobj[tdstype]['class1'],
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'expense',
                                                        fieldId: 'custcol_tss_itb_tdsmaster',
                                                        value: TDSObj.tdsrelation.custrecord_tss_vedtdstype,
                                                        line: newline
                                                    });
                                                }
                                            }
                                            // Checking the eligibility of deduction in expense sublist
                                            if (itemBaseAmt > 0) {
                                                var itemBaseAmt1 = itemBaseAmt;
                                                log.debug("itemBaseAmt1", itemBaseAmt1)
                                                // If TDS deducted line is added in expense sublist, then just TDS on Items are enough in item sublist
                                                if (parseFloat(expTdsAmt) == 0) {
                                                    itemBaseAmt1 = parseFloat(itemBaseAmt1) + parseFloat(expBaseAmt)
                                                    log.debug("itemBaseAmt1+expBaseAmt", itemBaseAmt1)
                                                }
                                                if (parseFloat(tdsBaseAmt) > parseFloat(itemBaseAmt)) {
                                                    // If the TDS is eligible for deduction in items
                                                    if (parseFloat(bucketTotalTDS) == 0 || (isTrue(isReachedNonDeductBill) && isTrue(isNonDeducted) && parseFloat(bucketTotalTDS) >= nonDeductedBillsAmt)) {


                                                        if (parseFloat(expTdsAmt) > 0) {
                                                            isItemCumReached = true;
                                                        }
                                                        else if ((parseFloat(itemBaseAmt1) + parseFloat(bucketAccumPrev)) > parseFloat(tdsCumulatThreshold)) {
                                                            isItemCumReached = true;
                                                            if (isTrue(tdsRetrospective)) {
                                                                itemBaseAmt1 = parseFloat(itemBaseAmt1) + parseFloat(bucketAccumPrev)
                                                            }
                                                            else {
                                                                itemBaseAmt1 = parseFloat(itemBaseAmt1) + parseFloat(bucketAccumPrev) - parseFloat(tdsCumulatThreshold)
                                                            }
                                                        }
                                                        else if (parseFloat(itemBaseAmt1) > parseFloat(tdsThreshold)) {
                                                            isItemDocReached = true;

                                                        }
                                                        else {
                                                        }
                                                        log.debug("itemBaseAmt1 in condition", itemBaseAmt1)
                                                    }
                                                    if (parseFloat(bucketTotalTDS) > 0) {
                                                        isItemCumReached = true
                                                        if (isNonDeducted && !isTrue(isReachedNonDeductBill) && parseFloat(expTdsAmt) == 0) {
                                                            if (parseFloat(itemBaseAmt1) > parseFloat(tdsCumulatThreshold)) {
                                                                itemBaseAmt1 = parseFloat(itemBaseAmt1) - parseFloat(tdsCumulatThreshold)
                                                            }
                                                            else {
                                                                itemBaseAmt1 = 0
                                                            }
                                                        }
                                                    }
                                                    if (isItemDocReached || isItemCumReached) {
                                                        itemTdsAmt = (parseFloat(tdsRate) * parseFloat(itemBaseAmt1)) / 100;
                                                        itemTdsAmt = applyTdsRoundMethod(tdsRounding, itemTdsAmt);
                                                        log.debug("itemTdsAmt in condition", itemTdsAmt)
                                                        itemTDSbaseAmt = itemBaseAmt1
                                                    }
                                                }
                                                else {
                                                    itemTdsAmt = totaltds
                                                    itemTDSbaseAmt = itemBaseAmt
                                                    log.debug("itemTDSbaseAmt - itemTdsAmt", itemTDSbaseAmt + ' - ' + itemTdsAmt)

                                                }
                                                log.debug("itemBaseAmt1", itemBaseAmt1)
                                                log.debug("itemTdsAmt", itemTdsAmt)
                                                //Adding deduction line in item sublist
                                                if (parseFloat(itemTdsAmt) > 0) {
                                                    var newline = current_record.getLineCount({ sublistId: 'item' });
                                                    current_record.insertLine({ sublistId: 'item', line: newline });
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'item',
                                                        value: tdsItem,
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'taxcode',
                                                        value: g_tdsCode,
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'rate',
                                                        value: -parseFloat(itemTdsAmt),
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'amount',
                                                        value: -parseFloat(itemTdsAmt),
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'grossamt',
                                                        value: -parseFloat(itemTdsAmt),
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'custcol_tss_baseamount',
                                                        value: parseFloat(itemTDSbaseAmt),
                                                        line: newline
                                                    });
                                                    var lineStr = itemTDSobj[tdstype]['line']
                                                    if (parseFloat(expBaseAmt) > 0 && parseFloat(expTdsAmt) == 0) {
                                                        lineStr = 'Expense - ' + expenseTDSobj[tdstype]['line'] + ' & Items - ' + lineStr
                                                    }
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'custcol_tss_it_tds_ref_id',
                                                        value: lineStr,
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'custcol_tss_tdsline',
                                                        value: true,
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'custcol_tss_tdspercent',
                                                        value: parseFloat(tdsRate),
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'location',
                                                        value: itemTDSobj[tdstype]['location'],
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'department',
                                                        value: itemTDSobj[tdstype]['department'],
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'class',
                                                        value: itemTDSobj[tdstype]['class1'],
                                                        line: newline
                                                    });
                                                    current_record.setSublistValue({
                                                        sublistId: 'item',
                                                        fieldId: 'custcol_tss_itb_tdsmaster',
                                                        value: TDSObj.tdsrelation.custrecord_tss_vedtdstype,
                                                        line: newline
                                                    });
                                                }
                                            }
                                            log.debug("TDS deduct line is added")
                                        }

                                    }
                                }// End Of If TDS is not Override in bothe TDS and VE


                            }
                        }

                        //Removing Un-Processed Override lines. This happens when TDS Line Section is not linked to ant TDS Relations in item/expinse lines
                        log.debug("groupedOverrideTDSobj after processed", groupedOverrideTDSobj);
                        removeUnprocessedTdsLines(current_record, groupedOverrideTDSobj)


                        //Setting Applied object data in field
                        current_record.setValue({
                            fieldId: 'custbody_tss_applied_tds_obj',
                            value: JSON.stringify(AppliedTDSobj),
                        });

                        //Updating the Accumulated Tax Bucket and Vendor Exemption accumulated amounts if un applied in current transaction

                        // Find keys in prevApliedTDSobj that are not in AppliedTDSobj
                        var missingKeys = Object.keys(prevApliedTDSobj).filter(key => !(key in AppliedTDSobj));
                        log.debug("missingKeys", missingKeys)
                        if (missingKeys.length > 0) {
                            for (var i = 0; i < missingKeys.length; i++) {
                                var veAppliedId = prevApliedTDSobj[missingKeys[i]]['vetdsid']
                                var TDSObj = getTDSdetails(missingKeys[i], rec_subsidiary, rec_date, veAppliedId, scriptContext.type);
                                log.debug("TDSObj", TDSObj)
                                log.debug("TDSObj.tdsrelation", TDSObj.tdsrelation);

                                var isBucket = checkBucketRecord(rec_vendor, rec_subsidiary, TDSObj.tdsrelation.custrecord_tss_vedtdstype, FYstartDate, FYendDate)
                                log.debug("isBucket", isBucket)

                                //Removing the tran amount from Vendor Exemption if applied previously
                                if (Object.keys(TDSObj.exemption).length === 0 && TDSObj.exemption.constructor === Object) {

                                }
                                else {
                                    //VE is apllied, To be remove data
                                    var veTaxableAmt = TDSObj.exemption.custrecord_tss_ve_taxable_amt || 0
                                    var veTaxAmt1 = TDSObj.exemption.custrecord_tss_ve_tax_amt || 0
                                    var IsVE_expired = TDSObj.exemption.custrecord_tss_ve_expired
                                    var veTDSobj = {}
                                    if (parseFloat(veTaxableAmt) > 0) {
                                        veTDSobj['custrecord_tss_ve_taxable_amt'] = parseFloat(veTaxableAmt) - parseFloat(prevApliedTDSobj[missingKeys[i]]['vetdsbaseamt'])
                                    }
                                    if (parseFloat(veTaxAmt1) > 0) {
                                        veTDSobj['custrecord_tss_ve_tax_amt'] = parseFloat(veTaxAmt1) - parseFloat(prevApliedTDSobj[missingKeys[i]]['vetdsamt'])
                                    }
                                    if (isTrue(IsVE_expired)) {
                                        veTDSobj['custrecord_tss_ve_expired'] = false
                                    }

                                    //Throw error if un applying TDS Vendor Exemption and This is accumulated in expiring and TDS also triggered
                                    if (parseFloat(prevApliedTDSobj[missingKeys[i]]['vetdsamt']) > 0) {

                                        var veFromDate = TDSObj.exemption.custrecord_tss_ve_from
                                        var veToDate = TDSObj.exemption.custrecord_tss_ve_to
                                        var tdsBaseAmtOverVE = getTdsBaseAmount(veFromDate, veToDate, missingKeys[i], current_record)
                                        log.debug("tdsBaseAmtOverVE in unapply", tdsBaseAmtOverVE)
                                        if (tdsBaseAmtOverVE > 0) {
                                            throw { "name": "TDS_APPLIED", "message": "TDS Unapply is not allowed. Vendor Exemption has expired, and the TDS base amount was accumulated during the exemption period." }
                                        }
                                    }
                                    //End Throw error if un applying TDS Vendor Exemption and This is accumulated in expiring and TDS also triggered


                                    // var veUpdatedId = record.submitFields({
                                    //     type: 'customrecord_tss_vendor_exemption',
                                    //     id: TDSObj.exemption.internalid,
                                    //     values: veTDSobj
                                    // });
                                    // log.debug("Updated VE in unapplied case", veUpdatedId)

                                    veTDSobj['action'] = 'vendorexemption'
                                    toBeUpdateIdObj['ve-' + TDSObj.exemption.internalid] = veTDSobj

                                }

                                //Updating the Accumulated Tax Bucket for unapplied TDS
                                if (isBucket.isAvaiable) {
                                    var bucketLookup = search.lookupFields({
                                        type: 'customrecord_tss_accumulated_tds_tax',
                                        id: isBucket.details.id,
                                        columns: ['custrecord_tss_acc_tax_period_amt', 'custrecord_tss_acc_tax_doc_taxable_amt', 'custrecord_tss_itaccumulated_tax_amt', 'custrecord_tss_it_doc_threshould_reched', 'custrecord_tss_it_doc_reach_ids', 'custrecord_tss_it_acc_nondeduct_tdsamt', 'custrecord_tss_it_acc_nondeduct_bills']
                                    });
                                    var tdsTaxableAmt = bucketLookup.custrecord_tss_acc_tax_period_amt || 0
                                    var tdsTaxAmt1 = bucketLookup.custrecord_tss_itaccumulated_tax_amt || 0
                                    var TDSobj = {}
                                    //Throw error if nondeductedBillAmt is more than 0
                                    var nonDeductTdsAmt = prevApliedTDSobj[missingKeys[i]]['nondeducttdsbaseamt'] || 0
                                    if (parseFloat(nonDeductTdsAmt) > 0) {
                                        var isNonDeducted = false;
                                        nonDeductedBills = bucketLookup.custrecord_tss_it_acc_nondeduct_bills || '[]'
                                        nonDeductedBills = JSON.parse(nonDeductedBills)
                                        if (nonDeductedBills.length > 0 && nonDeductedBills.includes(current_record.id)) {
                                            var nonDeductedBillsAmt = bucketLookup.custrecord_tss_it_acc_nondeduct_tdsamt || 0
                                            if (parseFloat(tdsTaxAmt1) - parseFloat(prevApliedTDSobj[missingKeys[i]]['tdsamt']) > 0) {
                                                throw { "name": "TDS_APPLIED", "message": "This bill is part of a TDS accumulation where TDS has already been deducted in another bill. You cannot unapply TDS Internal ID - " + missingKeys[i] + "." }
                                            }
                                            nonDeductedBills = nonDeductedBills.filter(item => item !== current_record.id);
                                            TDSobj['custrecord_tss_it_acc_nondeduct_bills'] = JSON.stringify(nonDeductedBills)
                                            // TDSobj['custrecord_tss_it_acc_nondeduct_tdsamt'] = parseFloat(nonDeductedBillsAmt) - parseFloat(prevApliedTDSobj[missingKeys[i]]['tdsamt'])

                                            var finalNonDeductedBillsAmt = parseFloat(nonDeductedBillsAmt) > 0 ? parseFloat(nonDeductedBillsAmt) - parseFloat(prevApliedTDSobj[missingKeys[i]]['tdsamt']) : 0
                                            TDSobj['custrecord_tss_it_acc_nondeduct_tdsamt'] = finalNonDeductedBillsAmt
                                        }
                                    }
                                    //End Throw error if nondeductedBillAmt is more than 0

                                    if (parseFloat(tdsTaxableAmt) > 0) {
                                        TDSobj['custrecord_tss_acc_tax_period_amt'] = parseFloat(tdsTaxableAmt) - parseFloat(prevApliedTDSobj[missingKeys[i]]['tdsbaseamt'])
                                    }
                                    if (parseFloat(tdsTaxAmt1) > 0) {
                                        TDSobj['custrecord_tss_itaccumulated_tax_amt'] = parseFloat(tdsTaxAmt1) - parseFloat(prevApliedTDSobj[missingKeys[i]]['tdsamt'])
                                    }

                                    var apliedBucketDocIds = bucketLookup.custrecord_tss_it_doc_reach_ids || '[]'
                                    apliedBucketDocIds = JSON.parse(apliedBucketDocIds)
                                    if (scriptContext.type == 'edit') {
                                        if (apliedBucketDocIds.includes(current_record.id)) {
                                            apliedBucketDocIds = apliedBucketDocIds.filter(item => item !== current_record.id);
                                            TDSobj['custrecord_tss_it_doc_reach_ids'] = JSON.stringify(apliedBucketDocIds)
                                            if (apliedBucketDocIds.length <= 1) {
                                                TDSobj['custrecord_tss_it_doc_threshould_reched'] = false
                                            }
                                        }
                                    }
                                    // var tdsUpdatedId = record.submitFields({
                                    //     type: 'customrecord_tss_accumulated_tds_tax',
                                    //     id: isBucket.details.id,
                                    //     values: TDSobj
                                    // });
                                    // log.debug("Updated TDS Tax Bucket in unapplied case", veUpdatedId)

                                    //Updating cache object
                                    toBeUpdateIdObj['acc-' + isBucket.details.id] = TDSobj
                                }

                            }
                        }

                        //Storing the data to update the Doc threshold check box as false and removing the internal id from field in Tax Bucket
                        // Store the updated data in the cache
                        var cacheObj = cache.getCache({
                            name: 'custdocreachedobj' // Define a custom cache name
                        });
                        cacheObj.put({
                            key: cacheKey, // Use the cache key to store the updated value
                            value: JSON.stringify(toBeUpdateIdObj), // Store the updated data
                        });


                    } // end if (Flag == 1)

                    // } // end if (currentContext == 'CSVIMPORT' || currentContext == 'SUITELET' || currentContext == 'WEBSERVICES')

                    // For Vendor Bill --> end of the adding TDS Lines for records which are created from suitelet, csv imports and web services.



                } // end  if (current_record.type == 'vendorbill')
            }
            catch (e) {
                log.error("Error in beforeSubmit", e);
                if (e == 'The TDS type you entered is not belongs to the Vendor') {
                    throw "The TDS type you entered is not belongs to the Vendor"
                }
                else if (e.name == "TDS_APPLIED") {
                    throw e
                }
                else {
                    throw e
                }
            }


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

            try {
                if (scriptContext.type != 'delete') {
                    var recordObj = scriptContext.newRecord;
                    recordObj = record.load({
                        type: recordObj.type,
                        id: recordObj.id
                    })
                    var rec_subsidiary = recordObj.getValue({ fieldId: "subsidiary" });
                    var g_subisidiary = new Array();

                    var indianCurrency = getIndianCurrency();

                    var GlobalRecId = SearchGlobalParameter();
                    if (_logValidation(GlobalRecId)) {
                        // var GlobalRec = search.lookupFields({
                        //     type: 'customrecord_tss_global_parameter',
                        //     id: GlobalRecId,
                        //     columns: ['custrecord_tss_gp_subsidiary']
                        // });
                        // g_subisidiary = GlobalRec.custrecord_tss_gp_subsidiary[0].value
                        var GlobalRec = record.load({ type: 'customrecord_tss_global_parameter', id: GlobalRecId, });
                        g_subisidiary = GlobalRec.getValue('custrecord_tss_gp_subsidiary');
                        log.debug("g_subisidiary afterSubmit", g_subisidiary);
                    } // end if (_logValidation(GlobalRecId))
                    var Flag = inArray(rec_subsidiary, g_subisidiary);

                    var billId = recordObj.id;
                    var recType = recordObj.type;
                    if (recType == 'vendorbill' && Flag == 1) {
                        // log.debug("entered in sfterSubmit", toBeUpdateIdObj)
                        // Store the updated data in the cache
                        var cacheObj = cache.getCache({
                            name: 'custdocreachedobj' // Define a custom cache name
                        });
                        var cacheKey = 'globalUpdatedObj';
                        var retrievedData = cacheObj.get({
                            key: cacheKey // Retrieve the value using the same cache key
                        });
                        log.debug("retrievedData", retrievedData)

                        if (_logValidation(retrievedData)) {
                            toBeUpdateIdObj = JSON.parse(retrievedData)
                        }

                        //Updating the Document threshold reached Bill internal id's in accumulated tax bucket record
                        for (var bucketID in toBeUpdateIdObj) {
                            if (toBeUpdateIdObj.hasOwnProperty(bucketID)) {
                                var updateTaxBucketObj = toBeUpdateIdObj[bucketID];
                                if (updateTaxBucketObj['action'] == 'vendorexemption') {
                                    var veUpdatedId = record.submitFields({
                                        type: 'customrecord_tss_vendor_exemption',
                                        id: bucketID.split('-')[1],
                                        values: updateTaxBucketObj
                                    });
                                    log.debug("Updated Vendor Exemption with Tax and Taxable amounts. Internal Id - ", veUpdatedId)

                                }
                                else {
                                    var docReachedIDS = updateTaxBucketObj['custrecord_tss_it_doc_reach_ids'] || [];
                                    log.debug("docReachedIDS afterSubmit", docReachedIDS);
                                    //If this transaction is only reached the document threshold, clearing the data in tax bucket
                                    if (updateTaxBucketObj['action'] == 'addId') {
                                        docReachedIDS.push(recordObj.id)
                                        updateTaxBucketObj['custrecord_tss_it_doc_reach_ids'] = JSON.stringify([...new Set(docReachedIDS)])
                                    }
                                    else if (updateTaxBucketObj['action'] == 'no') {
                                        if (docReachedIDS.length > 0) {
                                            docReachedIDS = docReachedIDS.filter(item => item !== recordObj.id && item !== String(recordObj.id));
                                            updateTaxBucketObj['custrecord_tss_it_doc_reach_ids'] = JSON.stringify([...new Set(docReachedIDS)])
                                        }
                                    }
                                    var nonDeductedIDS = updateTaxBucketObj['custrecord_tss_it_acc_nondeduct_bills'] || [];
                                    if (updateTaxBucketObj['nondeductaction'] == 'addId') {
                                        nonDeductedIDS.push(recordObj.id)
                                        updateTaxBucketObj['custrecord_tss_it_acc_nondeduct_bills'] = JSON.stringify([...new Set(nonDeductedIDS)])
                                    }
                                    else if (updateTaxBucketObj['nondeductaction'] == 'no') {
                                        if (nonDeductedIDS.length > 0) {
                                            nonDeductedIDS = nonDeductedIDS.filter(item => item !== recordObj.id && item !== String(recordObj.id));
                                            updateTaxBucketObj['custrecord_tss_it_acc_nondeduct_bills'] = JSON.stringify([...new Set(nonDeductedIDS)])
                                        }
                                    }
                                    //Updating the id' array in tax bucket using submit fields
                                    var updatedTaxBucId = record.submitFields({
                                        type: 'customrecord_tss_accumulated_tds_tax',
                                        id: bucketID.split('-')[1],
                                        values: updateTaxBucketObj,
                                        options: {
                                            enableSourcing: false,
                                            ignoreMandatoryFields: true
                                        }
                                    });

                                    log.debug("Updated the internalid in Tax Bucket because this transaction reached doc threshold", updatedTaxBucId)
                                }
                            }
                        }
                        // Inactivating the linked TDS Bill Relations
                        if (scriptContext.type == 'edit') {
                            inactiveTDSbillRelations(scriptContext)
                        }

                        //Creating TDS Bill Relations
                        createTDSbillRelations(scriptContext, 'expense', indianCurrency)
                        createTDSbillRelations(scriptContext, 'item', indianCurrency)

                    }
                }

            }
            catch (e) {
                log.error("Error in afterSubmit", e);
            }

        } // end const afterSubmit = (scriptContext) => 



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

        function isTrue(value) {
            if (value == 'T' || value == true || value == 'true') {
                return true;
            }
            else {
                return false;
            }
        } // end function isTrue(value)

        function isFalse(value) {
            if (value == 'F' || value == false || value == 'false') {
                return true;
            }
            else {
                return false;
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

        function getTDSitem(tdsType) {
            var tdsItem = search.lookupFields({
                type: 'customrecord_tss_tdsrelation',
                id: tdsType,
                columns: ['custrecord_tss_tds_vedtdsitem']
            });
            log.debug("tdsType in getTDSitem function", tdsType)
            if (tdsItem.custrecord_tss_tds_vedtdsitem.length > 0) {
                tdsItem = tdsItem.custrecord_tss_tds_vedtdsitem[0].value;
            }
            return tdsItem
        } // end function getTDSitem(tdsType)

        function getTDSaccount(tdsType) {
            var tdsAccount = search.lookupFields({
                type: 'customrecord_tss_tdsrelation',
                id: tdsType,
                columns: ['custrecord_tss_tds_vedtdsaccount']
            });
            //log.audit("tdsAccount obj", tdsAccount)
            if (tdsAccount.custrecord_tss_tds_vedtdsaccount) {
                tdsAccount = tdsAccount.custrecord_tss_tds_vedtdsaccount[0].value;
            }
            else {
                log.audit("not entered in condition")
            }
            log.audit("tdsAccount", tdsAccount)
            return tdsAccount;
        } // end function getTDSaccount(tdsType)

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


        function applyTdsRoundMethod(tdsRoundMethod, tdsAmount) {
            var roundedtdsAmount = tdsAmount;

            if (tdsRoundMethod == 2) {
                roundedtdsAmount = Math.ceil(tdsAmount)
            }
            if (tdsRoundMethod == 3) {
                roundedtdsAmount = Math.round(tdsAmount / 10) * 10;
            }
            if (tdsRoundMethod == 4) {
                if (tdsAmount < 50) {
                    var tdsamt = tdsAmount + 50;
                    roundedtdsAmount = Math.round(tdsamt / 100) * 100;
                }
                else {
                    roundedtdsAmount = Math.round(tdsAmount / 100) * 100;
                }
            }

            return roundedtdsAmount;
        } // end function applyTdsRoundMethod(tdsRoundMethod,tdsAmount)


        function checkValidTDS(vendor, tdsType) {
            var tdsVendor = search.lookupFields({
                type: 'customrecord_tss_tdsrelation',
                id: tdsType,
                columns: ['custrecord_tss_tds_vendorname']
            });
            if (tdsVendor.custrecord_tss_tds_vendorname.length > 0) {
                tdsVendor = tdsVendor.custrecord_tss_tds_vendorname[0].value;
                log.debug("tdsVendor in checkValidTDS(vendor,tdsType) function", tdsVendor);
                if (parseInt(vendor) == parseInt(tdsVendor)) {
                    return true;
                }
                else {
                    return false;
                }
            }
            else {
                return false;
            }
        } // end function checkValidTDS(vendor,tdsType)

        function getIndianCurrency() {
            var INRcurrency;
            var filter2 = new Array()
            var column2 = new Array()
            filter2.push(search.createFilter({
                name: 'symbol',
                operator: 'is',
                values: 'INR'
            }));
            column2.push(search.createColumn({ name: 'internalid' }));
            var Currency_search = search.create({
                type: 'currency',
                filters: filter2,
                columns: column2
            });
            var Currency_search_result = Currency_search.run().getRange(0, 100);
            if (Currency_search_result.length > 0) {
                INRcurrency = Currency_search_result[0].getValue({ name: 'internalid' });
                log.debug("INRcurrency in indianCurrency function", INRcurrency);
            }
            return INRcurrency;
        }

        function groupBy(list, keyGetter) {
            const map = new Map();
            list.forEach((item) => {
                const key = keyGetter(item);
                const collection = map.get(key);
                if (!collection) {
                    map.set(key, [item]);
                } else {
                    collection.push(item);
                }
            });
            return map;
        }

        // Function returns the start and end dates of financial year based on given date.
        function getStartEndDatesFY(rec_date) {
            log.debug("rec_date", rec_date)
            // Extract the year and month from the transaction date
            var tranMonth = rec_date.getMonth();  // Months are 0-indexed (0 = Jan, 11 = Dec)
            var tranYear = rec_date.getFullYear();

            // If the month is between Jan-Mar (0-2), the financial year is from the previous year
            if (tranMonth < 3) {
                tranYear -= 1;
            }

            // Financial year start and end dates
            var startDate = new Date(tranYear, 3, 1); // April 1st of the financial year
            var endDate = new Date(tranYear + 1, 2, 31); // March 31st of the following year

            // Format dates according to NetSuite preferences
            var startDateFormatted = format.format({
                value: startDate,
                type: format.Type.DATE
            });

            var endDateFormatted = format.format({
                value: endDate,
                type: format.Type.DATE
            });
            return [startDateFormatted, endDateFormatted]
        }

        //Function returns the Tax Bucket Accumulation record data if existed.
        function checkBucketRecord(rec_vendor, rec_subsidiary, tdstype, FYstartDate, FYendDate) {
            var BucketSearchFilters = [];
            BucketSearchFilters.push(['custrecord_tss_acc_tax_section', 'anyof', tdstype])
            BucketSearchFilters.push("AND")
            BucketSearchFilters.push(['custrecord_tss_acc_tax_subsidiary', 'anyof', rec_subsidiary])
            BucketSearchFilters.push("AND")
            BucketSearchFilters.push(['custrecord_tss_acc_tax_vendor', 'anyof', rec_vendor])
            BucketSearchFilters.push("AND")
            BucketSearchFilters.push(['isinactive', 'is', 'F']);
            BucketSearchFilters.push("AND")
            BucketSearchFilters.push(['custrecord_tss_acc_tax__startdate', 'onorafter', FYstartDate])
            BucketSearchFilters.push("AND")
            BucketSearchFilters.push(['custrecord_tss_acc_tax_enddate', 'onorbefore', FYendDate]);
            log.debug("BucketSearchFilters", BucketSearchFilters)
            var bucketSearch = search.create({
                type: 'customrecord_tss_accumulated_tds_tax',
                filters: BucketSearchFilters,
                columns: ['internalid']
            });
            log.debug("bucketSearch", bucketSearch)

            var bucketSearchRes = bucketSearch.run().getRange(0, 100);
            if (bucketSearchRes.length > 0) {
                var bucketId = bucketSearchRes[0].getValue({ name: 'internalid' })
                log.debug("Accumulated Bucket is already existed", bucketId)
                return { details: { id: bucketId }, isAvaiable: true };
            }
            else {
                return { details: '', isAvaiable: false };
            }

        }

        // This is the function returns the TDS Relation details and related valid Vendor Exemption details
        function getTDSdetails(tdstype, rec_subsidiary, rec_date, VEprevId, contextMode) {
            //Getting TDS Relation details
            var tdsRelLookUp = search.lookupFields({
                type: 'customrecord_tss_tdsrelation',
                id: tdstype,
                columns: ['custrecord_tss_vedtdstype', 'custrecord_tss_tds_section',
                    'custrecord_tss_tds_threshold', 'custrecord_tss_tds_vedsurchargethreshold',
                    'custrecord_tss_tds_vedtdsitem', 'custrecord_tss_tds_vedtdsaccount',
                    'custrecord_tss_tds_vednetper', 'custrecord_tss_tds_vedempty_pan_tdsper',
                    'custrecord_tss_tds_entity', 'custrecord_tss_tds_rounding',
                    'custrecord_tss_tds_calculate', 'custrecord_tss_tds_retrospective',
                    'custrecord_tss_tds_relation_valid_until', 'custrecord_tss_tds_relation_valid_from'
                ]
            });
            // log.debug("tdsRelLookUp", tdsRelLookUp)
            //Creating the TDS Relation object and exemption object
            var tdsRelObj = {}
            var exemptionObj = {}


            //Making the TDS Relation data in form of object
            tdsRelObj['custrecord_tss_vedtdstype'] = tdsRelLookUp.custrecord_tss_vedtdstype[0].value
            tdsRelObj['custrecord_tss_tds_section'] = tdsRelLookUp.custrecord_tss_tds_section
            tdsRelObj['custrecord_tss_tds_threshold'] = tdsRelLookUp.custrecord_tss_tds_threshold
            tdsRelObj['custrecord_tss_tds_vedsurchargethreshold'] = tdsRelLookUp.custrecord_tss_tds_vedsurchargethreshold
            tdsRelObj['custrecord_tss_tds_vedtdsitem'] = tdsRelLookUp.custrecord_tss_tds_vedtdsitem[0].value
            tdsRelObj['custrecord_tss_tds_vedtdsaccount'] = tdsRelLookUp.custrecord_tss_tds_vedtdsaccount[0].value
            tdsRelObj['custrecord_tss_tds_vednetper'] = tdsRelLookUp.custrecord_tss_tds_vednetper
            tdsRelObj['custrecord_tss_tds_vedempty_pan_tdsper'] = tdsRelLookUp.custrecord_tss_tds_vedempty_pan_tdsper
            tdsRelObj['custrecord_tss_tds_entity'] = tdsRelLookUp.custrecord_tss_tds_entity[0].value
            tdsRelObj['custrecord_tss_tds_rounding'] = tdsRelLookUp.custrecord_tss_tds_rounding[0].value
            tdsRelObj['custrecord_tss_tds_calculate'] = tdsRelLookUp.custrecord_tss_tds_calculate[0].value
            tdsRelObj['custrecord_tss_tds_retrospective'] = tdsRelLookUp.custrecord_tss_tds_retrospective
            tdsRelObj['custrecord_tss_tds_relation_valid_from'] = tdsRelLookUp.custrecord_tss_tds_relation_valid_from
            tdsRelObj['custrecord_tss_tds_relation_valid_until'] = tdsRelLookUp.custrecord_tss_tds_relation_valid_until

            // Transaction date is changing the format to use in saved search 
            var rec_dateFormat = format.format({
                value: rec_date,
                type: format.Type.DATE
            });
            //Filters for saved search to pull the valid Vendor Exemption record for particular vendor with in subsiadiary
            var VEsearchFilters = [];
            VEsearchFilters.push(['isinactive', 'is', 'F']);
            VEsearchFilters.push("AND")
            VEsearchFilters.push(['custrecord_tss_ve_tdsrelation', 'anyof', tdstype]);
            VEsearchFilters.push("AND")
            VEsearchFilters.push(['custrecord_tss_ve_subsidiary', 'anyof', rec_subsidiary]);
            VEsearchFilters.push("AND")
            VEsearchFilters.push(['custrecord_tss_ve_expired', 'is', 'F']);
            VEsearchFilters.push("AND")
            VEsearchFilters.push(['custrecord_tss_ve_from', 'onorbefore', rec_dateFormat]);
            VEsearchFilters.push("AND")
            VEsearchFilters.push(['custrecord_tss_ve_to', 'onorafter', rec_dateFormat]);

            log.debug("contextMode", contextMode)
            if (contextMode == 'edit') {
                if (_logValidation(VEprevId)) {
                    VEsearchFilters = ['internalid', 'anyof', VEprevId]
                }
            }

            //columns for saved search to pull the valid Vendor Exemption record for particular vendor with in subsiadiary
            var VEsearchColumns = []
            VEsearchColumns.push('internalid');
            VEsearchColumns.push('custrecord_tss_ve_certificate');
            VEsearchColumns.push('custrecord_tss_ve_schedule');
            VEsearchColumns.push('custrecord_tss_ve_from');
            VEsearchColumns.push('custrecord_tss_ve_to');
            VEsearchColumns.push('custrecord_tss_ve_amount');
            VEsearchColumns.push('custrecord_tss_ve_retrospective');
            VEsearchColumns.push('custrecord_tss_ve_rate');
            VEsearchColumns.push('custrecord_tss_ve_expired');
            VEsearchColumns.push('custrecord_tss_ve_tax_amt');
            VEsearchColumns.push('custrecord_tss_ve_taxable_amt');
            VEsearchColumns.push('custrecord_tss_ve_expired_billid');

            // Saved search to pull the valid Vendor Exemption record for particular vendor with in subsiadiary
            var VEsearch = search.create({
                type: 'customrecord_tss_vendor_exemption',
                filters: VEsearchFilters,
                columns: VEsearchColumns
            });

            //Getting Vendor exemption search results
            var VEsearchRes = VEsearch.run().getRange(0, 100);
            // log.debug("VEsearchRes", VEsearchRes)

            if (VEsearchRes.length > 0) {
                exemptionObj['internalid'] = VEsearchRes[0].getValue({ name: 'internalid' })
                exemptionObj['custrecord_tss_ve_certificate'] = VEsearchRes[0].getValue({ name: 'custrecord_tss_ve_certificate' })
                exemptionObj['custrecord_tss_ve_schedule'] = VEsearchRes[0].getValue({ name: 'custrecord_tss_ve_schedule' })
                exemptionObj['custrecord_tss_ve_from'] = VEsearchRes[0].getValue({ name: 'custrecord_tss_ve_from' })
                exemptionObj['custrecord_tss_ve_to'] = VEsearchRes[0].getValue({ name: 'custrecord_tss_ve_to' })
                exemptionObj['custrecord_tss_ve_amount'] = VEsearchRes[0].getValue({ name: 'custrecord_tss_ve_amount' })
                exemptionObj['custrecord_tss_ve_retrospective'] = VEsearchRes[0].getValue({ name: 'custrecord_tss_ve_retrospective' })
                exemptionObj['custrecord_tss_ve_rate'] = VEsearchRes[0].getValue({ name: 'custrecord_tss_ve_rate' })
                exemptionObj['custrecord_tss_ve_expired'] = VEsearchRes[0].getValue({ name: 'custrecord_tss_ve_expired' })
                exemptionObj['custrecord_tss_ve_taxable_amt'] = VEsearchRes[0].getValue({ name: 'custrecord_tss_ve_taxable_amt' })
                exemptionObj['custrecord_tss_ve_tax_amt'] = VEsearchRes[0].getValue({ name: 'custrecord_tss_ve_tax_amt' })
                exemptionObj['custrecord_tss_ve_expired_billid'] = VEsearchRes[0].getValue({ name: 'custrecord_tss_ve_expired_billid' })
            }

            return { 'tdsrelation': tdsRelObj, 'exemption': exemptionObj }


        } // end function getTDSdetails(tdstype, rec_subsidiary)


        function inactiveTDSbillRelations(scriptContext) {
            var filters3 = new Array();
            var column3 = new Array();
            filters3.push(search.createFilter({
                name: 'isinactive',
                operator: 'is',
                values: 'F'
            }));
            filters3.push(search.createFilter({
                name: 'custrecord_tss_its_billbillno',
                operator: 'is',
                values: scriptContext.newRecord.id
            }));

            column3.push(search.createColumn({ name: 'internalid' }));

            var BillRelationSearch = search.create({
                type: 'customrecord_tss_its_tds_billrelation',
                filters: filters3,
                columns: column3
            });
            BillRelationSearch.run().each(function (result) {
                var BillRelId = result.getValue({
                    name: 'internalid'
                });
                var id = record.submitFields({
                    type: 'customrecord_tss_its_tds_billrelation',
                    id: BillRelId,
                    values: {
                        'isinactive': true,
                        'custrecord_tss_its_billstatus': 'Inactive'
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
                log.debug("id aftersubmit", id)
                return true;
            });
        } // end inactiveTDSbillRelations(scriptContext)

        function createTDSbillRelations(scriptContext, sublistName, indianCurrency) {
            var current_record = scriptContext.newRecord
            var currency = current_record.getValue({ fieldId: "currency" });
            var exchangerate = current_record.getValue({ fieldId: "exchangerate" });
            var rec_vendor = current_record.getValue({ fieldId: "entity" });
            var postingperiod = current_record.getValue({ fieldId: "postingperiod" });
            var billId = current_record.id
            var trandate = current_record.getValue({ fieldId: "trandate" });
            var rec_subsidiary = current_record.getValue({ fieldId: "subsidiary" });
            var recType = current_record.type
            var Linecount = current_record.getLineCount({ sublistId: sublistName });
            log.debug("Linecount in afterSubmit", Linecount);
            for (var i = 0; i < Linecount; i++) {
                var tdsApply = current_record.getSublistValue({
                    sublistId: sublistName,
                    fieldId: 'custcol_tss_tdsline',
                    line: i
                });
                var tdsType = current_record.getSublistValue({
                    sublistId: sublistName,
                    fieldId: 'custcol_tss_itb_tdsmaster',
                    line: i
                });
                if (isTrue(tdsApply)) {
                    var tdsRelObj = search.lookupFields({
                        type: 'customrecord_tss_its_tdsmaster',
                        id: tdsType,
                        columns: ['custrecord_tss_its_tdsaccount', 'custrecord_tss_its_section', 'custrecord_tss_its_assessee_code']
                    });
                    var tdsPercent = current_record.getSublistValue({
                        sublistId: sublistName,
                        fieldId: 'custcol_tss_tdspercent',
                        line: i
                    });
                    var tdsFxAmount = current_record.getSublistValue({
                        sublistId: sublistName,
                        fieldId: 'amount',
                        line: i
                    });
                    var baseFxAmount = current_record.getSublistValue({
                        sublistId: sublistName,
                        fieldId: 'custcol_tss_baseamount',
                        line: i
                    });
                    var tdsamt = parseFloat(tdsFxAmount)
                    log.debug("tdsamt in afterSubmit", tdsamt);
                    var baseamt = parseFloat(baseFxAmount)
                    log.debug("baseamt in afterSubmit", baseamt);
                    if (indianCurrency != currency) {
                        tdsamt = (parseFloat(tdsamt) * parseFloat(exchangerate));
                        baseamt = (parseFloat(baseamt) * parseFloat(exchangerate));
                    } // end if(indianCurrency != currency)

                    // Creating TDS Bill Relation
                    try {
                        var Tds_Bill_Relation = record.create({
                            type: 'customrecord_tss_its_tds_billrelation',
                        });

                        Tds_Bill_Relation.setValue({
                            fieldId: 'custrecord_tss_its_vendorbillrel',
                            value: rec_vendor,
                        });
                        Tds_Bill_Relation.setValue({
                            fieldId: 'custrecord_tss_its_billpostingperiod',
                            value: postingperiod,
                        });
                        Tds_Bill_Relation.setValue({
                            fieldId: 'custrecord_tss_its_billbillno',
                            value: billId,
                        });

                        if (recType == 'vendorbill') {
                            Tds_Bill_Relation.setValue({
                                fieldId: 'custrecord_tss_its_billtdsamount',
                                value: -(tdsamt)
                            });
                            Tds_Bill_Relation.setValue({
                                fieldId: 'custrecord_tss_its_billtdspayable',
                                value: -(tdsamt),
                            });
                            Tds_Bill_Relation.setValue({
                                fieldId: 'custrecord_tss_its_billtdsamountfx',
                                value: -(tdsFxAmount),
                            });
                            Tds_Bill_Relation.setValue({
                                fieldId: 'custrecord_tss_its_billamount',
                                value: -baseamt,
                            });
                            Tds_Bill_Relation.setValue({
                                fieldId: 'custrecord_tss_its_billbillamountfx',
                                value: -baseFxAmount,
                            });
                        }
                        else {
                            Tds_Bill_Relation.setValue({
                                fieldId: 'custrecord_tss_its_billtdsamount',
                                value: tdsamt,
                            });
                            Tds_Bill_Relation.setValue({
                                fieldId: 'custrecord_tss_its_billtdspayable',
                                value: tdsamt,
                            });
                            Tds_Bill_Relation.setValue({
                                fieldId: 'custrecord_tss_its_billtdsamountfx',
                                value: tdsFxAmount,
                            });
                            Tds_Bill_Relation.setValue({
                                fieldId: 'custrecord_tss_its_billamount',
                                value: baseamt,
                            });
                            Tds_Bill_Relation.setValue({
                                fieldId: 'custrecord_tss_its_billbillamountfx',
                                value: baseFxAmount,
                            });
                        }

                        Tds_Bill_Relation.setValue({
                            fieldId: 'custrecord_tss_its_billbilldate',
                            value: trandate,
                        });
                        Tds_Bill_Relation.setValue({
                            fieldId: 'custrecord_tss_its_billtdstype',
                            value: tdsType
                        });
                        Tds_Bill_Relation.setValue({
                            fieldId: 'custrecord_tss_its_billtdssection',
                            value: tdsRelObj.custrecord_tss_its_section,
                        });
                        Tds_Bill_Relation.setValue({
                            fieldId: 'custrecord_tss_its_billtdsaccount',
                            value: tdsRelObj.custrecord_tss_its_tdsaccount[0] ? tdsRelObj.custrecord_tss_its_tdsaccount[0].value : null,
                        });
                        Tds_Bill_Relation.setValue({
                            fieldId: 'custrecord_tss_its_billstatus',
                            value: 'Open',
                        });



                        Tds_Bill_Relation.setValue({
                            fieldId: 'custrecord_tss_its_billsubsidiary',
                            value: rec_subsidiary,
                        });
                        Tds_Bill_Relation.setValue({
                            fieldId: 'custrecord_tss_its_billtdsrate',
                            value: tdsPercent,
                        });
                        Tds_Bill_Relation.setValue({
                            fieldId: 'custrecord_tss_its_billtrxtype',
                            value: recType,
                        });
                        Tds_Bill_Relation.setValue({
                            fieldId: 'custrecord_tss_its_billassessecode',
                            value: tdsRelObj.custrecord_tss_its_assessee_code[0] ? tdsRelObj.custrecord_tss_its_assessee_code[0].value : null,
                        });
                        var recordId = Tds_Bill_Relation.save({
                            enableSourcing: true,
                            //ignoreMandatoryFields: false
                        });
                        log.debug("TDS Bill Relation ID is", recordId);
                    } // end try
                    catch (e) {
                        log.error("Error in creating TDS Bill Relation record at TDS Applied Line number - " + (i + 1), e);
                    }
                }
            }
        } // end createTDSbillRelations(scriptContext,sublistName)

        function groupTdsData(arr) {
            const result = {};

            arr.forEach(obj => {
                const tdsType = obj.tdsType;
                const veNum = obj.veNum || '';

                if (!result[tdsType]) {
                    result[tdsType] = {
                        ovrTdsAmt: 0,
                        ovrTdsBaseAmt: 0,
                        oveVeTdsAmt: 0,
                        ovrVeTdsBaseAmt: 0,
                        veNum: '',
                        isOverride: false,
                        isVeOverride: false,
                        isProcessed: false
                    };
                }

                const existingVeNum = result[tdsType].veNum;

                // 🔴 VALIDATION
                if (veNum) {
                    if (existingVeNum && existingVeNum !== veNum) {
                        throw { "name": "TDS_APPLIED", "message": `Multiple VE Numbers found for TDS Type ${tdsType}: ${existingVeNum} and ${veNum}` }
                    }
                    result[tdsType].veNum = veNum;
                }

                // ✅ ACCUMULATION
                if (veNum) {
                    // VE case
                    result[tdsType].oveVeTdsAmt += Number(obj.ovrTdsAmt || 0);
                    result[tdsType].ovrVeTdsBaseAmt += Number(obj.ovrTdsBaseAmt || 0);
                    result[tdsType].isVeOverride = true;
                } else {
                    // Normal case
                    result[tdsType].ovrTdsAmt += Number(obj.ovrTdsAmt || 0);
                    result[tdsType].ovrTdsBaseAmt += Number(obj.ovrTdsBaseAmt || 0);
                    result[tdsType].isOverride = true;
                }
            });

            return result;
        }

        // Removes item and expense lines where TDS Type is unprocessed (isProcessed = false)
        function removeUnprocessedTdsLines(rec, groupedOverrideTDSobj) {

            var unprocessedTdsTypes = Object.keys(groupedOverrideTDSobj)
                .filter(key => groupedOverrideTDSobj[key].isProcessed === false);

            if (!unprocessedTdsTypes.length) return;

            function removeLines(sublistId, fieldId) {
                var lineCount = rec.getLineCount({ sublistId: sublistId });

                for (var i = lineCount - 1; i >= 0; i--) {
                    var lineTdsType = rec.getSublistValue({
                        sublistId: sublistId,
                        fieldId: fieldId,
                        line: i
                    });

                    if (lineTdsType && unprocessedTdsTypes.includes(String(lineTdsType))) {
                        rec.removeLine({
                            sublistId: sublistId,
                            line: i,
                            ignoreRecalc: true
                        });
                    }
                }
            }

            removeLines('item', 'custcol_tss_itb_tdsmaster');
            removeLines('expense', 'custcol_tss_itb_tdsmaster');
        }

        // Returns total TDS base amount for a given TDS type across same vendor bills within a date range (excluding current record)
        function getTdsBaseAmount(fromDate, toDate, tdsType, currentRecord) {
            log.debug("fromDate - toDate", fromDate + ' - ' + toDate)
            var totalBaseAmt = 0;
            fromDate = format.format({
                value: fromDate,
                type: format.Type.DATE
            });
            toDate = format.format({
                value: toDate,
                type: format.Type.DATE
            });

            var billSearch = search.create({
                type: 'transaction',
                filters: [
                    ['type', 'anyof', 'VendBill'],
                    'AND',
                    ['trandate', 'within', fromDate, toDate],
                    'AND',
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['voided', 'is', 'F'],
                    'AND',
                    ['entity', 'anyof', currentRecord.getValue('entity')],
                    'AND',
                    ['internalid', 'noneof', currentRecord.id] // exclude current bill
                ],
                columns: [
                    'custbody_tss_applied_tds_obj'
                ]
            });
            log.debug("billSearch.filters", billSearch.filters)

            billSearch.run().each(function (result) {

                var tdsObjStr = result.getValue('custbody_tss_applied_tds_obj');

                if (!tdsObjStr) return true;

                try {
                    var tdsObj = JSON.parse(tdsObjStr);

                    if (tdsObj && tdsObj[tdsType]) {
                        totalBaseAmt += Number(tdsObj[tdsType].tdsbaseamt || 0);
                    }

                } catch (e) {
                    log.debug('JSON Parse Error', e);
                }

                return true;
            });

            return totalBaseAmt;
        }

        function getTDSrel(rec_vendor, rec_date) {
            // alert(vendor)
            var defaultTDSfun = ''
            var a_filters = new Array();
            var a_column = new Array();
            a_filters.push(search.createFilter({
                name: 'isinactive',
                operator: 'is',
                values: 'F'
            }));
            a_filters.push(search.createFilter({
                name: 'custrecord_tss_tds_vendorname',
                operator: 'anyof',
                values: rec_vendor
            }));
            a_column.push(search.createColumn({
                name: 'internalid',
            }));
            a_column.push(search.createColumn({
                name: 'custrecord_tss_tds_relation_valid_from',
            }));
            a_column.push(search.createColumn({
                name: 'custrecord_tss_tds_relation_valid_until',
            }));

            var tdsrel_search = search.create({
                type: 'customrecord_tss_tdsrelation',
                filters: a_filters,
                columns: a_column
            });
            var tdsrel_searchh_result = tdsrel_search.run().getRange(0, 100);
            if (_logValidation(tdsrel_searchh_result)) {
                // alert(tdsrel_searchh_result.length + '-' + typeof (tdsrel_searchh_result.length))
                if (tdsrel_searchh_result.length == 1) {
                    var valid_from = tdsrel_searchh_result[0].getValue({ name: 'custrecord_tss_tds_relation_valid_from' })
                    var valid_until = tdsrel_searchh_result[0].getValue({ name: 'custrecord_tss_tds_relation_valid_until' })
                    log.debug("valid_from", valid_from)
                    log.debug("valid_until", valid_until)
                    valid_from = valid_from ? format.parse({ value: valid_from, type: format.Type.DATE }) : null;
                    valid_until = valid_until ? format.parse({ value: valid_until, type: format.Type.DATE }) : null;
                    rec_date = rec_date ? format.parse({ value: rec_date, type: format.Type.DATE }) : null;

                    if (((valid_from && rec_date >= valid_from) || !valid_from) && ((valid_until && rec_date <= valid_until) || !valid_until)) {
                        defaultTDSfun = tdsrel_searchh_result[0].getValue({ name: 'internalid' });
                        // alert(defaultTDSfun)
                    }
                }
                else if (tdsrel_searchh_result.length > 1) {
                    for (var i = 0; i < tdsrel_searchh_result.length; i++) {
                        var valid_from = tdsrel_searchh_result[i].getValue({ name: 'custrecord_tss_tds_relation_valid_from' })
                        var valid_until = tdsrel_searchh_result[i].getValue({ name: 'custrecord_tss_tds_relation_valid_until' })
                        log.debug("valid_from else", valid_from)
                        log.debug("valid_until else else", valid_until)
                        valid_from = valid_from ? format.parse({ value: valid_from, type: format.Type.DATE }) : null;
                        valid_until = valid_until ? format.parse({ value: valid_until, type: format.Type.DATE }) : null;
                        rec_date = rec_date ? format.parse({ value: rec_date, type: format.Type.DATE }) : null;
                        if (((valid_from && rec_date >= valid_from) || !valid_from) && ((valid_until && rec_date <= valid_until) || !valid_until)) {
                            defaultTDSfun = tdsrel_searchh_result[i].getValue({ name: 'internalid' });
                            // alert(defaultTDSfun)
                            break;
                        }
                    }
                }
            }
            return defaultTDSfun;
        }

        return {
            beforeLoad,
            beforeSubmit,
            afterSubmit,
        }

    });