import {
	boolean,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	real,
	text,
	timestamp,
	uniqueIndex,
	index,
	uuid
} from 'drizzle-orm/pg-core';

export const raceSurface = pgEnum('race_surface', ['road', 'trail']);
export const raceStatus = pgEnum('race_status', ['draft', 'upcoming', 'live', 'closed']);
export const matchMethod = pgEnum('match_method', ['gps', 'segment_effort', 'import']);
export const attemptSource = pgEnum('attempt_source', ['live', 'strava_import']);
export const leaderboardKind = pgEnum('leaderboard_kind', ['race', 'overall']);
export const jobStatus = pgEnum('job_status', ['pending', 'running', 'done', 'failed']);

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
	stravaAthleteId: text('strava_athlete_id').unique(),
	isAdmin: boolean('is_admin').notNull().default(false),
	needsEmail: boolean('needs_email').notNull().default(true)
});

export const session = pgTable('session', {
	id: text('id').primaryKey(),
	expiresAt: timestamp('expires_at').notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' })
});

export const account = pgTable('account', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at'),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const verification = pgTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at').defaultNow()
});

export const races = pgTable(
	'races',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		slug: text('slug').notNull().unique(),
		title: text('title').notNull(),
		stravaName: text('strava_name'),
		description: text('description').notNull().default(''),
		surface: raceSurface('surface').notNull(),
		startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
		endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
		status: raceStatus('status').notNull().default('draft'),
		stravaSegmentId: text('strava_segment_id'),
		courseGeojson: jsonb('course_geojson').$type<import('$lib/geo').LineString>().notNull(),
		gpx: text('gpx'),
		distanceM: real('distance_m').notNull().default(0),
		elevationGainM: real('elevation_gain_m').notNull().default(0),
		elevationProfileUrl: text('elevation_profile_url'),
		raceEndEmailsSentAt: timestamp('race_end_emails_sent_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('races_status_idx').on(t.status), index('races_surface_idx').on(t.surface)]
);

export const activities = pgTable(
	'activities',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		stravaActivityId: text('strava_activity_id').notNull(),
		sport: text('sport').notNull().default('Run'),
		name: text('name').notNull().default(''),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
		distanceM: real('distance_m').notNull().default(0),
		movingTimeS: integer('moving_time_s').notNull().default(0),
		elapsedTimeS: integer('elapsed_time_s').notNull().default(0),
		summaryPolyline: text('summary_polyline'),
		streamFetchedAt: timestamp('stream_fetched_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('activities_strava_id_idx').on(t.stravaActivityId),
		index('activities_user_idx').on(t.userId)
	]
);

export const attempts = pgTable(
	'attempts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		raceId: uuid('race_id')
			.notNull()
			.references(() => races.id, { onDelete: 'cascade' }),
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
		activityId: uuid('activity_id').references(() => activities.id, { onDelete: 'set null' }),
		importedName: text('imported_name'),
		stravaAthleteId: text('strava_athlete_id'),
		timeMs: integer('time_ms').notNull(),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
		matchMethod: matchMethod('match_method').notNull(),
		coveragePct: real('coverage_pct'),
		source: attemptSource('source').notNull().default('live'),
		effortUrl: text('effort_url'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('attempts_race_idx').on(t.raceId),
		index('attempts_user_idx').on(t.userId),
		index('attempts_athlete_idx').on(t.stravaAthleteId)
	]
);

export const rankSnapshots = pgTable(
	'rank_snapshots',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		raceId: uuid('race_id')
			.notNull()
			.references(() => races.id, { onDelete: 'cascade' }),
		board: leaderboardKind('board').notNull(),
		rank: integer('rank').notNull(),
		notifiedRank: integer('notified_rank'),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('rank_snapshots_unique').on(t.userId, t.raceId, t.board)]
);

export const jobs = pgTable(
	'jobs',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		type: text('type').notNull(),
		payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
		status: jobStatus('status').notNull().default('pending'),
		runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
		attempts: integer('attempts').notNull().default(0),
		lastError: text('last_error'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('jobs_status_run_idx').on(t.status, t.runAt)]
);

export const emailSuppressions = pgTable('email_suppressions', {
	email: text('email').primaryKey(),
	reason: text('reason').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
