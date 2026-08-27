/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/log', 'N/search', 'N/record', 'N/redirect', 'N/runtime', 'N/task', 'N/format', 'N/url', 'N/transaction'], function (serverWidget, log, search, record, redirect, runtime, task, format, url, transaction) {

    const TDS_REL = 'customrecord_tss_its_tds_billrelation';
    const TDS_PAY = 'customrecord_tss_its_tds_paymentdetails';
    var criteriaSuiteletId = 'customscript_tss_sl_tds_payments_criteri'
    var criteriaSuiteletDepId = 'customdeploy1';
    var tdsPaymentMRScriptId = 'customscript_tss_mr_tds_payments';
    var tdsPaymentMRDepId = 'customdeploy1';


    function onRequest(context) {

        try {
            if (context.request.method === 'GET') {
                var params = context.request.parameters || {};
                // status check endpoint for client-side polling
                if (params.checkstatus === 'T' || params.checkstatus === 'true') {
                    handleCheckStatus(context);
                } else if (params.show === 'status') {
                    // render status page after redirect from POST
                    renderStatusPage(context, params.taskid, params.paymentid);
                } else {
                    renderForm(context);
                }
            } else {
                // log.debug("context.request.method", context.request.method)
                handlePost(context);
                log.debug("Remaining governance units", runtime.getCurrentScript().getRemainingUsage());
            }
        } catch (e) {
            log.error('Suitelet Error', e);
            log.error('Suitelet Error Stringified', JSON.stringify(e));
            context.response.write(typeof (e) != 'String' ? JSON.stringify(e) : e)
        }
    }

    /**
     * Render the status page (called after POST redirect)
     */
    function renderStatusPage(context, taskId, paymentId) {
        try {
            var currentScript = runtime.getCurrentScript();
            var checkUrl = url.resolveScript({ scriptId: currentScript.id, deploymentId: currentScript.deploymentId, params: { checkstatus: 'T', taskid: taskId, paymentid: paymentId } });
            var paymentUrl = (typeof url.resolveRecord === 'function') ? url.resolveRecord({ recordType: TDS_PAY, recordId: paymentId, isEdit: false }) : ('/app/common/customrecordentry.nl?rectype=' + TDS_PAY + '&id=' + paymentId);
            // criteria suitelet URL (to allow user to return to criteria when MR fails)
            var criteriaUrl = url.resolveScript({ scriptId: criteriaSuiteletId, deploymentId: criteriaSuiteletDepId });
            log.debug('renderStatusPage', 'taskId=' + taskId + ' paymentId=' + paymentId);

            var html = '';
            html += '<!doctype html><html><head><meta charset="utf-8"><title>Processing TDS Payments</title>';
            html += '<meta name="viewport" content="width=device-width,initial-scale=1">';
            html += '<style>body{font-family:Inter,Segoe UI,Roboto,Arial,Helvetica,sans-serif;background:linear-gradient(135deg,#f5f7fa,#e9eef6);margin:0;padding:0;display:flex;align-items:center;justify-content:center;height:100vh} .card{background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(35,50,80,0.08);width:480px;max-width:95%;padding:28px;text-align:center} .title{font-size:20px;color:#1f2937;margin:0 0 8px} .subtitle{font-size:13px;color:#4b5563;margin:0 0 18px} .loader{height:100px;display:flex;align-items:center;justify-content:center;margin:12px 0;position:relative} .spinner{width:80px;height:80px;border:12px solid #f3f3f3;border-top:12px solid #3498db;border-radius:50%;animation:spin 1s linear infinite;display:flex;align-items:center;justify-content:center} .spinner.complete{border:12px solid #10b981;background:transparent;animation:none} .spinner.complete::after{content:\"\\2713\";color:#10b981;font-size:48px;font-weight:bold;line-height:1} .spinner.failed{border:12px solid #ef4444;background:transparent;animation:none} .spinner.failed::after{content:\"\\d7\";color:#ef4444;font-size:48px;font-weight:bold;line-height:1} @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}} .status-badge{display:inline-block;padding:6px 10px;border-radius:999px;font-weight:600;font-size:12px} .status-p{color:#374151;margin-top:8px} .task-id{font-size:10px;background:#f3f4f6;padding:6px 8px;border-radius:6px;word-break:break-all;margin-top:8px;color:#374151;font-family:monospace;line-height:1.4;max-height:50px;overflow-y:auto} .btn{display:inline-block;margin-top:14px;padding:10px 16px;border-radius:8px;background:#111827;color:#fff;text-decoration:none} .small{font-size:12px;color:#9ca3af;margin-top:6px} </style>';
            html += '</head><body>';
            html += '<div class="card">';
            html += '<div class="title">Submitting TDS Payment(s)</div>';
            html += '<div id="subtitle" class="subtitle">Your payment is being processed in the background.</div>';
            html += '<div class="loader"><div class="spinner"></div></div>';
            html += '<div id="status" class="status-badge" style="background:#f3f4f6;color:#374151">Starting</div>';
            html += '<div id="statusText" class="status-p">Initializing...</div>';
            html += '<div class="task-id">Task id: <code>' + taskId + '</code></div>';
            html += '<a id="openPayment" class="btn" href="' + paymentUrl + '" style="display:none">Open Payment</a>';
            html += '<a id="returnToCriteria" class="btn" href="' + criteriaUrl + '" style="display:none;margin-left:8px;background:#6b7280">Return To Criteria</a>';
            html += '<div id="autoRedirectNote" class="small">This page will auto-redirect after the process completes.</div>';
            html += '</div>';
            html += '<script>';
            html += '(function(){';
            html += 'var checkUrl = "' + checkUrl + '";';
            html += 'var paymentUrl = "' + paymentUrl + '";';
            html += 'var criteriaUrl = "' + criteriaUrl + '";';
            html += 'var statusEl = document.getElementById("status");';
            html += 'var statusText = document.getElementById("statusText");';
            html += 'var openPayment = document.getElementById("openPayment");';
            html += 'var spinner = document.querySelector(".spinner");';
            html += 'function setState(state, deleted){state = state.toUpperCase();';
            html += 'if(state==="PENDING"||state==="PROCESSING"){statusEl.style.background = "#eef2ff"; statusEl.style.color = "#3730a3"; statusEl.innerText = "Processing"; statusText.innerText = "Processing... please keep this page open.";}';
            html += 'else if(state==="COMPLETE"){statusEl.style.background = "#dcfce7"; statusEl.style.color = "#166534"; statusEl.innerText = "Complete"; statusText.innerText = "Completed. Redirecting to payment..."; if(spinner){spinner.classList.remove("failed"); spinner.classList.add("complete");} openPayment.style.display = "none";}';
            html += 'else if(state==="FAILED"||state==="CANCELLED"||state==="CANCELED"){statusEl.style.background = "#fee2e2"; statusEl.style.color = "#991b1b"; statusEl.innerText = "Failed"; if(document.getElementById(\'subtitle\')){document.getElementById(\'subtitle\').innerText = "Your payment has failed.";} if(document.getElementById(\'autoRedirectNote\')){document.getElementById(\'autoRedirectNote\').style.display = \'none\';} if(deleted){statusText.innerText = "Payment record deleted. Please re-run from Criteria."; openPayment.style.display = "none"; if(document.getElementById(\'returnToCriteria\')){document.getElementById(\'returnToCriteria\').style.display = \'inline-block\';}} else {statusText.innerText = "Processing failed. Please delete the payment record (Not deleted in backend)."; openPayment.style.display = "inline-block"; if(document.getElementById(\'returnToCriteria\')){document.getElementById(\'returnToCriteria\').style.display = \'none\';}} if(spinner){spinner.classList.remove("complete"); spinner.classList.add("failed");}}';
            html += 'else {statusEl.style.background = "#f8fafc"; statusEl.style.color = "#374151"; statusEl.innerText = state.toLowerCase(); statusText.innerText = "Status: " + state;}}';
            html += 'function poll(){var u = checkUrl + "&_ts=" + new Date().getTime();';
            html += 'fetch(u).then(function(r){return r.json();}).then(function(d){var s = (d && d.status) ? d.status.toUpperCase() : "UNKNOWN"; var deleted = (d && d.paymentDeleted) ? true : false; setState(s, deleted);';
            html += 'if(s==="COMPLETE"){setTimeout(function(){window.location.href = paymentUrl;}, 900);}';
            html += 'else if(s==="FAILED" || s==="CANCELLED" || s==="CANCELED"){ /* terminal state - stop polling */ }';
            html += 'else {setTimeout(poll, 2500);}}).catch(function(e){console.error(e); setTimeout(poll, 4000);});}';
            html += 'setTimeout(poll, 800);';
            html += '})();';
            html += '</script>';
            html += '</body></html>';
            context.response.write(html);
        } catch (e) {
            log.error('renderStatusPage error', e);
            context.response.write('Error rendering status page: ' + e);
        }
    }

    /**
     * Handle AJAX status checks for a Map/Reduce instance. Returns JSON with { status, paymentId }
     */
    function handleCheckStatus(context) {
        try {
            var params = context.request.parameters || {};
            var taskId = params.taskid || params.taskId || params.task || '';
            var paymentId = params.paymentid || params.paymentId || '';
            var status = 'UNKNOWN';
            var paymentDeleted = false;
            var deletedMessage = '';
            if (taskId) {
                try {
                    var tStatus = task.checkStatus({ taskId: taskId });
                    if (tStatus && tStatus.status) {
                        status = tStatus.status; // e.g. PENDING, PROCESSING, COMPLETE
                    }
                } catch (e) {
                    log.debug('task.checkStatus failed', e);
                }
            }
            // If MR failed, attempt to clean up the temporary payment record (same behaviour as sync path)
            if ((status === 'FAILED' || status === 'CANCELLED' || status === 'CANCELED') && paymentId) {
                log.debug("MR Script Status: " + status + ". Attempting to delete payment record with id " + paymentId);
                try {
                    // attempt delete; wrap in try/catch to avoid bubbling errors to client poll
                    record.delete({ type: TDS_PAY, id: paymentId });
                    paymentDeleted = true;
                    log.audit('Deleted payment after MR failure', 'paymentId=' + paymentId + ' taskId=' + taskId);
                } catch (delErr) {
                    paymentDeleted = false;
                    deletedMessage = (delErr && delErr.message) ? delErr.message : String(delErr);
                    log.debug('Failed to delete payment after MR failure', { paymentId: paymentId, err: delErr });
                }
            }
            context.response.write(JSON.stringify({ status: status, paymentId: paymentId, paymentDeleted: paymentDeleted, deletedMessage: deletedMessage }));
        } catch (e) {
            log.error('handleCheckStatus error', e);
            context.response.write(JSON.stringify({ status: 'ERROR', message: e.message || e }));
        }
    }

    function renderForm(context) {
        var req = context.request;
        var res = context.response;
        var params = req.parameters;
        var form = serverWidget.createForm({ title: 'TDS Payment List Form' });
        form.clientScriptFileId = getfileId('CLI TSS TDS Payments List.js');
        // key fields
        var bankField = form.addField({ id: 'account', type: serverWidget.FieldType.SELECT, label: 'Bank A/C' })
        bankField.isMandatory = true;
        populateBankAccounts(params, bankField)
        var bankblance = form.addField({ id: 'bankbal', type: serverWidget.FieldType.TEXT, label: 'Balance' });
        bankblance.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE })
        var pdate = form.addField({ id: 'pdate', type: serverWidget.FieldType.DATE, label: 'Date' })
        pdate.isMandatory = true;
        var dateStr = format.format({
            value: new Date(),
            type: format.Type.DATE
        });
        log.debug("dateStr1", dateStr);
        pdate.defaultValue = dateStr;
        form.addField({ id: 'memo', type: serverWidget.FieldType.TEXT, label: 'Memo' });
        form.addField({ id: 'cheque', type: serverWidget.FieldType.TEXT, label: 'Cheque No' });

        var totalamt = form.addField({ id: 'totalamt', type: serverWidget.FieldType.CURRENCY, label: 'Total Amount' });
        totalamt.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE })
        totalamt.defaultValue = (parseFloat(0));

        var taxagency = form.addField({ id: 'taxage', type: serverWidget.FieldType.SELECT, label: 'Tax Agency' })
        taxagency.isMandatory = true;
        popluattaxagency(params, taxagency);

        if (runtime.isFeatureInEffect({ feature: 'CLASSES' })) {
            form.addField({ id: 'class', type: serverWidget.FieldType.SELECT, label: 'Class', source: 'classification' })
        }
        if (runtime.isFeatureInEffect({ feature: 'DEPARTMENTS' })) {
            form.addField({ id: 'department', type: serverWidget.FieldType.SELECT, label: 'Departement', source: 'department' })
        }
        if (runtime.isFeatureInEffect({ feature: 'LOCATIONS' })) {
            var loc = form.addField({ id: 'location', type: serverWidget.FieldType.SELECT, label: 'Location' });
            popluatlocations(params, loc);
        }

        form.addField({ id: 'bsrcode', type: serverWidget.FieldType.TEXT, label: 'BSR Code' });
        form.addField({ id: 'paymentdate', type: serverWidget.FieldType.DATE, label: 'Payment Date' })
        form.addField({ id: 'challanno', type: serverWidget.FieldType.TEXT, label: 'Challan No' });

        // Hidden params

        var postingperiod = params['accountingperiod'] || '';
        var subsidiary = params['subsidiary'];
        var tds_section = params['tds_section'];
        var assessee_type = params['assessee_type'];
        var fromdate = params['fromdate'];
        var todate = params['todate'];

        form.addField({ id: 'accountingperiod', type: serverWidget.FieldType.SELECT, label: 'Posting Period', source: 'accountingperiod' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN }).defaultValue = postingperiod;
        form.addField({ id: 'fromdate', type: serverWidget.FieldType.DATE, label: 'From Date' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN }).defaultValue = fromdate;
        form.addField({ id: 'todate', type: serverWidget.FieldType.DATE, label: 'To Date' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN }).defaultValue = todate;
        if (runtime.isFeatureInEffect({ feature: 'SUBSIDIARIES' })) {
            var subsidiaryfield = form.addField({ id: 'subsidiary', type: serverWidget.FieldType.SELECT, label: 'Subsidiary', source: 'subsidiary' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE }).defaultValue = subsidiary;
        }

        var tds = search_tds_master(tds_section, assessee_type);
        var tdsfield = form.addField({ id: 'custpage_tdstype', type: serverWidget.FieldType.MULTISELECT, label: 'TDS', source: 'customrecord_tss_its_tdsmaster' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE }).defaultValue = tds;

        form.addField({ id: 'tds_section', type: serverWidget.FieldType.SELECT, label: 'TDS Section', source: 'customlist_tss_its_section_code' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN }).defaultValue = tds_section;
        form.addField({ id: 'assessee_type', type: serverWidget.FieldType.SELECT, label: 'Assessee Type', source: 'customlist_tss__assessee_code' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN }).defaultValue = assessee_type;

        form.addField({ id: 'custpage_apply_interest', type: serverWidget.FieldType.CHECKBOX, label: 'Apply Interest' })
        form.addField({ id: 'custpage_interst_acc', type: serverWidget.FieldType.SELECT, label: 'Interest A/C', source: 'account' })
        form.addField({ id: 'custpage_interest_amt', type: serverWidget.FieldType.CURRENCY, label: 'Interest Amount' });

        // form.addField({ id: 'custpage_apply_partial', type: serverWidget.FieldType.CHECKBOX, label: 'Partial Payments Feature' })

        // Sublist
        var sublist = form.addSublist({ id: 'tdslist', type: serverWidget.SublistType.LIST, label: 'TDS List' });
        sublist.addMarkAllButtons();
        sublist.addField({ id: 'custpage_apply', type: serverWidget.FieldType.CHECKBOX, label: 'Apply' });
        sublist.addField({ id: 'custpage_internalid', type: serverWidget.FieldType.TEXT, label: 'InternalId' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
        sublist.addField({ id: 'custpage_billdate', type: serverWidget.FieldType.TEXT, label: 'Bill Date' });
        sublist.addField({ id: 'custpage_billbillno_display', type: serverWidget.FieldType.SELECT, label: 'Bill No', source: 'transaction' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE })
        sublist.addField({ id: 'custpage_billvendorrel_display', type: serverWidget.FieldType.SELECT, label: 'Vendor Name', source: 'vendor' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE })
        sublist.addField({ id: 'custpage_billtdstype', type: serverWidget.FieldType.SELECT, label: 'TDS Type', source: 'customrecord_tss_its_tdsmaster' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });
        sublist.addField({ id: 'custpage_billtdssection', type: serverWidget.FieldType.TEXT, label: 'TDS Section' })
        sublist.addField({ id: 'custpage_billtdsaccount', type: serverWidget.FieldType.SELECT, label: 'TDS Account ID', source: 'account' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });
        sublist.addField({ id: 'custpage_billamount', type: serverWidget.FieldType.CURRENCY, label: 'Bill Amount' });
        sublist.addField({ id: 'custpage_billtdsamount', type: serverWidget.FieldType.CURRENCY, label: 'Bill TDS Amount' });
        sublist.addField({ id: 'custpage_billtdspayable', type: serverWidget.FieldType.CURRENCY, label: 'TDS Payable' });
        // sublist.addField({ id: 'custpage_billtdspaying', type: serverWidget.FieldType.CURRENCY, label: 'TDS Amount' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
        // .updateDisplayType({displayType: serverWidget.FieldDisplayType.ENTRY});

        // populate via search (simple search that returns relation records)
        var results = fetchTdsRelations(params);
        log.debug("results", results)
        if (results && results.length) {
            for (var i = 0; i < results.length; i++) {
                var r = results[i];
                log.debug("r", r)
                sublist.setSublistValue({ id: 'custpage_internalid', line: i, value: r.id });
                sublist.setSublistValue({ id: 'custpage_billdate', line: i, value: r.getValue('custrecord_tss_its_billbilldate') || ' ' });
                sublist.setSublistValue({ id: 'custpage_billbillno_display', line: i, value: r.getValue('custrecord_tss_its_billbillno') || ' ' });
                sublist.setSublistValue({ id: 'custpage_billvendorrel_display', line: i, value: r.getValue('custrecord_tss_its_vendorbillrel') || ' ' });
                sublist.setSublistValue({ id: 'custpage_billtdstype', line: i, value: r.getValue('custrecord_tss_its_billtdstype') || ' ' });
                sublist.setSublistValue({ id: 'custpage_billtdssection', line: i, value: r.getValue('custrecord_tss_its_billtdssection') || ' ' });
                sublist.setSublistValue({ id: 'custpage_billtdsaccount', line: i, value: r.getValue('custrecord_tss_its_billtdsaccount') || ' ' });
                sublist.setSublistValue({ id: 'custpage_billamount', line: i, value: r.getValue('custrecord_tss_its_billamount') || ' ' });
                sublist.setSublistValue({ id: 'custpage_billtdsamount', line: i, value: r.getValue('custrecord_tss_its_billtdsamount') || '0' });
                sublist.setSublistValue({ id: 'custpage_billtdspayable', line: i, value: r.getValue('custrecord_tss_its_billtdspayable') || '0' });
            }

        }


        form.addSubmitButton({ label: 'Submit' });
        var criteriaSuiteURL = url.resolveScript({
            scriptId: criteriaSuiteletId,
            deploymentId: criteriaSuiteletDepId,
            // params: params || {}
        });
        // log.debug("criteriaSuiteURL", criteriaSuiteURL)
        form.addField({ id: 'custpage_criteria_url', type: serverWidget.FieldType.TEXT, label: 'Criteria URL' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN }).defaultValue = criteriaSuiteURL;

        form.addButton({
            id: 'custpage_btn_return',
            label: 'Return To Criteria',
            functionName: 'returnToCriteria'
        });

        res.writePage(form);
    }

    function fetchTdsRelations(params) {
        var filters = [];
        filters.push(['custrecord_tss_its_billstatus', 'is', 'Open']);
        if (params['accountingperiod']) filters.push('AND', ['custrecord_tss_its_billpostingperiod', 'is', params['accountingperiod']]);
        else if (params['fromdate'] && params['todate']) {
            filters.push('AND', ['custrecord_tss_its_billbilldate', 'onorafter', params['fromdate']]);
            filters.push('AND', ['custrecord_tss_its_billbilldate', 'onorbefore', params['todate']]);
        }
        if (params['subsidiary']) filters.push('AND', ['custrecord_tss_its_billsubsidiary', 'is', params['subsidiary']]);
        log.debug("parameters for filtering", params)
        // log.debug("Filtering by TDS Section", params['tds_section_text'])
        // log.debug("params['tds_section']", params['tds_section'])
        if (params['tds_section_text']) {
            if (params['tds_section']) filters.push('AND', ['custrecord_tss_its_billtdssection', 'is', params['tds_section_text']]);
        }
        if (params['assessee_type']) filters.push('AND', ['custrecord_tss_its_billassessecode', 'is', params['assessee_type']]);
        filters.push('AND', ['isinactive', 'is', 'F']);
        filters.push('AND', ['custrecord_tss_its_billbillno', 'noneof', '@NONE@']);
        filters.push('AND', ['custrecord_tss_its_billbillno.mainline', 'is', 'T']);
        filters.push('AND', ['custrecord_tss_its_billbillno.voided', 'is', 'F']);
        log.debug("filters", filters)
        var cols = [];
        cols.push(search.createColumn({ name: 'internalid' }));
        cols.push(search.createColumn({ name: 'custrecord_tss_its_billbilldate' }));
        cols.push(search.createColumn({ name: 'custrecord_tss_its_billbillno' }));
        cols.push(search.createColumn({ name: 'custrecord_tss_its_vendorbillrel' }));
        cols.push(search.createColumn({ name: 'custrecord_tss_its_billtdstype' }));
        cols.push(search.createColumn({ name: 'custrecord_tss_its_billtdssection' }));
        cols.push(search.createColumn({ name: 'custrecord_tss_its_billtdsaccount' }));
        cols.push(search.createColumn({ name: 'custrecord_tss_its_billamount' }));
        cols.push(search.createColumn({ name: 'custrecord_tss_its_billtdsamount' }));
        cols.push(search.createColumn({ name: 'custrecord_tss_its_billtdspayable' }));

        var s = search.create({ type: 'customrecord_tss_its_tds_billrelation', filters: filters, columns: cols, title: 'TDS Payment List Search' });
        // log.debug("search created", s.save())
        var paged = s.runPaged({ pageSize: 1000 });
        log.debug("paged", paged)
        var out = [];
        paged.pageRanges.forEach(function (pr) {
            var page = paged.fetch({ index: pr.index });
            page.data.forEach(function (r) { out.push(r); });
        });
        return out;
    }

    function handlePost(context) {
        var req = context.request;
        var params = req.parameters;
        // parse selected lines
        // Suitelet submissions encode sublist as tdslist_internalid_x etc. Attempt to detect count
        var lineCount = req.getLineCount({ group: 'tdslist' });
        log.debug("lineCount", lineCount)

        var selectedIds = [];
        var selectedObjs = [];
        for (var i = 0; i < lineCount; i++) {
            var apply = req.getSublistValue({
                group: 'tdslist',
                name: 'custpage_apply',
                line: i
            });
            if (apply === 'T' || apply === true || apply === 'true') {
                var rid = req.getSublistValue({
                    group: 'tdslist',
                    name: 'custpage_internalid',
                    line: i
                });
                if (rid) {
                    var billtdsAcc = parseFloat(req.getSublistValue({
                        group: 'tdslist',
                        name: 'custpage_billtdsaccount',
                        line: i
                    }));
                    var billTdsAmount = parseFloat(req.getSublistValue({
                        group: 'tdslist',
                        name: 'custpage_billtdsamount',
                        line: i
                    }));
                    var billtdsPayable = parseFloat(req.getSublistValue({
                        group: 'tdslist',
                        name: 'custpage_billtdspayable',
                        line: i
                    }));
                    selectedIds.push(rid);
                    selectedObjs.push({ id: rid, billtdsAcc: billtdsAcc, billTdsAmount: billTdsAmount, billtdsPayable: billtdsPayable });
                }
            }
        }
        log.debug("selectedIds", selectedIds)
        log.debug("selectedObjs", selectedObjs)
        var SUITELET_THRESHOLD = parseInt(runtime.getCurrentScript().getParameter({ name: 'custscript_tss_suitelet_threshold' }) || '500', 10);
        log.debug("SUITELET_THRESHOLD", SUITELET_THRESHOLD)
        if (selectedIds.length === 0) {
            throw new Error('No lines selected.');
        }

        if (selectedIds.length <= SUITELET_THRESHOLD) {
            // synchronous path: process in this Suitelet
            try {
                // log.debug("req.parameters['pdate']",req.parameters['pdate'])
                var paymentId = processSynchronously(selectedObjs, req);
                redirect.toRecord({ type: TDS_PAY, id: paymentId });
            } catch (e) {
                log.error('sync processing error', e);
                throw e;
            }
        } else {
            //Create Payment record and then create task to process the rest async if over threshold
            var paymentId = createPaymentRecord(req);

            // create task
            try {
                var deployList = [];

                for (var di = 1; di <= 10; di++) deployList.push('customdeploy' + di);
                log.debug("deployList", deployList)

                var taskId = null;
                var lastErr = null;

                // Try to find an available deployment first (checks for running MR instances)
                var available = findAvailableDeployment(tdsPaymentMRScriptId, deployList);
                log.debug("available deployment", available)
                if (available) {
                    try {
                        var mrTask = task.create({ taskType: task.TaskType.MAP_REDUCE });
                        mrTask.scriptId = tdsPaymentMRScriptId;
                        mrTask.deploymentId = available;
                        mrTask.params = {
                            custscript_tss_mr_tdspymnt_payload: JSON.stringify({
                                selectedIds: selectedIds,
                                bankAccount: req.parameters['account'],
                                taxAgency: req.parameters['taxage'],
                                paymentDate: req.parameters['pdate'],
                                class: req.parameters['class'],
                                location: req.parameters['location'],
                                department: req.parameters['department'],
                                memo: req.parameters['memo'],
                                applyInterest: req.parameters['custpage_apply_interest'],
                                interestAcc: req.parameters['custpage_interst_acc'],
                                interestAmt: req.parameters['custpage_interest_amt'],
                                paymentRecordId: paymentId
                            })
                        };
                        taskId = mrTask.submit();
                        log.audit('MR queued', 'taskId=' + taskId + ' deployment=' + available);
                    } catch (submitErr) {
                        log.error('MR submit failed for available deployment ' + available, submitErr);
                        lastErr = submitErr;
                    }
                }
                log.debug("taskId after first submit attempt", taskId)
                // If not submitted yet, fall back to trying each deployment (handles transient errors)
                if (!taskId) {
                    for (var i = 0; i < deployList.length; i++) {
                        try {
                            var mrTask = task.create({ taskType: task.TaskType.MAP_REDUCE });
                            mrTask.scriptId = tdsPaymentMRScriptId;
                            mrTask.deploymentId = deployList[i];
                            mrTask.params = {
                                custscript_tss_mr_tdspymnt_payload: JSON.stringify({
                                    selectedIds: selectedIds,
                                    bankAccount: req.parameters['account'],
                                    taxAgency: req.parameters['taxage'],
                                    paymentDate: req.parameters['pdate'],
                                    class: req.parameters['class'],
                                    location: req.parameters['location'],
                                    department: req.parameters['department'],
                                    memo: req.parameters['memo'],
                                    bsrcode: req.parameters['bsrcode'],
                                    paymentdate: req.parameters['paymentdate'],
                                    challanno: req.parameters['challanno'],
                                    applyInterest: req.parameters['custpage_apply_interest'],
                                    interestAcc: req.parameters['custpage_interst_acc'],
                                    interestAmt: req.parameters['custpage_interest_amt'],
                                    paymentRecordId: paymentId
                                })
                            };
                            taskId = mrTask.submit();
                            log.audit('MR queued', 'taskId=' + taskId + ' deployment=' + deployList[i]);
                            break;
                        } catch (submitErr) {
                            log.debug('MR submit failed for deployment ' + deployList[i], submitErr);
                            lastErr = submitErr;
                        }
                    }
                }

                if (!taskId) {
                    // cleanup payment record if none of the deployments worked
                    log.error('All MR deployments failed', lastErr);
                    throw lastErr || new Error('Failed to submit MR task to any deployment');
                }

                // Redirect to status page (safe GET request, prevents double-submit)
                try {
                    var currentScript = runtime.getCurrentScript();
                    var statusPageUrl = url.resolveScript({
                        scriptId: currentScript.id,
                        deploymentId: currentScript.deploymentId,
                        params: { show: 'status', taskid: taskId, paymentid: paymentId }
                    });
                    log.debug('Redirecting to status page', 'taskId=' + taskId + ' url=' + statusPageUrl);
                    redirect.redirect({ url: statusPageUrl });
                    return;
                } catch (e) {
                    log.error('Failed to redirect to status page', e);
                    // fallback to immediate redirect if redirect fails
                    redirect.toRecord({ type: TDS_PAY, id: paymentId });
                }
            }
            catch (tErr) {
                var errorAlert = []
                log.error('task submit error', tErr);
                // If task submission fails, clean up the payment record we created to avoid orphaned records
                try {
                    record.delete({ type: TDS_PAY, id: paymentId });
                    log.audit('Payment record deleted due to task submission failure', 'paymentId=' + paymentId);
                } catch (cleanupErr) {
                    log.error('Failed to clean up payment record after task submission failure', cleanupErr);
                    errorAlert.push('Additionally, failed to clean up payment record (id: ' + paymentId + '). Please check the record and delete if necessary.');
                }

                throw (errorAlert.join('\n') + (errorAlert.length > 0 ? '\n' : '') + 'Original error: ' + tErr);
            }
        }
    }

    // synchronous processing: create payment record + check and update relations (small sets only)
    function processSynchronously(selectedObjs, req) {
        var createdPaymentId = null;
        var updated = [];
        try {
            // create payment record
            createdPaymentId = createPaymentRecord(req);
            log.debug('Payment created', 'id=' + createdPaymentId);
            log.debug('tax agency param', req.parameters['taxage'])
            // //create Journal for tax agency to check feasibilty
            // var jeObj = record.create({ type: 'journalentry', isDynamic: false });
            // jeObj.setValue({ fieldId: 'customform', value: 139 });
            // jeObj.setValue({ fieldId: 'subsidiary', value: req.parameters['subsidiary'] });
            // jeObj.setValue({ fieldId: 'currency', value: 7 });
            // jeObj.setValue({ fieldId: 'exchangerate', value: 1 });
            // jeObj.setText({ fieldId: 'trandate', text: req.parameters['pdate'] });

            // for (var i = 0; i < selectedObjs.length; i++) {
            //     var rid = selectedObjs[i].id;

            //     var tdsAmount = parseFloat(selectedObjs[i].billTdsAmount || 0);
            //     var tdsPayable = parseFloat(selectedObjs[i].billtdsPayable || 0);
            //     var amountToPay = Math.min(tdsAmount, tdsPayable);
            //     var tdsAcc = selectedObjs[i].billtdsAcc || '';
            //     jeObj.setSublistValue({ sublistId: 'line', fieldId: 'account', value: tdsAcc, line: i });
            //     jeObj.setSublistValue({ sublistId: 'line', fieldId: 'debit', value: amountToPay, line: i });
            //     if (req.parameters['location']) jeObj.setSublistValue({ sublistId: 'line', fieldId: 'location', value: req.parameters['location'], line: i });
            //     if (req.parameters['class']) jeObj.setSublistValue({ sublistId: 'line', fieldId: 'class', value: req.parameters['class'], line: i });
            //     if (req.parameters['department']) jeObj.setSublistValue({ sublistId: 'line', fieldId: 'department', value: req.parameters['department'], line: i });
            //     // jeObj.setSublistValue({ sublistId: 'line', fieldId: 'entity', value: req.parameters['taxage'], line: i });
            // }
            // jeObj.setSublistValue({ sublistId: 'line', fieldId: 'account', value: req.parameters['account'], line: i });
            // jeObj.setSublistValue({ sublistId: 'line', fieldId: 'credit', value: req.parameters['totalamt'], line: i });
            // if (req.parameters['location']) jeObj.setSublistValue({ sublistId: 'line', fieldId: 'location', value: req.parameters['location'], line: i });
            // if (req.parameters['class']) jeObj.setSublistValue({ sublistId: 'line', fieldId: 'class', value: req.parameters['class'], line: i });
            // if (req.parameters['department']) jeObj.setSublistValue({ sublistId: 'line', fieldId: 'department', value: req.parameters['department'], line: i });
            // // jeObj.setSublistValue({ sublistId: 'line', fieldId: 'entity', value: req.parameters['taxage'], line: i });
            // jeObj.save({ enableSourcing: false, ignoreMandatoryFields: true });
            // log.debug('Journal Entry created for tax agency', 'id=' + jeObj.id)
            // //End of JE Creation
            // create check and expense lines
            var chk = record.create({ type: 'check', isDynamic: true });
            chk.setValue({ fieldId: 'entity', value: parseInt(req.parameters['taxage']) || '' });
            log.debug('entity val', chk.getValue('entity'))
            chk.setValue({ fieldId: 'account', value: req.parameters['account'] });
            chk.setText({ fieldId: 'trandate', text: req.parameters['pdate'] });
            chk.setValue({ fieldId: 'memo', value: req.parameters['memo'] });
            chk.setValue({ fieldId: 'class', value: req.parameters['class'] });
            chk.setValue({ fieldId: 'department', value: req.parameters['department'] });
            chk.setValue({ fieldId: 'location', value: req.parameters['location'] });

            // Set place of supply to "Other State" for all transactions to avoid state tax implications. This is required to ensure that the TDS payment does not get blocked in the workflow due to missing place of supply, as the system expects a value for this field for tax agency payments.
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

            for (var i = 0; i < selectedObjs.length; i++) {
                var rid = selectedObjs[i].id;

                var tdsAmount = parseFloat(selectedObjs[i].billTdsAmount || 0);
                var tdsPayable = parseFloat(selectedObjs[i].billtdsPayable || 0);
                var amountToPay = Math.min(tdsAmount, tdsPayable);
                var tdsAcc = selectedObjs[i].billtdsAcc || '';

                // add line
                chk.selectNewLine({ sublistId: 'expense' });
                chk.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'account', value: tdsAcc });
                chk.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'amount', value: amountToPay });
                if (req.parameters['location']) chk.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'location', value: req.parameters['location'] });
                if (req.parameters['class']) chk.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'class', value: req.parameters['class'] });
                if (req.parameters['department']) chk.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'department', value: req.parameters['department'] });
                chk.commitLine({ sublistId: 'expense' });

                // store prev for rollback
                updated.push({
                    id: rid, prev: {
                        custrecord_tss_its_billtdspayable: tdsPayable,
                        custrecord_tss_its_billstatus: 'Open',
                        custrecord_tss_its_billpaymentlink: '',
                        custrecord_tss_its_billbankname: '',
                        custrecord_tss_its_billpayabledate: '',
                        custrecord_tss_its_billtaxagency: '',
                        custrecord_tss_its_billbsrcode: '',
                        custrecord_tss_its_billpaymentdate: '',
                        custrecord_tss_its_billchallanno: '',
                        custrecord_tss_its_billchequeno: ''
                    },
                    New: {
                        custrecord_tss_its_billtdspayable: tdsPayable - amountToPay
                    }
                });
            }

            //Add interest line if applicable
            if (req.parameters['custpage_apply_interest']) {
                var interestAmt = parseFloat(req.parameters['custpage_interest_amt'] || 0);
                if (interestAmt > 0) {
                    chk.selectNewLine({ sublistId: 'expense' });
                    chk.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'account', value: req.parameters['custpage_interst_acc'] });
                    chk.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'amount', value: interestAmt });
                    if (req.parameters['location']) chk.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'location', value: req.parameters['location'] });
                    if (req.parameters['class']) chk.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'class', value: req.parameters['class'] });
                    if (req.parameters['department']) chk.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'department', value: req.parameters['department'] });
                    chk.commitLine({ sublistId: 'expense' });
                }
            }

            // save check
            var checkId = chk.save({ enableSourcing: false, ignoreMandatoryFields: true });
            log.debug('Check created', 'id=' + checkId);
            // update relations to reduce payable & link to payment
            for (var j = 0; j < updated.length; j++) {
                var u = updated[j];
                // compute new payable
                var newBal = u.New.custrecord_tss_its_billtdspayable;
                if (newBal < 0) newBal = 0;
                record.submitFields({
                    type: TDS_REL,
                    id: u.id,
                    values: {
                        custrecord_tss_its_billtdspayable: newBal,
                        custrecord_tss_its_billstatus: newBal <= 0 ? 'Close' : 'Open',
                        custrecord_tss_its_billpaymentlink: createdPaymentId,
                        custrecord_tss_its_billpayabledate: req.parameters['pdate'],
                        custrecord_tss_its_billbankname: req.parameters['account'],
                        custrecord_tss_its_billchequeno: req.parameters['cheque'],
                        custrecord_tss_its_billtaxagency: req.parameters['taxage'],
                        custrecord_tss_its_billbsrcode: req.parameters['bsrcode'],
                        custrecord_tss_its_billpaymentdate: req.parameters['paymentdate'],
                        custrecord_tss_its_billchallanno: req.parameters['challanno']
                    },
                    options: { ignoreMandatoryFields: true }
                });
            }

            // link check to payment master
            record.submitFields({
                type: TDS_PAY,
                id: createdPaymentId,
                values: { custrecord_tss_tdspay_check: checkId },
                options: { ignoreMandatoryFields: true }
            });

            return createdPaymentId;

        } catch (err) {
            log.error('sync process error', err);
            var errorAlerts = []
            // rollback updated relations if any
            for (var k = 0; k < updated.length; k++) {
                try {
                    record.submitFields({ type: TDS_REL, id: updated[k].id, values: updated[k].prev, options: { ignoreMandatoryFields: true } });
                } catch (rb) {
                    log.error('rollback failed', 'id=' + updated[k].id + ' err=' + rb);
                    errorAlerts.push('Rollback failed for record ID ' + updated[k].id + '. Please check the record for inconsistencies. Error details: ' + rb.message);
                }
            }
            // delete created payment if exists
            if (createdPaymentId) {
                try { record.delete({ type: TDS_PAY, id: createdPaymentId }); }
                catch (delErr) {
                    log.error('delete payment failed', delErr);
                    errorAlerts.push('Failed to delete payment record ID ' + createdPaymentId + '. Please check the record for inconsistencies. Error details: ' + delErr.message);
                }
            }
            if (checkId) {
                // try { transaction.void({ type: 'transaction', id: checkId }); }
                // catch (voidErr) {
                //     log.error('void check failed, Check InternalId - ' + checkId, voidErr);
                //     errorAlerts.push('Failed to void check record ID ' + checkId + '. Please check the record for inconsistencies. Error details: ' + voidErr.message);
                // }
                try { record.delete({ type: 'check', id: checkId }); }
                catch (delErr) {
                    log.error('delete check failed, Check InternalId - ' + checkId, delErr);
                    errorAlerts.push('Failed to delete check record ID ' + checkId + '. Please check the record for inconsistencies. Error details: ' + delErr.message);
                }

            }
            throw (errorAlerts.join('\n') + (errorAlerts.length > 0 ? '\n' : '') + 'Original error: ' + err);

        }
    }

    // Bank Accounts fetch and adding options to bank A/C field
    function populateBankAccounts(params, bankField) {
        bankField.addSelectOption({
            value: '',
            text: ''
        });
        var bankSearch = search.create({
            type: 'account',
            filters: [
                ['subsidiary', 'anyof', params['subsidiary']],
                'AND',
                ['isinactive', 'is', 'F'],
                'AND',
                ['type', 'is', 'Bank']
            ],
            columns: ['name', 'internalid']
        });
        bankSearch.run().each(function (res) {
            bankField.addSelectOption({
                value: res.getValue('internalid'),
                text: (res.getValue('acctnumber') ? res.getValue('acctnumber') + ' - ' : '') + res.getValue('name')
            });
            return true;
        });

    }


    function popluattaxagency(params, taxagency) {
        var taxAgencySearch = search.create({
            type: 'customrecord_tss_ta_subsidiary_tax_agenc',
            filters: [
                ['custrecord_tss_ta_subsidiary', 'anyof', params['subsidiary']],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: ['name', 'internalid', 'custrecord_tss_ta_tax_agency_id']
        });
        taxAgencySearch.run().each(function (res) {
            taxagency.addSelectOption({
                value: res.getValue('custrecord_tss_ta_tax_agency_id'),
                text: res.getValue('name')
            });
            return true;
        });
    }

    function popluatlocations(params, loc) {
        loc.addSelectOption({
            value: '',
            text: ''
        });
        var locSearch = search.create({
            type: 'location',
            filters: [
                ['subsidiary', 'anyof', params['subsidiary']]
            ],
            columns: ['name', 'internalid']
        });
        locSearch.run().each(function (res) {
            loc.addSelectOption({
                value: res.getValue('internalid'),
                text: res.getValue('name')
            });
            return true;
        });

    }

    function search_tds_master(tds_section, assessee_type) {
        var tds_type = new Array();
        var tdsMasterSearch = search.create({
            type: 'customrecord_tss_its_tdsmaster',
            filters: [
                ['custrecord_tss_its_sectioncode', 'anyof', tds_section],
                'AND',
                ['custrecord_tss_its_assessee_code', 'anyof', assessee_type],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: ['name', 'internalid']
        });
        tdsMasterSearch.run().each(function (res) {
            // tds_type.push({
            //     value: res.getValue('internalid'),
            //     text: res.getValue('name')
            // });
            // log.debug("res.getValue('internalid')", res.getValue('internalid'))
            tds_type.push(res.getValue('internalid'))
            return true;
        });
        return tds_type;
    }

    const getfileId = (clientScript) => {
        //we can make it as function to reuse.
        var search_folder = search.create({
            type: 'folder',
            filters: [{
                name: 'name',
                join: 'file',
                operator: 'is',
                values: clientScript
            }],
            columns: [
                {
                    name: 'internalid',
                    join: 'file'
                },
                {
                    name: 'url',
                    join: 'file'
                }
            ]
        });
        var searchFolderId = '';
        search_folder.run().each(function (result) {
            searchFolderId = result.getValue({
                name: 'internalid',
                join: 'file'
            });
            return true;
        });
        log.debug('Client Script Id', searchFolderId)
        return searchFolderId;
    }

    function createPaymentRecord(req) {
        // create payment master
        var payment = record.create({ type: TDS_PAY, isDynamic: true });
        payment.setValue({ fieldId: 'custrecord_tss_its_tdspay_bank', value: req.parameters['account'] });
        payment.setValue({ fieldId: 'custrecord_tss_its_taxagency', value: req.parameters['taxage'] });
        payment.setText({ fieldId: 'custrecord_tss_its_tdspay_date', text: req.parameters['pdate'] });
        payment.setValue({ fieldId: 'custrecord_tss_its_tdspay_memo', value: req.parameters['memo'] });

        payment.setValue({ fieldId: 'custrecord_tss_tdspay_class', value: req.parameters['class'] });
        payment.setValue({ fieldId: 'custrecord_tss_tdspay_location', value: req.parameters['location'] });
        payment.setValue({ fieldId: 'custrecord_tss_tdspay_department', value: req.parameters['department'] });
        payment.setValue({ fieldId: 'custrecord_tss_tdspay_bsr_code', value: req.parameters['bsrcode'] });
        payment.setText({ fieldId: 'custrecord_tss_tdspay_paymentdate', text: req.parameters['paymentdate'] });
        payment.setValue({ fieldId: 'custrecord_tss_tdspay_challan', value: req.parameters['challanno'] });
        payment.setValue({ fieldId: 'custrecord_tss_its_tdspay_cheque', value: req.parameters['cheque'] });
        payment.setValue({ fieldId: 'custrecord_tss_tdspay_subsidiary', value: req.parameters['subsidiary'] });
        payment.setValue({ fieldId: 'custrecord_tss_tdspay_tdstype', value: req.parameters['custpage_tdstype'] });
        payment.setValue({ fieldId: 'custrecord_tss_its_tdspay_balance', value: req.parameters['bankbal'] });
        payment.setValue({ fieldId: 'custrecord_tss_its_tdspay_total_amt', value: req.parameters['totalamt'] });
        payment.setValue({ fieldId: 'custrecord_tss_tdspay_section', value: req.parameters['tds_section'] });
        payment.setValue({ fieldId: 'custrecord_tss_tdspay_assessee', value: req.parameters['assessee_type'] });
        payment.setValue({ fieldId: 'custrecord_tss_tdspay_apply_interest', value: req.parameters['custpage_apply_interest'] ? true : false });
        payment.setValue({ fieldId: 'custrecord_tss_tdspay_interest_amt', value: req.parameters['custpage_interest_amt'] });
        payment.setValue({ fieldId: 'custrecord_tss_tdspay_interest_acc', value: req.parameters['custpage_interst_acc'] });

        // set other fields as required
        var createdPaymentID = payment.save({ enableSourcing: false, ignoreMandatoryFields: true });
        return createdPaymentID;
    }

    /**
     * Find an available Map/Reduce deployment by checking for running instances
     * @param {string} scriptId - MR script id
     * @param {Array} deployList - array of deployment ids to check
     * @returns {string|null} deployment id or null
     */
    function findAvailableDeployment(scriptId, deployList) {
        try {
            for (var i = 0; i < deployList.length; i++) {
                var dep = deployList[i];
                try {
                    var taskSearch = search.create({
                        type: search.Type.MAP_REDUCE_SCRIPT_INSTANCE,
                        filters: [
                            ['script.scriptid', 'is', scriptId],
                            'AND',
                            ['scriptdeployment.scriptid', 'is', dep],
                            'AND',
                            ['status', 'anyof', ['PENDING', 'PROCESSING']]
                        ],
                        columns: ['status']
                    });

                    var resultCount = taskSearch.runPaged().count;
                    if (resultCount === 0) {
                        log.debug('Available deployment found', dep);
                        return dep;
                    } else {
                        log.debug('Deployment busy', { deployment: dep, runningTasks: resultCount });
                    }
                } catch (e) {
                    log.debug('Error checking deployment ' + dep, e.message);
                    continue;
                }
            }
        } catch (e) {
            log.error('findAvailableDeployment error', e);
        }
        return null;
    }

    return { onRequest: onRequest };
});
