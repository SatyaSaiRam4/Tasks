/**
 * The guide page: Melo, the glove puppet (MyApp/assets/models/model.glb), with
 * his name in raised champagne-gold lettering on his robe (meloName.js), on a
 * transparent stage for the app's WebView (assets/web/satya/index.html).
 * Built into melo.bundle.js with `npm run build:melo`; don't edit the bundle
 * by hand.
 *
 * Query: ?motion=reduced|full&intro=long|short&gesture=<name>&mode=stroll
 *
 * mode=stroll is Home's "Melo's corner": a wide stage where he lives. He
 * arrives as a ball in his robe red that rolls in and flips open; he pops
 * out, strolls off, turns to you, blushes bright red and runs off screen,
 * peeks back in from the edge (half of him, bent sideways) twice, then comes
 * back to talk; every other time he comes back on stage he arrives the same
 * way. Debug: ?at=N fast-forwards N seconds; ?hold=<phase>&f=0.5 freezes
 * halfway through a phase (ball, open, stroll, notice, blush, flee, peek&n=0|1).
 * Then he stops to wave and talk, wanders, sometimes strolls off one side
 * and comes back from the other, with a soft gold spotlight following him.
 * When he stops to talk the page posts {"type":"stop","x","y"} (his head's
 * position as fractions of the stage) so the app can pin a speech bubble
 * above him, and {"type":"move"} when he walks on. The app can call
 * window.melo.poke() (he blushes and does a shy little happy dance, hearts
 * floating up, then posts {"type":"stop","kind":"shy",...} so the app can
 * show a bashful line), window.melo.setPaused(true|false) and
 * window.melo.setMood(mood), where mood follows the user's day:
 * 'happy' (all done: sparkles, cheers), 'worried' (streak at risk: big
 * pleading eyes), 'sleepy' (late: slow, yawns, dozes with floating z's) or
 * 'calm'. When he comes back on stage he peeks in from the edge first.
 * The app makes Melo move with window.satya.play(name) or now(list) (a comma
 * list plays in order): talk, wave, hop, nod, spin, lookLeft, lookRight,
 * cheer, walk, think, shy, yawn, doze. It hears back 'loaded', 'nowebgl' or 'error'.
 *
 * Melo has no skeleton, so he moves as a whole puppet: an idle sway and
 * breath, and gestures made of turns, tilts, hops and squashes.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { findRobe, robeName } from './meloName.js';
import { createHatSpring, dressMelo } from './meloHat.js';
import { addMouth } from './meloMouth.js';
import { addFace, createFloaters } from './meloFace.js';

const params = new URLSearchParams(location.search);
const reduced = params.get('motion') === 'reduced';
const longIntro = params.get('intro') === 'long';
const stroll = params.get('mode') === 'stroll';
// For checking a later moment in a browser: ?at=6 starts 6 s in (like the story page).
const timeShift = Number(params.get('at') || 0) * 1000;
const D2R = Math.PI / 180;

function post(msg) {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
}

/** Reads a bundled file. fetch() is refused for file:// in the WebView; XHR is allowed. */
function load(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => (xhr.response && xhr.response.byteLength ? resolve(xhr.response) : reject(new Error('empty')));
    xhr.onerror = () => reject(new Error('xhr'));
    xhr.send();
  });
}

// ---- Puppet motion (as before: whole-puppet turns, tilts, hops and squashes) ----------

const DURATION = {
  talk: 1800,
  wave: 1400,
  hop: 900,
  nod: 1000,
  spin: 1400,
  lookLeft: 1300,
  lookRight: 1300,
  cheer: 1700,
  walk: 1500,
  think: 1800,
  shy: 2400,
  yawn: 2000,
  doze: 3200,
};
const MOODS = ['calm', 'happy', 'worried', 'sleepy'];
let mood = 'calm';
const bump = p => Math.sin(Math.PI * Math.min(1, Math.max(0, p)));
const ease = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

function createMotion() {
  let gesture = null;
  let started = null;
  let queue = [];
  // null until the first frame: a gesture started before then begins on that
  // frame, not at time 0 (which would make it look already finished).
  let clock = null;
  function play(name) {
    if (reduced || !DURATION[name]) return;
    if (gesture) {
      queue.push(name);
      return;
    }
    gesture = name;
    started = clock;
  }
  function now(list) {
    queue = [];
    gesture = null;
    String(list || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(play);
  }
  /**
   * Pose at `time`: yaw/pitch/roll in degrees, y lift in % of his height,
   * squash sx/sy, and his face: mouth open, blush, plead (puppy eyes) and
   * lids (eyes closing), each 0..1.
   */
  function pose(time) {
    clock = time;
    // Sleepy Melo sways slower; happy Melo is a touch bouncier.
    const pace = mood === 'sleepy' ? 0.6 : mood === 'happy' ? 1.25 : 1;
    const t = (time / 1000) * pace;
    let yaw = 14 * Math.sin(t * 0.55);
    let pitch = mood === 'worried' ? -5 : mood === 'sleepy' ? 4 : 0; // looks up at you / droops a little
    let roll = 3 * Math.sin(t * 0.9);
    let y = (mood === 'happy' ? 2.5 : 1.5) * Math.sin(t * 1.8);
    let sx = 1;
    let sy = 1 + 0.015 * Math.sin(t * 1.8);
    let airborne = 0;
    let open = 0; // how far his mouth is open
    let blush = mood === 'happy' ? 0.35 : 0;
    let plead = mood === 'worried' ? 1 : 0;
    let lids = mood === 'sleepy' ? 0.35 : 0;
    if (gesture) {
      if (started === null) started = time;
      const p = Math.max(0, (time - started) / DURATION[gesture]);
      if (p >= 1) {
        gesture = null;
        started = null;
        if (queue.length) play(queue.shift());
      } else if (gesture === 'talk') {
        const beat = Math.abs(Math.sin(p * Math.PI * 9));
        // Syllables: the mouth opens and closes unevenly, like real speech.
        open = 0.25 + 0.75 * Math.abs(Math.sin(p * Math.PI * 13) * Math.sin(p * Math.PI * 5 + 0.7)) * (1 - Math.pow(2 * p - 1, 8));
        y -= 3 * beat;
        sy += 0.05 * beat;
        sx -= 0.02 * beat;
        roll += 4 * Math.sin(p * Math.PI * 4);
      } else if (gesture === 'wave') {
        // A cheerful side-to-side rock that bobs on each swing and settles.
        const swing = Math.sin(p * Math.PI * 6) * (1 - p * 0.7);
        roll += 18 * swing;
        yaw += 12 * bump(p);
        y -= 3 * Math.abs(swing);
        sy += 0.03 * Math.abs(swing);
        open = 0.35 * bump(p);
      } else if (gesture === 'hop' || gesture === 'cheer') {
        // Anticipation (crouch), take-off stretch, airtime, squash on landing,
        // then a little springy settle.
        const hp = gesture === 'cheer' ? Math.min(1, p * 1.45) : p;
        const crouch = hp < 0.18 ? bump(hp / 0.18) : 0;
        const airT = (hp - 0.18) / 0.52;
        const air = hp >= 0.18 && hp < 0.7 ? Math.sin(Math.PI * airT) : 0;
        const stretch = hp >= 0.18 && hp < 0.7 ? Math.cos(Math.PI * airT) : 0; // + rising, - falling
        const land = hp >= 0.7 && hp < 0.82 ? bump((hp - 0.7) / 0.12) : 0;
        const settle = hp >= 0.82 ? Math.sin((hp - 0.82) / 0.18 * Math.PI * 2) * (1 - (hp - 0.82) / 0.18) : 0;
        y -= 26 * air;
        y += 3 * crouch + 2 * land;
        sy += -0.14 * crouch + 0.1 * Math.abs(stretch) * air - 0.16 * land + 0.04 * settle;
        sx += 0.1 * crouch - 0.05 * air + 0.12 * land - 0.03 * settle;
        pitch += 6 * crouch - 4 * air;
        airborne = air;
        open = Math.min(1, 0.2 * crouch + air * 1.1 + 0.4 * land);
        if (gesture === 'cheer') yaw += 360 * ease(Math.min(1, Math.max(0, (p - 0.1) / 0.75)));
      } else if (gesture === 'nod') {
        pitch += 14 * Math.sin(p * Math.PI * 4) * (1 - p);
      } else if (gesture === 'spin') {
        // Wind up the other way, then whip round with a little lift.
        const wind = p < 0.2 ? -28 * bump(p / 0.2 / 2) : 0;
        const turn = p < 0.2 ? 0 : 360 * ease((p - 0.2) / 0.8);
        yaw += wind + turn;
        y -= 8 * (p < 0.2 ? 0 : bump((p - 0.2) / 0.8));
        roll += p < 0.2 ? 0 : 6 * Math.sin(((p - 0.2) / 0.8) * Math.PI);
        airborne = p < 0.2 ? 0 : 0.5 * bump((p - 0.2) / 0.8);
        open = p < 0.2 ? 0 : 0.5 * bump((p - 0.2) / 0.8);
      } else if (gesture === 'walk') {
        const step = Math.sin(p * Math.PI * 6);
        roll += 9 * step;
        y -= 5 * Math.abs(step);
        sy += 0.03 * Math.abs(step);
        yaw += 20 * Math.sin(p * Math.PI * 2);
      } else if (gesture === 'think') {
        pitch -= 8 * bump(p);
        roll -= 7 * bump(p);
        yaw += 22 * bump(p);
      } else if (gesture === 'shy') {
        // The bashful happy dance: he turns half away, wiggles side to side
        // with little bounces, cheeks glowing, then peeks back at you.
        const env = bump(p);
        const wiggle = Math.sin(p * Math.PI * 10);
        roll += 13 * wiggle * env;
        yaw += -30 * bump(Math.min(1, p * 1.3)) + 8 * wiggle * env;
        y -= 4 * Math.abs(Math.sin(p * Math.PI * 10)) * env;
        sy += 0.05 * Math.abs(wiggle) * env;
        sx -= 0.02 * Math.abs(wiggle) * env;
        pitch += 7 * env;
        blush = Math.max(blush, Math.min(1, p * 5) * (p > 0.85 ? 1 - (p - 0.85) / 0.15 * 0.4 : 1));
        open = 0.3 * env;
      } else if (gesture === 'yawn') {
        // Stretches up, mouth wide, eyes shut, then sags back.
        const s = bump(p);
        sy += 0.08 * s;
        sx -= 0.03 * s;
        pitch -= 10 * s;
        open = Math.min(1, s * 1.4);
        lids = Math.max(lids, Math.min(1, s * 1.3));
      } else if (gesture === 'doze') {
        // Nods off: head sinks, eyes close, a slow breath; then wakes with a start.
        const sink = p < 0.85 ? Math.min(1, p / 0.25) : 1 - (p - 0.85) / 0.15;
        pitch += 14 * sink;
        roll += 5 * sink;
        y += 2 * sink;
        sy += 0.025 * Math.sin(p * Math.PI * 6) * sink;
        lids = Math.max(lids, sink);
        if (p > 0.85) y -= 6 * bump((p - 0.85) / 0.15); // a little jolt awake
      } else if (gesture === 'lookLeft' || gesture === 'lookRight') {
        yaw += (gesture === 'lookLeft' ? -42 : 42) * bump(p);
        roll += (gesture === 'lookLeft' ? -6 : 6) * bump(p);
      }
    }
    if (reduced) return { yaw: 0, pitch: 0, roll: 0, y: 0, sx: 1, sy: 1, air: 0, open: 0, blush: 0, plead, lids: 0 };
    return { yaw, pitch, roll, y, sx, sy, air: airborne, open, blush, plead, lids };
  }
  return { play, now, pose, busy: () => gesture !== null || queue.length > 0 };
}

// ---- Stage --------------------------------------------------------------------------------

/** A soft glow, for the halo around Melo's golden ball. */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 236, 180, 0.9)');
  grad.addColorStop(0.35, 'rgba(255, 214, 130, 0.45)');
  grad.addColorStop(1, 'rgba(255, 214, 130, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * The ball Melo arrives in, in his own robe red: two halves with a gold
 * seam, a shine, and a warm glow inside that shows when the top flips open.
 */
function makeBall(radius, red) {
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: red, metalness: 0.15, roughness: 0.32, emissive: red, emissiveIntensity: 0.08 });
  const inner = new THREE.MeshBasicMaterial({ color: 0xfff1c8, side: THREE.BackSide, toneMapped: false });
  const seam = new THREE.MeshStandardMaterial({ color: 0xe7c17a, metalness: 0.75, roughness: 0.25 });
  // The roller spins as it rolls; the halves sit inside it.
  const roller = new THREE.Group();
  g.add(roller);
  const half = top => {
    const h = new THREE.Group();
    const geo = new THREE.SphereGeometry(radius, 40, 20, 0, Math.PI * 2, top ? 0 : Math.PI / 2, Math.PI / 2);
    const outside = new THREE.Mesh(geo, shell);
    outside.castShadow = true;
    h.add(outside, new THREE.Mesh(geo, inner));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.005, radius * 0.06, 10, 48).rotateX(Math.PI / 2), seam);
    h.add(ring);
    return h;
  };
  // The top half hinges at the back of the seam, so it flips up and back.
  const hinge = new THREE.Group();
  hinge.position.set(0, 0, -radius);
  const top = half(true);
  top.position.set(0, 0, radius);
  hinge.add(top);
  const bottom = half(false);
  roller.add(hinge, bottom);
  // A white shine, and a gold button on the seam.
  const shine = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.14, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  shine.position.set(-radius * 0.45, radius * 0.6, radius * 0.6);
  top.add(shine);
  const button = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, radius * 0.08, 24).rotateX(Math.PI / 2), seam);
  button.position.set(0, 0, radius * 1.02);
  bottom.add(button);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 }));
  halo.scale.setScalar(radius * 4);
  g.add(halo);
  g.userData = { roller, hinge, halo, shell, radius };
  return g;
}

/** A soft round pool of warm light, for the floor under Melo. */
function spotlightTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(243, 220, 166, 0.55)');
  grad.addColorStop(0.45, 'rgba(212, 175, 106, 0.22)');
  grad.addColorStop(1, 'rgba(212, 175, 106, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function start() {
  const canvas = document.getElementById('stage');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (e) {
    post('nowebgl');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.8;
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(0.6, 2, 1.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 6;
  Object.assign(key.shadow.camera, { left: -0.6, right: 0.6, top: 1, bottom: -0.3 });
  scene.add(key);
  const ground = new THREE.Mesh(
    stroll ? new THREE.PlaneGeometry(8, 3) : new THREE.CircleGeometry(0.6, 48),
    new THREE.ShadowMaterial({ opacity: 0.25 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  if (stroll) {
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 1.2, bottom: -1 });
    key.shadow.mapSize.set(2048, 1024);
  }
  // In Melo's corner a soft gold spotlight follows him across the floor.
  const spot = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 48),
    new THREE.MeshBasicMaterial({ map: spotlightTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  spot.rotation.x = -Math.PI / 2;
  spot.position.y = 0.002;
  spot.visible = stroll;
  scene.add(spot);

  // The puppet hangs from a pivot at his base, so tilts and squashes rock him
  // from the bottom, like a glove puppet.
  const puppet = new THREE.Group();
  // The stroller carries him across the stage and turns him to face where he walks.
  const stroller = new THREE.Group();
  stroller.add(puppet);
  scene.add(stroller);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 20);
  let H = 0.7;

  let W = 0.5;
  let Dp = 0.5;
  /**
   * Places the camera (slightly above, looking down 12°) as close as it can
   * be while every corner of Melo's box, with headroom for his highest hop,
   * stays inside the view, whatever the shape of the WebView.
   */
  function frameCamera() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // His hat at the top of a hop (more room in Melo's corner, where he walks close to the edges).
    const top = H * (stroll ? 1.5 : 1.3);
    const target = new THREE.Vector3(0, top * 0.5, 0);
    const corners = [];
    for (const x of [-W / 2, W / 2]) for (const y of [-0.02, top]) for (const z of [-Dp / 2, Dp / 2]) corners.push(new THREE.Vector3(x, y, z));
    const tilt = 12 * D2R;
    const place = d => {
      camera.position.set(0, target.y + d * Math.sin(tilt), d * Math.cos(tilt));
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
    };
    const fits = d => {
      place(d);
      return corners.every(c => {
        const v = c.clone().project(camera);
        return Math.abs(v.x) <= 0.94 && Math.abs(v.y) <= 0.94;
      });
    };
    let lo = 0.1;
    let hi = 20;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    place(hi);
    // How far left/right the stage reaches at his feet (for strolling).
    const tan = Math.tan((camera.fov / 2) * D2R);
    edgeX = camera.position.distanceTo(target) * tan * camera.aspect;
  }
  let edgeX = 1;
  window.addEventListener('resize', frameCamera);
  frameCamera();

  const motion = createMotion();
  window.satya = { play: motion.play, now: motion.now };
  let paused = false;
  let poked = false;
  // Set by ?hold (checking a pose in a browser): the moment to keep showing.
  let frozenAt = null;
  window.melo = {
    setPaused: v => {
      paused = Boolean(v);
    },
    poke: () => {
      poked = true;
    },
    setMood: m => {
      if (MOODS.includes(m)) mood = m;
    },
  };
  if (MOODS.includes(params.get('mood'))) mood = params.get('mood');

  Promise.all([load('../../models/model.glb'), load('../../fonts/CormorantGaramond-Bold.ttf').catch(() => null)])
    .then(([glb, ttf]) => new Promise((resolve, reject) => new GLTFLoader().parse(glb, '', gltf => resolve([gltf, ttf]), reject)))
    .then(([gltf, ttf]) => {
      const model = gltf.scene;
      // Stand him on the floor, centred.
      const box = new THREE.Box3().setFromObject(model);
      const c = box.getCenter(new THREE.Vector3());
      model.position.set(-c.x, -box.min.y, -c.z);
      H = box.max.y - box.min.y;
      W = box.max.x - box.min.x;
      Dp = box.max.z - box.min.z;
      model.traverse(o => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      puppet.add(model);
      frameCamera();

      // His straw hat (in place of the model's own), with its springy physics.
      const hatSpring = createHatSpring(dressMelo(model));
      // His smile, which opens when he talks and cheers.
      const mouth = addMouth(model);
      // Sparkly eyes and rosy cheeks, and the hearts / sparkles / z's that float up.
      const face = addFace(model);
      const floaters = createFloaters(scene);
      const headAt = () => new THREE.Vector3(stroller.position.x, H * 1.12, stroller.position.z);
      const emit = (kind, n, spacing) => {
        for (let i = 0; i < n; i++) {
          setTimeout(() => {
            const h = headAt();
            floaters.emit(kind, h.x + (Math.random() - 0.5) * W * 0.6, h.y, h.z + 0.05, H * 0.22);
          }, i * spacing);
        }
      };
      // His eyes, for blinking.
      let eyes = null;
      model.traverse(o => {
        if (o.isMesh && /black/i.test(o.material?.name || '')) eyes = o;
      });
      const eyeScale = eyes ? eyes.scale.y : 1;
      let nextBlink = 1600;

      const robe = findRobe(model);
      if (ttf && robe) {
        try {
          const name = robeName(ttf, robe, model);
          // Measured with the puppet at rest, so the name moves with him.
          puppet.add(name);
        } catch (e) {
          // No name if the font can't be read; Melo carries on.
        }
      }

      canvas.style.transitionDuration = reduced ? '0ms' : longIntro ? '1100ms' : '450ms';
      requestAnimationFrame(() => canvas.classList.add('ready'));
      if (!reduced && !stroll) motion.play(params.get('gesture') || (longIntro ? 'wave' : 'nod'));
      const walker = stroll ? createStroll() : null;
      if (stroll && reduced) setTimeout(() => announce(0), 600); // standing still: tip at once

      /** Tells the app where his head is (fractions of the stage) when he stops to talk. */
      function announce(x, kind = 'tip') {
        const head = new THREE.Vector3(x, H * 1.12, 0).project(camera);
        post(JSON.stringify({ type: 'stop', kind, x: (head.x + 1) / 2, y: (1 - head.y) / 2 }));
      }

      /**
       * Melo's corner: a little life of his own. Enter, stop and talk (the
       * app shows his tip), wander, try a move, now and then stroll off one
       * side and come back from the other.
       */
      function createStroll() {
        const speed = () => H * (mood === 'sleepy' ? 0.32 : mood === 'happy' ? 0.65 : 0.55); // per second
        // What he does when he stops, by mood.
        const STOP_MOVES = {
          calm: ['nod', 'lookLeft,lookRight', 'think', 'hop', 'spin', 'wave', 'cheer'],
          happy: ['cheer', 'hop,hop', 'spin', 'wave', 'shy', 'cheer'],
          worried: ['lookLeft,lookRight', 'think', 'nod', 'wave'],
          sleepy: ['yawn', 'doze', 'doze', 'nod', 'yawn'],
        };
        const pick = list => list[Math.floor(Math.random() * list.length)];
        // A little extra on each move: sparkles when proud, z's when sleepy.
        const flourish = moves => {
          if (mood === 'happy' && /cheer|hop|spin/.test(moves)) setTimeout(() => emit('sparkle', 4, 160), 350);
          if (/doze/.test(moves)) setTimeout(() => emit('z', 3, 700), 600);
          if (/shy/.test(moves)) setTimeout(() => emit('heart', 3, 260), 300);
        };
        // Each walk is a segment from x0 to x1 starting at t0: his position comes
        // from the clock, so frame drops never slow him down.
        const st = { x: edgeX + W, x0: edgeX + W, x1: edgeX * 0.35, t0: null, phase: 'ball', stops: 0, wait: 0, face: 0, last: null, z: 0, pop: 1, blush: 0, plead: 0, tremble: 0, returns: 0 };
        stroller.position.x = st.x;

        // ---- The entrance: a ball in his own red rolls in and opens, Melo pops
        // out and strolls off casually; he turns, notices you watching, goes
        // bright red and runs off the screen; then, like Chopper, he leans
        // back in from the edge with half of him showing to check whether
        // you're still looking, twice, and finally comes back to say his tip.
        const ballR = H * 0.2;
        const ball = makeBall(ballR, robe?.material?.color ? robe.material.color.clone() : new THREE.Color(0xb8405a));
        ball.visible = false;
        scene.add(ball);
        const flash = new THREE.PointLight(0xffe2a8, 0, H * 6, 1.6);
        scene.add(flash);
        /** World x that appears at screen position `ndc` (-1 left edge, 1 right edge) at depth z. */
        const xAtScreen = (ndc, z = 0) => {
          const a = new THREE.Vector3(0, H * 0.5, z).project(camera).x;
          const b = new THREE.Vector3(1, H * 0.5, z).project(camera).x;
          return (ndc - a) / (b - a);
        };
        const T = { roll: 1700, open: 1100, stroll: 2300, notice: 700, blush: 1000, flee: 650, gone: 1300, peek: 2300, back: 0 };
        const setPhase = (time, phase) => {
          st.phase = phase;
          st.t0 = time;
        };
        const startBall = time => {
          st.side = Math.random() < 0.5 ? -1 : 1;
          setPhase(time, 'ball');
          st.pop = 0;
          st.blush = 0;
          st.plead = 0;
          st.tremble = 0;
          st.lean = 0;
          st.x = 0;
          st.peeks = 0;
          ball.visible = true;
          ball.scale.setScalar(1);
          ball.userData.hinge.rotation.x = 0;
          ball.userData.halo.material.opacity = 0;
          stroller.visible = false;
          post(JSON.stringify({ type: 'move' }));
        };
        // ?hold=<phase> (for checking a pose in a browser): freeze halfway through that phase.
        const hold = params.get('hold');
        /** The entrance, phase by phase. Returns true while it's running. */
        function entrance(time) {
          const k = time - st.t0;
          if (hold && st.phase === hold && k > (T[hold] || 0) * (Number(params.get('f')) || 0.5) && (hold !== 'peek' || st.peeks === Number(params.get('n') || 0))) frozenAt = time;
          const run = (from, to, f) => from + (to - from) * f;
          if (st.phase === 'ball') {
            // Rolls in from the side, bouncing less and less.
            const f = Math.min(1, k / T.roll);
            const bx = xAtScreen(st.side * 1.2) * (1 - ease(f));
            const bounce = Math.abs(Math.sin(f * Math.PI * 3)) * (1 - f) * H * 0.3;
            ball.position.set(bx, ballR + bounce, 0);
            ball.userData.roller.rotation.z = bx / ballR;
            const squash = bounce < H * 0.015 && f < 0.95 ? 0.1 : 0;
            ball.userData.roller.scale.set(1 + squash, 1 - squash, 1 + squash);
            spot.position.x = bx;
            if (f >= 1) setPhase(time, 'open');
            return true;
          }
          if (st.phase === 'open') {
            // A wiggle, then the top flips open with a warm light, and out he pops.
            const roller = ball.userData.roller;
            roller.rotation.z += (0 - roller.rotation.z) * 0.2;
            const wiggle = k < 450 ? Math.sin(k * 0.05) * bump(k / 450) : 0;
            roller.rotation.y = 0.25 * wiggle;
            roller.scale.set(1 + 0.06 * wiggle, 1 - 0.06 * Math.abs(wiggle), 1 + 0.06 * wiggle);
            const o = ease(Math.min(1, Math.max(0, (k - 450) / 300)));
            ball.userData.hinge.rotation.x = -2.1 * o;
            ball.userData.halo.material.opacity = 0.9 * o * (1 - Math.max(0, (k - 800) / 300));
            flash.position.set(0, H * 0.6, H * 0.8);
            flash.intensity = 7 * bump(Math.max(0, (k - 450) / 500));
            if (k > 450 && !st.opened) {
              st.opened = true;
              stroller.visible = true;
              emit('sparkle', 6, 50);
              for (let i = 0; i < 5; i++) floaters.emit('puff', (i - 2) * ballR * 0.5, ballR * 1.2, 0.1, H * 0.25);
              motion.now('hop');
            }
            // He springs up out of it with an overshoot.
            const g = Math.max(0, (k - 450) / 550);
            st.pop = g <= 0 ? 0 : g < 0.6 ? ease(g / 0.6) * 1.15 : 1.15 - 0.15 * Math.min(1, (g - 0.6) / 0.4);
            // The empty ball shrinks away.
            ball.scale.setScalar(Math.max(0.001, 1 - Math.max(0, (k - 800) / 300)));
            if (k > T.open) {
              st.opened = false;
              st.pop = 1;
              ball.visible = false;
              flash.intensity = 0;
              // Off for a casual stroll to one side.
              st.walkSide = Math.random() < 0.5 ? -1 : 1;
              st.x0 = st.x;
              st.x1 = xAtScreen(st.walkSide * 0.5);
              setPhase(time, 'stroll');
            }
            return true;
          }
          if (st.phase === 'stroll') {
            // Hands behind his back, la-la-la... (a slow, easy walk).
            const f = Math.min(1, k / T.stroll);
            st.x = run(st.x0, st.x1, f);
            st.face = st.walkSide * 0.95;
            if (!motion.busy()) motion.play('walk');
            if (f >= 0.7) setPhase(time, 'notice');
            return true;
          }
          if (st.phase === 'notice') {
            // ...he turns his face to you. Oh! Someone's watching.
            st.face = st.walkSide * 0.95 * (1 - ease(Math.min(1, k / 350)));
            st.plead = Math.min(1, k / 300);
            if (k > 120 && !st.noticed) {
              st.noticed = true;
              motion.now('');
            }
            if (k > T.notice) {
              st.noticed = false;
              setPhase(time, 'blush');
              st.wiggleUntil = time + T.blush;
            }
            return true;
          }
          if (st.phase === 'blush') {
            // Goes bright red, steam puffing off his head, a tiny shy wiggle.
            st.face = 0;
            st.blush = Math.min(2, (k / 400) * 2);
            if (k > 250 && !st.steamed) {
              st.steamed = true;
              steam(3);
              emit('heart', 2, 180);
            }
            if (k > T.blush) {
              st.steamed = false;
              st.x0 = st.x;
              st.x1 = xAtScreen(st.walkSide * 1.35);
              setPhase(time, 'flee');
              motion.now('');
            }
            return true;
          }
          if (st.phase === 'flee') {
            // And runs off the screen, fast.
            const f = Math.min(1, k / T.flee);
            st.x = run(st.x0, st.x1, f * f);
            st.face = st.walkSide * 1.1;
            if (!motion.busy()) motion.play('walk');
            st.tremble = 0.4;
            if (f >= 1) {
              st.tremble = 0;
              setPhase(time, 'gone');
            }
            return true;
          }
          if (st.phase === 'gone') {
            if (k > T.gone) setPhase(time, 'peek');
            return true;
          }
          if (st.phase === 'peek') {
            // Chopper-style: he leans back in from the edge, half of him
            // showing, bent sideways, eyes on you... then ducks back out.
            const f = Math.min(1, k / T.peek);
            const lean = f < 0.2 ? ease(f / 0.2) : f < 0.78 ? 1 : 1 - ease((f - 0.78) / 0.22);
            const depth = st.peeks === 0 ? 0.93 : 0.88; // the second time, a little braver
            st.x = run(xAtScreen(st.walkSide * 1.35), xAtScreen(st.walkSide * depth), lean);
            st.lean = -st.walkSide * lean;
            st.face = -st.walkSide * 0.35 * lean;
            st.blush = 1.4;
            st.plead = 1;
            st.tremble = 0.35 * lean;
            if (f >= 1) {
              st.peeks += 1;
              setPhase(time, st.peeks >= 2 ? 'back' : 'gone');
              if (st.peeks < 2) st.t0 = time - T.gone + 700; // a shorter wait before the second peek
            }
            return true;
          }
          if (st.phase === 'back') {
            // Coast's clear: he comes back in to tell you his tip.
            st.lean = 0;
            st.tremble = 0;
            st.plead = 0;
            st.blush = 0.4;
            st.x = xAtScreen(st.walkSide * 1.2);
            st.stops = 0;
            walkTo(time, xAtScreen(st.walkSide * 0.25));
            return false;
          }
          return false;
        }
        /** Little puffs of steam off his head: embarrassed! */
        function steam(n) {
          for (let i = 0; i < n; i++) {
            setTimeout(() => {
              const h = headAt();
              floaters.emit('puff', h.x + (i % 2 ? 1 : -1) * W * 0.32, h.y + H * 0.05, h.z + 0.05, H * 0.16);
            }, i * 160);
          }
        }
        const walkTo = (time, target) => {
          st.x0 = st.x;
          st.x1 = target;
          st.t0 = time;
          st.phase = 'walk';
        };
        const pickTarget = () => {
          const reach = Math.max(0.2, edgeX - W * 0.9);
          let t = (Math.random() * 2 - 1) * reach;
          if (Math.abs(t - st.x) < reach * 0.4) t = -Math.sign(st.x || 1) * reach * (0.4 + Math.random() * 0.5);
          return t;
        };
        const update = function update(time) {
          const dt = st.last === null ? 0 : Math.min(0.25, (time - st.last) / 1000);
          st.last = time;
          if (st.t0 === null) startBall(time); // the entrance starts as the page opens
          if (poked && st.phase === 'peek') {
            // Found him! He gives up and comes back, all shy.
            poked = false;
            st.peeks = 2;
            st.t0 = time - T.peek;
          }
          // After a tap he stays bright red for a while, then calms down.
          if (st.flushUntil && time > st.flushUntil) {
            st.flushUntil = 0;
            st.blush = 0;
          }
          if (entrance(time)) {
            poked = false;
            stroller.rotation.y += (st.face - stroller.rotation.y) * Math.min(1, dt * 6);
            stroller.position.x = st.x;
            stroller.position.z = st.z;
            spot.position.x = st.x;
            spot.position.z = st.z;
            spot.visible = st.phase !== 'gone' && st.phase !== 'peek' && st.phase !== 'flee';
            return;
          }
          // Out of the entrance, any leftover blush fades (unless he was just tapped).
          if (!st.flushUntil) st.blush = Math.max(0, st.blush - dt * 0.6);
          if (poked) {
            poked = false;
            if (st.phase !== 'away') {
              // "Tapping me won't make me happy!" (he's very happy): the shy dance.
              st.phase = 'stop';
              st.wait = time + 4200;
              st.face = 0;
              // Facing you, bright red to the ears, a shy wiggle, steam puffing, red hearts.
              motion.now('hop');
              st.face = 0;
              st.wiggleUntil = time + 2600;
              st.blush = 2;
              st.flushUntil = time + 4200;
              steam(4);
              emit('heart', 5, 220);
              post(JSON.stringify({ type: 'move' }));
              setTimeout(() => announce(st.x, 'shy'), 500);
            }
          }
          if (st.phase === 'walk') {
            const dir = Math.sign(st.x1 - st.x0);
            const length = Math.abs(st.x1 - st.x0) / speed();
            const f = length > 0 ? Math.min(1, (time - st.t0) / 1000 / length) : 1;
            st.x = st.x0 + (st.x1 - st.x0) * f;
            if (!motion.busy()) motion.play('walk');
            st.face = dir * 0.95;
            if (f >= 1) {
              st.stops += 1;
              if (Math.abs(st.x1) > edgeX) {
                // Walked off the stage: come back from the other side in a while.
                st.phase = 'away';
                st.wait = time + 3000 + Math.random() * 3000;
              } else {
                st.phase = 'stop';
                const talk = st.stops === 1 || st.stops % 3 === 0;
                const moves = talk ? (mood === 'happy' ? 'cheer,talk,talk' : mood === 'sleepy' ? 'yawn,talk' : 'wave,talk,talk') : pick(STOP_MOVES[mood]);
                motion.now(moves);
                flourish(moves);
                if (talk) announce(st.x);
                st.wait = time + (talk ? 6500 : /doze/.test(moves) ? 3600 : 2600) + Math.random() * 1500;
              }
            }
          } else if (st.phase === 'stop') {
            st.face = 0;
            if (time > st.wait && !motion.busy()) {
              post(JSON.stringify({ type: 'move' }));
              // Every few stops he strolls off one side; otherwise he wanders.
              walkTo(time, st.stops % 4 === 0 ? Math.sign(st.x || 1) * (edgeX + W) : pickTarget());
            }
          } else if (st.phase === 'away' && time > st.wait && st.returns++ % 2 === 0) {
            // Every other time he comes back as the golden ball.
            startBall(time);
          } else if (st.phase === 'away' && time > st.wait) {
            // Back from the other side: first he peeks in from the edge...
            const side = -Math.sign(st.x || 1);
            st.x = side * (edgeX + W);
            st.x0 = st.x;
            st.x1 = side * (edgeX + W * 0.05);
            st.t0 = time;
            st.side = side;
            st.phase = 'peek';
          } else if (st.phase === 'peek') {
            // ...leans in (half of him showing), looks at you, tilts his head...
            const f = Math.min(1, (time - st.t0) / 700);
            st.x = st.x0 + (st.x1 - st.x0) * ease(f);
            st.face = -st.side * 0.5;
            if (f >= 1 && !st.peeked) {
              st.peeked = true;
              motion.now(st.side > 0 ? 'lookLeft,think' : 'lookRight,think');
            }
            // ...then hops in with a happy little skip.
            if (st.peeked && !motion.busy()) {
              st.peeked = false;
              motion.now('hop');
              walkTo(time, -st.side * edgeX * (0.2 + Math.random() * 0.4));
            }
          }
          // Turn smoothly toward where he is going (or back to face you).
          stroller.rotation.y += (st.face - stroller.rotation.y) * Math.min(1, dt * 6);
          stroller.position.x = st.x;
          stroller.position.z = 0;
          spot.position.x = st.x;
          spot.position.z = 0;
          spot.visible = st.phase !== 'away' && st.phase !== 'peek';
        };
        update.state = st;
        return update;
      }

      // ?at=N (for checking a moment in a browser): play the first N seconds
      // in fast-forward on the first frame, so every phase really happens.
      let forwarded = timeShift <= 0;
      const tick = frameTime => {
        requestAnimationFrame(tick);
        if (paused) return;
        if (!forwarded) {
          forwarded = true;
          for (let t = frameTime; t < frameTime + timeShift && frozenAt === null; t += 16) {
            if (walker && !reduced) walker(t);
            motion.pose(t);
            floaters.update(t);
          }
        }
        const time = frozenAt !== null ? frozenAt : frameTime + timeShift;
        if (walker && !reduced && frozenAt === null) walker(time);
        const p = motion.pose(time);
        // The entrance adds a pop-in scale, a nervous tremble, blush and big eyes.
        const ex = walker && walker.state ? walker.state : null;
        const pop = ex ? ex.pop : 1;
        if (ex) {
          p.roll += ex.tremble * 3.5 * Math.sin(time * 0.07);
          // A shy wiggle, facing you (so you can see him blush).
          if (ex.wiggleUntil && time < ex.wiggleUntil) {
            const w = Math.min(1, (ex.wiggleUntil - time) / 400);
            p.roll += 9 * Math.sin(time * 0.022) * w;
            p.y -= 2 * Math.abs(Math.sin(time * 0.022)) * w;
            p.yaw *= 0.3;
          }
          // Peeking in from the edge: bent sideways at the waist, Chopper-style.
          p.roll += 24 * (ex.lean || 0);
          p.pitch += 4 * Math.abs(ex.lean || 0);
          p.blush = Math.max(p.blush, ex.blush);
          p.plead = Math.max(p.plead, ex.plead);
        }
        // (The old page turned the camera by -yaw; turning him by +yaw looks the same.)
        puppet.rotation.set(p.pitch * 0.6 * D2R, p.yaw * D2R, -p.roll * D2R, 'YXZ');
        puppet.position.y = (-p.y / 100) * H * 1.12; // the moves were tuned with this scale
        puppet.scale.set(p.sx * pop, p.sy * pop, p.sx * pop);
        if (!reduced) {
          hatSpring(time, { roll: p.roll, yaw: p.yaw, lift: -p.y, air: p.air });
          mouth?.setOpen(p.open);
          face?.set({ blush: p.blush, plead: p.plead });
          floaters.update(time);
          // A quick blink every few seconds (sometimes a double blink).
          if (eyes) {
            if (time > nextBlink + 140) nextBlink = time + (Math.random() < 0.2 ? 220 : 2400 + Math.random() * 3000);
            const b = time > nextBlink ? Math.sin(Math.PI * Math.min(1, (time - nextBlink) / 140)) : 0;
            eyes.scale.y = eyeScale * (1 - 0.9 * Math.max(b, p.lids));
          }
        }
        renderer.render(scene, camera);
      };
      requestAnimationFrame(tick);
      post('loaded');
    })
    .catch(() => post('error'));
}

start();
