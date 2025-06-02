import {
	INodeType,
	INodeTypeDescription,
	IExecuteFunctions,
	INodeExecutionData,
	NodeConnectionType,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	NodeOperationError,
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
		const executeMode = this.getMode();

		let contacts: any[] = [];
		try {
			let segment;
			if (segmentId) {
				segment = await fetchSegment(connection, segmentId);
			} else throw new NodeOperationError(this.getNode(), 'No active SegmentId found.');
			if (segment) {
				const segmentLabelId = (
					segment.filter_metadata?.find((f: any) => f.slug === 'labels')?.value || []
				).map((id: any) => Number(id));

				const inputData = this.getInputData();

				// const leads = nodeFieldMapping(inputData);
				// console.log(leads);

				// const objectInfo = Object.assign(this);

				// // find a contact crm source
				// type NodeInfo = { type: string; name?: string };

				// const matchedLabel = Object.values(
				// 	objectInfo.workflow.nodes as Record<string, NodeInfo>,
				// ).find((node) => getNodeTypeLabel(node.type) !== 'other')?.type;

				// const crmSource = matchedLabel ? getNodeTypeLabel(matchedLabel) : 'other';
				const crm_leads_ = fieldMappingFromPreviousNode(inputData);

				if (Array.isArray(crm_leads_) && crm_leads_.length > 0) {
					await Promise.all(
						crm_leads_.map((lead) =>
							createLead(connection, segment.company_id, segment.id, segmentLabelId, {
								...lead,
								company_id: segment.company_id,
								status: 'not-contacted',
							}),
						),
					);
				}
				await updateSegmentLeadCount(connection, segment.id, segment.company_id);
				contacts = await fetchContacts(
					connection,
					segment.id,
					segment.company_id,
					executeMode === 'manual',
				);
			}

			return contacts?.length > 0
				? [
						contacts?.map((contact) => ({
							json: {
								segmentId,
								...contact,
							},
						})),
					]
				: [];
		} catch (error) {
			connection.release();
			throw new NodeOperationError(this.getNode(), error.message || 'Unknown error');
		} finally {
			connection.release();
		}
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

function fieldMappingFromPreviousNode(inputData: any[]) {
	return inputData
		.map((input) => input.json)
		.filter((json) => json && Object.keys(json).length > 0);
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

// 🔹 Create a lead
async function createLead(
	connection: any,
	companyId: number,
	segmentId: number,
	labelId: number,
	lead: any,
) {
	const existingLead = await checkLeadExist(connection, companyId, lead);
	if (existingLead) {
		const updateFields = Object.entries(lead).reduce(
			(acc, [key, value]) => {
				if (
					value !== null &&
					value !== undefined &&
					(existingLead[key] === null ||
						existingLead[key] === undefined ||
						existingLead[key] === '')
				) {
					acc[key] = value;
				}
				return acc;
			},
			{} as Record<string, any>,
		);

		if (Object.keys(updateFields).length > 0) {
			const setClause = Object.keys(updateFields)
				.map((key) => `${key} = ?`)
				.join(', ');
			const values = Object.values(updateFields);
			values.push(existingLead.id);

			await connection.execute(`UPDATE customers_and_leads SET ${setClause} WHERE id = ?`, values);
		}
		await Promise.all([
			assignLabelToLead(connection, existingLead.id, companyId, labelId),
			assignLeadToSegment(connection, segmentId, existingLead.id, companyId),
		]);
		return existingLead.id;
	}

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
	const [result]: any = await connection.execute(
		`INSERT INTO customers_and_leads (${columns}) VALUES (${placeholders})`,
		values,
	);
	await Promise.all([
		await assignLabelToLead(connection, result.insertId, companyId, labelId),
		await assignLeadToSegment(connection, segmentId, result.insertId, companyId),
	]);
	return result.insertId;
}

// 🔹 Check a lead is exist or not
async function checkLeadExist(connection: any, companyId: number, lead: any) {
	const conditions = ['company_id = ?'];
	const values = [companyId];

	if (lead?.crm_metadata?.id) {
		conditions.push("crm_metadata->>'$.id' = ?");
		values.push(lead?.crm_metadata?.id);
	}

	if (!conditions.length) return null;
	const [results] = await connection.execute(
		`SELECT id FROM customers_and_leads WHERE ${conditions.join(' AND ')}`,
		values,
	);

	return results.length ? results[0] : null;
}

// 🔹 Assign label to lead
async function assignLabelToLead(
	connection: any,
	leadId: number,
	companyId: number,
	labelIds: number[] | number,
) {
	const sql = `
		INSERT INTO customers_and_leads_labels (
			label_id, customers_and_leads_id, company_id
		) VALUES (?, ?, ?)
		ON DUPLICATE KEY UPDATE
			label_id = VALUES(label_id)
	`;

	const labelArray = Array.isArray(labelIds) ? labelIds : [labelIds];

	await Promise.all(labelArray.map((id) => connection.execute(sql, [id, leadId, companyId])));
}

// 🔹 add lead in segment
async function assignLeadToSegment(
	connection: any,
	segmentId: number,
	leadId: number,
	companyId: number,
) {
	await connection.execute(
		`INSERT INTO customers_and_leads_segments (
			segment_id, customers_and_leads_id, company_id
		) VALUES (?, ?, ?)
		ON DUPLICATE KEY UPDATE
			segment_id = VALUES(segment_id)`,
		[segmentId, leadId, companyId],
	);
}

// 🔹 update segment's leads count
async function updateSegmentLeadCount(connection: any, segmentId: number, companyId: number) {
	const [result] = await connection.execute(
		`SELECT COUNT(id) AS total FROM customers_and_leads_segments WHERE segment_id = ? AND company_id = ?`,
		[segmentId, companyId],
	);
	const segmentLeadsCount = result[0]?.total || 0;
	if (segmentLeadsCount)
		await connection.execute(`UPDATE segments SET no_of_contacts = ? WHERE id = ?`, [
			segmentLeadsCount,
			segmentId,
		]);
}

// 🔹 Fetch eligible contacts from DB
async function fetchContacts(
	connection: any,
	segmentId: any,
	companyId: number,
	isManualExecuted: boolean,
) {
	const [contacts] = await connection.execute(
		`SELECT DISTINCT cal.*
         FROM customers_and_leads_segments AS cals
         JOIN customers_and_leads AS cal ON cals.customers_and_leads_id = cal.id
         WHERE cals.company_id = ? AND cals.segment_id = ?
		 ${
				!isManualExecuted
					? `AND cal.status NOT IN ('calling', 'non-responsive', 'do-not-call', 'contacted')`
					: ''
			}
         `,
		[companyId, segmentId],
	);
	return contacts;
}
