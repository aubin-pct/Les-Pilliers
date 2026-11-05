import { describe, expect, it } from "vitest";
import { DAY, dayKey } from "@/lib/format";
import { freshChantier, gain, markDay, tick } from "./core";
import { mergeChantier, proofCount } from "./sync";
import type { Chantier } from "./types";

const T0 = new Date(2026, 10, 2, 9, 0).getTime();
const copy = (c: Chantier): Chantier => JSON.parse(JSON.stringify(c));

function setup() {
  const base = freshChantier(T0 - 3 * DAY);
  tick(base, T0);
  base.pending = []; // pas de comptes à rendre : les gains ne sont pas divisés
  return { base, mac: copy(base), phone: copy(base) };
}

describe("fusion de deux appareils", () => {
  it("additionne les gains faits des deux côtés", () => {
    const { base, mac, phone } = setup();
    const before = base.p.corps.s;
    gain(mac, "corps", 6, T0 + 1000);
    gain(phone, "corps", 4, T0 + 2000);
    const m = mergeChantier(base, phone, mac, T0 + 3000);
    expect(m.p.corps.s).toBeCloseTo(before + 10, 2);
  });
  it("n'applique l'érosion et les pénalités de minuit qu'une fois", () => {
    const { base, mac, phone } = setup();
    const later = T0 + 2 * DAY;
    tick(mac, later); tick(phone, later);
    const m = mergeChantier(base, phone, mac, later);
    const ref = copy(base); tick(ref, later);
    expect(m.p.esprit.s).toBeCloseTo(ref.p.esprit.s, 6);
    expect(m.pending.length).toBe(ref.pending.length);
  });
  it("unit les journaux et garde la version modifiée d'une même entrée", () => {
    const { base, mac, phone } = setup();
    base.esprit.push({ ts: 1, topic: "BCE", ans: "", note: 6, verdict: "", lacune: "", objection: "", question: "?", stage: 0, next: T0 });
    mac.esprit = copy(base).esprit; phone.esprit = copy(base).esprit;
    mac.esprit[0].stage = 1; // révision faite sur le Mac
    mac.seances.push({ ts: T0 + 10, type: "Poussée", dur: 30, done: 10, total: 12, proof: "", timed: true });
    phone.orals.push({ ts: T0 + 20, sujet: "x", secs: 90, words: 200, wpm: 133, tpm: 2, ppm: 3, pause: 1, speak: .8, ttr: .5, longest: 20, h: 5, env: [], text: "", audio: true, verdict: "", structure: null });
    phone.missionLog.push({ ts: T0 + 30, text: "Annonce publiée" });
    const m = mergeChantier(base, phone, mac, T0 + 100);
    expect(m.esprit).toHaveLength(1);
    expect(m.esprit[0].stage).toBe(1);
    expect(m.seances).toHaveLength(1);
    expect(m.orals).toHaveLength(1);
    expect(m.missionLog).toHaveLength(1);
    expect(proofCount(m)).toBe(4);
  });
  it("garde les planchers posés sur l'un ou l'autre appareil", () => {
    const { base, mac, phone } = setup();
    markDay(mac, "corps", T0); markDay(phone, "verbe", T0);
    const m = mergeChantier(base, phone, mac, T0 + 10);
    expect(m.days[dayKey(T0)]).toMatchObject({ corps: true, verbe: true });
  });
  it("retire un compte à rendre réglé sur l'autre appareil", () => {
    const { base, mac, phone } = setup();
    base.pending.push({ date: "2026-11-01", pillar: "corps" });
    mac.pending = []; phone.pending = copy(base).pending;
    mac.excuses.push({ ts: T0 + 5, date: "2026-11-01", pillar: "corps", text: "fatigué", cat: "fatigue", ok: false, verdict: "Non." });
    const m = mergeChantier(base, phone, mac, T0 + 10);
    expect(m.pending.find((p) => p.date === "2026-11-01" && p.pillar === "corps")).toBeUndefined();
    expect(m.excuses).toHaveLength(1);
  });
  it("prend le profil le plus récent si les deux ont changé", () => {
    const { base, mac, phone } = setup();
    const p = { prenom: "A", corps: { objectifs: [], niveau: "debutant", age: null, poids: 70, taille: null, materiel: [], seancesParSemaine: 3, minutes: 30, contraintes: "", activites: "" }, capital: { situation: "", competences: "", ressources: "", heuresParSemaine: 5, budget: 0, risque: "moyen", interets: "", objectif: "", dejaFait: "", refus: "" }, esprit: { domaines: [], niveau: "debutant", pourquoi: "" }, verbe: { contexte: "", objectif: "" }, updated: 10 } as Chantier["profile"];
    mac.profile = { ...p!, corps: { ...p!.corps, poids: 78 }, updated: 200 };
    phone.profile = { ...p!, corps: { ...p!.corps, poids: 76 }, updated: 100 };
    expect(mergeChantier(base, phone, mac, T0).profile?.corps.poids).toBe(78);
    // Un seul côté a changé : c'est lui qui gagne, même plus ancien.
    const m2 = mergeChantier(base, copy(base), phone, T0);
    expect(m2.profile?.corps.poids).toBe(76);
  });
  it("additionne les euros et garde la feuille de route la plus avancée", () => {
    const { base, mac, phone } = setup();
    const rm = { ts: 5, vision: "v", index: 0, paliers: [{ titre: "a", pourquoi: "", preuve: "", cash: true, jours: 7 }, { titre: "b", pourquoi: "", preuve: "", cash: true, jours: 7 }] };
    base.roadmap = copy({ ...base, roadmap: rm } as Chantier).roadmap; mac.roadmap = { ...rm, index: 1 }; phone.roadmap = { ...rm, paliers: [...rm.paliers], index: 0 };
    phone.roadmap.paliers[0] = { ...rm.paliers[0], titre: "a2" };
    mac.euros = 40; phone.euros = 25;
    const m = mergeChantier(base, phone, mac, T0);
    expect(m.euros).toBe(65);
    expect(m.roadmap?.index).toBe(1);
  });
  it("ne modifie pas ses arguments", () => {
    const { base, mac, phone } = setup();
    gain(mac, "capital", 3, T0);
    const snap = JSON.stringify([base, mac, phone]);
    mergeChantier(base, phone, mac, T0 + DAY);
    expect(JSON.stringify([base, mac, phone])).toBe(snap);
  });
});
