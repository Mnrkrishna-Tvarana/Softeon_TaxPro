/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

/**
 * Script Name               : SUT TSS Get Location Data
 * Script Author             : MNR Krishna
 * Script Type               : Suitelet Script
 * Script Version            : 2.1
 * Script Created date       : 16/06/2023
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  suitelet sent Location record data as resopnse
 */




define(['N/record'],
    /**
 * @param{render} render
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
            try{
                var l_result =new Array();
                var s_Location = scriptContext.request.parameters.s_Location;
                log.debug("s_Location",s_Location);
                if(_logValidation(s_Location)){
                    var o_Record = record.load({
                        type: 'location', 
                        id: s_Location,
                        isDynamic: true,
                    });
                    if(_logValidation(o_Record)){
                        var i_Location_Type = o_Record.getText({fieldId:'custrecord_tss_gst_type_location'});
                        var i_Location_State = o_Record.getValue({fieldId:'custrecord_tss_its_location_statename'});
                        var GstIn = o_Record.getValue({fieldId:'custrecord_tss_gstin'});
                        if(_logValidation(i_Location_Type)){
                            l_result.push({	
                                'i_Location_Type' : i_Location_Type,
                                'i_Location_State': i_Location_State,
                                'GstIn':GstIn                           
                          });
                        }
                    }
                }
                log.debug("l_result",l_result)
                scriptContext.response.write(JSON.stringify(l_result));

            }// end try
            catch(e){
                log.error("Error in SUT_TSS_Get_Location_Data", SUT_TSS_Get_Location_Data);
            }

        }

        // Custom functions are defined below....
        function _logValidation(value) {
            if(value!='null' && value != null && value != null && value != '' && value != undefined && value != undefined && value != 'undefined' && value != 'undefined'&& value != 'NaN' && value != NaN) 
            {
                return true;
            }
            else 
            { 
                return false;
            }
        }
        // end custom functions


        return {onRequest}

    });
