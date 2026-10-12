/**
 * Melo's name in raised champagne-gold lettering across the front of his
 * robe, in the app's own serif (Cormorant Garamond Bold). Shared by the
 * guide page (web/satya/melo.js) and the welcome story (web/story/story.js).
 */
import * as THREE from 'three';
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js';
import { Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

/** The robe: his widest, lowest piece. */
export function findRobe(model) {
  let robe = null;
  let best = 0;
  model.updateMatrixWorld(true);
  model.traverse(o => {
    if (!o.isMesh) return;
    const b = new THREE.Box3().setFromObject(o);
    const score = (b.max.x - b.min.x) * (b.max.y - b.min.y) - b.min.y;
    if (score > best) {
      best = score;
      robe = o;
    }
  });
  return robe;
}

/**
 * "Melo" in champagne gold, wrapped onto the front of the robe: the robe's curve is
 * measured at a few heights (front depth and half-width), and every letter
 * point is pushed onto that curve, so the name sits on the fabric like a
 * raised print rather than a flat sign in front of it.
 */
/**
 * Builds the name for `robe` (a mesh inside `model`), in the coordinates of
 * the model's parent, measured with the model where it is now. `envMap`
 * gives the metal something to reflect in scenes without an environment.
 */
export function robeName(ttf, robe, model, envMap = null) {
  const font = new Font(new TTFLoader().parse(ttf));
  const box = new THREE.Box3().setFromObject(robe);
  const height = box.max.y - box.min.y;
  const width = box.max.x - box.min.x;
  const cy = box.min.y + height * 0.64; // across the chest of the robe

  const geo = new TextGeometry('Melo', {
    font,
    size: height * 0.2,
    depth: height * 0.022,
    curveSegments: 14,
    bevelEnabled: true,
    bevelThickness: height * 0.006,
    bevelSize: height * 0.0045,
    bevelSegments: 3,
  });
  geo.computeBoundingBox();
  const tb = geo.boundingBox;
  // Centre the word, then size it to about half the robe's width.
  const k = Math.min(1, (width * 0.5) / (tb.max.x - tb.min.x));
  geo.translate(-(tb.max.x + tb.min.x) / 2, -(tb.max.y + tb.min.y) / 2, -tb.min.z);
  geo.scale(k, k, 1);

  // Measure the robe: its front surface (z) and half-width (x) at each height.
  const ray = new THREE.Raycaster();
  model.updateMatrixWorld(true);
  const front = y => {
    ray.set(new THREE.Vector3(0, y, 5), new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObject(robe, true)[0];
    return hit ? hit.point.z : null;
  };
  const side = y => {
    ray.set(new THREE.Vector3(5, y, 0), new THREE.Vector3(-1, 0, 0));
    const hit = ray.intersectObject(robe, true)[0];
    return hit ? hit.point.x : null;
  };
  const span = (tb.max.y - tb.min.y) * k;
  const samples = [];
  for (let i = 0; i <= 8; i++) {
    const y = cy - span * 0.8 + (span * 1.6 * i) / 8;
    const z = front(y);
    const x = side(y);
    if (z !== null && x !== null) samples.push({ y, b: z, a: x });
  }
  const at = y => {
    if (!samples.length) return { a: width / 2, b: 0.1 };
    let s0 = samples[0];
    for (const s of samples) if (s.y <= y) s0 = s;
    const s1 = samples.find(s => s.y > y) || s0;
    const f = s1 === s0 ? 0 : (y - s0.y) / (s1.y - s0.y);
    return { a: s0.a + (s1.a - s0.a) * f, b: s0.b + (s1.b - s0.b) * f };
  };

  // Wrap: each point keeps its x and y, and sits on the robe's curve (an
  // ellipse in plan) plus its own depth in the letter.
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i) + cy;
    const { a, b } = at(y);
    const u = Math.min(0.98, Math.abs(x) / a);
    const surface = b * Math.sqrt(1 - u * u);
    pos.setXYZ(i, x, y, surface - b * 0.01 + pos.getZ(i));
  }
  geo.computeVertexNormals();

  // The app's champagne (brand.champagne / champagneLight) as satin metal:
  // a soft, warm sheen rather than a brassy yellow, edges a shade deeper.
  const face = new THREE.MeshPhysicalMaterial({
    color: 0xf1dcae,
    metalness: 1,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.8,
    emissive: 0x2e2416,
  });
  if (envMap) face.envMap = envMap;
  const edge = face.clone();
  edge.color.set(0xd4af6a);
  edge.roughness = 0.34;
  const name = new THREE.Mesh(geo, [face, edge]);
  // Lettering a few millimetres proud of the fabric casts no visible shadow.
  name.castShadow = false;
  name.userData.isName = true;
  return name;
}

