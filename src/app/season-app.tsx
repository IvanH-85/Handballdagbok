Warning: truncated output (original token count: 37268)
Total output lines: 1316

"use client";

import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Clock3,
  Dumbbell,
  Crown,
  Goal,
  LogIn,
  LogOut,
  KeyRound,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserCog,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { trainingThemeOptions } from "@/lib/training-themes";
import { calculatePositionStatistics, positionLabels, type PositionStat } from "@/lib/match-position-stats";
import { fetchSeriesTable, type SeriesTableData } from "@/lib/series-standings";
import { applyAction, clearAuthCallback, fetchCupSnapshot, fetchLiveMatch, fetchMatchEnhancements, fetchSnapshot, fetchTrainingObservations, fetchUserLoginActivity, readAuthCallback, refreshSession, requestPasswordReset, signIn, signOut as supabaseSignOut, signUp, updatePassword, type AuthSessionPayload } from "@/lib/supabase-api";
import { MatchWorkspace } from "./match-workspace";
import { TrainingWorkspace, type Exercise, type TrainingExercise, type TrainingObservation } from "./training-workspace";

type Player = { id: number; name: string; jerseyNumber: number | null; shirtSize: string; shortsSize: string; active: number | boolean; createdAt: string };
type ActivityStatus = "planned" | "live" | "completed" | "cancelled";
type MatchType = "league" | "cup" | "friendly";
type MatchPhase = "pre_match" | "first_half" | "halftime" | "second_half" | "completed";
type AppRole = "admin" | "parent" | "match_registrar";
type AppUser = { id: number; name: string; email: string | null; phone: string; role: AppRole; active: number | boolean; accountUserId: string | null; createdAt: string };
type UserLoginStat = { userId: number; loginCount: number; lastLoginAt: string | null };
type CurrentUser = { id: number; name: string; email: string | null; role: AppRole };
type Training = { id: number; date: string; startTime: string; durationMinutes: number; title: string; theme: string; plan: string; notes: string; status: Exclude<ActivityStatus, "live">; completedAt: string | null; createdAt: string };
type Attendance = { trainingId: number; playerId: number };
type Position = "goalkeeper" | "right_wing" | "right_back" | "center" | "left_back" | "left_wing" | "bench";
type Match = { id: number; date: string; startTime: string; opponent: string; team: string; homeAway: "home" | "away"; internalMatch: boolean; competition: string; matchType: MatchType; cupName: string; venue: string; registrarName: string | null; ourScore: number | null; opponentScore: number | null; periodCount: number; periodMinutes: number; matchPhase: MatchPhase; currentPeriod: number; periodElapsedSeconds: number; clockStartedAt: string | null; elapsedSeconds: number; clockRunning: number | boolean; notes: string; status: ActivityStatus; completedAt: string | null; createdAt: string };
type MatchPlayer = { matchId: number; playerId: number; teamSide: "ours" | "opponent"; starter: number | boolean; goalkeeper: number | boolean; captain: number | boolean; position: Position };
type MatchEvent = { id: number; matchId: number; playerId: number | null; side: "ours" | "opponent"; type: EventType; matchSecond: number; period: number; periodSecond: number; annulled: boolean; annulledAt: string | null; createdAt: string };
type MatchSubstitution = { id: number; matchId: number; playerInId: number; playerOutId: number; position: Exclude<Position, "bench">; swap: boolean; playerInPreviousPosition: Exclude<Position, "bench"> | null; matchSecond: number; period: number; periodSecond: number; createdAt: string };
type MatchComment = { id: number; matchId: number; visibility: "public" | "internal"; body: string; authorName: string; createdAt: string };
type RosterEntry = { playerId: number; teamSide: "ours" | "opponent"; starter: boolean; goalkeeper: boolean; captain: boolean; position: Position };
type EventType = "goal_open" | "goal_penalty" | "penalty_miss" | "yellow" | "two_min" | "red" | "save_open" | "save_penalty";
type MatchRegistrar = { matchId: number; userId: number };
type Cup = { id: number; name: string; startDate: string; endDate: string; venue: string; periodCount: number; periodMinutes: number; createdAt: string };
type CupTeam = { id: number; cupId: number; name: string; sortOrder: number };
type CupTeamPlayer = { cupId: number; cupTeamId: number; playerId: number };
type PlayerGuardian = { playerId: number; userId: number };
type CupMatchLink = { matchId: number; cupId: number; cupTeamId: number };
type CupData = { cups: Cup[]; cupTeams: CupTeam[]; cupTeamPlayers: CupTeamPlayer[]; playerGuardians: PlayerGuardian[]; cupMatchLinks: CupMatchLink[] };
type LiveMatchData = { match: Match; matchPlayers: MatchPlayer[]; matchEvents: MatchEvent[]; matchSubstitutions: MatchSubstitution[] };
type MatchEnhancements = { matchEvents: MatchEvent[]; matchSubstitutions: MatchSubstitution[]; matchComments: MatchComment[] };
type CloudStorageStatus = { provider: string; configured: boolean; mode: "prepared" };
type SeasonData = { players: Player[]; trainings: Training[]; attendance: Attendance[]; exercises: Exercise[]; trainingExercises: TrainingExercise[]; trainingObservations: TrainingObservation[]; matches: Match[]; matchPlayers: MatchPlayer[]; matchEvents: MatchEvent[]; matchSubstitutions: MatchSubstitution[]; matchComments: MatchComment[]; appUsers: AppUser[]; userLoginStats: UserLoginStat[]; matchRegistrars: MatchRegistrar[]; cups: Cup[]; cupTeams: CupTeam[]; cupTeamPlayers: CupTeamPlayer[]; playerGuardians: PlayerGuardian[]; cupMatchLinks: CupMatchLink[]; seriesTable: SeriesTableData | null; currentUser: CurrentUser | null; cloudStorage: CloudStorageStatus };
type AuthSession = { accessToken: string; refreshToken: string; expiresAt: number };

const emptyData: SeasonData = { players: [], trainings: [], attendance: [], exercises: [], trainingExercises: [], trainingObservations: [], matches: [], matchPlayers: [], matchEvents: [], matchSubstitutions: [], matchComments: [], appUsers: [], userLoginStats: [], matchRegistrars: [], cups: [], cupTeams: [], cupTeamPlayers: [], playerGuardians: [], cupMatchLinks: [], seriesTable: null, currentUser: null, cloudStorage: { provider: "Supabase", configured: false, mode: "prepared" } };
const authStorageKey = "sthk-season-auth-v1";
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
const positionOptions: { value: Position; label: string }[] = [
  { value: "goalkeeper", label: "Keeper" },
  { value: "right_wing", label: "Høyre ving" },
  { value: "right_back", label: "Høyre back" },
  { value: "center", label: "Midt" },
  { value: "left_back", label: "Venstre back" },
  { value: "left_wing", label: "Venstre ving" },
  { value: "bench", label: "Benk" },
];

async function readJson(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

function toStoredSession(session: AuthSessionPayload): AuthSession {
  return { accessToken: session.accessToken, refreshToken: session.refreshToken, expiresAt: Date.now() + Math.max(60, session.expiresIn) * 1000 };
}

function readStoredSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(authStorageKey);
    if (!raw) return null;
    const session = JSON.parse(raw) as Partial<AuthSession>;
    return typeof session.accessToken === "string" && typeof session.refreshToken === "string" && typeof session.expiresAt === "number" ? session as AuthSession : null;
  } catch {
    return null;
  }
}

async function fetchSeasonData(accessToken: string): Promise<SeasonData> {
  const data = await fetchSnapshot<Partial<SeasonData>>(accessToken);
  const [cupData, userLoginStats, matchEnhancements] = await Promise.all([
    fetchCupSnapshot<CupData>(accessToken),
    fetchUserLoginActivity<UserLoginStat[]>(accessToken),
    fetchMatchEnhancements<MatchEnhancements>(accessToken),
  ]);
  const trainingObservations = data.currentUser?.role === "admin" ? await fetchTrainingObservations<TrainingObservation[]>(accessToken) : [];
  const seriesTable = data.currentUser?.role === "admin" ? await fetchSeriesTable().catch(() => null) : null;
  return { ...emptyData, ...data, ...cupData, ...matchEnhancements, trainingObservations, userLoginStats, seriesTable };
}

export function SeasonApp() {
  const [data, setData] = useState<SeasonData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [playerOpen, setPlayerOpen] = useState(false);
  const [matchFormOpen, setMatchFormOpen] = useState(false);
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [cupFormOpen, setCupFormOpen] = useState(false);
  const [editingCup, setEditingCup] = useState<Cup | null>(null);
  const [activeCupId, setActiveCupId] = useState<number | null>(null);
  const [returnToCupId, setReturnToCupId] = useState<number | null>(null);
  const [cupMatchContext, setCupMatchContext] = useState<{ cup: Cup; team: CupTeam } | null>(null);
  const [activeMatchId, setActiveMatchId] = useState<number | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [previewRole, setPreviewRole] = useState<AppRole>("admin");
  const sessionRef = useRef<AuthSession | null>(null);
  const refreshPromiseRef = useRef<Promise<AuthSession> | null>(null);

  function saveSession(session: AuthSession | null) {
    sessionRef.current = session;
    setAuthSession(session);
    if (session) window.localStorage.setItem(authStorageKey, JSON.stringify(session));
    else window.localStorage.removeItem(authStorageKey);
  }

  async function refreshAuthSession() {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    const current = sessionRef.current;
    if (!current) throw new Error("Logg inn for å fortsette.");
    const promise = (async () => {
      const session = toStoredSession(await refreshSession(current.refreshToken));
      saveSession(session);
      return session;
    })();
    refreshPromiseRef.current = promise;
    try {
      return await promise;
    } finally {
      refreshPromiseRef.current = null;
    }
  }

  async function getAccessToken() {
    const current = sessionRef.current;
    if (!current) throw new Error("Logg inn for å fortsette.");
    if (current.expiresAt > Date.now() + 60_000) return current.accessToken;
    return (await refreshAuthSession()).accessToken;
  }

  async function loadSeasonData(accessToken?: string) {
    const token = accessToken ?? await getAccessToken();
    try {
      const freshData = await fetchSeasonData(token);
      setData(freshData);
      setError("");
    } catch (err) {
      if ((err as { status?: number }).status === 401) {
        try {
          const refreshed = await refreshAuthSession();
          setData(await fetchSeasonData(refreshed.accessToken));
          setError("");
          return;
        } catch {
          saveSession(null);
        }
      }
      throw err;
    }
  }

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const authCallback = readAuthCallback();
      const confirmedSession = authCallback && authCallback.type !== "recovery" ? toStoredSession(authCallback.session) : null;
      const stored = confirmedSession ?? readStoredSession();
      if (confirmedSession) {
        window.localStorage.setItem(authStorageKey, JSON.stringify(confirmedSession));
        clearAuthCallback();
      }
      sessionRef.current = stored;
      setAuthSession(stored);
      setAuthReady(true);
      if (!stored) {
        setLoading(false);
        return;
      }
      void loadSeasonData(stored.accessToken)
        .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Kunne ikke hente sesongdata."); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
    // Initialisering skal bare kjøres én gang på denne enheten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authSession || !activeMatchId) return;
    let cancelled = false;
    let requestInFlight = false;

    const syncOpenMatch = async () => {
      if (cancelled || requestInFlight || document.visibilityState === "hidden") return;
      requestInFlight = true;
      try {
        const token = await getAccessToken();
        const [live, enhancements] = await Promise.all([
          fetchLiveMatch<LiveMatchData>(token, activeMatchId),
          fetchMatchEnhancements<MatchEnhancements>(token, activeMatchId),
        ]);
        if (cancelled || !live.match) return;
        setData((current) => ({
          ...current,
          matches: current.matches.map((match) => match.id === activeMatchId ? live.match : match),
          matchPlayers: [...current.matchPlayers.filter((entry) => entry.matchId !== activeMatchId), ...live.matchPlayers],
          matchEvents: [...current.matchEvents.filter((event) => event.matchId !== activeMatchId), ...enhancements.matchEvents],
          matchSubstitutions: [...current.matchSubstitutions.filter((entry) => entry.matchId !== activeMatchId), ...enhancements.matchSubstitutions],
          matchComments: [...current.matchComments.filter((entry) => entry.matchId !== activeMatchId), ...enhancements.matchComments],
        }));
      } catch {
        // En midlertidig nettverksfeil skal ikke avbryte kampregistreringen.
      } finally {
        requestInFlight = false;
      }
    };

    const syncWhenVisible = () => { if (document.visibilityState === "visible") void syncOpenMatch(); };
    void syncOpenMatch();
    const interval = window.setInterval(() => void syncOpenMatch(), 2_000);
    document.addEventListener("visibilitychange", syncWhenVisible);
    window.addEventListener("focus", syncWhenVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.removeEventListener("focus", syncWhenVisible);
    };
    // Tilgangstokenet hentes fra sessionRef slik at intervallet ikke må opprettes på nytt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMatchId, authSession]);

  useEffect(() => {
    if (!authSession || (!activeCupId && !matchFormOpen)) return;
    let cancelled = false;
    let requestInFlight = false;
    const syncPlanning = async () => {
      if (cancelled || requestInFlight || document.visibilityState === "hidden") return;
      requestInFlight = true;
      try {
        const token = await getAccessToken();
        const [snapshot, cupSnapshot] = await Promise.all([
          fetchSnapshot<Partial<SeasonData>>(token),
          fetchCupSnapshot<CupData>(token),
        ]);
        if (cancelled) return;
        setData((current) => ({
          ...current,
          players: snapshot.players ?? current.players,
          matches: snapshot.matches ?? current.matches,
          matchPlayers: snapshot.matchPlayers ?? current.matchPlayers,
          matchRegistrars: snapshot.matchRegistrars ?? current.matchRegistrars,
          ...cupSnapshot,
        }));
      } catch {
        // Behold siste kjente plan ved et kort nettverksbrudd.
      } finally {
        requestInFlight = false;
      }
    };
    const syncWhenVisible = () => { if (document.visibilityState === "visible") void syncPlanning(); };
    const interval = window.setInterval(() => void syncPlanning(), 3_000);
    document.addEventListener("visibilitychange", syncWhenVisible);
    window.addEventListener("focus", syncWhenVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.removeEventListener("focus", syncWhenVisible);
    };
    // Tilgangstokenet hentes fra sessionRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCupId, matchFormOpen, authSession]);

  async function refresh(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      await loadSeasonData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente sesongdata.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function runAction(payload: Record<string, unknown>, successMessage: string) {
    setSaving(true);
    setError("");
    try {
      await applyAction(await getAccessToken(), payload);
      await refresh();
      toast.success(successMessage);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kunne ikke lagre endringen.";
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleAuthenticated(sessionPayload: AuthSessionPayload) {
    const session = toStoredSession(sessionPayload);
    saveSession(session);
    setLoading(true);
    try {
      await loadSeasonData(session.accessToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kunne ikke hente sesongdata.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    const token = sessionRef.current?.accessToken;
    saveSession(null);
    setData(emptyData);
    setError("");
    if (token) await supabaseSignOut(token).catch(() => null);
  }

  if (!authReady) return <AuthLoading />;
  if (!authSession) return <LoginScreen onAuthenticated={handleAuthenticated} />;

  const activePlayers = data.players.filter((player) => Boolean(player.active));
  const activeMatch = activeMatchId ? data.matches.find((match) => match.id === activeMatchId) ?? null : null;
  const actualIsAdmin = data.currentUser?.role === "admin";
  const effectiveRole = actualIsAdmin ? previewRole : data.currentUser?.role;
  const isAdmin = effectiveRole === "admin";
  const assignedMatchIds = new Set(data.matchRegistrars.filter((entry) => entry.userId === data.currentUser?.id).map((entry) => entry.matchId));
  const canRecordMatch = (matchId: number) => isAdmin || (actualIsAdmin && effectiveRole === "match_registrar") || (!actualIsAdmin && assignedMatchIds.has(matchId));
  const visibleMatchEvents = data.matchEvents;
  const visibleMatchSubstitutions = data.matchSubstitutions;

  return (
    <main className="min-h-screen pb-16">
      <Toaster position="top-center" />
      <header className="overflow-hidden bg-gradient-to-br from-[#8f1118] via-[#b72224] to-[#d7372d] text-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4 sm:gap-5">
              <img className="size-20 shrink-0 rounded-full bg-white object-cover shadow-lg ring-4 ring-white/20 sm:size-24" src="./sthk-logo.jpg" alt="Stokmarknes Håndballklubb" width={96} height={96} />
              <div className="min-w-0">
                <p className="text-sm font-bold uppercase tracking-[0.12em] text-red-100">Stokmarknes Håndballklubb</p>
                <h1 className="mt-1 flex flex-wrap items-baseline gap-x-2 text-3xl font-black tracking-tight sm:text-4xl"><span>Sesongdagbok</span><span className="text-xl text-red-100 sm:text-2xl">STHK 2015</span></h1>
                <p className="mt-1 hidden max-w-xl text-sm leading-6 text-red-50 sm:block">Treninger, laguttak, kamper og utvikling gjennom sesongen.</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {actualIsAdmin ? <div className="hidden w-40 rounded-2xl border border-white/20 bg-black/10 p-2 sm:block"><p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wider text-red-100">Se løsningen som</p><Select value={previewRole} onValueChange={(value) => setPreviewRole(value as AppRole)}><SelectTrigger className="h-10 border-white/20 bg-white text-slate-950"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Administrator</SelectItem><SelectItem value="parent">Foresatt</SelectItem><SelectItem value="match_registrar">Kampregistrator</SelectItem></SelectContent></Select></div> : <div className="hidden rounded-2xl border border-white/20 bg-black/10 px-4 py-3 text-right sm:block"><p className="text-xs font-bold uppercase tracking-wider text-red-100">{data.currentUser ? roleLabel(data.currentUser.role) : "Sesong"}</p><p className="font-black">{data.currentUser?.name ?? "J12 · 2026/27"}</p></div>}
              <Button aria-label="Logg ut" title="Logg ut" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white" size="icon" variant="outline" onClick={() => void signOut()}><LogOut /></Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-4 max-w-6xl px-3 sm:px-6">
        {actualIsAdmin && <div className="mb-4 rounded-2xl border bg-white p-3 shadow-sm sm:hidden"><Field label="Se løsningen som" htmlFor="mobile-role-preview" className="!mt-0"><Select value={previewRole} onValueChange={(value) => setPreviewRole(value as AppRole)}><SelectTrigger id="mobile-role-preview"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Administrator</SelectItem><SelectItem value="parent">Foresatt</SelectItem><SelectItem value="match_registrar">Kampregistrator</SelectItem></SelectContent></Select></Field></div>}
        {error && <ErrorState message={error} onRetry={() => void refresh(true)} />}
        {actualIsAdmin && previewRole !== "admin" && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-sky-300 bg-sky-50 p-3 text-sm text-sky-950"><div><p className="font-bold">Forhåndsvisning: {roleLabel(previewRole)}</p><p className="mt-0.5">Du ser menyene og valgene slik denne rollen gjør. En virkelig kampregistrator ser bare kampene hen er tildelt.</p></div><Button size="sm" variant="outline" onClick={() => setPreviewRole("admin")}>Tilbake til administrator</Button></div>}
        <Tabs value={isAdmin ? activeTab : "matches"} onValueChange={setActiveTab} className="gap-5">
          <TabsList className="flex !h-auto min-h-[60px] w-full overflow-x-auto rounded-2xl border bg-white p-1.5 shadow-sm">
            {isAdmin && <NavTab value="overview" icon={BarChart3} label="Oversikt" />}
            {isAdmin && <NavTab value="training" icon={Dumbbell} label="Trening" />}
            <NavTab value="matches" icon={Trophy} label="Kamper" />
            {isAdmin && <NavTab value="players" icon={Users} label="Spillere" />}
            {isAdmin && <NavTab value="stats" icon={CalendarDays} label="Statistikk" />}
            {isAdmin && <NavTab value="users" icon={UserCog} label="Brukere" />}
          </TabsList>

          {isAdmin && <TabsContent value="overview"><Overview data={data} loading={loading} onNavigate={setActiveTab} /></TabsContent>}
          {isAdmin && <TabsContent value="training">
            <TrainingWorkspace data={data} loading={loading} saving={saving} runAction={runAction} />
          </TabsContent>}
          <TabsContent value="matches">
            <MatchSection
              data={data}
              loading={loading}
              onAdd={() => { setReturnToCupId(null); setEditingMatch(null); setMatchFormOpen(true); }}
              onEdit={(match) => { setReturnToCupId(null); setEditingMatch(match); setMatchFormOpen(true); }}
              onOpen={setActiveMatchId}
              onDelete={(id) => runAction({ action: "deleteMatch", id }, "Kampen er slettet.")}
              onReset={(id) => runAction({ action: "resetMatch", matchId: id }, "Kampen er nullstilt.")}
              onStatus={(id, status) => runAction({ action: "setMatchStatus", matchId: id, status }, status === "planned" ? "Kampen er åpnet igjen." : "Kampen er markert som avlyst.")}
              onAddCup={() => { setEditingCup(null); setCupFormOpen(true); }}
              onOpenCup={setActiveCupId}
              isAdmin={isAdmin}
              canRecordMatch={canRecordMatch}
            />
          </TabsContent>
          {isAdmin && <TabsContent value="players">
            <PlayerSection
              data={data}
              loading={loading}
              onAdd={() => setPlayerOpen(true)}
              onOpen={setSelectedPlayerId}
              onToggle={(player) => runAction({ action: "togglePlayer", playerId: player.id, active: !Boolean(player.active) }, player.active ? "Spilleren er deaktivert." : "Spilleren er aktivert.")}
            />
          </TabsContent>}
          {isAdmin && <TabsContent value="stats"><StatsSection data={data} /></TabsContent>}
          {isAdmin && <TabsContent value="users"><UserSection users={data.appUsers} loginStats={data.userLoginStats} cloudStorage={data.cloudStorage} currentUserId={data.currentUser?.id ?? 0} onAdd={() => { setEditingUser(null); setUserFormOpen(true); }} onEdit={(user) => { setEditingUser(user); setUserFormOpen(true); }} onDelete={(id) => runAction({ action: "deleteUser", id }, "Brukeren er slettet.")} /></TabsContent>}
        </Tabs>
      </div>

      <PlayerDialog
        key={playerOpen ? "player-open" : "player-closed"}
        open={playerOpen}
        saving={saving}
        onOpenChange={setPlayerOpen}
        onSave={async (player) => {
          const ok = await runAction({ action: "addPlayer", ...player }, "Spilleren er lagt til.");
          if (ok) setPlayerOpen(false);
        }}
      />
      <MatchFormDialog
        key={editingMatch?.id ?? (cupMatchContext ? `cup-${cupMatchContext.cup.id}-team-${cupMatchContext.team.id}` : "new-match")}
        open={matchFormOpen}
        saving={saving}
        match={editingMatch}
        matches={data.matches}
        players={activePlayers}
        matchPlayers={data.matchPlayers}
        users={data.appUsers}
        matchRegistrars={data.matchRegistrars}
        cupContext={cupMatchContext}
        cupMatchLinks={data.cupMatchLinks}
        cups={data.cups}
        cupTeams={data.cupTeams}
        cupTeamPlayers={data.cupTeamPlayers}
        playerGuardians={data.playerGuardians}
        onOpenChange={(open) => { setMatchFormOpen(open); if (!open) { setCupMatchContext(null); setReturnToCupId(null); } }}
        onSave={async (payload) => {
          const action = payload.cupId ? "saveCupMatch" : "saveMatch";
          const ok = await runAction({ action, ...payload }, editingMatch ? "Kampen er oppdatert." : "Kampen er lagt til.");
          if (ok) {
            setMatchFormOpen(false);
            setCupMatchContext(null);
            if (returnToCupId) setActiveCupId(returnToCupId);
            setReturnToCupId(null);
          }
        }}
      />
      <CupFormDialog
        key={editingCup?.id ?? "new-cup"}
        open={cupFormOpen}
        saving={saving}
        cup={editingCup}
        teams={data.cupTeams}
        onOpenChange={setCupFormOpen}
        onSave={async (payload) => {
          const ok = await runAction({ action: "saveCup", ...payload }, editingCup ? "Cupen er oppdatert." : "Cupen er opprettet.");
          if (ok) setCupFormOpen(false);
        }}
      />
      {activeCupId && data.cups.some((cup) => cup.id === activeCupId) && <CupWorkspaceDialog
        key={activeCupId}
        open
        saving={saving}
        isAdmin={isAdmin}
        cup={data.cups.find((cup) => cup.id === activeCupId)!}
        data={data}
        canRecordMatch={canRecordMatch}
        onOpenChange={(open) => { if (!open) setActiveCupId(null); }}
        onEditCup={(cup) => { setEditingCup(cup); setCupFormOpen(true); }}
        onAddMatch={(cup, team) => { setReturnToCupId(cup.id); setActiveCupId(null); setEditingMatch(null); setCupMatchContext({ cup, team }); setMatchFormOpen(true); }}
        onEditMatch={(match) => { setReturnToCupId(activeCupId); setActiveCupId(null); setEditingMatch(match); setCupMatchContext(null); setMatchFormOpen(true); }}
        onOpenMatch={setActiveMatchId}
        onDeleteMatch={(id) => runAction({ action: "deleteMatch", id }, "Kampen er slettet.")}
        onResetMatch={(id) => runAction({ action: "resetMatch", matchId: id }, "Kampen er nullstilt.")}
        onStatus={(id, status) => runAction({ action: "setMatchStatus", matchId: id, status }, status === "planned" ? "Kampen er åpnet igjen." : "Kampen er markert som avlyst.")}
        onSaveRosters={(assignments) => runAction({ action: "saveCupRosters", cupId: activeCupId, assignments }, "Lagfordelingen er lagret.")}
        onDeleteCup={async () => {
          const ok = await runAction({ action: "deleteCup", cupId: activeCupId }, "Cupen er slettet.");
          if (ok) setActiveCupId(null);
        }}
      />}
      {selectedPlayerId && <PlayerProfileDialog player={data.players.find((player) => player.id === selectedPlayerId) ?? null} data={data} open={Boolean(selectedPlayerId)} onOpenChange={(open) => { if (!open) setSelectedPlayerId(null); }} />}
      <UserDialog
        key={editingUser?.id ?? "new-user"}
        open={userFormOpen}
        saving={saving}
        user={editingUser}
        onOpenChange={setUserFormOpen}
        onSave={async (payload) => {
          const ok = await runAction({ action: "saveUser", ...payload }, editingUser ? "Brukeren er oppdatert." : "Brukeren er forhåndsgodkjent.");
          if (ok) setUserFormOpen(false);
        }}
      />
      {activeMatch && (
        <MatchWorkspace
          key={activeMatch.id}
          open={Boolean(activeMatch)}
          saving={saving}
          match={{ ...activeMatch, internalMatch: data.matchPlayers.some((entry) => entry.matchId === activeMatch.id && entry.teamSide === "opponent") }}
          players={data.players}
          roster={data.matchPlayers.filter((entry) => entry.matchId === activeMatch.id)}
          events={visibleMatchEvents.filter((event) => event.matchId === activeMatch.id)}
          substitutions={visibleMatchSubstitutions.filter((entry) => entry.matchId === activeMatch.id)}
          comments={data.matchComments.filter((entry) => entry.matchId === activeMatch.id)}
          canRecord={canRecordMatch(activeMatch.id) && activeMatch.status !== "completed" && activeMatch.status !== "cancelled"}
          showPositionStats={isAdmin}
          onOpenChange={(open) => { if (!open) setActiveMatchId(null); }}
          onSave={(payload) => runAction({ action: "saveMatchNotes", matchId: activeMatch.id, notes: payload.notes }, "Kampnotatet er oppdatert.")}
          onClock={(clockMode, elapsedSeconds, periodElapsedSeconds, clockStartedAt) => runAction({ action: "setMatchClock", matchId: activeMatch.id, clockMode, elapsedSeconds, periodElapsedSeconds, clockStartedAt }, clockMode === "finish_period" ? "Første omgang er avsluttet." : clockMode === "start_second" ? "Andre omgang er startet." : clockMode === "pause" ? "Kampklokken er pauset." : clockMode === "reset" ? "Kampklokken er nullstilt." : "Kampklokken er startet.")}
          onEvent={(side, playerId, eventType, matchSecond, period, periodSecond) => runAction({ action: "addEvent", matchId: activeMatch.id, side, playerId, eventType, matchSecond, period, periodSecond }, side === "opponent" && eventType === "penalty_miss" ? "Straffebom og strafferedning registrert." : eventInfo[eventType].label + " registrert.")}
          onDeleteEvent={(eventId) => runAction({ action: "deleteEvent", eventId }, "Hendelsen er angret.")}
          onSetEventAnnulled={(eventId, annulled) => runAction({ action: "setEventAnnulled", eventId, annulled }, annulled ? "Målet er annullert." : "Målet er gjenopprettet.")}
          onChangeGoalScorer={(eventId, playerId) => runAction({ action: "changeGoalScorer", eventId, playerId }, "Målscoreren er endret.")}
          onSubstitution={(playerInId, playerOutId, matchSecond, period, periodSecond) => runAction({ action: "addSubstitution", matchId: activeMatch.id, playerInId, playerOutId, matchSecond, period, periodSecond }, "Byttet er registrert.")}
          onSwapPlayers={(playerOutId, playerInId, matchSecond, period, periodSecond) => runAction({ action: "swapPlayers", matchId: activeMatch.id, playerOutId, playerInId, matchSecond, period, periodSecond }, "Posisjonsbyttet er registrert.")}
          onDeleteSubstitution={(id) => runAction({ action: "deleteSubstitution", id }, "Det siste byttet er angret.")}
          onAddComment={(body, visibility) => runAction({ action: "addMatchComment", matchId: activeMatch.id, body, visibility }, visibility === "public" ? "Kommentaren er publisert til foresatte." : "Det interne notatet er lagret.")}
          onDeleteComment={(id) => runAction({ action: "deleteMatchComment", id }, "Kommentaren er slettet.")}
          onComplete={(elapsedSeconds, periodElapsedSeconds) => runAction({ action: "setMatchStatus", matchId: activeMatch.id, status: "completed", elapsedSeconds, periodElapsedSeconds }, "Kampen er avsluttet og låst.")}
        />
      )}
    </main>
  );
}

function AuthLoading() {
  return <main className="grid min-h-screen place-items-center bg-gradient-to-br from-[#8f1118] via-[#b72224] to-[#d7372d] p-5 text-white"><div className="text-center"><RefreshCw className="mx-auto size-8 animate-spin" /><p className="mt-3 font-semibold">Åpner sesongdagboken …</p></div></main>;
}

function LoginScreen({ onAuthenticated }: { onAuthenticated: (session: AuthSessionPayload) => Promise<void> }) {
  type LoginMode = "login" | "register" | "forgot" | "recovery";
  const callback = useRef(readAuthCallback()).current;
  const [mode, setMode] = useState<LoginMode>(callback?.type === "recovery" ? "recovery" : "login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [loginError, setLoginError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setLoginError("");
    setMessage("");
    try {
      if (mode === "forgot") {
        if (!identifier.includes("@")) throw new Error("Skriv inn e-postadressen som er registrert på deg.");
        await requestPasswordReset(identifier);
        setMessage("Vi har sendt en lenke for å velge nytt passord. Sjekk også søppelpost.");
        return;
      }
      if (mode === "recovery") {
        if (!callback) throw new Error("Lenken for å endre passord er ugyldig eller utløpt.");
        if (password !== confirmPassword) throw new Error("Passordene er ikke like.");
        await updatePassword(callback.session.accessToken, password);
        clearAuthCallback();
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setMessage("Passordet er endret. Du kan nå logge inn.");
        return;
      }
      const session = mode === "login" ? await signIn(identifier, password) : await signUp(identifier, password);
      if (session) {
        await onAuthenticated(session);
        return;
      }
      setMessage("Kontoen er opprettet. Bekreft e-posten hvis du blir bedt om det, og logg deretter inn.");
      setMode("login");
      setPassword("");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Kunne ikke logge inn.";
      setLoginError(errorMessage === "Invalid login credentials" ? "Feil e-postadresse eller passord." : errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="min-h-screen bg-gradient-to-br from-[#7b0e14] via-[#b72224] to-[#dc3b31] px-4 py-8 sm:grid sm:place-items-center sm:py-12">
    <Toaster position="top-center" />
    <section className="mx-auto w-full max-w-md overflow-hidden rounded-[2rem] border border-white/25 bg-white shadow-2xl">
      <div className="bg-gradient-to-br from-[#8f1118] to-[#c82a29] px-6 py-7 text-white">
        <div className="flex items-center gap-4"><img className="size-20 shrink-0 rounded-full bg-white object-cover shadow-lg ring-4 ring-white/20" src="./sthk-logo.jpg" alt="Stokmarknes Håndballklubb" width={80} height={80} /><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-red-100">Stokmarknes Håndballklubb</p><h1 className="mt-1 text-3xl font-black leading-tight">Sesongdagbok</h1><p className="mt-1 text-lg font-bold text-red-100">STHK 2015</p></div></div>
      </div>
      <form className="p-6" onSubmit={submit}>
        <div><h2 className="text-2xl font-black">{mode === "login" ? "Logg inn" : mode === "register" ? "Opprett passord" : mode === "forgot" ? "Glemt passord" : "Velg nytt passord"}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{mode === "login" ? "Bruk e-postadressen som er registrert på deg." : mode === "register" ? "Bruk e-postadressen som er registrert på deg. Dette virker bare når en administrator har lagt deg til i den godkjente brukerlisten." : mode === "forgot" ? "Skriv inn e-postadressen din, så sender vi en sikker lenke for å velge nytt passord." : "Skriv inn det nye passordet du vil bruke."}</p></div>
        {message && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">{message}</div>}
        {loginError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-900">{loginError}</div>}
        {mode !== "recovery" && <Field label="E-postadresse" htmlFor="login-identifier"><Input id="login-identifier" autoComplete="username" autoFocus inputMode="email" type="email" required value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="navn@eksempel.no" /></Field>}
        {mode !== "forgot" && <Field label={mode === "login" ? "Passord" : mode === "recovery" ? "Nytt passord" : "Velg passord"} htmlFor="login-password"><Input id="login-password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minst 8 tegn" /></Field>}
        {mode === "recovery" && <Field label="Gjenta nytt passord" htmlFor="confirm-password"><Input id="confirm-password" autoComplete="new-password" minLength={8} required type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Skriv passordet én gang til" /></Field>}
        <Button className="mt-6 min-h-12 w-full text-base" disabled={submitting || (mode !== "recovery" && !identifier.trim()) || (mode !== "forgot" && password.length < 8) || (mode === "recovery" && confirmPassword.length < 8)} type="submit">{submitting ? <RefreshCw className="animate-spin" /> : mode === "login" ? <LogIn /> : <KeyRound />}{submitting ? "Vent litt …" : mode === "login" ? "Logg inn" : mode === "register" ? "Opprett passord" : mode === "forgot" ? "Send lenke" : "Lagre nytt passord"}</Button>
        {mode === "login" ? <><button type="button" className="mt-4 min-h-11 w-full rounded-xl text-sm font-bold text-primary hover:bg-red-50" onClick={() => { setMode("register"); setLoginError(""); setMessage(""); setPassword(""); }}>Første gang? Opprett passord</button><button type="button" className="min-h-11 w-full rounded-xl text-sm font-bold text-primary hover:bg-red-50" onClick={() => { setMode("forgot"); setLoginError(""); setMessage(""); setPassword(""); }}>Glemt passord?</button></> : <button type="button" className="mt-4 min-h-11 w-full rounded-xl text-sm font-bold text-primary hover:bg-red-50" onClick={() => { if (mode === "recovery") clearAuthCallback(); setMode("login"); setLoginError(""); setMessage(""); setPassword(""); setConfirmPassword(""); }}>Tilbake til innlogging</button>}
        <p className="mt-4 border-t pt-4 text-center text-xs leading-5 text-muted-foreground">Håndballdagboken har en egen innlogging og er helt adskilt fra treningsdagboken. Bare forhåndsgodkjente brukere får tilgang.</p>
      </form>
    </section>
  </main>;
}

function NavTab({ value, icon: Icon, label }: { value: string; icon: LucideIcon; label: string }) {
  return <TabsTrigger value={value} className="h-14 min-w-[88px] flex-1 flex-col gap-1 rounded-xl text-[11px] sm:h-11 sm:flex-row sm:text-sm"><Icon className="size-4" /><span>{label}</span></TabsTrigger>;
}

function Overview({ data, loading, onNavigate }: { data: SeasonData; loading: boolean; onNavigate: (tab: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const nextTraining = [...data.trainings].filter((item) => item.date >= today && item.status === "planned").sort((a, b) => a.date.localeCompare(b.date))[0];
  const nextMatch = [...data.matches].filter((item) => item.date >= today && (item.status === "planned" || item.status === "live")).sort((a, b) => a.date.localeCompare(b.date))[0];
  const completedTrainings = data.trainings.filter((item) => item.status === "completed").length;
  const plannedTrainings = data.trainings.filter((item) => item.status === "planned").length;
  const completedMatches = data.matches.filter((item) => item.status === "completed").length;
  const plannedMatches = data.matches.filter((item) => item.status === "planned" || item.status === "live").length;
  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Users} label="Aktive spillere" value={String(data.players.filter((player) => Boolean(player.active)).length)} tone="blue" />
        <StatCard icon={Dumbbell} label={`${plannedTrainings} planlagt`} value={`${completedTrainings} gjennomført`} tone="orange" />
        <StatCard icon={Trophy} label={`${plannedMatches} planlagt`} value={`${completedMatches} gjennomført`} tone="green" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <NextCard icon={Dumbbell} eyebrow="Neste trening" item={nextTraining ? `${formatDate(nextTraining.date)}${nextTraining.startTime ? ` kl. ${nextTraining.startTime}` : ""}` : "Ingen trening planlagt"} detail={nextTraining ? `${nextTraining.title || "Lagstrening"}${nextTraining.theme ? ` · ${nextTraining.theme}` : ""}` : "Legg inn treninger når planen er klar."} action="Se treninger" onClick={() => onNavigate("training")} />
        <NextCard icon={Trophy} eyebrow="Neste kamp" item={nextMatch ? fixtureLabel(nextMatch) : "Ingen kamp planlagt"} detail={nextMatch ? `${formatDate(nextMatch.date)}${nextMatch.startTime ? ` kl. ${nextMatch.startTime}` : ""}` : "Legg inn seriekamper og turneringer."} action="Se kamper" onClick={() => onNavigate("matches")} />
      </div>
      {!loading && data.players.length === 0 && (
        <div className="rounded-3xl border border-dashed bg-white p-6 text-center"><UserRound className="mx-auto size-8 text-slate-400" /><h2 className="mt-3 text-lg font-bold">Start med spillerregisteret</h2><p className="mt-1 text-sm text-muted-foreground">Når spillerne er lagt inn, kan de velges på treninger og kamper.</p><Button className="mt-4" onClick={() => onNavigate("players")}>Legg inn spillere</Button></div>
      )}
    </section>
  );
}

function NextCard({ icon: Icon, eyebrow, item, detail, action, onClick }: { icon: LucideIcon; eyebrow: string; item: string; detail: string; action: string; onClick: () => void }) {
  return <article className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary text-primary"><Icon className="size-5" /></span><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</p><h2 className="mt-1 break-words text-lg font-bold leading-snug">{item}</h2><p className="mt-1 text-sm text-muted-foreground">{detail}</p><Button className="mt-4" size="sm" variant="outline" onClick={onClick}>{action}</Button></div></div></article>;
}

function MatchSection({ data, loading, onAdd, onEdit, onOpen, onDelete, onReset, onStatus, onAddCup, onOpenCup, isAdmin, canRecordMatch }: { data: SeasonData; loading: boolean; onAdd: () => void; onEdit: (match: Match) => void; onOpen: (id: number) => void; onDelete: (id: number) => Promise<boolean>; onReset: (id: number) => Promise<boolean>; onStatus: (id: number, status: "planned" | "cancelled") => Promise<boolean>; onAddCup: () => void; onOpenCup: (id: number) => void; isAdmin: boolean; canRecordMatch: (matchId: number) => boolean }) {
  const [matchType, setMatchType] = useState<MatchType>("league");
  const completed = data.matches.filter((match) => match.status === "completed").length;
  const planned = data.matches.filter((match) => match.status === "planned" || match.status === "live").length;
  const matchesByType = (type: MatchType) => data.matches.filter((match) => (match.matchType || "league") === type);
  const typeCounts = { league: matchesByType("league").length, cup: matchesByType("cup").length, friendly: matchesByType("friendly").length };
  const cardProps = { data, onEdit, onOpen, onDelete, onReset, onStatus, isAdmin, canRecordMatch };
  return <SectionCard eyebrow="Serie, cup og vennskapskamper" title="Kamper" count={`${completed} gjennomført · ${planned} planlagt`} actionLabel={isAdmin ? "Ny kamp" : undefined} onAction={isAdmin ? onAdd : undefined}>
    {loading ? <LoadingCards /> : data.matches.length === 0 ? <EmptyState icon={Trophy} title="Ingen kamper lagt inn" text="Legg inn kampene på forhånd og fyll ut hendelser underveis eller etterpå." /> : <Tabs value={matchType} onValueChange={(value) => setMatchType(value as MatchType)}>
      <TabsList className="grid min-h-14 w-full grid-cols-3 rounded-2xl bg-slate-100 p-1"><TabsTrigger className="min-h-12 rounded-xl" value="league">Serie <span className="ml-1 text-xs opacity-70">{typeCounts.league}</span></TabsTrigger><TabsTrigger className="min-h-12 rounded-xl" value="cup">Cup <span className="ml-1 text-xs opacity-70">{typeCounts.cup}</span></TabsTrigger><TabsTrigger className="min-h-12 rounded-xl" value="friendly">Vennskap <span className="ml-1 text-xs opacity-70">{typeCounts.friendly}</span></TabsTrigger></TabsList>
      <TabsContent className="mt-2" value="league"><MonthMatchTabs matches={matchesByType("league")} emptyText="Ingen seriekamper." {...cardProps} /></TabsContent>
      <TabsContent className="mt-2" value="cup"><CupOverview data={data} matches={matchesByType("cup")} isAdmin={isAdmin} onAddCup={onAddCup} onOpenCup={onOpenCup} actions={cardProps} /></TabsContent>
      <TabsContent className="mt-2" value="friendly"><MonthMatchTabs matches={matchesByType("friendly")} emptyText="Ingen vennskapskamper." {...cardProps} /></TabsContent>
    </Tabs>}
  </SectionCard>;
}

function CupOverview({ data, matches, isAdmin, onAddCup, onOpenCup, actions }: { data: SeasonData; matches: Match[]; isAdmin: boolean; onAddCup: () => void; onOpenCup: (id: number) => void; actions: MatchListActions }) {
  const linkedIds = new Set(data.cupMatchLinks.map((link) => link.matchId));
  const legacyMatches = matches.filter((match) => !linkedIds.has(match.id));
  return <div className="space-y-4">
    {isAdmin && <div className="flex justify-end"><Button onClick={onAddCup}><Plus /> Ny cup</Button></div>}
    {data.cups.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Ingen cuper er opprettet ennå.</p> : <div className="grid gap-3 lg:grid-cols-2">{data.cups.map((cup) => {
      const teams = data.cupTeams.filter((team) => team.cupId === cup.id);
      const links = data.c…12268 tokens truncated…edHistory.map(({ entry, match }) => {
    const events = data.matchEvents.filter((event) => event.matchId === match.id && event.playerId === player.id && !event.annulled);
    return { entry, match, seconds: playerSecondsForMatch(player.id, match, data.matchPlayers.filter((item) => item.matchId === match.id), data.matchSubstitutions.filter((item) => item.matchId === match.id)), goals: events.filter((event) => event.type === "goal_open" || event.type === "goal_penalty").length, saves: events.filter((event) => event.type === "save_open" || event.type === "save_penalty").length, twoMinutes: events.filter((event) => event.type === "two_min").length };
  });
  const recentForm = matchRows.slice(0, 5).reverse();
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[94dvh] overflow-y-auto p-0 sm:max-w-5xl"><DialogHeader className="sr-only"><DialogTitle>{player.name}</DialogTitle><DialogDescription>Spillerprofil med sesongdata.</DialogDescription></DialogHeader>
    <div className="overflow-hidden rounded-t-lg bg-gradient-to-r from-[#a3131a] via-[#d1262f] to-[#f59e0b] p-5 text-white sm:p-7"><div className="flex items-center gap-4"><span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-white/95 text-2xl font-black text-primary shadow-lg">{player.jerseyNumber ? `#${player.jerseyNumber}` : "–"}</span><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.2em] text-red-100">{primaryPosition ? positionLabels[primaryPosition.position] : "Spiller"}</p><h2 className="truncate text-2xl font-black sm:text-3xl">{player.name}</h2><p className="mt-1 text-sm text-white/85">STHK 2015 · {player.active ? "Aktiv spiller" : "Inaktiv spiller"}</p></div></div></div>
    <div className="space-y-5 p-4 sm:p-6">
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border bg-slate-200 sm:grid-cols-6"><FplProfileStat label="Kamper" value={completedHistory.length} /><FplProfileStat label="Starter" value={completedHistory.filter(({ entry }) => Boolean(entry.starter)).length} /><FplProfileStat label="Minutter" value={Math.floor(totalSeconds / 60)} /><FplProfileStat label="Mål" value={totalGoals} /><FplProfileStat label="Redninger" value={totalSaves} /><FplProfileStat label="Trening" value={`${trainingRate}%`} /></div>
      <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border bg-white p-4"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Siste kamper</p><h3 className="mt-1 font-black">Form uten poeng</h3></div><span className="text-xs text-muted-foreground">Tid · mål/redninger</span></div>{recentForm.length ? <div className="mt-4 grid grid-cols-5 gap-1.5">{recentForm.map((row) => <div key={row.match.id} className="min-w-0 rounded-xl bg-slate-50 p-2 text-center"><p className="truncate text-[10px] font-bold text-muted-foreground">{shortPlayerName(row.match.opponent)}</p><p className="mt-1 text-sm font-black">{Math.floor(row.seconds / 60)}m</p><p className="text-[10px] text-muted-foreground">{row.goals}M{row.saves ? ` · ${row.saves}R` : ""}</p></div>)}</div> : <p className="mt-4 text-sm text-muted-foreground">Ingen gjennomførte kamper ennå.</p>}</section><section className="rounded-2xl border bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-primary">Neste kamper</p><h3 className="mt-1 font-black">Kampprogram</h3>{upcomingHistory.length ? <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{upcomingHistory.slice(0, 5).map(({ entry, match }) => <div key={match.id} className="min-w-32 rounded-xl bg-red-50 p-3"><p className="text-[10px] font-bold uppercase text-primary">{formatDate(match.date)}</p><p className="mt-1 truncate text-sm font-black">{match.opponent}</p><p className="mt-1 text-xs text-muted-foreground">{match.startTime || "Tid ikke satt"} · {entry.starter ? "Start" : "Benk"}</p></div>)}</div> : <p className="mt-4 text-sm text-muted-foreground">Ingen planlagte kamper i laguttaket.</p>}</section></div>
      <Tabs defaultValue="history"><TabsList className="grid w-full grid-cols-3"><TabsTrigger value="history">Historikk</TabsTrigger><TabsTrigger value="positions">Posisjoner</TabsTrigger><TabsTrigger value="profile">Profil</TabsTrigger></TabsList><TabsContent value="history" className="mt-3"><div className="overflow-x-auto rounded-2xl border"><Table className="min-w-[760px]"><TableHeader><TableRow><TableHead>Dato</TableHead><TableHead>Motstander</TableHead><TableHead className="text-center">Start</TableHead><TableHead className="text-center">Tid</TableHead><TableHead className="text-center">Mål</TableHead><TableHead className="text-center">Redn.</TableHead><TableHead className="text-center">2 min</TableHead><TableHead className="text-center">Resultat</TableHead></TableRow></TableHeader><TableBody>{matchRows.map((row) => <TableRow key={row.match.id}><TableCell className="whitespace-nowrap">{formatDate(row.match.date)}</TableCell><TableCell className="font-semibold">{row.match.opponent}</TableCell><TableCell className="text-center">{row.entry.starter ? "Ja" : "Nei"}</TableCell><TableCell className="text-center font-bold">{formatDetailedPlayingTime(row.seconds)}</TableCell><TableCell className="text-center">{row.goals}</TableCell><TableCell className="text-center">{row.saves}</TableCell><TableCell className="text-center">{row.twoMinutes}</TableCell><TableCell className="whitespace-nowrap text-center font-bold">{displayScore(row.match)}</TableCell></TableRow>)}</TableBody></Table></div></TabsContent><TabsContent value="positions" className="mt-3"><div className="grid gap-3 sm:grid-cols-2">{positions.map((position, index) => <article key={position.position} className="rounded-2xl border bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">{index === 0 ? "Mest brukt" : index === 1 ? "Nest mest brukt" : "Posisjon"}</p><p className="mt-1 font-black">{positionLabels[position.position]}</p></div><span className="text-xl font-black">{totalSeconds ? Math.round((position.seconds / totalSeconds) * 100) : 0}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-red-100"><div className="h-full rounded-full bg-primary" style={{ width: `${totalSeconds ? Math.max(3, (position.seconds / totalSeconds) * 100) : 0}%` }} /></div><p className="mt-2 text-sm text-muted-foreground">{formatDetailedPlayingTime(position.seconds)} · {position.stints} {position.stints === 1 ? "periode" : "perioder"}</p></article>)}</div></TabsContent><TabsContent value="profile" className="mt-3"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Draktinformasjon</p><p className="mt-2 font-semibold">Drakt {player.shirtSize || "–"} · Shorts {player.shortsSize || "–"}</p></div><div className="rounded-2xl border bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sesong</p><p className="mt-2 font-semibold">{attendedTrainings}/{completedTrainings.length} treninger · {captainCount} som kaptein</p></div></div></TabsContent></Tabs>
    </div>
  </DialogContent></Dialog>;
}

function FplProfileStat({ label, value }: { label: string; value: number | string }) {
  return <div className="bg-white p-3 text-center"><p className="text-xl font-black text-slate-950">{value}</p><p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p></div>;
}

function LegacyPlayerProfileDialog({ player, data, open, onOpenChange }: { player: Player | null; data: SeasonData; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!player) return null;
  const completedTrainingIds = new Set(data.trainings.filter((training) => training.status === "completed").map((training) => training.id));
  const attendedTrainings = data.attendance.filter((entry) => entry.playerId === player.id && completedTrainingIds.has(entry.trainingId)).length;
  const matchHistory = data.matchPlayers.filter((entry) => entry.playerId === player.id).map((entry) => ({ entry, match: data.matches.find((match) => match.id === entry.matchId) })).filter((item): item is { entry: MatchPlayer; match: Match } => Boolean(item.match)).sort((a, b) => b.match.date.localeCompare(a.match.date) || b.match.startTime.localeCompare(a.match.startTime));
  const completedHistory = matchHistory.filter(({ match }) => match.status === "completed");
  const completedIds = new Set(completedHistory.map(({ match }) => match.id));
  const playerEvents = data.matchEvents.filter((event) => event.playerId === player.id && completedIds.has(event.matchId));
  const totalGoals = playerEvents.filter((event) => !event.annulled && (event.type === "goal_open" || event.type === "goal_penalty")).length;
  const captainCount = completedHistory.filter(({ entry }) => Boolean(entry.captain)).length;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-xl bg-primary text-lg font-black text-primary-foreground">{player.jerseyNumber ? `#${player.jerseyNumber}` : "–"}</span><span>{player.name}</span></DialogTitle><DialogDescription>Spillerinformasjon og statistikk fra gjennomførte aktiviteter.</DialogDescription></DialogHeader><div className="grid gap-3 py-4 sm:grid-cols-2"><div className="rounded-2xl border bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Draktinformasjon</p><p className="mt-2 font-semibold">Drakt {player.shirtSize || "–"} · Shorts {player.shortsSize || "–"}</p></div><div className="rounded-2xl border bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</p><p className="mt-2 font-semibold">{player.active ? "Aktiv spiller" : "Inaktiv spiller"}</p></div></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><ProfileStat label="Treninger" value={attendedTrainings} /><ProfileStat label="Kamper" value={completedHistory.length} /><ProfileStat label="Mål" value={totalGoals} /><ProfileStat label="Kaptein" value={captainCount} /></div><section className="mt-5"><h3 className="font-bold">Kamper og kampstatistikk</h3>{matchHistory.length === 0 ? <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Spilleren er ikke tatt ut til noen kamper ennå.</p> : <div className="mt-3 space-y-3">{matchHistory.map(({ entry, match }) => { const events = data.matchEvents.filter((event) => event.matchId === match.id && event.playerId === player.id); const goals = events.filter((event) => !event.annulled && (event.type === "goal_open" || event.type === "goal_penalty")).length; const penaltyGoals = events.filter((event) => !event.annulled && event.type === "goal_penalty").length; const misses = events.filter((event) => !event.annulled && event.type === "penalty_miss").length; const saves = events.filter((event) => !event.annulled && (event.type === "save_open" || event.type === "save_penalty")).length; const yellow = events.some((event) => !event.annulled && event.type === "yellow"); const twoMinutes = events.filter((event) => !event.annulled && event.type === "two_min").length; const red = events.some((event) => !event.annulled && event.type === "red"); const seconds = playerSecondsForMatch(player.id, match, data.matchPlayers.filter((item) => item.matchId === match.id), data.matchSubstitutions.filter((item) => item.matchId === match.id)); return <article key={match.id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-semibold text-primary">{formatDate(match.date)} · {matchTypeLabel(match.matchType)}</p><p className="mt-1 font-bold">{fixtureLabel(match)}</p></div><div className="flex items-center gap-2">{entry.captain && <Badge className="bg-amber-100 text-amber-900"><Crown /> Kaptein</Badge>}<StatusBadge status={match.status} /></div></div><div className="mt-3 flex flex-wrap gap-2 text-xs"><Badge variant="outline">{entry.starter ? "Startet" : "Benk"}</Badge><Badge variant="outline">{formatSeasonPlayingTime(seconds)}</Badge><Badge variant="outline">{goals} mål</Badge>{penaltyGoals > 0 && <Badge variant="outline">{penaltyGoals} straffemål</Badge>}{misses > 0 && <Badge variant="outline">{misses} straffebom</Badge>}{saves > 0 && <Badge variant="outline">{saves} redninger</Badge>}{yellow && <Badge className="bg-yellow-100 text-yellow-950">🟨 Gult</Badge>}{twoMinutes > 0 && <Badge className="bg-orange-100 text-orange-900">✌️ {twoMinutes} × 2 min</Badge>}{red && <Badge className="bg-red-100 text-red-900">🟥 Rødt</Badge>}</div></article>; })}</div>}</section></DialogContent></Dialog>;
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-primary p-3 text-center text-primary-foreground"><p className="text-2xl font-black">{value}</p><p className="text-xs text-red-100">{label}</p></div>;
}

function CupFormDialog({ open, saving, cup, teams, onOpenChange, onSave }: { open: boolean; saving: boolean; cup: Cup | null; teams: CupTeam[]; onOpenChange: (open: boolean) => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = useState(cup?.name ?? "");
  const [startDate, setStartDate] = useState(cup?.startDate ?? "");
  const [endDate, setEndDate] = useState(cup?.endDate ?? "");
  const [venue, setVenue] = useState(cup?.venue ?? "");
  const [periodCount, setPeriodCount] = useState(cup?.periodCount ?? 2);
  const [periodMinutes, setPeriodMinutes] = useState(cup?.periodMinutes ?? 18);
  const [teamCount, setTeamCount] = useState(cup ? teams.filter((team) => team.cupId === cup.id).length || 1 : 1);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-xl"><form onSubmit={(event) => { event.preventDefault(); void onSave({ cupId: cup?.id, name, startDate, endDate: endDate || startDate, venue, periodCount, periodMinutes, teamCount }); }}><DialogHeader><DialogTitle>{cup ? "Rediger cup" : "Opprett cup"}</DialogTitle><DialogDescription>Opprett cupen og lagene først. Kampene legges inn når kampoppsettet er klart.</DialogDescription></DialogHeader><div className="grid gap-4 py-5 sm:grid-cols-2"><Field label="Navn på cup" htmlFor="cup-name" className="sm:col-span-2"><Input id="cup-name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Eksempel: Nordkraftcupen 2027" /></Field><Field label="Fra dato" htmlFor="cup-start"><Input id="cup-start" required type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); if (!endDate) setEndDate(event.target.value); }} /></Field><Field label="Til dato" htmlFor="cup-end"><Input id="cup-end" required min={startDate} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></Field><Field label="Sted" htmlFor="cup-venue"><Input id="cup-venue" value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="Hall eller sted" /></Field><Field label="Antall lag" htmlFor="cup-teams"><Input id="cup-teams" min="1" max="6" type="number" inputMode="numeric" value={teamCount} onChange={(event) => setTeamCount(Math.min(6, Math.max(1, Number(event.target.value) || 1)))} /></Field><Field label="Antall omganger" htmlFor="cup-period-count"><Select value={String(periodCount)} onValueChange={(value) => setPeriodCount(Number(value))}><SelectTrigger id="cup-period-count"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1 omgang</SelectItem><SelectItem value="2">2 omganger</SelectItem></SelectContent></Select></Field><Field label="Minutter per omgang" htmlFor="cup-period"><Input id="cup-period" min="1" max="60" type="number" inputMode="numeric" value={periodMinutes} onChange={(event) => setPeriodMinutes(Number(event.target.value) || 18)} /></Field><div className="mt-4 flex items-end text-sm text-muted-foreground">Kampene settes opp med {periodCount} {periodCount === 1 ? "omgang" : "omganger"}.</div></div><DialogFooter><Button disabled={saving || !name.trim() || !startDate || !endDate} type="submit">{saving ? "Lagrer …" : cup ? "Lagre endringer" : "Opprett cup"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function CupWorkspaceDialog({ open, saving, isAdmin, cup, data, canRecordMatch, onOpenChange, onEditCup, onAddMatch, onEditMatch, onOpenMatch, onDeleteMatch, onResetMatch, onStatus, onSaveRosters, onDeleteCup }: { open: boolean; saving: boolean; isAdmin: boolean; cup: Cup; data: SeasonData; canRecordMatch: (matchId: number) => boolean; onOpenChange: (open: boolean) => void; onEditCup: (cup: Cup) => void; onAddMatch: (cup: Cup, team: CupTeam) => void; onEditMatch: (match: Match) => void; onOpenMatch: (id: number) => void; onDeleteMatch: (id: number) => Promise<boolean>; onResetMatch: (id: number) => Promise<boolean>; onStatus: (id: number, status: "planned" | "cancelled") => Promise<boolean>; onSaveRosters: (assignments: Array<{ playerId: number; cupTeamId: number }>) => Promise<boolean>; onDeleteCup: () => Promise<void> }) {
  const teams = data.cupTeams.filter((team) => team.cupId === cup.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const initialAssignments = data.cupTeamPlayers.filter((entry) => entry.cupId === cup.id).reduce<Record<number, number[]>>((result, entry) => ({ ...result, [entry.playerId]: [...(result[entry.playerId] ?? []), entry.cupTeamId] }), {});
  const [assignments, setAssignments] = useState<Record<number, number[]>>(initialAssignments);
  const links = data.cupMatchLinks.filter((link) => link.cupId === cup.id);
  const cupMatches = data.matches.filter((match) => links.some((link) => link.matchId === match.id));
  const actions: MatchListActions = { data, onEdit: onEditMatch, onOpen: onOpenMatch, onDelete: onDeleteMatch, onReset: onResetMatch, onStatus, isAdmin, canRecordMatch };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle>{cup.name}</DialogTitle><DialogDescription>{formatCupDates(cup)}{cup.venue ? ` · ${cup.venue}` : ""} · {cup.periodCount} × {cup.periodMinutes} min</DialogDescription></DialogHeader>{isAdmin && <><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onEditCup(cup)}><Pencil /> Rediger cup</Button><AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="text-destructive"><Trash2 /> Slett cup</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Slett {cup.name}?</AlertDialogTitle><AlertDialogDescription>Cupen, lagene og alle kampene som er lagt inn under cupen slettes. Dette kan ikke angres.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Avbryt</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void onDeleteCup()}>Slett cup</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
    <section className="mt-5 rounded-2xl border bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black">Fordel spillerne på lag</h3><p className="mt-1 text-sm text-muted-foreground">Velg ett eller flere lag per spiller. Ekstra innbyttere kan registreres på begge lag. Endringer overføres automatisk til alle planlagte kamper.</p></div><Button size="sm" disabled={saving} onClick={() => void onSaveRosters(Object.entries(assignments).flatMap(([playerId, teamIds]) => teamIds.map((cupTeamId) => ({ playerId: Number(playerId), cupTeamId }))))}>{saving ? "Lagrer …" : "Lagre lagfordeling"}</Button></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{data.players.filter((player) => Boolean(player.active)).map((player) => { const selectedTeams = assignments[player.id] ?? []; const allTeamsSelected = teams.length > 1 && teams.every((team) => selectedTeams.includes(team.id)); return <div key={player.id} className="rounded-xl border bg-white p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{player.jerseyNumber ? `#${player.jerseyNumber} · ` : ""}{player.name}</p><p className="truncate text-xs text-muted-foreground">{guardianNames(player.id, data)}</p></div><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => setAssignments((current) => { const next = { ...current }; delete next[player.id]; return next; })} className={`min-h-9 rounded-lg border px-3 text-xs font-bold ${selectedTeams.length === 0 ? "border-slate-700 bg-slate-100 text-slate-900" : "bg-white text-muted-foreground"}`}>Ikke med</button>{teams.map((team) => { const selected = selectedTeams.includes(team.id); return <button key={team.id} type="button" aria-pressed={selected} onClick={() => setAssignments((current) => { const currentTeams = current[player.id] ?? []; const nextTeams = selected ? currentTeams.filter((id) => id !== team.id) : [...currentTeams, team.id]; const next = { ...current }; if (nextTeams.length) next[player.id] = nextTeams; else delete next[player.id]; return next; })} className={`min-h-9 rounded-lg border px-3 text-xs font-bold ${selected ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:border-primary"}`}>{team.name}</button>; })}{teams.length > 1 && <button type="button" aria-pressed={allTeamsSelected} onClick={() => setAssignments((current) => ({ ...current, [player.id]: teams.map((team) => team.id) }))} className={`min-h-9 rounded-lg border px-3 text-xs font-bold ${allTeamsSelected ? "border-primary bg-primary text-primary-foreground" : "border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100"}`}>{teams.length === 2 ? "Begge lag" : "Alle lag"}</button>}</div></div>; })}</div></section></>}
    <section className="mt-5"><h3 className="text-lg font-black">Lag og kamper</h3><div className="mt-3 space-y-5">{teams.map((team) => { const teamPlayers = data.cupTeamPlayers.filter((entry) => entry.cupTeamId === team.id).map((entry) => data.players.find((player) => player.id === entry.playerId)).filter(Boolean) as Player[]; const teamMatchIds = new Set(links.filter((link) => link.cupTeamId === team.id).map((link) => link.matchId)); const teamMatches = cupMatches.filter((match) => teamMatchIds.has(match.id)); return <div key={team.id} className="rounded-2xl border p-3 sm:p-4"><div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-black">{team.name}</h4><p className="mt-1 text-sm text-muted-foreground">{teamPlayers.length ? teamPlayers.map((player) => shortPlayerName(player.name)).join(", ") : "Ingen spillere valgt ennå"}</p></div>{isAdmin && <Button size="sm" disabled={!teamPlayers.length} onClick={() => onAddMatch(cup, team)}><Plus /> Legg til kamp</Button>}</div><MatchGrid matches={teamMatches} emptyText="Ingen kamper lagt inn for laget ennå." {...actions} /></div>; })}</div></section>
  </DialogContent></Dialog>;
}

function MatchFormDialog({ open, saving, match, matches, players: allPlayers, matchPlayers, users, matchRegistrars, cupContext, cupMatchLinks, cups, cupTeams, cupTeamPlayers, playerGuardians, onOpenChange, onSave }: { open: boolean; saving: boolean; match: Match | null; matches: Match[]; players: Player[]; matchPlayers: MatchPlayer[]; users: AppUser[]; matchRegistrars: MatchRegistrar[]; cupContext: { cup: Cup; team: CupTeam } | null; cupMatchLinks: CupMatchLink[]; cups: Cup[]; cupTeams: CupTeam[]; cupTeamPlayers: CupTeamPlayer[]; playerGuardians: PlayerGuardian[]; onOpenChange: (open: boolean) => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const matchCupLink = match ? cupMatchLinks.find((link) => link.matchId === match.id) ?? null : null;
  const linkedCup = cupContext?.cup ?? cups.find((cup) => cup.id === matchCupLink?.cupId) ?? null;
  const linkedTeam = cupContext?.team ?? cupTeams.find((team) => team.id === matchCupLink?.cupTeamId) ?? null;
  const linkedTeamPlayerIds = new Set(linkedTeam ? cupTeamPlayers.filter((entry) => entry.cupTeamId === linkedTeam.id).map((entry) => entry.playerId) : []);
  const [date, setDate] = useState(match?.date ?? linkedCup?.startDate ?? "");
  const [startTime, setStartTime] = useState(match?.startTime ?? "");
  const [opponent, setOpponent] = useState(match?.opponent ?? "");
  const [team, setTeam] = useState(match?.team ?? linkedTeam?.name ?? "Stokmarknes");
  const [homeAway, setHomeAway] = useState<"home" | "away">(match?.homeAway ?? "home");
  const [internalMatch, setInternalMatch] = useState(Boolean(match && matchPlayers.some((entry) => entry.matchId === match.id && entry.teamSide === "opponent")));
  const [rosterSide, setRosterSide] = useState<"ours" | "opponent">("ours");
  const [matchType, setMatchType] = useState<MatchType>(linkedCup ? "cup" : match?.matchType ?? "league");
  const [competition, setCompetition] = useState(match?.matchType === "league" ? match.competition : "J12-serien 2026/27");
  const [cupName, setCupName] = useState(linkedCup?.name ?? match?.cupName ?? (match?.matchType === "cup" ? match.competition : ""));
  const [periodMinutes, setPeriodMinutes] = useState(match?.periodMinutes ?? linkedCup?.periodMinutes ?? 20);
  const [venue, setVenue] = useState(match?.venue ?? linkedCup?.venue ?? "");
  const [registrarUserId, setRegistrarUserId] = useState(() => match ? matchRegistrars.find((entry) => entry.matchId === match.id)?.userId ?? 0 : 0);
  const [positionMenuPlayerId, setPositionMenuPlayerId] = useState<number | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>(() => {
    if (!match) return linkedTeam ? cupTeamPlayers.filter((entry) => entry.cupTeamId === linkedTeam.id).map((entry) => ({ playerId: entry.playerId, teamSide: "ours" as const, starter: false, goalkeeper: false, captain: false, position: "bench" as Position })) : [];
    const entries = matchPlayers.filter((entry) => entry.matchId === match.id && (!linkedTeam || linkedTeamPlayerIds.has(entry.playerId)));
    const positions = normalizeMatchPositions(entries);
    return entries.map((entry) => {
      const position = positions.get(entry.playerId) ?? "bench";
      return { playerId: entry.playerId, teamSide: entry.teamSide ?? "ours", position, starter: position !== "bench", goalkeeper: position === "goalkeeper", captain: Boolean(entry.captain) };
    });
  });
  const linkedTeamPlayerSignature = [...linkedTeamPlayerIds].sort((a, b) => a - b).join(",");
  const previousLinkedTeamPlayerIds = useRef(new Set(linkedTeamPlayerIds));
  useEffect(() => {
    if (!linkedTeam) return;
    const previous = previousLinkedTeamPlayerIds.current;
    setRoster((current) => {
      const next = current.filter((entry) => linkedTeamPlayerIds.has(entry.playerId));
      for (const playerId of linkedTeamPlayerIds) {
        if (!previous.has(playerId) && !next.some((entry) => entry.playerId === playerId)) next.push({ playerId, teamSide: "ours", starter: false, goalkeeper: false, captain: false, position: "bench" });
      }
      return next;
    });
    previousLinkedTeamPlayerIds.current = new Set(linkedTeamPlayerIds);
    // Signature tracks the actual player IDs rather than the Set identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedTeamPlayerSignature]);
  function selectPlayer(playerId: number, checked: boolean) {
    setRoster((current) => checked ? current.some((entry) => entry.playerId === playerId) ? current : [...current, { playerId, teamSide: rosterSide, starter: false, goalkeeper: false, captain: false, position: "bench" }] : current.filter((entry) => entry.playerId !== playerId));
  }
  function choosePosition(playerId: number, position: Position) {
    setRoster((current) => {
      const existing = current.find((entry) => entry.playerId === playerId && entry.teamSide === rosterSide);
      const withPlayer = existing ? current : [...current, { playerId, teamSide: rosterSide, starter: false, goalkeeper: false, captain: false, position: "bench" as Position }];
      return withPlayer.map((entry) => {
        if (entry.playerId === playerId && entry.teamSide === rosterSide) return { ...entry, position, starter: position !== "bench", goalkeeper: position === "goalkeeper" };
        if (entry.teamSide === rosterSide && position !== "bench" && entry.position === position) return { ...entry, position: "bench", starter: false, goalkeeper: false };
        return entry;
      });
    });
    setPositionMenuPlayerId(null);
  }
  function chooseCaptain(playerId: number) {
    setRoster((current) => current.map((entry) => entry.teamSide === rosterSide ? { ...entry, captain: entry.playerId === playerId ? !entry.captain : false } : entry));
  }
  const availablePlayerIds = linkedTeam ? linkedTeamPlayerIds : new Set(allPlayers.map((player) => player.id));
  const eligibleGuardianIds = new Set(playerGuardians.filter((entry) => availablePlayerIds.has(entry.playerId)).map((entry) => entry.userId));
  const registrars = users.filter((user) => user.role === "parent" && Boolean(user.active) && (!linkedTeam || eligibleGuardianIds.has(user.id))).sort((a, b) => a.name.localeCompare(b.name, "nb-NO"));
  const players = linkedTeam ? allPlayers.filter((player) => availablePlayerIds.has(player.id)) : allPlayers;
  const cupNames = [...new Set(matches.filter((item) => item.matchType === "cup").map((item) => item.cupName || item.competition).filter(Boolean))];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"><form onSubmit={(event) => { event.preventDefault(); void onSave({ id: match?.id, cupId: linkedCup?.id, cupTeamId: linkedTeam?.id, date, startTime, opponent, team, homeAway, internalMatch: !linkedCup && !linkedTeam && internalMatch, competition, matchType, cupName, periodCount: linkedCup?.periodCount ?? 2, periodMinutes: matchType === "league" ? 20 : periodMinutes, venue, ourScore: match?.ourScore ?? null, opponentScore: match?.opponentScore ?? null, notes: match?.notes ?? "", roster: internalMatch ? roster : roster.map((entry) => ({ ...entry, teamSide: "ours" })), registrarUserId: registrarUserId || null }); }}>
    <DialogHeader><DialogTitle>{match ? "Rediger kamp" : "Ny kamp"}</DialogTitle><DialogDescription>Legg inn kampinformasjon og velg spillerne som skal delta.</DialogDescription></DialogHeader>
    <div className="grid gap-4 py-5 sm:grid-cols-2">
      <Field label="Kamptype" htmlFor="match-type" className="sm:col-span-2"><Select disabled={Boolean(linkedCup)} value={matchType} onValueChange={(value) => setMatchType(value as MatchType)}><SelectTrigger id="match-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="league">Seriekamp</SelectItem>{(Boolean(linkedCup) || match?.matchType === "cup") && <SelectItem value="cup">Cupkamp</SelectItem>}<SelectItem value="friendly">Vennskapskamp</SelectItem></SelectContent></Select>{!linkedCup && !match && <p className="mt-2 text-xs text-muted-foreground">Cupkamper legges inn ved å opprette og åpne cupen i Cup-fanen.</p>}</Field>
      <Field label="Dato" htmlFor="match-date"><Input id="match-date" required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
      <Field label="Starttid" htmlFor="match-time"><Input id="match-time" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></Field>
      <Field label="Vårt lag" htmlFor="match-team"><Input id="match-team" disabled={Boolean(linkedTeam)} value={team} onChange={(event) => setTeam(event.target.value)} placeholder="STHK 2" /></Field>
      <Field label="Motstander" htmlFor="match-opponent"><Input id="match-opponent" required value={opponent} onChange={(event) => setOpponent(event.target.value)} /></Field>{!linkedCup && !linkedTeam && <div className="sm:col-span-2 flex items-start gap-3 rounded-xl border bg-amber-50/60 p-3"><Checkbox id="internal-match" checked={internalMatch} onCheckedChange={(checked) => { const enabled = checked === true; setInternalMatch(enabled); if (!enabled) setRosterSide("ours"); }} /><div><label htmlFor="internal-match" className="cursor-pointer text-sm font-semibold">Intern kamp</label><p className="mt-1 text-xs text-muted-foreground">Kryss av når begge lagene er STHK-lag. Da kan spillerne fordeles på STHK 2 og STHK 3 i samme kamp.</p></div></div>}
      <Field label="Hjemme eller borte" htmlFor="match-home-away"><Select value={homeAway} onValueChange={(value) => setHomeAway(value as "home" | "away")}><SelectTrigger id="match-home-away"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="home">Hjemmekamp</SelectItem><SelectItem value="away">Bortekamp</SelectItem></SelectContent></Select></Field>
      <Field label="Sted" htmlFor="match-venue"><Input id="match-venue" value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="Hall" /></Field>
      {matchType === "league" && <Field label="Serie" htmlFor="match-competition"><Input id="match-competition" value={competition} onChange={(event) => setCompetition(event.target.value)} /></Field>}
      {matchType === "cup" && <Field label="Navn på cup" htmlFor="match-cup"><Input id="match-cup" disabled={Boolean(linkedCup)} list="cup-names" required value={cupName} onChange={(event) => setCupName(event.target.value)} placeholder="Eksempel: Vågan Cup" /><datalist id="cup-names">{cupNames.map((cup) => <option key={cup} value={cup} />)}</datalist></Field>}
      <Field label="Spilletid" htmlFor="match-period-minutes"><div className="flex items-center gap-2"><Input id="match-period-minutes" disabled={matchType === "league" || Boolean(linkedCup)} min="1" max="60" type="number" inputMode="numeric" value={matchType === "league" ? 20 : periodMinutes} onChange={(event) => setPeriodMinutes(Number(event.target.value) || 20)} /><span className="shrink-0 text-sm text-muted-foreground">{linkedCup?.periodCount ?? 2} {linkedCup?.periodCount === 1 ? "omgang" : "omganger"}</span></div>{matchType === "league" && <p className="mt-2 text-xs text-muted-foreground">J12-serien bruker 2 × 20 minutter.</p>}{linkedCup && <p className="mt-2 text-xs text-muted-foreground">Spilletiden styres av cupoppsettet.</p>}</Field>
      <Field label="Kampregistrator" htmlFor="match-registrar" className="sm:col-span-2"><Select value={registrarUserId ? String(registrarUserId) : "none"} onValueChange={(value) => setRegistrarUserId(value === "none" ? 0 : Number(value))}><SelectTrigger id="match-registrar"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ingen valgt</SelectItem>{registrars.map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>)}</SelectContent></Select><p className="mt-2 text-xs text-muted-foreground">{linkedTeam ? "Listen viser foresatte til spillerne på dette cuplaget." : "Velg blant aktive foresatte."} Valgt person får registreringstilgang bare til denne kampen. Administratorer har alltid tilgang.</p></Field>
      <div className="sm:col-span-2"><div className="mb-1 flex items-center justify-between"><p className="text-sm font-semibold">Laguttak, startposisjon og kaptein</p><span className="text-xs text-muted-foreground">{roster.filter((entry) => !internalMatch || entry.teamSide === rosterSide).length} valgt{internalMatch ? ` · ${rosterSide === "ours" ? team : opponent}` : ""}</span></div>{internalMatch && <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => setRosterSide("ours")} className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${rosterSide === "ours" ? "bg-white shadow" : "text-muted-foreground"}`}>{team || "Vårt lag"}</button><button type="button" onClick={() => setRosterSide("opponent")} className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${rosterSide === "opponent" ? "bg-white shadow" : "text-muted-foreground"}`}>{opponent || "Motstander"}</button></div>}<p className="mb-3 text-sm text-muted-foreground">{internalMatch ? `Velg spillerne som skal spille for ${rosterSide === "ours" ? team : opponent}. En spiller kan bare være på ett av lagene.` : "Trykk på spilleren for å velge plass. Kronen markerer kampens kaptein."}</p><div className="overflow-hidden rounded-2xl border"><div className="grid grid-cols-[40px_1fr] bg-slate-50 px-3 py-2 text-xs font-semibold text-muted-foreground"><span>Med</span><span className="grid grid-cols-[1fr_104px_48px] gap-2"><span>Spiller</span><span className="text-center">Startplass</span><span className="text-center">C</span></span></div>{players.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Legg inn spillere i spillerregisteret først.</p> : players.map((player) => { const entry = roster.find((item) => item.playerId === player.id && (!internalMatch || item.teamSide === rosterSide)); const assignedElsewhere = internalMatch && roster.some((item) => item.playerId === player.id && item.teamSide !== rosterSide); const positionLabel = positionOptions.find((option) => option.value === entry?.position)?.label ?? "Velg plass"; return <div key={player.id} className={`grid min-h-14 grid-cols-[40px_1fr] items-center border-t px-3 ${entry ? "bg-red-50/40" : "bg-white"}`}><div className="grid place-items-start"><Checkbox aria-label={`${player.name} er med i laguttaket${assignedElsewhere ? " på det andre laget" : ""}`} checked={Boolean(entry)} disabled={Boolean(assignedElsewhere)} onCheckedChange={(checked) => selectPlayer(player.id, checked === true)} /></div><div className="grid min-w-0 grid-cols-[1fr_104px_48px] items-center gap-2"><Popover open={positionMenuPlayerId === player.id} onOpenChange={(isOpen) => setPositionMenuPlayerId(isOpen ? player.id : null)}><PopoverTrigger asChild><button type="button" className="col-span-2 grid min-h-14 min-w-0 grid-cols-[1fr_104px] items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50" disabled={!entry}><span className="flex min-w-0 items-center gap-2"><span className="w-8 shrink-0 text-xs font-black text-primary">{player.jerseyNumber ? `#${player.jerseyNumber}` : ""}</span><span className="truncate text-sm font-semibold">{player.name}{assignedElsewhere && <span className="ml-2 text-xs font-normal text-muted-foreground">Valgt for {roster.find((item) => item.playerId === player.id)?.teamSide === "ours" ? team : opponent}</span>}</span></span><span className={`rounded-lg px-1.5 py-1.5 text-center text-xs font-bold ${entry?.position === "bench" ? "bg-slate-100 text-slate-700" : entry ? "bg-primary text-primary-foreground" : "bg-slate-50 text-muted-foreground"}`}>{positionLabel}</span></button></PopoverTrigger><PopoverContent className="z-[60] w-72" align="end"><PopoverHeader><PopoverTitle>{player.name}</PopoverTitle><PopoverDescription>Velg startposisjon eller benk.</PopoverDescription></PopoverHeader><div className="mt-3 grid grid-cols-2 gap-2">{positionOptions.map((option) => <button key={option.value} type="button" onClick={() => choosePosition(player.id, option.value)} className={`min-h-11 rounded-xl border px-2 py-2 text-sm font-semibold ${entry?.position === option.value ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:border-primary"}`}>{option.label}</button>)}</div></PopoverContent></Popover><button type="button" aria-label={entry?.captain ? `${player.name} er kaptein` : `Velg ${player.name} som kaptein`} disabled={!entry} onClick={() => chooseCaptain(player.id)} className={`grid size-10 place-items-center rounded-xl border transition disabled:opacity-30 ${entry?.captain ? "border-amber-500 bg-amber-100 text-amber-900" : "bg-white text-slate-400 hover:border-amber-400"}`}><Crown className="size-5" /></button></div></div>; })}</div></div>
    </div>
    <DialogFooter><Button disabled={saving || !date || !opponent.trim() || (matchType === "cup" && !cupName.trim()) || (internalMatch && (!roster.some((entry) => entry.teamSide === "ours") || !roster.some((entry) => entry.teamSide === "opponent")))} type="submit">{saving ? "Lagrer …" : "Lagre kamp"}</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}

function SectionCard({ eyebrow, title, count, actionLabel, onAction, children }: { eyebrow: string; title: string; count: string; actionLabel?: string; onAction?: () => void; children: React.ReactNode }) {
  return <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p><h2 className="mt-1 text-2xl font-bold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{count}</p></div>{actionLabel && onAction && <Button onClick={onAction}><Plus /> {actionLabel}</Button>}</div><div className="mt-6">{children}</div></section>;
}

function Field({ label, htmlFor, className = "", children }: { label: string; htmlFor: string; className?: string; children: React.ReactNode }) {
  return <div className={`mt-4 ${className}`}><label className="mb-2 block text-sm font-semibold" htmlFor={htmlFor}>{label}</label>{children}</div>;
}

function DeleteButton({ label, description, onConfirm }: { label: string; description: string; onConfirm: () => void }) {
  return <AlertDialog><AlertDialogTrigger asChild><Button aria-label={label} size="icon-sm" variant="ghost"><Trash2 /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{label}?</AlertDialogTitle><AlertDialogDescription>{description} Dette kan ikke angres.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Avbryt</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={onConfirm}>Slett</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

function ResetMatchButton({ match, onConfirm }: { match: Match; onConfirm: () => void }) {
  return <AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant="outline" className="border-amber-300 text-amber-900 hover:bg-amber-50"><RefreshCw /> Nullstill</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Nullstill {fixtureLabel(match)}?</AlertDialogTitle><AlertDialogDescription>Resultat, kampklokke, hendelser, bytter, registrert spilletid og kommentarer fjernes. Kampinformasjon, laguttak og kampregistrator beholdes. Dette kan ikke angres.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Avbryt</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={onConfirm}>Ja, nullstill kampen</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

function StatCard({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: "blue" | "orange" | "green" }) {
  const colors = { blue: "bg-red-50 text-primary", orange: "bg-amber-50 text-amber-700", green: "bg-emerald-50 text-emerald-700" };
  return <div className="flex items-center gap-4 rounded-3xl border bg-white p-5 shadow-sm"><span className={`grid size-11 place-items-center rounded-2xl ${colors[tone]}`}><Icon className="size-5" /></span><div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></div>;
}

function StatusBadge({ status, label }: { status: ActivityStatus; label?: string }) {
  const meta: Record<ActivityStatus, { label: string; className: string }> = {
    planned: { label: "Planlagt", className: "bg-slate-100 text-slate-700" },
    live: { label: "Pågår", className: "bg-emerald-100 text-emerald-800" },
    completed: { label: "Gjennomført", className: "bg-emerald-100 text-emerald-800" },
    cancelled: { label: "Avlyst", className: "bg-red-100 text-red-800" },
  };
  return <Badge className={meta[status].className}>{label ?? meta[status].label}</Badge>;
}

function roleLabel(role: AppRole) {
  return role === "admin" ? "Administrator" : role === "parent" ? "Foresatt" : "Kampregistrator";
}

function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <div className="rounded-2xl border border-dashed p-8 text-center"><Icon className="mx-auto size-8 text-slate-400" /><p className="mt-3 font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>;
}

function LoadingCards() {
  return <div className="grid gap-3 sm:grid-cols-2">{[1, 2].map((number) => <div key={number} className="h-32 animate-pulse rounded-2xl bg-slate-100" />)}</div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span>{message}</span><Button size="sm" variant="outline" onClick={onRetry}><RefreshCw /> Prøv igjen</Button></div>;
}

function fixtureLabel(match: Match) {
  return match.homeAway === "away" ? `${match.opponent} – ${match.team}` : `${match.team} – ${match.opponent}`;
}

function matchTypeLabel(matchType: MatchType) {
  return matchType === "cup" ? "Cup" : matchType === "friendly" ? "Vennskapskamp" : "Serie";
}

function displayScore(match: Match) {
  if (match.ourScore === null || match.opponentScore === null) return "";
  return match.homeAway === "away" ? `${match.opponentScore}–${match.ourScore}` : `${match.ourScore}–${match.opponentScore}`;
}

function formatDate(value: string) {
  if (!value) return "Dato ikke satt";
  return new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function formatDateWithWeekday(value: string) {
  if (!value) return "Dato ikke satt";
  return new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function formatCupDates(cup: Cup) {
  if (cup.startDate === cup.endDate) return formatDate(cup.startDate);
  return `${formatDate(cup.startDate)}–${formatDate(cup.endDate)}`;
}

function guardianNames(playerId: number, data: SeasonData) {
  return data.playerGuardians
    .filter((entry) => entry.playerId === playerId)
    .map((entry) => data.appUsers.find((user) => user.id === entry.userId)?.name)
    .filter(Boolean)
    .join(" og ");
}

function shortPlayerName(name: string) {
  if (name === "Martine Eilertsen") return "Martine E";
  if (name === "Martine Sørensen") return "Martine R";
  return name.split(" ")[0];
}

function formatLoginDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "ukjent tidspunkt";
  return new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function normalizeMatchPositions(roster: MatchPlayer[]) {
  const validPositions = new Set<Position>(positionOptions.map((option) => option.value));
  const fallback: Exclude<Position, "bench" | "goalkeeper">[] = ["left_wing", "left_back", "center", "right_back", "right_wing"];
  const used = new Map<string, Set<Exclude<Position, "bench">>>();
  const positions = new Map<number, Position>();
  const fallbackIndices = new Map<string, number>();
  for (const entry of roster) {
    const side = entry.teamSide ?? "ours";
    const sideUsed = used.get(side) ?? new Set<Exclude<Position, "bench">>();
    let fallbackIndex = fallbackIndices.get(side) ?? 0;
    let position: Position = validPositions.has(entry.position) ? entry.position : "bench";
    if (position === "bench" && Boolean(entry.goalkeeper)) position = "goalkeeper";
    if (position === "bench" && Boolean(entry.starter)) {
      while (fallbackIndex < fallback.length && sideUsed.has(fallback[fallbackIndex])) fallbackIndex += 1;
      position = fallback[fallbackIndex] ?? "bench";
      fallbackIndices.set(side, fallbackIndex + 1);
    }
    if (position !== "bench" && sideUsed.has(position)) position = "bench";
    if (position !== "bench") sideUsed.add(position);
    used.set(side, sideUsed);
    positions.set(entry.playerId, position);
  }
  return positions;
}

function playerSecondsForMatch(playerId: number, match: Match, roster: MatchPlayer[], substitutions: MatchSubstitution[]) {
  if (!roster.some((entry) => entry.playerId === playerId)) return 0;
  const position = normalizeMatchPositions(roster).get(playerId) ?? "bench";
  const elapsedSeconds = currentMatchSeconds(match);
  let total = 0;
  let onCourt = position !== "bench";
  let activeSince = 0;
  for (const substitution of [...substitutions].sort((a, b) => a.id - b.id)) {
    if (substitution.swap) continue;
    const at = Math.min(elapsedSeconds, Math.max(0, substitution.matchSecond));
    if (substitution.playerOutId === playerId && onCourt) {
      total += Math.max(0, at - activeSince);
      onCourt = false;
    }
    if (substitution.playerInId === playerId && !onCourt) {
      activeSince = at;
      onCourt = true;
    }
  }
  if (onCourt) total += Math.max(0, elapsedSeconds - activeSince);
  return total;
}

function currentMatchSeconds(match: Match) {
  const stored = Math.max(0, Number(match.elapsedSeconds ?? 0));
  if (!Boolean(match.clockRunning) || !match.clockStartedAt) return stored;
  const startedAt = Date.parse(match.clockStartedAt);
  return Number.isNaN(startedAt) ? stored : stored + Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

function formatSeasonPlayingTime(seconds: number) {
  return `${Math.floor(Math.max(0, seconds) / 60)} min`;
}

function formatDetailedPlayingTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
}
