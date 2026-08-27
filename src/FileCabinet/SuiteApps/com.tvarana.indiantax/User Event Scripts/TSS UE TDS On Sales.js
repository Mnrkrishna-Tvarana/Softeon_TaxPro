/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log', 'N/search', 'N/transaction', 'N/error', 'N/runtime', '/SuiteApps/com.tvarana.indiantax/Other Files/TSS TaxPro Server Helper'], (record, log, search, transaction, error, runtime, serverHelper) => {
    function beforeLoad(context) {
        // Always first line — checks subscription
        if (!serverHelper.checkSubscription()) {
            log.debug("TaxPro UE beforeLoad", "Subscription check failed - blocking execution");
            return true;
        }
        // if(context.newRecord.type !== 'customerpayment' || context.newRecord.type !== 'invoice') return;
        // log.debug("context.type beforeload", { type: context.type, newRecord: context.newRecord.type });
        var newRecord = context.newRecord;
        // if (context.newRecord.type != 'customerpayment' || context.newRecord.type != 'invoice' || context.newRecord.type != "creditmemo") return;
        if (context.type == "view" && (context.newRecord.type == 'invoice' || context.newRecord.type == 'customerpayment')) {

            var form = context.form;

            var hideButtons = newRecord.getValue({
                fieldId: 'custbody_tss_it_hide_ui_buttons'
            });

            if (hideButtons === true) {
                form.removeButton({
                    id: 'edit'
                });
            }
        }
        // log.debug(
        //     "context.type beforeload",
        //     { type: context.type, newRecord: context.newRecord.type }
        // )
        if ((context.type == "edit" || context.type == "view") && context.newRecord.type == "creditmemo") {
            // log.debug("context.newRecord", context.newRecord);
            var memo = context.newRecord.getValue({
                fieldId: 'memo'
            }) || '';
            log.debug("memo", memo);

            if (memo.indexOf('TDS Tax Amount for Invoice') !== -1) {
                context.form.removeButton({
                    id: 'edit'
                });

                if (context.type == "edit") {
                    log.debug('You are not allowed to edit this transaction as the TDS is applied');
                    throw 'You are not allowed to edit this transaction as the TDS is applied'
                }
            }
        }
        try {

            if ((context.type == "edit" || context.type == "view") && (context.newRecord.type == 'invoice')) {
                var invoiceId = newRecord.id;
                var tranId = newRecord.getValue({
                    fieldId: 'tranid'
                });

                log.debug("invoiceId", invoiceId);
                log.debug("tranId", tranId);

                if (tranId) {
                    // Search for credit memos with TDS memo pattern
                    var memoPattern = 'TDS Tax Amount for Invoice ' + tranId;

                    var transactionSearchObj = search.create({
                        type: "transaction",
                        settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                        filters: [
                            ["internalid", "anyof", invoiceId],
                            "AND",
                            ["type", "anyof", "CustInvc"],
                            "AND",
                            ["applyingtransaction.type", "anyof", "CustCred"],
                            "AND",
                            ["applyingtransaction.memo", "contains", memoPattern],
                            "AND",
                            ["mainline", "is", "T"]
                        ],
                        columns: [
                            search.createColumn({ name: "internalid", label: "Internal ID" }),
                            search.createColumn({ name: "tranid", label: "Document Number" })
                        ]
                    });

                    var searchResultCount = transactionSearchObj.runPaged().count;
                    log.debug("TDS Credit Memo Check", {
                        invoiceId: invoiceId,
                        tranId: tranId,
                        searchResultCount: searchResultCount
                    });

                    if (searchResultCount > 0) {
                        // Check if result matches current record
                        var foundMatch = false;
                        transactionSearchObj.run().each(function (result) {
                            var resultInternalId = result.getValue('internalid');
                            if (resultInternalId == invoiceId) {
                                foundMatch = true;
                                return false; // Stop iteration
                            }
                            return true;
                        });

                        if (foundMatch) {
                            context.form.removeButton({
                                id: 'edit'
                            });

                            if (context.type == "edit") {
                                throw 'You are not allowed to edit this transaction as the TDS credit memos are already generated for this payment';
                            }

                            // throw error.create({
                            //     name: 'TDS_EDIT_RESTRICTED',
                            //     message: 'You are not allowed to edit this transaction as the TDS applied payment and credit memo are already generated for Invoice ' + tranId,
                            //     notifyOff: false
                            // });
                        }
                    }
                }
            }


        } catch (e) {

            log.error('TDS Credit Memo Check Error', e.message);
            if (context.type == "edit") {
                throw e;
            }
        }



    }
    const beforeSubmit = (context) => {
        try {
            if (!serverHelper.checkSubscription()) {
                log.debug("TaxPro UE beforeSubmit", "Subscription check failed - blocking execution");
                return true;
            }
            var newRecord = context.newRecord;
            var recordType = newRecord.type;

            if (recordType === 'invoice' &&
                (context.type == 'create' || context.type == 'edit' || context.type == 'xedit')) {
                calculateInvoiceTdsAmounts(newRecord);
            }
            if (context.type === context.UserEventType.DELETE || context.type == 'delete') {

                if (recordType == 'customerpayment') {
                    const cmSearchSettings = [
                        { "name": "consolidationtype", "value": "ACCTTYPE" },
                        { "name": "includeperiodendtransactions", "value": "F" }
                    ];
                    var paymentId = context.oldRecord.id
                    log.debug("paymentid in before submit", paymentId)
                    // Void credit memos — first try non-voided only
                    let creditMemoSearch = search.create({
                        type: "creditmemo",
                        // settings: cmSearchSettings,
                        filters: [
                            ['mainline', 'is', 'T'],
                            // 'AND',
                            // ['type', 'anyof', 'CustCred'],
                            'AND',
                            ['custbody_tss_it_paymt_tds', 'anyof', paymentId],
                            // 'AND',
                            // ['status', 'noneof', 'CustCred:V']
                        ],
                        columns: ['internalid']
                    });

                    let searchResultCount = creditMemoSearch.runPaged().count;
                    log.debug('voidCreditMemosForPayment Search Count (with status filter)', searchResultCount);

                    creditMemoSearch.run().each(function (result) {
                        const creditMemoId = result.getValue('internalid');
                        log.debug('voidCreditMemosForPayment Credit Memo', creditMemoId);
                        voidCreditMemo(creditMemoId);
                        return true;
                    });

                }
            }

            var execContext = runtime.executionContext;
            if (
                execContext == "USERINTERFACE" ||
                context.type != "xedit"
            ) {
                return; // Skip only UI, allow XEDIT
            }
            log.debug("before submit ", {
                recordType: recordType,
                contextType: context.type
            });







            // Check for Invoice
            if (recordType === 'invoice') {
                var invoiceId = newRecord.id;
                // var tranId = newRecord.getValue({
                //     fieldId: 'tranid'
                // });
                const tranId = search.lookupFields({
                    type: context.newRecord.type,
                    id: context.newRecord.id,
                    columns: ['tranid']
                }).tranid;


                log.debug("invoiceId", invoiceId);
                log.debug("tranId", tranId);

                if (tranId) {
                    var memoPattern = 'TDS Tax Amount for Invoice ' + tranId;

                    var transactionSearchObj = search.create({
                        type: "transaction",
                        settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                        filters: [
                            ["internalid", "anyof", invoiceId],
                            "AND",
                            ["type", "anyof", "CustInvc"],
                            "AND",
                            ["applyingtransaction.type", "anyof", "CustCred"],
                            "AND",
                            ["applyingtransaction.memo", "contains", memoPattern],
                            "AND",
                            ["mainline", "is", "T"]
                        ],
                        columns: [
                            search.createColumn({ name: "internalid", label: "Internal ID" })
                        ]
                    });

                    var searchResultCount = transactionSearchObj.runPaged().count;

                    if (searchResultCount > 0) {
                        var foundMatch = false;
                        transactionSearchObj.run().each(function (result) {
                            var resultInternalId = result.getValue('internalid');
                            if (resultInternalId == invoiceId) {
                                foundMatch = true;
                                return false;
                            }
                            return true;
                        });
                        // log.debug("foundMatch", foundMatch);

                        if (foundMatch) {
                            throw 'You are not allowed to edit this transaction as the TDS applied payment and credit memo are already generated for Invoice ' + tranId;
                        }
                    }
                }
            }

            if (recordType == 'creditmemo') {
                // var memo = 
                // context.newRecord.getValue({
                //     fieldId: 'memo'
                // }) 
                var memo =
                    context.newRecord.getValue({ fieldId: 'memo' }) ||
                    (context.oldRecord && context.oldRecord.getValue({ fieldId: 'memo' })) ||
                    '';

                log.debug("memo", memo);
                if (memo.indexOf('TDS Tax Amount for Invoice') !== -1) {
                    throw 'You are not allowed to edit this transaction as the TDS is applied'
                }
            }




        } catch (e) {
            log.error('BeforeSubmit Error', {
                error: e.message || e,
                stack: e.stack,
                executionContext: runtime.executionContext
            });
            throw e;
        }
    }

    const afterSubmit = (context) => {
        try {
            if (!serverHelper.checkSubscription()) {
                log.debug("TaxPro UE afterSubmit", "Subscription check failed - blocking execution");
                return true;
            }
            if (context.type !== context.UserEventType.CREATE &&
                context.type !== context.UserEventType.EDIT &&
                context.type !== context.UserEventType.DELETE) {
                return;
            }

            const newRecord = context.newRecord;
            const recordType = newRecord.type;

            if (recordType !== 'customerpayment') {
                return;
            }
            log.debug('context and value', { type: context.type });

            const paymentId = newRecord.id;
            if (paymentId && context.type != context.UserEventType.DELETE) {
                var rec = record.load({ type: 'customerpayment', id: paymentId });
                var voided = rec.getValue({ fieldId: 'voided' })
            }
            // Handle void/delete event
            if (context.type === context.UserEventType.DELETE || voided == 'T' || context.type == 'delete') {

                const oldRecord = context.oldRecord;
                const voidPaymentId = oldRecord.id;
                log.debug("Delete context", {
                    context_type: context.type,
                    voidPaymentId: voidPaymentId

                })

                // log.audit('Payment Being Voided/Deleted', {
                //     paymentId: voidPaymentId,
                //     type: context.type
                // });

                // CAPTURE invoice IDs and payment amounts BEFORE voiding
                const invoicePaymentMap = {};
                const oldApplyLineCount = oldRecord.getLineCount({
                    sublistId: 'apply'
                });

                for (let i = 0; i < oldApplyLineCount; i++) {
                    const wasApplied = oldRecord.getSublistValue({
                        sublistId: 'apply',
                        fieldId: 'apply',
                        line: i
                    });

                    if (wasApplied === true || wasApplied === 'T') {
                        const invoiceId = oldRecord.getSublistValue({
                            sublistId: 'apply',
                            fieldId: 'internalid',
                            line: i
                        });

                        const paymentAmount = oldRecord.getSublistValue({
                            sublistId: 'apply',
                            fieldId: 'amount',
                            line: i
                        });

                        if (invoiceId && paymentAmount) {
                            invoicePaymentMap[invoiceId] = parseFloat(paymentAmount);
                        }
                    }
                }

                log.debug('Invoice Payment Map Captured', invoicePaymentMap);

                // Find and void all credit memos linked to this payment
                voidCreditMemosForPayment(voidPaymentId, invoicePaymentMap);
                return;
            }

            const isEdit = context.type === context.UserEventType.EDIT;

            // Get applied invoices
            const appliedInvoices = [];
            const invoiceNumberMap = {};
            const paymentAmountMap = {};
            const applyLineCount = newRecord.getLineCount({
                sublistId: 'apply'
            });

            for (let i = 0; i < applyLineCount; i++) {
                const isApplied = newRecord.getSublistValue({
                    sublistId: 'apply',
                    fieldId: 'apply',
                    line: i
                });

                if (isApplied === true || isApplied === 'T') {
                    const invoiceId = newRecord.getSublistValue({
                        sublistId: 'apply',
                        fieldId: 'internalid',
                        line: i
                    });

                    const invoiceNumber = newRecord.getSublistValue({
                        sublistId: 'apply',
                        fieldId: 'refnum',
                        line: i
                    });
                    const paymentAmount = newRecord.getSublistValue({
                        sublistId: 'apply',
                        fieldId: 'amount',
                        line: i
                    });

                    if (invoiceId) {
                        appliedInvoices.push(invoiceId);
                        invoiceNumberMap[invoiceId] = invoiceNumber || invoiceId;
                        paymentAmountMap[invoiceId] = parseFloat(paymentAmount) || 0;

                    }
                }
            }

            log.debug('Applied Invoices', appliedInvoices);
            log.debug('Invoice Number Map', invoiceNumberMap);
            const oldPaymentAmountMap = {};

            // For edit mode, get previously applied invoices to find unapplied ones
            let previouslyAppliedInvoices = [];
            if (isEdit) {
                const oldRecord = context.oldRecord;
                const oldApplyLineCount = oldRecord.getLineCount({
                    sublistId: 'apply'
                });

                for (let i = 0; i < oldApplyLineCount; i++) {
                    const wasApplied = oldRecord.getSublistValue({
                        sublistId: 'apply',
                        fieldId: 'apply',
                        line: i
                    });

                    if (wasApplied === true || wasApplied === 'T') {
                        const oldInvoiceId = oldRecord.getSublistValue({
                            sublistId: 'apply',
                            fieldId: 'internalid',
                            line: i
                        });

                        if (oldInvoiceId) {
                            previouslyAppliedInvoices.push(oldInvoiceId);
                        }
                    }
                }

                // Find unapplied invoices
                const unappliedInvoices = previouslyAppliedInvoices.filter(
                    invId => appliedInvoices.indexOf(invId) === -1
                );
                // const oldPaymentAmountMap = {};
                for (let i = 0; i < oldApplyLineCount; i++) {
                    const wasApplied = oldRecord.getSublistValue({
                        sublistId: 'apply',
                        fieldId: 'apply',
                        line: i
                    });

                    if (wasApplied === true || wasApplied === 'T') {
                        const oldInvoiceId = oldRecord.getSublistValue({
                            sublistId: 'apply',
                            fieldId: 'internalid',
                            line: i
                        });

                        const oldPaymentAmount = oldRecord.getSublistValue({
                            sublistId: 'apply',
                            fieldId: 'amount',
                            line: i
                        });

                        if (oldInvoiceId && oldPaymentAmount) {
                            oldPaymentAmountMap[oldInvoiceId] = parseFloat(oldPaymentAmount) || 0;
                        }
                    }
                }

                log.debug('Unapplied Invoices', unappliedInvoices);
                log.debug('Old Payment Amount Map', oldPaymentAmountMap);

                // Void credit memos for unapplied invoices
                unappliedInvoices.forEach((invoiceId) => {
                    const creditMemoId = findExistingCreditMemo(paymentId, invoiceId);
                    log.debug('Credit Memo Id', creditMemoId);
                    if (creditMemoId) {
                        voidCreditMemo(creditMemoId);
                        // log.audit('Credit Memo Voided - Invoice Unapplied', {
                        //     creditMemoId: creditMemoId,
                        //     invoiceId: invoiceId
                        // });
                    }

                    const oldPaymentAmount = oldPaymentAmountMap[invoiceId] || 0;
                    if (oldPaymentAmount > 0) {
                        reverseInvoiceTdsRemaining(invoiceId, oldPaymentAmount);
                        log.debug('Invoice TDS Remaining Reversed for Unapplied Invoice', {
                            invoiceId: invoiceId,
                            oldPaymentAmount: oldPaymentAmount
                        });
                    }
                });
            }

            if (appliedInvoices.length === 0) {
                log.debug('No Applied Invoices', 'Exiting');
                return;
            }

            // Get TDS JSON data
            const tdsJsonField = newRecord.getValue({
                fieldId: 'custbody_tss_it_inv_tdsamt'
            });

            if (!tdsJsonField) {
                log.debug('No TDS Data', 'custbody_tss_it_inv_tdsamt is empty');
                return;
            }

            let tdsData;
            try {
                tdsData = JSON.parse(tdsJsonField);
            } catch (e) {
                log.error('JSON Parse Error', e.message);
                return;
            }

            // Get payment details
            const customer = newRecord.getValue({
                fieldId: 'customer'
            });

            const subsidiary = newRecord.getValue({
                fieldId: 'subsidiary'
            });

            const currency = newRecord.getValue({
                fieldId: 'currency'
            });

            const invoiceRemainingMap = {};
            if (appliedInvoices.length > 0) {
                const invoiceSearch = search.create({
                    type: search.Type.INVOICE,
                    filters: [
                        ['internalid', 'anyof', appliedInvoices]
                    ],
                    columns: ['internalid', 'custbody_tss_it_tdsamt_remaining']
                });

                invoiceSearch.run().each(function (result) {
                    const invId = result.getValue('internalid');
                    const remaining = parseFloat(result.getValue('custbody_tss_it_tdsamt_remaining')) || 0;
                    invoiceRemainingMap[invId] = remaining;
                    return true;
                });

                log.debug('Invoice Remaining Amounts Loaded', invoiceRemainingMap);
            }

            // Track if any credit memos will be created/updated
            let willProcessCreditMemos = false;
            let invoicesToProcess = [];

            // Pre-check which invoices need credit memo processing
            appliedInvoices.forEach((invoiceId) => {
                const invoiceData = tdsData.find(inv => inv.invoice_id == invoiceId);

                if (invoiceData && invoiceData.credit && invoiceData.credit !== 0 &&
                    invoiceData.items && invoiceData.items.length > 0) {
                    willProcessCreditMemos = true;
                    invoicesToProcess.push(invoiceId);
                }
            });

            // If no credit memos to process, exit without checking checkbox
            if (!willProcessCreditMemos) {
                log.debug('No Credit Memos to Process', 'Exiting without checkbox update');
                return;
            }

            // Check checkbox on payment and invoices
            checkHideUIButtons(paymentId, invoicesToProcess);

            // Process each applied invoice
            appliedInvoices.forEach((invoiceId) => {
                try {
                    // Find invoice data in JSON
                    const invoiceData = tdsData.find(inv => inv.invoice_id == invoiceId);

                    if (!invoiceData) {
                        log.debug('Invoice Not Found in JSON', invoiceId);
                        return;
                    }

                    // Check if TDS is applicable on this invoice - if not, skip credit memo and remaining update entirely
                    const invoiceTdsApplicable = parseFloat(invoiceData.inv_tds_amount) || 0;
                    if (invoiceTdsApplicable <= 0) {
                        log.debug('TDS Not Applicable - Skipping Payment Processing', 'Invoice: ' + invoiceId);
                        return;
                    }

                    // Check if credit exists and items exist
                    if (!invoiceData.credit || invoiceData.credit === 0 || !invoiceData.items || invoiceData.items.length === 0) {
                        log.debug('No Credit or Items', 'Invoice: ' + invoiceId);
                        return;
                    }

                    // Get invoice document number from map
                    const invoiceNumber = invoiceNumberMap[invoiceId];

                    const creditAmount = parseFloat(invoiceData.credit);
                    const totalTdsAmount = parseFloat(invoiceData.total_tds_amount);
                    const items = invoiceData.items;

                    // Calculate line items
                    const lineItems = calculateLineItems(items, creditAmount, totalTdsAmount);

                    // Check if credit memo exists (for EDIT case)
                    let existingCreditMemoId = null;
                    if (isEdit) {
                        existingCreditMemoId = findExistingCreditMemo(paymentId, invoiceId);
                    }

                    if (existingCreditMemoId) {
                        // Update existing credit memo
                        updateCreditMemo(existingCreditMemoId, lineItems, invoiceNumber);
                        log.audit('Credit Memo Updated', {
                            creditMemoId: existingCreditMemoId,
                            invoiceId: invoiceId,
                            invoiceNumber: invoiceNumber
                        });
                    } else {
                        // Create new credit memo
                        const creditMemoId = createCreditMemo(
                            invoiceId,
                            invoiceNumber,
                            lineItems,
                            paymentId,
                            customer,
                            subsidiary,
                            currency
                        );

                        // log.audit('Credit Memo Created', {
                        //     creditMemoId: creditMemoId,
                        //     invoiceId: invoiceId,
                        //     invoiceNumber: invoiceNumber,
                        //     totalCredit: creditAmount,
                        //     itemCount: lineItems.length
                        // });
                    }

                    // Update invoice tds amount remaining
                    // const paymentAmount = paymentAmountMap[invoiceId] || 0;
                    // const currentRemaining = invoiceRemainingMap[invoiceId] || 0;
                    // if (paymentAmount > 0 && currentRemaining > 0) {
                    //     updateInvoiceTdsRemaining(invoiceId, paymentAmount, currentRemaining);
                    // } else if (paymentAmount > 0 && currentRemaining > 0 && currentRemaining < paymentAmount) {
                    //     // Log warning if remaining is less than payment amount
                    //     // log.audit('TDS Remaining Amount Insufficient', {
                    //     //     invoiceId: invoiceId,
                    //     //     paymentAmount: paymentAmount,
                    //     //     currentRemaining: currentRemaining,
                    //     //     message: 'Current remaining amount is less than payment amount - skipping deduction'
                    //     // });
                    // }
                    // Update invoice tds amount remaining
                    const newPaymentAmount = paymentAmountMap[invoiceId] || 0;
                    const oldPaymentAmount = oldPaymentAmountMap[invoiceId] || 0;
                    const currentRemaining = invoiceRemainingMap[invoiceId] || 0;

                    // In EDIT mode, handle payment amount changes
                    if (isEdit && oldPaymentAmount > 0) {
                        // Check if payment amount changed
                        if (oldPaymentAmount !== newPaymentAmount) {
                            log.debug('Payment Amount Changed', {
                                invoiceId: invoiceId,
                                oldAmount: oldPaymentAmount,
                                newAmount: newPaymentAmount,
                                currentRemaining: currentRemaining
                            });

                            // First, add back the old payment amount
                            reverseInvoiceTdsRemaining(invoiceId, oldPaymentAmount);

                            // Then deduct the new payment amount
                            // Get fresh remaining after reversal
                            const invoiceRec = record.load({
                                type: record.Type.INVOICE,
                                id: invoiceId,
                                isDynamic: false
                            });

                            const restoredRemaining = parseFloat(invoiceRec.getValue({
                                fieldId: 'custbody_tss_it_tdsamt_remaining'
                            })) || 0;

                            if (newPaymentAmount > 0 && restoredRemaining > 0) {
                                updateInvoiceTdsRemaining(invoiceId, newPaymentAmount, restoredRemaining);
                            }
                        }
                        // If payment amount didn't change, no action needed
                    } else if (!isEdit) {
                        // CREATE mode - just deduct the payment amount
                        if (newPaymentAmount > 0 && currentRemaining > 0) {
                            updateInvoiceTdsRemaining(invoiceId, newPaymentAmount, currentRemaining);
                        }
                    }


                } catch (e) {
                    log.error('Credit Memo Error', {
                        invoiceId: invoiceId,
                        error: e.message,
                        stack: e.stack
                    });
                }
            });


            // Uncheck checkbox after all processing
            uncheckHideUIButtons(paymentId, invoicesToProcess);

        } catch (e) {
            log.error('AfterSubmit Error', {
                error: e.message,
                stack: e.stack
            });
        }
    };

    /**
     * Update custbody_tss_it_tdsamt_remaining field on invoice
     */
    const updateInvoiceTdsRemaining = (invoiceId, paymentAmount, currentRemaining) => {
        try {
            if (currentRemaining <= 0) {
                log.debug('TDS Remaining Amount Already Zero', {
                    invoiceId: invoiceId,
                    message: 'Skipping deduction as remaining amount is already zero'
                });
                return;
            }

            if (paymentAmount > currentRemaining) {
                log.error('Invalid Deduction Amount', {
                    invoiceId: invoiceId,
                    paymentAmount: paymentAmount,
                    currentRemaining: currentRemaining,
                    message: 'Payment amount exceeds remaining TDS amount - skipping deduction'
                });
                return;
            }

            // LOAD the invoice record instead of direct update
            const invoiceRec = record.load({
                type: record.Type.INVOICE,
                id: invoiceId,
                isDynamic: false
            });

            // Get the current value from the loaded record
            const currentValue = parseFloat(invoiceRec.getValue({
                fieldId: 'custbody_tss_it_tdsamt_remaining'
            })) || 0;

            // Subtract the payment amount
            const newRemaining = currentValue - paymentAmount;

            if (newRemaining < 0) {
                log.error('Negative Remaining Amount Detected', {
                    invoiceId: invoiceId,
                    newRemaining: newRemaining,
                    message: 'Calculation resulted in negative value - skipping update'
                });
                return;
            }

            // Set the new value
            invoiceRec.setValue({
                fieldId: 'custbody_tss_it_tdsamt_remaining',
                value: newRemaining
            });

            // Save the invoice
            invoiceRec.save({
                enableSourcing: false,
                ignoreMandatoryFields: true
            });

            // log.audit('Invoice TDS Remaining Updated', {
            //     invoiceId: invoiceId,
            //     previousRemaining: currentValue,
            //     paymentAmount: paymentAmount,
            //     newRemaining: newRemaining
            // });

        } catch (e) {
            log.error('Update Invoice Error', {
                invoiceId: invoiceId,
                error: e.message,
                stack: e.stack
            });
        }
    };

    /**
     * Calculate line items based on TDS data
     */
    const calculateLineItems = (items, creditAmount, totalTdsAmount) => {
        try {
            const lineItems = [];

            if (items.length === 0) {
                return lineItems;
            }

            if (items.length === 1) {
                // Single item - use full credit amount
                lineItems.push({
                    item: items[0].tds_section_item,
                    amount: creditAmount
                });
            } else {
                // Check if all items have the same tds_section_item
                const firstItem = items[0].tds_section_item;
                const allSame = items.every(item => item.tds_section_item === firstItem);

                if (allSame) {
                    // All items same - add single line with full credit
                    lineItems.push({
                        item: firstItem,
                        amount: creditAmount
                    });
                } else {
                    // Multiple different items - calculate proportional amounts
                    items.forEach((item) => {
                        const lineTdsAmount = parseFloat(item.line_tds_amount);
                        const lineAmount = creditAmount * (lineTdsAmount / totalTdsAmount);
                        const roundedAmount = parseFloat(lineAmount.toFixed(2));

                        lineItems.push({
                            item: item.tds_section_item,
                            amount: roundedAmount
                        });
                    });
                }
            }

            return lineItems;
        } catch (e) {
            log.error('Calculate Line Items Error', {
                error: e.message,
                stack: e.stack
            });
        }
    };

    /**
     * Find existing credit memo for invoice and payment
     */
    const findExistingCreditMemo = (paymentId, invoiceId) => {
        try {
            const creditMemoSearch = search.create({
                type: search.Type.CREDIT_MEMO,
                filters: [
                    ['custbody_tss_it_paymt_tds', 'anyof', paymentId],
                    'AND',
                    ['appliedtotransaction', 'anyof', invoiceId],
                    'AND',
                    ['mainline', 'is', 'T']
                ],
                columns: ['internalid']
            });

            let creditMemoId = null;
            creditMemoSearch.run().each(function (result) {
                creditMemoId = result.getValue('internalid');
                return false; // Get first result only
            });

            return creditMemoId;

        } catch (e) {
            log.error('Find Credit Memo Error', e.message);
            return null;
        }
    };

    /**
     * Create new credit memo
     */
    const createCreditMemo = (invoiceId, invoiceNumber, lineItems, paymentId, customer, subsidiary, currency) => {
        log.debug("create credit memo", {
            invoiceId: invoiceId,
            paymentId: paymentId,

        })
        // Transform invoice to credit memo
        const creditMemo = record.transform({
            fromType: record.Type.INVOICE,
            fromId: invoiceId,
            toType: record.Type.CREDIT_MEMO,
            isDynamic: true
        });

        // Get department and class from the invoice
        const invoiceFields = search.lookupFields({
            type: search.Type.INVOICE,
            id: invoiceId,
            columns: ['department', 'class', 'location']
        });

        const invoiceDepartment = Array.isArray(invoiceFields.department) && invoiceFields.department.length > 0
            ? invoiceFields.department[0].value
            : '';
        const invoiceClass = Array.isArray(invoiceFields.class) && invoiceFields.class.length > 0
            ? invoiceFields.class[0].value
            : '';
        const invoiceLocation = Array.isArray(invoiceFields.location) && invoiceFields.location.length > 0
            ? invoiceFields.location[0].value
            : '';

        // Remove all existing line items
        const lineCount = creditMemo.getLineCount({
            sublistId: 'item'
        });

        for (let i = lineCount - 1; i >= 0; i--) {
            creditMemo.removeLine({
                sublistId: 'item',
                line: i
            });
        }

        // Set memo
        creditMemo.setValue({
            fieldId: 'memo',
            value: 'TDS Tax Amount for Invoice ' + invoiceNumber
        });

        // Set payment reference
        creditMemo.setValue({
            fieldId: 'custbody_tss_it_paymt_tds',
            value: paymentId
        });

        // Set department and class at body level
        if (invoiceDepartment) {
            creditMemo.setValue({
                fieldId: 'department',
                value: invoiceDepartment
            });
        }

        if (invoiceClass) {
            creditMemo.setValue({
                fieldId: 'class',
                value: invoiceClass
            });
        }

        if (invoiceLocation) {
            creditMemo.setValue({
                fieldId: 'location',
                value: invoiceLocation
            });
        }

        // Add line items
        lineItems.forEach((lineItem) => {
            creditMemo.selectNewLine({
                sublistId: 'item'
            });

            creditMemo.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                value: lineItem.item
            });

            creditMemo.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                value: 1
            });

            creditMemo.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'rate',
                value: lineItem.amount
            });

            if (invoiceDepartment) {
                creditMemo.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'department',
                    value: invoiceDepartment
                });
            }

            if (invoiceClass) {
                creditMemo.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'class',
                    value: invoiceClass
                });
            }

            if (invoiceLocation) {
                creditMemo.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'location',
                    value: invoiceLocation
                });
            }

            creditMemo.commitLine({
                sublistId: 'item'
            });

            log.debug('Line Item Added', {
                item: lineItem.item,
                amount: lineItem.amount,
                department: invoiceDepartment,
                class: invoiceClass,
                location: invoiceLocation
            });
        });

        // Apply to invoice in apply tab
        const applyLineCount = creditMemo.getLineCount({
            sublistId: 'apply'
        });

        log.debug("applyLineCount", applyLineCount);

        for (let i = 0; i < applyLineCount; i++) {
            const applyInvoiceId = creditMemo.getSublistValue({
                sublistId: 'apply',
                fieldId: 'internalid',
                line: i
            });

            if (applyInvoiceId == invoiceId) {
                log.debug("match found", {
                    applyInvoiceId: applyInvoiceId,
                    invoiceId: invoiceId
                });

                creditMemo.selectLine({
                    sublistId: 'apply',
                    line: i
                });

                creditMemo.setCurrentSublistValue({
                    sublistId: 'apply',
                    fieldId: 'apply',
                    value: true
                });

                creditMemo.commitLine({
                    sublistId: 'apply'
                });

                log.debug('Invoice Applied', invoiceId);
                break;
            }
        }

        // Save credit memo
        const creditMemoId = creditMemo.save({
            enableSourcing: true,
            ignoreMandatoryFields: true
        });

        return creditMemoId;
    };

    /**
     * Update existing credit memo
     */
    const updateCreditMemo = (creditMemoId, lineItems, invoiceNumber) => {
        try {
            const creditMemo = record.load({
                type: record.Type.CREDIT_MEMO,
                id: creditMemoId,
                isDynamic: true
            });

            let needsUpdate = false;

            // Check if line count matches
            const existingLineCount = creditMemo.getLineCount({
                sublistId: 'item'
            });

            if (existingLineCount !== lineItems.length) {
                needsUpdate = true;
            } else {
                // Check if amounts match
                for (let i = 0; i < existingLineCount; i++) {
                    const existingItem = creditMemo.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: i
                    });


                    const existingAmount = parseFloat(creditMemo.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        line: i
                    }));

                    const matchingLine = lineItems.find(li => li.item == existingItem);

                    const existingRounded = parseFloat(existingAmount.toFixed(2));
                    const newRounded = matchingLine ? parseFloat(matchingLine.amount.toFixed(2)) : 0;

                    if (!matchingLine || existingRounded !== newRounded) {
                        needsUpdate = true;
                        log.debug('Credit Memo Update Needed - Amount Changed', {
                            line: i,
                            existingItem: existingItem,
                            existingAmount: existingRounded,
                            newAmount: newRounded
                        });
                        break;
                    }
                }
            }

            if (!needsUpdate) {
                log.debug('No Update Needed', creditMemoId);
                return;
            }

            const appliedInvoiceIds = [];
            const applyLineCount = creditMemo.getLineCount({
                sublistId: 'apply'
            });

            for (let i = 0; i < applyLineCount; i++) {
                const isApplied = creditMemo.getSublistValue({
                    sublistId: 'apply',
                    fieldId: 'apply',
                    line: i
                });

                if (isApplied === true || isApplied === 'T') {
                    const invoiceId = creditMemo.getSublistValue({
                        sublistId: 'apply',
                        fieldId: 'internalid',
                        line: i
                    });

                    if (invoiceId) {
                        appliedInvoiceIds.push(invoiceId);
                    }
                }
            }

            log.debug('Captured Applied Invoices', appliedInvoiceIds);

            // UNAPPLY credit memo from all invoices before updating amounts
            for (let i = 0; i < applyLineCount; i++) {
                const isApplied = creditMemo.getSublistValue({
                    sublistId: 'apply',
                    fieldId: 'apply',
                    line: i
                });

                if (isApplied === true || isApplied === 'T') {
                    creditMemo.selectLine({
                        sublistId: 'apply',
                        line: i
                    });

                    creditMemo.setCurrentSublistValue({
                        sublistId: 'apply',
                        fieldId: 'apply',
                        value: false
                    });

                    creditMemo.commitLine({
                        sublistId: 'apply'
                    });

                    log.debug('Unapplied Line', i);
                }
            }
            // Remove all existing lines
            for (let i = existingLineCount - 1; i >= 0; i--) {
                creditMemo.removeLine({
                    sublistId: 'item',
                    line: i
                });
            }

            // Add updated line items
            lineItems.forEach((lineItem) => {
                log.debug('Updating Line Item', {
                    item: lineItem.item,
                    // existingAmount: existingAmount,
                    amount: lineItem.amount
                });
                creditMemo.selectNewLine({
                    sublistId: 'item'
                });

                creditMemo.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: lineItem.item
                });

                creditMemo.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: 1
                });

                creditMemo.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    value: lineItem.amount
                });

                creditMemo.commitLine({
                    sublistId: 'item'
                });
            });


            const newApplyLineCount = creditMemo.getLineCount({
                sublistId: 'apply'
            });

            log.debug('Reapplying Credit Memo', {
                creditMemoId: creditMemoId,
                appliedInvoiceIds: appliedInvoiceIds,
                newApplyLineCount: newApplyLineCount
            });

            for (let i = 0; i < newApplyLineCount; i++) {
                const applyInvoiceId = creditMemo.getSublistValue({
                    sublistId: 'apply',
                    fieldId: 'internalid',
                    line: i
                });

                // Only reapply if this invoice was previously applied
                if (appliedInvoiceIds.indexOf(applyInvoiceId) !== -1) {
                    creditMemo.selectLine({
                        sublistId: 'apply',
                        line: i
                    });

                    creditMemo.setCurrentSublistValue({
                        sublistId: 'apply',
                        fieldId: 'apply',
                        value: true
                    });

                    creditMemo.commitLine({
                        sublistId: 'apply'
                    });

                    log.debug('Reapplied to Invoice', applyInvoiceId);
                }
            }


            // Save updated credit memo
            creditMemo.save({
                enableSourcing: true,
                ignoreMandatoryFields: false
            });

            log.debug('Credit Memo Lines Updated', {
                creditMemoId: creditMemoId,
                newLineCount: lineItems.length
            });
        } catch (e) {
            log.error('Update Credit Memo Error', {
                creditMemoId: creditMemoId,
                error: e.message,
                stack: e.stack
            });
        }
    };

    /**
     * Void all credit memos for a payment
     */
    const voidCreditMemosForPayment = (paymentId, invoicePaymentMap) => {
        try {
            const cmSearchSettings = [
                { "name": "consolidationtype", "value": "ACCTTYPE" },
                { "name": "includeperiodendtransactions", "value": "F" }
            ];

            // Void credit memos — first try non-voided only
            let creditMemoSearch = search.create({
                type: "creditmemo",
                settings: cmSearchSettings,
                filters: [
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['type', 'anyof', 'CustCred'],
                    'AND',
                    ['custbody_tss_it_paymt_tds', 'anyof', paymentId],
                    'AND',
                    ['status', 'noneof', 'CustCred:V']
                ],
                columns: ['internalid']
            });

            let searchResultCount = creditMemoSearch.runPaged().count;
            log.debug('voidCreditMemosForPayment Search Count (with status filter)', searchResultCount);

            // If no results, NetSuite may have auto-voided them — retry without status filter
            if (searchResultCount === 0) {
                log.debug('No non-voided credit memos found — retrying without status filter', paymentId);
                creditMemoSearch = search.create({
                    type: "creditmemo",
                    settings: cmSearchSettings,
                    filters: [
                        ['mainline', 'is', 'T'],
                        'AND',
                        ['type', 'anyof', 'CustCred'],
                        'AND',
                        ['custbody_tss_it_paymt_tds', 'anyof', paymentId]
                    ],
                    columns: ['internalid']
                });
                searchResultCount = creditMemoSearch.runPaged().count;
                log.debug('voidCreditMemosForPayment Search Count (without status filter)', searchResultCount);
            }

            creditMemoSearch.run().each(function (result) {
                const creditMemoId = result.getValue('internalid');
                log.debug('voidCreditMemosForPayment Credit Memo', creditMemoId);
                voidCreditMemo(creditMemoId);
                return true;
            });

            // ADD BACK payment amounts to invoice custbody_tss_it_tdsamt_remaining
            if (invoicePaymentMap && Object.keys(invoicePaymentMap).length > 0) {
                // log.audit('Reversing Invoice TDS Amounts', {
                //     paymentId: paymentId,
                //     invoiceCount: Object.keys(invoicePaymentMap).length
                // });

                Object.keys(invoicePaymentMap).forEach(function (invoiceId) {
                    const paymentAmount = invoicePaymentMap[invoiceId];
                    log.debug('Reverse Invoice TDS Remaining', {
                        invoiceId: invoiceId,
                        paymentAmount: paymentAmount
                    });
                    reverseInvoiceTdsRemaining(invoiceId, paymentAmount);
                });
            } else {
                log.debug('No Invoice Payment Map Provided', {
                    paymentId: paymentId,
                    message: 'Skipping invoice amount reversal'
                });
            }


        } catch (e) {
            log.error('Void Credit Memos Error', {
                paymentId: paymentId,
                error: e.message,
                stack: e.stack
            });
        }
    };

    /**
     * Reverse/Add back the payment amount to custbody_tss_it_tdsamt_remaining when payment is voided
     */
    const reverseInvoiceTdsRemaining = (invoiceId, paymentAmount) => {
        try {
            if (!paymentAmount || paymentAmount <= 0) {
                log.debug('No Payment Amount to Reverse', {
                    invoiceId: invoiceId,
                    paymentAmount: paymentAmount
                });
                return;
            }

            // LOAD the invoice record instead of using submitFields
            const invoiceRec = record.load({
                type: record.Type.INVOICE,
                id: invoiceId,
                isDynamic: false
            });

            // Get the current value from the loaded record
            const currentRemaining = parseFloat(invoiceRec.getValue({
                fieldId: 'custbody_tss_it_tdsamt_remaining'
            })) || 0;

            // Add back the payment amount
            const newRemaining = currentRemaining + paymentAmount;

            // Set the new value
            invoiceRec.setValue({
                fieldId: 'custbody_tss_it_tdsamt_remaining',
                value: newRemaining
            });

            // Save the invoice
            invoiceRec.save({
                enableSourcing: false,
                ignoreMandatoryFields: true
            });

            // log.audit('Invoice TDS Remaining Reversed', {
            //     invoiceId: invoiceId,
            //     previousRemaining: currentRemaining,
            //     paymentAmountAdded: paymentAmount,
            //     newRemaining: newRemaining
            // });

        } catch (e) {
            log.error('Reverse Invoice TDS Remaining Error', {
                invoiceId: invoiceId,
                error: e.message,
                stack: e.stack
            });
        }
    };

    /**
     * Void a single credit memo
     */
    const voidCreditMemo = (creditMemoId) => {
        try {
            // Check if credit memo is already voided
            const cmStatus = search.lookupFields({
                type: search.Type.CREDIT_MEMO,
                id: creditMemoId,
                columns: ['status']
            });

            if (cmStatus && cmStatus.status && cmStatus.status[0].value === 'CustCred:V') {
                log.debug('Credit Memo Already Voided', creditMemoId);
                return;
            }
            try {
                transaction.void({
                    type: "creditmemo",
                    id: creditMemoId
                });
            } catch (e) {
                log.error("error n transaction void", e)
                record.delete({
                    type: "creditmemo",
                    id: creditMemoId
                });
            }

            try {
                const postVoidStatus = search.lookupFields({
                    type: search.Type.CREDIT_MEMO,
                    id: creditMemoId,
                    columns: ['status']
                });

                const isVoided = postVoidStatus && postVoidStatus.status &&
                    postVoidStatus.status[0] && postVoidStatus.status[0].value === 'CustCred:V';

                log.debug('Post-Void Credit Memo Status', {
                    creditMemoId: creditMemoId,
                    status: postVoidStatus && postVoidStatus.status && postVoidStatus.status[0]
                        ? postVoidStatus.status[0].value : 'unknown'
                });

                if (!isVoided) {
                    log.debug('Credit Memo Not Voided - Deleting', creditMemoId);
                    record.delete({
                        type: record.Type.CREDIT_MEMO,
                        id: creditMemoId
                    });
                    log.debug('Credit Memo Deleted', creditMemoId);
                }
            } catch (e) {
                log.error('Post-Void Status Check / Delete Error', {
                    creditMemoId: creditMemoId,
                    error: e.message,
                    stack: e.stack
                });
            }

            // log.audit('Credit Memo Voided Successfully', creditMemoId);

        } catch (e) {
            log.error('Void Credit Memo Error', {
                creditMemoId: creditMemoId,
                error: e.message,
                stack: e.stack
            });
        }
    };

    /**
     * Check hide UI buttons checkbox
     */
    const checkHideUIButtons = (paymentId, invoiceIds) => {
        try {
            // Check payment checkbox
            record.submitFields({
                type: record.Type.CUSTOMER_PAYMENT,
                id: paymentId,
                values: {
                    'custbody_tss_it_hide_ui_buttons': true
                }
            });

            // Check invoice checkboxes
            invoiceIds.forEach((invoiceId) => {
                try {
                    record.submitFields({
                        type: record.Type.INVOICE,
                        id: invoiceId,
                        values: {
                            'custbody_tss_it_hide_ui_buttons': true
                        }
                    });
                } catch (e) {
                    log.error('Check Invoice Checkbox Error', {
                        invoiceId: invoiceId,
                        error: e.message
                    });
                }
            });

            log.debug('Hide UI Buttons Checked', {
                paymentId: paymentId,
                invoiceIds: invoiceIds
            });

        } catch (e) {
            log.error('Check Hide UI Buttons Error', e.message);
        }
    };

    /**
     * Uncheck hide UI buttons checkbox
     */
    const uncheckHideUIButtons = (paymentId, invoiceIds) => {
        try {
            // Uncheck payment checkbox
            record.submitFields({
                type: record.Type.CUSTOMER_PAYMENT,
                id: paymentId,
                values: {
                    'custbody_tss_it_hide_ui_buttons': false
                }
            });

            // Uncheck invoice checkboxes
            invoiceIds.forEach((invoiceId) => {
                try {
                    record.submitFields({
                        type: record.Type.INVOICE,
                        id: invoiceId,
                        values: {
                            'custbody_tss_it_hide_ui_buttons': false
                        }
                    });
                } catch (e) {
                    log.error('Uncheck Invoice Checkbox Error', {
                        invoiceId: invoiceId,
                        error: e.message
                    });
                }
            });

            log.debug('Hide UI Buttons Unchecked', {
                paymentId: paymentId,
                invoiceIds: invoiceIds
            });

        } catch (e) {
            log.error('Uncheck Hide UI Buttons Error', e.message);
        }
    };

    /**
     * Look up the TDS Master record for a section: Base/Gross basis and the PAN-based rate
     */
    const getInvoiceTdsMasterData = (tdsSectionId) => {
        var masterData = {
            calculateOn: 'Base',
            netPercentage: 0,
            panEmptyPercentage: 0
        };

        if (tdsSectionId) {
            try {
                var tdsMasterFields = search.lookupFields({
                    type: 'customrecord_tss_its_tdsmaster',
                    id: tdsSectionId,
                    columns: ['custrecord_tss_its_calculate', 'custrecord_tss_its_netperc', 'custrecord_tss_its_panempty_per']
                });

                var calculateField = tdsMasterFields.custrecord_tss_its_calculate;
                if (calculateField && calculateField.length > 0) {
                    masterData.calculateOn = calculateField[0].text;
                }

                masterData.netPercentage = parseFloat(tdsMasterFields.custrecord_tss_its_netperc) || 0;
                masterData.panEmptyPercentage = parseFloat(tdsMasterFields.custrecord_tss_its_panempty_per) || 0;
            } catch (e) {
                log.error('TDS Master Lookup Error', e.message);
            }
        }

        return masterData;
    };

    /**
     * Check whether the customer on the invoice has PAN available
     */
    const isCustomerPanAvailable = (customerId) => {
        var panAvailable = false;

        if (customerId) {
            try {
                var customerFields = search.lookupFields({
                    type: search.Type.CUSTOMER,
                    id: customerId,
                    columns: ['custentity_tss_it_cust_pan_avlbl']
                });

                panAvailable = customerFields.custentity_tss_it_cust_pan_avlbl === true;
            } catch (e) {
                log.error('Customer PAN Available Lookup Error', e.message);
            }
        }

        return panAvailable;
    };

    /**
     * Calculate TDS rate/base/amount/remaining per item line on the invoice (server-side mirror of the client script)
     */
    const calculateInvoiceTdsAmounts = (newRecord) => {
        try {
            var customerId = newRecord.getValue({
                fieldId: 'entity'
            });

            var panAvailable = isCustomerPanAvailable(customerId);

            var lineCount = newRecord.getLineCount({
                sublistId: 'item'
            });

            for (var i = 0; i < lineCount; i++) {
                var tdsSectionId = newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_it_tds_sec_invoice',
                    line: i
                });

                var tdsMasterData = getInvoiceTdsMasterData(tdsSectionId);

                // Set the TDS rate (only if not already populated)
                var existingRate = newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_it_tds_rate_invoice',
                    line: i
                });

                var tdsRate = parseFloat(existingRate) || 0;

                if (!existingRate) {
                    tdsRate = panAvailable ? tdsMasterData.netPercentage : tdsMasterData.panEmptyPercentage;

                    newRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_tss_it_tds_rate_invoice',
                        line: i,
                        value: tdsRate
                    });
                }

                var lineAmount = parseFloat(newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'amount',
                    line: i
                })) || 0;

                var lineGrossAmount = parseFloat(newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'grossamt',
                    line: i
                })) || 0;

                var baseValue = (tdsMasterData.calculateOn === 'Gross') ? lineGrossAmount : lineAmount;

                // Set the base invoice amount (only if not already populated)
                var existingBaseAmount = newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_it_tds_base_invoice',
                    line: i
                });

                if (!existingBaseAmount) {
                    newRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_tss_it_tds_base_invoice',
                        line: i,
                        value: baseValue
                    });
                }

                // Use the actual stored base amount (existing value takes priority over the freshly computed one)
                var finalBaseAmount = parseFloat(existingBaseAmount) || baseValue;

                // TDS amount = TDS rate % of TDS base invoice amount
                var tdsAmount = (finalBaseAmount * tdsRate) / 100;

                // Remaining amount = gross amount - TDS amount
                var netAmount = lineGrossAmount - tdsAmount;

                // Set the TDS amount (only if not already populated)
                var existingTdsAmount = newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_it_tdsamt_invoice',
                    line: i
                });

                if (!existingTdsAmount) {
                    newRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_tss_it_tdsamt_invoice',
                        line: i,
                        value: tdsAmount
                    });
                }

                // Set the TDS remaining amount (only if not already populated)
                var existingRemaining = newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_it_tds_remain_inv',
                    line: i
                });

                if (!existingRemaining) {
                    newRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_tss_it_tds_remain_inv',
                        line: i,
                        value: netAmount
                    });
                }

                log.debug('Invoice TDS Calculation', {
                    line: i,
                    baseAmount: finalBaseAmount,
                    tdsRate: tdsRate,
                    tdsAmount: tdsAmount,
                    grossAmount: lineGrossAmount,
                    netAmount: netAmount
                });
            }
        } catch (e) {
            log.error('calculateInvoiceTdsAmounts Error', e.message);
        }
    };

    return {
        beforeLoad: beforeLoad,
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
});