/* eslint-env browser */
/**
 * Memo's welcome story, in 3D.
 *
 * Aarav asks his mom to remind him to call Grandma on her birthday; Mom has a
 * busy day and forgets; Grandma waits all day for the call. Then Satya shows
 * up, and next year Memo rings an alarm in the morning so Aarav remembers.
 *
 * The app shows this page in a WebView (src/modules/onboarding/WelcomeStory.tsx)
 * and drives it with window.story.show(sceneIndex); captions, progress and
 * buttons are drawn by the app. Speech bubbles are drawn here, pinned above
 * the speaker's head.
 *
 * Aarav and Mom are built from simple shapes with jointed arms, legs and head,
 * so they can walk, wave, talk, slump and jump. Satya is the app's own GLB.
 *
 * Build (from MyApp/): npm run build:story → assets/web/story/story.bundle.js
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const params = new URLSearchParams(location.search);
const reduced = params.get('motion') === 'reduced';

function post(msg) {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
}

// ---- Small helpers ------------------------------------------------------------------

const clamp01 = v => Math.min(1, Math.max(0, v));
/** 0 → 1 as t goes from a to b. */
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const ease = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const bump = p => Math.sin(Math.PI * clamp01(p));
const lerp = (a, b, p) => a + (b - a) * p;

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.02, ...opts });
}

function mesh(geometry, material, { x = 0, y = 0, z = 0, shadow = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  return m;
}

/** A limb that hangs down from its pivot (shoulder or hip). */
function limb(radius, length, material, endRadius, endMaterial) {
  const pivot = new THREE.Group();
  pivot.add(mesh(new THREE.CapsuleGeometry(radius, length, 6, 12), material, { y: -length / 2 - radius * 0.3 }));
  if (endRadius) pivot.add(mesh(new THREE.SphereGeometry(endRadius, 16, 12), endMaterial, { y: -length - radius * 0.9 }));
  return pivot;
}

// ---- Characters -------------------------------------------------------------------

/**
 * A stylized person. Returns the joints the scenes animate: root (position and
 * turn), body (lean), head, arms and legs (rotations), and setMood().
 */
function makePerson({ kind }) {
  const kid = kind === 'kid';
  const skin = mat(kid ? 0xf3c9a6 : 0xe9b48f, { roughness: 0.75 });
  const hair = mat(kid ? 0x2a1e1a : 0x3b2620, { roughness: 0.9 });
  const top = mat(kid ? 0x3f7cf0 : 0xc95c7a, { roughness: 0.8 });
  const bottom = mat(kid ? 0x26345e : 0x8e3a5e, { roughness: 0.85 });
  const shoe = mat(kid ? 0xf2f2f2 : 0x5a2b3f);
  const ink = mat(0x1e1512, { roughness: 0.3 });
  const gold = mat(0xe7c17a, { metalness: 0.6, roughness: 0.3 });

  const s = kid ? 0.78 : 1; // overall scale
  const legLen = 0.42 * s;
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = legLen + 0.12 * s;
  root.add(hips);

  const legL = limb(0.07 * s, legLen, bottom);
  const legR = limb(0.07 * s, legLen, bottom);
  legL.position.x = -0.09 * s;
  legR.position.x = 0.09 * s;
  for (const leg of [legL, legR]) {
    leg.add(mesh(new THREE.BoxGeometry(0.13 * s, 0.07 * s, 0.22 * s), shoe, { y: -legLen - 0.1 * s, z: 0.04 * s }));
    hips.add(leg);
  }

  const body = new THREE.Group();
  hips.add(body);
  const torsoH = 0.5 * s;
  if (kid) {
    body.add(mesh(new THREE.CapsuleGeometry(0.2 * s, torsoH * 0.55, 8, 16), top, { y: torsoH * 0.5 }));
    // Hoodie pocket and strings.
    body.add(mesh(new THREE.BoxGeometry(0.22 * s, 0.08 * s, 0.02), mat(0x356bd6), { y: torsoH * 0.28, z: 0.19 * s }));
  } else {
    // A kurta that flares into a long hem, with a gold dupatta across it.
    const profile = [
      [0.0, -0.36],
      [0.3, -0.36],
      [0.26, -0.1],
      [0.19, 0.2],
      [0.2, 0.42],
      [0.16, 0.52],
      [0.0, 0.54],
    ].map(([r, y]) => new THREE.Vector2(r * s, y * s));
    body.add(mesh(new THREE.LatheGeometry(profile, 32), top));
    const dupatta = mesh(new THREE.TorusGeometry(0.24 * s, 0.03 * s, 8, 32, Math.PI * 1.1), gold);
    dupatta.rotation.set(0.25, 0.2, 2.2);
    dupatta.position.set(0, 0.22 * s, 0.02);
    body.add(dupatta);
  }

  const shoulderY = kid ? torsoH * 0.82 : 0.46 * s;
  const shoulderX = kid ? 0.25 * s : 0.22 * s;
  const armLen = kid ? 0.3 * s : 0.36 * s;
  const armL = limb(0.055 * s, armLen, top, 0.065 * s, skin);
  const armR = limb(0.055 * s, armLen, top, 0.065 * s, skin);
  armL.position.set(-shoulderX, shoulderY, 0);
  armR.position.set(shoulderX, shoulderY, 0);
  armL.rotation.z = -0.12;
  armR.rotation.z = 0.12;
  body.add(armL, armR);

  // Head.
  const headR = (kid ? 0.26 : 0.22) * s;
  const head = new THREE.Group();
  head.position.y = shoulderY + headR * 1.05;
  body.add(head);
  head.add(mesh(new THREE.CylinderGeometry(0.05 * s, 0.06 * s, 0.1 * s, 12), skin, { y: -headR * 0.95 }));
  head.add(mesh(new THREE.SphereGeometry(headR, 32, 24), skin));
  for (const side of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(headR * 0.18, 12, 10), skin, { x: side * headR * 0.98 }));

  // Hair: a cap over the top and back, plus a fringe (kid) or a bun (mom).
  const cap = mesh(new THREE.SphereGeometry(headR * 1.06, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  cap.rotation.x = -0.35;
  head.add(cap);
  if (kid) {
    for (let i = -2; i <= 2; i++) {
      const tuft = mesh(new THREE.ConeGeometry(headR * 0.16, headR * 0.4, 8), hair, {
        x: i * headR * 0.22,
        y: headR * 0.88,
        z: headR * 0.35,
      });
      tuft.rotation.x = 0.9;
      tuft.rotation.z = -i * 0.25;
      head.add(tuft);
    }
  } else {
    head.add(mesh(new THREE.SphereGeometry(headR * 0.42, 20, 16), hair, { y: headR * 0.75, z: -headR * 0.55 }));
    const back = mesh(new THREE.SphereGeometry(headR * 1.08, 24, 16, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.5), hair);
    back.position.z = -headR * 0.12;
    back.scale.set(1, 1.15, 0.9);
    head.add(back);
    head.add(mesh(new THREE.SphereGeometry(headR * 0.06, 10, 8), mat(0xc0392b), { y: headR * 0.32, z: headR * 0.96 }));
    for (const side of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(headR * 0.08, 10, 8), gold, { x: side * headR * 1.02, y: -headR * 0.25 }));
  }

  // Face.
  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(headR * 0.11, 14, 12), ink, { x: side * headR * 0.36, y: headR * 0.08, z: headR * 0.9 }, false);
    eye.add(mesh(new THREE.SphereGeometry(headR * 0.035, 8, 6), mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }), { x: headR * 0.03, y: headR * 0.04, z: headR * 0.08 }));
    head.add(eye);
    eyes.push(eye);
    head.add(mesh(new THREE.SphereGeometry(headR * 0.13, 12, 10), mat(0xf29c9c, { transparent: true, opacity: 0.55 }), { x: side * headR * 0.55, y: -headR * 0.18, z: headR * 0.8 }, false));
  }
  const brows = [-1, 1].map(side => {
    const brow = mesh(new THREE.BoxGeometry(headR * 0.28, headR * 0.05, headR * 0.05), hair, { x: side * headR * 0.36, y: headR * 0.33, z: headR * 0.9 }, false);
    head.add(brow);
    return brow;
  });
  const mouth = new THREE.Group();
  mouth.position.set(0, -headR * 0.3, headR * 0.93);
  head.add(mouth);
  const smile = mesh(new THREE.TorusGeometry(headR * 0.2, headR * 0.045, 8, 20, Math.PI), mat(0x8a3b2e), {}, false);
  smile.rotation.z = Math.PI; // a "U": a smile
  mouth.add(smile);
  const open = mesh(new THREE.SphereGeometry(headR * 0.12, 14, 10), mat(0x6e2a20), {}, false);
  open.scale.set(1, 1.3, 0.5);
  mouth.add(open);

  function setMood(mood) {
    const sad = mood === 'sad' || mood === 'worried';
    smile.visible = mood !== 'surprised';
    open.visible = mood === 'surprised';
    smile.rotation.z = sad ? 0 : Math.PI;
    smile.position.y = sad ? -headR * 0.12 : 0;
    brows[0].rotation.z = sad ? -0.35 : mood === 'surprised' ? 0.15 : 0;
    brows[1].rotation.z = sad ? 0.35 : mood === 'surprised' ? -0.15 : 0;
    brows.forEach(b => (b.position.y = headR * (mood === 'surprised' ? 0.42 : 0.33)));
  }
  setMood('happy');

  return { root, hips, body, head, armL, armR, legL, legR, mouth, eyes, setMood, height: hips.position.y + head.position.y + headR };
}

/** Resets a person to standing still, before a frame's moves are applied. */
function rest(p, t) {
  const breathe = Math.sin(t * 2.2);
  p.hips.position.y = p.hips.userData.y ?? (p.hips.userData.y = p.hips.position.y);
  p.body.rotation.set(0.02 * breathe, 0, 0);
  p.body.scale.set(1, 1 + 0.012 * breathe, 1);
  p.head.rotation.set(0, 0, 0.04 * Math.sin(t * 0.9));
  p.armL.rotation.set(0.05 * breathe, 0, -0.12);
  p.armR.rotation.set(-0.05 * breathe, 0, 0.12);
  p.legL.rotation.set(0, 0, 0);
  p.legR.rotation.set(0, 0, 0);
  p.mouth.scale.set(1, 1, 1);
  // Blink every few seconds.
  const blink = (t + p.root.id * 0.7) % 3.6 < 0.12 ? 0.15 : 1;
  p.eyes.forEach(e => (e.scale.y = blink));
}

const moves = {
  /** Walk from x0 to x1 over [a, b] seconds, facing the way they go. */
  walk(p, t, a, b, x0, x1, faceEnd = 0) {
    const k = seg(t, a, b);
    p.root.position.x = lerp(x0, x1, ease(k));
    if (k > 0 && k < 1) {
      const swing = Math.sin((t - a) * 9);
      p.legL.rotation.x = 0.55 * swing;
      p.legR.rotation.x = -0.55 * swing;
      p.armL.rotation.x = -0.45 * swing;
      p.armR.rotation.x = 0.45 * swing;
      p.hips.position.y += 0.03 * Math.abs(swing);
      p.root.rotation.y = Math.sign(x1 - x0) * 1.2;
    } else {
      p.root.rotation.y = lerp(p.root.rotation.y, faceEnd, 0.15);
    }
  },
  wave(p, t, a, b, arm = 'R') {
    const k = seg(t, a, b);
    if (k <= 0 || k >= 1) return;
    const up = bump(k) > 0.25 ? 1 : bump(k) * 4;
    const j = arm === 'R' ? p.armR : p.armL;
    const side = arm === 'R' ? 1 : -1;
    j.rotation.z = side * (0.12 + up * (2.5 + 0.35 * Math.sin((t - a) * 12)));
  },
  talk(p, t, a, b) {
    const k = seg(t, a, b);
    if (k <= 0 || k >= 1) return;
    p.mouth.scale.set(1, 0.6 + 0.9 * Math.abs(Math.sin((t - a) * 13)), 1);
    p.head.rotation.x += 0.06 * Math.sin((t - a) * 6);
    p.armR.rotation.x -= 0.25 * bump(k) * (0.6 + 0.4 * Math.sin((t - a) * 5));
  },
  nod(p, t, a, b) {
    const k = seg(t, a, b);
    if (k > 0 && k < 1) p.head.rotation.x += 0.25 * Math.sin(k * Math.PI * 4) * (1 - k);
  },
  sad(p, amount = 1) {
    p.head.rotation.x += 0.35 * amount;
    p.body.rotation.x += 0.12 * amount;
    p.armL.rotation.z = -0.04;
    p.armR.rotation.z = 0.04;
  },
  think(p, t, a, b) {
    const k = ease(seg(t, a, a + 0.6)) * (1 - seg(t, b - 0.4, b));
    p.armR.rotation.x -= 2.3 * k;
    p.armR.rotation.z += -0.55 * k;
    p.head.rotation.z += 0.18 * k;
    p.head.rotation.y += -0.2 * k;
  },
  jump(p, t, a, b) {
    const k = seg(t, a, b);
    if (k <= 0 || k >= 1) return;
    const hop = Math.abs(Math.sin(k * Math.PI * 3));
    p.hips.position.y += 0.22 * hop;
    p.armL.rotation.z = -(0.2 + 2.6 * hop);
    p.armR.rotation.z = 0.2 + 2.6 * hop;
    p.legL.rotation.x = 0.4 * hop;
    p.legR.rotation.x = 0.4 * hop;
  },
  clap(p, t, a, b) {
    const k = seg(t, a, b);
    if (k <= 0 || k >= 1) return;
    const c = Math.abs(Math.sin((t - a) * 10));
    p.armL.rotation.x = -1.2;
    p.armR.rotation.x = -1.2;
    p.armL.rotation.z = -0.15 - 0.45 * c + 0.6;
    p.armR.rotation.z = 0.15 + 0.45 * c - 0.6;
  },
  busy(p, t) {
    // Hurrying: quick arm work and a restless head.
    p.armL.rotation.x = -0.9 + 0.5 * Math.sin(t * 7);
    p.armR.rotation.x = -0.9 + 0.5 * Math.sin(t * 7 + 1.8);
    p.head.rotation.y += 0.3 * Math.sin(t * 2.3);
  },
};

// ---- Props ----------------------------------------------------------------------------

function makeRoom() {
  const room = new THREE.Group();
  const floor = mesh(new THREE.CircleGeometry(30, 64), mat(0x3a2c2a, { roughness: 0.9 }), { shadow: false });
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);
  const rug = mesh(new THREE.CircleGeometry(1.3, 48), mat(0x7a3a4a, { roughness: 1 }), { y: 0.005, shadow: false });
  rug.rotation.x = -Math.PI / 2;
  rug.receiveShadow = true;
  room.add(rug);

  const wallMat = mat(0x4a3b52, { roughness: 1 });
  room.add(mesh(new THREE.PlaneGeometry(40, 14), wallMat, { y: 7, z: -2.2, shadow: false }));
  const windowGlow = new THREE.MeshBasicMaterial({ color: 0x2b4a8a });
  room.userData.window = windowGlow;
  const win = mesh(new THREE.PlaneGeometry(1.3, 1.1), windowGlow, { x: -1.6, y: 1.9, z: -2.18, shadow: false });
  room.add(win);
  const frameMat = mat(0xd9c3a0);
  room.add(mesh(new THREE.BoxGeometry(1.42, 0.06, 0.05), frameMat, { x: -1.6, y: 2.48, z: -2.16 }));
  room.add(mesh(new THREE.BoxGeometry(1.42, 0.06, 0.05), frameMat, { x: -1.6, y: 1.32, z: -2.16 }));
  room.add(mesh(new THREE.BoxGeometry(0.05, 1.2, 0.05), frameMat, { x: -1.6, y: 1.9, z: -2.16 }));
  // A moon, or the sun in the morning.
  const sky = mesh(new THREE.CircleGeometry(0.16, 24), new THREE.MeshBasicMaterial({ color: 0xf3dca6 }), { x: -1.3, y: 2.15, z: -2.17, shadow: false });
  room.userData.sky = sky;
  room.add(sky);

  // Sofa.
  const sofaMat = mat(0x2f6f73, { roughness: 0.95 });
  room.add(mesh(new THREE.BoxGeometry(1.8, 0.35, 0.7), sofaMat, { x: 1.4, y: 0.3, z: -1.7 }));
  room.add(mesh(new THREE.BoxGeometry(1.8, 0.6, 0.18), sofaMat, { x: 1.4, y: 0.7, z: -2.0 }));
  for (const side of [-1, 1]) room.add(mesh(new THREE.BoxGeometry(0.18, 0.5, 0.7), sofaMat, { x: 1.4 + side * 0.9, y: 0.45, z: -1.7 }));
  room.add(mesh(new THREE.BoxGeometry(0.4, 0.35, 0.12), mat(0xe7c17a), { x: 1.0, y: 0.62, z: -1.85 }));

  // Lamp and a plant.
  room.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8), mat(0x222222), { x: -2.4, y: 0.75, z: -1.6 }));
  const shade = mesh(new THREE.ConeGeometry(0.25, 0.3, 24, 1, true), mat(0xf6e3b4, { emissive: 0xf6c56a, emissiveIntensity: 0.6, side: THREE.DoubleSide }), { x: -2.4, y: 1.55, z: -1.6 });
  room.add(shade);
  room.add(mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.3, 16), mat(0xb5653f), { x: 2.6, y: 0.15, z: -1.2 }));
  for (const [x, y, z, r] of [
    [2.6, 0.5, -1.2, 0.22],
    [2.5, 0.72, -1.15, 0.17],
    [2.7, 0.68, -1.25, 0.15],
  ]) {
    room.add(mesh(new THREE.SphereGeometry(r, 16, 12), mat(0x3f8f4f), { x, y, z }));
  }
  return room;
}

/** A floating object for Mom's busy day. */
function busyThing(kind) {
  const g = new THREE.Group();
  if (kind === 'clock') {
    const face = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 24), mat(0xf7f2e8));
    face.rotation.x = Math.PI / 2;
    g.add(face);
    g.add(mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 24), mat(0xc0392b)));
    const hand = mesh(new THREE.BoxGeometry(0.02, 0.11, 0.02), mat(0x222222), { y: 0.05, z: 0.04 });
    g.add(hand);
    g.userData.spin = hand;
  } else if (kind === 'phone') {
    g.add(mesh(new THREE.BoxGeometry(0.17, 0.32, 0.03), mat(0x1c2233)));
    g.add(mesh(new THREE.PlaneGeometry(0.14, 0.26), new THREE.MeshBasicMaterial({ color: 0x5b9bff }), { z: 0.017, shadow: false }));
  } else if (kind === 'cup') {
    g.add(mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.17, 16), mat(0xf2f2f2)));
    g.add(mesh(new THREE.TorusGeometry(0.05, 0.015, 8, 16), mat(0xf2f2f2), { x: 0.1 }));
  } else if (kind === 'book') {
    g.add(mesh(new THREE.BoxGeometry(0.26, 0.05, 0.2), mat(0x8e3a5e)));
    g.add(mesh(new THREE.BoxGeometry(0.24, 0.04, 0.19), mat(0xf7f2e8), { y: 0.005, x: 0.01 }));
  } else {
    // A shopping bag.
    g.add(mesh(new THREE.BoxGeometry(0.22, 0.24, 0.1), mat(0xe7a64a)));
    g.add(mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 16, Math.PI), mat(0x7a4a1a), { y: 0.12 }));
  }
  return g;
}

/** The phone that rings with the reminder, its screen drawn on a canvas. */
function makePhone() {
  const g = new THREE.Group();
  const w = 0.62;
  const h = 1.18;
  g.add(mesh(new THREE.BoxGeometry(w, h, 0.06), mat(0x14192a, { metalness: 0.5, roughness: 0.3 })));
  const canvas = document.createElement('canvas');
  canvas.width = 420;
  canvas.height = 800;
  const c = canvas.getContext('2d');
  const grad = c.createLinearGradient(0, 0, 0, 800);
  grad.addColorStop(0, '#1b2440');
  grad.addColorStop(1, '#0b1122');
  c.fillStyle = grad;
  c.fillRect(0, 0, 420, 800);
  c.fillStyle = '#efe9dc';
  c.textAlign = 'center';
  c.font = '600 120px Georgia, serif';
  c.fillText('7:00', 210, 210);
  c.font = '500 30px sans-serif';
  c.fillStyle = 'rgba(239,233,220,0.7)';
  c.fillText('Saturday, 14 June', 210, 260);
  c.fillStyle = 'rgba(239,233,220,0.12)';
  roundRect(c, 40, 320, 340, 250, 32);
  c.fill();
  c.font = '72px sans-serif';
  c.fillText('🎂', 210, 410);
  c.fillStyle = '#efe9dc';
  c.font = '700 40px sans-serif';
  c.fillText('Call Grandma', 210, 475);
  c.font = '500 28px sans-serif';
  c.fillStyle = 'rgba(239,233,220,0.7)';
  c.fillText('Her birthday · Alarm', 210, 520);
  c.fillStyle = '#d4af6a';
  roundRect(c, 70, 650, 280, 80, 40);
  c.fill();
  c.fillStyle = '#0b1122';
  c.font = '700 36px sans-serif';
  c.fillText('Stop', 210, 702);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  g.add(mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.92), new THREE.MeshBasicMaterial({ map: texture }), { z: 0.031, shadow: false }));
  // Rings of light that pulse out while it rings.
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const ring = mesh(
      new THREE.RingGeometry(0.62, 0.66, 48),
      new THREE.MeshBasicMaterial({ color: 0xf3dca6, transparent: true, opacity: 0, side: THREE.DoubleSide }),
      { z: -0.05, shadow: false },
    );
    g.add(ring);
    rings.push(ring);
  }
  g.userData.rings = rings;
  return g;
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Golden sparkles that drift around Satya. */
function makeSparkles(count = 70) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 3;
    positions[i * 3 + 1] = Math.random() * 2.6;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xf3dca6, size: 0.05, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  return points;
}

// ---- Stage ------------------------------------------------------------------------------

const canvas = document.getElementById('stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (e) {
  post('nowebgl');
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b1122, 6, 14);
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);

const hemi = new THREE.HemisphereLight(0xfff1dc, 0x2a2238, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe2b8, 2.2);
sun.position.set(2.5, 5, 3.5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -4;
sun.shadow.camera.right = 4;
sun.shadow.camera.top = 4;
sun.shadow.camera.bottom = -2;
sun.shadow.bias = -0.0005;
scene.add(sun);
const lamp = new THREE.PointLight(0xffb45e, 6, 6, 1.6);
lamp.position.set(-2.3, 1.6, -1.2);
scene.add(lamp);
const rim = new THREE.DirectionalLight(0x8fb4ff, 0.8);
rim.position.set(-3, 3, -3);
scene.add(rim);

const room = makeRoom();
scene.add(room);
const aarav = makePerson({ kind: 'kid' });
const mom = makePerson({ kind: 'mom' });
scene.add(aarav.root, mom.root);
const things = ['clock', 'phone', 'cup', 'book', 'bag'].map(k => {
  const t = busyThing(k);
  scene.add(t);
  return t;
});
const phone = makePhone();
scene.add(phone);
const sparkles = makeSparkles();
scene.add(sparkles);

// Satya, loaded from the app's own GLB and scaled to stand about 1.1 tall.
const satya = new THREE.Group();
scene.add(satya);
let satyaModel = null;
(function loadSatya() {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', '../../models/model.glb');
  xhr.responseType = 'arraybuffer';
  xhr.onload = () => {
    if (!xhr.response || !xhr.response.byteLength) return;
    new GLTFLoader().parse(xhr.response, '', gltf => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const k = 1.1 / size.y;
      model.scale.setScalar(k);
      // Stand it on the floor, centered on its own middle.
      model.position.set(-center.x * k, -box.min.y * k, -center.z * k);
      model.traverse(o => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      satya.add(model);
      satyaModel = model;
    });
  };
  xhr.send();
})();

// ---- Speech bubbles -------------------------------------------------------------------

const bubbleLayer = document.getElementById('bubbles');
const bubbles = [];

/** A bubble pinned above `who`'s head from `at` seconds into the scene. */
function say(who, text, at, { thought = false, until = Infinity } = {}) {
  const el = document.createElement('div');
  el.className = `bubble${thought ? ' thought' : ''}${who === mom || who === satya ? ' gold' : ''}`;
  el.textContent = text;
  bubbleLayer.appendChild(el);
  bubbles.push({ el, who, at, until });
}

function clearBubbles() {
  bubbles.length = 0;
  bubbleLayer.innerHTML = '';
}

const anchor = new THREE.Vector3();
function placeBubbles(t) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  for (const b of bubbles) {
    const on = t >= b.at && t < b.until;
    b.el.classList.toggle('on', on);
    if (!on) continue;
    if (b.who === satya) anchor.set(satya.position.x, satya.position.y + 1.25, satya.position.z);
    else b.who.head.getWorldPosition(anchor).add(new THREE.Vector3(0, 0.38, 0));
    anchor.project(camera);
    const x = (anchor.x * 0.5 + 0.5) * w;
    const y = (-anchor.y * 0.5 + 0.5) * h;
    const bw = b.el.offsetWidth;
    const left = Math.min(Math.max(x - bw / 2, 10), w - bw - 10);
    b.el.style.transform = `translate(${left}px, ${Math.max(y - b.el.offsetHeight, 8)}px)`;
    b.el.style.setProperty('--tail', `${Math.min(Math.max(x - left, 18), bw - 18)}px`);
  }
}

// ---- Scenes -----------------------------------------------------------------------------

/** Each scene sets things up once, then poses everyone for time t (seconds). */
const SCENES = [
  {
    // Aarav asks Mom to remind him about Grandma's birthday.
    sky: { bg: 0x2a2140, window: 0x2b4a8a, moon: true, lamp: 6 },
    camera: { x: 0, y: 1.05, z: 4.6, look: [0, 1.1, 0], width: 2.6 },
    setup() {
      aarav.setMood('happy');
      mom.setMood('happy');
      mom.root.position.set(0.7, 0, 0);
      mom.root.rotation.y = -0.45;
      say(aarav, 'Mom, tomorrow is Grandma’s birthday! Please remind me to call her in the morning.', 1.4);
      say(mom, 'Of course, beta. I won’t forget!', 4.2);
    },
    update(t) {
      moves.walk(aarav, t, 0, 1.4, -2.6, -0.55, 0.45);
      moves.wave(aarav, t, 1.3, 2.6, 'L');
      moves.talk(aarav, t, 1.5, 3.9);
      moves.nod(mom, t, 2.2, 3.4);
      moves.talk(mom, t, 4.3, 5.8);
      moves.wave(mom, t, 5.4, 6.4);
    },
  },
  {
    // Mom's busy day: things whirl around her and the reminder slips away.
    sky: { bg: 0x241b33, window: 0x5a3b6e, moon: false, lamp: 3 },
    camera: { x: 0, y: 1.2, z: 5.0, look: [0, 1.3, 0], width: 2.6 },
    setup() {
      mom.setMood('happy');
      mom.root.position.set(0, 0, 0);
      aarav.root.position.set(-9, 0, 0);
      say(mom, 'Call Grandma… call Grandma…', 0.6, { thought: true, until: 3.0 });
      say(mom, '…what was I supposed to remember? 🤔', 3.2, { thought: true });
    },
    update(t) {
      if (t < 3) {
        const dir = Math.sin(t * 1.6);
        mom.root.position.x = 0.5 * dir;
        mom.root.rotation.y = Math.cos(t * 1.6) > 0 ? 0.9 : -0.9;
        const swing = Math.sin(t * 9);
        mom.legL.rotation.x = 0.4 * swing;
        mom.legR.rotation.x = -0.4 * swing;
        moves.busy(mom, t);
      } else {
        mom.root.rotation.y = lerp(mom.root.rotation.y, 0, 0.1);
        mom.setMood('worried');
        moves.think(mom, t, 3.0, 99);
      }
      things.forEach((thing, i) => {
        const a = t * 1.3 + (i / things.length) * Math.PI * 2;
        const r = 0.95;
        thing.visible = true;
        thing.position.set(Math.cos(a) * r + mom.root.position.x * 0.5, 1.45 + 0.18 * Math.sin(t * 2 + i), Math.sin(a) * r * 0.5 + 0.3);
        thing.rotation.set(t * 0.7 + i, t + i, 0);
        if (thing.userData.spin) thing.userData.spin.rotation.z = -t * 6;
        thing.scale.setScalar(0.6 + 0.4 * ease(seg(t, 0.1 * i, 0.1 * i + 0.6)));
      });
    },
  },
  {
    // The next evening: Grandma waited all day.
    sky: { bg: 0x1d2236, window: 0x1b2a52, moon: true, lamp: 5 },
    camera: { x: 0, y: 1.0, z: 4.6, look: [0, 1.1, 0], width: 2.6 },
    setup() {
      aarav.setMood('sad');
      mom.setMood('happy');
      aarav.root.position.set(-0.6, 0, 0);
      aarav.root.rotation.y = 0.35;
      mom.root.position.set(0.7, 0, 0);
      mom.root.rotation.y = -0.4;
      say(aarav, 'Mom… Grandma waited all day for my call. 😢', 0.5);
      say(mom, 'Oh no… I forgot. I’m so sorry, beta.', 3.3);
    },
    update(t) {
      moves.sad(aarav, 0.7 + 0.3 * Math.sin(t));
      moves.talk(aarav, t, 0.6, 2.8);
      if (t > 2.6) mom.setMood('sad');
      moves.sad(mom, ease(seg(t, 2.6, 3.4)));
      moves.think(mom, t, 3.0, 99);
      moves.talk(mom, t, 3.4, 5.4);
    },
  },
  {
    // Satya arrives.
    sky: { bg: 0x161a33, window: 0x3a2a6e, moon: true, lamp: 2 },
    camera: { x: 0, y: 1.0, z: 5.0, look: [0, 1.15, 0], width: 3.4 },
    setup() {
      aarav.setMood('surprised');
      mom.setMood('surprised');
      aarav.root.position.set(-1.25, 0, 0.1);
      aarav.root.rotation.y = 0.6;
      mom.root.position.set(1.3, 0, 0.1);
      mom.root.rotation.y = -0.6;
      say(satya, 'Hi! I’m Satya. Tell Memo once, and I’ll remember it for you.', 2.0);
    },
    update(t) {
      // Drops in with a bounce, spins once, then wiggles hello.
      const drop = seg(t, 0, 0.9);
      const bounce = drop < 1 ? (1 - ease(drop)) * 3 : Math.abs(Math.sin((t - 0.9) * 9)) * 0.25 * Math.max(0, 1 - (t - 0.9) * 1.6);
      satya.position.set(0, bounce, 0.3);
      satya.rotation.y = Math.PI * 2 * ease(seg(t, 0.9, 2.0));
      satya.rotation.z = t > 2 ? 0.2 * Math.sin((t - 2) * 7) * Math.max(0, 1 - (t - 2) * 0.25) : 0;
      satya.visible = true;
      sparkles.visible = true;
      sparkles.rotation.y = t * 0.3;
      sparkles.material.opacity = 0.9 * seg(t, 0.6, 1.4);
      if (t > 1.2) {
        aarav.setMood('happy');
        mom.setMood('happy');
      }
      moves.jump(aarav, t, 1.3, 2.4);
      moves.clap(mom, t, 1.4, 3.0);
    },
  },
  {
    // A year later, Memo rings in the morning and Aarav calls Grandma.
    sky: { bg: 0x3a4a6e, window: 0x9fd0ff, moon: false, sun: true, lamp: 0 },
    camera: { x: 0, y: 1.1, z: 5.0, look: [0, 1.3, 0], width: 3.1 },
    setup() {
      aarav.setMood('surprised');
      mom.setMood('happy');
      aarav.root.position.set(-1.0, 0, 0.2);
      aarav.root.rotation.y = 0.5;
      mom.root.position.set(1.1, 0, -0.1);
      mom.root.rotation.y = -0.5;
      say(aarav, 'Memo remembered! Happy birthday, Grandma! 🎉', 3.0);
    },
    update(t) {
      phone.visible = true;
      const ringing = t > 0.6 && t < 3.2;
      const appear = ease(seg(t, 0, 0.7));
      phone.position.set(0.15, 1.35 + 0.05 * Math.sin(t * 2), 0.6);
      phone.scale.setScalar(0.4 + 0.6 * appear);
      phone.rotation.set(-0.08, -0.15, ringing ? 0.09 * Math.sin(t * 38) : 0);
      phone.userData.rings.forEach((ring, i) => {
        const k = ((t * 0.9 + i / 3) % 1);
        ring.scale.setScalar(1 + k * 0.6);
        ring.material.opacity = ringing ? 0.5 * (1 - k) : 0;
      });
      if (t > 2.8) aarav.setMood('happy');
      moves.jump(aarav, t, 3.0, 4.6);
      moves.talk(aarav, t, 4.6, 6.3);
      moves.clap(mom, t, 3.2, 5.0);
    },
  },
  {
    // Everyone says hello: the closing shot behind the app's feature list.
    sky: { bg: 0x2a2140, window: 0x2b4a8a, moon: true, lamp: 5 },
    camera: { x: 0, y: 0.6, z: 6.0, look: [0, -0.3, 0], width: 3.5 },
    setup() {
      aarav.setMood('happy');
      mom.setMood('happy');
      aarav.root.position.set(-1.1, 0, 0.3);
      aarav.root.rotation.y = 0.2;
      mom.root.position.set(1.1, 0, 0);
      mom.root.rotation.y = -0.2;
    },
    update(t) {
      satya.visible = true;
      satya.position.set(0, Math.abs(Math.sin(t * 2.2)) * 0.12, 0.4);
      satya.rotation.z = 0.12 * Math.sin(t * 3);
      moves.wave(aarav, t % 3, 0, 2.2, 'L');
      moves.wave(mom, (t + 1.2) % 3, 0, 2.2, 'R');
    },
  },
];

let current = -1;
let startedAt = 0;

function show(index) {
  const s = SCENES[index];
  if (!s) return;
  current = index;
  startedAt = performance.now();
  clearBubbles();
  // Hide the extras; each scene turns on what it needs.
  satya.visible = false;
  sparkles.visible = false;
  phone.visible = false;
  things.forEach(th => (th.visible = false));
  aarav.root.rotation.set(0, 0, 0);
  mom.root.rotation.set(0, 0, 0);
  s.setup();
  scene.background = new THREE.Color(s.sky.bg);
  scene.fog.color.set(s.sky.bg);
  room.userData.window.color.set(s.sky.window);
  room.userData.sky.material.color.set(s.sky.sun ? 0xffe9a8 : 0xf3dca6);
  room.userData.sky.scale.setScalar(s.sky.sun ? 1.5 : 1);
  room.userData.sky.visible = Boolean(s.sky.moon || s.sky.sun);
  lamp.intensity = s.sky.lamp;
  hemi.intensity = s.sky.sun ? 1.6 : 1.1;
  fitCamera();
}

function fitCamera() {
  const s = SCENES[current];
  if (!s) return;
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Pull back far enough that the scene's width always fits, even on narrow phones.
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const needed = s.camera.width / 2 / (Math.tan(halfFov) * camera.aspect);
  camera.userData.base = { ...s.camera, z: Math.max(s.camera.z, needed) };
  // The haze starts just behind the cast, however far back the camera sits.
  scene.fog.near = camera.userData.base.z + 1.5;
  scene.fog.far = camera.userData.base.z + 12;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', fitCamera);
window.story = { show };

function frame(now) {
  requestAnimationFrame(frame);
  if (current < 0) return;
  const t = (now - startedAt) / 1000;
  const s = SCENES[current];
  rest(aarav, now / 1000);
  rest(mom, now / 1000 + 1.3);
  s.update(t);
  // A slow, gentle drift of the camera keeps every shot alive.
  const base = camera.userData.base;
  const drift = reduced ? 0 : Math.sin(t * 0.35);
  camera.position.set(base.x + 0.25 * drift, base.y + 0.05 * drift, base.z - (reduced ? 0 : 0.25 * seg(t, 0, 6)));
  camera.lookAt(base.look[0], base.look[1], base.look[2]);
  if (satyaModel && satya.visible) satyaModel.rotation.y = 0;
  renderer.render(scene, camera);
  placeBubbles(t);
}

show(Number(params.get('scene') || 0));
requestAnimationFrame(frame);
post('loaded');
