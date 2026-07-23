# Future Feature Spec: Agent Roles and Scoped CRM API

Status: Proposed

Date: 2026-07-23

## Summary

Nexus CRM should support agents and integrations as first-class CRM actors without turning MCP into a broad admin surface. The recommended direction is:

- Keep MCP as a personal assistant surface backed by user-scoped API tokens.
- Add scoped API access for agent and service workflows that need organization-wide reads, imports, ownership assignment, or reporting.
- Introduce role and scope management so admins can grant specific capabilities to agent identities such as Queen Raida, Prism, Discord, Portal, or external channel agents.
- Preserve auditability by tying every agent/service action to a CRM actor identity.

This is a future feature spec. It documents the target model and phased rollout; it is not an implementation plan for the current sprint.

## Current State

API token authentication currently identifies a user and returns that user ID to the calling surface. The token format is `nxtc__...`.

MCP tools are intentionally user-scoped. This makes sense for a personal assistant: an agent acting on behalf of a human should only see the CRM records that the human can act on through that assistant surface.

The CRM does not currently have a general-purpose admin CRM API. Some admin routes exist for specific product areas, but there is not a shared scoped API authorization layer for contacts, leads, opportunities, ownership assignment, imports, or reports.

Roles are currently fixed application roles rather than admin-managed dynamic roles. Admins can assign existing roles, but they cannot define reusable role profiles such as `discord-agent`, `prism-console`, or `portal-sync`.

Imported CRM data can be unassigned. A user-scoped MCP token may therefore return fewer records than the CRM actually contains, which is expected behavior for a personal assistant surface.

## Goals

Support agents that can act like CRM users when needed, without requiring browser sessions.

Support service-style workflows such as imports, reports, dedupe, ownership assignment, and cross-workspace summaries through scoped API tokens.

Allow admins to create or manage reusable capability profiles for agents and integrations.

Keep audit trails clear: actions taken by Queen Raida, Prism, Discord Agent, Portal Sync, or other agents should point to a concrete actor identity.

Avoid a single shared super-admin service key for all automation.

## Non-Goals

Do not make MCP the admin API.

Do not require agents to manage Better Auth browser sessions.

Do not grant every agent broad admin powers by default.

Do not replace human ownership of CRM records. Agent actions should help assign, enrich, import, or prepare records; operational ownership should remain explicit.

## Proposed Model

### Actor Identity

Each long-running agent or integration should have a CRM actor identity, represented by a `User` row or equivalent identity record.

Examples:

- `Queen Raida`
- `Discord Agent`
- `Prism Console`
- `Portal Sync`
- `Telegram Agent`
- `External App Agent`

These identities do not need normal browser login access unless a specific workflow requires it. Their primary credential should be an API token.

### Roles and Scopes

Add a scope model that represents concrete capabilities.

Example scopes:

- `crm:summary:read`
- `crm:contacts:read`
- `crm:contacts:write`
- `crm:contacts:assign`
- `crm:leads:read`
- `crm:leads:write`
- `crm:leads:import`
- `crm:opportunities:read`
- `crm:opportunities:create`
- `crm:reports:read`
- `crm:email:drafts:create`
- `crm:email:drafts:approve`

Admins should eventually be able to manage reusable roles that grant scopes.

Example roles:

- `discord-agent`: create and update leads from Discord workflows.
- `prism-console`: read CRM context and write enrichment results from Prism workflows.
- `portal-sync`: import or update CRM records that originate in Portal.
- `bizdev-agent`: support bizdev operators with lead intake, updates, assignment, and summaries.
- `sales-manager`: review imports, assign owners, and view team-level reports.

### Effective Permissions

The recommended permission model is:

- A role defines the maximum authority for an actor.
- An API token can optionally narrow that authority.
- Effective token scopes are the actor role scopes intersected with token scopes when token scopes are present.
- If token scopes are empty, the token receives the actor role's default scope set.

This lets admins create a powerful agent identity while issuing narrower tokens for specific channels.

### Audit Attribution

Every API or MCP action should record the actor identity.

For agent-mediated human requests, the audit event can later include optional requester metadata:

- `actorUserId`: the agent or service identity that executed the action.
- `requestedByUserId`: the human CRM user, when known.
- `requestedByExternalId`: a Discord, Telegram, or external app user ID, when no CRM user mapping exists.
- `source`: `discord`, `prism`, `portal`, `telegram`, `api`, or similar.

The first version can rely on `actorUserId` only, as long as the actor is not a shared global key.

## API Surface Direction

MCP should remain a personal assistant interface.

Use scoped REST API routes for workflows that need broader CRM authority.

Candidate routes:

- `GET /api/agent/crm/summary`
- `GET /api/agent/crm/unassigned`
- `POST /api/agent/crm/assign-owner`
- `POST /api/agent/crm/import/leads`
- `POST /api/agent/crm/import/contacts`
- `POST /api/agent/crm/leads/:id/convert`
- `POST /api/agent/crm/email/drafts`
- `POST /api/agent/crm/email/drafts/:id/approve`

The exact namespace can be decided during implementation. Good candidates are:

- `/api/agent/...` for agent-facing workflows.
- `/api/service/...` for integration workflows.
- `/api/admin/crm/...` only for human-admin-only operations.

Avoid using route naming to imply unlimited power. Authorization should always come from scopes.

## Admin UI Direction

Add an admin surface for role, scope, and token management.

Recommended sections:

- Admin -> Roles & Scopes
- Admin -> Agents/API Access

Roles & Scopes should support:

- Creating reusable roles.
- Assigning scopes to roles.
- Viewing which users or agents have each role.

Agents/API Access should support:

- Creating agent identities.
- Assigning roles to agent identities.
- Creating API tokens.
- Narrowing token scopes when needed.
- Revoking tokens.
- Showing token prefix, last used timestamp, and created-by metadata.

## Ownership and Assignment

`assigned_to` should remain the operational owner field for CRM records.

Imported records may be unassigned. This is valid and should not be treated as data loss.

Future workflows should support:

- Unassigned contact and lead queues.
- Bulk assignment.
- Agent-assisted assignment recommendations.
- Explicit assignment through a scoped API action.

Only actors with an assignment scope such as `crm:contacts:assign` or `crm:leads:assign` should be able to assign ownership.

## Relationship to Lead Segments

Lead segments are the right grouping layer for scraped lists, campaign cohorts, and audience-specific outreach.

Roles/scopes are separate from lead segmentation:

- Segments answer: "Which leads belong to this audience, batch, or campaign?"
- Roles/scopes answer: "Who or what is allowed to read, write, import, or assign records?"

Agent import workflows should be able to create or attach leads to segments when they have the required import scope.

## Security Requirements

Avoid a single shared super-admin service key.

Use per-agent or per-integration tokens.

Store only hashed token secrets.

Show token prefixes for management, not full token values.

Track `lastUsedAt` and revoke unused or compromised tokens.

Add idempotency support for import endpoints.

Add rate limits for write-heavy agent endpoints.

Log all scoped API writes in the audit log.

## Phased Rollout

1. Document the target model and align on terminology.
2. Add a shared API-token actor helper, such as `requireScopedApiToken(requiredScopes)`.
3. Add token scopes and effective-scope checks.
4. Add minimal scoped API endpoints for CRM summary, unassigned records, and owner assignment.
5. Add admin UI for agent identities, token creation, revocation, and scope viewing.
6. Add dynamic role management if fixed role profiles are too limiting.
7. Expand scoped API support for imports, lead conversion, email draft workflows, and Prism enrichment.

## Open Questions

Should `agent` become a first-class user role before dynamic roles exist, or should the project move directly to dynamic role profiles?

Should route namespaces use `/api/agent`, `/api/service`, or another convention?

Should token scopes always be explicit, or should an empty token scope list inherit all role scopes?

How should Discord, Telegram, and external app users map to CRM users for requester attribution?

Which records should be backfilled with owners before introducing unassigned queues?

Which scopes should Queen Raida receive first for day-one bizdev workflows?
