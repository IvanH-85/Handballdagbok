export type SeriesStanding = {
  position: number;
  id: number | null;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

export type SeriesTableData = {
  tournamentId: number;
  tournamentName: string;
  season: string;
  sourceUrl: string;
  updatedAt: string;
  completedMatches: number;
  totalMatches: number;
  standings: SeriesStanding[];
};

export async function fetchSeriesTable(): Promise<SeriesTableData | null> {
  const url = new URL(`${import.meta.env.BASE_URL}series-standings.json`, window.location.origin);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  const data = await response.json() as Partial<SeriesTableData>;
  return Array.isArray(data.standings) ? data as SeriesTableData : null;
}
