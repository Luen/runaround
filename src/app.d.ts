import type { User, Session } from 'better-auth';

declare global {
	namespace App {
		interface Locals {
			user?: User & {
				stravaAthleteId?: string | null;
				isAdmin?: boolean;
				needsEmail?: boolean;
				newsletterOptIn?: boolean;
				newsletterOptInAt?: Date | null;
			};
			session?: Session;
		}
	}
}

export {};
