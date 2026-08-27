/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */

/**
 * Script Name               : CLI TSS Vendor Exemption Validations
 * Script Author             : MNR Krishna
 * Script Type               : Client Script
 * Script Version            : 2.0
 * Script Created date       : 02/08/2024
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  It will validate the TDS Vendor Exemption record like stops duplicate records with in the same period, scheduled type validations and more.
 */

/** 
 * * Version      Name              Date          Notes
 * 1.0         MNR Krishna       02/08/2024        Initial version 
 * 
 */

define(['N/search'],
    /**
     * @param{search} search
     */
    function (search) {

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
                var schedType = current_record.getValue({ fieldId: 'custrecord_tss_ve_schedule' });
                var amountField = current_record.getField({ fieldId: 'custrecord_tss_ve_amount' });
                if (schedType == 1) {
                    amountField.isDisplay = true;
                    amountField.isMandatory = true;
                }
                else if (schedType == 2) {
                    amountField.isDisplay = false;
                    amountField.isMandatory = false;
                }
                else {
                    amountField.isDisplay = false;
                    amountField.isMandatory = false;
                }

                // Setting Vendor from TDS Relation when user creating Exemption from TDS Relation

                var vend = current_record.getValue({ fieldId: 'custrecordtss_ve_vendorname' });
                if (!_logValidation(vend)) {
                    var tdsRel = current_record.getValue({ fieldId: 'custrecord_tss_ve_tdsrelation' });
                    if (_logValidation(tdsRel)) {
                        var tdsRelObj = search.lookupFields({
                            type: 'customrecord_tss_tdsrelation',
                            id: tdsRel,
                            columns: ['custrecord_tss_tds_vendorname']
                        });
                        var vendorId = tdsRelObj.custrecord_tss_tds_vendorname[0] ? tdsRelObj.custrecord_tss_tds_vendorname[0].value : null;

                        if (vendorId) {
                            current_record.setValue({
                                fieldId: 'custrecordtss_ve_vendorname',
                                value: vendorId
                            });
                        }
                    }
                }

                // // Disabling the fields if Exemption deducted on any transactions
                // var exemptAmt = current_record.getValue({ fieldId: 'custrecord_tss_ve_tax_amt' }) || 0;
                // if (parseFloat(exemptAmt) > 0) {
                //     // var exemptTdsField = current_record.getField({ fieldId: 'custrecord_tss_ve_tax_amt' });
                //     // // log.debug("exemptTdsField", exemptTdsField)
                //     // exemptTdsField.isDisabled = true;
                //     current_record.getField({ fieldId: 'custrecordtss_ve_vendorname' }).isDisabled = true;
                //     current_record.getField({ fieldId: 'custrecord_tss_ve_tdsrelation' }).isDisabled = true;
                //     current_record.getField({ fieldId: 'custrecord_tss_ve_subsidiary' }).isDisabled = true;
                //     current_record.getField({ fieldId: 'custrecord_tss_ve_certificate' }).isDisabled = true;
                //     current_record.getField({ fieldId: 'custrecord_tss_ve_schedule' }).isDisabled = true;
                //     current_record.getField({ fieldId: 'custrecord_tss_ve_from' }).isDisabled = true;
                //     current_record.getField({ fieldId: 'custrecord_tss_ve_to' }).isDisabled = true;
                //     current_record.getField({ fieldId: 'custrecord_tss_ve_amount' }).isDisabled = true;
                //     current_record.getField({ fieldId: 'custrecord_tss_ve_rate' }).isDisabled = true;
                //     // current_record.getField({ fieldId: 'custrecord_tss_ve_tax_amt' }).isDisabled = true;
                //     // current_record.getField({ fieldId: 'custrecord_tss_ve_tax_amt' }).isDisabled = true;
                // }
            } catch (error) {
                log.error("Error in pageInit", error)
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
                if (scriptContext.fieldId == 'custrecord_tss_ve_schedule') {
                    var current_record = scriptContext.currentRecord;
                    var schedType = current_record.getValue({ fieldId: 'custrecord_tss_ve_schedule' });
                    var amountField = current_record.getField({ fieldId: 'custrecord_tss_ve_amount' });
                    if (schedType == 1) {
                        amountField.isDisplay = true;
                        amountField.isMandatory = true;
                    }
                    else if (schedType == 2) {
                        amountField.isDisplay = false;
                        amountField.isMandatory = false;
                    }
                    else {
                        amountField.isDisplay = false;
                        amountField.isMandatory = false;
                    }
                    current_record.setValue({ fieldId: 'custrecord_tss_ve_amount', value: '' });

                }
            } catch (error) {
                log.error('Error in fieldchanged', error)
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
                var current_record = scriptContext.currentRecord;

                //Making Threshold Amount field mandatory based on Scheduled Type
                var schedType = current_record.getValue({ fieldId: 'custrecord_tss_ve_schedule' });
                var amountField = current_record.getValue({ fieldId: 'custrecord_tss_ve_amount' });
                if (schedType == 1 && !_logValidation(amountField)) {
                    alert('Please enter value(s) for: Threshold Amount')
                    return false;
                }

                // Validating the Vendor with Vendor in TDS Relation
                if (_logValidation(tdsRel) && _logValidation(vend)) {
                    var tdsRelObj = search.lookupFields({
                        type: 'customrecord_tss_tdsrelation',
                        id: tdsRel,
                        columns: ['custrecord_tss_tds_vendorname']
                    });
                    var vendorId = tdsRelObj.custrecord_tss_tds_vendorname[0] ? tdsRelObj.custrecord_tss_tds_vendorname[0].value : null;

                    if (vendorId && vendorId == vend) {
                        //Vendor matched in TDS Relation
                    }
                    else {
                        alert("Please Enter valid Vendor")
                        return false
                    }
                }

                // Checking Duplicate TDS Vendor Exemption records
                var vend = current_record.getValue({ fieldId: 'custrecordtss_ve_vendorname' });
                var tdsRel = current_record.getValue({ fieldId: 'custrecord_tss_ve_tdsrelation' });
                var subs = current_record.getValue({ fieldId: 'custrecord_tss_ve_subsidiary' });
                var from = current_record.getText({ fieldId: 'custrecord_tss_ve_from' });
                var to = current_record.getText({ fieldId: 'custrecord_tss_ve_to' });

                if (vend && tdsRel && subs && from && to) {

                    var exemFilters = [];


                    exemFilters.push(['isinactive', 'is', 'F'])

                    if (_logValidation(vend)) {
                        exemFilters.push('AND')
                        exemFilters.push(['custrecordtss_ve_vendorname', 'anyof', vend])
                    }
                    if (_logValidation(tdsRel)) {
                        exemFilters.push('AND')
                        exemFilters.push(['custrecord_tss_ve_tdsrelation', 'anyof', tdsRel])
                    }
                    if (_logValidation(subs)) {
                        exemFilters.push('AND')
                        exemFilters.push(['custrecord_tss_ve_subsidiary', 'anyof', subs])
                    }
                    if (_logValidation(from)) {
                        exemFilters.push('AND')
                        exemFilters.push(['custrecord_tss_ve_to', 'onorafter', from])
                    }
                    if (_logValidation(to)) {
                        exemFilters.push('AND')
                        exemFilters.push(['custrecord_tss_ve_from', 'onorbefore', to])
                    }
                    if (_logValidation(current_record.id)) {
                        exemFilters.push('AND')
                        exemFilters.push(['internalid', 'noneof', current_record.id])
                    }




                    var exemSearch = search.create({
                        type: 'customrecord_tss_vendor_exemption',
                        filters: exemFilters,
                        columns: ['internalid']
                    });

                    var exemSearchRes = exemSearch.run().getRange(0, 100);

                    if (exemSearchRes.length > 0) {
                        var vend = current_record.getText({ fieldId: 'custrecordtss_ve_vendorname' });
                        alert("The " + vend + " has already vendor exemption record exists in particular period")
                        return false;
                    }

                }




                return true;




            } catch (error) {
                log.error("Error in saveRecord", error)
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
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            //       postSourcing: postSourcing,
            //      sublistChanged: sublistChanged,
            //       lineInit: lineInit,
            // validateField: validateField,
            //       validateLine: validateLine,
            //       validateInsert: validateInsert,
            //       validateDelete: validateDelete,
            saveRecord: saveRecord
        };

    });
