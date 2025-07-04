import type { INodeProperties } from 'n8n-workflow';

import { currencies, makeCustomFieldsFixedCollection, makeGetAllFields } from './SharedFields';

export const dealOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['deal'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a deal',
				action: 'Create a deal',
			},
			{
				name: 'Search',
				value: 'search',
				description: 'Search for deals',
				action: 'Search deals',
			},
			{
				name: 'Create or Update',
				value: 'upsert',
				description: 'Create a new record, or update the current one if it already exists (upsert)',
				action: 'Create or Update a deal',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a contact',
				action: 'Delete a deal',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a contact',
				action: 'Get a deal',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many contacts',
				action: 'Get many deals',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a contact',
				action: 'Update a deal',
			},
		],
		default: 'create',
	},
];

export const dealFields: INodeProperties[] = [
	// ----------------------------------------
	//              deal: search
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
				resource: ['deal'],
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
	//              deal: create
	// ----------------------------------------
	{
		displayName: 'Deal Name',
		name: 'dealName',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['deal'],
				operation: ['create'],
			},
		},
	},

	// ----------------------------------------
	//             deal: upsert
	// ----------------------------------------
	{
		displayName: 'Deal Name',
		name: 'dealName',
		description:
			'Name of the deal. If a record with this deal name exists it will be updated, otherwise a new one will be created.',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['deal'],
				operation: ['upsert'],
			},
		},
	},
	// ----------------------------------------
	//          deal: create + upsert
	// ----------------------------------------
	{
		displayName: 'Stage Name or ID',
		name: 'stage',
		type: 'options',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		required: true,
		default: [],
		typeOptions: {
			loadOptionsMethod: 'getDealStage',
		},
		displayOptions: {
			show: {
				resource: ['deal'],
				operation: ['create', 'upsert'],
			},
		},
	},
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
				resource: ['deal'],
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
	//               deal: delete
	// ----------------------------------------
	{
		displayName: 'Deal ID',
		name: 'dealId',
		description: 'ID of the deal to delete',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['deal'],
				operation: ['delete'],
			},
		},
	},

	// ----------------------------------------
	//                deal: get
	// ----------------------------------------
	{
		displayName: 'Deal ID',
		name: 'dealId',
		description: 'ID of the deal to retrieve',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['deal'],
				operation: ['get'],
			},
		},
	},

	// ----------------------------------------
	//               deal: getAll
	// ----------------------------------------
	...makeGetAllFields('deal'),

	// ----------------------------------------
	//               deal: update
	// ----------------------------------------
	{
		displayName: 'Deal ID',
		name: 'dealId',
		description: 'ID of the deal to update',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['deal'],
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
				resource: ['deal'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Amount',
				name: 'Amount',
				type: 'number',
				default: '',
				description: 'Monetary amount of the deal',
			},
			{
				displayName: 'Closing Date',
				name: 'Closing_Date',
				type: 'dateTime',
				default: '',
			},
			{
				displayName: 'Currency',
				name: 'Currency',
				type: 'string',
				default: '',
				description: 'Symbol of the currency in which revenue is generated',
			},
			makeCustomFieldsFixedCollection('deal'),
			{
				displayName: 'Deal Name',
				name: 'Deal_Name',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Description',
				name: 'Description',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Lead Conversion Time',
				name: 'Lead_Conversion_Time',
				type: 'number',
				default: '',
				description: 'Average number of days to convert the lead into a deal',
			},
			{
				displayName: 'Next Step',
				name: 'Next_Step',
				type: 'string',
				default: '',
				description: 'Description of the next step in the sales process',
			},
			{
				displayName: 'Overall Sales Duration',
				name: 'Overall_Sales_Duration',
				type: 'number',
				default: '',
				description: 'Average number of days to convert the lead into a deal and to win the deal',
			},
			{
				displayName: 'Probability',
				name: 'Probability',
				type: 'number',
				typeOptions: {
					minValue: 0,
					maxValue: 100,
				},
				default: '',
				description: 'Probability of deal closure as a percentage. For example, enter 12 for 12%.',
			},
			{
				displayName: 'Sales Cycle Duration',
				name: 'Sales_Cycle_Duration',
				type: 'number',
				default: 0,
				description: 'Average number of days to win the deal',
			},
			{
				displayName: 'Stage Name or ID',
				name: 'Stage',
				type: 'options',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: {
					loadOptionsMethod: 'getDealStage',
				},
				default: [],
			},
		],
	},
];
