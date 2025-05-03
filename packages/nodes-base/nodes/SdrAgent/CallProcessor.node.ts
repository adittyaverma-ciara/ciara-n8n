import {
	INodeType,
	INodeTypeDescription,
	IExecuteFunctions,
	INodeExecutionData,
	NodeConnectionType,
} from 'n8n-workflow';
import { getDbConnection } from '@utils/db';
import {
	createDynamicObject,
	adjustTimeByOffset,
	getWeekDayOfToday,
	checkTimeSlotDayWise,
	checkDynamicObject,
	agentVoiceProvider,
	NormalObjT,
	extractVariableTypes,
	isVariableValue,
	extractVariableName,
	LeadStatusTypesE,
	LeadEntityTypeE,
	LeadActivityE,
} from './helper';
import Retell from 'retell-sdk';

export class CallProcessor implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Call Processor',
		name: 'callProcessor',
		group: ['transform'],
		version: 1,
		description:
			'Fetches SDR Agents, checks availability, fetches contacts, and processes calls using Retell API.',
		defaults: {
			name: 'Call Processor',
			color: '#28A745',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		properties: [],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const [inputData] = this.getInputData();
		const { sdrAgentId, segmentId, maxAttempts, retryAfterDays } = inputData.json;

		if (!sdrAgentId || !segmentId) {
			throw new Error('SDR Agent ID and Segment ID are required.');
		}
		const objectInfo = Object.assign(this);
		const userId = objectInfo?.additionalData?.userId;

		const connection = await getDbConnection();
		try {
			if (userId) {
				let [company] = await connection.execute(
					'SELECT * FROM companies WHERE workflow_acc_id = ?',
					[userId],
				);
				company = company as any[];
				const companyInfo = company[0] as any;
				const companyId = companyInfo.id;
				if (companyId) {
					const sdrAgent = await fetchSDRAgent(connection, sdrAgentId, companyId);

					if (!sdrAgent) {
						console.log('No active SDR agent found.');
						return [[{ json: { message: 'No active SDR agent found.' } }]];
					}

					// Check if the SDR Agent is available
					// const isAvailable = checkTimeSlotDayWise(
					// 	sdrAgent.scheduling_hours,
					// 	getWeekDayOfToday(sdrAgent.offset),
					// 	sdrAgent.offset,
					// );

					// if (!isAvailable) {
					// 	console.log('Agent not available in the current time slot.');
					// 	return [[{ json: { message: 'Agent unavailable at this time.' } }]];
					// }

					// Fetch eligible contacts
					const contacts = await fetchContacts(
						connection,
						segmentId,
						sdrAgent.offset,
						maxAttempts,
						retryAfterDays,
						companyId,
					);
					if (!contacts.length) {
						console.log('No eligible contacts found.');
						return [[{ json: { message: 'No eligible contacts found.' } }]];
					}

					// Process calls
					const callResults = await processCalls(contacts, sdrAgent, segmentId);

					return [this.helpers.returnJsonArray(callResults)];
				}
			}
			return [this.helpers.returnJsonArray([])];
		} finally {
			connection.release();
		}
	}
}
// 🔹 Fetch SDR Agent details from DB
async function fetchSDRAgent(connection: any, sdrAgentId: any, companyId: number) {
	try {
		const [results] = await connection.execute(
			`SELECT sa.*, sa.id as agent_id, tz.*
					FROM sdr_agents AS sa
					JOIN s_a_scheduling_details AS sasd ON sa.id = sasd.sdr_agent_id
					JOIN timezones AS tz ON sasd.timezone = tz.id
					WHERE sa.company_id = ? AND sa.id = ? AND sa.status = 'ACTIVE'`,
			[companyId, sdrAgentId],
		);
		return results.length ? results[0] : null;
	} finally {
		connection.release();
	}
}

// 🔹 Fetch eligible contacts from DB
async function fetchContacts(
	connection: any,
	segmentId: any,
	offset: string,
	maxAttempts: any,
	retryAfterDays: any,
	companyId: number,
) {
	const [contacts] = await connection.execute(
		`SELECT DISTINCT cal.*
         FROM customers_and_leads_segments AS cals
         JOIN customers_and_leads AS cal ON cals.customers_and_leads_id = cal.id
         LEFT JOIN sdr_agents_call_details AS sacd ON sacd.lead_id = cal.id
         WHERE cals.company_id = ? AND cals.segment_id = ?
         AND cal.status NOT IN ('calling', 'non-responsive', 'do-not-call')
         AND (cal.status != 'call-back' 
              OR EXISTS (SELECT 1 FROM sdr_agents_call_details sacd WHERE sacd.lead_id = cal.id AND sacd.sdr_agent_id = cal.sdr_agent_id AND (sacd.is_callback_requested = true AND sacd.is_callback = false AND CONVERT_TZ(NOW(), '+00:00', IFNULL(?,"+00:00")) >= CONVERT_TZ(sacd.callback_timestamp, '+00:00', IFNULL(?,"+00:00")))))
         AND (
             (SELECT COUNT(*) FROM sdr_agents_call_details AS calls WHERE calls.lead_id = cal.id) < ?
             AND COALESCE((SELECT MAX(created_at) FROM sdr_agents_call_details AS calls WHERE calls.lead_id = cal.id), '1970-01-01') 
             <= DATE_SUB(NOW(), INTERVAL COALESCE(?, 0) DAY)
         )`,
		[companyId, segmentId, offset, offset, maxAttempts, retryAfterDays],
	);
	return contacts;
}

// 🔹 Process calls for each eligible contact
async function processCalls(contacts: any[], sdrAgent: any, segmentId: any) {
	const callPromises = contacts.map(async (contact) => {
		try {
			console.log(`Calling ${contact.phone_number} from ${sdrAgent.agent_phone_number}...`);
			if (contact.phone_number && sdrAgent.agent_phone_number) {
				const parsedCustomVariables = JSON.parse(contact.custom_variables || '[]');

				const { constantVariables, dynamicVariable } = extractVariableTypes(parsedCustomVariables);

				const dynamicVariableObj = createDynamicObject(JSON.parse(contact?.custom_fields || '[]'));
				const callDynamicVariable: any = {};
				callDynamicVariable['recipientName'] = contact.name?.split(' ')?.[0] || '';
				callDynamicVariable['productName'] = contact.product_of_interest;
				callDynamicVariable['currentTime'] = adjustTimeByOffset(new Date(), sdrAgent.offset);

				const leadDetails = {
					...dynamicVariableObj,
					...contact,
				};
				Object.keys(dynamicVariable)?.reduce((acc, curr) => {
					acc[curr] = leadDetails[dynamicVariable[curr]] || '';
					return acc;
				}, callDynamicVariable);

				callDynamicVariable['companyName'] = isVariableValue(sdrAgent.company_name)
					? leadDetails[extractVariableName(sdrAgent.company_name) || ''] || ''
					: sdrAgent.company_name;

				Object.assign(callDynamicVariable, constantVariables);

				const checkDynamicObj = checkDynamicObject(
					Object.keys(callDynamicVariable),
					callDynamicVariable,
				);
				const agentVoice = contact.agent_voice;
				const llmModel = contact.llm_model;

				if (checkDynamicObj) {
					const callData = await createPhoneCall(
						sdrAgent.agent_phone_number,
						contact.phone_number,
						dynamicVariableObj,
						contact.company_id,
						{
							llm_model: llmModel,
							voice_provider: agentVoiceProvider(agentVoice),
						},
					);

					const sdrAgentCallId = await storeCallDetails([
						sdrAgent.agent_id,
						callData.call_status,
						callData.call_id,
						contact.company_id,
						contact.id,
						segmentId,
						contact.priority,
						contact.product_of_interest,
						LeadStatusTypesE.CALLING,
					]);
					await storeLeadInteractionLogs([
						sdrAgentCallId,
						LeadEntityTypeE.CALL_START,
						contact.id,
						contact.company_id,
						LeadActivityE.CALL_START,
					]);
					await updateCallStatus(contact.id, 'calling');
					return { ...contact, ...callData };
				} else {
					console.log(
						`Skipping call for lead ${contact.id} (not eligible). \nvariables : ${JSON.stringify(checkDynamicObj, null, 3)}`,
					);
				}
			} else
				console.log('call executer error :', 'agent PhoneNumber or lead PhoneNumber not found');
		} catch (error) {
			console.error(`Error processing lead ${contact.id}:`, error);
			throw new Error(error);
		}
	});

	return Promise.all(callPromises);
}

// 🔹 Database Helper Functions
async function storeCallDetails(record: any[]) {
	const connection = await getDbConnection();
	try {
		const [result]: any = await connection.execute(
			`INSERT INTO sdr_agents_call_details (
			sdr_agent_id, call_current_status, retell_call_id, company_id, 
			lead_id, segment_id, lead_priority, lead_product_of_interest, lead_status
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			record,
		);
		return result.insertId;
	} finally {
		connection.release();
	}
}

async function updateCallStatus(contactId: number, status: string) {
	const connection = await getDbConnection();
	try {
		await connection.execute('UPDATE customers_and_leads SET status = ? WHERE id = ?', [
			status,
			contactId,
		]);
	} finally {
		connection.release();
	}
}

// 🔹 Retell API Helper Functions
async function getRetellClient(companyId: number) {
	const connection = await getDbConnection();
	try {
		const [companies] = (await connection.execute(
			`SELECT retell_api_key FROM companies WHERE id = ?`,
			[companyId],
		)) as any[];
		if (!companies?.length) throw new Error('Retell API key not found.');
		return new Retell({ apiKey: companies[0]?.retell_api_key });
	} finally {
		connection.release();
	}
}

async function createPhoneCall(
	fromNumber: string,
	toNumber: string,
	dynamicVariables: NormalObjT,
	companyId: number,
	metadata?: NormalObjT,
) {
	const client = await getRetellClient(companyId);
	return client?.call?.createPhoneCall({
		from_number: fromNumber,
		to_number: toNumber,
		retell_llm_dynamic_variables: dynamicVariables,
		metadata,
	});
}

async function storeLeadInteractionLogs(record: any[]) {
	const connection = await getDbConnection();
	try {
		await connection.execute(
			'INSERT INTO lead_activity_logs (entity_id, entity_type, lead_id, company_id, activity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
			record,
		);
	} finally {
		connection.release();
	}
}
