import { describe, expect, it } from "vitest";
import { clip, EspritExamSchema } from "./schemas";

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
