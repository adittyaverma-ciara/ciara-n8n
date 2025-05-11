import {
	INodeType,
	INodeTypeDescription,
	IExecuteFunctions,
	INodeExecutionData,
	NodeConnectionType,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';
import { getDbConnection } from '@utils/db';

export class Contact implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Contact',
		name: 'contact',
		group: ['transform'],
		version: 1,
		description: 'Import Contacts from CRM.',
		defaults: {
			name: 'Contact',
			color: '#1F72E5',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		properties: [
			{
				displayName: 'Segment',
				name: 'segmentId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getSegments',
				},
				default: '',
				description: 'Select a Segment',
			},
		],
	};

	methods = {
		loadOptions: {
			async getSegments(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const objectInfo = Object.assign(this);
				const userId = objectInfo?.additionalData?.userId;
				let result: { name: string; value: number }[] = [];

				if (userId) {
					const connection = await getDbConnection();
					let [company] = await connection.execute(
						'SELECT * FROM companies WHERE workflow_acc_id = ?',
						[userId],
					);
					company = company as any[];
					const companyInfo = company[0] as any;
					const companyId = companyInfo.id;

					const [rows] = await connection.execute(
						'SELECT id, name FROM segments WHERE company_id = ? AND status = ?',
						[companyId, 'active'],
					);

					result = (rows as { id: number; name: string }[]).map((row) => ({
						name: row.name,
						value: row.id,
					}));
				}

				return result;
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const connection = await getDbConnection();
		const segmentId = this.getNodeParameter('segmentId', 0) as number;

		let segment,
			contacts: any[] = [];
		if (segmentId) {
			segment = await fetchSegment(connection, segmentId);
			console.log({ segmentId, segment });
		} else return [[{ json: { message: 'No active SegmentId found.' } }]];
		if (segment) {
			const segmentLabelId = (
				segment.filter_metadata?.find((f: any) => f.slug === 'labels')?.value || []
			).map((id: any) => Number(id));

			const inputData = this.getInputData();

			// const leads = nodeFieldMapping(inputData);
			// console.log(leads);

			const objectInfo = Object.assign(this);

			// find a contact crm source
			type NodeInfo = { type: string; name?: string };

			const matchedLabel = Object.values(
				objectInfo.workflow.nodes as Record<string, NodeInfo>,
			).find((node) => getNodeTypeLabel(node.type) !== 'other')?.type;

			const crmSource = matchedLabel ? getNodeTypeLabel(matchedLabel) : 'other';
			const leads_crm = CRMFieldMapping(crmSource, inputData);
			console.log(leads_crm);

			if (Array.isArray(leads_crm) && leads_crm.length > 0) {
				await Promise.all(
					leads_crm.map((lead) =>
						createLead(connection, segment.company_id, segmentLabelId, {
							...lead,
							company_id: segment.company_id,
						}),
					),
				);
			}
		}

		return [
			[
				{
					json: {
						segmentId,
						contacts,
					},
				},
			],
		];
	}
}

function getNodeTypeLabel(nodeType: string): string {
	switch (nodeType) {
		case 'n8n-nodes-base.zohoCrm':
			return 'zoho';
		case 'n8n-nodes-base.email':
			return 'email';
		default:
			return 'other';
	}
}

function nodeFieldMapping(inputData: any[]) {
	const leadFields = ['company_name', 'name', 'phone_number', 'email', 'crm_id'];
	return inputData.map((input) => {
		return leadFields.reduce(
			(acc, field) => {
				acc[field] = input.json[field];
				return acc;
			},
			{} as Record<string, any>,
		);
	});
}

function CRMFieldMapping(source: string, inputData: any[]) {
	switch (source) {
		case 'zoho':
			return inputData.map((input) => {
				return {
					company_name: input.json['Company'],
					name: input.json['First_Name'],
					phone_number: input.json['Phone'],
					email: input.json['Email'],
					// "crm_metadata": { "id": input.json["id"] },
				};
			});
	}
}

// 🔹 Fetch Segment details from DB
async function fetchSegment(connection: any, segmentId: number) {
	const [results] = await connection.execute(
		`SELECT *
			FROM segments
 			WHERE id = ?`, // AND sa.status = 'ACTIVE' // need to check
		[segmentId],
	);
	return results.length ? results[0] : null;
}

// 🔹 Assign label to lead
async function assignLabelToLead(connection: any, leadId: number, companyId: number, labelId: any) {
	if (Array.isArray(labelId) && labelId.length > 0) {
		await Promise.all(
			labelId.map((id) =>
				connection.execute(
					`INSERT INTO customers_and_leads_labels (
					label_id, customers_and_leads_id, company_id
				) VALUES (?, ?, ?)`,
					[id, leadId, companyId],
				),
			),
		);
	} else {
		const [result]: any = await connection.execute(
			`INSERT INTO customers_and_leads_labels (
			label_id, customers_and_leads_id, company_id
		) VALUES (?, ?, ?)`,
			[labelId, leadId, companyId],
		);
	}
}

// 🔹 Create a lead
async function createLead(connection: any, companyId: number, labelId: number, lead: any) {
	const isLead = await checkLeadExist(connection, lead);
	if (isLead) return;

	// Filter only valid (non-null/undefined) keys
	const validKeys = Object.keys(lead).filter(
		(key) => lead[key] !== undefined && lead[key] !== null,
	);

	if (validKeys.length === 0) {
		throw new Error('No valid lead fields to insert.');
	}

	const columns = validKeys.join(', ');
	const placeholders = validKeys.map(() => '?').join(', ');
	const values = validKeys.map((key) => lead[key]);
	console.log({ columns, placeholders });

	const [result]: any = await connection.execute(
		`INSERT INTO customers_and_leads (${columns}) VALUES (${placeholders})`,
		values,
	);
	await assignLabelToLead(connection, result.insertId, companyId, labelId);
	return result.insertId;
}

// 🔹 Check a lead is exist or not
async function checkLeadExist(connection: any, lead: any) {
	const conditions = [];
	const values = [];

	if (lead.name) {
		conditions.push('name = ?');
		values.push(lead.name);
	}
	if (lead.phone_number) {
		conditions.push('phone_number = ?');
		values.push(lead.phone_number);
	}

	if (!conditions.length) return null;
	console.log({ conditions, values });

	const [results] = await connection.execute(
		`SELECT id FROM customers_and_leads WHERE ${conditions.join(' AND ')}`,
		values,
	);

	return results.length ? results[0] : null;
}
