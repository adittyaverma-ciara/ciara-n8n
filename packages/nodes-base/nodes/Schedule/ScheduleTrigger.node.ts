import { sendAt } from 'cron';
import moment from 'moment-timezone';
import type {
	ITriggerFunctions,
	INodeType,
	INodeTypeDescription,
	ITriggerResponse,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import { intervalToRecurrence, recurrenceCheck, toCronExpression } from './GenericFunctions';
import type { IRecurrenceRule, Rule } from './SchedulerInterface';
import { getDbConnection } from '@utils/db';

export class ScheduleTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Schedule Trigger',
		name: 'scheduleTrigger',
		icon: 'fa:clock',
		group: ['trigger', 'schedule'],
		version: [1, 1.1, 1.2],
		description: 'Triggers the workflow on a given schedule',
		eventTriggerDescription: '',
		activationMessage:
			'Your schedule trigger will now trigger executions on the schedule you have defined.',
		defaults: {
			name: 'Schedule Trigger',
			color: '#31C49F',
		},

		inputs: [],
		outputs: [NodeConnectionType.Main],
		properties: [
			{
				displayName:
					'This workflow will run on the schedule you define here once you <a data-key="activate">activate</a> it.<br><br>For testing, you can also trigger it manually: by going back to the canvas and clicking \'test workflow\'',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Trigger Rules',
				name: 'rule',
				placeholder: 'Add Rule',
				type: 'hidden',
				typeOptions: {
					multipleValues: true,
					editorIsReadOnly: true,
				},
				default: {},
				options: [
					{
						name: 'interval',
						displayName: 'Trigger Interval',
						values: [
							{
								displayName: 'Trigger Interval',
								name: 'field',
								type: 'options',
								default: 'days',
								// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
								options: [
									{
										name: 'Seconds',
										value: 'seconds',
									},
									{
										name: 'Minutes',
										value: 'minutes',
									},
									{
										name: 'Hours',
										value: 'hours',
									},
									{
										name: 'Days',
										value: 'days',
									},
									{
										name: 'Weeks',
										value: 'weeks',
									},
									{
										name: 'Months',
										value: 'months',
									},
									{
										name: 'Custom (Cron)',
										value: 'cronExpression',
									},
								],
							},
							{
								displayName: 'Seconds Between Triggers',
								name: 'secondsInterval',
								type: 'number',
								default: 30,
								displayOptions: {
									show: {
										field: ['seconds'],
									},
								},
								description: 'Number of seconds between each workflow trigger',
							},
							{
								displayName: 'Minutes Between Triggers',
								name: 'minutesInterval',
								type: 'number',
								default: 5,
								displayOptions: {
									show: {
										field: ['minutes'],
									},
								},
								description: 'Number of minutes between each workflow trigger',
							},
							{
								displayName: 'Hours Between Triggers',
								name: 'hoursInterval',
								type: 'number',
								displayOptions: {
									show: {
										field: ['hours'],
									},
								},
								default: 1,
								description: 'Number of hours between each workflow trigger',
							},
							{
								displayName: 'Days Between Triggers',
								name: 'daysInterval',
								type: 'number',
								displayOptions: {
									show: {
										field: ['days'],
									},
								},
								default: 1,
								description: 'Number of days between each workflow trigger',
							},
							{
								displayName: 'Weeks Between Triggers',
								name: 'weeksInterval',
								type: 'number',
								displayOptions: {
									show: {
										field: ['weeks'],
									},
								},
								default: 1,
								description: 'Would run every week unless specified otherwise',
							},
							{
								displayName: 'Months Between Triggers',
								name: 'monthsInterval',
								type: 'number',
								displayOptions: {
									show: {
										field: ['months'],
									},
								},
								default: 1,
								description: 'Would run every month unless specified otherwise',
							},
							{
								displayName: 'Trigger at Day of Month',
								name: 'triggerAtDayOfMonth',
								type: 'number',
								displayOptions: {
									show: {
										field: ['months'],
									},
								},
								typeOptions: {
									minValue: 1,
									maxValue: 31,
								},
								default: 1,
								description: 'The day of the month to trigger (1-31)',
								hint: 'If a month doesn’t have this day, the node won’t trigger',
							},
							{
								displayName: 'Trigger on Weekdays',
								name: 'triggerAtDay',
								type: 'multiOptions',
								displayOptions: {
									show: {
										field: ['weeks'],
									},
								},
								typeOptions: {
									maxValue: 7,
								},
								options: [
									{
										name: 'Monday',
										value: 1,
									},
									{
										name: 'Tuesday',
										value: 2,
									},
									{
										name: 'Wednesday',
										value: 3,
									},
									{
										name: 'Thursday',
										value: 4,
									},
									{
										name: 'Friday',
										value: 5,
									},

									{
										name: 'Saturday',
										value: 6,
									},
									{
										name: 'Sunday',
										value: 0,
									},
								],
								default: [0],
							},
							{
								displayName: 'Trigger at Hour',
								name: 'triggerAtHour',
								type: 'options',
								default: 0,
								displayOptions: {
									show: {
										field: ['days', 'weeks', 'months'],
									},
								},
								options: [
									{
										name: 'Midnight',
										displayName: 'Midnight',
										value: 0,
									},
									{
										name: '1am',
										displayName: '1am',
										value: 1,
									},
									{
										name: '2am',
										displayName: '2am',
										value: 2,
									},
									{
										name: '3am',
										displayName: '3am',
										value: 3,
									},
									{
										name: '4am',
										displayName: '4am',
										value: 4,
									},
									{
										name: '5am',
										displayName: '5am',
										value: 5,
									},
									{
										name: '6am',
										displayName: '6am',
										value: 6,
									},
									{
										name: '7am',
										displayName: '7am',
										value: 7,
									},
									{
										name: '8am',
										displayName: '8am',
										value: 8,
									},
									{
										name: '9am',
										displayName: '9am',
										value: 9,
									},
									{
										name: '10am',
										displayName: '10am',
										value: 10,
									},
									{
										name: '11am',
										displayName: '11am',
										value: 11,
									},
									{
										name: 'Noon',
										displayName: 'Noon',
										value: 12,
									},
									{
										name: '1pm',
										displayName: '1pm',
										value: 13,
									},
									{
										name: '2pm',
										displayName: '2pm',
										value: 14,
									},
									{
										name: '3pm',
										displayName: '3pm',
										value: 15,
									},
									{
										name: '4pm',
										displayName: '4pm',
										value: 16,
									},
									{
										name: '5pm',
										displayName: '5pm',
										value: 17,
									},
									{
										name: '6pm',
										displayName: '6pm',
										value: 18,
									},
									{
										name: '7pm',
										displayName: '7pm',
										value: 19,
									},
									{
										name: '8pm',
										displayName: '8pm',
										value: 20,
									},
									{
										name: '9pm',
										displayName: '9pm',
										value: 21,
									},
									{
										name: '10pm',
										displayName: '10pm',
										value: 22,
									},
									{
										name: '11pm',
										displayName: '11pm',
										value: 23,
									},
								],
								description: 'The hour of the day to trigger',
							},
							{
								displayName: 'Trigger at Minute',
								name: 'triggerAtMinute',
								type: 'number',
								default: 0,
								displayOptions: {
									show: {
										field: ['hours', 'days', 'weeks', 'months'],
									},
								},
								typeOptions: {
									minValue: 0,
									maxValue: 59,
								},
								description: 'The minute past the hour to trigger (0-59)',
							},
							{
								displayName:
									'You can find help generating your cron expression <a href="https://crontab.guru/examples.html" target="_blank">here</a>',
								name: 'notice',
								type: 'notice',
								displayOptions: {
									show: {
										field: ['cronExpression'],
									},
								},
								default: '',
							},
							{
								displayName: 'Expression',
								name: 'expression',
								type: 'string',
								default: '',
								placeholder: 'eg. 0 15 * 1 sun',
								displayOptions: {
									show: {
										field: ['cronExpression'],
									},
								},
								hint: 'Format: [Second] [Minute] [Hour] [Day of Month] [Month] [Day of Week]',
							},
						],
					},
				],
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		// const { interval: intervals } = this.getNodeParameter('rule', []) as Rule;
		const workflowId = this.getWorkflow().id as string;
		const { cronExpressions: cronList, timezoneInfo } = await getCronExpressions(
			workflowId as string,
		);
		const intervals: any[] = cronList.map((expr) => ({
			field: 'cronExpression',
			expression: expr,
		}));

		if (!intervals?.length || !intervals.some((rule) => rule.field)) {
			throw new NodeApiError(this.getNode(), {
				message: '❌ No working hours set from CiaraAI. Please configure them first.',
				//⚠️ No cron rules found. Sync your working hours from CiaraAI.
			});
		}
		await updateWorkflowTimezone(workflowId, timezoneInfo.iana_timezone);

		const timezone = this.getTimezone();
		const staticData = this.getWorkflowStaticData('node') as {
			recurrenceRules: number[];
		};
		if (!staticData.recurrenceRules) {
			staticData.recurrenceRules = [];
		}

		const executeTrigger = async (recurrence: IRecurrenceRule) => {
			const shouldTrigger = recurrenceCheck(recurrence, staticData.recurrenceRules, timezone);
			if (!shouldTrigger) return;

			const momentTz = moment.tz(timezone);
			const resultData = {
				timestamp: momentTz.toISOString(true),
				'Readable date': momentTz.format('MMMM Do YYYY, h:mm:ss a'),
				'Readable time': momentTz.format('h:mm:ss a'),
				'Day of week': momentTz.format('dddd'),
				Year: momentTz.format('YYYY'),
				Month: momentTz.format('MMMM'),
				'Day of month': momentTz.format('DD'),
				Hour: momentTz.format('HH'),
				Minute: momentTz.format('mm'),
				Second: momentTz.format('ss'),
				Timezone: `${timezone} (UTC${momentTz.format('Z')})`,
			};

			const isWorkflowEligibleToStart = await isStartDatePassed(workflowId, timezone);
			if (!isWorkflowEligibleToStart) return;

			this.emit([this.helpers.returnJsonArray([resultData])]);
		};

		const rules = intervals.map((interval, i) => ({
			interval,
			cronExpression: toCronExpression(interval),
			recurrence: intervalToRecurrence(interval, i),
		}));

		if (this.getMode() !== 'manual') {
			for (const { interval, cronExpression, recurrence } of rules) {
				try {
					this.helpers.registerCron(cronExpression, () => executeTrigger(recurrence));
				} catch (error) {
					if (interval.field === 'cronExpression') {
						throw new NodeOperationError(this.getNode(), 'Invalid cron expression', {
							description: 'More information on how to build them at https://crontab.guru/',
						});
					} else {
						throw error;
					}
				}
			}
			return {};
		} else {
			const manualTriggerFunction = async () => {
				const { interval, cronExpression, recurrence } = rules[0];
				if (interval.field === 'cronExpression') {
					try {
						sendAt(cronExpression);
					} catch (error) {
						throw new NodeOperationError(this.getNode(), 'Invalid cron expression', {
							description: 'More information on how to build them at https://crontab.guru/',
						});
					}
				}
				executeTrigger(recurrence);
			};
			return {
				manualTriggerFunction,
			};
		}
	}
}

const updateWorkflowTimezone = async (playbook_id: string, newTimezone: string) => {
	const connection = await getDbConnection();
	try {
		if (newTimezone) {
			await connection.execute(
				`
			UPDATE n8n_workflow_entity
			SET settings = JSON_SET(settings, '$.timezone', ?)
			WHERE id = ?
			`,
				[newTimezone, playbook_id],
			);

			console.log(`Timezone updated to ${newTimezone} for workflow ${playbook_id}`);
		}
	} catch (error) {
		connection.release();
	} finally {
		connection.release();
	}
};

async function getCronExpressions(workflowId: string) {
	const connection = await getDbConnection();
	let cronExpressions: string[] = [];
	let timezoneInfo;
	try {
		const scheduleData = await getSchedulingDetailsFromDB(workflowId, connection);
		cronExpressions = createCronIntervals(scheduleData?.scheduling_hours, 1);
		timezoneInfo = await getTimezone(connection, scheduleData?.timezone);
		return { cronExpressions, timezoneInfo };
	} catch (error) {
		connection.release();
		return { cronExpressions, timezoneInfo };
	} finally {
		connection.release();
	}
}

async function getSchedulingDetailsFromDB(playbook_id: string, connection?: any) {
	let isNewConnection: boolean = false;
	try {
		if (!connection) {
			connection = await getDbConnection();
			isNewConnection = true;
		}
		const [results] = await connection.execute(
			`SELECT *
				FROM s_a_scheduling_details
	 			WHERE playbook_id = ?`,
			[playbook_id],
		);
		let scheduleData = results.length ? results[0] : null;
		if (!scheduleData) return null;
		return scheduleData;
	} catch (error) {
		if (isNewConnection) connection.release();
		return null;
	} finally {
		if (isNewConnection) connection.release();
	}
}

async function getTimezone(connection: any, timezone_id: string) {
	if (!timezone_id) return null;
	const [results] = await connection.execute(
		`SELECT *
			FROM timezones
 			WHERE id = ?`,
		[timezone_id],
	);
	const timezoneData = results.length ? results[0] : null;

	return timezoneData;
}

async function isStartDatePassed(workflowId: string, timezone: string): Promise<boolean> {
	const schedule = await getSchedulingDetailsFromDB(workflowId);
	if (!schedule) return false;

	const startDate = schedule.start_date;
	if (!startDate) return true; // No start date means no restriction

	const scheduledStart = moment.tz(startDate, timezone).startOf('day');
	const now = moment.tz(timezone);

	return now.isAfter(scheduledStart);
}

type Slot = { from: string; to: string };
type DaySchedule = { slots?: Slot[]; isActive: boolean };
type Schedule = Record<string, DaySchedule>;

const dayMap: Record<string, number> = {
	sunday: 0,
	monday: 1,
	tuesday: 2,
	wednesday: 3,
	thursday: 4,
	friday: 5,
	saturday: 6,
};

function createCronIntervals(schedule: Schedule, frequencyInMinutes = 1): string[] {
	const cronExpressions: string[] = [];

	for (const [day, data] of Object.entries(schedule)) {
		if (!data.isActive) continue;

		const dayNum = dayMap[day.toLowerCase()];
		if (dayNum === undefined || !data.slots || data.slots.length === 0) continue;

		for (const slot of data.slots) {
			let [fromHour, fromMin] = slot.from.split(':').map(Number);
			let [toHour, toMin] = slot.to.split(':').map(Number);

			// Handle 24:00 as 23:59
			if (toHour === 24 && toMin === 0) {
				toHour = 23;
				toMin = 59;
			}

			// Invalid range check
			if (fromHour > toHour || (fromHour === toHour && fromMin >= toMin)) continue;

			// Case: same hour
			if (fromHour === toHour) {
				if (fromMin < toMin) {
					cronExpressions.push(
						`${fromMin}-${toMin - 1}/${frequencyInMinutes} ${fromHour} * * ${dayNum}`,
					);
				}
				continue;
			}

			// 1. Partial first hour
			if (fromMin > 0) {
				cronExpressions.push(`${fromMin}-59/${frequencyInMinutes} ${fromHour} * * ${dayNum}`);
			} else {
				// Whole first hour
				cronExpressions.push(`*/${frequencyInMinutes} ${fromHour} * * ${dayNum}`);
			}

			// 2. Full hours
			const fullHourStart = fromHour + 1;
			const fullHourEnd = toHour - 1;
			if (fullHourStart <= fullHourEnd) {
				cronExpressions.push(
					`*/${frequencyInMinutes} ${fullHourStart}-${fullHourEnd} * * ${dayNum}`,
				);
			}

			// 3. Partial last hour
			if (toMin > 0) {
				cronExpressions.push(`0-${toMin - 1}/${frequencyInMinutes} ${toHour} * * ${dayNum}`);
			}
		}
	}

	return cronExpressions;
}
