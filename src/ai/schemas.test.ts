import { describe, expect, it } from "vitest";
import { clip, EspritExamSchema, ExoSchema } from "./schemas";

describe("réponses de l'IA jamais coupées net", () => {
  it("garde un verdict long en entier", () => {
    const verdict = "Bonne structure. ".repeat(60).trim(); // ~1000 caractères, bien plus que la taille « normale » de 400
    const r = EspritExamSchema.parse({ note: 7, verdict, lacune: "x" });
    expect(r.verdict).toBe(verdict);
  });
  it("si un texte est vraiment démesuré, il est coupé à la fin d'une phrase", () => {
    const s = "Première phrase complète. ".repeat(80);
    const c = clip(s, 100);
    expect(c.endsWith(".")).toBe(true);
    expect(c.length).toBeLessThanOrEqual(300);
    const w = clip("mot ".repeat(200), 50);
    expect(w.endsWith("…")).toBe(true);
    expect(w).not.toMatch(/\smo…$/);
  });
});

describe("exercice : vocabulaire de l'écorché", () => {
  const base = { nom: "Pompes", type: "reps", series: 4, cible: 12 };
  it("garde un mouvement et des muscles connus, écarte le reste", () => {
    const r = ExoSchema.parse({ ...base, mouvement: " Pompe ", muscles: { principaux: ["pectoraux", "biceps_cuisse", "Triceps"], secondaires: ["triceps", "dentele"] } });
    expect(r.mouvement).toBe("pompe");
    expect(r.muscles).toEqual({ principaux: ["pectoraux", "triceps"], secondaires: ["dentele"] });
  });
  it("mouvement inconnu ou muscles absents : champs vides, l'exercice reste valide", () => {
    const r = ExoSchema.parse({ ...base, mouvement: "salto", muscles: "tout" });
    expect(r.mouvement).toBeUndefined();
    expect(r.muscles).toBeUndefined();
    expect(r.nom).toBe("Pompes");
  });
});
