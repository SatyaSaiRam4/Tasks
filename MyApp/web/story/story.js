/* eslint-env browser */
/**
 * Memo's welcome story, in 3D. Aarav asks Mom to remind him of Grandma's
 * birthday, two days away. Two busy days fly by, she forgets, and they miss
 * the call. Melo arrives: tell Memo once, days or months ahead, and it
 * reminds you on the day. This time Mom saves it in Memo; on the birthday it
 * reminds her, and Aarav calls Grandma. Nothing is ever held in front of a
 * face: the card sits at chest height, the phone floats between them.
 *
 * The app shows this page in a WebView (src/modules/onboarding/WelcomeStory.tsx)
 * and drives it with window.story.show(sceneIndex); captions, progress and
 * buttons are drawn by the app. Speech bubbles are drawn here, pinned above
 * the speaker's head.
 *
 * Aarav and Mom are built from simple shapes with jointed arms, legs and head,
 * so they can walk, wave, talk, slump and jump. Melo is the app's own GLB.
 *
 * Build (from MyApp/): npm run build:story → assets/web/story/story.bundle.js
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { findRobe, robeName } from '../satya/meloName.js';

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
function makePerson({
  kind,
  skinColor = 0xe9b48f,
  topColor = 0xc95c7a,
  hairColor = 0x3b2620,
  bottomColor = 0x2b3550,
  glasses = false,
  mustache = false,
  beard = false,
  jacketColor = null,
}) {
  // kind: 'kid', 'woman' (kurta, ponytail), 'bride' (bun, veil, jewellery),
  // 'man' (shirt and trousers, optional jacket and beard), 'groom' (sherwani
  // and turban) or 'casual' (a young woman in a top and jeans, long open hair).
  const kid = kind === 'kid';
  const casual = kind === 'casual';
  const bride = kind === 'bride';
  const man = kind === 'man';
  const groom = kind === 'groom';
  const male = man || groom;
  const skin = mat(kid ? 0xf3c9a6 : skinColor, { roughness: 0.75 });
  const hair = mat(kid ? 0x2a1e1a : hairColor, { roughness: 0.9 });
  const top = mat(kid ? 0x3f7cf0 : topColor, { roughness: bride ? 0.55 : 0.8, metalness: bride ? 0.08 : 0.02 });
  const bottom = mat(kid ? 0x26345e : male || casual ? bottomColor : 0x5a2b3f, { roughness: 0.85 });
  const shoe = mat(kid || casual || jacketColor ? 0xf2f2f2 : male ? 0x2a1d17 : 0x5a2b3f);
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
  if (man) {
    // A shirt with a collar and buttons.
    body.add(mesh(new THREE.CapsuleGeometry(0.2, 0.2, 8, 16), top, { y: 0.3 }));
    for (const side of [-1, 1]) {
      const collar = mesh(new THREE.BoxGeometry(0.09, 0.05, 0.02), mat(0xffffff), { x: side * 0.05, y: 0.55, z: 0.15 });
      collar.rotation.z = side * 0.5;
      body.add(collar);
    }
    for (let i = 0; i < 3; i++) body.add(mesh(new THREE.SphereGeometry(0.012, 8, 6), mat(0xf2f2f2), { y: 0.45 - i * 0.1, z: 0.2 }, false));
    if (jacketColor) {
      // An open jacket over the shirt: two front panels, the back and lapels.
      const jacket = mat(jacketColor, { roughness: 0.7 });
      body.add(mesh(new THREE.CapsuleGeometry(0.208, 0.2, 8, 16, 1), jacket, { y: 0.3, z: -0.012 }));
      for (const side of [-1, 1]) {
        const panel = mesh(new THREE.BoxGeometry(0.11, 0.42, 0.03), jacket, { x: side * 0.13, y: 0.29, z: 0.19 });
        panel.rotation.y = side * 0.35;
        body.add(panel);
        const lapel = mesh(new THREE.BoxGeometry(0.05, 0.16, 0.02), mat(0x1b2438), { x: side * 0.08, y: 0.45, z: 0.205 }, false);
        lapel.rotation.z = side * 0.35;
        body.add(lapel);
      }
    }
  } else if (casual) {
    // A fitted top with a round neck, and a little star print.
    body.add(mesh(new THREE.CapsuleGeometry(0.175, 0.2, 8, 16), top, { y: 0.3 }));
    body.add(mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20), mat(0xffffff), { y: 0.5, z: 0.11 }, false));
    body.add(mesh(new THREE.CircleGeometry(0.04, 5), mat(0xfff1a8), { y: 0.33, z: 0.178 }, false));
  } else if (groom) {
    // A long cream sherwani with a gold border and a red stole.
    const coat = [
      [0.0, -0.3],
      [0.24, -0.3],
      [0.22, 0.0],
      [0.2, 0.3],
      [0.21, 0.5],
      [0.12, 0.58],
      [0.0, 0.6],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    body.add(mesh(new THREE.LatheGeometry(coat, 32), top));
    const hem = mesh(new THREE.TorusGeometry(0.24, 0.018, 8, 40), gold, { y: -0.29 });
    hem.rotation.x = Math.PI / 2;
    body.add(hem);
    const stole = mesh(new THREE.TorusGeometry(0.2, 0.028, 8, 32, Math.PI * 1.1), mat(0xb3122e), { y: 0.28, z: 0.02 });
    stole.rotation.set(0.25, -0.2, 2.2);
    body.add(stole);
    for (let i = 0; i < 4; i++) body.add(mesh(new THREE.SphereGeometry(0.014, 8, 6), gold, { y: 0.5 - i * 0.12, z: 0.205 }, false));
  } else if (kid) {
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
    if (bride) {
      // A gold border on the lehenga's hem and a necklace.
      const hem = mesh(new THREE.TorusGeometry(0.295 * s, 0.025 * s, 8, 40), gold, { y: -0.33 * s });
      hem.rotation.x = Math.PI / 2;
      body.add(hem);
      const necklace = mesh(new THREE.TorusGeometry(0.1 * s, 0.018 * s, 8, 24, Math.PI), gold, { y: 0.5 * s, z: 0.06 * s });
      necklace.rotation.z = Math.PI;
      necklace.rotation.x = -0.5;
      body.add(necklace);
    }
  }

  const shoulderY = kid ? torsoH * 0.82 : male ? 0.5 : casual ? 0.47 : 0.46 * s;
  const shoulderX = kid ? 0.25 * s : male ? 0.25 : casual ? 0.215 : 0.22 * s;
  const armLen = kid ? 0.3 * s : male ? 0.38 : 0.36 * s;
  const sleeve = jacketColor ? mat(jacketColor, { roughness: 0.7 }) : top;
  const armL = limb(0.055 * s, armLen, sleeve, 0.065 * s, skin);
  const armR = limb(0.055 * s, armLen, sleeve, 0.065 * s, skin);
  if (jacketColor) {
    // A wristwatch.
    armL.add(mesh(new THREE.TorusGeometry(0.052, 0.014, 8, 16), mat(0xd4af6a, { metalness: 0.7, roughness: 0.3 }), { y: -armLen * 0.86 }, false));
  }
  armL.position.set(-shoulderX, shoulderY, 0);
  armR.position.set(shoulderX, shoulderY, 0);
  armL.rotation.z = -0.12;
  armR.rotation.z = 0.12;
  body.add(armL, armR);

  // Head.
  const headR = (kid ? 0.26 : male ? 0.215 : 0.22) * s;
  const head = new THREE.Group();
  head.position.y = shoulderY + headR * 1.05;
  body.add(head);
  head.add(mesh(new THREE.CylinderGeometry(0.05 * s, 0.06 * s, 0.1 * s, 12), skin, { y: -headR * 0.95 }));
  head.add(mesh(new THREE.SphereGeometry(headR, 32, 24), skin));
  for (const side of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(headR * 0.18, 12, 10), skin, { x: side * headR * 0.98 }));

  // Hair: a cap over the top and back, plus a fringe (kid), a ponytail or a bun.
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
  } else if (male) {
    // Short hair with a side fringe; the groom wears a turban over it.
    const fringe = mesh(new THREE.SphereGeometry(headR * 0.55, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), hair, { x: headR * 0.25, y: headR * 0.62, z: headR * 0.35 });
    fringe.scale.set(1.2, 0.5, 0.9);
    head.add(fringe);
    if (groom) {
      const safa = mat(0xe8862a, { roughness: 0.75 });
      for (let i = 0; i < 4; i++) {
        const fold = mesh(new THREE.TorusGeometry(headR * (1.0 - i * 0.12), headR * 0.2, 10, 28), safa, { y: headR * (0.45 + i * 0.2) });
        fold.rotation.x = Math.PI / 2 + 0.15;
        head.add(fold);
      }
      head.add(mesh(new THREE.SphereGeometry(headR * 0.75, 20, 14), safa, { y: headR * 0.95 }));
      head.add(mesh(new THREE.SphereGeometry(headR * 0.13, 10, 8), gold, { y: headR * 0.75, z: headR * 0.95 }));
      const plume = mesh(new THREE.ConeGeometry(headR * 0.08, headR * 0.6, 8), gold, { y: headR * 1.3, z: headR * 0.8 });
      plume.rotation.x = -0.4;
      head.add(plume);
    }
    if (beard) {
      // A short, neat beard along the jaw and chin, below the mouth.
      const stubble = mat(0x3d2c24, { roughness: 1 });
      const jaw = mesh(new THREE.SphereGeometry(headR * 1.02, 28, 14, 0, Math.PI * 2, Math.PI * 0.68, Math.PI * 0.22), stubble, {}, false);
      head.add(jaw);
      const stache = mesh(new THREE.CapsuleGeometry(headR * 0.035, headR * 0.3, 4, 8), stubble, { y: -headR * 0.16, z: headR * 0.97 }, false);
      stache.rotation.z = Math.PI / 2;
      head.add(stache);
    }
    if (mustache) {
      const m = mesh(new THREE.CapsuleGeometry(headR * 0.06, headR * 0.3, 4, 8), hair, { y: -headR * 0.18, z: headR * 0.95 }, false);
      m.rotation.z = Math.PI / 2;
      head.add(m);
    }
    if (glasses) {
      const frameMat = mat(0x1d1d1d, { metalness: 0.4, roughness: 0.3 });
      for (const side of [-1, 1]) {
        const lens = mesh(new THREE.TorusGeometry(headR * 0.2, headR * 0.03, 8, 20), frameMat, { x: side * headR * 0.36, y: headR * 0.08, z: headR * 0.97 }, false);
        head.add(lens);
      }
      head.add(mesh(new THREE.BoxGeometry(headR * 0.3, headR * 0.03, headR * 0.03), frameMat, { y: headR * 0.1, z: headR * 0.98 }, false));
    }
  } else if (casual) {
    // Long open hair falling behind the shoulders, a side fringe, hoops.
    const fall = mesh(new THREE.CapsuleGeometry(headR * 0.82, headR * 1.3, 8, 16), hair, { y: -headR * 0.75, z: -headR * 0.42 });
    fall.scale.set(1.18, 1, 0.55);
    head.add(fall);
    for (const side of [-1, 1]) {
      head.add(mesh(new THREE.CapsuleGeometry(headR * 0.2, headR * 1.0, 6, 10), hair, { x: side * headR * 0.86, y: -headR * 0.45, z: -headR * 0.05 }));
    }
    const fringe = mesh(new THREE.SphereGeometry(headR * 0.62, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), hair, { x: -headR * 0.22, y: headR * 0.58, z: headR * 0.38 });
    fringe.scale.set(1.35, 0.45, 0.95);
    fringe.rotation.z = 0.25;
    head.add(fringe);
    for (const side of [-1, 1]) {
      head.add(mesh(new THREE.TorusGeometry(headR * 0.14, headR * 0.03, 8, 18), gold, { x: side * headR * 1.03, y: -headR * 0.38 }, false));
    }
  } else {
    if (kind === 'woman') {
      // A high ponytail.
      head.add(mesh(new THREE.SphereGeometry(headR * 0.3, 16, 12), hair, { y: headR * 0.55, z: -headR * 0.85 }));
      const tail = mesh(new THREE.ConeGeometry(headR * 0.26, headR * 1.1, 14), hair, { y: -headR * 0.05, z: -headR * 1.05 });
      tail.rotation.x = Math.PI + 0.35;
      head.add(tail);
    } else {
      head.add(mesh(new THREE.SphereGeometry(headR * 0.42, 20, 16), hair, { y: headR * 0.75, z: -headR * 0.55 }));
    }
    if (bride) {
      // A sheer red-gold veil over the head and a forehead jewel.
      const veil = mesh(
        new THREE.SphereGeometry(headR * 1.25, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
        mat(0xd4384f, { transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 0.6 }),
        { y: headR * 0.05, z: -headR * 0.15 },
      );
      veil.rotation.x = -0.5;
      head.add(veil);
      head.add(mesh(new THREE.SphereGeometry(headR * 0.08, 10, 8), gold, { y: headR * 0.55, z: headR * 0.88 }));
    }
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
  const nose = mesh(new THREE.SphereGeometry(headR * 0.09, 12, 10), skin, { y: -headR * 0.08, z: headR * 0.98 }, false);
  nose.scale.set(1, 0.8, 0.7);
  head.add(nose);
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

  return { root, hips, body, head, armL, armR, legL, legR, mouth, eyes, setMood, top, height: hips.position.y + head.position.y + headR };
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
  const blink = (t + p.root.id * 0.7) % 3.6 < 0.12 ? 0.12 : 1;
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
  /** Both hands to the head: "Oh no!" */
  shock(p, t, a) {
    const k = ease(seg(t, a, a + 0.4));
    p.armL.rotation.set(-0.6 * k, 0, -(0.12 + 2.3 * k));
    p.armR.rotation.set(-0.6 * k, 0, 0.12 + 2.3 * k);
    p.head.rotation.x -= 0.15 * k;
  },
  /** Arms out and around: a hug, held from a to b. */
  hug(p, t, a, b) {
    const k = ease(seg(t, a, a + 0.5)) * (1 - ease(seg(t, b - 0.4, b)));
    p.armL.rotation.set(-1.25 * k, 0, -0.12 + 0.75 * k);
    p.armR.rotation.set(-1.25 * k, 0, 0.12 - 0.75 * k);
  },
  /** Holding something up in the right hand, e.g. the invitation. */
  hold(p, amount = 1) {
    p.armR.rotation.x = -1.3 * amount;
    p.armR.rotation.z = 0.12 - 0.25 * amount;
  },
  /** Jogging on the spot: quick knees, pumping arms, a light bounce. */
  jog(p, t, a, b) {
    const k = seg(t, a, b);
    if (k <= 0 || k >= 1) return;
    const swing = Math.sin((t - a) * 14);
    p.legL.rotation.x = 0.85 * swing;
    p.legR.rotation.x = -0.85 * swing;
    p.armL.rotation.x = -0.6 - 0.5 * swing;
    p.armR.rotation.x = -0.6 + 0.5 * swing;
    p.hips.position.y += 0.045 * Math.abs(swing);
    p.body.rotation.x += 0.08;
  },
  /** Both arms up at the sides: "I did it!" (never in front of the face). */
  flex(p, t, a, b) {
    const k = ease(seg(t, a, a + 0.35)) * (1 - ease(seg(t, b - 0.35, b)));
    if (k <= 0) return;
    const pump = 0.12 * Math.sin((t - a) * 9);
    p.armL.rotation.z = -(0.12 + (2.1 + pump) * k);
    p.armR.rotation.z = 0.12 + (2.1 + pump) * k;
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
  room.userData.wall = wallMat;
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
  const sofa = new THREE.Group();
  room.add(sofa);
  room.userData.sofa = sofa;
  const sofaMat = mat(0x2f6f73, { roughness: 0.95 });
  room.userData.sofaMat = sofaMat;
  sofa.add(mesh(new THREE.BoxGeometry(1.8, 0.35, 0.7), sofaMat, { x: 1.4, y: 0.3, z: -1.7 }));
  sofa.add(mesh(new THREE.BoxGeometry(1.8, 0.6, 0.18), sofaMat, { x: 1.4, y: 0.7, z: -2.0 }));
  for (const side of [-1, 1]) sofa.add(mesh(new THREE.BoxGeometry(0.18, 0.5, 0.7), sofaMat, { x: 1.4 + side * 0.9, y: 0.45, z: -1.7 }));
  sofa.add(mesh(new THREE.BoxGeometry(0.4, 0.35, 0.12), mat(0xe7c17a), { x: 1.0, y: 0.62, z: -1.85 }));

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

/**
 * The phone, its screen drawn on a canvas. draw(screen) switches between the
 * reminder being saved, the reminder going off on the day, and the call.
 */
function makePhone() {
  const g = new THREE.Group();
  const w = 0.62;
  const h = 1.18;
  g.add(mesh(new THREE.BoxGeometry(w, h, 0.06), mat(0x14192a, { metalness: 0.5, roughness: 0.3 })));
  const canvas = document.createElement('canvas');
  canvas.width = 420;
  canvas.height = 800;
  const c = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  g.add(mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.92), new THREE.MeshBasicMaterial({ map: texture }), { z: 0.031, shadow: false }));

  const text = (value, y, font, color = '#efe9dc') => {
    c.font = font;
    c.fillStyle = color;
    c.fillText(value, 210, y);
  };
  /**
   * Draws one screen. spec.type: 'ring' (a Memo reminder going off),
   * 'saved' (a reminder just saved), 'call' (a video call with Grandma),
   * 'ad', 'photos' or 'paid'.
   */
  g.userData.draw = spec => {
    const grad = c.createLinearGradient(0, 0, 0, 800);
    grad.addColorStop(0, '#1b2440');
    grad.addColorStop(1, '#0b1122');
    c.fillStyle = grad;
    c.fillRect(0, 0, 420, 800);
    c.textAlign = 'center';
    if (spec.type === 'ad') {
      c.fillStyle = '#e2574c';
      roundRect(c, 30, 120, 360, 480, 30);
      c.fill();
      text('MEGA SALE', 230, '800 58px sans-serif');
      text('Up to 70% off', 300, '600 34px sans-serif', '#ffe9c9');
      text('🛍️', 420, '110px sans-serif');
      text('Opens in 10 days', 540, '700 32px sans-serif');
    } else if (spec.type === 'photos') {
      text(spec.who ?? 'A friend posted photos', 90, '600 28px sans-serif', 'rgba(239,233,220,0.75)');
      c.fillStyle = '#7a1f33';
      roundRect(c, 40, 130, 340, 380, 28);
      c.fill();
      text('💍', 290, '120px sans-serif');
      text('Our wedding day ✨', 400, '700 36px sans-serif');
      text(spec.date ?? '', 450, '500 28px sans-serif', 'rgba(239,233,220,0.75)');
      text('♥ 248   💬 61', 580, '600 30px sans-serif', 'rgba(239,233,220,0.8)');
      text('Yesterday', 650, '500 26px sans-serif', 'rgba(239,233,220,0.5)');
    } else if (spec.type === 'saved') {
      text('Memo', 100, '700 34px sans-serif', '#d4af6a');
      text('✅', 230, '110px sans-serif');
      text('Reminder saved', 330, '800 40px sans-serif');
      c.fillStyle = 'rgba(239,233,220,0.12)';
      roundRect(c, 36, 380, 348, 220, 28);
      c.fill();
      text(spec.emoji ?? '🎨', 450, '56px sans-serif');
      text(spec.title ?? '', 510, '700 30px sans-serif');
      text(spec.date ?? '', 555, '600 27px sans-serif', '#f3dca6');
      text(spec.sub ?? '', 680, '500 26px sans-serif', 'rgba(239,233,220,0.7)');
    } else if (spec.type === 'vault-lock') {
      // The Vault's PIN pad, with `spec.dots` digits entered.
      text('🔒', 230, '120px sans-serif');
      text('Private Vault', 320, '800 38px sans-serif');
      text('Enter your PIN', 365, '500 26px sans-serif', 'rgba(239,233,220,0.7)');
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.arc(135 + i * 50, 450, 15, 0, Math.PI * 2);
        c.fillStyle = i < (spec.dots ?? 0) ? '#b58cff' : 'rgba(239,233,220,0.18)';
        c.fill();
      }
      text('Only you can open it', 560, '600 26px sans-serif', 'rgba(239,233,220,0.6)');
    } else if (spec.type === 'vault') {
      text('Private Vault', 95, '800 36px sans-serif', '#cec3f6');
      text('🔓 Unlocked with your PIN', 140, '500 24px sans-serif', 'rgba(239,233,220,0.7)');
      [
        ['🏦', 'Bank details', 'Note'],
        ['🪪', 'Our ID cards', '2 photos'],
        ['🎙️', 'Gift ideas for Papa', 'Voice note'],
      ].forEach(([icon, title, sub], i) => {
        const y = 190 + i * 150;
        c.fillStyle = 'rgba(181,140,255,0.16)';
        roundRect(c, 30, y, 360, 126, 24);
        c.fill();
        c.textAlign = 'left';
        c.font = '54px sans-serif';
        c.fillText(icon, 52, y + 82);
        c.font = '700 30px sans-serif';
        c.fillStyle = '#efe9dc';
        c.fillText(title, 130, y + 58);
        c.font = '500 24px sans-serif';
        c.fillStyle = 'rgba(239,233,220,0.65)';
        c.fillText(sub, 130, y + 96);
        c.textAlign = 'center';
      });
      text('Encrypted · only you can see it', 690, '600 24px sans-serif', 'rgba(239,233,220,0.55)');
    } else if (spec.type === 'call') {
      // A video call: Grandma big, Aarav small in the corner.
      const bg = c.createLinearGradient(0, 0, 0, 800);
      bg.addColorStop(0, '#f6d8b8');
      bg.addColorStop(1, '#e7a98a');
      c.fillStyle = bg;
      c.fillRect(0, 0, 420, 800);
      text('👵', 380, '220px sans-serif');
      text('Grandma', 120, '800 40px sans-serif', '#3b2620');
      text('Video call · 00:12', 165, '600 26px sans-serif', 'rgba(59,38,32,0.7)');
      text('🎂 Happy birthday!', 560, '800 34px sans-serif', '#8a3b2e');
      c.fillStyle = '#1b2440';
      roundRect(c, 290, 600, 100, 130, 18);
      c.fill();
      text('👦', 690, '64px sans-serif');
      c.fillStyle = '#e2574c';
      c.beginPath();
      c.arc(150, 700, 38, 0, Math.PI * 2);
      c.fill();
      text('📞', 714, '36px sans-serif');
    } else if (spec.type === 'paid') {
      text('✅', 300, '150px sans-serif');
      text('Bill paid', 420, '800 50px sans-serif');
      text('₹2,340 · on time', 480, '500 30px sans-serif', 'rgba(239,233,220,0.75)');
    } else {
      text(spec.time ?? '9:00', 210, '600 120px Georgia, serif');
      text(spec.date ?? '', 262, '500 30px sans-serif', 'rgba(239,233,220,0.7)');
      c.fillStyle = 'rgba(239,233,220,0.12)';
      roundRect(c, 40, 320, 340, 250, 32);
      c.fill();
      text(spec.emoji ?? '⏰', 410, '72px sans-serif');
      text(spec.title ?? '', 475, '700 36px sans-serif');
      text(spec.sub ?? '', 520, '500 27px sans-serif', 'rgba(239,233,220,0.7)');
      if (spec.whatsapp) {
        c.fillStyle = '#25d366';
        roundRect(c, 40, 588, 340, 46, 23);
        c.fill();
        text(spec.whatsapp, 620, '700 23px sans-serif', '#06301a');
      }
      c.fillStyle = '#d4af6a';
      roundRect(c, 70, 650, 280, 80, 40);
      c.fill();
      text('Memo reminder', 702, '700 30px sans-serif', '#0b1122');
    }
    texture.needsUpdate = true;
  };
  g.userData.draw({ type: 'ring' });

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

/** Draws on a fresh canvas and returns it as a texture. */
function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** The birthday card Aarav made for Grandma. */
function makeCard() {
  const tex = canvasTexture(256, 200, c => {
    c.fillStyle = '#fff4e6';
    c.fillRect(0, 0, 256, 200);
    c.strokeStyle = '#d4af6a';
    c.lineWidth = 8;
    c.strokeRect(6, 6, 244, 188);
    c.textAlign = 'center';
    c.font = '64px sans-serif';
    c.fillText('🎂', 128, 92);
    c.fillStyle = '#c0392b';
    c.font = '800 30px sans-serif';
    c.fillText('Happy Birthday', 128, 140);
    c.fillStyle = '#8a3b2e';
    c.font = '700 26px sans-serif';
    c.fillText('Grandma ♥', 128, 176);
  });
  const g = new THREE.Group();
  g.add(mesh(new THREE.PlaneGeometry(0.34, 0.27), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }), { shadow: false }));
  return g;
}

/** A wall calendar; flip(t) tears pages off so weeks fly by. */
function makeCalendar(months) {
  const g = new THREE.Group();
  const page = month => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 300;
    const c = canvas.getContext('2d');
    c.fillStyle = '#faf6ee';
    c.fillRect(0, 0, 256, 300);
    c.fillStyle = '#c0392b';
    c.fillRect(0, 0, 256, 70);
    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.font = '700 40px sans-serif';
    c.fillText(month[0], 128, 50);
    c.fillStyle = '#2a1e1a';
    c.font = '700 130px Georgia, serif';
    c.fillText(month[1], 128, 220);
    c.font = '500 26px sans-serif';
    c.fillText(month[2], 128, 270);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  };
  const pages = months.map((m, i) => {
    const sheet = mesh(new THREE.PlaneGeometry(0.42, 0.5), page(m), { z: 0.002 * (months.length - i), shadow: false });
    g.add(sheet);
    return sheet;
  });
  g.add(mesh(new THREE.BoxGeometry(0.46, 0.06, 0.03), mat(0x2a1e1a), { y: 0.27 }));
  /** Shows page `index` with every earlier page torn off. `fly` (0..1) animates the last tear. */
  g.userData.show = (index, fly = 1) => {
    pages.forEach((sheet, i) => {
      if (i < index - 1 || (i === index - 1 && fly >= 1)) sheet.visible = false;
      else if (i === index - 1) {
        sheet.visible = true;
        sheet.position.set(0.5 * fly, -0.6 * fly * fly, 0.05 + 0.3 * fly);
        sheet.rotation.set(0.6 * fly, 0, -1.4 * fly);
      } else {
        sheet.visible = true;
        sheet.position.set(0, 0, 0.002 * (months.length - i));
        sheet.rotation.set(0, 0, 0);
      }
    });
  };
  g.userData.show(0);
  g.position.set(1.05, 2.2, -2.15);
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

/** Golden sparkles that drift around Melo. */
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

/** A plan in Memo: its title, the day, and three tasks that tick. */
function makePlanCard(title, tasks) {
  const canvas = document.createElement('canvas');
  canvas.width = 560;
  canvas.height = 380;
  const c = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  g.add(mesh(new THREE.PlaneGeometry(1.16, 0.79), new THREE.MeshBasicMaterial({ map: tex, transparent: true }), { shadow: false }));
  /** Redraws for `day` (1–7) with `done` tasks ticked today. */
  g.userData.draw = (day, done) => {
    c.clearRect(0, 0, 560, 380);
    c.fillStyle = '#121a33';
    roundRect(c, 4, 4, 552, 372, 36);
    c.fill();
    c.strokeStyle = '#d4af6a';
    c.lineWidth = 4;
    roundRect(c, 4, 4, 552, 372, 36);
    c.stroke();
    c.textAlign = 'left';
    c.fillStyle = '#d4af6a';
    c.font = '700 24px sans-serif';
    c.fillText('MEMO · PLAN', 36, 52);
    c.fillStyle = '#efe9dc';
    c.font = '800 38px sans-serif';
    c.fillText(title, 36, 100);
    c.textAlign = 'right';
    c.fillStyle = 'rgba(239,233,220,0.7)';
    c.font = '600 26px sans-serif';
    c.fillText(`Day ${day} of 7`, 524, 52);
    c.textAlign = 'left';
    tasks.forEach((task, i) => {
      const y = 150 + i * 72;
      const ok = i < done;
      c.fillStyle = ok ? '#4fc38a' : 'rgba(239,233,220,0.12)';
      c.beginPath();
      c.arc(60, y + 22, 22, 0, Math.PI * 2);
      c.fill();
      if (ok) {
        c.strokeStyle = '#0b1122';
        c.lineWidth = 6;
        c.beginPath();
        c.moveTo(49, y + 23);
        c.lineTo(57, y + 31);
        c.lineTo(72, y + 13);
        c.stroke();
      }
      c.fillStyle = ok ? 'rgba(239,233,220,0.55)' : '#efe9dc';
      c.font = '600 30px sans-serif';
      c.fillText(task, 100, y + 33);
    });
    tex.needsUpdate = true;
  };
  g.userData.draw(1, 0);
  return g;
}

/** The streak flame with its number, which counts up as days are finished. */
function makeStreakFlame() {
  const g = new THREE.Group();
  const outer = mesh(new THREE.ConeGeometry(0.16, 0.42, 20), mat(0xff5a1f, { emissive: 0xff3d00, emissiveIntensity: 0.9 }), { y: 0.21, shadow: false });
  const inner = mesh(new THREE.ConeGeometry(0.09, 0.26, 16), mat(0xffd54a, { emissive: 0xffc22e, emissiveIntensity: 1.1 }), { y: 0.15, z: 0.05, shadow: false });
  const base = mesh(new THREE.SphereGeometry(0.16, 20, 14), mat(0xff5a1f, { emissive: 0xff3d00, emissiveIntensity: 0.9 }), { y: 0.03, shadow: false });
  g.add(outer, inner, base);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const c = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const counter = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  counter.scale.set(0.5, 0.25, 1);
  counter.position.set(0, -0.2, 0);
  g.add(counter);
  let shown = -1;
  /** Shows `n` and flickers for time t. */
  g.userData.update = (n, t) => {
    const f = 1 + 0.08 * Math.sin(t * 17) + 0.05 * Math.sin(t * 29);
    outer.scale.set(1, f, 1);
    inner.scale.set(1, 2 - f, 1);
    if (n === shown) return;
    shown = n;
    c.clearRect(0, 0, 256, 128);
    c.textAlign = 'center';
    c.fillStyle = '#ffb23e';
    c.font = '900 72px Georgia, serif';
    c.fillText(`${n}`, 128, 70);
    c.fillStyle = 'rgba(239,233,220,0.85)';
    c.font = '700 28px sans-serif';
    c.fillText('STREAK', 128, 112);
    tex.needsUpdate = true;
  };
  g.userData.update(0, 0);
  return g;
}

/** The Bronze badge: a metal disc with a ribbon. */
function makeMedal() {
  const g = new THREE.Group();
  const bronze = mat(0xe0904f, { metalness: 0.7, roughness: 0.28, emissive: 0x7a3d12, emissiveIntensity: 0.6 });
  const disc = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 40), bronze, { shadow: false });
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  const rim = mesh(new THREE.TorusGeometry(0.17, 0.02, 10, 40), mat(0xf6c29a, { metalness: 0.9, roughness: 0.25 }), { shadow: false });
  g.add(rim);
  const star = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 5), mat(0xf6c29a, { metalness: 0.9, roughness: 0.2 }), { z: 0.01, shadow: false });
  star.rotation.x = Math.PI / 2;
  g.add(star);
  for (const side of [-1, 1]) {
    const ribbon = mesh(new THREE.BoxGeometry(0.08, 0.26, 0.01), mat(side < 0 ? 0x2f5fd0 : 0xd8698a), { x: side * 0.06, y: 0.26, z: -0.02, shadow: false });
    ribbon.rotation.z = side * 0.25;
    g.add(ribbon);
  }
  return g;
}

/** A gold coin with a rupee sign: streaks can earn real money. */
function makeCoin() {
  const tex = canvasTexture(256, 256, c => {
    const grad = c.createRadialGradient(100, 90, 20, 128, 128, 128);
    grad.addColorStop(0, '#fff4bf');
    grad.addColorStop(0.6, '#f2c230');
    grad.addColorStop(1, '#b07a0c');
    c.fillStyle = grad;
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#8a5a06';
    c.textAlign = 'center';
    c.font = '900 150px Georgia, serif';
    c.fillText('₹', 128, 180);
  });
  const face = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.6, roughness: 0.3 });
  const edge = mat(0xb07a0c, { metalness: 0.8, roughness: 0.3 });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 48), edge);
  rim.rotation.x = Math.PI / 2;
  const g = new THREE.Group();
  g.add(rim);
  // Flat discs for the faces, so the ₹ reads the right way round on both sides.
  const front = new THREE.Mesh(new THREE.CircleGeometry(0.215, 48), face);
  front.position.z = 0.026;
  const back = new THREE.Mesh(new THREE.CircleGeometry(0.215, 48), face);
  back.position.z = -0.026;
  back.rotation.y = Math.PI;
  g.add(front, back);
  return g;
}

/** The Vault's padlock: it springs open when the PIN goes in. */
function makePadlock() {
  const g = new THREE.Group();
  const violet = mat(0x8f6bff, { metalness: 0.6, roughness: 0.3, emissive: 0x3a1f99, emissiveIntensity: 0.6 });
  g.add(mesh(new THREE.BoxGeometry(0.24, 0.19, 0.09), violet, { shadow: false }));
  g.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 12), mat(0x1b1240), { y: 0.0, z: 0.03, shadow: false }));
  const shackle = mesh(new THREE.TorusGeometry(0.075, 0.02, 10, 24, Math.PI), mat(0xd9dde3, { metalness: 0.9, roughness: 0.2 }), { y: 0.095, shadow: false });
  g.add(shackle);
  /** 0 = locked, 1 = open. */
  g.userData.open = k => {
    shackle.position.y = 0.095 + 0.07 * k;
    shackle.rotation.y = 1.2 * k;
  };
  return g;
}

/** Gold coins raining down behind the cast: streaks can earn real money. */
function makeCoinRain(count = 26) {
  const g = new THREE.Group();
  const gold = mat(0xf2c230, { metalness: 0.7, roughness: 0.25, emissive: 0x6a4a00, emissiveIntensity: 0.4 });
  const seeds = [];
  for (let i = 0; i < count; i++) {
    const coin = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.012, 20), gold, { shadow: false });
    g.add(coin);
    seeds.push({ coin, x: (Math.random() - 0.5) * 3.2, delay: Math.random() * 1.6, speed: 1.0 + Math.random() * 0.7, spin: 3 + Math.random() * 5 });
  }
  g.userData.update = t => {
    for (const sd of seeds) {
      const k = t - sd.delay;
      sd.coin.visible = k > 0;
      if (k <= 0) continue;
      sd.coin.position.set(sd.x, 3.0 - ((k * sd.speed) % 3.2), -0.7);
      sd.coin.rotation.set(k * sd.spin, k * 2, 0.4);
    }
  };
  return g;
}

/** Specks of dust that drift slowly through the lamp light, in every room. */
function makeDust(count = 90) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 5;
    positions[i * 3 + 1] = Math.random() * 2.8;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 2.5;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xffe2b8, size: 0.018, transparent: true, opacity: 0.55, depthWrite: false }),
  );
}

/** Little hearts that float up from the phone while Aarav talks to Grandma. */
function makeHearts(count = 14) {
  const tex = canvasTexture(64, 64, c => {
    c.fillStyle = '#ff5a7a';
    c.beginPath();
    c.moveTo(32, 56);
    c.bezierCurveTo(4, 36, 6, 10, 22, 10);
    c.bezierCurveTo(28, 10, 32, 16, 32, 20);
    c.bezierCurveTo(32, 16, 36, 10, 42, 10);
    c.bezierCurveTo(58, 10, 60, 36, 32, 56);
    c.fill();
  });
  const g = new THREE.Group();
  const seeds = [];
  for (let i = 0; i < count; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    g.add(sprite);
    seeds.push({ sprite, x: (Math.random() - 0.5) * 0.5, delay: Math.random() * 2.4, speed: 0.35 + Math.random() * 0.25, size: 0.08 + Math.random() * 0.07, sway: Math.random() * 6 });
  }
  /** Rises from (x, y) for t seconds, looping. */
  g.userData.update = (t, x, y) => {
    for (const sd of seeds) {
      const k = ((t - sd.delay) * sd.speed) % 1.4;
      const on = t > sd.delay;
      sd.sprite.visible = on;
      if (!on) continue;
      sd.sprite.position.set(x + sd.x + 0.08 * Math.sin(t * 2 + sd.sway), y + k * 1.1, 0.6);
      sd.sprite.scale.setScalar(sd.size * (0.6 + 0.4 * Math.min(1, k * 4)));
      sd.sprite.material.opacity = Math.max(0, 1 - k / 1.4);
    }
  };
  return g;
}

/** Confetti for the happy endings: little paper squares that tumble down. */
function makeConfetti(count = 160) {
  const colors = [0xd4af6a, 0xe2574c, 0x5b9bff, 0x4fc38a, 0xc24dff, 0xffffff];
  const geometry = new THREE.PlaneGeometry(0.05, 0.03);
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const confetti = new THREE.InstancedMesh(geometry, material, count);
  const color = new THREE.Color();
  const seeds = [];
  for (let i = 0; i < count; i++) {
    confetti.setColorAt(i, color.set(colors[i % colors.length]));
    seeds.push({ x: (Math.random() - 0.5) * 3.4, z: (Math.random() - 0.3) * 1.6, speed: 0.5 + Math.random() * 0.6, phase: Math.random() * 6, delay: Math.random() * 0.8 });
  }
  const dummy = new THREE.Object3D();
  confetti.userData.update = t => {
    seeds.forEach((sd, i) => {
      const k = Math.max(0, t - sd.delay);
      dummy.position.set(sd.x + 0.15 * Math.sin(k * 2 + sd.phase), 3.2 - ((k * sd.speed) % 3.4), sd.z);
      dummy.rotation.set(k * 3 + sd.phase, k * 2, k * 4);
      dummy.scale.setScalar(t > sd.delay ? 1 : 0);
      dummy.updateMatrix();
      confetti.setMatrixAt(i, dummy.matrix);
    });
    confetti.instanceMatrix.needsUpdate = true;
  };
  confetti.frustumCulled = false;
  return confetti;
}

// ---- Renderer ---------------------------------------------------------------------------

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
renderer.setClearColor(0x000000, 0);

// Space the app keeps for its caption at the top and its hint at the bottom
// (CSS pixels); the three panels share the height between them.
const TOP = Number(params.get('top') || 130);
const BOTTOM = Number(params.get('bottom') || 70);
const GAP = 8;

// ---- Stages: one little world per story ---------------------------------------------------

/** A room with its own camera and lights; `light()` sets the time of day (or a power cut). */
function makeStage() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b1122, 6, 14);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  const hemi = new THREE.HemisphereLight(0xfff1dc, 0x2a2238, 1.1);
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.2);
  sun.position.set(2.5, 5, 3.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(512, 512);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -2 });
  sun.shadow.bias = -0.0005;
  const lamp = new THREE.PointLight(0xffb45e, 6, 6, 1.6);
  lamp.position.set(-2.3, 1.6, -1.2);
  const rim = new THREE.DirectionalLight(0x8fb4ff, 0.8);
  rim.position.set(-3, 3, -3);
  scene.add(hemi, sun, lamp, rim);
  const room = makeRoom();
  scene.add(room);
  const dust = makeDust();
  scene.add(dust);
  const stage = { scene, camera, room, dust, view: null, power: 1, sky: null };
  stage.light = sky => {
    stage.sky = sky;
    scene.background = new THREE.Color(sky.bg);
    scene.fog.color.set(sky.bg);
    room.userData.window.color.set(sky.window);
    room.userData.sky.material.color.set(sky.sun ? 0xffe9a8 : 0xf3dca6);
    room.userData.sky.scale.setScalar(sky.sun ? 1.5 : 1);
    room.userData.sky.visible = Boolean(sky.moon || sky.sun);
    stage.setPower(1);
  };
  /** 1 is normal light, 0 a power cut (only the moonlight left). */
  stage.setPower = level => {
    stage.power = level;
    const sky = stage.sky;
    hemi.intensity = (sky.sun ? 1.6 : 1.1) * (0.12 + 0.88 * level);
    sun.intensity = 2.2 * (0.05 + 0.95 * level);
    lamp.intensity = sky.lamp * level;
    rim.intensity = 0.8 * (0.5 + 0.5 * level);
    scene.background = new THREE.Color(sky.bg).lerp(new THREE.Color(0x05070d), 1 - level);
  };
  return stage;
}

function addThings(stage) {
  return ['clock', 'phone', 'cup', 'book', 'bag'].map(k => {
    const t = busyThing(k);
    t.visible = false;
    stage.scene.add(t);
    return t;
  });
}

/** Small things whirl around a busy person at waist height, never in front of a face. */
function whirl(things, t, centerX) {
  things.forEach((thing, i) => {
    const a = t * 1.3 + (i / things.length) * Math.PI * 2;
    thing.visible = true;
    thing.position.set(Math.cos(a) * 0.75 + centerX, 0.75 + 0.08 * Math.sin(t * 2 + i), Math.sin(a) * 0.4);
    thing.rotation.set(t * 0.7 + i, t + i, 0);
    if (thing.userData.spin) thing.userData.spin.rotation.z = -t * 6;
    thing.scale.setScalar(0.6 + 0.4 * ease(seg(t, 0.1 * i, 0.1 * i + 0.6)));
  });
}

const DAY_WINDOW = new THREE.Color(0xffc78a);
const NIGHT_WINDOW = new THREE.Color(0x1b2a6e);
/** Days going by: the window turns from day to night and back, the sun and moon cross it. */
function daysPass(stage, t) {
  const phase = (t / 1.4) % 1;
  const night = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
  stage.room.userData.window.color.copy(DAY_WINDOW).lerp(NIGHT_WINDOW, night);
  const disc = stage.room.userData.sky;
  disc.visible = true;
  disc.position.x = -2.05 + 0.9 * phase;
  disc.position.y = 1.85 + 0.35 * Math.sin(phase * Math.PI);
  disc.material.color.set(night > 0.5 ? 0xf3dca6 : 0xffe9a8);
}

/** Busy walking back and forth, then stopping to think. */
function busyDay(p, t, stopAt) {
  if (t < stopAt) {
    p.root.position.x = 0.45 * Math.sin(t * 1.6);
    p.root.rotation.y = Math.cos(t * 1.6) > 0 ? 0.9 : -0.9;
    const swing = Math.sin(t * 9);
    p.legL.rotation.x = 0.4 * swing;
    p.legR.rotation.x = -0.4 * swing;
    moves.busy(p, t);
  } else {
    p.root.rotation.y = lerp(p.root.rotation.y, 0, 0.1);
    p.setMood('worried');
    moves.think(p, t, stopAt, 99);
  }
}

/** A phone floating between Aarav and Mom (clear of their faces), ringing between a and b. */
function ringPhone(phone, t, a, b, { x = 0.35, y = 1.35, scale = 0.5 } = {}) {
  phone.visible = true;
  phone.scale.setScalar(scale * ease(seg(t, a - 0.3, a + 0.1)) + 0.001);
  phone.position.set(x, y + 0.04 * Math.sin(t * 2), 0.5);
  const ringing = t > a && t < b;
  phone.rotation.set(-0.08, -0.2, ringing ? 0.09 * Math.sin(t * 38) : 0);
  phone.userData.rings.forEach((ring, i) => {
    const k = (t * 0.9 + i / 3) % 1;
    ring.scale.setScalar(1 + k * 0.6);
    ring.material.opacity = ringing ? 0.5 * (1 - k) : 0;
  });
}

const AARAV = { kind: 'kid' };
// Part 2's cast looks nothing like Part 1's: Satya (beard, glasses, a navy
// jacket over a white shirt, a watch, sneakers) and his friend Riya (long
// open hair, a pink top and jeans, hoops).
const SATYA = { kind: 'man', skinColor: 0xc98f66, topColor: 0xf2f4f7, bottomColor: 0x3a3f4a, hairColor: 0x161010, glasses: true, beard: true, jacketColor: 0x2b3a5c };
const RIYA = { kind: 'casual', skinColor: 0xf0c4a0, topColor: 0xe85d8a, bottomColor: 0x3b5ba5, hairColor: 0x3a2318 };
const MOM = { kind: 'mom', skinColor: 0xe9b48f, topColor: 0xc95c7a, hairColor: 0x3b2620 };

function cast(stage, spec) {
  const p = makePerson(spec);
  p.root.position.set(-9, 0, 0);
  stage.scene.add(p.root);
  return p;
}

// Grandma's birthday story: it all happens at home.
const B = makeStage();
B.aarav = cast(B, AARAV);
B.mom = cast(B, MOM);
B.phone = makePhone();
B.card = makeCard();
B.calendar = makeCalendar([
  ['OCT', '12', 'In 2 days: Grandma 🎂'],
  ['OCT', '13', ''],
  ['OCT', '14', 'Grandma’s birthday'],
  ['OCT', '15', 'One day late'],
]);
B.confetti = makeConfetti(90);
B.hearts = makeHearts();
B.things = addThings(B);
B.scene.add(B.phone, B.card, B.calendar, B.confetti, B.hearts);
B.calendar.position.set(1.15, 2.05, -2.15);

// Part 2: Satya's flat (a teal room), with his plan, streak, badge and Vault.
const P = makeStage();
P.room.userData.wall.color.set(0x2c4a52);
P.room.userData.sofaMat.color.set(0x8e3a5e);
P.satya = cast(P, SATYA);
P.riya = cast(P, RIYA);
P.phone = makePhone();
P.confetti = makeConfetti(110);
P.plan = makePlanCard('💪 Get fit in 30 days', ['Walk for 20 minutes', 'Do 10 push-ups', 'Drink 8 glasses of water']);
P.flame = makeStreakFlame();
P.medal = makeMedal();
P.coin = makeCoin();
P.rain = makeCoinRain();
P.padlock = makePadlock();
P.sparkles = makeSparkles(50);
// A burst of light when the badge appears, and when the Vault opens.
P.flash = new THREE.PointLight(0xffe2a8, 0, 5, 1.4);
P.flash.position.set(0, 1.4, 1.1);
P.scene.add(P.phone, P.confetti, P.plan, P.flame, P.medal, P.coin, P.rain, P.padlock, P.sparkles, P.flash);

// Melo's arrival.
const M = makeStage();
M.aarav = cast(M, AARAV);
M.mom = cast(M, MOM);
M.melo = new THREE.Group();
M.melo.isGroup = true;
M.sparkles = makeSparkles();
// A burst of warm light as Melo lands.
M.flash = new THREE.PointLight(0xffe2a8, 0, 6, 1.4);
M.flash.position.set(0.15, 1.2, 1.2);
M.scene.add(M.melo, M.sparkles, M.flash);

// The finale.
const F = makeStage();
F.aarav = cast(F, AARAV);
F.mom = cast(F, MOM);
// Part 2 ends with its own cast.
F.satya = cast(F, SATYA);
F.riya = cast(F, RIYA);
F.melo = new THREE.Group();
F.melo.isGroup = true;
F.confetti = makeConfetti(160);
F.scene.add(F.melo, F.confetti);

const PEOPLE = [B.aarav, B.mom, M.aarav, M.mom, F.aarav, F.mom, P.satya, P.riya, F.satya, F.riya];
/** Which part is playing (the closing scene shows that part's cast). */
let part = 1;
// The calendar comes back for the scenes that use it.
const showCalendar = on => (B.calendar.visible = on);

// Melo, loaded from the app's own GLB and scaled to stand about 1.1 tall.
(function loadMelo() {
  const get = url =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      xhr.responseType = 'arraybuffer';
      xhr.onload = () => (xhr.response && xhr.response.byteLength ? resolve(xhr.response) : reject(new Error('empty')));
      xhr.onerror = reject;
      xhr.send();
    });
  Promise.all([get('../../models/model.glb'), get('../../fonts/CormorantGaramond-Bold.ttf').catch(() => null)]).then(([glb, ttf]) => {
    new GLTFLoader().parse(glb, '', gltf => {
      const model = gltf.scene;
      // His name in champagne gold on his robe, as on the guide page. Built
      // before the model is scaled, then attached so it moves with him.
      if (ttf) {
        try {
          const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
          const name = robeName(ttf, findRobe(model), model, env);
          // The story is lit brighter than the guide page; keep the champagne from washing out.
          // Deeper champagne here (brand.champagne, champagneDeep edges).
          name.material[0].color.set(0xd8b673);
          name.material[1].color.set(0xb48b45);
          for (const m of name.material) {
            m.envMapIntensity = 0.8;
            m.emissive.set(0x000000);
          }
          model.add(name);
        } catch (e) {
          // No font, no name; Melo carries on.
        }
      }
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const k = 1.1 / size.y;
      model.scale.setScalar(k);
      model.position.set(-center.x * k, -box.min.y * k, -center.z * k);
      model.traverse(o => {
        if (o.isMesh) {
          o.castShadow = !o.userData.isName; // the lettering casts none
          o.receiveShadow = true;
        }
      });
      M.melo.add(model);
      F.melo.add(model.clone(true));
    });
  });
})();

// ---- Speech bubbles and panel labels --------------------------------------------------------

const bubbleLayer = document.getElementById('bubbles');
let bubbles = [];

/** A bubble pinned above `who` (a person, or Melo's group) in `stage`, from `at` seconds. */
function say(stage, who, text, at, { thought = false, until = Infinity, gold = false } = {}) {
  const el = document.createElement('div');
  el.className = `bubble${thought ? ' thought' : ''}${gold ? ' gold' : ''}${stage.view && stage.view.small ? ' small' : ''}`;
  el.textContent = text;
  bubbleLayer.appendChild(el);
  bubbles.push({ el, stage, who, at, until });
}

function clearOverlay() {
  bubbles = [];
  bubbleLayer.innerHTML = '';
}

/** The little title chip at the top-left of each panel. */
function label(stage, text) {
  const el = document.createElement('div');
  el.className = 'panel-label';
  el.textContent = text;
  el.style.left = '12px';
  el.style.top = `${stage.view.y + 8}px`;
  bubbleLayer.appendChild(el);
  const line = document.createElement('div');
  line.className = 'panel-line';
  line.style.top = `${stage.view.y + stage.view.h + GAP / 2}px`;
  bubbleLayer.appendChild(line);
}

const anchor = new THREE.Vector3();
const lift = new THREE.Vector3(0, 0.36, 0);
/** Dims a panel that is waiting its turn, with a short note on it. */
function dim(stage, text) {
  const el = document.createElement('div');
  el.className = 'panel-dim';
  el.style.top = `${stage.view.y}px`;
  el.style.height = `${stage.view.h}px`;
  el.innerHTML = `<span>${text}</span>`;
  bubbleLayer.appendChild(el);
}

function placeBubbles(t) {
  for (const b of bubbles) {
    const on = t >= b.at && t < b.until;
    b.el.classList.toggle('on', on);
    if (!on) continue;
    const v = b.stage.view;
    if (b.who.isGroup) anchor.set(b.who.position.x, b.who.position.y + 1.2, b.who.position.z);
    else b.who.head.getWorldPosition(anchor).add(lift);
    anchor.project(b.stage.camera);
    const x = (anchor.x * 0.5 + 0.5) * v.w;
    const y = (-anchor.y * 0.5 + 0.5) * v.h;
    const bw = b.el.offsetWidth;
    const bh = b.el.offsetHeight;
    const left = Math.min(Math.max(x - bw / 2, 10), v.w - bw - 10);
    // Full-screen scenes keep bubbles below the app's caption at the top.
    const minTop = v.small ? 30 : Math.max(30, TOP - 24);
    const top = Math.min(Math.max(y - bh, minTop), v.h - bh - 8);
    b.el.style.transform = `translate(${left}px, ${v.y + top}px)`;
    b.el.style.setProperty('--tail', `${Math.min(Math.max(x - left, 18), bw - 18)}px`);
  }
}

// ---- Scenes ---------------------------------------------------------------------------------

const NIGHT = { bg: 0x2a2140, window: 0x2b4a8a, moon: true, lamp: 6 };
const EVENING = { bg: 0x241b33, window: 0x5a3b6e, moon: false, lamp: 3 };
const DUSK = { bg: 0x1d2236, window: 0x1b2a52, moon: true, lamp: 5 };
const MORNING = { bg: 0x2c3558, window: 0xffc78a, sun: true, lamp: 2 };
const MAGIC = { bg: 0x161a33, window: 0x3a2a6e, moon: true, lamp: 2 };

/** Panel camera: Aarav and Mom side by side, framed from the knees up. */
const PANEL_CAM = { x: 0, y: 1.15, z: 4.4, look: [0, 1.25, 0], width: 2.9 };

/**
 * A scene is either three panels (`panels`: one entry per story, each with
 * its own setup and update) or one full-screen stage.
 */
/** A hand-held prop (the card) at chest height beside the body, below the face. */
function inHand(prop, p, raise = 0) {
  prop.visible = true;
  prop.position.set(p.root.position.x + 0.34, p.hips.position.y + 0.12 + raise, p.root.position.z + 0.3);
  prop.rotation.set(-0.15, -0.3, 0.05);
}

/** Part 2's grown-ups are taller: the camera sits a little higher and further back. */
const PART2_CAM = { x: 0, y: 1.45, z: 5.6, look: [0, 1.5, 0], width: 3.3 };

/** Full-screen camera for Aarav and Mom side by side. */
const STORY_CAM = { x: 0, y: 1.1, z: 4.6, look: [0, 1.15, 0], width: 2.8 };

/** Each scene sets things up once, then poses everyone for time t (seconds). */
const SCENES = [
  {
    // Aarav shows Mom the card he made: Grandma's birthday is in 2 days.
    stage: B,
    sky: DUSK,
    camera: STORY_CAM,
    setup() {
      B.aarav.setMood('happy');
      B.mom.setMood('happy');
      B.mom.root.position.set(0.65, 0, 0);
      B.mom.root.rotation.y = -0.45;
      B.calendar.userData.show(0);
      say(B, B.aarav, 'Mom, Grandma’s birthday is in 2 days! Please remind me to call her. 🎂', 1.4, { until: 5.6 });
      say(B, B.mom, 'Just 2 days? I’ll remember, don’t worry.', 5.8, { gold: true });
    },
    update(t) {
      moves.walk(B.aarav, t, 0, 1.3, -2.4, -0.6, 0.5);
      const raise = bump(seg(t, 2.6, 5.0));
      inHand(B.card, B.aarav, 0.1 * raise);
      moves.hold(B.aarav, 0.6 + 0.2 * raise);
      moves.talk(B.aarav, t, 1.5, 5.2);
      moves.clap(B.mom, t, 3.2, 4.8);
      moves.talk(B.mom, t, 5.9, 7.8);
      moves.jump(B.aarav, t, 8.0, 9.0);
    },
  },
  {
    // Two busy days fly by, Mom forgets, and the birthday passes.
    stage: B,
    sky: EVENING,
    camera: STORY_CAM,
    setup() {
      B.mom.setMood('happy');
      B.mom.root.position.set(0.2, 0, 0);
      B.calendar.userData.show(0);
      say(B, B.mom, 'Grandma… birthday… I’ll remember.', 0.8, { thought: true, until: 4.6 });
      say(B, B.aarav, 'Mom… Grandma’s birthday was yesterday. We forgot to call her. 😞', 5.6, { until: 9.0 });
      say(B, B.mom, 'Oh no, beta… I forgot.', 9.2, { gold: true });
    },
    update(t) {
      if (t < 4.7) {
        daysPass(B, t);
        const p = Math.min(t / 1.4, 2.999);
        B.calendar.userData.show(Math.floor(p) + 1, p - Math.floor(p) < 0.6 ? (p - Math.floor(p)) / 0.6 : 1);
        busyDay(B.mom, t, 99);
        whirl(B.things, t, B.mom.root.position.x);
        return;
      }
      if (!B.settled) {
        B.settled = true;
        B.light(EVENING);
        B.room.userData.sky.position.set(-1.3, 2.15, -2.17);
        B.things.forEach(th => (th.visible = false));
        B.calendar.userData.show(3);
        B.aarav.root.position.set(-0.6, 0, 0.2);
        B.aarav.root.rotation.y = 0.4;
        B.mom.root.position.set(0.6, 0, 0);
        B.mom.root.rotation.y = -0.4;
      }
      const k = t - 4.7;
      inHand(B.card, B.aarav);
      moves.hold(B.aarav, 0.5);
      if (k > 0.8) {
        B.aarav.setMood('sad');
        moves.sad(B.aarav, ease(seg(k, 0.8, 1.5)));
      }
      if (k > 4.4) {
        B.mom.setMood('sad');
        moves.sad(B.mom, 0.35 * ease(seg(k, 4.4, 5.0)));
      }
    },
  },
  {
    // Melo arrives: tell Memo once, even months ahead.
    stage: M,
    sky: MAGIC,
    camera: { x: 0, y: 1.0, z: 5.0, look: [0, 1.0, 0], width: 3.4 },
    setup() {
      M.aarav.setMood('sad');
      M.mom.setMood('sad');
      M.aarav.root.position.set(-1.05, 0, 0.1);
      M.aarav.root.rotation.y = 0.55;
      M.mom.root.position.set(1.25, 0, -0.1);
      M.mom.root.rotation.y = -0.55;
      say(M, M.melo, 'Hi, I’m Melo! Tell Memo once, days or months ahead, and I’ll remind you right on the day.', 2.0, { gold: true });
    },
    update(t) {
      const drop = seg(t, 0, 0.9);
      const bounce = drop < 1 ? (1 - ease(drop)) * 3 : Math.abs(Math.sin((t - 0.9) * 9)) * 0.25 * Math.max(0, 1 - (t - 0.9) * 1.6);
      M.melo.visible = true;
      M.melo.position.set(0.15, bounce, 0.4);
      M.flash.intensity = 9 * bump(seg(t, 0.75, 1.9));
      M.melo.rotation.y = Math.PI * 2 * ease(seg(t, 0.9, 2.0)) - 0.3;
      M.melo.rotation.z = t > 2 ? 0.2 * Math.sin((t - 2) * 7) * Math.max(0, 1 - (t - 2) * 0.25) : 0;
      M.sparkles.visible = true;
      M.sparkles.rotation.y = t * 0.3;
      M.sparkles.material.opacity = 0.9 * seg(t, 0.6, 1.4);
      for (const [p, i] of [
        [M.aarav, 0],
        [M.mom, 1],
      ]) {
        if (t > 1.0 + i * 0.2) p.setMood('surprised');
        if (t > 2.6 + i * 0.3) p.setMood('happy');
      }
      moves.jump(M.aarav, t, 2.8, 4.0);
      moves.clap(M.mom, t, 3.0, 4.6);
    },
  },
  {
    // This time Mom saves it in Memo; on the birthday it reminds her and Aarav calls Grandma.
    stage: B,
    sky: MORNING,
    camera: STORY_CAM,
    setup() {
      B.aarav.setMood('happy');
      B.mom.setMood('happy');
      B.aarav.root.position.set(-0.65, 0, 0);
      B.aarav.root.rotation.y = 0.4;
      B.mom.root.position.set(0.65, 0, 0);
      B.mom.root.rotation.y = -0.4;
      B.calendar.userData.show(0);
      B.phone.userData.draw({ type: 'saved', emoji: '🎂', title: 'Call Grandma: birthday', date: '14 Oct · 8:00 AM', sub: 'In 2 days · Memo will remind you' });
      B.phone.userData.screen = 'saved';
      say(B, B.mom, 'Saved in Memo, for 14 October. Done! ✅', 1.2, { gold: true, until: 3.4 });
      say(B, B.mom, 'Memo reminded me, and sent Papa a WhatsApp too! 📲', 5.4, { gold: true, until: 8.4 });
      say(B, B.aarav, 'Happy birthday, Grandma! 🎂 I made you a card!', 9.4, { until: 12.2 });
      say(B, B.mom, 'She’s so happy! Thank you, Memo. 💛', 12.4, { gold: true });
    },
    update(t) {
      inHand(B.card, B.aarav);
      moves.hold(B.aarav, 0.5);
      const phone = { x: 0.0, y: 1.3 };
      if (t < 3.4) {
        // Mom saves the reminder two days ahead. (No ringing: it just shows it's saved.)
        ringPhone(B.phone, t, 0.3, 0.3, { ...phone, scale: 0.9 * (1 - ease(seg(t, 3.0, 3.4))) + 0.001 });
        moves.talk(B.mom, t, 1.3, 3.0);
        return;
      }
      if (t < 4.8) {
        // The two days fly by…
        B.phone.visible = false;
        const p = Math.min((t - 3.4) / 0.6, 2);
        B.calendar.userData.show(Math.min(Math.floor(p) + 1, 2), p - Math.floor(p) < 0.6 ? (p - Math.floor(p)) / 0.6 : 1);
        return;
      }
      B.calendar.userData.show(2);
      if (t < 8.4) {
        // …and on 14 October, Memo reminds her.
        if (B.phone.userData.screen !== 'ring') {
          B.phone.userData.draw({ type: 'ring', time: '8:00', date: '14 October', emoji: '🎂', title: 'Grandma’s birthday', sub: 'Call her today', whatsapp: '✓ Also sent to Papa on WhatsApp' });
          B.phone.userData.screen = 'ring';
        }
        ringPhone(B.phone, t, 5.1, 7.4, { ...phone, scale: 0.9 });
        if (t > 5.6) B.aarav.setMood('surprised');
        if (t > 6.6) B.aarav.setMood('happy');
        moves.nod(B.mom, t, 5.6, 6.8);
        moves.clap(B.aarav, t, 6.8, 8.0);
        return;
      }
      // The video call with Grandma.
      if (B.phone.userData.screen !== 'call') {
        B.phone.userData.draw({ type: 'call' });
        B.phone.userData.screen = 'call';
      }
      ringPhone(B.phone, t, 0, 0, { ...phone, scale: 0.9 });
      moves.wave(B.aarav, t, 8.6, 11.0, 'L');
      moves.talk(B.aarav, t, 9.5, 12.0);
      moves.clap(B.mom, t, 12.4, 14.0);
      const k = t - 9.4;
      B.confetti.visible = k > 0;
      if (B.confetti.visible) B.confetti.userData.update(k);
      B.hearts.visible = true;
      B.hearts.userData.update(t - 8.6, phone.x, phone.y + 0.45);
    },
  },
  {
    // Part 2. Big goals, one small step a day: Satya's fitness plan, his streak, a badge and real money.
    stage: P,
    steady: true,
    sky: DUSK,
    camera: PART2_CAM,
    setup() {
      P.satya.setMood('happy');
      P.riya.setMood('happy');
      P.satya.root.position.set(-0.75, 0, 0.1);
      P.satya.root.rotation.y = 0.35;
      P.riya.root.position.set(0.75, 0, 0);
      P.riya.root.rotation.y = -0.35;
      P.plan.userData.draw(1, 0);
      say(P, P.satya, 'Riya, I want to get fit in 30 days! 💪', 0.4, { until: 3.2 });
      say(P, P.riya, 'Make it a plan in Memo, Satya: a few small tasks every day.', 3.4, { gold: true, until: 6.6 });
      say(P, P.satya, 'Streak 7! I got the Bronze badge! 🥉', 12.0, { until: 14.8 });
      say(P, P.riya, 'And your streaks can earn real money too! 💰', 15.0, { gold: true });
    },
    update(t) {
      // Everything floats between Satya and Riya at chest height: clear of
      // their faces and of the speech bubbles above their heads.
      const pop = ease(seg(t, 4.6, 5.3)) * (1 - ease(seg(t, 11.2, 11.7)));
      P.plan.visible = pop > 0.01;
      P.plan.scale.setScalar(0.001 + 0.8 * pop);
      P.plan.position.set(0, 1.28 + 0.03 * Math.sin(t * 1.6), 0.25);
      // Day 1: the three tasks tick one by one; then the next days fly by.
      let day = 1;
      let done = t > 8.0 ? 3 : t > 7.3 ? 2 : t > 6.6 ? 1 : 0;
      if (t > 8.6) {
        const k = Math.min((t - 8.6) / 0.5, 6);
        day = 1 + Math.min(Math.ceil(k), 6);
        done = k >= 6 ? 3 : Math.floor((k - Math.floor(k)) * 4);
      }
      if (P.plan.userData.day !== day || P.plan.userData.done !== done) {
        P.plan.userData.day = day;
        P.plan.userData.done = done;
        P.plan.userData.draw(day, done);
      }
      // The streak: one point for each finished day.
      const streakDays = t < 8.0 ? 0 : t > 8.6 ? Math.min(1 + Math.floor((t - 8.6) / 0.5), 7) : 1;
      const flamePop = ease(seg(t, 5.6, 6.2)) * (1 - ease(seg(t, 14.6, 15.2)));
      P.flame.visible = flamePop > 0.01;
      P.flame.scale.setScalar(0.001 + 0.62 * flamePop * (1 + 0.15 * bump(seg(t, 11.6, 12.2))));
      // Just under the plan card (and the badge), in the middle.
      P.flame.position.set(0, 0.74, 0.32);
      P.flame.userData.update(streakDays, t);
      // Day 7: the Bronze badge pops up and spins.
      const medalPop = ease(seg(t, 11.6, 12.2)) * (1 - ease(seg(t, 14.6, 15.2)));
      P.medal.visible = medalPop > 0.01;
      P.medal.scale.setScalar(0.001 + medalPop * 1.35);
      P.medal.position.set(-0.05, 1.3 + 0.04 * Math.sin(t * 2), 0.3);
      P.medal.rotation.y = (t - 11.6) * 2.4;
      // Then a coin for the real-money rewards.
      const coinPop = ease(seg(t, 15.0, 15.6));
      P.coin.visible = coinPop > 0.01;
      P.coin.scale.setScalar(0.001 + coinPop * 1.2);
      // Between them at chest height: clear of both faces and of the speech bubble.
      P.coin.position.set(0, 1.15 + 0.05 * Math.sin(t * 2), 0.3);
      P.coin.rotation.y = 0.7 * Math.sin(t * 1.6);
      moves.talk(P.satya, t, 0.5, 3.0);
      moves.flex(P.satya, t, 1.2, 3.0);
      moves.talk(P.riya, t, 3.5, 6.3);
      // He gets going: jogging on the spot while his tasks tick and the days fly.
      moves.jog(P.satya, t, 6.2, 11.4);
      for (const at of [6.6, 7.3, 8.0]) moves.clap(P.riya, t, at, at + 0.45);
      if (t > 8.6 && t < 11.6) daysPass(P, t - 8.6);
      else if (t >= 11.6 && !P.settled) {
        P.settled = true;
        P.light(DUSK);
        P.room.userData.sky.position.set(-1.3, 2.15, -2.17);
      }
      P.flash.intensity = 7 * bump(seg(t, 11.5, 12.6));
      moves.jump(P.satya, t, 12.0, 13.0);
      moves.flex(P.satya, t, 13.0, 14.6);
      moves.clap(P.riya, t, 12.2, 13.8);
      moves.talk(P.riya, t, 15.1, 17.2);
      P.confetti.visible = t > 12.0 && t < 15.0;
      if (P.confetti.visible) P.confetti.userData.update(t - 12.0);
      P.rain.visible = t > 15.0;
      if (P.rain.visible) P.rain.userData.update(t - 15.0);
    },
  },
  {
    // Part 2. Private things stay private: Satya's Vault, behind his own PIN.
    stage: P,
    steady: true,
    sky: NIGHT,
    camera: PART2_CAM,
    setup() {
      P.satya.setMood('happy');
      P.riya.setMood('happy');
      P.satya.root.position.set(-0.7, 0, 0.1);
      P.satya.root.rotation.y = 0.4;
      P.riya.root.position.set(0.7, 0, 0);
      P.riya.root.rotation.y = -0.4;
      P.phone.userData.draw({ type: 'vault-lock', dots: 0 });
      P.phone.userData.screen = 'lock0';
      say(P, P.satya, 'My bank details, ID photos and voice notes? In my private Vault, behind my own PIN. 🔒', 0.6, { gold: true, until: 5.4 });
      say(P, P.riya, 'So only you can open it? Smart, Satya! 😎', 5.6);
    },
    update(t) {
      const dots = Math.max(0, Math.min(4, Math.floor((t - 1.4) / 0.35) + 1));
      const screen = t > 3.0 ? 'vault' : `lock${dots}`;
      if (P.phone.userData.screen !== screen) {
        P.phone.userData.screen = screen;
        P.phone.userData.draw(screen === 'vault' ? { type: 'vault' } : { type: 'vault-lock', dots });
      }
      ringPhone(P.phone, t, 0, 0, { x: 0.0, y: 1.3, scale: 0.9 });
      // The padlock under the phone springs open as the PIN goes in.
      P.padlock.visible = true;
      P.padlock.position.set(0, 0.55 + 0.03 * Math.sin(t * 2), 0.45);
      P.padlock.scale.setScalar(1 + 0.25 * bump(seg(t, 2.9, 3.5)));
      P.padlock.userData.open(ease(seg(t, 2.9, 3.3)));
      P.flash.intensity = 6 * bump(seg(t, 2.9, 3.9));
      P.flash.color.set(0xc9b6ff);
      P.sparkles.visible = t > 2.9;
      P.sparkles.rotation.y = t * 0.4;
      P.sparkles.material.opacity = 0.8 * seg(t, 2.9, 3.4);
      moves.talk(P.satya, t, 0.7, 5.0);
      moves.nod(P.riya, t, 3.2, 4.4);
      moves.talk(P.riya, t, 5.7, 7.2);
      moves.flex(P.satya, t, 6.0, 7.6);
    },
  },
  {
    // Aarav, Mom and Melo wave: the closing shot behind the app's feature list.
    stage: F,
    sky: NIGHT,
    camera: { x: 0, y: 0.6, z: 6.0, look: [0, -0.3, 0], width: 3.4 },
    setup() {
      const [left, right] = part === 2 ? [F.satya, F.riya] : [F.aarav, F.mom];
      F.left = left;
      F.right = right;
      left.setMood('happy');
      right.setMood('happy');
      left.root.position.set(-1.05, 0, 0.3);
      left.root.rotation.y = 0.25;
      right.root.position.set(1.1, 0, 0);
      right.root.rotation.y = -0.25;
    },
    update(t) {
      F.melo.visible = true;
      F.melo.position.set(0, Math.abs(Math.sin(t * 2.2)) * 0.12, 0.45);
      F.melo.rotation.z = 0.12 * Math.sin(t * 3);
      moves.wave(F.left, t % 3, 0, 2.2, 'L');
      moves.wave(F.right, (t + 1.2) % 3, 0, 2.2, 'R');
      F.confetti.visible = true;
      F.confetti.userData.update(t);
    },
  },
];

// ---- Playing ------------------------------------------------------------------------------

let current = -1;
let startedAt = 0;
/** Story time runs this much slower than real time, so there's time to read. */
const SLOW = 1.15;

function resetStage(stage) {
  for (const key of ['phone', 'card', 'confetti', 'sparkles', 'melo', 'hearts', 'plan', 'flame', 'medal', 'coin', 'rain', 'padlock']) if (stage[key]) stage[key].visible = false;
  if (stage.flash) {
    stage.flash.intensity = 0;
    stage.flash.color.set(0xffe2a8);
  }
  stage.room.userData.sky.position.set(-1.3, 2.15, -2.17);
  stage.cam = null;
  stage.settled = false;
  if (stage.things) stage.things.forEach(th => (th.visible = false));
  if (stage.phone) stage.phone.userData.paid = undefined;
  if (stage.calendar) {
    stage.calendar.userData.show(0);
    showCalendar(true);
  }
}

function layout() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  const s = SCENES[current];
  if (!s) return;
  const fit = (stage, cam, view) => {
    stage.view = view;
    stage.camera.aspect = view.w / view.h;
    const halfFov = THREE.MathUtils.degToRad(stage.camera.fov / 2);
    const needed = cam.width / 2 / (Math.tan(halfFov) * stage.camera.aspect);
    stage.base = { ...cam, z: Math.max(cam.z, needed) };
    stage.scene.fog.near = stage.base.z + 1.5;
    stage.scene.fog.far = stage.base.z + 12;
    stage.camera.updateProjectionMatrix();
  };
  if (s.panels) {
    const bandH = (h - TOP - BOTTOM - GAP * (s.panels.length - 1)) / s.panels.length;
    s.panels.forEach((panel, i) => fit(panel.stage, PANEL_CAM, { x: 0, y: TOP + i * (bandH + GAP), w, h: bandH, small: true }));
  } else {
    fit(s.stage, s.camera, { x: 0, y: 0, w, h, small: false });
  }
}

/** Shows scene `index`; `whichPart` (1 or 2) picks the closing scene's cast. */
function show(index, whichPart = part) {
  const s = SCENES[index];
  if (!s) return;
  part = whichPart;
  current = index;
  startedAt = performance.now();
  clearOverlay();
  for (const p of PEOPLE) {
    p.root.position.set(-9, 0, 0);
    p.root.rotation.set(0, 0, 0);
    p.root.visible = true;
  }
  const entries = s.panels ?? [s];
  for (const e of entries) {
    resetStage(e.stage);
    e.stage.light(e.sky);
  }
  layout();
  for (const e of entries) {
    if (s.panels) label(e.stage, e.label);
    e.setup();
    if (e.still) dim(e.stage, e.still);
  }
  // Each new scene fades up from dark.
  canvas.style.transition = 'none';
  canvas.style.opacity = '0';
  requestAnimationFrame(() => {
    canvas.style.transition = 'opacity 450ms ease';
    canvas.style.opacity = '1';
  });
}

window.addEventListener('resize', layout);
window.story = { show };

/** Who is speaking on `stage` at time t (the newest bubble showing), or null. */
function speakerOn(stage, t) {
  let who = null;
  let at = -1;
  for (const b of bubbles) if (b.stage === stage && t >= b.at && t < b.until && b.at > at) ((who = b.who), (at = b.at));
  return who;
}

/** Whoever isn't speaking turns their head toward the one who is. */
function listen(stage, t) {
  const speaker = speakerOn(stage, t);
  if (!speaker) return;
  const sx = speaker.isGroup ? speaker.position.x : speaker.root.position.x;
  for (const p of [stage.aarav, stage.mom, stage.satya, stage.riya]) {
    if (!p || p === speaker) continue;
    const dx = sx - p.root.position.x;
    if (Math.abs(dx) > 0.15) p.head.rotation.y += 0.32 * Math.sign(dx) - 0.5 * p.root.rotation.y * 0.3;
  }
}

/**
 * A gentle film camera: it drifts, eases in over the scene, and leans toward
 * whoever is speaking (pushing in a little), smoothly.
 */
function draw(stage, t) {
  const v = stage.view;
  const h = canvas.clientHeight || window.innerHeight;
  const base = stage.base;
  const drift = reduced ? 0 : Math.sin(t * 0.35);
  // Scenes with things floating above the cast keep the camera steady.
  const speaker = reduced || SCENES[current]?.steady ? null : speakerOn(stage, t);
  const sx = speaker ? (speaker.isGroup ? speaker.position.x : speaker.root.position.x) : 0;
  const goal = { x: 0.2 * sx, look: 0.3 * sx, z: speaker ? -0.25 : 0 };
  const cam = (stage.cam = stage.cam ?? { ...goal });
  const follow = reduced ? 1 : 0.035;
  cam.x += (goal.x - cam.x) * follow;
  cam.look += (goal.look - cam.look) * follow;
  cam.z += (goal.z - cam.z) * follow;
  stage.camera.position.set(base.x + cam.x + 0.18 * drift, base.y + 0.04 * drift, base.z + cam.z - (reduced ? 0 : 0.25 * seg(t, 0, 10)));
  stage.camera.lookAt(base.look[0] + cam.look, base.look[1], base.look[2]);
  // WebGL counts y from the bottom of the canvas.
  const y = h - (v.y + v.h);
  renderer.setViewport(v.x, y, v.w, v.h);
  renderer.setScissor(v.x, y, v.w, v.h);
  renderer.render(stage.scene, stage.camera);
}

function frame(now) {
  requestAnimationFrame(frame);
  if (current < 0) return;
  const t = (now - startedAt) / 1000 / SLOW;
  const s = SCENES[current];
  PEOPLE.forEach((p, i) => rest(p, now / 1000 + i * 0.7));
  // Each panel's background sets the clear color; reset it, so the space
  // around the panels stays see-through.
  renderer.setClearColor(0x000000, 0);
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);
  for (const e of s.panels ?? [s]) {
    e.update(t);
    e.stage.dust.rotation.y = t * 0.025;
    e.stage.dust.position.y = 0.08 * Math.sin(t * 0.3);
    listen(e.stage, t);
    draw(e.stage, t);
  }
  placeBubbles(t);
}

show(Number(params.get('scene') || 0), Number(params.get('part') || 1));
// For checking a moment of a scene in a browser: ?scene=2&at=3 starts 3 s in.
if (params.get('at')) startedAt -= Number(params.get('at')) * 1000 * SLOW;
requestAnimationFrame(frame);
post('loaded');
