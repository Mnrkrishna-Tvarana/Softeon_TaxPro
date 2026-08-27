/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(["N/record", "N/search", 'N/error', 'N/runtime'], function (record, search, error, runtime) {
    var formSetFlag = true;
    var customFormsObjSb = {
        'purchaseorder': 201, 'vendorprepayment': 203, 'vendorbill': 193, 'vendorreturnauthorization': '', 'vendorcredit': 194, 'billpayment': '',
        'salesorder': 202, 'invoice': 199, 'returnauthorization': '', 'creditmemo': 197, 'customerpayments': '', 'cashsale': 195, 'customerrefund': 176, 'customerdeposit': 204
    }
    var customFormsObjProd = {
        'purchaseorder': 201, 'vendorprepayment': 203, 'vendorbill': 193, 'vendorreturnauthorization': '', 'vendorcredit': 194, 'billpayment': '',
        'salesorder': 202, 'invoice': 199, 'returnauthorization': '', 'creditmemo': 197, 'customerpayments': '', 'cashsale': 195, 'customerrefund': 176, 'customerdeposit': 204
    }
    function beforeSubmit(context) {
        try {
            var rec = context.newRecord;
            var mode = context.type;
            log.debug("rec", rec)
            if (context.type === context.UserEventType.COPY) {
                var rec = context.newRecord;

                // Uncheck Apply Tax (replace with your actual field id)
                rec.setValue({
                    fieldId: 'custbody_tss_it_apply_gst',
                    value: false
                });

                clearGstFields(rec);

                log.debug('COPY MODE', 'Apply Tax unchecked and GST fields cleared');
            }
            if (context.type === context.UserEventType.DELETE) {
                var appSearch = search.create({
                    type: "vendorprepaymentapplication",
                    filters: [
                        ['appliedtotransaction', 'anyof', rec.id],
                        "AND",
                        ['appliedtotransaction.type', 'anyof', ['VPrep']],
                    ],
                    columns: ['internalid']
                });

                var hasApplication = false;

                appSearch.run().each(function () {
                    hasApplication = true;
                    return false;
                });

                if (hasApplication) {
                    throw error.create({
                        name: 'PREPAYMENT_APPLICATION_EXISTS',
                        message: 'This transaction cannot be deleted because a Vendor Prepayment Application is already applied.',

                    });
                }

            }

            if (context.type === context.UserEventType.XEDIT) {
                var newRec = context.newRecord;
                var oldRec = context.oldRecord;
                var subsidiary = getValueSafe('subsidiary', newRec, oldRec);
            }
            else {
                var subsidiary = rec.getValue("subsidiary");
            }
            var globalSubsidiary = GettingGlobalParameter();
            log.debug("subsidiary", subsidiary)
            log.debug("globalSubsidiary", globalSubsidiary)

            var Flag = 0;
            Flag = inArray(subsidiary, globalSubsidiary);
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
                    var rec_form = rec.getValue({ fieldId: "customform" });
                    if ((rec_form != customFormsObj[rec.type]) && (_logValidation(customFormsObj[rec.type]))) {
                        rec.setValue({ fieldId: "customform", value: customFormsObj[rec.type] });
                    }
                }
                if (context.type === context.UserEventType.XEDIT) {
                    var newRec = context.newRecord;
                    var oldRec = context.oldRecord;
                    var applyGst = getValueSafe('custbody_tss_it_apply_gst', newRec, oldRec);
                    var amountWithoutTax = getValueSafe('custbody_tss_it_amount_withouttax', newRec, oldRec);
                    var payment = getValueSafe('payment', newRec, oldRec);
                    var taxCode = getValueSafe('custbody_tss_it_tax_code', newRec, oldRec);

                }
                else {
                    var applyGst = rec.getValue("custbody_tss_it_apply_gst");
                    var amountWithoutTax = parseFloat(rec.getValue("custbody_tss_it_amount_withouttax")) || 0;
                    var payment = parseFloat(rec.getValue("payment")) || 0;;
                    var taxCode = rec.getValue("custbody_tss_it_tax_code");

                }


                if (!applyGst) {
                    clearGstFields(rec);
                    rec.setValue('custbody_tss_tds_relation', "");
                    rec.setValue("custbody_tss_tds_account", "");
                    rec.setValue('custbody_tss_tds_percentage', "");
                    rec.setValue("custbody_tss_tds_amount", "");
                    rec.setValue("custbody_tss_tds_baseamt", "");
                    rec.setValue("custbody_tss_tds_section", "");
                    if (!applyGst && amountWithoutTax) {
                        rec.setValue("payment", amountWithoutTax);
                        rec.setValue("custbody_tss_it_amount_withouttax", '');

                    }
                    return true;
                }


                if (!amountWithoutTax && payment && applyGst) {
                    rec.setValue("custbody_tss_it_amount_withouttax", payment);
                    amountWithoutTax = payment;
                }


                if (!amountWithoutTax) {
                    throw error.create({
                        name: "AMOUNT_REQUIRED",
                        message: "Amount Without Tax is mandatory when Apply GST is checked."
                    });
                }




                log.debug("taxCode", taxCode)


                if (taxCode) {
                    var taxCodeText = getTaxCodeName(taxCode);

                    log.debug("taxCodeText", taxCodeText);

                    if (taxCodeText && taxCodeText.includes("GST Group") || taxCodeText.includes("IGST Group")) {
                        taxRate = getTaxRateFromTaxCode(taxCode);
                        log.debug("taxRate", taxRate);
                        rec.setValue("custbody_tss_it_taxrate", taxRate);


                        taxAmount = parseFloat(amountWithoutTax * (taxRate / 100));
                        log.debug("taxAmount", taxAmount);

                        rec.setValue("custbody_tss_it_taxamount", taxAmount);

                        var total = amountWithoutTax + taxAmount;
                        rec.setValue("payment", total);


                        applyTaxSplit(rec, taxCodeText, taxAmount);
                    } else {

                        clearGstFields(rec);
                        throw error.create({
                            name: "TAXCODE_MISMATCH",
                            message: "Please select a valid GST Group or IGST Group tax code."
                        });
                    }

                    var taxRate = rec.getValue("custbody_tss_it_taxrate");
                    var taxAmount = rec.getValue("custbody_tss_it_taxamount");
                    if (!taxRate) {
                        throw error.create({
                            name: "TAXRATE_REQUIRED",
                            message: "Tax Rate is mandatory when Tax Code is selected."
                        });
                    }
                    if (!taxAmount) {
                        throw error.create({
                            name: "TAXAMOUNT_REQUIRED",
                            message: "Tax Amount is mandatory when Tax Amount is selected."
                        });
                    }
                }


                //tds
                if (context.type === context.UserEventType.XEDIT) {
                    var newRec = context.newRecord;
                    var oldRec = context.oldRecord;
                    var rec_vendor = getValueSafe('entity', newRec, oldRec);
                    var TdsType = getValueSafe('custbody_tss_tds_relation', newRec, oldRec);
                    var baseAmt = getValueSafe('custbody_tss_it_amount_withouttax', newRec, oldRec) || 0;
                    var taxAmt = getValueSafe('custbody_tss_it_taxamount', newRec, oldRec) || 0;
                }
                else {

                    var rec_vendor = rec.getValue({ fieldId: "entity" });
                    var TdsType = rec.getValue({ fieldId: "custbody_tss_tds_relation" });
                    var baseAmt = rec.getValue({ fieldId: "custbody_tss_it_amount_withouttax" }) || 0;
                    var taxAmt = rec.getValue({ fieldId: "custbody_tss_it_taxamount" }) || 0;

                }
                log.debug("rec_vendor", rec_vendor);
                log.debug("TDSType", TdsType);
                log.debug("baseAmt", baseAmt);
                log.debug("taxAmt", taxAmt);
                var tdstaxrate = rec.getValue("custbody_tss_tds_percentage");
                log.debug("tdstaxrate", tdstaxrate);


                if (rec_vendor && TdsType) {


                    var vendorObj = search.lookupFields({
                        type: 'vendor',
                        id: rec_vendor,
                        columns: ['custentitytss_pan']
                    });
                    log.debug("vendorObj in fieldChanged", vendorObj)
                    pan = vendorObj.custentitytss_pan;



                    TDSrelObj = search.lookupFields({
                        type: 'customrecord_tss_tdsrelation',
                        id: TdsType,
                        columns: ['custrecord_tss_tds_vedtdsaccount', 'custrecord_tss_tds_vednetper', 'custrecord_tss_tds_vedempty_pan_tdsper', 'custrecord_tss_tds_section', 'custrecord_tss_tds_calculate', 'custrecord_tss_tds_rounding']
                    });

                    rec.setValue({
                        fieldId: 'custbody_tss_tds_section',
                        value: TDSrelObj.custrecord_tss_tds_section
                    });

                    rec.setValue({
                        fieldId: 'custbody_tss_tds_account',
                        value: TDSrelObj.custrecord_tss_tds_vedtdsaccount[0].value
                    });
                    var TDSrate = _logValidation(pan) ? TDSrelObj.custrecord_tss_tds_vednetper : TDSrelObj.custrecord_tss_tds_vedempty_pan_tdsper
                    log.debug("TDSrate", TDSrate)
                    if (tdstaxrate) {
                        rec.setValue({
                            fieldId: 'custbody_tss_tds_percentage',
                            value: parseFloat(tdstaxrate)
                        });
                        TDSrate = tdstaxrate
                    }
                    else {
                        rec.setValue({
                            fieldId: 'custbody_tss_tds_percentage',
                            value: parseFloat(TDSrate)
                        });
                        TDSrate = TDSrate

                    }


                    var tdsBaseAmt = (TDSrelObj.custrecord_tss_tds_calculate[0].value == 2) ? (parseFloat(baseAmt) + parseFloat(taxAmt)) : parseFloat(baseAmt);

                    var tdsAmt = (parseFloat(TDSrate) * parseFloat(tdsBaseAmt)) / 100;
                    tdsAmt = applyTdsRoundMethod(TDSrelObj.custrecord_tss_tds_rounding[0].value, tdsAmt);

                    rec.setValue({
                        fieldId: 'custbody_tss_tds_baseamt',
                        value: parseFloat(tdsBaseAmt),
                        ignoreFieldChange: true
                    });

                    rec.setValue({
                        fieldId: 'custbody_tss_tds_amount',
                        value: parseFloat(tdsAmt),
                        ignoreFieldChange: true
                    });

                    rec.setValue({
                        fieldId: 'payment',
                        value: (parseFloat(baseAmt) - parseFloat(tdsAmt) + parseFloat(taxAmt))
                    });

                    if (TdsType) {
                        var tdsRate = rec.getValue("custbody_tss_tds_percentage");
                        var tdstaxAmount = rec.getValue("custbody_tss_tds_amount");
                        var tdsbaseAmount = rec.getValue("custbody_tss_tds_baseamt")
                        if (!tdsRate) {
                            throw error.create({
                                name: "TAXRATE_REQUIRED",
                                message: "Tax Rate is mandatory when Tax Type is selected."
                            });
                        }
                        if (!tdstaxAmount) {
                            throw error.create({
                                name: "TAXAMOUNT_REQUIRED",
                                message: "Tax Amount is mandatory when Tax Type is selected."
                            });
                        }
                        if (!tdsbaseAmount) {
                            throw error.create({
                                name: "BASEAMOUNT_REQUIRED",
                                message: "Base Amount is mandatory when Tax Type is selected."
                            });
                        }
                    }

                }
            }

        } catch (e) {
            log.error("Error in beforeSubmit", e);
            throw e;
        }
    }

    function applyTdsRoundMethod(tdsRoundMethod, tdsAmount) {
        var roundedtdsAmount = tdsAmount;
        if (tdsRoundMethod == 2) {
            roundedtdsAmount = Math.ceil(tdsAmount)
        }
        if (tdsRoundMethod == 3) {
            roundedtdsAmount = Math.round(tdsAmount / 10) * 10;
        }
        if (tdsRoundMethod == 4) {
            if (tdsAmount < 50) {
                var tdsamt = tdsAmount + 50;
                roundedtdsAmount = Math.round(tdsamt / 100) * 100;
            }
            else {
                roundedtdsAmount = Math.round(tdsAmount / 100) * 100;
            }
        }

        return roundedtdsAmount;
    }
    function getValueSafe(fieldId, newRec, oldRec) {
        var newRecFields = newRec.getFields();

        if (newRecFields.indexOf(fieldId) !== -1) {
            return newRec.getValue(fieldId);
        }

        return oldRec.getValue(fieldId);
    }

    function clearGstFields(rec) {
        var fields = [
            "custbody_tss_it_tax_code",
            "custbody_tss_it_taxrate",
            "custbody_tss_it_taxamount",
            "custbody_tss_it_igst_amount",
            "custbody_tss_it_sgst_amount",
            "custbody_tss_cgst_amount"
        ];

        fields.forEach(function (fld) {
            rec.setValue(fld, "");
        });
    }



    function applyTaxSplit(rec, taxCodeText, taxAmount) {

        taxAmount = parseFloat(taxAmount.toFixed(2));

        if (taxCodeText.toUpperCase().includes("GST") &&
            !taxCodeText.toUpperCase().includes("IGST")) {

            var half = taxAmount / 2;

            var cgst = Math.floor(half * 100) / 100;
            var sgst = parseFloat((taxAmount - cgst).toFixed(2));

            rec.setValue("custbody_tss_cgst_amount", cgst);
            rec.setValue("custbody_tss_it_sgst_amount", sgst);
            rec.setValue("custbody_tss_it_igst_amount", "");
        }

        if (taxCodeText.toUpperCase().includes("IGST")) {
            rec.setValue("custbody_tss_it_igst_amount", taxAmount);
            rec.setValue("custbody_tss_cgst_amount", "");
            rec.setValue("custbody_tss_it_sgst_amount", "");
        }
    }

    function getTaxCodeName(taxCodeId) {
        if (!taxCodeId) return "";
        var result = search.lookupFields({
            type: "taxgroup",
            id: taxCodeId,
            columns: ["name"]
        });
        return result.name || "";
    }


    function getTaxRateFromTaxCode(taxCodeId) {
        var rate = 0;

        var searchObj = search.create({
            type: "taxgroup",
            filters: [
                ["internalid", "anyof", taxCodeId],
                "AND",
                ["isinactive", "is", "F"],
                // "AND",

                // ["taxtype", "anyof", "5", "4"]
            ],
            columns: [
                search.createColumn({ name: "rate" })
            ]
        });

        var result = searchObj.run().getRange({ start: 0, end: 1 });
        if (result.length > 0) {
            rate = parseFloat(result[0].getValue("rate")) || 0;
        }

        return rate;
    }

    function GettingGlobalParameter() {
        var GlobalSubsidiary = ''

        var GlobalParameterSearch = search.create({
            type: "customrecord_tss_global_parameter",
            filters: [["isinactive", "is", "F"]],
            columns: [
                search.createColumn({ name: "internalid", label: "Internalid" }),
                search.createColumn({ name: "custrecord_tss_gp_subsidiary", label: "Internalid" }),

            ]
        });
        var GlobalParameterSearchResults = GlobalParameterSearch.run().getRange({ start: 0, end: 1000 });
        if (GlobalParameterSearchResults.length > 0) {
            GlobalSubsidiary = GlobalParameterSearchResults[0].getValue({ name: 'custrecord_tss_gp_subsidiary' });

        }
        return GlobalSubsidiary

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

    return {
        beforeSubmit: beforeSubmit
    };
});