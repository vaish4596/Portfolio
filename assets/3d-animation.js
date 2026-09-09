import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';

const stage = document.getElementById('three-stage');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (stage && !reduced) {
  stage.style.pointerEvents = 'none';

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x02030a, 0.035);
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, 10);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  stage.appendChild(renderer.domElement);

  const world = new THREE.Group();
  scene.add(world);
  scene.add(new THREE.AmbientLight(0x536bff, 0.3));

  const lightA = new THREE.PointLight(0x35e9ff, 100, 28, 2);
  const lightB = new THREE.PointLight(0x8b5cff, 120, 30, 2);
  const lightC = new THREE.PointLight(0xff4fb9, 80, 24, 2);
  scene.add(lightA, lightB, lightC);

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const ndc = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();

  function move(e) {
    pointer.tx = (e.clientX / innerWidth - 0.5) * 2;
    pointer.ty = -(e.clientY / innerHeight - 0.5) * 2;
    ndc.set(pointer.tx, pointer.ty);
  }
  addEventListener('pointermove', move, { passive: true });

  // Cursor-reactive particle flow. The mouse creates a vortex in the field.
  const count = innerWidth < 700 ? 900 : 1800;
  const pos = new Float32Array(count * 3);
  const base = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const j = i * 3;
    const z = -1 - Math.random() * 24;
    base[j] = (Math.random() - 0.5) * (5 + Math.abs(z) * 0.25);
    base[j + 1] = (Math.random() - 0.5) * (3.5 + Math.abs(z) * 0.12);
    base[j + 2] = z;
    pos[j] = base[j]; pos[j + 1] = base[j + 1]; pos[j + 2] = z;
    seed[i] = Math.random() * 20;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const particleMaterial = new THREE.PointsMaterial({ color: 0x9cecff, size: 0.034, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false });
  world.add(new THREE.Points(particleGeometry, particleMaterial));

  // Fluid-like light ribbons.
  const ribbons = [];
  const ribbonCount = innerWidth < 700 ? 6 : 10;
  const points = 150;
  const palette = [0x35e9ff, 0x8b5cff, 0xff4fb9, 0x72ffd8];
  for (let r = 0; r < ribbonCount; r++) {
    const data = new Float32Array(points * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data, 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: palette[r % palette.length], transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
    world.add(line);
    ribbons.push({ line, data, lane: (r - (ribbonCount - 1) / 2) * 0.45, seed: Math.random() * 20, speed: 0.45 + Math.random() * 0.5 });
  }

  // Receding 3D portals make scroll visibly change the depth of the scene.
  const tunnel = new THREE.Group();
  world.add(tunnel);
  const portals = [];
  for (let i = 0; i < 10; i++) {
    const portal = new THREE.Mesh(
      new THREE.TorusGeometry(3.2 + i * 0.12, 0.025, 8, 96),
      new THREE.MeshBasicMaterial({ color: palette[i % palette.length], transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    portal.position.z = -i * 2.4;
    portal.rotation.x = Math.PI / 2;
    tunnel.add(portal);
    portals.push(portal);
  }

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.9, 5),
    new THREE.MeshPhysicalMaterial({ color: 0x62ecff, emissive: 0x15527a, emissiveIntensity: 2, metalness: 0.35, roughness: 0.08, transmission: 0.3, transparent: true, opacity: 0.78 })
  );
  world.add(core);

  // Click creates a shockwave at the cursor.
  const waves = [];
  addEventListener('pointerdown', () => {
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) {
      const wave = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 64), new THREE.MeshBasicMaterial({ color: 0xb8ffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      wave.position.copy(hit);
      world.add(wave);
      waves.push({ mesh: wave, life: 0 });
    }
  });

  let scrollTarget = 0;
  let scroll = 0;
  addEventListener('scroll', () => {
    scrollTarget = Math.min(1, Math.max(0, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)));
  }, { passive: true });

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    pointer.x += (pointer.tx - pointer.x) * 0.08;
    pointer.y += (pointer.ty - pointer.y) * 0.08;
    scroll += (scrollTarget - scroll) * 0.065;

    // Strong cursor parallax: camera, lights and geometry all react independently.
    const cx = pointer.x * 1.8;
    const cy = pointer.y * 1.05;
    camera.position.x += (cx - camera.position.x) * 0.05;
    camera.position.y += (cy - camera.position.y) * 0.05;
    camera.position.z += ((10 - scroll * 7) - camera.position.z) * 0.045;
    camera.rotation.z += (-pointer.x * 0.06 - camera.rotation.z) * 0.04;

    ray.setFromCamera(ndc, camera);
    ray.ray.intersectPlane(plane, hit);
    const px = hit.x, py = hit.y;

    for (let i = 0; i < count; i++) {
      const j = i * 3;
      const z0 = base[j + 2];
      const z = -1 - ((Math.abs(z0) + t * (1 + (seed[i] % 1.7))) % 24);
      const dx = px - base[j];
      const dy = py - base[j + 1];
      const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
      const force = Math.pow(Math.max(0, 1 - d / 4.5), 2);
      const swirl = Math.sin(t * 1.8 + seed[i] + d * 2) * force * 1.3;
      pos[j] = base[j] + Math.sin(z * 0.32 + t * 0.45 + seed[i]) * 0.65 + dx * force * 0.9 - dy * swirl;
      pos[j + 1] = base[j + 1] + Math.cos(z * 0.25 + t * 0.4 + seed[i]) * 0.45 + dy * force * 0.8 + dx * swirl;
      pos[j + 2] = z;
    }
    particleGeometry.attributes.position.needsUpdate = true;

    ribbons.forEach((r, ri) => {
      for (let i = 0; i < points; i++) {
        const u = i / (points - 1);
        const x = (u - 0.5) * 15;
        const phase = t * r.speed + r.seed;
        const y0 = r.lane + Math.sin(u * 8 + phase) * 0.6;
        const z0 = Math.cos(u * 6 - phase) * 0.7 - u * 9;
        const dx = px - x, dy = py - y0;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
        const force = Math.pow(Math.max(0, 1 - d / 4), 2);
        r.data[i * 3] = x + dx * force * 0.2;
        r.data[i * 3 + 1] = y0 + dy * force * 0.65 + Math.sin(u * 15 + phase) * force * 1.2;
        r.data[i * 3 + 2] = z0 + force * 1.8;
      }
      r.line.geometry.attributes.position.needsUpdate = true;
      r.line.rotation.y = pointer.x * 0.15 + Math.sin(t * 0.2 + ri) * 0.025;
      r.line.rotation.z = pointer.x * 0.035;
    });

    // Scrolling travels through the portals instead of merely moving a background.
    tunnel.position.z = -scroll * 8;
    tunnel.position.y = Math.sin(scroll * Math.PI * 8) * 0.5;
    tunnel.rotation.y += (pointer.x * 0.2 - tunnel.rotation.y) * 0.04;
    tunnel.rotation.x += (pointer.y * 0.12 + scroll * 0.2 - tunnel.rotation.x) * 0.035;
    portals.forEach((portal, i) => {
      portal.rotation.z = t * (0.08 + i * 0.01) + pointer.x * 0.4;
      portal.scale.setScalar(1 + Math.sin(t * 1.5 + i) * 0.06 + scroll * 0.1);
      portal.material.opacity = 0.1 + Math.abs(Math.sin(scroll * Math.PI * 7 + i)) * 0.28;
    });

    core.position.x += (pointer.x * 0.8 - core.position.x) * 0.03;
    core.position.y += (pointer.y * 0.55 - core.position.y) * 0.03;
    core.rotation.x += 0.006 + pointer.y * 0.008;
    core.rotation.y += 0.01 + pointer.x * 0.01;
    core.scale.setScalar(1 + Math.sin(t * 1.8) * 0.08 + Math.abs(pointer.x + pointer.y) * 0.1 + scroll * 0.25);

    lightA.position.set(pointer.x * 5, pointer.y * 4, 4 - scroll * 8);
    lightB.position.set(-pointer.x * 4, -pointer.y * 3, 1 - scroll * 5);
    lightC.position.z = -4 - scroll * 4;

    waves.forEach((w, i) => {
      w.life += 0.035;
      w.mesh.scale.setScalar(1 + w.life * 13);
      w.mesh.material.opacity = Math.max(0, 0.85 - w.life);
      if (w.life > 0.85) { world.remove(w.mesh); waves.splice(i, 1); }
    });

    particleMaterial.size = 0.03 + Math.abs(scrollTarget - scroll) * 0.2;
    renderer.render(scene, camera);
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    renderer.setSize(innerWidth, innerHeight);
  });

  animate();
}
