import type { INodeProperties } from 'n8n-workflow';

import {
	address,
	currencies,
	makeCustomFieldsFixedCollection,
	makeGetAllFields,
} from './SharedFields';

export const vendorOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['vendor'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a vendor',
				action: 'Create a vendor',
			},
			{
				name: 'Search',
				value: 'search',
				description: 'Search for vendors',
				action: 'Search vendors',
			},
			{
				name: 'Create or Update',
				value: 'upsert',
				description: 'Create a new record, or update the current one if it already exists (upsert)',
				action: 'Create or update a vendor',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a vendor',
				action: 'Delete a vendor',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a vendor',
				action: 'Get a vendor',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many vendors',
				action: 'Get many vendors',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a vendor',
				action: 'Update a vendor',
			},
		],
		default: 'create',
	},
];

export const vendorFields: INodeProperties[] = [
	// ----------------------------------------
	//           vendor: search
	// ----------------------------------------
	{
		displayName: 'Search Filters',
		name: 'searchFilters',
		type: 'fixedCollection',
		placeholder: 'Add Filter',
		default: {},
		typeOptions: {
			multipleValues: true,
		},
		displayOptions: {
			show: {
				resource: ['vendor'],
				operation: ['search'],
			},
		},
		options: [
			{
				displayName: 'Filter',
				name: 'filters',
				values: [
					{
						displayName: 'Field',
						name: 'field',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getFields',
							loadOptionsDependsOn: ['resource'],
						},
						default: '',
						description: 'Field to filter by',
					},
					{
						displayName: 'Operator',
						name: 'operator',
						type: 'options',
						options: [
							{ name: 'Equals', value: 'equals' },
							{ name: 'Not Equals', value: 'not_equals' },
							{ name: 'Contains', value: 'contains' },
							{ name: 'Does Not Contain', value: 'not_contains' },
							{ name: 'Starts With', value: 'starts_with' },
							{ name: 'Ends With', value: 'ends_with' },
							{ name: 'Greater Than', value: 'greater_than' },
							{ name: 'Less Than', value: 'less_than' },
							{ name: 'Greater or Equal', value: 'greater_equal' },
							{ name: 'Less or Equal', value: 'less_equal' },
							{ name: 'Is Empty', value: 'is_empty' },
							{ name: 'Is Not Empty', value: 'is_not_empty' },
						],
						default: 'equals',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						description: 'Value to compare',
						displayOptions: {
							hide: {
								operator: ['is_empty', 'is_not_empty'],
							},
						},
					},
				],
			},
		],
	},
	// ----------------------------------------
	//            vendor: create
	// ----------------------------------------
	{
		displayName: 'Vendor Name',
		name: 'vendorName',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['vendor'],
				operation: ['create'],
			},
		},
	},

	// ----------------------------------------
	//           vendor: upsert
	// ----------------------------------------
	{
		displayName: 'Vendor Name',
		name: 'vendorName',
		description:
			'Name of the vendor. If a record with this vendor name exists it will be updated, otherwise a new one will be created.',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['vendor'],
				operation: ['upsert'],
			},
		},
	},

	// ----------------------------------------
	//         vendor: create + upsert
	// ----------------------------------------
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'fixedCollection',
		placeholder: 'Add Field',
		default: {},
		typeOptions: {
			multipleValues: true,
		},
		displayOptions: {
			show: {
				resource: ['vendor'],
				operation: ['create', 'upsert'],
			},
		},
		options: [
			{
				displayName: 'Field',
				name: 'fields',
				values: [
					{
						displayName: 'Field',
						name: 'field',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getFields',
							loadOptionsDependsOn: ['resource'],
						},
						default: '',
						description: 'Field to set',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						description: 'Value to set',
					},
				],
			},
		],
	},
	// ----------------------------------------
	//             vendor: delete
	// ----------------------------------------
	{
		displayName: 'Vendor ID',
		name: 'vendorId',
		description: 'ID of the vendor to delete',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['vendor'],
				operation: ['delete'],
			},
		},
	},

	// ----------------------------------------
	//               vendor: get
	// ----------------------------------------
	{
		displayName: 'Vendor ID',
		name: 'vendorId',
		description: 'ID of the vendor to retrieve',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['vendor'],
				operation: ['get'],
			},
		},
	},

	// ----------------------------------------
	//             vendor: getAll
	// ----------------------------------------
	...makeGetAllFields('vendor'),

	// ----------------------------------------
	//             vendor: update
	// ----------------------------------------
	{
		displayName: 'Vendor ID',
		name: 'vendorId',
		description: 'ID of the vendor to update',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['vendor'],
				operation: ['update'],
			},
		},
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['vendor'],
				operation: ['update'],
			},
		},
		options: [
			address,
			{
				displayName: 'Category',
				name: 'Category',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Currency',
				name: 'Currency',
				type: 'string',
				default: '',
			},
			makeCustomFieldsFixedCollection('vendor'),
			{
				displayName: 'Description',
				name: 'Description',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Email',
				name: 'Email',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Phone',
				name: 'Phone',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Vendor Name',
				name: 'Vendor_Name',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Website',
				name: 'Website',
				type: 'string',
				default: '',
			},
		],
	},
];
