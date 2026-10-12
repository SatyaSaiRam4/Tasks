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
  for (const b of centres) {
    const c = b.getCenter(new THREE.Vector3());
    const out = Math.sign(c.x - (centres[0].getCenter(new THREE.Vector3()).x + span / 2)) || 1;
    const cheek = new THREE.Mesh(new THREE.PlaneGeometry(span * 0.62, span * 0.4), rosy);
    if (stick(cheek, face, c.x + out * span * 0.22, b.min.y - span * 0.18, b.max.z, span * 0.03, face.parent)) {
      cheek.renderOrder = 2;
      cheeks.push(cheek);
    }
  }

  return {
    /** blush: 0 a hint of rose, 1 bright pink. plead: 0 normal, 1 big shiny puppy eyes. */
    set({ blush = 0, plead = 0 } = {}) {
      rosy.opacity = 0.36 + 0.56 * Math.max(0, Math.min(1, blush));
      const grow = 1 + 0.9 * Math.max(0, Math.min(1, plead));
      sparkles.forEach(s => s.scale.setScalar(s.userData.base * grow));
    },
  };
}

/** Little things that float up from Melo: hearts, sparkles, a sleepy "z", a startled "!" or a puff of smoke. */
export function createFloaters(scene) {
  const draw = kind => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.translate(32, 32);
    if (kind === 'heart') {
      g.fillStyle = '#ff6f8f';
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
      // A soft four-pointed twinkle with a warm glow.
      const glow = g.createRadialGradient(0, 0, 0, 0, 0, 26);
      glow.addColorStop(0, 'rgba(255, 236, 180, 0.7)');
      glow.addColorStop(1, 'rgba(255, 236, 180, 0)');
      g.fillStyle = glow;
      g.fillRect(-32, -32, 64, 64);
      g.fillStyle = '#ffe9b0';
      g.beginPath();
      g.moveTo(0, -28);
      g.quadraticCurveTo(3, -3, 28, 0);
      g.quadraticCurveTo(3, 3, 0, 28);
      g.quadraticCurveTo(-3, 3, -28, 0);
      g.quadraticCurveTo(-3, -3, 0, -28);
      g.fill();
    } else if (kind === 'bang') {
      // A comic "!": a gold burst with a bold mark, for "someone's watching!"
      g.fillStyle = '#fff4d6';
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const r = i % 2 ? 18 : 30;
        const a = (i / 16) * Math.PI * 2;
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
      g.fillStyle = '#e0a12a';
      g.font = '900 40px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('!', 0, 2);
    } else if (kind === 'puff') {
      // A soft round cloud, for the poof when the ball becomes Melo.
      const cloud = g.createRadialGradient(0, 0, 0, 0, 0, 30);
      cloud.addColorStop(0, 'rgba(255, 250, 238, 0.95)');
      cloud.addColorStop(0.6, 'rgba(255, 244, 220, 0.55)');
      cloud.addColorStop(1, 'rgba(255, 244, 220, 0)');
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
  const textures = { heart: draw('heart'), sparkle: draw('sparkle'), z: draw('z'), bang: draw('bang'), puff: draw('puff') };
  const live = [];
  return {
    /** Sends one up from (x, y, z), `size` across. */
    emit(kind, x, y, z, size) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures[kind], transparent: true, depthWrite: false, toneMapped: false }));
      sprite.position.set(x, y, z);
      sprite.scale.setScalar(size * 0.3);
      sprite.renderOrder = 5;
      scene.add(sprite);
      const life = kind === 'z' ? 2600 : kind === 'bang' ? 1300 : kind === 'puff' ? 900 : 1700;
      live.push({ sprite, born: null, size, drift: (Math.random() - 0.5) * size * (kind === 'puff' ? 3 : 1.2), life, x, y, kind });
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
        if (f.kind === 'bang') {
          // Pops in big with a wobble and stays put above his head.
          const wob = 1 + 0.25 * Math.sin(Math.min(1, p / 0.35) * Math.PI * 3) * (1 - Math.min(1, p / 0.35));
          f.sprite.scale.setScalar(f.size * pop * wob * 1.1);
          f.sprite.position.y = f.y + Math.min(1, p / 0.2) * f.size * 0.4;
          f.sprite.material.opacity = p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2;
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
