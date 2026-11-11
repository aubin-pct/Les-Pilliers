import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { MOVEMENTS, PARTS, PART_FOCUS } from "@/content/anatomy";
import { ANIMS, sampleAnim } from "./poses";
import { applyPose, buildRig, type Limb } from "./rig";
import { buildStrands, STRANDS, updateStrand } from "./muscles";

describe("écorché : animations", () => {
  const rig = buildRig();
  const strands = buildStrands();

  it("chaque portion du catalogue a son faisceau, et inversement", () => {
    for (const [id, parts] of Object.entries(PARTS)) for (const p of parts!) {
      expect(STRANDS.some((s) => s.id === id && (s.part === p.id || s.grad?.includes(p.id))), `${id}.${p.id}`).toBe(true);
    }
    for (const s of STRANDS) for (const p of [s.part, ...(s.grad ?? [])].filter(Boolean)) {
      expect(PARTS[s.id]?.some((q) => q.id === p), `${s.id}.${p}`).toBe(true);
    }
    for (const [mv, focus] of Object.entries(PART_FOCUS)) for (const [id, parts] of Object.entries(focus!)) for (const p of Object.keys(parts)) {
      expect(PARTS[id as keyof typeof PARTS]?.some((q) => q.id === p), `${mv} → ${id}.${p}`).toBe(true);
    }
  });

  it("chaque mouvement du catalogue a son animation", () => {
    for (const m of MOVEMENTS) expect(ANIMS[m.id], m.id).toBeDefined();
  });

  for (const m of MOVEMENTS) {
    it(`${m.id} : pose valide sur tout le cycle`, () => {
      const a = ANIMS[m.id];
      for (let k = 0; k < 24; k++) {
        const pose = sampleAnim(a, k / 24);
        applyPose(rig, pose);
        // Mains et pieds posés (sol, barre, banc) : la cible est atteinte à 5 cm près.
        for (const [limb, t] of Object.entries(pose.ik ?? {}) as [Limb, unknown][]) {
          if (!Array.isArray(t) || (limb.startsWith("hand") && pose.plant?.[limb] === undefined)) continue;
          const p = rig.bones[limb].getWorldPosition(new Vector3());
          expect(p.distanceTo(new Vector3(...(t as [number, number, number]))), `${m.id} ${limb} à ${k}/24`).toBeLessThan(0.05);
        }
        // Rien ne passe franchement sous le sol.
        for (const j of ["head", "hips", "chest", "handL", "handR", "footL", "footR", "shinL", "shinR"] as const) {
          const y = rig.bones[j].getWorldPosition(new Vector3()).y;
          expect(Number.isFinite(y)).toBe(true);
          expect(y, `${m.id} ${j} à ${k}/24`).toBeGreaterThan(-0.01);
        }
        for (const s of strands) updateStrand(s, rig, 0.5);
        const pos = strands[0].geo.attributes.position.array as Float32Array;
        expect(pos.every(Number.isFinite)).toBe(true);
      }
    });
  }
});
