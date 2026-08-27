/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 * Async TDS Payment processor: matches Suitelet sync flow with proper error handling
 * - Loads paid relations
 * - Creates Check with TDS expenses
 * - Updates TDS_REL records with new payable balance, status, payment link, etc.
 * - Links Check to Payment record
 * - On any error: deletes payment record to avoid orphaned records
 */
define(['N/record', 'N/search', 'N/log', 'N/runtime', 'N/email'],
    function (record, search, log, runtime, email) {

        const TDS_REL = 'customrecord_tss_its_tds_billrelation';
        const TDS_PAY = 'customrecord_tss_its_tds_paymentdetails';
        const CHECK = 'check';

        /**
         * Parse payload and fetch all TDS relations in one search; return pre-loaded data to map
         */
        function getInputData() {
            try {
                var payloadStr = runtime.getCurrentScript().getParameter({ name: 'custscript_tss_mr_tdspymnt_payload' });
                if (!payloadStr) {
                    throw new Error('Missing payload parameter custscript_tss_mr_tdspymnt_payload');
                }
                var payload = JSON.parse(payloadStr);
                var selectedIds = payload.selectedIds || [];

                if (selectedIds.length === 0) {
                    throw new Error('No relation IDs in payload');
                }

                log.debug('MR Payload loaded', {
                    selectedIds: selectedIds.length,
                    paymentRecordId: payload.paymentRecordId
                });

                // Search all relations at once with internalid filter
                var filters = [['internalid', 'anyof', selectedIds]];
                var cols = [
                    search.createColumn({ name: 'internalid' }),
                    search.createColumn({ name: 'custrecord_tss_its_billtdspayable' }),
                    search.createColumn({ name: 'custrecord_tss_its_billbillno' }),
                    search.createColumn({ name: 'custrecord_tss_its_billtdsaccount' }),
                    search.createColumn({ name: 'custrecord_tss_its_billamount' }),
                    search.createColumn({ name: 'custrecord_tss_its_billtdsamount' }),
                    search.createColumn({ name: 'custrecord_tss_its_vendorbillrel' }),
                    search.createColumn({ name: 'custrecord_tss_its_billtdstype' }),
                    search.createColumn({ name: 'custrecord_tss_its_billtdssection' })
                ];

                var s = search.create({ type: TDS_REL, filters: filters, columns: cols });
                var paged = s.runPaged({ pageSize: 1000 });
                var out = [];

                log.debug('Search executed', 'relationCount=' + paged.pageRanges.length);

                // Iterate through search results and output pre-loaded data
                paged.pageRanges.forEach(function (pr) {
                    var page = paged.fetch({ index: pr.index });
                    page.data.forEach(function (sr) {
                        out.push(JSON.stringify({
                            relationId: sr.getValue('internalid'),
                            tdsPayable: parseFloat(sr.getValue('custrecord_tss_its_billtdspayable')) || 0,
                            billNo: sr.getValue('custrecord_tss_its_billbillno'),
                            tdsAccount: sr.getValue('custrecord_tss_its_billtdsaccount'),
                            billAmount: parseFloat(sr.getValue('custrecord_tss_its_billamount')) || 0,
                            tdsamount: parseFloat(sr.getValue('custrecord_tss_its_billtdsamount')) || 0,
                            vendorRel: sr.getValue('custrecord_tss_its_vendorbillrel'),
                            tdsType: sr.getValue('custrecord_tss_its_billtdstype'),
                            tdsSection: sr.getValue('custrecord_tss_its_billtdssection'),
                            context: payload
                        }));
                    });
                });

                log.debug('getInputData complete', 'resultsCount=' + out.length);
                return out;
            } catch (e) {
                log.error('getInputData error', e);
                // throw e;
            }
        }

        /**
         * Map phase: process pre-loaded relation data from search (no additional record loads needed)
         */
        function map(context) {
            try {
                log.debug('Map input', context.value);
                var obj = JSON.parse(context.value);
                var relationId = obj.relationId;
                var tdsPay = obj.tdsPayable;
                var billNo = obj.billNo;
                var payload = obj.context;

                log.debug('Map: TDS Relation processed', {
                    relationId: relationId,
                    billNo: billNo,
                    tdsPay: tdsPay
                });

                // Output the relation for reduce phase (data already pre-loaded in getInputData)
                context.write({
                    key: 'RELATION_' + relationId,
                    value: JSON.stringify({
                        relationId: relationId,
                        tdsPayable: tdsPay,
                        billNo: billNo,
                        tdsAccount: obj.tdsAccount,
                        context: payload
                    })
                });
            } catch (e) {
                log.error('Map error for relation', e);
                context.write({ key: 'MAP_ERROR', value: JSON.stringify({ error: e.toString(), value: context.value }) });
            }
        }

        /**
         * Reduce: aggregate all relations and prepare for check creation
         */
        function reduce(context) {
            try {
                log.debug('Reduce input', {
                    key: context.key,
                    values: context.values
                });
                var relations = [];
                var totalTds = 0;
                var contextData = null;

                // Parse relation values
                context.values.forEach(function (v) {
                    try {
                        var obj = JSON.parse(v);
                        if (obj.relationId) {
                            relations.push(obj);
                            totalTds += parseFloat(obj.tdsPayable) || 0;
                            if (!contextData) contextData = obj.context;
                        }
                    } catch (pe) {
                        log.error('Reduce: parse error', pe);
                    }
                });

                if (relations.length === 0) {
                    log.warn('Reduce: no relations found for key', context.key);
                    context.write({
                        key: context.key,
                        value: JSON.stringify({ status: 'SKIP', reason: 'no_relations' })
                    });
                    return;
                }

                log.debug('Reduce: aggregated relations', {
                    key: context.key,
                    relationCount: relations.length,
                    totalTds: totalTds
                });

                // Output aggregated data for summarize
                context.write({
                    key: 'REDUCE_' + context.key,
                    value: JSON.stringify({
                        relations: relations,
                        totalTds: totalTds,
                        context: contextData
                    })
                });
            } catch (e) {
                log.error('Reduce error for key ' + context.key, e);
                context.write({ key: 'REDUCE_ERROR', value: JSON.stringify({ error: e.toString(), key: context.key }) });
            }
        }

        /**
         * Summarize: create Check, update relations, link to Payment, handle errors and cleanup
         */
        function summarize(summary) {
            try {
                log.audit('MR Summarize start', {
                    mapCount: summary.mapSummary.outputCount,
                    reduceCount: summary.reduceSummary.outputCount,
                    usagePoints: summary.usage.usage,
                    totalSeconds: summary.seconds
                });
                log.debug('Summarize details', JSON.stringify(summary));
                var checkCreated = null;
                var updatedRelations = [];
                var paymentRecordId = null;
                var contextData = null;
                var allRelations = [];
                var totalTdsAmount = 0;
                var isPaymentDeleted = false;

                // Parse summarize output
                var hasErrors = false;
                summary.output.iterator().each(function (key, value) {
                    try {
                        var obj = JSON.parse(value);

                        // Track aggregated relation data
                        if (key.indexOf('REDUCE_') === 0 && obj.relations) {
                            allRelations = allRelations.concat(obj.relations);
                            totalTdsAmount += parseFloat(obj.totalTds) || 0;
                            contextData = obj.context;
                        }

                        // Flag errors
                        if (key.indexOf('ERROR') === 0) {
                            log.error('Summarize: found error', { key: key, error: obj.error });
                            hasErrors = true;
                        }
                    } catch (pe) {
                        log.error('Summarize: parse error on key ' + key, pe);
                        hasErrors = true;
                    }
                    return true;
                });

                // Extract payment record ID and other context
                if (contextData) {
                    paymentRecordId = contextData.paymentRecordId;
                    log.debug('Summarize: context loaded', {
                        paymentRecordId: paymentRecordId,
                        relationCount: allRelations.length
                    });
                    if (contextData.applyInterest) {
                        totalTdsAmount += parseFloat(contextData.interestAmt) || 0;
                    }
                }

                // If any map/reduce errors or no relations, mark as failed
                if (hasErrors || allRelations.length === 0) {
                    log.error('Summarize: processing has errors or no relations', {
                        mapErrors: summary.mapSummary.errorsCount,
                        reduceErrors: summary.reduceSummary.errorsCount,
                        relationCount: allRelations.length
                    });
                    // Delete payment record to avoid orphaned record
                    if (paymentRecordId) {
                        try {
                            record.delete({ type: TDS_PAY, id: paymentRecordId });
                            log.audit('Payment record deleted due to MR errors', 'paymentId=' + paymentRecordId);
                            isPaymentDeleted = true;
                        } catch (delErr) {
                            log.error('Failed to delete payment record after MR errors', delErr);
                        }
                    }
                    throw new Error('MR processing failed: map/reduce errors or no relations found');
                }

                // Create Check (matches Suitelet flow exactly)
                log.debug('Creating check with TDS expenses', {
                    bankAccount: contextData.bankAccount,
                    taxAgency: contextData.taxAgency,
                    expectedExpenses: allRelations.length
                });

                checkCreated = createCheckWithExpenses(allRelations, contextData);
                log.audit('Check created', 'checkId=' + checkCreated);

                // Update all TDS relations (matches Suitelet flow)
                var updateTdsRelationsResult = updateTdsRelations(allRelations, contextData, paymentRecordId);
                updatedRelations = updateTdsRelationsResult.updated;
                log.audit('Relations updated', 'count=' + updatedRelations.length);
                if (!updateTdsRelationsResult.success) {
                    log.error('Failed to update some relations', updateTdsRelationsResult.error);
                    throw ('Failed to update some relations: ' + updateTdsRelationsResult.error);
                }


                // Link check to payment record (matches Suitelet flow)
                record.submitFields({
                    type: TDS_PAY,
                    id: paymentRecordId,
                    values: { custrecord_tss_tdspay_check: checkCreated },
                    options: { ignoreMandatoryFields: true }
                });
                log.audit('Payment linked to check', { paymentId: paymentRecordId, checkId: checkCreated });

                // Success: send completion email
                // sendCompletionEmail({
                //     paymentId: paymentRecordId,
                //     checkId: checkCreated,
                //     relationCount: updatedRelations.length,
                //     totalTds: totalTdsAmount
                // });

                log.audit('MR Summarize success', {
                    paymentId: paymentRecordId,
                    checkId: checkCreated,
                    updatedRelations: updatedRelations.length,
                    totalTds: totalTdsAmount,
                    remainingGovernanceCurr: runtime.getCurrentScript().getRemainingUsage()
                });


            } catch (e) {
                log.error('MR Summarize error', e);
                var errorAlert = []
                // rollback updated relations if any
                if (updatedRelations.length > 0) {
                    updatedRelations.forEach(function (rel) {
                        try {
                            record.submitFields({
                                type: TDS_REL,
                                id: rel.id,
                                values: {
                                    custrecord_tss_its_billtdspayable: rel.originalPayable,
                                    custrecord_tss_its_billstatus: 'Open',
                                    custrecord_tss_its_billpaymentlink: '', custrecord_tss_its_billpayabledate: '',
                                    custrecord_tss_its_billbankname: '', custrecord_tss_its_billchequeno: '',
                                    custrecord_tss_its_billtaxagency: '', custrecord_tss_its_billbsrcode: '',
                                    custrecord_tss_its_billpaymentdate: '', custrecord_tss_its_billchallanno: ''
                                },
                                options: { ignoreMandatoryFields: true }
                            });
                            log.debug('Rolled back relation update', rel.id);
                        } catch (rollbackErr) {
                            log.error('Failed to rollback relation ' + rel.id, rollbackErr);
                            errorAlert.push('Failed to rollback relation with ID ' + rel.id + '. Please check if the record is correct and update manually.' + rollbackErr.message);
                        }
                    });
                }
                //Try to clean up any created check if summarize failed after check creation
                if (checkCreated) {
                    try {
                        record.delete({ type: CHECK, id: checkCreated });
                        log.audit('Check deleted due to summarize failure', 'checkId=' + checkCreated);
                    } catch (delErr) {
                        log.error('Failed to delete check after summarize failure', delErr);
                        errorAlert.push('Failed to delete check record with ID ' + checkCreated + ' after summarize failure. Please check if the record exists and delete manually.' + delErr.message);
                    }
                }
                // Try to delete payment record on total failure
                var paymentRecordId = null;
                if (contextData && contextData.paymentRecordId && !isPaymentDeleted) {
                    try {
                        record.delete({ type: TDS_PAY, id: contextData.paymentRecordId });
                        log.audit('Payment record deleted due to summarize failure', 'paymentId=' + contextData.paymentRecordId);
                    } catch (cleanupErr) {
                        log.error('Failed to cleanup payment record in summarize error handler', cleanupErr);
                        errorAlert.push('Failed to delete payment record with ID ' + paymentRecordId + ' after summarize failure. Please check if the record exists and delete manually.' + cleanupErr.message);
                    }
                }
                // // Send error email
                // try {
                //     // var admin = runtime.getCurrentScript().getParameter({ name: 'custscript_admin_email' }) || runtime.getCurrentUser().email;
                //     // email.send({
                //     //     author: runtime.getCurrentUser().id,
                //     //     recipients: admin,
                //     //     subject: 'MR TDS Payment Processor: Summarize Error',
                //     //     body: 'MR TDS Payment processing failed during summarize phase.\n\nError: ' + e.message +
                //     //         '\n\nPayment Record ID (if deleted): ' + (paymentRecordId || 'N/A')
                //     // });
                // } catch (emailErr) {
                //     log.error('Failed to send error email', emailErr);
                // }
                throw errorAlert.join('\n') + (errorAlert.length > 0 ? '\n' : '') + 'Summarize error: ' + e;
            }
        }

        /**
         * Create Check with TDS expense lines (matches Suitelet processSynchronously logic)
         */
        function createCheckWithExpenses(relations, contextData) {
            var chk = record.create({ type: CHECK, isDynamic: true });
            chk.setValue({ fieldId: 'entity', value: contextData.taxAgency || '' });
            chk.setValue({ fieldId: 'account', value: contextData.bankAccount });
            log.debug('Payment Date param', contextData.paymentDate);
            // log.debug('Payment Date', new Date(contextData.paymentDate));
            // chk.setValue({ fieldId: 'trandate', value: new Date(contextData.paymentDate) });
            chk.setText({ fieldId: 'trandate', text: contextData.paymentDate });
            if (contextData.memo) chk.setValue({ fieldId: 'memo', value: contextData.memo });
            if (contextData.department) chk.setValue({ fieldId: 'department', value: contextData.department });
            if (contextData.location) chk.setValue({ fieldId: 'location', value: contextData.location });
            if (contextData.class) chk.setValue({ fieldId: 'class', value: contextData.class });

            // Set Place Of Supply as Other State if subsidiary is India to avoid GST issues
            var stateSearch = search.create({
                type: 'customrecord_tss_gst_state_master',
                filters: [
                    ['name', 'is', 'Other State'],
                    'AND',
                    ['isinactive', 'is', 'F']
                ],
                columns: [
                    search.createColumn({ name: 'internalid' }),
                    search.createColumn({ name: 'name' })
                ]
            });
            var stateResult = stateSearch.run().getRange({ start: 0, end: 1 });
            if (stateResult && stateResult.length > 0) {
                chk.setValue({ fieldId: 'custbody_tss_placeof_supply', value: stateResult[0].getValue('internalid') });
            }

            var totalCheckAmount = 0;
            relations.forEach(function (rel, idx) {
                chk.selectNewLine({ sublistId: 'expense' });
                chk.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'account', value: rel.tdsAccount }); // Assuming account is stored in relation
                chk.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'amount', value: rel.tdsPayable });
                if (contextData.location) chk.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'location', value: contextData.location });
                if (contextData.class) chk.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'class', value: contextData.class });
                if (contextData.department) chk.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'department', value: contextData.department });
                chk.commitLine({ sublistId: 'expense' });
                totalCheckAmount += parseFloat(rel.tdsPayable) || 0;
            });

            //Add interest line if applicable
            if (contextData.applyInterest && parseFloat(contextData.interestAmt) > 0) {
                chk.selectNewLine({ sublistId: 'expense' });
                chk.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'account', value: contextData.interestAcc });
                chk.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'amount', value: contextData.interestAmt });
                chk.commitLine({ sublistId: 'expense' });
            }
            var checkId = chk.save({ enableSourcing: false, ignoreMandatoryFields: true });
            log.debug('Check saved', { checkId: checkId, lineCount: relations.length, totalAmount: totalCheckAmount });
            return checkId;
        }

        /**
         * Update TDS Relations: reduce payable, update status, link to payment (uses pre-loaded data)
         */
        function updateTdsRelations(relations, contextData, paymentRecordId) {
            var updated = [];
            log.debug("Context data in updateTdsRelations", contextData);
            relations.forEach(function (rel) {
                try {
                    // Use pre-loaded tdsPayable from search (no additional record load needed)
                    var originalPayable = parseFloat(rel.tdsPayable) || 0;
                    var paidAmount = parseFloat(rel.tdsPayable) || 0;
                    var newPayable = originalPayable - paidAmount;
                    if (newPayable < 0) newPayable = 0;

                    // Update relation with new payable, status, payment link, etc.
                    record.submitFields({
                        type: TDS_REL,
                        id: rel.relationId,
                        values: {
                            custrecord_tss_its_billtdspayable: newPayable,
                            custrecord_tss_its_billstatus: newPayable <= 0 ? 'Close' : 'Open',
                            custrecord_tss_its_billpaymentlink: paymentRecordId,
                            custrecord_tss_its_billpayabledate: contextData.paymentDate,
                            custrecord_tss_its_billbankname: contextData.bankAccount,
                            custrecord_tss_its_billchequeno: contextData.memo,
                            custrecord_tss_its_billtaxagency: contextData.taxAgency,
                            custrecord_tss_its_billbsrcode: contextData.bsrcode,
                            custrecord_tss_its_billpaymentdate: contextData.paymentdate,
                            custrecord_tss_its_billchallanno: contextData.challanno
                        },
                        options: { ignoreMandatoryFields: true }
                    });
                    updated.push({ id: rel.relationId, newPayable: newPayable, originalPayable: originalPayable });
                    log.debug('Relation updated', {
                        relationId: rel.relationId,
                        originalPayable: originalPayable,
                        newPayable: newPayable,
                        paidAmount: paidAmount
                    });
                } catch (updateErr) {
                    log.error('Failed to update relation ' + rel.relationId, updateErr);
                    return { success: false, updated: updated, error: updateErr }; // Return partial updates and error for handling in summarize
                    // throw updateErr; // Fail the entire MR if any update fails
                }
            });
            return { success: true, updated: updated };
        }

        /**
         * Send completion email to admin
         */
        function sendCompletionEmail(data) {
            try {
                var admin = runtime.getCurrentScript().getParameter({ name: 'custscript_admin_email' }) || runtime.getCurrentUser().email;
                var body = 'MR TDS Payment processing completed successfully.\n\n' +
                    'Payment Record ID: ' + data.paymentId + '\n' +
                    'Check ID: ' + data.checkId + '\n' +
                    'Relations Updated: ' + data.relationCount + '\n' +
                    'Total TDS Amount: ' + data.totalTds;
                email.send({
                    author: runtime.getCurrentUser().id,
                    recipients: admin,
                    subject: 'MR TDS Payment Processor: Success',
                    body: body
                });
            } catch (e) {
                log.error('Failed to send completion email', e);
            }
        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };
    });
