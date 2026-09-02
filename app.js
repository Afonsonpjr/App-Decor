/* App-Decor — WebXR-safe runtime */
(function () {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const loading = $('#loading');
  const status = $('#status') || $('#xr-status');
  const setStatus = (message) => { if (status) status.textContent = message; };
  const finishLoading = () => { if (loading) { loading.classList.add('hidden'); loading.setAttribute('aria-hidden', 'true'); } };

  let scene, camera, renderer, controls;
  let xrButtons = [];
  let clock;

  function assetUrl(name) {
    return `assets/models/${encodeURIComponent(name)}`;
  }

  function makeMaterial(textureName, fallbackColor) {
    const material = new THREE.MeshStandardMaterial({ color: fallbackColor, roughness: 0.78, metalness: 0.04 });
    if (!textureName) return material;
    const loader = new THREE.TextureLoader();
    loader.load(assetUrl(textureName), (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2, 2);
      material.map = texture;
      material.needsUpdate = true;
    }, undefined, () => setStatus('Modo visual ativo; algumas imagens não foram encontradas.'));
    return material;
  }

  function addRoom() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), makeMaterial('quartzo-mica-piso.jpg', 0x777777));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const back = new THREE.Mesh(new THREE.PlaneGeometry(18, 8), makeMaterial('quartzo-mica-parede.jpg', 0xe6e1d8));
    back.position.set(0, 4, -4);
    scene.add(back);

    const side = new THREE.Mesh(new THREE.PlaneGeometry(18, 8), makeMaterial('quartzo-mica-parede.jpg', 0xd9d2c8));
    side.rotation.y = Math.PI / 2;
    side.position.set(-9, 4, 5);
    scene.add(side);

    const shelf = new THREE.Mesh(new THREE.BoxGeometry(7, 0.25, 1.5), new THREE.MeshStandardMaterial({ color: 0x292929, roughness: 0.55 }));
    shelf.position.set(0, 2.2, -2.8);
    scene.add(shelf);
  }

  function addProducts() {
    const names = [
      ['Minerio', 'minerio.png', 0xb45b42],
      ['Topazio', 'topazio.png', 0xd99b35],
      ['Jaspe', 'jaspe.png', 0x8d5a45],
      ['Onix', 'onix.png', 0x252525]
    ];
    names.forEach(([label, file, color], index) => {
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 1.15, 32), makeMaterial(file, color));
      body.position.y = 2.95;
      group.add(body);
      group.position.x = (index - 1.5) * 1.45;
      group.position.z = -2.75;
      group.userData.label = label;
      scene.add(group);
    });
  }

  function setupXR() {
    if (!renderer.xr) return;
    const supportsXR = 'xr' in navigator;
    const addButton = (factory, mode, options) => {
      let button;
      try { button = factory(renderer, options); }
      catch (error) { button = null; }
      if (button) {
        button.dataset.mode = mode;
        button.addEventListener('click', () => setStatus(`Solicitando modo ${mode}…`));
        document.body.appendChild(button);
        xrButtons.push(button);
      }
    };
    if (!supportsXR) {
      setStatus('AR/VR requerem um dispositivo e navegador compatíveis.');
      return;
    }
    if (window.VRButton) addButton(window.VRButton.createButton, 'VR', { requiredFeatures: ['local-floor'] });
    if (window.ARButton) addButton(window.ARButton.createButton, 'AR', { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: document.body } });
    if (!window.VRButton && !window.ARButton) setStatus('AR/VR indisponíveis nesta versão do navegador.');
  }

  function init() {
    try {
      if (!window.THREE) throw new Error('Three.js não carregado');
      const canvas = $('#scene') || $('#canvas') || document.querySelector('canvas');
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x111318);
      camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 100);
      camera.position.set(0, 2.2, 8);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, canvas: canvas || undefined });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.setSize(innerWidth, innerHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.xr.enabled = true;
      document.body.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.2));
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(4, 8, 6);
      scene.add(key);
      addRoom();
      addProducts();

      if (window.OrbitControls) {
        controls = new window.OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 2.2, -2);
        controls.enableDamping = true;
      }
      setupXR();
      clock = new THREE.Clock();
      renderer.setAnimationLoop(() => {
        clock.getDelta();
        if (controls && !renderer.xr.isPresenting) controls.update();
        renderer.render(scene, camera);
      });
      addEventListener('resize', () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
      });
      finishLoading();
      setStatus('Showroom pronto. Se o dispositivo suportar WebXR, os botões AR/VR estarão disponíveis.');
    } catch (error) {
      console.error('[App-Decor]', error);
      finishLoading();
      setStatus('Não foi possível iniciar o showroom. Atualize a página ou verifique o console.');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
