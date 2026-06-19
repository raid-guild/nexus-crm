# Bizdev CRM and Agent Operator Handoff

## Purpose

NextCRM is the source of truth for RaidGuild bizdev relationships. Discord, Telegram, and other channels are where conversations happen. Prism and agents help research, summarize, and draft. The CRM keeps the structured record.

## Kickoff Review Checklist

Review these items with bizdev/sales, Discord agent operators, external agent owners, and the CRM team:

- Confirm the CRM is the source of truth for leads, contacts, accounts, opportunities, and email history.
- Confirm which channels create leads today: Discord, Telegram, Portal, email, referrals, events, external apps.
- Confirm who owns triage for new leads and inbound replies.
- Confirm the minimum required lead fields.
- Confirm the lead lifecycle/statuses the team wants to use.
- Confirm when a lead should become an opportunity.
- Confirm how humans approve outbound drafts.
- Confirm who can approve and send from `clerics@raidguild.org`.
- Confirm what the Discord agent may do without approval.
- Confirm what external agents may do without approval.
- Confirm escalation rules for sensitive, high-value, legal, pricing, or commitment-heavy messages.
- Confirm expected daily cadence: morning review, capture during day, end-of-day cleanup.
- Confirm what reports or views bizdev needs weekly.

## Core Rule

If it might become work, funding, partnership, referral, or a meaningful relationship, it belongs in the CRM.

## Daily Workflow

### Morning

Review:

- New leads
- Leads needing follow-up
- Draft emails needing approval
- Replies from `clerics@raidguild.org`
- Opportunities with no next step

Decide:

- Who owns each lead
- What must be sent today
- Which records need research
- Which leads should become opportunities

### During The Day

Capture leads as soon as they appear.

Good capture sources:

- Discord threads
- DMs
- Telegram chats
- Portal form submissions
- Referrals
- Events
- External apps
- Inbound email

Use the Discord bot/agent when possible:

```text
Create a lead for Sam at Moderne, email sam@moderne.ai. Source is Discord. Interested in AI code modernization.
```

### After Calls or Meaningful Threads

Update the CRM:

- Summary of what happened
- Current status
- Next step
- Owner
- Relevant dates
- Link to Discord/Telegram/thread/context if available

### End Of Day

Clean up:

- No active lead should be ownerless.
- No serious lead should be missing a next step.
- Drafts should be approved, rejected, or left with review notes.
- Replies should be linked to the right lead/contact/account.

## What Goes Where

### Discord / Telegram

Use for:

- Conversation
- Quick capture
- Asking the agent to research or draft
- Human approval discussion
- Notifications

Do not use as the long-term source of truth.

### NextCRM

Use for:

- Leads
- Contacts
- Accounts
- Opportunities
- Status
- Ownership
- Next steps
- Email drafts and sent email history
- Pipeline reporting

### Portal

Use for:

- Public/member-facing project context
- Case studies
- People/project pages
- Content that supports bizdev conversations

### Prism

Use for:

- Research
- Memory
- Summaries
- Context retrieval
- Agent workflows
- Document and thread analysis

## Lead Lifecycle

Suggested stages:

```text
New
Needs Research
Contacted
Engaged
Qualified
Converted to Opportunity
Nurture
Unqualified
Archived
```

The exact status values can evolve, but every active lead needs a status and next step.

## Minimum Lead Data

Required:

- Name or company
- Source
- Owner
- Status
- Next step

Strongly recommended:

- Email
- Role/title
- Context summary
- Need/pain point
- Relevant RaidGuild service
- Discord/Telegram/thread link
- Last touch date

## Using The Discord Agent

The Discord agent should make CRM use easier. It should not become an unsupervised admin.

Good requests:

```text
Search the CRM for Moderne before I create a new lead.
```

```text
Create a lead for Sumathi at Bretton AI. Source: Discord. She is hiring FDEs for financial crime AI agent deployments.
```

```text
Research this company and draft a first outreach email from clerics@raidguild.org.
```

```text
Summarize this thread and update the lead notes.
```

```text
Draft a follow-up email for this lead. Do not send it yet.
```

```text
Show me email drafts that need approval.
```

## Email Workflow

Agents can draft emails. Humans approve emails. CRM sends approved emails.

### Draft

Agent creates a draft from CRM context, Prism research, and the current conversation.

Draft should include:

- Recipient
- Subject
- Body
- Linked lead/contact/account/opportunity
- Source channel
- Reason for the email

### Review

Human checks:

- Is the recipient correct?
- Is the claim accurate?
- Is the tone right?
- Is the ask clear?
- Is the next step clear?
- Should this come from `clerics@raidguild.org`?

### Send

Only approved drafts should be sent. The send should happen through NextCRM/SendGrid, not directly by the agent using provider credentials.

### Replies

Replies go to:

```text
clerics@raidguild.org
```

NextCRM should sync this Gmail mailbox and link replies back to CRM records by sender/recipient email.

## External Agents

Other agents may operate from Telegram, external apps, Portal, or future channels. They should follow the same rules as the Discord agent.

External agents should:

- Use MCP or approved integration APIs.
- Identify their source channel.
- Search before creating records.
- Create/update CRM records only within their assigned workflow.
- Draft emails but not send unapproved emails.
- Include source metadata for every action.

External agents should not receive:

- SendGrid API keys
- Gmail passwords/app passwords
- Railway credentials
- Database URLs
- Admin backdoor tokens

## Approval Rules

Human approval is required for:

- Sending outbound email
- Bulk/campaign sends
- Deleting or archiving important records
- Moving a lead to opportunity if the context is ambiguous
- Any message with pricing, commitments, legal terms, or sensitive claims

Agent can do without approval:

- Search CRM
- Create lead with clear source context
- Update non-sensitive notes
- Draft email
- Summarize a thread
- Suggest next action

## Good CRM Hygiene

- Search before creating.
- Prefer updating an existing record over creating duplicates.
- Keep notes factual.
- Put uncertainty in review notes.
- Do not paste huge raw threads into CRM fields; summarize and link to source.
- Convert qualified leads into opportunities.
- Keep the next step current.

## Example Workflows

### New Discord Lead

1. Bizdev sees a promising Discord conversation.
2. Bizdev asks the agent to search CRM.
3. If no match, agent creates a lead.
4. Agent summarizes thread context.
5. Bizdev assigns owner and next step.
6. Agent drafts outreach if useful.
7. Human approves and sends.

### Inbound Email Reply

1. Prospect replies to `clerics@raidguild.org`.
2. CRM sync imports the email.
3. Email links to lead/contact by address.
4. Agent summarizes the reply.
5. Bizdev updates status and next step.
6. Agent drafts response.
7. Human approves and sends.

### External Telegram Agent

1. Telegram agent detects a potential lead.
2. It searches NextCRM through MCP.
3. It creates or updates the lead with `source=telegram`.
4. It stores Telegram thread/message identifiers.
5. It asks for human review before drafting or sending outreach.

## Working Principle

Discord and Telegram are interfaces. NextCRM is the record. Prism is the intelligence layer. Portal is public/contextual knowledge. SendGrid is the delivery system. Gmail is the shared inbox.
