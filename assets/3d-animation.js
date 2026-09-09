import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';

const stage = document.getElementById('three-stage');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (stage && !reduceMotion) {
  stage.style.pointerEvents = 'none';

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x01030a, 0.035);

  const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, 9);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  stage.appendChild(renderer.domElement);

  const world = new THREE.Group();
  scene.add(world);

  const cyan = new THREE.Color(0x35e9ff);
  const violet = new THREE.Color(0x8a63ff);
  const pink = new THREE.Color(0xff4fbc);
  const white = new THREE.Color(0xdffbff);

  scene.add(new THREE.AmbientLight(0x536bff, 0.35));
  const key = new THREE.PointLight(0x35e9ff, 90, 24, 2);
  const fill = new THREE.PointLight(0x8a63ff, 110, 28, 2);
  const rim = new THREE.PointLight(0xff4fbc, 80, 22, 2);
  scene.add(key, fill, rim);
  key.position.set(4, 3, 5);
  fill.position.set(-5, -2, 2);
  rim.position.set(1, -4, -3);

  // The cursor is treated as a force, not just a camera offset.
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, down: 0 };
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const pointerWorld = new THREE.Vector3();
  const pointerPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  function updatePointer(event) {
    pointer.targetX = (event.clientX / innerWidth - 0.5) * 2;
    pointer.targetY = -(event.clientY / innerHeight - 0.5) * 2;
    pointerNdc.set(pointer.targetX, pointer.targetY);
    raycaster.setFromCamera(pointerNdc, camera);
    raycaster.ray.intersectPlane(pointerPlane, pointerWorld);
  }

  addEventListener('pointermove', updatePointer, { passive: true });
  addEventListener('pointerdown', () => { pointer.down = 1; createShockwave(); });
  addEventListener('pointerup', () => { pointer.down = 0; });

  // ------------------------------------------------------------
  // 1. Deep particle flow: every particle bends toward the cursor.
  // ------------------------------------------------------------
  const PARTICLES = innerWidth < 700 ? 950 : 1900;
  const particlePositions = new Float32Array(PARTICLES * 3);
  const particleBase = new Float32Array(PARTICLES * 3);
  const particleSeeds = new Float32Array(PARTICLES * 4);

  for (let i = 0; i < PARTICLES; i++) {
    const i3 = i * 3;
    const z = -1 - Math.random() * 24;
    const spread = 2.4 + Math.abs(z) * 0.18;
    particleBase[i3] = (Math.random() - 0.5) * spread * 2;
    particleBase[i3 + 1] = (Math.random() - 0.5) * spread * 1.2;
    particleBase[i3 + 2] = z;
    particlePositions[i3] = particleBase[i3];
    particlePositions[i3 + 1] = particleBase[i3 + 1];
    particlePositions[i3 + 2] = z;
    particleSeeds[i * 4] = Math.random() * Math.PI * 2;
    particleSeeds[i * 4 + 1] = 0.3 + Math.random() * 1.5;
    particleSeeds[i * 4 + 2] = 0.5 + Math.random() * 2.5;
    particleSeeds[i * 4 + 3] = Math.random();
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particleMaterial = new THREE.PointsMaterial({
    color: 0x8fdfff,
    size: 0.035,
    transparent: true,
    opacity: 0.62,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const particleField = new THREE.Points(particleGeometry, particleMaterial);
  world.add(particleField);

  // ------------------------------------------------------------
  // 2. Twelve fluid ribbons. Cursor creates a visible vortex.
  // ------------------------------------------------------------
  const ribbons = [];
  const ribbonCount = innerWidth < 700 ? 7 : 12;
  const ribbonPoints = 140;
  const ribbonColors = [cyan, violet, pink, white];

  for (let r = 0; r < ribbonCount; r++) {
    const positions = new Float32Array(ribbonPoints * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({
      color: ribbonColors[r % ribbonColors.length],
      transparent: true,
      opacity: 0.18 + (r % 4) * 0.055,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const line = new THREE.Line(geometry, material);
    world.add(line);
    ribbons.push({
      line,
      positions,
      seed: Math.random() * 20,
      lane: (r - (ribbonCount - 1) / 2) * 0.42,
      amp: 0.5 + Math.random() * 0.8,
      speed: 0.5 + Math.random() * 0.65
    });
  }

  // ------------------------------------------------------------
  // 3. A 3D tunnel/showroom that changes depth as the page scrolls.
  // ------------------------------------------------------------
  const tunnel = new THREE.Group();
  world.add(tunnel);
  const rings = [];

  for (let i = 0; i < 9; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.5 + i * 0.08, 0.018, 8, 96),
      new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? cyan : i % 3 === 1 ? violet : pink,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    ring.position.z = -i * 2.7;
    ring.rotation.x = Math.PI / 2;
    tunnel.add(ring);
    rings.push(ring);
  }

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.0, 5),
    new THREE.MeshPhysicalMaterial({
      color: 0x6cecff,
      emissive: 0x164a72,
      emissiveIntensity: 2.2,
      metalness: 0.35,
      roughness: 0.08,
      transmission: 0.35,
      transparent: true,
      opacity: 0.72
    })
  );
  core.position.set(0, 0, -1.5);
  world.add(core);

  const coreHalo = new THREE.Mesh(
    new THREE.SphereGeometry(1.65, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0x3de8ff,
      transparent: true,
      opacity: 0.035,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  coreHalo.position.copy(core.position);
  world.add(coreHalo);

  // Shockwaves make clicks physically visible.
  const shockwaves = [];
  function createShockwave() {
    const wave = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.17, 64),
      new THREE.MeshBasicMaterial({
        color: 0x8fffff,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    wave.position.copy(pointerWorld);
    wave.position.z += 0.4;
    world.add(wave);
    shockwaves.push({ mesh: wave, life: 0 });
  }

  // ------------------------------------------------------------
  // 4. Scroll is a journey through the scene, not a tiny camera nudge.
  // ------------------------------------------------------------
  let scrollTarget = 0;
  let scroll = 0;
  let lastScrollY = scrollY;
  addEventListener('scroll', () => {
    scrollTarget = Math.min(1, Math.max(0, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)));
  }, { passive: true });

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    pointer.x += (pointer.targetX - pointer.x) * 0.085;
    pointer.y += (pointer.targetY - pointer.y) * 0.085;
    scroll += (scrollTarget - scroll) * 0.075;

    // Camera responds strongly enough to feel like an actual 3D space.
    const cameraX = pointer.x * 1.45;
    const cameraY = pointer.y * 0.9 + Math.sin(t * 0.18) * 0.12;
    const cameraZ = 9 - scroll * 7.2;
    camera.position.x += (cameraX - camera.position.x) * 0.045;
    camera.position.y += (cameraY - camera.position.y) * 0.045;
    camera.position.z += (cameraZ - camera.position.z) * 0.045;
    camera.rotation.z += ((-pointer.x * 0.055) - camera.rotation.z) * 0.04;

    // Cursor world position continuously pulls the fluid field around it.
    raycaster.setFromCamera(pointerNdc, camera);
    raycaster.ray.intersectPlane(pointerPlane, pointerWorld);

    const pX = pointerWorld.x;
    const pY = pointerWorld.y;

    for (let i = 0; i < PARTICLES; i++) {
      const i3 = i * 3;
      const s = i * 4;
      const bx = particleBase[i3];
      const by = particleBase[i3 + 1];
      const bz = particleBase[i3 + 2];
      const depth = ((bz + t * (1.5 + particleSeeds[s + 1])) % 25 + 25) % 25;
      const z = -1 - depth;
      const wave = Math.sin(t * particleSeeds[s + 2] + particleSeeds[s]) * 0.25;
      const flowX = Math.sin(z * 0.34 + t * 0.55 + particleSeeds[s]) * 0.7;
      const flowY = Math.cos(z * 0.25 + t * 0.4 + particleSeeds[s]) * 0.5;

      const dx = pX - bx;
      const dy = pY - by;
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;
      const influence = Math.max(0, 1 - dist / 4.2);
      const swirl = influence * influence;

      particlePositions[i3] = bx + flowX + dx * swirl * 0.9 + Math.sin(t + i) * 0.025;
      particlePositions[i3 + 1] = by + flowY + dy * swirl * 0.7 + wave;
      particlePositions[i3 + 2] = z;
    }
    particleGeometry.attributes.position.needsUpdate = true;

    ribbons.forEach((r, ri) => {
      const pos = r.positions;
      for (let i = 0; i < ribbonPoints; i++) {
        const u = i / (ribbonPoints - 1);
        const x = (u - 0.5) * 15;
        const phase = t * r.speed + r.seed;
        const baseY = r.lane + Math.sin(u * 8 + phase) * r.42;
        const baseZ = Math.cos(u * 6 - phase * 0.8) * 0.8 - u * 8;

        const dx = pX - x;
        const dy = pY - baseY;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;
        const influence = Math.max(0, 1 - dist / 3.8);
        const bend = influence * influence;
        const twist = Math.sin(u * 12 + phase) * bend * 1.15;

        pos[i * 3] = x + dx * bend * 0.18;
        pos[i * 3 + 1] = baseY + dy * bend * 0.48 + twist;
        pos[i * 3 + 2] = baseZ + bend * 1.4;
      }
      r.line.geometry.attributes.position.needsUpdate = true;
      r.line.rotation.z = pointer.x * (0.025 + ri * 0.002);
      r.line.rotation.y = Math.sin(t * 0.2 + ri) * 0.03 + pointer.x * 0.12;
    });

    // Scroll stages: every part of the long page changes the 3D composition.
    const stageIndex = Math.min(6, Math.floor(scroll * 7));
    const stageProgress = (scroll * 7) % 1;
    const stageTilt = stageIndex * 0.11 + stageProgress * 0.12;
    tunnel.rotation.x += ((pointer.y * 0.08 + stageTilt * 0.22) - tunnel.rotation.x) * 0.035;
    tunnel.rotation.y += ((pointer.x * 0.16 + Math.sin(t * 0.18) * 0.06) - tunnel.rotation.y) * 0.035;
    tunnel.position.z = -scroll * 4.5;
    tunnel.position.y = Math.sin(scroll * Math.PI * 6) * 0.45;

    rings.forEach((ring, i) => {
      ring.rotation.z = t * (0.08 + i * 0.012) + pointer.x * 0.35;
      ring.scale.setScalar(1 + Math.sin(t * 1.2 + i) * 0.05 + scroll * 0.08);
      ring.material.opacity = 0.12 + Math.abs(Math.sin(scroll * Math.PI * 4 + i)) * 0.24;
    });

    const pulse = 1 + Math.sin(t * 1.8) * 0.08 + Math.abs(pointer.x + pointer.y) * 0.05;
    core.scale.setScalar(pulse + scroll * 0.22);
    core.rotation.x += 0.006 + pointer.y * 0.006;
    core.rotation.y += 0.009 + pointer.x * 0.008;
    core.position.x += (pointer.x * 0.65 - core.position.x) * 0.025;
    core.position.y += (pointer.y * 0.45 - core.position.y) * 0.025;
    coreHalo.scale.setScalar(pulse * 1.15);

    // Lighting itself follows the cursor and scrolls through the scene.
    key.position.x += (pointer.x * 5 - key.position.x) * 0.035;
    key.position.y += (pointer.y * 4 - key.position.y) * 0.035;
    key.position.z = 4 - scroll * 8;
    fill.position.x += (-pointer.x * 4 - fill.position.x) * 0.025;
    fill.position.y += (-pointer.y * 3 - fill.position.y) * 0.025;
    rim.position.z = -3 - scroll * 5;

    shockwaves.forEach((s, index) => {
      s.life += 0.035;
      s.mesh.scale.setScalar(1 + s.life * 12);
      s.mesh.material.opacity = Math.max(0, 0.85 - s.life);
      s.mesh.rotation.z += 0.04;
      if (s.life >= 0.85) {
        world.remove(s.mesh);
        shockwaves.splice(index, 1);
      }
    });

    const scrollVelocity = Math.abs(scrollTarget - scroll);
    particleMaterial.size = 0.028 + scrollVelocity * 0.18 + Math.abs(pointer.x) * 0.012;
    particleMaterial.opacity = 0.48 + Math.min(0.28, scrollVelocity * 3);

    world.rotation.y += ((pointer.x * 0.05) - world.rotation.y) * 0.025;
    world.rotation.x += ((-pointer.y * 0.035) - world.rotation.x) * 0.025;

    renderer.render(scene, camera);
    lastScrollY = scrollY;
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    renderer.setSize(innerWidth, innerHeight);
  });

  animate();
}
