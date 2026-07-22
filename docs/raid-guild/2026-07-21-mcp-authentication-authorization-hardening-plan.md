# MCP Authentication and Authorization Hardening Plan

> **For agentic workers:** This is a post-pilot platform-hardening backlog. Do not begin it merely to launch the trusted-team BD Agent lead pilot. Start individual tasks only after explicit prioritization based on pilot evidence, a change in the trust model, or a decision to support external agents.

**Status:** Proposed post-pilot backlog  
**Date:** 2026-07-21  
**Priority:** Security / high  
**Goal:** Ensure an MCP bearer token can perform only the operations explicitly granted to that token and permitted for its active application user, with the same record-level authorization rules as the web application.

## Relationship to the BD Agent lead pilot

The [BD Agent MCP Lead Pilot](./bd-agent-mcp-onboarding-initiative.md) intentionally does not require this full plan. The pilot uses:

- An existing user-owned, named, expiring API token.
- The token owner's existing application role and lead access.
- A lead-only MCP tool surface plus a client-side allowlist.
- Focused audit/event parity and human review.
- A very small production canary.

That choice is appropriate only for the small, trusted team described by the pilot. The token owner accepts responsibility for the configured agent, and the existing token may remain capable of reaching the full MCP endpoint outside the pilot configuration.

Do not use the pilot as a reason to modify the `Users` model, add `AgentPrincipal`, add OAuth, migrate all MCP tools to capabilities, or refactor every domain. Revisit this hardening plan when the team needs a real server-enforced per-token privilege boundary, independent agent attribution, third-party onboarding, or larger unattended production volume.

## Why this work is needed

The MCP endpoint authenticates tool calls with a per-user `nxtc__...` bearer token, but authorization is inconsistent after authentication:

- `ApiToken` identifies a user but has no tool or capability scopes.
- `allTools` registers the complete MCP catalog for every token.
- Tool handlers receive only a `userId`; most do not receive the user's role or lifecycle state.
- Some handlers correctly restrict records by `assigned_to` or `createdBy`, while others ignore the authenticated user.
- MCP campaign operations bypass the manager/admin and campaign-scope checks used by application actions.
- MCP enrichment operations do not use the contact/target write checks used by the HTTP enrichment routes.
- Deactivating or banning a user does not revoke or invalidate existing API tokens.
- Authentication is performed inside tool callbacks rather than at the MCP request boundary.

This means an anonymous client cannot currently execute a tool, but an ordinary user token can reach operations that should require higher privileges or access to a specific record.

## Security invariants

The completed implementation must enforce all of the following:

1. Every MCP request, including initialization and tool discovery, is authenticated in production.
2. A token is valid only while it is unrevoked, unexpired, and owned by an existing, active, unbanned user.
3. Token capabilities restrict which classes of tools the token can invoke.
4. A token can never grant more authority than its owning user's current role.
5. Every record read or mutation uses the same `lib/authz` scope/assertion helper as the corresponding application action or route.
6. High-impact side effects require an explicit narrow capability and an appropriate role.
7. Deactivation, banning, or security revocation takes effect for MCP immediately.
8. Tool calls are rate-limited and auditable without recording bearer tokens or sensitive payload values.
9. MCP annotations help clients identify read-only, destructive, and open-world tools, but annotations are never treated as authorization.
10. A newly registered tool cannot compile without an explicit authorization and risk policy.

## Proposed authorization model

Authorization has two independent layers. Passing one layer must never bypass the other.

### Layer 1: token capabilities

Use exact, non-wildcard scope strings:

| Capability           | Intended operations                                                      |
| -------------------- | ------------------------------------------------------------------------ |
| `crm:read`           | Read/search/list CRM records allowed by resource scope                   |
| `crm:write`          | Create and update allowed CRM records                                    |
| `crm:delete`         | Soft-delete allowed CRM records                                          |
| `campaigns:read`     | Read allowed campaigns/templates/statistics                              |
| `campaigns:write`    | Create/update allowed campaigns, steps, templates, and target-list links |
| `campaigns:send`     | Send, pause, or resume campaigns; manager/admin only                     |
| `projects:read`      | Read allowed boards, sections, tasks, comments, and watches              |
| `projects:write`     | Mutate allowed project records                                           |
| `reports:read`       | Run reports using the caller's report scope                              |
| `enrichment:run`     | Launch enrichment for records the caller can write                       |
| `documents:transfer` | Generate upload/download URLs for documents the caller can access        |

New tokens should default to `crm:read`. Write, delete, external-side-effect, and campaign-send capabilities must be explicitly selected. Capability selection must be validated server-side; hiding a checkbox is not enforcement.

### Layer 2: user role and resource scope

The authenticated principal should include:

```ts
interface McpPrincipal {
  tokenId: string;
  user: AuthzUser; // id + current normalized role
  scopes: McpScope[];
  expiresAt: Date | null;
}
```

Each handler must use the existing `lib/authz` helpers, such as `leadReadScopeWhere`, `assertCanWriteContact`, `assertCanReadCampaign`, and project/document equivalents. Token capabilities do not replace these checks.

## File map

| File                                                            | Planned responsibility                                                        |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                          | Store token scopes and MCP audit events                                       |
| `prisma/migrations/<timestamp>_harden_mcp_tokens/migration.sql` | Add schema and revoke or migrate legacy tokens                                |
| `lib/api-tokens.ts`                                             | Issue scoped tokens and resolve a complete active principal                   |
| `lib/mcp/auth.ts`                                               | Verify bearer tokens for `withMcpAuth` and create MCP `AuthInfo`              |
| `lib/mcp/types.ts`                                              | Define `McpPrincipal`, `McpScope`, risk classes, and typed tool definitions   |
| `lib/mcp/authorize.ts`                                          | Enforce scopes, roles, rate limits, and standardized errors                   |
| `lib/mcp/audit.ts`                                              | Record sanitized MCP invocation audit events                                  |
| `lib/mcp/tools/index.ts`                                        | Register only typed tools with mandatory access metadata                      |
| `app/api/mcp/[transport]/route.ts`                              | Apply route-level `withMcpAuth`; pass `authInfo` into tool execution          |
| `actions/api-tokens.ts`                                         | Validate requested scopes and token lifetime against current user role/status |
| `app/[locale]/(routes)/profile/components/ApiTokens.tsx`        | Scope and expiration selection; one-time secret display                       |
| `lib/mcp/tools/*.ts`                                            | Apply capability, role, and existing resource authorization consistently      |
| `actions/admin/users/deactivate-user.ts`                        | Revoke active tokens when a user is deactivated                               |
| `public/SKILL.md`                                               | Document scoped bearer-token setup and safety behavior                        |
| `docs/lead-lifecycle.md`                                        | Explain MCP authentication and lead authorization boundaries                  |

---

## Task 1: Add security regression tests before changing behavior

**Files:**

- Create `__tests__/mcp/auth-route.test.ts`
- Create `__tests__/mcp/authorization-regressions.test.ts`
- Modify `__tests__/lib/api-tokens.test.ts`
- Modify domain tests under `__tests__/mcp/`

- [ ] Prove MCP initialization, `tools/list`, and `tools/call` return `401` without a valid bearer token.
- [ ] Prove invalid, expired, revoked, inactive-user, banned-user, and deleted-user tokens are rejected.
- [ ] Prove a normal `user` cannot call `campaigns_send`, `campaigns_pause`, `campaigns_resume`, or mutate an out-of-scope campaign.
- [ ] Prove enrichment cannot run against an out-of-scope contact or target, including bulk requests.
- [ ] Prove a token missing a required capability receives a stable `FORBIDDEN` MCP error.
- [ ] Prove resource scope is still enforced when a token has the required capability.
- [ ] Preserve lead tests for assignment ownership, manager/admin reassignment, imports, conversion, and soft deletion.
- [ ] Add a test that every entry in `allTools` declares access metadata and MCP annotations.

**Initial verification:**

```bash
pnpm test -- --runInBand __tests__/mcp __tests__/lib/api-tokens.test.ts
```

Expected before implementation: the new authorization-regression tests fail for the known bypasses.

## Task 2: Add token capabilities and secure token lifecycle

**Files:**

- Modify `prisma/schema.prisma`
- Create `prisma/migrations/<timestamp>_harden_mcp_tokens/migration.sql`
- Modify `lib/api-tokens.ts`
- Modify `actions/api-tokens.ts`
- Modify profile API-token components

- [ ] Add a typed scopes field to `ApiToken`; store exact capability strings and reject unknown scopes.
- [ ] Change token validation to return token ID, scopes, expiration, and the current database user role/status rather than only `userId`.
- [ ] Reject users that are missing, not `ACTIVE`, or banned, even when the token row itself is valid.
- [ ] Require an expiration date for newly issued tokens, with a recommended default of 30 days and a maximum of 90 days.
- [ ] Default new tokens to `crm:read`; require deliberate selection for write, delete, sending, enrichment, and document transfer.
- [ ] Enforce a server-side role ceiling. In particular, only current managers/admins may mint `campaigns:send` or organization-wide report capabilities.
- [ ] Continue to show the raw token only in the creation response; never return raw secrets or token hashes from list operations.
- [ ] Compare secret hashes/lookups without logging raw bearer values.
- [ ] Make the migration's legacy-token policy explicit. Recommended secure rollout: revoke all active pre-scope tokens and require users to create replacements.

**Tests:** token scope validation, default scope, maximum lifetime, role ceiling, inactive/banned rejection, legacy-token rejection, and secret non-disclosure.

## Task 3: Move authentication to the MCP request boundary

**Files:**

- Modify `lib/mcp/auth.ts`
- Modify `app/api/mcp/[transport]/route.ts`
- Create or modify `__tests__/mcp/auth-route.test.ts`

- [ ] Wrap the MCP handler with `withMcpAuth` from `mcp-handler` using `required: true`.
- [ ] Have the verifier return SDK `AuthInfo` containing token scopes and a sanitized principal in `extra`.
- [ ] Read `extra.authInfo` from the MCP tool callback's second argument and construct `McpToolContext` without re-reading request headers.
- [ ] Protect both Streamable HTTP and SSE request paths.
- [ ] Return protocol-correct `401` responses for missing/invalid tokens and `403`/MCP `FORBIDDEN` errors for insufficient capabilities.
- [ ] Remove the implicit development cookie fallback. If local cookie auth remains useful, require an explicit `MCP_ALLOW_DEV_SESSION_AUTH=true` setting and make startup visibly warn when it is enabled.
- [ ] Do not store principal state in module globals; it must remain request-scoped.

## Task 4: Make authorization metadata mandatory for every tool

**Files:**

- Create `lib/mcp/types.ts`
- Create `lib/mcp/authorize.ts`
- Modify `lib/mcp/tools/index.ts`
- Modify all files in `lib/mcp/tools/`

Define a typed tool contract similar to:

```ts
interface McpToolDefinition<TArgs> {
  name: string;
  description: string;
  schema: ZodType<TArgs>;
  access: {
    scopes: McpScope[];
    roles?: AppRole[];
    risk: "read" | "write" | "delete" | "external-side-effect";
  };
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
  handler(args: TArgs, context: McpToolContext): Promise<unknown>;
}
```

- [ ] Make `allTools` accept only `McpToolDefinition` entries.
- [ ] Enforce capability and role metadata in one wrapper before entering a domain handler.
- [ ] Pass `{ principal, tokenId, requestId, signal }` as tool context.
- [ ] Map authentication, authorization, validation, conflict, external-service, and internal errors consistently without leaking stack traces or secrets.
- [ ] Mark delete tools `destructiveHint: true` and enrichment/sending tools `openWorldHint: true`.
- [ ] Treat annotations as client UX hints only; server authorization remains mandatory.

## Task 5: Reconcile every MCP domain with application authorization

**Files:** all `lib/mcp/tools/*.ts` plus relevant `lib/authz/scopes/*` helpers.

Build and commit a tool authorization matrix before changing handlers. For every tool, record: capability, allowed roles, risk class, record-scope helper, side effect, rate class, and tests.

### Immediate high-risk fixes

- [ ] Campaign reads/writes use `campaignReadScopeWhere`, `assertCanReadCampaign`, or `assertCanWriteCampaign` as appropriate.
- [ ] `campaigns_send`, pause, and resume require `campaigns:send` plus role `manager` or `admin`.
- [ ] Campaign template and step operations inherit authorization from their parent campaign/template rules.
- [ ] Contact enrichment calls `assertCanWriteContact`; target enrichment calls `assertCanWriteTarget`.
- [ ] Bulk enrichment resolves and authorizes every requested ID before dispatching any job. Do not partially dispatch an unauthorized batch.
- [ ] Reports construct and pass `getReportScope(context.principal.user)` rather than relying on a default manager scope.
- [ ] User/organization-wide reports require the same manager/admin role checks as the application.

### Remaining domain parity

- [ ] Leads use shared lead scope/assertion helpers instead of independent MCP-only ownership rules, while preserving manager/admin reassignment rules.
- [ ] Accounts, contacts, opportunities, targets, products, contracts, activities, target lists, and lead segments match their application read/write scope helpers.
- [ ] Document upload/download/link/unlink operations authorize both the document and related entity.
- [ ] Project board, section, task, comment, watch, and document-assignment tools use the project authorization helpers.
- [ ] Email-account tools return only accounts the user is allowed to see; secrets remain encrypted/redacted.
- [ ] Delete operations require the domain write assertion plus the explicit delete capability.
- [ ] Configuration-table reads are documented as organization-wide where intentional.

**Definition of parity:** Given the same active user and record ID, the web action/API route and MCP tool produce the same allow/deny result.

## Task 6: Add rate limiting and high-impact safeguards

**Files:**

- Create `lib/mcp/rate-limit.ts`
- Reuse the existing Upstash dependencies and environment configuration
- Modify the central MCP authorization wrapper

- [ ] Key limits by token ID and tool/risk class, not only IP address.
- [ ] Start with configurable limits for reads, writes, deletes, campaign actions, enrichment, imports, and document transfers.
- [ ] Apply stricter limits to `campaigns:send`, delete operations, bulk imports, signed URL generation, and enrichment.
- [ ] In production, fail closed for external-side-effect operations when the limiter is unavailable; define an explicit operational policy for ordinary reads.
- [ ] Return retry metadata without revealing other users' usage.
- [ ] Preserve existing domain constraints such as import batch size and enrichment batch size.

Recommended initial limits should be validated against production traffic before enforcement; do not hard-code assumptions without telemetry.

## Task 7: Add MCP-specific audit logging

**Files:**

- Modify `prisma/schema.prisma`
- Add migration changes
- Create `lib/mcp/audit.ts`
- Modify the central tool wrapper

- [ ] Record request ID, timestamp, token ID, user ID, tool name, risk class, outcome, duration, and safe resource identifiers.
- [ ] Record denial reasons as categories such as `invalid_token`, `inactive_user`, `missing_scope`, `role_denied`, `resource_denied`, and `rate_limited`.
- [ ] Never store bearer tokens, provider API keys, email bodies, document contents, or full arbitrary tool arguments.
- [ ] Record both successful and denied high-impact operations.
- [ ] Define retention and admin-only access for MCP audit records.
- [ ] Add structured server logs suitable for alerting on repeated denials, campaign sends, bulk enrichment, and deletion spikes.

## Task 8: Revoke credentials when user authority changes

**Files:**

- Modify `actions/admin/users/deactivate-user.ts`
- Modify any ban/unban and user-deletion flows
- Modify `lib/api-tokens.ts`

- [ ] Revoke all active API tokens in the same transaction that deactivates or bans a user.
- [ ] Keep token validation's live user-state check so revocation is defense in depth, not the only control.
- [ ] Do not automatically restore old tokens when a user is reactivated or unbanned.
- [ ] Add an admin emergency action to revoke all tokens for one user.
- [ ] Add an optional system-wide MCP token revocation procedure for incident response.

## Task 9: Update user-facing and operator documentation

**Files:**

- Modify `public/SKILL.md`
- Modify `docs/lead-lifecycle.md`
- Create `docs/mcp-security-operations.md`

- [ ] Explain that the bearer token authenticates a user delegation, not an independent AI-agent identity.
- [ ] Document token creation, scope selection, expiration, rotation, and revocation.
- [ ] Document which lead operations are owner-scoped and which manager/admin actions are possible.
- [ ] Clearly label sending, deletion, bulk import, enrichment, and signed document transfer as high-impact operations.
- [ ] Document incident response: revoke a token, revoke all user tokens, deactivate a user, inspect audit events, and rotate provider credentials if needed.
- [ ] Remove the statement that all tools merely require a valid token; clarify that tools additionally require token capability, role, and resource authorization.

## Task 10: Verification and rollout

### Automated verification

```bash
pnpm test -- --runInBand __tests__/mcp __tests__/lib/api-tokens.test.ts
pnpm test -- --runInBand actions/campaigns app/api/crm/contacts/enrich app/api/crm/targets/enrich
pnpm lint
pnpm build
```

- [ ] Test both MCP transports with a real generated token against a non-production database.
- [ ] Test each role (`user`, `manager`, `admin`) with in-scope and out-of-scope records.
- [ ] Test every capability independently and in representative combinations.
- [ ] Test revoked, expired, inactive, banned, malformed, and missing tokens.
- [ ] Test concurrent revocation while an MCP client is connected.
- [ ] Confirm no raw token or sensitive argument appears in application logs, audit rows, errors, or snapshots.

### Deployment sequence

1. Deploy schema, principal validation, audit support, and tests without enabling remote MCP traffic changes.
2. Apply authorization metadata and fix campaign/enrichment/report bypasses in the dev environment.
3. Enable scoped-token issuance and route-level authentication in dev.
4. Revoke legacy unscoped dev tokens and recreate scoped test tokens.
5. Exercise Streamable HTTP and SSE end-to-end in the remote dev deployment.
6. Announce the production token reset window and scope-selection instructions.
7. Deploy production enforcement, revoke legacy active tokens, and require replacement scoped tokens.
8. Monitor authentication failures, authorization denials, rate limits, campaign actions, and enrichment volume.
9. Open the normal `dev -> main` release PR only after remote dev validation is green.

### Rollback rule

Do not roll back to accepting unscoped or inactive-user tokens. If compatibility problems appear, disable the affected MCP tool/domain or MCP endpoint while preserving authentication and authorization enforcement.

## Acceptance criteria

- [ ] No MCP request succeeds without a valid bearer token in production.
- [ ] Deactivated, banned, expired, revoked, and deleted-user tokens fail immediately.
- [ ] Every tool has mandatory capability, role, risk, annotation, and resource-scope decisions.
- [ ] A standard user cannot send/pause/resume campaigns or run organization-wide reports.
- [ ] No user can read or mutate an out-of-scope record through MCP.
- [ ] Bulk operations authorize the entire batch before producing side effects.
- [ ] Dangerous operations require explicit non-default token capabilities.
- [ ] Every dangerous operation is rate-limited and audited.
- [ ] Existing application and MCP allow/deny behavior is covered by parity tests.
- [ ] Legacy unscoped tokens are no longer accepted.
- [ ] Documentation accurately describes authentication, authorization, and incident response.

## Explicit non-goals

- Implementing a separate database identity for each AI model or MCP client.
- Replacing the application's existing role and resource-authorization framework.
- Treating client-side confirmation dialogs or MCP annotations as a security boundary.
- Adding third-party OAuth dynamic client registration in this phase. A hardened scoped bearer-token model is sufficient for first-party MCP clients; OAuth can be evaluated separately if delegated third-party access is required.
