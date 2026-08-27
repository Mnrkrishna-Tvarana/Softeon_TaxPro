/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
/**
 * Script Name               : SUT TSS Sales Tax Item Search
 * Script Author             : MNR Krishna
 * Script Type               : Suitelet Script
 * Script Version            : 2.1
 * Script Created date       : 19/06/2023
 * 
 * Script Last Modified Date : ----
 * Script Last Modified By   : ----
 * Script Comments           : ----
 * 
 * Script Description        :  suitelet sent Tax Code search data as response
 */


define(['N/search'],
    /**
 * @param{record} record
 */
    (search) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            try {
                //var l_result =new Array();

                //var s_expense = scriptContext.request.parameters.s_expense;
                //log.debug("s_expense",s_expense);

                var salestaxitemSearch = search.create({
                    type: 'salestaxitem',
                    title: 'Test Tax Codes1',
                    filters: [
                        search.createFilter({
                            name: 'isinactive',
                            operator: 'is',
                            values: 'F'
                        }),
                        search.createFilter({
                            name: 'country',
                            operator: 'anyof',
                            values: 'IN'
                        })
                    ],
                    // filters: [['isinactive', 'is', 'F'],
                    //     'AND',
                    // ['country', 'anyof', 'IN']
                    // ],
                    columns: [
                        search.createColumn({ name: 'name' }),
                        search.createColumn({ name: 'rate', }),
                        search.createColumn({ name: 'purchaseaccount' }),
                        search.createColumn({ name: 'saleaccount' }),
                        search.createColumn({ name: 'taxgroup' }),
                        search.createColumn({ name: 'taxtype', }),
                    ]
                });
                // log.debug(salestaxitemSearch.save())
                var salestaxitemSearch_results = salestaxitemSearch.run().getRange(0, 1000);
                log.debug("salestaxitemSearch_results.length", salestaxitemSearch_results.length);
                log.debug("salestaxitemSearch_results", salestaxitemSearch_results);
                scriptContext.response.write(JSON.stringify(salestaxitemSearch_results));


            }// end try
            catch (e) {
                log.error("Error in SUT TSS Sales Tax Item Search", e);
            }

        }


        // Custom functions are defined below....
        function _logValidation(value) {
            if (value != 'null' && value != null && value != null && value != '' && value != undefined && value != undefined && value != 'undefined' && value != 'undefined' && value != 'NaN' && value != NaN) {
                return true;
            }
            else {
                return false;
            }
        }
        // end custom functions

        return { onRequest }

    });
