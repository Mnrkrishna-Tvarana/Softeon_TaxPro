/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/url', 'N/https', 'N/ui/message', 'N/format', './ExcelJS.js'],
    function (currentRecord, url, https, message, format, ExcelJS) {

        /**
         * Triggered automatically when the page loads.
         */
        const pageInit = (context) => {
            console.log("TDS Reconciliation Client Script Loaded ✅");
        };
        const generatepdfReconReportFile = () => {
            try {
                console.log('Entered PDF script');

                var objCurrentRecord = currentRecord.get();
                var fromDateSelected = objCurrentRecord.getText({ fieldId: 'custpage_tss_prepayment_date' });
                var toDateSelected = objCurrentRecord.getText({ fieldId: 'custpage_tss_prepayment_to_date' });
                var selectedSection = objCurrentRecord.getValue({ fieldId: 'custpage_tss_tds_section' });
                var selectedVendor = objCurrentRecord.getValue({ fieldId: 'custpage_tss_vendor_name' });
                var selectedSegment = objCurrentRecord.getValue({ fieldId: 'custpage_tss_main_segment' });
                var selectedCreatedBy = objCurrentRecord.getValue({ fieldId: 'custpage_tss_created_by' });
                var selectedReconciled = objCurrentRecord.getValue({ fieldId: 'custpage_tss_reconciled' });

                var downloadPdfLink = url.resolveScript({
                    scriptId: 'customscript_tss_sl_vppa_reconcil_report',
                    deploymentId: 'customdeploy_tss_sl_vppa_reconcil_report',
                    params: {
                        custpage_tss_prepayment_date: fromDateSelected,
                        custpage_tss_prepayment_to_date: toDateSelected,
                        custpage_tss_tds_section: selectedSection,
                        custpage_tss_vendor_name: selectedVendor,
                        custpage_tss_main_segment: selectedSegment,
                        custpage_tss_created_by: selectedCreatedBy,
                        custpage_tss_reconciled: selectedReconciled,
                        download: true
                    },
                    returnExternalUrl: false
                });

                console.log("downloadPdfLink", downloadPdfLink);

                var startMessage = message.create({
                    type: message.Type.INFORMATION,
                    title: "PDF Download Started",
                    message: "Preparing your PDF. Please wait..."
                });
                startMessage.show();

                https.get.promise({ url: downloadPdfLink })
                    .then(function (response) {
                        startMessage.hide();
                        if (!response.body) {
                            throw new Error("No data received from Suitelet");
                        }

                        const data = JSON.parse(response.body);

                        // --- PDFMake document definition ---
                        var headers = [
                            "Created By", "Pre-Payment Date", "Document Number", "Vendor", "Main Segment",
                            "TDS Section", "TDS Rate", "Gross Amount", "Net Amount", "TDS Amount", "Status",
                            "Created From", "App Doc Number", "App Date", "App Amount", "Applied Bill",
                            "Applied Bill Amount", "Bill TDS Amt", "Reversal TDS Amt", "VPP Adjusted", "Reconciled"
                        ];

                        var body = [headers]; // First row is header

                        if (Array.isArray(data)) {
                            data.forEach(entry => {
                                if (entry.vpaDetails && Array.isArray(entry.vpaDetails)) {
                                    entry.vpaDetails.forEach(vpa => {
                                        if (vpa.vppabills && Array.isArray(vpa.vppabills)) {
                                            vpa.vppabills.forEach(bill => {
                                                body.push([
                                                    entry.createdBy || '',
                                                    entry.date || '',
                                                    entry.docNumber || '',
                                                    entry.vendor || '',
                                                    entry.mainSegment || '',
                                                    entry.sectionCode || '',
                                                    entry.rate || '',
                                                    entry.grossAmt || '',
                                                    entry.netAmt || '',
                                                    entry.tdsAmount || '',
                                                    entry.status || '',
                                                    entry.createdFrom || '',
                                                    vpa.appDocNumber || '',
                                                    vpa.appDate || '',
                                                    vpa.appAmount || '',
                                                    bill.billDocNumber || '',
                                                    vpa.appliedBillAmount || '',
                                                    bill.billTdsObj ? bill.billTdsObj[entry.tdsRelation]?.tdsvppa?.[vpa.appInternalId] || '' : '',
                                                    vpa.reversalAmt || '',
                                                    entry.adjusted || '',
                                                    entry.reconciled || ''
                                                ]);
                                            });
                                        }
                                    });
                                }
                            });
                        }

                        var docDefinition = {
                            pageSize: 'A4',
                            pageOrientation: 'landscape',
                            content: [
                                { text: 'TDS Reconciliation Report', style: 'header', alignment: 'center', margin: [0, 0, 0, 20] },
                                {
                                    table: {
                                        headerRows: 1,
                                        widths: Array(headers.length).fill('*'),
                                        body: body
                                    },
                                    layout: {
                                        fillColor: function (rowIndex) {
                                            return rowIndex === 0 ? '#2980b9' : (rowIndex % 2 === 0 ? '#f0f0f0' : null);
                                        }
                                    }
                                }
                            ],
                            styles: {
                                header: { fontSize: 16, bold: true },
                                tableHeader: { bold: true, fontSize: 10, color: 'white' }
                            },
                            defaultStyle: { fontSize: 9 }
                        };

                        // --- Download PDF ---
                        if (typeof pdfMake !== 'undefined') {
                            pdfMake.createPdf(docDefinition).download('TDS_Reconciliation_Report.pdf');
                            message.create({
                                type: message.Type.CONFIRMATION,
                                title: "Download Success",
                                message: "Your PDF has been generated successfully.",
                                duration: 5000
                            }).show();
                        } else {
                            throw new Error("PDFMake is not loaded. Make sure vfs_fonts.js is included in Suitelet HTML.");
                        }

                    })
                    .catch(function (err) {
                        startMessage.hide();
                        console.error("PDF download failed:", err);
                        message.create({
                            type: message.Type.ERROR,
                            title: "Download Failed",
                            message: "PDF download failed. Reason: " + err
                        }).show();
                    });

            } catch (error) {
                console.error("Error in generatepdfReconReportFile:", error);
                message.create({
                    type: message.Type.ERROR,
                    title: "Download Failed",
                    message: "PDF generation failed. Please contact your administrator."
                }).show();
            }
        };


        /*
             * Function to generate VPPA reconciliation report file.
             */
        const generateVppaReconReportFile = () => {
            try {
                var objCurrentRecord = currentRecord.get();
                var subsidSelected = objCurrentRecord.getValue({ fieldId: 'custpage_tss_prepayment_subs' });
                var fromDateSelected = objCurrentRecord.getText({ fieldId: 'custpage_tss_prepayment_date' });
                var toDateSelected = objCurrentRecord.getText({ fieldId: 'custpage_tss_prepayment_to_date' });
                var selectedSection = objCurrentRecord.getValue({ fieldId: 'custpage_tss_tds_section' });
                var selectedVendor = objCurrentRecord.getValue({ fieldId: 'custpage_tss_vendor_name' });
                var selectedSegment = objCurrentRecord.getValue({ fieldId: 'custpage_tss_main_segment' });
                var selectedCreatedBy = objCurrentRecord.getValue({ fieldId: 'custpage_tss_created_by' });
                var selectedReconciled = objCurrentRecord.getValue({ fieldId: 'custpage_tss_reconciled' });

                var downloadExcelLink = url.resolveScript({
                    scriptId: 'customscript_tss_sl_vppa_reconcil_report',
                    deploymentId: 'customdeploy_tss_sl_vppa_reconcil_report',
                    params: {
                        custpage_tss_prepayment_subs: subsidSelected,
                        custpage_tss_prepayment_date: fromDateSelected,
                        custpage_tss_prepayment_to_date: toDateSelected,
                        custpage_tss_tds_section: selectedSection,
                        custpage_tss_vendor_name: selectedVendor,
                        custpage_tss_main_segment: selectedSegment,
                        custpage_tss_created_by: selectedCreatedBy,
                        custpage_tss_reconciled: selectedReconciled,
                        download: true
                    },
                    returnExternalUrl: false
                });

                console.log("downloadExcelLink", downloadExcelLink);

                var startMessage = message.create({
                    type: message.Type.INFORMATION,
                    title: "Download Started",
                    message: "Your download has started. Please wait while we prepare your file. \n Thank you...."
                });
                startMessage.show();

                https.get.promise({ url: downloadExcelLink })
                    .then(async function (response) {
                        startMessage.hide();
                        try {
                            console.log("response", response);
                            var isDownloaded = await generateTDSReconcReport(response);
                            console.log("isDownloaded", isDownloaded);
                            if (isDownloaded === true) {
                                message.create({
                                    type: message.Type.CONFIRMATION,
                                    title: "Download Success",
                                    message: "Your request for download was completed. \n Thank you....",
                                    duration: 10000
                                }).show();
                            }
                        } catch (error) {
                            console.error("Error", error);
                            message.create({
                                type: message.Type.ERROR,
                                title: "Download Failed",
                                message: "Your download has failed. Please contact your administrator for more information. \n Thank you...."
                            }).show();
                        }
                    }).catch(function onRejected(reason) {
                        startMessage.hide();
                        message.create({
                            type: message.Type.ERROR,
                            title: "Download Failed",
                            message: "Your download has failed, Reason :  " + reason
                        }).show();
                    });

            } catch (error) {
                console.error("Error while downloading Excel report", error);
                log.error("Error while downloading Excel report", error);
            }
        };

        /**
         * Function to generate Excel report using ExcelJS.
         */
        async function generateTDSReconcReport(response) {
            try {
                const objBorder = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };

                console.log("response", response);
                console.log("response.body", response.body);

                var reportData;
                if (response.body) {
                    reportData = JSON.parse(response.body);
                } else if (response.body === '') {
                    reportData = false;
                }

                const workbook = new ExcelJS.Workbook();
                const sheet = workbook.addWorksheet("TDS Reconciliation");

                var rowNumber = 1;

                // Title Row
                sheet.mergeCells('A1:U1');
                const titleCell = sheet.getCell('A1');
                titleCell.value = "TDS Reconciliation Report";
                titleCell.font = { bold: true, size: 16 };
                titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
                rowNumber++;

                // Updated Headers - Added Application Amount column
                const headers = [
                    "Vendor Pre-Payment Created By",
                    "Vendor Pre-Payment Date",
                    "Vendor Pre-Payment Document Number",
                    "Vendor",
                    "Vendor Pre-Payment Main Segment",
                    "Vendor Pre-Payment TDS Section Code",
                    "Vendor Pre-Payment TDS Rate",
                    "Vendor Pre-Payment Gross Amount",
                    "Vendor Pre-Payment Net Amount",
                    "Vendor Pre-Payment TDS Amount",
                    "Vendor Pre-Payment Status",
                    "Vendor Pre-Payment Created From",
                    "Application Document Number",
                    "Application Date",
                    "Application Amount", // <-- Added
                    "Applied Bill",
                    "Applied Bill Amount",
                    "Bill TDS Amt",
                    "Reversal TDS Amt on VPA",
                    "VPP TDS Amount Need to be Adjusted",
                    "Reconciled"
                ];

                var leftAlignCols = ['A', 'D', 'F', 'K'];
                var rightAlignCols = ['H', 'I', 'J', 'O', 'S'];

                headers.forEach((text, idx) => {
                    const cell = sheet.getCell(rowNumber, idx + 1);
                    cell.value = text;
                    cell.font = { bold: true, size: 12 };
                    cell.alignment = { horizontal: 'center', wrapText: true };
                    cell.border = objBorder;
                });

                rowNumber++;

                if (!reportData || reportData.length === 0) {
                    sheet.mergeCells(`A${rowNumber}:U${rowNumber}`);
                    const cell = sheet.getCell(`A${rowNumber}`);
                    cell.value = "No results found";
                    cell.font = { italic: true, color: { argb: 'FF0000' }, bold: true };
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    cell.border = objBorder;
                } else {
                    // Data Rows
                    reportData.forEach(entry => {
                        var rowspan = entry.vpaDetails.length || 1;
                        const startRow = rowNumber;

                        entry.vpaDetails.forEach((vpa, idx) => {
                            let billrowspan1 = (vpa.vppabills && vpa.vppabills.length) ? vpa.vppabills.length : 1;
                            console.log("billrowspan1", billrowspan1)
                            console.log("vpa.appInternalId", vpa.appInternalId)
                            if (vpa.appInternalId && billrowspan1 > 1) {
                                rowspan = rowspan + billrowspan1 - 1
                            }
                        })

                        entry.vpaDetails.forEach((vpa, i) => {
                            vpa['vppabills'] = vpa.vppabills ? vpa.vppabills : [{ 'billTdsObj': '' }]
                            let billrowspan = (vpa.vppabills && vpa.vppabills.length) ? vpa.vppabills.length : 1;
                            var vppaStartRow = startRow + 1
                            vpa.vppabills.forEach((bill, bill_idx) => {
                                vppaStartRow++
                                console.log('vpa.appDocNumber', vpa.appDocNumber)
                                const row = rowNumber++;

                                if (i === 0) {
                                    sheet.getCell('A' + row).value = entry.createdBy;
                                    sheet.getCell('B' + row).value = entry.date;
                                    sheet.getCell('C' + row).value = entry.docNumber;
                                    sheet.getCell('D' + row).value = entry.vendor;
                                    sheet.getCell('E' + row).value = entry.mainSegment;
                                    sheet.getCell('F' + row).value = entry.sectionCode;
                                    sheet.getCell('G' + row).value = entry.rate;
                                    sheet.getCell('H' + row).value = entry.grossAmt;
                                    sheet.getCell('I' + row).value = entry.netAmt;
                                    sheet.getCell('J' + row).value = entry.tdsAmount;
                                    sheet.getCell('K' + row).value = entry.status;
                                    sheet.getCell('L' + row).value = entry.createdFrom;
                                    sheet.getCell('T' + row).value = entry.adjusted;
                                    sheet.getCell('U' + row).value = entry.reconciled;

                                    if (rowspan > 1) {
                                        // console.log("startRow", startRow)
                                        // console.log("rowspan", rowspan)
                                        var mergeCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'T', 'U'];
                                        mergeCols.forEach(col => {
                                            sheet.mergeCells(`${col}${startRow}:${col}${startRow + rowspan - 1}`);
                                            for (var r = startRow; r <= startRow + rowspan - 1; r++) {
                                                const cell = sheet.getCell(`${col}${r}`);
                                                cell.border = objBorder;
                                                var alignment = { vertical: 'middle', wrapText: true };
                                                if (leftAlignCols.includes(col)) alignment.horizontal = 'left';
                                                else if (rightAlignCols.includes(col)) alignment.horizontal = 'right';
                                                else alignment.horizontal = 'center';
                                                cell.alignment = alignment;
                                            }
                                        });
                                    }
                                }


                                // Application Details
                                console.log("bill_idx", bill_idx)
                                if (bill_idx === 0) {
                                    // sheet.getCell('M' + row).value = vpa.appDocNumber;
                                    // sheet.getCell('N' + row).value = vpa.appDate;
                                    sheet.getCell('M' + row).value = vpa.appDocNumber ? String(vpa.appDocNumber) : '';  // Always string

                                    if (vpa.appDate) {
                                        // Convert to proper Date object
                                        const excelDate = new Date(vpa.appDate);
                                        if (!isNaN(excelDate)) {
                                            sheet.getCell('N' + row).value = excelDate;
                                            sheet.getCell('N' + row).numFmt = 'mm/dd/yyyy'; // Excel date format
                                        } else {
                                            // Fallback if invalid date format
                                            sheet.getCell('N' + row).value = vpa.appDate;
                                        }
                                    } else {
                                        sheet.getCell('N' + row).value = '';
                                    }
                                    sheet.getCell('O' + row).value = vpa.appAmount; // <-- New column added here
                                    sheet.getCell('S' + row).value = vpa.reversalAmt;


                                    console.log("billrowspan merge0", billrowspan)
                                    if (billrowspan > 1) {
                                        var mergeCols = ['M', 'N', 'O', 'S'];
                                        console.log("vppaStartRow", vppaStartRow)
                                        mergeCols.forEach(col => {
                                            console.log("col", col)
                                            console.log("billrowspan merge", billrowspan)
                                            sheet.mergeCells(`${col}${vppaStartRow}:${col}${vppaStartRow + billrowspan - 1}`);
                                            for (var r = vppaStartRow; r <= vppaStartRow + billrowspan - 1; r++) {
                                                const cell = sheet.getCell(`${col}${r}`);
                                                cell.border = objBorder;
                                                var alignment = { vertical: 'middle', wrapText: true };
                                                if (leftAlignCols.includes(col)) alignment.horizontal = 'left';
                                                else if (rightAlignCols.includes(col)) alignment.horizontal = 'right';
                                                else alignment.horizontal = 'center';
                                                cell.alignment = alignment;
                                            }
                                        });
                                    }
                                }
                                sheet.getCell('P' + row).value = bill.billDocNumber;
                                sheet.getCell('Q' + row).value = vpa.appliedBillAmount;
                                var baseAmt = 0;
                                var tdsRelation1 = entry.tdsRelation
                                bill.billTdsObj = bill.billTdsObj ? JSON.parse(bill.billTdsObj) : {}
                                if (bill.billTdsObj[tdsRelation1] &&
                                    bill.billTdsObj[tdsRelation1].tdsvppa &&
                                    bill.billTdsObj[tdsRelation1].tdsvppa[vpa.appInternalId]) {

                                    baseAmt = bill.billTdsObj[tdsRelation1].tdsvppa[vpa.appInternalId];
                                }
                                console.log("baseAmt", baseAmt)
                                var billTDSamt = ((parseFloat(entry.rate) * parseFloat(baseAmt)) / 100).toFixed(2);
                                sheet.getCell('R' + row).value = billTDSamt;


                                for (var col = 1; col <= 21; col++) {
                                    const cell = sheet.getCell(row, col);
                                    const colLetter = sheet.getColumn(col).letter;
                                    var alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                                    if (leftAlignCols.includes(colLetter)) alignment.horizontal = 'left';
                                    else if (rightAlignCols.includes(colLetter)) alignment.horizontal = 'right';
                                    cell.alignment = alignment;
                                    cell.border = objBorder;
                                }
                            });

                            // Merge common columns

                        });
                    });
                }

                // Updated column widths (added Application Amount column)
                sheet.columns = [
                    { width: 18 }, { width: 15 }, { width: 18 }, { width: 20 }, { width: 18 },
                    { width: 25 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 },
                    { width: 15 }, { width: 20 }, { width: 20 }, { width: 15 },
                    { width: 18 }, // <-- Application Amount
                    { width: 20 }, { width: 20 }, { width: 12 }
                ];

                // Freeze Title + Header Rows
                sheet.views = [{ state: 'frozen', ySplit: 2 }];

                // Download Excel
                const buffer = await workbook.xlsx.writeBuffer();
                const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `TDS_Reconciliation_Report.xlsx`;
                link.click();
                URL.revokeObjectURL(link.href);
                return true;

            } catch (error) {
                console.error("Error generating Excel:", error);
                message.create({
                    type: message.Type.ERROR,
                    title: "Download Failed",
                    message: "Download failed. Please contact your administrator."
                }).show();
                return;
            }
        }



        // Start of Customer Deposit GST report Export files

        /*
             * Function to generate VPPA reconciliation report file.
             */
        const generateCdaReconReportFile = () => {
            try {
                var objCurrentRecord = currentRecord.get();
                var fromDateSelected = objCurrentRecord.getText({ fieldId: 'custpage_tss_deposit_date' });
                var toDateSelected = objCurrentRecord.getText({ fieldId: 'custpage_tss_deposit_to_date' });
                var selectedSection = objCurrentRecord.getValue({ fieldId: 'custpage_tss_taxcode' });
                var selectedVendor = objCurrentRecord.getValue({ fieldId: 'custpage_tss_customer_name' });
                var selectedSegment = objCurrentRecord.getValue({ fieldId: 'custpage_tss_main_segment' });
                var selectedCreatedBy = objCurrentRecord.getValue({ fieldId: 'custpage_tss_created_by' });
                var selectedReconciled = objCurrentRecord.getValue({ fieldId: 'custpage_tss_reconciled' });

                var downloadExcelLink = url.resolveScript({
                    scriptId: 'customscript_sl_tss_itb_deposit_gst_repo',
                    deploymentId: 'customdeploy1',
                    params: {
                        custpage_tss_deposit_date: fromDateSelected,
                        custpage_tss_deposit_to_date: toDateSelected,
                        custpage_tss_taxcode: selectedSection,
                        custpage_tss_customer_name: selectedVendor,
                        custpage_tss_main_segment: selectedSegment,
                        custpage_tss_created_by: selectedCreatedBy,
                        custpage_tss_reconciled: selectedReconciled,
                        download: true
                    },
                    returnExternalUrl: false
                });

                console.log("downloadExcelLink", downloadExcelLink);

                var startMessage = message.create({
                    type: message.Type.INFORMATION,
                    title: "Download Started",
                    message: "Your download has started. Please wait while we prepare your file. \n Thank you...."
                });
                startMessage.show();

                https.get.promise({ url: downloadExcelLink })
                    .then(async function (response) {
                        startMessage.hide();
                        try {
                            console.log("response", response);
                            var isDownloaded = await generateCDreconReportFile(response);
                            console.log("isDownloaded", isDownloaded);
                            if (isDownloaded === true) {
                                message.create({
                                    type: message.Type.CONFIRMATION,
                                    title: "Download Success",
                                    message: "Your request for download was completed. \n Thank you....",
                                    duration: 10000
                                }).show();
                            }
                        } catch (error) {
                            console.error("Error", error);
                            message.create({
                                type: message.Type.ERROR,
                                title: "Download Failed",
                                message: "Your download has failed. Please contact your administrator for more information. \n Thank you...."
                            }).show();
                        }
                    }).catch(function onRejected(reason) {
                        startMessage.hide();
                        message.create({
                            type: message.Type.ERROR,
                            title: "Download Failed",
                            message: "Your download has failed, Reason :  " + reason
                        }).show();
                    });

            } catch (error) {
                console.error("Error while downloading Excel report", error);
                log.error("Error while downloading Excel report", error);
            }
        };

        /**
         * Function to generate Excel report using ExcelJS.
         */
        async function generateCDreconReportFile(response) {
            try {
                const objBorder = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };

                console.log("response", response);
                console.log("response.body", response.body);

                var reportData;
                if (response.body) {
                    reportData = JSON.parse(response.body);
                } else if (response.body === '') {
                    reportData = false;
                }

                const workbook = new ExcelJS.Workbook();
                const sheet = workbook.addWorksheet("GST Reconciliation");

                var rowNumber = 1;

                // Title Row
                sheet.mergeCells('A1:AB1');
                const titleCell = sheet.getCell('A1');
                titleCell.value = "Customer Deposit GST Reconciliation Report";
                titleCell.font = { bold: true, size: 16 };
                titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
                rowNumber++;

                // Updated Headers - Added Application Amount column
                const headers = [
                    "Customer Deposit Created By",
                    "Customer Deposit Date",
                    "Customer Deposit Document Number",
                    "Customer",
                    "Customer Deposit Class",

                    "Customer Deposit Tax Code",
                    "Customer Deposit Tax Rate",
                    "Customer Deposit Gross Amount",
                    "Customer Deposit Net Amount",
                    "Customer Deposit Tax Amount",
                    "SGST",
                    "CGST",
                    "IGST",

                    "Customer Deposit Status",
                    "Customer Deposit Created From",
                    "Application Document Number",
                    "Application Date",
                    "Application Amount", // <-- Added

                    "Applied Invoice",
                    "Invoice Amount",
                    "Invoice Base Amount",
                    "Invoice Tax Amount",
                    "Invoice SGST",
                    "Invoice CGST",
                    "Invoice IGST",

                    "Reversal Tax Amt on CD",
                    "CD Tax Amount Need to be Adjusted",
                    "Reconciled"
                ];

                var leftAlignCols = ['A', 'D', 'F', 'K'];
                var rightAlignCols = ['H', 'I', 'J', 'O', 'S'];

                headers.forEach((text, idx) => {
                    const cell = sheet.getCell(rowNumber, idx + 1);
                    cell.value = text;
                    cell.font = { bold: true, size: 12 };
                    cell.alignment = { horizontal: 'center', wrapText: true };
                    cell.border = objBorder;
                });

                rowNumber++;

                if (!reportData || reportData.length === 0) {
                    sheet.mergeCells(`A${rowNumber}:AB${rowNumber}`);
                    const cell = sheet.getCell(`A${rowNumber}`);
                    cell.value = "No results found";
                    cell.font = { italic: true, color: { argb: 'FF0000' }, bold: true };
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    cell.border = objBorder;
                } else {
                    // Data Rows
                    reportData.forEach(entry => {
                        var rowspan = entry.cdaDetails.length || 1;
                        const startRow = rowNumber;

                        entry.cdaDetails.forEach((cda, idx) => {
                            let invoicerowspan1 = (cda.cdainvoices && cda.cdainvoices.length) ? cda.cdainvoices.length : 1;
                            console.log("invoicerowspan1", invoicerowspan1)
                            console.log("cda.appInternalId", cda.appInternalId)
                            if (cda.appInternalId && invoicerowspan1 > 1) {
                                rowspan = rowspan + invoicerowspan1 - 1
                            }
                        })

                        entry.cdaDetails.forEach((cda, i) => {
                            cda['cdainvoices'] = cda.cdainvoices ? cda.cdainvoices : [{ 'flagKey': '' }]
                            let billrowspan = (cda.cdainvoices && cda.cdainvoices.length) ? cda.cdainvoices.length : 1;
                            var vppaStartRow = 0//startRow + 1
                            cda.cdainvoices.forEach((invoice, invoice_idx) => {
                                vppaStartRow++
                                console.log('cda.appDocNumber', cda.appDocNumber)
                                const row = rowNumber++;

                                if (i === 0 && invoice_idx === 0) {
                                    sheet.getCell('A' + row).value = entry.createdBy;
                                    sheet.getCell('B' + row).value = entry.date;
                                    sheet.getCell('C' + row).value = entry.docNumber;
                                    sheet.getCell('D' + row).value = entry.customer;
                                    sheet.getCell('E' + row).value = entry.mainSegment;
                                    sheet.getCell('F' + row).value = entry.taxCodeText;
                                    sheet.getCell('G' + row).value = entry.rate;
                                    sheet.getCell('H' + row).value = entry.grossAmt;
                                    sheet.getCell('I' + row).value = entry.netAmt;
                                    sheet.getCell('J' + row).value = entry.taxAmount;
                                    sheet.getCell('K' + row).value = entry.sgstAmount;
                                    sheet.getCell('L' + row).value = entry.cgstAmount;
                                    sheet.getCell('M' + row).value = entry.igstAmount;
                                    sheet.getCell('N' + row).value = entry.status;
                                    sheet.getCell('O' + row).value = entry.createdFrom;
                                    sheet.getCell('AA' + row).value = entry.adjusted;
                                    sheet.getCell('AB' + row).value = entry.reconciled;

                                    if (rowspan > 1) {
                                        // console.log("startRow", startRow)
                                        // console.log("rowspan", rowspan)
                                        var mergeCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'AA', 'AB'];
                                        mergeCols.forEach(col => {
                                            sheet.mergeCells(`${col}${startRow}:${col}${startRow + rowspan - 1}`);
                                            for (var r = startRow; r <= startRow + rowspan - 1; r++) {
                                                const cell = sheet.getCell(`${col}${r}`);
                                                cell.border = objBorder;
                                                var alignment = { vertical: 'middle', wrapText: true };
                                                if (leftAlignCols.includes(col)) alignment.horizontal = 'left';
                                                else if (rightAlignCols.includes(col)) alignment.horizontal = 'right';
                                                else alignment.horizontal = 'center';
                                                cell.alignment = alignment;
                                            }
                                        });
                                    }
                                }


                                // Application Details
                                console.log("invoice_idx", invoice_idx)
                                if (invoice_idx === 0) {
                                    // sheet.getCell('P' + row).value = cda.appDocNumber;
                                    // sheet.getCell('Q' + row).value = cda.appDate;
                                    sheet.getCell('P' + row).value = cda.appDocNumber ? String(cda.appDocNumber) : '';  // Always string

                                    if (cda.appDate) {
                                        // Convert to proper Date object
                                        const excelDate = new Date(cda.appDate);
                                        if (!isNaN(excelDate)) {
                                            sheet.getCell('Q' + row).value = excelDate;
                                            sheet.getCell('Q' + row).numFmt = 'mm/dd/yyyy'; // Excel date format
                                        } else {
                                            // Fallback if invalid date format
                                            sheet.getCell('Q' + row).value = cda.appDate;
                                        }
                                    } else {
                                        sheet.getCell('Q' + row).value = '';
                                    }
                                    sheet.getCell('R' + row).value = cda.appAmount; // <-- New column added here
                                    sheet.getCell('Z' + row).value = cda.reversalAmt;


                                    console.log("billrowspan merge0", billrowspan)
                                    if (billrowspan > 1) {
                                        var mergeCols = ['P', 'Q', 'R', 'Z'];
                                        console.log("vppaStartRow", vppaStartRow)
                                        vppaStartRow = vppaStartRow + startRow
                                        console.log("startRow", startRow)
                                        console.log("vppaStartRow1", vppaStartRow)
                                        mergeCols.forEach(col => {
                                            console.log("col", col)
                                            console.log("billrowspan merge", billrowspan)
                                            console.log("startRow + billrowspan - 1", startRow + billrowspan - 1)
                                            sheet.mergeCells(`${col}${startRow}:${col}${startRow + billrowspan - 1}`);
                                            // sheet.mergeCells(`${col}${3}:${col}${4}`);
                                            for (var r = startRow; r <= startRow + billrowspan - 1; r++) {
                                                const cell = sheet.getCell(`${col}${r}`);
                                                cell.border = objBorder;
                                                var alignment = { vertical: 'middle', wrapText: true };
                                                if (leftAlignCols.includes(col)) alignment.horizontal = 'left';
                                                else if (rightAlignCols.includes(col)) alignment.horizontal = 'right';
                                                else alignment.horizontal = 'center';
                                                cell.alignment = alignment;
                                            }
                                        });
                                    }
                                }
                                sheet.getCell('S' + row).value = invoice.invDocNumber;
                                sheet.getCell('T' + row).value = invoice.InvAmount;
                                var baseAmt = 0;
                                // var tdsRelation1 = entry.tdsRelation
                                // invoice.billTdsObj = invoice.billTdsObj ? JSON.parse(invoice.billTdsObj) : {}
                                // if (invoice.billTdsObj[tdsRelation1] &&
                                //     invoice.billTdsObj[tdsRelation1].tdsvppa &&
                                //     invoice.billTdsObj[tdsRelation1].tdsvppa[cda.appInternalId]) {

                                //     baseAmt = invoice.billTdsObj[tdsRelation1].tdsvppa[cda.appInternalId];
                                // }
                                baseAmt = (parseFloat(invoice.InvAmount || 0) / (1 + parseFloat(entry.rate) / 100)).toFixed(2)
                                console.log("baseAmt", baseAmt)
                                var invoiceTaxamt = (parseFloat(invoice.InvAmount || 0) - parseFloat(baseAmt)).toFixed(2);
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
                                sheet.getCell('U' + row).value = baseAmt;
                                sheet.getCell('V' + row).value = invoiceTaxamt;
                                sheet.getCell('W' + row).value = invoiceSGST;
                                sheet.getCell('X' + row).value = invoiceCGST;
                                sheet.getCell('Y' + row).value = invoiceIGST;


                                for (var col = 1; col <= 28; col++) {
                                    const cell = sheet.getCell(row, col);
                                    const colLetter = sheet.getColumn(col).letter;
                                    var alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                                    if (leftAlignCols.includes(colLetter)) alignment.horizontal = 'left';
                                    else if (rightAlignCols.includes(colLetter)) alignment.horizontal = 'right';
                                    cell.alignment = alignment;
                                    cell.border = objBorder;
                                }
                            });

                            // Merge common columns

                        });
                    });
                }

                // Updated column widths (added Application Amount column)
                sheet.columns = [
                    { width: 18 }, { width: 15 }, { width: 18 }, { width: 20 }, { width: 18 },
                    { width: 25 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 },
                    { width: 15 }, { width: 20 }, { width: 20 }, { width: 15 },
                    { width: 18 }, // <-- Application Amount
                    { width: 20 }, { width: 20 }, { width: 12 }
                ];

                // Freeze Title + Header Rows
                sheet.views = [{ state: 'frozen', ySplit: 2 }];

                // Download Excel
                const buffer = await workbook.xlsx.writeBuffer();
                const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `Deposit_GST_Reconciliation_Report.xlsx`;
                link.click();
                URL.revokeObjectURL(link.href);
                return true;

            } catch (error) {
                console.error("Error generating Excel:", error);
                message.create({
                    type: message.Type.ERROR,
                    title: "Download Failed",
                    message: "Download failed. Please contact your administrator."
                }).show();
                return;
            }
        }


        const generatevendorprepaymentGstreport = () => {
            try {
                var objCurrentRecord = currentRecord.get();
                var fromDateSelected = objCurrentRecord.getText({ fieldId: 'custpage_tss_prepayment_date' });
                var toDateSelected = objCurrentRecord.getText({ fieldId: 'custpage_tss_prepayment_to_date' });
                var selectedSection = objCurrentRecord.getValue({ fieldId: 'custpage_tss_gst_code' });
                var selectedVendor = objCurrentRecord.getValue({ fieldId: 'custpage_tss_vendor_name' });
                var selectedSegment = objCurrentRecord.getValue({ fieldId: 'custpage_tss_main_segment' });
                var selectedCreatedBy = objCurrentRecord.getValue({ fieldId: 'custpage_tss_created_by' });
                var selectedReconciled = objCurrentRecord.getValue({ fieldId: 'custpage_tss_reconciled' });

                var downloadExcelLink = url.resolveScript({
                    scriptId: 'customscript_tss_sl_vendor_prepayment_gs',
                    deploymentId: 'customdeploy_tss_sl_vendor_prepayment_gs',
                    params: {
                        custpage_tss_prepayment_date: fromDateSelected,
                        custpage_tss_prepayment_to_date: toDateSelected,
                        custpage_tss_gst_code: selectedSection,
                        custpage_tss_vendor_name: selectedVendor,
                        custpage_tss_main_segment: selectedSegment,
                        custpage_tss_created_by: selectedCreatedBy,
                        custpage_tss_reconciled: selectedReconciled,
                        download: true
                    },
                    returnExternalUrl: false
                });

                console.log("downloadExcelLink", downloadExcelLink);

                var startMessage = message.create({
                    type: message.Type.INFORMATION,
                    title: "Download Started",
                    message: "Your download has started. Please wait while we prepare your file. \n Thank you...."
                });
                startMessage.show();

                https.get.promise({ url: downloadExcelLink })
                    .then(async function (response) {
                        startMessage.hide();
                        try {
                            console.log("response", response);
                            var isDownloaded = await generateGSTReconcReport(response);
                            console.log("isDownloaded", isDownloaded);
                            if (isDownloaded === true) {
                                message.create({
                                    type: message.Type.CONFIRMATION,
                                    title: "Download Success",
                                    message: "Your request for download was completed. \n Thank you....",
                                    duration: 10000
                                }).show();
                            }
                        } catch (error) {
                            console.error("Error", error);
                            message.create({
                                type: message.Type.ERROR,
                                title: "Download Failed",
                                message: "Your download has failed. Please contact your administrator for more information. \n Thank you...."
                            }).show();
                        }
                    }).catch(function onRejected(reason) {
                        startMessage.hide();
                        message.create({
                            type: message.Type.ERROR,
                            title: "Download Failed",
                            message: "Your download has failed, Reason :  " + reason
                        }).show();
                    });

            } catch (error) {
                console.error("Error while downloading Excel report", error);
                log.error("Error while downloading Excel report", error);
            }
        };

        async function generateGSTReconcReport(response) {
            try {
                const objBorder = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };

                const reportData = response.body ? JSON.parse(response.body) : [];

                const workbook = new ExcelJS.Workbook();
                const sheet = workbook.addWorksheet("GST Reconciliation");

                let rowNumber = 1;

                /* ---------------- TITLE ---------------- */
                sheet.mergeCells('A1:AB1');
                sheet.getCell('A1').value = "Vendor Prepayment GST Reconciliation Report";
                sheet.getCell('A1').font = { bold: true, size: 16 };
                sheet.getCell('A1').alignment = { horizontal: 'center' };
                rowNumber++;

                /* ---------------- HEADERS ---------------- */
                const headers = [
                    "Vendor Pre-Payment Created By", "Vendor Pre-Payment Date",
                    "Vendor Pre-Payment Document Number", "Vendor",
                    "Vendor Pre-Payment Class", "Vendor Pre-Payment GST Code",
                    "Vendor Pre-Payment GST Rate", "Vendor Pre-Payment Gross Amount",
                    "Vendor Pre-Payment Net Amount", "Vendor Pre-Payment GST Tax Amount",
                    "Vendor Pre-Payment SGST Amount", "Vendor Pre-Payment CGST Amount",
                    "Vendor Pre-Payment IGST Amount", "Vendor Pre-Payment Status",
                    "Vendor Pre-Payment Created From",
                    "Application Document Number", "Application Date",
                    "Application Amount",
                    "Applied Bill", "Applied Bill Amount",
                    "Bill GST Tax Amount", "Bill SGST", "Bill CGST", "Bill IGST",
                    "Reversal GST Amt on VPA", "VPP TDS Amount Need to be Adjusted",
                    "Reconciled"
                ];

                headers.forEach((h, i) => {
                    const c = sheet.getCell(rowNumber, i + 1);
                    c.value = h;
                    c.font = { bold: true };
                    c.alignment = { horizontal: 'center', wrapText: true };
                    c.border = objBorder;
                });

                rowNumber++;

                /* ---------------- DATA ---------------- */
                reportData.forEach(entry => {

                    const prepayStartRow = rowNumber;

                    entry.vpaDetails.forEach(cda => {

                        const bills = (cda.vppabills && cda.vppabills.length)
                            ? cda.vppabills
                            : [{}];

                        const appStartRow = rowNumber;

                        bills.forEach(bill => {
                            const row = rowNumber++;

                            /* ---------- PREPAYMENT (only first row) ---------- */
                            if (row === prepayStartRow) {
                                sheet.getCell('A' + row).value = entry.createdBy;
                                sheet.getCell('B' + row).value = entry.date;
                                sheet.getCell('C' + row).value = entry.docNumber;
                                sheet.getCell('D' + row).value = entry.vendor;
                                sheet.getCell('E' + row).value = entry.mainSegment;
                                sheet.getCell('F' + row).value = entry.sectionCode;
                                sheet.getCell('G' + row).value = entry.rate;
                                sheet.getCell('H' + row).value = entry.grossAmt;
                                sheet.getCell('I' + row).value = entry.netAmt;
                                sheet.getCell('J' + row).value = entry.tdsAmount;
                                sheet.getCell('K' + row).value = entry.sgstAmount;
                                sheet.getCell('L' + row).value = entry.cgstAmount;
                                sheet.getCell('M' + row).value = entry.igstAmount;
                                sheet.getCell('N' + row).value = entry.status;
                                sheet.getCell('O' + row).value = entry.createdFrom;
                                sheet.getCell('Z' + row).value = entry.adjusted;
                                sheet.getCell('AA' + row).value = entry.reconciled;
                            }

                            /* ---------- APPLICATION ---------- */
                            if (row === appStartRow) {
                                sheet.getCell('P' + row).value = String(cda.appDocNumber || '');
                                sheet.getCell('Q' + row).value = cda.appDate ? cda.appDate : '';
                                sheet.getCell('R' + row).value = cda.appAmount;
                                sheet.getCell('Y' + row).value = cda.reversalAmt;
                            }

                            /* ---------- BILL ---------- */
                            sheet.getCell('S' + row).value = bill.billDocNumber || '';
                            sheet.getCell('T' + row).value = bill.BillAmount || '';

                            const baseAmt = (
                                parseFloat(bill.BillAmount || 0) /
                                (1 + parseFloat(entry.rate || 0) / 100)
                            ).toFixed(2);

                            let sgst = 0, cgst = 0, igst = 0;
                            if (parseFloat(entry.igstAmount) > 0) {
                                igst = baseAmt;
                            } else {
                                const h1 = Math.floor((baseAmt / 2) * 100) / 100;
                                const h2 = (baseAmt - h1).toFixed(2);
                                cgst = Math.min(h1, h2);
                                sgst = Math.max(h1, h2);
                            }

                            sheet.getCell('U' + row).value = baseAmt;
                            sheet.getCell('V' + row).value = sgst;
                            sheet.getCell('W' + row).value = cgst;
                            sheet.getCell('X' + row).value = igst;

                            for (let c = 1; c <= 28; c++) {
                                sheet.getCell(row, c).border = objBorder;
                                sheet.getCell(row, c).alignment = {
                                    vertical: 'middle',
                                    horizontal: 'center',
                                    wrapText: true
                                };
                            }
                        });

                        /* ---------- MERGE APPLICATION ---------- */
                        if (rowNumber - appStartRow > 1) {
                            ['P', 'Q', 'R', 'Z'].forEach(col => {
                                sheet.mergeCells(
                                    `${col}${appStartRow}:${col}${rowNumber - 1}`
                                );
                            });
                        }
                    });


                    if (rowNumber - prepayStartRow > 1) {
                        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'AA', 'AB']
                            .forEach(col => {
                                sheet.mergeCells(
                                    `${col}${prepayStartRow}:${col}${rowNumber - 1}`
                                );
                            });
                    }
                });

                sheet.views = [{ state: 'frozen', ySplit: 2 }];

                const buffer = await workbook.xlsx.writeBuffer();
                const blob = new Blob([buffer], {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                });

                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = "Vendor_prepayment_GST_Reconciliation_Report.xlsx";
                link.click();
                URL.revokeObjectURL(link.href);

            } catch (e) {
                console.error(e);
            }
        }


        return {
            pageInit,
            generateVppaReconReportFile,
            generatepdfReconReportFile,
            generateCdaReconReportFile,
            generatevendorprepaymentGstreport
        };
    });