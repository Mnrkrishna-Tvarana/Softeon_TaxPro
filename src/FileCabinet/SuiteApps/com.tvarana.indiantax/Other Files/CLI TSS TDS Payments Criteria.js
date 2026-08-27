/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 *
 * Script Name: CLI TSS TDS Payments Criteria
 */

define(['N/currentRecord', 'N/ui/message'], function (currentRecord, message) {

    function pageInit(context) {
        try {
            var rec = currentRecord.get();
            var accPeriod = rec.getValue({ fieldId: 'accountingperiod' });

            toggleDateFields(accPeriod);
        } catch (e) {
            console.log('pageInit error', e);
        }
    }

    function fieldChanged(context) {
        try {
            if (context.fieldId === 'accountingperiod') {
                var rec = currentRecord.get();
                var accPeriod = rec.getValue({ fieldId: 'accountingperiod' });

                toggleDateFields(accPeriod);
            }
        } catch (e) {
            console.log('fieldChanged error', e);
        }
    }

    function saveRecord(context) {
        try {
            var rec = currentRecord.get();

            var accPeriod = rec.getValue({ fieldId: 'accountingperiod' });
            var fromDate = rec.getValue({ fieldId: 'fromdate' });
            var toDate = rec.getValue({ fieldId: 'todate' });

            if (!isValid(accPeriod)) {

                if (!isValid(fromDate) && !isValid(toDate)) {
                    alert('Please enter value(s) for: [From Date, To Date] or [Posting Period]');
                    return false;
                }
                else if (!isValid(fromDate) && isValid(toDate)) {
                    alert('Please enter value for: From Date');
                    return false;
                }
                else if (!isValid(toDate) && isValid(fromDate)) {
                    alert('Please enter value for: To Date');
                    return false;
                }
            }

            return true;
        } catch (e) {
            console.log('saveRecord error', e);
            return false;
        }
    }

    /* ================= Helper Functions ================= */

    function toggleDateFields(accPeriod) {
        try {
            var fromDateField = document.getElementById('fromdate');
            var toDateField = document.getElementById('todate');

            if (!fromDateField || !toDateField) return;

            if (isValid(accPeriod)) {
                fromDateField.disabled = true;
                toDateField.disabled = true;
            } else {
                fromDateField.disabled = false;
                toDateField.disabled = false;
            }
        } catch (e) {
            console.log('toggleDateFields error', e);
        }
    }

    function isValid(value) {
        return !(value === null || value === '' || value === undefined || value === 'undefined' || value === 'NaN');
    }

    return {
        pageInit: pageInit,
        fieldChanged: fieldChanged,
        saveRecord: saveRecord
    };

});
