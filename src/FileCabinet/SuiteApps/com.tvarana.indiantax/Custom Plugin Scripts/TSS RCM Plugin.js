/**
 * @NApiVersion 2.1
 * @NScriptType CustomGLPlugin
 */
/**
 * Script Type          : Custom GL Lines Plug-in
 * Script Name          : TSS RCM Plugin
 * Script Version       : 2.1
 * Suite Script Version : 2.1
 * Author               : MNR Krishna
 * Start Date           : 10-12-2025
 * Description          : This Script will add custom GL lines on Vendor Bill, Vendor Credit and Purchase Order for RCM Lines. 
 * 
 * Version      Name              Date       	        Notes
 * 1.0          MNR Krishna       01-11-2023           Initial version
 * 2.1          MNR Krishna       10-12-2025           Converted from 1.0 version into 2.1 version script
 */
define(['N/log', 'N/search', 'N/record', 'N/url', 'N/https', '/SuiteApps/com.tvarana.indiantax/Other Files/TSS TaxPro Server Helper'], function (log, search, record, url, https, serverHelper) {

    function customizeGlImpact(context) {
        try {
            // Always first line — checks subscription
            if (!serverHelper.checkSubscription()) {
                log.debug("TaxPro RCM Plugin", "Subscription check failed - blocking execution");
                return true;
            }
            var transactionRecord = context.transactionRecord;
            var standardLines = context.standardLines;
            var customLines = context.customLines;

            var recType = transactionRecord.getValue({ fieldId: 'type' });
            var recSub = transactionRecord.getValue({ fieldId: 'subsidiary' });
            var exchRate = parseFloat(transactionRecord.getValue({ fieldId: 'exchangerate' })) || 1;

            // -------------------------------------------------------------------
            // 1. Load Global Parameters
            // -------------------------------------------------------------------
            var globalParams = loadGlobalParameters();
            if (!globalParams) return;

            var subsList = globalParams.subsidiaryIds;
            if (subsList.indexOf(recSub) === -1) return;

            log.debug("Global Parameters", globalParams);

            // -------------------------------------------------------------------
            // 2. Load Tax Agency Vendor
            // -------------------------------------------------------------------
            var taxAgency = getTaxAgencyVendor(recSub);
            log.debug("Tax Agency", taxAgency);

            var GSTamt = 0;
            var IGSTamt = 0;

            // -------------------------------------------------------------------
            // 3. Process Item & Expense Lines
            // -------------------------------------------------------------------
            processLineGroup("item");
            processLineGroup("expense");

            function processLineGroup(sublistId) {
                var count = transactionRecord.getLineCount({ sublistId: sublistId });

                for (var i = 0; i < count; i++) {

                    var applyRCM = transactionRecord.getSublistValue({
                        sublistId: sublistId,
                        fieldId: 'custcol_tss_rcm_apply',
                        line: i
                    });

                    if (!isTrue(applyRCM)) continue;

                    var taxCode = transactionRecord.getSublistValue({
                        sublistId: sublistId,
                        fieldId: 'custcol_tss_rcm_tax_code',
                        line: i
                    });

                    var taxRate = parseFloat(transactionRecord.getSublistValue({
                        sublistId: sublistId,
                        fieldId: 'custcol_tss_rcm_rate',
                        line: i
                    })) || 0;

                    var amount = parseFloat(transactionRecord.getSublistValue({
                        sublistId: sublistId,
                        fieldId: 'amount',
                        line: i
                    })) || 0;

                    var taxType = getTaxType(taxCode);

                    var taxAmt = (taxRate * amount) / 100;

                    if (taxType === 'GST') GSTamt += taxAmt;
                    if (taxType === 'IGST') IGSTamt += taxAmt;
                }
            }

            // -------------------------------------------------------------------
            // 4. Add CGST/SGST Lines
            // -------------------------------------------------------------------
            if (GSTamt > 0) {
                GSTamt *= exchRate;

                var half = parseFloat((GSTamt / 2).toFixed(2));
                var half2 = parseFloat((GSTamt - half).toFixed(2));

                // CGST
                addGL(globalParams.rcmCgstPay, globalParams.rcmCgstSale, Math.min(half, half2), "RCM CGST");

                // SGST
                addGL(globalParams.rcmSgstPay, globalParams.rcmSgstSale, Math.max(half, half2), "RCM SGST");
            }

            // -------------------------------------------------------------------
            // 5. Add IGST Lines
            // -------------------------------------------------------------------
            if (IGSTamt > 0) {
                IGSTamt *= exchRate;

                addGL(globalParams.rcmIgstPay, globalParams.rcmIgstSale, IGSTamt, "RCM IGST");
            }

            // -------------------------------------------------------------------
            // Helper: Add GL Lines
            // -------------------------------------------------------------------
            function addGL(debitAcct, creditAcct, amount, memo) {

                var isCredit = (recType === 'vendcred');
                log.debug("recType", recType);
                log.debug("isCredit", isCredit);

                // Purchase side
                var l1 = customLines.addNewLine();
                l1.accountId = parseInt(debitAcct);

                if (isCredit) l1.creditAmount = amount;
                else l1.debitAmount = amount;

                if (taxAgency) l1.entityId = parseInt(taxAgency);
                l1.memo = memo;

                // Sales side
                var l2 = customLines.addNewLine();
                l2.accountId = parseInt(creditAcct);

                if (isCredit) l2.debitAmount = amount;
                else l2.creditAmount = amount;

                if (taxAgency) l2.entityId = parseInt(taxAgency);
                l2.memo = memo;
            }

        } catch (e) {
            log.error("Error in customizeGlImpact", e);
        }
    }

    // -------------------------------------------------------------------
    // Load Global Parameters
    // -------------------------------------------------------------------
    function loadGlobalParameters() {
        var results = search.create({
            type: 'customrecord_tss_global_parameter',
            filters: [['isinactive', 'is', 'F']],
            columns: [
                'custrecord_tss_gp_subsidiary',
                'custrecord_tss_gp_rcm_cgst_sales',
                'custrecord_tss_gp_rcm_cgst_pay',
                'custrecord_tss_gp_rcm_sgst_sales',
                'custrecord_tss_gp_rcm_sgst_pay',
                'custrecord_tss_gp_rcm_igst_sales',
                'custrecord_tss_gp_rcm_igst_payables'
            ]
        }).run().getRange({ start: 0, end: 1 });

        if (!results || results.length === 0) return null;

        var r = results[0];

        return {
            subsidiaryIds: (r.getValue('custrecord_tss_gp_subsidiary') || "").split(","),
            rcmCgstSale: r.getValue('custrecord_tss_gp_rcm_cgst_sales'),
            rcmCgstPay: r.getValue('custrecord_tss_gp_rcm_cgst_pay'),
            rcmSgstSale: r.getValue('custrecord_tss_gp_rcm_sgst_sales'),
            rcmSgstPay: r.getValue('custrecord_tss_gp_rcm_sgst_pay'),
            rcmIgstSale: r.getValue('custrecord_tss_gp_rcm_igst_sales'),
            rcmIgstPay: r.getValue('custrecord_tss_gp_rcm_igst_payables')
        };
    }

    // -------------------------------------------------------------------
    // Identify Tax Type
    // -------------------------------------------------------------------
    function getTaxType(taxGroupId) {
        try {
            var t = record.load({ type: 'taxgroup', id: taxGroupId });
            var taxtype = t.getSublistText({ sublistId: 'taxitem', fieldId: 'taxtype', line: 0 });

            if (taxtype === 'RCM IGST') return 'IGST';
            if (['RCM GST', 'RCM SGST', 'RCM CGST'].indexOf(taxtype) !== -1) return 'GST';

            return taxtype;
        }
        catch (e) {
            // Fallback suitelet call (converted to SS2.x)
            var slUrl = url.resolveScript({
                scriptId: 'customscript_sut_tss_tax_group_data',
                deploymentId: 'customdeploy1',
                params: {
                    operationType: 'getTaxType',
                    taxcode: taxGroupId
                }
            });

            var resp = https.get({ url: slUrl });
            return resp.body || 'GST';
        }
    }

    // -------------------------------------------------------------------
    // Get Tax Agency Vendor (Custom Record First → Vendor Fallback)
    // -------------------------------------------------------------------
    function getTaxAgencyVendor(subsidiary) {
        try {
            // ---------------------------------------------------------------
            // 1. Try fetching vendor from custom record mapping
            // ---------------------------------------------------------------
            try {
                var customTaxAgency = search.create({
                    type: 'customrecord_tss_ta_subsidiary_tax_agenc',
                    filters: [
                        ['custrecord_tss_ta_subsidiary', 'anyof', subsidiary],
                        'AND',
                        ['isinactive', 'is', 'F']
                    ],
                    columns: ['custrecord_tss_ta_tax_agency_id']
                }).run().getRange({ start: 0, end: 1 });

                if (customTaxAgency && customTaxAgency.length > 0) {
                    var mappedVendor = customTaxAgency[0].getValue('custrecord_tss_ta_tax_agency_id');
                    if (mappedVendor) {
                        return mappedVendor; // Return custom record vendor
                    }
                }
            }
            catch (err) {
                log.error("Error in getTaxAgencyVendor in try", err);
                if (err.name == 'INVALID_RCRD_TYPE') {
                    // ---------------------------------------------------------------
                    // 2. Fallback → Standard Vendor Search (category = 3)
                    // ---------------------------------------------------------------
                    var vendorRes = search.create({
                        type: 'vendor',
                        filters: [
                            ['subsidiary', 'anyof', subsidiary],
                            'AND',
                            ['category', 'anyof', 3]
                        ],
                        columns: ['internalid']
                    }).run().getRange({ start: 0, end: 1 });

                    return (vendorRes && vendorRes[0]) ? vendorRes[0].getValue('internalid') : null;
                }
            }

        } catch (e) {
            log.error("Error in getTaxAgencyVendor()", e);
            return null;
        }
    }


    function isTrue(v) {
        return (v === true || v === 'T' || v === 'true');
    }

    return {
        customizeGlImpact: customizeGlImpact
    };

});
