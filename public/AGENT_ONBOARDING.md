# NextCRM Agent Onboarding

NextCRM agents use an API token owned by a human user. The token has that user's access, and the user is responsible for how the agent uses it.

## 1. Get an API token

1. Open **Profile → Developer → API Tokens**.
2. Create a clearly named token, such as `BD Agent` or `Research Agent`.
3. Set an expiration date appropriate for the integration.
4. Copy the token when it is shown. It cannot be displayed again.
5. Store it in the agent runtime's secret storage. Do not put it in a prompt, skill file, CRM record, chat, email, or source control.

Revoke the token from the same Developer page when the agent no longer needs access or if its configuration is uncertain.

## 2. Give the agent its skill and MCP configuration

Choose the smallest skill that matches the agent's job.

### Lead-only agents

Give the agent the complete [`nextcrm-leads`](skills/nextcrm-leads/SKILL.md) folder, including its `references/lead-contract.md` file.

Configure:

```text
https://YOUR_NEXTCRM_URL/api/mcp-leads/mcp
```

This endpoint exposes only lead configuration, search, read, create, update, and exact-name status tools. It excludes deletion, import, conversion, reassignment, campaigns, enrichment, and unrelated CRM operations.

### General CRM agents

Give the agent the general [`SKILL.md`](SKILL.md).

Configure:

```text
https://YOUR_NEXTCRM_URL/api/mcp/mcp
```

This endpoint exposes the full MCP catalog available to the token-owning user. Use it only when the agent genuinely needs broader CRM access.

The Developer page provides **Copy MCP Config** buttons for both configurations. Replace `YOUR_NEXTCRM_URL` and provide the API token through the runtime's secret mechanism.

## Quick connection check

Ask the agent to list its available tools and perform a read-only search. For a lead-only agent, exactly nine lead tools should be visible. If unexpected tools appear, stop and correct the MCP URL before allowing mutations.

After the connection works, give the agent its business workflow and approval rules. Keep human review for ambiguous matches, lifecycle changes, outbound communication, pricing, legal commitments, deletion, conversion, and access expansion.
