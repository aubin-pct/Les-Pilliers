/*
 * Le flux de données vers l'IA : pour chaque pilier, un dossier compact et chiffré construit à partir
 * 1. du profil déclaré, 2. des preuves enregistrées (historique), 3. de la mémoire du Contremaître.
 * Toutes les consignes passent par ici : on ajoute une donnée au contexte d'un seul endroit.
 */
import { PILLAR } from "@/content/pillars";
import { GOALS, LEVELS } from "@/content/profile";
import { TESTS } from "@/content/corps";
import { bestOf, currentMission } from "@/engine/scoring";
import { hesit } from "@/engine/insights";
import type { Chantier, ChatScope, PillarId } from "@/engine/types";
import { STAGES } from "@/content/capital";
import { eloSkills } from "@/engine/eloquence";
import { DAY, dayKey, f1, fdate } from "@/lib/format";

const lvl = (id: string) => LEVELS.find((l) => l.id === id)?.label ?? id;
const ago = (ts: number, now: number) => `il y a ${Math.max(0, Math.round((now - ts) / DAY))} j`;

function memory(c: Chantier, id: PillarId) {
  const m = c.memoire[id];
  return m ? { date: fdate(m.ts), synthese: m.synthese, forces: m.forces, faiblesses: m.faiblesses, priorite: m.priorite } : null;
}

function pillarState(c: Chantier, id: PillarId, now: number) {
  const h = c.hist.slice(-7)[0];
  return { hauteur: +c.p[id].s.toFixed(1), variation_7j: h ? +(c.p[id].s - h[id]).toFixed(1) : null, derniere_preuve: ago(c.p[id].last, now), erosion_jour: `${f1(PILLAR[id].rate * 100)} %` };
}

export function corpsContext(c: Chantier, now: number) {
  const p = c.profile?.corps;
  return {
    profil: p && {
      prenom: c.profile!.prenom || undefined,
      objectifs: p.objectifs.map((g) => GOALS.find((x) => x.id === g)?.label ?? g),
      niveau: lvl(p.niveau), age: p.age, poids_kg: p.poids, taille_cm: p.taille,
      materiel: p.materiel, seances_par_semaine: p.seancesParSemaine, minutes_par_seance: p.minutes,
      contraintes_blessures: p.contraintes || "aucune", autres_activites: p.activites || "aucune",
    },
    pilier: pillarState(c, "corps", now),
    records: TESTS.map((T) => ({ test: T.name, record: bestOf(c, T.id), unite: T.unit })).filter((r) => r.record !== null),
    dernieres_seances: c.seances.slice(-8).map((s) => ({
      date: fdate(s.ts), titre: s.type, minutes: s.dur, series: `${s.done}/${s.total}`, ressenti_effort: s.rpe ?? null, note: s.note || undefined,
      detail: s.logs?.map((l) => `${l.exo} : ${l.faits.map((x, k) => (x === null ? "×" : l.poids?.[k] != null ? `${x}@${l.poids[k]}kg` : x)).join(" / ")} (cible ${l.cible}${l.type === "duree" ? " s" : ""}${l.charge ? ", prévu " + l.charge : ""})`),
    })),
    seances_7_derniers_jours: c.seances.filter((s) => s.ts > now - 7 * DAY).length,
    seance_du_jour: c.plans.seance?.date === dayKey(now) ? {
      titre: c.plans.seance.titre, minutes: c.plans.seance.duree, commencee: c.seanceStart !== null,
      exercices: c.plans.seance.exos.map((e) => `${e.nom} ${e.series}×${e.cible}${e.type === "duree" ? " s" : ""}${e.charge ? " " + e.charge : ""}`),
      demandes_appliquees: c.plans.seance.demandes ?? [],
    } : null,
    programme: c.plans.programme && { titre: c.plans.programme.titre, semaine: c.plans.programme.semaine, progression: c.plans.programme.progression },
    memoire_du_contremaitre: memory(c, "corps"),
    jour: new Date(now).toLocaleDateString("fr-FR", { weekday: "long" }),
  };
}

export function capitalContext(c: Chantier, now: number) {
  const p = c.profile?.capital;
  const M = currentMission(c);
  return {
    profil: p && {
      situation: p.situation, competences: p.competences, ressources: p.ressources, heures_par_semaine: p.heuresParSemaine,
      budget_investissable_euros: p.budget, rapport_au_risque: p.risque, centres_interet: p.interets, objectif: p.objectif,
      deja_tente: p.dejaFait || "rien", refuse_de_faire: p.refus || "rien de précis",
    },
    pilier: pillarState(c, "capital", now),
    euros_gagnes_seul: c.euros,
    mises_perdues_euros: c.stakesLost,
    // Ancien système de missions : seulement tant qu'aucune piste n'est choisie.
    ...(c.capital.thesis ? {} : {
      feuille_de_route: c.roadmap && { vision: c.roadmap.vision, paliers: c.roadmap.paliers.map((x, i) => `${i < c.roadmap!.index ? "✓" : i === c.roadmap!.index ? "→" : "·"} ${x.titre}`) },
      mission_en_cours: M.done ? null : { titre: M.title, pourquoi: M.detail, preuve: M.proof, delai_jours: M.jours },
    }),
    encaissements: c.missions.slice(-8).map((m) => ({ date: fdate(m.ts), titre: m.title, montant: m.amount })),
    actions_recentes: c.missionLog.slice(-12).map((l) => `${fdate(l.ts)} : ${l.text}`),
    concepts_examines: c.concepts.slice(-10).map((x) => ({ concept: x.c, note: x.note })),
    mise_en_cours: c.stake && { montant: c.stake.amount, echeance: fdate(c.stake.deadline) },
    entretien_diagnostic: c.capital.interview,
    piste_choisie: c.capital.thesis && { ...c.capital.thesis.option, objectif_mensuel_euros: c.capital.thesis.objectifMois, choisie_le: fdate(c.capital.thesis.ts) },
    sprint_en_cours: c.capital.sprint && { semaine: c.capital.sprint.semaine, objectif: c.capital.sprint.objectif, indicateurs: c.capital.sprint.kpis.map((k) => `${k.label} : ${k.fait}/${k.cible}`) },
    entonnoir_prospects: STAGES.map((s, i) => ({ etape: s, nombre: c.capital.prospects.filter((p) => p.stage === i).length })),
    prospects_recents: c.capital.prospects.slice(-10).map((p) => ({ nom: p.nom, etape: STAGES[p.stage], note: p.note })),
    encaissements_30j: c.missions.filter((m) => m.ts > now - 30 * DAY).reduce((a, m) => a + m.amount, 0),
    memoire_du_contremaitre: memory(c, "capital"),
  };
}

export function espritContext(c: Chantier, now: number) {
  const p = c.profile?.esprit;
  const byDomain: Record<string, number> = {};
  c.esprit.forEach((e) => { if (e.domaine) byDomain[e.domaine] = (byDomain[e.domaine] ?? 0) + 1; });
  return {
    profil: p && { domaines_choisis: p.domaines, niveau: lvl(p.niveau), pourquoi: p.pourquoi },
    pilier: pillarState(c, "esprit", now),
    sujets_deja_traites: c.esprit.slice(-40).map((e) => `${e.topic} (${e.note}/10${e.stage >= 3 ? ", gravé" : ""})`),
    sujets_faibles: c.esprit.filter((e) => e.note < 6).slice(-8).map((e) => ({ sujet: e.topic, lacune: e.lacune })),
    repartition_par_domaine: byDomain,
    parcours_actif: activeParcours(c),
    carte_du_savoir: c.knowledgeMap && c.knowledgeMap.domaines.map((d) => ({ domaine: d.nom, a_acquerir: d.sujets.filter((x) => !c.esprit.some((e) => e.topic === x.titre)).slice(0, 6).map((x) => x.titre) })),
    memoire_du_contremaitre: memory(c, "esprit"),
  };
}

export function activeParcours(c: Chantier) {
  const p = c.parcours.find((x) => x.id === c.parcoursActif);
  return p ? { theme: p.theme, avancement: `${p.index}/${p.sujets.length}`, prochain: p.sujets[p.index]?.titre ?? null } : null;
}

export function verbeContext(c: Chantier, now: number) {
  const p = c.profile?.verbe;
  return {
    profil: p && { contexte: p.contexte || "non précisé", objectif: p.objectif || "non précisé" },
    pilier: pillarState(c, "verbe", now),
    derniers_oraux: c.orals.slice(-10).map((o) => ({
      date: fdate(o.ts), sujet: o.sujet, hesitations_min: +hesit(o).toFixed(1), mots_min: o.wpm, blancs_min: o.ppm, structure: o.structure,
      critique: o.verdict ? o.verdict.split("\n")[0] : undefined,
    })),
    sujets_recents: c.orals.slice(-15).map((o) => o.sujet),
    competences_0_100: eloSkills(c),
    exercices_recents: c.orals.slice(-8).map((o) => o.drill ?? "libre"),
    memoire_du_contremaitre: memory(c, "verbe"),
  };
}

export function pillarContext(c: Chantier, id: PillarId, now: number) {
  return { corps: corpsContext, capital: capitalContext, esprit: espritContext, verbe: verbeContext }[id](c, now);
}

/** Vue d'ensemble : les quatre piliers en une ligne chacun. */
export function templeContext(c: Chantier, now: number) {
  return {
    prenom: c.profile?.prenom || undefined,
    piliers: Object.fromEntries((["corps", "capital", "esprit", "verbe"] as PillarId[]).map((id) => [id, { ...pillarState(c, id, now), plancher_aujourdhui: !!c.days[dayKey(now)]?.[id], priorite: c.memoire[id]?.priorite }])),
    comptes_a_rendre: c.pending.length,
    excuses_30j: c.excuses.filter((e) => e.ts > now - 30 * DAY).length,
    euros_gagnes_seul: c.euros,
    piste_capital: c.capital.thesis?.option.nom,
    heure: new Date(now).getHours(),
  };
}

/** Ce que le Coach sait toujours de lui, quelle que soit la section. */
export function baseContext(c: Chantier, now: number) {
  const p = c.profile;
  return {
    prenom: p?.prenom || undefined,
    jours_depuis_le_debut: Math.max(0, Math.floor((now - c.created) / DAY)),
    corps: p && { objectifs: p.corps.objectifs.map((g) => GOALS.find((x) => x.id === g)?.label ?? g), niveau: lvl(p.corps.niveau), age: p.corps.age, poids_kg: p.corps.poids, taille_cm: p.corps.taille, contraintes: p.corps.contraintes || undefined },
    capital: p && { situation: p.capital.situation, objectif: p.capital.objectif, piste: c.capital.thesis?.option.nom },
    esprit: p && { domaines: p.esprit.domaines },
    verbe: p && { contexte: p.verbe.contexte || undefined, objectif: p.verbe.objectif || undefined },
    priorites_du_contremaitre: Object.fromEntries((["corps", "capital", "esprit", "verbe"] as PillarId[]).map((id) => [id, c.memoire[id]?.priorite]).filter(([, v]) => v)),
    hauteurs: Object.fromEntries((["corps", "capital", "esprit", "verbe"] as PillarId[]).map((id) => [id, +c.p[id].s.toFixed(1)])),
  };
}

export function scopeContext(c: Chantier, scope: ChatScope, now: number) {
  return scope === "temple" ? templeContext(c, now) : pillarContext(c, scope, now);
}

/** Excuses et victoires : ce qui sert à juger un manquement. */
export function excuseContext(c: Chantier, now: number) {
  return {
    registre_30j: c.excuses.filter((e) => e.ts > now - 30 * DAY).map((e) => ({ date: e.date, pilier: PILLAR[e.pillar].name, excuse: e.text, categorie: e.cat })),
    victoires: c.wins.slice(-6).map((w) => ({ date: fdate(w.ts), victoire: w.text })),
    jours_complets_recents: Object.entries(c.days).filter(([k, v]) => k >= dayKey(now - 14 * DAY) && Object.keys(v).length === 4).length,
  };
}
