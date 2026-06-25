# Deploy NextCRM on Railway

This repo is configured for Railway Docker deployments with `railway.json`.
The Docker image builds the Next.js standalone app, then the entrypoint runs
Prisma migrations and seeds the first admin user on startup.

## 1. Create Railway services

1. Create a new Railway project from this repository.
2. Add a PostgreSQL service with pgvector support. Search Railway templates for
   `pgvector`, `Postgres with pgVector`, or use a Postgres image that has the
   `vector` extension installed.
3. In the app service, set `DATABASE_URL` to the database service reference:

```txt
${{Postgres.DATABASE_URL}}
```

NextCRM runs `CREATE EXTENSION IF NOT EXISTS vector` during migrations, but that
only works when pgvector is already installed on the Postgres server. If
Railway's base Postgres image reports `extension "vector" is not available`, use
a pgvector template/provider instead. If the pgvector database requires SSL,
append `?sslmode=require` to `DATABASE_URL`.

## 2. Set required variables

Use `.env.railway.example` as the checklist. At minimum set:

```txt
DATABASE_URL=${{Postgres.DATABASE_URL}}
BETTER_AUTH_SECRET=<openssl rand -base64 32>
EMAIL_ENCRYPTION_KEY=<openssl rand -hex 32>
BETTER_AUTH_URL=https://your-nextcrm.up.railway.app
NEXT_PUBLIC_APP_URL=https://your-nextcrm.up.railway.app
ADMIN_EMAIL=you@example.com
NEXT_PUBLIC_APP_NAME=The RaidGuild Nexus
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=<sendgrid api key>
EMAIL_FROM=noreply@yourdomain.com
AUTH_GOOGLE_ENABLED=false
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
```

For production login, `EMAIL_FROM` must be a SendGrid-verified sender or a
sender on a SendGrid-authenticated domain. Resend is still supported by setting
`RESEND_API_KEY` instead of `EMAIL_PROVIDER=sendgrid`.

For Portal handoff login, configure the external module in Portal to callback to
`https://your-nextcrm.up.railway.app/portal/callback`, set its launch audience
and module slug to match the values below, and use the same shared secret in both
apps:

```txt
PORTAL_MODULE_LAUNCH_SECRET=<same secret configured in Portal>
PORTAL_LAUNCH_ISSUER=https://portal.raidguild.org
PORTAL_LAUNCH_AUDIENCE=nexus
PORTAL_LAUNCH_MODULE_SLUG=nexus
PORTAL_LAUNCH_REDIRECT_PATH=/
```

For AI integrations, this fork is designed to keep secrets in Railway variables:

```txt
AI_EMBEDDINGS_PROVIDER=venice
VENICE_API_KEY=<venice-api-key>
OPENAI_BASE_URL=https://api.venice.ai/api/v1
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1536
DOCUMENT_AI_PROVIDER=prism
DOCUMENT_AI_MODEL=prism-agent-workflow
AI_AGENT_PROVIDER=prism
PRISM_AGENT_API_BASE_URL=https://prism.raidguild.org
PRISM_AGENT_SERVICE_TOKEN=<agent-service-token>
PRISM_DOCUMENT_HOOK_KEY=crm-document-uploaded
PRISM_MEMORY_BASE_URL=https://prism.raidguild.org
PRISM_API_KEY=<memory-api-key>
```

`OPENAI_EMBEDDING_DIMENSIONS` must match the pgvector schema. The current schema
uses `vector(1536)`.

`DOCUMENT_AI_PROVIDER=prism` keeps CRM-owned upload, text extraction,
embeddings, and database updates, then sends extracted document text and
metadata to Prism Memory and triggers the Prism Agent API hook named by
`PRISM_DOCUMENT_HOOK_KEY`. Use `DOCUMENT_AI_PROVIDER=prism-codex` only when you
explicitly want direct synchronous Codex Runtime prompting through
`PRISM_CODEX_RUNTIME_URL`.

## 3. Deploy

Railway will use:

- Build method: Dockerfile
- Runtime port: `PORT`, injected by Railway
- Start command: Docker entrypoint, no custom command needed

On first boot the app waits for Postgres, runs `prisma migrate deploy`, and
seeds the database if no users exist.

## 4. First login

Go to the Railway app URL and sign in with `ADMIN_EMAIL`. NextCRM uses email
OTP login, so configure email delivery before using this as a production CRM.
