/**
 * @NAPIVersion 2.1
 * @NScriptType SDFInstallationScript
 */
define(['N/record', 'N/search', 'N/runtime'],
    /**
 * @param{record} record
 * @param{search} search
 */
    (record, search, runtime) => {
        /**
         * Defines what is executed when the script is specified by the SDF deployment(in the deploy.xml file of a SuiteCloud project).
         * @param {Object} scriptContext
         * @param {fromVersion} scriptContext.fromVersion - The version of the SuiteApp currently installed on the account. Specify null
         *     if this is a new installation.
         * @param {toVersion} scriptContext.toVersion - The version of the SuiteApp that will be installed on the account.
         * @since 2015.2
         */
        const scriptIDarr = [
            'customscript_cli_tss_globalparam_restric',
            'customscript_cli_tss_gst_on_cust_refund',
            'customscript_cli_tss_gst_state_validatio',
            'customscript_cli_tss_hsn_validation',
            'customscript_cli_tss_indian_tax_transact',
            'customscript_cli_tss_india_tax_vpp',
            'customscript_cli_tss_tax_grp_determinat',
            'customscript_cli_tss_tds_on_vpp',
            'customscript_cli_tss_tds_relation',
            'customscript_cli_tss_vendor_exemption_va',
            'customscript_cli_tss_vendor_validations',
            'customscript_sch_tss_update_gst_on_depos',
            'customscript_sl_tss_itb_deposit_gst_repo',
            'customscript_sut_tss_exp_item_data',
            'customscript_sut_tss_getstate_fromaddres',
            'customscript_sut_tss_get_entity_data',
            'customscript_sut_tss_get_location_data',
            'customscript_sut_tss_gst_journal_creatio',
            'customscript_sut_tss_salestaxitem_search',
            'customscript_sut_tss_tax_group_data',
            'customscript_tss_cs_customer_deposit',
            'customscript_tss_cs_prepayment',
            'customscript_tss_cs_prepayment_applicati',
            'customscript_tss_sl_vppa_reconcil_report',
            'customscript_tss_ue_customer_deposit',
            'customscript_tss_ue_gst_on_journal',
            'customscript_ue_tss_india_tax_vpp',
            'customscript_tss_ue_vendor_tax_validatio',
            'customscript_ues_tss_creating_taxgroup',
            'customscript_ues_tss_location_validation',
            'customscript_ues_tss_tds_master_record',
            'customscript_ues_tss_tds_relation',
            'customscript_ues_tss_vendor_exemption',
            'customscript_ue_tss_gst_on_cust_refund',
            'customscript_ue_tss_indian_tax_transacti',
            'customscript_tss_ue_tds_customer_payment',
            'customscript_tss_it_cs_config_items'
        ];

        const run = (scriptContext) => {
            try {
                // Start: log remaining governance
                let usageStart = runtime.getCurrentScript().getRemainingUsage();
                log.audit('Governance Start', usageStart);
                // const roleIds = [
                //     "ADMINISTRATOR",
                //     "customroleenfinity_admin_nohreeaccess",
                //     "customrole1070",
                //     "customrole1225",
                //     "customrole1057",
                //     "customrole1072",
                //     "customrole1189",
                //     "customrole1179",
                //     "customrole1231",
                //     "customrole1173",
                //     "customrole1180",
                //     "customrole1237"
                // ]
                var roleNames = [
                    'Administrator',
                    'Enfinity - Administrator - No HR',
                    'Enfinity Accountant - India',
                    'Enfinity A/R Clerk - India',
                    'Enfinity A/P Clerk Extended - India',
                    'Enfinity Controller - India',
                    'Enfinity Fixed Assets - India',
                    'Enfinity HR Director India',
                    'Enfinity Accountant - EG India Holdings BV',
                    'Enfinity Withholding Tax Accountant India',
                    'Enfinity FP&A - India',
                    'Enfinity Bank Details India'
                ]
                const roleIds = getRoleIds(roleNames)

                log.audit('Roles Found:', roleIds);
                const DEPLOYMENTS = getDeploymentsByScriptIds(scriptIDarr)
                log.audit("DEPLOYMENTS", DEPLOYMENTS)
                DEPLOYMENTS.forEach(deployId => {
                    // updateDeploymentRoles(deployId, roleIds);
                });

                // End: log remaining governance
                let usageEnd = runtime.getCurrentScript().getRemainingUsage();
                log.debug('Governance End', usageEnd);

            } catch (e) {
                log.error('Post Install Error', e);
                throw e;
            }
        }

        function updateDeploymentRoles(deployId, roleIds) {
            const rec = record.load({
                type: record.Type.SCRIPT_DEPLOYMENT,
                id: deployId
            });

            // Field ID for roles audience
            // It's multi-select field
            rec.setValue({
                fieldId: 'allroles',
                value: false
            });
            rec.setValue({
                fieldId: 'audslctrole',
                value: roleIds
            });

            const id = rec.save();
            log.debug(`Updated Deployment ${deployId}`, `Saved: ${id}`);
        }

        function getDeploymentsByScriptIds(scriptIds) {

            const deploymentIds = [];

            scriptIds.forEach(scriptId => {

                const results = search.create({
                    type: search.Type.SCRIPT_DEPLOYMENT,
                    filters: [
                        ['script.scriptid', 'is', scriptId]   // filter by script ID
                    ],
                    columns: [
                        'internalid',
                        'script.scriptid',
                        'script'
                    ]
                }).run().getRange({ start: 0, end: 1000 });

                // results.forEach(row => {
                //     deploymentIds.push({
                //         deploymentId: row.getValue('internalid'),
                //         scriptId: row.getValue({ name: 'scriptid', join: 'script' })
                //     });
                // });
                results.forEach(row => {
                    deploymentIds.push(row.getValue('internalid'));
                });
            });

            return deploymentIds;
        }

        function getRoleIds(roleNames) {
            const ids = [];

            roleNames.forEach(name => {
                const res = search.create({
                    type: search.Type.ROLE,
                    filters: [['name', 'is', name]],
                    columns: ['internalid']
                }).run().getRange({ start: 0, end: 1 });

                if (res.length)
                    ids.push(res[0].getValue('internalid'));
                else
                    log.error('Role Not Found', name);
            });

            return ids;
        }

        return { run }
    });
