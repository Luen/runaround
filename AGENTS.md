# AGENTS.md

Living instructions for coding agents working on this repository. Not a human README (see `README.md`).

**Maintain this file.** After any change that would mislead a future agent, update AGENTS.md in the same PR: add only concise, still-true facts; delete stale, redundant, or one-off history. Prefer pointing at source files over copying them. User chat instructions override this file.

## Project

Townsville virtual races ([runaround.com.au](https://runaround.com.au)). SvelteKit 2 + Svelte 5 (runes) + TypeScript 6, `@sveltejs/adapter-node`, Tailwind 4, Drizzle + Postgres (PostGIS image; course geometry is JSON LineString in JS), Better Auth 1.7 generic OAuth (Strava; `account.issuer` is `local:oauth:strava`), MapLibre, Zod, Vitest, Playwright. Runtime is Node 24 LTS (`Dockerfile`, `.nvmrc`, `package.json` `engines`). App and worker share `src/lib/server` except the worker must not import `$app/*`. Stay on Kit 2 and TypeScript 6 until `svelte-check` peers TS 7 and Kit 3 is stable (`npx sv migrate` is major-version only).

Product: admins create Road/Trail races with GPX; runners log in with Strava; GPS (+ optional Strava segment) matching; **race-window** and **overall** leaderboards; Cloudflare Email Sending from the **worker** only (rank improvement, not drops; race-end place). Canonical race URLs: `/races/:id` (legacy segment ids).

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
- Static site files live in `static/` (SvelteKit): `robots.txt`, `humans.txt`, `llms.txt`, `ads.txt`. Dynamic sitemap is `src/routes/sitemap.xml`. HTML and `Link` headers advertise `llms.txt` (`rel=describedby`) per the [llms.txt](https://llmstxt.org/) spec. 
- Matching: `src/lib/matching.ts` (road 25 m / trail 60 m buffer, ~85% coverage). Rank email only when `notified_rank` exists and the new place is strictly better.
- Prefer relative imports in modules the worker loads (`src/worker`, `src/lib/server/sync.ts`, etc.).

## Security

Never commit `.env`, `.env.*` (except `.env.template`), or `strava_config.json`. Do not hardcode Strava, Thunderforest, Cloudflare, or other keys; use env (`PUBLIC_MAP_TILES` / `PUBLIC_THUNDERFOREST_API_KEY` for maps). If a secret appears in git, stop, rotate it, and do not repeat the value in chat or commits.

## Git

- `main` is production. `develop` is staging and the default branch. Feature PRs target `develop`; promote to production with a PR from `develop` into `main`.
- Do not commit unless the user asks. Do not force-push `main` or `develop`. Do not merge PRs unless asked. Conventional, why-focused commit messages.
