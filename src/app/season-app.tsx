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
import { applyAction, clearAuthCallback, fetchSnapshot, readAuthCallback, refreshSession, requestPasswordReset, signIn, signOut as supabaseSignOut, signUp, updatePassword, type AuthSessionPayload } from "@/lib/supabase-api";
import { MatchWorkspace } from "./match-workspace";
import { TrainingWorkspace, type Exercise, type TrainingExercise } from "./training-workspace";

type Player = { id: number; name: string; jerseyNumber: number | null; shirtSize: string; shortsSize: string; active: number | boolean; createdAt: string };
type ActivityStatus = "planned" | "live" | "completed" | "cancelled";
type MatchType = "league" | "cup" | "friendly";
type MatchPhase = "pre_match" | "first_half" | "halftime" | "second_half" | "completed";
type AppRole = "admin" | "parent" | "match_registrar";
type AppUser = { id: number; name: string; email: string | null; phone: string; role: AppRole; active: number | boolean; accountUserId: string | null; createdAt: string };
type CurrentUser = { id: number; name: string; email: string | null; role: AppRole };
type Training = { id: number; date: string; startTime: string; durationMinutes: number; title: string; theme: string; plan: string; notes: string; status: Exclude<ActivityStatus, "live">; completedAt: string | null; createdAt: string };
type Attendance = { trainingId: number; playerId: number };
type Position = "goalkeeper" | "right_wing" | "right_back" | "center" | "left_back" | "left_wing" | "bench";
type Match = { id: number; date: string; startTime: string; opponent: string; team: string; homeAway: "home" | "away"; competition: string; matchType: MatchType; cupName: string; venue: string; ourScore: number | null; opponentScore: number | null; periodCount: number; periodMinutes: number; matchPhase: MatchPhase; currentPeriod: number; periodElapsedSeconds: number; clockStartedAt: string | null; elapsedSeconds: number; clockRunning: number | boolean; notes: string; status: ActivityStatus; completedAt: string | null; createdAt: string };
type MatchPlayer = { matchId: number; playerId: number; starter: number | boolean; goalkeeper: number | boolean; captain: number | boolean; position: Position };
type MatchEvent = { id: number; matchId: number; playerId: number | null; side: "ours" | "opponent"; type: EventType; matchSecond: number; period: number; periodSecond: number; createdAt: string };
type MatchSubstitution = { id: number; matchId: number; playerInId: number; playerOutId: number; position: Exclude<Position, "bench">; matchSecond: number; period: number; periodSecond: number; createdAt: string };
type RosterEntry = { playerId: number; starter: boolean; goalkeeper: boolean; captain: boolean; position: Position };
type EventType = "goal_open" | "goal_penalty" | "penalty_miss" | "yellow" | "two_min" | "red" | "save_open" | "save_penalty";
type MatchRegistrar = { matchId: number; userId: number };
type CloudStorageStatus = { provider: string; configured: boolean; mode: "prepared" };
type SeasonData = { players: Player[]; trainings: Training[]; attendance: Attendance[]; exercises: Exercise[]; trainingExercises: TrainingExercise[]; matches: Match[]; matchPlayers: MatchPlayer[]; matchEvents: MatchEvent[]; matchSubstitutions: MatchSubstitution[]; appUsers: AppUser[]; matchRegistrars: MatchRegistrar[]; currentUser: CurrentUser | null; cloudStorage: CloudStorageStatus };
type AuthSession = { accessToken: string; refreshToken: string; expiresAt: number };

const emptyData: SeasonData = { players: [], trainings: [], attendance: [], exercises: [], trainingExercises: [], matches: [], matchPlayers: [], matchEvents: [], matchSubstitutions: [], appUsers: [], matchRegistrars: [], currentUser: null, cloudStorage: { provider: "Supabase", configured: false, mode: "prepared" } };
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
  return { ...emptyData, ...data };
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
      const stored = readStoredSession();
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
              onAdd={() => { setEditingMatch(null); setMatchFormOpen(true); }}
              onEdit={(match) => { setEditingMatch(match); setMatchFormOpen(true); }}
              onOpen={setActiveMatchId}
              onDelete={(id) => runAction({ action: "deleteMatch", id }, "Kampen er slettet.")}
              onStatus={(id, status) => runAction({ action: "setMatchStatus", matchId: id, status }, status === "planned" ? "Kampen er åpnet igjen." : "Kampen er markert som avlyst.")}
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
          {isAdmin && <TabsContent value="users"><UserSection users={data.appUsers} cloudStorage={data.cloudStorage} currentUserId={data.currentUser?.id ?? 0} onAdd={() => { setEditingUser(null); setUserFormOpen(true); }} onEdit={(user) => { setEditingUser(user); setUserFormOpen(true); }} onDelete={(id) => runAction({ action: "deleteUser", id }, "Brukeren er slettet.")} /></TabsContent>}
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
        key={editingMatch?.id ?? "new-match"}
        open={matchFormOpen}
        saving={saving}
        match={editingMatch}
        matches={data.matches}
        players={activePlayers}
        matchPlayers={data.matchPlayers}
        users={data.appUsers}
        matchRegistrars={data.matchRegistrars}
        onOpenChange={setMatchFormOpen}
        onSave={async (payload) => {
          const ok = await runAction({ action: "saveMatch", ...payload }, editingMatch ? "Kampen er oppdatert." : "Kampen er lagt til.");
          if (ok) setMatchFormOpen(false);
        }}
      />
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
          match={activeMatch}
          players={data.players}
          roster={data.matchPlayers.filter((entry) => entry.matchId === activeMatch.id)}
          events={visibleMatchEvents.filter((event) => event.matchId === activeMatch.id)}
          substitutions={visibleMatchSubstitutions.filter((entry) => entry.matchId === activeMatch.id)}
          canRecord={canRecordMatch(activeMatch.id) && activeMatch.status !== "completed" && activeMatch.status !== "cancelled"}
          onOpenChange={(open) => { if (!open) setActiveMatchId(null); }}
          onSave={(payload) => runAction({ action: "saveMatchNotes", matchId: activeMatch.id, notes: payload.notes }, "Kampnotatet er oppdatert.")}
          onClock={(clockMode, elapsedSeconds, periodElapsedSeconds, clockStartedAt) => runAction({ action: "setMatchClock", matchId: activeMatch.id, clockMode, elapsedSeconds, periodElapsedSeconds, clockStartedAt }, clockMode === "finish_period" ? "Første omgang er avsluttet." : clockMode === "start_second" ? "Andre omgang er startet." : clockMode === "pause" ? "Kampklokken er pauset." : clockMode === "reset" ? "Kampklokken er nullstilt." : "Kampklokken er startet.")}
          onEvent={(side, playerId, eventType, matchSecond, period, periodSecond) => runAction({ action: "addEvent", matchId: activeMatch.id, side, playerId, eventType, matchSecond, period, periodSecond }, eventInfo[eventType].label + " registrert.")}
          onDeleteEvent={(eventId) => runAction({ action: "deleteEvent", eventId }, "Hendelsen er angret.")}
          onSubstitution={(playerInId, playerOutId, matchSecond, period, periodSecond) => runAction({ action: "addSubstitution", matchId: activeMatch.id, playerInId, playerOutId, matchSecond, period, periodSecond }, "Byttet er registrert.")}
          onDeleteSubstitution={(id) => runAction({ action: "deleteSubstitution", id }, "Det siste byttet er angret.")}
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
      setMessage("Kontoen er opprettet. Bekreft e-post eller telefon hvis Supabase ber om det, og logg deretter inn.");
      setMode("login");
      setPassword("");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Kunne ikke logge inn.");
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
        <div><h2 className="text-2xl font-black">{mode === "login" ? "Logg inn" : mode === "register" ? "Opprett passord" : mode === "forgot" ? "Glemt passord" : "Velg nytt passord"}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{mode === "login" ? "Bruk e-postadressen eller telefonnummeret som er registrert på deg." : mode === "register" ? "Dette virker bare når en administrator har lagt deg til i den godkjente brukerlisten." : mode === "forgot" ? "Skriv inn e-postadressen din, så sender vi en sikker lenke for å velge nytt passord." : "Skriv inn det nye passordet du vil bruke."}</p></div>
        {message && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">{message}</div>}
        {loginError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-900">{loginError}</div>}
        {mode !== "recovery" && <Field label={mode === "forgot" ? "E-postadresse" : "E-post eller telefonnummer"} htmlFor="login-identifier"><Input id="login-identifier" autoComplete="username" autoFocus inputMode="email" required value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={mode === "forgot" ? "navn@eksempel.no" : "navn@eksempel.no eller 999 99 999"} /></Field>}
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

function MatchSection({ data, loading, onAdd, onEdit, onOpen, onDelete, onStatus, isAdmin, canRecordMatch }: { data: SeasonData; loading: boolean; onAdd: () => void; onEdit: (match: Match) => void; onOpen: (id: number) => void; onDelete: (id: number) => Promise<boolean>; onStatus: (id: number, status: "planned" | "cancelled") => Promise<boolean>; isAdmin: boolean; canRecordMatch: (matchId: number) => boolean }) {
  const [matchType, setMatchType] = useState<MatchType>("league");
  const completed = data.matches.filter((match) => match.status === "completed").length;
  const planned = data.matches.filter((match) => match.status === "planned" || match.status === "live").length;
  const matchesByType = (type: MatchType) => data.matches.filter((match) => (match.matchType || "league") === type);
  const typeCounts = { league: matchesByType("league").length, cup: matchesByType("cup").length, friendly: matchesByType("friendly").length };
  const cardProps = { data, onEdit, onOpen, onDelete, onStatus, isAdmin, canRecordMatch };
  return <SectionCard eyebrow="Serie, cup og vennskapskamper" title="Kamper" count={`${completed} gjennomført · ${planned} planlagt`} actionLabel={isAdmin ? "Ny kamp" : undefined} onAction={isAdmin ? onAdd : undefined}>
    {loading ? <LoadingCards /> : data.matches.length === 0 ? <EmptyState icon={Trophy} title="Ingen kamper lagt inn" text="Legg inn kampene på forhånd og fyll ut hendelser underveis eller etterpå." /> : <Tabs value={matchType} onValueChange={(value) => setMatchType(value as MatchType)}>
      <TabsList className="grid min-h-14 w-full grid-cols-3 rounded-2xl bg-slate-100 p-1"><TabsTrigger className="min-h-12 rounded-xl" value="league">Serie <span className="ml-1 text-xs opacity-70">{typeCounts.league}</span></TabsTrigger><TabsTrigger className="min-h-12 rounded-xl" value="cup">Cup <span className="ml-1 text-xs opacity-70">{typeCounts.cup}</span></TabsTrigger><TabsTrigger className="min-h-12 rounded-xl" value="friendly">Vennskap <span className="ml-1 text-xs opacity-70">{typeCounts.friendly}</span></TabsTrigger></TabsList>
      <TabsContent className="mt-2" value="league"><MonthMatchTabs matches={matchesByType("league")} emptyText="Ingen seriekamper." {...cardProps} /></TabsContent>
      <TabsContent className="mt-2" value="cup"><MonthMatchTabs matches={matchesByType("cup")} emptyText="Ingen cupkamper." groupCups {...cardProps} /></TabsContent>
      <TabsContent className="mt-2" value="friendly"><MonthMatchTabs matches={matchesByType("friendly")} emptyText="Ingen vennskapskamper." {...cardProps} /></TabsContent>
    </Tabs>}
  </SectionCard>;
}

type MatchListActions = { data: SeasonData; onEdit: (match: Match) => void; onOpen: (id: number) => void; onDelete: (id: number) => Promise<boolean>; onStatus: (id: number, status: "planned" | "cancelled") => Promise<boolean>; isAdmin: boolean; canRecordMatch: (matchId: number) => boolean };

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const label = new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function preferredMonth(months: string[]) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (months.includes(currentMonth)) return currentMonth;
  return months.find((month) => month > currentMonth) ?? months.at(-1) ?? "";
}

function MonthMatchTabs({ matches, emptyText, groupCups = false, ...actions }: { matches: Match[]; emptyText: string; groupCups?: boolean } & MatchListActions) {
  const sortedMatches = [...matches].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  const months = [...new Set(sortedMatches.map((match) => match.date.slice(0, 7)))];
  const [selectedMonth, setSelectedMonth] = useState(() => preferredMonth(months));

  useEffect(() => {
    if (!months.includes(selectedMonth)) setSelectedMonth(preferredMonth(months));
  }, [months.join("|"), selectedMonth]);

  if (!matches.length) return <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{emptyText}</p>;

  return <Tabs value={selectedMonth} onValueChange={setSelectedMonth}>
    <TabsList aria-label="Velg måned" className="flex min-h-12 w-full justify-start gap-1 overflow-x-auto rounded-2xl bg-red-50 p-1">
      {months.map((month) => <TabsTrigger className="min-h-10 min-w-fit shrink-0 rounded-xl px-4" key={month} value={month}>{monthLabel(month)} <span className="ml-1 text-xs opacity-70">{sortedMatches.filter((match) => match.date.startsWith(month)).length}</span></TabsTrigger>)}
    </TabsList>
    {months.map((month) => {
      const monthMatches = sortedMatches.filter((match) => match.date.startsWith(month));
      return <TabsContent className="mt-2" key={month} value={month}>{groupCups ? <CupMatchGroups matches={monthMatches} emptyText={emptyText} {...actions} /> : <MatchGrid matches={monthMatches} emptyText={emptyText} {...actions} />}</TabsContent>;
    })}
  </Tabs>;
}

function MatchGrid({ matches, emptyText, ...actions }: { matches: Match[]; emptyText: string } & MatchListActions) {
  if (!matches.length) return <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return <div className="grid gap-3 lg:grid-cols-2">{matches.map((match) => <MatchCard key={match.id} match={match} {...actions} />)}</div>;
}

function CupMatchGroups({ matches, emptyText, ...actions }: { matches: Match[]; emptyText: string } & MatchListActions) {
  if (!matches.length) return <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  const cups = [...new Set(matches.map((match) => match.cupName || match.competition || "Cup"))];
  return <div className="space-y-5">{cups.map((cup) => { const cupMatches = matches.filter((match) => (match.cupName || match.competition || "Cup") === cup); const teams = [...new Set(cupMatches.flatMap((match) => [match.team, match.opponent]))]; const completed = cupMatches.filter((match) => match.status === "completed").length; return <section key={cup} className="rounded-2xl border bg-red-50/30 p-3 sm:p-4"><div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h3 className="text-lg font-black">{cup}</h3><p className="mt-1 text-sm text-muted-foreground">{teams.join(" · ")}</p></div><Badge variant="secondary">{completed}/{cupMatches.length} gjennomført</Badge></div><MatchGrid matches={cupMatches} emptyText={emptyText} {...actions} /></section>; })}</div>;
}

function MatchCard({ match, data, onEdit, onOpen, onDelete, onStatus, isAdmin, canRecordMatch }: { match: Match } & MatchListActions) {
  const rosterCount = data.matchPlayers.filter((entry) => entry.matchId === match.id).length;
  const goals = data.matchEvents.filter((event) => event.matchId === match.id && (event.type === "goal_open" || event.type === "goal_penalty")).length;
  const canRecord = canRecordMatch(match.id);
  return <article className="rounded-2xl border bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-primary">{match.competition} · {formatDate(match.date)}</p><h3 className="mt-1 text-lg font-bold">{fixtureLabel(match)}</h3></div><div className="flex flex-col items-end gap-2"><StatusBadge status={match.status} />{match.ourScore !== null && match.opponentScore !== null && <span className="rounded-xl bg-primary px-3 py-2 text-lg font-bold text-primary-foreground">{displayScore(match)}</span>}</div></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground"><span className="flex items-center gap-1"><Clock3 className="size-4" /> {match.startTime || "Tid ikke satt"}</span>{match.venue && <span className="flex items-center gap-1"><MapPin className="size-4" /> {match.venue}</span>}<span>{match.homeAway === "away" ? "Bortekamp" : "Hjemmekamp"}</span><span>{match.periodCount || 2} × {match.periodMinutes || 20} min</span></div><div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline">{rosterCount} spillere</Badge><Badge variant="outline">{goals} registrerte mål</Badge>{!isAdmin && canRecord && <Badge className="bg-emerald-100 text-emerald-900">Kampregistrator</Badge>}{data.matchPlayers.some((entry) => entry.matchId === match.id && Boolean(entry.captain)) && <Badge className="bg-amber-100 text-amber-900"><Crown /> Kaptein valgt</Badge>}</div><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={() => onOpen(match.id)}><Goal /> {canRecord && match.status !== "completed" && match.status !== "cancelled" ? "Åpne kamp" : "Se kamp og laguttak"}</Button>{isAdmin && match.status !== "completed" && match.status !== "cancelled" && <Button size="sm" variant="outline" onClick={() => onEdit(match)}><Pencil /> Rediger</Button>}{isAdmin && (match.status === "completed" || match.status === "cancelled") && <Button size="sm" variant="outline" onClick={() => void onStatus(match.id, "planned")}>Åpne igjen</Button>}{isAdmin && match.status === "planned" && <Button size="sm" variant="ghost" onClick={() => void onStatus(match.id, "cancelled")}>Avlys</Button>}{isAdmin && match.status !== "completed" && <DeleteButton label="Slett kamp" description="Kampen, laguttaket og alle hendelser blir slettet." onConfirm={() => void onDelete(match.id)} />}</div></article>;
}

function PlayerSection({ data, loading, onAdd, onOpen, onToggle }: { data: SeasonData; loading: boolean; onAdd: () => void; onOpen: (id: number) => void; onToggle: (player: Player) => Promise<boolean> }) {
  const players = data.players;
  const activeCount = players.filter((player) => Boolean(player.active)).length;
  return <SectionCard eyebrow="Spillerregister" title="Laget" count={`${activeCount} aktive spillere`} actionLabel="Legg til spiller" onAction={onAdd}>
    {loading ? <LoadingCards /> : players.length === 0 ? <EmptyState icon={UserRound} title="Ingen spillere lagt inn ennå" text="Start med å legge inn spillerne på laget." /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{players.map((player) => { const completedMatches = data.matchPlayers.filter((entry) => entry.playerId === player.id && data.matches.some((match) => match.id === entry.matchId && match.status === "completed")).length; return <article key={player.id} className={`flex items-center justify-between gap-2 rounded-2xl border p-2 ${player.active ? "bg-white" : "bg-slate-50 opacity-60"}`}><button type="button" onClick={() => onOpen(player.id)} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left transition hover:bg-red-50"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary font-black text-primary-foreground">{player.jerseyNumber ? `#${player.jerseyNumber}` : "–"}</span><span className="min-w-0"><span className="block truncate font-semibold">{player.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{completedMatches} kamper · Trykk for profil</span></span></button><Button className="shrink-0" size="sm" variant="ghost" onClick={() => void onToggle(player)}>{player.active ? "Deaktiver" : "Aktiver"}</Button></article>; })}</div>}
  </SectionCard>;
}

function StatsSection({ data }: { data: SeasonData }) {
  type SortKey = "name" | "trainings" | "matches" | "starts" | "playingSeconds" | "goals" | "saves" | "twoMinutes" | "captain";
  const [scope, setScope] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("matches");
  const [descending, setDescending] = useState(true);
  const completedTrainings = data.trainings.filter((training) => training.status === "completed");
  const completedTrainingIds = new Set(completedTrainings.map((training) => training.id));
  const cupNames = [...new Set(data.matches.filter((match) => match.matchType === "cup").map((match) => match.cupName || match.competition).filter(Boolean))];
  const completedMatches = data.matches.filter((match) => match.status === "completed" && (scope === "all" || scope === match.matchType || (scope.startsWith("cup:") && match.matchType === "cup" && (match.cupName || match.competition) === scope.slice(4))));
  const completedMatchIds = new Set(completedMatches.map((match) => match.id));
  const rows = data.players.filter((player) => Boolean(player.active)).map((player) => ({ player, trainings: data.attendance.filter((entry) => entry.playerId === player.id && completedTrainingIds.has(entry.trainingId)).length, matches: data.matchPlayers.filter((entry) => entry.playerId === player.id && completedMatchIds.has(entry.matchId)).length, starts: data.matchPlayers.filter((entry) => entry.playerId === player.id && Boolean(entry.starter) && completedMatchIds.has(entry.matchId)).length, goals: data.matchEvents.filter((event) => event.playerId === player.id && completedMatchIds.has(event.matchId) && (event.type === "goal_open" || event.type === "goal_penalty")).length, twoMinutes: data.matchEvents.filter((event) => event.playerId === player.id && completedMatchIds.has(event.matchId) && event.type === "two_min").length, saves: data.matchEvents.filter((event) => event.playerId === player.id && completedMatchIds.has(event.matchId) && (event.type === "save_open" || event.type === "save_penalty")).length, captain: data.matchPlayers.filter((entry) => entry.playerId === player.id && Boolean(entry.captain) && completedMatchIds.has(entry.matchId)).length, playingSeconds: completedMatches.reduce((sum, match) => sum + playerSecondsForMatch(player.id, match, data.matchPlayers.filter((entry) => entry.matchId === match.id), data.matchSubstitutions.filter((entry) => entry.matchId === match.id)), 0) })).sort((a, b) => { const aValue = sortKey === "name" ? a.player.name : a[sortKey]; const bValue = sortKey === "name" ? b.player.name : b[sortKey]; const result = typeof aValue === "string" ? aValue.localeCompare(String(bValue), "nb-NO") : Number(aValue) - Number(bValue); return (descending ? -result : result) || a.player.name.localeCompare(b.player.name, "nb-NO"); });
  function chooseSort(next: SortKey) { if (next === sortKey) setDescending((value) => !value); else { setSortKey(next); setDescending(next !== "name"); } }
  const sortOptions: Array<{ value: SortKey; label: string }> = [{ value: "name", label: "Spiller" }, { value: "trainings", label: "Trening" }, { value: "matches", label: "Kamper" }, { value: "starts", label: "Starter" }, { value: "playingSeconds", label: "Spilletid" }, { value: "goals", label: "Mål" }, { value: "saves", label: "Redninger" }, { value: "twoMinutes", label: "2 min" }, { value: "captain", label: "Kaptein" }];
  const SortHead = ({ value, label }: { value: SortKey; label: string }) => <TableHead className={value === "name" ? "" : "text-center"}><button type="button" onClick={() => chooseSort(value)} className={`inline-flex min-h-10 items-center gap-1 whitespace-nowrap font-bold ${sortKey === value ? "text-primary" : "text-slate-700"}`}>{label}{sortKey === value && (descending ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />)}</button></TableHead>;
  return <SectionCard eyebrow="Automatisk oversikt" title="Sesongstatistikk" count={`${completedTrainings.length} gjennomførte treninger · ${completedMatches.length} valgte kamper`}><TrainingFocusSummary trainings={completedTrainings} /><div className="mt-5 grid gap-3 rounded-2xl border bg-white p-3 sm:grid-cols-2"><Field label="Vis statistikk for" htmlFor="stats-scope" className="!mt-0"><Select value={scope} onValueChange={setScope}><SelectTrigger id="stats-scope"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle kamper</SelectItem><SelectItem value="league">Serie</SelectItem><SelectItem value="cup">Alle cuper</SelectItem>{cupNames.map((cup) => <SelectItem key={cup} value={`cup:${cup}`}>{cup}</SelectItem>)}<SelectItem value="friendly">Vennskapskamper</SelectItem></SelectContent></Select></Field><div className="sm:hidden"><Field label="Sorter etter" htmlFor="stats-sort" className="!mt-0"><div className="flex gap-2"><Select value={sortKey} onValueChange={(value) => chooseSort(value as SortKey)}><SelectTrigger id="stats-sort"><SelectValue /></SelectTrigger><SelectContent>{sortOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><Button aria-label={descending ? "Sorter stigende" : "Sorter synkende"} variant="outline" size="icon" onClick={() => setDescending((value) => !value)}>{descending ? <ArrowDown /> : <ArrowUp />}</Button></div></Field></div></div>{rows.length === 0 ? <EmptyState icon={BarChart3} title="Ingen statistikk ennå" text="Statistikken fylles når treninger og kamper markeres som gjennomført." /> : <div className="mt-3 overflow-x-auto rounded-2xl border bg-white"><Table><TableHeader><TableRow>{sortOptions.map((option) => <SortHead key={option.value} value={option.value} label={option.label} />)}</TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.player.id}><TableCell className="whitespace-nowrap font-semibold">{row.player.jerseyNumber ? `#${row.player.jerseyNumber} · ` : ""}{row.player.name}</TableCell><TableCell className="text-center">{row.trainings}</TableCell><TableCell className="text-center">{row.matches}</TableCell><TableCell className="text-center">{row.starts}</TableCell><TableCell className="whitespace-nowrap text-center">{formatSeasonPlayingTime(row.playingSeconds)}</TableCell><TableCell className="text-center">{row.goals}</TableCell><TableCell className="text-center">{row.saves}</TableCell><TableCell className="text-center">{row.twoMinutes}</TableCell><TableCell className="text-center">{row.captain}</TableCell></TableRow>)}</TableBody></Table></div>}<p className="mt-4 text-xs leading-5 text-muted-foreground">Bare aktiviteter som er markert som gjennomført inngår i statistikken. Trening viser hele sesongen.</p></SectionCard>;
}

function TrainingFocusSummary({ trainings }: { trainings: Training[] }) {
  const counts = trainingThemeOptions
    .map((theme) => ({ theme, count: trainings.filter((training) => training.theme === theme).length }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.theme.localeCompare(b.theme, "nb-NO"));
  const maxCount = Math.max(1, ...counts.map((entry) => entry.count));
  return <section className="rounded-2xl border bg-red-50/40 p-4">
    <div className="flex flex-wrap items-end justify-between gap-2"><div><h3 className="font-bold">Treningsfokus i sesongen</h3><p className="mt-1 text-sm text-muted-foreground">Hovedtema i treninger som er markert som gjennomført.</p></div><Badge variant="secondary">{counts.reduce((sum, entry) => sum + entry.count, 0)} med tema</Badge></div>
    {counts.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{counts.map((entry) => <div key={entry.theme}><div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="font-medium">{entry.theme}</span><span className="font-bold">{entry.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-red-100"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(8, (entry.count / maxCount) * 100)}%` }} /></div></div>)}</div> : <p className="mt-4 rounded-xl border border-dashed bg-white/70 p-4 text-sm text-muted-foreground">Når gjennomførte treninger har et hovedtema, vises fordelingen her.</p>}
  </section>;
}

function UserSection({ users, cloudStorage, currentUserId, onAdd, onEdit, onDelete }: { users: AppUser[]; cloudStorage: CloudStorageStatus; currentUserId: number; onAdd: () => void; onEdit: (user: AppUser) => void; onDelete: (id: number) => Promise<boolean> }) {
  return <SectionCard eyebrow="Tilgang og roller" title="Brukere" count={`${users.filter((user) => Boolean(user.active)).length} aktive`} actionLabel="Legg til bruker" onAction={onAdd}>
    <div className={`mb-4 rounded-2xl border p-4 text-sm ${cloudStorage.configured ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-slate-50 text-slate-700"}`}><div className="flex items-center justify-between gap-3"><div><p className="font-bold">Sikker innlogging med {cloudStorage.provider}</p><p className="mt-1 leading-6">{cloudStorage.configured ? "E-post, telefonnummer og passord håndteres av Supabase. Roller og tilgang kontrolleres mot denne brukerlisten." : "Innloggingen er ikke konfigurert ennå."}</p></div><Badge className={cloudStorage.configured ? "bg-emerald-100 text-emerald-800" : ""} variant={cloudStorage.configured ? "secondary" : "outline"}>{cloudStorage.configured ? "Aktiv" : "Ikke klar"}</Badge></div></div>
    <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-bold">Forhåndsgodkjent innlogging</p><p className="mt-1 leading-6">Legg inn navn, e-post og/eller telefonnummer før brukeren får tilgang. Nye brukere velger «Første gang? Opprett passord» på innloggingssiden. De kan deretter logge inn med e-post eller registrert telefonnummer.</p></div>
    <div className="grid gap-3 lg:grid-cols-2">{users.map((user) => <article key={user.id} className={`rounded-2xl border p-4 ${user.active ? "bg-white" : "bg-slate-50 opacity-70"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{user.name}</h3><Badge variant={user.role === "admin" ? "default" : "secondary"}>{roleLabel(user.role)}</Badge>{user.id === currentUserId && <Badge variant="outline">Deg</Badge>}</div>{user.email && <p className="mt-2 break-all text-sm text-muted-foreground">{user.email}</p>}{user.phone && <p className={`${user.email ? "mt-1" : "mt-2"} text-sm text-muted-foreground`}>{user.phone}</p>}{!user.email && !user.phone && <p className="mt-2 text-sm text-red-700">Innloggingsinformasjon mangler</p>}</div><StatusBadge status={user.active ? "completed" : "cancelled"} label={user.active ? "Aktiv" : "Deaktivert"} /></div><div className="mt-4 flex gap-2"><Button size="sm" variant="outline" onClick={() => onEdit(user)}><Pencil /> Rediger</Button>{user.id !== currentUserId && <DeleteButton label="Slett bruker" description="Brukeren mister all tilgang og eventuelle kampoppdrag." onConfirm={() => void onDelete(user.id)} />}</div></article>)}</div>
  </SectionCard>;
}

function UserDialog({ open, saving, user, onOpenChange, onSave }: { open: boolean; saving: boolean; user: AppUser | null; onOpenChange: (open: boolean) => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [role, setRole] = useState<AppRole>(user?.role ?? "parent");
  const [active, setActive] = useState(user ? Boolean(user.active) : true);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><form onSubmit={(event) => { event.preventDefault(); void onSave({ id: user?.id, name, email, phone, role, active }); }}><DialogHeader><DialogTitle>{user ? "Rediger bruker" : "Forhåndsgodkjenn bruker"}</DialogTitle><DialogDescription>Brukeren må ha e-postadresse eller telefonnummer for å kunne opprette passord.</DialogDescription></DialogHeader><Field label="Navn" htmlFor="user-name"><Input id="user-name" autoFocus required value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="E-post" htmlFor="user-email"><Input id="user-email" type="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="navn@eksempel.no" /></Field><Field label="Telefonnummer" htmlFor="user-phone"><Input id="user-phone" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="999 99 999" /></Field><p className="mt-2 text-xs leading-5 text-muted-foreground">Minst ett av feltene e-post eller telefonnummer må fylles ut.</p><Field label="Rolle" htmlFor="user-role"><Select value={role} onValueChange={(value) => setRole(value as AppRole)}><SelectTrigger id="user-role"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Administrator</SelectItem><SelectItem value="parent">Foresatt</SelectItem></SelectContent></Select></Field><p className="mt-2 text-xs leading-5 text-muted-foreground">Kampregistrator velges på den enkelte kampen.</p>{user && <label className="mt-5 flex min-h-12 items-center gap-3 rounded-xl border p-3 text-sm font-semibold"><Checkbox checked={active} onCheckedChange={(checked) => setActive(checked === true)} />Aktiv bruker</label>}<DialogFooter className="mt-5"><Button disabled={saving || !name.trim() || (!email.trim() && !phone.trim())} type="submit">{saving ? "Lagrer …" : "Lagre bruker"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function PlayerDialog({ open, saving, onOpenChange, onSave }: { open: boolean; saving: boolean; onOpenChange: (open: boolean) => void; onSave: (player: { name: string; jerseyNumber: number | null; shirtSize: string; shortsSize: string }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [shirtSize, setShirtSize] = useState("");
  const [shortsSize, setShortsSize] = useState("");
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><form onSubmit={(event) => { event.preventDefault(); void onSave({ name, jerseyNumber: jerseyNumber ? Number(jerseyNumber) : null, shirtSize, shortsSize }); }}><DialogHeader><DialogTitle>Legg til spiller</DialogTitle><DialogDescription>Spilleren kan velges på treninger og kamper.</DialogDescription></DialogHeader><Field label="Navn" htmlFor="player-name"><Input id="player-name" autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Fornavn og etternavn" /></Field><div className="grid grid-cols-3 gap-3"><Field label="Drakt nr." htmlFor="player-number"><Input id="player-number" min="1" type="number" inputMode="numeric" value={jerseyNumber} onChange={(event) => setJerseyNumber(event.target.value)} /></Field><Field label="Drakt str." htmlFor="player-shirt"><Input id="player-shirt" inputMode="numeric" value={shirtSize} onChange={(event) => setShirtSize(event.target.value)} /></Field><Field label="Shorts str." htmlFor="player-shorts"><Input id="player-shorts" inputMode="numeric" value={shortsSize} onChange={(event) => setShortsSize(event.target.value)} /></Field></div><DialogFooter><Button disabled={saving || !name.trim()} type="submit">{saving ? "Lagrer …" : "Lagre spiller"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function PlayerProfileDialog({ player, data, open, onOpenChange }: { player: Player | null; data: SeasonData; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!player) return null;
  const completedTrainingIds = new Set(data.trainings.filter((training) => training.status === "completed").map((training) => training.id));
  const attendedTrainings = data.attendance.filter((entry) => entry.playerId === player.id && completedTrainingIds.has(entry.trainingId)).length;
  const matchHistory = data.matchPlayers.filter((entry) => entry.playerId === player.id).map((entry) => ({ entry, match: data.matches.find((match) => match.id === entry.matchId) })).filter((item): item is { entry: MatchPlayer; match: Match } => Boolean(item.match)).sort((a, b) => b.match.date.localeCompare(a.match.date) || b.match.startTime.localeCompare(a.match.startTime));
  const completedHistory = matchHistory.filter(({ match }) => match.status === "completed");
  const completedIds = new Set(completedHistory.map(({ match }) => match.id));
  const playerEvents = data.matchEvents.filter((event) => event.playerId === player.id && completedIds.has(event.matchId));
  const totalGoals = playerEvents.filter((event) => event.type === "goal_open" || event.type === "goal_penalty").length;
  const captainCount = completedHistory.filter(({ entry }) => Boolean(entry.captain)).length;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-xl bg-primary text-lg font-black text-primary-foreground">{player.jerseyNumber ? `#${player.jerseyNumber}` : "–"}</span><span>{player.name}</span></DialogTitle><DialogDescription>Spillerinformasjon og statistikk fra gjennomførte aktiviteter.</DialogDescription></DialogHeader><div className="grid gap-3 py-4 sm:grid-cols-2"><div className="rounded-2xl border bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Draktinformasjon</p><p className="mt-2 font-semibold">Drakt {player.shirtSize || "–"} · Shorts {player.shortsSize || "–"}</p></div><div className="rounded-2xl border bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</p><p className="mt-2 font-semibold">{player.active ? "Aktiv spiller" : "Inaktiv spiller"}</p></div></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><ProfileStat label="Treninger" value={attendedTrainings} /><ProfileStat label="Kamper" value={completedHistory.length} /><ProfileStat label="Mål" value={totalGoals} /><ProfileStat label="Kaptein" value={captainCount} /></div><section className="mt-5"><h3 className="font-bold">Kamper og kampstatistikk</h3>{matchHistory.length === 0 ? <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Spilleren er ikke tatt ut til noen kamper ennå.</p> : <div className="mt-3 space-y-3">{matchHistory.map(({ entry, match }) => { const events = data.matchEvents.filter((event) => event.matchId === match.id && event.playerId === player.id); const goals = events.filter((event) => event.type === "goal_open" || event.type === "goal_penalty").length; const penaltyGoals = events.filter((event) => event.type === "goal_penalty").length; const misses = events.filter((event) => event.type === "penalty_miss").length; const saves = events.filter((event) => event.type === "save_open" || event.type === "save_penalty").length; const yellow = events.some((event) => event.type === "yellow"); const twoMinutes = events.filter((event) => event.type === "two_min").length; const red = events.some((event) => event.type === "red"); const seconds = playerSecondsForMatch(player.id, match, data.matchPlayers.filter((item) => item.matchId === match.id), data.matchSubstitutions.filter((item) => item.matchId === match.id)); return <article key={match.id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-semibold text-primary">{formatDate(match.date)} · {matchTypeLabel(match.matchType)}</p><p className="mt-1 font-bold">{fixtureLabel(match)}</p></div><div className="flex items-center gap-2">{entry.captain && <Badge className="bg-amber-100 text-amber-900"><Crown /> Kaptein</Badge>}<StatusBadge status={match.status} /></div></div><div className="mt-3 flex flex-wrap gap-2 text-xs"><Badge variant="outline">{entry.starter ? "Startet" : "Benk"}</Badge><Badge variant="outline">{formatSeasonPlayingTime(seconds)}</Badge><Badge variant="outline">{goals} mål</Badge>{penaltyGoals > 0 && <Badge variant="outline">{penaltyGoals} straffemål</Badge>}{misses > 0 && <Badge variant="outline">{misses} straffebom</Badge>}{saves > 0 && <Badge variant="outline">{saves} redninger</Badge>}{yellow && <Badge className="bg-yellow-100 text-yellow-950">🟨 Gult</Badge>}{twoMinutes > 0 && <Badge className="bg-orange-100 text-orange-900">✌️ {twoMinutes} × 2 min</Badge>}{red && <Badge className="bg-red-100 text-red-900">🟥 Rødt</Badge>}</div></article>; })}</div>}</section></DialogContent></Dialog>;
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-primary p-3 text-center text-primary-foreground"><p className="text-2xl font-black">{value}</p><p className="text-xs text-red-100">{label}</p></div>;
}

function MatchFormDialog({ open, saving, match, matches, players, matchPlayers, users, matchRegistrars, onOpenChange, onSave }: { open: boolean; saving: boolean; match: Match | null; matches: Match[]; players: Player[]; matchPlayers: MatchPlayer[]; users: AppUser[]; matchRegistrars: MatchRegistrar[]; onOpenChange: (open: boolean) => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [date, setDate] = useState(match?.date ?? "");
  const [startTime, setStartTime] = useState(match?.startTime ?? "");
  const [opponent, setOpponent] = useState(match?.opponent ?? "");
  const [team, setTeam] = useState(match?.team ?? "Stokmarknes");
  const [homeAway, setHomeAway] = useState<"home" | "away">(match?.homeAway ?? "home");
  const [matchType, setMatchType] = useState<MatchType>(match?.matchType ?? "league");
  const [competition, setCompetition] = useState(match?.matchType === "league" ? match.competition : "J12-serien 2026/27");
  const [cupName, setCupName] = useState(match?.cupName ?? (match?.matchType === "cup" ? match.competition : ""));
  const [periodMinutes, setPeriodMinutes] = useState(match?.periodMinutes ?? 20);
  const [venue, setVenue] = useState(match?.venue ?? "");
  const [registrarUserId, setRegistrarUserId] = useState(() => match ? matchRegistrars.find((entry) => entry.matchId === match.id)?.userId ?? 0 : 0);
  const [positionMenuPlayerId, setPositionMenuPlayerId] = useState<number | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>(() => {
    if (!match) return [];
    const entries = matchPlayers.filter((entry) => entry.matchId === match.id);
    const positions = normalizeMatchPositions(entries);
    return entries.map((entry) => {
      const position = positions.get(entry.playerId) ?? "bench";
      return { playerId: entry.playerId, position, starter: position !== "bench", goalkeeper: position === "goalkeeper", captain: Boolean(entry.captain) };
    });
  });
  function selectPlayer(playerId: number, checked: boolean) {
    setRoster((current) => checked ? current.some((entry) => entry.playerId === playerId) ? current : [...current, { playerId, starter: false, goalkeeper: false, captain: false, position: "bench" }] : current.filter((entry) => entry.playerId !== playerId));
  }
  function choosePosition(playerId: number, position: Position) {
    setRoster((current) => {
      const existing = current.find((entry) => entry.playerId === playerId);
      const withPlayer = existing ? current : [...current, { playerId, starter: false, goalkeeper: false, captain: false, position: "bench" as Position }];
      return withPlayer.map((entry) => {
        if (entry.playerId === playerId) return { ...entry, position, starter: position !== "bench", goalkeeper: position === "goalkeeper" };
        if (position !== "bench" && entry.position === position) return { ...entry, position: "bench", starter: false, goalkeeper: false };
        return entry;
      });
    });
    setPositionMenuPlayerId(null);
  }
  function chooseCaptain(playerId: number) {
    setRoster((current) => current.map((entry) => ({ ...entry, captain: entry.playerId === playerId ? !entry.captain : false })));
  }
  const registrars = users.filter((user) => user.role === "parent" && Boolean(user.active)).sort((a, b) => a.name.localeCompare(b.name, "nb-NO"));
  const cupNames = [...new Set(matches.filter((item) => item.matchType === "cup").map((item) => item.cupName || item.competition).filter(Boolean))];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"><form onSubmit={(event) => { event.preventDefault(); void onSave({ id: match?.id, date, startTime, opponent, team, homeAway, competition, matchType, cupName, periodCount: 2, periodMinutes: matchType === "league" ? 20 : periodMinutes, venue, ourScore: match?.ourScore ?? null, opponentScore: match?.opponentScore ?? null, notes: match?.notes ?? "", roster, registrarUserId: registrarUserId || null }); }}>
    <DialogHeader><DialogTitle>{match ? "Rediger kamp" : "Ny kamp"}</DialogTitle><DialogDescription>Legg inn kampinformasjon og velg spillerne som skal delta.</DialogDescription></DialogHeader>
    <div className="grid gap-4 py-5 sm:grid-cols-2">
      <Field label="Kamptype" htmlFor="match-type" className="sm:col-span-2"><Select value={matchType} onValueChange={(value) => setMatchType(value as MatchType)}><SelectTrigger id="match-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="league">Seriekamp</SelectItem><SelectItem value="cup">Cupkamp</SelectItem><SelectItem value="friendly">Vennskapskamp</SelectItem></SelectContent></Select></Field>
      <Field label="Dato" htmlFor="match-date"><Input id="match-date" required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
      <Field label="Starttid" htmlFor="match-time"><Input id="match-time" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></Field>
      <Field label="Vårt lag" htmlFor="match-team"><Input id="match-team" value={team} onChange={(event) => setTeam(event.target.value)} placeholder="STHK 2" /></Field>
      <Field label="Motstander" htmlFor="match-opponent"><Input id="match-opponent" required value={opponent} onChange={(event) => setOpponent(event.target.value)} /></Field>
      <Field label="Hjemme eller borte" htmlFor="match-home-away"><Select value={homeAway} onValueChange={(value) => setHomeAway(value as "home" | "away")}><SelectTrigger id="match-home-away"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="home">Hjemmekamp</SelectItem><SelectItem value="away">Bortekamp</SelectItem></SelectContent></Select></Field>
      <Field label="Sted" htmlFor="match-venue"><Input id="match-venue" value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="Hall" /></Field>
      {matchType === "league" && <Field label="Serie" htmlFor="match-competition"><Input id="match-competition" value={competition} onChange={(event) => setCompetition(event.target.value)} /></Field>}
      {matchType === "cup" && <Field label="Navn på cup" htmlFor="match-cup"><Input id="match-cup" list="cup-names" required value={cupName} onChange={(event) => setCupName(event.target.value)} placeholder="Eksempel: Vågan Cup" /><datalist id="cup-names">{cupNames.map((cup) => <option key={cup} value={cup} />)}</datalist></Field>}
      <Field label="Spilletid" htmlFor="match-period-minutes"><div className="flex items-center gap-2"><Input id="match-period-minutes" disabled={matchType === "league"} min="1" max="60" type="number" inputMode="numeric" value={matchType === "league" ? 20 : periodMinutes} onChange={(event) => setPeriodMinutes(Number(event.target.value) || 20)} /><span className="shrink-0 text-sm text-muted-foreground">2 omganger</span></div>{matchType === "league" && <p className="mt-2 text-xs text-muted-foreground">J12-serien bruker 2 × 20 minutter.</p>}</Field>
      <Field label="Kampregistrator" htmlFor="match-registrar" className="sm:col-span-2"><Select value={registrarUserId ? String(registrarUserId) : "none"} onValueChange={(value) => setRegistrarUserId(value === "none" ? 0 : Number(value))}><SelectTrigger id="match-registrar"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ingen valgt</SelectItem>{registrars.map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>)}</SelectContent></Select><p className="mt-2 text-xs text-muted-foreground">Velg blant aktive foresatte. Valgt person får registreringstilgang bare til denne kampen. Administratorer har alltid tilgang.</p></Field>
      <div className="sm:col-span-2"><div className="mb-1 flex items-center justify-between"><p className="text-sm font-semibold">Laguttak, startposisjon og kaptein</p><span className="text-xs text-muted-foreground">{roster.length} valgt</span></div><p className="mb-3 text-sm text-muted-foreground">Trykk på spilleren for å velge plass. Kronen markerer kampens kaptein.</p><div className="overflow-hidden rounded-2xl border"><div className="grid grid-cols-[40px_1fr] bg-slate-50 px-3 py-2 text-xs font-semibold text-muted-foreground"><span>Med</span><span className="grid grid-cols-[1fr_104px_48px] gap-2"><span>Spiller</span><span className="text-center">Startplass</span><span className="text-center">C</span></span></div>{players.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Legg inn spillere i spillerregisteret først.</p> : players.map((player) => { const entry = roster.find((item) => item.playerId === player.id); const positionLabel = positionOptions.find((option) => option.value === entry?.position)?.label ?? "Velg plass"; return <div key={player.id} className={`grid min-h-14 grid-cols-[40px_1fr] items-center border-t px-3 ${entry ? "bg-red-50/40" : "bg-white"}`}><div className="grid place-items-start"><Checkbox aria-label={`${player.name} er med i laguttaket`} checked={Boolean(entry)} onCheckedChange={(checked) => selectPlayer(player.id, checked === true)} /></div><div className="grid min-w-0 grid-cols-[1fr_104px_48px] items-center gap-2"><Popover open={positionMenuPlayerId === player.id} onOpenChange={(isOpen) => setPositionMenuPlayerId(isOpen ? player.id : null)}><PopoverTrigger asChild><button type="button" className="col-span-2 grid min-h-14 min-w-0 grid-cols-[1fr_104px] items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50" disabled={!entry}><span className="flex min-w-0 items-center gap-2"><span className="w-8 shrink-0 text-xs font-black text-primary">{player.jerseyNumber ? `#${player.jerseyNumber}` : ""}</span><span className="truncate text-sm font-semibold">{player.name}</span></span><span className={`rounded-lg px-1.5 py-1.5 text-center text-xs font-bold ${entry?.position === "bench" ? "bg-slate-100 text-slate-700" : entry ? "bg-primary text-primary-foreground" : "bg-slate-50 text-muted-foreground"}`}>{positionLabel}</span></button></PopoverTrigger><PopoverContent className="z-[60] w-72" align="end"><PopoverHeader><PopoverTitle>{player.name}</PopoverTitle><PopoverDescription>Velg startposisjon eller benk.</PopoverDescription></PopoverHeader><div className="mt-3 grid grid-cols-2 gap-2">{positionOptions.map((option) => <button key={option.value} type="button" onClick={() => choosePosition(player.id, option.value)} className={`min-h-11 rounded-xl border px-2 py-2 text-sm font-semibold ${entry?.position === option.value ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:border-primary"}`}>{option.label}</button>)}</div></PopoverContent></Popover><button type="button" aria-label={entry?.captain ? `${player.name} er kaptein` : `Velg ${player.name} som kaptein`} disabled={!entry} onClick={() => chooseCaptain(player.id)} className={`grid size-10 place-items-center rounded-xl border transition disabled:opacity-30 ${entry?.captain ? "border-amber-500 bg-amber-100 text-amber-900" : "bg-white text-slate-400 hover:border-amber-400"}`}><Crown className="size-5" /></button></div></div>; })}</div></div>
    </div>
    <DialogFooter><Button disabled={saving || !date || !opponent.trim() || (matchType === "cup" && !cupName.trim())} type="submit">{saving ? "Lagrer …" : "Lagre kamp"}</Button></DialogFooter>
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

function normalizeMatchPositions(roster: MatchPlayer[]) {
  const validPositions = new Set<Position>(positionOptions.map((option) => option.value));
  const fallback: Exclude<Position, "bench" | "goalkeeper">[] = ["left_wing", "left_back", "center", "right_back", "right_wing"];
  const used = new Set<Exclude<Position, "bench">>();
  const positions = new Map<number, Position>();
  let fallbackIndex = 0;
  for (const entry of roster) {
    let position: Position = validPositions.has(entry.position) ? entry.position : "bench";
    if (position === "bench" && Boolean(entry.goalkeeper)) position = "goalkeeper";
    if (position === "bench" && Boolean(entry.starter)) {
      while (fallbackIndex < fallback.length && used.has(fallback[fallbackIndex])) fallbackIndex += 1;
      position = fallback[fallbackIndex] ?? "bench";
      fallbackIndex += 1;
    }
    if (position !== "bench" && used.has(position)) position = "bench";
    if (position !== "bench") used.add(position);
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
