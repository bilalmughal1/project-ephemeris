# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Ephemeris is a spatiotemporal satellite pass visualization app: a React/MapLibre frontend backed by an Express API that serves satellite trajectory ("telemetry") data out of DuckDB with its spatial extension. It's an npm workspaces monorepo (`backend`, `frontend`) currently in Phase 1 (core infrastructure) — the frontend is still Vite boilerplate; the backend has a working telemetry ingestion + pagination API.

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
- `database/db.ts` — owns the single DuckDB connection (`db`, `connection`, and a promisified `query(sql, params)` helper). `initDatabase()` runs on every startup: installs/loads the DuckDB `spatial` extension, then re-ingests `data/Altair-2P5S-tracks-1w.json` from scratch (drops and recreates `satellite_telemetry`). The source file is a GeoJSON `FeatureCollection`; ingestion loads it into a temp staging table, detects which top-level key holds the array (`features` / `tracks` / `data`, falling back to treating the file as already flat), and unnests it into one row per frame in `satellite_telemetry` (single column `telemetry_frame`, stored as JSON/struct). DuckDB persists to `duckdb/ephemeris.db` (path resolved relative to compiled `dist/`, i.e. three levels up from `backend/src/database`).
- `controllers/telemetry.controller.ts` — `getTelemetryData` reads `page`/`limit` query params, queries `satellite_telemetry` with `LIMIT`/`OFFSET`, and returns a GeoJSON-Feature-shaped payload (`{ type, properties, geometry }` per row) wrapped in a `meta` pagination envelope (`totalRecords`, `page`, `limit`, `totalPages`, `hasNextPage`, `hasPrevPage`). Serializes manually via `JSON.stringify` with a BigInt-safe replacer because DuckDB returns counts as `BigInt`.
- `routes/telemetry.routes.ts` — mounts `GET /` (full listing) under `/api/telemetry` (see `index.ts`).
- `GET /health` is defined directly in `index.ts`.

When adding new data endpoints, follow the existing route → controller → `query()` pattern rather than querying DuckDB directly from routes, and remember any BigInt-typed aggregate columns need the same serialization treatment.

### Frontend (`frontend/src`)

Standard Vite + React 19 + TypeScript template, not yet built out — `App.tsx` is still the scaffold starter page. Intended stack per the stack description: MapLibre GL JS for the map view, Zustand for client state, TanStack React Query for server state/data fetching against the backend API. `services/`, `store/`, `hooks/`, `pages/`, `types/`, `utils/` directories exist but are currently empty — establish conventions there as real features land.

### Data flow

`data/*.json` (GeoJSON tracks) → DuckDB ingestion in `initDatabase()` → `satellite_telemetry` table → `/api/telemetry` paginated REST endpoint → (future) frontend map rendering via MapLibre.
