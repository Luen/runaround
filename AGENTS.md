# AGENTS.md

Living instructions for coding agents working on this repository. Not a human README (see `README.md`).

**Maintain this file.** After any change that would mislead a future agent, update AGENTS.md in the same PR: add only concise, still-true facts; delete stale, redundant, or one-off history. Prefer pointing at source files over copying them. User chat instructions override this file.

## Project

Townsville virtual races ([runaround.com.au](https://runaround.com.au)). SvelteKit 2 + Svelte 5 (runes) + TypeScript, `@sveltejs/adapter-node`, Tailwind 4, Drizzle + Postgres (PostGIS image; course geometry is JSON LineString in JS), Better Auth generic OAuth (Strava), MapLibre, Zod, Vitest, Playwright. App and worker share `src/lib/server` except the worker must not import `$app/*`.

Product: admins create Road/Trail races with GPX; runners log in with Strava; GPS (+ optional Strava segment) matching; **race-window** and **overall** leaderboards; Cloudflare Email Sending from the **worker** only (rank improvement, not drops; race-end place). Canonical race URLs: `/races/:id` (legacy segment ids).

Out of scope unless the user asks: Garmin / manual GPX-FIT ([#107](https://github.com/Luen/runaround/issues/107)), gender/age ([#1](https://github.com/Luen/runaround/issues/1)), Instagram ([#108](https://github.com/Luen/runaround/issues/108)).

## Commands

```bash
cp .env.template .env   # then fill values; never commit .env
npm run db:start
npm run db:migrate
npm run migrate:legacy  # idempotent; needs data/legacy/database.json
npm run dev             # web
npm run worker          # sync, match, email
npm run check
npm run test:unit -- --run
npx playwright test     # builds + preview
```

Docker: `docker compose up --build` (`db`, `web` on 4008, `worker`).

## Conventions

- Svelte 5 runes only. Validate `.svelte` with the Svelte MCP autofixer before finishing UI work.
- `git mv` when relocating tracked assets so history is preserved; do not copy-then-delete binaries.
- Static site files live in `static/` (SvelteKit). Do not revive Express `public/`, `index.js`, `build.js`, or scrape scripts.
- Matching: `src/lib/matching.ts` (road 25 m / trail 60 m buffer, ~85% coverage). Rank email only when `notified_rank` exists and the new place is strictly better.
- Prefer relative imports in modules the worker loads (`src/worker`, `src/lib/server/sync.ts`, etc.).

## Security

Never commit `.env`, `.env.*` (except `.env.template` / `.env.example`), or `strava_config.json`. Do not hardcode Strava, Thunderforest, Cloudflare, or other keys; use env (`PUBLIC_MAP_TILES` / `PUBLIC_THUNDERFOREST_API_KEY` for maps). If a secret appears in git, stop, rotate it, and do not repeat the value in chat or commits.

## Git

Do not commit unless the user asks. Do not force-push `main`. Do not merge PRs unless asked. Conventional, why-focused commit messages.
