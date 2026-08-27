# RunAround

Virtual running races in Townsville, North Queensland. This is a SvelteKit rebuild of the original Express + Strava scrape site ([#106](https://github.com/Luen/runaround/issues/106)).

## Stack

SvelteKit (adapter-node), PostgreSQL/PostGIS, Drizzle, Better Auth (Strava), MapLibre, Tailwind, Cloudflare Email Sending, Docker Compose.

## Local setup

1. Copy `.env.template` (or `.env.example`) to `.env` and fill Strava, Better Auth, and Cloudflare values. Do not commit `.env` or `strava_config.json`.
2. Start Postgres: `npm run db:start`
3. Apply schema: `npm run db:migrate`
4. Import 2021–2022 races: `npm run migrate:legacy`
5. App: `npm run dev`
6. Worker (sync, matching, email): `npm run worker`

Strava OAuth callback: `{ORIGIN}/api/auth/callback/strava`

Webhook: `{ORIGIN}/api/strava/webhook`

## Docker

`docker compose up --build` starts `db`, `web` (port 4008), and `worker`.

## Product

- Admins publish Road or Trail races with a GPX course.
- Runners log in with Strava. Activities are GPS-matched to the course (and to a Strava segment on migrated races).
- Each race has a **race window** leaderboard and an **overall** all-time board.
- Emails go out via Cloudflare Email Sending when a runner gains a place, and when the race window closes.

Deferred: Garmin / GPX upload ([#107](https://github.com/Luen/runaround/issues/107)), gender/age groups ([#1](https://github.com/Luen/runaround/issues/1)), Instagram ([#108](https://github.com/Luen/runaround/issues/108)).
