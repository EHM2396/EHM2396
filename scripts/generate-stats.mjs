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
    }
    repositories(ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false) { totalCount }
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
const metrics = [
  ["Contribuciones", "últimos 12 meses", cc.contributionCalendar.totalContributions],
  ["Commits", "públicos y privados", cc.totalCommitContributions + cc.restrictedContributionsCount],
  ["Repositorios", "públicos propios", u.repositories.totalCount],
];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const W = 800, H = 120;
const font = 'font-family="-apple-system,Segoe UI,Helvetica,Arial,sans-serif"';
const colW = (W - 32) / metrics.length;

const cols = metrics.map(([label, sub, value], i) => {
  const cx = 16 + colW * i + colW / 2;
  const sep = i > 0 ? `<line x1="${16 + colW * i}" y1="26" x2="${16 + colW * i}" y2="${H - 26}" stroke="#1E293B"/>` : "";
  return sep +
    `<text x="${cx}" y="62" ${font} font-size="34" font-weight="700" fill="#F8FAFC" text-anchor="middle">${esc(value.toLocaleString("en-US"))}</text>` +
    `<text x="${cx}" y="84" ${font} font-size="13" font-weight="600" fill="#22D3EE" text-anchor="middle">${esc(label)}</text>` +
    `<text x="${cx}" y="101" ${font} font-size="11" fill="#94A3B8" text-anchor="middle">${esc(sub)}</text>`;
}).join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Estadísticas de GitHub de ${esc(LOGIN)}">
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="#0F172A" stroke="#1E293B"/>
<rect x="0" y="0" width="4" height="${H}" rx="2" fill="#22D3EE"/>
${cols}
</svg>
`;

mkdirSync("assets", { recursive: true });
writeFileSync(OUT, svg);
console.log(`Generado ${OUT}`, metrics);
