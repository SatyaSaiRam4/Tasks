/**
 * Melo's mouth: a friendly smile under his eyes, placed on his face by
 * measuring where its surface is. It can open (talking, cheering): a soft
 * dark mouth with a little tongue appears inside the smile.
 *
 * Shared by the guide page (web/satya/melo.js) and the welcome story
 * (web/story/story.js).
 */
import * as THREE from 'three';

const DARK = 0x2a1012;

/**
 * Adds the mouth to Melo's face (call before the model is scaled or moved,
 * or after: it measures in world space and converts back). Returns
 * { setOpen(0..1) }, or null if the model's eyes/face can't be found.
 */
export function addMouth(model) {
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

  // Under the eyes, by about one eye-row's width.
  const eyeBox = new THREE.Box3().setFromObject(eyes);
  const eyeSpan = eyeBox.max.x - eyeBox.min.x;
  const cx = (eyeBox.min.x + eyeBox.max.x) / 2;
  const y = eyeBox.min.y - eyeSpan * 0.42;

  // Where the face's surface is, straight ahead of that point.
  const ray = new THREE.Raycaster(new THREE.Vector3(cx, y, eyeBox.max.z + 1), new THREE.Vector3(0, 0, -1));
  const hit = ray.intersectObject(face, false)[0];
  if (!hit) return null;

  // Build in world units, then hang it on the same parent as the face.
  const width = eyeSpan * 0.62;
  const mouth = new THREE.Group();
  const lips = new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.5 });
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-width / 2, width * 0.12, -width * 0.12),
    new THREE.Vector3(-width / 4, -width * 0.06, -width * 0.02),
    new THREE.Vector3(0, -width * 0.1, 0),
    new THREE.Vector3(width / 4, -width * 0.06, -width * 0.02),
    new THREE.Vector3(width / 2, width * 0.12, -width * 0.12),
  ]);
  const smile = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, width * 0.045, 8, false), lips);
  mouth.add(smile);
  // The open mouth: a dark rounded opening with a pink tongue, hidden when closed.
  const inside = new THREE.Group();
  const opening = new THREE.Mesh(new THREE.CircleGeometry(width * 0.32, 32), new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.8 }));
  inside.add(opening);
  const tongue = new THREE.Mesh(new THREE.CircleGeometry(width * 0.2, 24), new THREE.MeshStandardMaterial({ color: 0xd9606b, roughness: 0.6 }));
  tongue.position.set(0, -width * 0.12, 0.0005);
  tongue.scale.y = 0.55;
  inside.add(tongue);
  // Opens downward from the smile, as a soft rounded "D".
  opening.scale.y = 0.8;
  inside.position.set(0, -width * 0.16, -0.0005);
  inside.scale.set(1, 0.001, 1);
  mouth.add(inside);

  // Place it a hair in front of the face, facing out along the face's normal.
  const normal = hit.face ? hit.face.normal.clone().transformDirection(face.matrixWorld) : new THREE.Vector3(0, 0, 1);
  mouth.position.copy(hit.point).addScaledVector(normal, width * 0.06);
  mouth.lookAt(mouth.position.clone().add(normal));
  // From world space into the face's parent's space, so it moves with Melo.
  face.parent.attach(mouth);
  mouth.traverse(o => {
    if (o.isMesh) o.castShadow = false;
  });

  return {
    /** 0 closed smile, 1 wide open. */
    setOpen(v) {
      const open = Math.max(0, Math.min(1, v));
      inside.scale.y = Math.max(0.001, open);
      inside.visible = open > 0.02;
      // The smile widens a touch as the mouth opens.
      smile.scale.set(1 + 0.15 * open, 1 + 0.4 * open, 1);
    },
  };
}
