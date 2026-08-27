/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
/**
 * Script Name               : CLI TSS Vendor Validations
 * Script Author             : MNR Krishna
 * Script Type               : Client Script
 * Script Version            : 2.0
 * Script Created date       : 13/06/2023
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  
 */

define(['N/search', 'N/currentRecord', 'N/record'],
    /**
     * @param{search} search
     */
    function (search, currentRecord, record) {


        //  Initializing  Global Variables, in particular, debugging variables...
        //var operationType;
        var global_subisidiary = new Array;
        //var i_vatCode;
        //var i_taxcode;
        //var s_pass_code;
        var ad_GST_Liable = 'F';
        var b_Liable_Check = 0;
        var ad_GST_Number;
        var isExpired = true;

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
                var current_record = scriptContext.currentRecord;
                var rec_subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                global_subisidiary = SearchGlobalParameter().split(',');
                if (isExpired) {
                    return true
                }
                //log.debug("Global Subsidiaries in pageInit",global_subisidiary);

                var Flag = 0;
                // Flag = inArray(rec_subsidiary,global_subisidiary);
                if (scriptContext.mode == 'create') {
                    current_record.getField("custentity_tss_is_nri").isDisabled = true;
                }

            }
            catch (e) {
                log.error("Error in pageInit", e);
            }

        }

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
                if (isExpired) {
                    return true
                }
                //Started the GST Puropse validations
                if (scriptContext.fieldId == 'custentity_tss_type_of_vendor') {
                    var current_record = scriptContext.currentRecord;
                    var panId = current_record.getValue({ fieldId: "custentitytss_pan" });
                    var typeVendor = current_record.getValue({ fieldId: "custentity_tss_type_of_vendor" });
                    if (typeVendor == 1) {
                        if (!_logValidation(panId)) {
                            alert("Please Enter PAN")
                        }
                        current_record.getField("custentity_tss_is_nri").isDisabled = false;
                    }
                    else {
                        current_record.getField("custentity_tss_is_nri").isDisabled = true;
                    }

                }

                if (scriptContext.fieldId == 'custentitytss_pan') {
                    var current_record = scriptContext.currentRecord;
                    var panId = current_record.getValue({ fieldId: "custentitytss_pan" });
                    if (_logValidation(panId)) {
                        var panPat = /^([A-Z]{5})(\d{4})([A-Z]{1})$/;
                        if (panId.search(panPat) == -1) {
                            alert('This is Invalid Pan No. Please Enter Correct Pan No ,\n * PAN Card Number Length 10 Character \n * First Five Character from A to Z \n * Four Numeric 0 to 9 \n * Last One Character from A to Z');
                            current_record.setValue({
                                fieldId: 'custentitytss_pan',
                                value: null,
                                //ignoreFieldChange: false,
                                //forceSyncSourcing: false
                            });
                        }
                    }
                }

                // The following code to be checked setting values into sublist.

                //Started the TDS related validations
                if (scriptContext.fieldId == 'custrecord_tss_tds_apply' || scriptContext.fieldId == 'custrecord_tss_vedtdstype') {
                    var current_record = scriptContext.currentRecord;
                    var rec_subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                    var Flag = 0;
                    Flag = inArray(rec_subsidiary, global_subisidiary);
                    if (Flag == 1) {
                        var sublistObj = current_record.getSublist({ sublistId: scriptContext.sublistId });
                        //log.debug("sublist in fieldChanged",sublistObj)
                        // var tdsapply = current_record.getCurrentSublistValue({
                        //     sublistId: scriptContext.sublistId,
                        //     fieldId: "custrecord_tss_tds_apply"
                        // });
                        // log.debug("tdsapply in fieldChanged", tdsapply);
                        // if (scriptContext.fieldId == 'custrecord_tss_tds_apply') {

                        //     if (tdsapply == 'T' || tdsapply == true || tdsapply == 'true') {
                        //         sublistObj.getColumn({
                        //             fieldId: 'custrecord_tss_vedtdstype',
                        //         }).isDisabled = true;
                        //     }
                        //     else {


                        //         sublistObj.getColumn({
                        //             fieldId: 'custrecord_tss_vedtdstype',
                        //         }).isDisabled = false;

                        //         current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_vedtdstype", value: '', ignoreFieldChange: true });
                        //         current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_vedassesseecode", value: '' });
                        //         current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_section", value: '' });
                        //         current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_paymentcode", value: '' });
                        //         current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_threshold", value: '' });
                        //         current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_vedsurchargethreshold", value: '' });
                        //         current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_vedtdsaccount", value: '' });
                        //         current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_vednetper", value: '' });
                        //         current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_vedempty_pan_tdsper", value: '' });
                        //         current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "name", value: '' });
                        //     }
                        // }

                        if (scriptContext.fieldId == 'custrecord_tss_vedtdstype') {
                            var tdstype = current_record.getCurrentSublistValue({
                                sublistId: scriptContext.sublistId,
                                fieldId: "custrecord_tss_vedtdstype"
                            });
                            log.debug("tdstype in fieldChanged", tdstype);
                            var filters = new Array();
                            var columns = new Array();
                            if (_logValidation(tdstype)) {

                                filters.push(search.createFilter({
                                    name: 'internalid',
                                    operator: 'is',
                                    values: tdstype
                                }));

                                columns.push(search.createColumn({ name: 'name' }));
                                columns.push(search.createColumn({ name: 'custrecord_tss_its_assessee_code' }));
                                columns.push(search.createColumn({ name: 'custrecord_tss_its_section' }));
                                columns.push(search.createColumn({ name: 'custrecord_tss_its_paymentcode' }));
                                columns.push(search.createColumn({ name: 'custrecord_tss_its_tds_threshold' }));
                                columns.push(search.createColumn({ name: 'custrecord_tss_its_cummulativethreshold' }));
                                columns.push(search.createColumn({ name: 'custrecord_tss_its_tdsitem' }));
                                columns.push(search.createColumn({ name: 'custrecord_tss_its_tdsaccount' }));
                                columns.push(search.createColumn({ name: 'custrecord_tss_its_netperc' }));
                                columns.push(search.createColumn({ name: 'custrecord_tss_its_panempty_per' }));


                                var tdsMaster_search = search.create({
                                    type: 'customrecord_tss_its_tdsmaster',
                                    filters: filters,
                                    columns: columns
                                });
                                var tdsMaster_search_res = tdsMaster_search.run().getRange(0, 100);

                                if (tdsMaster_search_res.length > 0) {
                                    var tds_name = tdsMaster_search_res[0].getValue({ name: 'name' });
                                    log.debug("tds_name from search in fieldChanged", tds_name);
                                    var tds_assess = tdsMaster_search_res[0].getValue({ name: 'custrecord_tss_its_assessee_code' });
                                    var tds_section = tdsMaster_search_res[0].getValue({ name: 'custrecord_tss_its_section' });
                                    var tds_pCode = tdsMaster_search_res[0].getValue({ name: 'custrecord_tss_its_paymentcode' });
                                    var tds_thresh = tdsMaster_search_res[0].getValue({ name: 'custrecord_tss_its_tds_threshold' });
                                    var tds_cumulat = tdsMaster_search_res[0].getValue({ name: 'custrecord_tss_its_cummulativethreshold' });
                                    var tds_item = tdsMaster_search_res[0].getValue({ name: 'custrecord_tss_its_tdsitem' });
                                    var tds_act = tdsMaster_search_res[0].getValue({ name: 'custrecord_tss_its_tdsaccount' });
                                    var tds_net = tdsMaster_search_res[0].getValue({ name: 'custrecord_tss_its_netperc' });
                                    var tds_panEmpty = tdsMaster_search_res[0].getValue({ name: 'custrecord_tss_its_panempty_per' });


                                    //Setting the search results into current line fields in TDS Relation sublist
                                    current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "name", value: tds_name });
                                    current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_vedassesseecode", value: tds_assess });
                                    current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_section", value: tds_section });
                                    current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_paymentcode", value: tds_pCode });
                                    current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_threshold", value: tds_thresh });
                                    current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_vedsurchargethreshold", value: tds_cumulat });
                                    current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_vedtdsitem", value: tds_item });
                                    current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_vedtdsaccount", value: tds_act });
                                    current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_vednetper", value: parseInt(tds_net) });
                                    current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_vedempty_pan_tdsper", value: parseInt(tds_panEmpty) });




                                } //end if(tdsMaster_search_res.length > 0)

                            } //end if(_logValidation(tdstype))
                            else {

                                current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_vedassesseecode", value: '' });
                                current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_section", value: '' });
                                current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_paymentcode", value: '' });
                                current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_threshold", value: '' });
                                current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_vedsurchargethreshold", value: '' });
                                current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_vedtdsitem", value: '' });
                                current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_vedtdsaccount", value: '' });
                                current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_vednetper", value: '' });
                                current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "custrecord_tss_tds_vedempty_pan_tdsper", value: '' });
                                current_record.setCurrentSublistValue({ sublistId: scriptContext.sublistId, fieldId: "name", value: '' });
                            }
                        }//end if (scriptContext.fieldId == 'custrecord_tss_vedtdstype')


                    } // end if (Flag == 1)
                }




            }
            catch (e) {
                log.error("Error in fieldChanged..", e);
            }

        }

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

        }

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
                // if (scriptContext.sublistId == "recmachcustrecord_tss_tds_vendorname") {
                //     var current_record = scriptContext.currentRecord;
                //     var rec_subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                //     var Flag = 0;
                //     Flag = inArray(rec_subsidiary, global_subisidiary);
                //     if (Flag == 1) {
                //         var sublistObj = current_record.getSublist({ sublistId: scriptContext.sublistId });
                //         //log.debug("sublist in fieldChanged",sublistObj)
                //         var tdsapply = current_record.getCurrentSublistValue({
                //             sublistId: scriptContext.sublistId,
                //             fieldId: "custrecord_tss_tds_apply"
                //         });
                //         log.debug("tdsapply in lineInit", tdsapply);
                //         if (tdsapply == 'T' || tdsapply == true || tdsapply == 'true') {
                //             sublistObj.getColumn({
                //                 fieldId: 'custrecord_tss_vedtdstype',
                //             }).isDisabled = true;
                //         }
                //         else {
                //             sublistObj.getColumn({
                //                 fieldId: 'custrecord_tss_vedtdstype',
                //             }).isDisabled = false;
                //         }
                //     } //end if (Flag == 1)

                // }

            }
            catch (e) {
                log.error("Error in lineInit", e);
            }

        }

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
            try {
                if (isExpired) {
                    return true
                }
                if (scriptContext.fieldId == 'custentity_tss_gstn_uid') {
                    var isValid_GSTIN = 0;
                    var current_record = scriptContext.currentRecord;
                    var GSTIN = current_record.getValue({ fieldId: "custentity_tss_gstn_uid" });
                    log.debug("GSTIN/UID in validateField", GSTIN);
                    // var b_Check = new RegExp("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$"); // This is only for GSTIN validation
                    var b_Check = new RegExp("^[0-9]{2}([A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]|[0-9]{2}[A-Z]{3}[0-9]{5}UN[0-9A-Z])$"); // This is used for both GSTIN and UIN Validation
                    var gstinCheck = new RegExp("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$");
                    var uinCheck = new RegExp("^[0-9]{2}[0-9]{2}[A-Z]{3}[0-9]{5}UN[0-9A-Z]$");
                    var isAttemptingUIN = false
                    var isAttemptingGSTIN = false
                    if (_logValidation(GSTIN)) {
                        isAttemptingUIN = GSTIN.toUpperCase().substring(12, 14) === 'UN'; // UN at position 13-14
                        isAttemptingGSTIN = !isAttemptingUIN;
                        var is_NRI = current_record.getValue({ fieldId: "custentity_tss_is_nri" });
                        if (is_NRI = 'T' || is_NRI == true || is_NRI == 'true') {
                            log.debug("Is GSTIN/UID valid in validateField", b_Check.test(GSTIN));
                            if (!b_Check.test(GSTIN)) {
                                isValid_GSTIN = 1;
                                // alert('Please enter The valid GSTIN No ,\n * GSTIN Number Length 15 Character \n * First Two Numeric 0 to 9 \n * Five Character from A to Z \n * Four Numeric 0 to 9 \n * One Character from A to Z \n *One Alpha Numeric A to Z or 0 to 9 \n * One Character Z \n * One Alpha Numeric A to Z or 0 to 9');
                                // Try to identify which format they attempted
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

                            }
                        }
                        var PAN = current_record.getValue({ fieldId: "custentitytss_pan" });
                        if (_logValidation(PAN) && isAttemptingGSTIN) {
                            var i_Pan_subString = GSTIN.substring(2, 12);
                            if (i_Pan_subString != PAN) {
                                alert('please check PAN is not matched with GSTIN. Enter correct GSTIN');
                                isValid_GSTIN = 1;
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
                        log.debug("vendor_search_results in validateField", vendor_search_results);
                        //var res_vendor = vendor_search_results[0].getValue({name: 'internalid'});

                        if (_logValidation(vendor_search_results[0])) {
                            isValid_GSTIN = 1;
                            alert('Vendor already exists with this GSTIN/UIN Number : ' + GSTIN);
                        }
                    }

                    if (isValid_GSTIN == 1) {
                        current_record.setValue({
                            fieldId: 'custentity_tss_gstn_uid',
                            value: null,
                        });
                    }
                }
                return true;

            }
            catch (e) {
                log.error("Error in validateField...", e);
            }


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
                if (isExpired) {
                    return true
                }
                var current_record = scriptContext.currentRecord;
                var rec_subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                var Flag = 0;
                Flag = inArray(rec_subsidiary, global_subisidiary);
                if (Flag == 1) {
                    var subrecord;
                    if (scriptContext.sublistId == 'addressbook') {
                        var current_record = scriptContext.currentRecord;
                        //var rec_subsidiary = current_record.getValue({fieldId:"subsidiary"});
                        var GST_Liable = current_record.getValue({ fieldId: "custentity_tss_gst_liable" });
                        log.debug("GST_Liable in validateLine", GST_Liable);
                        var isNRIVendorCheck = current_record.getValue({ fieldId: "custentity_tss_is_nri" });
                        log.debug("isNRIVendorCheck in validateLine", isNRIVendorCheck);
                        var lineCount = current_record.getLineCount({
                            sublistId: 'addressbook'
                        });
                        subrecord = current_record.getCurrentSublistSubrecord({
                            sublistId: 'addressbook',
                            fieldId: 'addressbookaddress'
                        });
                        if (isNRIVendorCheck != 'T' && isNRIVendorCheck != true && isNRIVendorCheck != 'true') {
                            if (_logValidation(subrecord)) {
                                ad_GST_Number = subrecord.getValue({ fieldId: 'custrecord_tss_its_address_gstin' });
                                addr_Country = subrecord.getValue({ fieldId: 'country' });
                                log.debug("Country in Validate line", addr_Country);
                                var ad_State = subrecord.getValue({ fieldId: 'custrecord_tss_its_gststate' });
                                // log.debug("ad_State", ad_State)
                                var currIndex = current_record.getCurrentSublistIndex({
                                    sublistId: 'addressbook'
                                });
                                log.debug("currIndex", currIndex)
                                if (isTrue(GST_Liable) && addr_Country == 'IN' && !_logValidation(ad_State) && currIndex != 0) {
                                    alert("Please Enter GST State.")
                                    return false;
                                }
                            }
                            if (_logValidation(ad_GST_Number) && addr_Country == 'IN') {
                                var ad_StateCode = subrecord.getValue({ fieldId: 'custrecord_tss_its_gststatecode' });
                                if (_logValidation(ad_StateCode) && ad_StateCode != ad_GST_Number.substring(0, 2)) {
                                    alert('Please check your GSTIN/UID, as first 2 numbers from GSTIN/UID: ' + ad_GST_Number.substring(0, 2) + ' does not match State Code: ' + ad_StateCode)
                                    return false;
                                }
                                // var b_Check = new RegExp("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$");
                                var b_Check = new RegExp("^[0-9]{2}([A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]|[0-9]{2}[A-Z]{3}[0-9]{5}UN[0-9A-Z])$"); // This is used for both GSTIN and UIN Validation
                                var isAttemptingUIN = GSTIN.toUpperCase().substring(12, 14) === 'UN'; // UN at position 13-14
                                var isAttemptingGSTIN = !isAttemptingUIN;
                                if (!b_Check.test(ad_GST_Number)) {
                                    // alert('Please enter The valid GSTIN No ,\n * GSTIN Number Length 15 Character \n * First Two Numeric 0 to 9 \n * Five Character from A to Z \n * Four Numeric 0 to 9 \n * One Character from A to Z \n *One Alpha Numeric A to Z or 0 to 9 \n * One Character Z \n * One Alpha Numeric A to Z or 0 to 9');
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
                                    return false;
                                }
                                var b_PAN_Id = current_record.getValue({ fieldId: "custentitytss_pan" });
                                var i_Pan_subString = ad_GST_Number.substring(2, 12);
                                if (_logValidation(b_PAN_Id) && i_Pan_subString != b_PAN_Id && isAttemptingGSTIN) {
                                    alert('please check PAN is not matched with GSTIN in current line Address');
                                    return false;
                                }

                            }

                        }// end if(isNRIVendorCheck != 'T')

                    } // end if (scriptContext.sublistId == 'addressbook')


                    if (scriptContext.sublistId == 'recmachcustrecord_tss_tds_vendorname') {
                        var current_record = scriptContext.currentRecord;
                        var rec_subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                        var Flag = 0;
                        Flag = inArray(rec_subsidiary, global_subisidiary);
                        if (Flag == 1) {
                            var assessee_code = current_record.getValue({ fieldId: "isperson" });
                            log.debug("assessee_code in validate Line", assessee_code);
                            if (assessee_code == 'T') {
                                assessee_code = 1
                            }
                            else {
                                assessee_code = 2;
                            }
                            log.debug("assessee_code(0 or 1) in validate Line", assessee_code);
                            var l_assessee_code = current_record.getCurrentSublistValue({
                                sublistId: scriptContext.sublistId,
                                fieldId: "custrecord_tss_tds_vedassesseecode"
                            });
                            if (_logValidation(l_assessee_code)) {
                                if (_logValidation(assessee_code)) {
                                    if (l_assessee_code != assessee_code) {
                                        alert('The Assesse code of selected TDS type and Type(Company/Individual) on vendor are Different , Please select the TDS type whose Assessee code are same');
                                        return false;
                                    }
                                }
                                else {
                                    alert('Please select the Type(Company/Individual) on Vendor');
                                    return false;
                                }
                            } // end if(_logValidation(l_assessee_code))
                            var l_tds_type = current_record.getCurrentSublistValue({
                                sublistId: scriptContext.sublistId,
                                fieldId: "custrecord_tss_vedtdstype"
                            });
                            var curr_line = current_record.getCurrentSublistIndex({ sublistId: 'recmachcustrecord_tss_tds_vendorname' });
                            var TDSrelationCount = current_record.getLineCount({
                                sublistId: 'recmachcustrecord_tss_tds_vendorname'
                            });
                            for (var i = 0; i < TDSrelationCount; i++) {
                                if (curr_line != i) {
                                    var l_TDStype = current_record.getSublistValue({
                                        sublistId: 'recmachcustrecord_tss_tds_vendorname',
                                        fieldId: "custrecord_tss_vedtdstype",
                                        line: i
                                    });
                                    if (l_TDStype == l_tds_type) {
                                        alert("Tds Type already exists, please change it");
                                        return false;
                                    }
                                }
                            } // end for(var i=0;i<curr_line;i++)
                        }// end if (Flag == 1)

                    }// end if (scriptContext.sublistId == 'recmachcustrecord_tss_tds_vendorname')
                }

                return true;

            }
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
                if (isExpired) {
                    var recSub = scriptContext.currentRecord.getValue({ fieldId: 'subsidiary' });
                    if (inArray(recSub, global_subisidiary) == parseInt(1)) {
                        alert('TaxPro SuiteApp subscription needs renewal. Please contact your administrator.');
                    }
                    return true
                }
                var current_record = scriptContext.currentRecord;
                var rec_subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                var Flag = 0;
                var subrecord;
                var addr_Country;
                Flag = inArray(rec_subsidiary, global_subisidiary);
                if (Flag == 1) {
                    var GST_Liable = current_record.getValue({ fieldId: "custentity_tss_gst_liable" });
                    log.debug("GST_Liable in saveRecord", GST_Liable);
                    var typeVendor = current_record.getValue({ fieldId: 'custentity_tss_type_of_vendor' });
                    log.debug("typeVendor in saveRecord", typeVendor);
                    var panId = current_record.getValue({ fieldId: 'custentitytss_pan' });
                    var isNRIVendorCheck = current_record.getValue({ fieldId: 'custentity_tss_is_nri' });
                    log.debug("isNRIVendorCheck in saveRecord", isNRIVendorCheck);
                    if (typeVendor == 1 && (isNRIVendorCheck == 'F' || isNRIVendorCheck == false)) {
                        if (!_logValidation(panId)) {
                            alert('Please Enter PAN');
                            return false;
                        }
                    }
                    var lineCount = current_record.getLineCount({
                        sublistId: 'addressbook'
                    });
                    for (var i = 0; i < lineCount; i++) {
                        current_record.selectLine({
                            sublistId: 'addressbook',
                            line: i
                        });
                        var hasSubrecord = current_record.hasCurrentSublistSubrecord({
                            sublistId: 'addressbook',
                            fieldId: 'addressbookaddress',
                            line: i
                        });
                        log.debug("hasSubrecord in saveRecord", hasSubrecord);
                        if (hasSubrecord == true || hasSubrecord == 'T') {
                            subrecord = current_record.getCurrentSublistSubrecord({
                                sublistId: 'addressbook',
                                fieldId: 'addressbookaddress',
                                line: i
                            });
                            log.debug("subrecord in saveRecord", subrecord);

                            if (_logValidation(subrecord)) {

                                ad_GST_Number = subrecord.getValue({ fieldId: 'custrecord_tss_its_address_gstin' });
                                addr_Country = subrecord.getValue({ fieldId: 'country' });
                                // if (_logValidation(ad_GST_Number) && addr_Country == 'IN') {
                                //     var i_Pan_subString = ad_GST_Number.substring(2, 12);
                                //     if (_logValidation(panId) && i_Pan_subString != panId) {
                                //         alert('please check PAN is not matched with GSTIN in address line numer - ', i + 1);
                                //         return false;
                                //     }

                                // }

                                if (GST_Liable == 'T' || GST_Liable == true || GST_Liable == 'true') {
                                    if (addr_Country == 'IN') {
                                        b_Liable_Check = 1;
                                        break;
                                    }
                                    else {
                                        b_Liable_Check = 0;
                                    }
                                }
                            }


                        } //end if(hasSubrecord == true || hasSubrecord == 'T')
                        // current_record.cancelLine({
                        //     sublistId: 'addressbook'
                        // });
                    } //end for (var i = 0; i < lineCount; i++)
                    log.debug("b_Liable_Check is ", b_Liable_Check)
                    if ((GST_Liable == 'T' || GST_Liable == true) && b_Liable_Check == 0) {
                        alert("Atleast One Address should be select as India");
                        return false;
                    }

                }

                return true;

            }
            catch (e) {
                log.error("Error in saveRecord...", e);
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

        function isTrue(value) {
            if (value == 'T' || value == true || value == 'true') {
                return true;
            }
            else {
                return false;
            }
        }

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
                name: 'custrecord_tss_gp_subscription_end',
            }));
            var global_param_search = search.create({
                type: 'customrecord_tss_global_parameter',
                filters: a_filters,
                columns: a_column
            });
            var global_param_search_result = global_param_search.run().getRange(0, 100);
            if (_logValidation(global_param_search_result)) {
                global_sub = global_param_search_result[0].getValue({ name: 'custrecord_tss_gp_subsidiary' });
                isExpired = global_param_search_result[0].getValue({ name: 'custrecord_tss_gp_subscription_end' });
            }
            return global_sub;

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

        }





        return {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            //    postSourcing: postSourcing,
            //    sublistChanged: sublistChanged,
            // lineInit: lineInit,
            validateField: validateField,
            validateLine: validateLine,
            //    validateInsert: validateInsert,
            //    validateDelete: validateDelete,
            saveRecord: saveRecord
        };

    });
