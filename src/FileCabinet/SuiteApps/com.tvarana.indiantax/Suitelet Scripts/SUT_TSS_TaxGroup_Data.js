/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

/**
 * Script Name               : SUT TSS Tax Group Data
 * Script Author             : MNR Krishna
 * Script Type               : Suitelet Script
 * Script Version            : 2.1
 * Script Created date       : 28/08/2023
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  suitelet sent Tax Group data as response
 */

/** 
 * * Version      Name              Date          Notes
 * 1.0         MNR Krishna       28/08/2023       Initial version 
 * 
 */


define(['N/record', 'N/search'],
    /**
 * @param{record} record
 * @param{search} search
 */
    (record, search) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            try {
                var Taxcode = scriptContext.request.parameters.taxcode;
                log.debug("Taxcode", Taxcode);
                var operationType = scriptContext.request.parameters.operationType;
                log.debug("operationType", operationType);
                if (operationType == 'getTaxType') {
                    var taxtype;
                    var taxgrpobj = record.load({ type: 'taxgroup', id: Taxcode });
                    var taxnameType = taxgrpobj.getSublistValue({
                        sublistId: 'taxitem',
                        fieldId: 'taxtype',
                        line: 0
                    });
                    log.debug("Tax Type in first line", taxnameType);
                    if (taxnameType == 'IGST') {
                        taxtype = 'IGST'
                    }
                    else if (taxnameType == 'GST' || taxnameType == 'SGST' || taxnameType == 'CGST') {
                        taxtype = 'GST'
                    }
                    scriptContext.response.write(taxtype);
                }
                else if (operationType == 'taxRate') {
                    var TaxRate = 0;
                    var tax_obj = search.lookupFields({
                        type: 'taxgroup',
                        id: Taxcode,
                        columns: ['rate']
                    });
                    TaxRate = parseInt(tax_obj.rate);
                    scriptContext.response.write(JSON.stringify(TaxRate));
                }
                else if (operationType == 'taxRateType') {
                    var TaxRate = 0;
                    var tax_obj = search.lookupFields({
                        type: 'taxgroup',
                        id: Taxcode,
                        columns: ['rate', 'taxtype']
                    });
                    TaxRate = parseInt(tax_obj.rate);
                    var taxType = tax_obj.taxtype ? tax_obj.taxtype[0].text : '';
                    scriptContext.response.write(JSON.stringify({ TaxRate: TaxRate, TaxType: taxType }));
                }

                else if (operationType == 'typeoftax') {
                    var TaxObj = search.lookupFields({
                        type: 'salestaxitem',
                        id: Taxcode,
                        columns: ['taxtype']
                    });
                    if (Object.keys(TaxObj).length > 0) {
                    }
                    else {
                        var TaxObj = search.lookupFields({
                            type: 'taxgroup',
                            id: Taxcode,
                            columns: ['taxtype']
                        });
                    }

                    var TaxType = TaxObj.taxtype[0].text;
                    log.debug("TaxType in typeoftax", TaxType);
                    scriptContext.response.write(TaxType);
                }
                else {
                    var taxAccountarray = new Array();
                    if (_logValidation(Taxcode)) {
                        var taxgrpobj = record.load({ type: 'taxgroup', id: Taxcode });
                        var taxgrplineitemcount = taxgrpobj.getLineCount({ sublistId: 'taxitem' });
                        log.debug("taxgrplineitemcount in SUT TSS Tax Group Data", taxgrplineitemcount)
                        for (var j = 0; j < taxgrplineitemcount; j++) {
                            var taxname = taxgrpobj.getSublistValue({
                                sublistId: 'taxitem',
                                fieldId: 'taxname',
                                line: j
                            });
                            var i_Tax_Name = taxgrpobj.getSublistValue({
                                sublistId: 'taxitem',
                                fieldId: 'taxtype',
                                line: j
                            });
                            var rate = taxgrpobj.getSublistValue({
                                sublistId: 'taxitem',
                                fieldId: 'rate',
                                line: j
                            });
                            if (operationType == 'export') {
                                taxAccountarray[taxAccountarray.length] = i_Tax_Name;
                                taxAccountarray[taxAccountarray.length] = parseInt(rate);
                            }
                            else if (operationType == 'taxtype') {
                                taxAccountarray[taxAccountarray.length] = i_Tax_Name;
                            }
                            // if (_logValidation(taxname)) {

                            //     var taxcodeObj = search.lookupFields({
                            //         type: 'salestaxitem',
                            //         id: taxname,
                            //         columns: ['taxtype', 'rate']
                            //     });
                            //     if (taxcodeObj.taxtype.length > 0) {
                            //         var i_Tax_Name = taxcodeObj.taxtype[0].text;
                            //         var rate = taxcodeObj.rate;

                            //         if (operationType == 'export') {
                            //             taxAccountarray[taxAccountarray.length] = i_Tax_Name;
                            //             taxAccountarray[taxAccountarray.length] = parseInt(rate);
                            //         }
                            //         else if (operationType == 'taxtype') {
                            //             taxAccountarray[taxAccountarray.length] = i_Tax_Name;
                            //         }

                            //     }

                            // }
                        }
                    }
                    scriptContext.response.write(JSON.stringify(taxAccountarray));
                }

            }
            catch (e) {
                log.error("Error in SUT TSS Tax Group Data", e);
            }
        }

        function _logValidation(value) {
            if (value != 'null' && value != null && value != null && value != '' && value != undefined && value != undefined && value != 'undefined' && value != 'undefined' && value != 'NaN' && value != NaN) {
                return true;
            }
            else {
                return false;
            }
        }

        return { onRequest }

    });
