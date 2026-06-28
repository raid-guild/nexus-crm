# Lead Lifecycle

## Lead Data Model

### Core Lead Fields

| Field                      | Type     | Notes                                                                                   |
| -------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `id`                       | UUID     | Primary lead ID.                                                                        |
| `createdAt`                | DateTime | Created automatically.                                                                  |
| `createdBy`                | UUID     | User that created the lead, when known.                                                 |
| `updatedAt`                | DateTime | Updated automatically.                                                                  |
| `updatedBy`                | UUID     | Last user or agent actor that updated the lead, when known.                             |
| `firstName`                | String   | Optional contact first name.                                                            |
| `lastName`                 | String   | Required contact or placeholder last name.                                              |
| `company`                  | String   | Organization, project, guild, or account name.                                          |
| `jobTitle`                 | String   | Contact role/title.                                                                     |
| `email`                    | String   | Contact email.                                                                          |
| `phone`                    | String   | Contact phone.                                                                          |
| `description`              | String   | Short context summary, need, source notes, or research notes.                           |
| `probability_score`        | Integer  | Optional percentage from `0` to `100`; use for confidence or likelihood of conversion.  |
| `lead_source_id`           | UUID     | Link to lead source option.                                                             |
| `lead_status_id`           | UUID     | Link to lifecycle status option.                                                        |
| `lead_type_id`             | UUID     | Link to lead type option.                                                               |
| `converted_opportunity_id` | UUID     | Set when the lead becomes an opportunity.                                               |
| `refered_by`               | String   | Referral source/person. Field name is intentionally spelled as it exists in the schema. |
| `campaign`                 | String   | Campaign, outreach push, or acquisition campaign name.                                  |
| `assigned_to`              | UUID     | Owner responsible for next action.                                                      |
| `accountsIDs`              | UUID     | Linked account, when the lead already maps to an account.                               |
| `documents`                | Relation | Documents associated with the lead.                                                     |
| `segments`                 | Relation | Lead segment memberships for grouped outreach/list views.                               |
| `embedding`                | Relation | Search/similarity embedding record.                                                     |
| `deletedAt`                | DateTime | Soft delete/archive timestamp.                                                          |
| `deletedBy`                | UUID     | User that archived/deleted the lead.                                                    |

### Lead Status Options

Use these as the canonical workflow states:

- `New`
- `Researching`
- `Cold Outreach`
- `Follow Up`
- `Qualified`
- `Converted to Opportunity`
- `Nurture`
- `Lost`

### Lead Source Options

Use source for origin, not audience grouping:

- `Web`
- `Referral`
- `Cold Call`
- `Email Campaign`
- `Event`
- `Discord Agent`
- `Portal`
- `Import`
- `Form`
- `Scrape`
- `Job Listing`
- `Other`

### Lead Type Options

Current seeded option:

- `Demo`

Add more lead types only when the team needs a stable classification that is different from source, status, or segment.

### Lead Segments

Lead segments are the first-class grouping layer for outreach cohorts, scrape batches, campaigns, and saved list views. Use segments for audiences like:

```text
Handymen - Southern Colorado - Jun 2026
```

Segment fields:

| Field         | Type     | Notes                                                 |
| ------------- | -------- | ----------------------------------------------------- |
| `id`          | UUID     | Primary segment ID.                                   |
| `name`        | String   | Required segment name; unique per creator.            |
| `description` | String   | Human summary of the segment.                         |
| `audience`    | String   | Audience label, persona, or market.                   |
| `region`      | String   | Geographic focus.                                     |
| `source`      | String   | Segment-level source, such as scrape/import provider. |
| `criteria`    | JSON     | Structured targeting criteria or filters.             |
| `createdBy`   | UUID     | Segment creator.                                      |
| `createdAt`   | DateTime | Created automatically.                                |
| `updatedAt`   | DateTime | Updated automatically.                                |
| `deletedAt`   | DateTime | Soft delete timestamp.                                |
| `deletedBy`   | UUID     | User that archived/deleted the segment.               |

## Lifecycle Steps

### 1. Capture New Lead

Entry points:

- Discord agent
- Portal
- Form
- Import
- Referral
- Scrape
- Job listing
- Manual bizdev entry

Set or update:

- `lead_status_id`: `New`
- `lead_source_id`: source that matches the entry point
- `assigned_to`: owner if known; otherwise triage owner
- `description`: initial context
- `campaign`: campaign/import/outreach name if applicable
- `refered_by`: referral person/source if applicable
- `segments`: add segment membership for imports, scrapes, or grouped outreach
- `probability_score`: optional initial confidence

### 2. Start Research

Move a lead from `New` to `Researching` when a human or agent is validating fit, background, contact info, company context, budget signals, or possible next step.

Set or update:

- `lead_status_id`: `Researching`
- `description`: research findings and open questions
- `assigned_to`: researcher or bizdev owner
- `accountsIDs`: linked account if a matching account exists
- `segments`: add/remove from audience cohorts as research clarifies fit
- `probability_score`: adjust if fit becomes stronger or weaker

### 3. Begin Cold Outreach

Move to `Cold Outreach` when outreach has started and the lead has not yet replied or agreed to a next step.

Set or update:

- `lead_status_id`: `Cold Outreach`
- `campaign`: outreach campaign or sequence
- `assigned_to`: owner responsible for replies and follow-up
- `description`: outreach angle, sent message summary, channel, and date
- `probability_score`: optional outreach confidence

### 4. Track Active Follow Up

Move to `Follow Up` when the lead replies, asks a question, books a call, requests more info, or has any active next step.

Set or update:

- `lead_status_id`: `Follow Up`
- `description`: latest reply, next step, blockers, and due date if known
- `assigned_to`: person responsible for the next action
- `probability_score`: increase or lower based on engagement

### 5. Qualify the Lead

Move to `Qualified` when there is credible evidence of real budget, scope, timeline, need, and fit.

Set or update:

- `lead_status_id`: `Qualified`
- `description`: qualification summary, scope, budget/timeline signals, key stakeholders, and proposed next step
- `accountsIDs`: linked account, when available
- `assigned_to`: opportunity owner or closer
- `probability_score`: expected conversion likelihood

### 6. Convert to Opportunity

Create an opportunity from a qualified lead when the team is ready to track pipeline value and delivery/sales motion.

Set or update:

- Create opportunity from the lead.
- `converted_opportunity_id`: new opportunity ID
- `lead_status_id`: `Converted to Opportunity`
- `description`: keep conversion context and any remaining handoff notes

The converted lead remains useful for source attribution, segmentation history, and traceability. The opportunity becomes the active pipeline record.

### 7. Mark Lost

Move to `Lost` when the lead is clearly not a fit, declined, is unreachable after reasonable effort, has no budget/need, or should not be pursued.

Set or update:

- `lead_status_id`: `Lost`
- `description`: loss reason and any useful context
- `probability_score`: usually `0` or blank
- `deletedAt`: only archive if the team no longer wants it in active lead views

### 8. Move to Nurture

Move to `Nurture` when the lead is not ready now but may be useful later.

Set or update:

- `lead_status_id`: `Nurture`
- `description`: why it is not now, when to revisit, and what signal should trigger follow-up
- `segments`: add to relevant nurture/audience cohort
- `probability_score`: optional future likelihood

## MCP and Agent Operations

Agents should use these MCP tools for lead workflows:

- `crm_list_lead_sources`
- `crm_list_lead_statuses`
- `crm_list_lead_types`
- `crm_list_leads`
- `crm_get_lead`
- `crm_search_leads`
- `crm_create_lead`
- `crm_update_lead`
- `crm_update_lead_status`
- `crm_import_leads`
- `crm_convert_lead_to_opportunity`
- `crm_delete_lead`
- `crm_create_lead_segment`
- `crm_list_lead_segments`
- `crm_add_leads_to_segment`

The MCP lead create/update/import tools should use the same lead fields available through the app where applicable:

- `firstName`
- `lastName`
- `email`
- `company`
- `phone`
- `jobTitle`
- `description`
- `probability_score`
- `lead_source_id`
- `lead_status_id`
- `lead_type_id`
- `refered_by`
- `campaign`
- `assigned_to`
- `accountIDs`

For imports, prefer:

- `segment_id` for the audience/import cohort
- `source` for resolving the lead source
- `dryRun` before creating records
- `dedupe_keys` such as `email`, `company`, or `phone`
- `import_batch_id` when scrape/import provenance matters
