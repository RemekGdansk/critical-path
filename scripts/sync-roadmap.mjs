// Mirrors context/foundation/roadmap.md into GitHub: one issue per roadmap item (F-NN, S-NN), the
// milestone, "blocked by" dependencies from Prerequisites, and the fields of the roadmap Project.
// One-way on purpose: roadmap.md is the source of truth, GitHub is a view of it. The script never
// deletes or reopens issues; drift it will not fix is printed as a warning.
//
// Usage: node scripts/sync-roadmap.mjs [--dry-run]
// Auth: the `gh` CLI; it needs the `repo` and `project` scopes (or GH_TOKEN with the same access).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ROADMAP_PATH = "context/foundation/roadmap.md";
const PROJECT_OWNER = "RemekGdansk";
const PROJECT_NUMBER = 2;
const ITEM_SECTIONS = ["Foundations", "Slices"];
const MARKER = /<!-- roadmap-id: ([A-Z]-\d+) -->/;
const MANAGED_LABEL = /^(roadmap|type:.+|stream:.+)$/;
const FIELD = { status: "Roadmap status", id: "Roadmap ID", changeId: "Change ID", stream: "Stream" };

const dryRun = process.argv.includes("--dry-run");
const warnings = [];
let changes = 0;

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 64 << 20 });
}

function ghJson(args) {
  const out = gh(args).trim();
  return out ? JSON.parse(out) : null;
}

// Logs a planned change and, unless this is a dry run, performs it.
function step(description, apply) {
  changes += 1;
  console.log(`${dryRun ? "would" : "✓"} ${description}`);
  return dryRun ? undefined : apply();
}

function warn(message) {
  warnings.push(message);
}

// ---------- roadmap.md ----------

function splitSections(text, level) {
  const sections = new Map();
  const prefix = `${"#".repeat(level)} `;
  let current = null;
  for (const line of text.split("\n")) {
    if (line.startsWith(prefix)) {
      current = line.slice(prefix.length).trim();
      sections.set(current, []);
    } else if (current !== null) {
      sections.get(current).push(line);
    }
  }
  return new Map([...sections].map(([name, lines]) => [name, lines.join("\n")]));
}

function tableRows(section) {
  return section
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .map((line) =>
      line
        .trim()
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim()),
    )
    .slice(2); // header + separator
}

function normalizeStatus(status) {
  return status.toLowerCase().replace(/[-_]/g, " ").trim();
}

function parseItem(block, kind) {
  const [heading, ...lines] = block.split("\n");
  const match = /^([FS]-\d+): (.+)$/.exec(heading.trim());
  if (!match) throw new Error(`Unrecognised roadmap item heading: "### ${heading}"`);
  const fields = [];
  for (const line of lines) {
    const top = /^- \*\*(.+?):\*\*\s*(.*)$/.exec(line);
    if (top) fields.push({ key: top[1], value: top[2] });
    else if (/^\s+\S/.test(line) && fields.length > 0) fields.at(-1).value += `\n${line}`;
  }
  const get = (key) => fields.find((field) => field.key === key)?.value.trim() ?? "";
  return {
    id: match[1],
    heading: match[2],
    kind,
    fields,
    changeId: get("Change ID"),
    status: normalizeStatus(get("Status")),
    prerequisites: get("Prerequisites").match(/[FS]-\d+/g) ?? [],
  };
}

function parseRoadmap(text) {
  const sections = splitSections(text, 2);

  const milestoneSection = sections.get("Milestone") ?? "";
  const milestoneMatch = /^\*\*(M-\d+: .+?)\*\* — Status: (\w+)/m.exec(milestoneSection);
  if (!milestoneMatch) throw new Error(`No "**M-N: Title** — Status: …" line under "## Milestone" in ${ROADMAP_PATH}`);
  const doneWhen = /^- \*\*Done when:\*\* (.+)$/m.exec(milestoneSection)?.[1] ?? "";
  const milestone = {
    title: milestoneMatch[1],
    status: milestoneMatch[2].toLowerCase(),
    description: `Done when: ${doneWhen}\n\nSource: ${ROADMAP_PATH}`,
  };

  const streams = new Map();
  for (const [stream, , chain] of tableRows(sections.get("Streams") ?? "")) {
    for (const [, id] of chain.matchAll(/`([FS]-\d+)`/g)) if (!streams.has(id)) streams.set(id, stream);
  }

  const titles = new Map(tableRows(sections.get("Backlog Handoff") ?? "").map(([id, , title]) => [id, title]));

  const items = [];
  for (const name of ITEM_SECTIONS) {
    const kind = name === "Foundations" ? "foundation" : "slice";
    for (const block of (sections.get(name) ?? "").split(/^### /m).slice(1)) items.push(parseItem(block, kind));
  }
  for (const item of items) {
    item.title = `[${item.id}] ${titles.get(item.id) ?? item.heading}`;
    item.stream = streams.get(item.id) ?? null;
    item.labels = ["roadmap", `type:${item.kind}`, ...(item.stream ? [`stream:${item.stream}`] : [])];
    item.body = renderBody(item);
  }
  return { milestone, items };
}

function renderBody(item) {
  const lines = [
    `<!-- roadmap-id: ${item.id} -->`,
    `> Mirrored from \`${ROADMAP_PATH}\` by \`scripts/sync-roadmap.mjs\`. Edit the roadmap, not this issue: the next sync overwrites the title and body.`,
    "",
    `## ${item.id}: ${item.heading}`,
    "",
  ];
  for (const { key, value } of item.fields) {
    if (key === "Status") continue; // lives in the Project's "Roadmap status" field and the open/closed state
    const trimmed = value.trim();
    if (value.startsWith("\n") || trimmed.startsWith("- "))
      lines.push(`**${key}:**`, "", trimmed.replace(/^ {2}/gm, ""), "");
    else lines.push(`**${key}:** ${trimmed}`, "");
  }
  return lines.join("\n").trim();
}

// ---------- GitHub ----------

function fetchProject() {
  const query = `query($owner: String!, $number: Int!) {
    user(login: $owner) { projectV2(number: $number) {
      id
      fields(first: 50) { nodes {
        ... on ProjectV2FieldCommon { id name }
        ... on ProjectV2SingleSelectField { options { id name } }
      } }
      items(first: 100) { nodes {
        id
        content { ... on Issue { number repository { nameWithOwner } } }
        fieldValues(first: 30) { nodes {
          ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { name } } }
          ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2FieldCommon { name } } }
        } }
      } }
    } }
  }`;
  const data = ghJson([
    "api",
    "graphql",
    "-f",
    `query=${query}`,
    "-F",
    `owner=${PROJECT_OWNER}`,
    "-F",
    `number=${PROJECT_NUMBER}`,
  ]);
  const project = data.data.user.projectV2;
  const fields = new Map(project.fields.nodes.filter((field) => field.name).map((field) => [field.name, field]));
  for (const name of Object.values(FIELD)) {
    if (!fields.has(name)) throw new Error(`Project ${PROJECT_OWNER}/${PROJECT_NUMBER} has no "${name}" field`);
  }
  const items = project.items.nodes
    .filter((node) => node.content?.number)
    .map((node) => ({
      id: node.id,
      repo: node.content.repository.nameWithOwner,
      number: node.content.number,
      values: new Map(
        node.fieldValues.nodes
          .filter((value) => value.field)
          .map((value) => [value.field.name, value.text ?? value.name]),
      ),
    }));
  return { id: project.id, fields, items };
}

function sameSet(a, b) {
  return a.length === b.length && a.every((value) => b.includes(value));
}

function syncMilestone(repo, milestone) {
  const existing = ghJson(["api", "--paginate", "--slurp", `repos/${repo}/milestones?state=all&per_page=100`])
    .flat()
    .find((candidate) => candidate.title === milestone.title);
  if (!existing) {
    const created = step(`create milestone "${milestone.title}"`, () =>
      ghJson([
        "api",
        `repos/${repo}/milestones`,
        "-f",
        `title=${milestone.title}`,
        "-f",
        `description=${milestone.description}`,
      ]),
    );
    return { number: created?.number ?? null, title: milestone.title, state: "open" };
  }
  if ((existing.description ?? "").trim() !== milestone.description) {
    step(`update description of milestone "${milestone.title}"`, () =>
      gh([
        "api",
        "-X",
        "PATCH",
        `repos/${repo}/milestones/${existing.number}`,
        "-f",
        `description=${milestone.description}`,
      ]),
    );
  }
  return existing;
}

function syncIssue(repo, item, existing, milestone) {
  if (!existing) {
    const args = ["api", `repos/${repo}/issues`, "-f", `title=${item.title}`, "-f", `body=${item.body}`];
    for (const label of item.labels) args.push("-f", `labels[]=${label}`);
    if (milestone.number) args.push("-F", `milestone=${milestone.number}`);
    const created = step(`create issue ${item.title}  [${item.labels.join(", ")}]`, () => ghJson(args));
    return created ?? { number: null, id: null, state: "open", html_url: null };
  }

  const currentLabels = existing.labels.map((label) => label.name);
  const labels = [...currentLabels.filter((label) => !MANAGED_LABEL.test(label)), ...item.labels];
  const diff = [];
  const args = ["api", "-X", "PATCH", `repos/${repo}/issues/${existing.number}`];
  if (existing.title !== item.title) {
    diff.push("title");
    args.push("-f", `title=${item.title}`);
  }
  if ((existing.body ?? "").replace(/\r\n/g, "\n").trim() !== item.body) {
    diff.push("body");
    args.push("-f", `body=${item.body}`);
  }
  if (!sameSet(currentLabels, labels)) {
    diff.push("labels");
    for (const label of labels) args.push("-f", `labels[]=${label}`);
  }
  if (milestone.number && existing.milestone?.number !== milestone.number) {
    diff.push("milestone");
    args.push("-F", `milestone=${milestone.number}`);
  }
  if (diff.length > 0) step(`update #${existing.number} ${item.id} (${diff.join(", ")})`, () => gh(args));
  return existing;
}

function syncState(repo, item, issue) {
  if (item.status === "done" && issue.state === "open") {
    step(`close ${ref(item, issue)} (roadmap status: done)`, () =>
      gh([
        "api",
        "-X",
        "PATCH",
        `repos/${repo}/issues/${issue.number}`,
        "-f",
        "state=closed",
        "-f",
        "state_reason=completed",
      ]),
    );
  } else if (item.status !== "done" && issue.state === "closed") {
    warn(
      `${ref(item, issue)} is closed but the roadmap says "${item.status}": mark it done in ${ROADMAP_PATH}, or reopen the issue`,
    );
  }
}

function syncDependencies(repo, item, issue, issuesById) {
  const current = issue.number
    ? ghJson(["api", `repos/${repo}/issues/${issue.number}/dependencies/blocked_by`]).map((blocker) => blocker.id)
    : [];
  for (const prerequisite of item.prerequisites) {
    const blocker = issuesById.get(prerequisite);
    if (!blocker) {
      warn(`${item.id} lists prerequisite ${prerequisite}, which is not a roadmap item`);
      continue;
    }
    if (blocker.id && current.includes(blocker.id)) continue;
    step(`mark ${ref(item, issue)} blocked by ${ref({ id: prerequisite }, blocker)}`, () =>
      gh([
        "api",
        "-X",
        "POST",
        `repos/${repo}/issues/${issue.number}/dependencies/blocked_by`,
        "-F",
        `issue_id=${blocker.id}`,
      ]),
    );
  }
  // Remove only dependencies on other roadmap issues; hand-added blockers outside the roadmap stay.
  const wanted = new Set(item.prerequisites.map((id) => issuesById.get(id)?.id));
  for (const [id, other] of issuesById) {
    if (!other.id || !current.includes(other.id) || wanted.has(other.id)) continue;
    step(`remove ${ref(item, issue)} blocked by ${ref({ id }, other)} (no longer a prerequisite)`, () =>
      gh(["api", "-X", "DELETE", `repos/${repo}/issues/${issue.number}/dependencies/blocked_by/${other.id}`]),
    );
  }
}

function syncProjectItem(repo, item, issue, project) {
  let projectItem = project.items.find((candidate) => candidate.repo === repo && candidate.number === issue.number);
  if (!projectItem) {
    const added = step(`add ${ref(item, issue)} to project ${PROJECT_NUMBER}`, () =>
      ghJson([
        "project",
        "item-add",
        String(PROJECT_NUMBER),
        "--owner",
        PROJECT_OWNER,
        "--url",
        issue.html_url,
        "--format",
        "json",
      ]),
    );
    projectItem = { id: added?.id ?? null, values: new Map() };
  }
  const wanted = [
    [FIELD.id, item.id],
    [FIELD.changeId, item.changeId],
    [FIELD.status, item.status],
    [FIELD.stream, item.stream],
  ];
  for (const [name, value] of wanted) {
    if (!value || projectItem.values.get(name) === value) continue;
    const field = project.fields.get(name);
    const args = ["project", "item-edit", "--id", projectItem.id, "--project-id", project.id, "--field-id", field.id];
    if (field.options) {
      const option = field.options.find((candidate) => candidate.name === value);
      if (!option) {
        warn(`${item.id}: project field "${name}" has no option "${value}"`);
        continue;
      }
      args.push("--single-select-option-id", option.id);
    } else {
      args.push("--text", value);
    }
    step(`set ${ref(item, issue)} ${name} = ${value}`, () => gh(args));
  }
}

function ref(item, issue) {
  return issue?.number ? `#${issue.number} ${item.id}` : `${item.id} (new)`;
}

// ---------- main ----------

const { milestone, items } = parseRoadmap(readFileSync(ROADMAP_PATH, "utf8"));
const repo = ghJson(["repo", "view", "--json", "nameWithOwner"]).nameWithOwner;
console.log(`${dryRun ? "Dry run: " : ""}syncing ${items.length} roadmap items of "${milestone.title}" to ${repo}\n`);

const labels = ghJson(["label", "list", "-R", repo, "--limit", "500", "--json", "name"]).map((label) => label.name);
const missingLabels = [...new Set(items.flatMap((item) => item.labels))].filter((label) => !labels.includes(label));
if (missingLabels.length > 0) throw new Error(`Create these labels first: ${missingLabels.join(", ")}`);

const issuesByMarker = new Map();
for (const issue of ghJson(["api", "--paginate", "--slurp", `repos/${repo}/issues?state=all&per_page=100`]).flat()) {
  const marker = MARKER.exec(issue.body ?? "")?.[1];
  if (issue.pull_request || !marker) continue;
  if (issuesByMarker.has(marker))
    warn(`${marker} is mirrored by more than one issue; syncing #${issuesByMarker.get(marker).number}`);
  else issuesByMarker.set(marker, issue);
}
const project = fetchProject();
const githubMilestone = syncMilestone(repo, milestone);

const issuesById = new Map();
for (const item of items) issuesById.set(item.id, syncIssue(repo, item, issuesByMarker.get(item.id), githubMilestone));
for (const item of items) {
  const issue = issuesById.get(item.id);
  syncState(repo, item, issue);
  syncDependencies(repo, item, issue, issuesById);
  syncProjectItem(repo, item, issue, project);
}

for (const [id, issue] of issuesByMarker) {
  if (!issuesById.has(id))
    warn(`#${issue.number} mirrors ${id}, which is no longer under ${ITEM_SECTIONS.join("/")} in the roadmap`);
}
if (milestone.status === "closed" && githubMilestone.state === "open" && githubMilestone.number) {
  step(`close milestone "${milestone.title}"`, () =>
    gh(["api", "-X", "PATCH", `repos/${repo}/milestones/${githubMilestone.number}`, "-f", "state=closed"]),
  );
}

console.log(`\n${changes === 0 ? "Already in sync." : `${changes} change(s) ${dryRun ? "planned" : "applied"}.`}`);
for (const message of warnings) console.log(`warning: ${message}`);
