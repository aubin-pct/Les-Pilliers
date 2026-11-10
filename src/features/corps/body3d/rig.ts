/*
 * Squelette de l'écorché : articulations en position de repos (debout, bras le long du corps, paumes en avant),
 * application d'une pose (rotations locales + cibles IK des mains et des pieds), IK analytique à deux segments.
 *
 * Repère : Y vers le haut, la figure regarde +Z, sa gauche est +X. Unités : mètres (1,80 m).
 * Au repos toutes les rotations sont nulles : une position « monde au repos » se convertit en position locale
 * d'un os en lui retranchant la position de repos de cet os (c'est ainsi que les muscles sont décrits).
 *
 * Conventions d'angles (degrés, ordre ZXY : torsion Y d'abord) :
 *  - bras : X négatif = vers l'avant (flexion), Z positif = écarté (gauche) ; coude : X négatif = flexion ;
 *  - cuisse : X négatif = genou vers l'avant ; genou : X positif = flexion ; tronc et tête : X positif = vers l'avant.
 *  Côté droit : mêmes valeurs avec Y et Z opposés (`mirror`).
 */
import { Euler, Matrix4, Object3D, Quaternion, Vector3 } from "three";

export type V3 = [number, number, number];
export type Side = "L" | "R";
export type Joint =
  | "hips" | "spine" | "chest" | "neck" | "head"
  | "clavL" | "armL" | "foreL" | "handL" | "thighL" | "shinL" | "footL"
  | "clavR" | "armR" | "foreR" | "handR" | "thighR" | "shinR" | "footR";
export type Limb = "handL" | "handR" | "footL" | "footR";

/** Positions de repos (côté gauche ; le droit en est le miroir). */
const REST_L: Record<string, V3> = {
  hips: [0, 0.98, 0], spine: [0, 1.08, -0.01], chest: [0, 1.28, -0.02], neck: [0, 1.5, -0.03], head: [0, 1.59, -0.01],
  clav: [0.02, 1.46, 0.05], arm: [0.19, 1.43, -0.01], fore: [0.215, 1.15, -0.02], hand: [0.235, 0.89, 0.01],
  thigh: [0.09, 0.92, 0.01], shin: [0.1, 0.49, 0.01], foot: [0.1, 0.075, -0.02],
};
/** Extrémités (pour la longueur du dernier segment et le dessin). */
export const TIPS_L = { hand: [0.245, 0.72, 0.02] as V3, toe: [0.11, 0.0, 0.18] as V3 };

const PARENT: Record<Joint, Joint | null> = {
  hips: null, spine: "hips", chest: "spine", neck: "chest", head: "neck",
  clavL: "chest", armL: "clavL", foreL: "armL", handL: "foreL", thighL: "hips", shinL: "thighL", footL: "shinL",
  clavR: "chest", armR: "clavR", foreR: "armR", handR: "foreR", thighR: "hips", shinR: "thighR", footR: "shinR",
};
export const JOINTS = Object.keys(PARENT) as Joint[];

export const mirrorX = (p: V3): V3 => [-p[0], p[1], p[2]];
export const mirror = (r: V3): V3 => [r[0], -r[1], -r[2]];

export function restOf(j: Joint): V3 {
  const side = j.endsWith("L") ? "L" : j.endsWith("R") ? "R" : null;
  const base = side ? REST_L[j.slice(0, -1)] : REST_L[j];
  return side === "R" ? mirrorX(base) : base;
}
export const REST: Record<Joint, V3> = Object.fromEntries(JOINTS.map((j) => [j, restOf(j)])) as Record<Joint, V3>;

/** Squelette monté : un Object3D par articulation. */
export interface Rig { root: Object3D; bones: Record<Joint, Object3D> }

export function buildRig(): Rig {
  const root = new Object3D();
  const bones = {} as Record<Joint, Object3D>;
  for (const j of JOINTS) { const o = new Object3D(); o.name = j; bones[j] = o; }
  for (const j of JOINTS) {
    const p = PARENT[j]; const r = REST[j];
    if (p) { const pr = REST[p]; bones[j].position.set(r[0] - pr[0], r[1] - pr[1], r[2] - pr[2]); bones[p].add(bones[j]); }
    else { bones[j].position.set(r[0], r[1], r[2]); root.add(bones[j]); }
  }
  return { root, bones };
}

/* ---------------- Poses ---------------- */

/** Orientation imposée à une main ou un pied posé : doigts/orteils F, normale de la paume/semelle N (monde). */
export type Plant = "sol" | "barre" | "barreSup" | "barreNeutre" | number;

export interface Pose {
  /** Position du bassin (monde). */
  root: V3;
  /** Rotation du bassin (degrés, ZXY). */
  rot?: V3;
  /** Rotations locales (degrés). */
  j?: Partial<Record<Joint, V3>>;
  /** Cible du poignet / de la cheville (monde), ou une articulation à rejoindre. */
  ik?: Partial<Record<Limb, V3 | Joint>>;
  /** Direction du coude / du genou, dans le repère du bassin. */
  pole?: Partial<Record<Limb, V3>>;
  /** Main : « sol » paume au sol, « barre » prise en pronation ; pied : angle de la pointe (0 = à plat). */
  plant?: Partial<Record<Limb, Plant>>;
  /** Effort instantané 0–1 (module l'intensité des couleurs). */
  effort?: number;
}

const D = Math.PI / 180;
const tmpE = new Euler(0, 0, 0, "ZXY");
const qFrom = (r: V3 | undefined, q = new Quaternion()) => (r ? q.setFromEuler(tmpE.set(r[0] * D, r[1] * D, r[2] * D, "ZXY")) : q.identity());

const DEFAULT_POLE: Record<Limb, V3> = { handL: [0.5, -0.3, -1], handR: [-0.5, -0.3, -1], footL: [0.25, 0, 1], footR: [-0.25, 0, 1] };
const CHAIN: Record<Limb, [Joint, Joint, Joint]> = { handL: ["armL", "foreL", "handL"], handR: ["armR", "foreR", "handR"], footL: ["thighL", "shinL", "footL"], footR: ["thighR", "shinR", "footR"] };

const v1 = new Vector3(), v2 = new Vector3(), v3 = new Vector3(), v4 = new Vector3(), v5 = new Vector3();
const q1 = new Quaternion(), q2 = new Quaternion(), q3 = new Quaternion();
const m1 = new Matrix4();

function worldQuat(o: Object3D, q: Quaternion) { return o.getWorldQuaternion(q); }

/** Fait pointer l'os `bone` de façon que son enfant `child` vise `target` (monde), en gardant la torsion. */
function aim(bone: Object3D, child: Object3D, target: Vector3) {
  const p = bone.getWorldPosition(v1);
  const c = child.getWorldPosition(v2).sub(p).normalize();
  const t = v3.copy(target).sub(p).normalize();
  if (c.lengthSq() < 1e-8 || t.lengthSq() < 1e-8) return;
  q1.setFromUnitVectors(c, t);
  const w = worldQuat(bone, q2).premultiply(q1);
  const parentQ = bone.parent ? worldQuat(bone.parent, q3) : q3.identity();
  bone.quaternion.copy(parentQ.invert().multiply(w));
  bone.updateMatrixWorld(true);
}

/** Oriente un os en monde : son axe local -Y (main) ou +Z (pied) suit F, sa normale suit N. */
function orient(bone: Object3D, F: Vector3, N: Vector3, foot: boolean) {
  // Main au repos : doigts -Y, paume +Z. Pied au repos : orteils +Z, semelle -Y.
  const f = F.clone().normalize();
  const n = N.clone().sub(f.clone().multiplyScalar(N.dot(f))).normalize();
  let X: Vector3, Y: Vector3, Z: Vector3;
  if (foot) { Z = f; Y = n.clone().negate(); X = new Vector3().crossVectors(Y, Z); }
  else { Y = f.clone().negate(); Z = n; X = new Vector3().crossVectors(Y, Z); }
  const w = q1.setFromRotationMatrix(m1.makeBasis(X, Y, Z));
  const parentQ = bone.parent ? worldQuat(bone.parent, q3) : q3.identity();
  bone.quaternion.copy(parentQ.invert().multiply(w));
  bone.updateMatrixWorld(true);
}

function solveLimb(rig: Rig, limb: Limb, target: Vector3, poleLocal: V3) {
  const [a, b, c] = CHAIN[limb].map((j) => rig.bones[j]);
  const A = a.getWorldPosition(new Vector3());
  const la = b.position.length(), lb = c.position.length();
  const toT = target.clone().sub(A);
  const d = Math.max(Math.abs(la - lb) + 1e-3, Math.min(la + lb - 1e-4, toT.length()));
  const dir = toT.normalize();
  const hipsQ = worldQuat(rig.bones.hips, new Quaternion());
  const pole = new Vector3(...poleLocal).applyQuaternion(hipsQ);
  let perp = pole.sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (perp.lengthSq() < 1e-6) perp = new Vector3(0, 0, 1).cross(dir);
  perp.normalize();
  const cosA = Math.max(-1, Math.min(1, (la * la + d * d - lb * lb) / (2 * la * d)));
  const sinA = Math.sqrt(1 - cosA * cosA);
  const B = A.clone().add(dir.clone().multiplyScalar(cosA * la)).add(perp.multiplyScalar(sinA * la));
  aim(a, b, B);
  aim(b, c, A.add(dir.multiplyScalar(d)));
}

/** Applique une pose au squelette. */
export function applyPose(rig: Rig, pose: Pose) {
  const { bones } = rig;
  for (const j of JOINTS) { if (j !== "hips") qFrom(pose.j?.[j], bones[j].quaternion); }
  bones.hips.position.set(...pose.root);
  qFrom(pose.rot, bones.hips.quaternion);
  rig.root.updateMatrixWorld(true);
  const order: Limb[] = ["footL", "footR", "handL", "handR"]; // les mains peuvent viser un pied
  for (const limb of order) {
    const t = pose.ik?.[limb]; if (t === undefined) continue;
    const target = typeof t === "string" ? bones[t].getWorldPosition(v4) : v4.set(...t);
    solveLimb(rig, limb, target.clone(), pose.pole?.[limb] ?? DEFAULT_POLE[limb]);
    const end = bones[limb];
    const foot = limb.startsWith("foot");
    const pl = pose.plant?.[limb] ?? (foot ? 0 : undefined);
    if (pl === undefined) { qFrom(pose.j?.[limb], end.quaternion); end.updateMatrixWorld(true); continue; }
    if (foot) {
      const a = (typeof pl === "number" ? pl : 0) * D;
      const yaw = (pose.j?.[limb]?.[1] ?? 0) * D;
      // Pointe abaissée de `a` : orteils F, semelle N (vers le bas et l'arrière).
      orient(end, v5.set(Math.sin(yaw) * Math.cos(a), -Math.sin(a), Math.cos(yaw) * Math.cos(a)), new Vector3(-Math.sin(yaw) * Math.sin(a), -Math.cos(a), -Math.cos(yaw) * Math.sin(a)), true);
    } else if (pl === "sol") orient(end, v5.set(0, 0, 1), new Vector3(0, -1, 0), false);
    else if (pl === "barre") orient(end, v5.set(0, 1, 0), new Vector3(0, 0, 1), false);
    else if (pl === "barreSup") orient(end, v5.set(0, 1, 0), new Vector3(0, 0, -1), false);
    else if (pl === "barreNeutre") orient(end, v5.set(0, 1, 0), new Vector3(limb === "handL" ? -1 : 1, 0, 0), false); // paumes face à face
  }
}

/** Position monde d'un point exprimé au repos, une fois la pose appliquée (pour cadrer, poser l'ombre…). */
export function worldOfRest(rig: Rig, bone: Joint, restWorld: V3, out = new Vector3()) {
  const r = REST[bone];
  return out.set(restWorld[0] - r[0], restWorld[1] - r[1], restWorld[2] - r[2]).applyMatrix4(rig.bones[bone].matrixWorld);
}

/* ---------------- Interpolation ---------------- */

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerp3 = (a: V3 | undefined, b: V3 | undefined, u: number): V3 | undefined => (!a && !b ? undefined : [lerp(a?.[0] ?? 0, b?.[0] ?? 0, u), lerp(a?.[1] ?? 0, b?.[1] ?? 0, u), lerp(a?.[2] ?? 0, b?.[2] ?? 0, u)]);

export function blendPose(a: Pose, b: Pose, u: number): Pose {
  const j: Partial<Record<Joint, V3>> = {};
  for (const k of new Set([...Object.keys(a.j ?? {}), ...Object.keys(b.j ?? {})]) as Set<Joint>) j[k] = lerp3(a.j?.[k], b.j?.[k], u);
  const ik: Pose["ik"] = {}, pole: Pose["pole"] = {}, plant: Pose["plant"] = {};
  for (const l of ["handL", "handR", "footL", "footR"] as Limb[]) {
    const ta = a.ik?.[l], tb = b.ik?.[l];
    if (ta !== undefined && tb !== undefined && typeof ta !== "string" && typeof tb !== "string") ik[l] = lerp3(ta, tb, u);
    else if (ta !== undefined || tb !== undefined) { const t = u < 0.5 ? ta ?? tb : tb ?? ta; if (t !== undefined) ik[l] = t; }
    const pa = a.pole?.[l], pb = b.pole?.[l];
    if (pa || pb) pole[l] = lerp3(pa ?? pb, pb ?? pa, u);
    const fa = a.plant?.[l], fb = b.plant?.[l];
    if (typeof fa === "number" || typeof fb === "number") plant[l] = lerp(typeof fa === "number" ? fa : 0, typeof fb === "number" ? fb : 0, u);
    else { const t = fa === fb ? fa : u < 0.15 ? fa : u > 0.85 ? fb : undefined; if (t !== undefined) plant[l] = t; } // une main ne se pose qu'en arrivant
  }
  return {
    root: lerp3(a.root, b.root, u)!, rot: lerp3(a.rot, b.rot, u), j, ik, pole, plant,
    effort: lerp(a.effort ?? 0.6, b.effort ?? 0.6, u),
  };
}

/** Position du bassin qui amène le point `restWorld` (au repos) sur `world`, une fois tourné de `rot`. */
export function placeRoot(rot: V3, restWorld: V3, world: V3): V3 {
  const h = REST.hips;
  const v = new Vector3(restWorld[0] - h[0], restWorld[1] - h[1], restWorld[2] - h[2]).applyQuaternion(qFrom(rot));
  return [world[0] - v.x, world[1] - v.y, world[2] - v.z];
}
/** Inverse : où arrive un point de repos du tronc, pour un bassin placé en `root` et tourné de `rot`. */
export function bodyPoint(root: V3, rot: V3, restWorld: V3): V3 {
  const h = REST.hips;
  const v = new Vector3(restWorld[0] - h[0], restWorld[1] - h[1], restWorld[2] - h[2]).applyQuaternion(qFrom(rot));
  return [root[0] + v.x, root[1] + v.y, root[2] + v.z];
}
