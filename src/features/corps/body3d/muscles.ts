/*
 * Les muscles de l'écorché, faisceau par faisceau. Chaque faisceau est un fuseau à section elliptique qui passe par des
 * points d'ancrage fixés sur les os (origine → ventre → insertion). À chaque image, la courbe est recalculée à partir de
 * la pose : un muscle qui se raccourcit s'épaissit (volume conservé), un muscle étiré s'affine. Les extrémités sont des
 * tendons (nacrés, plats).
 *
 * Ancrages : [os, x, y, z] en coordonnées monde AU REPOS, côté gauche (+X). Le côté droit est obtenu par miroir.
 * Os sans côté (bassin, tronc, cou, tête) : écrits tels quels ; os latéraux sans suffixe : clav, arm, fore, hand, thigh, shin, foot.
 */
import { BufferAttribute, BufferGeometry, Vector3 } from "three";
import type { MuscleId } from "@/content/anatomy";
import { REST, type Joint, type Rig, type V3 } from "./rig";

type BoneKey = "hips" | "spine" | "chest" | "neck" | "head" | "clav" | "arm" | "fore" | "hand" | "thigh" | "shin" | "foot";
type Anchor = [BoneKey, number, number, number];

export interface StrandDef {
  id: MuscleId;
  /** Portion du muscle que ce faisceau représente (`PARTS` du catalogue). */
  part?: string;
  /** Faisceau unique couvrant deux portions : la première à l'origine, la seconde à l'insertion (grand droit : bas → haut). */
  grad?: [string, string];
  a: Anchor[];
  /** Demi-largeur et demi-épaisseur maximales du ventre (m). */
  w: number; d: number;
  /** Part tendineuse à l'origine et à l'insertion (0–1). */
  tend?: [number, number];
  /** Position du sommet du ventre (0–1 dans la partie charnue). */
  peak?: number;
  /** Intersections tendineuses (grand droit : 4). */
  seg?: number;
  /** Faisceau central (non dédoublé). */
  mid?: boolean;
  /** Profond : dessiné, mais un peu rentré. */
  deep?: boolean;
}

export const STRANDS: StrandDef[] = [
  /* --- Poitrine --- */
  { id: "pectoraux", part: "haut", a: [["clav", 0.06, 1.45, 0.085], ["chest", 0.12, 1.41, 0.095], ["arm", 0.2, 1.365, 0.045]], w: 0.0358, d: 0.014, tend: [0.04, 0.16] },
  { id: "pectoraux", part: "milieu", a: [["chest", 0.018, 1.4, 0.112], ["chest", 0.1, 1.37, 0.118], ["arm", 0.2, 1.355, 0.04]], w: 0.047, d: 0.02, tend: [0.03, 0.16], peak: 0.4 },
  { id: "pectoraux", part: "bas", a: [["chest", 0.022, 1.31, 0.112], ["chest", 0.11, 1.32, 0.11], ["arm", 0.198, 1.37, 0.035]], w: 0.0448, d: 0.017, tend: [0.03, 0.18], peak: 0.4 },
  /* --- Épaules --- */
  { id: "deltoide_ant", a: [["clav", 0.12, 1.465, 0.055], ["arm", 0.215, 1.405, 0.06], ["arm", 0.225, 1.3, 0.025]], w: 0.0299, d: 0.0187, tend: [0.04, 0.14], peak: 0.4 },
  { id: "deltoide_lat", a: [["clav", 0.185, 1.48, 0.0], ["arm", 0.245, 1.41, 0.0], ["arm", 0.236, 1.3, 0.005]], w: 0.0345, d: 0.022, tend: [0.04, 0.14], peak: 0.38 },
  { id: "deltoide_post", a: [["clav", 0.13, 1.45, -0.09], ["arm", 0.225, 1.405, -0.06], ["arm", 0.232, 1.305, -0.015]], w: 0.031, d: 0.0176, tend: [0.04, 0.14], peak: 0.4 },
  /* --- Bras --- */
  { id: "biceps", a: [["clav", 0.19, 1.42, 0.035], ["arm", 0.222, 1.31, 0.05], ["arm", 0.224, 1.22, 0.055], ["fore", 0.222, 1.115, 0.03]], w: 0.0299, d: 0.0275, tend: [0.14, 0.15], peak: 0.55 },
  { id: "brachial", a: [["arm", 0.21, 1.26, 0.015], ["arm", 0.228, 1.18, 0.03], ["fore", 0.222, 1.105, 0.015]], w: 0.0341, d: 0.013, tend: [0.05, 0.16], peak: 0.6, deep: true },
  { id: "triceps", part: "long", a: [["clav", 0.17, 1.41, -0.055], ["arm", 0.212, 1.3, -0.068], ["arm", 0.218, 1.2, -0.058], ["fore", 0.216, 1.14, -0.045]], w: 0.0319, d: 0.0242, tend: [0.1, 0.22], peak: 0.45 },
  { id: "triceps", part: "lateral", a: [["arm", 0.236, 1.38, -0.03], ["arm", 0.246, 1.27, -0.042], ["fore", 0.222, 1.135, -0.04]], w: 0.0248, d: 0.0176, tend: [0.04, 0.25], peak: 0.4 },
  { id: "avant_bras", part: "flech", a: [["arm", 0.198, 1.165, 0.0], ["fore", 0.21, 1.07, 0.035], ["fore", 0.225, 0.95, 0.03], ["hand", 0.232, 0.875, 0.024]], w: 0.0283, d: 0.0187, tend: [0.04, 0.38], peak: 0.3 },
  { id: "avant_bras", part: "ext", a: [["arm", 0.248, 1.17, -0.012], ["fore", 0.258, 1.07, -0.012], ["fore", 0.254, 0.95, -0.002], ["hand", 0.25, 0.875, 0.002]], w: 0.0248, d: 0.0176, tend: [0.04, 0.38], peak: 0.3 },
  { id: "avant_bras", part: "brachiorad", a: [["arm", 0.243, 1.225, 0.012], ["fore", 0.254, 1.1, 0.034], ["fore", 0.246, 0.94, 0.034]], w: 0.0224, d: 0.0176, tend: [0.04, 0.4], peak: 0.25 },
  /* --- Dos --- */
  { id: "trapezes", part: "sup", a: [["head", 0.018, 1.625, -0.062], ["neck", 0.06, 1.53, -0.062], ["clav", 0.16, 1.475, -0.03]], w: 0.04, d: 0.0176, tend: [0.08, 0.1], peak: 0.55 },
  { id: "trapezes", part: "moyen", a: [["chest", 0.008, 1.46, -0.105], ["chest", 0.075, 1.445, -0.115], ["clav", 0.15, 1.455, -0.075]], w: 0.045, d: 0.011, tend: [0.12, 0.08] },
  { id: "trapezes", part: "inf", a: [["chest", 0.008, 1.24, -0.122], ["chest", 0.055, 1.33, -0.128], ["clav", 0.105, 1.42, -0.112]], w: 0.0425, d: 0.0099, tend: [0.12, 0.12], peak: 0.6 },
  { id: "rhomboides", a: [["chest", 0.01, 1.41, -0.115], ["clav", 0.085, 1.35, -0.116]], w: 0.03, d: 0.007, tend: [0.06, 0.06], deep: true },
  { id: "coiffe", part: "infra", a: [["clav", 0.085, 1.375, -0.122], ["clav", 0.14, 1.39, -0.112], ["arm", 0.205, 1.415, -0.05]], w: 0.0408, d: 0.0132, tend: [0.03, 0.2] },
  { id: "coiffe", part: "rond", a: [["clav", 0.115, 1.295, -0.112], ["arm", 0.19, 1.36, -0.03]], w: 0.024, d: 0.0176, tend: [0.03, 0.2] },
  { id: "grand_dorsal", part: "haut", a: [["chest", 0.01, 1.3, -0.122], ["chest", 0.1, 1.31, -0.122], ["arm", 0.192, 1.37, -0.005]], w: 0.06, d: 0.0132, tend: [0.08, 0.16] },
  { id: "grand_dorsal", part: "milieu", a: [["spine", 0.01, 1.12, -0.102], ["chest", 0.12, 1.24, -0.102], ["chest", 0.158, 1.32, -0.05], ["arm", 0.19, 1.372, -0.005]], w: 0.075, d: 0.0144, tend: [0.12, 0.12], peak: 0.45 },
  { id: "grand_dorsal", part: "bas", a: [["hips", 0.07, 1.0, -0.1], ["spine", 0.132, 1.1, -0.07], ["chest", 0.162, 1.26, -0.04], ["arm", 0.19, 1.375, 0.0]], w: 0.06, d: 0.0144, tend: [0.12, 0.12], peak: 0.5 },
  { id: "lombaires", a: [["hips", 0.03, 0.955, -0.098], ["spine", 0.036, 1.1, -0.088], ["chest", 0.036, 1.28, -0.102], ["chest", 0.028, 1.44, -0.092], ["neck", 0.02, 1.52, -0.07]], w: 0.0242, d: 0.021, tend: [0.08, 0.1], peak: 0.3 },
  /* --- Tronc --- */
  { id: "abdos", grad: ["bas", "haut"], a: [["hips", 0.02, 0.885, 0.094], ["spine", 0.034, 1.05, 0.11], ["chest", 0.038, 1.18, 0.114], ["chest", 0.048, 1.29, 0.108]], w: 0.036, d: 0.014, tend: [0.04, 0.03], peak: 0.7, seg: 4 },
  { id: "obliques", a: [["chest", 0.148, 1.27, 0.0], ["spine", 0.145, 1.13, 0.02], ["hips", 0.138, 1.01, 0.025]], w: 0.0414, d: 0.013, tend: [0.05, 0.08] },
  { id: "obliques", a: [["chest", 0.128, 1.31, 0.07], ["spine", 0.118, 1.15, 0.088], ["hips", 0.085, 1.0, 0.098]], w: 0.0368, d: 0.011, tend: [0.05, 0.12] },
  { id: "dentele", a: [["chest", 0.118, 1.335, 0.075], ["chest", 0.152, 1.345, -0.015], ["clav", 0.12, 1.335, -0.095]], w: 0.014, d: 0.008, tend: [0.05, 0.1] },
  { id: "dentele", a: [["chest", 0.128, 1.29, 0.065], ["chest", 0.158, 1.305, -0.025], ["clav", 0.12, 1.305, -0.1]], w: 0.014, d: 0.008, tend: [0.05, 0.1] },
  { id: "dentele", a: [["chest", 0.136, 1.25, 0.05], ["chest", 0.162, 1.27, -0.03], ["clav", 0.118, 1.28, -0.105]], w: 0.013, d: 0.007, tend: [0.05, 0.1] },
  { id: "cou", a: [["chest", 0.018, 1.462, 0.068], ["neck", 0.042, 1.54, 0.032], ["head", 0.06, 1.615, -0.022]], w: 0.014, d: 0.012, tend: [0.12, 0.12] },
  /* --- Hanches --- */
  { id: "fessiers", part: "bas", a: [["hips", 0.025, 0.935, -0.102], ["hips", 0.1, 0.875, -0.118], ["thigh", 0.152, 0.8, -0.035]], w: 0.069, d: 0.0352, tend: [0.04, 0.16], peak: 0.45 },
  { id: "fessiers", part: "haut", a: [["hips", 0.075, 1.0, -0.102], ["hips", 0.14, 0.925, -0.088], ["thigh", 0.168, 0.84, -0.02]], w: 0.0552, d: 0.0264, tend: [0.04, 0.16], peak: 0.45 },
  { id: "moyen_fessier", a: [["hips", 0.135, 1.025, -0.035], ["hips", 0.158, 0.965, -0.025], ["thigh", 0.168, 0.895, -0.002]], w: 0.0495, d: 0.02, tend: [0.04, 0.18] },
  { id: "flechisseurs_hanche", part: "psoas", a: [["spine", 0.042, 1.08, 0.0], ["hips", 0.072, 0.94, 0.065], ["thigh", 0.088, 0.855, 0.045]], w: 0.02, d: 0.02, tend: [0.04, 0.2], deep: true },
  { id: "flechisseurs_hanche", part: "couturier", a: [["hips", 0.122, 0.985, 0.078], ["thigh", 0.105, 0.78, 0.092], ["thigh", 0.062, 0.6, 0.045], ["shin", 0.075, 0.44, 0.025]], w: 0.011, d: 0.008, tend: [0.04, 0.12] },
  { id: "flechisseurs_hanche", part: "tfl", a: [["hips", 0.135, 0.985, 0.05], ["thigh", 0.162, 0.87, 0.04]], w: 0.019, d: 0.014, tend: [0.04, 0.3] },
  /* --- Cuisses --- */
  { id: "quadriceps", part: "droit", a: [["hips", 0.11, 0.965, 0.08], ["thigh", 0.112, 0.78, 0.092], ["thigh", 0.106, 0.62, 0.082], ["shin", 0.1, 0.465, 0.07]], w: 0.0442, d: 0.036, tend: [0.08, 0.2], peak: 0.45 },
  { id: "quadriceps", part: "vlat", a: [["thigh", 0.158, 0.86, 0.022], ["thigh", 0.166, 0.7, 0.03], ["thigh", 0.142, 0.56, 0.042], ["shin", 0.118, 0.47, 0.055]], w: 0.052, d: 0.0384, tend: [0.05, 0.16], peak: 0.45 },
  { id: "quadriceps", part: "vmed", a: [["thigh", 0.08, 0.75, 0.04], ["thigh", 0.066, 0.62, 0.05], ["thigh", 0.074, 0.545, 0.06], ["shin", 0.09, 0.47, 0.06]], w: 0.0442, d: 0.036, tend: [0.05, 0.14], peak: 0.7 },
  { id: "ischios", part: "biceps", a: [["hips", 0.092, 0.88, -0.08], ["thigh", 0.128, 0.72, -0.082], ["thigh", 0.14, 0.57, -0.062], ["shin", 0.148, 0.45, -0.032]], w: 0.039, d: 0.03, tend: [0.08, 0.2], peak: 0.5 },
  { id: "ischios", part: "semi", a: [["hips", 0.078, 0.88, -0.082], ["thigh", 0.078, 0.72, -0.088], ["thigh", 0.07, 0.57, -0.062], ["shin", 0.072, 0.44, -0.03]], w: 0.039, d: 0.03, tend: [0.08, 0.2], peak: 0.55 },
  { id: "adducteurs", part: "long", a: [["hips", 0.028, 0.885, 0.05], ["thigh", 0.058, 0.78, 0.028], ["thigh", 0.072, 0.62, 0.0]], w: 0.0525, d: 0.0299, tend: [0.06, 0.14], peak: 0.35 },
  { id: "adducteurs", part: "grand", a: [["hips", 0.035, 0.87, 0.0], ["thigh", 0.058, 0.74, -0.03], ["thigh", 0.075, 0.58, -0.03]], w: 0.045, d: 0.0276, tend: [0.06, 0.14], peak: 0.35 },
  /* --- Jambes --- */
  { id: "mollets", part: "jmed", a: [["thigh", 0.082, 0.52, -0.042], ["shin", 0.084, 0.38, -0.078], ["shin", 0.094, 0.24, -0.062], ["foot", 0.1, 0.06, -0.072]], w: 0.036, d: 0.0299, tend: [0.04, 0.45], peak: 0.4 },
  { id: "mollets", part: "jlat", a: [["thigh", 0.122, 0.52, -0.042], ["shin", 0.126, 0.39, -0.066], ["shin", 0.106, 0.25, -0.062], ["foot", 0.1, 0.06, -0.072]], w: 0.03, d: 0.0242, tend: [0.04, 0.45], peak: 0.4 },
  { id: "mollets", part: "sol", a: [["shin", 0.1, 0.42, -0.038], ["shin", 0.12, 0.28, -0.05], ["foot", 0.1, 0.075, -0.066]], w: 0.0408, d: 0.0161, tend: [0.04, 0.3], peak: 0.55, deep: true },
  { id: "tibial", a: [["shin", 0.12, 0.45, 0.042], ["shin", 0.116, 0.28, 0.046], ["foot", 0.09, 0.06, 0.045]], w: 0.0207, d: 0.0165, tend: [0.04, 0.38], peak: 0.35 },
];

/* ---------------- Construction ---------------- */

const SEG_T = 22; // anneaux le long du faisceau
const SEG_A = 14; // points par anneau

export interface Strand {
  def: StrandDef;
  side: "L" | "R" | "C";
  bones: Joint[];
  /** Ancrages et normales sortantes, dans le repère local de l'os. */
  local: Vector3[]; outs: Vector3[];
  restLen: number;
  geo: BufferGeometry;
  /** Centre courant (monde), pour cadrer la caméra. */
  center: Vector3;
  /** Points courants au quart, à la moitié et aux trois quarts du faisceau (étiquettes des portions). */
  q: [Vector3, Vector3, Vector3];
}

const boneOf = (k: BoneKey, side: "L" | "R" | "C"): Joint =>
  (["hips", "spine", "chest", "neck", "head"].includes(k) ? k : `${k}${side === "R" ? "R" : "L"}`) as Joint;

/** Axe de l'os (segment articulation → articulation suivante), pour orienter « vers l'extérieur ». */
const AXIS_END: Partial<Record<Joint, Joint>> = {
  armL: "foreL", foreL: "handL", thighL: "shinL", shinL: "footL",
  armR: "foreR", foreR: "handR", thighR: "shinR", shinR: "footR",
};

function outward(bone: Joint, p: Vector3): Vector3 {
  const end = AXIS_END[bone];
  if (end) {
    const a = new Vector3(...REST[bone]), b = new Vector3(...REST[end]);
    const ab = b.clone().sub(a); const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq()));
    return p.clone().sub(a.add(ab.multiplyScalar(t))).normalize();
  }
  if (bone.startsWith("hand") || bone.startsWith("foot")) return new Vector3(0, 0, 1);
  // Tronc, cou, tête, ceinture scapulaire : radial autour de l'axe vertical du corps.
  const o = new Vector3(p.x, 0, p.z + 0.01);
  return o.lengthSq() < 1e-6 ? new Vector3(0, 0, 1) : o.normalize();
}

export function buildStrands(): Strand[] {
  const out: Strand[] = [];
  for (const def of STRANDS) {
    const sides: ("L" | "R" | "C")[] = def.mid ? ["C"] : ["L", "R"];
    for (const side of sides) {
      const bones: Joint[] = [], local: Vector3[] = [], outs: Vector3[] = [];
      const world: Vector3[] = [];
      for (const [k, x, y, z] of def.a) {
        const b = boneOf(k, side);
        const p = new Vector3(side === "R" ? -x : x, y, z);
        world.push(p);
        const r = REST[b];
        bones.push(b); local.push(new Vector3(p.x - r[0], p.y - r[1], p.z - r[2]));
        outs.push(outward(b, p));
      }
      let restLen = 0; for (let i = 1; i < world.length; i++) restLen += world[i].distanceTo(world[i - 1]);
      const geo = new BufferGeometry();
      const n = (SEG_T + 1) * (SEG_A + 1);
      geo.setAttribute("position", new BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute("normal", new BufferAttribute(new Float32Array(n * 3), 3));
      const uv = new Float32Array(n * 2);
      for (let i = 0; i <= SEG_T; i++) for (let k = 0; k <= SEG_A; k++) { const o = (i * (SEG_A + 1) + k) * 2; uv[o] = i / SEG_T; uv[o + 1] = k / SEG_A; }
      geo.setAttribute("uv", new BufferAttribute(uv, 2));
      const idx: number[] = [];
      for (let i = 0; i < SEG_T; i++) for (let k = 0; k < SEG_A; k++) {
        const a = i * (SEG_A + 1) + k, b = a + SEG_A + 1;
        // Sens choisi pour que les faces regardent vers l'extérieur.
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
      geo.setIndex(idx);
      out.push({ def, side, bones, local, outs, restLen, geo, center: new Vector3(), q: [new Vector3(), new Vector3(), new Vector3()] });
    }
  }
  return out;
}

/* Courbe de Catmull-Rom (centripète simplifiée) passant par les points P, paramétrée par la longueur. */
function catmull(P: Vector3[], s: number, out: Vector3) {
  const n = P.length;
  if (n === 2) return out.copy(P[0]).lerp(P[1], s);
  const L: number[] = [0];
  for (let i = 1; i < n; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1]));
  const target = s * L[n - 1];
  let i = 0; while (i < n - 2 && L[i + 1] < target) i++;
  const u = (target - L[i]) / Math.max(1e-6, L[i + 1] - L[i]);
  const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
  const u2 = u * u, u3 = u2 * u;
  for (const ax of ["x", "y", "z"] as const) {
    out[ax] = 0.5 * ((2 * p1[ax]) + (-p0[ax] + p2[ax]) * u + (2 * p0[ax] - 5 * p1[ax] + 4 * p2[ax] - p3[ax]) * u2 + (-p0[ax] + 3 * p1[ax] - 3 * p2[ax] + p3[ax]) * u3);
  }
  return out;
}

const P: Vector3[] = Array.from({ length: 8 }, () => new Vector3());
const O: Vector3[] = Array.from({ length: 8 }, () => new Vector3());
const C: Vector3[] = Array.from({ length: SEG_T + 1 }, () => new Vector3());
const OUT: Vector3[] = Array.from({ length: SEG_T + 1 }, () => new Vector3());
const T = new Vector3(), W = new Vector3(), Dv = new Vector3(), tmp = new Vector3();

/** Profil du faisceau : 0 aux bouts, 1 au sommet du ventre, tendon plat de part et d'autre. */
function profile(t: number, t0: number, t1: number, peak: number) {
  if (t <= t0 || t >= 1 - t1) return 0;
  let u = (t - t0) / (1 - t0 - t1);
  u = u < peak ? 0.5 * (u / peak) : 0.5 + 0.5 * ((u - peak) / (1 - peak));
  return Math.pow(Math.sin(Math.PI * u), 0.62);
}

/**
 * Recalcule la géométrie d'un faisceau pour la pose courante.
 * `swell` : gonflement dû à la contraction (0–1).
 */
export function updateStrand(s: Strand, rig: Rig, swell: number) {
  const n = s.local.length;
  for (let i = 0; i < n; i++) {
    const b = rig.bones[s.bones[i]];
    P[i].copy(s.local[i]).applyMatrix4(b.matrixWorld);
    O[i].copy(s.outs[i]).transformDirection(b.matrixWorld);
  }
  const pts = P.slice(0, n);
  let len = 0; for (let i = 1; i < n; i++) len += pts[i].distanceTo(pts[i - 1]);
  // Conservation du volume : plus court → plus épais.
  const k = Math.max(0.72, Math.min(1.5, Math.sqrt(s.restLen / Math.max(1e-4, len))));
  const { w, d, tend = [0.08, 0.12], peak = 0.5, deep } = s.def;
  const ww = w * k * (deep ? 0.92 : 1), dd = d * Math.pow(k, 1.35) * (1 + 0.12 * swell) * (deep ? 0.9 : 1);
  s.center.set(0, 0, 0);
  for (let i = 0; i <= SEG_T; i++) {
    const t = i / SEG_T;
    catmull(pts, t, C[i]);
    // Normale sortante interpolée entre les ancrages voisins.
    const f = t * (n - 1), j = Math.min(n - 2, Math.floor(f));
    OUT[i].copy(O[j]).lerp(O[j + 1], f - j);
    s.center.add(C[i]);
  }
  s.center.multiplyScalar(1 / (SEG_T + 1));
  s.q[0].copy(C[Math.round(SEG_T * 0.25)]); s.q[1].copy(C[Math.round(SEG_T * 0.5)]); s.q[2].copy(C[Math.round(SEG_T * 0.75)]);
  const pos = s.geo.attributes.position.array as Float32Array;
  const nor = s.geo.attributes.normal.array as Float32Array;
  for (let i = 0; i <= SEG_T; i++) {
    const t = i / SEG_T;
    T.copy(C[Math.min(SEG_T, i + 1)]).sub(C[Math.max(0, i - 1)]).normalize();
    W.crossVectors(T, OUT[i]);
    if (W.lengthSq() < 1e-6) W.set(1, 0, 0).cross(T);
    W.normalize();
    Dv.crossVectors(W, T).normalize();
    const pr = profile(t, tend[0], tend[1], peak);
    // Tendon : ruban plat et fin ; ventre : ellipse pleine.
    const rw = Math.max(ww * (0.28 + 0.72 * pr), 0.0025);
    const rd = Math.max(dd * pr, dd * 0.18, 0.0018);
    for (let a = 0; a <= SEG_A; a++) {
      const ang = (a / SEG_A) * Math.PI * 2;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const o = (i * (SEG_A + 1) + a) * 3;
      tmp.copy(C[i]).addScaledVector(W, ca * rw).addScaledVector(Dv, sa * rd);
      // Rentrer le faisceau sous la surface : la face interne s'écrase contre le plan profond.
      if (sa < 0) tmp.addScaledVector(Dv, -sa * rd * 0.45);
      pos[o] = tmp.x; pos[o + 1] = tmp.y; pos[o + 2] = tmp.z;
      // Normale d'ellipse.
      tmp.copy(W).multiplyScalar(ca / rw).addScaledVector(Dv, sa / rd).normalize();
      nor[o] = tmp.x; nor[o + 1] = tmp.y; nor[o + 2] = tmp.z;
    }
  }
  s.geo.attributes.position.needsUpdate = true;
  s.geo.attributes.normal.needsUpdate = true;
}

/** Point d'un faisceau au repos (pour l'ombre et le cadrage sans pose). */
export const restAnchor = (a: Anchor): V3 => [a[1], a[2], a[3]];
