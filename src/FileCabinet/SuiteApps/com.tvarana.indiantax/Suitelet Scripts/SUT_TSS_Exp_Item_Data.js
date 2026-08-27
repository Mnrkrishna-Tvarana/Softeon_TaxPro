/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
/**
 * Script Name               : SUT TSS Exp Item Data
 * Script Author             : MNR Krishna
 * Script Type               : Suitelet Script
 * Script Version            : 2.1
 * Script Created date       : 16/06/2023
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  suitelet sent Item Record /Expense Category Record data as resopnse
 */


define(['N/record'],
    /**
 * @param{record} record
 */
    (record) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            try {
                var l_result = new Array();

                var s_expense = scriptContext.request.parameters.s_expense;
                log.debug("s_expense", s_expense);

                if (_logValidation(s_expense)) {
                    var o_Record = record.load({
                        type: 'expensecategory',
                        id: s_expense,
                        isDynamic: true,
                    });
                    if (_logValidation(o_Record)) {
                        var s_rcm = o_Record.getValue({ fieldId: 'custrecord_tss_rcm' });
                        var hsnsac = o_Record.getValue({ fieldId: 'custrecord_tss_its_exp_hsn' });
                        var taxLiable = o_Record.getValue({ fieldId: 'custrecord_tss_tax_liable' });
                        var s_ITC = o_Record.getValue({ fieldId: 'custrecord_tss_itc_ineligible' });
                        l_result.push({
                            's_rcm': s_rcm,
                            'hsnsac': hsnsac,
                            'taxLiable': taxLiable,
                            's_ITC': s_ITC
                        });
                    }
                }

                var s_item = scriptContext.request.parameters.s_item;
                log.debug("s_item", s_item);
                var s_itemType = scriptContext.request.parameters.s_itemType;
                log.debug("s_itemType", s_itemType);

                if (_logValidation(s_item)) {
                    var o_Record = record.load({
                        type: s_itemType,
                        id: s_item,
                        isDynamic: true,
                    });
                    if (_logValidation(o_Record)) {
                        var s_rcm = o_Record.getValue({ fieldId: 'custitem_tss_item_rcm_applicable' });
                        var s_ITC = o_Record.getValue({ fieldId: 'custitem_tss_itc_ineligible' });
                        l_result.push({
                            's_rcm': s_rcm,
                            's_ITC': s_ITC
                        });
                    }
                }

                var s_account = scriptContext.request.parameters.s_account;
                log.debug("s_account", s_account);

                if (_logValidation(s_account)) {
                    var o_Record = record.load({
                        type: 'account',
                        id: s_account,
                        isDynamic: true,
                    });
                    if (_logValidation(o_Record)) {
                        var s_rcm = o_Record.getValue({ fieldId: 'custrecord_tss_act_rcm' });
                        var hsnsac = o_Record.getValue({ fieldId: 'custrecord_tss_its_act_hsn' });
                        var taxLiable = o_Record.getValue({ fieldId: 'custrecord_tss_tax_act_liable' });
                        var s_ITC = o_Record.getValue({ fieldId: 'custrecord_tss_act_itc_ineligible' });
                        l_result.push({
                            's_rcm': s_rcm,
                            'hsnsac': hsnsac,
                            'taxLiable': taxLiable,
                            's_ITC': s_ITC
                        });
                    }
                }

                log.debug("l_result", l_result);
                scriptContext.response.write(JSON.stringify(l_result));

            }// end try
            catch (e) {
                log.error("Error in SUT_TSS_Exp_Item_Data", e);
            }

        }


        // Custom functions are defined below....
        function _logValidation(value) {
            if (value != 'null' && value != null && value != null && value != '' && value != undefined && value != undefined && value != 'undefined' && value != 'undefined' && value != 'NaN' && value != NaN) {
                return true;
            }
            else {
                return false;
            }
        }
        // end custom functions

        return { onRequest }

    });
