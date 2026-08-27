/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
/**
* Script Name          : SCH TSS TaxPro Daily Maintenance
* Author               : MNR Krishna 
* Start Date           : 01/08/2026
* Last Modified Date   : 
* Description          : 
*/
/************************** Global Variables *******************************/


/************************** Global Variables *******************************/
define(['N/log', 'N/runtime', 'N/https', 'N/config', 'N/email', 'N/search', 'N/record'],
   function (log, runtime, https, config, email, search, record) {
      /**
       * Definition of the Scheduled script trigger point.
       *
       * @param {Object} scriptContext
       * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
       * @Since 2015.2
       */
      function execute(scriptContext) {
         try {
            log.debug('@@@@@@@@ Script Start @@@@@@@'); //custscript2
            var company_pref = config.load({ type: config.Type.COMPANY_INFORMATION });
            var loggedUserId = -5;
            var urlhosting = 'https://api.tvarana.com/subscription/authorize';
            var product_name = 'Tvarana India Tax Pro';
            var product_code = 'Tvarana India Tax Bundle';
            var productKey = 'VesJElbBal6l3246tUNlN6oE6kuafd5F7m7dwRu9';
            // var keySize = runtime.getCurrentScript().getParameter({name: 'custscript_tss_product_key'}).split(',').length;
            var compid = company_pref.getValue('companyid');
            var companyid = compid.split('_')[0];
            var companyName = company_pref.getValue('companyname');
            log.debug('Prod Account', companyid)
            log.debug('Current Account', compid);


            var bodyData = JSON.stringify({ "accountID": companyid, "customer_name": companyName, "product_name": product_name, "product_code": product_code });
            log.debug("bodyData", bodyData)
            var response = https.post({
               url: urlhosting,
               body: bodyData,
               headers: {
                  "Content-Type": "application/json",
                  "x-api-Key": productKey
               }
            });
            var myresponse_body = JSON.parse(response.body);
            log.debug('myresponse_body', myresponse_body)
            if (myresponse_body.error != '' && myresponse_body.error != null) {
               //***************** Error Details *******************
               try {
                  //log.debug('Inside')
                  var confirmationSubject = "Subscription Error for " + product_name + " in:" + companyName + "<br>";
                  var confirmationBody = "";
                  confirmationBody += "Account Id: " + companyid + "<br>";
                  confirmationBody += "Error Detail: " + myresponse_body.error + "<br>";
                    var statusConfirm =  email.send({
                       author: loggedUserId,
                       recipients: 'appssubscriptionnotify@tvarana.com',
                       subject: confirmationSubject,
                       body: confirmationBody
                    });
                  log.debug('sent', confirmationBody)
               } catch (e) {
                  log.debug('Error', e)
               }
               //********************** END ***********************
               return false;
            } else {
               var now = new Date();
               var utcTimestamp = now.toISOString();
               log.debug("utcTimestamp", utcTimestamp)
               if (myresponse_body.subscription_deactivate) {
                  log.debug('The Account is De-Activate')
                  /***************Deactivated Section Code for SkyDoc****************/
                  var configsearch = search.create({
                     type: 'customrecord_tss_itb_runtime_config',
                     title: 'My TaxPro Configuration Page',
                     columns: null,
                     filters: [search.createFilter({
                        name: 'isinactive',
                        operator: 'is',
                        values: 'F'
                     })]
                  });
                  var configsearch = configsearch.run().getRange({
                     start: 0,
                     end: 10
                  });
                  if (configsearch != null && configsearch != '' && configsearch.length > 0) {
                     var recordIdVal = configsearch[0].id;
                     // var configRec = record.load({
                     //    type: 'customrecord_tss_itb_runtime_config',
                     //    id: recordIdVal,
                     //    isDynamic: true
                     // });
                     // configRec.setValue({ fieldId: 'custrecord_tss_itb_config', value: true });
                     // configRec.save();
                     var configRec = record.submitFields({
                        type: 'customrecord_tss_itb_runtime_config',
                        id: recordIdVal,
                        values: {
                           custrecord_tss_itb_config: true,
                           custrecord_tss_itb_config_run_at: utcTimestamp
                        },
                        options: {
                           enableSourcing: false,
                           ignoreMandatoryFields: true
                        }
                     });

                  } else {
                     var configRec = record.create({ type: 'customrecord_tss_itb_runtime_config', });
                     configRec.setValue({ fieldId: 'custrecord_tss_itb_config', value: true });
                     configRec.setValue({ fieldId: 'custrecord_tss_itb_config_run_at', value: utcTimestamp });
                     configRec.save({ enableSourcing: true });
                  }

                  var globalSearch = search.create({
                     type: 'customrecord_tss_global_parameter',
                     title: 'My TaxPro Global Preference Page',
                     columns: null,
                     filters: [search.createFilter({
                        name: 'isinactive',
                        operator: 'is',
                        values: 'F'
                     })]
                  });
                  var globalSearch = globalSearch.run().getRange({
                     start: 0,
                     end: 10
                  });
                  if (globalSearch != null && globalSearch != '' && globalSearch.length > 0) {
                     var g_recordIdVal = globalSearch[0].id;
                     var g_configRec = record.submitFields({
                        type: 'customrecord_tss_global_parameter',
                        id: g_recordIdVal,
                        values: {
                           custrecord_tss_gp_subscription_end: true
                        },
                        options: {
                           enableSourcing: false,
                           ignoreMandatoryFields: true
                        }
                     });
                  }
                  /*************** END of Deactivated Section Code for SkyDoc****************/
               } else {
                  log.debug('The Account is Activate');
                  /***************Activated Section Code for SkyDoc****************/
                  var configsearch = search.create({      // 
                     type: 'customrecord_tss_itb_runtime_config',
                     title: 'My TaxPro Configuration Page',
                     columns: null,
                     filters: [search.createFilter({
                        name: 'isinactive',
                        operator: 'is',
                        values: 'F'
                     })]
                  });
                  var configsearch = configsearch.run().getRange({
                     start: 0,
                     end: 10
                  });
                  if (configsearch != null && configsearch != '' && configsearch.length > 0) {
                     var recordIdVal = configsearch[0].id;
                     // var configRec = record.load({
                     //    type: 'customrecord_tss_itb_runtime_config',
                     //    id: recordIdVal,
                     //    isDynamic: true
                     // });
                     // configRec.setValue({ fieldId: 'custrecord_tss_itb_config', value: false });
                     // configRec.save();
                     var configRec = record.submitFields({
                        type: 'customrecord_tss_itb_runtime_config',
                        id: recordIdVal,
                        values: {
                           custrecord_tss_itb_config: false,
                           custrecord_tss_itb_config_run_at: utcTimestamp
                        },
                        options: {
                           enableSourcing: false,
                           ignoreMandatoryFields: true
                        }
                     });
                  } else {
                     var configRec = record.create({ type: 'customrecord_tss_itb_runtime_config', });
                     configRec.setValue({ fieldId: 'custrecord_tss_itb_config', value: false });
                     configRec.setValue({ fieldId: 'custrecord_tss_itb_config_run_at', value: utcTimestamp });
                     configRec.save({ enableSourcing: true });
                  }

                  var globalSearch = search.create({
                     type: 'customrecord_tss_global_parameter',
                     title: 'My TaxPro Global Preference Page',
                     columns: null,
                     filters: [search.createFilter({
                        name: 'isinactive',
                        operator: 'is',
                        values: 'F'
                     })]
                  });
                  var globalSearch = globalSearch.run().getRange({
                     start: 0,
                     end: 10
                  });
                  if (globalSearch != null && globalSearch != '' && globalSearch.length > 0) {
                     var g_recordIdVal = globalSearch[0].id;
                     var g_configRec = record.submitFields({
                        type: 'customrecord_tss_global_parameter',
                        id: g_recordIdVal,
                        values: {
                           custrecord_tss_gp_subscription_end: false
                        },
                        options: {
                           enableSourcing: false,
                           ignoreMandatoryFields: true
                        }
                     });
                  }
                  /***************END Activated Section Code for SkyDoc****************/
               }
            }
            log.debug('***** Script End *****');
         } catch (error) {
            log.error({ title: 'Error in Main', details: error });
         }
      }
      return {
         execute: execute
      };
   });