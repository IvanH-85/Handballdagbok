export type TrackedCourtPosition = "goalkeeper" | "right_wing" | "right_back" | "center" | "left_back" | "left_wing";
export type TrackedPosition = TrackedCourtPosition | "bench";

type RosterEntry = {
  playerId: number;
  starter: number | boolean;
  goalkeeper: number | boolean;
  position: TrackedPosition;
};

type SubstitutionEntry = {
  id: number;
  playerInId: number;
  playerOutId: number;
  position: TrackedCourtPosition;
  swap: boolean;
  playerInPreviousPosition: TrackedCourtPosition | null;
  matchSecond: number;
};

export type PositionStat = { position: TrackedCourtPosition; seconds: number; stints: number };
export type PlayerPositionStats = { playerId: number; totalSeconds: number; positions: PositionStat[] };

export const positionLabels: Record<TrackedCourtPosition, string> = {
  goalkeeper: "Keeper",
  left_wing: "Venstre ving",
  left_back: "Venstre back",
  center: "Midt",
  right_back: "Høyre back",
  right_wing: "Høyre ving",
};

const courtOrder: TrackedCourtPosition[] = ["goalkeeper", "left_wing", "left_back", "center", "right_back", "right_wing"];
const fallbackOrder: TrackedCourtPosition[] = ["left_wing", "left_back", "center", "right_back", "right_wing"];
const validPositions = new Set<TrackedPosition>([...courtOrder, "bench"]);

export function calculatePositionStatistics(roster: RosterEntry[], substitutions: SubstitutionEntry[], elapsedSeconds: number): Map<number, PlayerPositionStats> {
  const matchEnd = Math.max(0, Math.floor(elapsedSeconds));
  const positions = normalizePositions(roster);
  const active = new Map<number, { position: TrackedCourtPosition; since: number }>();
  const totals = new Map<number, Map<TrackedCourtPosition, { seconds: number; stints: number }>>();

  const addStint = (playerId: number, position: TrackedCourtPosition, since: number) => {
    const playerTotals = totals.get(playerId) ?? new Map<TrackedCourtPosition, { seconds: number; stints: number }>();
    const current = playerTotals.get(position) ?? { seconds: 0, stints: 0 };
    playerTotals.set(position, { ...current, stints: current.stints + 1 });
    totals.set(playerId, playerTotals);
    active.set(playerId, { position, since });
  };

  const closeStint = (playerId: number, at: number) => {
    const current = active.get(playerId);
    if (!current) return;
    const playerTotals = totals.get(playerId) ?? new Map<TrackedCourtPosition, { seconds: number; stints: number }>();
    const positionTotal = playerTotals.get(current.position) ?? { seconds: 0, stints: 1 };
    positionTotal.seconds += Math.max(0, at - current.since);
    playerTotals.set(current.position, positionTotal);
    totals.set(playerId, playerTotals);
    active.delete(playerId);
  };

  for (const [playerId, position] of positions) {
    if (position !== "bench") addStint(playerId, position, 0);
  }

  for (const substitution of [...substitutions].sort((a, b) => a.matchSecond - b.matchSecond || a.id - b.id)) {
    if (substitution.matchSecond > matchEnd) continue;
    const at = Math.max(0, substitution.matchSecond);
    const outgoingPosition = positions.get(substitution.playerOutId) ?? "bench";
    const incomingPosition = positions.get(substitution.playerInId) ?? "bench";

    closeStint(substitution.playerOutId, at);
    if (substitution.swap) closeStint(substitution.playerInId, at);

    if (substitution.swap) {
      const nextOutgoingPosition = substitution.playerInPreviousPosition ?? (incomingPosition === "bench" ? null : incomingPosition);
      positions.set(substitution.playerInId, substitution.position);
      positions.set(substitution.playerOutId, nextOutgoingPosition ?? "bench");
      addStint(substitution.playerInId, substitution.position, at);
      if (nextOutgoingPosition) addStint(substitution.playerOutId, nextOutgoingPosition, at);
    } else {
      positions.set(substitution.playerOutId, "bench");
      positions.set(substitution.playerInId, substitution.position);
      if (incomingPosition !== "bench") closeStint(substitution.playerInId, at);
      addStint(substitution.playerInId, substitution.position, at);
    }

    if (outgoingPosition === "bench" && substitution.swap) active.delete(substitution.playerOutId);
  }

  for (const playerId of [...active.keys()]) closeStint(playerId, matchEnd);

  return new Map(roster.map((entry) => {
    const playerTotals = totals.get(entry.playerId) ?? new Map<TrackedCourtPosition, { seconds: number; stints: number }>();
    const positionStats = courtOrder
      .map((position) => ({ position, ...(playerTotals.get(position) ?? { seconds: 0, stints: 0 }) }))
      .filter((stat) => stat.seconds > 0 || stat.stints > 0);
    return [entry.playerId, {
      playerId: entry.playerId,
      totalSeconds: positionStats.reduce((sum, stat) => sum + stat.seconds, 0),
      positions: positionStats,
    }];
  }));
}

function normalizePositions(roster: RosterEntry[]) {
  const used = new Set<TrackedCourtPosition>();
  const positions = new Map<number, TrackedPosition>();
  let fallbackIndex = 0;
  for (const entry of roster) {
    let position: TrackedPosition = validPositions.has(entry.position) ? entry.position : "bench";
    if (position === "bench" && Boolean(entry.goalkeeper)) position = "goalkeeper";
    if (position === "bench" && Boolean(entry.starter)) {
      while (fallbackIndex < fallbackOrder.length && used.has(fallbackOrder[fallbackIndex])) fallbackIndex += 1;
      position = fallbackOrder[fallbackIndex] ?? "bench";
      fallbackIndex += 1;
    }
    if (position !== "bench" && used.has(position)) position = "bench";
    if (position !== "bench") used.add(position);
    positions.set(entry.playerId, position);
  }
  return positions;
}
