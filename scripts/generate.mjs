#!/usr/bin/env node
/**
 * Generate the terminal SVGs used by README.md.
 *
 *   node scripts/generate.mjs
 *
 * Requires `gh` (public GraphQL is enough). Optional: python3 + Pillow
 * to refresh the avatar ASCII from https://github.com/kmr-rohit.png.
 *
 * GitHub strips inline SVG from READMEs, so these files are referenced
 * with <img src="./assets/...">. CSS/SMIL must keep default opacity at 1
 * — never animation-fill-mode: both.
 */

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(ROOT, "assets");

const THEME = {
  bg: "#0d1117",
  fg: "#c9d1d9",
  muted: "#8b949e",
  dim: "#484f58",
  faint: "#21262d",
  accent: "#6b8ef5",
  accentDim: "#3d4f8f",
  green: "#3fb950",
  red: "#ff7b72",
  yellow: "#d29922",
  traffic: ["#ff5f56", "#ffbd2e", "#27c93f"],
  font: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
};

const WIDTH = 850;
const TITLEBAR = 36;
const SKIP_LANGS = new Set([
  "Makefile",
  "CMake",
  "HTML",
  "CSS",
  "Jupyter Notebook",
  "TeX",
  "Pawn",
  "Sass",
]);

const FIGLET_ROHIT = [
  "    ____  ____  __  ____________",
  "   / __ \\/ __ \\/ / / /  _/_  __/",
  "  / /_/ / / / / /_/ // /  / /   ",
  " / _, _/ /_/ / __  // /  / /    ",
  "/_/ |_|\\____/_/ /_/___/ /_/     ",
];

const BAKED_ASCII = [
  "          +:*.",
  "        .:**#**:",
  "        +#####*+",
  "       *#@##@#**:",
  "      #@@*+###@@*: *+",
  "     +@@@***#@@@@#*#@#+*",
  "      *@@@###@@@@###**#*#*",
  "    :++*@@@##@@@@@*++:  *#",
  " :+*#*##*####@@@@##****+:",
  "+###############@########+",
  "###@@###@@@@#####@########",
  "##@@@@@@######@@##@@@@####",
  "####@@@#######*#@@@@@@###*",
  "###*###########**#@@@@####",
];

const PRS = [
  {
    date: "Aug 15",
    repo: "kubeflow/internal-acls",
    n: 953,
    title: "add kmr-rohit as Kubeflow org member",
    add: 1,
    del: 0,
    url: "https://github.com/kubeflow/internal-acls/pull/953",
  },
  {
    date: "Aug 12",
    repo: "kubeflow/docs-agent",
    n: 232,
    title: "fix(ci): GHCR push; optional pull secrets",
    add: 29,
    del: 23,
    url: "https://github.com/kubeflow/docs-agent/pull/232",
  },
  {
    date: "Aug 08",
    repo: "kubeflow/docs-agent",
    n: 219,
    title: "anonymous session-JWT auth",
    add: 755,
    del: 21,
    url: "https://github.com/kubeflow/docs-agent/pull/219",
  },
  {
    date: "Aug 01",
    repo: "kubeflow/docs-agent",
    n: 218,
    title: "Helm gateway-guardrails",
    add: 1740,
    del: 483,
    url: "https://github.com/kubeflow/docs-agent/pull/218",
  },
  {
    date: "Jun 25",
    repo: "kubeflow/docs-agent",
    n: 210,
    title: "3-tool MCP · TEI · issues/code · OKE CI/CD",
    add: 5414,
    del: 468,
    url: "https://github.com/kubeflow/docs-agent/pull/210",
  },
  {
    date: "Mar 09",
    repo: "jaiakash/deploy-kubeflow",
    n: 5,
    title: "Terraform OKE + Kubeflow on OCI",
    add: 1332,
    del: 2,
    url: "https://github.com/jaiakash/deploy-kubeflow/pull/5",
  },
];

const WRITING = [
  {
    slug: "agentic-rag-for-kubeflow",
    title: "Teaching a docs agent to read the repo",
    tag: "kubeflow",
  },
  {
    slug: "sglang-architecture",
    title: "SGLang, or a runtime that remembers",
    tag: "sglang",
  },
  {
    slug: "vllm-architecture",
    title: "vLLM from the inside",
    tag: "vllm",
  },
  {
    slug: "context-engineering-for-agents",
    title: "Context engineering, after the window",
    tag: "agents",
  },
  {
    slug: "the-agentic-harness",
    title: "The harness is the product",
    tag: "agents",
  },
  {
    slug: "the-two-clocks",
    title: "The two clocks",
    tag: "inference",
  },
];

const NOW = [
  {
    tag: "gsoc",
    kicker: "GSoC 2026",
    title: "kubeflow/docs-agent",
    lines: [
      "docs chatbot → agentic RAG + MCP",
      "docs · issues · code · manifests",
      "~10k chunks · org member · host the call",
    ],
  },
  {
    tag: "oracle",
    kicker: "Oracle · OCI",
    title: "AI Application Developer",
    lines: [
      "catalog / order / planner agents",
      "part matching +~30% coverage",
      "FastAPI + Kafka outbox · Gen AI hackathon",
    ],
  },
  {
    tag: "macbatch",
    kicker: "side project",
    title: "MacBatch",
    lines: [
      "batch inference on idle Apple Silicon",
      "252k embeddings / hour",
      "queue · lease scheduler · worker CLI",
    ],
  },
  {
    tag: "writing",
    kicker: "kmrrohit.space",
    title: "notes on serving + agents",
    lines: [
      "vLLM · SGLang · two clocks",
      "context engineering · the harness",
      "agentic RAG for Kubeflow",
    ],
  },
];

function escapeXml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function ghJson(args) {
  const out = execFileSync("gh", args, { encoding: "utf8", maxBuffer: 8_000_000 });
  return JSON.parse(out);
}

function fetchStats() {
  const query = `
    query {
      user(login: "kmr-rohit") {
        createdAt
        followers { totalCount }
        repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
          totalCount
          nodes {
            stargazerCount
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
              edges { size node { name } }
            }
          }
        }
        pullRequests { totalCount }
        contributionsCollection(from: "2026-01-01T00:00:00Z", to: "2026-12-31T23:59:59Z") {
          totalCommitContributions
          totalPullRequestContributions
          contributionCalendar { totalContributions }
        }
      }
      prs: search(query: "author:kmr-rohit is:pr", type: ISSUE) { issueCount }
      merged: search(query: "author:kmr-rohit is:pr is:merged", type: ISSUE) { issueCount }
    }
  `;

  const userRest = ghJson(["api", "users/kmr-rohit"]);
  const gql = ghJson(["api", "graphql", "-f", `query=${query}`]);
  const user = gql.data.user;
  const langs = new Map();
  let stars = 0;
  for (const repo of user.repositories.nodes) {
    stars += repo.stargazerCount;
    for (const edge of repo.languages.edges) {
      const name = edge.node.name;
      if (SKIP_LANGS.has(name)) continue;
      langs.set(name, (langs.get(name) || 0) + edge.size);
    }
  }
  const topLangs = [...langs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return {
    publicRepos: userRest.public_repos,
    followers: user.followers.totalCount,
    owned: user.repositories.totalCount,
    stars,
    prs: gql.data.prs.issueCount,
    merged: gql.data.merged.issueCount,
    contribs2026: user.contributionsCollection.contributionCalendar.totalContributions,
    commits2026: user.contributionsCollection.totalCommitContributions,
    prs2026: user.contributionsCollection.totalPullRequestContributions,
    createdAt: user.createdAt.slice(0, 4),
    langs: topLangs,
    generatedAt: new Date().toISOString().slice(0, 10),
  };
}

const ASCII_PY = `
from collections import deque
from PIL import Image
import urllib.request, io, sys

url = "https://avatars.githubusercontent.com/u/80917122?v=4"
img = Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=20).read())).convert("RGB")
w, h = img.size
px = img.load()

def lum(x, y):
    r, g, b = px[x, y]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

bg = [[False] * w for _ in range(h)]
q = deque()
for x in range(w):
    if lum(x, 0) > 230:
        q.append((x, 0)); bg[0][x] = True
for y in range(h):
    for x in (0, w - 1):
        if lum(x, y) > 230 and not bg[y][x]:
            q.append((x, y)); bg[y][x] = True
while q:
    x, y = q.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < w and 0 <= ny < h and not bg[ny][nx] and lum(nx, ny) > 225:
            bg[ny][nx] = True
            q.append((nx, ny))

width, aspect, chars = 26, 0.55, " .:+*#@"
nw, nh = width, max(1, int(h * (width / w) * aspect))
cell_w, cell_h = w / nw, h / nh
lines = []
for j in range(nh):
    row = []
    for i in range(nw):
        x0, x1 = int(i * cell_w), max(int(i * cell_w) + 1, int((i + 1) * cell_w))
        y0, y1 = int(j * cell_h), max(int(j * cell_h) + 1, int((j + 1) * cell_h))
        n = bgc = s = 0
        for yy in range(y0, y1):
            for xx in range(x0, x1):
                n += 1
                if bg[yy][xx]:
                    bgc += 1
                else:
                    s += lum(xx, yy)
        if n == 0 or bgc / n > 0.72:
            row.append(" ")
        else:
            subj = n - bgc
            t = 1 - (s / max(1, subj) / 255.0)
            t = max(0, min(1, t)) * (0.55 + 0.45 * (subj / n))
            row.append(chars[min(len(chars) - 1, int(t * (len(chars) - 1) + 0.5))])
    lines.append("".join(row).rstrip())
while lines and not lines[0].strip():
    lines.pop(0)
while lines and not lines[-1].strip():
    lines.pop()
sys.stdout.write("\\n".join(lines))
`;

function loadAscii() {
  try {
    const out = execFileSync("python3", ["-c", ASCII_PY], {
      encoding: "utf8",
      timeout: 30_000,
    });
    const lines = out.split("\n").filter((l) => l.length);
    if (lines.length >= 8) return lines;
  } catch {
    // fall through to baked art
  }
  return BAKED_ASCII;
}

function text(x, y, value, opts = {}) {
  const {
    fill = THEME.fg,
    size = 13,
    weight = "400",
    anchor = "start",
    family = THEME.font,
  } = opts;
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" xml:space="preserve">${escapeXml(value)}</text>`;
}

function monoLines(x, y, lines, opts = {}) {
  const { fill = THEME.fg, size = 12, lh = 16, fills } = opts;
  return lines
    .map((line, i) =>
      text(x, y + i * lh, line, { fill: fills ? fills[i] : fill, size }),
    )
    .join("\n");
}

function windowChrome({ width, height, title, scan = true }) {
  const [r, y, g] = THEME.traffic;
  const scanRect = scan
    ? `<rect x="0" y="${TITLEBAR}" width="${width}" height="10" fill="${THEME.accent}" opacity="0.06">
  <animate attributeName="y" values="${TITLEBAR};${height - 18};${TITLEBAR}" dur="11s" repeatCount="indefinite"/>
</rect>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <title>${escapeXml(title)}</title>
  <defs>
    <clipPath id="win"><rect width="${width}" height="${height}" rx="12" ry="12"/></clipPath>
  </defs>
  <g clip-path="url(#win)">
    <rect width="${width}" height="${height}" fill="${THEME.bg}"/>
    ${scanRect}
    <rect width="${width}" height="${TITLEBAR}" fill="#010409" opacity="0.55"/>
    <circle cx="22" cy="18" r="6" fill="${r}"/>
    <circle cx="42" cy="18" r="6" fill="${y}"/>
    <circle cx="62" cy="18" r="6" fill="${g}"/>
    ${text(82, 22, title, { fill: THEME.muted, size: 12 })}
    <line x1="0" y1="${TITLEBAR}" x2="${width}" y2="${TITLEBAR}" stroke="${THEME.faint}" stroke-width="1"/>
`;
}

function closeWindowFor(height) {
  return `  </g>
  <rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${height - 1}" rx="12" ry="12" fill="none" stroke="${THEME.faint}"/>
</svg>
`;
}

function cursor(x, y, w = 8, h = 14) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${THEME.accent}" opacity="1">
  <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.45;0.45;1" dur="1.15s" repeatCount="indefinite"/>
</rect>`;
}

function buildWhoami() {
  const h = 268;
  const x = 28;
  let y = TITLEBAR + 36;
  const parts = [
    windowChrome({ width: WIDTH, height: h, title: "whoami  —  ~/kmr-rohit" }),
    text(x, y, "kmr-rohit@github:~$ whoami", { fill: THEME.muted, size: 13 }),
  ];
  y += 28;
  parts.push(
    monoLines(x, y, FIGLET_ROHIT, {
      fill: THEME.accent,
      size: 14,
      lh: 17,
    }),
  );
  y += FIGLET_ROHIT.length * 17 + 14;
  parts.push(text(x, y, "kumar  ·  AI engineer  ·  Bengaluru", { fill: THEME.fg, size: 14 }));
  y += 22;
  parts.push(
    text(x, y, "Oracle OCI  ·  GSoC 2026  ·  Kubeflow Docs Agent", {
      fill: THEME.muted,
      size: 13,
    }),
  );
  y += 24;
  parts.push(cursor(x, y - 12));
  parts.push(closeWindowFor(h));
  return parts.join("\n");
}

function buildNeofetch(ascii) {
  const h = 348;
  const asciiX = 24;
  const asciiY = TITLEBAR + 28;
  const infoX = 268;
  const pad = Math.max(...ascii.map((l) => l.length));
  const art = ascii.map((l) => l.padEnd(pad, " "));

  const info = [
    ["kmr-rohit", "@github"],
    ["─────────", ""],
    ["role", "AI engineer"],
    ["org", "Oracle · OCI"],
    ["os", "GSoC 2026 · kubeflow/docs-agent"],
    ["host", "Bengaluru, India"],
    ["uptime", "Jun 2024 – present"],
    ["kernel", "agents · RAG · serving"],
    ["shell", "FastAPI · Kafka · MCP · TEI"],
    ["editor", "kmrrohit.space"],
    ["status", "Kubeflow org member"],
    ["edu", "B.Tech Mechanical, NIT Warangal '24"],
    ["talks", "KubeCon India 2026 · KF showcase"],
  ];

  const parts = [
    windowChrome({ width: WIDTH, height: h, title: "neofetch  —  ~/.config" }),
    monoLines(asciiX, asciiY, art, {
      fill: THEME.accent,
      size: 12,
      lh: 16,
    }),
  ];

  info.forEach(([k, v], i) => {
    const yy = asciiY + i * 18;
    if (i === 0) {
      parts.push(text(infoX, yy, k, { fill: THEME.accent, size: 13, weight: "600" }));
      parts.push(text(infoX + 78, yy, v, { fill: THEME.fg, size: 13 }));
    } else if (i === 1) {
      parts.push(text(infoX, yy, "────────────────────────", { fill: THEME.dim, size: 13 }));
    } else {
      parts.push(text(infoX, yy, k.padEnd(10, " "), { fill: THEME.accent, size: 13 }));
      parts.push(text(infoX + 92, yy, v, { fill: THEME.fg, size: 13 }));
    }
  });

  const swatch = [
    THEME.dim,
    THEME.muted,
    THEME.fg,
    THEME.accent,
    THEME.green,
    THEME.yellow,
    THEME.red,
    THEME.traffic[0],
  ];
  swatch.forEach((color, i) => {
    parts.push(
      `<rect x="${infoX + i * 18}" y="${h - 28}" width="14" height="14" rx="2" fill="${color}"/>`,
    );
  });

  parts.push(closeWindowFor(h));
  return parts.join("\n");
}

function buildNow() {
  const h = 372;
  const pad = 20;
  const gap = 12;
  const top = TITLEBAR + pad;
  const cardW = (WIDTH - pad * 2 - gap) / 2;
  const cardH = (h - TITLEBAR - pad * 2 - gap) / 2;

  const parts = [
    windowChrome({ width: WIDTH, height: h, title: "cat /now  —  2026" }),
  ];

  NOW.forEach((card, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = pad + col * (cardW + gap);
    const y = top + row * (cardH + gap);
    parts.push(
      `<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="8" fill="#010409" stroke="${THEME.faint}"/>`,
    );
    parts.push(text(x + 16, y + 28, `[${card.tag}]`, { fill: THEME.accent, size: 12 }));
    parts.push(text(x + 16, y + 50, card.kicker, { fill: THEME.muted, size: 12 }));
    parts.push(text(x + 16, y + 74, card.title, { fill: THEME.fg, size: 15, weight: "600" }));
    card.lines.forEach((line, li) => {
      parts.push(text(x + 16, y + 100 + li * 18, line, { fill: THEME.muted, size: 12 }));
    });
  });

  parts.push(closeWindowFor(h));
  return parts.join("\n");
}

function buildGitLog() {
  const h = 268;
  const x = 28;
  let y = TITLEBAR + 32;
  const parts = [
    windowChrome({ width: WIDTH, height: h, title: "git log --oneline  —  kubeflow / oci" }),
    text(x, y, "kmr-rohit@github:~$ git log --oneline --decorate", {
      fill: THEME.muted,
      size: 12,
    }),
  ];
  y += 26;

  PRS.forEach((pr, i) => {
    const last = i === PRS.length - 1;
    parts.push(text(x, y, "*", { fill: THEME.accent, size: 13 }));
    if (!last) {
      parts.push(
        `<line x1="${x + 3.5}" y1="${y + 4}" x2="${x + 3.5}" y2="${y + 24}" stroke="${THEME.dim}" stroke-width="1"/>`,
      );
    }
    parts.push(text(x + 18, y, pr.date, { fill: THEME.dim, size: 12 }));
    const ref = `${pr.repo}#${pr.n}`;
    parts.push(text(x + 78, y, ref, { fill: THEME.accent, size: 12 }));
    parts.push(text(x + 340, y, pr.title, { fill: THEME.fg, size: 12 }));
    const del = pr.del
      ? `<tspan fill="${THEME.red}"> -${pr.del}</tspan>`
      : "";
    parts.push(
      `<text x="${WIDTH - 28}" y="${y}" fill="${THEME.green}" font-family="${THEME.font}" font-size="12" text-anchor="end" xml:space="preserve">+${pr.add}${del}</text>`,
    );
    y += 24;
  });

  parts.push(closeWindowFor(h));
  return parts.join("\n");
}

function buildWriting() {
  const h = 268;
  const x = 28;
  let y = TITLEBAR + 32;
  const parts = [
    windowChrome({ width: WIDTH, height: h, title: "ls ~/writing  —  kmrrohit.space" }),
    text(x, y, "kmr-rohit@github:~$ ls -1 ~/writing", { fill: THEME.muted, size: 12 }),
  ];
  y += 28;

  const maxTag = Math.max(...WRITING.map((w) => w.tag.length));
  WRITING.forEach((w) => {
    parts.push(text(x, y, "2026", { fill: THEME.dim, size: 12 }));
    parts.push(text(x + 52, y, w.tag.padEnd(maxTag, " "), { fill: THEME.accent, size: 12 }));
    parts.push(text(x + 52 + maxTag * 8 + 16, y, w.title, { fill: THEME.fg, size: 13 }));
    y += 22;
  });

  parts.push(text(x, y + 8, "→  https://kmrrohit.space/writing", { fill: THEME.muted, size: 12 }));
  parts.push(closeWindowFor(h));
  return parts.join("\n");
}

function buildStats(stats) {
  const h = 308;
  const x = 28;
  let y = TITLEBAR + 32;
  const parts = [
    windowChrome({ width: WIDTH, height: h, title: "gh api graphql  —  public snapshot" }),
    text(x, y, `// ${stats.generatedAt}  ·  public repos · PRs authored · 2026 contribs · owned non-fork langs`, {
      fill: THEME.dim,
      size: 11,
    }),
  ];
  y += 28;

  const metrics = [
    ["public repos", String(stats.publicRepos)],
    ["prs authored", String(stats.prs)],
    ["prs merged", String(stats.merged)],
    ["contribs 2026", String(stats.contribs2026)],
    ["commits 2026", String(stats.commits2026)],
    ["followers", String(stats.followers)],
  ];

  metrics.forEach(([label, value], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = x + col * 175;
    const cy = y + row * 56;
    parts.push(text(cx, cy, value, { fill: THEME.accent, size: 22, weight: "600" }));
    parts.push(text(cx, cy + 20, label, { fill: THEME.muted, size: 12 }));
  });

  const langX = 560;
  const langY = y;
  parts.push(text(langX, langY, "languages", { fill: THEME.muted, size: 12 }));
  const maxLang = Math.max(...stats.langs.map(([, n]) => n), 1);
  const barW = 250;
  stats.langs.forEach(([name, size], i) => {
    const yy = langY + 22 + i * 36;
    const w = Math.max(6, Math.round(barW * (size / maxLang)));
    const pct = Math.round((size / stats.langs.reduce((s, [, n]) => s + n, 0)) * 100);
    parts.push(text(langX, yy, `${name}  ${pct}%`, { fill: THEME.fg, size: 12 }));
    parts.push(
      `<rect x="${langX}" y="${yy + 8}" width="${barW}" height="7" rx="3" fill="${THEME.faint}"/>`,
    );
    parts.push(
      `<rect x="${langX}" y="${yy + 8}" width="${w}" height="7" rx="3" fill="${THEME.accent}"/>`,
    );
  });

  parts.push(closeWindowFor(h));
  return parts.join("\n");
}

function main() {
  mkdirSync(ASSETS, { recursive: true });
  let stats;
  try {
    console.error("fetching GitHub stats…");
    stats = fetchStats();
  } catch (err) {
    console.error("gh fetch failed, using fallback snapshot:", err.message);
    stats = {
      publicRepos: 99,
      followers: 19,
      owned: 57,
      stars: 13,
      prs: 75,
      merged: 43,
      contribs2026: 129,
      commits2026: 55,
      prs2026: 52,
      createdAt: "2021",
      langs: [
        ["TypeScript", 737532],
        ["Python", 689336],
        ["C++", 530867],
        ["JavaScript", 309277],
      ],
      generatedAt: new Date().toISOString().slice(0, 10),
    };
  }
  console.error("langs:", stats.langs.map(([n, s]) => `${n}:${s}`).join(", "));
  console.error("ascii…");
  const ascii = loadAscii();

  const files = {
    "whoami.svg": buildWhoami(),
    "neofetch.svg": buildNeofetch(ascii),
    "now.svg": buildNow(),
    "gitlog.svg": buildGitLog(),
    "writing.svg": buildWriting(),
    "stats.svg": buildStats(stats),
  };

  for (const [name, svg] of Object.entries(files)) {
    const path = join(ASSETS, name);
    writeFileSync(path, svg);
    console.error("wrote", path);
  }
}

main();
