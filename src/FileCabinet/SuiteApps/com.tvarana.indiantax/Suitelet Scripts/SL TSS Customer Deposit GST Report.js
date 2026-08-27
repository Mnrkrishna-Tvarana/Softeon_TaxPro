/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
/**
 * Script Name               : SL TSS Customer Deposit GST Report
 * Script Author             : MNR Krishna
 * Script Type               : Suitelet Script
 * Script Version            : 2.1
 * Script Created date       : 25/09/2025
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  Report shows Customer Deposits - Deposit Application - Invoice Data
 */
define(['N/format', 'N/record', 'N/search', 'N/ui/serverWidget', 'N/query'],
    /**
 * @param{format} format
 * @param{record} record
 * @param{search} search
 * @param{serverWidget} serverWidget
 * @param{query} query
 */
    (format, record, search, serverWidget, query) => {
        // Main function that runs when the Suitelet is called
        const onRequest = (scriptContext) => {
            try {
                // Log the type of request (GET or POST)
                log.debug("Request Method", scriptContext.request.method);

                // Check if this is a download request
                let isDownload = scriptContext.request.parameters.download;
                if (isDownload && typeof isDownload === 'string') {
                    isDownload = JSON.parse(isDownload);
                }
                log.audit("Is Download", isDownload);

                // Step 1: Create the form for the report
                let form = serverWidget.createForm({ title: "Customer Deposit GST Reconciliation Report" });

                // Add a section for filters
                form.addFieldGroup({
                    id: 'custpage_tss_filters_region',
                    label: 'Report Filters'
                });

                // Add filter fields to the form
                let fromDateField = form.addField({
                    id: 'custpage_tss_deposit_date',
                    label: "Deposit From Date",
                    type: serverWidget.FieldType.DATE,
                    container: 'custpage_tss_filters_region'
                });

                let toDateField = form.addField({
                    id: 'custpage_tss_deposit_to_date',
                    label: "Deposit To Date",
                    type: serverWidget.FieldType.DATE,
                    container: 'custpage_tss_filters_region'
                });

                let taxField = form.addField({
                    id: 'custpage_tss_taxcode',
                    label: "Tax Code",
                    type: serverWidget.FieldType.SELECT,
                    // source: 'customrecord_tss_tdsrelation',
                    source: 'salestaxitem',

                    container: 'custpage_tss_filters_region'
                });


                let customerField = form.addField({
                    id: 'custpage_tss_customer_name',
                    label: "Customer Name",
                    type: serverWidget.FieldType.SELECT,
                    source: 'customer',
                    container: 'custpage_tss_filters_region'
                });

                let segmentField = form.addField({
                    id: 'custpage_tss_main_segment',
                    label: "Class",
                    type: serverWidget.FieldType.SELECT,
                    source: 'classification',
                    container: 'custpage_tss_filters_region'
                });


                let createdByField = form.addField({
                    id: 'custpage_tss_created_by',
                    label: "Created By",
                    type: serverWidget.FieldType.SELECT,
                    source: 'employee',
                    container: 'custpage_tss_filters_region'
                });


                let reconciledField = form.addField({
                    id: 'custpage_tss_reconciled',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Reconciled',
                    container: 'custpage_tss_filters_region'
                });

                // Add options to the Reconciled field
                reconciledField.addSelectOption({ value: '0', text: '' });
                reconciledField.addSelectOption({ value: '1', text: 'Yes' });
                reconciledField.addSelectOption({ value: '2', text: 'No' });


                // Optional: Set consistent field sizes for better alignment


                [
                    fromDateField,
                    toDateField,
                    taxField,
                    customerField,
                    segmentField,
                    createdByField,
                    reconciledField
                ].forEach(function (f) {
                    f.updateLayoutType({
                        layoutType: serverWidget.FieldLayoutType.OUTSIDE
                    });
                });

                // Row 1 with 4 columns (4 fields)
                fromDateField.updateBreakType({
                    breakType: serverWidget.FieldBreakType.STARTROW
                });
                toDateField.updateBreakType({
                    breakType: serverWidget.FieldBreakType.STARTCOL
                });
                taxField.updateBreakType({
                    breakType: serverWidget.FieldBreakType.STARTCOL
                });
                customerField.updateBreakType({
                    breakType: serverWidget.FieldBreakType.STARTCOL
                });

                // Row 2 with 3 columns (3 fields)
                segmentField.updateBreakType({
                    breakType: serverWidget.FieldBreakType.STARTROW
                });
                createdByField.updateBreakType({
                    breakType: serverWidget.FieldBreakType.STARTCOL
                });
                reconciledField.updateBreakType({
                    breakType: serverWidget.FieldBreakType.STARTCOL
                });



                // Set field sizes



                // Attach client script for button actions
                form.clientScriptFileId = getfileId('TSS_CS_TDS_Reconciliation.js');
                // form.clientScriptModulePath = 'SuiteScripts/TSS_CS_TDS_Reconciliation.js';

                // Add buttons
                form.addSubmitButton({ label: "Refresh" });
                form.addButton({
                    label: "Download",
                    id: 'custpage_tss_download_vppa_recon_report',
                    functionName: 'generateCdaReconReportFile()'
                });

                // Add section for the report table
                form.addFieldGroup({
                    id: 'custpage_tss_report_section',
                    label: 'Report'
                });

                // Add pagination field (hidden initially)
                let paginationField = form.addField({
                    id: 'custpage_tss_page_range',
                    label: 'Page Range',
                    type: serverWidget.FieldType.SELECT,
                    container: 'custpage_tss_report_section'
                });
                paginationField.layoutType = serverWidget.FieldLayoutType.HIDDEN;

                // Add HTML field for displaying the report table
                let reportHtmlField = form.addField({
                    id: 'custpage_tss_cda_report',
                    label: 'CDA Report',
                    type: serverWidget.FieldType.INLINEHTML,
                    container: 'custpage_tss_report_section'
                });
                reportHtmlField.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.OUTSIDEBELOW });

                // Step 3: Build the base HTML for the report table
                let reportHtmlString = `
                <style>
                    table.tablestyle { margin-left: -8px; width: 160%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
                    table.tablestyle th, table.tablestyle td { border: 1px solid #000000; padding: 5px; }
                    table.tablestyle th { background-color: #f2f2f2; font-weight: bold; position: sticky; z-index: 1; top:0; }
                    table.tablestyle tr.vpp-even { background-color: #dfd9d9bd; }  
                    table.tablestyle th { text-align: center; }  
                    .center-align { text-align: center; }
                    .left-align { text-align: left; }
                    .right-align { text-align: right; }
                    #custpage_tss_project_fs, #custpage_tss_project_fs_lbl { margin-left: -1%; }
                    #custpage_tss_project_location_fs, #custpage_tss_project_location_fs_lbl_uir_label { margin-left: -9%; }
                    #custpage_tss_created_by_fs, #custpage_tss_created_by_fs_lbl_uir_label { margin-left: -8%; }
                </style>
                <table class="tablestyle">
                    <thead>
                        <tr>
                            <th>Customer Deposit Created By</th>
                            <th>Customer Deposit Date</th>
                            <th>Customer Deposit Document Number</th>
                            <th>Customer</th>
                            <th>Customer Deposit Class</th>
                            
                            <th>Customer Deposit Tax Code</th>
                            <th>Customer Deposit Tax Rate</th>
                            <th>Customer Deposit Gross Amount</th>
                            <th>Customer Deposit Net Amount</th>
                            <th>Customer Deposit Tax Amount</th>
                            <th>Customer Deposit SGST</th>
                            <th>Customer Deposit CGST</th>
                            <th>Customer Deposit IGST</th>

                            <th>Customer Deposit Status</th>
                            <th>Customer Deposit Created From</th>
                            <th>Application Document Number</th>
                            <th>Application Date</th>
                            <th>Application Amount</th>
                            
                            <th>Applied Invoice</th>                                                   
                            <th>Invoice Amount</th>
                            <th>Invoice Base Amount</th>
                            <th>Invoice Tax Amount</th>
                            <th>Invoice SGST</th>
                            <th>Invoice CGST</th>
                            <th>Invoice IGST</th>
                            
                            <th>Reversal Tax Amt on CD</th>
                            <th>CD Tax Amount Need to be Adjusted</th>
                            <th>Reconciled</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

                // Step 4: Load Vendor Payment Application (CDA) data into a map for quick lookup
                //<th>Invoice Document Number</th>
                //<th>Applied Invoice Amount</th>
                //<th>Invoice TDS Amount</th>
                let cdaMap = {};
                // let cdaSearch = search.load({ id: 'customsearch_vpa_tds_reconciliation' });
                var cdaSearch = search.create({
                    type: "depositapplication",
                    settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                    filters:
                        [
                            ["type", "anyof", "DepAppl"],
                            "AND",
                            ["appliedtotransaction.trandate", "isnotempty", ""],
                            "AND",
                            ["mainline", "is", "F"],
                            "AND",
                            ['voided', 'is', 'F'],
                        ],
                    columns:
                        [
                            search.createColumn({ name: "tranid", label: "Application Document Number" }),
                            search.createColumn({ name: "trandate", label: "Application Date" }),
                            search.createColumn({
                                name: "trandate",
                                join: "appliedToTransaction",
                                label: "Invoice Date"
                            }),
                            search.createColumn({
                                name: "transactionnumber",
                                join: "appliedToTransaction",
                                label: "Invoice Document Number"
                            }),
                            search.createColumn({
                                name: "tranid",
                                join: "appliedToTransaction",
                                label: "Invoice Document Number"
                            }),
                            search.createColumn({
                                name: "internalid",
                                join: "appliedToTransaction",
                                label: "Invoice InternalId"
                            }),
                            search.createColumn({ name: "appliedtoforeignamount", label: "Applied Invoice Amount" }),
                            search.createColumn({
                                name: "taxtotal",
                                join: "appliedToTransaction",
                                label: "Invoice Tax Amount"
                            }),
                            search.createColumn({
                                name: "custbody_tss_it_vpp_appld_tds",
                                join: "appliedToTransaction",
                                label: "Invoice TDS Obj"
                            }),
                            search.createColumn({
                                name: "type",
                                join: "appliedToTransaction",
                                label: "Invoice Type"
                            }),
                            search.createColumn({ name: "custbody_tss_it_taxamount", label: "Tax Amount" }),
                            search.createColumn({ name: "custbody_tss_it_sgst_amount", label: "SGST" }),
                            search.createColumn({ name: "custbody_tss_cgst_amount", label: "CGST" }),
                            search.createColumn({ name: "custbody_tss_it_igst_amount", label: "IGST" }),
                            search.createColumn({ name: "fxamount", label: "Application Amount" }),
                            search.createColumn({ name: "custbody_tss_it_appliedamt_withouttax" })
                        ]
                });

                let pagedCdaResults = cdaSearch.runPaged({ pageSize: 1000 });
                var count = 1;
                pagedCdaResults.pageRanges.forEach((pageRange) => {
                    let page = pagedCdaResults.fetch({ index: pageRange.index });
                    page.data.forEach((result) => {
                        let id = result.id;
                        var invArr = (cdaMap[id] && cdaMap[id]['cdainvoices']) ? cdaMap[id]['cdainvoices'] : [];
                        invArr.push({
                            // invDocNumber: result.getValue({ name: 'transactionnumber', join: 'appliedToTransaction' }),
                            invDocNumber: result.getValue({ name: 'tranid', join: 'appliedToTransaction' }),
                            invInternalId: result.getValue({ name: 'internalid', join: 'appliedToTransaction' }),
                            invTaxAmount: result.getValue({ name: 'taxtotal', join: 'appliedToTransaction' }),
                            invoiceTaxObj: result.getValue({ name: 'custbody_tss_it_vpp_appld_tds', join: 'appliedToTransaction' }),
                            invDate: result.getValue({ name: 'trandate', join: 'appliedToTransaction' }),
                            invType: result.getValue({ name: 'type', join: 'appliedToTransaction' }),
                            InvAmount: result.getValue({ name: 'appliedtoforeignamount' }) || 0,
                        })
                        cdaMap[id] = {
                            appliedInvAmount: result.getValue({ name: 'appliedtoforeignamount' }) || 0,
                            reversalAmt: result.getValue({ name: 'custbody_tss_it_taxamount' }) || 0,
                            cdainvoices: invArr,
                            appliedObj: result.getValue({ name: 'custbody_tss_it_appliedamt_withouttax' }) || '{}'
                        };


                        log.debug(count++ + " " + id, cdaMap[id]);
                    });
                });

                log.debug('all data', cdaMap);
                var groupedCD = {};
                var orderedCdList = [];

                try {
                    // Step 5: Get filter values from the request (if form was submitted)
                    var requestParams = scriptContext.request.parameters;
                    var selectedFromDate = requestParams.custpage_tss_deposit_date || '';
                    var selectedToDate = requestParams.custpage_tss_deposit_to_date || '';
                    var selectedTaxCode = requestParams.custpage_tss_taxcode || '';
                    log.audit('selectedTaxCode', selectedTaxCode)
                    var selectedCustomer = requestParams.custpage_tss_customer_name || '';
                    var selectedSegment = requestParams.custpage_tss_main_segment || '';
                    var selectedCreatedBy = requestParams.custpage_tss_created_by || '';
                    var selectedReconciled = requestParams.custpage_tss_reconciled || '';

                    log.audit('filters data', {
                        selectedFromDate: selectedFromDate,
                        selectedToDate: selectedToDate,
                        selectedTaxCode: selectedTaxCode,
                        selectedCustomer: selectedCustomer,
                        selectedSegment: selectedSegment,
                        selectedCreatedBy: selectedCreatedBy,
                        selectedReconciled: selectedReconciled
                    });

                    // Step 6: Load and apply filters to Customer Deposit (CD) search
                    // var cdSearch = search.load({ id: 'customsearch_vpp_tds_reconciliations' });
                    var cdSearch = search.create({
                        type: "customerdeposit",
                        settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                        filters:
                            [
                                ["type", "anyof", "CustDep"],
                                "AND",
                                ["mainline", "any", ""],
                                "AND",
                                ["custbody_tss_it_taxamount", "greaterthan", "0.00"],
                                "AND",
                                ['voided', 'is', 'F'],
                            ],
                        columns:
                            [
                                search.createColumn({ name: "mainline", label: "*" }),
                                search.createColumn({ name: "createdby", label: "Customer Deposit Created By" }),
                                search.createColumn({ name: "trandate", label: "Customer Deposit Date" }),
                                search.createColumn({ name: "tranid", label: "Customer Deposit Document Number" }),
                                search.createColumn({ name: "entity", label: "Customer" }),
                                search.createColumn({ name: "class", label: "Customer Deposit Class" }),
                                search.createColumn({ name: "custbody_tss_it_tax_code", label: "Tax Code" }),
                                search.createColumn({ name: "custbody_tss_it_taxrate", label: "Customer Deposit Tax Rate" }),
                                search.createColumn({ name: "custbody_tss_it_taxamount", label: "Customer Deposit Tax Amount" }),
                                search.createColumn({ name: "custbody_tss_it_sgst_amount", label: "SGST" }),
                                search.createColumn({ name: "custbody_tss_cgst_amount", label: "CGST" }),
                                search.createColumn({ name: "custbody_tss_it_igst_amount", label: "IGST" }),
                                search.createColumn({ name: "custbody_tss_it_amount_withouttax", label: "Customer Deposit Net Amount" }),
                                search.createColumn({
                                    name: "formulacurrency",
                                    formula: "ABS({amount})",
                                    label: "Customer Deposit Gross Amount"
                                }),
                                search.createColumn({ name: "statusref", label: "Customer Deposit Status" }),
                                search.createColumn({
                                    name: "tranid",
                                    join: "appliedToTransaction",
                                    label: "Customer Deposit Created From"
                                }),
                                search.createColumn({
                                    name: "tranid",
                                    join: "applyingTransaction",
                                    label: "Application Document Number"
                                }),
                                search.createColumn({
                                    name: "trandate",
                                    join: "applyingTransaction",
                                    label: "Application Date"
                                }),
                                search.createColumn({
                                    name: "formulacurrency",
                                    formula: "ABS({applyingtransaction.amount})",
                                    label: "Application Amount"
                                }),
                                search.createColumn({
                                    name: "internalid",
                                    join: "applyingTransaction",
                                    label: "Application Internal ID"
                                }),
                                search.createColumn({
                                    name: "formulanumeric",
                                    formula: "ABS({custbody_tss_it_taxamount}) - ABS({applyingtransaction.custbody_tss_it_taxamount})",
                                    label: "Formula (Numeric)"
                                }),
                                search.createColumn({
                                    name: "custbody_tss_it_taxamount",
                                    join: "applyingTransaction",
                                    label: "Application Tax Amount"
                                }),
                                search.createColumn({ name: "custbody_tss_it_tax_code", label: "Tax Code" }),
                                search.createColumn({ name: "fxamount", label: "Amount (Foreign Currency)" }),
                                search.createColumn({ name: "applyingtransaction", label: "Applying Transaction" }),
                                search.createColumn({
                                    name: "amount",
                                    join: "applyingTransaction",
                                    label: "Amount"
                                }),
                                search.createColumn({
                                    name: "fxamount",
                                    join: "applyingTransaction",
                                    label: "Amount (Foreign Currency)"
                                })
                            ]
                    });
                    var filters = cdSearch.filters || [];


                    // Add date filters
                    // if (selectedFromDate && selectedToDate) {
                    //     filters.push(search.createFilter({
                    //         name: 'trandate',
                    //         operator: search.Operator.WITHIN,
                    //         values: [selectedFromDate, selectedToDate]
                    //     }));
                    let formattedFrom = selectedFromDate ? format.format({
                        value: format.parse({ value: selectedFromDate, type: format.Type.DATE }),
                        type: format.Type.DATE
                    }) : null;

                    let formattedTo = selectedToDate ? format.format({
                        value: format.parse({ value: selectedToDate, type: format.Type.DATE }),
                        type: format.Type.DATE
                    }) : null;
                    if (formattedFrom && formattedTo) {
                        filters.push(search.createFilter({
                            name: 'trandate',
                            operator: search.Operator.ONORAFTER,
                            values: formattedFrom
                        }));

                        filters.push(search.createFilter({
                            name: 'trandate',
                            operator: search.Operator.ONORBEFORE,
                            values: formattedTo
                        }));
                    }
                    else if (formattedFrom) {
                        filters.push(search.createFilter({
                            name: 'trandate',
                            operator: search.Operator.ONORAFTER,
                            values: formattedFrom
                        }));
                    } else if (formattedTo) {
                        filters.push(search.createFilter({
                            name: 'trandate',
                            operator: search.Operator.ONORBEFORE,
                            values: formattedTo
                        }));
                    }

                    // Set default values on form for selected filters
                    if (selectedFromDate) fromDateField.defaultValue = formattedFrom;
                    if (selectedToDate) toDateField.defaultValue = formattedTo;
                    if (selectedTaxCode) {

                        filters.push(search.createFilter({
                            name: 'custbody_tss_it_tax_code',
                            operator: search.Operator.ANYOF,
                            values: selectedTaxCode
                        }));


                        taxField.defaultValue = selectedTaxCode;
                    }
                    log.audit('selectedTaxCode set', filters)
                    if (selectedCustomer) {

                        filters.push(search.createFilter({
                            name: 'entity',
                            operator: search.Operator.ANYOF,
                            values: selectedCustomer
                        }));

                        customerField.defaultValue = selectedCustomer;
                    }
                    if (selectedSegment) {

                        filters.push(search.createFilter({
                            name: 'class',
                            operator: search.Operator.ANYOF,
                            values: selectedSegment
                        }));

                        segmentField.defaultValue = selectedSegment;
                    }

                    if (selectedCreatedBy) {

                        filters.push(search.createFilter({
                            name: 'createdby',
                            operator: search.Operator.ANYOF,
                            values: selectedCreatedBy
                        }));

                        createdByField.defaultValue = selectedCreatedBy;
                    }
                    if (selectedReconciled) {
                        reconciledField.defaultValue = selectedReconciled;
                    }
                    // Update the search with new filters
                    cdSearch.filters = filters;

                    // Step 7: Group CD results by ID

                    var pagedCdResults = cdSearch.runPaged({ pageSize: 1000 });
                    log.debug('pagedCdResults', pagedCdResults)


                    pagedCdResults.pageRanges.forEach((pageRange) => {
                        var page = pagedCdResults.fetch({ index: pageRange.index });
                        page.data.forEach((result) => {
                            log.debug('result', result);
                            let cdId = result.id;
                            log.debug('result.getValue("fxamount")', result.getValue('fxamount'))
                            // const vppRecord = record.load({
                            //     type: record.Type.VENDOR_PREPAYMENT,
                            //     id: cdId
                            // });

                            // const paymentAmount = vppRecord.getValue({ fieldId: 'payment' });
                            // log.debug('Payment Amount', paymentAmount);
                            let appInternalId = result.getValue({ name: 'internalid', join: 'applyingTransaction' }) || '';

                            // Helper to get field value or text
                            let get = (fld, join) => result.getText({ name: fld, join }) || result.getValue({ name: fld, join }) || '';
                            log.debug('get', get);
                            let header = {
                                createdBy: get('createdby'),
                                date: get('trandate'),
                                docNumber: get('tranid'),
                                customer: get('entity'),
                                mainSegment: get('class'),
                                // project: get('csegproject'),
                                // location: get('cseglocations'),
                                taxCodeText: result.getText({ name: 'custbody_tss_it_tax_code' }) || '', // custbody_prepayment_
                                taxCode: result.getValue({ name: 'custbody_tss_it_tax_code' }),
                                // taxCodeText: get('custbody_tss_it_tax_code'),  // custbody_prepayment_
                                rate: get('custbody_tss_it_taxrate'),      // custbody_tds_vendorprepayment_
                                grossAmt: Math.abs(parseFloat(result.getValue('fxamount') || 0)),     // custbody_gross_amount

                                //grossAmt:paymentAmount,
                                taxAmt: parseFloat(get('custbody_tss_it_taxamount')) || 0,  // custbody_vendor_prepayment
                                sgst: parseFloat(get('custbody_tss_it_sgst_amount')) || 0,
                                cgst: parseFloat(get('custbody_tss_cgst_amount')) || 0,
                                igst: parseFloat(get('custbody_tss_it_igst_amount')) || 0,
                                netAmt: parseFloat(get('custbody_tss_it_amount_withouttax')) || 0,  // Net amount from search column  
                                status: get('statusref'),
                                createdFrom: get('tranid', 'appliedToTransaction')
                            };

                            let application = {
                                appDocNumber: get('tranid', 'applyingTransaction'),
                                appDate: get('trandate', 'applyingTransaction'),
                                // appAmount: get('formulacurrency'),
                                appAmount: Math.abs(parseFloat(get('fxamount', 'applyingTransaction'))) || 0,
                                appInternalId: appInternalId
                            };

                            if (!groupedCD[cdId]) {
                                groupedCD[cdId] = {
                                    header,
                                    applications: [],
                                    hasValidCda: false
                                };
                                orderedCdList.push({
                                    cdId: cdId,
                                    date: header.date
                                });
                            }

                            if (appInternalId) {
                                groupedCD[cdId].hasValidCda = true;
                                groupedCD[cdId].applications.push(application);
                            } else {
                                groupedCD[cdId].applications.push(null);
                            }
                        });
                    });
                } catch (e) {
                    log.error('error in search', e)
                }


                // Sort CD list by date
                orderedCdList.sort((a, b) => new Date(a.date) - new Date(b.date));

                // Step 8: If no data, show "No results found"
                // Step 8: If no data, show "No results found"
                if (Object.keys(groupedCD).length === 0) {
                    reportHtmlString += `
                    <style>
                        #custpage_tss_project_location_fs_lbl_uir_label, #custpage_tss_project_location_fs { margin-left: -11%; }
                        #custpage_tss_created_by_fs, #custpage_tss_created_by_fs_lbl_uir_label { margin-left: -10%; }
                        #custpage_tss_page_range_fs_lbl, #custpage_tss_page_range_fs { display: none; }
                    </style>
                    <tr>
                        <td colspan="28" style="text-align: center; font-weight: bold;">No results found</td>
                    </tr>
                `;
                } else {
                    log.debug('data found in DEPOSIT');

                    // Step 9: Build the final data array for the report
                    let finalJsonArray = [];
                    let pageSize = 1000;

                    for (let i = 0; i < orderedCdList.length; i++) {
                        let cdId = orderedCdList[i].cdId;
                        let entry = groupedCD[cdId];
                        let apps = entry.hasValidCda ? entry.applications.filter(a => a !== null) : [null];
                        apps.sort((a, b) => (a?.appDocNumber || '').localeCompare(b?.appDocNumber || ''));

                        // Calculate total reversal amount
                        let totalReversalAmt = apps.reduce((sum, app) => {
                            let matchedCDA = app?.appInternalId ? (cdaMap[app.appInternalId] || {}) : {};
                            return sum + parseFloat(matchedCDA.reversalAmt || 0);
                        }, 0);

                        let taxAmount = entry.header.taxAmt;
                        let sgstAmount = entry.header.sgst;
                        let cgstAmount = entry.header.cgst;
                        let igstAmount = entry.header.igst;
                        let adjusted = taxAmount - totalReversalAmt;
                        // let adjusted = Math.abs(taxAmount - totalReversalAmt);
                        let reconciled = adjusted === 0 ? 'Yes' : 'No';


                        // Skip if it doesn't match reconciled filter
                        if ((selectedReconciled === '1' && reconciled !== 'Yes') ||
                            (selectedReconciled === '2' && reconciled !== 'No')) {
                            continue;
                        }

                        // Build CDA details array
                        // let cdaDetailsArray = apps.map(app => {
                        //     let matchedCDA = app?.appInternalId ? (cdaMap[app.appInternalId] || {}) : {};
                        //     log.debug("Matched CDA", matchedCDA);
                        //     return {
                        //         appDocNumber: app?.appDocNumber || '',
                        //         appDate: app?.appDate || '',
                        //         appAmount: formatCurrency(app?.appAmount || 0),
                        //         appInternalId: app?.appInternalId || '',
                        //         appType: app?.appType || '',
                        //         // invDocNumber: matchedCDA.invDocNumber || '',
                        //         // appliedInvAmount: formatCurrency(matchedCDA.appliedInvAmount || 0),
                        //         // invTaxAmount: formatCurrency(Math.abs(parseFloat(matchedCDA.invTaxAmount || 0))),
                        //         reversalAmt: formatCurrency(parseFloat(matchedCDA.reversalAmt || 0)),

                        //     };
                        // });
                        let cdaDetailsArray = apps.map(app => {
                            let matchedCDA = app?.appInternalId ? (cdaMap[app.appInternalId] || {}) : {};
                            log.debug("Matched CDA", matchedCDA);
                            return {
                                appDocNumber: app?.appDocNumber || '',    // Raw value for Excel
                                appDate: app?.appDate || '',              // Raw value for Excel
                                appAmount: app?.appAmount || 0,           // Raw formula currency value
                                appAmountFormatted: formatCurrency(app?.appAmount || 0), // For table display
                                appInternalId: app?.appInternalId || '',
                                appType: app?.appType || '',
                                cdainvoices: matchedCDA.cdainvoices,
                                appliedInvAmount: formatCurrency(matchedCDA.appliedInvAmount || 0),
                                appliedObj: matchedCDA.appliedObj,
                                // invDocNumber: matchedCDA.invDocNumber,
                                // invInternalId: matchedCDA.invInternalId,
                                // invTaxAmount: formatCurrency(Math.abs(parseFloat(matchedCDA.invTaxAmount || 0))),
                                reversalAmt: formatCurrency(parseFloat(matchedCDA.reversalAmt || 0)),
                            };
                        });


                        // Add to final array
                        finalJsonArray.push({
                            docId: cdId,
                            createdBy: entry.header.createdBy,
                            date: entry.header.date,
                            docNumber: entry.header.docNumber,
                            customer: entry.header.customer,
                            mainSegment: entry.header.mainSegment,
                            // project: entry.header.project,
                            // location: entry.header.location,
                            taxCodeText: entry.header.taxCodeText,
                            taxCode: entry.header.taxCode,
                            rate: entry.header.rate,
                            grossAmt: formatCurrency(entry.header.grossAmt),
                            taxAmount: formatCurrency(taxAmount),
                            sgstAmount: formatCurrency(sgstAmount),
                            cgstAmount: formatCurrency(cgstAmount),
                            igstAmount: formatCurrency(igstAmount),
                            netAmt: formatCurrency(entry.header.netAmt),
                            status: entry.header.status,
                            createdFrom: entry.header.createdFrom,
                            adjusted: adjusted,
                            adjustedFormatted: formatCurrency(adjusted),
                            reconciled,
                            cdaDetails: cdaDetailsArray
                        });
                    }

                    // Log the final data
                    log.audit("Final JSON Array", JSON.stringify(finalJsonArray, null, 2));

                    // Step 10: If download request, send JSON data
                    if (scriptContext.request.method === "GET" && isDownload === true) {
                        scriptContext.response.write(JSON.stringify(finalJsonArray));
                        return;  // Exit early for download
                    }

                    // Step 11: Set up pagination if needed
                    let selectedPageStart = 0;
                    let selectedPageEnd = pageSize;
                    let selectedRange = scriptContext.request.parameters.custpage_tss_page_range || '';
                    if (selectedRange) {
                        let [start, end] = selectedRange.split('-').map(s => parseInt(s.trim(), 10));
                        selectedPageStart = start - 1;
                        selectedPageEnd = end;
                        reportHtmlString += `<style>table.tablestyle { margin-left: 4px; }</style>`;
                    }

                    if (finalJsonArray.length > pageSize) {
                        let totalRecords = finalJsonArray.length;
                        let totalPages = Math.ceil(totalRecords / pageSize);
                        paginationField.layoutType = serverWidget.FieldLayoutType.NORMAL;
                        reportHtmlString += `
                        <style>
                            #custpage_tss_page_range_fs_lbl, #custpage_tss_page_range_fs { display: block; }
                        </style>
                    `;

                        for (let i = 0; i < totalPages; i++) {
                            let start = i * pageSize + 1;
                            let end = Math.min(start + pageSize - 1, totalRecords);
                            paginationField.addSelectOption({ value: `${start}-${end}`, text: `${start}-${end}` });
                        }
                        paginationField.defaultValue = `${selectedPageStart + 1}-${selectedPageEnd}`;
                    } else {
                        reportHtmlString += `
                        <style>
                            #custpage_tss_page_range_fs_lbl, #custpage_tss_page_range_fs { display: none; }
                        </style>
                    `;
                    }

                    // Step 12: Build the HTML table rows from data
                    let renderedVppCount = 0;
                    if (finalJsonArray.length === 0) {
                        reportHtmlString += `
                        <tr>
                            <td colspan="28" style="text-align: center; font-weight: bold;">No results found</td>
                        </tr>
                    `;
                    } else {
                        let pageSlice = finalJsonArray.slice(selectedPageStart, selectedPageEnd);

                        pageSlice.forEach(entry => {
                            let apps = entry.cdaDetails;
                            let rowspan = apps.length || 1;
                            let isEvenGroup = renderedVppCount % 2 === 1;
                            renderedVppCount++;
                            apps.forEach((cda, idx) => {
                                let invoicerowspan1 = (cda.cdainvoices && cda.cdainvoices.length) ? cda.cdainvoices.length : 1;
                                log.debug("invoicerowspan1", invoicerowspan1)
                                log.debug("cda.appInternalId", cda.appInternalId)
                                if (cda.appInternalId && invoicerowspan1 > 1) {
                                    rowspan = rowspan + invoicerowspan1 - 1
                                }
                            })
                            apps.forEach((cda, idx) => {
                                log.debug("cda in rowspan", cda)
                                // log.debug("cda.cdainvoices.length",cda.cdainvoices.length)
                                //Getting Bills count for vppa to add rowspan for CD
                                cda['cdainvoices'] = cda.cdainvoices ? cda.cdainvoices : [{ 'flagKey': '' }]
                                let billrowspan = (cda.cdainvoices && cda.cdainvoices.length) ? cda.cdainvoices.length : 1;
                                log.debug("billrowspan", billrowspan)
                                log.debug("cda.appInternalId", cda.appInternalId)
                                // if (cda.appInternalId && billrowspan > 1) {
                                //     rowspan = rowspan + billrowspan
                                // }

                                //Getting the applied Object from Deposit Application
                                // var appliedObj = JSON.parse(cda.appliedObj)

                                // if (cda.cdainvoices) {
                                cda.cdainvoices.forEach((invoice, invoice_idx) => {
                                    let rowClass = isEvenGroup ? ' class="vpp-even"' : '';
                                    reportHtmlString += `<tr${rowClass}>`;
                                    //                                    <td rowspan="${rowspan}" class="center-align">${entry.docNumber}</td>
                                    log.debug("idx in CDA", idx)
                                    if (idx === 0 && invoice_idx === 0) {
                                        log.debug("rowspan in CD", rowspan)
                                        reportHtmlString += `
                                    <td rowspan="${rowspan}" class="left-align">${entry.createdBy}</td>
                                    <td rowspan="${rowspan}" class="center-align">${entry.date}</td>
                                    <td rowspan="${rowspan}" class="center-align">
                                        <a href="/app/accounting/transactions/custdep.nl?id=${entry.docId}" 
                                        target="_blank" 
                                        style="color:blue;text-decoration:underline;">
                                        Deposit #${entry.docNumber}
                                        </a>
                                    </td>

                                    <td rowspan="${rowspan}" class="left-align">${entry.customer}</td>
                                    <td rowspan="${rowspan}" class="center-align">${entry.mainSegment}</td>
                                  
                                    <td rowspan="${rowspan}" class="left-align">${entry.taxCodeText}</td>
                                    <td rowspan="${rowspan}" class="center-align">${entry.rate}</td>
                                    <td rowspan="${rowspan}" class="right-align">${entry.grossAmt}</td>
                                    <td rowspan="${rowspan}" class="right-align">${entry.netAmt}</td>

                                    <td rowspan="${rowspan}" class="right-align">${entry.taxAmount}</td>
                                    <td rowspan="${rowspan}" class="right-align">${entry.sgstAmount}</td>
                                    <td rowspan="${rowspan}" class="right-align">${entry.cgstAmount}</td>
                                    <td rowspan="${rowspan}" class="right-align">${entry.igstAmount}</td>
                                    <td rowspan="${rowspan}" class="left-align">${entry.status}</td>
                                    <td rowspan="${rowspan}" class="center-align">${entry.createdFrom}</td>
                                `;
                                    }
                                    // let billrowspan = cda.cdainvoices.length || 1;
                                    log.debug("invoice_idx in CDA", invoice_idx)
                                    if (invoice_idx === 0) {
                                        reportHtmlString += `
                            <td rowspan="${billrowspan}" class="center-align">
                                ${cda.appInternalId ?
                                                `<a href="/app/accounting/transactions/depappl.nl?id=${cda.appInternalId}" 
                                        target="_blank" 
                                        style="color:blue;text-decoration:underline;">
                                        Application #${cda.appDocNumber || ''}
                                        </a>`
                                                : ''}
                            </td>

                                <td rowspan="${billrowspan}" class="center-align">${cda.appDate}</td>
                                <td rowspan="${billrowspan}" class="right-align">${cda.appAmountFormatted}</td>`
                                    }
                                    reportHtmlString += `
                                <td class="right-align">`
                                    if (invoice.invType == 'CustInvc') {
                                        reportHtmlString += `  ${invoice.invInternalId ?
                                            `<a href="/app/accounting/transactions/custinvc.nl?id=${invoice.invInternalId}" 
                                        target="_blank" 
                                        style="color:blue;text-decoration:underline;">
                                        Invoice #${invoice.invDocNumber || ''}
                                        </a>`
                                            : ''}`
                                    }
                                    else if (invoice.invType == 'CustRfnd') {
                                        reportHtmlString += `  ${invoice.invInternalId ?
                                            `<a href="/app/accounting/transactions/custrfnd.nl?id=${invoice.invInternalId}" 
                                        target="_blank" 
                                        style="color:blue;text-decoration:underline;">
                                        Refund #${invoice.invDocNumber || ''}
                                        </a>`
                                            : ''}`
                                    }
                                    reportHtmlString += `  </td>
                                <td class="right-align">${invoice.InvAmount || 0}</td>`
                                    var baseAmt = 0;
                                    // var tdsRelation1 = entry.taxCode
                                    // invoice.invoiceTaxObj = invoice.invoiceTaxObj ? JSON.parse(invoice.invoiceTaxObj) : {}
                                    // // log.debug("invoice.invoiceTaxObj", invoice.invoiceTaxObj)
                                    // // if (cda.appInternalId == 3600) {
                                    // //     log.debug("invoice.invoiceTaxObj[tdsRelation1]", invoice.invoiceTaxObj[tdsRelation1])
                                    // //     log.debug("invoice.invoiceTaxObj[tdsRelation1].tdsvppa", invoice.invoiceTaxObj[tdsRelation1].tdsvppa)
                                    // //     log.debug("invoice.invoiceTaxObj[tdsRelation1].tdsvppa[cda.appInternalId]", invoice.invoiceTaxObj[tdsRelation1].tdsvppa[cda.appInternalId])
                                    // // }
                                    // // log.debug("tdsRelation1", tdsRelation1)
                                    // // log.debug("cda.appInternalId", cda.appInternalId)
                                    // if (invoice.invoiceTaxObj[tdsRelation1] &&
                                    //     invoice.invoiceTaxObj[tdsRelation1].tdsvppa &&
                                    //     invoice.invoiceTaxObj[tdsRelation1].tdsvppa[cda.appInternalId]) {

                                    //     baseAmt = invoice.invoiceTaxObj[tdsRelation1].tdsvppa[cda.appInternalId];
                                    // }
                                    log.debug("invoice.InvAmount", invoice.InvAmount || 0)
                                    // baseAmt = appliedObj
                                    log.debug("entry.rate", entry.rate)
                                    baseAmt = (parseFloat(invoice.InvAmount || 0) / (1 + parseFloat(entry.rate) / 100)).toFixed(2)

                                    var invoiceTaxamt = (parseFloat(invoice.InvAmount || 0) - parseFloat(baseAmt)).toFixed(2);
                                    log.debug("invoiceTaxamt", invoiceTaxamt)
                                    var invoiceSGST = 0
                                    var invoiceCGST = 0
                                    var invoiceIGST = 0
                                    if (parseFloat(entry.igstAmount) > 0) {
                                        invoiceIGST = invoiceTaxamt
                                    }
                                    else {
                                        var half = parseFloat(invoiceTaxamt / 2).toFixed(2);
                                        var half2 = (invoiceTaxamt - half).toFixed(2)
                                        invoiceSGST = Math.max(half, half2)
                                        invoiceCGST = Math.min(half, half2)
                                    }
                                    reportHtmlString += ` 
                                <td class="right-align">${baseAmt}</td>
                                <td class="right-align">${invoiceTaxamt}</td>
                                <td class="right-align">${invoiceSGST}</td>
                                <td class="right-align">${invoiceCGST}</td>
                                <td class="right-align">${invoiceIGST}</td>
                                `
                                    if (invoice_idx === 0) {
                                        reportHtmlString += `
                                <td rowspan="${billrowspan}" class="right-align">${cda.reversalAmt}</td>
                            `;
                                    }

                                    // }
                                    // else {
                                    //     log.debug("entered into else no bills applied")
                                    //     reportHtmlString += `
                                    //         <td></td>
                                    //         <td></td>
                                    //         <td></td>
                                    //         <td></td>
                                    //         <td></td>
                                    //         <td></td>
                                    //         <td></td>
                                    //      `
                                    // }
                                    //<td class="center-align">${cda.appDocNumber}</td>
                                    //<td class="right-align">${cda.appAmount}</td>

                                    // <td class="center-align">${cda.invDocNumber}</td>
                                    //     <td class="right-align">${invoice.InvAmount}</td>
                                    //     <td class="right-align">${cda.invTaxAmount}</td>

                                    // if (idx === 0) {
                                    //     reportHtmlString += `
                                    //         <td rowspan="${rowspan}" class="right-align">${entry.adjusted}</td>
                                    //         <td rowspan="${rowspan}" class="center-align">${entry.reconciled}</td>
                                    //     `;
                                    // }
                                    if (idx === 0 && invoice_idx === 0) {
                                        log.debug("rowspan in adjusted", rowspan)
                                        reportHtmlString += `
                                <td rowspan="${rowspan}" class="right-align"
                                style="background-color:${parseFloat(entry.adjusted) < 0 ? '#ffcccc' : 'transparent'};">
                                ${entry.adjustedFormatted}
                                </td>
                                <td rowspan="${rowspan}" class="center-align">${entry.reconciled}</td>
                                `;
                                    }

                                    reportHtmlString += `</tr>`;
                                })
                            });
                        });
                    }
                }




                // Close the table HTML

                reportHtmlString += `</tbody></table>`;
                reportHtmlField.defaultValue = reportHtmlString;

                // Step 13: Send the form as response (unless it's a download)
                if (!isDownload) {
                    scriptContext.response.writePage(form);
                }

            } catch (e) {
                log.error("Error in Suitelet", e);
            }
        };

        // Helper function to format numbers as currency
        const formatCurrency = (value) => {
            return format.format({
                value: parseFloat(value || 0),
                type: format.Type.CURRENCY
            });
        };
        function getTransactionPage(type) {
            switch (type) {
                case 'VendPymt': return 'vendpymt';
                case 'VendBill': return 'vendbill';
                case 'Journal': return 'journalentry';
                case 'VendCred': return 'vendcred';
                default: return 'transaction'; // fallback if unknown
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
                columns: [{
                    name: 'internalid',
                    join: 'file'
                }]
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

        return { onRequest }

    });
