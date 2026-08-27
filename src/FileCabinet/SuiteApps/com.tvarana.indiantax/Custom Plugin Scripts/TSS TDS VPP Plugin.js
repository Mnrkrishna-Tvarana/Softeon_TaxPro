/**
 * @NApiVersion 2.1
 * @NScriptType CustomGLPlugin
  */
/**
 * Script Type          : Custom GL Lines Plug-in
 * Script Name          : TSS TDS VPP Plugin
 * Script Version       : 2.1
 * Converted From       : SuiteScript 1.0
 * Author               : MNR Krishna
 * Description          : Adds custom GL lines on Vendor Prepayment & Vendor Prepayment Application
 *                        for TDS and creates TDS Bill Relation records.
 * 
 * Version      Name              Date       	        Notes
 * 1.0          MNR Krishna       11-02-2024           Initial version
 * 2.0          MNR Krishna       12-12-2025           Converted from 1.0 version into 2.1 version script
 */

define(['N/log', 'N/search', 'N/record', '/SuiteApps/com.tvarana.indiantax/Other Files/TSS TaxPro Server Helper'], function (log, search, record, serverHelper) {

	function customizeGlImpact(context) {
		try {
			// Always first line — checks subscription
			if (!serverHelper.checkSubscription()) {
				log.debug("TaxPro TDS VPP Plugin", "Subscription check failed - blocking execution");
				return true;
			}
			log.debug('GL Plugin Started', 'TSS TDS VPP Plugin started');

			const transactionRecord = context.transactionRecord;
			const customLines = context.customLines;

			const recType = transactionRecord.type;
			const billId = transactionRecord.id;

			log.debug('Transaction Info', {
				type: recType,
				id: billId
			});

			// ------------------------------------------------------------------
			// Load Global Parameters
			// ------------------------------------------------------------------
			let global_Subsid = '';
			const gpSearch = search.create({
				type: 'customrecord_tss_global_parameter',
				filters: [['isinactive', 'is', 'F']],
				columns: ['custrecord_tss_gp_subsidiary']
			}).run().getRange({ start: 0, end: 1 });

			if (gpSearch && gpSearch.length > 0) {
				global_Subsid = gpSearch[0].getValue('custrecord_tss_gp_subsidiary');
			}

			const recSubsidiary = transactionRecord.getValue({ fieldId: 'subsidiary' });
			const Flag = inArray(recSubsidiary, global_Subsid);

			log.debug('Subsidiary Validation', {
				recSubsidiary: recSubsidiary,
				globalSubs: global_Subsid,
				flag: Flag
			});

			if (Flag !== 1) return;

			const tranCurrency = transactionRecord.getValue({ fieldId: 'currency' });
			const tranDate = transactionRecord.getValue({ fieldId: 'trandate' });
			const tranExchangeRate = transactionRecord.getValue({ fieldId: 'exchangerate' });
			const i_entity = transactionRecord.getValue({ fieldId: 'entity' });
			const tds_amount = transactionRecord.getValue({ fieldId: 'custbody_tss_tds_amount' });
			const paymentBaseAmt = transactionRecord.getValue({ fieldId: 'custbody_tss_tds_baseamt' });


			// ==================================================================
			// VENDOR PREPAYMENT
			// ==================================================================
			if (recType === 'vendorprepayment') {

				log.debug('Processing Vendor Prepayment', billId);


				const i_location = transactionRecord.getValue({ fieldId: 'location' });
				const i_department = transactionRecord.getValue({ fieldId: 'department' });
				const i_class = transactionRecord.getValue({ fieldId: 'class' });

				const tds_account = transactionRecord.getValue({ fieldId: 'custbody_tss_tds_account' });
				const advance_account = transactionRecord.getValue({ fieldId: 'prepaymentaccount' });
				const bank_account = transactionRecord.getValue({ fieldId: 'account' });


				const tds_apply = transactionRecord.getValue({ fieldId: 'custbody_tss_it_apply_gst' });
				const tds_relation = transactionRecord.getValue({ fieldId: 'custbody_tss_tds_relation' });

				// --------------------------------------------------------------
				// Inactivate existing Bill Relation records
				// --------------------------------------------------------------
				const relSearch = search.create({
					type: 'customrecord_tss_its_tds_billrelation',
					filters: [
						['custrecord_tss_its_billbillno', 'is', billId],
						'AND',
						['isinactive', 'is', 'F']
					],
					columns: ['internalid']
				}).run().getRange({ start: 0, end: 1000 });

				relSearch.forEach(r => {
					record.submitFields({
						type: 'customrecord_tss_its_tds_billrelation',
						id: r.getValue('internalid'),
						values: { isinactive: true }
					});
					log.debug('Inactivated Bill Relation', r.getValue('internalid'));
				});



				// --------------------------------------------------------------
				// Apply TDS
				// --------------------------------------------------------------
				if (tds_apply === true && _logValidation(tds_account) && _logValidation(bank_account)) {

					// Fetch Tax Agency Vendor
					var TaxAgency = getTaxAgencyVendor(recSubsidiary);
					log.debug("Tax Agency", TaxAgency);
					// let TaxAgency = null;
					// const taxAgencySearch = search.create({
					// 	type: 'vendor',
					// 	filters: [
					// 		['subsidiary', 'anyof', recSubsidiary],
					// 		'AND',
					// 		['category', 'anyof', 3]
					// 	],
					// 	columns: ['internalid']
					// }).run().getRange({ start: 0, end: 1 });

					// if (taxAgencySearch && taxAgencySearch.length > 0) {
					// 	TaxAgency = taxAgencySearch[0].getValue('internalid');
					// }

					log.debug('Tax Agency', TaxAgency);

					if (parseFloat(tds_amount) > 0) {

						// ---------------- GL Lines ----------------
						let line1 = customLines.addNewLine();
						line1.accountId = parseInt(tds_account);
						if (_logValidation(i_location)) line1.locationId = parseInt(i_location);
						if (_logValidation(i_department)) line1.departmentId = parseInt(i_department);
						if (_logValidation(i_class)) line1.classId = parseInt(i_class);
						if (_logValidation(i_entity)) line1.entityId = parseInt(i_entity);
						line1.creditAmount = parseFloat(tds_amount);

						let line2 = customLines.addNewLine();
						line2.accountId = parseInt(advance_account);
						if (_logValidation(i_location)) line2.locationId = parseInt(i_location);
						if (_logValidation(i_department)) line2.departmentId = parseInt(i_department);
						if (_logValidation(i_class)) line2.classId = parseInt(i_class);
						if (_logValidation(i_entity)) line2.entityId = parseInt(i_entity);
						line2.debitAmount = parseFloat(tds_amount);

						log.debug('Custom GL Lines Added', {
							credit: tds_amount,
							debit: tds_amount
						});

						// ---------------- Create Bill Relation ----------------
						const tdsrate = transactionRecord.getValue({ fieldId: 'custbody_tss_tds_percentage' });

						const tdsRelationObj = search.lookupFields({
							type: 'customrecord_tss_tdsrelation',
							id: tds_relation,
							columns: [
								'custrecord_tss_vedtdstype',
								'custrecord_tss_tds_vedassesseecode',
								'custrecord_tss_tds_section'
							]
						});
						log.debug("tdsRelationObj", JSON.stringify(tdsRelationObj))
						log.debug("tds master", tdsRelationObj.custrecord_tss_vedtdstype)
						const indianCurrency = getIndianCurrency();
						let tds_amountFx = tds_amount;
						let payment_amountFx = paymentBaseAmt;

						if (tranCurrency !== indianCurrency) {
							tds_amountFx = tds_amount * tranExchangeRate;
							payment_amountFx = paymentBaseAmt * tranExchangeRate;
						}

						const relRec = record.create({
							type: 'customrecord_tss_its_tds_billrelation',
							isDynamic: true
						});

						relRec.setValue({ fieldId: 'custrecord_tss_its_vendorbillrel', value: i_entity });
						relRec.setValue({ fieldId: 'custrecord_tss_its_billbillno', value: billId });
						relRec.setValue({ fieldId: 'custrecord_tss_its_billamount', value: paymentBaseAmt });
						relRec.setValue({ fieldId: 'custrecord_tss_its_billbillamountfx', value: payment_amountFx });
						relRec.setValue({ fieldId: 'custrecord_tss_its_billtdsamount', value: tds_amount });
						relRec.setValue({ fieldId: 'custrecord_tss_its_billtdspayable', value: tds_amount });
						relRec.setValue({ fieldId: 'custrecord_tss_its_billtdsamountfx', value: tds_amountFx });
						relRec.setValue({ fieldId: 'custrecord_tss_its_billbilldate', value: tranDate });
						relRec.setValue({ fieldId: 'custrecord_tss_its_billtdstype', value: tdsRelationObj.custrecord_tss_vedtdstype[0] ? tdsRelationObj.custrecord_tss_vedtdstype[0].value : null });
						relRec.setValue({ fieldId: 'custrecord_tss_its_billtdssection', value: tdsRelationObj.custrecord_tss_tds_section });
						relRec.setValue({ fieldId: 'custrecord_tss_its_billtdsaccount', value: tds_account });
						relRec.setValue({ fieldId: 'custrecord_tss_its_billstatus', value: 'Open' });
						relRec.setValue({ fieldId: 'custrecord_tss_its_billtdsrate', value: tdsrate });
						relRec.setValue({ fieldId: 'custrecord_tss_its_billsubsidiary', value: recSubsidiary });
						relRec.setValue({ fieldId: 'custrecord_tss_its_billtrxtype', value: recType });
						relRec.setValue({ fieldId: 'custrecord_tss_its_billassessecode', value: tdsRelationObj.custrecord_tss_tds_vedassesseecode[0] ? tdsRelationObj.custrecord_tss_tds_vedassesseecode[0].value : null });

						const relId = relRec.save();
						log.debug('Created TDS Bill Relation', relId);
					}
				}
			}

			// ==================================================================
			// VENDOR PREPAYMENT APPLICATION
			// ==================================================================
			else if (recType === 'vendorprepaymentapplication') {

				const tds_account = transactionRecord.getValue({ fieldId: 'custbody_tss_tds_account' });
				const prePayAccount = transactionRecord.getValue({ fieldId: 'prepaymentaccount' });

				const i_location = transactionRecord.getValue({ fieldId: 'location' });
				const i_department = transactionRecord.getValue({ fieldId: 'department' });
				const i_class = transactionRecord.getValue({ fieldId: 'class' });

				//Inactivate TDS Bill Relation on Prepayment Application
				const relSearch = search.create({
					type: 'customrecord_tss_its_tds_billrelation',
					filters: [
						['custrecord_tss_its_billbillno', 'is', billId],
						'AND',
						['custrecord_tss_its_billstatus', 'is', 'Open'],
						'AND',
						['isinactive', 'is', 'F']
					],
					columns: ['internalid']
				}).run().getRange({ start: 0, end: 1000 });
				relSearch.forEach(r => {
					record.submitFields({
						type: 'customrecord_tss_its_tds_billrelation',
						id: r.getValue('internalid'),
						values: { isinactive: true }
					});
					log.debug('Inactivated Bill Relation Application', r.getValue('internalid'));
				});


				if (parseFloat(tds_amount) > 0) {

					let line1 = customLines.addNewLine();
					line1.accountId = parseInt(prePayAccount);
					if (_logValidation(i_location)) line1.locationId = parseInt(i_location);
					if (_logValidation(i_department)) line1.departmentId = parseInt(i_department);
					if (_logValidation(i_class)) line1.classId = parseInt(i_class);
					if (_logValidation(i_entity)) line1.entityId = parseInt(i_entity);
					line1.creditAmount = parseFloat(tds_amount);

					let line2 = customLines.addNewLine();
					line2.accountId = parseInt(tds_account);
					if (_logValidation(i_location)) line2.locationId = parseInt(i_location);
					if (_logValidation(i_department)) line2.departmentId = parseInt(i_department);
					if (_logValidation(i_class)) line2.classId = parseInt(i_class);
					if (_logValidation(i_entity)) line2.entityId = parseInt(i_entity);
					line2.debitAmount = parseFloat(tds_amount);

					log.debug('Prepayment Application GL Lines Added', tds_amount);

					const tds_relation = transactionRecord.getValue({ fieldId: 'custbody_tss_tds_relation' });

					// ---------------- Create Bill Relation ----------------

					const tdsrate = transactionRecord.getValue({ fieldId: 'custbody_tss_tds_percentage' });

					const tdsRelationObj = search.lookupFields({
						type: 'customrecord_tss_tdsrelation',
						id: tds_relation,
						columns: [
							'custrecord_tss_vedtdstype',
							'custrecord_tss_tds_vedassesseecode',
							'custrecord_tss_tds_section'
						]
					});
					log.debug("tdsRelationObj in App", JSON.stringify(tdsRelationObj))
					log.debug("tds master in App", tdsRelationObj.custrecord_tss_vedtdstype)
					const indianCurrency = getIndianCurrency();
					let tds_amountFx = tds_amount;
					let payment_amountFx = paymentBaseAmt;

					if (tranCurrency !== indianCurrency) {
						tds_amountFx = tds_amount * tranExchangeRate;
						payment_amountFx = paymentBaseAmt * tranExchangeRate;
					}

					const relRec = record.create({
						type: 'customrecord_tss_its_tds_billrelation',
						isDynamic: true
					});

					relRec.setValue({ fieldId: 'custrecord_tss_its_vendorbillrel', value: i_entity });
					relRec.setValue({ fieldId: 'custrecord_tss_its_billbillno', value: billId });
					relRec.setValue({ fieldId: 'custrecord_tss_its_billamount', value: -paymentBaseAmt });
					relRec.setValue({ fieldId: 'custrecord_tss_its_billbillamountfx', value: -payment_amountFx });
					relRec.setValue({ fieldId: 'custrecord_tss_its_billtdsamount', value: -tds_amount });
					relRec.setValue({ fieldId: 'custrecord_tss_its_billtdspayable', value: -tds_amount });
					relRec.setValue({ fieldId: 'custrecord_tss_its_billtdsamountfx', value: -tds_amountFx });
					relRec.setValue({ fieldId: 'custrecord_tss_its_billbilldate', value: tranDate });
					relRec.setValue({ fieldId: 'custrecord_tss_its_billtdstype', value: tdsRelationObj.custrecord_tss_vedtdstype[0] ? tdsRelationObj.custrecord_tss_vedtdstype[0].value : null });
					relRec.setValue({ fieldId: 'custrecord_tss_its_billtdssection', value: tdsRelationObj.custrecord_tss_tds_section });
					relRec.setValue({ fieldId: 'custrecord_tss_its_billtdsaccount', value: tds_account });
					relRec.setValue({ fieldId: 'custrecord_tss_its_billstatus', value: 'Open' });
					relRec.setValue({ fieldId: 'custrecord_tss_its_billtdsrate', value: tdsrate });
					relRec.setValue({ fieldId: 'custrecord_tss_its_billsubsidiary', value: recSubsidiary });
					relRec.setValue({ fieldId: 'custrecord_tss_its_billtrxtype', value: recType });
					relRec.setValue({ fieldId: 'custrecord_tss_its_billassessecode', value: tdsRelationObj.custrecord_tss_tds_vedassesseecode[0] ? tdsRelationObj.custrecord_tss_tds_vedassesseecode[0].value : null });

					const relId = relRec.save();
					log.debug('Created TDS Bill Relation in App', relId);

				}
			}

		} catch (e) {
			log.error('TSS TDS VPP Plugin Failed', e);
			throw e;
		}
	}

	// ------------------------------------------------------------------
	// Helper Functions
	// ------------------------------------------------------------------
	function _logValidation(value) {
		return !(value === null || value === '' || value === undefined || value === 'undefined' || value === 'NaN' || value === NaN);
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

	function getIndianCurrency() {
		let INR = null;
		const res = search.create({
			type: 'currency',
			filters: [['symbol', 'is', 'INR']],
			columns: ['internalid']
		}).run().getRange({ start: 0, end: 1 });

		if (res && res.length > 0) {
			INR = res[0].getValue('internalid');
		}
		return INR;
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

	return {
		customizeGlImpact: customizeGlImpact
	};
});