"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Clock3,
  CheckCircle2,
  Dumbbell,
  ExternalLink,
  Flame,
  Goal,
  Pencil,
  Plus,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trainingThemeOptions, type TrainingTheme } from "@/lib/training-themes";

export type ExerciseCategory = "warmup" | "defense" | "attack" | "cardio" | "strength";
export type TrainingSectionKey = "warmup" | "technique" | "match";
export type Player = { id: number; name: string; active: number | boolean };
export type TrainingStatus = "planned" | "completed" | "cancelled";
export type Training = { id: number; date: string; startTime: string; durationMinutes: number; title: string; theme: string; plan: string; notes: string; status: TrainingStatus; completedAt: string | null };
export type Attendance = { trainingId: number; playerId: number };
export type Exercise = { id: number; seedKey: string | null; title: string; category: ExerciseCategory; description: string; durationMinutes: number; equipment: string; sourceTitle: string; sourceUrl: string };
export type TrainingExercise = { id: number; trainingId: number; exerciseId: number; section: TrainingSectionKey; sortOrder: number; durationMinutes: number; notes: string };

type TrainingData = {
  players: Player[];
  trainings: Training[];
  attendance: Attendance[];
  exercises: Exercise[];
  trainingExercises: TrainingExercise[];
};

type RunAction = (payload: Record<string, unknown>, successMessage: string) => Promise<boolean>;
type PlannerItem = { clientKey: string; exerciseId: number; section: TrainingSectionKey; sortOrder: number; durationMinutes: number; notes: string };

const categoryMeta: Record<ExerciseCategory, { label: string; icon: LucideIcon; color: string; soft: string }> = {
  warmup: { label: "Oppvarming", icon: Flame, color: "text-orange-700", soft: "bg-orange-50" },
  defense: { label: "Forsvar", icon: Shield, color: "text-blue-700", soft: "bg-blue-50" },
  attack: { label: "Angrep", icon: Goal, color: "text-emerald-700", soft: "bg-emerald-50" },
  cardio: { label: "Cardio", icon: Activity, color: "text-rose-700", soft: "bg-rose-50" },
  strength: { label: "Styrke", icon: Dumbbell, color: "text-violet-700", soft: "bg-violet-50" },
};

const sectionMeta: Record<TrainingSectionKey, { label: string; short: string; icon: LucideIcon; color: string }> = {
  warmup: { label: "Oppvarming", short: "1", icon: Flame, color: "border-orange-200 bg-orange-50/60" },
  technique: { label: "Teknikkøving", short: "2", icon: Sparkles, color: "border-sky-200 bg-sky-50/60" },
  match: { label: "Kamptrening", short: "3", icon: Goal, color: "border-emerald-200 bg-emerald-50/60" },
};

const categories = Object.keys(categoryMeta) as ExerciseCategory[];
const sections = Object.keys(sectionMeta) as TrainingSectionKey[];

export function TrainingWorkspace({ data, loading, saving, runAction }: { data: TrainingData; loading: boolean; saving: boolean; runAction: RunAction }) {
  const [view, setView] = useState("plans");
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [exerciseOpen, setExerciseOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const completedCount = data.trainings.filter((training) => training.status === "completed").length;
  const plannedCount = data.trainings.filter((training) => training.status === "planned").length;

  function newTraining() {
    setEditingTraining(null);
    setTrainingOpen(true);
  }

  function editTraining(training: Training) {
    setEditingTraining(training);
    setTrainingOpen(true);
  }

  function newExercise() {
    setEditingExercise(null);
    setExerciseOpen(true);
  }

  function editExercise(exercise: Exercise) {
    setEditingExercise(exercise);
    setExerciseOpen(true);
  }

  return (
    <section className="rounded-3xl border bg-white p-3 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 px-1 sm:px-0">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Plan og gjennomføring</p>
          <h2 className="mt-1 text-2xl font-bold">Treninger</h2>
          <p className="mt-1 text-sm text-muted-foreground">{completedCount} gjennomført · {plannedCount} planlagt</p>
        </div>
        <Button className="min-h-11" onClick={view === "plans" ? newTraining : newExercise}><Plus /> {view === "plans" ? "Ny trening" : "Ny øvelse"}</Button>
      </div>

      <Tabs value={view} onValueChange={setView} className="mt-5 gap-5">
        <TabsList className="grid h-12 w-full grid-cols-2 rounded-xl bg-slate-100 p-1 sm:max-w-md">
          <TabsTrigger value="plans" className="rounded-lg">Treningsplaner</TabsTrigger>
          <TabsTrigger value="library" className="rounded-lg">Øvelsesbank · {data.exercises.length}</TabsTrigger>
        </TabsList>
        <TabsContent value="plans">
          <TrainingPlans data={data} loading={loading} onAdd={newTraining} onEdit={editTraining} onDelete={(id) => runAction({ action: "deleteTraining", id }, "Treningen er slettet.")} onStatus={(id, status) => runAction({ action: "setTrainingStatus", id, status }, status === "completed" ? "Treningen er markert som gjennomført og låst." : status === "cancelled" ? "Treningen er markert som avlyst." : "Treningen er åpnet igjen.")} />
        </TabsContent>
        <TabsContent value="library">
          <ExerciseLibrary exercises={data.exercises} loading={loading} onAdd={newExercise} onEdit={editExercise} onDelete={(id) => runAction({ action: "deleteExercise", id }, "Øvelsen er slettet.")} />
        </TabsContent>
      </Tabs>

      <TrainingPlannerDialog
        key={editingTraining?.id ?? "new-training-plan"}
        open={trainingOpen}
        saving={saving}
        training={editingTraining}
        data={data}
        onOpenChange={setTrainingOpen}
        onSave={async (payload) => {
          const ok = await runAction({ action: "saveTraining", ...payload }, editingTraining ? "Treningen er oppdatert." : "Treningen er lagt til.");
          if (ok) setTrainingOpen(false);
        }}
      />
      <ExerciseDialog
        key={editingExercise?.id ?? "new-exercise"}
        open={exerciseOpen}
        saving={saving}
        exercise={editingExercise}
        onOpenChange={setExerciseOpen}
        onSave={async (payload) => {
          const ok = await runAction({ action: "saveExercise", ...payload }, editingExercise ? "Øvelsen er oppdatert." : "Øvelsen er lagt til.");
          if (ok) setExerciseOpen(false);
        }}
      />
    </section>
  );
}

function TrainingPlans({ data, loading, onAdd, onEdit, onDelete, onStatus }: { data: TrainingData; loading: boolean; onAdd: () => void; onEdit: (training: Training) => void; onDelete: (id: number) => Promise<boolean>; onStatus: (id: number, status: TrainingStatus) => Promise<boolean> }) {
  if (loading) return <LoadingCards />;
  if (!data.trainings.length) return <EmptyTraining onAdd={onAdd} />;
  const currentMonth = monthKey(new Date());
  const monthGroups = groupTrainingsByMonth(data.trainings, currentMonth);
  const initiallyOpen = monthGroups.find((group) => group.key === currentMonth)?.key ?? monthGroups[0]?.key;

  return <div className="space-y-4">
    <Accordion type="multiple" defaultValue={initiallyOpen ? [initiallyOpen] : []} className="space-y-3">
    {monthGroups.map((group) => <AccordionItem key={group.key} value={group.key} className="overflow-hidden rounded-2xl border bg-white">
      <AccordionTrigger className="min-h-16 bg-slate-50/80 px-4 py-3 hover:no-underline">
        <span className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2">
          <span className="text-base font-bold capitalize">{formatMonth(group.key)}</span>
          <span className="flex items-center gap-2">
            {group.key === currentMonth && <Badge className="hidden sm:inline-flex">Denne måneden</Badge>}
            <Badge variant="secondary">{group.trainings.length} treninger</Badge>
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="p-3 pt-3">
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}>
          {group.trainings.map((training) => <TrainingCard key={training.id} training={training} data={data} onEdit={onEdit} onDelete={onDelete} onStatus={onStatus} />)}
        </div>
      </AccordionContent>
    </AccordionItem>)}
    </Accordion>
  </div>;
}

function TrainingCard({ training, data, onEdit, onDelete, onStatus }: { training: Training; data: TrainingData; onEdit: (training: Training) => void; onDelete: (id: number) => Promise<boolean>; onStatus: (id: number, status: TrainingStatus) => Promise<boolean> }) {
  const items = data.trainingExercises.filter((item) => item.trainingId === training.id);
  const plannedMinutes = items.reduce((sum, item) => sum + item.durationMinutes, 0);
  const attendanceCount = data.attendance.filter((entry) => entry.trainingId === training.id).length;
  return <article className="overflow-hidden rounded-2xl border bg-white">
      <div className="border-b bg-slate-50/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-semibold text-primary">{formatDate(training.date)}</p><h3 className="mt-1 text-lg font-bold">{training.title || "Lagstrening"}</h3>{training.theme && <Badge className="mt-2" variant="outline">{training.theme}</Badge>}</div>
          <div className="flex flex-col items-end gap-2"><TrainingStatusBadge status={training.status} /><Badge variant="secondary">{plannedMinutes || training.durationMinutes} min</Badge></div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Clock3 className="size-3.5" />{training.startTime || "Tid ikke satt"}</span><span className="flex items-center gap-1"><Users className="size-3.5" />{attendanceCount} spillere</span></div>
      </div>
      <div className="space-y-3 p-4">
        {sections.map((section) => {
          const meta = sectionMeta[section];
          const sectionItems = items.filter((item) => item.section === section).sort((a, b) => a.sortOrder - b.sortOrder);
          return <div key={section} className="grid grid-cols-[30px_1fr] gap-2"><span className={`grid size-7 place-items-center rounded-lg text-xs font-bold ${meta.color}`}>{meta.short}</span><div><p className="text-xs font-bold">{meta.label}</p>{sectionItems.length ? <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{sectionItems.map((item) => data.exercises.find((exercise) => exercise.id === item.exerciseId)?.title).filter(Boolean).join(" · ")}</p> : <p className="mt-0.5 text-xs text-slate-400">Ingen øvelser lagt til</p>}</div></div>;
        })}
      </div>
      <div className="flex flex-wrap gap-2 border-t p-3"><Button className="min-h-11 flex-1" variant="outline" onClick={() => onEdit(training)}><Pencil /> {training.status === "planned" ? "Åpne planen" : "Se trening"}</Button>{training.status === "planned" ? <><Button className="min-h-11" onClick={() => void onStatus(training.id, "completed")}><CheckCircle2 /> Gjennomført</Button><Button className="min-h-11" variant="ghost" onClick={() => void onStatus(training.id, "cancelled")}>Avlys</Button><DeleteButton label="Slett trening" description="Treningen, øvelsesplanen og oppmøtet blir slettet." onConfirm={() => void onDelete(training.id)} /></> : <Button className="min-h-11" variant="outline" onClick={() => void onStatus(training.id, "planned")}>Åpne igjen</Button>}</div>
    </article>;
}

function ExerciseLibrary({ exercises, loading, onAdd, onEdit, onDelete }: { exercises: Exercise[]; loading: boolean; onAdd: () => void; onEdit: (exercise: Exercise) => void; onDelete: (id: number) => Promise<boolean> }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExerciseCategory | "all">("all");
  const filtered = useMemo(() => exercises.filter((exercise) => {
    const matchesCategory = category === "all" || exercise.category === category;
    const haystack = `${exercise.title} ${exercise.description} ${exercise.equipment}`.toLowerCase();
    return matchesCategory && haystack.includes(query.trim().toLowerCase());
  }), [category, exercises, query]);

  if (loading) return <LoadingCards />;
  return <div>
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><Input className="h-11 pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Søk etter øvelse eller utstyr" /></div>
      <Button className="min-h-11 sm:hidden" onClick={onAdd}><Plus /> Ny øvelse</Button>
    </div>
    <div className="scrollbar-none -mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
      <FilterChip active={category === "all"} onClick={() => setCategory("all")}>Alle</FilterChip>
      {categories.map((key) => <FilterChip key={key} active={category === key} onClick={() => setCategory(key)}>{categoryMeta[key].label}</FilterChip>)}
    </div>
    {filtered.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed p-8 text-center"><Search className="mx-auto size-8 text-slate-400" /><p className="mt-3 font-semibold">Ingen øvelser funnet</p><p className="mt-1 text-sm text-muted-foreground">Prøv en annen kategori eller opprett en ny øvelse.</p></div> : <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((exercise) => <ExerciseCard key={exercise.id} exercise={exercise} onEdit={() => onEdit(exercise)} onDelete={exercise.seedKey ? undefined : () => void onDelete(exercise.id)} />)}</div>}
  </div>;
}

function ExerciseCard({ exercise, onEdit, onDelete, addLabel, onAdd, added }: { exercise: Exercise; onEdit?: () => void; onDelete?: () => void; addLabel?: string; onAdd?: () => void; added?: boolean }) {
  const meta = categoryMeta[exercise.category];
  const Icon = meta.icon;
  return <article className="flex h-full flex-col rounded-2xl border bg-white p-4 shadow-sm">
    <div className="flex items-start gap-3"><span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${meta.soft} ${meta.color}`}><Icon className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-1.5"><Badge className={`${meta.soft} ${meta.color}`} variant="secondary">{meta.label}</Badge>{exercise.seedKey && <Badge variant="outline">Standard</Badge>}</div><h3 className="mt-2 text-base font-bold leading-5">{exercise.title}</h3></div></div>
    <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{exercise.description}</p>
    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground"><Badge variant="outline"><Clock3 /> {exercise.durationMinutes} min</Badge>{exercise.equipment && <Badge variant="outline">{exercise.equipment}</Badge>}</div>
    {exercise.sourceUrl && <a className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-semibold text-primary underline-offset-4 hover:underline" href={exercise.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Se video/illustrasjon{exercise.sourceTitle ? ` · ${exercise.sourceTitle}` : ""}</a>}
    <div className="mt-3 flex gap-2 border-t pt-3">{onAdd ? <Button className="min-h-11 flex-1" disabled={added} variant={added ? "secondary" : "default"} onClick={onAdd}>{added ? "Lagt til" : <><Plus />{addLabel || "Legg til"}</>}</Button> : <Button className="min-h-11 flex-1" variant="outline" onClick={onEdit}><Pencil /> Rediger</Button>}{onDelete && <DeleteButton label="Slett øvelse" description="Øvelsen fjernes også fra treningsplaner der den er brukt." onConfirm={onDelete} />}</div>
  </article>;
}

function ExerciseDialog({ open, saving, exercise, onOpenChange, onSave }: { open: boolean; saving: boolean; exercise: Exercise | null; onOpenChange: (open: boolean) => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [title, setTitle] = useState(exercise?.title ?? "");
  const [category, setCategory] = useState<ExerciseCategory>(exercise?.category ?? "warmup");
  const [duration, setDuration] = useState(String(exercise?.durationMinutes ?? 10));
  const [description, setDescription] = useState(exercise?.description ?? "");
  const [equipment, setEquipment] = useState(exercise?.equipment ?? "");
  const [sourceTitle, setSourceTitle] = useState(exercise?.sourceTitle ?? "");
  const [sourceUrl, setSourceUrl] = useState(exercise?.sourceUrl ?? "");
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><form onSubmit={(event) => { event.preventDefault(); void onSave({ id: exercise?.id, title, category, durationMinutes: Number(duration), description, equipment, sourceTitle, sourceUrl }); }}><DialogHeader><DialogTitle>{exercise ? "Rediger øvelse" : "Ny øvelse"}</DialogTitle><DialogDescription>Øvelsen blir tilgjengelig når du planlegger nye treninger.</DialogDescription></DialogHeader><div className="grid gap-x-4 py-3 sm:grid-cols-2"><Field label="Tittel" htmlFor="exercise-title"><Input id="exercise-title" autoFocus required value={title} onChange={(event) => setTitle(event.target.value)} /></Field><Field label="Kategori" htmlFor="exercise-category"><Select value={category} onValueChange={(value) => setCategory(value as ExerciseCategory)}><SelectTrigger id="exercise-category" className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{categories.map((key) => <SelectItem key={key} value={key}>{categoryMeta[key].label}</SelectItem>)}</SelectContent></Select></Field><Field label="Anslått tid" htmlFor="exercise-duration"><Input id="exercise-duration" min="1" type="number" value={duration} onChange={(event) => setDuration(event.target.value)} /></Field><Field label="Utstyr" htmlFor="exercise-equipment"><Input id="exercise-equipment" value={equipment} onChange={(event) => setEquipment(event.target.value)} placeholder="Baller, kjegler, vester …" /></Field><Field className="sm:col-span-2" label="Beskrivelse" htmlFor="exercise-description"><Textarea id="exercise-description" required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Organisering, gjennomføring og viktige fokuspunkter" /></Field><Field label="Navn på kilde" htmlFor="exercise-source"><Input id="exercise-source" value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="Valgfritt" /></Field><Field label="Lenke til video/illustrasjon" htmlFor="exercise-url"><Input id="exercise-url" inputMode="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" /></Field></div><DialogFooter><Button className="min-h-11" disabled={saving || !title.trim() || !description.trim()} type="submit">{saving ? "Lagrer …" : "Lagre øvelse"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function TrainingPlannerDialog({ open, saving, training, data, onOpenChange, onSave }: { open: boolean; saving: boolean; training: Training | null; data: TrainingData; onOpenChange: (open: boolean) => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [date, setDate] = useState(training?.date ?? "");
  const [startTime, setStartTime] = useState(training?.startTime ?? "");
  const [duration, setDuration] = useState(String(training?.durationMinutes ?? 60));
  const [title, setTitle] = useState(training?.title ?? "Lagstrening");
  const [theme, setTheme] = useState<TrainingTheme | "">((training?.theme as TrainingTheme) ?? "");
  const [plan, setPlan] = useState(training?.plan ?? "");
  const [notes, setNotes] = useState(training?.notes ?? "");
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>(training ? data.attendance.filter((entry) => entry.trainingId === training.id).map((entry) => entry.playerId) : []);
  const [items, setItems] = useState<PlannerItem[]>(training ? data.trainingExercises.filter((item) => item.trainingId === training.id).map((item) => ({ ...item, clientKey: `saved-${item.id}` })) : []);
  const [pickerSection, setPickerSection] = useState<TrainingSectionKey | null>(null);
  const [pickerCategory, setPickerCategory] = useState<ExerciseCategory | "all">("all");
  const [pickerQuery, setPickerQuery] = useState("");

  const plannedMinutes = items.reduce((sum, item) => sum + item.durationMinutes, 0);
  const locked = Boolean(training && training.status !== "planned");
  const activePlayers = data.players.filter((player) => Boolean(player.active));
  const pickerExercises = data.exercises.filter((exercise) => (pickerCategory === "all" || exercise.category === pickerCategory) && `${exercise.title} ${exercise.description}`.toLowerCase().includes(pickerQuery.trim().toLowerCase()));

  function togglePlayer(playerId: number, checked: boolean) {
    setSelectedPlayers((current) => checked ? [...current, playerId] : current.filter((id) => id !== playerId));
  }

  function addExercise(exercise: Exercise) {
    if (!pickerSection || items.some((item) => item.section === pickerSection && item.exerciseId === exercise.id)) return;
    const nextOrder = Math.max(-1, ...items.filter((item) => item.section === pickerSection).map((item) => item.sortOrder)) + 1;
    setItems((current) => [...current, { clientKey: `new-${Date.now()}-${exercise.id}-${pickerSection}`, exerciseId: exercise.id, section: pickerSection, sortOrder: nextOrder, durationMinutes: exercise.durationMinutes, notes: "" }]);
  }

  function moveItem(item: PlannerItem, direction: -1 | 1) {
    const ordered = items.filter((candidate) => candidate.section === item.section).sort((a, b) => a.sortOrder - b.sortOrder);
    const index = ordered.findIndex((candidate) => candidate.clientKey === item.clientKey);
    const other = ordered[index + direction];
    if (!other) return;
    setItems((current) => current.map((candidate) => candidate.clientKey === item.clientKey ? { ...candidate, sortOrder: other.sortOrder } : candidate.clientKey === other.clientKey ? { ...candidate, sortOrder: item.sortOrder } : candidate));
  }

  function normalizedItems() {
    return sections.flatMap((section) => items.filter((item) => item.section === section).sort((a, b) => a.sortOrder - b.sortOrder).map((item, index) => ({ exerciseId: item.exerciseId, section, sortOrder: index, durationMinutes: item.durationMinutes, notes: item.notes })));
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="h-[96dvh] max-h-[96dvh] w-[calc(100%-1rem)] max-w-6xl overflow-x-hidden overflow-y-auto p-4 sm:p-6"><form className="min-w-0" onSubmit={(event) => { event.preventDefault(); if (!locked) void onSave({ id: training?.id, date, startTime, durationMinutes: Number(duration), title, theme, plan, notes, playerIds: selectedPlayers, exerciseItems: normalizedItems() }); }}><DialogHeader><DialogTitle>{locked ? "Gjennomført trening" : training ? "Rediger treningsplan" : "Ny treningsplan"}</DialogTitle><DialogDescription>{locked ? "Treningen er låst. Åpne den igjen fra treningslisten for å gjøre endringer." : "Bygg økten i tre deler. Planen lagres og kan åpnes direkte på iPad i hallen."}</DialogDescription></DialogHeader>
    <fieldset disabled={locked} className="mt-4 min-w-0 space-y-4 disabled:opacity-75">
      <aside className="min-w-0 rounded-2xl border bg-slate-50/70 p-4"><h3 className="font-bold">Praktisk informasjon</h3><div className="grid gap-x-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }}><Field label="Dato" htmlFor="training-date"><Input id="training-date" className="h-11 bg-white" type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></Field><Field label="Starttid" htmlFor="training-time"><Input id="training-time" className="h-11 bg-white" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></Field><Field label="Planlagt varighet" htmlFor="training-duration"><Input id="training-duration" className="h-11 bg-white" min="1" type="number" value={duration} onChange={(event) => setDuration(event.target.value)} /></Field><Field label="Navn på treningen" htmlFor="training-title"><Input id="training-title" className="h-11 bg-white" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Lagstrening" /></Field><Field label="Hovedtema" htmlFor="training-theme"><Select value={theme || "none"} onValueChange={(value) => setTheme(value === "none" ? "" : value as TrainingTheme)}><SelectTrigger id="training-theme" className="h-11 w-full bg-white"><SelectValue placeholder="Velg tema" /></SelectTrigger><SelectContent><SelectItem value="none">Ikke valgt</SelectItem>{trainingThemeOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></Field><Field className="col-span-full" label="Fokus/rammer" htmlFor="training-plan"><Textarea id="training-plan" className="bg-white" value={plan} onChange={(event) => setPlan(event.target.value)} placeholder="Dagens mål, organisering eller beskjeder" /></Field><div className="col-span-full mt-4 rounded-xl border bg-white p-3"><p className="text-xs font-semibold text-muted-foreground">Tid i øvelsesplanen</p><p className="mt-1 text-2xl font-bold">{plannedMinutes} min</p><p className={`mt-1 text-xs ${plannedMinutes > Number(duration) ? "text-red-600" : "text-muted-foreground"}`}>{plannedMinutes > Number(duration) ? `${plannedMinutes - Number(duration)} min over planlagt tid` : `${Math.max(0, Number(duration) - plannedMinutes)} min ledig`}</p></div></div></aside>
      <div className="grid min-w-0 gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}>{sections.map((section) => <PlanSection key={section} section={section} items={items.filter((item) => item.section === section).sort((a, b) => a.sortOrder - b.sortOrder)} exercises={data.exercises} onAdd={() => setPickerSection(section)} onRemove={(clientKey) => setItems((current) => current.filter((item) => item.clientKey !== clientKey))} onMove={moveItem} onDuration={(clientKey, value) => setItems((current) => current.map((item) => item.clientKey === clientKey ? { ...item, durationMinutes: Number.isFinite(value) ? Math.max(1, value) : 1 } : item))} />)}</div>
      <div className="grid min-w-0 gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}><div className="min-w-0 rounded-2xl border p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">Oppmøte</h3><Badge className="shrink-0" variant="secondary">{selectedPlayers.length} valgt</Badge></div><div className="mt-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))" }}>{activePlayers.length ? activePlayers.map((player) => <label key={player.id} className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl bg-slate-50 px-3 text-sm font-medium"><Checkbox className="shrink-0" checked={selectedPlayers.includes(player.id)} onCheckedChange={(checked) => togglePlayer(player.id, checked === true)} /><span className="min-w-0 break-words">{player.name}</span></label>) : <p className="text-sm text-muted-foreground">Ingen aktive spillere er registrert.</p>}</div></div><div className="min-w-0 rounded-2xl border p-4"><h3 className="font-bold">Kommentar etter treningen</h3><Textarea className="mt-3 min-h-32" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Hva fungerte? Hva bør følges opp neste gang?" /></div></div>
    </fieldset>
    <DialogFooter className="sticky bottom-0 -mx-4 mt-5 border-t bg-white/95 px-4 pb-1 pt-4 backdrop-blur sm:-mx-6 sm:px-6">{locked ? <Button className="min-h-12 w-full sm:w-auto" type="button" onClick={() => onOpenChange(false)}>Lukk</Button> : <Button className="min-h-12 w-full sm:w-auto" disabled={saving || !date || !title.trim()} type="submit">{saving ? "Lagrer …" : "Lagre treningsplan"}</Button>}</DialogFooter>
  </form>
  <Sheet open={Boolean(pickerSection)} onOpenChange={(isOpen) => { if (!isOpen) setPickerSection(null); }}><SheetContent className="w-[94vw] sm:max-w-xl"><SheetHeader><SheetTitle>Legg til i {pickerSection ? sectionMeta[pickerSection].label.toLowerCase() : "økten"}</SheetTitle><SheetDescription>Velg en eller flere øvelser fra banken.</SheetDescription></SheetHeader><div className="px-4"><div className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><Input className="h-11 pl-9" value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} placeholder="Søk i øvelsesbanken" /></div><div className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2"><FilterChip active={pickerCategory === "all"} onClick={() => setPickerCategory("all")}>Alle</FilterChip>{categories.map((key) => <FilterChip key={key} active={pickerCategory === key} onClick={() => setPickerCategory(key)}>{categoryMeta[key].label}</FilterChip>)}</div></div><div className="flex-1 space-y-3 overflow-y-auto px-4 pb-6">{pickerExercises.map((exercise) => <ExerciseCard key={exercise.id} exercise={exercise} added={Boolean(pickerSection && items.some((item) => item.section === pickerSection && item.exerciseId === exercise.id))} onAdd={() => addExercise(exercise)} />)}</div></SheetContent></Sheet>
  </DialogContent></Dialog>;
}

function PlanSection({ section, items, exercises, onAdd, onRemove, onMove, onDuration }: { section: TrainingSectionKey; items: PlannerItem[]; exercises: Exercise[]; onAdd: () => void; onRemove: (clientKey: string) => void; onMove: (item: PlannerItem, direction: -1 | 1) => void; onDuration: (clientKey: string, value: number) => void }) {
  const meta = sectionMeta[section];
  const Icon = meta.icon;
  const minutes = items.reduce((sum, item) => sum + item.durationMinutes, 0);
  return <section className={`rounded-2xl border p-3 ${meta.color}`}><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-white"><Icon className="size-4" /></span><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Del {meta.short}</p><h3 className="font-bold">{meta.label}</h3></div></div><Badge variant="outline" className="bg-white">{minutes} min</Badge></div><div className="mt-3 space-y-2">{items.length ? items.map((item, index) => { const exercise = exercises.find((candidate) => candidate.id === item.exerciseId); return <div key={item.clientKey} className="rounded-xl border bg-white p-3 shadow-sm"><div className="flex items-start justify-between gap-2"><p className="text-sm font-bold leading-5">{exercise?.title || "Ukjent øvelse"}</p><button aria-label="Fjern øvelse" className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" type="button" onClick={() => onRemove(item.clientKey)}><X className="size-4" /></button></div><div className="mt-2 flex items-center gap-2"><Input aria-label="Tidsbruk i minutter" className="h-10 w-20" min="1" type="number" value={item.durationMinutes} onChange={(event) => onDuration(item.clientKey, Number(event.target.value))} /><span className="text-xs text-muted-foreground">min</span><div className="ml-auto flex gap-1"><Button aria-label="Flytt opp" disabled={index === 0} size="icon-sm" type="button" variant="ghost" onClick={() => onMove(item, -1)}><ArrowUp /></Button><Button aria-label="Flytt ned" disabled={index === items.length - 1} size="icon-sm" type="button" variant="ghost" onClick={() => onMove(item, 1)}><ArrowDown /></Button></div></div></div>; }) : <p className="rounded-xl border border-dashed bg-white/60 p-3 text-center text-xs text-muted-foreground">Ingen øvelser ennå</p>}</div><Button className="mt-3 min-h-11 w-full bg-white" type="button" variant="outline" onClick={onAdd}><Plus /> Legg til øvelse</Button></section>;
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition ${active ? "border-primary bg-primary text-primary-foreground" : "bg-white text-slate-600 hover:bg-slate-50"}`}>{children}</button>;
}

function DeleteButton({ label, description, onConfirm }: { label: string; description: string; onConfirm: () => void }) {
  return <AlertDialog><AlertDialogTrigger asChild><Button aria-label={label} className="min-h-11 min-w-11" size="icon-sm" variant="ghost"><Trash2 /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{label}?</AlertDialogTitle><AlertDialogDescription>{description} Dette kan ikke angres.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Avbryt</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={onConfirm}>Slett</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

function Field({ label, htmlFor, className = "", children }: { label: string; htmlFor: string; className?: string; children: React.ReactNode }) {
  return <div className={`mt-4 ${className}`}><label className="mb-2 block text-sm font-semibold" htmlFor={htmlFor}>{label}</label>{children}</div>;
}

function LoadingCards() {
  return <div className="grid gap-3 md:grid-cols-2">{[1, 2, 3, 4].map((number) => <div key={number} className="h-44 animate-pulse rounded-2xl bg-slate-100" />)}</div>;
}

function EmptyTraining({ onAdd }: { onAdd: () => void }) {
  return <div className="rounded-2xl border border-dashed p-8 text-center"><Dumbbell className="mx-auto size-8 text-slate-400" /><p className="mt-3 font-semibold">Ingen treninger lagt inn</p><p className="mt-1 text-sm text-muted-foreground">Lag den første planen med oppvarming, teknikkøving og kamptrening.</p><Button className="mt-4 min-h-11" onClick={onAdd}><Plus /> Ny trening</Button></div>;
}

function TrainingStatusBadge({ status }: { status: TrainingStatus }) {
  const meta = status === "completed" ? { label: "Gjennomført", className: "bg-emerald-100 text-emerald-800" } : status === "cancelled" ? { label: "Avlyst", className: "bg-red-100 text-red-800" } : { label: "Planlagt", className: "bg-slate-100 text-slate-700" };
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

function formatDate(value: string) {
  if (!value) return "Dato ikke satt";
  return new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric" }).format(new Date(`${value}-01T12:00:00`));
}

function groupTrainingsByMonth(trainings: Training[], currentMonth: string) {
  const groups = new Map<string, Training[]>();
  for (const training of trainings) {
    const key = training.date.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), training]);
  }

  return [...groups.entries()]
    .map(([key, entries]) => ({ key, trainings: entries.sort((a, b) => `${a.date}|${a.startTime}`.localeCompare(`${b.date}|${b.startTime}`)) }))
    .sort((a, b) => {
      if (a.key === currentMonth) return -1;
      if (b.key === currentMonth) return 1;
      const aIsFuture = a.key > currentMonth;
      const bIsFuture = b.key > currentMonth;
      if (aIsFuture !== bIsFuture) return aIsFuture ? 1 : -1;
      return aIsFuture ? a.key.localeCompare(b.key) : b.key.localeCompare(a.key);
    });
}
