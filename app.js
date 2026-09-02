/* App-Decor — runtime estável com entrada e WebXR opcional */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const KEY = 'app-decor-visitor';
  const entry = $('#entry-screen'), form = $('#entry-form'), nameInput = $('#visitor-name'), numberInput = $('#visitor-number'), error = $('#entry-error'), loading = $('#loading'), status = $('#status'), logout = $('#logout');
  let started = false, renderer, scene, camera, controls;
  const setStatus = (text) => { if (status) status.textContent = text; };
  const hideLoading = () => { if (loading) { loading.classList.add('hidden'); loading.setAttribute('aria-hidden', 'true'); } };
  const visitor = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (_) { return null; } };
  const showEntry = (visible) => { if (entry) { entry.hidden = !visible; document.body.classList.toggle('entry-active', visible); if (visible) setTimeout(() => nameInput?.focus(), 0); } };
  const setError = (text) => { if (error) { error.textContent = text; error.hidden = !text; } };

  function material(file, color) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: .78, metalness: .03 });
    new THREE.TextureLoader().load(`assets/models/${encodeURIComponent(file)}`, (texture) => { texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2, 2); mat.map = texture; mat.needsUpdate = true; }, undefined, () => {});
    return mat;
  }
  function buildScene() {
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x111318);
    camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .05, 100); camera.position.set(0, 2.2, 8);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, canvas: $('#scene') || undefined }); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.xr.enabled = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.2)); const light = new THREE.DirectionalLight(0xffffff, 2.2); light.position.set(4, 8, 6); scene.add(light);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), material('quartzo-mica-piso.jpg', 0x777777)); floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(18, 8), material('quartzo-mica-parede.jpg', 0xe6e1d8)); wall.position.set(0, 4, -4); scene.add(wall);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(7, .25, 1.5), new THREE.MeshStandardMaterial({ color: 0x292929, roughness: .55 })); shelf.position.set(0, 2.2, -2.8); scene.add(shelf);
    [['Minerio','minerio.png',0xb45b42],['Topazio','topazio.png',0xd99b35],['Jaspe','jaspe.png',0x8d5a45],['Onix','onix.png',0x252525]].forEach(([label, file, color], i) => { const product = new THREE.Mesh(new THREE.CylinderGeometry(.42, .48, 1.15, 32), material(file, color)); product.position.set((i - 1.5) * 1.45, 2.95, -2.75); product.userData.label = label; scene.add(product); });
    if (window.OrbitControls) { controls = new window.OrbitControls(camera, renderer.domElement); controls.target.set(0, 2.2, -2); controls.enableDamping = true; }
    if ('xr' in navigator) { try { if (window.VRButton) document.body.appendChild(window.VRButton.createButton(renderer, { requiredFeatures: ['local-floor'] })); if (window.ARButton) document.body.appendChild(window.ARButton.createButton(renderer, { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: document.body } })); } catch (_) { setStatus('Showroom pronto. AR/VR indisponível neste dispositivo.'); } }
    renderer.setAnimationLoop(() => { if (controls && !renderer.xr.isPresenting) controls.update(); renderer.render(scene, camera); });
    addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
  }
  function start() { if (started || !visitor()) return; started = true; try { if (!window.THREE) throw new Error('Three.js não carregado'); buildScene(); hideLoading(); setStatus(`Olá, ${visitor().name}! Showroom pronto.`); } catch (e) { console.error('[App-Decor]', e); hideLoading(); setStatus('Não foi possível iniciar o showroom.'); } }
  form?.addEventListener('submit', (event) => { event.preventDefault(); const name = nameInput.value.trim(), number = numberInput.value.trim(); if (name.length < 2) return setError('Digite um nome válido.'); if (number.length < 3) return setError('Digite um número válido.'); sessionStorage.setItem(KEY, JSON.stringify({ name, number })); setError(''); showEntry(false); start(); });
  logout?.addEventListener('click', () => { sessionStorage.removeItem(KEY); location.reload(); });
  showEntry(!visitor()); if (visitor()) start(); else hideLoading();
})();
