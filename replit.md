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
- Dual CSV format support: Format A (Zoom preamble) and Format B (flat CSV with Instructor/Topic columns)
- Client-side Format B detection with auto-fill of instructor/topic fields
- Stores all data persistently in PostgreSQL
- Shows an interactive analytics dashboard with tabs: Overview, Instructors, Topics
- Analyzes free-text feedback with NLP (pure JS, no external libraries)
- Detects and rejects duplicate uploads
- Edit-after-upload: PATCH endpoint to update instructor/topic for any session

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── health.ts
│   │       │   ├── upload.ts      # POST /api/upload + PATCH /api/upload/:id
│   │       │   └── dashboard.ts   # All dashboard endpoints incl. instructors/topics
│   │       └── services/
│   │           ├── csvParser.ts   # Format A/B detection + parsing
│   │           ├── nlp.ts         # Sentiment + theme classification (pure JS)
│   │           └── metrics.ts     # Compute averages, NPS, distributions
│   └── poll-dashboard/     # React + Vite frontend (at path /)
│       └── src/
│           ├── pages/
│           │   ├── dashboard.tsx  # Tabbed: Overview | Instructors | Topics + 7 KPI cards
│           │   └── upload.tsx     # Upload + Format B detection + edit modal
│           └── components/
│               ├── layout.tsx
│               └── subject-drilldown.tsx  # Includes Topic/Instructor columns
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
- `uploads` - One row per uploaded CSV (unique on meeting_id). Has `format_version`, `instructor`, `topic`
- `poll_responses` - Individual student responses with NLP sentiment/themes. Has `instructor`, `topic`, `additional_feedback`, `additional_sentiment`, `additional_themes`
- `students` - Deduplicated student records

## API Endpoints

All at `/api/`:
- `GET /healthz` - Health check
- `POST /upload` - Upload Zoom poll CSV (multipart/form-data); auto-detects format
- `PATCH /upload/:id` - Update instructor/topic for a session (edit after upload)
- `GET /summary` - Overall KPI summary (includes `total_instructors`, `total_topics`)
- `GET /subjects` - Per-subject analytics (includes instructors list)
- `GET /subject-sessions?subject=X` - Sessions for subject (includes instructor, topic)
- `GET /cohorts` - Cohort breakdown
- `GET /trends?subject=X` - Weekly trends
- `GET /distribution?subject=X&type=delivery|content&upload_id=N` - Rating distribution
- `GET /distribution/overall` - Overall distribution
- `GET /feedback?subject=X&upload_id=N` - NLP feedback analysis
- `GET /feedback/overview` - Overall feedback sentiment
- `GET /history` - Upload history (includes format_version, instructor, topic)
- `GET /instructors` - All instructors with analytics
- `GET /instructor/:name` - Per-instructor drill-down
- `GET /topics?subject=X&instructor=X` - All topics with analytics
- `GET /topic/:topicName` - Per-topic drill-down

## CSV Format Detection

- **Format A**: Standard Zoom export with preamble (Overview/Meeting ID/Topic rows), then participant table
- **Format B**: Flat CSV with header row including "Instructor", "Topic/Name", "Session Rating" columns
  - Single rating stored in both `delivery_rating` and `content_rating` so existing charts work
  - Dominant instructor/topic extracted from row counts

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
