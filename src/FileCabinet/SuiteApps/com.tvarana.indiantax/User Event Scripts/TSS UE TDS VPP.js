/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

/**
 * Script Name               : TSS UE TDS VPP
 * Script Author             : MNR Krishna
 * Script Type               : User Event Script
 * Script Version            : 2.1
 * Script Created date       : 28/08/2025
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  
/** 
 * * Version      Name              Date          Notes
 * 1.0         MNR Krishna       28/08/2025      Initial version 
 * 
 */

define(['N/search', 'N/runtime', 'N/record', 'N/currentRecord', 'N/format', 'N/cache'],
    /**
 * @param{search} search
 */
    (search, runtime, record, currentRecord, format, cache) => {

        var g_subisidiary;


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
                SearchGlobalParameter();
                var current_record = scriptContext.newRecord;
                var Subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                var Flag = inArray(Subsidiary, g_subisidiary);
                log.debug("Flag in beforeSubmit", Flag)
                if (Flag == 1) {
                    if (current_record.type == 'vendorprepaymentapplication') {
                        log.debug("scriptContext.type in beforeSubmit", scriptContext.type)
                        //In delete case, Updating the bills vppa applied field
                        if (scriptContext.type == 'delete') {
                            var TdsType = current_record.getValue({ fieldId: "custbody_tss_tds_relation" });
                            var old_record = scriptContext.oldRecord;
                            log.debug("old_record in beforeSubmit", old_record)
                            if (old_record && TdsType) {
                                var BaseAmtObj = JSON.parse(old_record.getValue({ fieldId: "custbody_tss_it_appliedamt_withouttax" }) || '{}');
                                log.debug("BaseAmtObj in beforeSubmit", BaseAmtObj)
                                if (parseFloat(BaseAmtObj['tdsamt'] || 0) > 0) {
                                    if (BaseAmtObj.tdsbills) {
                                        for (let billID in BaseAmtObj.tdsbills) {
                                            var billIDamt = parseFloat(BaseAmtObj['tdsbills'][billID] || 0)
                                            log.debug("billIDamt in afterSubmit", billIDamt)
                                            var billIDObj = search.lookupFields({
                                                type: 'vendorbill',
                                                id: billID,
                                                columns: ['custbody_tss_it_vpp_appld_tds']
                                            });
                                            billIDObj = JSON.parse(billIDObj.custbody_tss_it_vpp_appld_tds || '{}')
                                            billIDObj[TdsType] = billIDObj[TdsType] ? billIDObj[TdsType] : { 'tdsvppa': {} }
                                            log.debug("billIDObj unapplied in beforeSubmit", billIDObj)
                                            var billIDObjamt = parseFloat(billIDObj[TdsType]['tdsvppa'] ? billIDObj[TdsType]['tdsvppa'][current_record.id] || 0 : 0)
                                            log.debug("billIDObjamt unapplied in beforeSubmit", billIDObjamt);
                                            if (billIDObjamt > 0 && billIDObjamt == billIDamt) {
                                                var billappliedtds = parseFloat(billIDObj[TdsType]['tdsbaseamount'] || 0)
                                                log.debug("billappliedtds delete in beforeSubmit", billappliedtds)
                                                billIDObj[TdsType]['tdsbaseamount'] = (billappliedtds > 0) ? (billappliedtds - billIDamt) : 0
                                                // billIDObj[TdsType]['tdsvppa'][current_record.id] = 0
                                                if (billIDObj[TdsType]['tdsvppa'].hasOwnProperty(current_record.id)) {
                                                    delete billIDObj[TdsType]['tdsvppa'][current_record.id];
                                                }
                                                try {
                                                    var updatedId = record.submitFields({
                                                        type: 'vendorbill',
                                                        id: billID,
                                                        values: { 'custbody_tss_it_vpp_appld_tds': JSON.stringify(billIDObj) }
                                                    });
                                                    log.debug("updatedId delete in beforeSubmit", updatedId)
                                                }
                                                catch (e) {
                                                    log.error("Error in updating the bill record", e)
                                                    throw { "name": "BILL_UPDATE_FAIL", "message": "Fialed to update the bill on deleting the prepayment Application to unapply the tds amount in bill Internal Id - " + billID + ". Please reach out to administrator.", "details": e }
                                                }

                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                log.error("Error in beforeSubmit", error)
                if (error.name == "BILL_UPDATE_FAIL") {
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
            try {
                SearchGlobalParameter();
                var current_record = scriptContext.newRecord;
                current_record = record.load({
                    type: current_record.type,
                    id: current_record.id
                })
                var Subsidiary = current_record.getValue({ fieldId: "subsidiary" });
                var Flag = inArray(Subsidiary, g_subisidiary);
                log.debug("Flag in afterSubmit", Flag)
                if (Flag == 1) {
                    if (scriptContext.type != 'delete') {
                        var TdsType = current_record.getValue({ fieldId: "custbody_tss_tds_relation" });
                        log.debug("TdsType in afterSubmit", TdsType)
                        if (_logValidation(TdsType)) {
                            if (current_record.type == 'vendorprepaymentapplication') {
                                var BaseAmtObj = JSON.parse(current_record.getValue({ fieldId: "custbody_tss_it_appliedamt_withouttax" }) || '{}');
                                log.debug("BaseAmtObj in afterSubmit", BaseAmtObj)

                                //Updating the bills which have unapplied in edit
                                var old_record = scriptContext.oldRecord;
                                log.debug("oldObj in aftersubmit", old_record)
                                var unappliedBills = {};
                                if (old_record) {
                                    var oldObj = JSON.parse(old_record.getValue({ fieldId: "custbody_tss_it_appliedamt_withouttax" }) || '{}');
                                    log.debug("BaseAmtObjOld in aftersubmit", oldObj)
                                    if (parseFloat(oldObj['tdsamt'] || 0) > 0) {
                                        if (oldObj.tdsbills) {
                                            for (let billId in oldObj.tdsbills) {
                                                log.debug("!BaseAmtObj.tdsbills in aftersubmit", !BaseAmtObj.tdsbills)
                                                log.debug("!BaseAmtObj.tdsbills.hasOwnProperty(billId) in aftersubmit", !BaseAmtObj.tdsbills.hasOwnProperty(billId))
                                                if (!BaseAmtObj.tdsbills || !BaseAmtObj.tdsbills.hasOwnProperty(billId)) {
                                                    unappliedBills[billId] = oldObj.tdsbills[billId];
                                                }
                                            }
                                        }
                                    }
                                }
                                log.debug("unappliedBills in aftersubmit", unappliedBills)
                                for (var billID in unappliedBills) {
                                    log.debug("billID unapplied in afterSubmit", billID)
                                    if (unappliedBills.hasOwnProperty(billID)) {
                                        var billIDamt = parseFloat(unappliedBills[billID] || 0)
                                        log.debug("billIDamt unapplied in afterSubmit", billIDamt)
                                        var billIDObj = search.lookupFields({
                                            type: 'vendorbill',
                                            id: billID,
                                            columns: ['custbody_tss_it_vpp_appld_tds']
                                        });
                                        billIDObj = JSON.parse(billIDObj.custbody_tss_it_vpp_appld_tds || '{}')
                                        billIDObj[TdsType] = billIDObj[TdsType] ? billIDObj[TdsType] : { 'tdsvppa': {} }
                                        log.debug("billIDObj unapplied in afterSubmit", billIDObj)
                                        var billIDObjamt = parseFloat(billIDObj[TdsType]['tdsvppa'] ? billIDObj[TdsType]['tdsvppa'][current_record.id] || 0 : 0)
                                        log.debug("billIDObjamt unapplied in afterSubmit", billIDObjamt);
                                        if (billIDObjamt > 0 && billIDObjamt == billIDamt) {
                                            var billappliedtds = parseFloat(billIDObj[TdsType]['tdsbaseamount'] || 0)
                                            log.debug("billappliedtds unapplied in afterSubmit", billappliedtds)
                                            billIDObj[TdsType]['tdsbaseamount'] = (billappliedtds > 0) ? (billappliedtds - billIDamt) : 0
                                            // billIDObj[TdsType]['tdsvppa'][current_record.id] = 0
                                            if (billIDObj[TdsType]['tdsvppa'].hasOwnProperty(current_record.id)) {
                                                delete billIDObj[TdsType]['tdsvppa'][current_record.id];
                                            }
                                            var updatedId = record.submitFields({
                                                type: 'vendorbill',
                                                id: billID,
                                                values: { 'custbody_tss_it_vpp_appld_tds': JSON.stringify(billIDObj) }
                                            });
                                            log.debug("updatedId unapplied in afterSubmit", updatedId)
                                        }

                                    }
                                }

                                // Updating the Applied TDS Amounts in bills
                                if (parseFloat(BaseAmtObj['tdsamt'] || 0) > 0) {
                                    log.debug("BaseAmtObj['tdsamt'] in afterSubmit", BaseAmtObj['tdsamt'])
                                    for (var billID in BaseAmtObj['tdsbills']) {
                                        log.debug("billID in afterSubmit", billID)
                                        if (BaseAmtObj['tdsbills'].hasOwnProperty(billID)) {
                                            var billIDamt = parseFloat(BaseAmtObj['tdsbills'][billID] || 0)
                                            log.debug("billIDamt in afterSubmit", billIDamt)
                                            var billIDObj = search.lookupFields({
                                                type: 'vendorbill',
                                                id: billID,
                                                columns: ['custbody_tss_it_vpp_appld_tds']
                                            });
                                            billIDObj = JSON.parse(billIDObj.custbody_tss_it_vpp_appld_tds || '{}')
                                            billIDObj[TdsType] = billIDObj[TdsType] ? billIDObj[TdsType] : { 'tdsvppa': {} }
                                            log.debug("billIDObj in afterSubmit", billIDObj)
                                            var billIDObjamt = parseFloat(billIDObj[TdsType]['tdsvppa'] ? billIDObj[TdsType]['tdsvppa'][current_record.id] || 0 : 0)
                                            log.debug("billIDObjamt in afterSubmit", billIDObjamt)
                                            if (billIDObjamt != billIDamt && billIDamt != 0) {
                                                var billappliedtds = parseFloat(billIDObj[TdsType]['tdsbaseamount'] || 0)
                                                log.debug("billappliedtds in afterSubmit", billappliedtds)
                                                billIDObj[TdsType]['tdsbaseamount'] = (billappliedtds > 0) ? (billappliedtds - billIDObjamt + billIDamt) : billIDamt
                                                billIDObj[TdsType]['tdsvppa'][current_record.id] = billIDamt
                                                var updatedId = record.submitFields({
                                                    type: 'vendorbill',
                                                    id: billID,
                                                    values: { 'custbody_tss_it_vpp_appld_tds': JSON.stringify(billIDObj) }
                                                });
                                                log.debug("updatedId in afterSubmit", updatedId)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                log.error("Error in afterSubmit", error)
            }
        }

        //Custom Functions
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
        }

        function _logValidation(value) {
            if (value != 'null' && value != null && value != null && value != '' && value != undefined && value != undefined && value != 'undefined' && value != 'undefined' && value != 'NaN' && value != NaN) {
                return true;
            }
            else {
                return false;
            }
        }

        return {
            // beforeLoad, 
            beforeSubmit,
            afterSubmit
        }

    });
