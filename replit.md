# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Project

**Poll Analytics Dashboard** for IITJ (Indian Institute of Technology Jodhpur)
- Accepts Zoom poll CSV uploads with session metadata
- Parses the non-standard Zoom CSV format
- Stores all data persistently in PostgreSQL
- Shows an interactive 6-level drill-down dashboard
- Analyzes free-text feedback with NLP (pure JS, no external libraries)
- Detects and rejects duplicate uploads

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── health.ts
│   │       │   ├── upload.ts      # POST /api/upload (multer, CSV parsing)
│   │       │   └── dashboard.ts   # GET /api/summary|subjects|cohorts|trends|distribution|feedback|history
│   │       └── services/
│   │           ├── csvParser.ts   # Zoom CSV custom parser
│   │           ├── nlp.ts         # Sentiment + theme classification (pure JS)
│   │           └── metrics.ts     # Compute averages, NPS, distributions
│   └── poll-dashboard/     # React + Vite frontend (at path /)
│       └── src/
│           ├── pages/
│           │   ├── dashboard.tsx  # Main analytics dashboard
│           │   └── upload.tsx     # CSV upload page
│           └── components/
│               ├── layout.tsx
│               └── subject-drilldown.tsx
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/
│           └── polls.ts    # uploads, poll_responses, students tables
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

Three tables in PostgreSQL:
- `uploads` - One row per uploaded CSV (unique on meeting_id for duplicate detection)
- `poll_responses` - Individual student responses with NLP sentiment/themes
- `students` - Deduplicated student records

## API Endpoints

All at `/api/`:
- `GET /healthz` - Health check
- `POST /upload` - Upload Zoom poll CSV (multipart/form-data)
- `GET /summary` - Overall KPI summary
- `GET /subjects` - Per-subject analytics
- `GET /cohorts` - Cohort breakdown
- `GET /trends?subject=X` - Weekly trends
- `GET /distribution?subject=X&type=delivery|content` - Rating distribution
- `GET /feedback?subject=X` - NLP feedback analysis
- `GET /history` - Upload history

## Cohort Detection

- Email starts with `b25bs` → Cohort `2025-BS`
- Email starts with `b24bs` → Cohort `2024-BS`
- Email starts with `b23bs` → Cohort `2023-BS`
- Anything else → `External/Unknown`

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
- `pnpm --filter @workspace/api-spec run codegen` — regenerates API client and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes to PostgreSQL
