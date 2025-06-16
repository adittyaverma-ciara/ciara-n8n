import {
	INodeType,
	INodeTypeDescription,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	IExecuteFunctions,
	INodeExecutionData,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import { getDbConnection } from '@utils/db';
import {
	extractVariableTypes,
	createDynamicObject,
	adjustTimeByOffset,
	isVariableValue,
	extractVariableName,
	checkDynamicObject,
	agentVoiceProvider,
	LeadStatusTypesE,
	NormalObjT,
	RetellCallTypesE,
} from './helper';
import Retell from 'retell-sdk';
import { GlobalConfig } from '@n8n/config';
import axios from 'axios';
import { AxiosRequestConfig } from 'axios';
import { Container } from '@n8n/di';

export class CallAgent implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Call Agent',
		name: 'sdrAgent',
		group: ['input'],
		version: 1,
		description: 'Select an SDR Agent and Segment.',
		defaults: {
			name: 'Call Agent',
			color: '#1F72E5',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		properties: [
			{
				displayName: 'Call Agent',
				name: 'sdrAgentId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getSDRAgents',
				},
				default: '',
				description: 'Select a Call Agent',
			},
		],
	};

	methods = {
		loadOptions: {
			async getSDRAgents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const objectInfo = Object.assign(this);
				const userId = objectInfo?.additionalData?.userId;
				let result: { name: string; value: number }[] = [];

				if (userId) {
					const connection = await getDbConnection();
					try {
						let [company] = await connection.execute(
							'SELECT * FROM companies WHERE workflow_acc_id = ?',
							[userId],
						);
						company = company as any[];
						const companyInfo = company[0] as any;
						const companyId = companyInfo.id;
						const [rows] = await connection.execute(
							'SELECT id, agent_identifier_name FROM sdr_agents WHERE company_id = ? AND status = ?',
							[companyId, 'active'],
						);
						result = (rows as { id: number; agent_identifier_name: string }[]).map((row) => ({
							name: row.agent_identifier_name,
							value: row.id,
						}));
					} finally {
						connection.release();
					}
				}
				return result;
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const globalConfig = Container.get(GlobalConfig);
		const engineWebhookUrl = globalConfig.nodes['engineWebhookUrl'];

		const connection = await getDbConnection();
		const objectInfo = Object.assign(this);
		const workflow = this.getWorkflow();

		this.onExecutionCancellation(() => {
			console.log(
				`${workflow.id} Workflow is stopped by api due to billing over-due, aborted: ${this.getExecutionCancelSignal()?.aborted}`,
			);
		});

		const timezone = objectInfo?.workflow?.settings?.timezone || 'UTC';
		let sdrAgent, sdrAgentId, segmentId;
		const playbookId = workflow.id as string;
		try {
			sdrAgentId = this.getNodeParameter('sdrAgentId', 0) as number;
			await sendEngineWebhook(
				{ agentId: sdrAgentId, isRunning: true, playbookId },
				engineWebhookUrl,
			);

			if (sdrAgentId) {
				sdrAgent = await fetchSDRAgent(connection, sdrAgentId);
			} else throw new NodeOperationError(this.getNode(), 'No active Call agent found.');
			const inputData = this.getInputData();
			const contacts = inputData?.map((input) => input.json) || [];

			segmentId = contacts.length > 0 ? contacts[0].segmentId : null;
			// Process calls
			const callResults = await processCalls(
				this,
				connection,
				contacts,
				sdrAgent,
				timezone,
				workflow.id,
			);

			return callResults?.length > 0
				? [
						callResults?.map((contact: any) => ({
							json: {
								contact,
							},
						})),
					]
				: [];
		} catch (error) {
			connection.release();
			throw new NodeOperationError(this.getNode(), error.message || 'Unknown error');
		} finally {
			if (sdrAgentId) {
				await sendEngineWebhook(
					{ agentId: sdrAgentId, isRunning: false, playbookId },
					engineWebhookUrl,
				);
				await storeExecutionDetails(connection, [
					workflow.id,
					workflow.name,
					sdrAgentId,
					segmentId,
					workflow.active,
				]);
			}
			connection.release();
		}
	}
}

// 🔹 Fetch SDR Agent details from DB
async function fetchSDRAgent(connection: any, sdrAgentId: number) {
	const [results] = await connection.execute(
		`SELECT sa.*, sa.id as agent_id
			FROM sdr_agents AS sa
 			WHERE sa.id = ?`, // AND sa.status = 'ACTIVE' // need to check
		[sdrAgentId],
	);
	return results.length ? results[0] : null;
}

// 🔹 Process calls for previous nodes contact
export async function processCalls(
	execCtx: IExecuteFunctions,
	connection: any,
	contacts: any,
	sdrAgent: any,
	timezone: string,
	workflowId?: string,
) {
	const callResults: any[] = [];

	for (let i = 0; i < contacts.length; i++) {
		const contact = contacts[i];

		// 🛑 Stop if the workflow was cancelled
		if (execCtx.getExecutionCancelSignal()?.aborted) {
			console.log(`❌ Workflow execution aborted at contact ${i}.`);
			break;
		}

		try {
			console.log(`Calling ${contact.phone_number} from ${sdrAgent.agent_phone_number}...`);
			if (contact.phone_number && sdrAgent.agent_phone_number) {
				const parsedCustomVariables = sdrAgent.custom_variable;
				const { constantVariables, dynamicVariable } = extractVariableTypes(parsedCustomVariables);
				const dynamicVariableObj = createDynamicObject(contact?.custom_fields);

				const callDynamicVariable: any = {
					recipientName: contact.name?.split(' ')?.[0] || '',
					productName: contact.product_of_interest,
					currentTime: adjustTimeByOffset(new Date(), timezone),
				};

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
				const agentVoice = sdrAgent.agent_voice;
				const llmModel = sdrAgent.llm_model;

				if (checkDynamicObj) {
					const callData = await createPhoneCall(
						connection,
						sdrAgent.agent_phone_number,
						contact.phone_number,
						callDynamicVariable,
						sdrAgent.company_id,
						{
							llm_model: llmModel,
							voice_provider: agentVoiceProvider(agentVoice),
						},
					);

					await storeCallDetails(connection, [
						sdrAgent.agent_id,
						callData.call_status,
						callData.call_id,
						sdrAgent.company_id,
						contact.id,
						contact.segmentId,
						contact.priority,
						contact.product_of_interest,
						LeadStatusTypesE.CALLING,
						RetellCallTypesE.PHONE_CALL,
						workflowId,
					]);
					callResults.push(contact);

					await updateCallStatus(connection, contact.id, 'calling');
					return contact;
				} else {
					console.log(
						`Skipping call for lead ${contact.id} (not eligible). \nvariables : ${JSON.stringify(callDynamicVariable, null, 3)}`,
					);
				}
			} else console.log(`Agent or lead phone number missing for leadId : ${contact.id}`);
		} catch (error) {
			console.error(`Error processing lead ${contact.id}:`, error);
			throw new Error(error);
		}
	}
	return callResults;
}

// 🔹 Database Helper Functions
export async function storeCallDetails(connection: any, record: any[]) {
	const [result]: any = await connection.execute(
		`INSERT INTO sdr_agents_call_details (
			sdr_agent_id, call_current_status, retell_call_id, company_id, 
			lead_id, segment_id, lead_priority, lead_product_of_interest, lead_status, call_type, playbook_id
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		record,
	);
	return result.insertId;
}

export async function updateCallStatus(connection: any, contactId: number, status: string) {
	await connection.execute('UPDATE customers_and_leads SET status = ? WHERE id = ?', [
		status,
		contactId,
	]);
}

export async function storeExecutionDetails(connection: any, record: any[]) {
	const [result]: any = await connection.execute(
		`INSERT INTO ciara_playbook_executions (
			playbook_id, playbook_name, agent_id, segment_id, is_active
		) VALUES (?, ?, ?, ?, ?)`,
		record,
	);
	return result.insertId;
}

// 🔹 Retell API Helper Functions
async function getRetellClient(connection: any, companyId: number) {
	const [companies] = (await connection.execute(
		`SELECT retell_api_key FROM companies WHERE id = ?`,
		[companyId],
	)) as any[];
	if (!companies?.length) throw new Error('Retell API key not found.');
	return new Retell({ apiKey: companies[0]?.retell_api_key });
}

export async function createPhoneCall(
	connection: any,
	fromNumber: string,
	toNumber: string,
	dynamicVariables: NormalObjT,
	companyId: number,
	metadata?: NormalObjT,
) {
	const client = await getRetellClient(connection, companyId);
	return client?.call?.createPhoneCall({
		from_number: fromNumber,
		to_number: toNumber,
		retell_llm_dynamic_variables: dynamicVariables,
		metadata,
	});
}

export async function sendEngineWebhook(
	payload: { agentId: number; isRunning: boolean; playbookId: string },
	engineWebhookUrl: string,
) {
	try {
		const body = JSON.stringify(payload);
		const config: AxiosRequestConfig = {
			method: 'POST',
			url: `${engineWebhookUrl}/webhooks/sdragent/running-status`,
			headers: {
				'Content-Type': 'application/json',
			},
			data: body,
		};
		await axios.request(config);
	} catch (error) {
		console.error(`Error at updating agent "${payload.agentId}" status  :`, error);
	}
}
