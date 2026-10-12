/**
 * The cute bits of Melo's face: a sparkle of light in each eye (bigger when
 * he pleads, puppy-eyed) and soft rosy cheeks that glow when he's shy or
 * happy. Placed on his face by measuring where it is, like his mouth.
 *
 * Used by the guide page (web/satya/melo.js).
 */
import * as THREE from 'three';

/** A soft round blush: pink in the middle, fading to nothing. */
function blushTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 120, 140, 0.95)');
  grad.addColorStop(0.5, 'rgba(255, 130, 150, 0.5)');
  grad.addColorStop(1, 'rgba(255, 140, 160, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Anime blush lines: three short diagonal strokes, for when he's bright red. */
function blushLinesTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 80;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(220, 70, 95, 0.9)';
  g.lineWidth = 7;
  g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const x = 30 + i * 30;
    g.beginPath();
    g.moveTo(x + 10, 18);
    g.lineTo(x - 8, 62);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The centre of each eye (world space), from the eye mesh's vertices left and right of its middle. */
function eyeCentres(eyes) {
  const pos = eyes.geometry.attributes.position;
  const v = new THREE.Vector3();
  const box = new THREE.Box3().setFromObject(eyes);
  const mid = (box.min.x + box.max.x) / 2;
  const sides = [new THREE.Box3(), new THREE.Box3()];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(eyes.matrixWorld);
    sides[v.x < mid ? 0 : 1].expandByPoint(v);
  }
  return sides.filter(b => !b.isEmpty());
}

/** Puts `obj` on the surface of `mesh` straight ahead of (x, y), facing out, and hangs it on `parent`. */
function stick(obj, mesh, x, y, z, lift, parent) {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, y, z + 1), new THREE.Vector3(0, 0, -1));
  const hit = ray.intersectObject(mesh, false)[0];
  if (!hit) return false;
  const normal = hit.face ? hit.face.normal.clone().transformDirection(mesh.matrixWorld) : new THREE.Vector3(0, 0, 1);
  obj.position.copy(hit.point).addScaledVector(normal, lift);
  obj.lookAt(obj.position.clone().add(normal));
  parent.attach(obj);
  return true;
}

/**
 * Adds the sparkles and cheeks. Returns { set({ blush, plead }) } (both 0..1),
 * or null if his eyes or face can't be found.
 */
export function addFace(model) {
  let eyes = null;
  let face = null;
  model.traverse(o => {
    if (!o.isMesh) return;
    const name = o.material?.name || '';
    if (/black/i.test(name)) eyes = o;
    if (/cream/i.test(name)) face = o;
  });
  if (!eyes || !face) return null;
  model.updateMatrixWorld(true);
  const centres = eyeCentres(eyes);
  if (!centres.length) return null;

  // Sparkles: a big catchlight up and to one side, and a tiny one opposite.
  // They hang on the eyes, so they blink with them.
  const shine = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const sparkles = [];
  for (const b of centres) {
    const size = b.max.x - b.min.x;
    const c = b.getCenter(new THREE.Vector3());
    const big = new THREE.Mesh(new THREE.CircleGeometry(size * 0.2, 20), shine);
    const small = new THREE.Mesh(new THREE.CircleGeometry(size * 0.09, 14), shine);
    if (stick(big, eyes, c.x - size * 0.16, c.y + size * 0.2, b.max.z, size * 0.03, eyes)) sparkles.push(big);
    if (stick(small, eyes, c.x + size * 0.18, c.y - size * 0.2, b.max.z, size * 0.03, eyes)) sparkles.push(small);
  }
  sparkles.forEach(s => (s.userData.base = s.scale.x));

  // Cheeks: below and outside each eye, on the face.
  const span = centres.length > 1 ? centres[1].getCenter(new THREE.Vector3()).x - centres[0].getCenter(new THREE.Vector3()).x : 0.05;
  const rosy = new THREE.MeshBasicMaterial({ map: blushTexture(), transparent: true, depthWrite: false, opacity: 0.36, toneMapped: false });
  const cheeks = [];
  const lines = new THREE.MeshBasicMaterial({ map: blushLinesTexture(), transparent: true, depthWrite: false, opacity: 0, toneMapped: false });
  const deep = new THREE.Color(0xff4d6a);
  const soft = new THREE.Color(0xffffff);
  for (const b of centres) {
    const c = b.getCenter(new THREE.Vector3());
    const out = Math.sign(c.x - (centres[0].getCenter(new THREE.Vector3()).x + span / 2)) || 1;
    const cheek = new THREE.Mesh(new THREE.PlaneGeometry(span * 0.62, span * 0.4), rosy);
    if (stick(cheek, face, c.x + out * span * 0.22, b.min.y - span * 0.18, b.max.z, span * 0.03, face.parent)) {
      cheek.renderOrder = 2;
      cheek.userData.base = cheek.scale.x;
      // The blush lines sit on top of the cheek.
      const stroke = new THREE.Mesh(new THREE.PlaneGeometry(span * 0.5, span * 0.32), lines);
      stroke.position.z = span * 0.01;
      stroke.renderOrder = 3;
      cheek.add(stroke);
      cheeks.push(cheek);
    }
  }

  return {
    /**
     * blush: 0 a hint of rose, 1 pink, 2 really shy (a little rosier, faint
     * anime blush lines). plead: 0 normal, 1 big shiny puppy eyes.
     */
    set({ blush = 0, plead = 0 } = {}) {
      const b = Math.max(0, Math.min(2, blush));
      const red = Math.max(0, b - 1);
      rosy.opacity = 0.32 + 0.4 * Math.min(1, b) + 0.08 * red;
      rosy.color.copy(soft).lerp(deep, red * 0.35);
      lines.opacity = red * 0.55;
      cheeks.forEach(c => c.scale.set(c.userData.base * (1 + 0.25 * red), c.userData.base * (1 + 0.15 * red), 1));
      const grow = 1 + 0.9 * Math.max(0, Math.min(1, plead));
      sparkles.forEach(s => s.scale.setScalar(s.userData.base * grow));
    },
  };
}

/**
 * Little things around Melo: red hearts, sparkles, a sleepy "z", puffs
 * (steam, the ball opening), a burst of stars, dust kicks and a sweat drop.
 * Coloured with darker edges so they read on light and dark backgrounds.
 */
export function createFloaters(scene) {
  const draw = kind => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.translate(32, 32);
    if (kind === 'heart') {
      g.fillStyle = '#e8213c';
      g.beginPath();
      g.moveTo(0, 20);
      g.bezierCurveTo(-30, 0, -22, -26, 0, -10);
      g.bezierCurveTo(22, -26, 30, 0, 0, 20);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.beginPath();
      g.arc(-10, -8, 4, 0, Math.PI * 2);
      g.fill();
    } else if (kind === 'sparkle') {
      // A four-pointed twinkle: gold to amber with a darker edge and a white
      // glint, so it reads on the cream (light) and midnight (dark) Home alike.
      const star = () => {
        g.beginPath();
        g.moveTo(0, -28);
        g.quadraticCurveTo(4, -4, 28, 0);
        g.quadraticCurveTo(4, 4, 0, 28);
        g.quadraticCurveTo(-4, 4, -28, 0);
        g.quadraticCurveTo(-4, -4, 0, -28);
      };
      const fill = g.createRadialGradient(0, 0, 0, 0, 0, 28);
      fill.addColorStop(0, '#fffbe8');
      fill.addColorStop(0.35, '#ffd25a');
      fill.addColorStop(1, '#e8901a');
      star();
      g.fillStyle = fill;
      g.fill();
      g.lineWidth = 2.5;
      g.strokeStyle = 'rgba(150, 82, 8, 0.85)';
      g.stroke();
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(-3, -4, 3.2, 0, Math.PI * 2);
      g.fill();
    } else if (kind === 'star') {
      // A little five-pointed star for the burst (tinted per star).
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 11 : 26;
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      g.fillStyle = '#ffffff';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(0, 0, 0, 0.28)';
      g.stroke();
    } else if (kind === 'sweat') {
      // An anime sweat drop: light blue with a white shine.
      g.beginPath();
      g.moveTo(0, -26);
      g.bezierCurveTo(14, -6, 18, 6, 18, 12);
      g.arc(0, 12, 18, 0, Math.PI, false);
      g.bezierCurveTo(-18, 6, -14, -6, 0, -26);
      const drop = g.createLinearGradient(0, -26, 0, 30);
      drop.addColorStop(0, '#d8f1ff');
      drop.addColorStop(1, '#5fb8ff');
      g.fillStyle = drop;
      g.fill();
      g.lineWidth = 2.5;
      g.strokeStyle = 'rgba(40, 110, 190, 0.8)';
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath();
      g.ellipse(-6, 8, 4, 7, -0.4, 0, Math.PI * 2);
      g.fill();
    } else if (kind === 'dust') {
      // A kick of dust at his feet when he dashes off.
      const cloud = g.createRadialGradient(0, 0, 0, 0, 0, 30);
      cloud.addColorStop(0, 'rgba(214, 196, 168, 0.95)');
      cloud.addColorStop(0.65, 'rgba(196, 174, 140, 0.55)');
      cloud.addColorStop(1, 'rgba(196, 174, 140, 0)');
      g.fillStyle = cloud;
      g.beginPath();
      g.arc(0, 0, 30, 0, Math.PI * 2);
      g.fill();
    } else if (kind === 'puff') {
      // A soft round cloud (the ball's poof, steam when he's shy): warm white
      // with a rosy-beige edge, so it shows on cream as well as on midnight.
      const cloud = g.createRadialGradient(0, 0, 0, 0, 0, 30);
      cloud.addColorStop(0, 'rgba(255, 252, 245, 1)');
      cloud.addColorStop(0.55, 'rgba(250, 232, 220, 0.85)');
      cloud.addColorStop(0.85, 'rgba(214, 178, 170, 0.45)');
      cloud.addColorStop(1, 'rgba(214, 178, 170, 0)');
      g.fillStyle = cloud;
      g.beginPath();
      g.arc(0, 0, 30, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = '#c9d6ff';
      g.font = 'bold 44px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('z', 0, 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const textures = { heart: draw('heart'), sparkle: draw('sparkle'), z: draw('z'), puff: draw('puff'), star: draw('star'), sweat: draw('sweat'), dust: draw('dust') };
  const live = [];
  return {
    /**
     * A burst: `count` stars flying out from (x, y, z) with gravity and spin,
     * in the given colours.
     */
    burst(x, y, z, count, size, colors) {
      for (let i = 0; i < count; i++) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.star, transparent: true, depthWrite: false, toneMapped: false, color: colors[i % colors.length] }));
        sprite.position.set(x, y, z);
        sprite.renderOrder = 6;
        scene.add(sprite);
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const speed = size * (2.6 + Math.random() * 1.8);
        live.push({
          sprite, born: null, size: size * (0.18 + Math.random() * 0.12), life: 1100 + Math.random() * 400, kind: 'star',
          x, y, z, vx: Math.cos(a) * speed, vy: Math.abs(Math.sin(a)) * speed * 1.1 + size * 1.2, spin: (Math.random() - 0.5) * 12, last: null,
        });
      }
    },
    /** Sends one up from (x, y, z), `size` across. */
    emit(kind, x, y, z, size, drift = null) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures[kind], transparent: true, depthWrite: false, toneMapped: false }));
      sprite.position.set(x, y, z);
      sprite.scale.setScalar(size * 0.3);
      sprite.renderOrder = 5;
      scene.add(sprite);
      const life = kind === 'z' ? 2600 : kind === 'puff' ? 900 : kind === 'dust' ? 650 : kind === 'sweat' ? 1300 : 1700;
      live.push({ sprite, born: null, size, drift: drift ?? (Math.random() - 0.5) * size * (kind === 'puff' ? 3 : 1.2), life, x, y, kind });
    },
    update(time) {
      for (let i = live.length - 1; i >= 0; i--) {
        const f = live[i];
        if (f.born === null) f.born = time;
        const p = (time - f.born) / f.life;
        if (p >= 1) {
          scene.remove(f.sprite);
          f.sprite.material.dispose();
          live.splice(i, 1);
          continue;
        }
        // Pops in, drifts up with a gentle sway, fades away.
        const pop = Math.min(1, p / 0.15);
        if (f.kind === 'star') {
          // Flies out, falls under gravity, spins, and fades at the end.
          const dt = f.last === null ? 0 : Math.min(0.05, (time - f.last) / 1000);
          f.last = time;
          f.vy -= f.size * 22 * dt;
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.sprite.position.set(f.x, Math.max(0.01, f.y), f.z);
          f.sprite.scale.setScalar(f.size * Math.min(1, p / 0.08));
          f.sprite.material.rotation += f.spin * dt;
          f.sprite.material.opacity = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
          continue;
        }
        if (f.kind === 'sweat') {
          // Appears by his head and slides down a little.
          f.sprite.scale.set(f.size * 0.75 * Math.min(1, p / 0.15), f.size * Math.min(1, p / 0.15), 1);
          f.sprite.position.set(f.x, f.y - p * f.size * 0.6, f.sprite.position.z);
          f.sprite.material.opacity = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
          continue;
        }
        if (f.kind === 'dust') {
          // Kicked back along the floor, growing and fading.
          f.sprite.scale.setScalar(f.size * (0.6 + 1.2 * p));
          f.sprite.position.x = f.x + f.drift * p * 2;
          f.sprite.position.y = f.y + p * f.size * 0.3;
          f.sprite.material.opacity = 0.9 * (1 - p);
          continue;
        }
        if (f.kind === 'puff') {
          // Billows out and fades.
          f.sprite.scale.setScalar(f.size * (0.5 + 1.6 * p));
          f.sprite.position.x = f.x + f.drift * p;
          f.sprite.position.y = f.y + p * f.size * 0.8;
          f.sprite.material.opacity = 0.9 * (1 - p);
          continue;
        }
        f.sprite.scale.setScalar(f.size * (0.3 + 0.7 * pop) * (f.kind === 'z' ? 0.7 + 0.5 * p : 1));
        f.sprite.position.x = f.x + f.drift * p + Math.sin(p * Math.PI * 3) * f.size * 0.15;
        f.sprite.position.y = f.y + p * f.size * 2.4;
        f.sprite.material.opacity = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
        f.sprite.material.rotation = f.kind === 'sparkle' ? p * 0.8 : Math.sin(p * Math.PI * 2) * 0.25;
      }
    },
  };
}
