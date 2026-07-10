# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Ephemeris is a spatiotemporal satellite pass visualization app: a React/MapLibre frontend backed by an Express API that serves satellite pass data out of DuckDB with its spatial extension. It's an npm workspaces monorepo (`backend`, `frontend`); both the frontend (map + filter/search UI) and backend (pass ingestion + spatial query API) are implemented.

## Commands

Run from repo root unless noted.

- Install all workspace deps: `npm install`
- Backend dev server (tsx watch, hot reload): `npm run dev --workspace=backend` (or `cd backend && npm run dev`) — serves on `http://localhost:4000`
- Backend build (typecheck + emit): `cd backend && npm run build`
- Frontend dev server: `cd frontend && npm run dev` — serves on Vite's default port (Docker maps it to `3000`)
- Frontend build: `cd frontend && npm run build` (runs `tsc -b` then `vite build`)
- Frontend lint: `cd frontend && npm run lint`
- Full stack via Docker: `docker compose up` (builds `backend/Dockerfile.dev` and `frontend/Dockerfile.dev`, mounts source as volumes for live reload)

There is no backend lint/test script and no test runner configured yet (`backend/tests/` exists but is empty).

## Architecture

### Backend (`backend/src`)

Express 5 app (ESM, NodeNext module resolution, strict TypeScript). Layering: `routes/` → `controllers/` → `database/`.

- `index.ts` — app bootstrap. Calls `initDatabase()` before binding the port, so the server won't accept traffic until DuckDB ingestion finishes.
- `database/db.ts` — owns the single DuckDB connection (`db`, `connection`, and a promisified `query(sql, params)` helper). `initDatabase()` runs on every startup: installs/loads the DuckDB `spatial` extension, then re-ingests `data/Altair-2P5S-tracks-1w.json` from scratch (drops and recreates `passes`). The source file is a GeoJSON `FeatureCollection`; ingestion loads it into a temp staging table, detects which top-level key holds the array (`features` / `tracks` / `data`, falling back to treating the file as already flat), and unnests it into one row per pass in `passes` — typed columns (`satellite`, `ts_start`, `ts_end`, `local_time_h`) plus a `geom` `GEOMETRY` column built from the coordinate list via `ST_MakeLine`/`ST_Point`. DuckDB persists to `duckdb/ephemeris.db` (path resolved relative to compiled `dist/`, i.e. three levels up from `backend/src/database`).
- `controllers/passes.controller.ts` — `getPasses` filters `passes` by `satellite` membership and/or `ts_start`/`ts_end` interval overlap (`from`/`to` query params), returning a GeoJSON `FeatureCollection` (`ST_AsGeoJSON(geom)` per row, properties = `satellite`, `ts_start`, `ts_end`, `local_time_h`). `searchPasses` adds a point-radius filter: given `lat`/`lng`/`radius_km`, it computes the minimum great-circle distance (`ST_Distance_Sphere`) from the click point to each of a pass's 7 sampled track vertices (`ST_PointN` 1–7), since `ST_Distance_Sphere` doesn't accept LINESTRING geometry directly. Both serialize manually via `JSON.stringify` with a BigInt-safe replacer.
- `routes/passes.routes.ts` — mounts `GET /` (`getPasses`) and `GET /search` (`searchPasses`) under `/api/passes` (see `index.ts`).
- `GET /health` is defined directly in `index.ts`.

When adding new data endpoints, follow the existing route → controller → `query()` pattern rather than querying DuckDB directly from routes, and remember any BigInt-typed aggregate columns need the same serialization treatment.

### Frontend (`frontend/src`)

React 19 + TypeScript (Vite). MapLibre GL JS renders the map (OpenFreeMap dark basemap); Zustand (`store/`) holds filter/search UI state; TanStack React Query (`hooks/`) fetches from the backend via Vite's dev-server proxy (`/api` → `http://localhost:4000`, configured in `vite.config.ts`).

Two modes, toggled via `components/ModeSwitch.tsx`:
- **Browse Tracks** (Function 1) — `FilterPanel.tsx` filters passes by satellite and time range; results draw as colored tracks on `Map.tsx`.
- **Search by Location** (Function 2) — `SearchPanel.tsx` takes a map click plus radius + date range; matches render on the map and in `AccessesTable.tsx`, a synchronized table with one-way row→map highlighting.

`services/` wraps the two API calls (`passesApi.ts`, `searchApi.ts`); `types/passes.ts` holds shared response types; `utils/geoCircle.ts` computes the search-radius circle overlay.

### Data flow

`data/*.json` (GeoJSON tracks) → DuckDB ingestion in `initDatabase()` → `passes` table (typed columns + `GEOMETRY`) → `/api/passes` and `/api/passes/search` REST endpoints → frontend map rendering via MapLibre.
