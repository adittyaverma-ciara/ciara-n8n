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
import moment from 'moment-timezone';

export class CallBack implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'CallBack',
		name: 'callBack',
		group: ['transform'],
		version: 1,
		description: 'Import CallBack Leads from Segments.',
		defaults: {
			name: 'CallBack',
			color: '#078224',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		properties: [
			{
				displayName: 'Segments',
				name: 'segmentIds',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getSegments',
				},
				default: [],
				description: 'Select one or more Segments',
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
		const segmentIds = this.getNodeParameter('segmentIds', 0) as number[];
		const executeMode = this.getMode();

		const timezone = this.getTimezone();
		const timezoneOffset = moment.tz(timezone).format('Z'); // gives +HH:mm or -HH:mm
		const workflowTimezone = timezoneOffset || '+00:00';

		let contacts: any[] = [];
		try {
			let segments;
			if (segmentIds) {
				segments = await fetchSegments(connection, segmentIds);
			}
			if (!segments || segments.length === 0)
				throw new NodeOperationError(this.getNode(), 'No active SegmentId found.');

			if (segments && segments.length > 0) {
				contacts = await fetchContacts(
					connection,
					segmentIds,
					segments[0].company_id,
					workflowTimezone,
					executeMode === 'manual',
				);
			}

			return contacts?.length > 0
				? [
						contacts?.map((contact) => ({
							json: {
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

// 🔹 Fetch Segments details from DB
async function fetchSegments(connection: any, segmentIds: number[]) {
	if (!segmentIds.length) return [];

	const placeholders = segmentIds.map(() => '?').join(',');
	const query = `
		SELECT *
		FROM segments
		WHERE id IN (${placeholders})
		AND status = 'active'
	`;

	const [results] = await connection.execute(query, segmentIds);
	return results.length ? results : [];
}

// 🔹 Fetch Segment details from DB
async function fetchSegment(connection: any, segmentId: number) {
	const [results] = await connection.execute(
		`SELECT *
			FROM segments
 			WHERE id = ?
			AND status = 'active'`,
		[segmentId],
	);
	return results.length ? results[0] : null;
}

// 🔹 Fetch eligible contacts from DB
async function fetchContacts(
	connection: any,
	segmentIds: number[],
	companyId: number,
	workflowTimezone: string,
	isManualExecuted: boolean,
) {
	if (!segmentIds.length || !companyId) return [];
	const placeholders = segmentIds.map(() => '?').join(',');

	const [contacts] = await connection.execute(
		`
	SELECT 
		cal.*,
		TRUE AS isCallBackLead,
		sacd.id AS callBackCallId
	FROM customers_and_leads_segments AS cals
	JOIN customers_and_leads AS cal 
		ON cals.customers_and_leads_id = cal.id
	JOIN sdr_agents_call_details sacd 
		ON sacd.id = (
			SELECT sacd2.id
			FROM sdr_agents_call_details sacd2
			WHERE sacd2.lead_id = cal.id
			AND sacd2.is_callback_requested = TRUE
			AND sacd2.is_callback = FALSE
			AND NOW() >= sacd2.callback_timestamp
			ORDER BY sacd2.callback_timestamp ASC
			LIMIT 1
		)
	WHERE cals.company_id = ?
	AND cals.segment_id IN (${placeholders});
         `,
		[companyId, ...segmentIds],
	);

	return contacts;
}

// 	${!isManualExecuted
// 	   ? `AND cal.status NOT IN ('retry', 'calling', 'non-responsive', 'do-not-call', 'contacted')`
// 	   : ''
//    }
