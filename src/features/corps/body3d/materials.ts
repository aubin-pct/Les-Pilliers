/*
 * Matières de l'écorché, en shaders maison (éclairage de studio attaché à la caméra : le modèle reste lisible
 * quel que soit l'angle). Les couleurs sont écrites directement en espace d'affichage (sortie linéaire du rendu).
 *
 *  - muscle : fibres fines, tendons nacrés aux extrémités, intersections tendineuses (grand droit), rampe de chaleur
 *    selon l'activation (repos → rouge sombre → rouge vif → orange → jaune chaud), pulsation avec l'effort ;
 *  - tissu : plan profond sombre sous les muscles ; os : ivoire ; pierre : tête façon statue ; métal : barre, haltères.
 */
import { Color, DoubleSide, ShaderMaterial } from "three";

export type Kind = "muscle" | "tissu" | "os" | "pierre" | "metal" | "oeil";
const KIND: Record<Kind, number> = { muscle: 0, tissu: 1, os: 2, pierre: 3, metal: 4, oeil: 5 };

const vert = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const frag = /* glsl */ `
uniform vec3 uBase; uniform vec3 uRim;
uniform float uKind; uniform float uHeat; uniform float uPulse; uniform float uSel; uniform float uGhost;
uniform float uFibers; uniform vec2 uTend; uniform float uSeg; uniform float uSeed;
varying vec3 vN; varying vec3 vV; varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
// Intensité : repos (neutre) → vert → jaune → orange → rouge.
vec3 heat(float h) {
  vec3 g = vec3(0.22, 0.62, 0.30), y = vec3(0.90, 0.80, 0.18), o = vec3(0.97, 0.48, 0.12), r = vec3(0.88, 0.10, 0.08);
  if (h < 0.08) return mix(uBase, g, smoothstep(0.0, 0.08, h));
  if (h < 0.45) return mix(g, y, (h - 0.08) / 0.37);
  if (h < 0.72) return mix(y, o, (h - 0.45) / 0.27);
  return mix(o, r, min(1.0, (h - 0.72) / 0.23));
}
void main() {
  vec3 N = normalize(vN); vec3 V = normalize(vV);
  if (!gl_FrontFacing) N = -N;
  float t = vUv.x, a = vUv.y;
  vec3 alb = uBase; float tendon = 0.0; float gloss = 0.12; float shin = 24.0;
  if (uKind < 0.5) {
    alb = heat(uHeat);
    float ts = 1.0 - smoothstep(uTend.x * 0.7, uTend.x * 1.2 + 0.001, t);
    float te = smoothstep(1.0 - uTend.y * 1.2 - 0.001, 1.0 - uTend.y * 0.7, t);
    tendon = max(ts, te);
    // Fibres : lignes fines qui suivent le faisceau, légèrement ondulées.
    float f = a * uFibers + noise(vec2(t * 5.0 + uSeed, a * 30.0)) * 0.7;
    float line = smoothstep(0.38, 0.5, abs(fract(f) - 0.5));
    alb *= 1.0 - 0.28 * line * (1.0 - tendon);
    alb *= 0.9 + 0.2 * noise(vec2(t * 40.0 + uSeed, a * 120.0));
    if (uSeg > 0.0) {
      float s = abs(fract(t * uSeg) - 0.5);
      tendon = max(tendon, smoothstep(0.41, 0.48, s) * 0.85);
    }
    alb = mix(alb, vec3(0.72, 0.66, 0.6), tendon);
    gloss = mix(0.32, 0.55, tendon); shin = mix(30.0, 70.0, tendon);
  } else if (uKind < 1.5) { // tissu profond
    alb = uBase * (0.85 + 0.25 * noise(vUv * vec2(60.0, 30.0)));
    gloss = 0.1;
  } else if (uKind < 2.5) { // os
    alb = uBase * (0.92 + 0.12 * noise(vUv * vec2(40.0, 12.0)));
    gloss = 0.28; shin = 40.0;
  } else if (uKind < 3.5) { // pierre
    alb = uBase * (0.82 + 0.3 * noise(vUv * vec2(70.0, 50.0))) ;
    gloss = 0.08;
  } else if (uKind < 4.5) { // métal
    gloss = 0.9; shin = 90.0;
  }
  vec3 L1 = normalize(vec3(-0.45, 0.75, 0.55));
  vec3 L2 = normalize(vec3(0.85, -0.05, 0.3));
  vec3 L3 = normalize(vec3(0.1, 0.4, -1.0));
  float wrap = max(dot(N, L1) * 0.55 + 0.45, 0.0);
  float d2 = max(dot(N, L2), 0.0);
  vec3 col = alb * (0.3 + 0.85 * wrap * wrap + 0.3 * d2);
  if (uKind < 0.5) col += alb * vec3(0.22, 0.04, 0.03) * (1.0 - wrap); // diffusion sous la surface
  col += gloss * pow(max(dot(N, normalize(L1 + V)), 0.0), shin);
  col += gloss * 0.4 * pow(max(dot(N, normalize(L2 + V)), 0.0), shin);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  col += uRim * rim * (0.22 + 0.25 * max(dot(N, L3), 0.0));
  if (uKind < 0.5) col += heat(uHeat) * uHeat * uHeat * (0.06 + 0.26 * uPulse) * (1.0 - tendon);
  if (uKind > 4.5) col = uBase * (0.9 + 0.5 * uPulse) + rim * uBase;
  col += uSel * (rim * vec3(1.0, 0.86, 0.55) * 1.4 + vec3(0.07, 0.05, 0.03));
  float alpha = 1.0;
  if (uGhost > 0.0) {
    vec3 g = vec3(0.42, 0.46, 0.52) * (0.06 + rim * 0.9);
    col = mix(col, g, uGhost);
    alpha = mix(1.0, 0.06 + rim * 0.32, uGhost);
  }
  gl_FragColor = vec4(col, alpha);
}`;

export function makeMat(kind: Kind, base: string, opts: { fibers?: number; tend?: [number, number]; seg?: number; rim?: string; seed?: number } = {}) {
  return new ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true,
    ...(kind === "muscle" ? { side: DoubleSide } : {}),
    uniforms: {
      uBase: { value: new Color(base) }, uRim: { value: new Color(opts.rim ?? "#d08a5a") },
      uKind: { value: KIND[kind] }, uHeat: { value: 0 }, uPulse: { value: 0 }, uSel: { value: 0 }, uGhost: { value: 0 },
      uFibers: { value: opts.fibers ?? 9 }, uTend: { value: opts.tend ?? [0.08, 0.12] }, uSeg: { value: opts.seg ?? 0 }, uSeed: { value: opts.seed ?? 0 },
    },
  });
}

/** Sol : dalle sombre, anneaux gravés, fondu vers le fond. */
export function floorMat(bg: string, ring: string) {
  return new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uBg: { value: new Color(bg) }, uRing: { value: new Color(ring) } },
    vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `uniform vec3 uBg; uniform vec3 uRing; varying vec2 vP;
      void main(){
        float r = length(vP);
        float fade = 1.0 - smoothstep(0.6, 2.4, r);
        vec3 c = mix(uBg, uBg * 1.9 + 0.015, fade);
        float ring = smoothstep(0.012, 0.0, abs(fract(r * 2.0) - 0.5) - 0.488) * fade;
        float grid = (smoothstep(0.006, 0.0, abs(fract(vP.x * 4.0) - 0.5) - 0.494) + smoothstep(0.006, 0.0, abs(fract(vP.y * 4.0) - 0.5) - 0.494)) * fade * 0.35;
        c += uRing * (ring * 0.18 + grid * 0.06);
        gl_FragColor = vec4(c, fade * 0.98 + 0.02);
      }`,
  });
}

/** Ombre de contact : ellipse floue. */
export function shadowMat() {
  return new ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `varying vec2 vU; void main(){ vU = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `varying vec2 vU; void main(){ float r = length(vU); gl_FragColor = vec4(0.0, 0.0, 0.0, 0.55 * pow(1.0 - smoothstep(0.0, 1.0, r), 1.6)); }`,
  });
}
