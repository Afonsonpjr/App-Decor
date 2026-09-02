// App-Decor - Main branch com carregamento flexivel de imagens

import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.157.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.157.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://unpkg.com/three@0.157.0/examples/jsm/loaders/DRACOLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 0.5;
controls.maxDistance = 10;
controls.maxPolarAngle = Math.PI / 2.1;
controls.target.set(0, 1, 0);

const moveState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    velocity: 0,
    maxVelocity: 0.08,
    acceleration: 0.008,
    friction: 0.92,
    isMoving: false
};

const keys = {};

function resetAllInput() {
    Object.keys(keys).forEach(key => { keys[key] = false; });
    moveState.forward = false;
    moveState.backward = false;
    moveState.left = false;
    moveState.right = false;
    moveState.velocity = 0;
    moveState.isMoving = false;
    if (virtualJoystick) {
        virtualJoystick.active = false;
        virtualJoystick.startX = 0;
        virtualJoystick.startY = 0;
        virtualJoystick.currentX = 0;
        virtualJoystick.currentY = 0;
        virtualJoystick.angle = 0;
        virtualJoystick.distance = 0;
        updateVirtualJoystickVisual();
    }
    isTeleporting = false;
}

window.addEventListener('blur', () => { resetAllInput(); controls.enabled = true; });
window.addEventListener('focus', () => {});

document.addEventListener('keydown', (e) => { keys[e.code] = true; updateMoveState(); });
document.addEventListener('keyup', (e) => { keys[e.code] = false; updateMoveState(); });

function updateMoveState() {
    moveState.forward = keys['KeyW'] || keys['ArrowUp'];
    moveState.backward = keys['KeyS'] || keys['ArrowDown'];
    moveState.left = keys['KeyA'] || keys['ArrowLeft'];
    moveState.right = keys['KeyD'] || keys['ArrowRight'];
    moveState.isMoving = moveState.forward || moveState.backward || moveState.left || moveState.right;
}

function updateMovement() {
    if (!moveState.isMoving) {
        moveState.velocity *= moveState.friction;
        if (Math.abs(moveState.velocity) < 0.001) moveState.velocity = 0;
    } else {
        if (moveState.velocity < moveState.maxVelocity) {
            moveState.velocity += moveState.acceleration;
        }
    }
    if (moveState.velocity > 0) {
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        direction.y = 0;
        direction.normalize();
        const right = new THREE.Vector3();
        right.crossVectors(camera.up, direction).normalize();
        const moveDir = new THREE.Vector3();
        if (moveState.forward) moveDir.add(direction);
        if (moveState.backward) moveDir.sub(direction);
        if (moveState.left) moveDir.add(right);
        if (moveState.right) moveDir.sub(right);
        if (moveDir.length() > 0) {
            moveDir.normalize();
            camera.position.addScaledVector(moveDir, moveState.velocity);
        }
    }
}

const virtualJoystick = { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0, angle: 0, distance: 0, maxDistance: 60, zoneRadius: 80 };

function createVirtualJoystick() {
    const joystickZone = document.createElement('div');
    joystickZone.id = 'joystick-zone';
    joystickZone.style.cssText = 'position:fixed;bottom:100px;left:100px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,0.1);border:2px solid rgba(255,255,255,0.3);touch-action:none;z-index:1000;display:none;';
    const joystickKnob = document.createElement('div');
    joystickKnob.id = 'joystick-knob';
    joystickKnob.style.cssText = 'position:absolute;width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,0.5);border:2px solid rgba(255,255,255,0.8);top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;';
    joystickZone.appendChild(joystickKnob);
    document.body.appendChild(joystickZone);
    document.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        if (touch.clientX < window.innerWidth / 2 && touch.clientY > window.innerHeight / 2) {
            virtualJoystick.active = true;
            virtualJoystick.startX = touch.clientX;
            virtualJoystick.startY = touch.clientY;
            virtualJoystick.currentX = touch.clientX;
            virtualJoystick.currentY = touch.clientY;
            joystickZone.style.display = 'block';
            joystickZone.style.left = (touch.clientX - 80) + 'px';
            joystickZone.style.top = (touch.clientY - 80) + 'px';
        }
    });
    document.addEventListener('touchmove', (e) => {
        if (virtualJoystick.active) {
            const touch = e.touches[0];
            virtualJoystick.currentX = touch.clientX;
            virtualJoystick.currentY = touch.clientY;
            const dx = touch.clientX - virtualJoystick.startX;
            const dy = touch.clientY - virtualJoystick.startY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            virtualJoystick.distance = Math.min(distance, virtualJoystick.maxDistance);
            virtualJoystick.angle = angle;
            const knobX = Math.cos(angle) * virtualJoystick.distance;
            const knobY = Math.sin(angle) * virtualJoystick.distance;
            joystickKnob.style.transform = 'translate(calc(-50% + ' + knobX + 'px), calc(-50% + ' + knobY + 'px))';
            updateJoystickMovement();
        }
    });
    document.addEventListener('touchend', () => {
        if (virtualJoystick.active) {
            virtualJoystick.active = false;
            virtualJoystick.distance = 0;
            joystickZone.style.display = 'none';
            joystickKnob.style.transform = 'translate(-50%, -50%)';
            moveState.forward = false;
            moveState.backward = false;
            moveState.left = false;
            moveState.right = false;
            moveState.velocity = 0;
        }
    });
}

function updateJoystickMovement() {
    const threshold = 15;
    const angle = virtualJoystick.angle;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    moveState.forward = virtualJoystick.distance > threshold && sin < -0.3;
    moveState.backward = virtualJoystick.distance > threshold && sin > 0.3;
    moveState.left = virtualJoystick.distance > threshold && cos < -0.3;
    moveState.right = virtualJoystick.distance > threshold && cos > 0.3;
    moveState.isMoving = moveState.forward || moveState.backward || moveState.left || moveState.right;
}

function updateVirtualJoystickVisual() {
    const knob = document.getElementById('joystick-knob');
    if (knob) knob.style.transform = 'translate(-50%, -50%)';
}

let isTeleporting = false;
let teleportTarget = null;
let teleportProgress = 0;

function setupTeleport() {
    let mouseDownTime = 0;
    let isMouseDragging = false;
    renderer.domElement.addEventListener('mousedown', (e) => { if (e.button === 2) { mouseDownTime = Date.now(); isMouseDragging = false; } });
    renderer.domElement.addEventListener('mousemove', (e) => { if (e.buttons === 2 && mouseDownTime > 0) isMouseDragging = true; });
    renderer.domElement.addEventListener('mouseup', (e) => {
        if (e.button === 2 && mouseDownTime > 0) {
            const holdTime = Date.now() - mouseDownTime;
            if (holdTime < 300 && !isMouseDragging && !controls.enabled) performTeleport();
            mouseDownTime = 0;
            isMouseDragging = false;
        }
    });
    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
}

function performTeleport() {
    if (isTeleporting) return;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const floorIntersects = raycaster.intersectObjects([floorMesh]);
    if (floorIntersects.length > 0) {
        const targetPoint = floorIntersects[0].point;
        const distance = camera.position.distanceTo(targetPoint);
        if (distance > 8) { showNotification('Muito longe!', 'error'); return; }
        teleportTarget = targetPoint.clone();
        teleportTarget.y = 1.6;
        isTeleporting = true;
        teleportProgress = 0;
        showNotification('Teleportando...', 'info');
    }
}

function updateTeleport() {
    if (!isTeleporting || !teleportTarget) return;
    teleportProgress += 0.08;
    if (teleportProgress >= 1) {
        camera.position.copy(teleportTarget);
        isTeleporting = false;
        teleportTarget = null;
        teleportProgress = 0;
        showNotification('Chegou!', 'success');
    } else {
        const lerpPos = camera.position.clone().lerp(teleportTarget, 0.15);
        camera.position.copy(lerpPos);
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:' + (type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db') + ';color:white;padding:12px 24px;border-radius:8px;font-size:14px;z-index:10000;animation:fadeInOut 2s ease-in-out;';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
const loadedModels = [];

function loadModel(path, position, rotation = [0, 0, 0], scale = [1, 1, 1]) {
    gltfLoader.load(path, (gltf) => {
        const model = gltf.scene;
        model.position.set(...position);
        model.rotation.set(...rotation);
        model.scale.set(...scale);
        model.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
        scene.add(model);
        loadedModels.push(model);
    }, undefined, (error) => { /* Modelo opcional - silencioso */ });
}

const textureLoader = new THREE.TextureLoader();

function loadTextureFlexible(basePath, callback) {
    const extensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];
    let loaded = false;
    function tryExtension(index) {
        if (index >= extensions.length || loaded) { if (!loaded) callback(null); return; }
        const path = basePath + extensions[index];
        textureLoader.load(path, (texture) => {
            loaded = true;
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            console.log('Textura carregada:', path);
            callback(texture);
        }, undefined, (error) => { tryExtension(index + 1); });
    }
    tryExtension(0);
}

const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.7, metalness: 0.1 });
const panelMaterial = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.6, metalness: 0.15 });
const demoFloorMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.2 });

loadTextureFlexible('assets/textures/minerio', (texture) => {
    if (texture) { texture.repeat.set(4, 4); demoFloorMaterial.map = texture; demoFloorMaterial.needsUpdate = true; }
});

loadTextureFlexible('assets/textures/quartzo-mica-piso', (texture) => {
    if (texture) { texture.repeat.set(3, 3); wallMaterial.map = texture; wallMaterial.needsUpdate = true; }
});

const floorGeometry = new THREE.PlaneGeometry(20, 20);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8, metalness: 0.1 });
const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

const ceilingGeometry = new THREE.PlaneGeometry(20, 20);
const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0.05 });
const ceilingMesh = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
ceilingMesh.rotation.x = Math.PI / 2;
ceilingMesh.position.y = 4;
ceilingMesh.receiveShadow = true;
scene.add(ceilingMesh);

const wallGeometry = new THREE.PlaneGeometry(10, 4);
const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
wallMesh.position.set(0, 2, -5);
wallMesh.receiveShadow = true;
scene.add(wallMesh);

const panelGeometry = new THREE.BoxGeometry(3, 2, 0.2);
const panelMesh = new THREE.Mesh(panelGeometry, panelMaterial);
panelMesh.position.set(0, 1.5, -4.8);
panelMesh.castShadow = true;
panelMesh.receiveShadow = true;
scene.add(panelMesh);

const demoFloorGeometry = new THREE.PlaneGeometry(4, 4);
const demoFloorMesh = new THREE.Mesh(demoFloorGeometry, demoFloorMaterial);
demoFloorMesh.rotation.x = -Math.PI / 2;
demoFloorMesh.position.set(0, 0.01, -3);
demoFloorMesh.receiveShadow = true;
scene.add(demoFloorMesh);

const tourPoints = [
    { position: [0, 1.6, 3], lookAt: [0, 1, -3], label: 'Entrada' },
    { position: [-2, 1.6, 2], lookAt: [-2, 1, -3], label: 'Esquerda' },
    { position: [2, 1.6, 2], lookAt: [2, 1, -3], label: 'Direita' },
    { position: [0, 1.6, -2], lookAt: [0, 1, -4], label: 'Fundo' }
];

let currentTourIndex = 0;
let isTouring = false;
let tourInterval = null;

function startTour() {
    if (isTouring) return;
    isTouring = true;
    currentTourIndex = 0;
    moveToTourPoint(0);
    tourInterval = setInterval(() => {
        currentTourIndex = (currentTourIndex + 1) % tourPoints.length;
        moveToTourPoint(currentTourIndex);
    }, 4000);
    showNotification('Tour iniciado!', 'success');
}

function stopTour() {
    if (!isTouring) return;
    isTouring = false;
    clearInterval(tourInterval);
    tourInterval = null;
    showNotification('Tour parado', 'info');
}

function moveToTourPoint(index) {
    const point = tourPoints[index];
    const targetPos = new THREE.Vector3(...point.position);
    const targetLook = new THREE.Vector3(...point.lookAt);
    const startPos = camera.position.clone();
    const startLook = controls.target.clone();
    let progress = 0;
    const animateTour = () => {
        if (!isTouring) return;
        progress += 0.02;
        if (progress >= 1) {
            camera.position.copy(targetPos);
            controls.target.copy(targetLook);
            controls.update();
            return;
        }
        camera.position.lerpVectors(startPos, targetPos, progress);
        controls.target.lerpVectors(startLook, targetLook, progress);
        controls.update();
        requestAnimationFrame(animateTour);
    };
    animateTour();
}

function createHUD() {
    const instructions = document.createElement('div');
    instructions.id = 'instructions';
    instructions.style.cssText = 'position:fixed;top:10px;left:10px;background:rgba(0,0,0,0.7);color:white;padding:15px;border-radius:8px;font-family:Arial,sans-serif;font-size:13px;z-index:1000;max-width:280px;line-height:1.5;';
    instructions.innerHTML = '<strong>Decor Colors - Showroom</strong><br>PC: WASD/Setas - Mover | Mouse - Olhar<br>Clique direito curto - Teleporte<br>Clique direito longo - Capturar mouse<br>ESC - Sair do mouse<br>Mobile: Toque esquerdo - Mover | Deslizar - Olhar<br><br><strong>ACESSO PELO CELULAR:</strong><br>Use o link HTTPS do Cloudflare<br><br><button id="tour-btn" style="padding:8px 16px;background:#3498db;color:white;border:none;border-radius:4px;cursor:pointer;margin-top:8px;">Iniciar Tour</button><button id="stop-tour-btn" style="padding:8px 16px;background:#e74c3c;color:white;border:none;border-radius:4px;cursor:pointer;margin-top:8px;margin-left:8px;">Parar Tour</button>';
    document.body.appendChild(instructions);
    document.getElementById('tour-btn').addEventListener('click', startTour);
    document.getElementById('stop-tour-btn').addEventListener('click', stopTour);
    const surfaceInfo = document.createElement('div');
    surfaceInfo.id = 'surface-info';
    surfaceInfo.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:white;padding:10px 20px;border-radius:8px;font-family:Arial,sans-serif;font-size:14px;z-index:1000;text-align:center;';
    surfaceInfo.textContent = 'Superficie: Nenhuma';
    document.body.appendChild(surfaceInfo);
    const captureBtn = document.createElement('button');
    captureBtn.id = 'capture-btn';
    captureBtn.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:12px 20px;background:rgba(52,152,219,0.9);color:white;border:none;border-radius:8px;font-family:Arial,sans-serif;font-size:14px;cursor:pointer;z-index:1000;';
    captureBtn.textContent = 'Capturar Mouse';
    document.body.appendChild(captureBtn);
    captureBtn.addEventListener('click', () => renderer.domElement.requestPointerLock());
}

document.addEventListener('click', () => renderer.domElement.requestPointerLock());

document.addEventListener('pointerlockchange', () => {
    const isLocked = document.pointerLockElement === renderer.domElement;
    controls.enabled = !isLocked;
    const captureBtn = document.getElementById('capture-btn');
    if (captureBtn) {
        captureBtn.textContent = isLocked ? 'Mouse Capturado' : 'Capturar Mouse';
        captureBtn.style.background = isLocked ? 'rgba(39,174,96,0.9)' : 'rgba(52,152,219,0.9)';
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

createVirtualJoystick();
createHUD();
setupTeleport();

loadModel('assets/models/pedestal.glb', [-1.5, 0, -3.5], [0, Math.PI / 4, 0], [0.5, 0.5, 0.5]);
loadModel('assets/models/pedestal.glb', [1.5, 0, -3.5], [0, -Math.PI / 4, 0], [0.5, 0.5, 0.5]);

function animate() {
    requestAnimationFrame(animate);
    updateMovement();
    updateTeleport();
    controls.update();
    renderer.render(scene, camera);
}

animate();

setTimeout(() => showNotification('Bem-vindo ao Showroom!', 'success'), 500);
