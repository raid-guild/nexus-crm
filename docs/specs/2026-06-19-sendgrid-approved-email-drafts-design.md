# SendGrid Approved Email Drafts and Agent Outbound

## Goal

Enable agents to draft outbound email through NextCRM while keeping humans in control of sending. NextCRM should send approved messages through SendGrid, keep `clerics@raidguild.org` as the operational Gmail mailbox, and preserve a clear audit trail from lead context to draft approval to sent email.

## Kickoff Review Checklist

Review these items with product, engineering, infra, bizdev, and agent owners before implementation starts:

- Confirm the operating model: agents draft, humans approve, CRM sends.
- Confirm whether MCP approval is allowed in v1 or approval must happen in the CRM UI.
- Confirm which roles can approve and send drafts.
- Confirm whether token scopes are required before exposing email draft MCP tools to external agents.
- Confirm the first supported senders: `no-reply@raidguild.org` for system mail and `clerics@raidguild.org` for bizdev outbound.
- Confirm the first inbound strategy: Gmail sync for `clerics@raidguild.org`, not SendGrid Inbound Parse.
- Confirm which CRM objects drafts can attach to in v1: leads, contacts, accounts, opportunities.
- Confirm what source metadata external agents must provide.
- Confirm audit-log requirements for draft creation, approval, sending, rejection, and failure.
- Confirm whether campaign sending should be migrated to SendGrid in the same implementation phase or handled separately.
- Confirm acceptance criteria for the first release.

## Current State

- `SENDGRID_API_KEY` is configured in Railway.
- `clerics@raidguild.org` is an existing Gmail/Google Workspace mailbox and must remain in use.
- `no-reply@raidguild.org` is approved for system/transactional mail.
- `lib/resend.ts` already wraps SendGrid for auth/system email when `SENDGRID_API_KEY` or `EMAIL_PROVIDER=sendgrid` is present.
- Campaign send jobs currently import `Resend` directly in `inngest/functions/campaigns/send-step.ts`.
- The email module supports user-owned IMAP/SMTP accounts in `EmailAccount`, `Email`, and `actions/emails/*`.
- MCP exposes CRM tools and `crm_list_email_accounts`, but no send-email or draft workflow.

## Non-Goals

- Do not give agents direct access to SendGrid credentials.
- Do not let agents send arbitrary unapproved email.
- Do not replace `clerics@raidguild.org` as the shared mailbox.
- Do not move root `raidguild.org` MX records to SendGrid.
- Do not build full marketing automation before the approved-draft workflow is stable.

## Sending Lanes

### Transactional/System

Use SendGrid through the existing shared mail helper.

Examples:

- Login verification codes
- Invites
- System notifications
- Internal workflow alerts

Recommended env:

```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=...
TRANSACTIONAL_FROM_EMAIL=no-reply@raidguild.org
EMAIL_FROM=no-reply@raidguild.org
```

### Human-Owned One-to-One Outbound

Use `clerics@raidguild.org` as the shared bizdev sender/reply mailbox. The Discord agent and other external agents create drafts. A human approves the draft. NextCRM sends it through SendGrid only after approval.

Recommended env:

```bash
OUTBOUND_FROM_EMAIL=clerics@raidguild.org
OUTBOUND_FROM_NAME=RaidGuild Clerics
OUTBOUND_REPLY_TO=clerics@raidguild.org
```

### Campaign/Bulk Outbound

Use the existing Campaigns module, but replace direct Resend usage with the SendGrid-capable shared mail helper. Campaign sending should remain separate from one-to-one approved drafts.

Recommended env:

```bash
RESEND_API_KEY= # not required after SendGrid migration
RESEND_FROM_EMAIL= # deprecated after SendGrid migration
CAMPAIGN_FROM_EMAIL=clerics@raidguild.org
CAMPAIGN_REPLY_TO=clerics@raidguild.org
```

## Data Model

Add an `EmailDraft` model or similarly named CRM model.

Recommended fields:

```prisma
model EmailDraft {
  id              String   @id @default(uuid()) @db.Uuid
  status          EmailDraftStatus @default(DRAFT)

  subject         String
  bodyText        String?
  bodyHtml        String?

  fromEmail       String
  fromName        String?
  replyTo         String?
  toRecipients    Json     @db.JsonB
  ccRecipients    Json?    @db.JsonB
  bccRecipients   Json?    @db.JsonB

  leadId          String?  @db.Uuid
  contactId       String?  @db.Uuid
  accountId       String?  @db.Uuid
  opportunityId   String?  @db.Uuid

  source          String?  // discord, telegram, portal, external-app, manual
  sourceThreadId  String?
  sourceMessageId String?
  externalAgentId String?

  createdBy       String?  @db.Uuid
  approvedBy      String?  @db.Uuid
  sentBy          String?  @db.Uuid
  sendgridMessageId String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  approvedAt      DateTime?
  sentAt          DateTime?
  rejectedAt      DateTime?

  errorMessage    String?

  @@index([status])
  @@index([leadId])
  @@index([contactId])
  @@index([accountId])
  @@index([opportunityId])
  @@index([createdBy])
  @@index([source, sourceThreadId])
}

enum EmailDraftStatus {
  DRAFT
  NEEDS_REVIEW
  APPROVED
  SENT
  REJECTED
  FAILED
}
```

Optional later fields:

- `scheduledAt`
- `templateId`
- `prismRunId`
- `researchSummary`
- `approvalNotes`
- `riskFlags`

## MCP Tools

Add MCP tools for the approved draft lifecycle.

### `crm_create_email_draft`

Creates a draft tied to a CRM object.

Required:

- `subject`
- `bodyText` or `bodyHtml`
- at least one recipient
- at least one CRM link or explicit `source`

Useful args:

```ts
{
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  leadId?: string;
  contactId?: string;
  accountId?: string;
  opportunityId?: string;
  source?: "discord" | "telegram" | "portal" | "external-app" | "manual";
  sourceThreadId?: string;
  sourceMessageId?: string;
  externalAgentId?: string;
}
```

Behavior:

- Creates draft as `NEEDS_REVIEW`.
- Sets `fromEmail` from `OUTBOUND_FROM_EMAIL`.
- Sets `replyTo` from `OUTBOUND_REPLY_TO`.
- Uses MCP token owner as `createdBy`.
- Does not send.

### `crm_update_email_draft`

Allows agent or user to revise a draft before approval.

Rules:

- Only `DRAFT`, `NEEDS_REVIEW`, or `REJECTED` drafts can be edited.
- Editing an approved draft should move it back to `NEEDS_REVIEW`.

### `crm_list_email_drafts`

Lists drafts by status, CRM object, or source.

### `crm_get_email_draft`

Returns a single draft with linked lead/contact/account/opportunity summary.

### `crm_approve_email_draft`

Approves a draft for sending.

Rules:

- Should require an authenticated CRM user with appropriate permission.
- For MCP, approval should only be allowed for tokens intentionally granted approval rights. If token scopes are not implemented yet, do not expose approval broadly.
- Sets `approvedBy` and `approvedAt`.

### `crm_send_approved_email_draft`

Sends only approved drafts.

Rules:

- Refuse unless status is `APPROVED`.
- Send through SendGrid.
- Store `sendgridMessageId`.
- Write a sent `Email` record or `EmailDraft.sentAt` at minimum.
- Link sent email back to the CRM object.
- Set status to `SENT` or `FAILED`.

## Approval and Safety Rules

- Agents may create drafts.
- Agents may revise drafts.
- Agents may request approval.
- Agents must not send unapproved drafts.
- Deleting drafts should be human-only or admin-only.
- Every sent email must have an audit trail.
- Every draft created from Discord/Telegram/external apps should include source metadata.
- If an agent generated uncertain claims, the draft should be marked `NEEDS_REVIEW` with notes.

## SendGrid Migration Tasks

1. Refactor campaign sending to use the shared SendGrid-capable helper rather than direct `Resend`.
2. Add explicit outbound env handling:
   - `OUTBOUND_FROM_EMAIL`
   - `OUTBOUND_FROM_NAME`
   - `OUTBOUND_REPLY_TO`
   - `CAMPAIGN_FROM_EMAIL`
   - `CAMPAIGN_REPLY_TO`
3. Keep `EMAIL_FROM` for auth/system mail or migrate to `TRANSACTIONAL_FROM_EMAIL`.
4. Add approved draft data model and migration.
5. Add server-side send helper for approved drafts.
6. Add MCP draft tools.
7. Add audit log entries for draft create, approve, send, reject, fail.
8. Add basic UI for reviewing/approving drafts, even if most creation happens from Discord.
9. Add tests for:
   - agent can create draft
   - unapproved draft cannot send
   - approved draft sends through mocked SendGrid
   - sent draft writes CRM email/activity/audit record
   - external source metadata is preserved

## Inbound Email Plan

### Stage 1: Gmail/IMAP Sync

Because `clerics@raidguild.org` is an existing Gmail mailbox, keep it as the primary inbound mailbox.

Implementation:

- Add/connect `clerics@raidguild.org` in Profile -> Emails with Gmail IMAP/SMTP settings.
- Use existing sync jobs to ingest inbox/sent mail.
- Improve linking logic if needed so replies from known leads/contacts are linked by email address.
- Surface inbound replies on lead/contact/account pages.

### Stage 2: Reply Routing

For better threading, add outbound headers and metadata:

- `Reply-To: clerics@raidguild.org`
- `X-NextCRM-Draft-ID`
- `X-NextCRM-Lead-ID`
- `X-NextCRM-Contact-ID`

Gmail may not preserve all custom headers in forwarded/synced contexts, so this should be a best-effort enhancement, not the only linking strategy.

### Stage 3: SendGrid Inbound Parse for Subdomain

If precise automated reply routing becomes important, set up SendGrid Inbound Parse on a subdomain like:

```text
reply.raidguild.org
```

Then use unique reply addresses:

```text
lead+<leadId>@reply.raidguild.org
draft+<draftId>@reply.raidguild.org
```

Do not move root `raidguild.org` MX records away from Gmail.

## External Agent Support

External agents may come from Discord, Telegram, Portal, or other apps. They should all use the same NextCRM MCP draft tools and identify their source.

Minimum source metadata:

- `source`
- `sourceThreadId`
- `sourceMessageId`
- `externalAgentId`
- human requester/approver if available

External agents must not receive SendGrid credentials. They should receive only:

```bash
NEXTCRM_MCP_URL=https://nextcrm-production-6c46.up.railway.app/api/mcp/mcp
NEXTCRM_API_TOKEN=nxtc__...
```

## Open Questions

- Should approval be MCP-based, UI-only, or both?
- Which CRM roles can approve drafts?
- Should `clerics@raidguild.org` be connected as a shared service mailbox or under a dedicated CRM user?
- Should campaign sending use `clerics@raidguild.org` or a separate list-style sender?
- Should we add token scopes before exposing email draft tools to external agents?
