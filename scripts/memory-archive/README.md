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

Run:

```bash
node scripts/memory-archive/prepare-crm-import.mjs
```

Useful options:

```bash
node scripts/memory-archive/prepare-crm-import.mjs --include-shipped=true
node scripts/memory-archive/prepare-crm-import.mjs --include-duplicates=true
node scripts/memory-archive/prepare-crm-import.mjs --min-score=10
node scripts/memory-archive/prepare-crm-import.mjs --archive=../memory-archive --out=exports/memory-crm-import-preview
```
