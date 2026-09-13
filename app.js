import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- UI Elements ---
const myIdEl = document.getElementById('my-id');
const joinInput = document.getElementById('join-id');
const joinBtn = document.getElementById('join-btn');
const startBtn = document.getElementById('start-btn');
const introScreen = document.getElementById('intro-screen');
const lobbyCard = document.getElementById('lobby-card');
const gameOverModal = document.getElementById('game-over-modal');
const matchTitle = document.getElementById('match-result-title');
const matchSub = document.getElementById('match-result-sub');

const hpEl = document.getElementById('hp');
const glooEl = document.getElementById('gloo-count');
const medkitEl = document.getElementById('medkit-count');
const localScoreEl = document.getElementById('local-score');
const remoteScoreEl = document.getElementById('remote-score');
const healBarContainer = document.getElementById('heal-bar-container');
const healProgress = document.getElementById('heal-progress');

// --- 1. Scene & Arena Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a10);
scene.fog = new THREE.FogExp2(0x0a0a10, 0.015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 22);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const spotlight = new THREE.SpotLight(0xff4500, 1.5, 100, Math.PI / 3);
spotlight.position.set(0, 30, 0);
scene.add(spotlight);

// Arena Ground
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ color: 0x1f1f24, roughness: 0.5 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Obstacles
const containerGeo = new THREE.BoxGeometry(6, 4, 12);
const redMat = new THREE.MeshStandardMaterial({ color: 0xb22222 });
const blueMat = new THREE.MeshStandardMaterial({ color: 0x4682b4 });

function addObstacle(geo, mat, x, z, ry = 0) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, 2, z);
  mesh.rotation.y = ry;
  scene.add(mesh);
}
addObstacle(containerGeo, redMat, -10, 0);
addObstacle(containerGeo, blueMat, 10, 0);
addObstacle(new THREE.BoxGeometry(4, 4, 4), redMat, 0, -6);

// --- 2. Game & Player State ---
let health = 100;
let glooWallsLeft = 3;
let medKitsLeft = 2;
let localWins = 0;
let remoteWins = 0;
let isRoundActive = false;
let gameStarted = false;

// Physics
let velocityY = 0;
let isGrounded = true;
const GRAVITY = 25;
const JUMP_FORCE = 9;

// Healing State
let isHealing = false;
let healTimer = null;
let healProgressInterval = null;
let healStartTime = 0;
const HEAL_DURATION = 3000;

const controls = new PointerLockControls(camera, renderer.domElement);

startBtn.addEventListener('click', () => {
  gameStarted = true;
  isRoundActive = true;
  introScreen.classList.add('hidden');
  if (!isMobileDevice()) controls.lock();
});

const moveState = { forward: false, backward: false, left: false, right: false };
const velocity = new THREE.Vector3();
let prevTime = performance.now();

// Keyboard Listeners (PC)
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE') deployGlooWall();
  if (e.code === 'KeyF') startHealing();
  if (e.code === 'Space') jump();
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code) && isHealing) cancelHealing();
  handleKey(e.code, true);
});
window.addEventListener('keyup', (e) => handleKey(e.code, false));

function handleKey(code, state) {
  switch (code) {
    case 'KeyW': moveState.forward = state; break;
    case 'KeyS': moveState.backward = state; break;
    case 'KeyA': moveState.left = state; break;
    case 'KeyD': moveState.right = state; break;
  }
}

function jump() {
  if (isGrounded && gameStarted && isRoundActive) {
    velocityY = JUMP_FORCE;
    isGrounded = false;
  }
}

// --- 3. Mobile Touch & Virtual Joystick Logic ---
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

  // Update Move Flags
  moveState.forward = joystickVector.y < -0.2;
  moveState.backward = joystickVector.y > 0.2;
  moveState.left = joystickVector.x < -0.2;
  moveState.right = joystickVector.x > 0.2;

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

// Action Button Event Listeners
document.getElementById('btn-fire').addEventListener('touchstart', (e) => { e.preventDefault(); shoot(); });
document.getElementById('btn-jump').addEventListener('touchstart', (e) => { e.preventDefault(); jump(); });
document.getElementById('btn-gloo').addEventListener('touchstart', (e) => { e.preventDefault(); deployGlooWall(); });
document.getElementById('btn-medkit').addEventListener('touchstart', (e) => { e.preventDefault(); startHealing(); });

// --- 4. Abilities & Shooting Mechanics ---
const glooWalls = [];
function deployGlooWall() {
  if (glooWallsLeft <= 0 || !isRoundActive) return;
  glooWallsLeft--;
  glooEl.innerText = glooWallsLeft;

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(5, 4, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.8 })
  );
  wall.position.set(camera.position.x + dir.x * 4, 2, camera.position.z + dir.z * 4);
  wall.rotation.y = Math.atan2(dir.x, dir.z);
  scene.add(wall);
  glooWalls.push(wall);

  if (conn && conn.open) {
    conn.send({ type: 'gloo', x: wall.position.x, y: wall.position.y, z: wall.position.z, ry: wall.rotation.y });
  }
}

function startHealing() {
  if (isHealing || health >= 100 || medKitsLeft <= 0 || !isRoundActive) return;

  isHealing = true;
  healStartTime = performance.now();
  healBarContainer.classList.remove('hidden');

  healProgressInterval = setInterval(() => {
    const elapsed = performance.now() - healStartTime;
    healProgress.style.width = Math.min((elapsed / HEAL_DURATION) * 100, 100) + '%';
  }, 50);

  healTimer = setTimeout(() => {
    health = Math.min(health + 75, 100);
    hpEl.innerText = health;
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

const bullets = [];
window.addEventListener('mousedown', (e) => {
  if (controls.isLocked && e.button === 0) shoot();
});

function shoot() {
  if (!isRoundActive) return;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  const bulletData = {
    x: camera.position.x + dir.x * 0.5,
    y: camera.position.y,
    z: camera.position.z + dir.z * 0.5,
    vx: dir.x * 70, vy: dir.y * 70, vz: dir.z * 70
  };

  spawnBullet(bulletData);
  if (conn && conn.open) conn.send({ type: 'shoot', bullet: bulletData });
}

function spawnBullet(data) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff4500 }));
  mesh.position.set(data.x, data.y, data.z);
  scene.add(mesh);
  bullets.push({ mesh, vx: data.vx, vy: data.vy, vz: data.vz, life: 1.5 });
}

function takeDamage(amount) {
  if (!isRoundActive) return;
  cancelHealing();
  health = Math.max(0, health - amount);
  hpEl.innerText = health;

  if (health === 0) {
    if (conn && conn.open) conn.send({ type: 'round_win', winner: conn.peer });
    handleRoundEnd('remote');
  }
}

// --- 5. Match Scoring & Rounds ---
function handleRoundEnd(winner) {
  if (!isRoundActive) return;
  isRoundActive = false;

  if (winner === 'local') {
    localWins++;
    localScoreEl.innerText = localWins;
  } else {
    remoteWins++;
    remoteScoreEl.innerText = remoteWins;
  }

  if (localWins === 5 || remoteWins === 5) {
    endMatch(localWins === 5 ? 'VICTORY' : 'DEFEAT');
    return;
  }

  setTimeout(() => { resetRound(); }, 2000);
}

function resetRound() {
  health = 100;
  glooWallsLeft = 3;
  medKitsLeft = 2;
  hpEl.innerText = health;
  glooEl.innerText = glooWallsLeft;
  medkitEl.innerText = medKitsLeft;

  const spawnZ = isHost ? 22 : -22;
  camera.position.set(0, 1.6, spawnZ);
  camera.lookAt(0, 1.6, 0);

  cancelHealing();
  isRoundActive = true;
}

function endMatch(result) {
  if (controls.isLocked) controls.unlock();
  introScreen.classList.remove('hidden');
  lobbyCard.classList.add('hidden');
  gameOverModal.classList.remove('hidden');

  if (result === 'VICTORY') {
    matchTitle.innerText = "VICTORY! BOOYAH!";
    matchTitle.style.color = "#00ff00";
    matchSub.innerText = "DEEPAN GAMING INDUSTRY CHAMPION";
  } else {
    matchTitle.innerText = "DEFEAT!";
    matchTitle.style.color = "#ff0055";
    matchSub.innerText = "Better luck next time!";
  }
}

// --- 6. PeerJS Networking ---
const remotePlayer = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.8, 1.8, 4, 8),
  new THREE.MeshStandardMaterial({ color: 0xff0000 })
);
remotePlayer.visible = false;
scene.add(remotePlayer);

let peer = null, conn = null, peerReady = false, isHost = false;
peer = new Peer();

peer.on('open', (id) => {
  myIdEl.innerText = id;
  peerReady = true;
});

peer.on('connection', (c) => { 
  conn = c; 
  isHost = true;
  setupNetwork(); 
});

joinBtn.addEventListener('click', () => {
  const tid = joinInput.value.trim();
  if (tid) { 
    conn = peer.connect(tid); 
    isHost = false;
    setupNetwork(); 
  }
});

function setupNetwork() {
  conn.on('open', () => { 
    remotePlayer.visible = true; 
    resetRound();
  });

  conn.on('data', (data) => {
    if (data.type === 'state') {
      remotePlayer.position.set(data.x, data.y - 0.9, data.z);
      remotePlayer.rotation.y = data.ry;
    } else if (data.type === 'shoot') {
      spawnBullet(data.bullet);
    } else if (data.type === 'gloo') {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(5, 4, 0.5), 
        new THREE.MeshStandardMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.8 })
      );
      wall.position.set(data.x, data.y, data.z);
      wall.rotation.y = data.ry;
      scene.add(wall);
    } else if (data.type === 'hit') {
      takeDamage(data.damage);
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

// --- 7. Main Game & Physics Loop ---
function animate() {
  requestAnimationFrame(animate);
  const time = performance.now();
  const delta = Math.min((time - prevTime) / 1000, 0.1);
  prevTime = time;

  if (gameStarted && isRoundActive) {
    // Gravity and Jumping
    velocityY -= GRAVITY * delta;
    camera.position.y += velocityY * delta;

    if (camera.position.y <= 1.6) {
      camera.position.y = 1.6;
      velocityY = 0;
      isGrounded = true;
    }

    // Combine PC + Touch Joystick Movement
    const moveZ = (moveState.forward ? 1 : 0) - (moveState.backward ? 1 : 0);
    const moveX = (moveState.right ? 1 : 0) - (moveState.left ? 1 : 0);

    if (moveZ !== 0 || moveX !== 0) {
      const moveVector = new THREE.Vector3(moveX, 0, -moveZ).normalize();
      moveVector.applyQuaternion(camera.quaternion);
      moveVector.y = 0; // Lock movement to ground plane
      camera.position.addScaledVector(moveVector, 12 * delta);
    }
  }

  // Update Bullets & Hit Detection
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.mesh.position.x += b.vx * delta;
    b.mesh.position.y += b.vy * delta;
    b.mesh.position.z += b.vz * delta;

    if (remotePlayer.visible && b.mesh.position.distanceTo(remotePlayer.position) < 1.4) {
      scene.remove(b.mesh);
      bullets.splice(i, 1);
      if (conn && conn.open) conn.send({ type: 'hit', damage: 25 });
      continue;
    }

    b.life -= delta;
    if (b.life <= 0) { scene.remove(b.mesh); bullets.splice(i, 1); }
  }

  renderer.render(scene, camera);
}

animate();
