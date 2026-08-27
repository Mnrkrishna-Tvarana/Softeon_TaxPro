/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
/**
 * Script Name               : TSS UE Vendor Tax Validations
 * Script Author             : MNR Krishna
 * Script Type               : User Event Script
 * Script Version            : 2.1
 * Script Created date       : 04/07/2023
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  This script will update the GST State, GSTIN fields in address sublist from Header level data.
 */

define(['N/search', 'N/runtime', '/SuiteApps/com.tvarana.indiantax/Other Files/TSS TaxPro Server Helper'],

    (search, runtime, serverHelper) => {
        var g_subisidiary = '';
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
            try {
                if (!serverHelper.checkSubscription()) {
                    log.debug("TaxPro UE beforeSubmit", "Subscription check failed - blocking execution");
                    return true;
                }
                var currentContext = runtime.executionContext;
                // if (currentContext != 'USERINTERFACE') {
                var GlobalRecId = SearchGlobalParameter();
                // if (scriptContext.type === scriptContext.UserEventType.XEDIT) {
                //     var current_record = scriptContext.oldRecord;
                // } else {
                //     var current_record = scriptContext.newRecord;
                // }
                if (scriptContext.type === scriptContext.UserEventType.XEDIT) {
                    var newRec = scriptContext.newRecord;
                    var oldRec = scriptContext.oldRecord;

                    // Use safe getter
                    var Subsidiary = getValueSafe('subsidiary', newRec, oldRec);
                    var GST_Liable = getValueSafe("custentity_tss_gst_liable", newRec, oldRec);
                    var panId = getValueSafe("custentitytss_pan", newRec, oldRec);
                    var GSTIN = getValueSafe("custentity_tss_gstn_uid", newRec, oldRec);
                    var is_NRI = getValueSafe("custentity_tss_is_nri", newRec, oldRec);
                    var PAN = getValueSafe("custentitytss_pan", newRec, oldRec);
                    // var current_record = scriptContext.oldRecord;

                }
                else {
                    var newRec = scriptContext.newRecord;
                    var oldRec = scriptContext.oldRecord;

                    // Normal mode (full record available)
                    var Subsidiary = newRec.getValue('subsidiary');
                    var GST_Liable = newRec.getValue("custentity_tss_gst_liable");
                    var panId = newRec.getValue("custentitytss_pan");
                    var GSTIN = newRec.getValue("custentity_tss_gstn_uid");
                    var is_NRI = newRec.getValue("custentity_tss_is_nri");
                    var PAN = newRec.getValue("custentitytss_pan");
                    //var current_record = scriptContext.newRecord;

                }
                var current_record = scriptContext.newRecord;
                log.debug("scriptContext.oldRecord", scriptContext.oldRecord)
                log.debug("scriptContext.newRecord", scriptContext.newRecord)
                // const Subsidiary = current_record.getValue('subsidiary');
                log.debug('Subsidiary', Subsidiary)
                var Flag = inArray(Subsidiary, g_subisidiary);
                if (Flag == parseInt(1)) {
                    // var GST_Liable = current_record.getValue({ fieldId: "custentity_tss_gst_liable" });
                    log.debug("GST_Liable in beforeSubmit", GST_Liable);


                    // PAN Validation
                    // var panId = current_record.getValue({ fieldId: "custentitytss_pan" });
                    log.debug("panId", panId)
                    if (_logValidation(panId)) {
                        var panPat = /^([A-Z]{5})(\d{4})([A-Z]{1})$/;
                        if (panId.search(panPat) == -1) {
                            log.error('This is Invalid Pan No - ' + panId, ' Please Enter Correct Pan No ,\n * PAN Card Number Length 10 Character \n * First Five Character from A to Z \n * Four Numeric 0 to 9 \n * Last One Character from A to Z');
                            current_record.setValue({
                                fieldId: 'custentitytss_pan',
                                value: null,
                                //ignoreFieldChange: false,
                                //forceSyncSourcing: false
                            });
                            throw { "name": "TaxPro_GSTIN_Validation_Error", "message": 'This is Invalid Pan No - ' + panId + ', Please Enter Correct Pan No ,\n * PAN Card Number Length 10 Character \n * First Five Character from A to Z \n * Four Numeric 0 to 9 \n * Last One Character from A to Z' }
                        }
                    }


                    // GSTIN Validations
                    // var GSTIN = current_record.getValue({ fieldId: "custentity_tss_gstn_uid" });
                    log.debug("GSTIN/UID in beforeSubmit", GSTIN);
                    var isValid_GSTIN = 0;
                    // var b_Check = new RegExp("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$");
                    var b_Check = new RegExp("^[0-9]{2}([A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]|[0-9]{2}[A-Z]{3}[0-9]{5}UN[0-9A-Z])$"); // This is used for both GSTIN and UIN Validation
                    var isAttemptingUIN = false
                    var isAttemptingGSTIN = false
                    if (_logValidation(GSTIN)) {
                        isAttemptingUIN = GSTIN.toUpperCase().substring(12, 14) === 'UN';
                        isAttemptingGSTIN = !isAttemptingUIN;
                        // var is_NRI = current_record.getValue({ fieldId: "custentity_tss_is_nri" });
                        log.debug('is_NRI', is_NRI)
                        if (is_NRI = 'T' || is_NRI == true || is_NRI == 'true') {
                            log.debug("Is GSTIN/UID valid in beforeSubmit", b_Check.test(GSTIN));
                            if (!b_Check.test(GSTIN)) {
                                isValid_GSTIN = 1;
                                // log.error('Please enter The valid GSTIN No - ' + GSTIN, ' * GSTIN Number Length 15 Character \n * First Two Numeric 0 to 9 \n * Five Character from A to Z \n * Four Numeric 0 to 9 \n * One Character from A to Z \n *One Alpha Numeric A to Z or 0 to 9 \n * One Character Z \n * One Alpha Numeric A to Z or 0 to 9');
                                var errMessage = ''
                                if (isAttemptingUIN) {
                                    errMessage = 'Please enter a valid UIN Number-' + GSTIN + '.\n\n' +
                                        '--- UIN Format (15 Characters) ---\n' +
                                        ' * First 2 digits     : State Code (0-9)\n' +
                                        ' * Next 2 digits      : Year of Issue (0-9)\n' +
                                        ' * Next 3 characters  : Organisation Code (A to Z)\n' +
                                        ' * Next 5 digits      : Serial Number (0 to 9)\n' +
                                        ' * Next 2 characters  : Always UN\n' +
                                        ' * Last 1 character   : A to Z or 0 to 9\n'
                                        ;
                                } else {
                                    errMessage = 'Please enter a valid GSTIN Number-' + GSTIN + '.\n\n' +
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
                                // throw { "name": "TaxPro_GSTIN_Validation_Error", "message": 'Please enter The valid GSTIN No - ' + GSTIN + ', * GSTIN Number Length 15 Character \n * First Two Numeric 0 to 9 \n * Five Character from A to Z \n * Four Numeric 0 to 9 \n * One Character from A to Z \n *One Alpha Numeric A to Z or 0 to 9 \n * One Character Z \n * One Alpha Numeric A to Z or 0 to 9' }
                                throw { "name": "TaxPro_GSTIN_Validation_Error", "message": errMessage }
                            }
                        }
                        // var PAN = current_record.getValue({ fieldId: "custentitytss_pan" });
                        log.debug("PAN", PAN)
                        if (_logValidation(PAN) && isAttemptingGSTIN) {
                            var i_Pan_subString = GSTIN.substring(2, 12);
                            if (i_Pan_subString != PAN) {
                                log.error('please check PAN is not matched with GSTIN. Enter correct GSTIN');
                                isValid_GSTIN = 1;
                                throw { "name": "TaxPro_GSTIN_Validation_Error", "message": 'please check PAN is not matched with GSTIN. Enter correct GSTIN' }
                            }
                        }
                        var filters = new Array();
                        var columns = new Array();
                        filters.push(search.createFilter({
                            name: 'custentity_tss_gstn_uid',
                            operator: 'is',
                            values: GSTIN
                        }));
                        var rec_id = current_record.id;
                        log.debug("rec_id", rec_id)
                        if (_logValidation(rec_id)) {
                            filters.push(search.createFilter({
                                name: 'internalid',
                                operator: 'noneOf',
                                values: rec_id
                            }));
                        }
                        columns.push(search.createColumn({ name: 'internalid' }));
                        var vendor_search = search.create({
                            type: 'vendor',
                            filters: filters,
                            columns: columns
                        });
                        var vendor_search_results = vendor_search.run().getRange(0, 100);
                        log.debug("vendor_search_results in beforeSubmit", vendor_search_results);
                        //var res_vendor = vendor_search_results[0].getValue({name: 'internalid'});

                        if (_logValidation(vendor_search_results[0])) {
                            isValid_GSTIN = 1;
                            log.error('Vendor already exists with this GSTIN Number : ', GSTIN);
                            throw { "name": "TaxPro_GSTIN_Validation_Error", "message": 'Vendor already exists with this GSTIN Number : ' + GSTIN }
                        }
                        log.debug("isValid_GSTIN", isValid_GSTIN)
                        if (isValid_GSTIN == 1) {
                            log.debug("entered");
                            current_record.setValue({
                                fieldId: 'custentity_tss_gstn_uid',
                                value: null,
                            });
                        }
                    }



                    // Defaulting the State Name and GSTIN in address subrecord
                    const addressCount = current_record.getLineCount({ sublistId: 'addressbook' });
                    log.debug("addressCount", addressCount)
                    if (addressCount > 0) {
                        for (var i = 0; i < addressCount; i++) {
                            var isDefaultShipping = current_record.getSublistValue({
                                sublistId: 'addressbook',
                                fieldId: 'defaultshipping',
                                line: i
                            });
                            var isDefaultBilling = current_record.getSublistValue({
                                sublistId: 'addressbook',
                                fieldId: 'defaultbilling',
                                line: i
                            });
                            log.debug("isDefaultShipping - isDefaultBilling", isDefaultShipping + '-' + isDefaultBilling)
                            if (isTrue(isDefaultShipping) || isTrue(isDefaultBilling)) {
                                const addressSubrecord = current_record.getSublistSubrecord({
                                    sublistId: 'addressbook',
                                    fieldId: 'addressbookaddress',
                                    line: i
                                });

                                if (addressSubrecord) {
                                    var addr_Country = addressSubrecord.getValue({ fieldId: 'country' });
                                    log.debug("addr_Country", addr_Country)
                                    if (addr_Country == 'IN') {



                                        const state = addressSubrecord.getValue({ fieldId: 'state' });
                                        log.debug("state", state)
                                        if (state) {
                                            var GSTstate;

                                            // Setting the GST State Field value
                                            var addrState = addressSubrecord.getValue({ fieldId: 'custrecord_tss_its_gststate' });
                                            // if (!addrState) {
                                            var stateFilters = []
                                            stateFilters.push(['isinactive', 'is', 'F'])

                                            stateFilters.push('AND')
                                            stateFilters.push(['custrecord_tss_state_name.shortname', 'is', state])

                                            var stateSearch = search.create({
                                                type: 'customrecord_tss_gst_state_master',
                                                filters: stateFilters,
                                                columns: ['internalid', 'custrecord_tss_tin']
                                            });
                                            var stateSearch_result = stateSearch.run().getRange(0, 100);
                                            if (_logValidation(stateSearch_result)) {
                                                GSTstate = stateSearch_result[0].getValue({ name: 'internalid' });
                                                addressSubrecord.setValue({
                                                    fieldId: 'custrecord_tss_its_gststate',
                                                    value: GSTstate
                                                });
                                                addressSubrecord.setValue({
                                                    fieldId: 'custrecord_tss_its_gststatecode',
                                                    value: stateSearch_result[0].getValue({ name: 'custrecord_tss_tin' })
                                                });
                                            }
                                            // }

                                            // Setting the GSTIN
                                            if (GSTIN && GSTstate) {
                                                var addrGSTIN = addressSubrecord.getValue({ fieldId: 'custrecord_tss_its_address_gstin' });
                                                log.debug("addrGSTIN", addrGSTIN)
                                                if (!addrGSTIN) {
                                                    addressSubrecord.setValue({
                                                        fieldId: 'custrecord_tss_its_address_gstin',
                                                        value: GSTIN
                                                    });
                                                }
                                                var addrGSTIN1 = addressSubrecord.getValue({ fieldId: 'custrecord_tss_its_address_gstin' });
                                                log.debug("addrGSTIN1", addrGSTIN1)
                                                if (addrGSTIN1) {
                                                    // var b_Check = new RegExp("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$");
                                                    var b_Check = new RegExp("^[0-9]{2}([A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]|[0-9]{2}[A-Z]{3}[0-9]{5}UN[0-9A-Z])$"); // This is used for both GSTIN and UIN Validation
                                                    var isAttemptingUIN = false
                                                    var isAttemptingGSTIN = false
                                                    if (!b_Check.test(addrGSTIN1)) {
                                                        // log.error('Please enter The valid GSTIN No - ' + addrGSTIN1, ' * GSTIN Number Length 15 Character \n * First Two Numeric 0 to 9 \n * Five Character from A to Z \n * Four Numeric 0 to 9 \n * One Character from A to Z \n *One Alpha Numeric A to Z or 0 to 9 \n * One Character Z \n * One Alpha Numeric A to Z or 0 to 9');
                                                        var errMessage = ''
                                                        if (isAttemptingUIN) {
                                                            errMessage = 'Please enter a valid UIN Number-' + addrGSTIN1 + '.\n\n' +
                                                                '--- UIN Format (15 Characters) ---\n' +
                                                                ' * First 2 digits     : State Code (0-9)\n' +
                                                                ' * Next 2 digits      : Year of Issue (0-9)\n' +
                                                                ' * Next 3 characters  : Organisation Code (A to Z)\n' +
                                                                ' * Next 5 digits      : Serial Number (0 to 9)\n' +
                                                                ' * Next 2 characters  : Always UN\n' +
                                                                ' * Last 1 character   : A to Z or 0 to 9\n'
                                                                ;
                                                        } else {
                                                            errMessage = 'Please enter a valid GSTIN Number-' + addrGSTIN1 + '.\n\n' +
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
                                                        // throw { "name": "TaxPro_GSTIN_Validation_Error", "message": 'Please enter The valid GSTIN No - ' + addrGSTIN1 + ', * GSTIN Number Length 15 Character \n * First Two Numeric 0 to 9 \n * Five Character from A to Z \n * Four Numeric 0 to 9 \n * One Character from A to Z \n *One Alpha Numeric A to Z or 0 to 9 \n * One Character Z \n * One Alpha Numeric A to Z or 0 to 9' }
                                                        throw { "name": "TaxPro_GSTIN_Validation_Error", "message": errMessage }
                                                    }
                                                    var ad_StateCode = addressSubrecord.getValue({ fieldId: 'custrecord_tss_its_gststatecode' });
                                                    log.debug("GSTstate - ad_StateCode", GSTstate + ' - ' + ad_StateCode)
                                                    if (_logValidation(ad_StateCode) && ad_StateCode != addrGSTIN1.substring(0, 2)) {
                                                        log.error('Please check your GSTIN/UID', 'as first 2 numbers from GSTIN/UID: ' + addrGSTIN1.substring(0, 2) + ' does not match State Code: ' + ad_StateCode)
                                                        // log.error("Invalid GSTIN in Address line 1")
                                                        addressSubrecord.setValue({
                                                            fieldId: 'custrecord_tss_its_address_gstin',
                                                            value: ''
                                                        });
                                                        throw { "name": "TaxPro_GSTIN_Validation_Error", "message": 'Please check your GSTIN/UID as first 2 numbers from GSTIN/UID: ' + addrGSTIN1.substring(0, 2) + ' does not match State Code: ' + ad_StateCode }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }



                }
                // }
            } catch (error) {
                log.error("Error in beforeSubmit", error)
                if (error.name = "TaxPro_GSTIN_Validation_Error") {
                    throw error
                }
            }

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


        function isTrue(value) {
            if (value == 'T' || value == true || value == 'true') {
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
                name: 'custrecord_tss_gp_lut_gstrefund',
            }));
            a_column.push(search.createColumn({
                name: 'custrecord_tss_gp_lut_igst_payable',
            }));
            a_column.push(search.createColumn({
                name: 'custrecord_tss_gp_subsidiary',
            }));
            var global_param_search = search.create({
                type: 'customrecord_tss_global_parameter',
                filters: a_filters,
                columns: a_column
            });
            var global_param_search_result = global_param_search.run().getRange(0, 100);
            if (_logValidation(global_param_search_result)) {
                global_sub = global_param_search_result[0].getValue({ name: 'internalid' });
                g_subisidiary = global_param_search_result[0].getValue({ name: 'custrecord_tss_gp_subsidiary' });
            }
            return global_sub;
        } // end function SearchGlobalParameter()


        return {
            // beforeLoad, 
            beforeSubmit,
            // afterSubmit
        }
        function getValueSafe(fieldId, newRec, oldRec) {
            var newRecFields = newRec.getFields();

            if (newRecFields.indexOf(fieldId) !== -1) {
                return newRec.getValue(fieldId);
            }

            return oldRec.getValue(fieldId);
        }



    });
