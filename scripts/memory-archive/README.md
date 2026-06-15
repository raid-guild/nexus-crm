# Memory Archive CRM Import

`prepare-crm-import.mjs` turns the `../memory-archive` external CRM project
export into reviewable NextCRM-shaped account and opportunity drafts.

It is intentionally dry-run only. It writes CSV/JSON/Markdown review artifacts
and does not touch the database.

Default scope:

- includes `RAIDING` and `PREPARING` records
- excludes shipped/lost historical records
- excludes possible duplicates
- keeps internal raid-party people as provenance, not CRM contacts

Relationship history scope:

- includes `RAIDING`, `PREPARING`, and high-scoring `SHIPPED` records
- defaults to `--min-score=10`
- groups known same-client project families into one account with multiple opportunities
- keeps possible duplicates out of the import draft for review

Full legacy CRM scope:

- includes every legacy CRM candidate from the archive
- keeps `LOST`, low-score, duplicate, and knowledge-only records in the draft
- marks risky/low-confidence rows as `needs_review`
- should be reviewed before any live database import

Run:

```bash
node scripts/memory-archive/prepare-crm-import.mjs
```

Run the approved relationship-history preview:

```bash
pnpm memory:crm:relationship-preview
```

Run the full legacy CRM preview:

```bash
pnpm memory:crm:full-preview
```

Useful options:

```bash
node scripts/memory-archive/prepare-crm-import.mjs --profile=relationship-history --group-clients=false
node scripts/memory-archive/prepare-crm-import.mjs --include-shipped=true
node scripts/memory-archive/prepare-crm-import.mjs --include-duplicates=true
node scripts/memory-archive/prepare-crm-import.mjs --min-score=10
node scripts/memory-archive/prepare-crm-import.mjs --archive=../memory-archive --out=exports/memory-crm-import-preview
```
