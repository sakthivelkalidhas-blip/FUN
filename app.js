import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ============================================================
// UI Elements
// ============================================================
const modeSelectEl = document.getElementById('mode-select');
const hostModeBtn = document.getElementById('host-mode-btn');
const joinModeBtn = document.getElementById('join-mode-btn');
const hostPanel = document.getElementById('host-panel');
const joinPanel = document.getElementById('join-panel');
const hostCodeEl = document.getElementById('host-code');
const hostStatusEl = document.getElementById('host-status');
const hostStartBtn = document.getElementById('host-start-btn');
const hostBackBtn = document.getElementById('host-back-btn');
const joinCodeInput = document.getElementById('join-code');
const joinConnectBtn = document.getElementById('join-connect-btn');
const joinStatusEl = document.getElementById('join-status');
const joinStartBtn = document.getElementById('join-start-btn');
const joinBackBtn = document.getElementById('join-back-btn');
const introScreen = document.getElementById('intro-screen');
const lobbyCard = document.getElementById('lobby-card');
const gameOverModal = document.getElementById('game-over-modal');
const matchTitle = document.getElementById('match-result-title');
const matchSub = document.getElementById('match-result-sub');

const hpEl = document.getElementById('hp');
const hpBarInner = document.getElementById('hp-bar-inner');
const glooEl = document.getElementById('gloo-count');
const medkitEl = document.getElementById('medkit-count');
const ammoCountEl = document.getElementById('ammo-count');
const ammoMaxEl = document.getElementById('ammo-max');
const localScoreEl = document.getElementById('local-score');
const remoteScoreEl = document.getElementById('remote-score');
const healBarContainer = document.getElementById('heal-bar-container');
const healProgress = document.getElementById('heal-progress');
const reloadBarContainer = document.getElementById('reload-bar-container');
const reloadProgress = document.getElementById('reload-progress');
const crosshairEl = document.getElementById('crosshair');
const damageFlashEl = document.getElementById('damage-flash');
const statusBannerEl = document.getElementById('status-banner');

// ---- Pre-match weapon shop ----
const shopOverlay = document.getElementById('shop-overlay');
const shopStatusEl = document.getElementById('shop-status');
const shopConfirmBtn = document.getElementById('shop-confirm-btn');
const weaponButtons = document.querySelectorAll('.weapon-btn');
const shopMusicHost = document.getElementById('shop-music');

// ============================================================
// Audio - all sound effects are synthesized in-browser (Web Audio API)
// so no external/copyrighted audio assets are used.
// ============================================================
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function makeNoiseBuffer(duration) {
  const size = Math.floor(audioCtx.sampleRate * duration);
  const buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function playGunshot() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  // Sharp noise "crack"
  const noise = audioCtx.createBufferSource();
  noise.buffer = makeNoiseBuffer(0.18);
  const bandpass = audioCtx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(2200, now);
  bandpass.frequency.exponentialRampToValueAtTime(600, now + 0.12);
  bandpass.Q.value = 0.9;
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.9, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  noise.connect(bandpass).connect(noiseGain).connect(audioCtx.destination);
  noise.start(now);
  noise.stop(now + 0.18);

  // Low punch
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.09);
  const oscGain = audioCtx.createGain();
  oscGain.gain.setValueAtTime(0.7, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
  osc.connect(oscGain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

function playHitMarker() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1400, now);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.08);
}

function playImpactThud() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const noise = audioCtx.createBufferSource();
  noise.buffer = makeNoiseBuffer(0.1);
  const lowpass = audioCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 500;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  noise.connect(lowpass).connect(gain).connect(audioCtx.destination);
  noise.start(now);
  noise.stop(now + 0.1);
}

function playHealTone() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.linearRampToValueAtTime(900, now + 0.5);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.5);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.5);
}

function playJumpBlip() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(500, now + 0.08);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}

// ============================================================
// Procedural textures (no external image files -> fully original art)
// ============================================================
function buildTexture(size, drawFn, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  return tex;
}

const floorTexture = buildTexture(512, (ctx, s) => {
  ctx.fillStyle = '#2b2d30';
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 2;
  const tiles = 4;
  for (let i = 0; i <= tiles; i++) {
    const p = (i / tiles) * s;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(s, p); ctx.stroke();
  }
  // fine scuffs + grime for extra surface detail at close range
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    ctx.lineWidth = 1;
    const x1 = Math.random() * s, y1 = Math.random() * s;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + Math.random() * 40 - 20, y1 + Math.random() * 40 - 20); ctx.stroke();
  }
}, 22, 22);

const centerMatTexture = buildTexture(512, (ctx, s) => {
  ctx.fillStyle = '#33363a';
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = '#e6e6e6';
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, s - 28, s - 28);
  ctx.fillStyle = '#c81e1e';
  const cx = s / 2, cy = s / 2, arm = s * 0.11, len = s * 0.34;
  ctx.fillRect(cx - arm / 2, cy - len, arm, len * 2);
  ctx.fillRect(cx - len, cy - arm / 2, len * 2, arm);
}, 1, 1);

function woodCrateTexture(base1, base2) {
  return buildTexture(512, (ctx, s) => {
    ctx.fillStyle = base1;
    ctx.fillRect(0, 0, s, s);
    const planks = 5;
    for (let i = 0; i < planks; i++) {
      const y = (i / planks) * s;
      ctx.fillStyle = i % 2 === 0 ? base1 : base2;
      ctx.fillRect(0, y, s, s / planks);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, y, s, s / planks);
      for (let g = 0; g < 10; g++) {
        ctx.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`;
        ctx.lineWidth = 1;
        const gy = y + Math.random() * (s / planks);
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(s, gy + (Math.random() * 6 - 3)); ctx.stroke();
      }
      // wood grain highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath(); ctx.moveTo(0, y + 4); ctx.lineTo(s, y + 4); ctx.stroke();
    }
    // corner metal braces
    ctx.fillStyle = 'rgba(20,20,20,0.55)';
    const b = 16;
    ctx.fillRect(0, 0, b, s); ctx.fillRect(s - b, 0, b, s);
    ctx.fillRect(0, 0, s, b); ctx.fillRect(0, s - b, s, b);
  }, 1, 1);
}

const crateTexWood = woodCrateTexture('#8a5a30', '#78491f');
const crateTexOlive = woodCrateTexture('#4f5b32', '#414b28');
const crateTexTan = woodCrateTexture('#a58657', '#93764a');

const wallTexture = buildTexture(512, (ctx, s) => {
  ctx.fillStyle = '#2e3336';
  ctx.fillRect(0, 0, s, s);
  const ribs = 18;
  for (let i = 0; i < ribs; i++) {
    const x = (i / ribs) * s;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.13)';
    ctx.fillRect(x, 0, s / ribs, s);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  for (let i = 0; i < 70; i++) ctx.fillRect(Math.random() * s, Math.random() * s, 3, 3);
  // horizontal panel seams
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 3;
  for (let i = 1; i < 4; i++) { const y = (i / 4) * s; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
}, 16, 3);

// Corrugated shipping-container texture (grayscale so it can be tinted
// per-instance via material.color for color variety)
const containerTexture = buildTexture(512, (ctx, s) => {
  ctx.fillStyle = '#c9c9c9';
  ctx.fillRect(0, 0, s, s);
  const ridges = 24;
  for (let i = 0; i < ridges; i++) {
    const x = (i / ridges) * s;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.22)';
    ctx.fillRect(x, 0, s / ridges, s);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  for (let i = 0; i < 90; i++) ctx.fillRect(Math.random() * s, Math.random() * s, 3, 3);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 4;
  for (let i = 1; i < 3; i++) { const y = (i / 3) * s; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
}, 10, 2);


// ============================================================
// Scene & Renderer
// ============================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0f12);
scene.fog = new THREE.Fog(0x0d0f12, 34, 110);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const BASE_FOV = 75;
camera.position.set(0, 1.6, 34);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('canvas-container').appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Post-processing: subtle bloom so lamps, tracers and the muzzle
// flash glow instead of looking flat ----
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.55, // strength
  0.4,  // radius
  0.82  // threshold - only bright emissive/lamp areas bloom
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// ---- Lighting ----
scene.add(new THREE.HemisphereLight(0x9fb7c9, 0x2b2416, 0.6));

const sunLight = new THREE.DirectionalLight(0xffe3b8, 1.0);
sunLight.position.set(-24, 34, -18);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(4096, 4096);
sunLight.shadow.camera.left = -52;
sunLight.shadow.camera.right = 52;
sunLight.shadow.camera.top = 52;
sunLight.shadow.camera.bottom = -52;
sunLight.shadow.camera.far = 110;
sunLight.shadow.bias = -0.0012;
scene.add(sunLight);

// Warm hanging warehouse lamps, spread across the larger floor on a grid
const LAMP_GRID = [-32, 0, 32];
const lampPositions = [];
LAMP_GRID.forEach((x) => LAMP_GRID.forEach((z) => lampPositions.push([x, 8.8, z])));
lampPositions.forEach(([x, y, z]) => {
  const lamp = new THREE.PointLight(0xffb066, 7, 34, 2);
  lamp.position.set(x, y, z);
  lamp.castShadow = false;
  scene.add(lamp);

  const fixture = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.5, 0.4, 12),
    new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.4, emissive: 0xffaa55, emissiveIntensity: 0.8 })
  );
  fixture.position.set(x, y + 0.35, z);
  scene.add(fixture);
});

// ============================================================
// Arena (original layout inspired by warehouse duel arenas: tiled
// floor with a center marker, crate cover, industrial shell).
// Enlarged so there's real space to flank and rotate around cover.
// ============================================================
const ROOM_HALF = 46;
const obstacles = []; // {x, z, hw, hd, top} for simple AABB collision

// Skylight glow panel on the back wall (light source hinted in reference art)
const skylight = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 6),
  new THREE.MeshBasicMaterial({ color: 0xdfefff })
);
skylight.position.set(0, 8, -(ROOM_HALF - 0.1));
scene.add(skylight);
const skylightFill = new THREE.PointLight(0xcfe8ff, 4, 60, 2);
skylightFill.position.set(0, 8, -(ROOM_HALF - 4));
scene.add(skylightFill);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(ROOM_HALF * 2, ROOM_HALF * 2),
  new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.85, metalness: 0.05 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const centerMat = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ map: centerMatTexture, roughness: 0.9 })
);
centerMat.rotation.x = -Math.PI / 2;
centerMat.position.y = 0.01;
centerMat.receiveShadow = true;
scene.add(centerMat);

// Walls
const wallMat = new THREE.MeshStandardMaterial({ map: wallTexture, roughness: 0.9, metalness: 0.15 });
function addWall(w, h, d, x, y, z) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  wall.position.set(x, y, z);
  wall.receiveShadow = true;
  wall.castShadow = true;
  scene.add(wall);
}
const WALL_H = 13;
addWall(ROOM_HALF * 2 + 2, WALL_H, 1, 0, WALL_H / 2, -ROOM_HALF);
addWall(ROOM_HALF * 2 + 2, WALL_H, 1, 0, WALL_H / 2, ROOM_HALF);
addWall(1, WALL_H, ROOM_HALF * 2 + 2, -ROOM_HALF, WALL_H / 2, 0);
addWall(1, WALL_H, ROOM_HALF * 2 + 2, ROOM_HALF, WALL_H / 2, 0);

// Roof trusses (simple industrial beams, purely decorative)
const beamMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, metalness: 0.7, roughness: 0.5 });
for (let i = -4; i <= 4; i++) {
  const beam = new THREE.Mesh(new THREE.BoxGeometry(ROOM_HALF * 2, 0.5, 0.5), beamMat);
  beam.position.set(0, 12, i * 11.5);
  scene.add(beam);
}
for (let i = -4; i <= 4; i++) {
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, ROOM_HALF * 2), beamMat);
  beam.position.set(i * 11.5, 12, 0);
  scene.add(beam);
}

// Crate factory
function addCrate(size, x, z, texture, ry = 0) {
  const geo = new THREE.BoxGeometry(size, size, size);
  const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, size / 2, z);
  mesh.rotation.y = ry;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  obstacles.push({ x, z, hw: size / 2, hd: size / 2, top: size });
  return mesh;
}

function addCrateStack(x, z, texture, ry = 0) {
  addCrate(2.2, x, z, texture, ry);
  const top = addCrate(1.6, x, z, texture, ry + 0.4);
  top.position.y = 2.2 + 0.8;
}

// Cover clusters mirrored left/right, echoing the reference photo's layout,
// scaled outward to fill the larger arena footprint.
const SCALE = ROOM_HALF / 27;
const sx = (v) => v * SCALE;

addCrateStack(sx(-14), sx(-8), crateTexOlive, 0.3);
addCrate(2.4, sx(-16), sx(-3), crateTexTan, 0.6);
addCrate(1.8, sx(-11), sx(-2), crateTexWood, -0.2);
addCrateStack(sx(-14), sx(8), crateTexWood, -0.4);
addCrate(2.0, sx(-9), sx(12), crateTexOlive, 0.5);

addCrateStack(sx(14), sx(-8), crateTexOlive, -0.3);
addCrate(2.4, sx(16), sx(-3), crateTexTan, -0.6);
addCrate(1.8, sx(11), sx(-2), crateTexWood, 0.2);
addCrateStack(sx(14), sx(8), crateTexWood, 0.4);
addCrate(2.0, sx(9), sx(12), crateTexOlive, -0.5);

// Center-lane low cover (symmetric, keeps duels fair)
addCrate(1.6, sx(-3.5), 0, crateTexTan, 0.3);
addCrate(1.6, sx(3.5), 0, crateTexTan, -0.3);
addCrate(2.0, 0, sx(-10), crateTexWood, 0);
addCrate(2.0, 0, sx(10), crateTexWood, 0);

// Outer-ring cover: the bigger footprint leaves room to flank wide,
// so give both flanks and the back lanes extra crate cover too.
addCrateStack(sx(-14) - 14, 0, crateTexTan, 0.15);
addCrateStack(sx(14) + 14, 0, crateTexOlive, -0.15);
addCrate(2.6, 0, sx(12) + 14, crateTexWood, 0.1);
addCrate(2.6, 0, -(sx(12) + 14), crateTexWood, -0.1);
addCrateStack(sx(-16), sx(16), crateTexOlive, 0.5);
addCrateStack(sx(16), sx(16), crateTexTan, -0.5);
addCrateStack(sx(-16), -sx(16), crateTexWood, 0.6);
addCrateStack(sx(16), -sx(16), crateTexOlive, -0.6);

// Shipping containers - big tinted box cover scattered around the arena
function addContainer(x, z, ry, color) {
  const w = 6.2, h = 2.7, d = 2.4;
  const mat = new THREE.MeshStandardMaterial({ map: containerTexture, color, roughness: 0.75, metalness: 0.3 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, h / 2, z);
  mesh.rotation.y = ry;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  // register a rotated footprint as an axis-aligned box (approximate but safe for 0/90-ish rotations)
  const cos = Math.abs(Math.cos(ry)), sin = Math.abs(Math.sin(ry));
  obstacles.push({ x, z, hw: (w * cos + d * sin) / 2, hd: (w * sin + d * cos) / 2, top: h });
  return mesh;
}

const CONTAINER_RED = 0xb33a2e, CONTAINER_BLUE = 0x2e5a8f, CONTAINER_GREEN = 0x3f5a34, CONTAINER_YELLOW = 0xc99a1f;

addContainer(sx(-22), sx(-14), Math.PI / 2, CONTAINER_RED);
addContainer(sx(-22), sx(-6), Math.PI / 2, CONTAINER_BLUE);
addContainer(sx(22), sx(-14), Math.PI / 2, CONTAINER_GREEN);
addContainer(sx(22), sx(-6), Math.PI / 2, CONTAINER_YELLOW);
addContainer(sx(-20), sx(18), 0.25, CONTAINER_BLUE);
addContainer(sx(20), sx(18), -0.25, CONTAINER_RED);
addContainer(0, sx(-24), 0, CONTAINER_GREEN);
addContainer(0, sx(24), 0, CONTAINER_YELLOW);
addContainer(sx(-8), sx(-20), Math.PI / 2 + 0.2, CONTAINER_YELLOW);
addContainer(sx(8), sx(20), Math.PI / 2 - 0.2, CONTAINER_GREEN);
// stacked container on one flank for vertical variety
const stackedContainer = addContainer(sx(-22), 0, Math.PI / 2, CONTAINER_BLUE);
const topContainer = addContainer(sx(-22), 0, Math.PI / 2, CONTAINER_RED);
topContainer.position.y = 2.7 + 1.35;

// ============================================================
// Weapon loadout data (generic historical firearm designations,
// not tied to any specific game's branding) - every gun uses a
// 20-round magazine per the player's chosen capacity.
// ============================================================
const MAG_SIZE = 20;
const RELOAD_TIME = 1600; // ms

const WEAPONS = {
  mp40:   { name: 'MP40',          category: 'SMG',    color: 0x38383a, damage: 16, fireRate: 0.11, auto: true,  bodyLen: 0.58, barrelLen: 0.40 },
  ump:    { name: 'UMP',           category: 'SMG',    color: 0x2d2d2f, damage: 18, fireRate: 0.14, auto: true,  bodyLen: 0.60, barrelLen: 0.36 },
  m1911:  { name: 'M1911',         category: 'Pistol', color: 0x555555, damage: 26, fireRate: 0.28, auto: false, bodyLen: 0.34, barrelLen: 0.22 },
  deagle: { name: 'Desert Eagle',  category: 'Pistol', color: 0x6b6b6b, damage: 38, fireRate: 0.38, auto: false, bodyLen: 0.38, barrelLen: 0.26 },
  g18:    { name: 'G18',           category: 'Pistol', color: 0x333333, damage: 20, fireRate: 0.10, auto: true,  bodyLen: 0.30, barrelLen: 0.20 },
  awm:    { name: 'AWM',           category: 'Sniper', color: 0x4d4030, damage: 95, fireRate: 1.30, auto: false, bodyLen: 0.70, barrelLen: 0.85 },
  kar98k: { name: 'Kar98k',        category: 'Sniper', color: 0x5a4128, damage: 85, fireRate: 1.20, auto: false, bodyLen: 0.68, barrelLen: 0.80 },
  m24:    { name: 'M24',           category: 'Sniper', color: 0x3d3d3d, damage: 80, fireRate: 1.15, auto: false, bodyLen: 0.66, barrelLen: 0.78 },
};

let selectedWeaponKey = 'mp40';
let currentAmmo = MAG_SIZE;
let isReloading = false;
let isFiring = false;
let lastShotTime = 0;
let localShopReady = false;
let remoteShopReady = false;

// ============================================================
// Game & Player State
// ============================================================
const MAX_HP = 200;
let health = MAX_HP;
let glooWallsLeft = 3;
let medKitsLeft = 2;
let localWins = 0;
let remoteWins = 0;
let isRoundActive = false;
let gameStarted = false;
let isCrouching = false;

// Physics
let velocityY = 0;
let isGrounded = true;
const GRAVITY = 25;
const JUMP_FORCE = 9;
const STAND_HEIGHT = 1.6;
const CROUCH_HEIGHT = 1.0;
let currentEyeHeight = STAND_HEIGHT;

// Healing State
let isHealing = false;
let healTimer = null;
let healProgressInterval = null;
let healStartTime = 0;
const HEAL_DURATION = 3000;

const controls = new PointerLockControls(camera, renderer.domElement);

// ---- Pre-match weapon shop: players can walk around the arena and pick
// a loadout; the round only begins once both sides have locked in ----
function playShopMusic() {
  if (shopMusicHost.childElementCount) return; // already playing
  const iframe = document.createElement('iframe');
  iframe.width = '1'; iframe.height = '1'; iframe.style.opacity = '0';
  iframe.allow = 'autoplay';
  iframe.src = 'https://www.youtube.com/embed/FLvxuM1_rDk?autoplay=1&controls=0';
  shopMusicHost.appendChild(iframe);
}
function stopShopMusic() {
  shopMusicHost.innerHTML = '';
}

function enterShopPhase() {
  ensureAudio();
  gameStarted = true;   // lets the player walk around while shopping
  isRoundActive = false; // no damage/combat until both sides are ready
  introScreen.classList.add('hidden');
  shopOverlay.classList.remove('hidden');

  const spawnZ = isHost ? ROOM_HALF - 8 : -(ROOM_HALF - 8);
  camera.position.set(0, STAND_HEIGHT, spawnZ);
  camera.lookAt(0, STAND_HEIGHT, 0);

  playShopMusic();
  // Pointer stays unlocked here so the mouse cursor is free to click the
  // shop UI; WASD still moves the player using the camera's current facing.
}
hostStartBtn.addEventListener('click', enterShopPhase);
joinStartBtn.addEventListener('click', enterShopPhase);

weaponButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (localShopReady) return;
    weaponButtons.forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    setWeapon(btn.dataset.weapon);
  });
});

shopConfirmBtn.addEventListener('click', () => {
  if (localShopReady) return;
  localShopReady = true;
  shopConfirmBtn.disabled = true;
  shopConfirmBtn.innerText = 'Locked In';
  shopStatusEl.innerText = 'Waiting for opponent to lock in\u2026';
  if (conn && conn.open) conn.send({ type: 'shopReady', weapon: selectedWeaponKey });
  checkBothShopReady();
});

function checkBothShopReady() {
  if (localShopReady && remoteShopReady) beginMatch();
}

function beginMatch() {
  shopOverlay.classList.add('hidden');
  stopShopMusic();
  if (!isMobileDevice()) controls.lock();
  resetRound();
}

const moveState = { forward: false, backward: false, left: false, right: false };
let sprinting = false;
let prevTime = performance.now();
let bobPhase = 0;

// Keyboard Listeners (PC)
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE') deployGlooWall();
  if (e.code === 'KeyF') startHealing();
  if (e.code === 'KeyR') reload();
  if (e.code === 'Space') jump();
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') sprinting = true;
  if (e.code === 'KeyC') toggleCrouch();
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code) && isHealing) cancelHealing();
  handleKey(e.code, true);
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') sprinting = false;
  handleKey(e.code, false);
});

function handleKey(code, state) {
  switch (code) {
    case 'KeyW': moveState.forward = state; break;
    case 'KeyS': moveState.backward = state; break;
    case 'KeyA': moveState.left = state; break;
    case 'KeyD': moveState.right = state; break;
  }
}

function jump() {
  if (isGrounded && gameStarted && isRoundActive && !isCrouching) {
    velocityY = JUMP_FORCE;
    isGrounded = false;
    playJumpBlip();
  }
}

function toggleCrouch() {
  isCrouching = !isCrouching;
}

// Right-mouse Aim Down Sights (PC only) - narrows FOV & steadies aim
let isAiming = false;
window.addEventListener('mousedown', (e) => {
  if (e.button === 2 && controls.isLocked) isAiming = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 2) isAiming = false;
});
window.addEventListener('contextmenu', (e) => { if (controls.isLocked) e.preventDefault(); });

// ============================================================
// Mobile Touch & Virtual Joystick Logic
// ============================================================
function isMobileDevice() {
  return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
}

const joystickContainer = document.getElementById('joystick-container');
const joystickKnob = document.getElementById('joystick-knob');
const touchLookArea = document.getElementById('touch-look-area');

let joystickTouchId = null;
let joystickCenter = { x: 0, y: 0 };
let joystickVector = { x: 0, y: 0 };

joystickContainer.addEventListener('touchstart', (e) => {
  e.preventDefault();
  ensureAudio();
  const touch = e.changedTouches[0];
  joystickTouchId = touch.identifier;
  const rect = joystickContainer.getBoundingClientRect();
  joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  updateJoystick(touch);
}, { passive: false });

joystickContainer.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === joystickTouchId) {
      updateJoystick(e.changedTouches[i]);
      break;
    }
  }
}, { passive: false });

const resetJoystick = () => {
  joystickTouchId = null;
  joystickVector = { x: 0, y: 0 };
  joystickKnob.style.transform = `translate(-50%, -50%)`;
  moveState.forward = false;
  moveState.backward = false;
  moveState.left = false;
  moveState.right = false;
};

joystickContainer.addEventListener('touchend', resetJoystick);
joystickContainer.addEventListener('touchcancel', resetJoystick);

function updateJoystick(touch) {
  const maxRadius = 45;
  const dx = touch.clientX - joystickCenter.x;
  const dy = touch.clientY - joystickCenter.y;
  const dist = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const clampedDist = Math.min(dist, maxRadius);

  const knobX = Math.cos(angle) * clampedDist;
  const knobY = Math.sin(angle) * clampedDist;

  joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

  joystickVector = { x: knobX / maxRadius, y: knobY / maxRadius };

  moveState.forward = joystickVector.y < -0.2;
  moveState.backward = joystickVector.y > 0.2;
  moveState.left = joystickVector.x < -0.2;
  moveState.right = joystickVector.x > 0.2;
  sprinting = clampedDist > maxRadius * 0.85;

  if (isHealing && dist > 10) cancelHealing();
}

// Camera Touch-Look Logic
let lookTouchId = null;
let lastTouchX = 0, lastTouchY = 0;
let euler = new THREE.Euler(0, 0, 0, 'YXZ');

touchLookArea.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  lookTouchId = touch.identifier;
  lastTouchX = touch.clientX;
  lastTouchY = touch.clientY;
}, { passive: false });

touchLookArea.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];
    if (touch.identifier === lookTouchId) {
      const deltaX = touch.clientX - lastTouchX;
      const deltaY = touch.clientY - lastTouchY;
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;

      euler.setFromQuaternion(camera.quaternion);
      euler.y -= deltaX * 0.004;
      euler.x -= deltaY * 0.004;
      euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.x));
      camera.quaternion.setFromEuler(euler);
      break;
    }
  }
}, { passive: false });

const resetLook = () => { lookTouchId = null; };
touchLookArea.addEventListener('touchend', resetLook);
touchLookArea.addEventListener('touchcancel', resetLook);

// Action Button Event Listeners (fire supports press-and-hold continuous fire)
document.getElementById('btn-fire').addEventListener('touchstart', (e) => { e.preventDefault(); startFiring(); });
document.getElementById('btn-fire').addEventListener('touchend', (e) => { e.preventDefault(); stopFiring(); });
document.getElementById('btn-fire').addEventListener('touchcancel', (e) => { e.preventDefault(); stopFiring(); });
document.getElementById('btn-jump').addEventListener('touchstart', (e) => { e.preventDefault(); jump(); });
document.getElementById('btn-crouch').addEventListener('touchstart', (e) => { e.preventDefault(); toggleCrouch(); });
document.getElementById('btn-gloo').addEventListener('touchstart', (e) => { e.preventDefault(); deployGlooWall(); });
document.getElementById('btn-medkit').addEventListener('touchstart', (e) => { e.preventDefault(); startHealing(); });
document.getElementById('btn-reload').addEventListener('touchstart', (e) => { e.preventDefault(); reload(); });

// ============================================================
// First-person weapon viewmodel (procedural, no external models).
// The mesh rebuilds per weapon; human forearms/hands are always
// attached so the local player looks like a real person, not a
// floating gun.
// ============================================================
const weaponGroup = new THREE.Group();
weaponGroup.position.set(0.28, -0.28, -0.55);
camera.add(weaponGroup);
scene.add(camera);

const skinMat = new THREE.MeshStandardMaterial({ color: 0xd8ad82, roughness: 0.82 });
const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2f, roughness: 0.7 });

function buildWeaponMesh(key) {
  const w = WEAPONS[key];
  const group = new THREE.Group();
  const gunMetal = new THREE.MeshStandardMaterial({ color: w.color, metalness: 0.7, roughness: 0.35 });
  const gunAccent = new THREE.MeshStandardMaterial({ color: 0xff6a00, emissive: 0xff4500, emissiveIntensity: 0.4, metalness: 0.3, roughness: 0.4 });

  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, w.bodyLen), gunMetal);
  group.add(gunBody);

  const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, w.barrelLen, 10), gunMetal);
  gunBarrel.rotation.x = Math.PI / 2;
  gunBarrel.position.set(0, 0.02, -(w.bodyLen / 2 + w.barrelLen / 2));
  group.add(gunBarrel);

  const gunGrip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.12), gunMetal);
  gunGrip.position.set(0, -0.16, w.bodyLen * 0.3);
  gunGrip.rotation.x = 0.35;
  group.add(gunGrip);

  const gunMag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.1), gunMetal);
  gunMag.position.set(0, -0.14, w.bodyLen * 0.02);
  gunMag.rotation.x = -0.2;
  group.add(gunMag);

  const gunStripe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.02, 0.2), gunAccent);
  gunStripe.position.set(0, 0.075, w.bodyLen * 0.1);
  group.add(gunStripe);

  if (w.category === 'Sniper') {
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.3, 10),
      new THREE.MeshStandardMaterial({ color: 0x0f0f0f, metalness: 0.6, roughness: 0.3 })
    );
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.14, -0.05);
    group.add(scope);
  }

  // Human forearms + hands so the weapon reads as held, not floating
  const foreArmGeo = new THREE.CapsuleGeometry(0.06, 0.3, 4, 8);
  const rightArm = new THREE.Mesh(foreArmGeo, sleeveMat);
  rightArm.rotation.z = Math.PI / 2.05;
  rightArm.position.set(0.03, -0.17, w.bodyLen * 0.24);
  group.add(rightArm);

  const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), skinMat);
  rightHand.position.set(0, -0.17, w.bodyLen * 0.34);
  group.add(rightHand);

  const leftArm = new THREE.Mesh(foreArmGeo, sleeveMat);
  leftArm.rotation.z = Math.PI / 2.25;
  leftArm.rotation.y = 0.2;
  leftArm.position.set(-0.03, -0.04, -(w.bodyLen * 0.12));
  group.add(leftArm);

  const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), skinMat);
  leftHand.position.set(0, -0.02, -(w.bodyLen * 0.28));
  group.add(leftHand);

  group.traverse((obj) => { if (obj.isMesh) obj.castShadow = true; });
  return group;
}

let weaponMesh = buildWeaponMesh(selectedWeaponKey);
weaponGroup.add(weaponMesh);

const muzzleLight = new THREE.PointLight(0xffaa33, 0, 6, 2);
weaponGroup.add(muzzleLight);

const muzzleFlash = new THREE.Mesh(
  new THREE.PlaneGeometry(0.25, 0.25),
  new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0, side: THREE.DoubleSide })
);
weaponGroup.add(muzzleFlash);

function updateMuzzlePosition() {
  const w = WEAPONS[selectedWeaponKey];
  const z = -(w.bodyLen / 2 + w.barrelLen + 0.05);
  muzzleLight.position.set(0, 0.02, z);
  muzzleFlash.position.set(0, 0.02, z - 0.03);
}
updateMuzzlePosition();

function setWeapon(key) {
  selectedWeaponKey = key;
  weaponGroup.remove(weaponMesh);
  weaponMesh = buildWeaponMesh(key);
  weaponGroup.add(weaponMesh);
  updateMuzzlePosition();
  currentAmmo = MAG_SIZE;
  ammoCountEl.innerText = currentAmmo;
  ammoMaxEl.innerText = MAG_SIZE;
}

let recoilTime = 0;
const RECOIL_DURATION = 0.14;

function triggerRecoil() {
  recoilTime = RECOIL_DURATION;
  muzzleLight.intensity = 8;
  muzzleFlash.material.opacity = 0.9;
  crosshairEl.classList.add('fire');
  setTimeout(() => crosshairEl.classList.remove('fire'), 90);
}

// ============================================================
// Abilities & Shooting Mechanics
// ============================================================
const glooWalls = [];
function deployGlooWall() {
  if (glooWallsLeft <= 0 || !isRoundActive) return;
  glooWallsLeft--;
  glooEl.innerText = glooWallsLeft;

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(5, 4, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.75, emissive: 0x00e5ff, emissiveIntensity: 0.15 })
  );
  wall.position.set(camera.position.x + dir.x * 4, 2, camera.position.z + dir.z * 4);
  wall.rotation.y = Math.atan2(dir.x, dir.z);
  wall.castShadow = true;
  scene.add(wall);
  glooWalls.push(wall);
  obstacles.push({ x: wall.position.x, z: wall.position.z, hw: 2.5, hd: 0.25, top: 4 });

  if (conn && conn.open) {
    conn.send({ type: 'gloo', x: wall.position.x, y: wall.position.y, z: wall.position.z, ry: wall.rotation.y });
  }
}

function startHealing() {
  if (isHealing || health >= MAX_HP || medKitsLeft <= 0 || !isRoundActive) return;

  isHealing = true;
  healStartTime = performance.now();
  healBarContainer.classList.remove('hidden');
  playHealTone();

  healProgressInterval = setInterval(() => {
    const elapsed = performance.now() - healStartTime;
    healProgress.style.width = Math.min((elapsed / HEAL_DURATION) * 100, 100) + '%';
  }, 50);

  healTimer = setTimeout(() => {
    health = Math.min(health + 100, MAX_HP);
    updateHpUI();
    medKitsLeft--;
    medkitEl.innerText = medKitsLeft;
    cancelHealing();
  }, HEAL_DURATION);
}

function cancelHealing() {
  isHealing = false;
  clearTimeout(healTimer);
  clearInterval(healProgressInterval);
  healProgress.style.width = '0%';
  healBarContainer.classList.add('hidden');
}

function updateHpUI() {
  hpEl.innerText = health;
  hpBarInner.style.width = (Math.max(health, 0) / MAX_HP) * 100 + '%';
}

function updateAmmoUI() {
  ammoCountEl.innerText = currentAmmo;
  ammoMaxEl.innerText = MAG_SIZE;
}

// ---- Reloading ----
function reload() {
  if (isReloading || currentAmmo === MAG_SIZE || !isRoundActive) return;
  isReloading = true;
  stopFiring();
  reloadBarContainer.classList.remove('hidden');
  reloadProgress.style.width = '0%';
  const startedAt = performance.now();

  const tick = setInterval(() => {
    const pct = Math.min(((performance.now() - startedAt) / RELOAD_TIME) * 100, 100);
    reloadProgress.style.width = pct + '%';
  }, 40);

  setTimeout(() => {
    clearInterval(tick);
    currentAmmo = MAG_SIZE;
    isReloading = false;
    reloadBarContainer.classList.add('hidden');
    reloadProgress.style.width = '0%';
    updateAmmoUI();
  }, RELOAD_TIME);
}

// ---- Firing (press and hold; automatics keep firing via the game loop) ----
const bullets = [];

function startFiring() {
  if (!gameStarted) return;
  isFiring = true;
  shoot(); // immediate first round, then the loop handles auto fire
}
function stopFiring() {
  isFiring = false;
}

window.addEventListener('mousedown', (e) => {
  if (controls.isLocked && e.button === 0) startFiring();
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) stopFiring();
});

function shoot() {
  if (!isRoundActive || !gameStarted || isReloading) return;

  const weapon = WEAPONS[selectedWeaponKey];
  const now = performance.now() / 1000;
  if (now - lastShotTime < weapon.fireRate) return; // respect per-weapon cadence

  if (currentAmmo <= 0) {
    reload(); // auto-reload on empty
    return;
  }

  lastShotTime = now;
  currentAmmo--;
  updateAmmoUI();

  ensureAudio();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  const bulletData = {
    x: camera.position.x + dir.x * 0.5,
    y: camera.position.y,
    z: camera.position.z + dir.z * 0.5,
    vx: dir.x * 130, vy: dir.y * 130, vz: dir.z * 130,
    damage: weapon.damage
  };

  spawnBullet(bulletData);
  playGunshot();
  triggerRecoil();
  if (conn && conn.open) conn.send({ type: 'shoot', bullet: bulletData });

  if (currentAmmo === 0) reload();
}

function spawnBullet(data) {
  const dir = new THREE.Vector3(data.vx, data.vy, data.vz).normalize();
  const tracer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6),
    new THREE.MeshBasicMaterial({ color: 0xffaa33 })
  );
  tracer.position.set(data.x, data.y, data.z);
  tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  scene.add(tracer);
  bullets.push({ mesh: tracer, vx: data.vx, vy: data.vy, vz: data.vz, life: 1.2, damage: data.damage || 20 });
}

function showStatusBanner(text, color) {
  statusBannerEl.innerText = text;
  statusBannerEl.style.color = color;
  statusBannerEl.classList.add('show');
  setTimeout(() => statusBannerEl.classList.remove('show'), 1100);
}

function flashDamage() {
  damageFlashEl.classList.add('active');
  setTimeout(() => damageFlashEl.classList.remove('active'), 250);
}

function takeDamage(amount) {
  if (!isRoundActive) return;
  cancelHealing();
  health = Math.max(0, health - amount);
  updateHpUI();
  flashDamage();
  playImpactThud();

  if (health === 0) {
    if (conn && conn.open) conn.send({ type: 'round_win', winner: conn.peer });
    handleRoundEnd('remote');
  }
}

// ============================================================
// Match Scoring & Rounds
// ============================================================
function handleRoundEnd(winner) {
  if (!isRoundActive) return;
  isRoundActive = false;

  if (winner === 'local') {
    localWins++;
    localScoreEl.innerText = localWins;
    showStatusBanner('ROUND WON', '#00ff88');
  } else {
    remoteWins++;
    remoteScoreEl.innerText = remoteWins;
    showStatusBanner('ROUND LOST', '#ff3b3b');
  }

  if (localWins === 5 || remoteWins === 5) {
    endMatch(localWins === 5 ? 'VICTORY' : 'DEFEAT');
    return;
  }

  setTimeout(() => { resetRound(); }, 2000);
}

function resetRound() {
  health = MAX_HP;
  glooWallsLeft = 3;
  medKitsLeft = 2;
  updateHpUI();
  glooEl.innerText = glooWallsLeft;
  medkitEl.innerText = medKitsLeft;

  // Fresh magazine each round
  currentAmmo = MAG_SIZE;
  isReloading = false;
  stopFiring();
  reloadBarContainer.classList.add('hidden');
  updateAmmoUI();

  const spawnZ = isHost ? ROOM_HALF - 8 : -(ROOM_HALF - 8);
  camera.position.set(0, STAND_HEIGHT, spawnZ);
  camera.lookAt(0, STAND_HEIGHT, 0);

  cancelHealing();
  isRoundActive = true;
}

function endMatch(result) {
  if (controls.isLocked) controls.unlock();
  introScreen.classList.remove('hidden');
  lobbyCard.classList.add('hidden');
  gameOverModal.classList.remove('hidden');

  if (result === 'VICTORY') {
    matchTitle.innerText = 'VICTORY!';
    matchTitle.style.color = '#00ff00';
    matchSub.innerText = 'DEEPAN GAMING INDUSTRY CHAMPION';
  } else {
    matchTitle.innerText = 'DEFEAT!';
    matchTitle.style.color = '#ff0055';
    matchSub.innerText = 'Better luck next time!';
  }
}

// ============================================================
// Opponent character models — two original, distinctly-styled
// low-poly operators (not based on any existing game's characters)
// ============================================================
function buildCharacter(accentColor, bodyColor) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6, metalness: 0.25 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.35, roughness: 0.5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.75 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd8ad82, roughness: 0.85 });

  const legGeo = new THREE.CapsuleGeometry(0.17, 0.68, 4, 8);
  const legL = new THREE.Mesh(legGeo, darkMat); legL.position.set(-0.21, 0.52, 0); group.add(legL);
  const legR = new THREE.Mesh(legGeo, darkMat); legR.position.set(0.21, 0.52, 0); group.add(legR);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.58, 4, 8), bodyMat);
  torso.position.set(0, 1.28, 0); group.add(torso);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.1, 0.44), accentMat);
  stripe.position.set(0, 1.38, 0); group.add(stripe);

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.46, 0.2), darkMat);
  pack.position.set(0, 1.3, -0.3); group.add(pack);

  const armGeo = new THREE.CapsuleGeometry(0.12, 0.52, 4, 8);
  const armL = new THREE.Mesh(armGeo, bodyMat); armL.position.set(-0.48, 1.25, 0); armL.rotation.z = 0.22; group.add(armL);
  const armR = new THREE.Mesh(armGeo, bodyMat); armR.position.set(0.48, 1.25, 0); armR.rotation.z = -0.22; group.add(armR);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), skinMat);
  head.position.set(0, 1.87, 0); group.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.09), accentMat);
  visor.position.set(0, 1.9, 0.21); group.add(visor);

  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), accentMat);
  fin.position.set(0, 2.13, -0.04); group.add(fin);

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return group;
}

// "Vanguard" - orange/black tactical rig, "Specter" - cyan/slate stealth rig
const vanguardModel = buildCharacter(0xff6a00, 0x2b2b2f);
const specterModel = buildCharacter(0x00e5ff, 0x232830);
vanguardModel.visible = false;
specterModel.visible = false;
scene.add(vanguardModel, specterModel);

// ============================================================
// PeerJS Networking
// ============================================================
let remotePlayer = vanguardModel; // reassigned to the correct model once a role is known

let peer = null, conn = null, isHost = false;

// ---- Step 1: mode select ----
hostModeBtn.addEventListener('click', () => {
  modeSelectEl.classList.add('hidden');
  hostPanel.classList.remove('hidden');
  startHosting();
});

joinModeBtn.addEventListener('click', () => {
  modeSelectEl.classList.add('hidden');
  joinPanel.classList.remove('hidden');
});

hostBackBtn.addEventListener('click', () => location.reload());
joinBackBtn.addEventListener('click', () => location.reload());

joinCodeInput.addEventListener('input', () => {
  joinCodeInput.value = joinCodeInput.value.replace(/\D/g, '').slice(0, 6);
});

// ---- Host: spin up a peer identified by a short 6-digit room code ----
function generateRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function startHosting() {
  const code = generateRoomCode();
  hostCodeEl.innerText = code;
  hostStatusEl.innerText = 'Generating code\u2026';

  peer = new Peer(code);

  peer.on('open', (id) => {
    hostCodeEl.innerText = id;
    hostStatusEl.innerText = 'Waiting for opponent to join\u2026';
  });

  peer.on('connection', (c) => {
    conn = c;
    isHost = true;
    setupNetwork();
  });

  peer.on('error', (err) => {
    if (err.type === 'unavailable-id') {
      startHosting(); // code collision (rare) - try a fresh one
    } else {
      hostStatusEl.innerText = 'Connection error - please refresh and try again.';
    }
  });
}

// ---- Join: connect to the host's 6-digit room code ----
joinConnectBtn.addEventListener('click', () => {
  const code = joinCodeInput.value.trim();
  if (code.length !== 6) {
    joinStatusEl.innerText = 'Enter the 6-digit code from your opponent.';
    return;
  }

  joinStatusEl.innerText = 'Connecting\u2026';
  joinConnectBtn.disabled = true;

  peer = new Peer();
  peer.on('open', () => {
    conn = peer.connect(code);
    isHost = false;
    setupNetwork();
  });
  peer.on('error', (err) => {
    joinConnectBtn.disabled = false;
    joinStatusEl.innerText = 'Could not connect - check the code and try again.';
  });
});

function setupNetwork() {
  conn.on('open', () => {
    // Host sees the "Specter" model as their opponent; the guest sees "Vanguard".
    remotePlayer = isHost ? specterModel : vanguardModel;
    remotePlayer.visible = true;
    // Note: the round does NOT start here any more - both players go
    // through the weapon shop first, then beginMatch() calls resetRound().
    if (isHost) {
      hostStatusEl.innerText = 'Opponent connected!';
      hostStartBtn.classList.remove('hidden');
    } else {
      joinStatusEl.innerText = 'Connected!';
      joinStartBtn.classList.remove('hidden');
    }
  });

  conn.on('data', (data) => {
    if (data.type === 'state') {
      remotePlayer.position.set(data.x, Math.max(0, data.y - STAND_HEIGHT), data.z);
      remotePlayer.rotation.y = data.ry;
    } else if (data.type === 'shoot') {
      spawnBullet(data.bullet);
    } else if (data.type === 'gloo') {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(5, 4, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.75, emissive: 0x00e5ff, emissiveIntensity: 0.15 })
      );
      wall.position.set(data.x, data.y, data.z);
      wall.rotation.y = data.ry;
      wall.castShadow = true;
      scene.add(wall);
      obstacles.push({ x: data.x, z: data.z, hw: 2.5, hd: 0.25, top: 4 });
    } else if (data.type === 'hit') {
      takeDamage(data.damage);
      playHitMarker();
    } else if (data.type === 'shopReady') {
      remoteShopReady = true;
      if (!localShopReady) shopStatusEl.innerText = 'Opponent is ready - lock in your weapon!';
      checkBothShopReady();
    } else if (data.type === 'round_win') {
      handleRoundEnd(data.winner === peer.id ? 'local' : 'remote');
    }
  });
}

// Sync player transform (30 FPS)
setInterval(() => {
  if (conn && conn.open && gameStarted) {
    conn.send({ type: 'state', x: camera.position.x, y: camera.position.y, z: camera.position.z, ry: camera.rotation.y });
  }
}, 33);

// ============================================================
// Simple AABB collision so players can use crates as real cover
// ============================================================
function resolveCollisions(pos) {
  const radius = 0.5;
  for (const ob of obstacles) {
    if (ob.top !== undefined && currentEyeHeight - 1.0 > ob.top) continue; // above the crate (rough)
    const halfW = ob.hw + radius;
    const halfD = ob.hd + radius;
    const dx = pos.x - ob.x;
    const dz = pos.z - ob.z;
    if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
      const overlapX = halfW - Math.abs(dx);
      const overlapZ = halfD - Math.abs(dz);
      if (overlapX < overlapZ) {
        pos.x = ob.x + Math.sign(dx || 1) * halfW;
      } else {
        pos.z = ob.z + Math.sign(dz || 1) * halfD;
      }
    }
  }
  const bound = ROOM_HALF - 1;
  pos.x = Math.max(-bound, Math.min(bound, pos.x));
  pos.z = Math.max(-bound, Math.min(bound, pos.z));
}

// ============================================================
// Main Game & Physics Loop
// ============================================================
function animate() {
  requestAnimationFrame(animate);
  const time = performance.now();
  const delta = Math.min((time - prevTime) / 1000, 0.1);
  prevTime = time;

  // Recoil recovery
  if (recoilTime > 0) {
    recoilTime -= delta;
    const t = Math.max(recoilTime / RECOIL_DURATION, 0);
    weaponGroup.position.z = -0.55 + t * 0.12;
    weaponGroup.rotation.x = -t * 0.25;
    muzzleLight.intensity = 8 * t;
    muzzleFlash.material.opacity = 0.9 * t;
  } else {
    weaponGroup.position.z = -0.55;
    weaponGroup.rotation.x = 0;
  }

  // Smooth crouch height
  const targetHeight = isCrouching ? CROUCH_HEIGHT : STAND_HEIGHT;
  currentEyeHeight += (targetHeight - currentEyeHeight) * Math.min(delta * 10, 1);

  // Smooth aim-down-sights FOV
  const targetFov = isAiming ? BASE_FOV - 20 : BASE_FOV;
  camera.fov += (targetFov - camera.fov) * Math.min(delta * 12, 1);
  camera.updateProjectionMatrix();

  if (gameStarted) {
    // Gravity and Jumping
    velocityY -= GRAVITY * delta;
    camera.position.y += velocityY * delta;

    if (camera.position.y <= currentEyeHeight) {
      camera.position.y = currentEyeHeight;
      velocityY = 0;
      isGrounded = true;
    }

    // Combine PC + Touch Joystick Movement
    const moveZ = (moveState.forward ? 1 : 0) - (moveState.backward ? 1 : 0);
    const moveX = (moveState.right ? 1 : 0) - (moveState.left ? 1 : 0);
    const speed = (isCrouching ? 6 : sprinting ? 16 : 11);

    if (moveZ !== 0 || moveX !== 0) {
      const moveVector = new THREE.Vector3(moveX, 0, -moveZ).normalize();
      moveVector.applyQuaternion(camera.quaternion);
      moveVector.y = 0;

      const prevPos = camera.position.clone();
      camera.position.addScaledVector(moveVector, speed * delta);
      resolveCollisions(camera.position);

      // View bob (applied to the weapon viewmodel only, so it never fights ground collision)
      bobPhase += delta * (sprinting ? 14 : 9);
      const bobAmount = isGrounded ? 0.035 : 0;
      weaponGroup.position.y = -0.28 + Math.sin(bobPhase) * bobAmount;
    } else {
      resolveCollisions(camera.position);
      weaponGroup.position.y += (-0.28 - weaponGroup.position.y) * Math.min(delta * 8, 1);
    }

    // Continuous fire for automatic weapons while the trigger is held
    if (isFiring && WEAPONS[selectedWeaponKey].auto) shoot();
  }

  // Update Bullets & Hit Detection
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.mesh.position.x += b.vx * delta;
    b.mesh.position.y += b.vy * delta;
    b.mesh.position.z += b.vz * delta;

    // Hit-test against the character model's torso height, not its
    // ground-level origin (the model now stands with feet at y=0).
    if (remotePlayer.visible) {
      const targetCenter = new THREE.Vector3(remotePlayer.position.x, remotePlayer.position.y + 1.25, remotePlayer.position.z);
      if (b.mesh.position.distanceTo(targetCenter) < 1.3) {
        scene.remove(b.mesh);
        bullets.splice(i, 1);
        if (conn && conn.open) conn.send({ type: 'hit', damage: b.damage });
        continue;
      }
    }

    b.life -= delta;
    if (b.life <= 0) { scene.remove(b.mesh); bullets.splice(i, 1); }
  }

  composer.render();
}

updateHpUI();
animate();
