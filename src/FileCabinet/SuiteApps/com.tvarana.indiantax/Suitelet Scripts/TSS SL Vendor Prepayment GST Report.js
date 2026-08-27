/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/search', 'N/ui/serverWidget', 'N/format', 'N/record'], (search, serverWidget, format, record) => {

    /**
     * Defines the Suitelet script trigger point.
     * @param {Object} scriptContext
     * @param {ServerRequest} scriptContext.request - Incoming request
     * @param {ServerResponse} scriptContext.response - Suitelet response
     * @since 2015.2
     */
    const onRequest = (scriptContext) => {
        try {
            let isDownload = scriptContext.request.parameters.download;
            if (isDownload && typeof isDownload === 'string') {
                isDownload = JSON.parse(isDownload);
            }
            let form = serverWidget.createForm({ title: "GST Reconciliation Report" });

            form.addFieldGroup({
                id: 'custpage_tss_filters_region',
                label: 'Report Filters'
            });

            let fromDateField = form.addField({
                id: 'custpage_tss_prepayment_date',
                label: "Vendor Pre-payment From Date",
                type: serverWidget.FieldType.DATE,
                container: 'custpage_tss_filters_region'
            });

            let toDateField = form.addField({
                id: 'custpage_tss_prepayment_to_date',
                label: "Vendor Pre-payment To Date",
                type: serverWidget.FieldType.DATE,
                container: 'custpage_tss_filters_region'
            });

            let gstCodeField = form.addField({
                id: 'custpage_tss_gst_code',
                label: "GST Code",
                type: serverWidget.FieldType.SELECT,
                source: 'salestaxitem',
                container: 'custpage_tss_filters_region'
            });


            let vendorField = form.addField({
                id: 'custpage_tss_vendor_name',
                label: "Vendor Name",
                type: serverWidget.FieldType.SELECT,
                source: 'vendor',
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

            reconciledField.addSelectOption({ value: '0', text: '' });
            reconciledField.addSelectOption({ value: '1', text: 'Yes' });
            reconciledField.addSelectOption({ value: '2', text: 'No' });


            [
                fromDateField,
                toDateField,
                gstCodeField,
                vendorField,
                segmentField,
                createdByField,
                reconciledField
            ].forEach(function (f) {
                f.updateLayoutType({
                    layoutType: serverWidget.FieldLayoutType.OUTSIDE
                });
                f.updateDisplaySize({
                    height: 60,
                    width: 200
                });
            });


            fromDateField.updateBreakType({
                breakType: serverWidget.FieldBreakType.STARTROW
            }).updateDisplaySize({
                height: 60,
                width: 200
            });


            toDateField.updateBreakType({
                breakType: serverWidget.FieldBreakType.STARTCOL
            }).updateDisplaySize({
                height: 60,
                width: 200
            });

            gstCodeField.updateBreakType({
                breakType: serverWidget.FieldBreakType.STARTCOL
            }).updateDisplaySize({
                height: 60,
                width: 200
            });

            vendorField.updateBreakType({
                breakType: serverWidget.FieldBreakType.STARTCOL
            }).updateDisplaySize({
                height: 60,
                width: 200
            });


            segmentField.updateBreakType({
                breakType: serverWidget.FieldBreakType.STARTROW
            });

            createdByField.updateBreakType({
                breakType: serverWidget.FieldBreakType.STARTCOL
            });

            reconciledField.updateBreakType({
                breakType: serverWidget.FieldBreakType.STARTCOL
            });




            form.clientScriptFileId = getfileId('TSS_CS_TDS_Reconciliation.js');

            form.addSubmitButton({ label: "Refresh" });
            form.addButton({
                label: "Download",
                id: 'custpage_tss_download_vppa_recon_report',
                functionName: 'generatevendorprepaymentGstreport()'
            });

            form.addFieldGroup({
                id: 'custpage_tss_report_section',
                label: 'Report'
            });

            let paginationField = form.addField({
                id: 'custpage_tss_page_range',
                label: 'Page Range',
                type: serverWidget.FieldType.SELECT,
                container: 'custpage_tss_report_section'
            });
            paginationField.layoutType = serverWidget.FieldLayoutType.HIDDEN;

            let reportHtmlField = form.addField({
                id: 'custpage_tss_vppa_report',
                label: 'VPPA Report',
                type: serverWidget.FieldType.INLINEHTML,
                container: 'custpage_tss_report_section'
            });
            reportHtmlField.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.OUTSIDEBELOW });

            let reportHtmlString = `
            
            <script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js"></script>

            
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
                            <th>Vendor Pre-Payment Created By</th>
                            <th>Vendor Pre-Payment Date</th>
                            <th>Vendor Pre-Payment Document Number</th>
                            <th>Vendor</th>
                            <th>Vendor Pre-Payment Class</th>
                            
                            <th>Vendor Pre-Payment GST Code</th>
                            <th>Vendor Pre-Payment GST Rate</th>
                            <th>Vendor Pre-Payment Gross Amount</th>
                            <th>Vendor Pre-Payment Net Amount</th>
                            <th>Vendor Pre-Payment GST Tax Amount</th>
                            <th>Vendor Pre-Payment SGST Amount</th>
                            <th>Vendor Pre-Payment CGST Amount</th>
                            <th>Vendor Pre-Payment IGST Amount</th>

                            <th>Vendor Pre-Payment Status</th>
                            <th>Vendor Pre-Payment Created From</th>
                            <th>Application Document Number</th>
                            <th>Application Date</th>
                            <th>Application Amount</th>
                            <th>Applied Bill</th>                                                   
                            <th>Applied Bill Amount</th>
                            <th>Bill GST Tax Amount</th>
                             <th>Bill SGST</th>
                            <th>Bill CGST</th>
                            <th>Bill IGST</th>
                            
                            <th>Reversal GST Amt on VPA</th>
                            <th>VPP TDS Amount Need to be Adjusted</th>
                            <th>Reconciled</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            // Step 4: Load Vendor Payment Application (VPA) data into a map for quick lookup
            //<th>Bill Document Number</th>
            //<th>Applied Bill Amount</th>
            //<th>Bill TDS Amount</th>
            let vpaMap = {};
            // let vpaSearch = search.load({ id: 'customsearch_vpa_tds_reconciliation' });
            var vpaSearch = search.create({
                type: "vendorprepaymentapplication",
                settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                filters:
                    [
                        ["type", "anyof", "VPrepApp"],
                        "AND",
                        ["appliedtotransaction.trandate", "isnotempty", ""],
                        "AND",
                        ["mainline", "is", "F"]
                    ],
                columns:
                    [
                        search.createColumn({ name: "tranid", label: "Application Document Number" }),
                        search.createColumn({ name: "trandate", label: "Application Date" }),
                        search.createColumn({
                            name: "trandate",
                            join: "appliedToTransaction",
                            label: "Bill Date"
                        }),
                        search.createColumn({
                            name: "transactionnumber",
                            join: "appliedToTransaction",
                            label: "Bill Document Number"
                        }),
                        search.createColumn({
                            name: "internalid",
                            join: "appliedToTransaction",
                            label: "Bill InternalId"
                        }),
                        search.createColumn({ name: "appliedtoforeignamount", label: "Applied Bill Amount" }),
                        search.createColumn({
                            name: "taxtotal",
                            join: "appliedToTransaction",
                            label: "Bill TDS Amount"
                        }),
                        search.createColumn({
                            name: "custbody_tss_it_vpp_appld_tds",
                            join: "appliedToTransaction",
                            label: "Bill TDS Obj"
                        }),
                        search.createColumn({ name: "custbody_tss_it_taxamount", label: "TDS Amount" }),
                        search.createColumn({ name: "fxamount", label: "Application Amount" })
                    ]
            });
            let pagedVpaResults = vpaSearch.runPaged({ pageSize: 1000 });
            var count = 1;
            pagedVpaResults.pageRanges.forEach((pageRange) => {
                let page = pagedVpaResults.fetch({ index: pageRange.index });
                page.data.forEach((result) => {
                    let id = result.id;
                    var billArr = (vpaMap[id] && vpaMap[id]['vppabills']) ? vpaMap[id]['vppabills'] : [];
                    billArr.push({
                        billDocNumber: result.getValue({ name: 'transactionnumber', join: 'appliedToTransaction' }),
                        billInternalId: result.getValue({ name: 'internalid', join: 'appliedToTransaction' }),
                        billTdsAmount: result.getValue({ name: 'taxtotal', join: 'appliedToTransaction' }),
                        billTdsObj: result.getValue({ name: 'custbody_tss_it_vpp_appld_tds', join: 'appliedToTransaction' }),
                       BillAmount: result.getValue({ name: 'appliedtoforeignamount' }) || 0,

                    })
                    vpaMap[id] = {
                        billDate: result.getValue({ name: 'trandate', join: 'appliedToTransaction' }),
                        appliedBillAmount: result.getValue({ name: 'appliedtoforeignamount' }) || 0,
                        reversalAmt: result.getValue({ name: 'custbody_tss_it_taxamount' }) || 0,
                        vppabills: billArr
                    };


                    log.debug(count++ + " " + id, vpaMap[id]);
                });
            });

            log.debug('all data', vpaMap);
            var groupedVPP = {};
            var orderedVppList = [];

            try {
                // Step 5: Get filter values from the request (if form was submitted)
                var requestParams = scriptContext.request.parameters;
                var selectedFromDate = requestParams.custpage_tss_prepayment_date || '';
                var selectedToDate = requestParams.custpage_tss_prepayment_to_date || '';
                var selectedSection = requestParams.custpage_tss_gst_code || '';
                log.audit('selectedSection', selectedSection)
                var selectedVendor = requestParams.custpage_tss_vendor_name || '';
                var selectedSegment = requestParams.custpage_tss_main_segment || '';
                var selectedCreatedBy = requestParams.custpage_tss_created_by || '';
                var selectedReconciled = requestParams.custpage_tss_reconciled || '';

                log.audit('filters data', {
                    selectedFromDate: selectedFromDate,
                    selectedToDate: selectedToDate,
                    selectedSection: selectedSection,
                    selectedVendor: selectedVendor,
                    selectedSegment: selectedSegment,
                    selectedCreatedBy: selectedCreatedBy,
                    selectedReconciled: selectedReconciled
                });

                // Step 6: Load and apply filters to Vendor Pre-Payment (VPP) search
                // var vppSearch = search.load({ id: 'customsearch_vpp_tds_reconciliations' });
                var vppSearch = search.create({
                    type: "vendorprepayment",
                    settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                    filters:
                        [
                            ["type", "anyof", "VPrep"],
                            "AND",
                            ["mainline", "any", ""],
                            "AND",
                            ["custbody_tss_it_taxamount", "greaterthanorequalto", "1.00"]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "mainline", label: "*" }),
                            search.createColumn({ name: "createdby", label: "Vendor Pre-Payment Created By" }),
                            search.createColumn({ name: "trandate", label: "Vendor Pre-Payment Date" }),
                            search.createColumn({ name: "tranid", label: "Vendor Pre-Payment Document Number" }),
                            search.createColumn({ name: "entity", label: "Vendor" }),
                            search.createColumn({ name: "class", label: "Vendor Pre-Payment Class" }),
                            search.createColumn({ name: "custbody_tss_it_tax_code", label: "tax Code" }),
                            search.createColumn({ name: "custbody_tss_it_taxrate", label: "Vendor Pre-Payment tax Rate" }),
                            search.createColumn({ name: "custbody_tss_it_amount_withouttax", label: "Vendor Pre-Payment Base Amount(Gross)" }),
                            search.createColumn({ name: "custbody_tss_it_taxamount", label: "Vendor Pre-Payment TDS Amount" }),
                            search.createColumn({ name: "custbody_tss_it_sgst_amount", label: "SGST" }),
                            search.createColumn({ name: "custbody_tss_cgst_amount", label: "CGST" }),
                            search.createColumn({ name: "custbody_tss_it_igst_amount", label: "IGST" }),
                            search.createColumn({
                                name: "formulacurrency",
                                formula: "ABS({amount})",
                                label: "Vendor Pre-Payment Net Amount"
                            }),
                            search.createColumn({ name: "statusref", label: "Vendor Pre-Payment Status" }),
                            search.createColumn({
                                name: "tranid",
                                join: "appliedToTransaction",
                                label: "Vendor Pre-Payment Created From"
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
                                label: "Application TDS Amount"
                            }),
                            search.createColumn({ name: "custbody_tss_it_tax_code", label: "TDS Type" }),
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
                var filters = vppSearch.filters || [];



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
                if (selectedSection) {

                    filters.push(search.createFilter({
                        name: 'custbody_tss_it_tax_code',        // field on the related record
                        // join: 'custbody_tss_it_tax_code',       // join from VPP to relation
                        operator: search.Operator.ANYOF,
                        values: selectedSection
                    }));


                    gstCodeField.defaultValue = selectedSection;
                }
                log.audit('selectedSection set', filters)
                if (selectedVendor) {

                    filters.push(search.createFilter({
                        name: 'entity',
                        operator: search.Operator.ANYOF,
                        values: selectedVendor
                    }));

                    vendorField.defaultValue = selectedVendor;
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
                vppSearch.filters = filters;

                // Step 7: Group VPP results by ID

                var pagedVppResults = vppSearch.runPaged({ pageSize: 1000 });
                log.debug('pagedVppResults', pagedVppResults)


                pagedVppResults.pageRanges.forEach((pageRange) => {
                    var page = pagedVppResults.fetch({ index: pageRange.index });
                    page.data.forEach((result) => {
                        log.debug('result', result);
                        let vppId = result.id;
                        log.debug('result.getValue("fxamount")', result.getValue('fxamount'))

                        let appInternalId = result.getValue({ name: 'internalid', join: 'applyingTransaction' }) || '';

                        let get = (fld, join) => result.getText({ name: fld, join }) || result.getValue({ name: fld, join }) || '';
                        log.debug('get', get);
                        let header = {
                            createdBy: get('createdby'),
                            date: get('trandate'),
                            docNumber: get('tranid'),
                            vendor: get('entity'),
                            mainSegment: get('class'),

                            sectionCode: result.getText({ name: 'custbody_tss_it_tax_code' }) || '',
                            tdsRelation: result.getValue({ name: 'custbody_tss_it_tax_code' }),
                            rate: get('custbody_tss_it_taxrate'),
                            grossAmt: Math.abs(parseFloat(result.getValue('fxamount') || 0)),

                            tdsAmt: parseFloat(get('custbody_tss_it_taxamount')) || 0,
                            sgst: parseFloat(get('custbody_tss_it_sgst_amount')) || 0,
                            cgst: parseFloat(get('custbody_tss_cgst_amount')) || 0,
                            igst: parseFloat(get('custbody_tss_it_igst_amount')) || 0,
                            netAmt: get('custbody_tss_it_amount_withouttax'),
                            status: get('statusref'),
                            createdFrom: get('tranid', 'appliedToTransaction')
                        };

                        let application = {
                            appDocNumber: get('tranid', 'applyingTransaction'),
                            appDate: get('trandate', 'applyingTransaction'),
                            appAmount: Math.abs(parseFloat(get('fxamount', 'applyingTransaction'))) || 0,
                            appInternalId: appInternalId
                        };

                        if (!groupedVPP[vppId]) {
                            groupedVPP[vppId] = {
                                header,
                                applications: [],
                                hasValidVppa: false
                            };
                            orderedVppList.push({
                                vppId: vppId,
                                date: header.date
                            });
                        }

                        if (appInternalId) {
                            groupedVPP[vppId].hasValidVppa = true;
                            groupedVPP[vppId].applications.push(application);
                        } else {
                            groupedVPP[vppId].applications.push(null);
                        }
                    });
                });
            } catch (e) {
                log.error('error in search', e)
            }



            orderedVppList.sort((a, b) => new Date(a.date) - new Date(b.date));


            if (Object.keys(groupedVPP).length === 0) {
                reportHtmlString += `
                    <style>
                        #custpage_tss_project_location_fs_lbl_uir_label, #custpage_tss_project_location_fs { margin-left: -11%; }
                        #custpage_tss_created_by_fs, #custpage_tss_created_by_fs_lbl_uir_label { margin-left: -10%; }
                        #custpage_tss_page_range_fs_lbl, #custpage_tss_page_range_fs { display: none; }
                    </style>
                    <tr>
                        <td colspan="23" style="text-align: center; font-weight: bold;">No results found</td>
                    </tr>
                `;
            } else {
                log.debug('data found in PREPAYMENT');

                let finalJsonArray = [];
                let pageSize = 1000;

                for (let i = 0; i < orderedVppList.length; i++) {
                    let vppId = orderedVppList[i].vppId;
                    let entry = groupedVPP[vppId];
                    let apps = entry.hasValidVppa ? entry.applications.filter(a => a !== null) : [null];
                    apps.sort((a, b) => (a?.appDocNumber || '').localeCompare(b?.appDocNumber || ''));

                    let totalReversalAmt = apps.reduce((sum, app) => {
                        let matchedVPA = app?.appInternalId ? (vpaMap[app.appInternalId] || {}) : {};
                        return sum + parseFloat(matchedVPA.reversalAmt || 0);
                    }, 0);

                    let tdsAmount = entry.header.tdsAmt;
                    let sgstAmount = entry.header.sgst;
                    let cgstAmount = entry.header.cgst;
                    let igstAmount = entry.header.igst;
                    let adjusted = tdsAmount - totalReversalAmt;
                    let reconciled = adjusted === 0 ? 'Yes' : 'No';


                    if ((selectedReconciled === '1' && reconciled !== 'Yes') ||
                        (selectedReconciled === '2' && reconciled !== 'No')) {
                        continue;
                    }

                    let vpaDetailsArray = apps.map(app => {
                        let matchedVPA = app?.appInternalId ? (vpaMap[app.appInternalId] || {}) : {};
                        log.debug("Matched VPA", matchedVPA);
                        return {
                            appDocNumber: app?.appDocNumber || '',
                            appDate: app?.appDate || '',
                            appAmount: app?.appAmount || 0,
                            appAmountFormatted: formatCurrency(app?.appAmount || 0),
                            appInternalId: app?.appInternalId || '',
                            appType: app?.appType || '',
                            vppabills: matchedVPA.vppabills,
                            appliedBillAmount: formatCurrency(matchedVPA.appliedBillAmount || 0),

                            reversalAmt: formatCurrency(parseFloat(matchedVPA.reversalAmt || 0)),
                        };
                    });


                    // Add to final array
                    finalJsonArray.push({
                        docId: vppId,
                        createdBy: entry.header.createdBy,
                        date: entry.header.date,
                        docNumber: entry.header.docNumber,
                        vendor: entry.header.vendor,
                        mainSegment: entry.header.mainSegment,

                        sectionCode: entry.header.sectionCode,
                        tdsRelation: entry.header.tdsRelation,
                        rate: entry.header.rate,
                        grossAmt: formatCurrency(entry.header.grossAmt),
                        tdsAmount: formatCurrency(tdsAmount),
                        netAmt: formatCurrency(entry.header.netAmt),
                        sgstAmount: formatCurrency(sgstAmount),
                        cgstAmount: formatCurrency(cgstAmount),
                        igstAmount: formatCurrency(igstAmount),
                        status: entry.header.status,
                        createdFrom: entry.header.createdFrom,
                        adjusted: adjusted,
                        adjustedFormatted: formatCurrency(adjusted),
                        reconciled,
                        vpaDetails: vpaDetailsArray
                    });
                }

                log.audit("Final JSON Array", JSON.stringify(finalJsonArray, null, 2));

                if (scriptContext.request.method === "GET" && isDownload === true) {
                    scriptContext.response.write(JSON.stringify(finalJsonArray));
                    return;
                }

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

                let renderedVppCount = 0;
                if (finalJsonArray.length === 0) {
                    reportHtmlString += `
                        <tr>
                            <td colspan="23" style="text-align: center; font-weight: bold;">No results found</td>
                        </tr>
                    `;
                } else {
                    let pageSlice = finalJsonArray.slice(selectedPageStart, selectedPageEnd);

                    pageSlice.forEach(entry => {
                        let apps = entry.vpaDetails;
                        let rowspan = apps.length || 1;
                        let isEvenGroup = renderedVppCount % 2 === 1;
                        renderedVppCount++;
                        apps.forEach((vpa, idx) => {
                            let billrowspan1 = (vpa.vppabills && vpa.vppabills.length) ? vpa.vppabills.length : 1;
                            log.debug("billrowspan1", billrowspan1)
                            log.debug("vpa.appInternalId", vpa.appInternalId)
                            if (vpa.appInternalId && billrowspan1 > 1) {
                                rowspan = rowspan + billrowspan1 - 1
                            }
                        })
                        apps.forEach((vpa, idx) => {
                            log.debug("vpa in rowspan", vpa)

                            vpa['vppabills'] = vpa.vppabills ? vpa.vppabills : [{ 'billTdsObj': '' }]
                            let billrowspan = (vpa.vppabills && vpa.vppabills.length) ? vpa.vppabills.length : 1;
                            log.debug("billrowspan", billrowspan)
                            log.debug("vpa.appInternalId", vpa.appInternalId)

                            vpa.vppabills.forEach((bill, bill_idx) => {
                                let rowClass = isEvenGroup ? ' class="vpp-even"' : '';
                                reportHtmlString += `<tr${rowClass}>`;
                                //                                    <td rowspan="${rowspan}" class="center-align">${entry.docNumber}</td>

                                if (idx === 0) {
                                    log.debug("rowspan in VPP", rowspan)
                                    reportHtmlString += `
                                    <td rowspan="${rowspan}" class="left-align">${entry.createdBy}</td>
                                    <td rowspan="${rowspan}" class="center-align">${entry.date}</td>
                                    <td rowspan="${rowspan}" class="center-align">
                                        <a href="/app/accounting/transactions/vprep.nl?id=${entry.docId}" 
                                        target="_blank" 
                                        style="color:blue;text-decoration:underline;">
                                        Pre-payment #${entry.docNumber}
                                        </a>
                                    </td>

                                    <td rowspan="${rowspan}" class="left-align">${entry.vendor}</td>
                                    <td rowspan="${rowspan}" class="center-align">${entry.mainSegment}</td>
                                  
                                    <td rowspan="${rowspan}" class="left-align">${entry.sectionCode}</td>
                                    <td rowspan="${rowspan}" class="center-align">${entry.rate}</td>
                                    <td rowspan="${rowspan}" class="right-align">${entry.grossAmt}</td>
                                    <td rowspan="${rowspan}" class="right-align">${entry.netAmt}</td>

                                    <td rowspan="${rowspan}" class="right-align">${entry.tdsAmount}</td>
                                    <td rowspan="${rowspan}" class="right-align">${entry.sgstAmount}</td>
                                    <td rowspan="${rowspan}" class="right-align">${entry.cgstAmount}</td>
                                    <td rowspan="${rowspan}" class="right-align">${entry.igstAmount}</td>
                                    <td rowspan="${rowspan}" class="left-align">${entry.status}</td>
                                    <td rowspan="${rowspan}" class="center-align">${entry.createdFrom}</td>
                                `;
                                }
                                // let billrowspan = vpa.vppabills.length || 1;

                                if (bill_idx === 0) {
                                    reportHtmlString += `
                            <td rowspan="${billrowspan}" class="center-align">
                                ${vpa.appInternalId ?
                                            `<a href="/app/accounting/transactions/${getTransactionPage(vpa.appType)}.nl?id=${vpa.appInternalId}" 
                                        target="_blank" 
                                        style="color:blue;text-decoration:underline;">
                                        Application #${vpa.appDocNumber || ''}
                                        </a>`
                                            : ''}
                            </td>

                                <td rowspan="${billrowspan}" class="center-align">${vpa.appDate}</td>
                                <td rowspan="${billrowspan}" class="right-align">${vpa.appAmountFormatted}</td>`
                                }
                                reportHtmlString += `
                                <td class="right-align">
                                ${bill.billInternalId ?
                                        `<a href="/app/accounting/transactions/vendbill.nl?id=${bill.billInternalId}" 
                                        target="_blank" 
                                        style="color:blue;text-decoration:underline;">
                                        Bill #${bill.billDocNumber || ''}
                                        </a>`
                                        : ''}
                                </td>
                                <td class="right-align">${bill.BillAmount || ''}</td>`
                                var baseAmt = 0;
                                // var tdsRelation1 = entry.tdsRelation
                                // bill.billTdsObj = bill.billTdsObj ? JSON.parse(bill.billTdsObj) : {}

                                // if (bill.billTdsObj[tdsRelation1] &&
                                //     bill.billTdsObj[tdsRelation1].tdsvppa &&
                                //     bill.billTdsObj[tdsRelation1].tdsvppa[vpa.appInternalId]) {

                                //     baseAmt = bill.billTdsObj[tdsRelation1].tdsvppa[vpa.appInternalId];
                                // }
                                // log.debug("baseAmt", baseAmt)
                                // var billTDSamt = ((parseFloat(entry.rate) * parseFloat(baseAmt)) / 100).toFixed(2);
                             baseAmt = (parseFloat(bill.BillAmount || 0) / (1 + parseFloat(entry.rate) / 100)).toFixed(2)

                                var BillTaxamount = (parseFloat(bill.BillAmount || 0) - parseFloat(baseAmt)).toFixed(2);
                                    // var BillTaxamount = baseAmt;

                                var billSGST = 0
                                var billCGST = 0
                                var billIGST = 0
                                if (parseFloat(entry.igstAmount) > 0) {
                                    billIGST = BillTaxamount
                                }
                                else {
                                    var half = parseFloat(BillTaxamount / 2).toFixed(2);
                                    var half2 = (BillTaxamount - half).toFixed(2)
                                    billSGST = Math.max(half, half2)
                                    billCGST = Math.min(half, half2)
                                }

                                reportHtmlString += ` 
                                <td class="right-align">${baseAmt || ''}</td>

                                <td class="right-align">${billSGST || ''}</td>
                                <td class="right-align">${billCGST || ''}</td>
                                <td class="right-align">${billIGST ||''}</td> `
                                if (bill_idx === 0) {
                                    reportHtmlString += `
                                <td rowspan="${billrowspan}" class="right-align">${vpa.reversalAmt}</td>
                            `;
                                }


                                if (idx === 0) {
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


            if (!isDownload) {
                scriptContext.response.writePage(form);
            }
        } catch (e) {
            log.error("Error in Suitelet", e)
        }


    }




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