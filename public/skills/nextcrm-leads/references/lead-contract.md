# NextCRM lead-agent contract

## Connection

Configure the lead-only Streamable HTTP endpoint:

```json
{
  "mcpServers": {
    "nextcrm-leads": {
      "type": "http",
      "url": "https://YOUR_NEXTCRM_URL/api/mcp-leads/mcp",
      "headers": { "Authorization": "Bearer YOUR_API_TOKEN" }
    }
  }
}
```

Keep the token in runtime secret storage. The token acts as its owning NextCRM user: admin and manager users can access all non-deleted leads; standard users retain the application's assigned, created, and linked-account scope.

## Approved tools

| Tool                     | Purpose                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| `crm_list_lead_sources`  | List configured sources.                                                   |
| `crm_list_lead_statuses` | List configured statuses in lifecycle order.                               |
| `crm_list_lead_types`    | List configured types.                                                     |
| `crm_list_leads`         | List leads available to the token owner.                                   |
| `crm_get_lead`           | Retrieve one available lead by UUID.                                       |
| `crm_search_leads`       | Search name, company, email, or phone with `query`, `limit`, and `offset`. |
| `crm_create_lead`        | Create one lead using the approved create fields.                          |
| `crm_update_lead`        | Update ordinary approved fields on an available lead.                      |
| `crm_update_lead_status` | Set status using the lead `id` and exact `lead_status_name`.               |

If any other tool is visible, stop: the agent is connected to the wrong MCP surface.

## Create and update fields

`lastName` is required on create and optional on update. These fields are accepted:

- `firstName`
- `lastName`
- `email`
- `company`
- `phone`
- `jobTitle`
- `description`
- `probability_score` as an integer from 0 through 100 or `null`
- `lead_source_id` from `crm_list_lead_sources`
- `lead_type_id` from `crm_list_lead_types`
- `refered_by`
- `campaign`

Create and update reject `assigned_to`, `lead_status_id`, `account_id`, and `accountIDs`.

Use `crm_update_lead_status` for status. Its schema accepts only:

- `id`: lead UUID
- `lead_status_name`: exact configured status name

It does not accept `lead_status_id` and does not clear status with `null`.

## Responses and safe recovery

- Item tools return `{ "data": <record> }`.
- List/search tools return `{ "data": [...], "total": number, "offset": number }`.
- `NOT_FOUND`: refresh once and report if still absent.
- `INVALID_PARAMS`: correct the request using the live schema.
- `INVALID_REQUEST`: stop and report the conflict.
- `UNAUTHORIZED`: stop; never request or display the token.
- `INTERNAL_ERROR` after create: search for the intended lead before any further action and request human review.
