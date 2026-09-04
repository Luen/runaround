# RunAround

Virtual running races in Townsville, North Queensland.

## Stack

SvelteKit (adapter-node), PostgreSQL/PostGIS, Drizzle, Better Auth (Strava), MapLibre, Tailwind, Cloudflare Email Sending, Docker Compose.

## Local setup

1. Copy `.env.template` to `.env` and fill Strava, Better Auth, and Cloudflare values. Do not commit `.env` or `strava_config.json`.
2. Start Postgres: `pnpm run db:start`
3. Apply schema: `pnpm run db:migrate`
4. Import 2021–2022 races: `pnpm run migrate:legacy`
5. App: `pnpm run dev`
6. Worker (sync, matching, email): `pnpm run worker`

Strava OAuth callback: `{ORIGIN}/api/auth/callback/strava`

Webhook: `{ORIGIN}/api/strava/webhook`

## Docker

`docker compose up --build` starts `db`, `web` (port 4008), and `worker`.

## Branches

`develop` is staging (PRs merge here). `main` is production (promote with a PR from `develop`).

## Vercel + Cloudflare

Production web runs on **Vercel** (`adapter-vercel` when `VERCEL=1`); Docker still uses `adapter-node`.

DNS for `runaround.com.au` is proxied through **Cloudflare**. Set Cloudflare **SSL/TLS encryption mode** to **Full (strict)** — not Flexible. Flexible makes Cloudflare call Vercel over HTTP while Vercel redirects to HTTPS, causing `ERR_TOO_MANY_REDIRECTS`.

Cloudflare DNS should CNAME `@` and `www` to `cname.vercel-dns.com` (proxied orange cloud is fine once SSL mode is Full strict). Set `ORIGIN=https://runaround.com.au` on Vercel.

## Product

- Admins publish Road or Trail races with a GPX course.
- Runners log in with Strava. Activities are GPS-matched to the course (and to a Strava segment on migrated races).
- Each race has a **race window** leaderboard and an **overall** all-time board.
- Emails go out via Cloudflare Email Sending when a runner gains a place, and when the race window closes.
