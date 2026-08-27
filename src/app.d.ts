import type { User, Session } from 'better-auth';

declare global {
	namespace App {
		interface Locals {
			user?: User & {
				stravaAthleteId?: string | null;
				isAdmin?: boolean;
				needsEmail?: boolean;
			};
			session?: Session;
		}
	}
}

export {};
