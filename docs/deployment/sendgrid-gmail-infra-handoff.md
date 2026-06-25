# SendGrid and Gmail Infrastructure Handoff

## Purpose

This handoff covers the infrastructure needed for NextCRM outbound email through SendGrid while preserving `clerics@raidguild.org` as the existing Gmail/Google Workspace mailbox.

## Kickoff Review Checklist

Review these items with infra, DNS, Google Workspace, SendGrid, and NextCRM owners:

- Confirm who owns `clerics@raidguild.org` credentials and recovery access.
- Confirm whether `clerics@raidguild.org` is a mailbox, group, alias, or delegated inbox.
- Confirm Google Workspace allows IMAP and app passwords, or identify the OAuth requirement.
- Confirm `raidguild.org` is authenticated in SendGrid.
- Confirm both `no-reply@raidguild.org` and `clerics@raidguild.org` are allowed senders.
- Confirm the active SendGrid API key has Mail Send permissions and is stored only in Railway/secret manager.
- Confirm production Railway env vars and which old Resend vars can be retired after code migration.
- Confirm DNS changes needed now versus later.
- Confirm no root `raidguild.org` MX changes are planned for SendGrid Inbound Parse.
- Confirm whether a future `reply.raidguild.org` subdomain is acceptable for precise reply routing.
- Confirm validation steps and who will run test sends/replies.
- Confirm credential rotation process if any secret is exposed during setup.

## Required Accounts and Addresses

Keep these addresses active:

- `no-reply@raidguild.org` for system/transactional mail
- `clerics@raidguild.org` for bizdev/sales outbound and inbound replies

Do not replace or decommission the Gmail mailbox for `clerics@raidguild.org`.

## SendGrid Requirements

### Domain Authentication

Confirm `raidguild.org` is authenticated in SendGrid.

Required:

- SPF/DKIM records provided by SendGrid are present in DNS.
- SendGrid shows the domain as verified/authenticated.
- `no-reply@raidguild.org` can send.
- `clerics@raidguild.org` can send, or a sender identity/domain policy allows it.

### API Key

Create or confirm a SendGrid API key with Mail Send permissions.

Store only in Railway/secret manager:

```bash
SENDGRID_API_KEY=...
EMAIL_PROVIDER=sendgrid
```

Do not share this key with Discord agents, Telegram agents, local operator machines, or external apps.

## Railway Environment Variables

Set or confirm these on the `nextcrm` production service:

```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=...
EMAIL_FROM=no-reply@raidguild.org
TRANSACTIONAL_FROM_EMAIL=no-reply@raidguild.org
OUTBOUND_FROM_EMAIL=clerics@raidguild.org
OUTBOUND_FROM_NAME=RaidGuild Clerics
OUTBOUND_REPLY_TO=clerics@raidguild.org
CAMPAIGN_FROM_EMAIL=clerics@raidguild.org
CAMPAIGN_REPLY_TO=clerics@raidguild.org
```

Existing variables currently seen in production include:

- `SENDGRID_API_KEY`
- `EMAIL_FROM`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `EMAIL_ENCRYPTION_KEY`

After the SendGrid migration, `RESEND_API_KEY` and `RESEND_FROM_EMAIL` should not be required for campaign sending.

## Gmail / Google Workspace Requirements

`clerics@raidguild.org` remains a Gmail mailbox.

For CRM mailbox sync, choose one of these approaches:

### Preferred Short-Term: Gmail App Password

Requirements:

- 2FA enabled on the Google account.
- App Password created for NextCRM.
- IMAP enabled in Gmail settings.
- SMTP access allowed.

CRM settings:

```text
IMAP Host: imap.gmail.com
IMAP Port: 993
IMAP SSL: enabled
SMTP Host: smtp.gmail.com
SMTP Port: 465
SMTP SSL: enabled
Username: clerics@raidguild.org
Password: Gmail app password
Sent Folder: [Gmail]/Sent Mail
```

Add this mailbox in NextCRM under Profile -> Emails.

### Later: OAuth-Based Gmail Connection

If app passwords are not acceptable long term, implement OAuth for Gmail mailbox access. That is a product/code change, not just infra setup.

## Inbound Email Handling

### Stage 1: Gmail Sync

Inbound replies to `clerics@raidguild.org` land in Gmail. NextCRM syncs the mailbox over IMAP and links messages to CRM contacts/leads/accounts by email address.

Infra tasks:

- Ensure Gmail receives mail normally.
- Ensure IMAP is enabled.
- Provide an app password or OAuth path.
- Confirm NextCRM sync can read inbox and sent folders.

### Stage 2: SendGrid Inbound Parse on Subdomain

Only set this up later if precise automated reply routing is needed.

Use a subdomain:

```text
reply.raidguild.org
```

Do not change root `raidguild.org` MX records away from Google Workspace.

Infra tasks:

- Add MX records for `reply.raidguild.org` pointing to SendGrid Inbound Parse.
- Configure SendGrid Inbound Parse host for `reply.raidguild.org`.
- Configure destination URL:

```text
https://nextcrm-production-6c46.up.railway.app/api/integrations/sendgrid/inbound
```

This endpoint does not exist yet; wait for the NextCRM implementation before enabling production routing.

## Security Rules

- SendGrid API key is service-only.
- Agents get MCP tokens, not provider credentials.
- Gmail app password is service-only and should be stored encrypted in NextCRM.
- Rotate credentials if they are copied into agent prompts, Discord, docs, or screenshots.
- Use separate keys for production and development if possible.

## Validation Checklist

After setup:

- Send a test auth email from NextCRM to a real mailbox.
- Send a test approved draft from NextCRM to an internal address.
- Confirm the message is from `clerics@raidguild.org` or configured outbound sender.
- Confirm replies land in `clerics@raidguild.org`.
- Confirm NextCRM email sync imports the reply.
- Confirm CRM links the reply to the right lead/contact by email address.
- Confirm SendGrid activity shows accepted/delivered events.

## Infrastructure Questions

- Is `clerics@raidguild.org` a mailbox, group, or alias?
- Who owns the Gmail credentials and 2FA device?
- Is IMAP allowed by workspace policy?
- Are app passwords allowed by workspace policy?
- Is `raidguild.org` already authenticated in SendGrid?
- Should outbound use `clerics@raidguild.org` directly or a verified sender alias?
- Do we need a separate subdomain for reply routing?
