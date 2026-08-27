/**
 * Script Name               : TSS UE TCS On Sales
 * Script Author             : Gayathri Sai Priya
 * Script Type               : User Event Script
 * Script Version            : 2.1
 * Script Created date       : 2/13/2026 
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  
 */

/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search'], (record, search) => {

    function beforeSubmit(context) {
        try {
            const newRecord = context.newRecord;
            log.debug('is sub condition', isSubsidiaryMatch(newRecord));

            if (!isSubsidiaryMatch(newRecord)) return;

            const customerId = newRecord.getValue({ fieldId: 'entity' });
            if (!_logValidation(customerId)) return;


            const finalLineCount = newRecord.getLineCount({ sublistId: 'item' });
            const tcsValidationErrors = [];

            for (let i = 0; i < finalLineCount; i++) {
                const isTCSLine = newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_it_tcs_line',
                    line: i
                });

                if (!isTCSLine) continue;

                const tdsType = newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_itb_tcs_section',
                    line: i
                });

                const tdsPercentage = newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_itb_tcs_rate',
                    line: i
                });

                const tdsBaseAmt = newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_itb_tcs_base_amount',
                    line: i
                });

                const refId = newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_it_tcs_refid',
                    line: i
                });

                const missingFields = [];
                if (!_logValidation(tdsType)) missingFields.push("TCS Section");
                if (!_logValidation(tdsPercentage)) missingFields.push("TCS Percentage");
                if (!_logValidation(tdsBaseAmt)) missingFields.push("TCS Base Amount");
                if (!_logValidation(refId)) missingFields.push("TCS Reference ID");

                if (missingFields.length > 0) {
                    tcsValidationErrors.push(
                        "Item Line " + (i + 1) + " (TCS Line) missing:\n• " + missingFields.join("\n• ")
                    );
                }
            }

            if (tcsValidationErrors.length > 0) {
                throw {
                    name: 'TCS_VALIDATION_ERROR',
                    message: 'TCS validation failed:\n\n' + tcsValidationErrors.join('\n\n')
                };
            }

            // Customer lookup - PAN availability and number
            const customerLookup = search.lookupFields({
                type: search.Type.CUSTOMER,
                id: customerId,
                columns: [
                    'custentity_tss_it_cust_pan_avlbl',
                    'custentity_tss_it_cust_pannum'
                ]
            });

            const panAvailable = customerLookup.custentity_tss_it_cust_pan_avlbl;
            const panNumber = customerLookup.custentity_tss_it_cust_pannum;
            const usePanRate = panAvailable && _logValidation(panNumber);

            log.debug('Customer PAN Info', { panAvailable, panNumber, usePanRate });

            const lineCount = newRecord.getLineCount({ sublistId: 'item' });
            log.debug('lineCount', lineCount);

            // Checking body-level override
            const bodyOverride = newRecord.getValue({ fieldId: 'custbody_tss_it_tcs_override' });
            log.debug('Body Override', bodyOverride);

            // Track line numbers covered by overridden TCS lines
            const overriddenLineNumbers = new Set();


            // Remove existing TCS lines (except overridden ones)
            log.debug('Processing existing TCS lines');
            for (let i = lineCount - 1; i >= 0; i--) {
                const isTCSLine = newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_it_tcs_line',
                    line: i
                });

                if (isTCSLine) {
                    // Check if this TCS line has override
                    const lineOverride = newRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_tss_it_tcs_override_line',
                        line: i
                    });

                    if (bodyOverride && lineOverride) {
                        // Keep this TCS line - track which main lines it covers
                        const refId = newRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_tss_it_tcs_refid',
                            line: i
                        });

                        if (_logValidation(refId)) {
                            const refLines = refId.split(',');
                            refLines.forEach(function (lineNum) {
                                overriddenLineNumbers.add(parseInt(lineNum.trim(), 10));
                            });
                        }

                        log.debug('Keeping overridden TCS line at position ' + i, { refId: refId });
                    } else {
                        // Remove non-overridden TCS line
                        newRecord.removeLine({ sublistId: 'item', line: i });
                        log.debug('Removed TCS line at position', i);
                    }
                }
            }

            log.debug('Line numbers covered by overridden TCS lines', Array.from(overriddenLineNumbers));


            // Get updated line count after removal
            const updatedLineCount = newRecord.getLineCount({ sublistId: 'item' });
            log.debug('Updated lineCount after TCS removal', updatedLineCount);

            // Extract data from overridden TCS lines to include in JSON

            const overriddenTCSData = {};
            for (let i = 0; i < updatedLineCount; i++) {
                const isTCSLine = newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_it_tcs_line',
                    line: i
                });

                if (isTCSLine) {
                    const lineOverride = newRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_tss_it_tcs_override_line',
                        line: i
                    });

                    if (bodyOverride && lineOverride) {
                        // Get reference line numbers to find the main item
                        const refId = newRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_tss_it_tcs_refid',
                            line: i
                        });

                        // Get relation type from the FIRST referenced main item line
                        let relTypeId = null;
                        if (_logValidation(refId)) {
                            const refLines = refId.split(',');
                            const firstRefLine = parseInt(refLines[0].trim(), 10) - 1; // Convert to 0-based index

                            if (firstRefLine >= 0 && firstRefLine < updatedLineCount) {
                                relTypeId = newRecord.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_tss_itb_tcs_relation_type',
                                    line: firstRefLine
                                });
                            }
                        }

                        const itemId = newRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: i
                        });
                        const baseAmt = parseFloat(newRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_tss_itb_tcs_base_amount',
                            line: i
                        })) || 0;
                        const taxAmt = parseFloat(newRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'amount',
                            line: i
                        })) || 0;

                        if (_logValidation(relTypeId)) {
                            const refLines = _logValidation(refId) ? refId.split(',').map(function (n) { return parseInt(n.trim(), 10); }) : [];

                            overriddenTCSData[relTypeId] = {
                                item: itemId,
                                total: baseAmt,
                                tax_amount: taxAmt,
                                lineNumbers: refLines
                            };

                            log.debug('Extracted overridden TCS data for relation type ' + relTypeId, overriddenTCSData[relTypeId]);
                        }
                    }
                }
            }


            // Step 1: Group lines by relationTypeId - track line numbers and accumulate totals
            const relationTypeMap = {};

            for (let i = 0; i < updatedLineCount; i++) {
                // Skip if this line is already a TCS tax line
                const isTCSLine = newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_it_tcs_line',
                    line: i
                });
                if (isTCSLine) continue;

                const relationTypeId = newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tss_itb_tcs_relation_type',
                    line: i
                });

                log.debug('relationTypeId at line ' + i, relationTypeId);

                if (!_logValidation(relationTypeId)) continue;

                // Skip if this line is covered by an overridden TCS line
                if (overriddenLineNumbers.has(i + 1)) {
                    log.debug('Skipping line ' + (i + 1), 'Covered by overridden TCS line');
                    continue;
                }

                const lineAmount = parseFloat(newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'amount',
                    line: i
                })) || 0;




                // Get gross amount (amount + tax)
                const grossAmount = parseFloat(newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'grossamt',
                    line: i
                })) || lineAmount; // Fallback to lineAmount if grossamt not available

                if (!relationTypeMap[relationTypeId]) {
                    relationTypeMap[relationTypeId] = {
                        baseTotal: 0,
                        grossTotal: 0,
                        lineNumbers: []
                    };
                }

                relationTypeMap[relationTypeId].baseTotal = parseFloat(
                    (relationTypeMap[relationTypeId].baseTotal + lineAmount).toFixed(2)
                );
                relationTypeMap[relationTypeId].grossTotal = parseFloat(
                    (relationTypeMap[relationTypeId].grossTotal + grossAmount).toFixed(2)
                );
                relationTypeMap[relationTypeId].lineNumbers.push(i + 1);

                // if (!relationTypeMap[relationTypeId]) {
                //     relationTypeMap[relationTypeId] = {
                //         total: 0,
                //         lineNumbers: []
                //     };
                // }

                // relationTypeMap[relationTypeId].total = parseFloat(
                //     (relationTypeMap[relationTypeId].total + lineAmount).toFixed(2)
                // );
                // relationTypeMap[relationTypeId].lineNumbers.push(i + 1); // Line numbers are 1-based for display
            }

            log.debug('relationTypeMap after grouping', JSON.stringify(relationTypeMap));

            if (Object.keys(relationTypeMap).length === 0) {
                log.debug('beforeSubmit', 'No TCS applicable lines found');
                return;
            }

            // For each relation type, lookup master and calculate tax
            const tcsLineData = {};

            for (const relationTypeId in relationTypeMap) {

                const tcsMasterLookup = search.lookupFields({
                    type: 'customrecord_tss_its_tcsmaster',
                    id: relationTypeId,
                    columns: [
                        'custrecord_tss_tcs_retrospective',
                        'custrecord_tvr_tcsmaster_rate',
                        'custrecord_tvr_tcsmaster_pan_aadhar',
                        'custrecord_tvr_tcsamount_threshold_amt',
                        'custrecord_tss_it_tcsmaster_item',
                        'custrecord_tss_it_tcs_rounding_method',
                        'custrecord_tss_it_tcs_calculate'
                    ]
                });

                log.debug('tcsMasterLookup for ' + relationTypeId, JSON.stringify(tcsMasterLookup));

                const isRetrospective = tcsMasterLookup.custrecord_tss_tcs_retrospective;

                // Determine rate based on PAN
                const tcsRate = usePanRate
                    ? parseFloat(tcsMasterLookup.custrecord_tvr_tcsmaster_rate) || 0
                    : parseFloat(tcsMasterLookup.custrecord_tvr_tcsmaster_pan_aadhar) || 0;

                const custrecord_tss_it_tcsmaster_itemValue = Array.isArray(tcsMasterLookup.custrecord_tss_it_tcsmaster_item)
                    ? (tcsMasterLookup.custrecord_tss_it_tcsmaster_item[0] && tcsMasterLookup.custrecord_tss_it_tcsmaster_item[0].value) || ''
                    : tcsMasterLookup.custrecord_tss_it_tcsmaster_item || '';

                // const totalAmount = relationTypeMap[relationTypeId].total;
                // let taxAmount = 0;
                // let taxableAmount = 0;

                // if (!isRetrospective) {


                // Get calculation method and rounding method
                // Get calculation method with default
                let calculateMethod = Array.isArray(tcsMasterLookup.custrecord_tss_it_tcs_calculate) && tcsMasterLookup.custrecord_tss_it_tcs_calculate.length > 0
                    ? tcsMasterLookup.custrecord_tss_it_tcs_calculate[0].text
                    : tcsMasterLookup.custrecord_tss_it_tcs_calculate;

                // Default to "Base" if empty
                if (!_logValidation(calculateMethod)) {
                    calculateMethod = 'Base';
                    log.debug('Calculate method empty, defaulting to Base');
                }

                // Get rounding method with default
                let roundingMethod = Array.isArray(tcsMasterLookup.custrecord_tss_it_tcs_rounding_method) && tcsMasterLookup.custrecord_tss_it_tcs_rounding_method.length > 0
                    ? tcsMasterLookup.custrecord_tss_it_tcs_rounding_method[0].text
                    : tcsMasterLookup.custrecord_tss_it_tcs_rounding_method;

                // Default to "No Rounding" if empty
                if (!_logValidation(roundingMethod)) {
                    roundingMethod = 'No Rounding';
                    log.debug('Rounding method empty, defaulting to No Rounding');
                }

                log.debug('Calculation Settings', { calculateMethod: calculateMethod, roundingMethod: roundingMethod });
                // Determine amount based on calculation method
                let totalAmount;

                if (calculateMethod === 'Gross') {
                    totalAmount = relationTypeMap[relationTypeId].grossTotal;
                    log.debug('Using Gross amount (including existing tax)', totalAmount);
                } else {
                    // Default is Base (line amount before tax)
                    totalAmount = relationTypeMap[relationTypeId].baseTotal;
                    log.debug('Using Base amount (before tax)', totalAmount);
                }


                let taxAmount = 0;
                let taxableAmount = 0;

                if (!isRetrospective) {





                    // Retrospective false → calculate tax on full total
                    taxableAmount = totalAmount;
                    taxAmount = parseFloat(((totalAmount * tcsRate) / 100).toFixed(2));

                    log.debug('Non-Retrospective TCS', { totalAmount, tcsRate, taxAmount });

                } else {
                    // Retrospective true → calculate tax only on amount exceeding threshold
                    const thresholdAmt = parseFloat(tcsMasterLookup.custrecord_tvr_tcsamount_threshold_amt) || 0;

                    // if (totalAmount > thresholdAmt) {
                    //     taxableAmount = parseFloat((totalAmount - thresholdAmt).toFixed(2));
                    //     taxAmount = parseFloat(((taxableAmount * tcsRate) / 100).toFixed(2));

                    //     log.debug('Retrospective TCS - exceeded threshold', {
                    //         totalAmount,
                    //         thresholdAmt,
                    //         taxableAmount,
                    //         tcsRate,
                    //         taxAmount
                    //     });
                    if (totalAmount > thresholdAmt) {
                        taxableAmount = parseFloat((totalAmount - thresholdAmt).toFixed(2));
                        taxAmount = parseFloat(((taxableAmount * tcsRate) / 100).toFixed(2));

                        // Apply rounding
                        taxAmount = roundTaxAmount(taxAmount, roundingMethod);

                        log.debug('Retrospective TCS - exceeded threshold', {
                            totalAmount,
                            thresholdAmt,
                            taxableAmount,
                            tcsRate,
                            taxAmount,
                            roundingMethod
                        });
                    } else {
                        log.debug('Retrospective TCS - below threshold, no tax', {
                            totalAmount,
                            thresholdAmt
                        });
                    }
                }

                tcsLineData[relationTypeId] = {
                    item: custrecord_tss_it_tcsmaster_itemValue,
                    total: totalAmount,
                    tax_amount: taxAmount,
                    tcs_rate: tcsRate,
                    lineNumbers: relationTypeMap[relationTypeId].lineNumbers
                };
            }

            log.debug('Final TCS Line Data', JSON.stringify(tcsLineData));

            // Merge overridden TCS data into tcsLineData
            for (const relTypeId in overriddenTCSData) {
                tcsLineData[relTypeId] = overriddenTCSData[relTypeId];
                log.debug('Added overridden data to JSON for relation type ' + relTypeId, overriddenTCSData[relTypeId]);
            }

            log.debug('Complete TCS Line Data (including overridden)', JSON.stringify(tcsLineData));

            // Step 3: Set the JSON to body field
            // if (Object.keys(tcsLineData).length > 0) {
            if (Object.keys(tcsLineData).length > 0 || Object.keys(overriddenTCSData).length > 0) {
                newRecord.setValue({
                    fieldId: 'custbody_tss_itb_tcs_line_data',
                    value: JSON.stringify(tcsLineData)
                });

                // Step 4: Read back from JSON field and add lines
                const savedJSON = newRecord.getValue({ fieldId: 'custbody_tss_itb_tcs_line_data' });
                log.debug('Reading saved JSON', savedJSON);

                if (_logValidation(savedJSON)) {
                    const parsedData = JSON.parse(savedJSON);
                    log.debug('Parsed JSON Data', JSON.stringify(parsedData));

                    for (const relationTypeId in parsedData) {
                        const data = parsedData[relationTypeId];

                        // Skip if no tax amount
                        if (data.tax_amount <= 0) {
                            log.debug('Skipping relation type ' + relationTypeId, 'No tax amount');
                            continue;
                        }
                        // Skip if this relation type is from an overridden TCS line (already exists on invoice)
                        if (overriddenTCSData.hasOwnProperty(relationTypeId)) {
                            log.debug('Skipping relation type ' + relationTypeId, 'Already exists as overridden TCS line');
                            continue;
                        }

                        // Get current line count
                        const currentLineCount = newRecord.getLineCount({ sublistId: 'item' });

                        // Insert new line at the end
                        newRecord.insertLine({
                            sublistId: 'item',
                            line: currentLineCount
                        });

                        // Set item
                        newRecord.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: currentLineCount,
                            value: data.item
                        });

                        // Set quantity (always 1 for tax lines)
                        newRecord.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            line: currentLineCount,
                            value: 1
                        });

                        // Set rate
                        newRecord.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate',
                            line: currentLineCount,
                            value: data.tax_amount
                        });

                        // Set base amount
                        newRecord.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_tss_itb_tcs_base_amount',
                            line: currentLineCount,
                            value: data.total
                        });

                        // Mark as TCS line
                        newRecord.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_tss_it_tcs_line',
                            line: currentLineCount,
                            value: true
                        });

                        // Set reference line numbers
                        newRecord.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_tss_it_tcs_refid',
                            line: currentLineCount,
                            value: data.lineNumbers.join(',')
                        });

                        newRecord.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_tss_itb_tcs_section',
                            line: currentLineCount,
                            value: relationTypeId
                        });

                        // Set TCS rate
                        newRecord.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_tss_itb_tcs_rate',
                            line: currentLineCount,
                            value: data.tcs_rate
                        });

                        // Department - if not present at line level, default from body level
                        const lineDepartment = newRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'department',
                            line: currentLineCount
                        });
                        if (!_logValidation(lineDepartment)) {
                            const bodyDepartment = newRecord.getValue({ fieldId: 'department' });
                            if (_logValidation(bodyDepartment)) {
                                newRecord.setSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'department',
                                    line: currentLineCount,
                                    value: bodyDepartment
                                });
                            }
                        }

                        // Class - if not present at line level, default from body level
                        const lineClass = newRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'class',
                            line: currentLineCount
                        });
                        if (!_logValidation(lineClass)) {
                            const bodyClass = newRecord.getValue({ fieldId: 'class' });
                            if (_logValidation(bodyClass)) {
                                newRecord.setSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'class',
                                    line: currentLineCount,
                                    value: bodyClass
                                });
                            }
                        }

                        // Location - if not present at line level, default from body level
                        const lineLocation = newRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'location',
                            line: currentLineCount
                        });
                        if (!_logValidation(lineLocation)) {
                            const bodyLocation = newRecord.getValue({ fieldId: 'location' });
                            if (_logValidation(bodyLocation)) {
                                newRecord.setSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'location',
                                    line: currentLineCount,
                                    value: bodyLocation
                                });
                            }
                        }

                        log.debug('Added TCS line at position ' + currentLineCount, {
                            item: data.item,
                            rate: data.tax_amount,
                            baseAmount: data.total,
                            refLines: data.lineNumbers.join(',')
                        });
                    }
                }
            }

        } catch (e) {
            if (e.name === 'TCS_VALIDATION_ERROR') {
                throw e.message;
            }
            log.error('beforeSubmit Error', e.message + ' | Stack: ' + e.stack);
        }
    }

    /* ---------- Helpers ---------- */
    function _logValidation(val) {
        return val !== '' && val !== null && val !== undefined && val !== false && val !== 'null';
    }

    function SearchGlobalParameter() {
        const filters = [search.createFilter({ name: 'isinactive', operator: 'is', values: 'F' })];
        const columns = [search.createColumn({ name: 'internalid' })];
        const result = search.create({
            type: 'customrecord_tss_global_parameter',
            filters,
            columns
        }).run().getRange(0, 100);

        if (_logValidation(result) && result.length > 0) {
            return result[0].getValue({ name: 'internalid' });
        }
        return null;
    }

    function inArray(needle, haystack) {
        if (_logValidation(haystack)) {
            if (typeof haystack === 'string') haystack = haystack.split(',');
            for (let i = 0; i < haystack.length; i++) {
                if (haystack[i] === needle) return 1;
            }
        }
        return 0;
    }

    function isSubsidiaryMatch(newRecord) {
        try {
            const GlobalRecId = SearchGlobalParameter();
            if (!_logValidation(GlobalRecId)) return false;

            const GlobalRec = record.load({ type: 'customrecord_tss_global_parameter', id: GlobalRecId });
            const g_subsidiary = GlobalRec.getValue('custrecord_tss_gp_subsidiary');
            const rec_subsidiary = newRecord.getValue({ fieldId: 'subsidiary' });

            log.debug('subsidiary details', { rec_subsidiary, g_subsidiary });
            log.debug('inArray result', inArray(rec_subsidiary, g_subsidiary));

            return inArray(rec_subsidiary, g_subsidiary) === 1;
        } catch (e) {
            log.error('isSubsidiaryMatch Error', e.message);
            return false;
        }
    }
    function roundTaxAmount(amount, roundingMethod) {
        if (!roundingMethod) return amount;

        // Get text value from array if needed
        const methodText = Array.isArray(roundingMethod) && roundingMethod.length > 0
            ? roundingMethod[0].text
            : roundingMethod;

        log.debug('Rounding Method', { amount: amount, method: methodText });

        switch (methodText) {
            case 'No Rounding':
                return amount;
            case 'Nearest to One':
                return Math.round(amount);
            case 'Nearest to Ten':
                return Math.round(amount / 10) * 10;
            case 'Nearest to Hundred':
                return Math.round(amount / 100) * 100;
            default:
                return amount;
        }
    }

    return { beforeSubmit };
});