"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Eye, Flag, LockKeyhole, MessageSquare, Pause, Play, RotateCcw, Shield, TimerReset, Trash2, UserRoundCheck, Users } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Player = { id: number; name: string; jerseyNumber: number | null };
type Match = {
  id: number;
  date: string;
  startTime: string;
  opponent: string;
  team: string;
  homeAway: "home" | "away";
  competition: string;
  matchType: "league" | "cup" | "friendly";
  cupName: string;
  registrarName: string | null;
  ourScore: number | null;
  opponentScore: number | null;
  periodCount: number;
  periodMinutes: number;
  matchPhase: "pre_match" | "first_half" | "halftime" | "second_half" | "completed";
  currentPeriod: number;
  periodElapsedSeconds: number;
  clockStartedAt: string | null;
  elapsedSeconds: number;
  clockRunning: number | boolean;
  notes: string;
  status: "planned" | "live" | "completed" | "cancelled";
};
type MatchPlayer = { matchId: number; playerId: number; starter: number | boolean; goalkeeper: number | boolean; captain: number | boolean; position: Position };
type EventType = "goal_open" | "goal_penalty" | "penalty_miss" | "yellow" | "two_min" | "red" | "save_open" | "save_penalty";
type MatchEvent = { id: number; matchId: number; playerId: number | null; side: "ours" | "opponent"; type: EventType; matchSecond: number; period: number; periodSecond: number; annulled: boolean; annulledAt: string | null; createdAt: string };
type MatchSubstitution = { id: number; matchId: number; playerInId: number; playerOutId: number; position: CourtPosition; swap: boolean; playerInPreviousPosition: CourtPosition | null; matchSecond: number; period: number; periodSecond: number; createdAt: string };
type MatchComment = { id: number; matchId: number; visibility: "public" | "internal"; body: string; authorName: string; createdAt: string };
type Position = CourtPosition | "bench";
type CourtPosition = "goalkeeper" | "right_wing" | "right_back" | "center" | "left_back" | "left_wing";

const courtPositions: CourtPosition[] = ["goalkeeper", "left_wing", "left_back", "center", "right_back", "right_wing"];
const fallbackCourtPositions: CourtPosition[] = ["left_wing", "left_back", "center", "right_back", "right_wing"];
const validPositions = new Set<Position>([...courtPositions, "bench"]);
const positionLayout: Record<CourtPosition, { left: string; top: string; label: string }> = {
  goalkeeper: { left: "50%", top: "89%", label: "Keeper" },
  left_wing: { left: "12%", top: "74%", label: "Venstre ving" },
  left_back: { left: "30%", top: "69%", label: "Venstre back" },
  center: { left: "50%", top: "59%", label: "Midt" },
  right_back: { left: "70%", top: "69%", label: "Høyre back" },
  right_wing: { left: "88%", top: "74%", label: "Høyre ving" },
};
const eventInfo: Record<EventType, { short: string; label: string; className: string }> = {
  goal_open: { short: "Mål", label: "Mål åpent spill", className: "bg-emerald-600 text-white" },
  goal_penalty: { short: "Straffe", label: "Mål straffe", className: "bg-sky-600 text-white" },
  penalty_miss: { short: "Bom", label: "Bom straffe", className: "bg-slate-600 text-white" },
  yellow: { short: "Gult", label: "Gult kort", className: "bg-yellow-400 text-yellow-950" },
  two_min: { short: "2 min", label: "2 min", className: "bg-orange-500 text-white" },
  red: { short: "Rødt", label: "Rødt kort", className: "bg-red-600 text-white" },
  save_open: { short: "Redning", label: "Redning", className: "bg-violet-600 text-white" },
  save_penalty: { short: "Reddet 7 m", label: "Reddet straffe", className: "bg-indigo-700 text-white" },
};
const eventOrder: EventType[] = ["goal_open", "yellow", "red", "two_min", "goal_penalty", "penalty_miss"];
const goalkeeperEventOrder: EventType[] = ["save_open", "save_penalty"];

export function MatchWorkspace({
  open,
  saving,
  match,
  players,
  roster,
  events,
  substitutions,
  comments,
  onOpenChange,
  onSave,
  onClock,
  onEvent,
  onDeleteEvent,
  onSetEventAnnulled,
  onChangeGoalScorer,
  onSubstitution,
  onSwapPlayers,
  onDeleteSubstitution,
  onAddComment,
  onDeleteComment,
  canRecord,
  onComplete,
}: {
  open: boolean;
  saving: boolean;
  match: Match;
  players: Player[];
  roster: MatchPlayer[];
  events: MatchEvent[];
  substitutions: MatchSubstitution[];
  comments: MatchComment[];
  onOpenChange: (open: boolean) => void;
  onSave: (payload: Record<string, unknown>) => Promise<boolean>;
  onClock: (mode: "start_first" | "start" | "pause" | "finish_period" | "start_second" | "reset", elapsedSeconds: number, periodElapsedSeconds: number, clockStartedAt?: string) => Promise<boolean>;
  onEvent: (side: "ours" | "opponent", playerId: number | null, type: EventType, matchSecond: number, period: number, periodSecond: number) => Promise<boolean>;
  onDeleteEvent: (eventId: number) => Promise<boolean>;
  onSetEventAnnulled: (eventId: number, annulled: boolean) => Promise<boolean>;
  onChangeGoalScorer: (eventId: number, playerId: number) => Promise<boolean>;
  onSubstitution: (playerInId: number, playerOutId: number, matchSecond: number, period: number, periodSecond: number) => Promise<boolean>;
  onSwapPlayers: (playerOutId: number, playerInId: number, matchSecond: number, period: number, periodSecond: number) => Promise<boolean>;
  onDeleteSubstitution: (id: number) => Promise<boolean>;
  onAddComment: (body: string, visibility: "public" | "internal") => Promise<boolean>;
  onDeleteComment: (id: number) => Promise<boolean>;
  canRecord: boolean;
  onComplete: (elapsedSeconds: number, periodElapsedSeconds: number) => Promise<boolean>;
}) {
  const [selectedTarget, setSelectedTarget] = useState<{ side: "ours" | "opponent"; playerId: number | null; label: string } | null>(null);
  const [playerGoingOut, setPlayerGoingOut] = useState<{ playerId: number; reason: "two_min" | "red" } | null>(null);
  const [playerChanging, setPlayerChanging] = useState<number | null>(null);
  const [selectedLoggedGoal, setSelectedLoggedGoal] = useState<MatchEvent | null>(null);
  const [goalScorerChanging, setGoalScorerChanging] = useState<MatchEvent | null>(null);
  const [commentText, setCommentText] = useState("");
  const [notes, setNotes] = useState(match.notes);
  const [now, setNow] = useState(() => Date.now());
  const autoStopKey = useRef("");

  useEffect(() => {
    if (!Boolean(match.clockRunning)) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [match.clockRunning, match.clockStartedAt]);

  const clockSeconds = useMemo(() => {
    const stored = Math.max(0, Number(match.elapsedSeconds ?? 0));
    if (!Boolean(match.clockRunning) || !match.clockStartedAt) return stored;
    const startedAt = Date.parse(match.clockStartedAt);
    if (Number.isNaN(startedAt)) return stored;
    return stored + Math.max(0, Math.floor((now - startedAt) / 1000));
  }, [match.clockRunning, match.clockStartedAt, match.elapsedSeconds, now]);
  const periodClockSeconds = useMemo(() => {
    const stored = Math.max(0, Number(match.periodElapsedSeconds ?? 0));
    if (!Boolean(match.clockRunning) || !match.clockStartedAt) return stored;
    const startedAt = Date.parse(match.clockStartedAt);
    if (Number.isNaN(startedAt)) return stored;
    return stored + Math.max(0, Math.floor((now - startedAt) / 1000));
  }, [match.clockRunning, match.clockStartedAt, match.periodElapsedSeconds, now]);
  const periodLimitSeconds = Math.max(60, Number(match.periodMinutes || 20) * 60);
  const displayedPeriodSeconds = Math.min(periodClockSeconds, periodLimitSeconds);
  const activePeriod = match.currentPeriod === 2 || match.matchPhase === "second_half" ? 2 : 1;

  useEffect(() => {
    if (!canRecord || !Boolean(match.clockRunning) || periodClockSeconds < periodLimitSeconds) return;
    if (match.matchPhase !== "first_half" && match.matchPhase !== "second_half") return;
    const transitionKey = `${match.id}:${match.matchPhase}:${match.clockStartedAt}`;
    if (autoStopKey.current === transitionKey) return;
    autoStopKey.current = transitionKey;
    const cappedTotal = Math.max(0, clockSeconds - Math.max(0, periodClockSeconds - periodLimitSeconds));
    const transition = match.matchPhase === "first_half" ? onClock("finish_period", cappedTotal, periodLimitSeconds) : onComplete(cappedTotal, periodLimitSeconds);
    void transition.then((ok) => { if (!ok) autoStopKey.current = ""; });
  }, [canRecord, clockSeconds, match.clockRunning, match.clockStartedAt, match.id, match.matchPhase, onClock, onComplete, periodClockSeconds, periodLimitSeconds]);

  const initialPositions = useMemo(() => normalizeInitialPositions(roster), [roster]);
  const currentPositions = useMemo(() => {
    const positions = new Map(initialPositions);
    for (const substitution of [...substitutions].sort((a, b) => a.id - b.id)) {
      positions.set(substitution.playerOutId, substitution.swap ? substitution.playerInPreviousPosition ?? "bench" : "bench");
      positions.set(substitution.playerInId, substitution.position);
    }
    return positions;
  }, [initialPositions, substitutions]);
  const playingSeconds = useMemo(() => calculatePlayingSeconds(roster, substitutions, clockSeconds), [roster, substitutions, clockSeconds]);

  const rosterPayload = roster.map((entry) => {
    const position = initialPositions.get(entry.playerId) ?? "bench";
    return { playerId: entry.playerId, starter: position !== "bench", goalkeeper: position === "goalkeeper", captain: Boolean(entry.captain), position };
  });
  const rosterPlayers = useMemo(() => {
    const rosterPlayerIds = new Set(roster.map((entry) => entry.playerId));
    return players.filter((player) => rosterPlayerIds.has(player.id));
  }, [players, roster]);
  const redPlayerIds = new Set(events.filter((event) => event.side === "ours" && event.type === "red" && event.playerId).map((event) => Number(event.playerId)));
  const registeredGoals = events.filter((event) => !event.annulled && (event.type === "goal_open" || event.type === "goal_penalty"));
  const ourScore = registeredGoals.length > 0 ? registeredGoals.filter((event) => event.side === "ours").length : match.ourScore ?? 0;
  const opponentScore = registeredGoals.length > 0 ? registeredGoals.filter((event) => event.side === "opponent").length : match.opponentScore ?? 0;
  const homeTeam = match.homeAway === "away" ? match.opponent : match.team;
  const awayTeam = match.homeAway === "away" ? match.team : match.opponent;
  const homeScore = match.homeAway === "away" ? opponentScore : ourScore;
  const awayScore = match.homeAway === "away" ? ourScore : opponentScore;
  const ourGoals = events
    .filter((event) => !event.annulled && event.side === "ours" && (event.type === "goal_open" || event.type === "goal_penalty"))
    .sort((a, b) => b.id - a.id);

  async function registerEvent(type: EventType) {
    if (!selectedTarget) return;
    const target = selectedTarget;
    const targetPosition = target.playerId ? currentPositions.get(target.playerId) ?? "bench" : "bench";
    const requiresReplacement = target.side === "ours" && Boolean(target.playerId) && targetPosition !== "bench" && targetPosition !== "goalkeeper" && (type === "two_min" || type === "red");
    setSelectedTarget(null);
    const ok = await onEvent(target.side, target.playerId, type, clockSeconds, activePeriod, displayedPeriodSeconds);
    if (!ok) setSelectedTarget(target);
    else if (requiresReplacement && target.playerId) setPlayerGoingOut({ playerId: target.playerId, reason: type as "two_min" | "red" });
  }

  async function completeForcedReplacement(playerInId: number) {
    if (!playerGoingOut) return;
    const outgoing = playerGoingOut;
    setPlayerGoingOut(null);
    const ok = await onSubstitution(playerInId, outgoing.playerId, clockSeconds, activePeriod, displayedPeriodSeconds);
    if (!ok) setPlayerGoingOut(outgoing);
  }

  async function completePlayerChange(playerId: number) {
    if (!playerChanging) return;
    const selectedPlayerId = playerChanging;
    const selectedPosition = currentPositions.get(selectedPlayerId) ?? "bench";
    const targetPosition = currentPositions.get(playerId) ?? "bench";
    setPlayerChanging(null);
    const ok = selectedPosition === "bench"
      ? await onSubstitution(selectedPlayerId, playerId, clockSeconds, activePeriod, displayedPeriodSeconds)
      : targetPosition === "bench"
        ? await onSubstitution(playerId, selectedPlayerId, clockSeconds, activePeriod, displayedPeriodSeconds)
        : await onSwapPlayers(selectedPlayerId, playerId, clockSeconds, activePeriod, displayedPeriodSeconds);
    if (!ok) setPlayerChanging(selectedPlayerId);
  }

  async function saveComment(visibility: "public" | "internal") {
    const body = commentText.trim();
    if (!body) return;
    const ok = await onAddComment(body, visibility);
    if (ok) setCommentText("");
  }

  async function changeGoalScorer(playerId: number) {
    if (!goalScorerChanging) return;
    const eventId = goalScorerChanging.id;
    setGoalScorerChanging(null);
    const ok = await onChangeGoalScorer(eventId, playerId);
    if (!ok) setGoalScorerChanging(goalScorerChanging);
  }

  function selectPlayer(player: Player) {
    if (!canRecord) return;
    const position = currentPositions.get(player.id) ?? "bench";
    if (position === "bench" && redPlayerIds.has(player.id)) return;
    if (playerGoingOut) {
      if (position === "bench") void completeForcedReplacement(player.id);
      return;
    }
    setSelectedTarget({ side: "ours", playerId: player.id, label: playerLabel(player) });
  }

  const goingOutPlayer = players.find((player) => player.id === playerGoingOut?.playerId);
  const phase = match.status === "completed" ? "completed" : match.matchPhase || (match.currentPeriod === 2 ? "second_half" : match.currentPeriod === 1 ? "first_half" : "pre_match");
  const clockIsRunning = Boolean(match.clockRunning) && displayedPeriodSeconds < periodLimitSeconds;
  const phaseLabel = phase === "halftime" ? "Pause" : phase === "second_half" ? "2. omgang" : phase === "first_half" ? "1. omgang" : phase === "completed" ? "Kampen er ferdig" : "Ikke startet";

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="h-[96dvh] max-h-[96dvh] overflow-y-auto p-4 sm:max-w-5xl sm:p-6">
      <DialogHeader>
        <DialogTitle>{fixtureLabel(match)}</DialogTitle>
        <DialogDescription>{match.competition} · {formatDate(match.date)}{match.startTime ? ` kl. ${match.startTime}` : ""}</DialogDescription>
        <div className="mt-1 flex w-fit items-center gap-2 rounded-full border bg-slate-50 px-3 py-1.5 text-sm text-slate-800">
          <UserRoundCheck className="size-4 text-primary" />
          <span><span className="font-semibold">Kampregistrator:</span> {match.registrarName || "Ingen valgt"}</span>
        </div>
      </DialogHeader>

      <div className="space-y-4">
        {!canRecord && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950"><p className="font-bold">{match.status === "cancelled" ? "Kampen er avlyst" : match.status === "completed" ? "Kampen er gjennomført og låst" : "Visning av kamp og laguttak"}</p><p className="mt-1">{match.status === "completed" ? "En administrator kan åpne kampen igjen dersom noe må korrigeres." : "Du har lesetilgang til kampen."}</p></div>}
        <section className="rounded-3xl bg-gradient-to-br from-[#730d13] to-[#b72224] px-4 py-4 text-white shadow-sm sm:px-6">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <div><p className="text-sm font-bold leading-tight sm:text-lg">{homeTeam}</p><p className="mt-1 text-5xl font-black tabular-nums">{homeScore}</p></div>
            <div className="min-w-24">
              <p className="text-xs font-bold uppercase tracking-wider text-red-100">{phaseLabel}</p>
              <p className="mt-1 font-mono text-2xl font-black tabular-nums sm:text-3xl">{formatClock(displayedPeriodSeconds)}</p>
              <p className="mt-1 text-xs text-red-100">{clockIsRunning ? "Klokken går" : phase === "halftime" ? "Klar for andre omgang" : phase === "first_half" || phase === "second_half" ? "Klokken er pauset" : `${match.periodCount || 2} × ${match.periodMinutes || 20} min`}</p>
            </div>
            <div><p className="text-sm font-bold leading-tight sm:text-lg">{awayTeam}</p><p className="mt-1 text-5xl font-black tabular-nums">{awayScore}</p></div>
          </div>
          {canRecord && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {phase === "pre_match" && <Button className="min-w-40 bg-white text-primary hover:bg-red-50" disabled={saving} onClick={() => void onClock("start_first", 0, 0, new Date().toISOString())}><Play /> Start 1. omgang</Button>}
            {(phase === "first_half" || phase === "second_half") && <Button className="min-w-32 bg-white text-primary hover:bg-red-50" disabled={saving} onClick={() => clockIsRunning ? void onClock("pause", clockSeconds, displayedPeriodSeconds) : void onClock("start", clockSeconds, displayedPeriodSeconds, new Date().toISOString())}>{clockIsRunning ? <><Pause /> Pause</> : <><Play /> Fortsett</>}</Button>}
            {phase === "first_half" && <Button className="min-w-44 border-amber-300 bg-amber-400 text-slate-950 hover:bg-amber-300 hover:text-slate-950" disabled={saving} variant="outline" onClick={() => void onClock("finish_period", clockSeconds, displayedPeriodSeconds)}><Flag /> 1. omgang ferdig</Button>}
            {phase === "halftime" && <Button className="min-w-40 bg-white text-primary hover:bg-red-50" disabled={saving} onClick={() => void onClock("start_second", clockSeconds, 0, new Date().toISOString())}><Play /> Start 2. omgang</Button>}
            {(phase === "pre_match" || phase === "first_half") && !Boolean(match.clockRunning) && clockSeconds > 0 && events.length === 0 && substitutions.length === 0 && <AlertDialog>
              <AlertDialogTrigger asChild><Button className="border-white/30 text-white hover:bg-white/10 hover:text-white" variant="outline"><TimerReset /> Nullstill</Button></AlertDialogTrigger>
              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Nullstill kampklokken?</AlertDialogTitle><AlertDialogDescription>Klokken settes tilbake til 00:00. Registrerte hendelser og bytter beholdes.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Avbryt</AlertDialogCancel><AlertDialogAction onClick={() => void onClock("reset", 0, 0)}>Nullstill</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>}
            {phase === "second_half" && <AlertDialog><AlertDialogTrigger asChild><Button className="border-white/30 text-white hover:bg-white/10 hover:text-white" variant="outline"><Flag /> Kamp ferdig</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Avslutt og lås kampen?</AlertDialogTitle><AlertDialogDescription>Kampklokken stoppes, og kampen tas med i statistikken. Administrator kan åpne den igjen senere.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Avbryt</AlertDialogCancel><AlertDialogAction onClick={() => void onComplete(clockSeconds, displayedPeriodSeconds)}>Kamp ferdig</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
          </div>}
          {ourGoals.length > 0 && <div className="mt-4 border-t border-white/20 pt-3"><p className="text-center text-xs font-bold uppercase tracking-wider text-red-100">Siste mål</p><div className="mt-2 flex flex-wrap justify-center gap-1.5">{ourGoals.slice(0, 6).map((event) => { const player = players.find((item) => item.id === event.playerId); return <span key={event.id} className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">{player ? compactName(player.name, rosterPlayers) : "Spiller"} · {formatEventTime(event.period, event.periodSecond)}</span>; })}</div></div>}
        </section>

        {playerGoingOut && <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-orange-500 bg-orange-50 p-3 text-orange-950">
          <div><p className="font-bold">{goingOutPlayer ? `${compactName(goingOutPlayer.name, rosterPlayers)} har fått ${playerGoingOut.reason === "red" ? "rødt kort" : "2 minutter"}` : "Velg innbytter"}</p><p className="text-sm">J12 spiller videre med fullt lag. Trykk på spilleren på benken som skal inn nå.</p></div>
          <Button variant="outline" onClick={() => setPlayerGoingOut(null)}>Avbryt</Button>
        </div>}

        <section>
          <div className="mb-3 flex items-end justify-between gap-3"><div><h3 className="text-lg font-bold">Kampbane</h3><p className="text-sm text-muted-foreground">Trykk på en spiller eller motstanderlaget for å registrere.</p></div><Badge variant="outline"><Users /> {roster.length} spillere</Badge></div>
          <div className="relative mx-auto aspect-[4/5] w-full max-w-3xl overflow-hidden rounded-3xl border-4 border-white bg-[#efa764] shadow-[0_0_0_1px_#d7833e] sm:aspect-[16/10]">
            <div className="absolute inset-x-0 top-1/2 border-t-2 border-white/90" />
            <div className="absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 sm:size-32" />
            <div className="absolute left-1/2 top-0 h-[9%] w-[30%] -translate-x-1/2 border-x-2 border-b-2 border-white/90" />
            <div className="absolute bottom-0 left-1/2 h-[9%] w-[30%] -translate-x-1/2 border-x-2 border-t-2 border-white/90" />
            <div className="absolute left-1/2 top-0 h-[27%] w-[62%] -translate-x-1/2 rounded-b-[50%] border-x-2 border-b-2 border-white/80" />
            <div className="absolute bottom-0 left-1/2 h-[27%] w-[62%] -translate-x-1/2 rounded-t-[50%] border-x-2 border-t-2 border-white/80" />

            <button type="button" disabled={!canRecord || Boolean(playerGoingOut)} onClick={() => setSelectedTarget({ side: "opponent", playerId: null, label: match.opponent })} className="absolute left-1/2 top-[20%] z-10 min-h-14 w-[54%] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-white bg-[#7c1117] px-3 py-2 text-center text-white shadow-lg transition hover:scale-[1.02] disabled:opacity-80">
              <span className="block text-xs font-bold uppercase tracking-wider text-red-100">Motstanderlaget</span><span className="mt-1 block truncate font-black">{match.opponent}</span>
            </button>

            {courtPositions.map((position) => {
              const playerId = [...currentPositions.entries()].find(([, playerPosition]) => playerPosition === position)?.[0];
              const player = players.find((item) => item.id === playerId);
              if (!player) return <div key={position} style={{ left: positionLayout[position].left, top: positionLayout[position].top }} className="absolute w-[22%] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-dashed border-white/70 bg-white/20 px-1 py-2 text-center text-[10px] font-bold text-white/90 sm:text-xs">{positionLayout[position].label}</div>;
              return <CourtPlayerButton key={position} player={player} displayName={compactName(player.name, rosterPlayers)} position={position} seconds={playingSeconds.get(player.id) ?? 0} marks={disciplineMarks(events, player.id)} captain={Boolean(roster.find((entry) => entry.playerId === player.id)?.captain)} selectingOutgoing={false} disabled={!canRecord || Boolean(playerGoingOut)} onClick={() => selectPlayer(player)} />;
            })}
          </div>

          <div className="mt-3 rounded-2xl border bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Benk</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {roster.filter((entry) => (currentPositions.get(entry.playerId) ?? "bench") === "bench").map((entry) => {
                const player = players.find((item) => item.id === entry.playerId);
                if (!player) return null;
                const marks = disciplineMarks(events, player.id);
                const unavailable = redPlayerIds.has(player.id);
                return <button key={player.id} type="button" disabled={!canRecord || unavailable} onClick={() => selectPlayer(player)} className={`min-h-12 rounded-xl border px-3 py-2 text-left shadow-sm transition hover:border-primary disabled:opacity-80 ${playerGoingOut && !unavailable ? "animate-pulse border-orange-500 bg-orange-50" : unavailable ? "border-red-300 bg-red-50" : "bg-white"}`}>
                  <span className="flex items-center gap-1 text-sm font-bold">{entry.captain && <CaptainMark />}{playerLabel(player)}<PlayerMarks marks={marks} /></span><span className="block text-xs text-muted-foreground">{unavailable ? "Rødt kort · kan ikke byttes inn" : `${formatPlayingTime(playingSeconds.get(player.id) ?? 0)} på banen`}</span>
                </button>;
              })}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border p-4">
          <h3 className="flex items-center gap-2 font-bold"><MessageSquare className="size-5" /> Kampkommentarer</h3>
          {canRecord && <div className="mt-3 rounded-xl border bg-slate-50 p-3">
            <Textarea className="min-h-20 bg-white" maxLength={1000} aria-label="Ny kampkommentar" value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Skriv en kort oppdatering eller et internt notat …" />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" disabled={saving || !commentText.trim()} onClick={() => void saveComment("public")}><Eye /> Publiser til foresatte</Button>
              <Button size="sm" variant="outline" disabled={saving || !commentText.trim()} onClick={() => void saveComment("internal")}><LockKeyhole /> Lagre internt</Button>
            </div>
          </div>}
          {comments.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Ingen kommentarer lagt inn.</p> : <div className="mt-3 space-y-2">{comments.map((comment) => <div key={comment.id} className={`rounded-xl border p-3 ${comment.visibility === "internal" ? "border-amber-200 bg-amber-50" : "bg-white"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge className={comment.visibility === "internal" ? "bg-amber-100 text-amber-950" : "bg-sky-100 text-sky-950"}>{comment.visibility === "internal" ? <><LockKeyhole /> Internt</> : <><Eye /> Foresatte</>}</Badge><span className="text-xs text-muted-foreground">{comment.authorName} · {formatCommentTime(comment.createdAt)}</span></div><p className="mt-2 whitespace-pre-wrap text-sm">{comment.body}</p></div>{canRecord && <Button aria-label="Slett kommentar" size="icon-sm" variant="ghost" onClick={() => void onDeleteComment(comment.id)}><Trash2 /></Button>}</div></div>)}</div>}
        </section>

        {canRecord && <section className="rounded-2xl border p-4"><h3 className="flex items-center gap-2 font-bold"><LockKeyhole className="size-5" /> Internt kampnotat</h3><p className="mt-1 text-xs text-muted-foreground">Samlet trenernotat. Dette vises bare for administrator og kampregistrator.</p><Textarea className="mt-3 min-h-24" aria-label="Internt kampnotat" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Kommentarer og læringspunkter" /><Button className="mt-3" disabled={saving} onClick={() => void onSave({ ...match, notes, roster: rosterPayload })}>{saving ? "Lagrer …" : "Lagre internt kampnotat"}</Button></section>}

        <section className="grid gap-4 lg:grid-cols-2">
          <div><h3 className="font-bold">Hendelseslogg</h3>{events.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Ingen hendelser registrert.</p> : <div className="mt-2 space-y-2">{events.map((event) => { const player = players.find((item) => item.id === event.playerId); const actor = event.side === "opponent" ? match.opponent : player?.name ?? "Ukjent spiller"; const isGoal = event.type === "goal_open" || event.type === "goal_penalty"; return <div key={event.id} role={canRecord && isGoal ? "button" : undefined} tabIndex={canRecord && isGoal ? 0 : undefined} onClick={() => { if (canRecord && isGoal) setSelectedLoggedGoal(event); }} onKeyDown={(keyEvent) => { if (canRecord && isGoal && (keyEvent.key === "Enter" || keyEvent.key === " ")) setSelectedLoggedGoal(event); }} className={`flex min-h-12 items-center justify-between rounded-xl border px-3 py-2 ${event.annulled ? "border-dashed bg-slate-100 opacity-70" : canRecord && isGoal ? "cursor-pointer hover:border-primary hover:bg-red-50/40" : ""}`}><div className="flex min-w-0 items-center gap-2"><span className="w-20 shrink-0 text-xs font-bold text-muted-foreground">{formatEventTime(event.period, event.periodSecond)}</span><span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${event.annulled ? "bg-slate-400 text-white line-through" : eventInfo[event.type].className}`}>{eventInfo[event.type].short}</span><span className={`truncate text-sm font-medium ${event.annulled ? "line-through" : ""}`}>{actor}</span>{event.annulled && <Badge variant="outline">Annullert</Badge>}</div>{canRecord && !isGoal && <Button aria-label={`Angre ${eventInfo[event.type].label}`} size="icon-sm" variant="ghost" onClick={() => void onDeleteEvent(event.id)}><RotateCcw /></Button>}</div>; })}</div>}</div>
          <div><h3 className="font-bold">Bytter</h3>{substitutions.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Ingen bytter registrert.</p> : <div className="mt-2 space-y-2">{[...substitutions].reverse().map((substitution, index) => { const playerIn = players.find((item) => item.id === substitution.playerInId); const playerOut = players.find((item) => item.id === substitution.playerOutId); return <div key={substitution.id} className="flex min-h-12 items-center justify-between rounded-xl border px-3 py-2"><div className="min-w-0">{substitution.swap ? <p className="truncate text-sm font-semibold"><span className="text-sky-800">Posisjonsbytte: {playerOut ? compactName(playerOut.name, rosterPlayers) : "Ukjent"} ↔ {playerIn ? compactName(playerIn.name, rosterPlayers) : "Ukjent"}</span></p> : <p className="truncate text-sm font-semibold"><span className="text-emerald-700">Inn: {playerIn ? compactName(playerIn.name, rosterPlayers) : "Ukjent"}</span> · <span className="text-primary">Ut: {playerOut ? compactName(playerOut.name, rosterPlayers) : "Ukjent"}</span></p>}<p className="text-xs text-muted-foreground">{formatEventTime(substitution.period, substitution.periodSecond)} · {substitution.swap ? "Byttet posisjon" : positionLayout[substitution.position]?.label ?? "Posisjon"}</p></div>{canRecord && index === 0 && <Button aria-label="Angre siste bytte" size="icon-sm" variant="ghost" onClick={() => void onDeleteSubstitution(substitution.id)}><RotateCcw /></Button>}</div>; })}</div>}</div>
        </section>
      </div>

      <Dialog open={Boolean(selectedTarget)} onOpenChange={(isOpen) => { if (!isOpen) setSelectedTarget(null); }}>
        <DialogContent className="z-[70] max-w-xl rounded-3xl p-0">
          <DialogHeader className="border-b px-5 pb-4 pt-5 pr-12 text-left">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Registrer hendelse</p>
            <DialogTitle className="text-xl">{selectedTarget?.label ?? "Velg hendelse"}</DialogTitle>
            <DialogDescription>{activePeriod}. omgang · {formatClock(displayedPeriodSeconds)}. Vinduet lukkes når du velger.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 px-4 pb-5 sm:grid-cols-3 sm:px-5">
            {selectedTarget?.side === "ours" && selectedTarget.playerId && currentPositions.get(selectedTarget.playerId) === "bench" ? <button type="button" disabled={saving} onClick={() => { setPlayerChanging(selectedTarget.playerId); setSelectedTarget(null); }} className="col-span-2 min-h-20 rounded-xl bg-sky-700 px-4 py-4 text-base font-black text-white transition hover:bg-sky-800 sm:col-span-3"><ArrowLeftRight className="mr-2 inline size-6" /> Bytt inn</button> : <>
              {selectedTarget?.side === "ours" && selectedTarget.playerId && currentPositions.get(selectedTarget.playerId) === "goalkeeper" ? <>
                <button type="button" disabled={saving} onClick={() => void registerEvent("save_open")} className={`col-span-2 min-h-20 rounded-xl px-4 py-4 text-base font-black transition hover:brightness-95 disabled:opacity-50 sm:col-span-3 ${eventInfo.save_open.className}`}>{eventInfo.save_open.label}</button>
                {goalkeeperEventOrder.filter((type) => type !== "save_open").map((type) => <button key={type} type="button" disabled={saving} onClick={() => void registerEvent(type)} className={`min-h-16 rounded-xl px-3 py-3 text-sm font-bold transition hover:brightness-95 disabled:opacity-50 ${eventInfo[type].className}`}>{eventInfo[type].label}</button>)}
                {eventOrder.map((type) => <button key={type} type="button" disabled={saving} onClick={() => void registerEvent(type)} className={`min-h-16 rounded-xl px-3 py-3 text-sm font-bold transition hover:brightness-95 disabled:opacity-50 ${eventInfo[type].className}`}>{eventInfo[type].label}</button>)}
              </> : selectedTarget?.side === "ours" && selectedTarget.playerId ? <>
                <button type="button" disabled={saving} onClick={() => void registerEvent("goal_open")} className={`col-span-2 min-h-20 rounded-xl px-4 py-4 text-base font-black transition hover:brightness-95 disabled:opacity-50 sm:col-span-3 ${eventInfo.goal_open.className}`}>{eventInfo.goal_open.label}</button>
                {eventOrder.filter((type) => type !== "goal_open").map((type) => <button key={type} type="button" disabled={saving} onClick={() => void registerEvent(type)} className={`min-h-16 rounded-xl px-3 py-3 text-sm font-bold transition hover:brightness-95 disabled:opacity-50 ${eventInfo[type].className}`}>{eventInfo[type].label}</button>)}
              </> : eventOrder.map((type) => <button key={type} type="button" disabled={saving} onClick={() => void registerEvent(type)} className={`min-h-16 rounded-xl px-3 py-3 text-sm font-bold transition hover:brightness-95 disabled:opacity-50 ${eventInfo[type].className}`}>{eventInfo[type].label}</button>)}
              {selectedTarget?.side === "ours" && selectedTarget.playerId && <button type="button" disabled={saving} onClick={() => { setPlayerChanging(selectedTarget.playerId); setSelectedTarget(null); }} className="col-span-2 min-h-20 rounded-xl bg-sky-700 px-4 py-4 text-base font-black text-white transition hover:bg-sky-800 sm:col-span-3"><ArrowLeftRight className="mr-2 inline size-6" /> Bytte</button>}
            </>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedLoggedGoal)} onOpenChange={(isOpen) => { if (!isOpen) setSelectedLoggedGoal(null); }}>
        <DialogContent className="z-[70] max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>{selectedLoggedGoal?.annulled ? "Annullert mål" : "Registrert mål"}</DialogTitle>
            <DialogDescription>{selectedLoggedGoal ? formatEventTime(selectedLoggedGoal.period, selectedLoggedGoal.periodSecond) : ""}. Endringen oppdaterer stillingen og statistikken med en gang.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={saving || !selectedLoggedGoal} variant={selectedLoggedGoal?.annulled ? "outline" : "destructive"} onClick={() => { if (!selectedLoggedGoal) return; const selected = selectedLoggedGoal; setSelectedLoggedGoal(null); void onSetEventAnnulled(selected.id, !selected.annulled); }}>{selectedLoggedGoal?.annulled ? "Gjenopprett mål" : "Annuller mål"}</Button>
            {selectedLoggedGoal?.side === "ours" && <Button disabled={saving} variant="outline" onClick={() => { setGoalScorerChanging(selectedLoggedGoal); setSelectedLoggedGoal(null); }}>Endre målscorer</Button>}
            <Button variant="outline" onClick={() => setSelectedLoggedGoal(null)}>Avbryt</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(goalScorerChanging)} onOpenChange={(isOpen) => { if (!isOpen) setGoalScorerChanging(null); }}>
        <DialogContent className="z-[70] max-h-[88dvh] max-w-xl overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Velg riktig målscorer</DialogTitle>
            <DialogDescription>Målet beholder samme tidspunkt og type.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">{rosterPlayers.map((player) => <button key={player.id} type="button" disabled={saving || player.id === goalScorerChanging?.playerId} onClick={() => void changeGoalScorer(player.id)} className="rounded-xl border bg-white p-3 text-left transition hover:border-primary hover:bg-red-50/40 disabled:bg-slate-100 disabled:opacity-60"><span className="font-bold">{playerLabel(player)}</span>{player.id === goalScorerChanging?.playerId && <span className="ml-2 text-xs text-muted-foreground">Nåværende</span>}</button>)}</div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(playerChanging)} onOpenChange={(isOpen) => { if (!isOpen) setPlayerChanging(null); }}>
        <DialogContent className="z-[70] max-h-[88dvh] max-w-xl overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Velg spiller å bytte med</DialogTitle>
            <DialogDescription>{playerChanging && currentPositions.get(playerChanging) === "bench" ? "Velg spilleren på banen som skal ut. Innbytteren overtar posisjonen." : "Velg en spiller på benken for et vanlig bytte, eller en spiller på banen for å bytte posisjon."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <PlayerChoices title="På banen" players={rosterPlayers.filter((player) => player.id !== playerChanging && (currentPositions.get(player.id) ?? "bench") !== "bench" && !redPlayerIds.has(player.id))} positions={currentPositions} onChoose={(id) => void completePlayerChange(id)} />
            {playerChanging && currentPositions.get(playerChanging) !== "bench" && <PlayerChoices title="På benken" players={rosterPlayers.filter((player) => player.id !== playerChanging && (currentPositions.get(player.id) ?? "bench") === "bench" && !redPlayerIds.has(player.id))} positions={currentPositions} onChoose={(id) => void completePlayerChange(id)} />}
          </div>
        </DialogContent>
      </Dialog>
    </DialogContent>
  </Dialog>;
}

type DisciplineMarks = { yellow: boolean; twoMinutes: number; red: boolean };

function CourtPlayerButton({ player, displayName, position, seconds, marks, captain, selectingOutgoing, disabled, onClick }: { player: Player; displayName: string; position: CourtPosition; seconds: number; marks: DisciplineMarks; captain: boolean; selectingOutgoing: boolean; disabled: boolean; onClick: () => void }) {
  const layout = positionLayout[position];
  return <button type="button" title={`${player.name} · ${layout.label}`} disabled={disabled} onClick={onClick} style={{ left: layout.left, top: layout.top }} className={`absolute z-10 w-[23%] max-w-36 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 px-1.5 py-1.5 text-center shadow-md transition sm:px-2 sm:py-2 ${selectingOutgoing ? "animate-pulse border-sky-700 bg-sky-50 text-sky-950" : "border-white bg-white text-slate-950 hover:scale-105"} disabled:opacity-60`}>
    <span className="flex items-center justify-center gap-1 text-[11px] font-black leading-tight sm:text-sm">{captain && <CaptainMark />}<span className="truncate">{displayName}</span></span>
    <span className="mt-0.5 block truncate text-[9px] text-muted-foreground sm:text-[11px]">{position === "goalkeeper" && <Shield className="mr-0.5 inline size-3" />}{formatPlayingTime(seconds)}</span>
    <span className="mt-1 flex min-h-4 items-center justify-center gap-1 text-[10px] font-bold text-slate-600 sm:text-xs">{player.jerseyNumber ? `#${player.jerseyNumber}` : ""}<PlayerMarks marks={marks} /></span>
  </button>;
}

function PlayerChoices({ title, players, positions, onChoose }: { title: string; players: Player[]; positions: Map<number, Position>; onChoose: (id: number) => void }) {
  return <section><h3 className="mb-2 text-sm font-bold text-muted-foreground">{title}</h3>{players.length === 0 ? <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Ingen tilgjengelige spillere.</p> : <div className="grid gap-2 sm:grid-cols-2">{players.map((player) => { const position = positions.get(player.id) ?? "bench"; return <button key={player.id} type="button" onClick={() => onChoose(player.id)} className="rounded-xl border bg-white p-3 text-left transition hover:border-primary hover:bg-red-50/40"><span className="block font-bold">{playerLabel(player)}</span><span className="text-xs text-muted-foreground">{position === "bench" ? "Benk" : positionLayout[position]?.label ?? "På banen"}</span></button>; })}</div>}</section>;
}

function PlayerMarks({ marks }: { marks: DisciplineMarks }) {
  return <>{marks.yellow && <span aria-label="Gult kort" title="Gult kort">🟨</span>}{marks.twoMinutes > 0 && <span aria-label={`${marks.twoMinutes} tominuttersutvisning${marks.twoMinutes > 1 ? "er" : ""}`} title={`${marks.twoMinutes} × 2 minutter`}>✌️{marks.twoMinutes > 1 ? <span className="text-[10px] font-black">{marks.twoMinutes}</span> : null}</span>}{marks.red && <span aria-label="Rødt kort" title="Rødt kort">🟥</span>}</>;
}

function CaptainMark() {
  return <span aria-label="Kaptein" title="Kaptein" className="inline-grid size-4 shrink-0 place-items-center rounded-full bg-amber-400 text-[10px] font-black text-amber-950">C</span>;
}

function disciplineMarks(events: MatchEvent[], playerId: number): DisciplineMarks {
  const playerEvents = events.filter((event) => event.side === "ours" && event.playerId === playerId);
  return { yellow: playerEvents.some((event) => event.type === "yellow"), twoMinutes: playerEvents.filter((event) => event.type === "two_min").length, red: playerEvents.some((event) => event.type === "red") };
}

function normalizeInitialPositions(roster: MatchPlayer[]) {
  const positions = new Map<number, Position>();
  const used = new Set<CourtPosition>();
  let fallbackIndex = 0;
  for (const entry of roster) {
    let position: Position = validPositions.has(entry.position) ? entry.position : "bench";
    if (position === "bench" && Boolean(entry.goalkeeper)) position = "goalkeeper";
    if (position === "bench" && Boolean(entry.starter)) {
      while (fallbackIndex < fallbackCourtPositions.length && used.has(fallbackCourtPositions[fallbackIndex])) fallbackIndex += 1;
      position = fallbackCourtPositions[fallbackIndex] ?? "bench";
      fallbackIndex += 1;
    }
    if (position !== "bench" && used.has(position)) position = "bench";
    if (position !== "bench") used.add(position);
    positions.set(entry.playerId, position);
  }
  return positions;
}

function calculatePlayingSeconds(roster: MatchPlayer[], substitutions: MatchSubstitution[], elapsedSeconds: number) {
  const initial = normalizeInitialPositions(roster);
  const totals = new Map<number, number>(roster.map((entry) => [entry.playerId, 0]));
  const activeSince = new Map<number, number>();
  for (const [playerId, position] of initial) if (position !== "bench") activeSince.set(playerId, 0);
  for (const substitution of [...substitutions].sort((a, b) => a.id - b.id)) {
    if (substitution.swap) continue;
    const at = Math.min(elapsedSeconds, Math.max(0, substitution.matchSecond));
    const outgoingSince = activeSince.get(substitution.playerOutId);
    if (outgoingSince !== undefined) totals.set(substitution.playerOutId, (totals.get(substitution.playerOutId) ?? 0) + Math.max(0, at - outgoingSince));
    activeSince.delete(substitution.playerOutId);
    activeSince.set(substitution.playerInId, at);
  }
  for (const [playerId, since] of activeSince) totals.set(playerId, (totals.get(playerId) ?? 0) + Math.max(0, elapsedSeconds - since));
  return totals;
}

function playerLabel(player: Player) {
  return `${player.jerseyNumber ? `#${player.jerseyNumber} · ` : ""}${player.name}`;
}

function compactName(name: string, teammates: Player[]) {
  const nameParts = name.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || name;
  const matchingFirstNames = teammates.filter((player) => {
    const teammateFirstName = player.name.trim().split(/\s+/)[0] || player.name;
    return teammateFirstName.localeCompare(firstName, "nb-NO", { sensitivity: "base" }) === 0;
  });
  if (matchingFirstNames.length < 2 || nameParts.length < 2) return firstName;
  return `${firstName} ${nameParts[1].charAt(0).toLocaleUpperCase("nb-NO")}`;
}

function fixtureLabel(match: Match) {
  return match.homeAway === "away" ? `${match.opponent} – ${match.team}` : `${match.team} – ${match.opponent}`;
}

function formatClock(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function formatEventTime(period: number, periodSecond: number) {
  return `${period === 2 ? "2." : "1."} omg · ${formatClock(periodSecond)}`;
}

function formatPlayingTime(seconds: number) {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const remainingSeconds = Math.floor(Math.max(0, seconds) % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatCommentTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "ukjent tidspunkt";
  return new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDate(value: string) {
  if (!value) return "Dato ikke satt";
  return new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}
