/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */

define(['N/currentRecord', 'N/search'], function (currentRecord, search) {
    function pageInit() {
        setTimeout(attachMarkAllListeners, 1000); // wait for UI to render
    }
    function fieldChanged(context) {
        if (context.fieldId === 'custpage_apply') {
            var rec = currentRecord.get();
            var total = parseFloat(rec.getValue('totalamt') || 0)
            // alert(JSON.stringify(context))
            // alert(context.line)
            var checked = rec.getSublistValue({
                sublistId: 'tdslist',
                fieldId: 'custpage_apply',
                line: context.line
            });


            var amt = parseFloat(rec.getSublistValue({
                sublistId: 'tdslist',
                fieldId: 'custpage_billtdspayable',
                line: context.line
            })) || 0;
            if (checked) {
                total += amt;
            }
            else {
                total -= amt
            }
            rec.setValue({
                fieldId: 'totalamt',
                // value: total > 0 ? total.toFixed(2) : 0,
                value: total.toFixed(2),
                ignoreFieldChange: true
            });

        }

        if (context.fieldId === 'account') {
            var rec = currentRecord.get();
            var bankAcct = rec.getValue('account');
            if (bankAcct) {
                var accountSearch = search.create({
                    type: 'account',
                    filters: ['internalid', 'anyof', bankAcct],
                    columns: ['name', 'balance']
                })
                var accountSearchRes = accountSearch.run().getRange(0, 100)
                rec.setValue({
                    fieldId: 'bankbal',
                    value: parseFloat(accountSearchRes[0].getValue('balance') || 0).toFixed(2),
                    ignoreFieldChange: true
                });
            }
            else {
                rec.setValue({
                    fieldId: 'bankbal',
                    value: '',
                    ignoreFieldChange: true
                });
            }
        }


        if (context.fieldId === 'custpage_apply_interest') {
            var rec = currentRecord.get();
            var applyinterest = rec.getValue('custpage_apply_interest')
            if (applyinterest) {
                var intrstAcctFld = rec.getField('custpage_interst_acc').isMandatory = true
                var intrstAmtFld = rec.getField('custpage_interest_amt').isMandatory = true
                var total = parseFloat(rec.getValue('totalamt') || 0)
                var intrstAmt = parseFloat(rec.getValue('custpage_interest_amt') || 0)
                rec.setValue({
                    fieldId: 'totalamt',
                    value: parseFloat(total + intrstAmt).toFixed(2),
                    ignoreFieldChange: true
                });

            }
            else {
                var intrstAcctFld = rec.getField('custpage_interst_acc').isMandatory = false
                var intrstAmtFld = rec.getField('custpage_interest_amt').isMandatory = false
                var total = parseFloat(rec.getValue('totalamt') || 0)
                var intrstAmt = parseFloat(rec.getValue('custpage_interest_amt') || 0)
                recalcTotal(true, false)
                rec.setValue({
                    fieldId: 'custpage_interest_amt',
                    value: '',
                    ignoreFieldChange: true
                });
                rec.setValue({
                    fieldId: 'custpage_interst_acc',
                    value: '',
                    ignoreFieldChange: true
                });
            }
        }

        if (context.fieldId === 'custpage_interest_amt') {
            recalcTotal(true, false)
        }



    }

    function saveRecord(context) {
        var rec = currentRecord.get();
        var totalAmt = parseFloat(rec.getValue('totalamt') || 0)
        if (totalAmt <= 0) {
            alert("Total Payable Amount should be greater than zero.");
            return false;
        }
        var applyinterest = rec.getValue('custpage_apply_interest')
        if (applyinterest) {
            var intrstAcct = rec.getValue('custpage_interst_acc')
            var intrstAmt = rec.getValue('custpage_interest_amt')
            if (!intrstAcct && !intrstAmt) {
                alert("Please enter Values for * Interest A/C, Interest Amount");
                return false;
            }
            else if (!intrstAcct) {
                alert("Please enter Value(s) for: Interest A/C");
                return false;
            }
            else if (!intrstAmt) {
                alert("Please enter Value(s) for:  Interest Amount");
                return false;
            }

        }
        // show preloader overlay and prevent further interaction
        try {
            showPreloader();
        } catch (e) { console.log('preloader show failed', e); }
        return true;
    }

    function showPreloader() {
        // avoid adding multiple overlays
        if (document.getElementById('tss-preloader-overlay')) return;
        var overlay = document.createElement('div');
        overlay.id = 'tss-preloader-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(255,255,255,0.85)';
        overlay.style.zIndex = '99999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.innerHTML = '<div style="text-align:center;font-family:Arial,Helvetica,sans-serif;color:#333;"><div style="width:80px;height:80px;border:12px solid #f3f3f3;border-top:12px solid #3498db;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 10px auto"></div><div style="font-size:16px;">Processing... Please wait</div></div>';

        var style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = '@keyframes spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}';
        document.head.appendChild(style);

        document.body.appendChild(overlay);

        // disable submit buttons to avoid double-submit
        var submits = document.querySelectorAll('input[type="submit"], input[type="button"], button[type="submit"]');
        submits.forEach(function (el) {
            try { el.disabled = true; } catch (e) { }
        });
    }


    function attachMarkAllListeners() {
        var markAllBtn = document.querySelector("input[name='tdslistmarkall']");
        var unmarkAllBtn = document.querySelector("input[name='tdslistunmarkall']");

        if (markAllBtn) {
            markAllBtn.addEventListener('click', function () {
                setTimeout(recalcTotal(true, true), 500);
            });
        }

        if (unmarkAllBtn) {
            unmarkAllBtn.addEventListener('click', function () {
                console.log("Un MarkAll button clicked!");
                setTimeout(recalcTotal(false, true), 500);
            });
        }

    }

    function recalcTotal(isAllMark, buttonFlag) {
        var rec = currentRecord.get();
        var total = 0;
        var applyinterest = rec.getValue('custpage_apply_interest')
        if (applyinterest) {
            var intrstAmt = parseFloat(rec.getValue('custpage_interest_amt')) || 0
            total += intrstAmt
        }
        if (isAllMark) {
            var lineCount = rec.getLineCount({ sublistId: 'tdslist' });

            for (var i = 0; i < lineCount; i++) {
                var checked = rec.getSublistValue({
                    sublistId: 'tdslist',
                    fieldId: 'custpage_apply',
                    line: i
                });

                if (!checked && !buttonFlag) {
                    continue;
                }
                var amt = parseFloat(rec.getSublistValue({
                    sublistId: 'tdslist',
                    fieldId: 'custpage_billtdspayable',
                    line: i
                })) || 0;
                total += amt;
            }

        }
        rec.setValue({
            fieldId: 'totalamt',
            value: total.toFixed(2),
            ignoreFieldChange: true
        });

    }

    function returnToCriteria() {
        var rec = currentRecord.get();
        var criteriaUrl = rec.getValue('custpage_criteria_url');
        if (criteriaUrl) {
            window.location.href = criteriaUrl;
        }
    }

    return {
        pageInit: pageInit,
        fieldChanged: fieldChanged,
        saveRecord: saveRecord,
        returnToCriteria: returnToCriteria
    };
});
