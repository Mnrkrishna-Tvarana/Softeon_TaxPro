/**
 * Script Name               : TSS CS TCS On Sales
 * Script Author             : Gayathri Sai Priya
 * Script Type               : Client Script
 * Script Version            : 2.1
 * Script Created date       : 2/4/2026
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  
 */

/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/search', 'N/record', 'N/ui/dialog', 'N/runtime'], (currentRecord, search, record, dialog, runtime) => {
    //Global Variables
    var isExpired = true;
    const ELIGIBILITY_FIELD = 'custitem_tss_it_tcs_eligibility';

    const TARGET_FIELDS = [
        'custitem_tss_itb_tcs_section',
        'custitem_tss_it_item_tcs_subsection',
        'custitem_tss_itb_item_challan'
    ];
    const CUSTOMER_ELIGIBILITY = 'custentity_tss__it_customer_tcs';

    const CUSTOMER_FIELDS = [
        'custentity_tss_it_cust_pan_avlbl',
    ];

    function pageInit(context) {
        try {
            SearchGlobalParameter()
            if (isExpired) {
                return true
            }
            const rec = context.currentRecord;
            if (isItemRecordTypeEligible(context.currentRecord.type)) {
                var isEligible = rec.getValue({ fieldId: ELIGIBILITY_FIELD });

                toggleFields(isEligible, TARGET_FIELDS);
            }
            /* ---------- Customer ---------- */
            if (context.currentRecord.type == 'customer') {

                var isEligible = rec.getValue({ fieldId: CUSTOMER_ELIGIBILITY });

                toggleFields(isEligible, CUSTOMER_FIELDS);

                togglePanNumberField();
            }
            if (context.currentRecord.type == 'invoice') {
                var overrideTCS = rec.getValue({ fieldId: 'custbody_tss_it_tcs_override' });
                toggleOverrideColumn(rec, overrideTCS);
                if (context.mode == 'copy') {
                    rec.setValue({
                        fieldId: 'custbody_tss_it_tcs_override',
                        value: false
                    });

                    setTimeout(function () {
                        var Item_Count = rec.getLineCount({ sublistId: 'item' });
                        log.debug("Item_Count in pageInit", Item_Count);
                        for (var i = Item_Count - 1; i >= 0; i--) {
                            var Tcscheck = rec.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_tss_it_tcs_line',
                                line: i
                            });
                            //log.debug("Tdscheck",Tdscheck);
                            if (Tcscheck == 'T' || Tcscheck == true || Tcscheck == 'true') {
                                rec.removeLine({
                                    sublistId: 'item',
                                    line: i,
                                    // ignoreRecalc: true
                                });
                            } // end if(isTrue(Tdscheck))
                        } // end for (var i = Item_Count-1; i >= 0; i--)

                    }, 1000);
                }

            }
        } catch (e) {
            log.error("pageInit Error", e.message);
        }
    }

    /* ---------- fieldChanged ---------- */
    function fieldChanged(context) {
        try {
            if (isExpired) {
                return true
            }
            if (isItemRecordTypeEligible(context.currentRecord.type)) {
                const rec = context.currentRecord;


                // eligibility toggle
                if (context.fieldId === ELIGIBILITY_FIELD) {

                    const isEligible = rec.getValue({ fieldId: ELIGIBILITY_FIELD });
                    toggleFields(isEligible, TARGET_FIELDS);

                }

                // custitem_tss_itb_tcs_section changed → populate details
                if (context.fieldId === 'custitem_tss_itb_tcs_section') {
                    var masterRecValue = rec.getValue({ fieldId: 'custitem_tss_itb_tcs_section' });
                    populateTCSDetails(masterRecValue);
                }
            }
            /* ---------- Customer ---------- */
            if (context.currentRecord.type == 'customer') {

                const rec = context.currentRecord;

                if (context.fieldId === CUSTOMER_ELIGIBILITY) {
                    var isEligible = rec.getValue({ fieldId: CUSTOMER_ELIGIBILITY });
                    toggleFields(isEligible, CUSTOMER_FIELDS);

                }
                if (context.fieldId === 'custentity_tss_it_cust_pan_avlbl') {
                    togglePanNumberField()

                }
            }
            if (context.currentRecord.type == 'invoice') {

                if (!isSubsidiaryMatch(context.currentRecord)) return;


                /* ---------- Invoice Line TCS ---------- */
                if (context.sublistId === 'item') {

                    // When item is changed on line
                    var sublistId = context.sublistId
                    if (context.fieldId === 'item') {
                        const rec = context.currentRecord;
                        const isTCSApplicable = rec.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_tss_itb_apply_tcs'
                        });

                        if (isTCSApplicable) {
                            calculateLineTCS(context);
                        }
                    }
                    if (context.fieldId === 'custcol_tss_itb_apply_tcs') {
                        const rec = context.currentRecord;
                        const isTCSApplicable = rec.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_tss_itb_apply_tcs'
                        });
                        log.debug('isTCSApplicable', isTCSApplicable);

                        if (isTCSApplicable) {
                            calculateLineTCS(context);
                        } else if (!isTCSApplicable) {
                            // Clear TCS fields when unchecked
                            rec.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: 'custcol_tss_itb_tcs_relation_type',
                                value: ''
                            });

                            // rec.setCurrentSublistValue({
                            //     sublistId: sublistId,
                            //     fieldId: 'custcol_tss_itb_tcs_rate',
                            //     value: ''
                            // });

                            // rec.setCurrentSublistValue({
                            //     sublistId: sublistId,
                            //     fieldId: 'custcol_tss_tcsamt',
                            //     value: ''
                            // });

                            return;
                        }


                    }

                    // When amount changes, recalculate TCS
                    if (context.fieldId === 'amount' || context.fieldId === 'quantity' || context.fieldId === 'rate') {
                        const rec = context.currentRecord;
                        const isTCSApplicable = rec.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_tss_itb_apply_tcs'
                        });

                        if (isTCSApplicable) {
                            calculateLineTCS(context);
                        }
                    }
                }
                if (context.fieldId == 'custbody_tss_it_tcs_override') {
                    const rec = context.currentRecord;
                    var overrideTCS = rec.getValue({ fieldId: 'custbody_tss_it_tcs_override' });
                    toggleOverrideColumn(rec, overrideTCS);
                }
            }
        }
        catch (e) {
            log.error('fieldChanged Error', e.message);
        }
    }
    function validateLine(context) {
        try {
            if (isExpired) {
                return true
            }
            if (context.currentRecord.type == 'invoice' && context.sublistId === 'item') {
                if (!isSubsidiaryMatch(context.currentRecord)) return;
                const rec = context.currentRecord;

                const isTCSApplicable = rec.getCurrentSublistValue({
                    sublistId: context.sublistId,
                    fieldId: 'custcol_tss_itb_apply_tcs'
                });

                if (isTCSApplicable) {
                    calculateLineTCS(context);
                }

                try {
                    var current_record = context.currentRecord;
                    var sublistName = context.sublistId;

                    if (sublistName !== 'item') return true;

                    var tdsLineFlag = current_record.getCurrentSublistValue({
                        sublistId: sublistName,
                        fieldId: "custcol_tss_it_tcs_line"
                    });

                    // Skip if not TDS Line 
                    if (!tdsLineFlag) return true;

                    var tdsType = current_record.getCurrentSublistValue({
                        sublistId: sublistName,
                        fieldId: "custcol_tss_itb_tcs_section",
                    })
                    var tdsPercentage = current_record.getCurrentSublistValue({
                        sublistId: sublistName,
                        fieldId: "custcol_tss_itb_tcs_rate",
                    })
                    var tdsBaseAmt = current_record.getCurrentSublistValue({
                        sublistId: sublistName,
                        fieldId: "custcol_tss_itb_tcs_base_amount",
                    })
                    // var tdsAmount = current_record.getCurrentSublistValue({
                    //     sublistId: sublistName,
                    //     fieldId: "custcol_tss_tcsamt",
                    // })
                    var refId = current_record.getCurrentSublistValue({
                        sublistId: sublistName,
                        fieldId: "custcol_tss_it_tcs_refid",
                    })

                    var missingFields = [];
                    if (!_logValidation(tdsType)) missingFields.push("TCS Section");
                    if (!_logValidation(tdsPercentage)) missingFields.push("TCS Percentage");
                    if (!_logValidation(tdsBaseAmt)) missingFields.push("TCS Base Amount");
                    // if (!_logValidation(tdsAmount)) missingFields.push("TCS Amount");
                    if (!_logValidation(refId)) missingFields.push("TCS Reference ID");

                    if (missingFields.length > 0) {

                        dialog.alert({
                            title: 'TDS Validation',
                            message: 'Please provide:\n\n ' + missingFields.join('\n, ')
                        });
                        return false;
                    } else {
                        return true
                    }
                }
                catch (e) {
                    log.error("error in validateLine", e);
                    return true;
                }

            }
            return true;
        } catch (e) {
            log.error('validateLine Error', e.message);
            return true;
        }
    }
    /* ---------- Enable/Disable ---------- */
    function toggleFields(isEligible, fields) {
        try {
            const rec = currentRecord.get();

            fields.forEach(id => {
                const field = rec.getField({ fieldId: id });

                if (field) {
                    field.isDisabled = !isEligible;
                    field.isMandatory = isEligible;

                    if (!isEligible) {
                        rec.setValue({
                            fieldId: id,
                            value: rec.getField({ fieldId: id }).type === 'checkbox' ? false : ''
                        });
                    }
                }
            });
        }
        catch (e) {
            log.error('toggleFields Error', e.message);
        }
    }

    function validateDelete(context) {
        try {
            var currentRec = context.currentRecord;

            if (context.sublistId === 'item') {

                var isTCSLine = currentRec.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_it_tcs_line'
                });

                if (isTCSLine === true || isTCSLine === 'T') {
                    dialog.alert({
                        title: 'TCS Validation',
                        message: 'TCS line should not be removed.'
                    })
                    return false;
                }
            }

            return true;

        } catch (e) {
            log.error('Error in validateDelete:', e);
            return true;
        }
    }


    function togglePanNumberField() {
        try {
            const rec = currentRecord.get();

            const tcs = rec.getValue({ fieldId: CUSTOMER_ELIGIBILITY });
            const panAvailable = rec.getValue({ fieldId: 'custentity_tss_it_cust_pan_avlbl' });

            const field = rec.getField({ fieldId: 'custentity_tss_it_cust_pannum' });
            if (!field) return;

            const enable = tcs && panAvailable;

            field.isDisabled = !enable;
            field.isMandatory = enable;

            if (!enable) {
                rec.setValue({
                    fieldId: 'custentity_tss_it_cust_pannum',
                    value: ''
                });
            }
        }
        catch (e) {
            log.error('togglePanNumberField Error', e.message);
        }
    }

    function populateTCSDetails(masterId) {
        try {
            if (!masterId) return;

            const rec = currentRecord.get();

            const lookup = search.lookupFields({
                type: 'customrecord_tss_its_tcsmaster',
                id: masterId,
                columns: [
                    'custrecord_tvr_tcsmaster_subsection_code',
                    'custrecord_tvr_tcsmaster_challan_code'
                ]
            });

            rec.setValue({
                fieldId: 'custitem_tss_it_item_tcs_subsection',
                value: lookup.custrecord_tvr_tcsmaster_subsection_code || ''
            });

            rec.setValue({
                fieldId: 'custitem_tss_itb_item_challan',
                value: lookup.custrecord_tvr_tcsmaster_challan_code || ''
            });
        }
        catch (e) {
            log.error('populateTCSDetails Error', e.message);
        }
    }

    /* ---------- Invoice TCS Calculation ---------- */
    function calculateLineTCS(context) {
        try {
            const rec = context.currentRecord;
            const sublistId = context.sublistId;
            const line = context.line;

            // Check if TCS is applicable on this line
            const isTCSApplicable = rec.getCurrentSublistValue({
                sublistId: sublistId,
                fieldId: 'custcol_tss_itb_apply_tcs'
            });

            if (!isTCSApplicable) {
                return;
            }

            // Get item ID from current line
            const itemId = rec.getCurrentSublistValue({
                sublistId: sublistId,
                fieldId: 'item'
            });

            if (!itemId) {
                return;
            }

            // Check item eligibility
            const itemLookup = search.lookupFields({
                type: search.Type.ITEM,
                id: itemId,
                columns: ['custitem_tss_it_tcs_eligibility', 'custitem_tss_itb_tcs_section']
            });

            const itemEligible = itemLookup.custitem_tss_it_tcs_eligibility;
            const tcsRelationType = itemLookup.custitem_tss_itb_tcs_section;

            log.debug("item data", {
                itemEligible: itemEligible,
                tcsRelationType: tcsRelationType
            })

            if (!itemEligible) {
                log.debug('Item is not eligible for TCS');
                // alert('Item is not eligible for TCS');
                return;
            }

            // Check customer eligibility
            const customerId = rec.getValue({ fieldId: 'entity' });

            if (!customerId) return;

            const customerLookup = search.lookupFields({
                type: search.Type.CUSTOMER,
                id: customerId,
                columns: ['custentity_tss__it_customer_tcs', 'custentity_tss_it_cust_pan_avlbl']
            });

            const customerEligible = customerLookup.custentity_tss__it_customer_tcs;
            const panAvailable = customerLookup.custentity_tss_it_cust_pan_avlbl;
            log.debug("customer data", {
                customerEligible: customerEligible,
                panAvailable: panAvailable
            })

            if (!customerEligible) {
                log.debug('Customer is not eligible for TCS');
                // alert('Customer is not eligible for TCS');
                return;
            }

            // Set TCS Relation Type on line
            if (tcsRelationType && tcsRelationType.length > 0) {
                const tcsRelationTypeId = tcsRelationType[0].value;

                rec.setCurrentSublistValue({
                    sublistId: sublistId,
                    fieldId: 'custcol_tss_itb_tcs_relation_type',
                    value: tcsRelationTypeId
                });

                // Get TCS Rate based on PAN availability
                if (tcsRelationTypeId) {
                    const tcsMasterLookup = search.lookupFields({
                        type: 'customrecord_tss_its_tcsmaster',
                        id: tcsRelationTypeId,
                        columns: ['custrecord_tvr_tcsmaster_rate']
                    });

                    let tcsRate = 0;

                    if (panAvailable && tcsMasterLookup.custrecord_tvr_tcsmaster_rate) {
                        tcsRate = parseFloat(tcsMasterLookup.custrecord_tvr_tcsmaster_rate) || 0;
                    }

                    // Set TCS Rate on line
                    // rec.setCurrentSublistValue({
                    //     sublistId: sublistId,
                    //     fieldId: 'custcol_tss_itb_tcs_rate',
                    //     value: tcsRate
                    // });

                    // Calculate TCS Amount
                    const lineAmount = rec.getCurrentSublistValue({
                        sublistId: sublistId,
                        fieldId: 'amount'
                    }) || 0;

                    const tcsAmount = (lineAmount * tcsRate) / 100;

                    // Set TCS Amount on line
                    // rec.setCurrentSublistValue({
                    //     sublistId: sublistId,
                    //     fieldId: 'custcol_tss_tcsamt',
                    //     value: tcsAmount.toFixed(2)
                    // });
                }
            }
        }
        catch (e) {
            log.error('calculateLineTCS Error', e.message);
        }
    }


    function _logValidation(val) {
        if (val !== '' && val !== null && val !== undefined && val !== false && val !== 'null') {
            return true;
        }
        return false;
    }

    function SearchGlobalParameter() {
        var a_filters = [];
        var a_column = [];
        a_filters.push(search.createFilter({ name: 'isinactive', operator: 'is', values: 'F' }));
        a_column.push(search.createColumn({ name: 'internalid' }));
        a_column.push(search.createColumn({ name: 'custrecord_tss_gp_subscription_end' }));
        var global_param_search = search.create({
            type: 'customrecord_tss_global_parameter',
            filters: a_filters,
            columns: a_column
        });
        var result = global_param_search.run().getRange(0, 100);
        if (_logValidation(result) && result.length > 0) {
            isExpired = result[0].getValue({ name: 'custrecord_tss_gp_subscription_end' });
            return result[0].getValue({ name: 'internalid' });
        }
        return null;
    }

    function isItemRecordTypeEligible(recordType) {
        try {
            var script = runtime.getCurrentScript();
            var paramValue = script.getParameter({ name: 'custscript_item_record_type' });

            if (!_logValidation(paramValue)) return false;

            var eligibleTypes = String(paramValue).split(',').map(function (type) {
                return type.trim();
            });

            return eligibleTypes.indexOf(recordType) !== -1;
        } catch (e) {
            log.error('isItemRecordTypeEligible Error', e.message);
            return false;
        }
    }

    function inArray(needle, haystack) {
        if (_logValidation(haystack)) {
            if (typeof haystack === 'string') haystack = haystack.split(',');
            for (var i = 0; i < haystack.length; i++) {
                if (haystack[i] === needle) return 1;
            }
            return 0;
        }
        return 0;
    }

    function isSubsidiaryMatch(current_record) {
        try {
            var GlobalRecId = SearchGlobalParameter();
            if (!_logValidation(GlobalRecId)) return false;

            var GlobalRec = record.load({ type: 'customrecord_tss_global_parameter', id: GlobalRecId });
            var g_subsidiary = GlobalRec.getValue('custrecord_tss_gp_subsidiary');

            var rec_subsidiary = current_record.getValue({ fieldId: 'subsidiary' });
            return inArray(rec_subsidiary, g_subsidiary) === 1;
        } catch (e) {
            log.error('isSubsidiaryMatch Error', e.message);
            return false;
        }
    }
    function toggleOverrideColumn(currentRecord, isEnabled) {
        try {
            // Handle item sublist
            var itemCount = currentRecord.getLineCount({ sublistId: 'item' });
            if (itemCount > 0) {
                for (var j = 0; j < itemCount; j++) {
                    var sublistField = currentRecord.getSublistField({
                        sublistId: 'item',
                        fieldId: 'custcol_tss_it_tcs_override_line',
                        line: j
                    })
                    if (sublistField) sublistField.isDisabled = !isEnabled;
                }
            }
        }
        catch (e) {
            log.error('toggleOverrideColumn Error', e.message);
        }
    }

    return {
        pageInit,
        fieldChanged,
        validateLine,
        // validateDelete
    };
});