#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const DEFAULT_ARCHIVE = "../memory-archive";
const DEFAULT_OUTPUT = "exports/memory-crm-import-preview";
const OPERATIONAL_STATUSES = new Set(["RAIDING", "PREPARING"]);
const DEFAULT_MIN_SCORE = 8;
const RELATIONSHIP_HISTORY_MIN_SCORE = 10;

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  }),
);

const archiveDir = path.resolve(args.get("archive") || DEFAULT_ARCHIVE);
const outputDir = path.resolve(args.get("out") || DEFAULT_OUTPUT);
const profile = args.get("profile") || "operational";
const relationshipHistory = profile === "relationship-history";
const minScore = Number(
  args.get("min-score") || (relationshipHistory ? RELATIONSHIP_HISTORY_MIN_SCORE : DEFAULT_MIN_SCORE),
);
const includeShipped = args.has("include-shipped")
  ? args.get("include-shipped") === "true"
  : relationshipHistory;
const includeLost = args.get("include-lost") === "true";
const includeDuplicates = args.get("include-duplicates") === "true";
const groupClients = args.has("group-clients")
  ? args.get("group-clients") === "true"
  : relationshipHistory;

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const candidatesPath = path.join(archiveDir, "exports/external-crm-cms-candidates.json");
const reportPath = path.join(archiveDir, "exports/external-crm-dedupe-report.json");

const candidatesFile = readJson(candidatesPath);
const reportFile = readJson(reportPath);
const reportByRaidId = new Map(
  (reportFile.items || []).map((item) => [item.crm_raid_id, item]),
);

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const CLIENT_GROUPS = [
  {
    account_name: "POKT Network",
    account_slug: "pokt-network",
    patterns: [/\bpokt\b/i, /\bwpokt\b/i, /\bpocket network\b/i, /\bpocket\b/i],
  },
  {
    account_name: "Daedalus",
    account_slug: "daedalus",
    patterns: [/\bdaedalus\b/i],
  },
  {
    account_name: "Ultimate Dominion",
    account_slug: "ultimate-dominion",
    patterns: [/\bultimate dominion\b/i],
  },
  {
    account_name: "SongADay",
    account_slug: "songaday",
    patterns: [/\bsongaday\b/i, /\bsongadao\b/i],
  },
  {
    account_name: "SporkDAO",
    account_slug: "sporkdao",
    patterns: [/\bbufficorn\b/i, /\bsporkdao\b/i],
  },
];

const resolveAccountGroup = (candidate, metadata) => {
  if (!groupClients) {
    return {
      account_name: candidate.name,
      account_slug: normalize(candidate.name).replace(/\s+/g, "-"),
      grouped: false,
    };
  }

  const haystack = [
    candidate.name,
    candidate.summary,
    metadata.summary,
    metadata.slug,
    metadata.canonical_project_slug,
    ...(metadata.entities || []),
  ].filter(Boolean).join(" ");

  const group = CLIENT_GROUPS.find(({ patterns }) =>
    patterns.some((pattern) => pattern.test(haystack)),
  );

  return group
    ? { ...group, grouped: true }
    : {
        account_name: candidate.name,
        account_slug: normalize(candidate.name).replace(/\s+/g, "-"),
        grouped: false,
      };
};

const titleCase = (value) =>
  String(value || "")
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");

const csvEscape = (value) => {
  if (value == null) return "";
  const stringValue = Array.isArray(value) ? value.join("; ") : String(value);
  if (/[",\n]/.test(stringValue)) return `"${stringValue.replace(/"/g, '""')}"`;
  return stringValue;
};

const writeCsv = (filePath, rows, columns) => {
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ];
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
};

const readKnowledgeDoc = (knowledgeDoc) => {
  if (!knowledgeDoc) return "";
  const relativePath = knowledgeDoc.replace(/^memory-archive\//, "");
  const docPath = path.join(archiveDir, relativePath);
  return fs.existsSync(docPath) ? fs.readFileSync(docPath, "utf8") : "";
};

const sectionLines = (markdown, heading) => {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith("## ")) break;
    const line = lines[i].trim();
    if (line) out.push(line);
  }
  return out;
};

const extractPeople = (markdown) =>
  [...new Set(sectionLines(markdown, "People")
    .map((line) => line.replace(/^-\s*/, "").replace(/^Raid party:\s*/i, "").trim())
    .map((line) => line.replace(/^[A-Za-z][A-Za-z\s-]{1,30}:\s*/, "").trim())
    .filter(Boolean))];

const extractLinks = (markdown) =>
  sectionLines(markdown, "Links")
    .map((line) => {
      const match = line.match(/\[([^\]]+)]\(([^)]+)\)/);
      return match ? { label: match[1], url: match[2] } : null;
    })
    .filter(Boolean);

const publicWebsiteFromLinks = (links) => {
  const ignoredHosts = new Set(["hackmd.io", "docs.google.com", "discord.com"]);
  const link = links.find(({ label, url }) => {
    try {
      const parsed = new URL(url);
      return /^https?:$/.test(parsed.protocol)
        && !ignoredHosts.has(parsed.hostname.replace(/^www\./, ""))
        && !/consultation/i.test(label);
    } catch {
      return false;
    }
  });
  return link?.url || "";
};

const statusToAccountStatus = (status) =>
  status === "RAIDING" || status === "PREPARING" ? "Active" : "Inactive";

const statusToOpportunityStatus = (status) => {
  if (status === "RAIDING") return "ACTIVE";
  if (status === "PREPARING") return "PENDING";
  if (status === "SHIPPED") return "CLOSED";
  return "INACTIVE";
};

const accountType = (status) =>
  status === "RAIDING" || status === "PREPARING" ? "Prospect" : "Customer";

const shouldConsider = (candidate) => {
  if ((candidate.score || 0) < minScore) return false;
  if (OPERATIONAL_STATUSES.has(candidate.crm_status)) return true;
  if (includeShipped && candidate.crm_status === "SHIPPED") return true;
  if (includeLost && candidate.crm_status === "LOST") return true;
  return false;
};

const now = new Date().toISOString();
const accountRows = [];
const opportunityRows = [];
const reviewRows = [];
const skippedRows = [];
const seenAccountNames = new Map();

const countBy = (rows, key) =>
  rows.reduce((acc, row) => {
    const value = row[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

const accountDrafts = new Map();

const mergeAccountDraft = (account) => {
  const existing = accountDrafts.get(account.account_slug);
  if (!existing) {
    accountDrafts.set(account.account_slug, {
      ...account,
      project_names: [account.project_name],
      crm_raid_ids: [account.crm_raid_id],
      knowledge_docs: account.knowledge_doc ? [account.knowledge_doc] : [],
      internal_people: account.internal_people,
      services_required: account.services_required,
      crm_statuses: [account.crm_status],
    });
    return;
  }

  existing.project_names.push(account.project_name);
  existing.crm_raid_ids.push(account.crm_raid_id);
  if (account.knowledge_doc) existing.knowledge_docs.push(account.knowledge_doc);
  existing.internal_people = [...new Set([...existing.internal_people, ...account.internal_people])];
  existing.services_required = [...new Set([...existing.services_required, ...account.services_required])];
  existing.crm_statuses = [...new Set([...existing.crm_statuses, account.crm_status])];
  existing.score = Math.max(existing.score, account.score);
  existing.status = existing.crm_statuses.some((status) => OPERATIONAL_STATUSES.has(status))
    ? "Active"
    : existing.status;
  existing.type = existing.status === "Active" ? "Prospect" : existing.type;
  existing.description = [
    `Grouped account for ${existing.project_names.length} memory-archive CRM project records.`,
    "",
    ...existing.project_names.map((name) => `- ${name}`),
    "",
    `Source: ${existing.source}`,
    `CRM raid IDs: ${existing.crm_raid_ids.join(", ")}`,
    existing.internal_people.length ? `Internal raid party: ${existing.internal_people.join(", ")}` : "",
    existing.services_required.length ? `Services: ${existing.services_required.map(titleCase).join(", ")}` : "",
  ].filter(Boolean).join("\n");
};

for (const candidate of candidatesFile.candidates || []) {
  const report = reportByRaidId.get(candidate.crm_raid_id) || {};
  const metadata = report.metadata || {};
  const markdown = readKnowledgeDoc(candidate.knowledge_doc || report.knowledge_doc);
  const people = extractPeople(markdown);
  const links = extractLinks(markdown);
  const website = publicWebsiteFromLinks(links);
  const accountGroup = resolveAccountGroup(candidate, metadata);
  const normalizedName = normalize(candidate.name);
  const duplicateReason = candidate.recommended_action === "review_possible_duplicate"
    || candidate.dedupe_confidence !== "none"
    || metadata.dedupe_confidence !== "none";

  const base = {
    source: "memory-archive",
    source_record_type: metadata.source_record_type || "crm_raid_consultation",
    source_file: metadata.source_file || "memory-archive/external/projects.csv",
    crm_raid_id: candidate.crm_raid_id,
    crm_consultation_id: metadata.crm_consultation_id || "",
    knowledge_slug: candidate.knowledge_slug || metadata.slug || "",
    knowledge_doc: candidate.knowledge_doc || report.knowledge_doc || "",
    crm_status: candidate.crm_status,
    crm_lifecycle: candidate.crm_lifecycle || metadata.crm_lifecycle || "",
    recommended_action: candidate.recommended_action,
    score: candidate.score,
    dedupe_confidence: candidate.dedupe_confidence || metadata.dedupe_confidence || "none",
    sensitivity_flags: metadata.sensitivity_flags || report.sensitivity_flags || [],
    internal_people: people,
    services_required: metadata.crm_services_required || [],
    roles_required: metadata.crm_roles_required || [],
    budget_band: titleCase(metadata.crm_budget_band),
    delivery_priority: titleCase(metadata.crm_delivery_priority),
    generated_at: now,
  };

  if (!shouldConsider(candidate)) {
    skippedRows.push({
      ...base,
      name: candidate.name,
      reason: "outside default operational scope",
    });
    continue;
  }

  if (duplicateReason && !includeDuplicates) {
    reviewRows.push({
      ...base,
      name: candidate.name,
      reason: "possible duplicate or existing archive relationship",
      exact_archive_slug: candidate.exact_archive_slug || "",
      fuzzy_archive_match: candidate.fuzzy_archive_match?.slug || "",
    });
    continue;
  }

  if (seenAccountNames.has(normalizedName)) {
    reviewRows.push({
      ...base,
      name: candidate.name,
      reason: `duplicate normalized account name with ${seenAccountNames.get(normalizedName)}`,
    });
    continue;
  }
  seenAccountNames.set(normalizedName, candidate.crm_raid_id);

  const provenance = [
    `Source: ${base.source}`,
    `CRM raid ID: ${base.crm_raid_id}`,
    base.crm_consultation_id ? `Consultation ID: ${base.crm_consultation_id}` : "",
    base.knowledge_doc ? `Knowledge doc: ${base.knowledge_doc}` : "",
    people.length ? `Internal raid party: ${people.join(", ")}` : "",
    base.services_required.length ? `Services: ${base.services_required.map(titleCase).join(", ")}` : "",
    base.budget_band ? `Budget band: ${base.budget_band}` : "",
  ].filter(Boolean);

  accountRows.push({
    name: accountGroup.account_name,
    account_slug: accountGroup.account_slug,
    project_name: candidate.name,
    grouped_account: accountGroup.grouped,
    status: statusToAccountStatus(candidate.crm_status),
    type: accountType(candidate.crm_status),
    website,
    company_id: candidate.crm_raid_id,
    description: `${candidate.summary || metadata.summary || ""}\n\n${provenance.join("\n")}`,
    tags: ["memory-archive", "crm-sunset", candidate.crm_lifecycle || metadata.crm_lifecycle].filter(Boolean),
    ...base,
  });

  opportunityRows.push({
    name: candidate.name,
    status: statusToOpportunityStatus(candidate.crm_status),
    budget: 0,
    expected_revenue: 0,
    close_date: "",
    next_step: "Human review: confirm account, owner, stage, contact, and whether this is still active.",
    description: `${candidate.summary || metadata.summary || ""}\n\n${provenance.join("\n")}`,
    account_name: accountGroup.account_name,
    account_slug: accountGroup.account_slug,
    grouped_account: accountGroup.grouped,
    ...base,
  });
}

for (const row of accountRows) {
  mergeAccountDraft(row);
}

const groupedAccountRows = [...accountDrafts.values()].map((row) => ({
  ...row,
  project_count: row.project_names.length,
  project_names: row.project_names,
  crm_raid_ids: row.crm_raid_ids,
  knowledge_docs: row.knowledge_docs,
}));

fs.mkdirSync(outputDir, { recursive: true });

const preview = {
  generated_at: now,
  source: {
    archive_dir: archiveDir,
    candidates: path.relative(process.cwd(), candidatesPath),
    report: path.relative(process.cwd(), reportPath),
  },
  options: {
    min_score: minScore,
    include_shipped: includeShipped,
    include_lost: includeLost,
    include_duplicates: includeDuplicates,
    group_clients: groupClients,
    profile,
  },
  counts: {
    account_candidates: groupedAccountRows.length,
    opportunity_candidates: opportunityRows.length,
    review_only: reviewRows.length,
    skipped: skippedRows.length,
  },
  account_candidates: groupedAccountRows,
  opportunity_candidates: opportunityRows,
  review_only: reviewRows,
  skipped_summary: {
    by_status: countBy(skippedRows, "crm_status"),
    by_reason: countBy(skippedRows, "reason"),
  },
  skipped_sample: skippedRows.slice(0, 20),
};

fs.writeFileSync(
  path.join(outputDir, "memory-crm-import-preview.json"),
  `${JSON.stringify(preview, null, 2)}\n`,
);

writeCsv(path.join(outputDir, "accounts.csv"), groupedAccountRows, [
  "name",
  "account_slug",
  "project_count",
  "project_names",
  "status",
  "type",
  "website",
  "crm_raid_ids",
  "description",
  "crm_statuses",
  "score",
  "internal_people",
  "services_required",
  "knowledge_docs",
]);

writeCsv(path.join(outputDir, "opportunities.csv"), opportunityRows, [
  "name",
  "account_name",
  "account_slug",
  "status",
  "budget",
  "expected_revenue",
  "next_step",
  "description",
  "crm_status",
  "crm_lifecycle",
  "score",
  "internal_people",
  "services_required",
  "budget_band",
  "knowledge_doc",
]);

writeCsv(path.join(outputDir, "review-only.csv"), reviewRows, [
  "name",
  "reason",
  "crm_status",
  "crm_lifecycle",
  "score",
  "recommended_action",
  "dedupe_confidence",
  "exact_archive_slug",
  "fuzzy_archive_match",
  "knowledge_doc",
]);

const report = [
  "# Memory Archive CRM Import Preview",
  "",
  `Generated: ${now}`,
  "",
  "## Counts",
  "",
  `- Account candidates: ${groupedAccountRows.length}`,
  `- Opportunity candidates: ${opportunityRows.length}`,
  `- Review only: ${reviewRows.length}`,
  `- Skipped: ${skippedRows.length}`,
  "",
  "## Scope",
  "",
  `- Profile: ${profile}`,
  includeShipped
    ? `- Includes RAIDING, PREPARING, and SHIPPED records with score >= ${minScore}.`
    : `- Includes RAIDING and PREPARING records with score >= ${minScore}.`,
  includeLost ? "- Includes LOST records." : "- Excludes lost records.",
  "- Excludes possible duplicates unless explicitly requested.",
  "- Does not import internal raid-party people as CRM contacts.",
  groupClients ? "- Groups known same-client project families into one account with multiple opportunities." : "",
  "",
  "## Account Candidates",
  "",
  ...groupedAccountRows.map((row) => [
    `### ${row.name}`,
    "",
    `- Project count: ${row.project_count}`,
    `- Projects: ${row.project_names.join(", ")}`,
    `- CRM statuses: ${row.crm_statuses.join(", ")}`,
    `- Score: ${row.score}`,
    `- Services: ${row.services_required.join(", ") || "n/a"}`,
    `- Internal people: ${row.internal_people.join(", ") || "n/a"}`,
    `- Knowledge docs: ${row.knowledge_docs.join(", ") || "n/a"}`,
    "",
  ].join("\n")),
  "## Review Only",
  "",
  ...reviewRows.map((row) => `- ${row.name}: ${row.reason}`),
  "",
].join("\n");

fs.writeFileSync(path.join(outputDir, "README.md"), report);

console.log(JSON.stringify({ profile, ...preview.counts }, null, 2));
console.log(`Wrote ${path.relative(process.cwd(), outputDir)}`);
