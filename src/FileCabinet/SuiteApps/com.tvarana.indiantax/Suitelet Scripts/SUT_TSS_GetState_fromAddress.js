/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

/**
 * Script Name               : SUT TSS Get State from Address
 * Script Author             : MNR Krishna
 * Script Type               : Suitelet Script
 * Script Version            : 2.1
 * Script Created date       : 16/06/2023
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  suitelet sent State and GSTIN/UID from address (billaddresslist) values as resopnse
 */



define(['N/record', 'N/search'],
    /**
 * @param{record} record
 */
    (record, search) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            try {
                var a_result = new Array();
                var s_Record_Type = scriptContext.request.parameters.s_record_type;
                log.debug("s_Record_Type", s_Record_Type);
                var s_entiry_id = scriptContext.request.parameters.s_entiry_id;
                log.debug("s_entiry_id", s_entiry_id);
                var s_Ship_To = scriptContext.request.parameters.s_Ship_To;
                log.debug("s_Ship_To", s_Ship_To);
                var s_getDefaultAddressData = scriptContext.request.parameters.s_getDefaultAddressData;
                log.debug("s_getDefaultAddressData", s_getDefaultAddressData);
                if (_logValidation(s_entiry_id) && _logValidation(s_Ship_To)) {
                    var o_Record;
                    if (s_Record_Type == 'cashsale' || s_Record_Type == 'invoice' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'creditmemo') {
                        o_Record = record.load({
                            type: 'customer',
                            id: s_entiry_id,
                            isDynamic: true,
                        });
                        //log.debug("o_Record",o_Record);
                    }
                    else if (s_Record_Type == 'vendorbill' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorcredit') {
                        o_Record = record.load({
                            type: 'vendor',
                            id: s_entiry_id,
                            isDynamic: true,
                        });
                        //log.debug("o_Record",o_Record);

                    }
                    log.debug("o_Record", o_Record);

                    if (_logValidation(o_Record)) {
                        var i_Count = o_Record.getLineCount({ sublistId: 'addressbook' });

                        for (var i = 0; i < i_Count; i++) {
                            var l_addrId = o_Record.getSublistValue({
                                sublistId: 'addressbook',
                                fieldId: 'addressid',
                                line: i
                            });
                            log.debug("l_addrId", l_addrId);
                            if (_logValidation(l_addrId) && (s_Ship_To == l_addrId)) {
                                o_Record.selectLine({
                                    sublistId: 'addressbook',
                                    line: i
                                });
                                var subrecord = o_Record.getCurrentSublistSubrecord({
                                    sublistId: 'addressbook',
                                    fieldId: 'addressbookaddress',
                                    line: i
                                });
                                log.debug("subrecord in suitelet", subrecord);
                                if (_logValidation(subrecord)) {

                                    addr_Country = subrecord.getValue({ fieldId: 'country' });
                                    if (addr_Country == 'IN') {
                                        ad_GST_Number = subrecord.getValue({ fieldId: 'custrecord_tss_its_address_gstin' });
                                        log.debug("ad_GST_Number in suitelet", ad_GST_Number);
                                        ad_state = subrecord.getValue({ fieldId: 'custrecord_tss_its_gststate' });
                                        log.debug("ad_state in suitelet", ad_state);
                                        a_result.push({
                                            'state': ad_state,
                                            'gstinuid': ad_GST_Number,
                                        });
                                        break;
                                    } // end if (addr_Country =='IN')

                                    else {
                                        var a_Filters = new Array();
                                        var a_Columns = new Array();
                                        a_Filters.push(search.createFilter({
                                            name: 'isinactive',
                                            operator: 'is',
                                            values: 'F'
                                        }));
                                        a_Filters.push(search.createFilter({
                                            name: 'name',
                                            operator: 'is',
                                            values: 'Other State'
                                        }));
                                        a_Columns.push(search.createColumn({
                                            name: 'internalid',
                                        }));
                                        var otherState_search = search.create({
                                            type: 'customrecord_tss_gst_state_master',
                                            filters: a_Filters,
                                            columns: a_Columns
                                        });
                                        var otherState_search_result = otherState_search.run().getRange(0, 10);
                                        var OS_Id = otherState_search_result[0].getValue({ name: 'internalid' });
                                        log.debug("Other State InternalId", OS_Id);
                                        if (_logValidation(OS_Id)) {
                                            a_result.push({
                                                'state': OS_Id,
                                                'gstinuid': '',
                                            });
                                            break;
                                        }
                                    } // end else

                                } // end if(_logValidation(subrecord))
                            } // end if(_logValidation(l_addrId) && (s_Ship_To == l_addrId))
                        }// end for(var i = 0; i < i_Count; i++)

                    } // end if(_logValidation(o_Record))

                } // end if(_logValidation(s_entiry_id) && _logValidation(s_Ship_To))

                // Getting GSTIN and Place Of Service from default address of a customer. This is added for Customer Deposit.
                if (_logValidation(s_entiry_id) && isTrue(s_getDefaultAddressData)) {
                    var o_Record;
                    var defaultFieldId = ''
                    if (s_Record_Type == 'cashsale' || s_Record_Type == 'invoice' || s_Record_Type == 'salesorder' || s_Record_Type == 'estimate' || s_Record_Type == 'creditmemo' || s_Record_Type == 'customerdeposit' || s_Record_Type == 'customerrefund') {
                        o_Record = record.load({
                            type: 'customer',
                            id: s_entiry_id,
                            isDynamic: true,
                        });
                        //log.debug("o_Record",o_Record);
                        defaultFieldId = 'defaultshipping'
                    }
                    else if (s_Record_Type == 'vendorbill' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorcredit') {
                        o_Record = record.load({
                            type: 'vendor',
                            id: s_entiry_id,
                            isDynamic: true,
                        });
                        //log.debug("o_Record",o_Record);
                        defaultFieldId = 'defaultbilling'
                    }
                    log.debug("o_Record", o_Record);

                    if (_logValidation(o_Record)) {
                        var entityGSTIN = o_Record.getValue({ fieldId: 'custentity_tss_gstn_uid' })
                        var i_Count = o_Record.getLineCount({ sublistId: 'addressbook' });

                        for (var i = 0; i < i_Count; i++) {
                            var l_addrId = o_Record.getSublistValue({
                                sublistId: 'addressbook',
                                fieldId: defaultFieldId,
                                line: i
                            });
                            log.debug("l_addrId", l_addrId);
                            if (isTrue(l_addrId)) {
                                o_Record.selectLine({
                                    sublistId: 'addressbook',
                                    line: i
                                });
                                var subrecord = o_Record.getCurrentSublistSubrecord({
                                    sublistId: 'addressbook',
                                    fieldId: 'addressbookaddress',
                                    line: i
                                });
                                log.debug("subrecord in suitelet", subrecord);
                                if (_logValidation(subrecord)) {

                                    addr_Country = subrecord.getValue({ fieldId: 'country' });
                                    if (addr_Country == 'IN') {
                                        ad_GST_Number = subrecord.getValue({ fieldId: 'custrecord_tss_its_address_gstin' });
                                        log.debug("ad_GST_Number in suitelet", ad_GST_Number);
                                        ad_state = subrecord.getValue({ fieldId: 'custrecord_tss_its_gststate' });
                                        log.debug("ad_state in suitelet", ad_state);
                                        a_result.push({
                                            'state': ad_state,
                                            'gstinuid': ad_GST_Number,
                                            'entityGSTIN': entityGSTIN
                                        });
                                        break;
                                    } // end if (addr_Country =='IN')

                                    else {
                                        var a_Filters = new Array();
                                        var a_Columns = new Array();
                                        a_Filters.push(search.createFilter({
                                            name: 'isinactive',
                                            operator: 'is',
                                            values: 'F'
                                        }));
                                        a_Filters.push(search.createFilter({
                                            name: 'name',
                                            operator: 'is',
                                            values: 'Other State'
                                        }));
                                        a_Columns.push(search.createColumn({
                                            name: 'internalid',
                                        }));
                                        var otherState_search = search.create({
                                            type: 'customrecord_tss_gst_state_master',
                                            filters: a_Filters,
                                            columns: a_Columns
                                        });
                                        var otherState_search_result = otherState_search.run().getRange(0, 10);
                                        var OS_Id = otherState_search_result[0].getValue({ name: 'internalid' });
                                        log.debug("Other State InternalId", OS_Id);
                                        if (_logValidation(OS_Id)) {
                                            a_result.push({
                                                'state': OS_Id,
                                                'gstinuid': '',
                                                'entityGSTIN': entityGSTIN
                                            });
                                            break;
                                        }
                                    } // end else

                                } // end if(_logValidation(subrecord))
                            } // end if(_logValidation(l_addrId) && (s_Ship_To == l_addrId))
                        }// end for(var i = 0; i < i_Count; i++)

                    } // end if(_logValidation(o_Record))
                } // end if(_logValidation(s_entiry_id) && isTrue(s_getDefaultAddressData))

                log.debug("a_result", a_result);
                scriptContext.response.write(JSON.stringify(a_result));

            }//end try
            catch (e) {
                log.error("Error in Suitelet SUT_TSS_GetState_fromAddress", e);
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
        function isTrue(value) {
            if (value == 'T' || value == true || value == 'true') {
                return true;
            }
            else {
                return false;
            }
        } // end function isTrue(value)
        // end custom functions
        return { onRequest }

    });
