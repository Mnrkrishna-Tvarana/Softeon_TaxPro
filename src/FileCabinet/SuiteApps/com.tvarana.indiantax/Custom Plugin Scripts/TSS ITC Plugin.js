/**
 * @NApiVersion 2.1
 * @NScriptType CustomGLPlugin
 */

/**
 * Script Type          : Custom GL Lines Plug-in
 * Script Name          : TSS ITC Plugin
 * Script Version       : 2.1
 * Suite Script Version : 2.1
 * Author               : MNR Krishna
 * Start Date           : 11-12-2025
 * Description          : This Script will add custom GL lines on Vendor Bill and Vendor Credit for ITC Ineligible Lines. 
 * 
 * Version      Name              Date       	        Notes
 * 1.0          MNR Krishna       20-05-2023           Initial version
 * 2.0          MNR Krishna       11-12-2025           Converted plugin version into 2.1 from 1.0 version
 */

define(['N/log', 'N/search', 'N/record', 'N/url', 'N/https', '/SuiteApps/com.tvarana.indiantax/Other Files/TSS TaxPro Server Helper'], function (log, search, record, url, https, serverHelper) {

    function customizeGlImpact(context) {
        try {
            // Always first line — checks subscription
            if (!serverHelper.checkSubscription()) {
                log.debug("TaxPro ITC Plugin", "Subscription check failed - blocking execution");
                return true;
            }
            const transactionRecord = context.transactionRecord;
            const standardLines = context.standardLines;
            const customLines = context.customLines;
            var recType = transactionRecord.getValue({ fieldId: 'type' });

            let taxLookupMap = {};
            let debitMap = {};

            let GSTamt = 0;
            let RCM_IGSTamt = 0;
            let RCM_GSTamt = 0;
            let IGSTamt = 0;

            let IGSTact = '';
            let CGSTact = '';
            let SGSTact = '';

            let TaxAgency;
            let global_Subsid;

            let RCMcgstSale;
            let RCMcgstPurchase;
            let RCMsgstSale;
            let RCMsgstPurchase;
            let RCMigstSale;
            let RCMigstPurchase;

            // -------------------------------------------------------------
            // Load GLOBAL PARAMETERS (Converted from nlapiSearchRecord)
            // -------------------------------------------------------------
            let gpSearch = search.create({
                type: 'customrecord_tss_global_parameter',
                filters: [['isinactive', 'is', 'F']],
                columns: [
                    'custrecord_tss_gp_subsidiary',
                    'custrecord_tss_gp_igst_purchase',
                    'custrecord_tss_gp_sgst_purchase',
                    'custrecord_tss_gp_cgst_purchase',
                    'custrecord_tss_gp_rcm_sgst_sales',
                    'custrecord_tss_gp_rcm_cgst_sales',
                    'custrecord_tss_gp_rcm_sgst_pay',
                    'custrecord_tss_gp_rcm_cgst_pay',
                    'custrecord_tss_gp_rcm_igst_sales',
                    'custrecord_tss_gp_rcm_igst_payables'
                ]
            }).run().getRange({ start: 0, end: 1 });

            if (gpSearch && gpSearch.length > 0) {
                let r = gpSearch[0];
                global_Subsid = r.getValue('custrecord_tss_gp_subsidiary');
                CGSTact = r.getValue('custrecord_tss_gp_cgst_purchase');
                SGSTact = r.getValue('custrecord_tss_gp_sgst_purchase');
                IGSTact = r.getValue('custrecord_tss_gp_igst_purchase');

                RCMcgstSale = r.getValue('custrecord_tss_gp_rcm_cgst_sales');
                RCMcgstPurchase = r.getValue('custrecord_tss_gp_rcm_cgst_pay');
                RCMsgstSale = r.getValue('custrecord_tss_gp_rcm_sgst_sales');
                RCMsgstPurchase = r.getValue('custrecord_tss_gp_rcm_sgst_pay');
                RCMigstSale = r.getValue('custrecord_tss_gp_rcm_igst_sales');
                RCMigstPurchase = r.getValue('custrecord_tss_gp_rcm_igst_payables');
            }

            let Rec_Sub = transactionRecord.getValue({ fieldId: 'subsidiary' });
            let Flag = inArray(Rec_Sub, global_Subsid);
            log.debug("Flag", Flag)
            if (Flag !== 1) return;

            let Rec_exchRate = parseFloat(transactionRecord.getValue({ fieldId: 'exchangerate' })) || 1;

            // -------------------------------------------------------------
            // TAX AGENCY SEARCH (Converted)
            // -------------------------------------------------------------
            var taxAgency = getTaxAgencyVendor(Rec_Sub);
            log.debug("Tax Agency", taxAgency);

            // -------------------------------------------------------------
            // LOAD TAX MAP (converted from salestaxitem search)
            // -------------------------------------------------------------
            try {
                let taxItemSearch = search.create({
                    type: 'salestaxitem',
                    filters: [
                        ['isinactive', 'is', 'F'],
                        'AND',
                        ['country', 'anyof', 'IN']
                    ],
                    columns: [
                        'taxtype',
                        'purchaseaccount',
                        'taxgroup'
                    ]
                }).run().getRange({ start: 0, end: 1000 });

                taxItemSearch.forEach(r => {
                    let taxType = r.getText('taxtype');
                    let accountId = r.getValue('purchaseaccount');
                    let taxGroup = r.getValue('taxgroup');

                    taxLookupMap[taxGroup] = {};

                    if (taxType === 'SGST' || taxType === 'CGST') {
                        taxLookupMap[taxGroup]['taxtype'] = 'GST';
                        if (taxType === 'SGST') taxLookupMap[taxGroup]['SGST'] = accountId;
                        else taxLookupMap[taxGroup]['CGST'] = accountId;
                    }
                    else if (taxType === 'IGST') {
                        taxLookupMap[taxGroup]['taxtype'] = 'IGST';
                        taxLookupMap[taxGroup]['IGST'] = accountId;
                    }
                    else if (taxType === 'RCM SGST' || taxType === 'RCM CGST') {
                        taxLookupMap[taxGroup]['taxtype'] = 'RCM GST';
                        if (taxType === 'RCM SGST') taxLookupMap[taxGroup]['RCM SGST'] = accountId;
                        else taxLookupMap[taxGroup]['RCM CGST'] = accountId;
                    }
                    else if (taxType === 'RCM IGST') {
                        taxLookupMap[taxGroup]['taxtype'] = 'RCM IGST';
                        taxLookupMap[taxGroup]['RCM IGST'] = accountId;
                    }
                });

            } catch (err) {
                // SUITELET FALLBACK
                let slUrl = url.resolveScript({
                    scriptId: 'customscript_sut_tss_salestaxitem_search',
                    deploymentId: 'customdeploy1'
                });

                let resp = https.get({ url: slUrl });
                let taxResults = JSON.parse(resp.body || '[]');

                taxResults.forEach(tr => {
                    let taxGroup = tr.values.taxgroup[0].value;
                    let taxType = tr.values.taxtype[0].text;
                    let accountId = tr.values.purchaseaccount[0].value;

                    taxLookupMap[taxGroup] = {};

                    if (taxType === 'SGST' || taxType === 'CGST') {
                        taxLookupMap[taxGroup]['taxtype'] = 'GST';
                        if (taxType === 'SGST') taxLookupMap[taxGroup]['SGST'] = accountId;
                        else taxLookupMap[taxGroup]['CGST'] = accountId;
                    }
                    else if (taxType === 'IGST') {
                        taxLookupMap[taxGroup]['taxtype'] = 'IGST';
                        taxLookupMap[taxGroup]['IGST'] = accountId;
                    }
                    else if (taxType === 'RCM SGST' || taxType === 'RCM CGST') {
                        taxLookupMap[taxGroup]['taxtype'] = 'RCM GST';
                        if (taxType === 'RCM SGST') taxLookupMap[taxGroup]['RCM SGST'] = accountId;
                        else taxLookupMap[taxGroup]['RCM CGST'] = accountId;
                    }
                    else if (taxType === 'RCM IGST') {
                        taxLookupMap[taxGroup]['taxtype'] = 'RCM IGST';
                        taxLookupMap[taxGroup]['RCM IGST'] = accountId;
                    }
                });
            }

            // -------------------------------------------------------------------
            // Utility to group amounts
            // -------------------------------------------------------------------
            function groupByAccount(accountId, amount) {
                if (!debitMap[accountId]) debitMap[accountId] = 0;
                debitMap[accountId] += parseFloat(amount || 0);
            }

            // -------------------------------------------------------------------
            // HEADER LEVEL DIMENSIONS
            // -------------------------------------------------------------------
            let headerLocation = transactionRecord.getValue({ fieldId: 'location' });
            let headerDepartment = transactionRecord.getValue({ fieldId: 'department' });
            let headerClass = transactionRecord.getValue({ fieldId: 'class' });

            // -------------------------------------------------------------------
            // ITEM LINES
            // -------------------------------------------------------------------
            let itemCount = transactionRecord.getLineCount({ sublistId: 'item' });
            // log.debug("itemCount", itemCount)
            for (let i = 0; i < itemCount; i++) {

                let isIneligible = transactionRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_itc_ineligible',
                    line: i
                });
                // log.debug("isIneligible", isIneligible)
                if (!isTrue(isIneligible)) continue;

                let isRCM = transactionRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_rcm_apply',
                    line: i
                });

                if (isTrue(isRCM)) {
                    let itemId = transactionRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                    let taxCode = transactionRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_tss_rcm_tax_code', line: i });
                    let baseAmount = parseFloat(transactionRecord.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i })) || 0;
                    let rcmRate = parseFloat(transactionRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_tss_rcm_rate', line: i })) || 0;

                    let amount = ((rcmRate * baseAmount) / 100).toFixed(2);
                    log.debug("ITC Ineligible for RCM Line - " + i, amount)
                    if (taxLookupMap[taxCode]) {
                        let itemExpenseAcct = search.lookupFields({
                            type: 'item',
                            id: itemId,
                            columns: ['expenseaccount']
                        }).expenseaccount[0].value;

                        groupByAccount(itemExpenseAcct, amount);

                        if (taxLookupMap[taxCode]['taxtype'] === 'RCM GST') RCM_GSTamt += parseFloat(amount);
                        else RCM_IGSTamt += parseFloat(amount);
                    }
                }
                else {
                    let itemId = transactionRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                    let taxCode = transactionRecord.getSublistValue({ sublistId: 'item', fieldId: 'taxcode', line: i });
                    let amount = parseFloat(transactionRecord.getSublistValue({ sublistId: 'item', fieldId: 'tax1amt', line: i })) || 0;
                    log.debug("ITC Ineligible for Item Line - " + i, amount)
                    if (taxLookupMap[taxCode]) {

                        let itemExpenseAcct = search.lookupFields({
                            type: 'item',
                            id: itemId,
                            columns: ['expenseaccount']
                        }).expenseaccount[0].value;

                        groupByAccount(itemExpenseAcct, amount);

                        if (taxLookupMap[taxCode]['taxtype'] === 'GST') GSTamt += amount;
                        else IGSTamt += amount;
                    }
                }
            }

            // -------------------------------------------------------------------
            // EXPENSE LINES
            // -------------------------------------------------------------------
            let expCount = transactionRecord.getLineCount({ sublistId: 'expense' });

            for (let i = 0; i < expCount; i++) {

                let isIneligible = transactionRecord.getSublistValue({
                    sublistId: 'expense',
                    fieldId: 'custcol_tss_itc_ineligible',
                    line: i
                });

                if (!isTrue(isIneligible)) continue;

                let isRCM = transactionRecord.getSublistValue({
                    sublistId: 'expense',
                    fieldId: 'custcol_tss_rcm_apply',
                    line: i
                });

                if (isTrue(isRCM)) {
                    let account = transactionRecord.getSublistValue({ sublistId: 'expense', fieldId: 'account', line: i });
                    let taxCode = transactionRecord.getSublistValue({ sublistId: 'expense', fieldId: 'custcol_tss_rcm_tax_code', line: i });
                    let baseAmount = parseFloat(transactionRecord.getSublistValue({ sublistId: 'expense', fieldId: 'amount', line: i })) || 0;
                    let rcmRate = parseFloat(transactionRecord.getSublistValue({ sublistId: 'expense', fieldId: 'custcol_tss_rcm_rate', line: i })) || 0;

                    let amount = ((rcmRate * baseAmount) / 100).toFixed(2);
                    log.debug("ITC Ineligible for RCM ExpLine - " + i, amount)
                    if (taxLookupMap[taxCode]) {
                        groupByAccount(account, amount);
                        if (taxLookupMap[taxCode]['taxtype'] === 'RCM GST') RCM_GSTamt += parseFloat(amount);
                        else RCM_IGSTamt += parseFloat(amount);
                    }
                }
                else {
                    let account = transactionRecord.getSublistValue({ sublistId: 'expense', fieldId: 'account', line: i });
                    let taxCode = transactionRecord.getSublistValue({ sublistId: 'expense', fieldId: 'taxcode', line: i });
                    let amount = parseFloat(transactionRecord.getSublistValue({ sublistId: 'expense', fieldId: 'tax1amt', line: i })) || 0;
                    log.debug("ITC Ineligible for Expense Line - " + i, amount)
                    if (taxLookupMap[taxCode]) {
                        groupByAccount(account, amount);
                        if (taxLookupMap[taxCode]['taxtype'] === 'GST') GSTamt += amount;
                        else IGSTamt += amount;
                    }
                }
            }

            // Convert to base currency
            GSTamt *= Rec_exchRate;
            IGSTamt *= Rec_exchRate;
            RCM_GSTamt *= Rec_exchRate;
            RCM_IGSTamt *= Rec_exchRate;

            log.debug("GSTamt - IGSTamt - RCM_GSTamt - RCM_IGSTamt", GSTamt + ' - ' + IGSTamt + ' - ' + RCM_GSTamt + ' - ' + RCM_IGSTamt)
            log.debug("taxLookupMap", JSON.stringify(taxLookupMap))

            // -------------------------------------------------------------------
            // CREATE GL LINES EXACTLY LIKE 1.0 SCRIPT (no behaviour change)
            // -------------------------------------------------------------------

            // IGST
            if (IGSTamt > 0 && IGSTact) {
                var isCredit = (recType === 'vendbill');
                let line = customLines.addNewLine();
                line.accountId = parseInt(IGSTact);
                if (isCredit) line.creditAmount = IGSTamt;
                else line.debitAmount = IGSTamt;
                line.memo = 'VAT';

                if (TaxAgency) line.entityId = parseInt(TaxAgency);
                if (headerLocation) line.locationId = parseInt(headerLocation);
                if (headerDepartment) line.departmentId = parseInt(headerDepartment);
                if (headerClass) line.classId = parseInt(headerClass);
            }

            // GST split
            let CgstAmt = 0;
            let SgstAmt = 0;
            if (GSTamt > 0) {
                let half = parseFloat((GSTamt / 2).toFixed(2));
                CgstAmt = Math.min(half, GSTamt - half);
                SgstAmt = Math.max(half, GSTamt - half);
            }

            if (GSTamt > 0 && CGSTact) {
                var isCredit = (recType === 'vendbill');
                let line = customLines.addNewLine();
                line.accountId = parseInt(CGSTact);
                if (isCredit) line.creditAmount = CgstAmt;
                else line.debitAmount = CgstAmt;
                line.memo = 'VAT';

                if (TaxAgency) line.entityId = parseInt(TaxAgency);
                if (headerLocation) line.locationId = parseInt(headerLocation);
                if (headerDepartment) line.departmentId = parseInt(headerDepartment);
                if (headerClass) line.classId = parseInt(headerClass);
            }

            if (GSTamt > 0 && SGSTact) {
                var isCredit = (recType === 'vendbill');
                let line = customLines.addNewLine();
                line.accountId = parseInt(SGSTact);
                if (isCredit) line.creditAmount = SgstAmt;
                else line.debitAmount = SgstAmt;
                line.memo = 'VAT';

                if (TaxAgency) line.entityId = parseInt(TaxAgency);
                if (headerLocation) line.locationId = parseInt(headerLocation);
                if (headerDepartment) line.departmentId = parseInt(headerDepartment);
                if (headerClass) line.classId = parseInt(headerClass);
            }

            // RCM IGST
            if (RCM_IGSTamt > 0 && RCMigstPurchase) {
                var isCredit = (recType === 'vendbill');
                let line = customLines.addNewLine();
                line.accountId = parseInt(RCMigstPurchase);
                if (isCredit) line.creditAmount = RCM_IGSTamt;
                else line.debitAmount = RCM_IGSTamt;
                line.memo = 'VAT';

                if (TaxAgency) line.entityId = parseInt(TaxAgency);
                if (headerLocation) line.locationId = parseInt(headerLocation);
                if (headerDepartment) line.departmentId = parseInt(headerDepartment);
                if (headerClass) line.classId = parseInt(headerClass);
            }

            // RCM GST split
            let RcmCgstAmt = 0;
            let RcmSgstAmt = 0;

            if (RCM_GSTamt > 0) {
                let half = parseFloat((RCM_GSTamt / 2).toFixed(2));
                RcmCgstAmt = Math.min(half, RCM_GSTamt - half);
                RcmSgstAmt = Math.max(half, RCM_GSTamt - half);
            }

            if (RCM_GSTamt > 0 && RCMcgstPurchase) {
                var isCredit = (recType === 'vendbill');
                let line = customLines.addNewLine();
                line.accountId = parseInt(RCMcgstPurchase);
                if (isCredit) line.creditAmount = RcmCgstAmt;
                else line.debitAmount = RcmCgstAmt;
                line.memo = 'VAT';

                if (TaxAgency) line.entityId = parseInt(TaxAgency);
                if (headerLocation) line.locationId = parseInt(headerLocation);
                if (headerDepartment) line.departmentId = parseInt(headerDepartment);
                if (headerClass) line.classId = parseInt(headerClass);
            }

            if (RCM_GSTamt > 0 && RCMsgstPurchase) {
                var isCredit = (recType === 'vendbill');
                let line = customLines.addNewLine();
                line.accountId = parseInt(RCMsgstPurchase);
                if (isCredit) line.creditAmount = RcmSgstAmt;
                else line.debitAmount = RcmSgstAmt;
                line.memo = 'VAT';

                if (TaxAgency) line.entityId = parseInt(TaxAgency);
                if (headerLocation) line.locationId = parseInt(headerLocation);
                if (headerDepartment) line.departmentId = parseInt(headerDepartment);
                if (headerClass) line.classId = parseInt(headerClass);
            }

            // -------------------------------------------------------------------
            // ADD grouped ineligible DEBIT lines 
            // -------------------------------------------------------------------
            for (let acctId in debitMap) {
                var isDebit = (recType === 'vendbill');
                let amt = debitMap[acctId];
                if (amt > 0) {
                    let line = customLines.addNewLine();
                    line.accountId = parseInt(acctId);
                    if (isDebit) line.debitAmount = parseFloat((amt * Rec_exchRate).toFixed(2));
                    else line.creditAmount = parseFloat((amt * Rec_exchRate).toFixed(2));
                    line.memo = 'ITC Ineligible';

                    if (headerLocation) line.locationId = parseInt(headerLocation);
                    if (headerDepartment) line.departmentId = parseInt(headerDepartment);
                    if (headerClass) line.classId = parseInt(headerClass);
                }
            }

        } catch (e) {
            log.error("Failed in TSS ITC Plugin", e);
        }
    }

    // -------------------------------------------------------------------
    // Helper: inArray 
    // -------------------------------------------------------------------
    function inArray(needle, haystack) {
        if (haystack && typeof haystack === 'string') {
            let arr = haystack.split(',');
            return arr.includes(needle) ? 1 : 0;
        }
        return 0;
    }

    function isTrue(v) {
        return (v === true || v === 'T' || v === 'true');
    }

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

    return {
        customizeGlImpact: customizeGlImpact
    };
});
