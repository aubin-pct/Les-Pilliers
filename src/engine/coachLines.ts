/* Phrases locales du Coach (sans IA, ou quand le plancher du jour est déjà posé) : une ligne, chiffrée. */
import { PILLAR_IDS } from "@/content/pillars";
import { DRILL, SKILLS } from "@/content/verbe";
import { TESTS } from "@/content/corps";
import { doneToday } from "./core";
import { dueRevisions, hesit } from "./insights";
import { bestOf } from "./scoring";
import { eloSkills, suggestDrill } from "./eloquence";
import type { Chantier, ChatScope } from "./types";
import { DAY, dayKey, f0, f1, plural, startOfDay } from "@/lib/format";

export function monthCash(c: Chantier, now: number) {
  const d = new Date(now), m0 = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  return c.missions.filter((m) => m.ts >= m0).reduce((a, m) => a + m.amount, 0);
}

export function localLine(c: Chantier, scope: ChatScope, now: number): string {
  const today = dayKey(now);
  switch (scope) {
    case "temple": {
      if (c.pending.length) return `${c.pending.length} ${plural(c.pending.length, "compte")} à rendre. Tes gains sont divisés par deux.`;
      const k = PILLAR_IDS.filter((id) => doneToday(c, id, now)).length;
      const h = Math.floor((startOfDay(now) + DAY - now) / 3600e3);
      return k === 4 ? "4 sur 4. Journée tenue. Demain, plus haut." : `${k} plancher${k > 1 ? "s" : ""} sur 4. Il reste ${h} h.`;
    }
    case "corps": {
      if (doneToday(c, "corps", now)) {
        const t = TESTS.find((T) => bestOf(c, T.id) !== null);
        return t ? `Posé. Prochain cap : battre ${bestOf(c, t.id)} ${t.unit} au ${t.name.toLowerCase()}.` : "Posé. Passe un test étalon : c'est lui qui fait monter.";
      }
      const p = c.plans.seance?.date === today ? c.plans.seance : null;
      return p ? `${p.titre}. ${p.duree} minutes. Lance.` : `Pas de séance aujourd'hui. ${c.profile?.corps.minutes ?? 40} minutes, maintenant.`;
    }
    case "capital": {
      const k = c.capital;
      if (!k.thesis) return k.options ? "Trois pistes sur la table. Choisis-en une." : k.interview.length ? `Diagnostic : ${k.interview.length} réponses. Termine-le.` : "Pas de plan, pas d'argent. Diagnostic : 5 minutes.";
      const kpi = k.sprint?.kpis.find((x) => x.fait < x.cible);
      if (doneToday(c, "capital", now)) return `Action posée. ${f0(monthCash(c, now))} € ce mois, objectif ${f0(k.thesis.objectifMois)} €.`;
      return kpi ? `${kpi.label} : ${kpi.fait} sur ${kpi.cible}. Une de plus, aujourd'hui.` : `${f0(monthCash(c, now))} € ce mois. Objectif ${f0(k.thesis.objectifMois)} €.`;
    }
    case "esprit": {
      const due = dueRevisions(c, now).length;
      const e = c.esprit.find((x) => dayKey(x.ts) === today);
      if (e) return `${e.note}/10 sur « ${e.topic} ». ${due ? `${due} ${plural(due, "révision")} en attente.` : "Demain, un autre."}`;
      if (due) return `${due} ${plural(due, "révision")} ${plural(due, "due")}. Ce qui n'est pas révisé s'efface.`;
      const ch = c.espritChoice?.date === today ? c.espritChoice : null;
      return ch ? `« ${ch.titre} ». 120 mots, de mémoire.` : "Choisis un sujet sur ta carte. Un par jour.";
    }
    case "verbe": {
      const o = c.orals.filter((x) => dayKey(x.ts) === today).pop();
      if (o) return `${f1(hesit(o))} hésitations par minute. Objectif : sous 3.`;
      const s = eloSkills(c), d = DRILL[suggestDrill(c)];
      const weak = SKILLS.filter((x) => s[x.id] !== null).sort((a, b) => (s[a.id] ?? 0) - (s[b.id] ?? 0))[0];
      return weak ? `${weak.nom} : ${s[weak.id]}/100. Ta pire note. Exercice : ${d.nom}.` : `Premier exercice : ${d.nom}. ${d.secs} secondes.`;
    }
  }
}

/** La ligne affichée : le brief IA du jour tant que le plancher n'est pas posé, sinon la phrase locale. */
export function coachLine(c: Chantier, scope: ChatScope, now: number): string {
  const done = scope === "temple" ? false : doneToday(c, scope, now);
  const ai = c.brief?.date === dayKey(now) ? c.brief.lines[scope] : undefined;
  // Capital sans piste : l'étape du diagnostic change dans la journée, la phrase locale la suit.
  const stale = (scope === "temple" && c.pending.length > 0) || (scope === "capital" && !c.capital.thesis);
  return !done && ai && !stale ? ai : localLine(c, scope, now);
}
