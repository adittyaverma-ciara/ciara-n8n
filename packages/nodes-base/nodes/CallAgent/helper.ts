import { camelCase, isArray, isObject, transform } from 'lodash';
import moment = require('moment');

export type NormalObjT = Record<string, any>;

export enum CustomVariableypesE {
	CONSTANT = 'constant',
	VARIABLE = 'variable',
}
export interface CustomVariableI {
	name: string;
	slug: string;
	placeholder: string;
	tooltip?: string;
	value: string;
	type: CustomVariableypesE;
}

export enum LeadStatusTypesE {
	NOT_CONTACTED = 'not-contacted',
	CONTACTED = 'contacted',
	CALL_BACK = 'call-back',
	CALLING = 'calling',
	NON_RESPONSIVE = 'non-responsive',
	DO_NOT_CALL = 'do-not-call',
	RETRY = 'retry',
}

export enum LeadEntityTypeE {
	LEAD_ADDED = 'customers_and_leads',
	CALL_START = 'sdr_agents_call_details',
	CALL_SCHEDULE = 'user_meetings',
}

export enum LeadActivityE {
	LEAD_ADDED = 'lead-added',
	CHAT_START = 'chat-started',
	CALL_START = 'call-started',
	CALL_SCHEDULE = 'call-scheduled',
}

export const getWeekDayOfToday = (utcOffset: string) =>
	moment().utcOffset(utcOffset).format('dddd').toLowerCase();

export const checkTimeSlotDayWise = (
	json: NormalObjT,
	dayOfWeek: string,
	utcOffset: string = '+00:00',
	dateTime?: moment.Moment,
): boolean => {
	const countryTime = (dateTime || moment()).utcOffset(utcOffset);

	if (!json?.[dayOfWeek]?.isActive) {
		return false;
	}
	const slots = json[dayOfWeek].slots;

	for (let i = 0; i < slots.length; i++) {
		const workingStartLocal = moment(
			`${countryTime.format('YYYY-MM-DD')} ${slots[i].from}`,
		).utcOffset(utcOffset, true);
		const workingEndLocal = moment(`${countryTime.format('YYYY-MM-DD')} ${slots[i].to}`).utcOffset(
			utcOffset,
			true,
		);
		const slotFrom = workingStartLocal;
		const slotTo = workingEndLocal;

		if (countryTime.isBetween(slotFrom, slotTo, null, '[]')) {
			return true;
		}
	}

	return false;
};

export const toCamelCase = <T extends NormalObjT | NormalObjT[]>(obj: T): T => {
	if (Array.isArray(obj)) {
		// Handle the case where obj is an array of NormalObjT
		return obj.map((item) => toCamelCase(item)) as T;
	}

	// Handle the case where obj is a NormalObjT (single object)
	return transform(obj, (result: NormalObjT, value: any, key: string, target) => {
		const camelKey = isArray(target) ? key : camelCase(key);
		result[camelKey] = isObject(value) ? toCamelCase(value as NormalObjT) : value;
	}) as T;
};

export function createDynamicObject(transformedData: Record<string, any>[]) {
	if (!transformedData || !Object.keys(transformedData).length) return {};
	return transformedData?.reduce((acc, item) => {
		acc[item.label] = item.value;
		return acc;
	}, {});
}

export const adjustTimeByOffset = (date: Date, utcOffset: string, format?: string) => {
	// Adjust the UTC time by the offset
	return moment(date).utcOffset(utcOffset).format(format);
};

export function checkDynamicObject(variables: string[], dataMap: Record<string, any>) {
	let result: Record<string, any> = {};
	for (let variable of variables) {
		if (!(variable in dataMap) || !dataMap[variable]) {
			return false;
		}
		result[variable] = dataMap[variable];
	}
	return result;
}

export const defaultConfig = {
	retryAfterDays: 1,
	maxAttempts: 3,
};

export function agentVoiceProvider(voiceId: string) {
	if (voiceId.includes('labs') || voiceId.includes('custom')) {
		return 'elevenlabs';
	}
	return null;
}

export function extractVariableTypes(variables: CustomVariableI[]): {
	dynamicVariable: NormalObjT;
	constantVariables: NormalObjT;
} {
	const dynamicVariable: NormalObjT = {};
	const constantVariables: NormalObjT = {};

	for (const variable of variables) {
		if (variable.type === CustomVariableypesE.VARIABLE) {
			dynamicVariable[variable.slug] = extractVariableName(variable.value);
		} else if (variable.type === CustomVariableypesE.CONSTANT) {
			constantVariables[variable.slug] = variable.value;
		}
	}
	return { dynamicVariable, constantVariables };
}

export function extractVariableName(value: string): string | null {
	const match = value.trim().match(/^\{\{\s*(.+?)\s*\}\}$/);
	if (match) {
		const camelCase = match[1];
		const snakeCase = camelCase.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
		return snakeCase;
	}
	return null;
}

export function isVariableValue(value: string): boolean {
	return /^\{\{.+\}\}$/.test(value.trim());
}
