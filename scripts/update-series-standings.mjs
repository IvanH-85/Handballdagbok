import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const tournamentId = 447972;
const sourceUrl = `https://www.handball.no/system/kamper/turnering/?turnid=${tournamentId}`;
const apiUrl = `https://www.handball.no/api/AjaxData/TerminlisteForTournament?id=${tournamentId}&typeId=Serie`;
const outputPath = resolve(dirname(fileURLToPath(import.meta.url)), "../public/series-standings.json");

const response = await fetch(apiUrl, {
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; STHK-2015-series-table/1.0)",
    Referer: sourceUrl,
    "X-Requested-With": "XMLHttpRequest",
  },
});

if (!response.ok) throw new Error(`handball.no svarte med HTTP ${response.status}.`);

const payload = await response.json();
if (!Array.isArray(payload.matches) || payload.matches.length === 0) {
  throw new Error("Turneringen inneholder ingen kamper. Eksisterende tabell beholdes.");
}

const teams = new Map();
const ensureTeam = (id, name) => {
  const key = String(id ?? name);
  if (!teams.has(key)) teams.set(key, { id: Number(id) || null, name: String(name || "Ukjent lag").trim(), played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });
  return teams.get(key);
};

let completedMatches = 0;
for (const match of payload.matches) {
  const home = ensureTeam(match.homeTeamId, match.homeTeamDisplayName || match.homeTeamName);
  const away = ensureTeam(match.awayTeamId, match.awayTeamDisplayName || match.awayTeamName);
  const homeGoals = Number(match.goalsHome);
  const awayGoals = Number(match.goalsAway);
  const hasResult = match.goalsHome !== null && match.goalsAway !== null && Number.isFinite(homeGoals) && Number.isFinite(awayGoals) && !match.cancelled && !match.postponed;
  if (!hasResult) continue;

  completedMatches += 1;
  home.played += 1;
  away.played += 1;
  home.goalsFor += homeGoals;
  home.goalsAgainst += awayGoals;
  away.goalsFor += awayGoals;
  away.goalsAgainst += homeGoals;

  if (homeGoals > awayGoals) {
    home.won += 1;
    away.lost += 1;
    home.points += 2;
  } else if (awayGoals > homeGoals) {
    away.won += 1;
    home.lost += 1;
    away.points += 2;
  } else {
    home.drawn += 1;
    away.drawn += 1;
    home.points += 1;
    away.points += 1;
  }
}

const standings = [...teams.values()]
  .map((team) => ({ ...team, goalDifference: team.goalsFor - team.goalsAgainst }))
  .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.name.localeCompare(b.name, "nb-NO"))
  .map((team, index) => ({ position: index + 1, ...team }));

const output = {
  tournamentId,
  tournamentName: payload.matches[0]?.tournamentName || "Jenter 12 år, NordNorge-serien - 02",
  season: "2026/2027",
  sourceUrl,
  updatedAt: new Date().toISOString(),
  completedMatches,
  totalMatches: payload.matches.length,
  standings,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Oppdaterte ${standings.length} lag fra ${payload.matches.length} kamper (${completedMatches} med resultat).`);
