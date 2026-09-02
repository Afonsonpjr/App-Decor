/* App-Decor — entrada do visitante + showroom WebXR seguro */
(function () {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const entryScreen = $('#entry-screen');
  const entryForm = $('#entry-form');
  const entryName = $('#visitor-name');
  const entryNumber = $('#visitor-number');
  const entryError = $('#entry-error');
  const loading = $('#loading');
  const status = $('#status');
  const logout = $('#logout');
  const SESSION_KEY = 'app-decor-visitor';
  let scene, camera, renderer, controls, clock;

  function setStatus(message) { if (status) status.textContent = message; }
  function finishLoading() { if (loading) { loading.classList.add('hidden'); loading.setAttribute('aria-hidden', 'true'); } }
  function showEntry(show) {
    if (!entryScreen) return;
    entryScreen.hidden = !show;
    document.body.classList.toggle('entry-active', show);
    if (show && entryName) setTimeout(() => entryName.focus(), 0);
  }
  function getVisitor() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (_) { return null; }
  }
  function setEntryError(message) {
    if (!entryError) return;
    entryError.textContent = message;
    entryError.hidden = !message;
  }
  function enterShowroom(event) {
    event.preventDefault();
    const name = (entryName?.value || '').trim();
    const number = (entryNumber?.value || '').trim();
    if (name.length < 2) return setEntryError('Digite um nome válido.');
    if (number.length < 3) return setEntryError('Digite um número válido.');
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ name, number, enteredAt: new Date().toISOString() }));
    setEntryError('');
    showEntry(false);
    init();
  }
  function leaveShowroom() {
    sessionStorage.removeItem(SESSION_KEY);
    if (entryForm) entryForm.reset();
    showEntry(true);
    setStatus('Informe seus dados para entrar.');
  }

  function assetUrl(name) { return `assets/models/${encodeURIComponent(name)}`; }
  function material(textureName, fallbackColor) {
    const mat = new THREE.MeshStandardMaterial({ color: fallbackColor, roughness: .78, metalness: .04 });
    if (!textureName) return mat;
    new THREE.TextureLoader().load(assetUrl(textureName), (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2, 2);
      mat.map = texture;
      mat.needsUpdate = true;
    }, undefined, () => {});
    return mat;
  }
  function addRoom() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), material('quartzo-mica-piso.jpg', 0x777777));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(18, 8), material('quartzo-mica-parede.jpg', 0xe6e1d8));
    wall.position.set(0, 4, -4);
    scene.add(wall);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(7, .25, 1.5), new THREE.MeshStandardMaterial({ color: 0x292929, roughness: .55 }));
    shelf.position.set(0, 2.2, -2.8);
    scene.add(shelf);
  }
  function addProducts() {
    [['Minerio', 'minerio.png', 0xb45b42], ['Topazio', 'topazio.png', 0xd99b35], ['Jaspe', 'jaspe.png', 0x8d5a45], ['Onix', 'onix.png', 0x252525]].forEach(([label, file, color], index) => {
      const product = new THREE.Mesh(new THREE.CylinderGeometry(.42, .48, 1.15, 32), material(file, color));
      product.position.set((index - 1.5) * 1.45, 2.95, -2.75);
      product.userData.label = label;
      scene.add(product);
    });
  }
  function setupXR() {
    if (!renderer?.xr || !('xr' in navigator)) { setStatus('Showroom pronto. AR/VR requerem dispositivo compatível.'); return; }
    try {
      if (window.VRButton) document.body.appendChild(window.VRButton.createButton(renderer, { requiredFeatures: ['local-floor'] }));
      if (window.ARButton) document.body.appendChild(window.ARButton.createButton(renderer, { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: document.body } }));
    } catch (_) { setStatus('Showroom pronto. AR/VR não disponíveis neste dispositivo.'); }
  }
  function init() {
    if (!getVisitor()) { showEntry(true); finishLoading(); return; }
    if (renderer) { showEntry(false); return; }
    try {
      if (!window.THREE) throw new Error('Three.js não carregado');
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x111318);
      camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .05, 100);
      camera.position.set(0, 2.2, 8);
      renderer = new THREE.WebGLRenderer({ antialias: true, canvas: $('#scene') || undefined });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.setSize(innerWidth, innerHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.xr.enabled = true;
      scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.2));
      const light = new THREE.DirectionalLight(0xffffff, 2.2);
      light.position.set(4, 8, 6);
      scene.add(light);
      addRoom();
      addProducts();
      if (window.OrbitControls) { controls = new window.OrbitControls(camera, renderer.domElement); controls.target.set(0, 2.2, -2); controls.enableDamping = true; }
      setupXR();
      clock = new THREE.Clock();
      renderer.setAnimationLoop(() => { clock.getDelta(); if (controls && !renderer.xr.isPresenting) controls.update(); renderer.render(scene, camera); });
      addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
      finishLoading();
      const visitor = getVisitor();
      setStatus(`Olá, ${visitor.name}! Showroom pronto.`);
    } catch (error) { console.error('[App-Decor]', error); finishLoading(); setStatus('Não foi possível iniciar o showroom.'); }
  }

  entryForm?.addEventListener('submit', enterShowroom);
  logout?.addEventListener('click', leaveShowroom);
  showEntry(!getVisitor());
  if (getVisitor()) init(); else finishLoading();
})();
