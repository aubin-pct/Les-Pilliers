import { describe, expect, it } from "vitest";
import { DAY, dayKey, startOfDay } from "@/lib/format";
import { MISS_PENALTY, PILLAR } from "@/content/pillars";
import { erode, freshChantier, gain, markDay, normalize, rollover, streak, tick } from "./core";
import { applyReview, applyTest, currentMission, missionPoints, oralPoints, seanceGain } from "./scoring";
import { analyzeAudio, analyzeText, splitTics } from "./analysis";
import { localVerdict, categorize } from "./verdicts";
import { buildDemo } from "./demo";
import { dossier, foremanLine, weekData } from "./insights";

const T0 = new Date(2026, 10, 2, 9, 0).getTime(); // lundi 2 novembre 2026, 9 h

describe("érosion", () => {
  it("fait perdre `rate` par jour, de façon continue", () => {
    const c = freshChantier(T0);
    erode(c, T0 + DAY);
    expect(c.p.corps.s).toBeCloseTo(10 * Math.exp(-PILLAR.corps.rate), 6);
    expect(c.p.esprit.s).toBeCloseTo(10 * Math.exp(-PILLAR.esprit.rate), 6);
  });
  it("ne fait rien si le temps recule", () => {
    const c = freshChantier(T0);
    erode(c, T0 - 1000);
    expect(c.p.corps.s).toBe(10);
  });
});

describe("passage des jours", () => {
  it("épargne le jour de la signature", () => {
    const c = freshChantier(T0);
    rollover(c, T0 + DAY);
    expect(c.pending).toHaveLength(0);
    expect(c.hist).toHaveLength(1);
  });
  it("pénalise et crée un compte à rendre pour chaque pilier nu", () => {
    const c = freshChantier(T0);
    rollover(c, T0 + DAY);
    markDay(c, "corps", T0 + DAY);
    const before = c.p.capital.s;
    rollover(c, T0 + 2 * DAY);
    expect(c.pending.map((p) => p.pillar).sort()).toEqual(["capital", "esprit", "verbe"]);
    expect(c.p.capital.s).toBeCloseTo(before * (1 - MISS_PENALTY), 6);
    expect(c.p.corps.s).toBe(10);
  });
  it("plafonne les comptes à rendre à 8 après une longue absence", () => {
    const c = freshChantier(T0);
    tick(c, T0 + 20 * DAY);
    expect(c.pending).toHaveLength(8);
    expect(c.lastDay).toBe(dayKey(T0 + 20 * DAY));
  });
  it("fait perdre une mise échue", () => {
    const c = freshChantier(T0);
    c.stake = { amount: 20, level: 0, title: "Vendre", set: T0, deadline: T0 + DAY };
    const cap = c.p.capital.s;
    rollover(c, T0 + 2 * DAY);
    expect(c.stake).toBeNull();
    expect(c.stakesLost).toBe(20);
    expect(c.excuses[0].cat).toBe("mise");
    expect(c.p.capital.s).toBeLessThan(cap);
  });
});

describe("gains", () => {
  it("divise les gains par deux tant qu'il reste des comptes à rendre", () => {
    const c = freshChantier(T0);
    c.pending.push({ date: "2026-11-01", pillar: "corps" });
    const r = gain(c, "corps", 10, T0);
    expect(r).toEqual({ real: 5, halved: true });
    expect(c.p.corps.s).toBe(15);
  });
  it("ne divise pas les pertes et ne descend jamais sous zéro", () => {
    const c = freshChantier(T0);
    c.pending.push({ date: "2026-11-01", pillar: "corps" });
    expect(gain(c, "corps", -50, T0).real).toBe(-50);
    expect(c.p.corps.s).toBe(0);
  });
  it("pose le plancher sauf si demandé", () => {
    const c = freshChantier(T0);
    gain(c, "verbe", -1, T0, { floor: false });
    expect(c.days[dayKey(T0)]?.verbe).toBeUndefined();
    gain(c, "verbe", 3, T0);
    expect(c.days[dayKey(T0)]?.verbe).toBe(true);
  });
  it("compte les jours complets d'affilée", () => {
    const c = freshChantier(T0);
    for (let i = 0; i < 3; i++) (["corps", "capital", "esprit", "verbe"] as const).forEach((id) => markDay(c, id, T0 - i * DAY));
    expect(streak(c, T0)).toBe(3);
  });
});

describe("barème", () => {
  it("premier test = référence, record = gain, égalité = perte", () => {
    const c = freshChantier(T0);
    expect(applyTest(c, "pompes", 20, T0, true).first).toBe(true);
    const rec = applyTest(c, "pompes", 25, T0 + DAY, true);
    expect(rec.record).toBe(true);
    expect(rec.g.real).toBeCloseTo(6 + 0.25 * 60, 6);
    const eq = applyTest(c, "pompes", 25, T0 + 2 * DAY, true);
    expect(eq.record).toBe(false);
    expect(eq.g.real).toBe(-2);
    expect(c.wins).toHaveLength(1);
  });
  it("souplesse : progression en centimètres, valeurs négatives permises", () => {
    const c = freshChantier(T0);
    applyTest(c, "souplesse", -8, T0, false);
    const r = applyTest(c, "souplesse", -5, T0 + DAY, false);
    expect(r.record).toBe(true);
    expect(r.g.real).toBe(6 + 3 * 2);
  });
  it("séance : bornée par la durée", () => {
    expect(seanceGain(15, 5, 5)).toBe(5);
    expect(seanceGain(300, 5, 5)).toBe(7);
  });
  it("mission : plus l'échelon est haut et le montant gros, plus ça paie", () => {
    expect(missionPoints(0, 0, false)).toBe(12);
    expect(missionPoints(1, 70, false)).toBeCloseTo(24 + 6 * 3, 6);
    expect(missionPoints(5, 0, true)).toBe(10);
  });
  it("mission courante : échelle, puis sur mesure", () => {
    const c = freshChantier(T0);
    expect(currentMission(c).cash).toBe(true);
    c.missionLevel = 8;
    expect(currentMission(c).done).toBe(true);
    c.custom = { titre: "Donner un cours", consigne: "…", preuve: "…", jours: 7 };
    expect(currentMission(c).custom).toBe(true);
  });
  it("révision : réussie avance, ratée recule", () => {
    const c = freshChantier(T0);
    c.esprit.push({ ts: 1, topic: "X", ans: "", note: 7, verdict: "", lacune: "", objection: "", question: "?", stage: 0, next: T0 });
    expect(applyReview(c, 1, 8, T0).real).toBe(4);
    expect(c.esprit[0].stage).toBe(1);
    expect(c.esprit[0].next).toBe(T0 + 10 * DAY);
    expect(applyReview(c, 1, 3, T0).real).toBe(-2);
    expect(c.esprit[0].next).toBe(T0 + DAY);
  });
  it("oral : bonus si les hésitations baissent et si le débit est bon", () => {
    expect(oralPoints(null, 5, 140)).toBe(4);
    expect(oralPoints(6, 5, 100)).toBe(6);
    expect(oralPoints(4, 5, 200)).toBe(3);
  });
});

describe("analyse de la Tribune", () => {
  it("compte mots, tics et débit", () => {
    const m = analyzeText("Euh alors du coup je pense que, en fait, voilà. Bref, c'est simple quoi.", 30);
    expect(m.tics).toMatchObject({ euh: 1, "du coup": 1, "en fait": 1, voilà: 1, bref: 1, quoi: 1 });
    expect(m.wpm).toBe(Math.round(m.words / 0.5));
  });
  it("ne compte pas « quoi » dans une question", () => {
    expect(analyzeText("Tu fais quoi demain matin avec lui", 30).tics.quoi).toBeUndefined();
  });
  it("découpe la transcription en marquant les tics", () => {
    const parts = splitTics("Euh je crois, du coup, que oui");
    expect(parts.filter((p) => p.tic).map((p) => p.t.toLowerCase())).toEqual(["euh", "du coup"]);
    expect(parts.map((p) => p.t).join("")).toBe("Euh je crois, du coup, que oui");
  });
  it("détecte les blancs de 0,8 s ou plus entre deux paroles", () => {
    const seg = (sec: number, v: number) => Array.from({ length: Math.round(sec / 0.05) }, (_, i) => v * (0.9 + (i % 3) * 0.1));
    const rms = [...seg(0.5, 0.002), ...seg(2, 0.08), ...seg(1.2, 0.003), ...seg(1.5, 0.07), ...seg(0.4, 0.002), ...seg(2, 0.09), ...seg(2, 0.002), ...seg(1, 0.06), ...seg(1, 0.002)];
    const a = analyzeAudio(rms)!;
    expect(a.pauses).toBe(2);
    expect(a.longest).toBeCloseTo(2, 1);
    expect(a.env).toHaveLength(72);
  });
  it("renvoie null sur un enregistrement trop court", () => {
    expect(analyzeAudio([0.1, 0.2])).toBeNull();
  });
});

describe("verdicts locaux", () => {
  it("classe les excuses", () => {
    expect(categorize("trop fatigué").id).toBe("fatigue");
    expect(categorize("partiel demain").id).toBe("temps");
    expect(categorize("j'avais de la fièvre").ok).toBe(true);
  });
  it("compte les récidives sur 30 jours", () => {
    const c = freshChantier(T0);
    c.excuses.push({ ts: T0 - DAY, date: "x", pillar: "corps", text: "fatigué", cat: "fatigue", ok: false, verdict: "" });
    const v = localVerdict(c, "corps", "encore crevé", T0);
    expect(v.ok).toBe(false);
    expect(v.verdict).toContain("2e fois en 30 jours");
  });
  it("accepte la santé avec respect", () => {
    const v = localVerdict(freshChantier(T0), "corps", "malade, grippe", T0);
    expect(v.ok).toBe(true);
    expect(v.verdict).toMatch(/Soigne-toi/);
  });
});

describe("démo et lectures", () => {
  it("construit 47 jours cohérents et reproductibles", () => {
    const now = startOfDay(T0) + 12 * 3600e3;
    const a = buildDemo(now), b = buildDemo(now);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.lastDay).toBe(dayKey(now));
    expect(a.hist.length).toBeGreaterThanOrEqual(46);
    expect(a.euros).toBe(105);
    expect(a.missionLevel).toBe(2);
    expect(a.orals.length).toBeGreaterThan(20);
    expect(a.pending).toHaveLength(1); // le Verbe de la veille
  });
  it("produit le rapport, le dossier et la phrase du jour sans planter", () => {
    const now = startOfDay(T0) + 15 * 3600e3;
    const c = buildDemo(now);
    expect(weekData(c, now).scores.corps).toBeGreaterThan(0);
    expect(dossier(c).map((g) => g.pillar)).toEqual(["corps", "capital", "esprit", "verbe"]);
    expect(foremanLine(c, now).say).toBe("Tu me dois des explications.");
  });
  it("complète un chantier incomplet", () => {
    const c = normalize({ v: 1, created: T0 } as never, T0);
    expect(c.orals).toEqual([]);
    expect(c.p.verbe.s).toBe(10);
  });
});
