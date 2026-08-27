/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/currentRecord', 'N/log', 'N/search', 'N/ui/dialog'], function (currentRecord, log, search, dialog) {
    //Global Variables
    var isExpired = true;
    var global_sub = '';
    /**
     * Page Init event
     */
    var mode;
    var _saveConfirmed = false;

    function _triggerNativeSave() {
        var selectors = [
            'button[name="submitter"]',
            '#btn_multibutton_submitter',
            'input[name="submitter"]',
            'button[id*="submitter"]',
            '[data-ns-tooltip="Save"]'
        ];
        for (var i = 0; i < selectors.length; i++) {
            var btn = document.querySelector(selectors[i]);
            if (btn) { btn.click(); return; }
        }
        log.error('_triggerNativeSave', 'Native save button not found');
    }

    function pageInit(context) {
        try {
            if (SearchGlobalParameter()) {
                return true
            }
            var currRecord = context.currentRecord;
            mode = context.mode;
            log.debug('Page Init', currRecord);
            // Delay execution so Apply sublist is populated
            setTimeout(function () {
                try {
                    var recordType = currRecord.type;
                    if (recordType != 'customerpayment' || mode != 'create') {
                        return;
                    }

                    var invoiceIds = [];
                    var invoicePaymentMap = {};
                    var appliedInvoices = [];
                    var invoiceTDSMap = {};
                    var totalTDSRatioAmount = 0;

                    var applyLineCount = currRecord.getLineCount({
                        sublistId: 'apply'
                    });

                    log.debug('Apply Line Count (after timeout)', applyLineCount);

                    // Loop through all lines to get all invoice data
                    try {
                        for (var i = 0; i < applyLineCount; i++) {

                            var invoiceId = currRecord.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'internalid',
                                line: i
                            });

                            var paymentAmount = currRecord.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'amount',
                                line: i
                            });

                            var isApplied = currRecord.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'apply',
                                line: i
                            });

                            if (invoiceId) {
                                if (invoiceIds.indexOf(invoiceId) === -1) {
                                    invoiceIds.push(invoiceId);
                                }
                                invoicePaymentMap[invoiceId] = parseFloat(paymentAmount) || 0;

                                if (isApplied === true || isApplied === 'T') {
                                    appliedInvoices.push(invoiceId);
                                    log.debug('Applied Invoice ID', invoiceId);
                                    log.debug('Payment Amount', paymentAmount);
                                }
                            }
                        }
                    } catch (e) {
                        log.error('pageInit: reading apply lines failed', e.message);
                        return;
                    }

                    /* log.debug('All Invoice IDs', invoiceIds); */
                    /* log.debug('Applied Invoice IDs', appliedInvoices); */
                    /* log.debug('Invoice Payment Map', invoicePaymentMap); */

                    if (invoiceIds.length === 0) {
                        try {
                            currRecord.setValue({
                                fieldId: 'custbody_tss_it_inv_tdsamt',
                                value: '[]'
                            });

                            currRecord.setValue({
                                fieldId: 'custbody_tss_it_tdsamt_inv_r',
                                value: 0
                            });
                        } catch (e) {
                            log.error('pageInit: clearing TDS fields failed', e.message);
                        }
                        return;
                    }

                    // Initialize all invoices from apply list
                    for (var j = 0; j < invoiceIds.length; j++) {
                        var invId = invoiceIds[j];
                        invoiceTDSMap[invId] = {
                            invoice_id: invId,
                            inv_amount: 0,
                            inv_tds_amount: 0,
                            credit: 0,
                            total_tds_amount: 0,
                            remaining_inv_total: 0,
                            items: []
                        };
                    }

                    // Invoice search - get line items with TDS information
                    try {
                        var invoiceSearch = search.create({
                            type: search.Type.INVOICE,
                            settings: [{ "name": "consolidationtype", "value": "NONE" }],
                            filters: [
                                ['internalid', 'anyof', invoiceIds],
                                "AND",
                                ['mainline', 'is', 'F'],
                                "AND",
                                ['taxline', 'is', 'F']
                            ],
                            columns: [
                                'internalid',
                                'fxamount',
                                'custbody_tss_it_total_tdsamt',
                                'total',
                                // search.createColumn({
                                //     name: 'custbody_tss_it_total_tdsamt',
                                //     summary: search.Summary.GROUP
                                // }),
                                'custcol_tss_it_tds_sec_invoice',
                                'custcol_tss_it_tdsamt_invoice',
                                'custbody_tss_it_tdsamt_remaining',
                                search.createColumn({
                                    name: 'custrecord_tss_its_tdsitem',
                                    join: 'custcol_tss_it_tds_sec_invoice',
                                    label: 'TDS Item'
                                })
                            ]
                        });

                        invoiceSearch.run().each(function (result) {

                            var invoiceId = result.getValue('internalid');
                            var invoiceTotal = parseFloat(result.getValue('total')) || 0;
                            // var invoiceTotal = parseFloat(result.getValue('fxamount')) || 0;
                            var totalTdsAmount = parseFloat(result.getValue({
                                name: 'custbody_tss_it_total_tdsamt'
                            })) || 0;
                            var tdsSection = result.getValue('custcol_tss_it_tds_sec_invoice');
                            var lineTdsAmount = parseFloat(result.getValue('custcol_tss_it_tdsamt_invoice')) || 0;
                            var tdsSectionItem = result.getValue({
                                name: 'custrecord_tss_its_tdsitem',
                                join: 'custcol_tss_it_tds_sec_invoice'
                            });
                            var remainingTotalAmount = parseFloat(result.getValue('custbody_tss_it_tdsamt_remaining')) || 0;

                            if (!invoiceTDSMap[invoiceId]) {
                                return true;
                            }

                            // Update invoice amount (first line will set it)
                            if (invoiceTDSMap[invoiceId].inv_amount === 0) {
                                invoiceTDSMap[invoiceId].inv_amount = invoiceTotal;
                                invoiceTDSMap[invoiceId].total_tds_amount = totalTdsAmount;
                                invoiceTDSMap[invoiceId].remaining_inv_total = remainingTotalAmount;

                            }

                            // Add line item only if TDS section exists
                            if (tdsSection) {
                                invoiceTDSMap[invoiceId].items.push({
                                    tds_section: tdsSection,
                                    line_tds_amount: lineTdsAmount,
                                    tds_section_item: tdsSectionItem
                                });

                                // Accumulate line TDS amounts only for lines with TDS
                                invoiceTDSMap[invoiceId].inv_tds_amount += lineTdsAmount;
                            }

                            return true;
                        });
                    } catch (e) {
                        log.error('pageInit: invoice TDS search failed', e.message);
                        return;
                    }

                    /* log.debug('Setting TDS Remaining Amounts in Apply Lines'); */

                    // Override the applied amount on each line with the invoice's TDS-net remaining total
                    try {
                        for (var i = 0; i < applyLineCount; i++) {
                            var lineInvoiceId = currRecord.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'internalid',
                                line: i
                            });
                            var applyValue = currRecord.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'apply',
                                line: i
                            })
                            /*
                            log.debug('line data', {
                                lineInvoiceId: lineInvoiceId,
                                invoiceTDSMap: invoiceTDSMap,
                                applyLineCount: applyLineCount,
                                applyValue: applyValue
                            })
                            */
                            if (lineInvoiceId && invoiceTDSMap[lineInvoiceId] && (applyValue == 'T' || applyValue == true)) {
                                var remainingAmount = invoiceTDSMap[lineInvoiceId].remaining_inv_total;

                                // Set the remaining TDS amount in the apply line
                                try {
                                    // currRecord.selectLine({
                                    //     sublistId: 'apply',
                                    //     line: i
                                    // });

                                    // currRecord.setCurrentSublistValue({
                                    //     sublistId: 'apply',
                                    //     fieldId: 'amount',
                                    //     value: remainingAmount,
                                    //     ignoreFieldChange: true
                                    // });

                                    // // Commit the line - without this the record is left with an
                                    // // uncommitted line, which breaks the next selectLine iteration
                                    // currRecord.commitLine({
                                    //     sublistId: 'apply'
                                    // });

                                    var finalAmount = currRecord.getSublistValue({
                                        sublistId: 'apply',
                                        fieldId: 'amount',
                                        line: i
                                    });
                                    invoicePaymentMap[lineInvoiceId] = parseFloat(finalAmount) || 0;

                                    log.debug('Set TDS Remaining for Invoice', lineInvoiceId, 'Amount:', remainingAmount);
                                } catch (e) {
                                    log.error('pageInit: setting TDS remaining amount for line failed', { line: i, error: e.message });
                                }
                            }
                        }
                    } catch (e) {
                        log.error('pageInit: applying TDS remaining amounts failed', e.message);
                    }

                    // Calculate credits for applied invoices
                    try {
                        var invoiceTDSArray = [];
                        for (var invId in invoiceTDSMap) {
                            var invoiceData = invoiceTDSMap[invId];
                            var paymentAmount = invoicePaymentMap[invId] || 0;
                            var calculatedCredit = 0;

                            // Only calculate credit if invoice is applied and TDS doesn't equal the full invoice amount
                            var taxableBase = invoiceData.inv_amount - invoiceData.total_tds_amount;
                            if (appliedInvoices.indexOf(invId) != -1 && invoiceData.total_tds_amount != 0 && taxableBase != 0) {

                                /* log.debug("Invoice ID", invId); */
                                /* log.debug("Total TDS Amount", invoiceData.total_tds_amount); */
                                /* log.debug("Invoice Total", invoiceData.inv_amount); */

                                var ratio = invoiceData.total_tds_amount / taxableBase;
                                /* log.debug("Ratio", ratio); */

                                var value = ratio * paymentAmount;
                                /* log.debug("Credit Value", value); */

                                calculatedCredit = parseFloat(value.toFixed(2));
                                totalTDSRatioAmount += value;
                            }

                            invoiceData.credit = calculatedCredit;
                            invoiceData.inv_tds_amount = parseFloat((invoiceData.inv_tds_amount || 0).toFixed(2));
                            invoiceTDSArray.push(invoiceData);
                        }

                        totalTDSRatioAmount = parseFloat(totalTDSRatioAmount.toFixed(2));

                        /* log.debug('Final Invoice TDS Array', invoiceTDSArray); */
                        /* log.debug('Total invoices in Array', invoiceTDSArray.length); */
                        /* log.debug('Total TDS Ratio Amount', totalTDSRatioAmount); */

                        currRecord.setValue({
                            fieldId: 'custbody_tss_it_inv_tdsamt',
                            value: JSON.stringify(invoiceTDSArray)
                        });

                        currRecord.setValue({
                            fieldId: 'custbody_tss_it_tdsamt_inv_r',
                            value: Math.abs(totalTDSRatioAmount)
                        });
                    } catch (e) {
                        log.error('pageInit: calculating/setting TDS credit JSON failed', e.message);
                    }
                } catch (e) {
                    log.error('pageInit: deferred processing failed', e.message);
                }
            }, 10);

        } catch (e) {
            log.error('pageInit Error', e.message);
        }



    }


    /**
     * Field Changed event
     */
    function fieldChanged(context) {

        try {
            if (isExpired) {
                return true
            }
            var currRecord = context.currentRecord;
            var sublistName = context.sublistId;
            var fieldId = context.fieldId;
            if (currRecord.type == 'invoice') {

                // Check if the field changed is custcol_tss_it_tds_rate_invoice
                // if (sublistName === 'item' && fieldId === 'custcol_tss_it_tds_rate_invoice') {
                //     calculateTDSAmounts(currRecord);
                // }
                if (sublistName === 'item' && fieldId === 'custcol_tss_it_tds_sec_invoice') {
                    calculateTDSAmounts(currRecord, true);
                }

                // Check if the field changed is custcol_tss_it_tds_base_invoice
                if (sublistName === 'item' && fieldId === 'custcol_tss_it_tds_base_invoice') {
                    recalculateFromBaseAmount(currRecord);


                }
            }
            if (currRecord.type == 'customerpayment') {
                try {
                    var currRecord = context.currentRecord;
                    var sublistName = context.sublistId;
                    var fieldId = context.fieldId;

                    if (sublistName === 'apply' && (fieldId === 'apply' || fieldId === 'amount')) {

                        var line = context.line;

                        var isApplied = currRecord.getSublistValue({
                            sublistId: 'apply',
                            fieldId: 'apply',
                            line: line
                        });

                        var paymentAmount = currRecord.getSublistValue({
                            sublistId: 'apply',
                            fieldId: 'amount',
                            line: line
                        });

                        var currentInvoiceId = currRecord.getSublistValue({
                            sublistId: 'apply',
                            fieldId: 'internalid',
                            line: line
                        });

                        /*
                        log.debug("curr inv details", {
                            currentInvoiceId: currentInvoiceId,
                            isApplied: isApplied,
                            paymentAmount: paymentAmount
                        });
                        */

                        if (!currentInvoiceId) {
                            /* log.debug('No invoice ID found on current line'); */
                            return;
                        }

                        // Get existing JSON data
                        var existingJsonString = currRecord.getValue({
                            fieldId: 'custbody_tss_it_inv_tdsamt'
                        });

                        // Initialize empty array if no JSON exists
                        var invoiceTDSArray = existingJsonString ? JSON.parse(existingJsonString) : [];

                        // Find the invoice in the array
                        var invoiceData = null;
                        var invoiceIndex = -1;

                        for (var i = 0; i < invoiceTDSArray.length; i++) {
                            if (invoiceTDSArray[i].invoice_id === currentInvoiceId) {
                                invoiceData = invoiceTDSArray[i];
                                invoiceIndex = i;
                                break;
                            }
                        }

                        // If invoice not found in array, fetch from search and add it
                        if (!invoiceData) {
                            /* log.debug('Invoice not found in JSON array, fetching from search'); */

                            var invoiceSearch = search.create({
                                type: search.Type.INVOICE,
                                filters: [
                                    ['internalid', 'is', currentInvoiceId],
                                    "AND",
                                    ['mainline', 'is', 'T']
                                ],
                                columns: [
                                    'internalid',
                                    'total',
                                    'custbody_tss_it_total_tdsamt'
                                ]
                            });

                            var searchResult = invoiceSearch.run().getRange({ start: 0, end: 1 });

                            if (searchResult.length > 0) {
                                var result = searchResult[0];
                                var invoiceTotal = parseFloat(result.getValue('total')) || 0;
                                var tdsAmount = parseFloat(result.getValue('custbody_tss_it_total_tdsamt')) || 0;

                                // Add new invoice to array
                                invoiceData = {
                                    invoice_id: currentInvoiceId,
                                    inv_amount: invoiceTotal,
                                    inv_tds_amount: tdsAmount,
                                    credit: 0
                                };

                                invoiceTDSArray.push(invoiceData);
                                invoiceIndex = invoiceTDSArray.length - 1;
                            } else {
                                /* log.debug('Invoice not found in search'); */
                                return;
                            }
                        }

                        /* log.debug('Found Invoice Data', invoiceData); */

                        // Get old credit BEFORE any updates
                        var oldCredit = invoiceData.credit || 0;
                        /* log.debug('Old Credit', oldCredit); */

                        // Calculate new credit
                        var newCredit = 0;

                        // Only calculate if TDS amount is not 0 and invoice is applied
                        if ((isApplied === true || isApplied === 'T') && invoiceData.inv_tds_amount !== 0) {

                            var invoiceTotal = invoiceData.inv_amount || 0;
                            var tdsAmount = invoiceData.inv_tds_amount || 0;
                            var payment = parseFloat(paymentAmount) || 0;

                            var ratio = tdsAmount / (invoiceTotal - tdsAmount);
                            newCredit = ratio * payment;

                            /* log.debug('Invoice Total', invoiceTotal); */
                            /* log.debug('TDS Amount', tdsAmount); */
                            /* log.debug('Ratio', ratio); */
                            /* log.debug('New Credit (raw)', newCredit); */
                        }

                        // Round the new credit
                        var newCreditRounded = Math.round(Math.abs(parseFloat(newCredit) || 0) * 100) / 100;
                        /* log.debug('New Credit (rounded)', newCreditRounded); */

                        // Update the invoice credit in array
                        invoiceTDSArray[invoiceIndex].credit = newCreditRounded;

                        // Get current total TDS from field
                        var currentTotalTDS = parseFloat(currRecord.getValue({
                            fieldId: 'custbody_tss_it_tdsamt_inv_r'
                        })) || 0;
                        /* log.debug('Current Total TDS', currentTotalTDS); */

                        // Incremental update: subtract old credit and add new credit
                        var totalTDS = currentTotalTDS - oldCredit + newCreditRounded;
                        /* log.debug('New Total TDS', totalTDS); */

                        // Update the JSON field
                        currRecord.setValue({
                            fieldId: 'custbody_tss_it_inv_tdsamt',
                            value: JSON.stringify(invoiceTDSArray)
                        });

                        // Update total TDS amount field
                        currRecord.setValue({
                            fieldId: 'custbody_tss_it_tdsamt_inv_r',
                            value: Math.round(Math.abs(parseFloat(totalTDS) || 0) * 100) / 100
                        });

                        /* log.debug('Updated Total TDS Amount', totalTDS); */


                    }

                } catch (e) {
                    log.error('fieldChanged Error', e.message);
                }
            }
        } catch (e) {
            log.error('fieldChanged Error', e.message);
        }
    }

    /**
     * Validate Line event
     */
    function validateLine(context) {
        try {
            if (isExpired) {
                return true
            }
            var currRecord = context.currentRecord;
            var sublistName = context.sublistId;
            if (currRecord.type == 'invoice') {
                if (sublistName === 'item') {
                    calculateTDSAmounts(currRecord);
                }
            }

            return true;
        } catch (e) {
            log.error('validateLine Error', e.message);
            return true;
        }
    }





    function saveRecord(context) {
        try {
            if (isExpired) {
                var recSub = context.currentRecord.getValue({ fieldId: 'subsidiary' });
                if (inArray(recSub, global_sub) == parseInt(1)) {
                    alert('TaxPro SuiteApp subscription needs renewal. Please contact your administrator.');
                }
                return true
            }
            var currRecord = context.currentRecord;
            if (currRecord.type == 'invoice' && (mode == 'create' || mode == 'copy')) {
                var totalTDS = 0;
                var remainingTotal = 0;

                // Get the line count for the item sublist
                var lineCount = currRecord.getLineCount({
                    sublistId: 'item'
                });

                // Loop through all lines and sum up custcol_tss_it_tdsamt_invoice
                for (var i = 0; i < lineCount; i++) {
                    var tdsRemaining = currRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_tss_it_tdsamt_invoice',
                        line: i
                    });
                    var lineRemaining = currRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_tss_it_tds_remain_inv',
                        line: i
                    })
                    if (lineRemaining) {
                        remainingTotal += parseFloat(lineRemaining);
                    }

                    if (tdsRemaining) {
                        totalTDS += parseFloat(tdsRemaining);
                    }
                }

                // Set the total TDS amount at body level
                currRecord.setValue({
                    fieldId: 'custbody_tss_it_total_tdsamt',
                    value: totalTDS
                });

                currRecord.setValue({
                    fieldId: 'custbody_tss_it_tdsamt_remaining',
                    value: remainingTotal
                });

                log.debug('Total Remaining Amount: ' + remainingTotal + ' Total TDS: ' + totalTDS);
            }

            if (currRecord.type == 'customerpayment') {
                // Second pass: user confirmed via dialog — adjustments already applied, just save
                if (_saveConfirmed) {
                    _saveConfirmed = false;
                    return true;
                }

                try {
                    var paymentRecord = context.currentRecord;
                    var paymentId = paymentRecord.id;

                    var appliedInvoices = [];
                    var linePaymentMap = {};

                    var applyLineCount = paymentRecord.getLineCount({ sublistId: 'apply' });
                    log.debug("Apply Line Count", applyLineCount);

                    for (var i = 0; i < applyLineCount; i++) {
                        var isApplied = paymentRecord.getSublistValue({
                            sublistId: 'apply', fieldId: 'apply', line: i
                        });

                        if (isApplied === true || isApplied === 'T') {
                            var invoiceId = paymentRecord.getSublistValue({
                                sublistId: 'apply', fieldId: 'internalid', line: i
                            });
                            var paymentAmount = paymentRecord.getSublistValue({
                                sublistId: 'apply', fieldId: 'amount', line: i
                            });
                            if (invoiceId) {
                                appliedInvoices.push(invoiceId);
                                linePaymentMap[invoiceId] = {
                                    lineIndex: i,
                                    paymentAmount: parseFloat(paymentAmount) || 0
                                };
                            }
                        }
                    }

                    log.debug('Applied Invoices', appliedInvoices);
                    log.debug('Line Payment Map', linePaymentMap);

                    if (appliedInvoices.length === 0) {
                        return true;
                    }

                    var isEditMode = (paymentId && mode == 'edit');
                    log.debug("save Details", { paymentId: paymentId, isEditMode: isEditMode, mode: mode });

                    var originalPaymentMap = {};

                    if (isEditMode && paymentId) {
                        try {
                            var paymentSearch = search.create({
                                type: search.Type.CUSTOMER_PAYMENT,
                                filters: [
                                    ['internalid', 'anyof', paymentId],
                                    'AND',
                                    ['appliedtotransaction.internalid', 'anyof', appliedInvoices]
                                ],
                                columns: [
                                    search.createColumn({ name: 'internalid', join: 'appliedToTransaction' }),
                                    search.createColumn({ name: 'appliedtoforeignamount' })
                                ]
                            });

                            paymentSearch.run().each(function (result) {
                                var appliedInvoiceId = result.getValue({ name: 'internalid', join: 'appliedToTransaction' });
                                var originalAmount = parseFloat(result.getValue('appliedtoforeignamount')) || 0;
                                originalPaymentMap[appliedInvoiceId] = originalAmount;
                                log.debug('Original Payment for Invoice ' + appliedInvoiceId + ': ' + originalAmount);
                                return true;
                            });
                        } catch (e) {
                            log.error('Error fetching original payment amounts', e.message);
                        }
                    }

                    var invoiceSearchObj = search.create({
                        type: 'invoice',
                        settings: [{ name: 'consolidationtype', value: 'NONE' }],
                        filters: [
                            ['type', 'anyof', 'CustInvc'], 'AND',
                            ['internalid', 'anyof', appliedInvoices], 'AND',
                            ['mainline', 'is', 'T']
                        ],
                        columns: [
                            search.createColumn({ name: 'internalid' }),
                            search.createColumn({ name: 'fxamount' }),
                            search.createColumn({ name: 'fxamountremaining' }),
                            search.createColumn({ name: 'fxamountpaid' }),
                            search.createColumn({ name: 'custbody_tss_it_total_tdsamt' }),
                            search.createColumn({ name: 'custbody_tss_it_tdsamt_remaining' })
                        ]
                    });

                    var needsAdjustment = false;
                    var pendingAdjustments = [];
                    var adjustmentMessages = [];
                    log.debug('originalPaymentMap', originalPaymentMap);

                    invoiceSearchObj.run().each(function (result) {
                        var invoiceId = result.getValue('internalid');
                        var totalTdsAmount = parseFloat(result.getValue('custbody_tss_it_total_tdsamt')) || 0;
                        var tdsAmountRemaining = parseFloat(result.getValue('custbody_tss_it_tdsamt_remaining')) || 0;
                        var lineData = linePaymentMap[invoiceId];

                        if (lineData && totalTdsAmount <= 0) {
                            log.debug('No TDS Applicable - Skipping Payment Cap for Invoice: ' + invoiceId);
                            return true;
                        }

                        if (lineData) {
                            var currentLinePayment = lineData.paymentAmount;
                            var availableForPayment = tdsAmountRemaining;
                            var paymentToValidate = currentLinePayment;

                            // In EDIT mode, add back the original payment to get available amount
                            if (isEditMode && originalPaymentMap[invoiceId] !== undefined) {
                                var originalPayment = parseFloat(originalPaymentMap[invoiceId]) || 0;

                                // Restore what was available before this payment
                                availableForPayment = tdsAmountRemaining + originalPayment;

                                console.log('EDIT MODE - Invoice ID: ' + invoiceId);
                                console.log('Original Payment: ' + originalPayment);
                                console.log('TDS Remaining (after original): ' + tdsAmountRemaining);
                                console.log('Available (restored): ' + availableForPayment);
                                console.log('New Payment Amount: ' + paymentToValidate);
                            } else {
                                // CREATE mode
                                console.log('CREATE MODE - Invoice ID: ' + invoiceId);
                                console.log('TDS Amount Remaining: ' + tdsAmountRemaining);
                                console.log('Payment Amount: ' + paymentToValidate);
                            }

                            // Check if payment exceeds available amount
                            if (paymentToValidate > availableForPayment) {
                                needsAdjustment = true;

                                // Calculate allowed payment amount
                                var allowedPayment = availableForPayment;
                                allowedPayment = Math.max(0, allowedPayment);
                                allowedPayment = parseFloat(allowedPayment.toFixed(2));

                                console.log('Adjustment Needed - Allowed Payment: ' + allowedPayment);

                                // Set the adjusted amount in the apply line
                                paymentRecord.selectLine({
                                    sublistId: 'apply',
                                    line: lineData.lineIndex
                                });

                                paymentRecord.setCurrentSublistValue({
                                    sublistId: 'apply',
                                    fieldId: 'amount',
                                    value: allowedPayment
                                });

                                paymentRecord.commitLine({
                                    sublistId: 'apply'
                                });

                                adjustmentMessages.push(
                                    'Invoice ' + invoiceId + ': Payment adjusted from ' +
                                    currentLinePayment.toFixed(2) + ' to ' + allowedPayment.toFixed(2) +
                                    ' (Available for Payment: ' + availableForPayment.toFixed(2) + ')'
                                );

                                console.log('Payment amount adjusted for invoice: ' + invoiceId);
                            }
                        }
                        return true;
                    });

                    log.debug('needsAdjustment', needsAdjustment);

                    if (needsAdjustment) {
                        var message = 'Payment amounts have been adjusted:\n\n' + adjustmentMessages.join('\n');
                        // alert(message);
                        console.log('Adjustments Made', adjustmentMessages);
                    }
                    return true;

                } catch (e) {
                    console.error('saveRecord Error', e.message);
                    // alert('Error validating payment amounts: ' + e.message);
                    return false;
                }
            }

            return true;

        } catch (e) {
            log.error('saveRecord Error', e.message);
            return true;
        }
    }
    /**
     * Calculate TDS amounts
     */
    function calculateTDSAmounts(currRecord, forceRecalc) {
        try {
            // Get the line amount (invoice amount)
            var lineAmount = currRecord.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'amount'
            });

            // Get the line amount (invoice amount)
            var lineGrossAmount = currRecord.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'grossamt'
            });


            if (!lineAmount) {
                lineAmount = 0;
            }

            // Determine the TDS basis (Base/Gross) and the PAN-based rate from the TDS Master record
            var tdsMasterDetails = getTdsMasterDetails(currRecord);
            var calculateOn = tdsMasterDetails.calculateOn;
            var tdsRate = tdsMasterDetails.rate;

            var baseValue = (calculateOn === 'Gross') ? lineGrossAmount : lineAmount;

            // Set the TDS rate (only if not already populated, unless forced)
            var existingRate = currRecord.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_tss_it_tds_rate_invoice'
            });

            if (forceRecalc || !existingRate) {
                currRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_it_tds_rate_invoice',
                    value: tdsRate,
                    ignoreFieldChange: true
                });
            }

            // Set the base invoice amount (only if not already populated)
            var existingBaseAmount = currRecord.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_tss_it_tds_base_invoice'
            });

            if (forceRecalc || !existingBaseAmount) {
                currRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_it_tds_base_invoice',
                    value: baseValue,
                    ignoreFieldChange: true
                });
            }

            // Read back the stored base amount and rate so the TDS amount always
            // reflects what's actually on the line, not just the freshly computed values
            var finalBaseAmount = parseFloat(currRecord.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_tss_it_tds_base_invoice'
            })) || 0;

            var finalTdsRate = parseFloat(currRecord.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_tss_it_tds_rate_invoice'
            })) || 0;

            // TDS amount = TDS rate % of TDS base invoice amount
            var tdsRemaining = (finalBaseAmount * finalTdsRate) / 100;

            // Remaining amount = gross amount - TDS amount
            var netAmount = lineGrossAmount - tdsRemaining;

            // Set the TDS amount (only if not already populated)
            var existingTdsAmount = currRecord.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_tss_it_tdsamt_invoice'
            });

            if (forceRecalc || !existingTdsAmount) {
                currRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_it_tdsamt_invoice',
                    value: tdsRemaining,
                    ignoreFieldChange: true
                });
            }

            // Set the TDS remaining amount (only if not already populated)
            var existingRemaining = currRecord.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_tss_it_tds_remain_inv'
            });

            if (forceRecalc || !existingRemaining) {
                currRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_it_tds_remain_inv',
                    value: netAmount,
                    ignoreFieldChange: true
                });
            }

            /*
            log.debug('TDS Calculation', {
                baseAmount: finalBaseAmount,
                tdsRate: finalTdsRate,
                tdsAmount: tdsRemaining,
                grossAmount: lineGrossAmount,
                netAmount: netAmount
            });
            */

        } catch (e) {
            log.error('calculateTDSAmounts Error', e.message);
        }
    }

    /**
     * Look up whether the customer/vendor on the record has a PAN on file
     */
    function hasCustomerPan(currRecord) {
        var panExists = false;
        var entityId = currRecord.getValue({ fieldId: 'entity' });

        if (!entityId) {
            return panExists;
        }

        try {
            var customerSearch = search.create({
                type: search.Type.CUSTOMER,
                filters: [
                    ['internalid', 'anyof', entityId]
                ],
                columns: ['custentity_tss_it_cust_pannum']
            });

            var panNumber = '';
            customerSearch.run().each(function (result) {
                panNumber = result.getValue('custentity_tss_it_cust_pannum') || '';
                return false;
            });

            panExists = !!(panNumber && String(panNumber).trim());
        } catch (e) {
            log.error('Customer PAN Lookup Error', e.message);
        }

        return panExists;
    }

    /**
     * Look up the TDS Master record for the current line: whether it calculates on
     * Base or Gross, and the applicable rate based on whether the customer has a PAN
     */
    function getTdsMasterDetails(currRecord) {
        var details = { calculateOn: 'Base', rate: 0 };
        var tdsSectionId = currRecord.getCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_tss_it_tds_sec_invoice'
        });

        if (tdsSectionId) {
            try {
                var tdsMasterSearch = search.create({
                    type: 'customrecord_tss_its_tdsmaster',
                    filters: [
                        ['internalid', 'anyof', tdsSectionId]
                    ],
                    columns: ['custrecord_tss_its_calculate', 'custrecord_tss_its_netperc', 'custrecord_tss_its_panempty_per']
                });

                var panExists = hasCustomerPan(currRecord);

                tdsMasterSearch.run().each(function (result) {
                    var calculateText = result.getText('custrecord_tss_its_calculate');
                    if (calculateText) {
                        details.calculateOn = calculateText;
                    }

                    var rateValue = panExists
                        ? result.getValue('custrecord_tss_its_netperc')
                        : result.getValue('custrecord_tss_its_panempty_per');

                    details.rate = parseFloat(rateValue) || 0;

                    return false;
                });

                /*
                log.debug('TDS Master Details', {
                    tdsSectionId: tdsSectionId,
                    panExists: panExists,
                    calculateOn: details.calculateOn,
                    rate: details.rate
                });
                */
            } catch (e) {
                log.error('TDS Master Lookup Error', e.message);
            }
        }

        return details;
    }


    /**
     * Recalculate TDS amount and remaining when custcol_tss_it_tds_base_invoice is edited directly
     */
    function recalculateFromBaseAmount(currRecord) {
        try {
            var baseAmount = currRecord.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_tss_it_tds_base_invoice'
            });

            var tdsRate = currRecord.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_tss_it_tds_rate_invoice'
            });

            var lineGrossAmount = currRecord.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'grossamt'
            });

            if (!baseAmount) {
                baseAmount = 0;
            }

            if (!tdsRate) {
                tdsRate = 0;
            }

            var tdsAmount = (baseAmount * tdsRate) / 100;

            // Remaining amount = gross amount - TDS amount
            var netAmount = lineGrossAmount - tdsAmount;

            currRecord.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_tss_it_tdsamt_invoice',
                value: tdsAmount,
                ignoreFieldChange: true
            });
            currRecord.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_tss_it_tds_remain_inv',
                value: netAmount,
                ignoreFieldChange: true
            });

            /*
            log.debug('TDS Recalculation from Base', {
                baseAmount: baseAmount,
                tdsRate: tdsRate,
                tdsAmount: tdsAmount,
                netAmount: netAmount
            });
            */

        } catch (e) {
            log.error('recalculateFromBaseAmount Error', e.message);
        }
    }

    function SearchGlobalParameter() {
        var a_filters = new Array();
        var a_column = new Array();
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
            name: 'custrecord_tss_gp_taxcode',
        }));
        a_column.push(search.createColumn({
            name: 'custrecordtss_gp_vnr_taxgroup_instate',
        }));
        a_column.push(search.createColumn({
            name: 'custrecord_tss_gp_vnr_taxgroup_outstate',
        }));
        a_column.push(search.createColumn({
            name: 'custrecord_tss_gp_rcm_applicable',
        }));
        a_column.push(search.createColumn({
            name: 'custrecord_tss_gp_sez_taxcode',
        }));
        a_column.push(search.createColumn({
            name: 'custrecord_tss_gp_taxcode_igst',
        }));
        a_column.push(search.createColumn({
            name: 'custrecord_tss_use_acc_exp_gst_auto',
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
        if (global_param_search_result.length > 0) {
            isExpired = global_param_search_result[0].getValue({ name: 'custrecord_tss_gp_subscription_end' });
            global_sub = global_param_search_result[0].getValue({ name: 'custrecord_tss_gp_subsidiary' });
        }
        return isExpired;
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
        validateLine: validateLine,
        saveRecord: saveRecord
    };
});