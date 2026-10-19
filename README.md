# RunAround

Virtual running races in Townsville, North Queensland.

## Stack

SvelteKit (adapter-node), PostgreSQL/PostGIS, Drizzle, Better Auth (magic link + Strava), MapLibre, Tailwind, Cloudflare Email Sending, Docker Compose.

## Local setup

1. Copy `.env.template` to `.env` and fill Strava, Better Auth, and Cloudflare values. Do not commit `.env` or `strava_config.json`.
2. Start Postgres: `pnpm run db:start`
3. Apply schema: `pnpm run db:migrate`
4. Import 2021–2022 races: `pnpm run migrate:legacy`
5. App: `pnpm run dev`
6. Worker (sync, matching, email): `pnpm run worker`

Strava OAuth callback: `{ORIGIN}/api/auth/callback/strava`

Webhook: `{ORIGIN}/api/strava/webhook`

Onboarding email: `{ORIGIN}/onboarding/email` — Strava runners are sent here to add an email address, since Strava does not share one. Leave before adding an email and you keep getting redirected back here.

Magic-link login (`MAGIC_LINK_ENABLED=true` + Cloudflare email env): `{ORIGIN}/login` presents email first. New runners can opt in to the monthly newsletter on that form, in onboarding, or later on `/me`; every newsletter includes a signed `{ORIGIN}/newsletter/unsubscribe` link.

## Docker

`docker compose up --build` starts `db`, `web` (port 4008), and `worker`.

## Branches

`develop` is staging (PRs merge here). `main` is production (promote with a PR from `develop`).

## Vercel + Cloudflare

Production web runs on **Vercel** (`adapter-vercel` when `VERCEL=1`); Docker still uses `adapter-node`. Kit config (including `kit.env.publicPrefix: 'PUBLIC_'`) lives in `svelte.config.js`.

On Vercel Production (and Preview), set **`POSTGRES_URL`** to the Supabase pooled connection string (Supabase/Vercel inject this name by default). Optional: `POSTGRES_URL_NON_POOLING` for direct connections/migrations.

Server-only secrets (`BETTER_AUTH_SECRET`, `STRAVA_CLIENT_SECRET`, `STRAVA_VERIFY_TOKEN`, and similar) should be added as **Sensitive** in Vercel → Settings → Environment Variables. Do not prefix them with `PUBLIC_` or `NEXT_PUBLIC_` (Supabase may suggest Next-style public prefixes — ignore those for this app). If Sensitive verification still fails after a deploy that includes `svelte.config.js`, use **Encrypted** instead; it is fine for server-only vars.

DNS for `runaround.com.au` is proxied through **Cloudflare**. Set Cloudflare **SSL/TLS encryption mode** to **Full (strict)** — not Flexible. Flexible makes Cloudflare call Vercel over HTTP while Vercel redirects to HTTPS, causing `ERR_TOO_MANY_REDIRECTS`.

Cloudflare DNS should CNAME `@` and `www` to `cname.vercel-dns.com` (proxied orange cloud is fine once SSL mode is Full strict). Set `ORIGIN=https://runaround.com.au` on Vercel.

## Product

- Admins publish Road or Trail races with a GPX course.
- Runners log in with an email magic link (or Strava). Strava and Garmin are optional activity connections; GPX uploads work without either.
- Activities are GPS-matched to the course (and to a Strava segment on migrated races).
- Each race has a **race window** leaderboard and an **overall** all-time board.
- Emails go out via Cloudflare Email Sending when a runner gains a place, when the race window closes, and for the opt-in monthly newsletter.
- Suspicious uploads are flagged for admin review on `/admin/races/:slug`; admins can clear the flag or remove the upload.
