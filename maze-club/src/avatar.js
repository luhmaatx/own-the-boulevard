import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { hairFor, outfitFor } from './game-data.js';

const OUTFIT_COLORS = {
  'ruby-noir': ['#501d2c', '#ab3151', '#d6ad68'],
  'gold-operator': ['#27232a', '#c29e61', '#f0d89f'],
  'gala-afterglow': ['#edd3bb', '#b47775', '#e8c27c'],
  'emerald-night': ['#183a32', '#287055', '#d8b66b'],
  'midnight-vault': ['#16171d', '#34323a', '#d8b45f']
};

function mat(color, roughness = 0.52, metalness = 0.05, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}
function mesh(geometry, material, parent, position, scale) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  if (scale) item.scale.set(...scale);
  item.castShadow = true; item.receiveShadow = true;
  parent.add(item); return item;
}
function capsule(radius, length, material, parent, position, rotation = [0, 0, 0]) {
  const piece = mesh(new THREE.CapsuleGeometry(radius, length, 4, 8), material, parent, position);
  piece.rotation.set(...rotation); return piece;
}
function lathe(points, material, parent, position, scale) {
  const shape = new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), 12);
  return mesh(shape, material, parent, position, scale);
}

export function createAvatar(profile, { name = profile.name, accent = '#d9ae66', remote = false } = {}) {
  const root = new THREE.Group();
  root.name = `Avatar:${name}`;
  const model = new THREE.Group(); model.name = 'procedural-luxury-rig'; root.add(model);
  const [pantsColor, jacketColor, goldColor] = OUTFIT_COLORS[profile.outfit] || OUTFIT_COLORS['ruby-noir'];
  const skin = mat('#b78166', 0.72), skinLight = mat('#d0a184', 0.68);
  const jacket = mat(jacketColor, 0.35, 0.18), pants = mat(pantsColor, 0.46, 0.14);
  const gold = mat(goldColor || accent, 0.23, 0.78), boots = mat('#1a1719', 0.28, 0.22);
  const hairColors = hairFor(profile).colors;
  const hairA = mat(hairColors[0], 0.44, 0.02), hairB = mat(hairColors[1], 0.44, 0.02);
  const eye = mat('#231821', 0.25), lip = mat('#8c3950', 0.35);
  const white = mat('#fff2df', 0.32);

  // Tailored silhouette: hips, fitted jacket, collar, waist sash, and layered sleeves.
  mesh(new THREE.SphereGeometry(0.26, 18, 14), pants, model, [0, 0.77, 0], [1.12, 0.72, 0.82]);
  lathe([[0.19, 0], [0.22, 0.1], [0.27, 0.36], [0.23, 0.7], [0.14, 0.82], [0, 0.82]], jacket, model, [0, 0.9, 0], [1, 1.03, 0.86]);
  const collar = mesh(new THREE.TorusGeometry(0.155, 0.018, 6, 20), gold, model, [0, 1.64, 0]);
  collar.rotation.x = Math.PI / 2;
  const belt = mesh(new THREE.CylinderGeometry(0.205, 0.215, 0.07, 16), gold, model, [0, 0.98, 0]);
  belt.material = gold;
  mesh(new THREE.BoxGeometry(0.11, 0.1, 0.04), gold, model, [0, 0.98, 0.22]);
  for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(0.022, 8, 8), gold, model, [0, 1.49 - i * 0.16, 0.201]);
  for (const side of [-1, 1]) {
    const lapel = mesh(new THREE.BoxGeometry(0.045, 0.46, 0.025), gold, model, [side * 0.095, 1.39, 0.198]);
    lapel.rotation.z = side * -0.28;
    mesh(new THREE.SphereGeometry(0.09, 12, 10), jacket, model, [side * 0.235, 1.49, 0], [1.1, 1.02, 0.95]);
  }

  // Head and expressive facial features. Face points toward +Z.
  const neck = mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.18, 12), skin, model, [0, 1.75, 0]);
  const head = new THREE.Group(); head.position.set(0, 1.94, 0.015); model.add(head);
  mesh(new THREE.SphereGeometry(0.205, 20, 18), skin, head, [0, 0, 0], [0.86, 1.08, 0.84]);
  mesh(new THREE.SphereGeometry(0.052, 10, 8), skinLight, head, [0, -0.06, 0.163], [0.75, 0.5, 0.62]);
  for (const side of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.024, 8, 8), eye, head, [side * 0.074, 0.025, 0.157], [1.12, 0.76, 0.6]);
    mesh(new THREE.SphereGeometry(0.041, 8, 8), skin, head, [side * 0.177, -0.015, 0]);
    mesh(new THREE.SphereGeometry(0.027, 10, 8), gold, head, [side * 0.181, -0.09, 0.015]);
  }
  mesh(new THREE.SphereGeometry(0.025, 8, 8), skinLight, head, [0, -0.012, 0.176], [0.7, 1, 0.8]);
  const mouth = mesh(new THREE.SphereGeometry(0.029, 10, 6), lip, head, [0, -0.098, 0.151], [1.15, 0.38, 0.5]);

  // Split color hair, with a sculpted crown and loose waves down the back.
  mesh(new THREE.SphereGeometry(0.22, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.61), hairA, head, [-0.025, 0.085, -0.017], [1.02, 0.84, 1.02]);
  mesh(new THREE.SphereGeometry(0.22, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.61), hairB, head, [0.055, 0.082, -0.015], [0.96, 0.84, 1.02]);
  mesh(new THREE.SphereGeometry(0.18, 16, 12), hairA, head, [-0.14, -0.23, -0.115], [0.63, 1.15, 0.78]);
  mesh(new THREE.SphereGeometry(0.18, 16, 12), hairB, head, [0.14, -0.23, -0.115], [0.63, 1.15, 0.78]);
  if (profile.hairStyle === 'bob') {
    head.children.slice(-2).forEach(child => { child.scale.y *= 0.48; child.position.y += 0.1; });
  } else if (profile.hairStyle === 'sleek') {
    head.children.slice(-2).forEach(child => { child.scale.set(0.48, 0.82, 0.58); });
  } else if (profile.hairStyle === 'updo') {
    head.children.slice(-2).forEach(child => { child.visible = false; });
    mesh(new THREE.SphereGeometry(0.14, 14, 10), hairA, head, [-0.1, 0.25, -0.15], [1.05, 0.95, 1]);
    mesh(new THREE.SphereGeometry(0.14, 14, 10), hairB, head, [0.1, 0.25, -0.15], [1.05, 0.95, 1]);
  }
  const waveCount = profile.hairStyle === 'sleek' || profile.hairStyle === 'bob' || profile.hairStyle === 'updo' ? 0 : 3;
  for (let i = 0; i < waveCount; i++) {
    const strand = mesh(new THREE.TorusGeometry(0.075, 0.028, 5, 10, Math.PI * 1.2), i % 2 ? hairA : hairB, head, [-0.11 + i * 0.1, -0.37 - (i % 2) * 0.04, -0.12]);
    strand.rotation.y = Math.PI / 2;
  }

  // Articulated arms and legs. Upper limb groups act as a small procedural skeleton.
  const arms = [], legs = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * 0.28, 1.49, 0); model.add(arm);
    capsule(0.083, 0.2, jacket, arm, [side * 0.012, -0.18, 0], [0, 0, side * -0.16]);
    const elbow = new THREE.Group(); elbow.position.set(side * 0.015, -0.34, 0); arm.add(elbow);
    capsule(0.067, 0.2, skin, elbow, [side * 0.025, -0.16, 0], [0, 0, side * -0.12]);
    const cuff = mesh(new THREE.CylinderGeometry(0.073, 0.073, 0.045, 10), gold, elbow, [side * 0.025, -0.28, 0]);
    capsule(0.052, 0.075, skinLight, elbow, [side * 0.028, -0.34, 0.01]);
    arms.push(arm);

    const leg = new THREE.Group(); leg.position.set(side * 0.135, 0.73, 0); model.add(leg);
    capsule(0.105, 0.31, pants, leg, [0, -0.19, 0]);
    const knee = new THREE.Group(); knee.position.set(0, -0.37, 0); leg.add(knee);
    capsule(0.078, 0.29, pants, knee, [0, -0.16, 0]);
    mesh(new THREE.BoxGeometry(0.125, 0.13, 0.24), boots, knee, [0, -0.34, 0.035], [1, 0.8, 1.08]);
    mesh(new THREE.BoxGeometry(0.128, 0.035, 0.25), gold, knee, [0, -0.403, 0.035]);
    legs.push({ upper: leg, lower: knee });
  }
  const shoulderCape = mesh(new THREE.SphereGeometry(0.27, 12, 8), jacket, model, [0, 1.48, -0.05], [1, 0.44, 0.7]);
  shoulderCape.material = jacket;
  if (profile.accessory !== 'none') {
    const accessoryMat = mat(profile.accessory === 'ruby-halo' ? '#ee3562' : profile.accessory === 'crystal-drops' ? '#d8f0ed' : goldColor, 0.2, 0.78, { emissive: profile.accessory === 'ruby-halo' ? '#781430' : '#000000', emissiveIntensity: 0.22 });
    const earring = mesh(new THREE.TorusGeometry(profile.accessory === 'ruby-halo' ? 0.047 : 0.035, 0.009, 5, 12), accessoryMat, head, [0.18, -0.095, 0.012]);
    earring.rotation.x = Math.PI / 2;
  }

  const nameplate = new THREE.Group(); nameplate.position.y = 2.37; root.add(nameplate);
  const flag = mesh(new THREE.SphereGeometry(0.034, 8, 8), mat(remote ? '#83d8ff' : '#f1cc83', 0.25, 0.4), nameplate, [0, 0, 0]);
  const avatar = {
    root, model, head, arms, legs, nameplate, name,
    moving: false, mixer: null, clips: null, procedural: true,
    animate(dt, elapsed, moving, sprint = false) {
      this.moving = moving;
      if (this.mixer) {
        this.mixer.update(dt);
        const desired = moving ? (sprint ? 'Run' : 'Walk') : 'Idle';
        if (this.currentClip !== desired && this.clips?.[desired]) {
          this.clips[this.currentClip]?.fadeOut(0.18);
          this.clips[desired].reset().fadeIn(0.18).play(); this.currentClip = desired;
        }
        return;
      }
      const swing = moving ? Math.sin(elapsed * (sprint ? 13 : 9)) * (sprint ? 0.48 : 0.31) : Math.sin(elapsed * 1.6) * 0.03;
      this.root.position.y = moving ? Math.abs(Math.sin(elapsed * 9)) * 0.035 : Math.sin(elapsed * 1.4) * 0.012;
      this.head.rotation.y = Math.sin(elapsed * 0.7) * 0.025;
      this.arms.forEach((arm, i) => { arm.rotation.x = i ? -swing * 0.82 : swing * 0.82; });
      this.legs.forEach((leg, i) => {
        leg.upper.rotation.x = i ? swing : -swing;
        leg.lower.rotation.x = moving ? Math.max(0, Math.sin(elapsed * (sprint ? 13 : 9) - i * Math.PI)) * -0.53 : 0;
      });
    }
  };
  root.userData.avatar = avatar;
  return avatar;
}

let glbPromise;
export function loadAvatarOverride() {
  if (!glbPromise) {
    glbPromise = (async () => {
      try {
        const manifest = await fetch('/assets/manifest.json').then(r => r.json());
        const path = manifest.optionalOverrides?.avatar;
        if (!path) return null;
        return await new Promise((resolve, reject) => new GLTFLoader().load(path, resolve, undefined, reject));
      } catch { return null; }
    })();
  }
  return glbPromise;
}

export function applyAvatarGLB(avatar, gltf) {
  if (!gltf?.scene) return false;
  try {
    const imported = cloneSkeleton(gltf.scene);
    imported.scale.setScalar(1.05);
    imported.position.y = 0;
    avatar.model.visible = false;
    avatar.root.add(imported);
    avatar.procedural = false;
    if (gltf.animations?.length) {
      avatar.mixer = new THREE.AnimationMixer(imported);
      const find = label => gltf.animations.find(c => c.name.toLowerCase().includes(label.toLowerCase()));
      avatar.clips = {};
      for (const label of ['Idle', 'Walk', 'Run', 'Emote']) {
        const clip = find(label); if (clip) avatar.clips[label] = avatar.mixer.clipAction(clip);
      }
      if (avatar.clips.Idle) { avatar.clips.Idle.play(); avatar.currentClip = 'Idle'; }
    }
    return true;
  } catch { return false; }
}
