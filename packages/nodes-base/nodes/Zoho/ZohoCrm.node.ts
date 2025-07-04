import {
	type IExecuteFunctions,
	type IDataObject,
	type ILoadOptionsFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';

import {
	accountFields,
	accountOperations,
	contactFields,
	contactOperations,
	dealFields,
	dealOperations,
	invoiceFields,
	invoiceOperations,
	leadFields,
	leadOperations,
	productFields,
	productOperations,
	purchaseOrderFields,
	purchaseOrderOperations,
	quoteFields,
	quoteOperations,
	salesOrderFields,
	salesOrderOperations,
	vendorFields,
	vendorOperations,
} from './descriptions';
import {
	addGetAllFilterOptions,
	adjustAccountPayload,
	adjustContactPayload,
	adjustDealPayload,
	adjustInvoicePayload,
	adjustInvoicePayloadOnUpdate,
	adjustLeadPayload,
	adjustProductDetails,
	adjustProductPayload,
	adjustPurchaseOrderPayload,
	adjustQuotePayload,
	adjustSalesOrderPayload,
	adjustVendorPayload,
	getFields,
	getFieldsForExecution,
	getPicklistOptions,
	handleListing,
	throwOnEmptyUpdate,
	throwOnMissingProducts,
	toLoadOptions,
	zohoApiRequest,
	zohoApiRequestAllItems,
} from './GenericFunctions';
import type {
	CamelCaseResource,
	GetAllFilterOptions,
	LoadedAccounts,
	LoadedContacts,
	SnakeCaseResource,
	LoadedDeals,
	LoadedProducts,
	LoadedVendors,
	ProductDetails,
} from './types';

export class ZohoCrm implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Zoho CRM',
		name: 'zohoCrm',
		icon: 'file:zoho.svg',
		group: ['transform'],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		version: 1,
		description: 'Consume Zoho CRM API',
		defaults: {
			name: 'Zoho CRM',
		},
		usableAsTool: true,
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'zohoOAuth2Api',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Account',
						value: 'account',
					},
					{
						name: 'Contact',
						value: 'contact',
					},
					{
						name: 'Deal',
						value: 'deal',
					},
					{
						name: 'Invoice',
						value: 'invoice',
					},
					{
						name: 'Lead',
						value: 'lead',
					},
					{
						name: 'Product',
						value: 'product',
					},
					{
						name: 'Purchase Order',
						value: 'purchaseOrder',
					},
					{
						name: 'Quote',
						value: 'quote',
					},
					{
						name: 'Sales Order',
						value: 'salesOrder',
					},
					{
						name: 'Vendor',
						value: 'vendor',
					},
				],
				default: 'account',
			},
			...accountOperations,
			...accountFields,
			...contactOperations,
			...contactFields,
			...dealOperations,
			...dealFields,
			...invoiceOperations,
			...invoiceFields,
			...leadOperations,
			...leadFields,
			...productOperations,
			...productFields,
			...purchaseOrderOperations,
			...purchaseOrderFields,
			...quoteOperations,
			...quoteFields,
			...salesOrderOperations,
			...salesOrderFields,
			...vendorOperations,
			...vendorFields,
		],
	};

	methods = {
		loadOptions: {
			// ----------------------------------------
			//               resources
			// ----------------------------------------

			async getAccounts(this: ILoadOptionsFunctions) {
				const accounts = (await zohoApiRequestAllItems.call(
					this,
					'GET',
					'/accounts',
				)) as LoadedAccounts;
				return toLoadOptions(accounts, 'Account_Name');
			},

			async getContacts(this: ILoadOptionsFunctions) {
				const contacts = (await zohoApiRequestAllItems.call(
					this,
					'GET',
					'/contacts',
				)) as LoadedContacts;
				return toLoadOptions(contacts, 'Full_Name');
			},

			async getDeals(this: ILoadOptionsFunctions) {
				const deals = (await zohoApiRequestAllItems.call(this, 'GET', '/deals')) as LoadedDeals;
				return toLoadOptions(deals, 'Deal_Name');
			},

			async getProducts(this: ILoadOptionsFunctions) {
				const products = (await zohoApiRequestAllItems.call(
					this,
					'GET',
					'/products',
				)) as LoadedProducts;
				return toLoadOptions(products, 'Product_Name');
			},

			async getVendors(this: ILoadOptionsFunctions) {
				const vendors = (await zohoApiRequestAllItems.call(
					this,
					'GET',
					'/vendors',
				)) as LoadedVendors;
				return toLoadOptions(vendors, 'Vendor_Name');
			},

			// ----------------------------------------
			//             resource fields
			// ----------------------------------------

			// standard fields - called from `makeGetAllFields`

			async getAccountFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'account');
			},

			async getContactFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'contact');
			},

			async getDealFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'deal');
			},

			async getInvoiceFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'invoice');
			},

			async getLeadFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'lead');
			},

			async getProductFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'product');
			},

			async getPurchaseOrderFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'purchase_order');
			},

			async getVendorOrderFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'vendor');
			},

			async getQuoteFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'quote');
			},

			async getSalesOrderFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'sales_order');
			},

			async getVendorFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'vendor');
			},

			// custom fields

			async getCustomAccountFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'account', { onlyCustom: true });
			},

			async getCustomContactFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'contact', { onlyCustom: true });
			},

			async getCustomDealFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'deal', { onlyCustom: true });
			},

			async getCustomInvoiceFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'invoice', { onlyCustom: true });
			},

			async getCustomLeadFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'lead', { onlyCustom: true });
			},

			async getCustomProductFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'product', { onlyCustom: true });
			},

			async getCustomPurchaseOrderFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'purchase_order', { onlyCustom: true });
			},

			async getCustomVendorOrderFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'vendor', { onlyCustom: true });
			},

			async getCustomQuoteFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'quote', { onlyCustom: true });
			},

			async getCustomSalesOrderFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'sales_order', { onlyCustom: true });
			},

			async getCustomVendorFields(this: ILoadOptionsFunctions) {
				return await getFields.call(this, 'vendor', { onlyCustom: true });
			},

			// ----------------------------------------
			//        resource picklist options
			// ----------------------------------------

			async getAccountType(this: ILoadOptionsFunctions) {
				return await getPicklistOptions.call(this, 'account', 'Account_Type');
			},

			async getDealStage(this: ILoadOptionsFunctions) {
				return await getPicklistOptions.call(this, 'deal', 'Stage');
			},

			async getPurchaseOrderStatus(this: ILoadOptionsFunctions) {
				return await getPicklistOptions.call(this, 'purchaseOrder', 'Status');
			},

			async getSalesOrderStatus(this: ILoadOptionsFunctions) {
				return await getPicklistOptions.call(this, 'salesOrder', 'Status');
			},

			async getQuoteStage(this: ILoadOptionsFunctions) {
				return await getPicklistOptions.call(this, 'quote', 'Quote_Stage');
			},

			async getFields(this: ILoadOptionsFunctions) {
				const resource = this.getCurrentNodeParameter('resource') as SnakeCaseResource;
				return getFields.call(this, resource);
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as CamelCaseResource;
		const operation = this.getNodeParameter('operation', 0);

		let responseData;

		for (let i = 0; i < items.length; i++) {
			// https://www.zoho.com/crm/developer/docs/api/insert-records.html
			// https://www.zoho.com/crm/developer/docs/api/get-records.html
			// https://www.zoho.com/crm/developer/docs/api/update-specific-record.html
			// https://www.zoho.com/crm/developer/docs/api/delete-specific-record.html
			// https://www.zoho.com/crm/developer/docs/api/v8/upsert-records.html

			try {
				if (resource === 'account') {
					// **********************************************************************
					//                                account
					// **********************************************************************

					// https://www.zoho.com/crm/developer/docs/api/v8/accounts-response.html
					// https://www.zoho.com/crm/developer/docs/api/v8/get-records.html
					// https://help.zoho.com/portal/en/kb/crm/customize-crm-account/customizing-fields/articles/standard-modules-fields#Accounts

					if (operation === 'search') {
						// ----------------------------------------
						//             account: search
						// ----------------------------------------
						// Get top-level search params
						const criteriaParam = this.getNodeParameter('criteria', i, '');
						const emailParam = this.getNodeParameter('email', i, '');
						let criteriaParamValue = this.getNodeParameter('criteria', i, '');
						if (typeof criteriaParamValue !== 'string')
							criteriaParamValue = String(criteriaParamValue);
						const searchFilters = this.getNodeParameter('searchFilters', i);
						let criteriaFromFilters = '';
						let filtersArray = [];
						if (
							searchFilters &&
							typeof searchFilters === 'object' &&
							'filters' in searchFilters &&
							Array.isArray(searchFilters.filters) &&
							searchFilters.filters.length > 0
						) {
							filtersArray = searchFilters.filters;
						}
						if (filtersArray.length > 0) {
							const loadOptionsContext = {
								getCurrentNodeParameter: (name: string) => {
									if (name === 'resource') return 'account';
									return undefined;
								},
							} as unknown as ILoadOptionsFunctions;
							criteriaFromFilters = await buildCriteriaFromFilters(
								searchFilters,
								loadOptionsContext,
								'account',
							);
						}
						// Combine criteriaParam and criteriaFromFilters if both exist
						let criteria = '';
						if (criteriaParamValue && criteriaFromFilters) {
							criteria = `${criteriaParamValue} and ${criteriaFromFilters}`;
						} else if (criteriaParamValue) {
							criteria = criteriaParamValue;
						} else if (criteriaFromFilters) {
							criteria = criteriaFromFilters;
						}
						if (!criteria) {
							throw new Error('Please provide at least one search criteria or filter.');
						}
						// Only declare qs once, and remove all legacy code below
						const qs: IDataObject = { criteria };
						responseData = await zohoApiRequest.call(this, 'GET', '/Accounts/search', {}, qs);
						responseData = responseData.data;
						// All legacy/old qs/email/phone/word code below this point has been removed.
						// (No further qs or search param logic should exist after this line for account:search)

						// (Removed legacy qs/email/phone/word logic. Only criteria is used above.)
					} else if (operation === 'create') {
						// ----------------------------------------
						//             account: create
						// ----------------------------------------

						const body: IDataObject = {
							Account_Name: this.getNodeParameter('accountName', i),
						};

						Object.assign(
							body,
							mapDynamicFieldsToBody(this.getNodeParameter('additionalFields', i)),
						);

						responseData = await zohoApiRequest.call(this, 'POST', '/Accounts', body);
						responseData = responseData.data[0].details;
					} else if (operation === 'delete') {
						// ----------------------------------------
						//             account: delete
						// ----------------------------------------

						const accountId = this.getNodeParameter('accountId', i);

						const endpoint = `/Accounts/${accountId}`;
						responseData = await zohoApiRequest.call(this, 'DELETE', endpoint);
						responseData = responseData.data[0].details;
					} else if (operation === 'get') {
						// ----------------------------------------
						//               account: get
						// ----------------------------------------

						const accountId = this.getNodeParameter('accountId', i);

						const endpoint = `/Accounts/${accountId}`;
						responseData = await zohoApiRequest.call(this, 'GET', endpoint);
						responseData = responseData.data;
					} else if (operation === 'getAll') {
						// ----------------------------------------
						//             account: getAll
						// ----------------------------------------

						const qs: IDataObject = {};
						const options = this.getNodeParameter('options', i) as GetAllFilterOptions;

						addGetAllFilterOptions(qs, options);
						// Only include all fields if user did not select any
						if (!options.fields || options.fields.length === 0) {
							const allFields = await getFieldsForExecution(this, resource as SnakeCaseResource);
							qs.fields = allFields.join(',');
						} else {
							qs.fields = options.fields.join(',');
						}

						responseData = await handleListing.call(this, 'GET', '/Accounts', {}, qs);
					} else if (operation === 'update') {
						// ----------------------------------------
						//             account: update
						// ----------------------------------------

						const body: IDataObject = {};
						Object.assign(body, mapDynamicFieldsToBody(this.getNodeParameter('updateFields', i)));

						const accountId = this.getNodeParameter('accountId', i);

						const endpoint = `/accounts/${accountId}`;
						responseData = await zohoApiRequest.call(this, 'PUT', endpoint, body);
						responseData = responseData.data[0].details;
					} else if (operation === 'upsert') {
						// ----------------------------------------
						//             account: upsert
						// ----------------------------------------

						const body: IDataObject = {
							Account_Name: this.getNodeParameter('accountName', i),
						};

						Object.assign(
							body,
							mapDynamicFieldsToBody(this.getNodeParameter('additionalFields', i)),
						);

						responseData = await zohoApiRequest.call(this, 'POST', '/Accounts/upsert', body);
						responseData = responseData.data[0].details;
					}
				} else if (resource === 'contact') {
					// **********************************************************************
					//                                contact
					// **********************************************************************

					// https://www.zoho.com/crm/developer/docs/api/v8/contacts-response.html
					// https://help.zoho.com/portal/en/kb/crm/customize-crm-account/customizing-fields/articles/standard-modules-fields#Contacts

					if (operation === 'search') {
						// ----------------------------------------
						//             contact: search
						// ----------------------------------------
						const searchFilters = this.getNodeParameter('searchFilters', i);
						const criteria = await buildCriteriaFromFilters(searchFilters);
						const qs: IDataObject = { criteria };
						responseData = await zohoApiRequest.call(this, 'GET', '/Contacts/search', {}, qs);
						responseData = responseData.data;
					} else if (operation === 'create') {
						// ----------------------------------------
						//             contact: create
						// ----------------------------------------

						const body: IDataObject = {
							Last_Name: this.getNodeParameter('lastName', i),
						};

						Object.assign(
							body,
							mapDynamicFieldsToBody(this.getNodeParameter('additionalFields', i)),
						);

						responseData = await zohoApiRequest.call(this, 'POST', '/Contacts', body);
						responseData = responseData.data[0].details;
					} else if (operation === 'delete') {
						// ----------------------------------------
						//             contact: delete
						// ----------------------------------------

						const contactId = this.getNodeParameter('contactId', i);

						const endpoint = `/Contacts/${contactId}`;
						responseData = await zohoApiRequest.call(this, 'DELETE', endpoint);
						responseData = responseData.data[0].details;
					} else if (operation === 'get') {
						// ----------------------------------------
						//               contact: get
						// ----------------------------------------

						const contactId = this.getNodeParameter('contactId', i);

						const endpoint = `/Contacts/${contactId}`;
						responseData = await zohoApiRequest.call(this, 'GET', endpoint);
						responseData = responseData.data;
					} else if (operation === 'getAll') {
						// ----------------------------------------
						//             contact: getAll
						// ----------------------------------------

						const qs: IDataObject = {};
						const options = this.getNodeParameter('options', i) as GetAllFilterOptions;

						addGetAllFilterOptions(qs, options);
						if (!options.fields || options.fields.length === 0) {
							const allFields = await getFieldsForExecution(this, resource as SnakeCaseResource);
							qs.fields = allFields.join(',');
						} else {
							qs.fields = options.fields.join(',');
						}

						responseData = await handleListing.call(this, 'GET', '/Contacts', {}, qs);
					} else if (operation === 'update') {
						// ----------------------------------------
						//             contact: update
						// ----------------------------------------

						const body: IDataObject = {};
						Object.assign(body, mapDynamicFieldsToBody(this.getNodeParameter('updateFields', i)));

						const contactId = this.getNodeParameter('contactId', i);

						const endpoint = `/contacts/${contactId}`;
						responseData = await zohoApiRequest.call(this, 'PUT', endpoint, body);
						responseData = responseData.data[0].details;
					} else if (operation === 'upsert') {
						// ----------------------------------------
						//             contact: upsert
						// ----------------------------------------

						const body: IDataObject = {
							Last_Name: this.getNodeParameter('lastName', i),
						};

						Object.assign(
							body,
							mapDynamicFieldsToBody(this.getNodeParameter('additionalFields', i)),
						);

						responseData = await zohoApiRequest.call(this, 'POST', '/Contacts/upsert', body);
						responseData = responseData.data[0].details;
					}
				} else if (resource === 'deal') {
					// **********************************************************************
					//                                deal
					// **********************************************************************

					// https://www.zoho.com/crm/developer/docs/api/v8/deals-response.html
					// https://help.zoho.com/portal/en/kb/crm/customize-crm-account/customizing-fields/articles/standard-modules-fields#Deals

					if (operation === 'search') {
						// ----------------------------------------
						//             deal: search
						// ----------------------------------------
						const searchFilters = this.getNodeParameter('searchFilters', i);
						const criteria = buildCriteriaFromFilters(searchFilters);
						const qs: IDataObject = { criteria };
						responseData = await zohoApiRequest.call(this, 'GET', '/Deals/search', {}, qs);
						responseData = responseData.data;
					} else if (operation === 'create') {
						// ----------------------------------------
						//               deal: create
						// ----------------------------------------

						const body: IDataObject = {
							Deal_Name: this.getNodeParameter('dealName', i),
							Stage: this.getNodeParameter('stage', i),
						};

						Object.assign(
							body,
							mapDynamicFieldsToBody(this.getNodeParameter('additionalFields', i)),
						);

						responseData = await zohoApiRequest.call(this, 'POST', '/deals', body);
						responseData = responseData.data[0].details;
					} else if (operation === 'delete') {
						// ----------------------------------------
						//               deal: delete
						// ----------------------------------------

						const dealId = this.getNodeParameter('dealId', i);

						responseData = await zohoApiRequest.call(this, 'DELETE', `/deals/${dealId}`);
						responseData = responseData.data[0].details;
					} else if (operation === 'get') {
						// ----------------------------------------
						//                deal: get
						// ----------------------------------------

						const dealId = this.getNodeParameter('dealId', i);

						responseData = await zohoApiRequest.call(this, 'GET', `/Deals/${dealId}`);
						responseData = responseData.data;
					} else if (operation === 'getAll') {
						// ----------------------------------------
						//               deal: getAll
						// ----------------------------------------

						const qs: IDataObject = {};
						const options = this.getNodeParameter('options', i) as GetAllFilterOptions;

						addGetAllFilterOptions(qs, options);
						if (!options.fields || options.fields.length === 0) {
							const allFields = await getFieldsForExecution(this, resource as SnakeCaseResource);
							qs.fields = allFields.join(',');
						} else {
							qs.fields = options.fields.join(',');
						}

						responseData = await handleListing.call(this, 'GET', '/deals', {}, qs);
					} else if (operation === 'update') {
						// ----------------------------------------
						//               deal: update
						// ----------------------------------------

						const body: IDataObject = {};
						Object.assign(body, mapDynamicFieldsToBody(this.getNodeParameter('updateFields', i)));

						const dealId = this.getNodeParameter('dealId', i);

						responseData = await zohoApiRequest.call(this, 'PUT', `/deals/${dealId}`, body);
						responseData = responseData.data[0].details;
					} else if (operation === 'upsert') {
						// ----------------------------------------
						//              deal: upsert
						// ----------------------------------------

						const body: IDataObject = {
							Deal_Name: this.getNodeParameter('dealName', i),
							Stage: this.getNodeParameter('stage', i),
						};

						Object.assign(
							body,
							mapDynamicFieldsToBody(this.getNodeParameter('additionalFields', i)),
						);

						responseData = await zohoApiRequest.call(this, 'POST', '/deals/upsert', body);
						responseData = responseData.data[0].details;
					}
				} else if (resource === 'invoice') {
					// **********************************************************************
					//                                invoice
					// **********************************************************************

					// https://www.zoho.com/crm/developer/docs/api/v8/invoices-response.html
					// https://help.zoho.com/portal/en/kb/crm/customize-crm-account/customizing-fields/articles/standard-modules-fields#Invoices

					if (operation === 'search') {
						// ----------------------------------------
						//             invoice: search
						// ----------------------------------------
						const criteria = this.getNodeParameter('criteria', i) as string;
						const qs: IDataObject = { criteria };
						responseData = await zohoApiRequest.call(this, 'GET', '/Invoices/search', {}, qs);
						responseData = responseData.data;
					} else if (operation === 'create') {
						// ----------------------------------------
						//             invoice: create
						// ----------------------------------------

						const productDetails = this.getNodeParameter('Product_Details', i) as ProductDetails;

						throwOnMissingProducts.call(this, resource, productDetails);

						const body: IDataObject = {
							Subject: this.getNodeParameter('subject', i),
							Product_Details: adjustProductDetails(productDetails),
						};

						const additionalFields = this.getNodeParameter('additionalFields', i);

						if (Object.keys(additionalFields).length) {
							Object.assign(body, adjustInvoicePayload(additionalFields));
						}

						responseData = await zohoApiRequest.call(this, 'POST', '/invoices', body);
						responseData = responseData.data[0].details;
					} else if (operation === 'delete') {
						// ----------------------------------------
						//             invoice: delete
						// ----------------------------------------

						const invoiceId = this.getNodeParameter('invoiceId', i);

						const endpoint = `/invoices/${invoiceId}`;
						responseData = await zohoApiRequest.call(this, 'DELETE', endpoint);
						responseData = responseData.data[0].details;
					} else if (operation === 'get') {
						// ----------------------------------------
						//               invoice: get
						// ----------------------------------------

						const invoiceId = this.getNodeParameter('invoiceId', i);

						const endpoint = `/Invoices/${invoiceId}`;
						responseData = await zohoApiRequest.call(this, 'GET', endpoint);
						responseData = responseData.data;
					} else if (operation === 'getAll') {
						// ----------------------------------------
						//             invoice: getAll
						// ----------------------------------------

						const qs: IDataObject = {};
						const options = this.getNodeParameter('options', i) as GetAllFilterOptions;

						addGetAllFilterOptions(qs, options);
						if (!options.fields || options.fields.length === 0) {
							const allFields = await getFieldsForExecution(this, resource as SnakeCaseResource);
							qs.fields = allFields.join(',');
						} else {
							qs.fields = options.fields.join(',');
						}

						responseData = await handleListing.call(this, 'GET', '/invoices', {}, qs);
					} else if (operation === 'update') {
						// ----------------------------------------
						//             invoice: update
						// ----------------------------------------

						const body: IDataObject = {};
						const updateFields = this.getNodeParameter('updateFields', i);

						if (Object.keys(updateFields).length) {
							Object.assign(body, adjustInvoicePayloadOnUpdate(updateFields));
						} else {
							throwOnEmptyUpdate.call(this, resource);
						}

						const invoiceId = this.getNodeParameter('invoiceId', i);

						const endpoint = `/invoices/${invoiceId}`;

						responseData = await zohoApiRequest.call(this, 'PUT', endpoint, body);
						responseData = responseData.data[0].details;
					} else if (operation === 'upsert') {
						// ----------------------------------------
						//             invoice: upsert
						// ----------------------------------------

						const productDetails = this.getNodeParameter('Product_Details', i) as ProductDetails;

						const body: IDataObject = {
							Subject: this.getNodeParameter('subject', i),
							Product_Details: adjustProductDetails(productDetails),
						};

						const additionalFields = this.getNodeParameter('additionalFields', i);

						if (Object.keys(additionalFields).length) {
							Object.assign(body, adjustInvoicePayload(additionalFields));
						}

						responseData = await zohoApiRequest.call(this, 'POST', '/invoices/upsert', body);
						responseData = responseData.data[0].details;
					}
				} else if (resource === 'lead') {
					// **********************************************************************
					//                                  lead
					// **********************************************************************

					// https://www.zoho.com/crm/developer/docs/api/v8/leads-response.html
					// https://www.zoho.com/crm/developer/docs/api/v8/get-records.html
					// https://help.zoho.com/portal/en/kb/crm/customize-crm-account/customizing-fields/articles/standard-modules-fields#Leads

					if (operation === 'search') {
						// ----------------------------------------
						//             lead: search
						// ----------------------------------------
						const criteria = this.getNodeParameter('criteria', i) as string;
						const qs: IDataObject = { criteria };
						responseData = await zohoApiRequest.call(this, 'GET', '/Leads/search', {}, qs);
						responseData = responseData.data;
					} else if (operation === 'create') {
						// ----------------------------------------
						//               lead: create
						// ----------------------------------------

						const body: IDataObject = {
							Company: this.getNodeParameter('Company', i),
							Last_Name: this.getNodeParameter('lastName', i),
						};

						const additionalFields = this.getNodeParameter('additionalFields', i);

						if (Object.keys(additionalFields).length) {
							Object.assign(body, adjustLeadPayload(additionalFields));
						}

						responseData = await zohoApiRequest.call(this, 'POST', '/leads', body);
						responseData = responseData.data[0].details;
					} else if (operation === 'delete') {
						// ----------------------------------------
						//               lead: delete
						// ----------------------------------------

						const leadId = this.getNodeParameter('leadId', i);

						responseData = await zohoApiRequest.call(this, 'DELETE', `/leads/${leadId}`);
						responseData = responseData.data[0].details;
					} else if (operation === 'get') {
						// ----------------------------------------
						//                lead: get
						// ----------------------------------------

						const leadId = this.getNodeParameter('leadId', i);

						responseData = await zohoApiRequest.call(this, 'GET', `/leads/${leadId}`);
					} else if (operation === 'getAll') {
						// ----------------------------------------
						//               lead: getAll
						// ----------------------------------------

						const qs: IDataObject = {};
						const options = this.getNodeParameter('options', i) as GetAllFilterOptions;

						addGetAllFilterOptions(qs, options);
						if (!options.fields || options.fields.length === 0) {
							const allFields = await getFieldsForExecution(this, resource as SnakeCaseResource);
							qs.fields = allFields.join(',');
						} else {
							qs.fields = options.fields.join(',');
						}

						responseData = await handleListing.call(this, 'GET', '/leads', {}, qs);
					} else if (operation === 'getFields') {
						// ----------------------------------------
						//            lead: getFields
						// ----------------------------------------

						responseData = await zohoApiRequest.call(
							this,
							'GET',
							'/settings/fields',
							{},
							{ module: 'leads' },
						);
						responseData = responseData.fields;
					} else if (operation === 'update') {
						// ----------------------------------------
						//               lead: update
						// ----------------------------------------

						const body: IDataObject = {};
						Object.assign(body, mapDynamicFieldsToBody(this.getNodeParameter('updateFields', i)));

						const leadId = this.getNodeParameter('leadId', i);

						responseData = await zohoApiRequest.call(this, 'PUT', `/leads/${leadId}`, body);
						responseData = responseData.data[0].details;
					} else if (operation === 'upsert') {
						// ----------------------------------------
						//              lead: upsert
						// ----------------------------------------

						const body: IDataObject = {
							Company: this.getNodeParameter('Company', i),
							Last_Name: this.getNodeParameter('lastName', i),
						};

						const additionalFields = this.getNodeParameter('additionalFields', i);

						if (Object.keys(additionalFields).length) {
							Object.assign(body, adjustLeadPayload(additionalFields));
						}

						responseData = await zohoApiRequest.call(this, 'POST', '/leads/upsert', body);
						responseData = responseData.data[0].details;
					}
				} else if (resource === 'product') {
					// **********************************************************************
					//                              product
					// **********************************************************************

					// https://www.zoho.com/crm/developer/docs/api/v8/products-response.html
					// https://help.zoho.com/portal/en/kb/crm/customize-crm-account/customizing-fields/articles/standard-modules-fields#Products

					if (operation === 'search') {
						// ----------------------------------------
						//             product: search
						// ----------------------------------------
						const criteria = this.getNodeParameter('criteria', i) as string;
						const qs: IDataObject = { criteria };
						responseData = await zohoApiRequest.call(this, 'GET', '/Products/search', {}, qs);
						responseData = responseData.data;
					} else if (operation === 'create') {
						// ----------------------------------------
						//             product: create
						// ----------------------------------------

						const body: IDataObject = {
							Product_Name: this.getNodeParameter('productName', i),
						};

						Object.assign(
							body,
							mapDynamicFieldsToBody(this.getNodeParameter('additionalFields', i)),
						);

						responseData = await zohoApiRequest.call(this, 'POST', '/products', body);
						responseData = responseData.data[0].details;
					} else if (operation === 'delete') {
						// ----------------------------------------
						//            product: delete
						// ----------------------------------------

						const productId = this.getNodeParameter('productId', i);

						const endpoint = `/products/${productId}`;
						responseData = await zohoApiRequest.call(this, 'DELETE', endpoint);
						responseData = responseData.data[0].details;
					} else if (operation === 'get') {
						// ----------------------------------------
						//              product: get
						// ----------------------------------------

						const productId = this.getNodeParameter('productId', i);

						const endpoint = `/products/${productId}`;
						responseData = await zohoApiRequest.call(this, 'GET', endpoint);
						responseData = responseData.data;
					} else if (operation === 'getAll') {
						// ----------------------------------------
						//            product: getAll
						// ----------------------------------------

						const qs: IDataObject = {};
						const options = this.getNodeParameter('options', i) as GetAllFilterOptions;

						addGetAllFilterOptions(qs, options);
						if (!options.fields || options.fields.length === 0) {
							const allFields = await getFieldsForExecution(this, resource as SnakeCaseResource);
							qs.fields = allFields.join(',');
						} else {
							qs.fields = options.fields.join(',');
						}

						responseData = await handleListing.call(this, 'GET', '/products', {}, qs);
					} else if (operation === 'update') {
						// ----------------------------------------
						//            product: update
						// ----------------------------------------

						const body: IDataObject = {};
						Object.assign(body, mapDynamicFieldsToBody(this.getNodeParameter('updateFields', i)));

						const productId = this.getNodeParameter('productId', i);

						const endpoint = `/products/${productId}`;
						responseData = await zohoApiRequest.call(this, 'PUT', endpoint, body);
						responseData = responseData.data[0].details;
					} else if (operation === 'upsert') {
						// ----------------------------------------
						//             product: upsert
						// ----------------------------------------

						const body: IDataObject = {
							Product_Name: this.getNodeParameter('productName', i),
						};

						Object.assign(
							body,
							mapDynamicFieldsToBody(this.getNodeParameter('additionalFields', i)),
						);

						responseData = await zohoApiRequest.call(this, 'POST', '/products/upsert', body);
						responseData = responseData.data[0].details;
					}
				} else if (resource === 'purchaseOrder') {
					// **********************************************************************
					//                             purchaseOrder
					// **********************************************************************

					// https://www.zoho.com/crm/developer/docs/api/v8/purchase-orders-response.html
					// https://help.zoho.com/portal/en/kb/crm/customize-crm-account/customizing-fields/articles/standard-modules-fields#Purchase_Order

					if (operation === 'search') {
						// ----------------------------------------
						//         purchaseOrder: search
						// ----------------------------------------
						const criteria = this.getNodeParameter('criteria', i) as string;
						const qs: IDataObject = { criteria };
						responseData = await zohoApiRequest.call(
							this,
							'GET',
							'/Purchase_Orders/search',
							{},
							qs,
						);
						responseData = responseData.data;
					} else if (operation === 'create') {
						// ----------------------------------------
						//          purchaseOrder: create
						// ----------------------------------------

						const productDetails = this.getNodeParameter('Product_Details', i) as ProductDetails;

						throwOnMissingProducts.call(this, resource, productDetails);

						const body: IDataObject = {
							Subject: this.getNodeParameter('subject', i),
							Vendor_Name: { id: this.getNodeParameter('vendorId', i) },
							Product_Details: adjustProductDetails(productDetails),
						};

						const additionalFields = this.getNodeParameter('additionalFields', i);

						if (Object.keys(additionalFields).length) {
							Object.assign(body, adjustPurchaseOrderPayload(additionalFields));
						}

						responseData = await zohoApiRequest.call(this, 'POST', '/purchase_orders', body);
						responseData = responseData.data[0].details;
					} else if (operation === 'delete') {
						// ----------------------------------------
						//          purchaseOrder: delete
						// ----------------------------------------

						const purchaseOrderId = this.getNodeParameter('purchaseOrderId', i);

						const endpoint = `/purchase_orders/${purchaseOrderId}`;
						responseData = await zohoApiRequest.call(this, 'DELETE', endpoint);
						responseData = responseData.data[0].details;
					} else if (operation === 'get') {
						// ----------------------------------------
						//            purchaseOrder: get
						// ----------------------------------------

						const purchaseOrderId = this.getNodeParameter('purchaseOrderId', i);

						const endpoint = `/Purchase_Orders/${purchaseOrderId}`;
						responseData = await zohoApiRequest.call(this, 'GET', endpoint);
						responseData = responseData.data;
					} else if (operation === 'getAll') {
						// ----------------------------------------
						//          purchaseOrder: getAll
						// ----------------------------------------

						const qs: IDataObject = {};
						const options = this.getNodeParameter('options', i) as GetAllFilterOptions;

						addGetAllFilterOptions(qs, options);
						if (!options.fields || options.fields.length === 0) {
							const allFields = await getFieldsForExecution(this, resource as SnakeCaseResource);
							qs.fields = allFields.join(',');
						} else {
							qs.fields = options.fields.join(',');
						}

						responseData = await handleListing.call(this, 'GET', '/purchase_orders', {}, qs);
					} else if (operation === 'update') {
						// ----------------------------------------
						//          purchaseOrder: update
						// ----------------------------------------

						const body: IDataObject = {};
						Object.assign(body, mapDynamicFieldsToBody(this.getNodeParameter('updateFields', i)));

						const purchaseOrderId = this.getNodeParameter('purchaseOrderId', i);

						const endpoint = `/purchase_orders/${purchaseOrderId}`;
						responseData = await zohoApiRequest.call(this, 'PUT', endpoint, body);
						responseData = responseData.data[0].details;
					} else if (operation === 'upsert') {
						// ----------------------------------------
						//          purchaseOrder: upsert
						// ----------------------------------------

						const productDetails = this.getNodeParameter('Product_Details', i) as ProductDetails;

						const body: IDataObject = {
							Subject: this.getNodeParameter('subject', i),
							Vendor_Name: { id: this.getNodeParameter('vendorId', i) },
							Product_Details: adjustProductDetails(productDetails),
						};

						const additionalFields = this.getNodeParameter('additionalFields', i);

						if (Object.keys(additionalFields).length) {
							Object.assign(body, adjustPurchaseOrderPayload(additionalFields));
						}

						responseData = await zohoApiRequest.call(this, 'POST', '/purchase_orders/upsert', body);
						responseData = responseData.data[0].details;
					}
				} else if (resource === 'quote') {
					// **********************************************************************
					//                                 quote
					// **********************************************************************

					// https://www.zoho.com/crm/developer/docs/api/v8/quotes-response.html
					// https://help.zoho.com/portal/en/kb/crm/customize-crm-account/customizing-fields/articles/standard-modules-fields#Quotes

					if (operation === 'search') {
						// ----------------------------------------
						//             quote: search
						// ----------------------------------------
						const criteria = this.getNodeParameter('criteria', i) as string;
						const qs: IDataObject = { criteria };
						responseData = await zohoApiRequest.call(this, 'GET', '/Quotes/search', {}, qs);
						responseData = responseData.data;
					} else if (operation === 'create') {
						// ----------------------------------------
						//              quote: create
						// ----------------------------------------

						const productDetails = this.getNodeParameter('Product_Details', i) as ProductDetails;

						throwOnMissingProducts.call(this, resource, productDetails);

						const body: IDataObject = {
							Subject: this.getNodeParameter('subject', i),
							Product_Details: adjustProductDetails(productDetails),
						};

						const additionalFields = this.getNodeParameter('additionalFields', i);

						if (Object.keys(additionalFields).length) {
							Object.assign(body, adjustQuotePayload(additionalFields));
						}

						responseData = await zohoApiRequest.call(this, 'POST', '/quotes', body);
						responseData = responseData.data[0].details;
					} else if (operation === 'delete') {
						// ----------------------------------------
						//              quote: delete
						// ----------------------------------------

						const quoteId = this.getNodeParameter('quoteId', i);

						responseData = await zohoApiRequest.call(this, 'DELETE', `/quotes/${quoteId}`);
						responseData = responseData.data[0].details;
					} else if (operation === 'get') {
						// ----------------------------------------
						//                quote: get
						// ----------------------------------------

						const quoteId = this.getNodeParameter('quoteId', i);

						responseData = await zohoApiRequest.call(this, 'GET', `/Quotes/${quoteId}`);
						responseData = responseData.data;
					} else if (operation === 'getAll') {
						// ----------------------------------------
						//              quote: getAll
						// ----------------------------------------

						const qs: IDataObject = {};
						const options = this.getNodeParameter('options', i) as GetAllFilterOptions;

						addGetAllFilterOptions(qs, options);
						if (!options.fields || options.fields.length === 0) {
							const allFields = await getFieldsForExecution(this, resource as SnakeCaseResource);
							qs.fields = allFields.join(',');
						} else {
							qs.fields = options.fields.join(',');
						}

						responseData = await handleListing.call(this, 'GET', '/quotes', {}, qs);
					} else if (operation === 'update') {
						// ----------------------------------------
						//              quote: update
						// ----------------------------------------

						const body: IDataObject = {};
						Object.assign(body, mapDynamicFieldsToBody(this.getNodeParameter('updateFields', i)));

						const quoteId = this.getNodeParameter('quoteId', i);

						responseData = await zohoApiRequest.call(this, 'PUT', `/quotes/${quoteId}`, body);
						responseData = responseData.data[0].details;
					} else if (operation === 'upsert') {
						// ----------------------------------------
						//              quote: upsert
						// ----------------------------------------

						const productDetails = this.getNodeParameter('Product_Details', i) as ProductDetails;

						const body: IDataObject = {
							Subject: this.getNodeParameter('subject', i),
							Product_Details: adjustProductDetails(productDetails),
						};

						const additionalFields = this.getNodeParameter('additionalFields', i);

						if (Object.keys(additionalFields).length) {
							Object.assign(body, adjustQuotePayload(additionalFields));
						}

						responseData = await zohoApiRequest.call(this, 'POST', '/quotes/upsert', body);
						responseData = responseData.data[0].details;
					}
				} else if (resource === 'salesOrder') {
					// **********************************************************************
					//                               salesOrder
					// **********************************************************************

					// https://www.zoho.com/crm/developer/docs/api/v8/sales-orders-response.html
					// https://help.zoho.com/portal/en/kb/crm/customize-crm-account/customizing-fields/articles/standard-modules-fields#Sales_Orders

					if (operation === 'search') {
						// ----------------------------------------
						//         salesOrder: search
						// ----------------------------------------
						const criteria = this.getNodeParameter('criteria', i) as string;
						const qs: IDataObject = { criteria };
						responseData = await zohoApiRequest.call(this, 'GET', '/Sales_Orders/search', {}, qs);
						responseData = responseData.data;
					} else if (operation === 'create') {
						// ----------------------------------------
						//            salesOrder: create
						// ----------------------------------------

						const productDetails = this.getNodeParameter('Product_Details', i) as ProductDetails;

						const body: IDataObject = {
							Account_Name: { id: this.getNodeParameter('accountId', i) },
							Subject: this.getNodeParameter('subject', i),
							Product_Details: adjustProductDetails(productDetails),
						};

						const additionalFields = this.getNodeParameter('additionalFields', i);

						if (Object.keys(additionalFields).length) {
							Object.assign(body, adjustSalesOrderPayload(additionalFields));
						}

						responseData = await zohoApiRequest.call(this, 'POST', '/sales_orders', body);
						responseData = responseData.data[0].details;
					} else if (operation === 'delete') {
						// ----------------------------------------
						//            salesOrder: delete
						// ----------------------------------------

						const salesOrderId = this.getNodeParameter('salesOrderId', i);

						const endpoint = `/sales_orders/${salesOrderId}`;
						responseData = await zohoApiRequest.call(this, 'DELETE', endpoint);
						responseData = responseData.data[0].details;
					} else if (operation === 'get') {
						// ----------------------------------------
						//             salesOrder: get
						// ----------------------------------------

						const salesOrderId = this.getNodeParameter('salesOrderId', i);

						const endpoint = `/Sales_Orders/${salesOrderId}`;
						responseData = await zohoApiRequest.call(this, 'GET', endpoint);
						responseData = responseData.data;
					} else if (operation === 'getAll') {
						// ----------------------------------------
						//            salesOrder: getAll
						// ----------------------------------------

						const qs: IDataObject = {};
						const options = this.getNodeParameter('options', i) as GetAllFilterOptions;

						addGetAllFilterOptions(qs, options);
						if (!options.fields || options.fields.length === 0) {
							const allFields = await getFieldsForExecution(this, resource as SnakeCaseResource);
							qs.fields = allFields.join(',');
						} else {
							qs.fields = options.fields.join(',');
						}

						responseData = await handleListing.call(this, 'GET', '/sales_orders', {}, qs);
					} else if (operation === 'update') {
						// ----------------------------------------
						//            salesOrder: update
						// ----------------------------------------

						const body: IDataObject = {};
						Object.assign(body, mapDynamicFieldsToBody(this.getNodeParameter('updateFields', i)));

						const salesOrderId = this.getNodeParameter('salesOrderId', i);

						const endpoint = `/sales_orders/${salesOrderId}`;
						responseData = await zohoApiRequest.call(this, 'PUT', endpoint, body);
						responseData = responseData.data[0].details;
					} else if (operation === 'upsert') {
						// ----------------------------------------
						//           salesOrder: upsert
						// ----------------------------------------

						const productDetails = this.getNodeParameter('Product_Details', i) as ProductDetails;

						const body: IDataObject = {
							Account_Name: { id: this.getNodeParameter('accountId', i) },
							Subject: this.getNodeParameter('subject', i),
							Product_Details: adjustProductDetails(productDetails, 'upsert'),
						};

						const additionalFields = this.getNodeParameter('additionalFields', i);

						if (Object.keys(additionalFields).length) {
							Object.assign(body, adjustSalesOrderPayload(additionalFields));
						}

						responseData = await zohoApiRequest.call(this, 'POST', '/sales_orders/upsert', body);
						responseData = responseData.data[0].details;
					}
				} else if (resource === 'vendor') {
					// **********************************************************************
					//                               vendor
					// **********************************************************************

					// https://www.zoho.com/crm/developer/docs/api/v8/vendors-response.html
					// https://help.zoho.com/portal/en/kb/crm/customize-crm-account/customizing-fields/articles/standard-modules-fields#Vendors

					if (operation === 'search') {
						// ----------------------------------------
						//             vendor: search
						// ----------------------------------------
						const criteria = this.getNodeParameter('criteria', i) as string;
						const qs: IDataObject = { criteria };
						responseData = await zohoApiRequest.call(this, 'GET', '/Vendors/search', {}, qs);
						responseData = responseData.data;
					} else if (operation === 'create') {
						// ----------------------------------------
						//            vendor: create
						// ----------------------------------------

						const body: IDataObject = {
							Vendor_Name: this.getNodeParameter('vendorName', i),
						};

						const additionalFields = this.getNodeParameter('additionalFields', i);

						if (Object.keys(additionalFields).length) {
							Object.assign(body, adjustVendorPayload(additionalFields));
						}

						responseData = await zohoApiRequest.call(this, 'POST', '/vendors', body);
						responseData = responseData.data[0].details;
					} else if (operation === 'delete') {
						// ----------------------------------------
						//            vendor: delete
						// ----------------------------------------

						const vendorId = this.getNodeParameter('vendorId', i);

						const endpoint = `/vendors/${vendorId}`;
						responseData = await zohoApiRequest.call(this, 'DELETE', endpoint);
						responseData = responseData.data[0].details;
					} else if (operation === 'get') {
						// ----------------------------------------
						//             vendor: get
						// ----------------------------------------

						const vendorId = this.getNodeParameter('vendorId', i);

						const endpoint = `/Vendors/${vendorId}`;
						responseData = await zohoApiRequest.call(this, 'GET', endpoint);
						responseData = responseData.data;
					} else if (operation === 'getAll') {
						// ----------------------------------------
						//            vendor: getAll
						// ----------------------------------------

						const qs: IDataObject = {};
						const options = this.getNodeParameter('options', i) as GetAllFilterOptions;

						addGetAllFilterOptions(qs, options);
						if (!options.fields || options.fields.length === 0) {
							const allFields = await getFieldsForExecution(this, resource as SnakeCaseResource);
							qs.fields = allFields.join(',');
						} else {
							qs.fields = options.fields.join(',');
						}

						responseData = await handleListing.call(this, 'GET', '/vendors', {}, qs);
					} else if (operation === 'update') {
						// ----------------------------------------
						//            vendor: update
						// ----------------------------------------

						const body: IDataObject = {};
						Object.assign(body, mapDynamicFieldsToBody(this.getNodeParameter('updateFields', i)));

						const vendorId = this.getNodeParameter('vendorId', i);

						const endpoint = `/vendors/${vendorId}`;
						responseData = await zohoApiRequest.call(this, 'PUT', endpoint, body);
						responseData = responseData.data[0].details;
					} else if (operation === 'upsert') {
						// ----------------------------------------
						//             vendor: upsert
						// ----------------------------------------

						const body: IDataObject = {
							Vendor_Name: this.getNodeParameter('vendorName', i),
						};

						const additionalFields = this.getNodeParameter('additionalFields', i);

						if (Object.keys(additionalFields).length) {
							Object.assign(body, adjustVendorPayload(additionalFields));
						}

						responseData = await zohoApiRequest.call(this, 'POST', '/vendors/upsert', body);
						responseData = responseData.data[0].details;
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ error: error.message, json: {} });
					continue;
				}
				throw error;
			}
			const executionData = this.helpers.constructExecutionMetaData(
				this.helpers.returnJsonArray(responseData as IDataObject),
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		}

		return [returnData];
	}
}

// Helper to map dynamic additional/update fields to body
function mapDynamicFieldsToBody(fieldsCollection: any): IDataObject {
	const body: IDataObject = {};
	if (fieldsCollection && Array.isArray(fieldsCollection.fields)) {
		for (const { field, value } of fieldsCollection.fields) {
			if (field) body[field] = value;
		}
	}
	return body;
}

// Helper to build criteria string from dynamic search filters, enforcing Zoho operator support
async function buildCriteriaFromFilters(
	filtersCollection: any,
	nodeContext?: ILoadOptionsFunctions,
	resource?: SnakeCaseResource,
): Promise<string> {
	if (!filtersCollection || !Array.isArray(filtersCollection.filters)) return '';

	// Supported operators by Zoho field type
	const zohoSupportedOperators: Record<string, string[]> = {
		text: ['equals', 'not_equal', 'starts_with', 'in'],
		email: ['equals', 'not_equal', 'starts_with', 'in'],
		phone: ['equals', 'not_equal', 'starts_with', 'in'],
		website: ['equals', 'not_equal', 'starts_with', 'in'],
		picklist: ['equals', 'not_equal', 'in'],
		autonumber: ['equals', 'not_equal', 'in'],
		date: [
			'equals',
			'not_equal',
			'greater_equal',
			'greater_than',
			'less_equal',
			'less_than',
			'between',
			'in',
		],
		datetime: [
			'equals',
			'not_equal',
			'greater_equal',
			'greater_than',
			'less_equal',
			'less_than',
			'between',
			'in',
		],
		integer: [
			'equals',
			'not_equal',
			'greater_equal',
			'greater_than',
			'less_equal',
			'less_than',
			'between',
			'in',
		],
		currency: [
			'equals',
			'not_equal',
			'greater_equal',
			'greater_than',
			'less_equal',
			'less_than',
			'between',
			'in',
		],
		decimal: [
			'equals',
			'not_equal',
			'greater_equal',
			'greater_than',
			'less_equal',
			'less_than',
			'between',
			'in',
		],
		boolean: ['equals', 'not_equal'],
		textarea: ['equals', 'not_equal', 'starts_with'],
		lookup: ['equals', 'not_equal', 'in'],
		owner_lookup: ['equals', 'not_equal', 'in'],
		user_lookup: ['equals', 'not_equal', 'in'],
		multiselectpicklist: ['equals', 'not_equal', 'in', 'starts_with'],
		bigint: [
			'equals',
			'not_equal',
			'greater_than',
			'greater_equal',
			'less_than',
			'less_equal',
			'between',
			'in',
		],
		percent: [
			'equals',
			'not_equal',
			'greater_than',
			'greater_equal',
			'less_than',
			'less_equal',
			'between',
			'in',
		],
		// formula: [], // Not handled for now
	};

	// Get field metadata for the resource
	let fieldMeta: Record<string, { data_type: string }> = {};
	if (nodeContext && resource) {
		try {
			const fields = await getFields.call(nodeContext, resource);
			for (const f of fields) {
				// Defensive: check for data_type property
				if (f.value && typeof (f as any).data_type === 'string') {
					fieldMeta[f.value] = { data_type: (f as any).data_type };
				}
			}
		} catch (e) {
			// fallback: no type validation
		}
	}

	// Map UI operator to Zoho operator (UI may use not_equals, Zoho expects not_equal)
	const operatorMap: Record<string, string> = {
		equals: 'equals',
		not_equals: 'not_equal',
		not_equal: 'not_equal',
		contains: 'contains', // not supported by Zoho search
		not_contains: 'not_contains', // not supported by Zoho search
		starts_with: 'starts_with',
		ends_with: 'ends_with', // not supported by Zoho search
		greater_than: 'greater_than',
		less_than: 'less_than',
		greater_equal: 'greater_equal',
		less_equal: 'less_equal',
		is_empty: 'is_empty', // not supported by Zoho search
		is_not_empty: 'is_not_empty', // not supported by Zoho search
		between: 'between',
		in: 'in',
	};

	const unsupportedOperators = [
		'contains',
		'not_contains',
		'ends_with',
		'is_empty',
		'is_not_empty',
	];

	const criteriaParts: string[] = [];
	for (const filter of filtersCollection.filters) {
		const { field, operator, value } = filter;
		const zohoOperator = operatorMap[operator];
		if (!zohoOperator || unsupportedOperators.includes(operator)) {
			throw new Error(`Operator '${operator}' is not supported by Zoho Search API.`);
		}
		let fieldType = fieldMeta[field]?.data_type;
		if (!fieldType && nodeContext && resource) {
			// fallback: try to get type from getFields again
			try {
				const fields = await getFields.call(nodeContext, resource);
				const found = fields.find((f: any) => f.value === field);
				if (found && typeof (found as any).data_type === 'string')
					fieldType = (found as any).data_type;
			} catch {}
		}
		if (!fieldType) {
			// fallback: allow, but warn in error if Zoho rejects
			fieldType = 'text'; // default to text for validation
		}
		const allowedOps = zohoSupportedOperators[fieldType] || [];
		if (!allowedOps.includes(zohoOperator)) {
			throw new Error(
				`Operator '${operator}' is not allowed for field '${field}' of type '${fieldType}'. Allowed: ${allowedOps.join(', ')}. (Field type could not be determined, so 'text' was assumed.)`,
			);
		}
		// Build criteria
		if (zohoOperator === 'in' && Array.isArray(value)) {
			criteriaParts.push(`${field}:in:${value.join(',')}`);
		} else if (zohoOperator === 'between' && Array.isArray(value) && value.length === 2) {
			criteriaParts.push(`${field}:between:${value[0]},${value[1]}`);
		} else {
			criteriaParts.push(`${field}:${zohoOperator}:${value}`);
		}
	}
	return criteriaParts.join('and');
}
