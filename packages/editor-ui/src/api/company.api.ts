interface ICompanyCredentials {
	email: string;
	password: string;
}

import { COMPANY } from '@/constants/company';

export async function getCompanyCredentials(companyId: string): Promise<ICompanyCredentials> {
	const credentials = COMPANY[companyId as keyof typeof COMPANY];
	if (!credentials) {
		throw new Error('Company not found');
	}
	return credentials;
}
