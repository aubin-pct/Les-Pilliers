import { describe, expect, it } from "vitest";
import { MOVEMENTS, MUSCLES } from "@/content/anatomy";
import { SEANCES } from "@/content/corps";
import { exoAnatomy, guessMovement } from "./anatomy";

describe("écorché : mouvement d'un exercice", () => {
  it("reconnaît chaque exercice des séances de secours", () => {
    const miss = SEANCES.flatMap((s) => s.ex.map(([n]) => n)).filter((n) => guessMovement(n) === null);
    expect(miss).toEqual([]);
  });
  it("le mot-clé le plus précis l'emporte", () => {
    expect(guessMovement("Squats sautés")).toBe("squat_saute");
    expect(guessMovement("Squat goblet")).toBe("squat");
    expect(guessMovement("Gainage latéral")).toBe("gainage_lateral");
    expect(guessMovement("Dips sur chaise")).toBe("dips");
    expect(guessMovement("Pompes diamant")).toBe("pompe_diamant");
    expect(guessMovement("Fente basse")).toBe("fente_basse");
    expect(guessMovement("Posture du pigeon")).toBe("fente_basse");
    expect(guessMovement("Ouverture d’épaules au mur")).toBe("etirement_pectoraux");
  });
  it("exercice inconnu : posture debout, signalé comme approché", () => {
    const a = exoAnatomy({ nom: "Truc inventé" });
    expect(a.mouvement).toBe("debout");
    expect(a.reconnu).toBe(false);
  });
  it("les muscles désignés par l'IA priment sur ceux du mouvement", () => {
    const a = exoAnatomy({ nom: "Pompes", mouvement: "pompe", muscles: { principaux: ["triceps"], secondaires: ["pectoraux"] } });
    expect(a.muscles[0]).toMatchObject({ id: "triceps", w: 1, principal: true });
    expect(a.muscles.find((m) => m.id === "pectoraux")!.w).toBeLessThan(0.7);
  });
  it("chaque mouvement ne cite que des muscles connus, avec au moins un moteur principal", () => {
    const ids = new Set(MUSCLES.map((m) => m.id));
    for (const m of MOVEMENTS) {
      for (const k of Object.keys(m.muscles)) expect(ids.has(k as never), `${m.id} → ${k}`).toBe(true);
      if (m.id !== "debout") expect(Math.max(...Object.values(m.muscles)), m.id).toBeGreaterThanOrEqual(0.85);
    }
  });
});
