/**
 * Melo's straw hat: a woven straw hat with a rounded crown, a wide brim and
 * a red band (the classic adventurer's straw hat). It replaces the model's
 * own hat, and has a little springy physics of its own: a gentle lag as Melo
 * turns, rocks and hops, and a small lift at the top of a jump.
 *
 * Shared by the guide page (web/satya/melo.js) and the welcome story
 * (web/story/story.js).
 */
import * as THREE from 'three';

/** Straw: warm golden weave, rings running around the hat with a fine cross-weave. */
function strawTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#dcae4e';
  g.fillRect(0, 0, 512, 256);
  // Rings of plaited straw (rows of the lathe's v), each a slightly different tone.
  for (let y = 0; y < 256; y += 6) {
    g.fillStyle = `rgba(${150 + Math.random() * 40}, ${108 + Math.random() * 30}, ${40 + Math.random() * 20}, 0.32)`;
    g.fillRect(0, y, 512, 2);
    g.fillStyle = 'rgba(255, 238, 170, 0.35)';
    g.fillRect(0, y + 3, 512, 1);
  }
  // The cross-weave: short slanted stitches.
  g.strokeStyle = 'rgba(140, 98, 34, 0.28)';
  g.lineWidth = 1;
  for (let y = 0; y < 256; y += 6) {
    for (let x = (y / 6) % 2 ? 0 : 4; x < 512; x += 8) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 4, y + 5);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  t.anisotropy = 8;
  return t;
}

/** The hat itself, sized for Melo's head; its origin is where it sits on his head. */
export function createStrawHat() {
  const weave = strawTexture();
  const straw = new THREE.MeshPhysicalMaterial({
    map: weave,
    // Straw lets a little light through: a faint glow of its own weave keeps
    // the underside of the brim reading as straw, not a black disc.
    emissiveMap: weave,
    emissive: new THREE.Color(0x5a4420),
    roughness: 0.78,
    sheen: 0.6,
    sheenColor: new THREE.Color(0xfff0b8),
    sheenRoughness: 0.5,
    side: THREE.DoubleSide,
  });
  // One profile spun round: the brim's edge lifts a touch, then a soft dome.
  const profile = [
    [0.19, 0.016],
    [0.18, 0.008],
    [0.15, 0.002],
    [0.11, 0.0],
    [0.084, 0.003],
    [0.083, 0.035],
    [0.081, 0.065],
    [0.074, 0.088],
    [0.058, 0.104],
    [0.032, 0.113],
    [0.0, 0.116],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const hat = new THREE.Group();
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 72), straw);
  body.castShadow = true;
  body.receiveShadow = true;
  hat.add(body);
  // The red band around the crown.
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0845, 0.0855, 0.026, 64, 1, true),
    new THREE.MeshPhysicalMaterial({ color: 0xc8102e, roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color(0xff6b6b), side: THREE.DoubleSide }),
  );
  band.position.y = 0.017;
  hat.add(band);
  return hat;
}

/**
 * Swaps the model's own hat (its "oak" piece) for the straw hat. Returns the
 * hat's pivot, or null if the model has no hat piece.
 */
export function dressMelo(model) {
  let old = null;
  model.traverse(o => {
    if (o.isMesh && o.material && /oak/i.test(o.material.name || '')) old = o;
  });
  if (!old) return null;
  old.visible = false;
  // The old hat's local size, in its parent's units.
  old.geometry.computeBoundingBox();
  const box = old.geometry.boundingBox.clone().applyMatrix4(old.matrix);
  const pivot = new THREE.Group();
  pivot.position.set((box.min.x + box.max.x) / 2, box.min.y + 0.004, (box.min.z + box.max.z) / 2);
  // Tilted back a little, brim up at the front: jaunty.
  const hat = createStrawHat();
  hat.rotation.x = -0.12;
  pivot.add(hat);
  pivot.userData.baseY = pivot.position.y;
  old.parent.add(pivot);
  return pivot;
}

/**
 * A damped spring that makes the hat follow Melo with a little lag. Feed it
 * how he is moving each frame; it tilts and lifts the hat's pivot.
 */
export function createHatSpring(pivot) {
  const s = { tx: 0, tz: 0, vx: 0, vz: 0, lift: 0, vl: 0, last: null, prev: null };
  return function update(time, { roll = 0, yaw = 0, lift = 0, air = 0 } = {}) {
    const dt = s.last === null ? 0 : Math.min(0.05, (time - s.last) / 1000);
    s.last = time;
    if (!pivot || dt === 0) return;
    // How fast he is rocking, turning and rising: the hat lags against it.
    const p = s.prev || { roll, yaw, lift };
    const dRoll = (roll - p.roll) / dt;
    const dYaw = (yaw - p.yaw) / dt;
    const dLift = (lift - p.lift) / dt;
    s.prev = { roll, yaw, lift };
    // Stiff and well damped: a gentle lag that settles quickly, never a flop.
    const k = 220; // stiffness
    const c = 24; // damping
    const targetZ = -0.0005 * dRoll + 0.0002 * dYaw;
    const targetX = -0.0015 * dLift;
    s.vz += (k * (targetZ - s.tz) - c * s.vz) * dt;
    s.vx += (k * (targetX - s.tx) - c * s.vx) * dt;
    s.tz += s.vz * dt;
    s.tx += s.vx * dt;
    // At the top of a jump the hat lifts just off his head, then settles back.
    const targetLift = 0.01 * air;
    s.vl += (160 * (targetLift - s.lift) - 11 * s.vl) * dt;
    s.lift += s.vl * dt;
    const MAX_TILT = 0.12; // about 7 degrees
    pivot.rotation.set(THREE.MathUtils.clamp(s.tx, -MAX_TILT, MAX_TILT), 0, THREE.MathUtils.clamp(s.tz, -MAX_TILT, MAX_TILT));
    pivot.position.y = pivot.userData.baseY + Math.max(-0.002, s.lift);
  };
}
