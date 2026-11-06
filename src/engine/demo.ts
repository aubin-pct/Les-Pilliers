/* Démo : 47 jours simulés d'un utilisateur fictif, graine fixe. Jamais enregistrée. */
import { SEANCES, type TestId } from "@/content/corps";
import { CONCEPTS, LADDER } from "@/content/capital";
import { TOPICS } from "@/content/esprit";
import { SUBJECTS } from "@/content/verbe";
import { DAY, clamp, dayIndex, mulberry32, startOfDay } from "@/lib/format";
import { erode, freshChantier, gain, rollover, win } from "./core";
import { applyTest, avgOf, missionPoints, oralPoints, seanceGain } from "./scoring";
import { localVerdict } from "./verdicts";
import type { Chantier, Oral, PillarId } from "./types";
import { dayKey } from "@/lib/format";
import { demoProfile, fallbackProgramme, fallbackProposals, fallbackSeance, fallbackSubjects, ladderRoadmap } from "./fallbacks";

const EXCUSES: Record<PillarId, string[]> = {
  corps: ["Trop fatigué après les cours.", "Pas le temps, partiel demain.", "Il pleuvait, flemme."],
  capital: ["J'avais pas d'idée de mission.", "Trop de boulot à l'alternance."],
  esprit: ["Pas le temps.", "Fatigué, je lirai demain."],
  verbe: ["Mon coloc était là, j'ai pas osé parler seul.", "Fatigué.", "Pas envie aujourd'hui."],
};

export function buildDemo(now: number, N = 47): Chantier {
  const rnd = mulberry32(4747);
  const c = freshChantier(startOfDay(now) - N * DAY + 7 * 3600e3);
  c.p.corps.s = 14; c.p.capital.s = 6; c.p.esprit.s = 12; c.p.verbe.s = 8;
  let ei = 0, wpm = 104, tics = 7.2, blanks = 6.5;
  const best: Record<TestId, number> = { pompes: 17, tractions: 6, gainage: 68, squats: 36, souplesse: -7 };
  for (let i = N; i >= 1; i--) {
    const dStart = startOfDay(now) - i * DAY;
    const morning = dStart + 7.5 * 3600e3;
    erode(c, morning); rollover(c, morning);
    while (c.pending.length) {
      const pd = c.pending.shift()!;
      const arr = EXCUSES[pd.pillar];
      const text = arr[ei++ % arr.length];
      const v = localVerdict(c, pd.pillar, text, morning);
      c.excuses.push({ ts: morning, date: pd.date, pillar: pd.pillar, text, cat: v.cat, ok: v.ok, verdict: v.verdict });
    }
    const t = dStart + 18.5 * 3600e3;
    erode(c, t);
    const day = N - i, last = i === 1;
    // Corps
    if (last || rnd() < 0.82) {
      if (day % 7 === 3) {
        const k = (["pompes", "gainage", "squats", "souplesse"] as TestId[])[Math.floor(day / 7) % 4];
        const inc = { pompes: 2 + Math.round(rnd() * 2), tractions: 1, gainage: 8 + Math.round(rnd() * 10), squats: 2 + Math.round(rnd() * 3), souplesse: 1 + Math.round(rnd()) }[k];
        const v = rnd() < 0.18 ? best[k] - 1 : best[k] + inc;
        if (!c.tests.some((x) => x.kind === k)) applyTest(c, k, best[k] - inc, t - 3 * DAY, k === "pompes");
        best[k] = Math.max(best[k], v);
        applyTest(c, k, v, t, k === "pompes");
      } else {
        const dur = 22 + Math.round(rnd() * 25), checked = 3 + Math.round(rnd() * 2);
        c.seances.push({ ts: t, type: SEANCES[dayIndex(t) % SEANCES.length].title, dur, done: checked, total: 5, proof: String(Math.round(best.pompes * 0.6 + rnd() * 3)), timed: true });
        gain(c, "corps", seanceGain(dur, checked, 5), t);
      }
    }
    // Capital (les deux missions livrées tombent toujours aux jours 11 et 29)
    if (last || day === 11 || day === 29 || rnd() < 0.72) {
      if (day === 11 || day === 29) {
        const lvl = day === 11 ? 0 : 1, amount = day === 11 ? 45 : 60;
        const proof = day === 11 ? "Vendu mon ancien casque audio sur Leboncoin" : "2 h de cours de maths à un lycéen, 30 €/h";
        c.missions.push({ ts: t, level: lvl, title: LADDER[lvl].title, proof, amount, photo: null });
        c.euros += amount; c.missionLevel = lvl + 1;
        gain(c, "capital", missionPoints(lvl, amount, false), t);
        win(c, "capital", day === 11 ? "Premier euro gagné seul : 45 € (casque vendu)" : "Premier service facturé : 60 € de cours", t);
      } else if (rnd() < 0.5) {
        const note = 4 + Math.round(rnd() * 4);
        c.concepts.push({ ts: t, c: CONCEPTS[dayIndex(t) % CONCEPTS.length].name, ans: "", note, verdict: "" });
        gain(c, "capital", note * 0.6, t);
      } else {
        c.missionLog.push({ ts: t, text: ["Rédigé l'annonce de cours particuliers", "Demandé à 3 personnes ce qu'elles paieraient", "Comparé les prix des cours en ligne", "Posté l'offre dans le groupe de promo"][Math.floor(rnd() * 4)] });
        gain(c, "capital", 1.5, t);
      }
    }
    // Esprit
    if (last || rnd() < 0.76) {
      const topic = TOPICS[c.esprit.length % TOPICS.length].title;
      const note = 4 + Math.round(rnd() * 4.4);
      const stage = day < 30 ? Math.min(2, Math.floor((N - day) / 12)) : 0;
      c.esprit.push({ ts: t, topic, ans: "", note, verdict: "", lacune: "", objection: "", question: `Réexplique « ${topic} » en trois phrases.`, stage, next: t + [3, 10, 30][stage] * DAY });
      gain(c, "esprit", note, t);
      if (note >= 8) win(c, "esprit", `${note}/10 sur « ${topic} »`, t);
    }
    // Verbe
    if (!last && rnd() < 0.66) {
      wpm = clamp(wpm + (rnd() - 0.35) * 3.2, 95, 160);
      tics = clamp(tics - (rnd() - 0.3) * 0.35, 1.5, 10);
      blanks = clamp(blanks - (rnd() - 0.3) * 0.3, 1.2, 9);
      const prev = avgOf(c.orals, "h");
      const o: Oral = {
        ts: t, sujet: SUBJECTS[dayIndex(t) % SUBJECTS.length].text, secs: 90, words: Math.round(wpm * 1.5), wpm: Math.round(wpm),
        tpm: +tics.toFixed(1), ppm: +blanks.toFixed(1), pause: +(1 + rnd() * 2).toFixed(1), speak: +(0.7 + rnd() * 0.15).toFixed(2),
        ttr: +(0.52 + rnd() * 0.12).toFixed(2), longest: 18 + Math.round(rnd() * 14), h: +(tics + blanks).toFixed(1),
        env: Array.from({ length: 72 }, () => (rnd() < 0.12 ? +(rnd() * 0.08).toFixed(2) : +(0.35 + rnd() * 0.6).toFixed(2))),
        text: "", audio: false, verdict: "", structure: null,
      };
      c.orals.push(o);
      gain(c, "verbe", oralPoints(prev, o.h, o.wpm), t);
    }
  }
  c.stake = { amount: 20, level: c.missionLevel, title: LADDER[c.missionLevel].title, set: now - 4 * DAY, deadline: startOfDay(now) + 3 * DAY + 20 * 3600e3 };
  c.missionLog.push({ ts: now - 2 * DAY, text: "Brouillon de l'offre « dépannage PC à domicile, 25 € »" });
  erode(c, now); rollover(c, now);
  // v2 : profil, feuille de route et plans de démo (contenus statiques, aucun appel IA).
  c.profile = demoProfile();
  c.roadmap = ladderRoadmap(c.missionLevel);
  c.plans.programme = fallbackProgramme();
  c.plans.seance = fallbackSeance(c, now);
  c.plans.espritProps = { date: dayKey(now), items: fallbackProposals(c, now) };
  c.plans.verbe = { date: dayKey(now), items: fallbackSubjects(c, now), index: 0 };
  c.memoire.corps = { ts: now - 3 * DAY, synthese: "Records de pompes et de gainage en hausse depuis 6 semaines. Les jambes sont négligées : 2 séances sur 14.", forces: ["Régularité en semaine"], faiblesses: ["Jambes", "Week-ends vides"], priorite: "Deux séances jambes par semaine, sans exception." };
  c.memoire.capital = { ts: now - 3 * DAY, synthese: "105 € gagnés seul en deux missions. L'offre de dépannage stagne au brouillon depuis 10 jours.", forces: ["Passe à l'action quand la mission est claire"], faiblesses: ["Repousse la prospection"], priorite: "Publier l'offre et contacter 10 personnes cette semaine." };
  return c;
}
