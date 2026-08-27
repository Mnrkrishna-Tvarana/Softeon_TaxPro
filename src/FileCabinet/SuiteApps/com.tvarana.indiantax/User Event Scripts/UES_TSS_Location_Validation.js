/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
/**
 * Script Name               : UES TSS Location Validation
 * Script Author             : MNR Krishna
 * Script Type               : User Event Script
 * Script Version            : 2.1
 * Script Created date       : 06/06/2023
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  This script is to validate State Code and GSTIN in Location record.
 */
define(['N/search', '/SuiteApps/com.tvarana.indiantax/Other Files/TSS TaxPro Server Helper'],
    /**
 * @param{search} search
 * @param{serverHelper} serverHelper
 */
    (search, serverHelper) => {
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
            if (!serverHelper.checkSubscription()) {
                log.debug("TaxPro UE beforeSubmit", "Subscription check failed - blocking execution");
                return true;
            }
            //try{
            var current_record = scriptContext.newRecord;
            var GST_IN = current_record.getValue({ fieldId: "custrecord_tss_gstin" });
            log.debug("GST_IN in beforeSubmit", GST_IN);
            var b_Check = new RegExp("^[0-9]{2}([A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]|[0-9]{2}[A-Z]{3}[0-9]{5}UN[0-9A-Z])$"); // This is used for both GSTIN and UIN Validation
            // var company_info_search = search.create({
            //     type : 'customrecord_tss_company_info',
            //     filters : ["isinactive","is","F"],
            //     columns : ["custrecord_tss_permanent_accountno"]
            // });
            // var company_info_search_results = company_info_search.run().getRange(0,100);
            // var panNumber = new Array();
            // //log.debug("_logValidation(company_info_search_results)",_logValidation(company_info_search_results));
            // if(_logValidation(company_info_search_results)){
            //     for(var i=0;i<company_info_search_results.length;i++){
            //         panNumber.push(company_info_search_results[i].getValue({name: 'custrecord_tss_permanent_accountno'}));
            //         if(_nullValidation(panNumber)){
            //             panNumber = '';
            //         }

            //     }
            // }
            var GST_Liable = current_record.getValue({ fieldId: "custrecord_tss_its_gst_liable_location" });
            log.debug("GST_Liable in beforeSubmit", GST_Liable);
            if (GST_Liable == true || GST_Liable == 'T' || GST_Liable == 'true') {
                if (_logValidation(GST_IN)) {
                    if (b_Check.test(GST_IN)) {
                        log.debug("valid", b_Check.test(GST_IN));
                        var State_Code = current_record.getValue({ fieldId: "custrecord_tss_location_state_code" });
                        var State_Number = GST_IN.substring(0, 2);
                        var Pan_Number = GST_IN.substring(2, 12);
                        // var Pan_Value = inArray(Pan_Number,panNumber);
                        // log.debug("Pan_Value in beforeSubmit",Pan_Value);
                        if (_logValidation(State_Code) && State_Code != State_Number) {
                            throw ('Please check your GSTIN/UID, as first 2 numbers from GSTIN/UID: ' + State_Number + ' does not match State Code: ' + State_Code);
                            return false;
                        }
                        // else if(_logValidation(Pan_Number) && Pan_Value != true){
                        //     throw('Please check your GSTIN/UID, as Pan Number from GSTIN/UID: '+Pan_Number + ' does not match Pan Number of Company Information: '+panNumber);
                        //     return false;
                        // }

                    }
                    else {
                        // throw ('Please enter The valid GSTIN No ,\n * GSTIN Number Length 15 Character \n * First Two Numeric 0 to 9 \n * Five Character from A to Z \n * Four Numeric 0 to 9 \n * One Character from A to Z \n * One Alpha Numeric A to Z or 0 to 9 \n * One Character Z \n * One Alpha Numeric A to Z or 0 to 9');
                        var isAttemptingUIN = GST_IN.toUpperCase().substring(12, 14) === 'UN';;
                        var isAttemptingGSTIN = !isAttemptingUIN;
                        var errMessage = '';
                        if (isAttemptingUIN) {
                            errMessage = 'Entered a invalid UIN Number-' + GST_IN + '.\n\n' +
                                '--- UIN Format (15 Characters) ---\n' +
                                ' * First 2 digits     : State Code (0-9)\n' +
                                ' * Next 2 digits      : Year of Issue (0-9)\n' +
                                ' * Next 3 characters  : Organisation Code (A to Z)\n' +
                                ' * Next 5 digits      : Serial Number (0 to 9)\n' +
                                ' * Next 2 characters  : Always UN\n' +
                                ' * Last 1 character   : A to Z or 0 to 9\n'
                                ;
                        } else {
                            errMessage = 'Entered a invalid GSTIN Number-' + GST_IN + '.\n\n' +
                                '--- GSTIN Format (15 Characters) ---\n' +
                                ' * First 2 digits     : State Code (0-9)\n' +
                                ' * Next 5 characters  : A to Z\n' +
                                ' * Next 4 digits      : 0 to 9\n' +
                                ' * Next 1 character   : A to Z\n' +
                                ' * Next 1 character   : A to Z or 1 to 9\n' +
                                ' * Next 1 character   : Always Z\n' +
                                ' * Last 1 character   : A to Z or 0 to 9\n'
                                ;
                        }
                        throw (errMessage);
                    }
                }
            }
            //}
            /* catch(e){
                 log.error("Error in beforeSubmit",e);
             }*/


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

        }


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

        function inArray(needle, haystack) {
            if (_logValidation(haystack)) {
                if (typeof (haystack) == 'string')
                    haystack = haystack.split(',')
                var count = haystack.length;
                log.debug("Pan Count of global parameters in inArray(needle,haystack)", count);
                for (var i = 0; i < count; i++) {
                    if (haystack[i] === needle) { return true; }
                }
                return false;
            }

        }

        return {
            //beforeLoad, 
            beforeSubmit
            //afterSubmit
        }

    });
