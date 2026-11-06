import { describe, expect, it } from "vitest";
import { DAY, weekKey } from "@/lib/format";
import { freshChantier, tick } from "./core";
import { accuracy, detectPitch, eloScore, eloSkills, measuredSkills, suggestDrill, voiceVariation } from "./eloquence";
import { coachLine, localLine } from "./coachLines";
import { mergeChantier } from "./sync";
import type { Chantier, Oral } from "./types";

const T0 = new Date(2026, 10, 2, 9, 0).getTime();
const copy = (c: Chantier): Chantier => JSON.parse(JSON.stringify(c));
const oral = (p: Partial<Oral>): Oral => ({ ts: T0, sujet: "s", secs: 60, words: 140, wpm: 140, tpm: 0, ppm: 2, pause: 1, speak: 0.8, ttr: 0.6, longest: 20, h: 2, env: [], text: "", audio: false, verdict: "", structure: null, ...p });

describe("compétences d'éloquence", () => {
  it("note bien un oral fluide au bon débit, mal un oral plein de tics et trop lent", () => {
    const good = measuredSkills(oral({ tpm: 0.5, ppm: 1.5, wpm: 145, pitchVar: 3, volVar: 5, ttr: 0.62 }));
    const bad = measuredSkills(oral({ tpm: 6, ppm: 6, wpm: 80, pitchVar: 0.6, volVar: 1, ttr: 0.35 }));
    for (const k of ["fluidite", "rythme", "voix", "vocabulaire"] as const) {
      expect(good[k]!).toBeGreaterThan(bad[k]!);
      expect(good[k]!).toBeLessThanOrEqual(100); expect(bad[k]!).toBeGreaterThanOrEqual(0);
    }
  });
  it("moyenne les 6 dernières mesures et conseille l'exercice de la compétence la plus faible", () => {
    const c = freshChantier(T0);
    expect(eloScore(c)).toBeNull();
    c.orals = [1, 2, 3].map((i) => oral({ ts: T0 + i, skills: { fluidite: 80, rythme: 70, voix: 20, vocabulaire: 60, structure: 75, impact: 70 } }));
    expect(eloSkills(c).voix).toBe(20);
    expect(["lecture", "articulation"]).toContain(suggestDrill(c));
  });
  it("mesure la précision d'un texte lu et la hauteur d'une voix", () => {
    expect(accuracy("Un chasseur sachant chasser", "un chasseur sachant chasser")).toBe(1);
    expect(accuracy("Un chasseur sachant chasser", "un chat")).toBeLessThan(0.5);
    const sr = 16000, buf = new Float32Array(2048);
    for (let i = 0; i < buf.length; i++) buf[i] = 0.3 * Math.sin((2 * Math.PI * 150 * i) / sr);
    expect(detectPitch(buf, sr)).toBeGreaterThan(140);
    expect(detectPitch(buf, sr)).toBeLessThan(160);
    const flat = voiceVariation(Array(40).fill(0.1), Array(40).fill(150));
    const lively = voiceVariation(Array.from({ length: 40 }, (_, i) => 0.05 + (i % 5) * 0.04), Array.from({ length: 40 }, (_, i) => 110 + (i % 7) * 20));
    expect(lively.pitchVar!).toBeGreaterThan(flat.pitchVar!);
    expect(lively.volVar!).toBeGreaterThan(flat.volVar!);
  });
});

describe("le Coach", () => {
  it("a toujours une phrase courte pour chaque section", () => {
    const c = freshChantier(T0);
    for (const s of ["temple", "corps", "capital", "esprit", "verbe"] as const) {
      const l = localLine(c, s, T0);
      expect(l.length).toBeGreaterThan(5);
      expect(l.length).toBeLessThan(110);
    }
  });
  it("prend le brief IA du jour tant que le plancher n'est pas posé", () => {
    const c = freshChantier(T0);
    c.brief = { date: "2026-11-02", lines: { corps: "Tractions : 5 × 6. Maintenant." } };
    expect(coachLine(c, "corps", T0)).toBe("Tractions : 5 × 6. Maintenant.");
    c.days["2026-11-02"] = { corps: true };
    expect(coachLine(c, "corps", T0)).not.toBe("Tractions : 5 × 6. Maintenant.");
  });
});

describe("semaine ISO", () => {
  it("numérote les semaines", () => {
    expect(weekKey(T0)).toBe("2026-W45");
    expect(weekKey(new Date(2027, 0, 1).getTime())).toBe("2026-W53");
  });
});

describe("fusion v5", () => {
  function setup() {
    const base = freshChantier(T0 - 3 * DAY);
    tick(base, T0); base.pending = [];
    return { base, mac: copy(base), phone: copy(base) };
  }
  it("unit les conversations, l'entonnoir et garde le sprint le plus avancé", () => {
    const { base, mac, phone } = setup();
    const sprint = { semaine: "2026-W45", objectif: "o", script: "s", kpis: [{ id: "a", label: "Messages", cible: 10, fait: 0 }, { id: "b", label: "Appels", cible: 3, fait: 0 }] };
    base.capital.sprint = copy({ ...base, capital: { ...base.capital, sprint } } as Chantier).capital.sprint;
    mac.capital.sprint = { ...sprint, kpis: [{ ...sprint.kpis[0], fait: 4 }, sprint.kpis[1]] };
    phone.capital.sprint = { ...sprint, kpis: [{ ...sprint.kpis[0], fait: 2 }, { ...sprint.kpis[1], fait: 1 }] };
    mac.chats.capital = [{ ts: 1, from: "moi", text: "a" }];
    phone.chats.capital = [{ ts: 2, from: "coach", text: "b" }];
    mac.capital.prospects = [{ id: "p1", nom: "Léa", stage: 1, note: "", ts: 1, maj: 5 }];
    phone.capital.prospects = [{ id: "p2", nom: "Marc", stage: 0, note: "", ts: 2, maj: 2 }];
    const m = mergeChantier(base, phone, mac, T0);
    expect(m.capital.sprint!.kpis.map((k) => k.fait)).toEqual([4, 1]);
    expect(m.chats.capital!.map((x) => x.text)).toEqual(["a", "b"]);
    expect(m.capital.prospects.map((p) => p.nom).sort()).toEqual(["Léa", "Marc"]);
  });
  it("garde la carte du savoir la plus récente", () => {
    const { base, mac, phone } = setup();
    mac.knowledgeMap = { ts: 10, domaines: [{ nom: "A", sujets: [] }] };
    phone.knowledgeMap = { ts: 20, domaines: [{ nom: "B", sujets: [] }] };
    expect(mergeChantier(base, phone, mac, T0).knowledgeMap!.domaines[0].nom).toBe("B");
  });
});

import { mergeRecognized } from "./analysis";
describe("reconnaissance vocale", () => {
  it("fusionne les répétitions d'Android sans perdre de phrases", () => {
    expect(mergeRecognized(["je", "je veux", "je veux parler"])).toBe("je veux parler");
    expect(mergeRecognized(["Bonjour.", "bonjour", "je m'appelle Aubin"])).toBe("Bonjour. je m'appelle Aubin");
    expect(mergeRecognized(["première phrase", "deuxième phrase"])).toBe("première phrase deuxième phrase");
    expect(mergeRecognized(["", "  ", "texte"])).toBe("texte");
    expect(mergeRecognized(["je veux je veux parler du projet du projet"])).toBe("je veux parler du projet");
    expect(mergeRecognized(["non non c'est faux"])).toBe("non non c'est faux");
    expect(mergeRecognized(["je veux parler", "je veux parler du projet je veux parler du projet"])).toBe("je veux parler du projet");
  });
});
