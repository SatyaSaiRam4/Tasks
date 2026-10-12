/**
 * The guide page: Melo, the glove puppet (MyApp/assets/models/model.glb), with
 * his name in raised champagne-gold lettering on his robe (meloName.js), on a
 * transparent stage for the app's WebView (assets/web/satya/index.html).
 * Built into melo.bundle.js with `npm run build:melo`; don't edit the bundle
 * by hand.
 *
 * Query: ?motion=reduced|full&intro=long|short&gesture=<name>
 * The app makes Melo move with window.satya.play(name) or now(list) (a comma
 * list plays in order): talk, wave, hop, nod, spin, lookLeft, lookRight,
 * cheer, walk, think. It hears back 'loaded', 'nowebgl' or 'error'.
 *
 * Melo has no skeleton, so he moves as a whole puppet: an idle sway and
 * breath, and gestures made of turns, tilts, hops and squashes.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { findRobe, robeName } from './meloName.js';

const params = new URLSearchParams(location.search);
const reduced = params.get('motion') === 'reduced';
const longIntro = params.get('intro') === 'long';
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

const DURATION = { talk: 1800, wave: 1400, hop: 900, nod: 1000, spin: 1400, lookLeft: 1300, lookRight: 1300, cheer: 1700, walk: 1500, think: 1800 };
const bump = p => Math.sin(Math.PI * Math.min(1, Math.max(0, p)));
const ease = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

function createMotion() {
  let gesture = null;
  let started = null;
  let queue = [];
  let clock = 0;
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
  /** Pose at `time`: yaw/pitch/roll in degrees, y lift in % of his height, squash sx/sy. */
  function pose(time) {
    clock = time;
    const t = time / 1000;
    let yaw = 14 * Math.sin(t * 0.55);
    let pitch = 0;
    let roll = 3 * Math.sin(t * 0.9);
    let y = 1.5 * Math.sin(t * 1.8);
    let sx = 1;
    let sy = 1 + 0.015 * Math.sin(t * 1.8);
    if (gesture) {
      if (started === null) started = time;
      const p = Math.max(0, (time - started) / DURATION[gesture]);
      if (p >= 1) {
        gesture = null;
        started = null;
        if (queue.length) play(queue.shift());
      } else if (gesture === 'talk') {
        const beat = Math.abs(Math.sin(p * Math.PI * 9));
        y -= 3 * beat;
        sy += 0.05 * beat;
        sx -= 0.02 * beat;
        roll += 4 * Math.sin(p * Math.PI * 4);
      } else if (gesture === 'wave') {
        roll += 18 * Math.sin(p * Math.PI * 6) * (1 - p);
        yaw += 10 * bump(p);
      } else if (gesture === 'hop' || gesture === 'cheer') {
        const hp = gesture === 'cheer' ? Math.min(1, p * 1.6) : p;
        const air = hp > 0.15 && hp < 0.85 ? bump((hp - 0.15) / 0.7) : 0;
        const land = hp <= 0.15 ? bump(hp / 0.15) : hp >= 0.85 ? bump((hp - 0.85) / 0.15) : 0;
        y -= 22 * air;
        sy += 0.1 * air - 0.12 * land;
        sx += 0.08 * land - 0.04 * air;
        if (gesture === 'cheer') yaw += 360 * ease(p);
      } else if (gesture === 'nod') {
        pitch += 14 * Math.sin(p * Math.PI * 4) * (1 - p);
      } else if (gesture === 'spin') {
        yaw += 360 * ease(p);
        y -= 6 * bump(p);
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
      } else if (gesture === 'lookLeft' || gesture === 'lookRight') {
        yaw += (gesture === 'lookLeft' ? -42 : 42) * bump(p);
        roll += (gesture === 'lookLeft' ? -6 : 6) * bump(p);
      }
    }
    if (reduced) return { yaw: 0, pitch: 0, roll: 0, y: 0, sx: 1, sy: 1 };
    return { yaw, pitch, roll, y, sx, sy };
  }
  return { play, now, pose };
}

// ---- Stage --------------------------------------------------------------------------------

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
  const ground = new THREE.Mesh(new THREE.CircleGeometry(0.6, 48), new THREE.ShadowMaterial({ opacity: 0.25 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // The puppet hangs from a pivot at his base, so tilts and squashes rock him
  // from the bottom, like a glove puppet.
  const puppet = new THREE.Group();
  scene.add(puppet);
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
    const top = H * 1.3; // his hat at the top of a hop
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
  }
  window.addEventListener('resize', frameCamera);
  frameCamera();

  const motion = createMotion();
  window.satya = { play: motion.play, now: motion.now };

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
      if (!reduced) motion.play(params.get('gesture') || (longIntro ? 'wave' : 'nod'));

      const tick = time => {
        const p = motion.pose(time);
        // (The old page turned the camera by -yaw; turning him by +yaw looks the same.)
        puppet.rotation.set(p.pitch * 0.6 * D2R, p.yaw * D2R, -p.roll * D2R, 'YXZ');
        puppet.position.y = (-p.y / 100) * H * 1.12; // the moves were tuned with this scale
        puppet.scale.set(p.sx, p.sy, p.sx);
        renderer.render(scene, camera);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      post('loaded');
    })
    .catch(() => post('error'));
}

start();
