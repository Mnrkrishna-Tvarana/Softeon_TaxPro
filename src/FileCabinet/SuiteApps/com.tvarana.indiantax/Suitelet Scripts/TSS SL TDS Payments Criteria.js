/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/log', 'N/redirect', 'N/runtime', 'N/search', 'N/config', 'N/format', '/SuiteApps/com.tvarana.indiantax/Other Files/TSS TaxPro Server Helper'],
    function (serverWidget, log, redirect, runtime, search, config, format, serverHelper) {
        var g_subisidiary;
        var listSuiteletId = 'customscript_tss_sl_tds_payments'
        var listSuiteletDepId = 'customdeploy1'

        // Date formats to attempt when parsing user input dates (in order)
        /* Commented out since we are now using N/format to get today's date in user's preferred format, but keeping it here for reference in case we need to do custom formatting/parsing in the future
        var slash = ['m/d/yyyy', 'd/m/yyyy', 'yyyy/m/d', 'dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy/mm/dd'];
        var dash = ['d-mon-yyyy', 'd-month-yyyy', 'yyyy-m-d', 'dd-mon-yyyy', 'dd-month-yyyy', 'yyyy-mm-dd'];
        var dot = ['d.m.yyyy', 'dd.mm.yyyy'];
        var comma = ['dd month, yyyy', 'd month, yyyy'];
        var flag = '';
        */

        function onRequest(context) {
            // Always first line — checks subscription
            if (!serverHelper.checkSubscription()) {
                log.debug("TaxPro TDS Payments Page", "Subscription check failed - blocking execution");

                context.response.write(
                    '<!DOCTYPE html>' +
                    '<html>' +
                    '<head>' +
                    '<title>TaxPro - Subscription Ended</title>' +
                    '<style>' +
                    'body {' +
                    'font-family: Arial, sans-serif;' +
                    'display: flex;' +
                    'justify-content: center;' +
                    'align-items: center;' +
                    'height: 100vh;' +
                    'margin: 0;' +
                    'background-color: #f4f4f4;' +
                    '}' +
                    '.container {' +
                    'text-align: center;' +
                    'background: #fff;' +
                    'padding: 50px 60px;' +
                    'border-radius: 8px;' +
                    'box-shadow: 0 2px 10px rgba(0,0,0,0.1);' +
                    'max-width: 500px;' +
                    'width: 100%;' +
                    '}' +
                    '.icon {' +
                    'font-size: 60px;' +
                    'margin-bottom: 20px;' +
                    '}' +
                    'h2 {' +
                    'color: #d9534f;' +
                    'font-size: 24px;' +
                    'margin-bottom: 10px;' +
                    '}' +
                    'p {' +
                    'color: #666;' +
                    'font-size: 15px;' +
                    'line-height: 1.6;' +
                    'margin-bottom: 25px;' +
                    '}' +
                    '.contact {' +
                    'display: inline-block;' +
                    'background-color: #d9534f;' +
                    'color: #fff;' +
                    'padding: 12px 30px;' +
                    'border-radius: 5px;' +
                    'text-decoration: none;' +
                    'font-size: 14px;' +
                    'font-weight: bold;' +
                    '}' +
                    '.contact:hover {' +
                    'background-color: #c9302c;' +
                    '}' +
                    '.footer {' +
                    'margin-top: 30px;' +
                    'font-size: 12px;' +
                    'color: #aaa;' +
                    '}' +
                    '</style>' +
                    '</head>' +
                    '<body>' +
                    '<div class="container">' +
                    '<div class="icon">&#x26A0;</div>' +
                    '<h2>Subscription Ended</h2>' +
                    '<p>' +
                    'Your <strong>TaxPro</strong> subscription has ended or needs renewal.<br>' +
                    'Please contact our support team to continue using TaxPro.' +
                    '</p>' +
                    '<a class="contact" href="mailto:appssubscriptionnotify@tvarana.com">' +
                    '&#9993; Contact Support' +
                    '</a>' +
                    '<div class="footer">' +
                    'TaxPro &copy; ' + new Date().getFullYear() + ' Tvarana. All rights reserved.' +
                    '</div>' +
                    '</div>' +
                    '</body>' +
                    '</html>'
                );
                return;
            }
            SearchGlobalParameter()
            if (context.request.method === 'GET') {
                // Determine user's date format preference to set default date values accordingly
                /* Commented out since we are now using N/format to get today's date in user's preferred format, but keeping it here for reference in case we need to do custom formatting/parsing in the future
                var sysDateFormat = config.load({ type: config.Type.USER_PREFERENCES }).getValue({ fieldId: 'DATEFORMAT' }).toLowerCase();
                if (slash.indexOf(sysDateFormat) != -1) {
                    flag = "slash";
                } else if (dash.indexOf(sysDateFormat) != -1) {
                    flag = "dash";
                } else if (dot.indexOf(sysDateFormat) != -1) {
                    flag = "dot";
                } else if (comma.indexOf(sysDateFormat) != -1) {
                    flag = "comma";
                }
                */

                var form = serverWidget.createForm({ title: 'TDS Payment Criteria' });
                form.clientScriptFileId = getfileId('CLI TSS TDS Payments Criteria.js');

                // Set default From and To dates to today's date formatted according to user's preference
                /* Commented out since we are now using N/format to get today's date in user's preferred format, but keeping it here for reference in case we need to do custom formatting/parsing in the future
                var dateStr = formatLeaveDates(flag, new Date(), '', sysDateFormat)[0];
                */

                // Alternate approach using N/format to get today's date in user's preferred format
                var dateStr = format.format({
                    value: new Date(),
                    type: format.Type.DATE
                });
                log.debug('dateStr', dateStr);

                form.addField({ id: 'accountingperiod', type: serverWidget.FieldType.SELECT, label: 'Posting Period', source: 'accountingperiod' });
                var from = form.addField({ id: 'fromdate', type: serverWidget.FieldType.DATE, label: 'From Date' }).defaultValue = dateStr;
                var to = form.addField({ id: 'todate', type: serverWidget.FieldType.DATE, label: 'To Date' }).defaultValue = dateStr;
                form.addField({ id: 'tds_section', type: serverWidget.FieldType.SELECT, label: 'TDS Section', source: 'customlist_tss_its_section_code' }).isMandatory = true;
                form.addField({ id: 'assessee_type', type: serverWidget.FieldType.SELECT, label: 'Assessee Type', source: 'customlist_tss__assessee_code' }).isMandatory = true;
                var subsiField = form.addField({ id: 'subsidiary', type: serverWidget.FieldType.SELECT, label: 'Subsidiary' })
                if (runtime.isFeatureInEffect({ feature: 'SUBSIDIARIES' })) {
                    subsiField.isMandatory = true;
                    populateSubsidiaries(g_subisidiary, subsiField)
                }


                form.addSubmitButton({ label: 'Search' });
                context.response.writePage(form);
            } else {
                // POST -> redirect to payment suitelet with params
                var tds_sectionText = ''
                if (context.request.parameters['tds_section']) {
                    var tds_sectionLookup = search.lookupFields({
                        type: 'customlist_tss_its_section_code',   // or record type of that list
                        id: context.request.parameters['tds_section'],
                        columns: ['name']
                    });
                    // log.debug("tds_sectionLookup", tds_sectionLookup)
                    tds_sectionText = tds_sectionLookup.name;
                }

                var params = {
                    accountingperiod: context.request.parameters['accountingperiod'] || '',
                    fromdate: context.request.parameters['fromdate'] || '',
                    todate: context.request.parameters['todate'] || '',
                    subsidiary: context.request.parameters['subsidiary'] || '',
                    tds_section: context.request.parameters['tds_section'] || '',
                    assessee_type: context.request.parameters['assessee_type'] || '',
                    tds_section_text: tds_sectionText
                };
                redirect.toSuitelet({ scriptId: listSuiteletId, deploymentId: listSuiteletDepId, parameters: params });
            }
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

        //Custom Functions
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

            }
            return global_sub;
        } // end function SearchGlobalParameter()

        function _logValidation(value) {
            if (value != 'null' && value != null && value != null && value != '' && value != undefined && value != undefined && value != 'undefined' && value != 'undefined' && value != 'NaN' && value != NaN) {
                return true;
            }
            else {
                return false;
            }
        }

        // Subsidiaries fetch and adding options to Subsidiary field
        function populateSubsidiaries(g_subisidiary, subsiField) {
            subsiField.addSelectOption({
                value: '',
                text: ''
            });
            var subsiSearch = search.create({
                type: 'subsidiary',
                filters: [
                    ['internalid', 'anyof', g_subisidiary.split(',')],
                    'AND',
                    ['isinactive', 'is', 'F']
                ],
                columns: ['name', 'internalid']
            });
            subsiSearch.run().each(function (res) {
                subsiField.addSelectOption({
                    value: res.getValue('internalid'),
                    text: res.getValue('name')
                });
                return true;
            });

        }

        // Function to format dates based on user's preferred date format
        /* Commented out since we are now using N/format to get today's date in user's preferred format, but keeping it here for reference in case we need to do custom formatting/parsing in the future
        function formatLeaveDates(flag, start, end, dateFormat) {
            try {
                var resArray = [];
                var separatorObj = { "slash": '/', "dash": "-", "dot": ".", "comma": ',' };
                var monthObj = {
                    'm': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
                    'mm': ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
                    'mon': ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
                    'month': ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
                };

                // Fallback dateFormat
                if (!dateFormat || typeof dateFormat !== 'string') {
                    dateFormat = 'dd/mm/yyyy';
                }

                var sep = (flag && separatorObj[flag]) ? separatorObj[flag] : '/';
                var lowerFormat = dateFormat.toLowerCase();

                // identify tokens using regex for safe token matching
                var dateTokenMatch = lowerFormat.match(/\bdd\b|\bd\b/);
                var monthTokenMatch = lowerFormat.match(/\bmonth\b|\bmon\b|\bmm\b|\bm\b/);
                var yearTokenMatch = lowerFormat.match(/yyyy|yy/);

                var dateForm = dateTokenMatch ? dateTokenMatch[0] : 'dd';
                var monthForm = monthTokenMatch ? monthTokenMatch[0] : 'mm';
                var yearForm = yearTokenMatch ? yearTokenMatch[0] : 'yyyy';

                // Helper to format a single input (Date or string)
                function formatSingle(inDate) {
                    var dt = null;
                    if (!inDate) return null;
                    if (Object.prototype.toString.call(inDate) === '[object Date]') {
                        dt = inDate;
                    } else {
                        dt = new Date(inDate);
                    }
                    if (!dt || isNaN(dt.getTime())) return null;

                    var day = dt.getDate();
                    var month = dt.getMonth() + 1;
                    var year = dt.getFullYear();

                    var dayStr = (dateForm === 'dd') ? ('0' + day).slice(-2) : String(day);
                    var monthStr;
                    if (monthForm === 'mm') monthStr = ('0' + month).slice(-2);
                    else if (monthForm === 'm') monthStr = String(month);
                    else if (monthForm === 'mon') monthStr = monthObj['mon'][month - 1];
                    else if (monthForm === 'month') monthStr = monthObj['month'][month - 1];
                    else monthStr = ('0' + month).slice(-2);

                    var yearStr = (yearForm === 'yy') ? String(year).slice(-2) : String(year);

                    // Replace tokens with word boundaries to avoid partial replacements
                    var out = lowerFormat;
                    out = out.replace(new RegExp('\\b' + dateForm + '\\b'), dayStr);
                    out = out.replace(new RegExp('\\b' + monthForm + '\\b'), monthStr);
                    out = out.replace(new RegExp('\\b' + yearForm + '\\b'), yearStr);
                    return out;
                }

                var formattedStart = formatSingle(start);
                if (formattedStart) resArray.push(formattedStart);

                var formattedEnd = formatSingle(end);
                if (formattedEnd) resArray.push(formattedEnd);

                return resArray;
            } catch (e) {
                log.error('Failed to Parse Dates', e);
                return [];
            }
        }
        */

        return { onRequest: onRequest };

    });
