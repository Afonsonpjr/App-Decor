import * as THREE from 'three';

/*
  DECOR COLORS — QUARTZO MICA
  Versão estabilizada: valida todos os elementos do HTML antes de registrar eventos.
*/

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
    { id: 'topazio', name: 'Topázio', hex: '#9A7350', mockup: 'assets/mockups/topazio.jpg', texture: 'assets/textures/topazio.jpg', description: 'Efeito mineral Quartzo Mica em tonalidade quente para parede e piso.' },
    { id: 'off-white', name: 'Off-White', hex: '#C8C0B5', mockup: 'assets/mockups/off-white.jpg', texture: 'assets/textures/off-white.jpg', description: 'Tonalidade clara e versátil que destaca o acabamento mineral.' },
    { id: 'bianco', name: 'Bianco', hex: '#D1CDCA', mockup: 'assets/mockups/bianco.jpg', texture: 'assets/textures/bianco.jpg', description: 'Acabamento mineral claro, elegante e contemporâneo.' },
    { id: 'olho-de-tigre', name: 'Olho de Tigre', hex: '#8E6746', mockup: 'assets/mockups/olho-de-tigre.jpg', texture: 'assets/textures/olho-de-tigre.jpg', description: 'Tonalidade terrosa profunda, inspirada em minerais naturais.' },
    { id: 'onix', name: 'Ônix', hex: '#252526', mockup: 'assets/mockups/onix.jpg', texture: 'assets/textures/onix.jpg', description: 'Acabamento escuro e sofisticado para contrastes marcantes.' },
    { id: 'jaspe', name: 'Jaspe', hex: '#806147', mockup: 'assets/mockups/jaspe.jpg', texture: 'assets/textures/jaspe.jpg', description: 'Tom orgânico e acolhedor para composições naturais.' }
  ],
  referenceTextures: { mineral: 'assets/textures/minerio.jpg', floor: 'assets/textures/quartzo-mica-piso.jpg' }
};

function on(id, event, callback) {
  const element = $(id);
  if (!element) {
    console.warn(`[Decor Colors] Elemento #${id} não encontrado no HTML. Evento ignorado.`);
    return;
  }
  element.addEventListener(event, callback);
}
function setText(element, text) { if (element) element.textContent = text; }
function notify(text) { setText(statusEl, text); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

if (!sceneHost) {
  console.error('[Decor Colors] #scene não foi encontrado. Use o index.html atualizado.');
  if (loadingEl) loadingEl.style.display = 'none';
  throw new Error('Elemento #scene ausente');
}

let catalog = FALLBACK_CATALOG;
let selectedProduct = FALLBACK_CATALOG.products[0];
let currentSurface = 'wall';
let wallMaterial;
let floorMaterial;
let xrMode = null;
let hitTestSource = null;
let floorSpace = null;
let arPlaced = false;
let reticleSamples = [];
let tourActive = false;
let tourIndex = 0;
let yaw = 0;
let pitch = -0.03;
const keys = {};
const joystick = { x: 0, y: 0 };
const moveTarget = new THREE.Vector3();
const pickables = [];
const floorTargets = [];
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
function createCan(product, parent) {
  const group = new THREE.Group();
  parent.add(group);
  const body = addMesh(new THREE.CylinderGeometry(.29, .31, .62, 28), material('#f0f0eb', .31, .05), 0, .31, 0, group);
  const label = addMesh(new THREE.CylinderGeometry(.315, .315, .36, 28), material(product.hex, .46), 0, .31, 0, group);
  const lid = addMesh(new THREE.CylinderGeometry(.29, .30, .06, 28), material('#171918', .22, .73), 0, .65, 0, group);
  [body, label, lid].forEach(item => {
    item.userData.product = product;
    pickables.push(item);
  });
  group.userData.product = product;
  return group;
}
function createPedestal(product, index) {
  const group = new THREE.Group();
  showroom.add(group);
  const angle = (index / catalog.products.length) * Math.PI * 2 + 0.2;
  const radius = 4.5;
  group.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius - .25);
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
}
function buildShowroom() {
  const W = 17, D = 15, H = 5;
  floorMaterial = material('#79736c', .48, .04);
  wallMaterial = material('#9e8d7d', .62, .02);
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
  const displayFloor = addBox(4.5, .03, 3.1, floorMaterial, 0, .09, -4.65);
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
  catalog.products.forEach(createPedestal);
}
function loadTexture(url, repeatX, repeatY, callback) {
  new THREE.TextureLoader().load(url, texture => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    callback(texture);
  }, undefined, () => console.warn(`[Decor Colors] Não foi possível carregar textura: ${url}`));
}
function applyTexture(url, surface) {
  const target = surface === 'wall' ? wallMaterial : floorMaterial;
  if (!target || !url) return;
  loadTexture(url, surface === 'wall' ? 2.2 : 3.2, surface === 'wall' ? 1.15 : 3.2, texture => {
    target.map = texture;
    target.color.set('#ffffff');
    target.needsUpdate = true;
  });
}
function applyProduct(product, surface = currentSurface) {
  if (!product || !wallMaterial || !floorMaterial) return;
  selectedProduct = product;
  currentSurface = surface;
  const target = surface === 'wall' ? wallMaterial : floorMaterial;
  target.map = null;
  target.color.set(product.hex);
  target.roughness = surface === 'wall' ? .55 : .40;
  target.metalness = .05;
  applyTexture(product.texture, surface);
  setText(selectedName, product.name);
  document.querySelectorAll('.product-item').forEach(button => button.classList.toggle('active', button.dataset.id === product.id));
  if (productImage) productImage.src = product.mockup;
  setText(productTitle, product.name);
  setText(productDescription, product.description);
  if (inspector) inspector.classList.add('open');
  notify(`${product.name} aplicado em ${surface === 'wall' ? 'parede' : 'piso'}.`);
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
    image.onerror = () => image.style.opacity = '.15';
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
function pick(normalizedX, normalizedY) {
  pointer.set(normalizedX, normalizedY);
  raycaster.setFromCamera(pointer, camera);
  const productHit = raycaster.intersectObjects(pickables, false)[0];
  if (productHit?.object?.userData?.product) {
    applyProduct(productHit.object.userData.product);
    return;
  }
  const floorHit = raycaster.intersectObjects(floorTargets, false)[0];
  if (floorHit && !tourActive) {
    moveTarget.copy(floorHit.point);
    moveTarget.y = 1.65;
    moveTarget.x = clamp(moveTarget.x, -7.1, 7.1);
    moveTarget.z = clamp(moveTarget.z, -6.2, 6.2);
    notify('Movendo para o ponto selecionado…');
  }
}
window.addEventListener('keydown', event => keys[event.code] = true);
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
  touchState = { id:t.identifier, x:t.clientX, y:t.clientY, sx:t.clientX, sy:t.clientY, distance:0 };
}, { passive:true });
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
}, { passive:true });
renderer.domElement.addEventListener('touchend', () => {
  if (touchState && touchState.distance < 14 && !xrMode) pick((touchState.sx / innerWidth) * 2 - 1, -(touchState.sy / innerHeight) * 2 + 1);
  touchState = null;
}, { passive:true });

const joystickEl = $('joystick');
const knob = $('knob');
let joystickId = null;
function updateJoystick(touch) {
  if (!joystickEl || !knob) return;
  const rect = joystickEl.getBoundingClientRect();
  const limit = rect.width / 2 - 18;
  let dx = touch.clientX - rect.left - rect.width / 2;
  let dy = touch.clientY - rect.top - rect.height / 2;
  const length = Math.hypot(dx, dy);
  if (length > limit) { dx *= limit / length; dy *= limit / length; }
  joystick.x = dx / limit;
  joystick.y = dy / limit;
  knob.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
}
if (joystickEl) {
  joystickEl.addEventListener('touchstart', event => { event.preventDefault(); joystickId = event.changedTouches[0].identifier; updateJoystick(event.changedTouches[0]); }, { passive:false });
  joystickEl.addEventListener('touchmove', event => { event.preventDefault(); for (const t of event.changedTouches) if (t.identifier === joystickId) updateJoystick(t); }, { passive:false });
  joystickEl.addEventListener('touchend', () => { joystickId = null; joystick.x = 0; joystick.y = 0; if (knob) knob.style.transform = 'translate(-50%,-50%)'; });
}

const reticle = new THREE.Mesh(new THREE.RingGeometry(.08,.13,32).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({ color:'#e9c66b' }));
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);
const arTools = $('arTools');
const arInstruction = $('arInstruction');
const arButtonIds = ['placeAR','centerAR','scaleDown','scaleUp','resetAR'];
function setARControlsEnabled(value) { arButtonIds.forEach(id => { const element = $(id); if (element) element.disabled = !value; }); }
async function supportsXR(mode) { return Boolean(navigator.xr) && navigator.xr.isSessionSupported(mode).catch(() => false); }
function endXR() {
  hitTestSource?.cancel();
  hitTestSource = null;
  floorSpace = null;
  reticleSamples = [];
  xrMode = null;
  arPlaced = false;
  reticle.visible = false;
  scene.background = new THREE.Color('#101312');
  showroom.visible = true;
  showroom.position.set(0, 0, 0);
  showroom.rotation.set(0, 0, 0);
  showroom.scale.setScalar(1);
  document.body.classList.remove('ar');
  if (arTools) arTools.classList.add('hidden');
  notify('Modo normal: showroom pronto.');
}
async function enterAR() {
  if (!await supportsXR('immersive-ar')) { notify('AR indisponível neste aparelho/navegador. Use Chrome Android com ARCore ou o modo normal.'); return; }
  try {
    const session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures:['hit-test'], optionalFeatures:['local-floor'] });
    xrMode = 'ar'; arPlaced = false; reticleSamples = [];
    scene.background = null;
    showroom.visible = false;
    document.body.classList.add('ar');
    if (arTools) arTools.classList.remove('hidden');
    if (arInstruction) arInstruction.textContent = 'Mova o celular lentamente apontando para uma área livre do chão.';
    setARControlsEnabled(false);
    renderer.xr.setReferenceSpaceType('local-floor');
    await renderer.xr.setSession(session);
    const viewerSpace = await session.requestReferenceSpace('viewer');
    floorSpace = await session.requestReferenceSpace('local-floor');
    hitTestSource = await session.requestHitTestSource({ space:viewerSpace });
    session.addEventListener('end', endXR);
    notify('AR ativo: procurando uma superfície estável.');
  } catch (error) {
    console.error(error);
    notify(`Erro ao iniciar AR: ${error.message}`);
    endXR();
  }
}
async function enterVR() {
  if (!await supportsXR('immersive-vr')) { notify('VR indisponível. Abra em um headset compatível.'); return; }
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures:['local-floor','bounded-floor','hand-tracking'] });
    xrMode = 'vr';
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
  setARControlsEnabled(true);
  if (arInstruction) arInstruction.textContent = 'Maquete posicionada. Caminhe ao redor e ajuste a escala se necessário.';
  notify('AR: showroom posicionado.');
}
function updateAR(frame) {
  if (!frame || !hitTestSource || !floorSpace) return;
  const result = frame.getHitTestResults(hitTestSource)[0];
  if (!result) { reticle.visible = false; reticleSamples = []; return; }
  const pose = result.getPose(floorSpace);
  if (!pose) return;
  reticle.matrix.fromArray(pose.transform.matrix);
  reticle.matrix.decompose(reticle.position, reticle.quaternion, reticle.scale);
  reticle.visible = true;
  reticleSamples.push(reticle.position.clone());
  if (reticleSamples.length > 10) reticleSamples.shift();
  const average = reticleSamples.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / reticleSamples.length);
  const variation = reticleSamples.reduce((sum, point) => sum + point.distanceTo(average), 0) / reticleSamples.length;
  const stable = reticleSamples.length >= 7 && variation < .06;
  const placeButton = $('placeAR');
  if (placeButton) placeButton.disabled = !stable;
  if (stable && !arPlaced) {
    if (arInstruction) arInstruction.textContent = 'Chão estável detectado. Toque em “Posicionar aqui” para confirmar.';
    notify('AR: chão estável detectado.');
  }
}

on('placeAR', 'click', placeAR);
on('centerAR', 'click', placeAR);
on('resetAR', 'click', () => { showroom.visible = false; arPlaced = false; setARControlsEnabled(false); if (arInstruction) arInstruction.textContent = 'Mova o celular até detectar outro ponto estável.'; });
on('scaleUp', 'click', () => { if (arPlaced) showroom.scale.multiplyScalar(1.15); });
on('scaleDown', 'click', () => { if (arPlaced) showroom.scale.multiplyScalar(.87); });
on('exitAR', 'click', () => renderer.xr.getSession()?.end());
on('arBtn', 'click', enterAR);
on('vrBtn', 'click', enterVR);
on('normalBtn', 'click', () => renderer.xr.getSession() ? renderer.xr.getSession().end() : endXR());
on('tourBtn', 'click', () => { tourActive = !tourActive; tourIndex = 0; $('tourBtn')?.classList.toggle('active', tourActive); notify(tourActive ? 'Tour guiado iniciado.' : 'Tour guiado encerrado.'); });
on('wallMode', 'click', () => { currentSurface = 'wall'; $('wallMode')?.classList.add('active'); $('floorMode')?.classList.remove('active'); applyProduct(selectedProduct, 'wall'); });
on('floorMode', 'click', () => { currentSurface = 'floor'; $('floorMode')?.classList.add('active'); $('wallMode')?.classList.remove('active'); applyProduct(selectedProduct, 'floor'); });
on('applyWall', 'click', () => applyProduct(selectedProduct, 'wall'));
on('applyFloor', 'click', () => applyProduct(selectedProduct, 'floor'));
on('uploadTexture', 'click', () => $('textureFile')?.click());
on('textureFile', 'change', event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const target = currentSurface === 'wall' ? wallMaterial : floorMaterial;
    if (target) { target.map = null; target.color.set('#ffffff'); }
    applyTexture(reader.result, currentSurface);
    notify(`Textura enviada aplicada em ${currentSurface === 'wall' ? 'parede' : 'piso'}.`);
  };
  reader.readAsDataURL(file);
  event.target.value = '';
});
on('arProduct', 'click', () => notify('AR de produto será conectado quando você adicionar um arquivo GLB em uploads/models/.'));
on('closeInspector', 'click', () => inspector?.classList.remove('open'));
on('captureBtn', 'click', () => { const a = document.createElement('a'); a.download = `decor-colors-${Date.now()}.png`; a.href = renderer.domElement.toDataURL('image/png'); a.click(); });
on('helpBtn', 'click', () => $('help')?.classList.add('open'));
on('closeHelp', 'click', () => $('help')?.classList.remove('open'));
on('startBtn', 'click', () => { $('welcome')?.classList.remove('open'); notify(isTouch ? 'Arraste para olhar · toque no piso para mover.' : 'WASD + mouse para explorar.'); });
on('quickTourBtn', 'click', () => { $('welcome')?.classList.remove('open'); tourActive = true; $('tourBtn')?.classList.add('active'); notify('Tour guiado iniciado.'); });
on('enterBtn', 'click', () => $('welcome')?.classList.add('open'));

const tourPoints = [
  new THREE.Vector3(0, 1.65, 5.8),
  new THREE.Vector3(-4.4, 1.65, 1.5),
  new THREE.Vector3(0, 1.65, -2.6),
  new THREE.Vector3(4.4, 1.65, 1.5),
  new THREE.Vector3(0, 1.65, 5.8)
];
const clock = new THREE.Clock();
function updateNormalMovement(delta) {
  if (xrMode || tourActive) return;
  let forward = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joystick.y;
  let side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joystick.x;
  const length = Math.hypot(forward, side);
  if (length > 1) { forward /= length; side /= length; }
  const speed = 3.1 * delta;
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  camera.position.x += (forward * -sin + side * cos) * speed;
  camera.position.z += (forward * -cos + side * -sin) * speed;
  if (moveTarget.lengthSq() > 0) {
    const direction = moveTarget.clone().sub(camera.position);
    direction.y = 0;
    if (direction.length() < .09) moveTarget.set(0, 0, 0);
    else camera.position.add(direction.normalize().multiplyScalar(Math.min(delta * 4, direction.length())));
  }
  camera.position.x = clamp(camera.position.x, -7.1, 7.1);
  camera.position.z = clamp(camera.position.z, -6.2, 6.2);
  camera.rotation.set(pitch, yaw, 0);
}
function updateTour(delta) {
  if (!tourActive || xrMode) return;
  const point = tourPoints[tourIndex];
  const direction = point.clone().sub(camera.position);
  direction.y = 0;
  if (direction.length() < .18) { tourIndex = (tourIndex + 1) % tourPoints.length; return; }
  camera.position.add(direction.normalize().multiplyScalar(delta * 1.4));
  yaw = Math.atan2(-direction.x, -direction.z);
  camera.rotation.set(-.05, yaw, 0);
}
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
    const timeout = setTimeout(() => controller.abort(), 3500);
    const response = await fetch('catalogo.json', { cache: 'no-store', signal: controller.signal });
    clearTimeout(timeout);
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
    setText(selectedName, selectedProduct.name);
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
