// ============================================
// Hero3D — faceted brass sculpture, Three.js
// Pure side-effect module. Target: #hero-canvas
// ============================================
import * as THREE from 'three';

const HOST = document.getElementById('hero-canvas');
const REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const HOVER  = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

if (HOST && window.WebGLRenderingContext) {
  let raf = null, running = false;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 5.2);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  HOST.appendChild(renderer.domElement);

  // --- Procedural environment for metal reflections ---
  const pmrem = new THREE.PMREMGenerator(renderer);
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 512;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.00, '#2a1f0c');
  g.addColorStop(0.42, '#0a0b0d');
  g.addColorStop(1.00, '#0a0b0d');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 512);
  // warm reflection band (key)
  ctx.fillStyle = 'rgba(248,226,168,0.92)'; ctx.fillRect(0, 110, 16, 22);
  // cool reflection band (rim)
  ctx.fillStyle = 'rgba(120,162,210,0.30)'; ctx.fillRect(0, 360, 16, 26);
  const envTex = new THREE.CanvasTexture(cv);
  envTex.colorSpace = THREE.SRGBColorSpace;
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = pmrem.fromEquirectangular(envTex).texture;
  envTex.dispose();

  // --- Faceted brass sculpture ---
  const geo = new THREE.IcosahedronGeometry(1.35, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xD6B568,
    metalness: 1.0,
    roughness: 0.30,
    flatShading: true,
    envMapIntensity: 1.25
  });
  const sculpt = new THREE.Mesh(geo, mat);
  scene.add(sculpt);

  // Outer wireframe hull — depth + "holding gravitas"
  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.82, 0),
    new THREE.MeshBasicMaterial({ color: 0xCBA75A, wireframe: true, transparent: true, opacity: 0.13 })
  );
  scene.add(wire);

  // --- Lights ---
  const key = new THREE.DirectionalLight(0xfff0d2, 1.7); key.position.set(4.5, 3.5, 5); scene.add(key);
  const rim = new THREE.PointLight(0x7da6d8, 1.3, 40); rim.position.set(-4, -2.5, -4); scene.add(rim);
  scene.add(new THREE.AmbientLight(0x2a2a2a, 0.7));

  // --- Pointer parallax ---
  const target = { x: 0, y: 0 };
  let cur = { x: 0, y: 0 };
  if (HOVER && !REDUCE) {
    window.addEventListener('pointermove', (e) => {
      const r = HOST.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / Math.max(r.width, 1)) * 2 - 1;
      target.y = ((e.clientY - r.top) / Math.max(r.height, 1)) * 2 - 1;
    }, { passive: true });
  }

  // --- Resize ---
  function resize() {
    const r = HOST.getBoundingClientRect();
    const w = Math.max(r.width, 1), h = Math.max(r.height, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(HOST);
  window.addEventListener('resize', resize, { passive: true });
  resize();

  // --- Frame ---
  function render() {
    cur.x += (target.x - cur.x) * 0.045;
    cur.y += (target.y - cur.y) * 0.045;
    sculpt.rotation.y += 0.0034;
    sculpt.rotation.x = cur.y * 0.45;
    sculpt.rotation.z = cur.x * 0.12;
    wire.rotation.y -= 0.0016;
    wire.rotation.x = -cur.y * 0.3;
    renderer.render(scene, camera);
  }

  function loop() {
    render();
    if (running) raf = requestAnimationFrame(loop);
  }

  if (REDUCE) {
    render();                      // one static frame
  } else {
    running = true;
    loop();
  }

  // Pause when offscreen (perf)
  if ('IntersectionObserver' in window && !REDUCE) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          if (!running) { running = true; loop(); }
        } else {
          running = false;
          if (raf) cancelAnimationFrame(raf);
        }
      });
    });
    io.observe(HOST);
  }
}
