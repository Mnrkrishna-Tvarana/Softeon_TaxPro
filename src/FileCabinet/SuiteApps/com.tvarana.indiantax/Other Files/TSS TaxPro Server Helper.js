/**
 * taxpro_server_helper.js
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define([
    'N/record',
    'N/runtime',
    'N/email',
    'N/error',
    'N/log',
    'N/search'
], function (record, runtime, email, error, log, search) {

    //=========================================
    // CONSTANTS
    //=========================================
    var CONSTANTS = {
        STALE_THRESHOLD_DAYS: 5,
        ALERT_EMAIL: 'appssubscriptionnotify@tvarana.com',
        ALERT_SENDER: -5,

        CONFIG_RECORD_ID: '',
        CONFIG_RECORD_TYPE: 'customrecord_tss_itb_runtime_config',
        CONFIG_SUB_ENDED: 'custrecord_tss_itb_config',
        CONFIG_LAST_RUN: 'custrecord_tss_itb_config_run_at'
    };

    //=========================================
    // MAIN — CHECK SUBSCRIPTION
    // Call this at top of every UE / Suitelet
    //=========================================
    function checkSubscription() {
        try {
            var config = getConfigRecord();

            if (!config) {
                log.error("TaxPro", "Not Configured Subscription - blocking execution");
                return false;
            }

            var subscriptionEnded = config.subscriptionEnded;
            var lastRunTimestamp = config.lastRunTimestamp;

            log.debug("TaxPro Check", {
                configured: subscriptionEnded,
                lastTimestamp: lastRunTimestamp
            });

            // Case 1: Subscription explicitly ended
            if (subscriptionEnded) {
                log.debug("TaxPro", "Configuration ended - blocking execution");
                return false;
            }

            // Case 2: Schedule script stale (5+ days not run)
            if (isScheduleScriptStale(lastRunTimestamp)) {
                log.debug("TaxPro", "Schedule script stale - blocking execution");

                //Checking Netsuite Environmemt type
                var accountId = runtime.accountId; // e.g. '6330123_SB3', '6330123_RP', or '6330123'
                var isNonProduction = /_SB\d*$/i.test(accountId) || /_RP$/i.test(accountId);
                if (isNonProduction) {
                    log.audit('Alert Suppressed', 'Skipping stale alert - non-production account: ' + accountId);
                } else {

                    // Mark subscription ended
                    markConfigurationEnded();

                    // Alert product team
                    sendStaleAlert(lastRunTimestamp);

                    return false;
                }
            }

            // All good — subscription active
            log.debug("TaxPro", "Configuration active - proceeding");
            return true;

        } catch (e) {
            // If error is our block error rethrow it
            if (e.name === 'TAXPRO_SUBSCRIPTION_BLOCK') {
                throw e;
            }
            // Any other unexpected error — fail safe block
            log.error("TaxPro checkConfiguration ERROR", e.message);
            return false;
        }
    }

    //=========================================
    // GET CONFIG RECORD
    //=========================================
    function getConfigRecord() {
        try {
            var configsearch = search.create({
                type: CONSTANTS.CONFIG_RECORD_TYPE,
                title: 'My TaxPro Configuration Page',
                columns: [CONSTANTS.CONFIG_SUB_ENDED, CONSTANTS.CONFIG_LAST_RUN],
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
                CONSTANTS['CONFIG_RECORD_ID'] = configsearch[0].id;
                return {
                    subscriptionEnded: configsearch[0].getValue(CONSTANTS.CONFIG_SUB_ENDED),
                    lastRunTimestamp: configsearch[0].getValue(CONSTANTS.CONFIG_LAST_RUN)
                };
            }

        } catch (e) {
            log.error("Config Record Load ERROR", e.message);
            return null;
        }
    }

    //=========================================
    // IS SCHEDULE SCRIPT STALE
    //=========================================
    function isScheduleScriptStale(storedISOTimestamp) {
        // Never ran → treat as stale
        if (!storedISOTimestamp) {
            log.debug("TaxPro", "No last run  - treating as stale");
            return true;
        }

        try {
            var lastRun = new Date(storedISOTimestamp);

            // Validate parsed date
            if (isNaN(lastRun.getTime())) {
                log.error("TaxPro", "Invalid timestamp: " + storedISOTimestamp);
                return true; // Fail safe
            }

            var now = new Date();
            var diffMs = now.getTime() - lastRun.getTime();
            var diffDays = diffMs / (1000 * 60 * 60 * 24);

            log.debug("TaxPro Staleness Check", {
                lastRun: lastRun.toUTCString(),
                now: now.toUTCString(),
                diffDays: diffDays.toFixed(2),
                threshold: CONSTANTS.STALE_THRESHOLD_DAYS,
                isStale: diffDays > CONSTANTS.STALE_THRESHOLD_DAYS
            });

            return diffDays > CONSTANTS.STALE_THRESHOLD_DAYS;

        } catch (e) {
            log.error("Staleness Check ERROR", e.message);
            return true; // Fail safe
        }
    }

    //=========================================
    // MARK SUBSCRIPTION ENDED
    //=========================================
    function markConfigurationEnded() {
        try {
            var values = {};
            values[CONSTANTS.CONFIG_SUB_ENDED] = true;
            if (CONSTANTS.CONFIG_RECORD_ID) {
                record.submitFields({
                    type: CONSTANTS.CONFIG_RECORD_TYPE,
                    id: CONSTANTS.CONFIG_RECORD_ID,
                    values: values,
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
                log.debug("TaxPro", "Configuration marked as ended in config record");

                var globalPrefSearch = search.create({
                    type: 'customrecord_tss_global_parameter',
                    filters: [search.createFilter({
                        name: 'isinactive',
                        operator: 'is',
                        values: 'F'
                    })],
                    columns: [search.createColumn({
                        name: 'internalid',
                    })]
                });
                var globalPrefResults = globalPrefSearch.run().getRange({ start: 0, end: 1 });
                if (globalPrefResults && globalPrefResults.length > 0) {
                    var globalPrefId = globalPrefResults[0].getValue({ name: 'internalid' });
                    record.submitFields({
                        type: 'customrecord_tss_global_parameter',
                        id: globalPrefId,
                        values: {
                            'custrecord_tss_gp_subscription_end': true
                        },
                        options: {
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        }
                    });
                    log.debug("TaxPro", "Global Config marked as ended");
                }
            }

        } catch (e) {
            log.error("markConfigurationEnded ERROR", e.message);
        }
    }

    //=========================================
    // SEND STALE ALERT
    //=========================================
    function sendStaleAlert(lastRunTimestamp) {
        try {
            email.send({
                author: CONSTANTS.ALERT_SENDER,
                recipients: [CONSTANTS.ALERT_EMAIL],
                subject: 'TaxPro Alert - Schedule Script Not Running',
                body: [
                    'TaxPro Schedule Script(Subscription Checker Script) Alert',
                    '================================',
                    'Account ID   : ' + runtime.accountId,
                    'Last Run     : ' + (lastRunTimestamp || 'Never'),
                    'Detected At  : ' + new Date().toISOString(),
                    'Reason       : Schedule script has not run for ' +
                    (lastRunTimestamp ? CONSTANTS.STALE_THRESHOLD_DAYS + '+' : 'Some') + ' days.',
                    '================================',
                    'Action Required: Please check with the client regarding',
                    'schedule script status and subscription verification.'
                ].join('\n')
            });

        } catch (e) {
            log.error("Stale Alert Email ERROR", e.message);
        }
    }

    //=========================================
    // BLOCK EXECUTION
    //=========================================
    function blockExecution(message) {
        throw error.create({
            name: 'TAXPRO_SUBSCRIPTION_BLOCK',
            message: message,
            notifyOff: true
        });
    }

    return {
        checkSubscription: checkSubscription
    };
});