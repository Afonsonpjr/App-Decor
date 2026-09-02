import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const sceneHost = $('scene');
const statusEl = $('status');
const loadingEl = $('loading');
const productList = $('productList');
const inspector = $('inspector');
const productImage = $('productImage');
const productTitle = $('productTitle');
const productDescription = $('productDescription');
const selectedName = $('selectedName');

const FALLBACK_CATALOG = {
  products: [
    { id: 'topazio', name: 'Topázio', hex: '#9A7350', mockup: 'assets/mockups/topazio.jpg', texture: 'assets/textures/topazio-albedo.jpg', description: 'Efeito mineral Quartzo Mica em tonalidade quente para parede e piso.' },
    { id: 'off-white', name: 'Off-White', hex: '#C8C0B5', mockup: 'assets/mockups/off-white.jpg', texture: 'assets/textures/off-white-albedo.jpg', description: 'Tonalidade clara e versátil que destaca o acabamento mineral.' },
    { id: 'bianco', name: 'Bianco', hex: '#D1CDCA', mockup: 'assets/mockups/bianco.jpg', texture: 'assets/textures/bianco-albedo.jpg', description: 'Acabamento mineral claro, elegante e contemporâneo.' },
    { id: 'olho-de-tigre', name: 'Olho de Tigre', hex: '#8E6746', mockup: 'assets/mockups/olho-de-tigre.jpg', texture: 'assets/textures/olho-de-tigre-albedo.jpg', description: 'Tonalidade terrosa profunda, inspirada em minerais naturais.' },
    { id: 'onix', name: 'Ônix', hex: '#252526', mockup: 'assets/mockups/onix.jpg', texture: 'assets/textures/onix-albedo.jpg', description: 'Acabamento escuro e sofisticado para contrastes marcantes.' },
    { id: 'jaspe', name: 'Jaspe', hex: '#806147', mockup: 'assets/mockups/jaspe.jpg', texture: 'assets/textures/jaspe-albedo.jpg', description: 'Tom orgânico e acolhedor para composições naturais.' }
  ],
  referenceTextures: { mineral: 'assets/textures/minerio.jpg', floor: 'assets/textures/quartzo-mica-piso.jpg' }
};

function on(id, event, callback) {
  const element = $(id);
  if (!element) return console.warn(`[Decor Colors] #${id} não existe.`);
  element.addEventListener(event, callback);
}
function notify(message) { if (statusEl) statusEl.textContent = message; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function setActive(id, active) { $(id)?.classList.toggle('active', active); }

if (!sceneHost) throw new Error('Elemento #scene ausente no index.html');

const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
sceneHost.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#101312');
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 120);
camera.rotation.order = 'YXZ';
camera.position.set(0, 1.65, 6.1);
const showroom = new THREE.Group();
scene.add(showroom);
scene.add(new THREE.HemisphereLight(0xfff8e7, 0x1c2322, 1.55));
const keyLight = new THREE.DirectionalLight(0xffe6b3, 2.4);
keyLight.position.set(-4, 8, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);
const fillLight = new THREE.PointLight(0xe7c56e, 25, 11, 2);
fillLight.position.set(0, 3, -3.4);
scene.add(fillLight);

let catalog = FALLBACK_CATALOG;
let selectedProduct = FALLBACK_CATALOG.products[0];
let currentSurface = 'wall';
let appState = 'NORMAL';
let wallMaterial;
let floorMaterial;
let sampleMaterial;
let xrMode = null;
let hitTestSource = null;
let floorSpace = null;
let arPlaced = false;
let reticleSamples = [];
const pickables = [];
const floorTargets = [];
const colliders = [];
const keys = {};
const inputAxis = new THREE.Vector2();
const velocity = new THREE.Vector3();
const desiredVelocity = new THREE.Vector3();
const teleportTarget = new THREE.Vector3();
let teleporting = false;
let yaw = 0;
let pitch = -0.03;
let tourIndex = 0;

function material(color, roughness = 0.7, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function addMesh(geometry, mat, x = 0, y = 0, z = 0, parent = showroom) {
  const object = new THREE.Mesh(geometry, mat);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}
function addBox(width, height, depth, mat, x, y, z, parent = showroom) {
  return addMesh(new THREE.BoxGeometry(width, height, depth), mat, x, y, z, parent);
}
function textTexture(title, subtitle = '') {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#121514';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#e9c66b';
  ctx.lineWidth = 8;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
  ctx.fillStyle = '#f6f2e9';
  ctx.font = 'bold 72px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, canvas.width / 2, 88);
  ctx.fillStyle = '#e9c66b';
  ctx.font = 'bold 27px Arial';
  ctx.fillText(subtitle, canvas.width / 2, 153);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function addCollider(x, z, width, depth) {
  colliders.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 });
}
function createCan(product, parent) {
  const group = new THREE.Group();
  parent.add(group);
  const body = addMesh(new THREE.CylinderGeometry(.29, .31, .62, 28), material('#f0f0eb', .31, .05), 0, .31, 0, group);
  const label = addMesh(new THREE.CylinderGeometry(.315, .315, .36, 28), material(product.hex, .46), 0, .31, 0, group);
  const lid = addMesh(new THREE.CylinderGeometry(.29, .30, .06, 28), material('#171918', .22, .73), 0, .65, 0, group);
  [body, label, lid].forEach(item => { item.userData.product = product; pickables.push(item); });
  return group;
}
function createPedestal(product, index) {
  const group = new THREE.Group();
  showroom.add(group);
  const angle = (index / catalog.products.length) * Math.PI * 2 + 0.2;
  const radius = 4.5;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius - .25;
  group.position.set(x, 0, z);
  group.rotation.y = -angle + Math.PI / 2;
  const base = addBox(1.1, .64, 1.1, material('#2d302e', .55, .05), 0, .32, 0, group);
  const top = addBox(.92, .08, .92, material(product.hex, .33, .1), 0, .68, 0, group);
  base.userData.product = product;
  top.userData.product = product;
  pickables.push(base, top);
  const can = createCan(product, group);
  can.position.y = .69;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.45, .31), new THREE.MeshBasicMaterial({ map: textTexture(product.name.toUpperCase()), transparent: true }));
  plane.position.set(0, 1.70, -.01);
  plane.rotation.y = Math.PI;
  group.add(plane);
  addCollider(x, z, 1.35, 1.35);
}
function buildShowroom() {
  const W = 17, D = 15, H = 5;
  floorMaterial = material('#79736c', .48, .04);
  wallMaterial = material('#9e8d7d', .62, .02);
  sampleMaterial = material('#615b54', .55, .02);
  const dark = material('#171a18', .82);
  const trim = material('#b99442', .33, .65);
  const floor = addBox(W, .12, D, floorMaterial, 0, 0, 0);
  floorTargets.push(floor);
  addBox(W, .1, D, material('#242625', .9), 0, H, 0);
  addBox(W, H, .18, wallMaterial, 0, H / 2, -D / 2);
  addBox(W, H, .18, dark, 0, H / 2, D / 2);
  addBox(.18, H, D, dark, -W / 2, H / 2, 0);
  addBox(.18, H, D, dark, W / 2, H / 2, 0);
  addBox(W, .12, .12, trim, 0, .12, -D / 2 + .14);
  addBox(W, .12, .12, trim, 0, .12, D / 2 - .14);
  addBox(.12, .12, D, trim, -W / 2 + .14, .12, 0);
  addBox(.12, .12, D, trim, W / 2 - .14, .12, 0);
  addBox(9.7, 3.25, .09, wallMaterial, 0, 2.05, -D / 2 + .29);
  const displayFloor = addBox(4.5, .03, 3.1, sampleMaterial, 0, .09, -4.65);
  floorTargets.push(displayFloor);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 1.46), new THREE.MeshBasicMaterial({ map: textTexture('decor colors', 'QUARTZO MICA') }));
  sign.position.set(0, 3.45, -D / 2 + .19);
  showroom.add(sign);
  for (const [x, z] of [[-5,-3],[5,-3],[-5,3],[5,3],[0,0]]) {
    addBox(2.1, .04, .28, new THREE.MeshBasicMaterial({ color: '#fff1c6' }), x, H - .04, z);
    const light = new THREE.PointLight(0xffe4b0, 10, 6, 2);
    light.position.set(x, H - .18, z);
    showroom.add(light);
  }
  addBox(5.3, .82, 1.1, material('#372f26', .6), 0, .42, 5.7);
  addBox(5.6, .1, 1.28, material('#80684e', .42), 0, .87, 5.7);
  addCollider(0, 5.7, 5.7, 1.55);
  catalog.products.forEach(createPedestal);
}

function loadTexture(url, repeatX, repeatY, callback) {
  if (!url) return;
  new THREE.TextureLoader().load(url, texture => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    callback(texture);
  }, undefined, () => console.warn(`[Decor Colors] Textura não encontrada: ${url}`));
}
function surfaceMaterial(surface) {
  return surface === 'wall' ? wallMaterial : surface === 'floor' ? floorMaterial : sampleMaterial;
}
function applyTexture(url, surface) {
  const target = surfaceMaterial(surface);
  if (!target || !url) return;
  const repeat = surface === 'wall' ? [2.2, 1.15] : surface === 'floor' ? [3.2, 3.2] : [1, 1];
  loadTexture(url, repeat[0], repeat[1], texture => {
    target.map = texture;
    target.color.set('#ffffff');
    target.needsUpdate = true;
  });
}
function applyProduct(product, surface = currentSurface) {
  if (!product) return;
  selectedProduct = product;
  currentSurface = surface;
  const target = surfaceMaterial(surface);
  if (target) {
    target.map = null;
    target.color.set(product.hex);
    target.roughness = surface === 'wall' ? .55 : surface === 'floor' ? .40 : .48;
    target.metalness = .04;
    applyTexture(product.texture, surface);
  }
  setActive('wallMode', surface === 'wall');
  setActive('floorMode', surface === 'floor');
  document.querySelectorAll('.product-item').forEach(button => button.classList.toggle('active', button.dataset.id === product.id));
  if (selectedName) selectedName.textContent = product.name;
  if (productImage) productImage.src = product.mockup;
  if (productTitle) productTitle.textContent = product.name;
  if (productDescription) productDescription.textContent = product.description;
  inspector?.classList.add('open');
  cancelTeleport();
  notify(`${product.name} aplicado somente em ${surface === 'wall' ? 'parede' : 'piso'}.`);
}
function buildProductList() {
  if (!productList) return;
  productList.innerHTML = '';
  catalog.products.forEach(product => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'product-item';
    button.dataset.id = product.id;
    const image = document.createElement('img');
    image.src = product.mockup;
    image.alt = product.name;
    image.onerror = () => image.style.opacity = '.18';
    const caption = document.createElement('span');
    caption.textContent = product.name;
    const dot = document.createElement('i');
    dot.style.background = product.hex;
    caption.appendChild(dot);
    button.append(image, caption);
    button.addEventListener('click', () => applyProduct(product));
    productList.appendChild(button);
  });
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function isWalkable(position) {
  const margin = .36;
  if (position.x < -7.7 || position.x > 7.7 || position.z < -6.7 || position.z > 6.7) return false;
  return !colliders.some(box => position.x > box.minX - margin && position.x < box.maxX + margin && position.z > box.minZ - margin && position.z < box.maxZ + margin);
}
function cancelTeleport() {
  teleporting = false;
  teleportTarget.set(0, 0, 0);
}
function startTeleport(point) {
  const target = new THREE.Vector3(point.x, 1.65, point.z);
  if (!isWalkable(target)) {
    notify('Esse ponto está ocupado por um expositor. Escolha uma área livre do piso.');
    return;
  }
  teleportTarget.copy(target);
  teleporting = true;
  appState = 'TELEPORTANDO';
  velocity.set(0, 0, 0);
  notify('Movendo até o ponto selecionado…');
}
function pick(normalizedX, normalizedY) {
  pointer.set(normalizedX, normalizedY);
  raycaster.setFromCamera(pointer, camera);
  const productHit = raycaster.intersectObjects(pickables, false)[0];
  if (productHit?.object?.userData?.product) {
    applyProduct(productHit.object.userData.product);
    return;
  }
  const floorHit = raycaster.intersectObjects(floorTargets, false)[0];
  if (floorHit && appState === 'NORMAL') startTeleport(floorHit.point);
}

window.addEventListener('keydown', event => {
  keys[event.code] = true;
  if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)) {
    cancelTeleport();
    if (appState === 'TOUR') stopTour();
  }
});
window.addEventListener('keyup', event => keys[event.code] = false);
renderer.domElement.addEventListener('click', event => {
  if (xrMode) return;
  if (!isTouch && document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock();
  const rect = renderer.domElement.getBoundingClientRect();
  pick(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
});
window.addEventListener('mousemove', event => {
  if (document.pointerLockElement !== renderer.domElement || xrMode) return;
  yaw -= event.movementX * .0022;
  pitch = clamp(pitch - event.movementY * .0022, -1.34, 1.34);
});
document.addEventListener('pointerlockchange', () => document.body.classList.toggle('locked', document.pointerLockElement === renderer.domElement));

let touchState = null;
renderer.domElement.addEventListener('touchstart', event => {
  if (xrMode) return;
  const t = event.changedTouches[0];
  touchState = { id: t.identifier, x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, distance: 0 };
}, { passive: true });
renderer.domElement.addEventListener('touchmove', event => {
  if (!touchState || xrMode) return;
  for (const t of event.changedTouches) if (t.identifier === touchState.id) {
    const dx = t.clientX - touchState.x;
    const dy = t.clientY - touchState.y;
    touchState.distance += Math.abs(dx) + Math.abs(dy);
    yaw -= dx * .004;
    pitch = clamp(pitch - dy * .004, -1.34, 1.34);
    touchState.x = t.clientX;
    touchState.y = t.clientY;
  }
}, { passive: true });
renderer.domElement.addEventListener('touchend', () => {
  if (touchState && touchState.distance < 14 && !xrMode) pick((touchState.sx / innerWidth) * 2 - 1, -(touchState.sy / innerHeight) * 2 + 1);
  touchState = null;
}, { passive: true });

const joystickElement = $('joystick');
const knob = $('knob');
let joystickId = null;
function updateJoystick(touch) {
  if (!joystickElement || !knob) return;
  const rect = joystickElement.getBoundingClientRect();
  const limit = rect.width / 2 - 18;
  let dx = touch.clientX - rect.left - rect.width / 2;
  let dy = touch.clientY - rect.top - rect.height / 2;
  const length = Math.hypot(dx, dy);
  if (length > limit) { dx *= limit / length; dy *= limit / length; }
  inputAxis.set(dx / limit, dy / limit);
  knob.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
  cancelTeleport();
  if (appState === 'TOUR') stopTour();
}
if (joystickElement) {
  joystickElement.addEventListener('touchstart', event => { event.preventDefault(); joystickId = event.changedTouches[0].identifier; updateJoystick(event.changedTouches[0]); }, { passive: false });
  joystickElement.addEventListener('touchmove', event => { event.preventDefault(); for (const t of event.changedTouches) if (t.identifier === joystickId) updateJoystick(t); }, { passive: false });
  const releaseJoystick = () => { joystickId = null; inputAxis.set(0, 0); if (knob) knob.style.transform = 'translate(-50%,-50%)'; };
  joystickElement.addEventListener('touchend', releaseJoystick);
  joystickElement.addEventListener('touchcancel', releaseJoystick);
}

const reticle = new THREE.Mesh(new THREE.RingGeometry(.08, .13, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#e9c66b' }));
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);
const arTools = $('arTools');
const arInstruction = $('arInstruction');
const arButtonIds = ['placeAR','centerAR','scaleDown','scaleUp','resetAR'];
function setARControlsEnabled(value) { arButtonIds.forEach(id => { const button = $(id); if (button) button.disabled = !value; }); }
async function supportsXR(mode) { return Boolean(navigator.xr) && navigator.xr.isSessionSupported(mode).catch(() => false); }
function endXR() {
  hitTestSource?.cancel();
  hitTestSource = null;
  floorSpace = null;
  reticleSamples = [];
  xrMode = null;
  arPlaced = false;
  reticle.visible = false;
  appState = 'NORMAL';
  scene.background = new THREE.Color('#101312');
  showroom.visible = true;
  showroom.position.set(0, 0, 0);
  showroom.rotation.set(0, 0, 0);
  showroom.scale.setScalar(1);
  document.body.classList.remove('ar');
  arTools?.classList.add('hidden');
  notify('Modo normal: showroom pronto.');
}
async function enterAR() {
  if (!await supportsXR('immersive-ar')) { notify('AR indisponível neste aparelho/navegador. Use Chrome Android com ARCore ou modo normal.'); return; }
  try {
    const session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['local-floor', 'dom-overlay'], domOverlay: { root: document.body } });
    xrMode = 'ar';
    appState = 'AR_ESCANEANDO';
    arPlaced = false;
    reticleSamples = [];
    scene.background = null;
    showroom.visible = false;
    document.body.classList.add('ar');
    arTools?.classList.remove('hidden');
    if (arInstruction) arInstruction.textContent = 'Mova o celular lentamente apontando para uma área livre do chão.';
    setARControlsEnabled(false);
    renderer.xr.setReferenceSpaceType('local-floor');
    await renderer.xr.setSession(session);
    const viewerSpace = await session.requestReferenceSpace('viewer');
    floorSpace = await session.requestReferenceSpace('local-floor');
    hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
    session.addEventListener('end', endXR);
    notify('AR ativo: procurando superfície estável.');
  } catch (error) {
    console.error(error);
    notify(`Erro ao iniciar AR: ${error.message}`);
    endXR();
  }
}
async function enterVR() {
  if (!await supportsXR('immersive-vr')) { notify('VR indisponível. Abra em um headset compatível.'); return; }
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    xrMode = 'vr';
    appState = 'VR';
    renderer.xr.setReferenceSpaceType('local-floor');
    await renderer.xr.setSession(session);
    session.addEventListener('end', endXR);
    notify('VR ativo.');
  } catch (error) { notify(`Erro ao iniciar VR: ${error.message}`); }
}
function placeAR() {
  if (!reticle.visible) return;
  showroom.position.copy(reticle.position);
  showroom.quaternion.copy(reticle.quaternion);
  showroom.scale.setScalar(.22);
  showroom.visible = true;
  arPlaced = true;
  appState = 'AR_POSICIONADO';
  setARControlsEnabled(true);
  if (arInstruction) arInstruction.textContent = 'Maquete posicionada. Caminhe ao redor e ajuste a escala se necessário.';
  notify('AR: showroom posicionado.');
}
function updateAR(frame) {
  if (!frame || !hitTestSource || !floorSpace || appState !== 'AR_ESCANEANDO') return;
  const result = frame.getHitTestResults(hitTestSource)[0];
  if (!result) { reticle.visible = false; reticleSamples = []; return; }
  const pose = result.getPose(floorSpace);
  if (!pose) return;
  reticle.matrix.fromArray(pose.transform.matrix);
  reticle.matrix.decompose(reticle.position, reticle.quaternion, reticle.scale);
  reticle.visible = true;
  reticleSamples.push(reticle.position.clone());
  if (reticleSamples.length > 12) reticleSamples.shift();
  const average = reticleSamples.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / reticleSamples.length);
  const variation = reticleSamples.reduce((sum, point) => sum + point.distanceTo(average), 0) / reticleSamples.length;
  const stable = reticleSamples.length >= 8 && variation < .045;
  const placeButton = $('placeAR');
  if (placeButton) placeButton.disabled = !stable;
  if (stable && !arPlaced) {
    if (arInstruction) arInstruction.textContent = 'Chão estável detectado. Confirme em “Posicionar aqui”.';
    notify('AR: chão estável detectado.');
  }
}

const tourPoints = [
  new THREE.Vector3(0, 1.65, 5.8),
  new THREE.Vector3(-4.4, 1.65, 1.5),
  new THREE.Vector3(0, 1.65, -2.6),
  new THREE.Vector3(4.4, 1.65, 1.5),
  new THREE.Vector3(0, 1.65, 5.8)
];
function startTour() {
  cancelTeleport();
  velocity.set(0, 0, 0);
  tourIndex = 0;
  appState = 'TOUR';
  setActive('tourBtn', true);
  notify('Tour guiado iniciado. Use WASD, setas ou joystick para interromper.');
}
function stopTour() {
  if (appState !== 'TOUR') return;
  appState = 'NORMAL';
  setActive('tourBtn', false);
  notify('Tour guiado interrompido.');
}
function updateTour(delta) {
  if (appState !== 'TOUR') return;
  const target = tourPoints[tourIndex];
  const direction = target.clone().sub(camera.position);
  direction.y = 0;
  if (direction.length() < .18) { tourIndex = (tourIndex + 1) % tourPoints.length; return; }
  camera.position.add(direction.normalize().multiplyScalar(delta * 1.45));
  yaw = Math.atan2(-direction.x, -direction.z);
  camera.rotation.set(-.05, yaw, 0);
}
function resolveCollision(position) {
  const radius = .32;
  for (const box of colliders) {
    const insideX = position.x > box.minX - radius && position.x < box.maxX + radius;
    const insideZ = position.z > box.minZ - radius && position.z < box.maxZ + radius;
    if (!insideX || !insideZ) continue;
    const left = Math.abs(position.x - (box.minX - radius));
    const right = Math.abs((box.maxX + radius) - position.x);
    const back = Math.abs(position.z - (box.minZ - radius));
    const front = Math.abs((box.maxZ + radius) - position.z);
    const minimum = Math.min(left, right, back, front);
    if (minimum === left) position.x = box.minX - radius;
    else if (minimum === right) position.x = box.maxX + radius;
    else if (minimum === back) position.z = box.minZ - radius;
    else position.z = box.maxZ + radius;
    velocity.set(0, 0, 0);
  }
}
function updateNormalMovement(delta) {
  if (xrMode || appState === 'TOUR') return;
  const forward = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - inputAxis.y;
  const side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + inputAxis.x;
  const hasInput = Math.hypot(forward, side) > .05;
  desiredVelocity.set(0, 0, 0);
  if (hasInput) {
    const length = Math.hypot(forward, side);
    const normalizedForward = forward / Math.max(1, length);
    const normalizedSide = side / Math.max(1, length);
    const speed = 3.15;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    desiredVelocity.set((normalizedForward * -sin + normalizedSide * cos) * speed, 0, (normalizedForward * -cos + normalizedSide * -sin) * speed);
    cancelTeleport();
    appState = 'NORMAL';
  } else if (teleporting) {
    const direction = teleportTarget.clone().sub(camera.position);
    direction.y = 0;
    if (direction.length() < .09) {
      cancelTeleport();
      appState = 'NORMAL';
      notify('Chegou ao destino.');
    } else {
      desiredVelocity.copy(direction.normalize().multiplyScalar(Math.min(4.2, direction.length() * 3.5)));
    }
  }
  const rate = hasInput || teleporting ? 20 : 42;
  velocity.lerp(desiredVelocity, 1 - Math.exp(-rate * delta));
  if (!hasInput && !teleporting && velocity.lengthSq() < .0004) velocity.set(0, 0, 0);
  camera.position.addScaledVector(velocity, delta);
  camera.position.x = clamp(camera.position.x, -7.5, 7.5);
  camera.position.z = clamp(camera.position.z, -6.5, 6.5);
  resolveCollision(camera.position);
  camera.rotation.set(pitch, yaw, 0);
}

on('placeAR', 'click', placeAR);
on('centerAR', 'click', placeAR);
on('resetAR', 'click', () => { showroom.visible = false; arPlaced = false; appState = 'AR_ESCANEANDO'; setARControlsEnabled(false); if (arInstruction) arInstruction.textContent = 'Mova o celular até detectar outro ponto estável.'; });
on('scaleUp', 'click', () => { if (arPlaced) showroom.scale.multiplyScalar(1.15); });
on('scaleDown', 'click', () => { if (arPlaced) showroom.scale.multiplyScalar(.87); });
on('exitAR', 'click', () => renderer.xr.getSession()?.end());
on('arBtn', 'click', enterAR);
on('vrBtn', 'click', enterVR);
on('normalBtn', 'click', () => renderer.xr.getSession() ? renderer.xr.getSession().end() : endXR());
on('tourBtn', 'click', () => appState === 'TOUR' ? stopTour() : startTour());
on('wallMode', 'click', () => { currentSurface = 'wall'; applyProduct(selectedProduct, 'wall'); });
on('floorMode', 'click', () => { currentSurface = 'floor'; applyProduct(selectedProduct, 'floor'); });
on('applyWall', 'click', () => applyProduct(selectedProduct, 'wall'));
on('applyFloor', 'click', () => applyProduct(selectedProduct, 'floor'));
on('uploadTexture', 'click', () => $('textureFile')?.click());
on('textureFile', 'change', event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const target = surfaceMaterial(currentSurface);
    if (target) { target.map = null; target.color.set('#ffffff'); }
    applyTexture(reader.result, currentSurface);
    notify(`Textura enviada aplicada somente em ${currentSurface === 'wall' ? 'parede' : 'piso'}.`);
  };
  reader.readAsDataURL(file);
  event.target.value = '';
});
on('arProduct', 'click', () => notify('AR de produto será conectado quando um GLB for adicionado em uploads/models/.'));
on('closeInspector', 'click', () => inspector?.classList.remove('open'));
on('captureBtn', 'click', () => { const link = document.createElement('a'); link.download = `decor-colors-${Date.now()}.png`; link.href = renderer.domElement.toDataURL('image/png'); link.click(); });
on('helpBtn', 'click', () => $('help')?.classList.add('open'));
on('closeHelp', 'click', () => $('help')?.classList.remove('open'));
on('startBtn', 'click', () => { $('welcome')?.classList.remove('open'); notify(isTouch ? 'Arraste para olhar · toque no piso para mover.' : 'WASD + mouse para explorar.'); });
on('quickTourBtn', 'click', () => { $('welcome')?.classList.remove('open'); startTour(); });
on('enterBtn', 'click', () => $('welcome')?.classList.add('open'));

const clock = new THREE.Clock();
function render(time, frame) {
  const delta = Math.min(clock.getDelta(), .05);
  if (xrMode === 'ar') updateAR(frame);
  updateNormalMovement(delta);
  updateTour(delta);
  renderer.render(scene, camera);
}
async function loadCatalog() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const response = await fetch('catalogo.json', { cache: 'no-store', signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.products) || !data.products.length) throw new Error('Catálogo vazio');
    return data;
  } catch (error) {
    console.warn('[Decor Colors] Catálogo externo indisponível. Usando catálogo interno.', error);
    return FALLBACK_CATALOG;
  }
}
async function init() {
  try {
    catalog = await loadCatalog();
    selectedProduct = catalog.products[0];
    buildShowroom();
    buildProductList();
    if (selectedName) selectedName.textContent = selectedProduct.name;
    document.querySelector('.product-item')?.classList.add('active');
    applyTexture(catalog.referenceTextures?.mineral, 'wall');
    applyTexture(catalog.referenceTextures?.floor, 'floor');
    renderer.setAnimationLoop(render);
    notify('Showroom pronto: selecione uma tonalidade.');
  } catch (error) {
    console.error('[Decor Colors] Falha de inicialização:', error);
    notify(`Erro ao iniciar showroom: ${error.message}`);
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }
}
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
init();
