// Genera assets/stats.svg con datos de la API GraphQL de GitHub.
// Sin dependencias. Requiere Node 18+ y la variable GH_TOKEN.
import { writeFileSync, mkdirSync } from "node:fs";

const LOGIN = process.env.GH_LOGIN || "EHM2396";
const TOKEN = process.env.GH_TOKEN;
const OUT = process.env.OUT || "assets/stats.svg";
if (!TOKEN) {
  console.error("Falta GH_TOKEN");
  process.exit(1);
}

const query = `
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar { totalContributions }
      totalCommitContributions
      restrictedContributionsCount
      totalPullRequestContributions
    }
    repositories(ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false, first: 100) {
      totalCount
      nodes {
        stargazerCount
        languages(first: 8, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name color } }
        }
      }
    }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json", "User-Agent": "profile-stats" },
  body: JSON.stringify({ query, variables: { login: LOGIN } }),
});
const json = await res.json();
if (!res.ok || json.errors || !json.data?.user) {
  console.error("Error de GitHub:", res.status, JSON.stringify(json.errors ?? json).slice(0, 500));
  process.exit(1);
}

const u = json.data.user;
const cc = u.contributionsCollection;
const stars = u.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0);

const langs = new Map();
for (const repo of u.repositories.nodes)
  for (const e of repo.languages.edges) {
    const cur = langs.get(e.node.name) ?? { size: 0, color: e.node.color || "#64748B" };
    cur.size += e.size;
    langs.set(e.node.name, cur);
  }
const total = [...langs.values()].reduce((s, l) => s + l.size, 0) || 1;
const top = [...langs.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 5)
  .map(([name, l]) => ({ name, color: l.color, pct: (l.size / total) * 100 }));

const rows = [
  ["Contribuciones (12 meses)", cc.contributionCalendar.totalContributions],
  ["Commits", cc.totalCommitContributions + cc.restrictedContributionsCount],
  ["Pull requests", cc.totalPullRequestContributions],
  ["Repos públicos", u.repositories.totalCount],
  ["Estrellas", stars],
];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const W = 800, H = 210;
const font = "font-family=\"-apple-system,Segoe UI,Helvetica,Arial,sans-serif\"";

const statLines = rows.map(([label, v], i) =>
  `<text x="32" y="${86 + i * 24}" ${font} font-size="13" fill="#94A3B8">${esc(label)}</text>` +
  `<text x="360" y="${86 + i * 24}" ${font} font-size="14" font-weight="600" fill="#F8FAFC" text-anchor="end">${esc(v.toLocaleString("en-US"))}</text>`).join("\n");

const BAR_X = 440, BAR_W = 328;
let x = BAR_X;
const segs = top.map((l) => {
  const w = (l.pct / 100) * BAR_W;
  const s = `<rect x="${x.toFixed(1)}" y="64" width="${Math.max(w, 1).toFixed(1)}" height="8" fill="${esc(l.color)}"/>`;
  x += w;
  return s;
}).join("");
const langLines = top.map((l, i) =>
  `<circle cx="${BAR_X + 5}" cy="${99 + i * 24}" r="5" fill="${esc(l.color)}"/>` +
  `<text x="${BAR_X + 20}" y="${104 + i * 24}" ${font} font-size="13" fill="#CBD5E1">${esc(l.name)}</text>` +
  `<text x="${BAR_X + BAR_W}" y="${104 + i * 24}" ${font} font-size="13" fill="#94A3B8" text-anchor="end">${l.pct.toFixed(1)}%</text>`).join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Estadísticas de GitHub de ${esc(LOGIN)}">
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="#0F172A" stroke="#1E293B"/>
<rect x="0" y="0" width="4" height="${H}" rx="2" fill="#22D3EE"/>
<text x="32" y="40" ${font} font-size="16" font-weight="700" fill="#22D3EE">Actividad en GitHub</text>
<text x="${BAR_X}" y="40" ${font} font-size="16" font-weight="700" fill="#22D3EE">Lenguajes (repos públicos)</text>
<line x1="32" y1="52" x2="360" y2="52" stroke="#1E293B"/>
<line x1="${BAR_X}" y1="52" x2="${BAR_X + BAR_W}" y2="52" stroke="#1E293B"/>
${statLines}
<clipPath id="bar"><rect x="${BAR_X}" y="64" width="${BAR_W}" height="8" rx="4"/></clipPath>
<g clip-path="url(#bar)">${segs}</g>
${langLines}
</svg>
`;

mkdirSync("assets", { recursive: true });
writeFileSync(OUT, svg);
console.log(`Generado ${OUT}`, { rows, top });
