/*
 * Les mouvements animés. Chaque mouvement est une boucle de poses clés (t de 0 à 1) jouée en `dur` secondes,
 * interpolées en douceur. Les mains et les pieds posés (sol, barre, banc) tiennent par IK : ils ne glissent pas.
 * `effort` (0–1) suit la phase : fort en montée (concentrique), moyen en descente, constant en gainage.
 */
import type { MovementId } from "@/content/anatomy";
import { blendPose, bodyPoint, mirror, mirrorX, placeRoot, type Joint, type Limb, type Plant, type Pose, type V3 } from "./rig";

/** Accessoire nommé, ou bloc posé au sol (centre x, y, z ; largeur, hauteur, profondeur). */
export type Prop = "barre" | "poignees" | "barres_paralleles" | "goblet" | "banc" | "banc_dips" | "mur" | "halteres" | "tapis" | { box: [number, number, number, number, number, number] };
export interface Anim { dur: number; keys: { t: number; p: Pose }[]; props?: Prop[]; az?: number; el?: number }

type SideKey = "clav" | "arm" | "fore" | "hand" | "thigh" | "shin" | "foot";
/** Même rotation des deux côtés (le droit en miroir). */
const sym = (o: Partial<Record<SideKey, V3>>): Partial<Record<Joint, V3>> => {
  const r: Partial<Record<Joint, V3>> = {};
  for (const [k, v] of Object.entries(o) as [SideKey, V3][]) { r[`${k}L` as Joint] = v; r[`${k}R` as Joint] = mirror(v); }
  return r;
};
const L = (k: SideKey, v: V3): Partial<Record<Joint, V3>> => ({ [`${k}L`]: v });
const R = (k: SideKey, v: V3): Partial<Record<Joint, V3>> => ({ [`${k}R`]: mirror(v) });
/** Cible des deux mains / pieds (le droit en miroir). */
const both = (l: "hand" | "foot", p: V3): Partial<Record<Limb, V3>> => ({ [`${l}L`]: p, [`${l}R`]: mirrorX(p) });
const poles = (l: "hand" | "foot", p: V3): Partial<Record<Limb, V3>> => ({ [`${l}L`]: p, [`${l}R`]: mirrorX(p) });
const plants = (l: "hand" | "foot", p: Plant): Partial<Record<Limb, Plant>> => ({ [`${l}L`]: p, [`${l}R`]: p });

const ANKLES: V3 = [0, 0.075, -0.02];
const SHOULDERS: V3 = [0, 1.43, -0.01];
const FEET: Partial<Record<Limb, V3>> = both("foot", [0.11, 0.075, -0.02]);

const STAND: Pose = { root: [0, 0.98, 0], j: sym({ arm: [0, 0, 5], fore: [-8, 0, 0] }), ik: FEET, effort: 0.3 };
const breathe = (p: Pose, d = 0.008): Pose => ({ ...p, root: [p.root[0], p.root[1] + d, p.root[2]], j: { ...p.j, chest: [((p.j?.chest?.[0]) ?? 0) - 2, 0, 0] } });

/* ---- Planche (bras tendus ou fléchis) : pieds fixes (au sol ou sur un banc), mains posées. ---- */
const FLOOR_PIVOT: V3 = [0, 0.13, -0.86];
function plankAt(angle: number, handX: number, handY: number, handZ: number, pivot: V3, extra: Partial<Pose> = {}): Pose {
  const rot: V3 = [90 - angle, 0, 0];
  const root = placeRoot(rot, ANKLES, pivot);
  return {
    root, rot, j: { ...sym({ foot: [-12, 0, 0] }), neck: [-8, 0, 0], ...extra.j },
    ik: { ...both("hand", [handX, handY, handZ]), ...extra.ik }, plant: { ...plants("hand", "sol"), ...extra.plant },
    pole: { ...poles("hand", [0.6, -0.7, -0.4]), ...extra.pole }, effort: extra.effort,
  };
}
const plank = (angle: number, handX: number, handZ: number, extra: Partial<Pose> = {}) => plankAt(angle, handX, 0.05, handZ, FLOOR_PIVOT, extra);
const shZAt = (angle: number, pivot: V3) => bodyPoint(placeRoot([90 - angle, 0, 0], ANKLES, pivot), [90 - angle, 0, 0], SHOULDERS)[2];
const shZ = (angle: number) => shZAt(angle, FLOOR_PIVOT);

/** Pompe : corps de `top` à `bottom` degrés au-dessus de l'horizontale, mains en (x, y), pieds sur `pivot`. */
function pushAnim(top: number, bottom: number, handX: number, handY: number, pivot: V3, o: { pole?: V3; props?: Prop[]; az?: number; el?: number; handZ?: number } = {}): Anim {
  const z = o.handZ ?? shZAt(bottom, pivot) + 0.03;
  const ex = (e: number): Partial<Pose> => ({ effort: e, ...(o.pole ? { pole: poles("hand", o.pole) } : {}) });
  return {
    dur: 2.6, az: o.az ?? 70, el: o.el ?? 14, props: o.props,
    keys: [
      { t: 0, p: plankAt(top, handX, handY, z, pivot, ex(0.35)) },
      { t: 0.42, p: plankAt(bottom, handX, handY, z, pivot, ex(0.65)) },
      { t: 0.5, p: plankAt(bottom, handX, handY, z, pivot, ex(1)) },
      { t: 0.85, p: plankAt(top, handX, handY, z, pivot, ex(0.8)) },
    ],
  };
}

/* ---- Barre fixe : hauteur de la prise, épaules sous la barre selon l'écartement des mains. ---- */
const BAR_Y = 2.27;
/** Hauteur des épaules, bras presque tendus, mains écartées de `x` (bras de 0,52 m). */
const hangShoulderY = (x: number) => BAR_Y - Math.sqrt(0.52 ** 2 - Math.min(0.4, Math.abs(x - 0.19)) ** 2);
/** Suspendu à la barre : le milieu des épaules reste fixe, le corps tourne autour (bascule, rotation). */
function hang(x: number, rot: V3, plant: Plant, pole: V3, j: Partial<Record<Joint, V3>>, effort: number, shY = hangShoulderY(x), shZ = -0.02): Pose {
  return {
    root: placeRoot(rot, SHOULDERS, [0, shY, shZ]), rot, j: { neck: [-6, 0, 0], ...j },
    ik: both("hand", [x, BAR_Y, 0.02]), plant: plants("hand", plant), pole: poles("hand", pole), effort,
  };
}
/** Traction : de la suspension au menton au-dessus de la barre. */
function pullAnim(x: number, plant: Plant, pole: V3, props: Prop[] = ["barre"]): Anim {
  const legs = (d: number) => sym({ thigh: [-14 - d, 0, 0], shin: [62, 0, 0], foot: [30, 0, 0] });
  const lo = (e: number) => hang(x, [4, 0, 0], plant, pole, legs(0), e);
  const hi = (e: number) => hang(x, [4, 0, 0], plant, pole, legs(6), e, BAR_Y - 0.2);
  return { dur: 3, az: 150, el: 4, props, keys: [{ t: 0, p: lo(0.45) }, { t: 0.4, p: hi(1) }, { t: 0.52, p: hi(0.85) }, { t: 0.92, p: lo(0.55) }] };
}
/** Traction gainée : corps en « banane » (abdos serrés, jambes tendues un peu devant), menton au-dessus de la barre. */
function pullHollow(): Anim {
  const x = 0.3, pole: V3 = [1, -0.5, 0.1];
  const body = (d: number): Partial<Record<Joint, V3>> => ({ ...sym({ thigh: [-20 - d, 0, 0], shin: [4, 0, 0], foot: [35, 0, 0] }), spine: [8, 0, 0], chest: [4, 0, 0] });
  const lo = (e: number) => hang(x, [2, 0, 0], "barre", pole, body(0), e);
  const hi = (e: number) => hang(x, [2, 0, 0], "barre", pole, body(4), e, BAR_Y - 0.21);
  return { dur: 3, az: 90, el: 4, props: ["barre"], keys: [{ t: 0, p: lo(0.45) }, { t: 0.4, p: hi(1) }, { t: 0.52, p: hi(0.85) }, { t: 0.92, p: lo(0.55) }] };
}
/** Traction poitrine à la barre : on bombe le torse, le buste bascule en arrière, le sternum vient toucher la barre. */
function pullChest(): Anim {
  const x = 0.32, pole: V3 = [1, -0.8, -0.4];
  const lo = (e: number) => hang(x, [2, 0, 0], "barre", [1, -0.5, 0.1], { ...sym({ thigh: [-6, 0, 0], shin: [60, 0, 0], foot: [30, 0, 0] }) }, e);
  const hi = (e: number) => hang(x, [-17, 0, 0], "barre", pole, {
    ...sym({ thigh: [6, 0, 0], shin: [70, 0, 0], foot: [30, 0, 0] }), spine: [-8, 0, 0], chest: [-10, 0, 0], neck: [-14, 0, 0],
  }, e, BAR_Y - 0.08, -0.09);
  return { dur: 3.2, az: 95, el: 4, props: ["barre"], keys: [{ t: 0, p: lo(0.45) }, { t: 0.42, p: hi(1) }, { t: 0.54, p: hi(0.9) }, { t: 0.94, p: lo(0.55) }] };
}
const HANG_X = 0.28;
const HANG_POLE: V3 = [1, -0.5, 0.1];

/* ---- Sur le dos ---- */
function supine(extra: Partial<Pose> & { lift?: number } = {}): Pose {
  const rot: V3 = extra.rot ?? [-90, 0, 0];
  return {
    root: extra.root ?? [0, 0.105, 0.0], rot,
    j: { ...extra.j }, ik: { ...extra.ik }, plant: { ...extra.plant }, pole: { ...extra.pole }, effort: extra.effort,
  };
}

const PUSH_Z = shZ(12) + 0.03;

export const ANIMS: Record<MovementId, Anim> = {
  debout: {
    dur: 4.2, az: 25, el: 6,
    keys: [{ t: 0, p: STAND }, { t: 0.5, p: { ...breathe(STAND, 0.006), effort: 0.5 } }],
  },

  pompe: {
    dur: 2.6, az: 70, el: 14,
    keys: [
      { t: 0, p: plank(21, 0.27, PUSH_Z, { effort: 0.35 }) },
      { t: 0.42, p: plank(4.5, 0.27, PUSH_Z, { effort: 0.65 }) },
      { t: 0.5, p: plank(4.5, 0.27, PUSH_Z, { effort: 1 }) },
      { t: 0.85, p: plank(21, 0.27, PUSH_Z, { effort: 0.8 }) },
    ],
  },
  pompe_diamant: {
    dur: 2.6, az: 60, el: 16,
    keys: [
      { t: 0, p: plank(21, 0.055, PUSH_Z, { effort: 0.35, pole: poles("hand", [0.15, -1, -0.5]) }) },
      { t: 0.42, p: plank(6, 0.055, PUSH_Z, { effort: 0.65, pole: poles("hand", [0.15, -1, -0.5]) }) },
      { t: 0.5, p: plank(6, 0.055, PUSH_Z, { effort: 1, pole: poles("hand", [0.15, -1, -0.5]) }) },
      { t: 0.85, p: plank(21, 0.055, PUSH_Z, { effort: 0.8, pole: poles("hand", [0.15, -1, -0.5]) }) },
    ],
  },
  pompe_piquee: {
    dur: 2.8, az: 80, el: 10,
    keys: (() => {
      const k = (y: number, rx: number, e: number): Pose => ({
        root: [0, y, -0.12], rot: [rx, 0, 0], j: { neck: [-15, 0, 0], spine: [6, 0, 0] },
        ik: { ...both("hand", [0.24, 0.05, 0.36]), ...both("foot", [0.11, 0.09, -0.46]) },
        plant: { ...plants("hand", "sol"), ...plants("foot", 35) }, pole: { ...poles("hand", [0.5, -0.8, -0.4]), ...poles("foot", [0.2, 0, 1]) }, effort: e,
      });
      return [{ t: 0, p: k(0.84, 128, 0.35) }, { t: 0.45, p: k(0.76, 140, 0.65) }, { t: 0.52, p: k(0.76, 140, 1) }, { t: 0.88, p: k(0.84, 128, 0.8) }];
    })(),
  },
  dips: {
    dur: 2.6, az: 70, el: 12, props: ["banc_dips"],
    keys: (() => {
      const k = (y: number, e: number): Pose => ({
        root: [0, y, 0.02], rot: [-6, 0, 0], j: { neck: [6, 0, 0] },
        ik: { ...both("hand", [0.2, 0.47, -0.2]), ...both("foot", [0.12, 0.075, 0.62]) },
        plant: { ...plants("hand", "sol"), ...plants("foot", 0) }, pole: { ...poles("hand", [0.15, 0.2, -1]), ...poles("foot", [0.1, 0.4, 1]) }, effort: e,
      });
      return [{ t: 0, p: k(0.53, 0.35) }, { t: 0.42, p: k(0.31, 0.65) }, { t: 0.5, p: k(0.31, 1) }, { t: 0.86, p: k(0.53, 0.8) }];
    })(),
  },
  developpe_epaules: {
    dur: 2.6, az: 30, el: 6, props: ["halteres"],
    keys: (() => {
      const k = (y: number, x: number, e: number): Pose => ({
        ...STAND, ik: { ...FEET, ...both("hand", [x, y, 0.03]) }, pole: poles("hand", [1, -0.6, -0.1]), plant: plants("hand", "barre"), effort: e,
      });
      return [{ t: 0, p: k(1.5, 0.29, 0.6) }, { t: 0.4, p: k(2.02, 0.17, 1) }, { t: 0.5, p: k(2.02, 0.17, 0.75) }, { t: 0.92, p: k(1.5, 0.29, 0.55) }];
    })(),
  },
  developpe_couche: {
    dur: 2.6, az: 75, el: 22, props: ["banc", "halteres"],
    keys: (() => {
      const k = (y: number, x: number, e: number): Pose => supine({
        root: [0, 0.555, 0.02], rot: [-90, 0, 0],
        ik: { ...both("hand", [x, y, -0.4]), ...both("foot", [0.24, 0.075, 0.5]) }, plant: { ...plants("hand", "barre"), ...plants("foot", 0) },
        pole: { ...poles("hand", [1, 0, -0.5]), ...poles("foot", [0.3, 0, 1]) }, effort: e,
      });
      return [{ t: 0, p: k(1.06, 0.18, 0.35) }, { t: 0.45, p: k(0.69, 0.27, 0.7) }, { t: 0.52, p: k(0.69, 0.27, 1) }, { t: 0.9, p: k(1.06, 0.18, 0.75) }];
    })(),
  },
  elevation_laterale: {
    dur: 2.4, az: 15, el: 8, props: ["halteres"],
    keys: [
      { t: 0, p: { ...STAND, j: sym({ arm: [0, -80, 10], fore: [-15, 0, 0] }), effort: 0.35 } },
      { t: 0.42, p: { ...STAND, j: sym({ arm: [0, -80, 86], fore: [-15, 0, 0] }), effort: 1 } },
      { t: 0.52, p: { ...STAND, j: sym({ arm: [0, -80, 86], fore: [-15, 0, 0] }), effort: 0.8 } },
    ],
  },
  curl: {
    dur: 2.4, az: 35, el: 6, props: ["halteres"],
    keys: [
      { t: 0, p: { ...STAND, j: sym({ arm: [3, 0, 6], fore: [-6, 0, 0] }), effort: 0.35 } },
      { t: 0.42, p: { ...STAND, j: sym({ arm: [-12, 0, 6], fore: [-140, 0, 0] }), effort: 1 } },
      { t: 0.52, p: { ...STAND, j: sym({ arm: [-12, 0, 6], fore: [-140, 0, 0] }), effort: 0.8 } },
    ],
  },
  extension_triceps: {
    dur: 2.4, az: 120, el: 8, props: ["halteres"],
    keys: [
      { t: 0, p: { ...STAND, j: sym({ arm: [-168, -10, 8], fore: [-145, 0, 0] }), effort: 0.45 } },
      { t: 0.42, p: { ...STAND, j: sym({ arm: [-172, -10, 6], fore: [-8, 0, 0] }), effort: 1 } },
      { t: 0.52, p: { ...STAND, j: sym({ arm: [-172, -10, 6], fore: [-8, 0, 0] }), effort: 0.8 } },
    ],
  },
  traction: pullAnim(0.3, "barre", [1, -0.5, 0.1]),
  traction_large: pullAnim(0.44, "barre", [1, -0.3, -0.05]),
  traction_supination: pullAnim(0.19, "barreSup", [0.35, -0.6, 0.9]),
  traction_neutre: pullAnim(0.17, "barreNeutre", [0.5, -0.6, 0.7], ["poignees"]),
  traction_serree: pullAnim(0.1, "barre", [0.7, -0.6, 0.5]),
  traction_gainee: pullHollow(),
  traction_poitrine: pullChest(),

  pompe_large: pushAnim(17, 4.5, 0.42, 0.05, FLOOR_PIVOT, { pole: [1, -0.4, -0.2], handZ: PUSH_Z }),
  pompe_inclinee: pushAnim(38, 20, 0.27, 0.46, FLOOR_PIVOT, { props: [{ box: [0, 0.21, 0.62, 0.9, 0.42, 0.34] }], el: 10 }),
  pompe_declinee: pushAnim(2, -13, 0.27, 0.05, [0, 0.56, -0.86], { props: [{ box: [0, 0.24, -0.92, 0.5, 0.48, 0.34] }], el: 12 }),

  releve_genoux_suspendu: {
    dur: 2.6, az: 75, el: 4, props: ["barre"],
    keys: (() => {
      const k = (h: number, e: number): Pose => hang(HANG_X, [4 - h * 0.12, 0, 0], "barre", HANG_POLE, { ...sym({ thigh: [-6 - h, 0, 0], shin: [12 + h * 0.95, 0, 0], foot: [30, 0, 0] }), spine: [h * 0.12, 0, 0] }, e);
      return [{ t: 0, p: k(0, 0.45) }, { t: 0.42, p: k(100, 1) }, { t: 0.52, p: k(100, 0.85) }, { t: 0.92, p: k(0, 0.55) }];
    })(),
  },
  releve_jambes_suspendu: {
    dur: 2.8, az: 80, el: 4, props: ["barre"],
    keys: (() => {
      const k = (h: number, e: number): Pose => hang(HANG_X, [4 - h * 0.15, 0, 0], "barre", HANG_POLE, { ...sym({ thigh: [-4 - h, 0, 0], shin: [6, 0, 0], foot: [35, 0, 0] }), spine: [h * 0.12, 0, 0] }, e);
      return [{ t: 0, p: k(0, 0.5) }, { t: 0.42, p: k(92, 1) }, { t: 0.52, p: k(92, 0.85) }, { t: 0.92, p: k(0, 0.6) }];
    })(),
  },
  toes_to_bar: {
    dur: 3, az: 85, el: 6, props: ["barre"],
    keys: (() => {
      const k = (h: number, e: number): Pose => hang(HANG_X, [4 - h * 0.28, 0, 0], "barre", [1, -0.5, -0.3], { ...sym({ thigh: [-4 - h * 1.15, 0, 0], shin: [6, 0, 0], foot: [35, 0, 0] }), spine: [h * 0.2, 0, 0], chest: [h * 0.1, 0, 0] }, e);
      return [{ t: 0, p: k(0, 0.5) }, { t: 0.4, p: k(118, 1) }, { t: 0.5, p: k(118, 0.9) }, { t: 0.92, p: k(0, 0.6) }];
    })(),
  },
  genoux_obliques_suspendu: {
    dur: 3.4, az: 20, el: 4, props: ["barre"],
    keys: (() => {
      const k = (h: number, tw: number, e: number): Pose => hang(HANG_X, [4 - h * 0.1, tw, 0], "barre", HANG_POLE, { ...sym({ thigh: [-6 - h, 0, 0], shin: [12 + h * 0.95, 0, 0], foot: [30, 0, 0] }), spine: [h * 0.1, tw * 0.3, 0] }, e);
      return [{ t: 0, p: k(0, 0, 0.5) }, { t: 0.25, p: k(90, 32, 1) }, { t: 0.5, p: k(0, 0, 0.5) }, { t: 0.75, p: k(90, -32, 1) }];
    })(),
  },
  rowing: {
    dur: 2.4, az: 70, el: 12, props: ["halteres"],
    keys: (() => {
      const rot: V3 = [52, 0, 0];
      const root: V3 = [0, 0.9, -0.13];
      const sh = bodyPoint(root, rot, [0.19, 1.43, -0.01]);
      const k = (hy: number, hz: number, e: number): Pose => ({
        root, rot, j: { neck: [-28, 0, 0], spine: [-4, 0, 0] }, ik: { ...FEET, ...both("hand", [0.21, hy, hz]) },
        pole: { ...poles("hand", [0.25, 0.65, -0.9]), ...poles("foot", [0.25, 0, 1]) }, plant: plants("hand", "barre"), effort: e,
      });
      return [{ t: 0, p: k(sh[1] - 0.52, sh[2] + 0.04, 0.4) }, { t: 0.4, p: k(sh[1] - 0.24, sh[2] - 0.2, 1) }, { t: 0.52, p: k(sh[1] - 0.24, sh[2] - 0.2, 0.85) }, { t: 0.92, p: k(sh[1] - 0.52, sh[2] + 0.04, 0.5) }];
    })(),
  },
  souleve_de_terre: {
    dur: 3, az: 75, el: 8, props: ["halteres"],
    keys: (() => {
      const k = (a: number, y: number, z: number, e: number): Pose => ({
        root: [0, y, z], rot: [a, 0, 0], j: { ...sym({ arm: [-a + 4, 0, 4] }), neck: [-a * 0.35, 0, 0] }, ik: FEET, pole: poles("foot", [0.2, 0, 1]), effort: e,
      });
      return [{ t: 0, p: k(0, 0.98, 0, 0.45) }, { t: 0.45, p: k(72, 0.9, -0.15, 0.6) }, { t: 0.52, p: k(72, 0.9, -0.15, 1) }, { t: 0.92, p: k(0, 0.98, 0, 0.7) }];
    })(),
  },
  squat: {
    dur: 2.8, az: 55, el: 10,
    keys: (() => {
      const feet = { ...both("foot", [0.15, 0.075, 0.0]) };
      const k = (y: number, z: number, a: number, arms: number, e: number): Pose => ({
        root: [0, y, z], rot: [a, 0, 0], j: { ...sym({ arm: [arms, 0, 8], fore: [-10, 0, 0], foot: [0, 12, 0] }), neck: [-a * 0.6, 0, 0] },
        ik: feet, pole: poles("foot", [0.4, 0, 1]), effort: e,
      });
      return [{ t: 0, p: k(0.965, 0, 0, -20, 0.35) }, { t: 0.45, p: k(0.56, -0.17, 34, -112, 0.7) }, { t: 0.52, p: k(0.56, -0.17, 34, -112, 1) }, { t: 0.92, p: k(0.965, 0, 0, -20, 0.6) }];
    })(),
  },
  squat_sumo: {
    dur: 2.8, az: 30, el: 10,
    keys: (() => {
      const k = (y: number, z: number, a: number, e: number): Pose => ({
        root: [0, y, z], rot: [a, 0, 0], j: { ...sym({ arm: [-32, 0, -12], fore: [-118, 0, 0], foot: [0, 38, 0] }), neck: [-a * 0.6, 0, 0] },
        ik: both("foot", [0.29, 0.075, 0.02]), pole: poles("foot", [0.85, 0, 0.6]), effort: e,
      });
      return [{ t: 0, p: k(0.95, 0, 0, 0.35) }, { t: 0.45, p: k(0.6, -0.06, 14, 0.7) }, { t: 0.52, p: k(0.6, -0.06, 14, 1) }, { t: 0.92, p: k(0.95, 0, 0, 0.6) }];
    })(),
  },
  squat_goblet: {
    dur: 2.8, az: 50, el: 10, props: ["goblet"],
    keys: (() => {
      const k = (y: number, z: number, a: number, e: number): Pose => ({
        root: [0, y, z], rot: [a, 0, 0], j: { ...sym({ arm: [-30 + a * 0.2, 0, -16], fore: [-128, 0, 0], foot: [0, 15, 0] }), neck: [-a * 0.6, 0, 0] },
        ik: both("foot", [0.16, 0.075, 0.0]), pole: poles("foot", [0.45, 0, 1]), effort: e,
      });
      return [{ t: 0, p: k(0.965, 0, 0, 0.35) }, { t: 0.45, p: k(0.55, -0.13, 24, 0.7) }, { t: 0.52, p: k(0.55, -0.13, 24, 1) }, { t: 0.92, p: k(0.965, 0, 0, 0.6) }];
    })(),
  },
  squat_bulgare: {
    dur: 2.8, az: 85, el: 8, props: [{ box: [0, 0.21, -0.62, 0.5, 0.42, 0.34] }],
    keys: (() => {
      const k = (y: number, e: number): Pose => ({
        root: [0, y, -0.07], rot: [8, 0, 0], j: { ...sym({ arm: [0, 0, 8], fore: [-12, 0, 0] }), neck: [-5, 0, 0] },
        ik: { footL: [0.12, 0.075, 0.32], footR: [-0.12, 0.47, -0.6] }, plant: { footL: 0, footR: 172 },
        pole: { footL: [0.15, 0, 1], footR: [-0.05, -1, 0.2] }, effort: e,
      });
      return [{ t: 0, p: k(0.93, 0.35) }, { t: 0.45, p: k(0.58, 0.7) }, { t: 0.52, p: k(0.58, 1) }, { t: 0.92, p: k(0.93, 0.6) }];
    })(),
  },
  squat_pistol: {
    dur: 3.2, az: 75, el: 8,
    keys: (() => {
      const k = (y: number, z: number, a: number, th: number, arms: number, e: number): Pose => ({
        root: [-0.04, y, z], rot: [a, 0, 0],
        j: { ...L("thigh", [th, 0, 4]), ...L("shin", [5, 0, 0]), ...L("foot", [20, 0, 0]), ...sym({ arm: [arms, 0, 8], fore: [-8, 0, 0] }), neck: [-a * 0.5, 0, 0] },
        ik: { footR: [-0.1, 0.075, 0.0] }, plant: { footR: 0 }, pole: { footR: [-0.2, 0, 1] }, effort: e,
      });
      return [{ t: 0, p: k(0.96, 0, 4, -40, -85, 0.4) }, { t: 0.45, p: k(0.5, -0.16, 38, -118, -128, 0.75) }, { t: 0.53, p: k(0.5, -0.16, 38, -118, -128, 1) }, { t: 0.93, p: k(0.96, 0, 4, -40, -85, 0.6) }];
    })(),
  },
  dips_barres: {
    dur: 2.6, az: 75, el: 6, props: ["barres_paralleles"],
    keys: (() => {
      const k = (shY: number, e: number): Pose => {
        const rot: V3 = [4, 0, 0];
        return {
          root: placeRoot(rot, SHOULDERS, [0, shY, -0.02]), rot, j: { ...sym({ thigh: [-8, 0, 0], shin: [75, 0, 0], foot: [30, 0, 0] }), neck: [-4, 0, 0] },
          ik: both("hand", [0.26, 1.27, 0.02]), plant: plants("hand", "sol"), pole: poles("hand", [0.2, 0, -1]), effort: e,
        };
      };
      return [{ t: 0, p: k(1.77, 0.35) }, { t: 0.42, p: k(1.5, 0.65) }, { t: 0.5, p: k(1.5, 1) }, { t: 0.86, p: k(1.77, 0.8) }];
    })(),
  },
  dips_pectoraux: {
    dur: 2.6, az: 70, el: 6, props: ["barres_paralleles"],
    keys: (() => {
      const k = (shY: number, shZ: number, lean: number, e: number): Pose => {
        const rot: V3 = [lean, 0, 0];
        return {
          root: placeRoot(rot, SHOULDERS, [0, shY, shZ]), rot, j: { ...sym({ thigh: [-35, 0, 0], shin: [85, 0, 0], foot: [30, 0, 0] }), neck: [-12, 0, 0] },
          ik: both("hand", [0.26, 1.27, 0.02]), plant: plants("hand", "sol"), pole: poles("hand", [0.7, 0, -0.7]), effort: e,
        };
      };
      return [{ t: 0, p: k(1.76, 0.03, 16, 0.35) }, { t: 0.42, p: k(1.5, 0.1, 30, 0.65) }, { t: 0.5, p: k(1.5, 0.1, 30, 1) }, { t: 0.86, p: k(1.76, 0.03, 16, 0.8) }];
    })(),
  },
  squat_saute: {
    dur: 1.7, az: 55, el: 8,
    keys: (() => {
      const k = (y: number, z: number, a: number, arms: number, footY: number, toe: number, e: number): Pose => ({
        root: [0, y, z], rot: [a, 0, 0], j: { ...sym({ arm: [arms, 0, 8], fore: [-10, 0, 0], foot: [0, 10, 0] }), neck: [-a * 0.6, 0, 0] },
        ik: both("foot", [0.15, footY, 0.0]), plant: plants("foot", toe), pole: poles("foot", [0.4, 0, 1]), effort: e,
      });
      return [
        { t: 0, p: k(0.6, -0.15, 32, 40, 0.075, 0, 0.7) },
        { t: 0.22, p: k(1.0, 0, 0, -150, 0.12, 40, 1) },
        { t: 0.4, p: k(1.2, 0.0, -2, -170, 0.3, 45, 0.6) },
        { t: 0.62, p: k(0.96, 0, 2, -60, 0.075, 0, 0.6) },
        { t: 0.85, p: k(0.6, -0.15, 32, 40, 0.075, 0, 0.8) },
      ];
    })(),
  },
  fente: {
    dur: 2.8, az: 80, el: 8,
    keys: (() => {
      const k = (y: number, e: number): Pose => ({
        root: [0, y, -0.04], rot: [0, 0, 0], j: { ...sym({ arm: [0, 0, 8], fore: [-12, 0, 0] }) },
        ik: { footL: [0.12, 0.075, 0.36], footR: [-0.12, 0.13, -0.5] }, plant: { footL: 0, footR: 58 },
        pole: { footL: [0.15, 0, 1], footR: [-0.1, -0.2, 1] }, effort: e,
      });
      return [{ t: 0, p: k(0.92, 0.35) }, { t: 0.45, p: k(0.56, 0.7) }, { t: 0.52, p: k(0.56, 1) }, { t: 0.92, p: k(0.92, 0.6) }];
    })(),
  },
  chaise_murale: {
    dur: 3.6, az: 80, el: 8, props: ["mur"],
    keys: (() => {
      const k = (dy: number, e: number): Pose => ({
        root: [0, 0.5 + dy, -0.17], rot: [0, 0, 0], j: { ...sym({ arm: [0, 0, 6], fore: [-5, 0, 0] }) },
        ik: both("foot", [0.13, 0.075, 0.3]), pole: poles("foot", [0.2, 0, 1]), effort: e,
      });
      return [{ t: 0, p: k(0, 0.9) }, { t: 0.5, p: k(0.006, 0.95) }];
    })(),
  },
  mollets: {
    dur: 1.8, az: 70, el: 4,
    keys: [
      { t: 0, p: { ...STAND, ik: both("foot", [0.11, 0.075, -0.02]), plant: plants("foot", 0), effort: 0.4 } },
      { t: 0.4, p: { ...STAND, root: [0, 1.06, 0.04], ik: both("foot", [0.11, 0.155, 0.04]), plant: plants("foot", 45), effort: 1 } },
      { t: 0.55, p: { ...STAND, root: [0, 1.06, 0.04], ik: both("foot", [0.11, 0.155, 0.04]), plant: plants("foot", 45), effort: 0.85 } },
    ],
  },
  pont_fessier: {
    dur: 2.6, az: 70, el: 18, props: ["tapis"],
    keys: (() => {
      const k = (lift: number, e: number): Pose => {
        const rot: V3 = [-90 - lift, 0, 0];
        const root = placeRoot(rot, SHOULDERS, [0, 0.07, -0.46]);
        return supine({
          root, rot, j: { neck: [lift * 0.6 + 8, 0, 0] },
          ik: { ...both("foot", [0.14, 0.075, 0.36]), ...both("hand", [0.26, 0.035, -0.1]) },
          plant: { ...plants("foot", 0), ...plants("hand", "sol") }, pole: { ...poles("foot", [0.3, 0, 1]), ...poles("hand", [1, 0, 0.2]) }, effort: e,
        });
      };
      return [{ t: 0, p: k(0, 0.35) }, { t: 0.4, p: k(34, 1) }, { t: 0.55, p: k(34, 0.9) }, { t: 0.92, p: k(0, 0.45) }];
    })(),
  },
  gainage: {
    dur: 3.4, az: 65, el: 14, props: ["tapis"],
    keys: (() => {
      const k = (dy: number, e: number): Pose => {
        const rot: V3 = [84 - dy * 40, 0, 0];
        const root = placeRoot(rot, ANKLES, [0, 0.13, -0.84]);
        const sh = bodyPoint(root, rot, [0.19, 1.43, -0.01]);
        return {
          root, rot, j: { ...sym({ foot: [-12, 0, 0] }), neck: [-14, 0, 0] },
          ik: both("hand", [0.13, 0.04, sh[2] + 0.24]), plant: plants("hand", "sol"), pole: poles("hand", [0.1, -0.5, 1]), effort: e,
        };
      };
      return [{ t: 0, p: k(0, 0.9) }, { t: 0.5, p: k(0.04, 0.95) }];
    })(),
  },
  gainage_lateral: {
    dur: 3.4, az: -70, el: 12, props: ["tapis"],
    keys: (() => {
      const k = (lift: number, e: number): Pose => {
        const rot: V3 = [90 - lift, -90, 0];
        const root = placeRoot(rot, [0.1, 0.075, -0.02], [-0.08, 0.06, -0.8]);
        const sh = bodyPoint(root, rot, [0.19, 1.43, -0.01]);
        return {
          root, rot, j: { ...R("arm", [0, 0, 92]), ...R("fore", [-4, 0, 0]), ...sym({ foot: [-30, 0, 0] }), footR: [-30, 0, 0], neck: [0, 0, 8] },
          ik: { handL: [sh[0] - 0.24, 0.04, sh[2] + 0.02] }, plant: { handL: "sol" }, pole: { handL: [0.3, -0.8, 0.6] }, effort: e,
        };
      };
      return [{ t: 0, p: k(18, 0.9) }, { t: 0.5, p: k(20, 0.95) }];
    })(),
  },
  crunch: {
    dur: 2.4, az: 75, el: 16, props: ["tapis"],
    keys: (() => {
      const k = (c: number, e: number): Pose => supine({
        j: { spine: [c * 0.45, 0, 0], chest: [c * 0.4, 0, 0], neck: [10 + c * 0.3, 0, 0], ...sym({ arm: [-25, 0, -30], fore: [-140, 0, 0] }) },
        ik: both("foot", [0.13, 0.075, 0.42]), plant: plants("foot", 0), pole: poles("foot", [0.3, 0, 1]), effort: e,
      });
      return [{ t: 0, p: k(0, 0.35) }, { t: 0.42, p: k(55, 1) }, { t: 0.52, p: k(55, 0.85) }, { t: 0.92, p: k(0, 0.45) }];
    })(),
  },
  releve_jambes: {
    dur: 2.8, az: 80, el: 16, props: ["tapis"],
    keys: (() => {
      const k = (h: number, e: number): Pose => supine({
        j: { ...sym({ thigh: [-h, 0, 0], shin: [6, 0, 0], foot: [25, 0, 0] }), neck: [12, 0, 0] },
        ik: both("hand", [0.25, 0.035, -0.05]), plant: plants("hand", "sol"), pole: poles("hand", [1, 0, 0.2]), effort: e,
      });
      return [{ t: 0, p: k(12, 0.6) }, { t: 0.42, p: k(88, 1) }, { t: 0.52, p: k(88, 0.7) }, { t: 0.92, p: k(12, 0.75) }];
    })(),
  },
  hollow: {
    dur: 3.2, az: 80, el: 14, props: ["tapis"],
    keys: (() => {
      const k = (d: number, e: number): Pose => supine({
        root: [0, 0.1, 0], j: { spine: [12 + d, 0, 0], chest: [10 + d, 0, 0], neck: [14, 0, 0], ...sym({ thigh: [-26 - d, 0, 0], foot: [30, 0, 0], arm: [-160, 0, 8] }) },
        effort: e,
      });
      return [{ t: 0, p: k(0, 0.9) }, { t: 0.5, p: k(2, 0.95) }];
    })(),
  },
  superman: {
    dur: 2.6, az: 70, el: 14, props: ["tapis"],
    keys: (() => {
      const k = (l: number, e: number): Pose => ({
        root: [0, 0.115, 0], rot: [90, 0, 0],
        j: { spine: [-l * 0.4, 0, 0], chest: [-l * 0.45, 0, 0], neck: [-l * 0.3, 0, 0], ...sym({ arm: [-168 + l * 0.1, 0, 14], thigh: [l * 0.45, 0, 0], foot: [40, 0, 0] }) },
        effort: e,
      });
      return [{ t: 0, p: k(0, 0.35) }, { t: 0.42, p: k(32, 1) }, { t: 0.55, p: k(32, 0.85) }, { t: 0.92, p: k(0, 0.45) }];
    })(),
  },
  mountain_climber: {
    dur: 1, az: 70, el: 14,
    keys: (() => {
      // Le genou monte en deux temps (le pied décolle d'abord) pour que le pied ne racle pas le sol.
      const base = plank(20, 0.24, PUSH_Z + 0.02, { effort: 0.8 });
      // Genou ramené : le bassin monte (sinon le genou raclerait le sol), le pied d'appui reste planté.
      const upRot: V3 = [96, 0, 0];
      const up: Pose = {
        ...base, rot: upRot, root: placeRoot(upRot, SHOULDERS, [0, 0.56, PUSH_Z - 0.01]),
        ik: { ...base.ik, footL: [0.11, 0.13, -0.77], footR: [-0.11, 0.13, -0.77] }, plant: { ...base.plant, footL: 80, footR: 80 }, effort: 1,
      };
      const leg = (p: Pose, side: "L" | "R", th: number, sh: number): Pose => {
        const ik = { ...p.ik }; delete ik[side === "L" ? "footL" : "footR"];
        return { ...p, ik, j: { ...p.j, ...(side === "L" ? { ...L("thigh", [th, 0, 0]), ...L("shin", [sh, 0, 0]) } : { ...R("thigh", [th, 0, 0]), ...R("shin", [sh, 0, 0]) }) } };
      };
      return [
        { t: 0, p: base }, { t: 0.1, p: leg(up, "L", -30, 95) }, { t: 0.25, p: leg(up, "L", -115, 132) }, { t: 0.4, p: leg(up, "L", -30, 95) },
        { t: 0.5, p: base }, { t: 0.6, p: leg(up, "R", -30, 95) }, { t: 0.75, p: leg(up, "R", -115, 132) }, { t: 0.9, p: leg(up, "R", -30, 95) },
      ];
    })(),
  },
  burpee: {
    dur: 3.2, az: 70, el: 10,
    keys: (() => {
      const top = plank(20, 0.26, PUSH_Z, { effort: 0.6 });
      const down = plank(5, 0.26, PUSH_Z, { effort: 0.8 });
      const feetBack = { ...both("foot", [0.11, 0.13, -0.86]) };
      const withFeet = (p: Pose, e: number): Pose => ({ ...p, ik: { ...p.ik, ...feetBack }, plant: { ...p.plant, ...plants("foot", 85) }, pole: { ...p.pole, ...poles("foot", [0.2, 0, 1]) }, effort: e });
      const crouch: Pose = {
        root: [0, 0.42, -0.1], rot: [70, 0, 0], j: { neck: [-35, 0, 0] },
        ik: { ...both("foot", [0.14, 0.075, -0.02]), ...both("hand", [0.2, 0.05, PUSH_Z - 0.02]) }, plant: { ...plants("foot", 0), ...plants("hand", "sol") },
        pole: { ...poles("foot", [0.4, 0, 1]), ...poles("hand", [0.6, -0.4, -0.6]) }, effort: 0.8,
      };
      const jump: Pose = { root: [0, 1.2, 0], rot: [-3, 0, 0], ik: { ...both("foot", [0.12, 0.28, -0.04]), ...both("hand", [0.2, 2.12, 0.03]) }, pole: poles("hand", [1, 0, -0.3]), plant: plants("foot", 45), effort: 1 };
      const stand: Pose = { ...STAND, ik: { ...FEET, ...both("hand", [0.235, 0.9, 0.03]) }, pole: poles("hand", [0.3, 0, -1]), plant: plants("foot", 0), effort: 0.5 };
      // Sauts des pieds vers l'arrière puis vers l'avant : les pieds décollent, les genoux ne raclent pas le sol.
      const kick: Pose = { ...withFeet(top, 0.9), ik: { ...top.ik, ...both("foot", [0.12, 0.36, -0.4]) }, plant: { ...top.plant, ...plants("foot", 40) } };
      return [
        { t: 0, p: stand }, { t: 0.14, p: crouch }, { t: 0.2, p: kick }, { t: 0.27, p: withFeet(top, 0.6) }, { t: 0.38, p: withFeet(down, 0.8) },
        { t: 0.5, p: withFeet(top, 1) }, { t: 0.56, p: kick }, { t: 0.62, p: crouch }, { t: 0.78, p: jump }, { t: 0.92, p: stand },
      ];
    })(),
  },
  jumping_jack: {
    dur: 1, az: 20, el: 6,
    keys: [
      { t: 0, p: { root: [0, 0.975, 0], j: sym({ arm: [0, 0, 6], fore: [-8, 0, 0] }), ik: both("foot", [0.1, 0.075, -0.02]), effort: 0.5 } },
      { t: 0.25, p: { root: [0, 1.03, 0], j: sym({ arm: [0, 0, 90], fore: [-8, 0, 0] }), ik: both("foot", [0.22, 0.12, -0.02]), plant: plants("foot", 30), effort: 1 } },
      { t: 0.5, p: { root: [0, 0.95, 0], j: sym({ arm: [0, -10, 168], fore: [-8, 0, 0] }), ik: both("foot", [0.33, 0.075, -0.02]), pole: poles("foot", [0.5, 0, 1]), effort: 0.7 } },
      { t: 0.75, p: { root: [0, 1.03, 0], j: sym({ arm: [0, 0, 90], fore: [-8, 0, 0] }), ik: both("foot", [0.22, 0.12, -0.02]), plant: plants("foot", 30), effort: 1 } },
    ],
  },
  course: {
    dur: 0.8, az: 70, el: 6,
    keys: (() => {
      const k = (side: "L" | "R", y: number, e: number): Pose => {
        const up = side === "L" ? L : R, down = side === "L" ? R : L;
        return {
          root: [0, y, 0], rot: [6, 0, 0],
          j: { ...up("thigh", [-80, 0, 0]), ...up("shin", [95, 0, 0]), ...up("foot", [20, 0, 0]), ...down("thigh", [4, 0, 0]),
            ...down("arm", [-50, 0, 8]), ...down("fore", [-95, 0, 0]), ...up("arm", [35, 0, 8]), ...up("fore", [-85, 0, 0]) },
          effort: e,
        };
      };
      return [{ t: 0, p: k("L", 1.0, 1) }, { t: 0.25, p: { ...k("L", 0.96, 0.6), j: { ...sym({ arm: [-8, 0, 8], fore: [-90, 0, 0], thigh: [-20, 0, 0], shin: [30, 0, 0] }) } } }, { t: 0.5, p: k("R", 1.0, 1) }, { t: 0.75, p: { ...k("R", 0.96, 0.6), j: { ...sym({ arm: [-8, 0, 8], fore: [-90, 0, 0], thigh: [-20, 0, 0], shin: [30, 0, 0] }) } } }];
    })(),
  },
  rotation_tronc: {
    dur: 2.2, az: 20, el: 18, props: ["tapis"],
    keys: (() => {
      const k = (tw: number, e: number): Pose => ({
        root: [0, 0.13, -0.05], rot: [-42, 0, 0],
        j: { spine: [8, tw * 0.5, 0], chest: [6, tw * 0.6, 0], neck: [-8, tw * 0.2, 0], ...sym({ thigh: [-80, 0, 4], shin: [52, 0, 0], foot: [25, 0, 0], arm: [-22, 0, -22], fore: [-85, 0, 0] }) },
        effort: e,
      });
      return [{ t: 0, p: k(-35, 1) }, { t: 0.5, p: k(35, 1) }];
    })(),
  },
  etirement_ischios: {
    dur: 5, az: 70, el: 10,
    keys: (() => {
      const k = (a: number, e: number): Pose => ({
        root: [0, 0.94, -0.12], rot: [a, 0, 0], j: { spine: [14, 0, 0], chest: [10, 0, 0], neck: [12, 0, 0] },
        ik: { ...FEET, ...both("hand", [0.15, a > 80 ? 0.5 : 0.55, 0.31]) }, pole: { ...poles("hand", [0.4, 0, 0.3]), ...poles("foot", [0.1, 0, 1]) }, effort: e,
      });
      return [{ t: 0, p: k(76, 0.7) }, { t: 0.5, p: k(82, 0.9) }];
    })(),
  },
  etirement_quadriceps: {
    dur: 4.4, az: 80, el: 6,
    keys: (() => {
      const k = (s: number, e: number): Pose => ({
        root: [0, 0.975, 0], rot: [0, 0, 0],
        j: { ...L("thigh", [8 + s, 0, 0]), ...L("shin", [150, 0, 0]), ...L("foot", [40, 0, 0]), ...R("arm", [0, 0, 32]), ...R("fore", [-10, 0, 0]) },
        ik: { footR: [-0.11, 0.075, -0.02], handL: "footL" }, pole: { handL: [0.6, 0, -1] }, effort: e,
      });
      return [{ t: 0, p: k(0, 0.7) }, { t: 0.5, p: k(6, 0.9) }];
    })(),
  },
  etirement_pectoraux: {
    dur: 4.4, az: 140, el: 8,
    keys: (() => {
      const k = (b: number, e: number): Pose => ({
        ...STAND, j: { ...sym({ arm: [42 + b, -20, 18], fore: [-6, 0, 0] }), chest: [-6 - b * 0.3, 0, 0], neck: [-6, 0, 0] }, effort: e,
      });
      return [{ t: 0, p: k(0, 0.7) }, { t: 0.5, p: k(12, 0.9) }];
    })(),
  },
  chien_tete_en_bas: {
    dur: 4.4, az: 80, el: 8,
    keys: (() => {
      const k = (y: number, toe: number, e: number): Pose => ({
        root: [0, y, -0.12], rot: [138, 0, 0], j: { neck: [-6, 0, 0], spine: [-4, 0, 0] },
        ik: { ...both("hand", [0.22, 0.05, 0.56]), ...both("foot", [0.11, 0.09, -0.56]) },
        plant: { ...plants("hand", "sol"), ...plants("foot", toe) }, pole: { ...poles("hand", [0.3, 1, 0]), ...poles("foot", [0.1, 0, 1]) }, effort: e,
      });
      return [{ t: 0, p: k(0.76, 40, 0.7) }, { t: 0.5, p: k(0.78, 25, 0.9) }];
    })(),
  },
  fente_basse: {
    dur: 4.4, az: 85, el: 8, props: ["tapis"],
    keys: (() => {
      const k = (y: number, e: number): Pose => ({
        root: [0, y, -0.02], rot: [-6, 0, 0], j: { ...sym({ arm: [-170, 0, 8], fore: [-4, 0, 0] }), chest: [-6, 0, 0] },
        ik: { footL: [0.12, 0.075, 0.44], footR: [-0.12, 0.05, -0.66] }, plant: { footL: 0, footR: 172 },
        pole: { footL: [0.15, 0, 1], footR: [-0.05, -1, 0.15] }, effort: e,
      });
      return [{ t: 0, p: k(0.44, 0.7) }, { t: 0.5, p: k(0.41, 0.9) }];
    })(),
  },
};

const ease = (u: number) => u * u * (3 - 2 * u);

/** Pose à l'instant `phase` (0–1) de la boucle. */
export function sampleAnim(a: Anim, phase: number): Pose {
  const ks = a.keys;
  if (ks.length === 1) return ks[0].p;
  const t = ((phase % 1) + 1) % 1;
  let i = ks.length - 1;
  for (let k = 0; k < ks.length; k++) if (ks[k].t <= t) i = k;
  const a0 = ks[i], a1 = ks[(i + 1) % ks.length];
  const t1 = i + 1 < ks.length ? a1.t : 1 + ks[0].t;
  const u = (t - a0.t) / Math.max(1e-6, t1 - a0.t);
  return blendPose(a0.p, a1.p, ease(Math.max(0, Math.min(1, u))));
}
