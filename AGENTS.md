# AGENTS.md

Living instructions for coding agents working on this repository. Not a human README (see `README.md`).

**Maintain this file.** After any change that would mislead a future agent, update AGENTS.md in the same PR: add only concise, still-true facts; delete stale, redundant, or one-off history. Prefer pointing at source files over copying them. User chat instructions override this file.

## Project

Townsville virtual races ([runaround.com.au](https://runaround.com.au)). SvelteKit 2 + Svelte 5 (runes) + TypeScript 6, `@sveltejs/adapter-node` (Docker) or `@sveltejs/adapter-vercel` when `VERCEL=1` (selected in `svelte.config.js`), Tailwind 4, Drizzle + Postgres (PostGIS image; course geometry is JSON LineString in JS), Better Auth 1.7 generic OAuth (Strava; `account.issuer` is `local:oauth:strava`), MapLibre, Zod, Vitest, Playwright. Runtime is Node 24 LTS (`Dockerfile`, `.nvmrc`, `package.json` `engines`). App and worker share `src/lib/server` except the worker must not import `$app/*`. Stay on Kit 2 and TypeScript 6 until `svelte-check` peers TS 7 and Kit 3 is stable (`pnpm exec sv migrate` is major-version only).

**DB URL:** Production (Vercel/Supabase) must set `POSTGRES_URL` (pooled). Optional fallback `POSTGRES_URL_NON_POOLING` for direct/migrate. Resolution lives in `src/lib/server/db/postgres-url.ts` (used by runtime and `drizzle.config.ts`). Do not use `DATABASE_URL`.

Product: admins create Road/Trail races with GPX; runners log in with Strava; GPS (+ optional Strava segment) matching; **race-window** and **overall** leaderboards; Cloudflare Email Sending from the **worker** only (rank improvement, not drops; race-end place). Canonical race URLs: `/races/:id` (legacy segment ids).

## Commands

```bash
cp .env.template .env   # then fill values; never commit .env
pnpm run db:start
pnpm run db:migrate
pnpm run migrate:legacy  # idempotent; needs data/legacy/database.json
pnpm run dev             # web
pnpm run worker          # sync, match, email
pnpm run check
pnpm run test:unit -- --run
pnpm exec playwright test     # builds + preview
```

Docker: `docker compose up --build` (`db`, `web` on 4008, `worker`).

## Conventions

- Svelte 5 runes only. Validate `.svelte` with the Svelte MCP autofixer before finishing UI work.
- `git mv` when relocating tracked assets so history is preserved; do not copy-then-delete binaries.
- Static site files live in `static/` (SvelteKit): `robots.txt`, `humans.txt`, `llms.txt`, `ads.txt`. Dynamic sitemap is `src/routes/sitemap.xml`. HTML and `Link` headers advertise `llms.txt` (`rel=describedby`) per the [llms.txt](https://llmstxt.org/) spec.
- Matching: `src/lib/matching.ts` (road 25 m / trail 60 m buffer, ~85% coverage). Rank email only when `notified_rank` exists and the new place is strictly better.
- SEO: per-page `<Seo />` in `src/lib/components/Seo.svelte` (title, description, canonical, Open Graph, Twitter, optional JSON-LD). Site origin from `ORIGIN` env via root `+layout.server.ts`.
- Prefer relative imports in modules the worker loads (`src/worker`, `src/lib/server/sync.ts`, etc.).
- MapLibre: pass plain deep-cloned GeoJSON to `GeoJSONSource.setData` (see `courseOverlayFeatureCollection` in `src/lib/geo.ts`) — Svelte 5 Proxies often fail to render while `fitBounds` still works.
- Race detail / admin maps load the course overlay from `/races/:slug/course.json` (`RaceMap` `courseUrl`); listing maps still pass `races`/`focus` SSR props. A Vercel Draft Mode `HEAD` to the HTML race URL (`x-vercel-draft-status`) is unrelated to map fetches — do not treat it as a missing GPX/GeoJSON bug.
- GPX download links use `data-sveltekit-preload-data="off"` (and `data-sveltekit-reload` where needed) so the client router does not treat `/races/:slug/gpx` as a page navigation.
- Leaderboards: `attempts.effortUrl` flows through `rankedLeaderboard` (`src/lib/boards.ts`); `LeaderboardTable` links the time when `safeHttpUrl` accepts http(s).

## Security

Never commit `.env`, `.env.*` (except `.env.template`), or `strava_config.json`. Do not hardcode Strava, Thunderforest, Cloudflare, or other keys; use env (`PUBLIC_MAP_TILES` / `PUBLIC_THUNDERFOREST_API_KEY` for maps). If a secret appears in git, stop, rotate it, and do not repeat the value in chat or commits.

## Vercel env (Sensitive / Secret)

Kit options live in `svelte.config.js` (`kit.env.publicPrefix: 'PUBLIC_'`, adapter selection). Vercel’s Sensitive env UI needs that file so it can verify the public prefix. Server-only secrets (`BETTER_AUTH_SECRET`, `STRAVA_CLIENT_SECRET`, `STRAVA_VERIFY_TOKEN`, etc.) must **not** use `PUBLIC_` or `NEXT_PUBLIC_` — do not keep Supabase/`NEXT_PUBLIC_*` public prefixes for app secrets. After deploy of this config: add those as **Sensitive** in Vercel → Settings → Environment Variables. If the UI still flakes, **Encrypted** (non-Sensitive) still works for server-only vars.

## Git

- `main` is production. `develop` is staging and the default branch. Feature PRs target `develop`; promote to production with a PR from `develop` into `main`.
- Do not commit unless the user asks. Do not force-push `main` or `develop`. Do not merge PRs unless asked. Conventional, why-focused commit messages.

## Package manager

This repo uses **pnpm** (`packageManager` in `package.json`).

- Install: `pnpm install` (do not use npm/yarn for installs in this repo).
- Scripts: `pnpm run <script>` / `pnpm exec <bin>`.
- Lockfile: `pnpm-lock.yaml` only â€” do not commit `package-lock.json` or `yarn.lock`.
- Local disk: pnpm's content-addressable store shares package contents across checkouts on the same machine.
