/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

/**
 * Script Name               : SUT TSS Get Entity Data
 * Script Author             : MNR Krishna
 * Script Type               : Suitelet Script
 * Script Version            : 2.1
 * Script Created date       : 16/06/2023
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  Suitelet gives Entity Data as response.
 */


define(['N/search'],
    /**
 * @param{search} search
 */
    (search) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            try {
                var result = new Array();
                var s_Record_Type = scriptContext.request.parameters.s_record_type;
                log.debug("s_Record_Type", s_Record_Type);
                var s_entiry_id = scriptContext.request.parameters.s_entiry_id;
                log.debug("s_entiry_id", s_entiry_id);
                var s_getEntType = scriptContext.request.parameters.s_getEntType;
                log.debug("s_getEntType", s_getEntType);
                if (_logValidation(s_entiry_id) && !isTrue(s_getEntType)) {
                    if (s_Record_Type == 'vendorbill' || s_Record_Type == 'purchaseorder' || s_Record_Type == 'vendorcredit') {
                        var vnr_Flag = search.lookupFields({
                            type: 'vendor',
                            id: s_entiry_id,
                            columns: ['custentity_tss_gst_liable', 'isperson', 'custentitytss_pan']
                        });
                        vnr_Flag = vnr_Flag.custentity_tss_gst_liable;
                        log.debug("vnr_Flag", vnr_Flag);
                        var assesse = vnr_Flag.isperson;
                        log.debug("assesse", assesse);
                        var Pan = vnr_Flag.custentitytss_pan;
                        log.debug("Pan", Pan);
                    }

                    if (_logValidation(vnr_Flag)) {
                        result.push({
                            'vnr_Flag': vnr_Flag,
                            'assesse': assesse,
                            'Pan': Pan
                        })
                    }

                    if (s_Record_Type == 'salesorder' || s_Record_Type == 'invoice' || s_Record_Type == 'creditmemo' || rec_type == 'cashsale' || rec_type == 'estimate'|| rec_type == 'customerdeposit') {
                        var cust_Flag = search.lookupFields({
                            type: 'customer',
                            id: s_entiry_id,
                            columns: ['custentity_tss_gst_liable']
                        });
                        cust_Flag = cust_Flag.custentity_tss_gst_liable;
                        log.debug("cust_Flag", cust_Flag);
                    }

                    if (_logValidation(cust_Flag)) {
                        result.push({
                            'cust_Flag': cust_Flag
                        })
                    }

                } // end if(_logValidation(s_entiry_id))

                else if (isTrue(s_getEntType)) {
                    var a_Filters = new Array();
                    var a_Columns = new Array();
                    a_Filters.push(search.createFilter({
                        name: 'internalid',
                        operator: 'anyof',
                        values: s_entiry_id
                    }));
                    a_Columns.push(search.createColumn({ name: 'type' }));
                    var entTypesearch = search.create({
                        type: 'entity',
                        filters: a_Filters,
                        columns: a_Columns
                    });
                    var entTypesearch_result = entTypesearch.run().getRange(0, 100);
                    log.debug("entTypesearch_result in suitelet", entTypesearch_result);
                    var ent_Type = entTypesearch_result[0].getText({ name: 'type' });
                    if (_logValidation(ent_Type)) {
                        result.push({
                            'ent_Type': ent_Type
                        })
                    }
                }



                log.debug("result", result);
                scriptContext.response.write(JSON.stringify(result));
            } // try
            catch (e) {
                log.error("Error in Suitelet SUT_TSS_Get_Vendor_Data", e);
            } // end catch(e)

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

        return { onRequest }

    });
