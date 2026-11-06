/*
 * Opérations partagées entre les écrans et le Coach : la même fonction sert au bouton et à l'action proposée
 * dans la conversation. Chacune renvoie un court message de confirmation, ou null si rien n'a été fait.
 */
import { DRILL, type DrillId } from "@/content/verbe";
import { gain } from "@/engine/core";
import { POINTS } from "@/engine/scoring";
import type { BizOption, Chantier, PillarId, Profile } from "@/engine/types";
import { dayKey, weekKey } from "@/lib/format";
import { useStore } from "@/store";
import { gainToast } from "@/store/ui";
import { create } from "zustand";
import * as C from "./contremaitre";

const act = <T,>(fn: (c: Chantier) => T): T => useStore.getState().act(fn);
const get = () => { const s = useStore.getState(); return (s.demo ?? s.chantier)!; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export { weekKey };

/* ---------------- Corps ---------------- */
/**
 * Prépare la séance du jour, ou MODIFIE celle qui existe déjà : la séance actuelle et les demandes déjà
 * appliquées partent avec la consigne, seule la nouvelle demande s'ajoute. `neuf` repart de zéro.
 */
export async function prepareSeance(a: Partial<{ minutes: number; energie: string; materiel: string[]; douleur: string; demande: string; neuf: boolean }> = {}) {
  const c = get();
  if (c.seanceStart !== null) return "Une séance est en cours : termine-la d'abord.";
  const cur = c.plans.seance?.date === dayKey(Date.now()) && !a.neuf ? c.plans.seance : null;
  const prev = cur?.conditions;
  const cond = {
    minutes: a.minutes ?? prev?.minutes ?? c.profile?.corps.minutes ?? 40, energie: a.energie || prev?.energie || "normale",
    materiel: a.materiel ?? prev?.materiel ?? c.profile?.corps.materiel ?? [], douleur: a.douleur ?? prev?.douleur ?? "",
  };
  const demande = (a.demande ?? "").trim();
  const demandes = cur?.demandes ?? [];
  const actuelle = cur ? { seance: { titre: cur.titre, focus: cur.focus, duree: cur.duree, echauffement: cur.echauffement, exos: cur.exos, retourAuCalme: cur.retourAuCalme }, demandes } : undefined;
  const r = await C.genSeance({ ...cond, demande }, actuelle);
  if (!r) return null;
  act((d) => { d.plans.seance = { date: dayKey(Date.now()), ...r, conditions: cond, demandes: demande ? [...demandes, demande].slice(-8) : demandes }; });
  return cur ? `Séance modifiée : ${r.ajustement || r.titre}` : `Séance prête : ${r.titre}, ${r.duree} min.`;
}
export async function remakeProgramme(demande = "") {
  const r = await C.genProgramme(demande);
  if (!r) return null;
  act((d) => { d.plans.programme = { ts: Date.now(), ...r }; if (d.seanceStart === null) d.plans.seance = null; });
  return `Programme refait : ${r.titre}.`;
}

/* ---------------- Capital ---------------- */
/** Enregistre la réponse à la question en cours, puis demande la suivante. */
export async function interviewStep(answer?: string) {
  const c = get();
  const qa = [...c.capital.interview];
  if (answer !== undefined && c.capital.ask) qa.push({ q: c.capital.ask.q, a: answer });
  act((d) => { d.capital.interview = qa; });
  const r = await C.interviewNext(qa);
  if (!r) return null;
  const done = r.fini || !r.question || qa.length >= 10;
  act((d) => { d.capital.ask = done ? null : { q: r.question, choix: r.choix }; d.capital.diagDone = done; });
  return done ? "Diagnostic terminé." : r.question;
}
export async function makeOptions(demande = "") {
  const r = await C.genOptions(demande);
  if (!r) return null;
  act((d) => { d.capital.options = r.options.map((o) => ({ ...o, id: uid() })); d.capital.diagDone = true; d.capital.ask = null; });
  return `${r.options.length} pistes prêtes.`;
}
export function chooseThesis(o: BizOption, objectifMois: number) {
  act((d) => { d.capital.thesis = { ts: Date.now(), option: o, objectifMois: Math.max(0, Math.round(objectifMois)) }; d.capital.sprint = null; });
  return `Piste choisie : ${o.nom}.`;
}
export async function makeSprint() {
  const r = await C.genSprint();
  if (!r) return null;
  act((d) => { d.capital.sprint = { semaine: weekKey(Date.now()), objectif: r.objectif, kpis: r.kpis.map((k) => ({ id: uid(), label: k.label, cible: k.cible, fait: 0 })), script: r.script }; });
  return `Sprint de la semaine : ${r.objectif}`;
}
/** Une action de la semaine (+1 sur un indicateur) : compte comme une action du jour. */
export function bumpKpi(id: string, delta = 1) {
  const c = get(); const k = c.capital.sprint?.kpis.find((x) => x.id === id);
  if (!k) return null;
  const r = act((d) => {
    const x = d.capital.sprint?.kpis.find((y) => y.id === id); if (!x) return null;
    x.fait = Math.max(0, x.fait + delta);
    if (delta <= 0) return null;
    d.missionLog.push({ ts: Date.now(), text: `${x.label} : ${x.fait}/${x.cible}` });
    if (d.missionLog.length > 400) d.missionLog = d.missionLog.slice(-400);
    return gain(d, "capital", POINTS.missionAction, Date.now());
  });
  if (r) gainToast("capital", r);
  return `${k.label} : ${k.fait + delta}/${k.cible}`;
}
export function addProspect(nom: string, note = "", stage = 0) {
  const n = nom.trim(); if (n.length < 2) return null;
  const now = Date.now();
  const r = act((d) => {
    d.capital.prospects.push({ id: uid(), nom: n.slice(0, 60), note: note.trim().slice(0, 200), stage, ts: now, maj: now });
    d.missionLog.push({ ts: now, text: `Prospect ajouté : ${n}` });
    return gain(d, "capital", POINTS.missionAction, now);
  });
  gainToast("capital", r);
  return `${n} ajouté à l'entonnoir.`;
}
export function moveProspect(id: string, stage: number, note?: string) {
  act((d) => {
    const p = d.capital.prospects.find((x) => x.id === id); if (!p) return;
    p.stage = Math.max(0, Math.min(4, stage)); p.maj = Date.now();
    if (note !== undefined) p.note = note.slice(0, 200);
  });
}

/* ---------------- Esprit ---------------- */
export async function makeMap() {
  const r = await C.genMap();
  if (!r) return null;
  act((d) => { d.knowledgeMap = { ts: Date.now(), domaines: r.domaines }; });
  return `Carte du savoir : ${r.domaines.reduce((a, x) => a + x.sujets.length, 0)} sujets.`;
}
export function studyTopic(titre: string, domaine: string) {
  const c = get();
  if (c.esprit.some((e) => dayKey(e.ts) === dayKey(Date.now()))) return "Sujet du jour déjà fait. Celui-ci t'attend demain.";
  act((d) => { d.espritChoice = { date: dayKey(Date.now()), titre: titre.slice(0, 100), domaine: domaine.slice(0, 40) || "libre", source: "libre", fiche: null }; });
  return `Sujet du jour : ${titre}.`;
}
export async function makeParcours(theme: string) {
  const r = await C.genParcours(theme);
  if (!r) return null;
  const id = "p" + Date.now();
  act((d) => { d.parcours.push({ id, theme, pourquoi: r.pourquoi, sujets: r.sujets, index: 0, ts: Date.now() }); d.parcoursActif = id; });
  return `Parcours « ${theme} » : ${r.sujets.length} sujets.`;
}

/* ---------------- Verbe ---------------- */
/** Exercice demandé (par le Coach ou un bouton) : la vue Verbe l'ouvre dès qu'elle est affichée. */
export const useDrillRequest = create<{ drill: DrillId | null; sujet: string }>()(() => ({ drill: null, sujet: "" }));
export function requestDrill(drill: DrillId, sujet = "") {
  if (!DRILL[drill]) return null;
  useDrillRequest.setState({ drill, sujet });
  return `Exercice prêt : ${DRILL[drill].nom}.`;
}

/* ---------------- Profil ---------------- */
type Fields = { [K in PillarId]: (keyof Profile[K])[] };
export const EDITABLE: Fields = {
  corps: ["contraintes", "activites", "minutes", "seancesParSemaine", "poids", "materiel", "niveau"],
  capital: ["situation", "competences", "ressources", "heuresParSemaine", "budget", "interets", "objectif", "dejaFait", "refus"],
  esprit: ["domaines", "pourquoi", "niveau"],
  verbe: ["contexte", "objectif"],
};
/** Met à jour un champ du profil (liste blanche, types respectés). */
export function setProfileField(pilier: string, champ: string, valeur: unknown) {
  const c = get();
  if (!c.profile || !(pilier in EDITABLE)) return null;
  const id = pilier as PillarId;
  if (!(EDITABLE[id] as string[]).includes(champ)) return null;
  const cur = (c.profile[id] as unknown as Record<string, unknown>)[champ];
  let v: unknown;
  if (typeof cur === "number" || cur === null) { const n = Number(valeur); if (!Number.isFinite(n)) return null; v = Math.round(n); }
  else if (Array.isArray(cur)) v = (Array.isArray(valeur) ? valeur : String(valeur).split(/[,;]/)).map((x) => String(x).trim()).filter(Boolean).slice(0, 14);
  else if (champ === "niveau") { if (!["debutant", "intermediaire", "avance"].includes(String(valeur))) return null; v = String(valeur); }
  else v = String(valeur ?? "").slice(0, 400);
  act((d) => { if (d.profile) { (d.profile[id] as unknown as Record<string, unknown>)[champ] = v; d.profile.updated = Date.now(); } });
  return "Profil mis à jour.";
}
