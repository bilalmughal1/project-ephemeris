# Ephemeris

Ephemeris is a full-stack spatiotemporal satellite-pass visualization app. It's map-centric: a React/MapLibre frontend backed by an Express API that serves satellite pass data out of DuckDB (with its spatial extension) for great-circle proximity and geometry queries. Two core functions cover browsing and searching satellite passes.

## Functions

- **Browse Tracks** — filter satellite passes by satellite and time range; results render as colored tracks on a MapLibre map.
- **Search by Location** — click a point on the map, set a radius (km) and date range, and see matching passes both on the map and in a synchronized Accesses table.

## Tech stack

**Backend**
- Node.js, Express, TypeScript
- DuckDB + spatial extension — great-circle proximity search and geometry built directly from track coordinates

**Frontend**
- React 19, TypeScript, Vite
- MapLibre GL JS — map rendering
- Zustand — client/filter state
- TanStack React Query — server-state data fetching
- OpenFreeMap — keyless OSM vector basemap (no API key required)

**Tooling**
- ESLint, Prettier
- Vitest (backend unit tests)
- Docker + Docker Compose
- GitHub Actions CI

## Prerequisites

- Node.js 24, npm
- Docker (optional — only needed for the containerized path)

**⚠️ Required dataset file:** the app needs `Altair-2P5S-tracks-1w.json` (~60MB) placed at `./data/Altair-2P5S-tracks-1w.json`. It is *not* included in this repo — it's gitignored due to size. Nothing renders without it. Place it before running either path below.

## How to run

### Docker (recommended)

```bash
# 1. Place the dataset file first:
#    ./data/Altair-2P5S-tracks-1w.json

docker compose up
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:4000](http://localhost:4000)

### Local dev

```bash
# 1. Place the dataset file first:
#    ./data/Altair-2P5S-tracks-1w.json

npm install

# In one terminal:
npm run dev --workspace=backend    # http://localhost:4000

# In another terminal:
npm run dev --workspace=frontend   # http://localhost:5173
```

The frontend dev server proxies `/api` requests to the backend (`http://localhost:4000` by default), so no CORS setup is needed locally.

## Testing & quality

```bash
# Backend unit tests (Vitest) — fixture-based, does NOT need the 60MB data file
npm run test --workspace=backend

# Lint
npm run lint --workspace=backend
npm run lint --workspace=frontend
```

GitHub Actions runs lint, tests, and build for both workspaces on every push and pull request to `main` — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Project structure

```
backend/    Express API, DuckDB ingestion, controllers/routes, tests/
frontend/   React + MapLibre UI (Browse Tracks, Search by Location)
data/       Place the dataset file here (gitignored, not in repo)
docs/       decisions.md — engineering decision log
```

## Engineering decisions

Key technical decisions — geometry construction, time-overlap filtering semantics, spatial proximity method, global map display density, and testing strategy — are recorded with their rationale, alternatives considered, and known limitations in [`docs/decisions.md`](docs/decisions.md). This README stays operational; that file is the "why."

## Use of AI coding agents

This project was implemented using Claude Code, with an Opus-based advisor consulted at key decision points, under a workflow where each change was reviewed before being written. `CLAUDE.md` documents the working context given to the agent.

## Known limitations & future work

These are deliberate, documented trade-offs — not oversights:

- **Search-radius results aren't clipped to the radius.** A matching pass renders as its full trajectory, not just the segment inside the search circle (see `docs/decisions.md`).
- **The search-radius circle doesn't special-case the antimeridian.** A search near ±180° longitude will visually streak across the map.
- **Map→table sync is one-way.** Clicking a table row highlights the corresponding track on the map; clicking a track on the map does not yet select its table row.
- **Backend still uses the legacy `duckdb` npm package**, not the newer `@duckdb/node-api`. A known effect: on Windows, the legacy binding can hold the database file handle open briefly after `close()` resolves, which can leave a stray temp directory after a local test run (harmless, doesn't affect test correctness or Linux/Docker behavior). Migrating to `@duckdb/node-api` is a planned next step.
