/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
/**
 * Script Name               : TSS CS Customer Deposit
 * Script Author             : MNR Krishna
 * Script Type               : Client Script
 * Script Version            : 2.1
 * Script Created date       : 25/05/2026
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  
 */
define(['N/record', 'N/currentRecord', 'N/search', 'N/ui/dialog', 'N/ui/message', 'N/https', 'N/runtime'],

    function (record, currentRecord, search, dialog, message, https, runtime) {
        //Global Variables
        var isExpired = true;
        var formSetFlag = true;
        var customFormsObjSb = {
            'purchaseorder': 201, 'vendorprepayment': 203, 'vendorbill': 193, 'vendorreturnauthorization': '', 'vendorcredit': 194, 'billpayment': '',
            'salesorder': 202, 'invoice': 199, 'returnauthorization': '', 'creditmemo': 197, 'customerpayments': '', 'cashsale': 195, 'customerrefund': 176, 'customerdeposit': 204
        }
        var customFormsObjProd = {
            'purchaseorder': 201, 'vendorprepayment': 203, 'vendorbill': 193, 'vendorreturnauthorization': '', 'vendorcredit': 194, 'billpayment': '',
            'salesorder': 202, 'invoice': 199, 'returnauthorization': '', 'creditmemo': 197, 'customerpayments': '', 'cashsale': 195, 'customerrefund': 176, 'customerdeposit': 204
        }

        /**
         * Function to be executed after page is initialized.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
         *
         * @since 2015.2
         */
        var cachedGlobalSubsidiary = null;
        var Previousfieldvalue = '';
        var gstCode = ''
        function pageInit(scriptContext) {
            try {
                var currentRec = scriptContext.currentRecord;
                var currentRecId = currentRec.id;
                cachedGlobalSubsidiary = GettingGlobalParameter();
                cachedGlobalSubsidiary = cachedGlobalSubsidiary[0]
                if (isExpired) {
                    return true
                }
                var amountwithouttax = currentRec.getValue({ fieldId: 'custbody_tss_it_amount_withouttax' });
                var taxcodepageinit = currentRec.getValue({ fieldId: 'custbody_tss_it_tax_code' });
                var exportpageinit = currentRec.getValue({ fieldId: 'custbody_tss_export_gst' });


                var currentrecordsubsidiary = currentRec.getValue({ fieldId: "subsidiary" });
                var Flag = 0;
                Flag = inArray(currentrecordsubsidiary, cachedGlobalSubsidiary);
                if (Flag == parseInt(1)) {
                    if (formSetFlag) {
                        var customFormsObj = ''
                        var accountId = runtime.accountId;
                        log.debug('Account ID', accountId);
                        if (accountId.endsWith('_SB1')) {
                            customFormsObj = customFormsObjSb// SB3
                        }
                        else if (runtime.envType === runtime.EnvType.PRODUCTION) {
                            customFormsObj = customFormsObjProd
                            // console.log('Production');
                        }
                        var rec_form = currentRec.getValue({ fieldId: "customform" });
                        if ((rec_form != customFormsObj[currentRec.type]) && (_logValidation(customFormsObj[currentRec.type]))) {
                            currentRec.setValue({ fieldId: "customform", value: customFormsObj[currentRec.type] });
                        }
                    }
                    currentRec.setValue({
                        fieldId: 'custbody_tss_isvalidsubsidiary',
                        value: true,
                    });
                    // currentRec.setValue({
                    //     fieldId: 'applied',
                    //     value: parseFloat(20),
                    //     ignoreFieldChange: true
                    // });
                    // var setResp = currentRec.getValue({
                    //     fieldId: 'applied'
                    // });
                    // alert(setResp)
                    if (!amountwithouttax) {
                        var fld = currentRec.getField({ fieldId: 'custbody_tss_it_amount_withouttax' });
                        fld.isDisabled = true;
                    }
                    if (!taxcodepageinit) {
                        var fld = currentRec.getField({ fieldId: 'custbody_tss_it_tax_code' });
                        fld.isDisabled = true;
                    }
                    if (!exportpageinit) {
                        var fld = currentRec.getField({ fieldId: 'custbody_tss_export_gst' });
                        fld.isDisabled = true;
                    }


                    /**Making the fields has disabled in page load */

                    var gstFieldsConfig = [
                        { id: 'custbody_tss_it_amount_withouttax' },
                        { id: 'custbody_tss_it_tax_code' },
                        { id: 'custbody_tss_it_taxrate' },
                        { id: 'custbody_tss_it_taxamount' },
                        { id: 'custbody_tss_it_igst_amount' },
                        { id: 'custbody_tss_it_sgst_amount' },
                        { id: 'custbody_tss_cgst_amount' },
                        { id: 'custbody_tss_it_apply_gst' },
                        { id: 'custbody_tss_export_gst' },
                        { id: 'custbody_tss_gst_payment_under' },
                    ];
                    if (currentRec.type == 'customerdeposit') {
                        var searchResultCount = 0;
                        if (currentRecId) {
                            var depositapplicationSearchObj = search.create({
                                type: "depositapplication",
                                settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                                filters:
                                    [
                                        ["type", "anyof", "DepAppl"],
                                        "AND",
                                        ["appliedtotransaction", "anyof", currentRecId],
                                        "AND",
                                        ["appliedtotransaction.type", "anyof", "CustDep"]
                                    ],
                                columns:
                                    [
                                        search.createColumn({ name: "internalid", label: "Internal ID" })
                                    ]
                            });
                            var searchResultCount = depositapplicationSearchObj.runPaged().count;
                        }

                        var status = currentRec.getValue({ fieldId: 'status' });
                        log.debug("status", status)
                        if (status == 'Fully Applied' || searchResultCount > 0) {
                            gstFieldsConfig.forEach(function (field) {
                                var fld = currentRec.getField({ fieldId: field.id });
                                fld.isDisabled = true;
                            });

                        } else {
                            var applyGst = currentRec.getValue({ fieldId: 'custbody_tss_it_apply_gst' });
                            var gstFieldsConfigs = [
                                { id: 'custbody_tss_it_amount_withouttax', mandatory: true },
                                { id: 'custbody_tss_it_tax_code', mandatory: false },
                                { id: 'custbody_tss_it_taxrate', mandatory: false },
                                { id: 'custbody_tss_it_taxamount', mandatory: false },
                                { id: 'custbody_tss_export_gst', mandatory: false },

                            ];
                            gstFieldsConfigs.forEach(function (field) {
                                var fld = currentRec.getField({ fieldId: field.id });
                                if (scriptContext.mode === 'create') {
                                    if (field.id != 'custbody_tss_it_taxrate' || field.id != 'custbody_tss_it_taxamount') {
                                        fld.isDisabled = !applyGst;
                                    }
                                    if (field.mandatory) {
                                        fld.isMandatory = applyGst;
                                    }
                                }
                                if (scriptContext.mode === 'edit') {
                                    if (field.id == 'custbody_tss_it_taxrate' || field.id == 'custbody_tss_it_taxamount' || field.id == 'custbody_tss_it_tax_code') {
                                        fld.isDisabled = true;
                                    }
                                    if (field.mandatory) {
                                        fld.isMandatory = field.mandatory;
                                    }
                                }
                            });
                        }
                        if (scriptContext.mode === 'edit') {
                            var paymentField = currentRec.getField({ fieldId: 'payment' });
                            paymentField.isDisabled = applyGst;
                            var gstTransaction = currentRec.getValue({ fieldId: 'custbody_tss_lut_journal_invoice' });
                            var ExportButton = currentRec.getField({ fieldId: 'custbody_tss_export_gst' });
                            var PaymentUnder = currentRec.getField({ fieldId: 'custbody_tss_gst_payment_under' });
                            var gstButton = currentRec.getField({ fieldId: 'custbody_tss_it_apply_gst' });
                            log.debug('ExportButton', currentRec.getValue({ fieldId: 'custbody_tss_export_gst' }));

                            currentRec.getField({ fieldId: 'custbody_tss_it_tax_code' }).isDisabled = !applyGst;
                            if (gstTransaction == '' || gstTransaction == null || gstTransaction == undefined) {
                                ExportButton.isDisabled = false;
                                if (currentRec.getValue({ fieldId: 'custbody_tss_export_gst' })) {
                                    log.debug("entered in payment under disable")
                                    PaymentUnder.isDisabled = false;
                                }
                            } else {
                                var gstFields = search.lookupFields({
                                    type: record.Type.JOURNAL_ENTRY,
                                    id: gstTransaction,
                                    columns: ['status']
                                });

                                var status = gstFields.status; // returns an object for list/record fields
                                log.debug('GST Transaction Status', status);
                                if (status && status[0] && status[0].text === 'Voided') {
                                    gstButton.isDisabled = false;
                                    ExportButton.isDisabled = false;
                                    PaymentUnder.isDisabled = false;
                                } else {
                                    gstButton.isDisabled = true;
                                    ExportButton.isDisabled = true;
                                    PaymentUnder.isDisabled = true;
                                }
                            }






                        }
                        if (scriptContext.mode === 'copy') {
                            currentRec.setValue({
                                fieldId: 'custbody_tss_it_apply_gst',
                                value: false
                            });
                            currentRec.setValue({
                                fieldId: 'custbody_tss_export_gst',
                                value: false
                            });
                            currentRec.setValue({
                                fieldId: 'custbody_tss_tds_relation',
                                value: ''
                            });
                            currentRec.setValue({ fieldId: 'custbody_tss_gst_payment_under', value: '' });
                            currentRec.setValue({ fieldId: 'custbody_tss_lut_journal_invoice', value: '' });
                            var Amt = currentRec.getField({ fieldId: 'custbody_tss_it_amount_withouttax' });
                            Amt.isDisabled = true;
                            var Taxcode = currentRec.getField({ fieldId: 'custbody_tss_it_tax_code' });
                            Taxcode.isDisabled = true;


                        }
                        /**Making the fields has disabled in page load */
                    }


                    if (currentRec.type == 'depositapplication') {

                        /* Disabling the field in page load */
                        gstFieldsConfig.forEach(function (field) {
                            var fld = currentRec.getField({ fieldId: field.id });
                            fld.isDisabled = true;

                        });
                        /* Disabling the field in page load */
                        log.debug('Script Mode', scriptContext.mode);
                        if (scriptContext.mode !== 'edit') {
                            currentRec.setValue({ fieldId: 'custbody_tss_lut_journal_invoice', value: '' });
                        }
                        if (scriptContext.mode == 'edit') {
                            var appliedAmt = currentRec.getValue({ fieldId: 'applied' }) || 0;
                            if (parseFloat(appliedAmt) == 0) {
                                currentRec.setValue({ fieldId: 'custbody_tss_it_appliedamt_withouttax', value: JSON.stringify({ "gstamt": "0", "gstinvoice": {}, "gstrefund": {} }) });
                            }
                        }


                        /* getting tax type from tax code*/
                        let gstCodevalue = currentRec.getValue({ fieldId: 'custbody_tss_it_tax_code' });
                        if (gstCodevalue) {
                            let result = search.create({
                                type: "taxgroup",
                                filters: [["internalid", "anyof", gstCodevalue]],
                                columns: [search.createColumn({ name: "taxtype" })]
                            }).run().getRange({ start: 0, end: 1 })[0];
                            gstCode = result ? result.getText({ name: 'taxtype' }) : '';
                        }
                        /* getting tax type from tax code*/

                        /*Getting the previous data from Customer deposit application*/

                        var depositId = currentRec.getValue({ fieldId: 'deposit' });
                        console.log('Customer Deposit ID', depositId);
                        var filters;

                        if (depositId) {
                            if (currentRecId) {
                                filters = [
                                    ['internalid', 'noneof', currentRecId], "AND",
                                    ['appliedtotransaction', 'is', depositId],
                                    "AND",
                                    ['appliedtotransaction.type', 'anyof', ['CustDep']]

                                ]
                            } else {
                                filters = [
                                    ['appliedtotransaction', 'is', depositId],
                                    "AND",
                                    ['appliedtotransaction.type', 'anyof', ['CustDep']]
                                ]
                            }
                            var depositsearch = search.create({
                                type: 'depositapplication',
                                filters: filters,
                                columns: [
                                    search.createColumn({ name: 'custbody_tss_it_appliedamt_withouttax' })
                                ]
                            });
                            var foundResults = false;
                            depositsearch.run().each(function (result) {
                                foundResults = true;
                                var rawValue = result.getValue('custbody_tss_it_appliedamt_withouttax');
                                log.debug("rawValue", rawValue)
                                var parsed;
                                if (rawValue) {
                                    parsed = JSON.parse(rawValue.replace(/'/g, '"'));
                                    Previousfieldvalue = JSON.stringify(parsed)
                                } else {
                                    parsed = { gstamt: 0, gstinvoice: {} };
                                    Previousfieldvalue = JSON.stringify(parsed)
                                }
                                return true;
                            });
                            if (!foundResults) {
                                var parsed = { gstamt: 0, gstinvoice: {} };
                                Previousfieldvalue = JSON.stringify(parsed)
                            }

                        }
                        /*Getting the previous data from Customer deposit application*/

                        /*For the auto apply and clear buttons */
                        window.setTimeout(function () {
                            var autoApplyBtn = document.querySelector('input[name="autoapply"]');
                            if (autoApplyBtn) {
                                autoApplyBtn.addEventListener("click", function () {
                                    console.log("Auto Apply button clicked!");
                                    var ApplyGST = currentRec.getValue({ fieldId: 'custbody_tss_it_apply_gst' });
                                    if (!ApplyGST) return;


                                    // small delay so NetSuite applies bills first
                                    setTimeout(function () {
                                        handleAutoApply(currentRec);
                                    }, 500);
                                });
                            }

                            var clearBtn = document.querySelector('input[name="clear"]');
                            if (clearBtn) {
                                clearBtn.addEventListener("click", function () {
                                    console.log("Clear button clicked!");
                                    setTimeout(function () {
                                        resetGST(currentRec);
                                    }, 500);
                                });
                            }
                        }, 1000);
                        /*For the auto apply and clear buttons */


                    }
                }
            } catch (e) {
                log.error('Error in pageInit', e.message);
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
                var currentRec = scriptContext.currentRecord;
                var currentrecordsubsidiary = currentRec.getValue({ fieldId: "subsidiary" });
                var Flag = 0;
                Flag = inArray(currentrecordsubsidiary, cachedGlobalSubsidiary);
                if (Flag == parseInt(1)) {
                    //Validation on GSTIN
                    if (scriptContext.fieldId == 'custbody_tss_transaction_gstin_uid') {
                        var current_record = scriptContext.currentRecord;
                        var s_Record_Type = current_record.type;
                        var gstin = current_record.getValue({ fieldId: "custbody_tss_transaction_gstin_uid" });
                        if (_logValidation(gstin)) {
                            var POS = current_record.getValue({ fieldId: "custbody_tss_place_of_service" });
                            // var b_Check = new RegExp("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$");
                            var b_Check = new RegExp("^[0-9]{2}([A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]|[0-9]{2}[A-Z]{3}[0-9]{5}UN[0-9A-Z])$"); // This is used for both GSTIN and UIN Validation
                            if (!b_Check.test(gstin)) {
                                var isAttemptingUIN = gstin.toUpperCase().substring(12, 14) === 'UN';
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
                                // alert('Please enter The valid GSTIN No ,\n * GSTIN Number Length 15 Character \n * First Two Numeric 0 to 9 \n * Five Character from A to Z \n * Four Numeric 0 to 9 \n * One Character from A to Z \n *One Alpha Numeric A to Z or 0 to 9 \n * One Character Z \n * One Alpha Numeric A to Z or 0 to 9');
                                current_record.setValue({
                                    fieldId: 'custbody_tss_transaction_gstin_uid',
                                    value: '',
                                    ignoreFieldChange: true
                                });
                            }

                            if (_logValidation(POS)) {
                                var stateObj = search.lookupFields({
                                    type: 'customrecord_tss_gst_state_master',
                                    id: POS,
                                    columns: ['custrecord_tss_tin']
                                });
                                var stateCode = stateObj.custrecord_tss_tin;
                                if (stateCode != gstin.slice(0, 2)) {
                                    current_record.setValue({
                                        fieldId: 'custbody_tss_transaction_gstin_uid',
                                        value: '',
                                        ignoreFieldChange: true
                                    });
                                    alert("GSTIN/UID is not matched with Place of Service, So please Enter Valid GSTIN accordingly");
                                }
                            }
                        }

                    } // end if (scriptContext.fieldId == 'custbody_tss_transaction_gstin_uid')

                    if (scriptContext.fieldId == 'custbody_tss_place_of_service') {
                        var current_record = scriptContext.currentRecord;
                        var POS = current_record.getValue({ fieldId: "custbody_tss_place_of_service" });
                        var gstin = current_record.getValue({ fieldId: "custbody_tss_transaction_gstin_uid" });
                        if (_logValidation(gstin) && _logValidation(POS)) {
                            //log.audit("gstin 2 chars",gstin.slice(0,2));
                            //log.audit("gstin 2 chars",gstin.substr(0, 2));
                            var stateObj = search.lookupFields({
                                type: 'customrecord_tss_gst_state_master',
                                id: POS,
                                columns: ['custrecord_tss_tin']
                            });
                            var stateCode = stateObj.custrecord_tss_tin;
                            if (stateCode != gstin.slice(0, 2)) {
                                current_record.setValue({
                                    fieldId: 'custbody_tss_transaction_gstin_uid',
                                    value: '',
                                    ignoreFieldChange: true
                                });
                                alert("GSTIN/UID is not matched with Place of Service, So please Enter Valid GSTIN accordingly");
                            }
                        }
                    }
                    if (currentRec.type == 'customerdeposit') {

                        if (scriptContext.fieldId === 'payment') {
                            var Payment = currentRec.getValue({ fieldId: 'payment' });
                            if (currentRec.getValue({ fieldId: 'custbody_tss_it_apply_gst' }) == true && !currentRec.getValue({ fieldId: 'custbody_tss_it_amount_withouttax' })) {
                                currentRec.setValue({ fieldId: 'custbody_tss_it_amount_withouttax', value: Payment });
                            }

                        }
                        if (scriptContext.fieldId === 'custbody_tss_export_gst') {
                            var ExportCheck = currentRec.getValue({ fieldId: 'custbody_tss_export_gst' });

                            var fld = currentRec.getField({ fieldId: 'custbody_tss_gst_payment_under' });
                            fld.isDisabled = !ExportCheck;
                            fld.isMandatory = ExportCheck;
                            if (!ExportCheck) {
                                currentRec.setValue({ fieldId: 'custbody_tss_gst_payment_under', value: '' });
                            }
                        }


                        /**Making the fields has disabled in if the Apply GST Checkbox is checked */
                        if (scriptContext.fieldId === 'custbody_tss_it_apply_gst') {
                            var applyGst = currentRec.getValue({ fieldId: 'custbody_tss_it_apply_gst' });
                            log.debug("applyGst", applyGst)



                            var Payment = currentRec.getValue({ fieldId: 'payment' });
                            if (applyGst && !currentRec.getValue({ fieldId: 'custbody_tss_it_amount_withouttax' })) {
                                currentRec.setValue({ fieldId: 'custbody_tss_it_amount_withouttax', value: Payment });
                            }
                            var gstFieldsConfig = [
                                { id: 'custbody_tss_it_amount_withouttax', mandatory: true },
                                { id: 'custbody_tss_it_tax_code', mandatory: false },
                                { id: 'custbody_tss_it_taxrate', mandatory: false },
                                { id: 'custbody_tss_it_taxamount', mandatory: false },
                                { id: 'custbody_tss_it_igst_amount', mandatory: false },
                                { id: 'custbody_tss_it_sgst_amount', mandatory: false },
                                { id: 'custbody_tss_cgst_amount', mandatory: false },
                                { id: 'custbody_tss_export_gst', mandatory: false },

                            ];
                            var alwaysEnabled = [
                                'custbody_tss_it_taxrate',
                                'custbody_tss_cgst_amount',
                                'custbody_tss_it_sgst_amount',
                                'custbody_tss_it_igst_amount',
                                'custbody_tss_it_taxamount',

                            ];
                            gstFieldsConfig.forEach(function (field) {
                                var fld = currentRec.getField({ fieldId: field.id });

                                if (!alwaysEnabled.includes(field.id)) {

                                    fld.isDisabled = !applyGst;
                                }

                                if (applyGst) {
                                    fld.isMandatory = field.mandatory;
                                } else {
                                    fld.isMandatory = false;
                                }
                                if (!applyGst) {

                                    clearGstFields(currentRec)

                                }
                            });

                            var paymentField = currentRec.getField({ fieldId: 'payment' });
                            paymentField.isDisabled = applyGst;
                            paymentField.isMandatory = applyGst;
                            if (!applyGst) {

                                var AmountwithoutTaxvalue = currentRec.getValue({ fieldId: 'custbody_tss_it_amount_withouttax' });
                                log.debug("AmountwithoutTaxvalue", AmountwithoutTaxvalue)
                                if (AmountwithoutTaxvalue) {
                                    currentRec.setValue({ fieldId: 'payment', value: AmountwithoutTaxvalue });
                                    currentRec.setValue({
                                        fieldId: "custbody_tss_it_amount_withouttax",
                                        value: '',

                                    });
                                } else {
                                    currentRec.setValue({
                                        fieldId: 'payment',
                                        value: '',
                                        ignoreFieldChange: true
                                    });
                                }
                                var Exportgst = currentRec.getField({ fieldId: 'custbody_tss_export_gst' });
                                Exportgst.isDisabled = true;
                                Exportgst.isMandatory = false;
                                currentRec.setValue({
                                    fieldId: 'custbody_tss_export_gst',
                                    value: false,
                                    ignoreFieldChange: true
                                });
                                var paymentUnder = currentRec.getField({ fieldId: 'custbody_tss_gst_payment_under' });
                                paymentUnder.isDisabled = true;
                                paymentUnder.isMandatory = false;
                                currentRec.setValue({
                                    fieldId: 'custbody_tss_gst_payment_under',
                                    value: '',
                                    ignoreFieldChange: true
                                });
                            }
                        }
                        /**Making the fields has disabled in if the Apply GST Checkbox is checked */

                        /**If the tax code is change if it GST and IGST Tax code then getting the rate and setting 
                         * in the tax rate and making it as diasabled  and and checking if the amount is given then
                         *  calucating the tax and setting it 
                         * if the tax code is not group then setting the all the values to empty 
                         */

                        if (scriptContext.fieldId === 'custbody_tss_it_tax_code' || scriptContext.fieldId === 'custbody_tss_gst_payment_under') {
                            var ExportCheck = currentRec.getValue({ fieldId: 'custbody_tss_export_gst' });

                            var gstFieldsConfig = [
                                { id: 'custbody_tss_it_amount_withouttax', mandatory: true },
                                { id: 'custbody_tss_it_tax_code', mandatory: false },
                                { id: 'custbody_tss_it_taxrate', mandatory: true },
                                { id: 'custbody_tss_it_taxamount', mandatory: true },
                            ];
                            gstFieldsConfig.forEach(function (field) {
                                var fld = currentRec.getField({ fieldId: field.id });
                                if (field.id == 'custbody_tss_it_tax_code' || field.id == 'custbody_tss_it_amount_withouttax') {
                                    fld.isDisabled = false;
                                } else {
                                    fld.isDisabled = true;
                                }
                                if (field.mandatory) {
                                    fld.isMandatory = field.mandatory;
                                }
                            });
                            var gstCodetext = currentRec.getText({ fieldId: 'custbody_tss_it_tax_code' })

                            if (ExportCheck) {
                                var PaymentValue = currentRec.getText({ fieldId: 'custbody_tss_gst_payment_under' });
                                log.debug("PaymentValue", PaymentValue)
                                if (PaymentValue == "Export With LUT") {
                                    if (gstCodetext && gstCodetext.includes("IGST Group")) {
                                        var gstCodeValue = currentRec.getValue({ fieldId: 'custbody_tss_it_tax_code' });
                                        var Taxrate = GetTaxRatefromTaxCode(gstCodeValue);
                                        if (Taxrate == 0) {
                                            currentRec.getField({ fieldId: 'custbody_tss_it_taxrate' }).isDisabled = true;
                                            currentRec.setValue({
                                                fieldId: 'custbody_tss_it_taxrate',
                                                value: Taxrate,
                                                ignoreFieldChange: true
                                            });
                                            Settingvalues(currentRec, true);
                                        } else {
                                            alert("For Export With LUT, please select IGST Group 0% Tax Code.");
                                            clearGstFields(currentRec);
                                        }
                                    } else {
                                        alert("For Export With LUT, please select IGST Group 0% Tax Code.");
                                        clearGstFields(currentRec);
                                    }
                                }

                                else if (PaymentValue == "Export without LUT") {
                                    if (gstCodetext && gstCodetext.includes("IGST Group")) {
                                        var gstCodeValue = currentRec.getValue({ fieldId: 'custbody_tss_it_tax_code' });
                                        var Taxrate = GetTaxRatefromTaxCode(gstCodeValue);
                                        if (Taxrate) {
                                            currentRec.getField({ fieldId: 'custbody_tss_it_taxrate' }).isDisabled = true;
                                            currentRec.setValue({
                                                fieldId: 'custbody_tss_it_taxrate',
                                                value: Taxrate,
                                                ignoreFieldChange: true
                                            });
                                            Settingvalues(currentRec, true);
                                        } else {
                                            clearGstFields(currentRec);
                                        }
                                    } else {
                                        alert("For Export Without LUT, please select an IGST Group Tax Code.");
                                        clearGstFields(currentRec);
                                    }
                                }
                            }
                            if (!ExportCheck) {

                                if (gstCodetext.includes("GST Group") || gstCodetext.includes("IGST Group")) {
                                    var gstCodeValue = currentRec.getValue({ fieldId: 'custbody_tss_it_tax_code' });
                                    var Taxrate = GetTaxRatefromTaxCode(gstCodeValue);
                                    if (Taxrate) {
                                        currentRec.getField({ fieldId: 'custbody_tss_it_taxrate' }).isDisabled = true;
                                        currentRec.setValue({ fieldId: 'custbody_tss_it_taxrate', value: Taxrate });
                                        Settingvalues(currentRec, true);
                                    } else {
                                        clearGstFields(currentRec);
                                    }
                                }
                                else if (gstCodetext == '') {
                                    currentRec.getField("custbody_tss_it_taxrate").isMandatory = false;
                                    currentRec.getField("custbody_tss_it_taxamount").isMandatory = false;
                                    currentRec.setValue({ fieldId: 'payment', value: currentRec.getValue({ fieldId: 'custbody_tss_it_amount_withouttax' }) });
                                    clearGstFields(currentRec);
                                } else {
                                    alert("Selected Tax Code is not GST Group or IGST Group. Please select a valid tax code.");
                                    clearGstFields(currentRec);
                                    return;
                                }

                            }
                        }
                        /**If the tax code is change if it GST and IGST Tax code then getting the rate and setting 
                        * in the tax rate and making it as diasabled  and and checking if the amount is given then
                        *  calucating the tax and setting it 
                        * if the tax code is not group then setting the all the values to empty 
                        */



                        /**If the amount is given then caluculatin the tax and setting in the repsective fields and making it as disabling 
                         * and setting the tax amount in the field and sum of amount and tax amount is set in the payment field 
                         */

                        if (scriptContext.fieldId === 'custbody_tss_it_amount_withouttax' || scriptContext.fieldId === 'custbody_tss_it_taxamount') {
                            var value = parseFloat(currentRec.getValue({ fieldId: scriptContext.fieldId })) || 0;
                            if (value < 0) {
                                alert('Negative values are not allowed for this field.');
                                currentRec.setValue({
                                    fieldId: scriptContext.fieldId,
                                    value: '',
                                    ignoreFieldChange: true
                                });
                            }
                            Settingvalues(currentRec, false)
                        }
                        /**If the amount is given then caluculatin the tax and setting in the repsective fields and making it as disabling 
                      * and setting the tax amount in the field and sum of amount and tax amount is set in the payment field 
                      */

                    }

                    if (currentRec.type == 'depositapplication') {
                        appliedAmount = currentRec.getValue({ fieldId: 'applied' });
                        var CompareTaxcode = currentRec.getValue({ fieldId: "custbody_tss_it_tax_code" });
                        var CompareTaxRate = currentRec.getValue({ fieldId: "custbody_tss_it_taxrate" });
                        var CompareAmount = currentRec.getValue({ fieldId: "custbody_tss_it_amount_withouttax" });
                        var CompareisExport = currentRec.getValue({ fieldId: 'custbody_tss_export_gst' });
                        var ComparePaymentValue = currentRec.getText({ fieldId: 'custbody_tss_gst_payment_under' });
                        var ApplyGST = currentRec.getValue({ fieldId: 'custbody_tss_it_apply_gst' });
                        var unApplied = currentRec.getValue({ fieldId: 'unapplied' });

                        if (!ApplyGST) return;

                        var depoistId = currentRec.getValue({ fieldId: 'deposit' });
                        var depoistIdObj = search.lookupFields({
                            type: "customerdeposit",
                            id: depoistId,
                            columns: ['custbody_tss_it_amount_withouttax']
                        });
                        var CompareAmount = depoistIdObj.custbody_tss_it_amount_withouttax


                        console.log("CompareTaxData", { CompareTaxcode: CompareTaxcode, CompareTaxRate: CompareTaxRate, CompareAmount: CompareAmount, CompareisExport: CompareisExport, ComparePaymentValue: ComparePaymentValue })
                        if (scriptContext.sublistId === 'apply' && (scriptContext.fieldId === 'apply' || scriptContext.fieldId === 'amount')) {

                            var line = scriptContext.line;
                            var isApplied = currentRec.getCurrentSublistValue({
                                sublistId: 'apply',
                                fieldId: 'apply'
                            });
                            var invoiceId = currentRec.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'doc',
                                line: line
                            });
                            var tranType = currentRec.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'trantype',
                                line: line
                            });
                            console.log("isApplied", isApplied)
                            console.log("invoiceId", invoiceId)
                            if (isApplied) {
                                if (invoiceId) {
                                    var invoiceResults = InvoiceSearch(invoiceId, tranType, false);

                                    if (invoiceResults.length > 0) {
                                        var ExportButton = invoiceResults[0].exportgst;
                                        var PaymentValue = invoiceResults[0].paymentunder;

                                        console.log("ExportButton", ExportButton);
                                        console.log("PaymentValue", PaymentValue);

                                        var itemAmount = 0;
                                        var allMatch = true;

                                        if (CompareisExport == ExportButton && ComparePaymentValue == PaymentValue) {
                                            // invoiceResults.each(function (line) {
                                            for (var i = 0; i < invoiceResults.length; i++) {
                                                var line = invoiceResults[i];
                                                log.debug("line", line);
                                                var taxCode = '';

                                                if (PaymentValue == 'Export without LUT' && ExportButton == true) {
                                                    taxCode = line.lutTaxcode;
                                                    console.log("in LUT", taxCode);
                                                } else {
                                                    taxCode = line.taxcode;
                                                    console.log("not in LUT", taxCode);
                                                }

                                                itemAmount += line.amount;

                                                if (isApplied) {
                                                    if (taxCode != CompareTaxcode) {
                                                        allMatch = false;
                                                        console.log("allMatch in item", allMatch);
                                                        break;
                                                    }
                                                }

                                                console.log('Bill Line ' +
                                                    ' → Tax Code: ' + taxCode +
                                                    ', Tax Amount: ' + line.amount +
                                                    ', Tax Rate: ' + line.taxrate);
                                                // return true;
                                            };
                                        } else {
                                            allMatch = false;
                                        }
                                    }

                                }
                                console.log("allMatch before", allMatch)


                                if (!allMatch) {
                                    dialog.alert({
                                        title: 'Alert',
                                        message: 'GST Tax Code is not matching with the Invoice. Please Apply to the Valid Invoice ',
                                    })
                                    currentRec.setCurrentSublistValue({
                                        sublistId: 'apply',
                                        fieldId: 'apply',
                                        value: false,
                                        // ignoreFieldChange: true
                                    });
                                    currentRec.setCurrentSublistValue({
                                        sublistId: 'apply',
                                        fieldId: 'amount',
                                        value: '',
                                        // ignoreFieldChange: true
                                    });
                                } else {
                                    // var fieldValue = Previousfieldvalue;
                                    // var existingData = {};
                                    // if (fieldValue) {
                                    //     existingData = JSON.parse(fieldValue);
                                    // }
                                    // log.debug("existingData", existingData)
                                    // var Totalamount = parseFloat(existingData.gstamt) || 0;
                                    // console.log("Totalamount", Totalamount)
                                    // var AmountRemaining = CompareAmount - Totalamount
                                    // console.log("AmountRemaining", AmountRemaining)
                                    var total = currentRec.getCurrentSublistValue({
                                        sublistId: 'apply',
                                        fieldId: 'amount'
                                    });
                                    var dueAmt = currentRec.getSublistValue({
                                        sublistId: 'apply',
                                        fieldId: 'due',
                                        line: line
                                    });
                                    console.log("total", total)

                                    // var existingDataCache = getSessionData()
                                    // console.log("invoiceIdCacheObj", existingDataCache)
                                    // var invoiceIdCacheObj = existingDataCache.gstinvoice ? existingDataCache.gstinvoice[invoiceId] ? existingDataCache.gstinvoice[invoiceId] : {} : {}
                                    // console.log("invoiceIdCacheObj", invoiceIdCacheObj)
                                    // //{invoiceId:{'taxamt':0,'baseamt':0}}
                                    // console.log("invoice applied amts - " + invoiceIdCacheObj.baseamt + " + " + invoiceIdCacheObj.taxamt)
                                    // if (parseFloat(total) == (parseFloat(invoiceIdCacheObj.taxamt || 0) + parseFloat(invoiceIdCacheObj.baseamt || 0))) {
                                    //     return;
                                    // }


                                    // var invoiceIdObj = existingData.gstinvoice ? existingData.gstinvoice[invoiceId] ? existingData.gstinvoice[invoiceId] : {} : {}
                                    // console.log("invoiceIdObj", invoiceIdObj)
                                    // //{invoiceId:{'taxamt':0,'baseamt':0}}
                                    // console.log("invoice applied amts - " + invoiceIdObj.baseamt + " + " + invoiceIdObj.taxamt)
                                    // if (parseFloat(total) == (parseFloat(invoiceIdObj.taxamt || 0) + parseFloat(invoiceIdObj.baseamt || 0))) {
                                    //     return;
                                    // }

                                    // if (AmountRemaining > 0) {
                                    //     var linebase = parseFloat(Math.min(total, AmountRemaining) || 0);
                                    //     console.log("linebase", linebase)
                                    // if (parseFloat(total) > parseFloat(AmountRemaining) && scriptContext.fieldId === 'amount') {
                                    //     var applyResponse = confirm("You can apply upto - " + AmountRemaining + " only. Please Click Ok tocontinue with max base amount.")
                                    //     if (applyResponse) {

                                    //     }
                                    //     else {
                                    //         currentRec.setCurrentSublistValue({
                                    //             sublistId: 'apply',
                                    //             fieldId: 'apply',
                                    //             value: false,
                                    //             // ignoreFieldChange: true
                                    //         });
                                    //         // currentRec.setCurrentSublistValue({
                                    //         //     sublistId: 'apply',
                                    //         //     fieldId: 'amount',
                                    //         //     value: '',
                                    //         //     // ignoreFieldChange: true
                                    //         // });
                                    //         // currentRec.setValue({
                                    //         //     fieldId: 'custbody_tss_it_taxamount',
                                    //         //     value: 0,
                                    //         //     ignoreFieldChange: true
                                    //         // });
                                    //         return;
                                    //     }
                                    // }
                                    var fieldValue = currentRec.getValue({ fieldId: 'custbody_tss_it_appliedamt_withouttax' });
                                    var existingData = {};
                                    if (fieldValue) {
                                        try {
                                            existingData = JSON.parse(fieldValue.replace(/'/g, '"'));
                                        } catch (e) {
                                            log.debug("JSON parse error, resetting", e);
                                            existingData = { gstamt: 0, gstinvoice: {} };
                                        }
                                    } else {
                                        existingData = { gstamt: 0, gstinvoice: {} };
                                    }
                                    var prevTotal = parseFloat(existingData.gstamt) || 0;
                                    // var GSTAmount = prevTotal + (parseFloat(linebase));
                                    console.log("prevTotal", prevTotal)
                                    // console.log("GSTAmount", GSTAmount)
                                    var invoiceInternalid = invoiceId;
                                    // var invBaseAmt = linebase
                                    console.log("total", total)
                                    var invBaseAmt = (parseFloat(total) / (1 + parseFloat(CompareTaxRate) / 100)).toFixed(2)
                                    var invTaxAmt = (parseFloat(total) - parseFloat(invBaseAmt)).toFixed(2)

                                    // var invTaxAmt = (parseFloat(linebase) * (CompareTaxRate / 100)).toFixed(2)
                                    console.log("invBaseAmt", invBaseAmt)

                                    console.log("invTaxAmt", invTaxAmt)
                                    // var finalLineAmt = (parseFloat(total) + parseFloat(invTaxAmt)).toFixed(2);
                                    // console.log("finalLineAmt", finalLineAmt)
                                    // console.log("dueAmt", dueAmt)
                                    // console.log("unApplied", unApplied)


                                    var invoiceIdObj = existingData.gstinvoice ? existingData.gstinvoice[invoiceId] ? existingData.gstinvoice[invoiceId] : {} : {}
                                    console.log("invoiceIdObj", invoiceIdObj)
                                    //{invoiceId:{'taxamt':0,'baseamt':0}}
                                    console.log("invoice applied amts - " + invoiceIdObj.baseamt + " + " + invoiceIdObj.taxamt)
                                    // var currInvAmt = (parseFloat(invoiceIdObj.taxamt || 0) + parseFloat(invoiceIdObj.baseamt || 0))
                                    // console.log("currInvAmt", currInvAmt)
                                    // var exceededAmt = (parseFloat(CompareAmount) - prevTotal + parseFloat(invoiceIdObj.baseamt || 0))
                                    // console.log("exceededAmt", exceededAmt)

                                    // if ((parseFloat(finalLineAmt) > parseFloat(dueAmt)) || parseFloat(unApplied) == 0 || parseFloat(linebase) > exceededAmt) {
                                    //     var linebase1 = parseFloat(Math.min(finalLineAmt, dueAmt) || 0);
                                    //     // console.log("is 1st", (parseFloat(finalLineAmt) > parseFloat(dueAmt)))
                                    //     // console.log("is 2nd", parseFloat(unApplied) == 0)
                                    //     // console.log("is Exceeded", parseFloat(linebase) > exceededAmt)
                                    //     console.log("finalLineAmt", finalLineAmt)
                                    //     console.log("dueAmt", dueAmt)
                                    //     console.log("linebase1", linebase1)

                                    //     // if (parseFloat(linebase) > exceededAmt) {
                                    //     //     linebase1 = total
                                    //     // }
                                    //     linebase1 = total
                                    //     console.log("linebase1 after", linebase1)
                                    //     invBaseAmt = (parseFloat(linebase1) / (1 + parseFloat(CompareTaxRate) / 100)).toFixed(2)
                                    //     console.log("invBaseAmt", invBaseAmt)
                                    //     invTaxAmt = (parseFloat(linebase1) - parseFloat(invBaseAmt)).toFixed(2)
                                    // }
                                    // finalLineAmt = (parseFloat(invBaseAmt) + parseFloat(invTaxAmt)).toFixed(2)
                                    // console.log("finalLineAmt1", finalLineAmt)
                                    existingData.gstinvoice[invoiceInternalid] = { "taxamt": parseFloat(invTaxAmt), "baseamt": parseFloat(invBaseAmt) };
                                    var newTotal = 0;
                                    for (var key in existingData.gstinvoice) {
                                        if (existingData.gstinvoice.hasOwnProperty(key)) {
                                            newTotal += parseFloat(existingData.gstinvoice[key]['baseamt']) || 0;
                                        }
                                    }
                                    existingData.gstamt = newTotal
                                    console.log("existingData1", existingData.gstinvoice[invoiceInternalid])
                                    currentRec.setValue({
                                        fieldId: 'custbody_tss_it_appliedamt_withouttax',
                                        value: JSON.stringify(existingData),
                                        // ignoreFieldChange: true
                                    });
                                    //Setting in cache
                                    // storeSessionData(existingData)
                                    // alert("set")
                                    console.log("existingData", existingData)
                                    var gstRate = parseFloat(currentRec.getValue({ fieldId: 'custbody_tss_it_taxrate' })) || 0;
                                    console.log(" existingData.gstamt", existingData.gstamt)
                                    var taxAmount = (parseFloat(existingData.gstamt) * (gstRate / 100)).toFixed(2);
                                    console.log("taxAmount", taxAmount)
                                    applyGstSplit(currentRec, gstCode, taxAmount)
                                    currentRec.setValue({
                                        fieldId: 'custbody_tss_it_taxamount',
                                        value: taxAmount,
                                        ignoreFieldChange: true
                                    });

                                    // var cdaTotal = parseFloat(currentRec.getValue({ fieldId: 'total' }) || 0)
                                    // var cdaApplAmt = parseFloat(currentRec.getValue({ fieldId: 'applied' }) || 0)
                                    // console.log("cdaApplAmt", cdaApplAmt)

                                    // var cdaApplAmtNew = (parseFloat(cdaApplAmt) + parseFloat(invTaxAmt)).toFixed(2)
                                    // console.log("cdaApplAmtNew", cdaApplAmtNew)
                                    // var cdaUnApplAmt = parseFloat(cdaTotal - cdaApplAmtNew).toFixed(2)
                                    // console.log("cdaUnApplAmt", cdaUnApplAmt)

                                    // currentRec.setValue({
                                    //     fieldId: 'applied',
                                    //     value: cdaApplAmtNew,
                                    //     ignoreFieldChange: true
                                    // });
                                    // currentRec.setValue({
                                    //     fieldId: 'unapplied',
                                    //     value: cdaUnApplAmt,
                                    //     ignoreFieldChange: true
                                    // });

                                    // console.log("amount setting current line", finalLineAmt)
                                    //Updating the Amount in line level
                                    // currentRec.setCurrentSublistValue({
                                    //     sublistId: 'apply',
                                    //     fieldId: 'amount',
                                    //     value: finalLineAmt,
                                    //     // ignoreFieldChange: true
                                    // });

                                    // } else {
                                    //     currentRec.setValue({
                                    //         fieldId: 'custbody_tss_it_taxamount',
                                    //         value: 0,
                                    //         ignoreFieldChange: true
                                    //     });
                                    // }

                                }
                            }
                            if (!isApplied && invoiceId) {
                                var fieldValue = currentRec.getValue({ fieldId: 'custbody_tss_it_appliedamt_withouttax' });
                                console.log("fieldValue", fieldValue)
                                var existingData = {};
                                if (fieldValue) {
                                    try {
                                        existingData = JSON.parse(fieldValue.replace(/'/g, '"'));
                                    } catch (e) {
                                        log.debug("JSON parse error, resetting", e);
                                        existingData = { gstamt: 0, gstinvoice: {} };
                                    }
                                } else {
                                    existingData = { gstamt: 0, gstinvoice: {} };
                                }
                                if (existingData.gstinvoice && existingData.gstinvoice[invoiceId]) {
                                    var removedAmt = parseFloat(existingData.gstinvoice[invoiceId] ? existingData.gstinvoice[invoiceId]['baseamt'] || 0 : 0) || 0;
                                    delete existingData.gstinvoice[invoiceId];
                                    existingData.gstamt = Math.max(0, (parseFloat(existingData.gstamt) || 0) - removedAmt);
                                }
                                console.log("existingData", existingData)
                                currentRec.setValue({
                                    fieldId: 'custbody_tss_it_appliedamt_withouttax',
                                    value: JSON.stringify(existingData),
                                    ignoreFieldChange: true
                                });

                                if (existingData.gstamt <= 0) {
                                    currentRec.setValue({ fieldId: 'custbody_tss_it_taxamount', value: 0, ignoreFieldChange: true });
                                    currentRec.setValue({ fieldId: 'custbody_tss_it_igst_amount', value: '', ignoreFieldChange: true });
                                    currentRec.setValue({ fieldId: 'custbody_tss_cgst_amount', value: '', ignoreFieldChange: true });
                                    currentRec.setValue({ fieldId: 'custbody_tss_it_sgst_amount', value: '', ignoreFieldChange: true });
                                }
                                else {
                                    var gstRate = parseFloat(currentRec.getValue({ fieldId: 'custbody_tss_it_taxrate' })) || 0;
                                    var taxAmount = (parseFloat(existingData.gstamt) * (gstRate / 100)).toFixed(2);
                                    console.log("taxAmount in uncheck", taxAmount)
                                    applyGstSplit(currentRec, gstCode, taxAmount)
                                    currentRec.setValue({
                                        fieldId: 'custbody_tss_it_taxamount',
                                        value: taxAmount,
                                        ignoreFieldChange: true
                                    });
                                }
                            }


                        }
                    }

                }
            } catch (e) {
                log.error("Error in Field Changed ", e)
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
            try {
                if (isExpired) {
                    return true
                }
                var currentRec = scriptContext.currentRecord;
                // Sourcing the GSTIN and Place of Service from customer if customer is fieldchanged
                if (scriptContext.fieldId === 'customer') {
                    var currentrecordsubsidiary = currentRec.getValue({ fieldId: "subsidiary" });
                    var Flag = 0;
                    Flag = inArray(currentrecordsubsidiary, cachedGlobalSubsidiary);
                    if (Flag == parseInt(1)) {
                        if (formSetFlag) {
                            var customFormsObj = ''
                            var accountId = runtime.accountId;
                            log.debug('Account ID', accountId);
                            if (accountId.endsWith('_SB1')) {
                                customFormsObj = customFormsObjSb// SB3
                            }
                            else if (runtime.envType === runtime.EnvType.PRODUCTION) {
                                customFormsObj = customFormsObjProd
                                // console.log('Production');
                            }
                            var rec_form = currentRec.getValue({ fieldId: "customform" });
                            if ((rec_form != customFormsObj[currentRec.type]) && (_logValidation(customFormsObj[currentRec.type]))) {
                                currentRec.setValue({ fieldId: "customform", value: customFormsObj[currentRec.type] });
                            }
                        }
                        var currCustomer = currentRec.getValue({ fieldId: 'customer' });
                        log.debug("customer in customer fieldChanged", currCustomer)
                        if (currCustomer) {
                            var rec_POS = currentRec.getValue({ fieldId: 'custbody_tss_place_of_service' });

                            var resposeObject = https.requestSuitelet({
                                scriptId: "customscript_sut_tss_getstate_fromaddres",
                                deploymentId: "customdeploy1",
                                // external: true,
                                urlParams: {
                                    's_entiry_id': currCustomer,
                                    's_record_type': currentRec.type,
                                    's_getDefaultAddressData': true
                                }
                            });
                            // log.debug("resposeObject from suitelet ship/bill to", resposeObject);
                            if (_logValidation(resposeObject)) {
                                var respBody = JSON.parse(resposeObject.body);
                                // log.debug("respBody from suitelet ship/bill to", respBody);
                                if (_logValidation(respBody) && respBody.length > 0) {
                                    var resp_state = respBody[0].state;
                                    log.debug("resp_state from SUT_TSS_GetState_fromAddress in Ship To / Bill To fieldchanged", resp_state);
                                    var resp_gstin = respBody[0].gstinuid;
                                    log.debug("resp_gstin from SUT_TSS_GetState_fromAddress in Ship To / Bill To fieldchanged", resp_gstin);
                                    var entityGSTIN = respBody[0].entityGSTIN;
                                    log.debug("entityGSTIN from SUT_TSS_GetState_fromAddress in Ship To / Bill To fieldchanged", entityGSTIN);
                                    if (!_logValidation(resp_gstin) && _logValidation(entityGSTIN)) {
                                        var stateObj = search.lookupFields({
                                            type: 'customrecord_tss_gst_state_master',
                                            id: resp_state,
                                            columns: ['custrecord_tss_tin']
                                        });
                                        var stateCode = stateObj.custrecord_tss_tin;
                                        if (stateCode == entityGSTIN.slice(0, 2)) {
                                            resp_gstin = entityGSTIN
                                        }
                                    }
                                    if (rec_POS != resp_state) {
                                        currentRec.setValue({
                                            fieldId: 'custbody_tss_place_of_service',
                                            value: resp_state,
                                        });
                                    } // end if(i_Place_Of_Service != resp_state)
                                    currentRec.setValue({
                                        fieldId: 'custbody_tss_transaction_gstin_uid',
                                        value: resp_gstin,
                                    });
                                }
                            } // end if(_logValidation(resposeObject))
                        }
                    }

                }
                if (scriptContext.fieldId === 'subsidiary') {
                    var currentrecordsubsidiary = currentRec.getValue({ fieldId: "subsidiary" });
                    var Flag = 0;
                    Flag = inArray(currentrecordsubsidiary, cachedGlobalSubsidiary);
                    if (Flag == parseInt(1)) {
                        if (formSetFlag) {
                            var customFormsObj = ''
                            var accountId = runtime.accountId;
                            log.debug('Account ID', accountId);
                            if (accountId.endsWith('_SB1')) {
                                customFormsObj = customFormsObjSb// SB3
                            }
                            else if (runtime.envType === runtime.EnvType.PRODUCTION) {
                                customFormsObj = customFormsObjProd
                                // console.log('Production');
                            }
                            var rec_form = currentRec.getValue({ fieldId: "customform" });
                            if ((rec_form != customFormsObj[currentRec.type]) && (_logValidation(customFormsObj[currentRec.type]))) {
                                currentRec.setValue({ fieldId: "customform", value: customFormsObj[currentRec.type] });
                            }
                        }
                    }
                }


            } catch (error) {
                log.error("Error in postSourcing", error)
            }
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
                    if (inArray(recSub, cachedGlobalSubsidiary) == parseInt(1)) {
                        alert('TaxPro SuiteApp subscription needs renewal. Please contact your administrator.');
                    }
                    return true
                }
                var currentRec = scriptContext.currentRecord;
                var currentrecordsubsidiary = currentRec.getValue({ fieldId: "subsidiary" });
                var Flag = 0;
                Flag = inArray(currentrecordsubsidiary, cachedGlobalSubsidiary);
                if (Flag == parseInt(1)) {

                    var applyGst = currentRec.getValue({ fieldId: 'custbody_tss_it_apply_gst' });
                    var ExportGST = currentRec.getValue({ fieldId: 'custbody_tss_export_gst' });


                    if (applyGst && !ExportGST) {
                        var amountWithoutTax = currentRec.getValue({ fieldId: 'custbody_tss_it_amount_withouttax' });
                        var taxCode = currentRec.getValue({ fieldId: 'custbody_tss_it_tax_code' });
                        var taxRate = currentRec.getValue({ fieldId: 'custbody_tss_it_taxrate' });
                        var taxAmount = currentRec.getValue({ fieldId: 'custbody_tss_it_taxamount' });

                        if (!amountWithoutTax) {
                            alert('Please enter a value for Amount Without Tax');
                            return false;
                        }

                        if (taxCode) {
                            if (!taxRate) {
                                alert('Please enter a value for Tax Rate');
                                return false;
                            }
                            if (!taxAmount) {
                                alert('Please enter a value for Tax Amount');
                                return false;
                            }
                        }
                    }
                    if (ExportGST) {
                        var PaymentUnder = currentRec.getValue({ fieldId: 'custbody_tss_gst_payment_under' });
                        var taxCode = currentRec.getValue({ fieldId: 'custbody_tss_it_tax_code' });
                        if (!PaymentUnder) {
                            alert('Please enter a value for Payment Under Field');
                            return false;
                        }
                        if (!taxCode) {
                            alert('Please enter a value for Tax Code');
                            return false;
                        }
                        var JournalId = currentRec.getValue({ fieldId: 'custbody_tss_lut_journal_invoice' });
                        var taxAmount = parseFloat(currentRec.getValue({ fieldId: 'custbody_tss_it_taxamount' })) || 0;
                        if (currentRec.type == 'depositapplication') {
                            // if (!JournalId) {
                            //     ReverseJournal(currentRec)
                            // }
                            if (JournalId) {
                                UpdateJournalEntry(JournalId, taxAmount, currentRec)
                            }
                        }
                    }


                }


                return true;
            } catch (e) {
                log.error('Error in saveRecord', e);
                return true;
            }
        }


        function handleAutoApply(currentRec) {
            try {
                var lineCount = currentRec.getLineCount({ sublistId: 'apply' });
                var CompareisExport = currentRec.getValue({ fieldId: 'custbody_tss_export_gst' });
                var ComparePaymentValue = currentRec.getText({ fieldId: 'custbody_tss_gst_payment_under' });
                var CompareTaxcode = currentRec.getValue({ fieldId: "custbody_tss_it_tax_code" });
                var CompareTaxRate = currentRec.getValue({ fieldId: "custbody_tss_it_taxrate" });
                console.log("CompareisExport", CompareisExport)
                console.log("ComparePaymentValue", ComparePaymentValue)
                console.log("CompareTaxcode", CompareTaxcode)

                var existingData = { gstamt: 0, gstinvoice: {} };
                var remainingAmt = parseFloat(currentRec.getValue({ fieldId: 'custbody_tss_it_amount_withouttax' }) || 0)
                log.debug("remainingAmt in handleAutoApply", remainingAmt)

                var failedLines = []; // <-- collect failed line numbers
                log.debug("lineCount", lineCount)

                var sublistObj = {}
                var tranArr = []

                for (var i = 0; i < lineCount; i++) {
                    var isApplied = currentRec.getSublistValue({
                        sublistId: 'apply',
                        fieldId: 'apply',
                        line: i
                    });
                    console.log("isApplied line " + i, isApplied);

                    if (isApplied) {
                        var invoiceid = currentRec.getSublistValue({
                            sublistId: 'apply',
                            fieldId: 'doc',
                            line: i
                        });
                        var tranType = currentRec.getSublistValue({
                            sublistId: 'apply',
                            fieldId: 'trantype',
                            line: i
                        });
                        var amount = currentRec.getSublistValue({
                            sublistId: 'apply',
                            fieldId: 'amount',
                            line: i
                        }) || 0;
                        console.log("isApplied invoiceid " + i, invoiceid);
                        console.log("isApplied amount " + i, amount);

                        if (invoiceid && amount) {
                            if (invoiceid && amount) {
                                sublistObj[invoiceid] = {}
                                sublistObj[invoiceid]['amount'] = amount
                                sublistObj[invoiceid]['line'] = i
                                tranArr.push(invoiceid)
                            }
                        }
                    }
                }
                console.log("tranArr", tranArr)




                var invoiceResults = InvoiceSearch(tranArr, 'All', true);
                let mergedResults = {};

                invoiceResults.forEach(function (rec) {
                    let id = rec.internalid;
                    // console.log("id", id)
                    if (!mergedResults[id]) {
                        mergedResults[id] = {
                            internalid: id,
                            lines: []
                        };
                    }

                    mergedResults[id].lines.push({
                        internalid: rec.internalid,
                        type: rec.type,
                        taxcode: rec.taxcode,
                        taxrate: rec.taxrate,
                        amount: rec.amount,
                        account: rec.account,
                        exportgst: rec.exportgst,
                        paymentunder: rec.paymentunder
                    });
                });
                log.debug("mergedResults", mergedResults)

                for (const tranId of tranArr) {
                    var matchFoundFlag = false;
                    if (Object.keys(mergedResults).length > 0) {
                        var lineTranResults1 = mergedResults[tranId].lines
                        console.log("lineTranResults1 ", tranId + "-" + lineTranResults1)
                        if (lineTranResults1.length > 0) {
                            var ExportButton = lineTranResults1[0].exportgst;
                            var PaymentValue = lineTranResults1[0].paymentunder;
                            console.log("CompareisExport == ExportButton", CompareisExport + ' == ' + ExportButton)
                            console.log("ComparePaymentValue == PaymentValue", ComparePaymentValue + ' == ' + PaymentValue)
                            if (CompareisExport == ExportButton && ComparePaymentValue == PaymentValue) {
                                lineTranResults1.forEach(function (line) {
                                    var taxCode = '';

                                    if (PaymentValue == 'Export without LUT' && ExportButton == true) {
                                        taxCode = line.lutTaxcode;
                                        console.log("in LUT", taxCode);
                                    } else {
                                        taxCode = line.taxcode;
                                        console.log("not in LUT", taxCode);
                                    }

                                    if (taxCode == CompareTaxcode) {
                                        // console.log("taxCode == CompareTaxcode",taxCode+' == '+CompareTaxcode)
                                    }
                                    else {
                                        console.log("taxCode == CompareTaxcode", tranId + "-id-" + taxCode + ' == ' + CompareTaxcode)
                                        matchFoundFlag = true;
                                    }
                                });
                            }
                            else {
                                matchFoundFlag = true;
                                console.log("not matched export values")
                            }
                        }

                        console.log("matchFoundFlag", matchFoundFlag)
                        if (!matchFoundFlag) {
                            var lineAmt = sublistObj[tranId]['amount']
                            var invBaseAmt = (parseFloat(lineAmt) / (1 + parseFloat(CompareTaxRate) / 100)).toFixed(2)
                            var invTaxAmt = (parseFloat(lineAmt) - parseFloat(invBaseAmt)).toFixed(2)
                            existingData.gstinvoice[invoiceid] = { "taxamt": parseFloat(invTaxAmt) || 0, "baseamt": parseFloat(invBaseAmt) || 0 };
                            // if (remainingAmt < parseFloat(parseFloat(amount) + existingData.gstamt)) {
                            //     existingData.gstamt = remainingAmt
                            // } else {
                            existingData.gstamt += parseFloat(invBaseAmt) || 0;
                            // }
                        } else {
                            failedLines.push(sublistObj[tranId]['line']); // <-- mark this line as failed
                        }
                    }
                    else {
                        alert("No results found for transactions in search, Please contact Administrator")

                    }
                }


                console.log("failedLines after loop", failedLines)

                // 🚨 After loop, handle all failed lines at once
                if (failedLines.length > 0) {
                    dialog.alert({
                        title: 'Alert',
                        message: 'GST Tax Code is not matching with the Invoice. Please Apply to the Valid Invoice ',
                    });
                    failedLines.forEach(function (line) {
                        currentRec.selectLine({ sublistId: 'apply', line: line });
                        currentRec.setCurrentSublistValue({
                            sublistId: 'apply',
                            fieldId: 'apply',
                            value: false,
                        });
                        currentRec.setCurrentSublistValue({
                            sublistId: 'apply',
                            fieldId: 'amount',
                            value: '',
                        });
                        currentRec.commitLine({ sublistId: 'apply' });
                    });
                }
                console.log("existingData after loop", existingData)

                currentRec.setValue({
                    fieldId: 'custbody_tss_it_appliedamt_withouttax',
                    value: JSON.stringify(existingData),
                    ignoreFieldChange: true
                });
                var linebase = existingData.gstamt
                var gstRate = parseFloat(currentRec.getValue({ fieldId: 'custbody_tss_it_taxrate' })) || 0;
                var taxAmount = linebase * (gstRate / 100);
                console.log("taxAmount", taxAmount)

                applyGstSplit(currentRec, gstCode, taxAmount)
                currentRec.setValue({
                    fieldId: 'custbody_tss_it_taxamount',
                    value: parseFloat(taxAmount).toFixed(2),
                    ignoreFieldChange: true
                });

                console.log("GST updated after Auto Apply", existingData);

            } catch (e) {
                log.error("Error in handleAutoApply", e);
            }
        }



        function resetGST(currentRec) {
            var existingData = { gstamt: 0, gstinvoice: {} };
            currentRec.setValue({
                fieldId: 'custbody_tss_it_appliedamt_withouttax',
                value: JSON.stringify(existingData),
                ignoreFieldChange: true
            });
            currentRec.setValue({ fieldId: 'custbody_tss_it_taxamount', value: 0, ignoreFieldChange: true });
            currentRec.setValue({ fieldId: 'custbody_tss_it_igst_amount', value: '', ignoreFieldChange: true });
            currentRec.setValue({ fieldId: 'custbody_tss_cgst_amount', value: '', ignoreFieldChange: true });
            currentRec.setValue({ fieldId: 'custbody_tss_it_sgst_amount', value: '', ignoreFieldChange: true });
        }





        function clearGstFields(currentRec) {
            var gstFields = [
                'custbody_tss_it_tax_code',
                'custbody_tss_it_taxrate',
                'custbody_tss_it_taxamount',
                'custbody_tss_it_igst_amount',
                'custbody_tss_it_sgst_amount',
                'custbody_tss_cgst_amount',

            ];
            gstFields.forEach(function (fieldId) {
                currentRec.setValue({
                    fieldId: fieldId,
                    value: '',
                    ignoreFieldChange: true
                });
            });
        }

        function applyGstSplit(currentRec, gstCode, taxAmount) {
            if (gstCode.toUpperCase().includes("IGST")) {
                currentRec.setValue({ fieldId: 'custbody_tss_it_igst_amount', value: parseFloat(taxAmount).toFixed(2), ignoreFieldChange: true });
                currentRec.setValue({ fieldId: 'custbody_tss_cgst_amount', value: '', ignoreFieldChange: true });
                currentRec.setValue({ fieldId: 'custbody_tss_it_sgst_amount', value: '', ignoreFieldChange: true });
            } else if (gstCode.toUpperCase().includes("GST")) {
                let half = parseFloat(taxAmount / 2).toFixed(2);
                var half2 = (taxAmount - half).toFixed(2)
                console.log("split amts", half + '-' + half2)
                currentRec.setValue({ fieldId: 'custbody_tss_it_sgst_amount', value: Math.max(half, half2), ignoreFieldChange: true });
                currentRec.setValue({ fieldId: 'custbody_tss_cgst_amount', value: Math.min(half, half2), ignoreFieldChange: true });
                currentRec.setValue({ fieldId: 'custbody_tss_it_igst_amount', value: '', ignoreFieldChange: true });
            }
        }



        function Settingvalues(currentRec, taxcodechange) {
            if (taxcodechange) {
                currentRec.setValue({ fieldId: 'custbody_tss_cgst_amount', value: 0, ignoreFieldChange: true });
                currentRec.setValue({ fieldId: 'custbody_tss_it_sgst_amount', value: 0, ignoreFieldChange: true });
                currentRec.setValue({ fieldId: 'custbody_tss_it_igst_amount', value: 0, ignoreFieldChange: true });
                currentRec.setValue({ fieldId: 'custbody_tss_it_taxamount', value: '', ignoreFieldChange: true });
            }
            var gstAmount = parseFloat(currentRec.getValue({ fieldId: 'custbody_tss_it_amount_withouttax' })) || 0;
            var gstRate = parseFloat(currentRec.getValue({ fieldId: 'custbody_tss_it_taxrate' })) || 0;
            var gstTaxAmount = parseFloat(currentRec.getValue({ fieldId: 'custbody_tss_it_taxamount' }));
            var gstCode = currentRec.getText({ fieldId: 'custbody_tss_it_tax_code' })
            var taxAmount = 0;
            log.debug('gstAmount', gstAmount);
            log.debug('gstRate', gstRate);
            log.debug('gstTaxAmount', gstTaxAmount);
            log.debug('gstCode', gstCode);
            // if (gstTaxAmount !== null && gstTaxAmount !== '' && !isNaN(gstTaxAmount) && gstTaxAmount != 0) {
            //     taxAmount = gstTaxAmount;
            // } else {
            taxAmount = gstAmount * (gstRate / 100);
            // }
            log.debug('taxAmount', taxAmount);
            var TotalAmount = gstAmount + taxAmount
            applyGstSplit(currentRec, gstCode, taxAmount)
            currentRec.getField({ fieldId: 'custbody_tss_cgst_amount' }).isDisabled = true;
            currentRec.getField({ fieldId: 'custbody_tss_it_sgst_amount' }).isDisabled = true;
            currentRec.getField({ fieldId: 'custbody_tss_it_igst_amount' }).isDisabled = true;
            currentRec.setValue({
                fieldId: 'custbody_tss_it_taxamount',
                value: parseFloat(taxAmount).toFixed(2),
                ignoreFieldChange: true
            });
            currentRec.setValue({
                fieldId: 'payment',
                value: TotalAmount,
                ignoreFieldChange: true
            });
            var JournalId = currentRec.getValue({ fieldId: 'custbody_tss_lut_journal_invoice' });
            log.debug('JournalId', JournalId);
            if (JournalId) {
                UpdateJournalEntry(JournalId, taxAmount, currentRec)

            }

        }

        function UpdateJournalEntry(JournalId, taxAmount, currentRec) {
            try {
                let journalRec = record.load({
                    type: record.Type.JOURNAL_ENTRY,
                    id: JournalId,
                    isDynamic: true
                });

                let lineCount = journalRec.getLineCount({ sublistId: 'line' });
                let updated = false;

                let debitLines = [];
                let creditLines = [];

                // First separate debit vs credit lines
                for (let i = 0; i < lineCount; i++) {
                    let debit = parseFloat(journalRec.getSublistValue({
                        sublistId: 'line',
                        fieldId: 'debit',
                        line: i
                    })) || 0;
                    let credit = parseFloat(journalRec.getSublistValue({
                        sublistId: 'line',
                        fieldId: 'credit',
                        line: i
                    })) || 0;

                    if (debit > 0 || debit !== 0) {
                        debitLines.push(i);
                    }
                    if (credit > 0 || credit !== 0) {
                        creditLines.push(i);
                    }
                }

                // ✅ Update debit lines with taxAmount if needed
                for (let i of debitLines) {
                    let existing = parseFloat(journalRec.getSublistValue({
                        sublistId: 'line',
                        fieldId: 'debit',
                        line: i
                    })) || 0;

                    if (existing !== taxAmount) {
                        journalRec.selectLine({ sublistId: 'line', line: i });
                        journalRec.setCurrentSublistValue({
                            sublistId: 'line',
                            fieldId: 'debit',
                            value: taxAmount
                        });
                        journalRec.commitLine({ sublistId: 'line' });
                        updated = true;
                    }
                }

                // ✅ Update credit lines depending on count
                if (creditLines.length === 2) {
                    let cgstAmt = parseFloat(currentRec.getValue({ fieldId: 'custbody_tss_cgst_amount' })) || 0;
                    let sgstAmt = parseFloat(currentRec.getValue({ fieldId: 'custbody_tss_it_sgst_amount' })) || 0;

                    // first credit line = CGST
                    let existing1 = parseFloat(journalRec.getSublistValue({
                        sublistId: 'line',
                        fieldId: 'credit',
                        line: creditLines[0]
                    })) || 0;

                    if (existing1 !== cgstAmt) {
                        journalRec.selectLine({ sublistId: 'line', line: creditLines[0] });
                        journalRec.setCurrentSublistValue({
                            sublistId: 'line',
                            fieldId: 'credit',
                            value: cgstAmt
                        });
                        journalRec.commitLine({ sublistId: 'line' });
                        updated = true;
                    }

                    // second credit line = SGST
                    let existing2 = parseFloat(journalRec.getSublistValue({
                        sublistId: 'line',
                        fieldId: 'credit',
                        line: creditLines[1]
                    })) || 0;

                    if (existing2 !== sgstAmt) {
                        journalRec.selectLine({ sublistId: 'line', line: creditLines[1] });
                        journalRec.setCurrentSublistValue({
                            sublistId: 'line',
                            fieldId: 'credit',
                            value: sgstAmt
                        });
                        journalRec.commitLine({ sublistId: 'line' });
                        updated = true;
                    }

                } else if (creditLines.length === 1) {
                    let igstAmt = parseFloat(currentRec.getValue({ fieldId: 'custbody_tss_it_igst_amount' })) || 0;

                    let existing = parseFloat(journalRec.getSublistValue({
                        sublistId: 'line',
                        fieldId: 'credit',
                        line: creditLines[0]
                    })) || 0;

                    if (existing !== igstAmt) {
                        journalRec.selectLine({ sublistId: 'line', line: creditLines[0] });
                        journalRec.setCurrentSublistValue({
                            sublistId: 'line',
                            fieldId: 'credit',
                            value: igstAmt
                        });
                        journalRec.commitLine({ sublistId: 'line' });
                        updated = true;
                    }
                }

                // ✅ Save only if something changed
                if (updated) {
                    journalRec.setValue({ fieldId: 'custbody_tss_lut_journal_invoice', value: currentRec.id });

                    let updatedId = journalRec.save({ ignoreMandatoryFields: true });
                    log.debug('Journal Updated', 'Updated Journal ID: ' + updatedId);
                } else {
                    log.debug('No Update Needed', 'Journal already has correct amounts');
                }
                // let suiteletUrl = url.resolveScript({
                //     scriptId: 'customscript_create_update_journal', // Suitelet script id
                //     deploymentId: 'customdeploy_create_update_journal',
                //     returnExternalUrl: false
                // });

                // // Call Suitelet
                // let response = https.post({
                //     url: suiteletUrl,
                //     body: JSON.stringify({ depositId: currentRec.id })
                // });

                // let res = JSON.parse(response.body);

                // if (res.success) {
                //     message.create({
                //         title: 'Success',
                //         message: res.msg,
                //         type: message.Type.CONFIRMATION
                //     }).show({ duration: 5000 });
                //     location.reload();
                // } else {
                //     alert("Error: " + res.msg);
                // }

            } catch (e) {
                log.error('Error Updating Journal', e);
            }
        }
        function GetTaxRatefromTaxCode(taxcodeInternalid) {
            var taxRate = ''
            if (taxcodeInternalid) {
                var salestaxitemSearchObj = search.create({
                    type: "taxgroup",
                    filters:
                        [
                            ["internalid", "anyof", taxcodeInternalid], "AND",
                            ["isinactive", "is", "F"],
                            "AND",

                            ["taxtype", "anyof", "5", "4"]

                        ],
                    columns:
                        [
                            search.createColumn({ name: "name", label: "Name" }),
                            search.createColumn({ name: "rate", label: "Rate" }),

                        ]
                });
                var salestaxitemSearchResults = salestaxitemSearchObj.run().getRange({ start: 0, end: 1000 });
            }
            if (salestaxitemSearchResults.length > 0) {
                taxRate = salestaxitemSearchResults[0].getValue({ name: 'rate' });
            }
            else {
                return alert("Selected Tax Code is not GST Group or IGST Group. Please select a valid tax code.");

            }


            return taxRate
        }
        function GettingGlobalParameter() {
            var GlobalSubsidiary = ''
            var GlobalGSTpaid = ''

            var GlobalParameterSearch = search.create({
                type: "customrecord_tss_global_parameter",
                filters: [["isinactive", "is", "F"]],
                columns: [
                    search.createColumn({ name: "internalid", label: "Internalid" }),
                    search.createColumn({ name: "custrecord_tss_gp_subsidiary", label: "Internalid" }),
                    search.createColumn({ name: "custrecord_tss_gp_lut_gstrefund", label: "Internalid" }),
                    search.createColumn({ name: 'custrecord_tss_gp_subscription_end', })

                ]
            });
            var GlobalParameterSearchResults = GlobalParameterSearch.run().getRange({ start: 0, end: 1000 });
            if (GlobalParameterSearchResults.length > 0) {
                GlobalSubsidiary = GlobalParameterSearchResults[0].getValue({ name: 'custrecord_tss_gp_subsidiary' });
                GlobalGSTpaid = GlobalParameterSearchResults[0].getValue({ name: 'custrecord_tss_gp_lut_gstrefund' });
                isExpired = GlobalParameterSearchResults[0].getValue({ name: 'custrecord_tss_gp_subscription_end' });

            }
            return [GlobalSubsidiary, GlobalGSTpaid]

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
        function _logValidation(value) {
            if (value != 'null' && value != null && value != null && value != '' && value != undefined && value != undefined && value != 'undefined' && value != 'undefined' && value != 'NaN' && value != NaN) {
                return true;
            }
            else {
                return false;
            }
        }

        function createJournal() {
            try {

                // let suiteletUrl = url.resolveScript({
                //     scriptId: 'customscript_create_update_journal', // Suitelet script id
                //     deploymentId: 'customdeploy_create_update_journal',
                //     returnExternalUrl: false
                // });

                // // Call Suitelet
                // let response = https.post({
                //     url: suiteletUrl,
                //     body: JSON.stringify({ depositId: recId })
                // });

                // let res = JSON.parse(response.body);

                // if (res.success) {
                //     message.create({
                //         title: 'Success',
                //         message: res.msg,
                //         type: message.Type.CONFIRMATION
                //     }).show({ duration: 5000 });
                //     location.reload();
                // } else {
                //     alert("Error: " + res.msg);
                // }
                // showPreloader();
                log.debug("Creating Journal Entry");
                var currRec = currentRecord.get();
                var recId = currRec.id;
                var Customerdeposit = record.load({ type: record.Type.CUSTOMER_DEPOSIT, id: recId });
                var taxGroupId = Customerdeposit.getValue({ fieldId: 'custbody_tss_it_tax_code' });
                if (taxGroupId) {
                    var taxGroup = record.load({
                        type: 'taxgroup',
                        id: taxGroupId
                    });

                    var taxItemLineCount = taxGroup.getLineCount({ sublistId: 'taxitem' });
                    var taxAccountMap = {};

                    for (var i = 0; i < taxItemLineCount; i++) {
                        var taxItemId = taxGroup.getSublistValue({
                            sublistId: 'taxitem',
                            fieldId: 'taxname',
                            line: i
                        });

                        var taxType = taxGroup.getSublistText({
                            sublistId: 'taxitem',
                            fieldId: 'taxtype',
                            line: i
                        });

                        if (taxItemId && taxType) {
                            var taxItemDetails = search.lookupFields({
                                type: "salestaxitem",
                                id: taxItemId,
                                columns: ['saleaccount']
                            });

                            var accountId = (taxItemDetails.saleaccount && taxItemDetails.saleaccount.length > 0)
                                ? taxItemDetails.saleaccount[0].value
                                : null;

                            taxAccountMap[taxType.toUpperCase()] = accountId;
                        }
                    }
                }
                var GSTPaidACcount = GettingGlobalParameter()

                // Example Journal Entry creation
                var je = record.create({ type: record.Type.JOURNAL_ENTRY, isDynamic: true });
                je.setValue({ fieldId: 'subsidiary', value: Customerdeposit.getValue({ fieldId: 'subsidiary' }) });
                je.setValue({ fieldId: 'currency', value: Customerdeposit.getValue({ fieldId: 'currency' }) });
                je.setValue({ fieldId: 'custbody_tss_lut_journal_invoice', value: recId });

                // Debit line
                je.selectNewLine({ sublistId: 'line' });
                je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'account', value: GSTPaidACcount[1] }); // replace with account internalid
                je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'debit', value: parseFloat(Customerdeposit.getValue({ fieldId: 'custbody_tss_it_taxamount' })).toFixed(2) });
                je.commitLine({ sublistId: 'line' });

                // Credit line
                je.selectNewLine({ sublistId: 'line' });
                je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'account', value: parseInt(taxAccountMap['IGST']) }); // replace with account internalid
                je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'credit', value: parseFloat(Customerdeposit.getValue({ fieldId: 'custbody_tss_it_igst_amount' })).toFixed(2) });
                je.commitLine({ sublistId: 'line' });

                var jeId = je.save();
                Customerdeposit.setValue({ fieldId: 'custbody_tss_lut_journal_invoice', value: jeId });
                Customerdeposit.save();

                message.create({
                    title: 'Success',
                    message: 'Journal Entry created successfully with ID: ' + jeId,
                    type: message.Type.CONFIRMATION
                }).show({ duration: 5000 });
                location.reload();
                // hidePreloader();
            } catch (e) {
                // alert("Error creating Journal Entry: " + e.message);
                // hidePreloader();
            }
        }
        function showPreloader() {

            const loader = document.createElement("div");

            loader.id = "customPreloader";

            loader.style.position = "fixed";

            loader.style.top = "0";

            loader.style.left = "0";

            loader.style.width = "100%";

            loader.style.height = "100%";

            loader.style.background = "rgba(0, 0, 0, 0.4)";

            loader.style.display = "flex";

            loader.style.justifyContent = "center";

            loader.style.alignItems = "center";

            loader.style.zIndex = "9999";

            loader.innerHTML = `<div style="padding:20px; background:white; border-radius:8px; font-size:16px;">Loading... Please wait</div>`;

            document.body.appendChild(loader);

        }

        function hidePreloader() {

            const loader = document.getElementById("customPreloader");

            if (loader) {

                loader.remove();

            }

        }

        function InvoiceSearch(internalid, tranType, isAll) {
            var InvoiceData = [];
            console.log("tranType", tranType)
            if (tranType == 'All' || tranType == 'CustInvc') {
                var transactionSearchObj = search.create({
                    type: "transaction",
                    settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                    filters:
                        [
                            ["type", "anyof", ["CustInvc", "CustRfnd"]],
                            "AND",
                            ["internalid", "anyof", internalid],
                            "AND",
                            ["mainline", "is", "F"],
                            "AND",
                            ["cogs", "is", "F"],
                            "AND",
                            ["taxline", "is", "F"]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "ordertype", label: "Order Type" }),
                            search.createColumn({ name: "taxcode", label: "Tax Item" }),
                            search.createColumn({ name: "custcol_tss_lut_taxcode", label: "Tax Item" }),

                            search.createColumn({ name: "fxamount", label: "Amount (Foreign Currency)" }),
                            search.createColumn({ name: "trandate", label: "Date" }),
                            search.createColumn({ name: "account", label: "Account" }),
                            search.createColumn({ name: "custbody_tss_export_gst", label: "Export" }),
                            search.createColumn({ name: "custbody_tss_gst_payment_under", label: "Payment of GST Under Export" })
                        ]
                });
                if (isAll) {
                    var pagedData = transactionSearchObj.runPaged({ pageSize: 1000 });
                    log.debug("Total Results", pagedData.count);

                    pagedData.pageRanges.forEach(function (pageRange) {
                        var page = pagedData.fetch({ index: pageRange.index });
                        page.data.forEach(function (result) {
                            if (result.recordType == 'invoice') {
                                InvoiceData.push({
                                    internalid: result.id,
                                    type: result.recordType,
                                    taxcode: result.getValue({ name: "taxcode" }),
                                    lutTaxcode: result.getValue({ name: "custcol_tss_lut_taxcode" }),
                                    taxrate: result.getValue({ name: "taxrate1" }),
                                    amount: Math.abs(parseFloat(result.getValue({ name: "fxamount" })) || 0),
                                    account: result.getValue({ name: "account" }),
                                    exportgst: result.getValue({ name: "custbody_tss_export_gst" }),
                                    paymentunder: result.getText({ name: "custbody_tss_gst_payment_under" })
                                });
                            }
                            else {
                                InvoiceData.push({
                                    internalid: result.id,
                                    type: result.recordType,
                                    taxcode: result.getValue({ name: "custbody_tss_it_tax_code" }),
                                    lutTaxcode: result.getValue({ name: "custbody_tss_it_tax_code" }),
                                    taxrate: result.getValue({ name: "taxrate1" }),
                                    amount: Math.abs(parseFloat(result.getValue({ name: "fxamount" })) || 0),
                                    account: result.getValue({ name: "account" }),
                                    exportgst: result.getValue({ name: "custbody_tss_export_gst" }),
                                    paymentunder: result.getText({ name: "custbody_tss_gst_payment_under" })
                                });
                            }
                        });
                    });
                }
                else {
                    var searchResultCount = transactionSearchObj.runPaged().count;
                    log.debug("transactionSearchObj result count", searchResultCount);

                    transactionSearchObj.run().each(function (result) {
                        if (result.recordType == 'invoice') {
                            InvoiceData.push({
                                internalid: result.id,
                                type: result.recordType,
                                taxcode: result.getValue({ name: "taxcode" }),
                                lutTaxcode: result.getValue({ name: "custcol_tss_lut_taxcode" }),
                                taxrate: result.getValue({ name: "taxrate1" }),
                                amount: Math.abs(parseFloat(result.getValue({ name: "fxamount" })) || 0),
                                account: result.getValue({ name: "account" }),
                                exportgst: result.getValue({ name: "custbody_tss_export_gst" }),
                                paymentunder: result.getText({ name: "custbody_tss_gst_payment_under" })
                            });
                        }
                        else {
                            InvoiceData.push({
                                internalid: result.id,
                                type: result.recordType,
                                taxcode: result.getValue({ name: "custbody_tss_it_tax_code" }),
                                lutTaxcode: result.getValue({ name: "custbody_tss_it_tax_code" }),
                                taxrate: result.getValue({ name: "taxrate1" }),
                                amount: Math.abs(parseFloat(result.getValue({ name: "fxamount" })) || 0),
                                account: result.getValue({ name: "account" }),
                                exportgst: result.getValue({ name: "custbody_tss_export_gst" }),
                                paymentunder: result.getText({ name: "custbody_tss_gst_payment_under" })
                            });
                        }
                        return true;
                    });
                }
            }
            else if (tranType == 'CustRfnd') {
                var refundObj = search.lookupFields({
                    type: 'customerrefund',
                    id: internalid,
                    columns: [
                        'amount', 'custbody_tss_it_tax_code', 'custbody_tss_it_taxrate',
                        'custbody_tss_export_gst', 'custbody_tss_gst_payment_under'
                    ]
                })
                log.debug("refundObj", refundObj)
                InvoiceData.push({
                    taxcode: refundObj.custbody_tss_it_tax_code ? refundObj.custbody_tss_it_tax_code[0] ? refundObj.custbody_tss_it_tax_code[0].value : '' : '',
                    lutTaxcode: '',
                    taxrate: refundObj.custbody_tss_it_taxrate,
                    amount: refundObj.amount,
                    account: '',
                    exportgst: refundObj.custbody_tss_export_gst,
                    paymentunder: refundObj.custbody_tss_gst_payment_under ? refundObj.custbody_tss_gst_payment_under[0] ? refundObj.custbody_tss_gst_payment_under[0].text : '' : ''
                });
            }
            log.debug("InvoiceData", InvoiceData);
            return InvoiceData;
        }

        function storeSessionData(obj) {
            sessionStorage.setItem('appliedTaxObj', JSON.stringify(obj));

        }

        function getSessionData() {
            var obj = {}
            var data = sessionStorage.getItem('appliedTaxObj');
            if (data) {
                obj = JSON.parse(data);
            }
            return obj
        }



        return {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            postSourcing: postSourcing,
            saveRecord: saveRecord,
            createJournal: createJournal
        };

    });