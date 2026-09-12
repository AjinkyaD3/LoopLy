# Work Log

This folder is a running record of what was done to this codebase in each Claude Code session —
useful for picking up context across sessions without re-deriving it from `git log` alone.

## Format

One file per session (or per logical chunk of work in a long session):

```
logs/YYYY-MM-DD-short-slug.md
```

Each entry should be short and cover:

```markdown
# YYYY-MM-DD — Short title

## What changed
- Bullet list of concrete changes (files/areas touched)

## Why
1-3 sentences of motivation/context — the part not obvious from the diff itself.

## Verification
What you ran to confirm it worked (build/tests/manual check) and the result.

## Follow-ups
Anything left open, deferred, or worth revisiting later. Omit if none.
```

Keep entries factual and terse — this is a log, not a report. Don't duplicate what `git log`
already tells you (commit list, diff content); focus on decisions, rationale, and verification
that wouldn't survive in the commit alone.
