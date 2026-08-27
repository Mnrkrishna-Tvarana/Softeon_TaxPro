/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
/**
 * Script Name               : SUT TSS GST Journal Creation
 * Script Author             : MNR Krishna
 * Script Type               : Suitelet Script
 * Script Version            : 2.1
 * Script Created date       : 06/07/2025
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  Creates the GST Journal for LUT and redirects to the Invoice
 */
define(['N/record', 'N/redirect', 'N/search', 'N/format'],
    /**
 * @param{record} record
 * @param{redirect} redirect
 * @param{search} search
 */
    (record, redirect, search, format) => {
        //Global Variables
        var igstRecievable;
        var igstPayable;
        var g_subisidiary;
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            var journalId = ''
            try {
                if (scriptContext.request.method === 'GET') {
                    const invoiceId = scriptContext.request.parameters.invoiceId;
                    const s_Record_Type = scriptContext.request.parameters.s_Record_Type;
                    const updateAction = scriptContext.request.parameters.updateAction;

                    if (invoiceId && s_Record_Type) {
                        var GlobalRecId = SearchGlobalParameter();

                        // Load the invoice
                        const invoice = record.load({ type: s_Record_Type, id: invoiceId });

                        const hasJE = invoice.getValue('custbody_tss_lut_journal_invoice');
                        const Subsidiary = invoice.getValue('subsidiary');
                        var Flag = inArray(Subsidiary, g_subisidiary);
                        if ((!hasJE || isTrue(updateAction)) && Flag == parseInt(1)) {

                            // Extract sample values for JEF
                            const customerId = invoice.getValue('entity');

                            const InvoiceDate = invoice.getText('trandate');
                            const Currency = invoice.getValue('currency');
                            const Class = invoice.getValue('class');
                            const Department = invoice.getValue('department');
                            const Location = invoice.getValue('location');

                            var grossTotalItem = calculateTaxAmount(invoice, 'item')
                            if (!hasJE) {
                                var journal = record.create({ type: record.Type.JOURNAL_ENTRY, isDynamic: true });
                                // journal.setValue('customform', 204);
                                journal.setValue('subsidiary', Subsidiary);
                            }
                            else {
                                var journal = record.load({ type: record.Type.JOURNAL_ENTRY, id: hasJE, isDynamic: true });
                            }
                            // journal.setValue('memo', 'Auto JE from Invoice Internal ID ' + invoiceId);
                            journal.setValue('memo', 'GST of Export with payment of Tax');

                            // journal.setText('trandate', InvoiceDate);
                            journal.setText('trandate', getCurrentFormattedDate());
                            journal.setValue('currency', Currency);
                            journal.setValue('custbody_tss_lut_journal_invoice', invoiceId);


                            // Debit line
                            if (!hasJE) {
                                journal.selectNewLine({ sublistId: 'line' });
                            }
                            else {
                                journal.selectLine({ sublistId: 'line', line: 0 });
                            }
                            journal.setCurrentSublistValue({ sublistId: 'line', fieldId: 'account', value: igstRecievable });
                            journal.setCurrentSublistValue({ sublistId: 'line', fieldId: 'debit', value: grossTotalItem });
                            if (Class) {
                                journal.setCurrentSublistValue({ sublistId: 'line', fieldId: 'class', value: Class });
                            }
                            if (Department) {
                                journal.setCurrentSublistValue({ sublistId: 'line', fieldId: 'department', value: Department });
                            }
                            if (Location) {
                                journal.setCurrentSublistValue({ sublistId: 'line', fieldId: 'location', value: Location });
                            }
                            journal.commitLine({ sublistId: 'line' });

                            // Credit line
                            if (!hasJE) {
                                journal.selectNewLine({ sublistId: 'line' });
                            }
                            else {
                                journal.selectLine({ sublistId: 'line', line: 1 });
                            }
                            journal.setCurrentSublistValue({ sublistId: 'line', fieldId: 'account', value: igstPayable });
                            journal.setCurrentSublistValue({ sublistId: 'line', fieldId: 'credit', value: grossTotalItem });
                            if (Class) {
                                journal.setCurrentSublistValue({ sublistId: 'line', fieldId: 'class', value: Class });
                            }
                            if (Department) {
                                journal.setCurrentSublistValue({ sublistId: 'line', fieldId: 'department', value: Department });
                            }
                            if (Location) {
                                journal.setCurrentSublistValue({ sublistId: 'line', fieldId: 'location', value: Location });
                            }
                            journal.commitLine({ sublistId: 'line' });

                            journalId = journal.save();

                            log.debug("GST Journal is created Successfully - ", journalId)

                            var invoiceUpdatedId = record.submitFields({
                                type: s_Record_Type,
                                id: invoiceId,
                                values: {
                                    'custbody_tss_lut_journal_invoice': journalId
                                }
                            });
                            log.debug("Created Journal is updated in Invoice - ", invoiceUpdatedId)
                            // Redirect to JE
                            // redirect.toRecord({ type: record.Type.JOURNAL_ENTRY, id: journalId });
                            redirect.toRecord({ type: s_Record_Type, id: invoiceId });
                        }
                        else {
                            var jeUrl = '/app/accounting/transactions/journal.nl?id=' + hasJE;
                            scriptContext.response.write('GST Journal has been created already. <a href="' + jeUrl + '" target="_blank">Journal Entry Internal ID: ' + hasJE + '</a>.')
                        }
                    }
                    else {
                        scriptContext.response.write("Something went wrong. Please reach out to Administrator")
                    }
                }
            } catch (error) {
                log.debug("Error in suitelet SUT TSS GST Journal Creation", error)
                //Deleting the Created JE
                if (journalId) {
                    var deletedJE = record.delete({
                        type: record.Type.JOURNAL_ENTRY,
                        id: journalId,
                    });
                    log.error("deletedJE", deletedJE)
                }
                scriptContext.response.write("Please Reach out to Administrator. Error... \n" + JSON.stringify(error))
            }
        }

        // Custom Functions
        function calculateTaxAmount(rec, sublistId) {
            let taxTotal = 0;
            let lineCount = rec.getLineCount({ sublistId: sublistId });

            for (let i = 0; i < lineCount; i++) {
                let amount = parseFloat(rec.getSublistValue({
                    sublistId: sublistId,
                    fieldId: 'amount',
                    line: i
                })) || 0;

                let taxRate = parseFloat(rec.getSublistValue({
                    sublistId: sublistId,
                    fieldId: 'custcol_tss_lut_taxrate', // or your custom field like 'custcol_tax_rate'
                    line: i
                })) || 0;

                let taxAmount = (amount * taxRate / 100);
                taxTotal += taxAmount;
            }

            return parseFloat(taxTotal.toFixed(2)); // Round to 2 decimals
        }

        function getCurrentFormattedDate() {
            var now = new Date();
            log.debug("getCurrentFormattedDate", format.format({
                value: now,
                type: format.Type.DATE
            }))
            return format.format({
                value: now,
                type: format.Type.DATE
            });
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
                igstRecievable = global_param_search_result[0].getValue({ name: 'custrecord_tss_gp_lut_gstrefund' });
                igstPayable = global_param_search_result[0].getValue({ name: 'custrecord_tss_gp_lut_igst_payable' });
            }
            return global_sub;
        } // end function SearchGlobalParameter()




        return { onRequest }

    });
