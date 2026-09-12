# 2026-09-11 — Project review + Claude tooling setup

## What changed
- Added `CLAUDE.md` at repo root: architecture map, data model summary, the two-auth-flow rule
  (business owner vs. no-login customer), route-handler conventions, and commands.
- Added `.claude/agents/looply-engineer.md`: a project-scoped subagent for implementing/reviewing
  changes in this repo, encoding the tenant-isolation and transaction-safety rules found in the
  existing code.
- Added `logs/` (this folder) with `logs/README.md` defining the log entry format for future
  sessions.

## Why
User asked for a full review of how the project works plus persistent Claude Code tooling
(project instructions, an agent, and a log of work) so future sessions have context without
re-deriving it from scratch each time.

## Verification
Read-only review — no application code, schema, or dependencies were changed. Reviewed:
`package.json`, `prisma/schema.prisma`, `src/lib/auth.ts`, `src/lib/storage.ts`,
`src/lib/rate-limit.ts`, `src/app/join/[businessToken]/page.tsx`,
`src/app/api/business/requests/[requestId]/route.ts`, `vitest.config.ts`, git log, and the
existing `looply-complete-login-removal-prompt.md` (confirms the current schema already reflects
that restructure — `Customer` has no FK to `User`, no `role` enum on `User`).

## Follow-ups
- `README.md` currently just contains placeholder text ("asd") — worth writing a real one.
- `scratch/*.js` one-off scripts exist at repo root; not reviewed in depth, flagged in `CLAUDE.md`
  as throwaway/ignorable unless asked about.
