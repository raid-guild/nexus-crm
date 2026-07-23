# BD Agent MCP Lead Pilot

> **Historical initiative:** Development certification succeeded on 2026-07-23. Use the [NextCRM Agent Onboarding](../../public/AGENT_ONBOARDING.md) for ongoing setup and the permanent [`nextcrm-leads` skill](../../public/skills/nextcrm-leads/SKILL.md) for lead agents.

**Status:** Completed
**Initiative owner:** TBD  
**Token owner/operator:** TBD  
**Target agent:** BD Agent  
**Initial environment:** Remote development  
**Outcome:** Lead-only MCP integration verified with synthetic data

## 1. Executive summary

The BD Agent pilot will use the API-token workflow that already exists at `/en/profile?tab=developer`. The token continues to represent the user who generated it, and that user accepts responsibility for the agent's actions.

The pilot does not require a separate agent principal, service user, OAuth server, per-token capability system, new provenance columns, or platform-wide changes to every MCP tool. Those remain possible post-pilot hardening work if team feedback demonstrates a need.

The minimum pilot is:

1. Generate a clearly named, expiring API token from the existing Developer page.
2. Configure the BD Agent with a lead-only MCP tool surface and the existing NextCRM skill guidance.
3. Search before creating a lead.
4. Create or update only approved lead fields.
5. Use the dedicated status tool for approved lifecycle changes.
6. Record the normal audit and downstream lead-saved effects.
7. Review every mutation during a small production canary.

## 2. Related artifacts

- [MCP Authentication and Authorization Hardening Plan](./2026-07-21-mcp-authentication-authorization-hardening-plan.md) — post-pilot platform backlog; not a pilot gate
- [NextCRM Agent Onboarding](../../public/AGENT_ONBOARDING.md) — canonical ongoing onboarding
- [Lead Lifecycle](./lead-lifecycle.md) — lead fields, statuses, and lead-agent tool contract
- [Bizdev CRM and Agent Operator Handoff](./bizdev-crm-agent-operator-handoff.md) — daily operating and approval rules
- [General public MCP skill](../../public/SKILL.md) — full-catalog MCP guidance
- [Lead-agent skill](../../public/skills/nextcrm-leads/SKILL.md) — permanent lead-only instructions

## 3. Current state

NextCRM already has most of the basic capability required for this pilot:

- Users can generate named, optionally expiring `nxtc__` API tokens from the Developer profile tab.
- Tokens are stored as hashes, shown once, revocable, and attributed to their owning user.
- The MCP server already implements lead configuration, list, search, get, create, update, status, import, conversion, deletion, and segment tools.
- `public/SKILL.md` already documents connection setup and basic lead CRUD.

The pilot must account for these current gaps:

- The public skill documents only part of the current lead tool set and includes deletion without a pilot-specific warning.
- The normal MCP endpoint exposes the full tool catalog rather than a lead-only list.
- MCP lead reads and mutations are generally limited to leads assigned directly to the token owner, even though the application has existing role-aware lead visibility rules.
- MCP lead mutations write directly through Prisma and do not consistently emit the audit and `crm/lead.saved` effects used by the web actions.
- Single-lead creation has no server idempotency key, and updates do not implement optimistic concurrency.

## 4. Desired outcome

At the end of the pilot:

- A trusted team member can configure the BD Agent using an existing user-owned API token.
- The agent sees and selects only the approved lead tools through its configured pilot MCP surface.
- The agent can search, create, retrieve, and update leads available to the token-owning user.
- An admin or manager token can work with any non-deleted lead, consistent with existing application read scope.
- Lead status changes use names or stable semantic keys rather than database UUIDs in agent instructions.
- Delete, import, conversion, reassignment, campaigns, enrichment, and unrelated CRM operations are outside the pilot.
- Creates and updates have normal user attribution, audit records, and downstream lead-saved events.
- A human reviews all production mutations and can revoke the token immediately.
- The team has enough evidence to decide whether stronger agent identity or token-scoping infrastructure is worthwhile.

## 5. Pilot boundary

### 5.1 Approved tools

The pilot tool surface contains only:

```text
crm_list_lead_sources
crm_list_lead_statuses
crm_list_lead_types
crm_list_leads
crm_get_lead
crm_search_leads
crm_create_lead
crm_update_lead
crm_update_lead_status
```

### 5.2 Explicitly excluded tools and actions

The pilot does not permit:

- `crm_delete_lead`
- `crm_import_leads`
- `crm_convert_lead_to_opportunity`
- Lead-segment mutation tools
- Ownership reassignment
- Bulk lead operations
- Campaign or email sending
- Paid enrichment
- Opportunity, project, document, report, or other non-lead operations
- Automatic retries after an unknown create result

Human approval remains required for conversion, reassignment, deletion or archival, pricing or legal commitments, and outbound communication.

### 5.3 Trust and security boundary

The API token has the authority of its owning user. For the pilot, the team explicitly accepts that the human token owner is responsible for the configured agent.

A lead-only MCP route or equivalent server-registered tool surface should return only the nine approved tools. It may reuse the same existing bearer token. Because that token can still be valid on the existing full MCP endpoint, this reduces accidental tool selection and context noise but is not a cryptographic per-token privilege boundary.

The agent runtime should also use a client-side allowlist. Server-side enforcement remains necessary for record access and approved field/status behavior within each pilot tool.

If the integration later becomes external, untrusted, or independently operated, complete the relevant capability and identity work in the hardening plan before expanding access.

## 6. Resolved architecture decisions

### ADR-1: Agent identity model

**Pilot decision:** Use the existing user identity and user-owned API token. Do not add `AgentPrincipal`, a service user, sponsor columns, or another identity model.

- Name the token clearly, for example `BD Agent Pilot - <operator>`.
- Require an expiration date for development and production tokens.
- Treat the token owner as the responsible sponsor/operator.
- Where practical, include the existing API token ID or name in MCP audit context so agent-token activity can be distinguished from the user's interactive session without a new database model.
- Revisit a separate identity only after pilot feedback shows a concrete attribution, ownership, or lifecycle need.

### ADR-2: Pilot token versus OAuth

**Pilot decision:** Use the token generated from the existing Developer profile page.

OAuth, protected-resource metadata, delegated consent, and third-party onboarding are deferred. Do not publish OAuth discovery metadata until a real authorization server exists.

### ADR-3: Tool visibility

**Pilot decision:** Return only the nine approved lead tools from the pilot MCP configuration.

Implement this additively, without changing the tool list for existing MCP consumers and without adding authorization metadata to the full tool catalog. Prefer a lead-only MCP route that reuses the existing token. Also configure the agent runtime with the same tool allowlist.

### ADR-4: Lead ownership scope

**Pilot decision:** The agent may access any non-deleted lead available to the token-owning user under the application's existing role-aware lead scope.

- For an admin or manager, this means any non-deleted lead.
- For a standard user, retain the application's existing assigned, created, or linked-account visibility.
- Reuse the existing authorization helper rather than adding agent ownership, sponsor ownership, or a dedicated segment.
- Ownership reassignment is not part of the pilot.

### ADR-5: Lifecycle transition policy

**Pilot decision:** Use the dedicated `crm_update_lead_status` tool with `lead_status_name` set to an exact configured status name.

- The pilot status schema accepts only the lead record `id` and `lead_status_name`; it does not accept `lead_status_id` or support clearing a status with `null`.
- Exclude `lead_status_id` and `assigned_to` from the generic pilot update contract.
- Reject unknown or ambiguous status names.
- Require human review for ambiguous lifecycle changes and conversion.

### ADR-6: Production canary limits

**Pilot decision:** Use small operational limits rather than building new distributed rate-limit or monitoring infrastructure.

- One agent run at a time.
- No automatic retry after a create timeout or unknown outcome; search and escalate instead.
- No more than five approved real leads in the initial production batch.
- Human review of every created or updated lead.
- A production token that expires at the end of the agreed pilot window.
- Immediate revocation after a duplicate, wrong-record update, unexpected non-lead operation, or secret-handling failure.

## 7. Required pilot work

### Workstream A: Update the existing skill and Developer experience

- [x] Correct the lead tool list in `public/SKILL.md`.
- [x] Add a concise lead pilot workflow: search, inspect, create or update, then verify.
- [x] Document the nine approved tools and the excluded operations.
- [x] Document search-before-create and no-automatic-retry behavior.
- [x] Document approved update fields and dedicated status handling.
- [x] Keep the existing token generation and add a lead-only MCP configuration on the Developer profile tab.
- [x] Publish a focused `nextcrm-leads` skill package for the operator while retaining the broad skill for general MCP users.

**Exit criterion:** A team member can configure the agent from the Developer page and complete the approved lead workflow without reading application source code.

### Workstream B: Add an isolated lead-only MCP surface

- [x] Reuse the existing `nxtc__` bearer token validation.
- [x] Register only the nine approved tools for the lead-only configuration.
- [x] Keep the existing full MCP route unchanged for current consumers.
- [x] Reuse the application's role-aware lead scope so an admin/manager can access any non-deleted lead.
- [x] Narrow the pilot create/update schemas so status, ownership, and account assignment cannot be changed through them.
- [x] Return stable validation and not-found errors suitable for an agent to act on.

**Exit criterion:** `tools/list` for the pilot surface contains exactly the approved tools, and unregistered tools cannot be called through that surface.

### Workstream C: Preserve lead mutation effects

- [x] Ensure MCP create, update, and status changes write the same audit information needed for operator review.
- [x] Emit `crm/lead.saved` after successful MCP create, update, and status mutations.
- [x] Preserve `createdBy` and `updatedBy` attribution to the token-owning user.
- [x] Avoid refactoring the existing web actions into a new shared domain service during the pilot unless focused tests demonstrate that it is necessary.

**Exit criterion:** An MCP mutation appears in the audit trail and triggers the same lead embedding/update event expected from a web mutation.

### Workstream D: Focused verification

- [x] Verify token authentication, expiration, and revocation.
- [x] Verify the exact pilot tool list.
- [x] Verify list, search, get, create, update, and status behavior.
- [x] Verify an admin/manager token can access any non-deleted lead.
- [x] Verify a standard user remains within existing application lead scope.
- [x] Verify generic update cannot reassign ownership or bypass the status tool.
- [x] Verify delete, import, conversion, and non-lead tools are unavailable through the pilot surface.
- [x] Verify audit and `crm/lead.saved` effects.
- [x] Run the workflow in the remote development environment with synthetic leads before production.

**Exit criterion:** The approved workflow succeeds, the explicitly excluded behavior fails through the pilot surface, and no existing full-route regression is introduced.

## 8. Operating procedure

1. The operator generates a named, expiring development token from the Developer profile tab.
2. The operator stores it in the agent runtime's secret mechanism, never in prompts, skills, CRM fields, chat, or source control.
3. The operator installs the focused `nextcrm-leads` skill package and configures the lead-only MCP surface.
4. The agent lists lead configuration and searches before every create.
5. If a likely duplicate exists, the agent reports it rather than creating another record.
6. The agent creates or updates only approved fields and verifies the returned record.
7. The agent uses the dedicated status tool for an unambiguous approved transition.
8. The agent reports searches, creates, updates, skips, uncertain matches, and errors after each run.
9. A human reviews development evidence before issuing a separate expiring production token.
10. A human reviews every mutation during the production canary.

## 9. Production canary

The first production run is limited to five pre-approved real leads. Do not reuse the development token.

Stop and revoke the token immediately if:

- A duplicate is created.
- The wrong lead is updated.
- A non-approved field or status is changed.
- A non-lead, delete, import, or conversion operation succeeds through the pilot surface.
- The agent retries an unknown create result without searching or escalating.
- A credential or secret appears in a prompt, record, log payload, or chat.
- Human review cannot determine what the agent changed.

After the initial batch, the operator and initiative owner record one decision: expand carefully, hold, remediate, or end the pilot.

## 10. Deferred post-pilot backlog

The following work is explicitly not required to start or complete the trusted-team pilot:

- A separate non-human CRM identity or `AgentPrincipal` model
- Per-token capabilities and scope-administration UI
- OAuth 2.1 and protected-resource metadata
- Authorization metadata and role reconciliation across every MCP tool
- A generated, versioned registry for the entire MCP catalog
- New lead provenance, agent-run, idempotency, or optimistic-concurrency columns
- MCP resources, prompts, `llms.txt`, or a generated documentation portal
- Administrative access-request, renewal, and sponsor-management systems
- Distributed rate limiting, metrics dashboards, automated alerts, and periodic access review

These items should be prioritized only from observed pilot failures, a change in the trust model, or a decision to support external third-party agents. The separate hardening plan remains the source for that work.

## 11. Definition of done

The pilot is complete when:

- [ ] A trusted operator has configured the BD Agent with an existing expiring user token.
- [ ] The pilot surface exposes only the nine approved lead tools.
- [ ] The agent has successfully searched, created, updated, and verified synthetic leads in remote development.
- [ ] Record access follows the token owner's existing application scope.
- [ ] MCP mutations have normal user attribution, audit evidence, and lead-saved events.
- [ ] Excluded tools are unavailable through the pilot surface.
- [ ] The first production batch touches no more than five approved leads and receives complete human review.
- [ ] The team records pilot feedback and a decision about whether any deferred hardening is justified.
