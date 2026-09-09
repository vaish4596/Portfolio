import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';

const stage = document.getElementById('three-stage');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (stage && !reduced) {
  stage.style.pointerEvents = 'none';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000002);
  scene.fog = new THREE.FogExp2(0x000002, 0.018);

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 160);
  camera.position.set(0, 3.6, 8.5);
  camera.lookAt(0, 1.0, -18);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.55;
  stage.appendChild(renderer.domElement);

  // ------------------------------------------------------------
  // Interaction
  // ------------------------------------------------------------
  const pointer = {
    x: 0, y: 0,
    tx: 0, ty: 0,
    vx: 0, vy: 0,
    speed: 0
  };

  let lastX = innerWidth * 0.5;
  let lastY = innerHeight * 0.5;

  addEventListener('pointermove', (e) => {
    const nx = (e.clientX / innerWidth - 0.5) * 2;
    const ny = -(e.clientY / innerHeight - 0.5) * 2;
    const dx = (e.clientX - lastX) / innerWidth;
    const dy = (e.clientY - lastY) / innerHeight;

    pointer.vx = THREE.MathUtils.lerp(pointer.vx, dx * 8, 0.35);
    pointer.vy = THREE.MathUtils.lerp(pointer.vy, dy * 8, 0.35);
    pointer.tx = nx;
    pointer.ty = ny;
    lastX = e.clientX;
    lastY = e.clientY;
  }, { passive: true });

  // ------------------------------------------------------------
  // Star field — small, quiet points in the black sky.
  // ------------------------------------------------------------
  const starCount = innerWidth < 700 ? 500 : 1000;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const j = i * 3;
    starPositions[j] = (Math.random() - 0.5) * 80;
    starPositions[j + 1] = 5 + Math.random() * 25;
    starPositions[j + 2] = -5 - Math.random() * 105;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.045,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  scene.add(new THREE.Points(starGeo, starMat));

  // ------------------------------------------------------------
  // The main landscape: dense rows of luminous dots over rolling waves.
  // This is the key visual language from the supplied reference video.
  // ------------------------------------------------------------
  const layers = [];
  const layerCount = innerWidth < 700 ? 4 : 6;
  const cols = innerWidth < 700 ? 76 : 112;
  const rows = innerWidth < 700 ? 38 : 52;
  const spacingX = 0.29;
  const spacingZ = 0.56;

  const palette = [
    new THREE.Color(0xff126f),
    new THREE.Color(0xff5a00),
    new THREE.Color(0xffe600),
    new THREE.Color(0x35ff35),
    new THREE.Color(0x00d9ff),
    new THREE.Color(0x4738ff),
    new THREE.Color(0xc42dff)
  ];

  function rainbowColor(v) {
    const x = ((v % 1) + 1) % 1;
    const scaled = x * (palette.length - 1);
    const i = Math.min(palette.length - 2, Math.floor(scaled));
    return palette[i].clone().lerp(palette[i + 1], scaled - i);
  }

  for (let layer = 0; layer < layerCount; layer++) {
    const count = cols * rows;
    const pos = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const meta = new Float32Array(count * 3);

    const zBase = -4 - layer * 9;
    const width = (cols - 1) * spacingX;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const j = i * 3;
        const u = c / (cols - 1);
        const v = r / (rows - 1);
        const x = (u - 0.5) * width;
        const z = zBase - r * spacingZ;

        pos[j] = x;
        pos[j + 1] = 0;
        pos[j + 2] = z;

        const col = rainbowColor(u * 0.92 + layer * 0.075 + r * 0.008);
        colors[j] = col.r;
        colors[j + 1] = col.g;
        colors[j + 2] = col.b;

        meta[j] = x;
        meta[j + 1] = z;
        meta[j + 2] = Math.random() * Math.PI * 2;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: innerWidth < 700 ? 0.075 : 0.095,
      vertexColors: true,
      transparent: true,
      opacity: 0.7 - layer * 0.065,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);
    layers.push({ points, pos, meta, layer, zBase });
  }

  // ------------------------------------------------------------
  // Organic glowing domes sitting on the moving landscape.
  // ------------------------------------------------------------
  function createDomeGeometry(radius = 1, segments = 18, rings = 8) {
    const vertices = [];
    const indices = [];

    for (let y = 0; y <= rings; y++) {
      const phi = (Math.PI * 0.5) * (y / rings);
      const rr = Math.sin(phi) * radius;
      const yy = Math.cos(phi) * radius;
      for (let x = 0; x <= segments; x++) {
        const theta = (Math.PI * 2 * x) / segments;
        vertices.push(Math.cos(theta) * rr, yy, Math.sin(theta) * rr);
      }
    }

    for (let y = 0; y < rings; y++) {
      for (let x = 0; x < segments; x++) {
        const a = y * (segments + 1) + x;
        const b = a + 1;
        const c = a + segments + 1;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }

  const domeGeometry = createDomeGeometry(1, 18, 8);
  const domeColors = [0xff174f, 0xff6a00, 0xffe600, 0x1aff3d, 0x00d9ff, 0x392dff, 0xc300ff];
  const domes = [];
  const domeCount = innerWidth < 700 ? 30 : 52;

  for (let i = 0; i < domeCount; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: domeColors[i % domeColors.length],
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const dome = new THREE.Mesh(domeGeometry, material);
    const depth = Math.random();
    dome.position.set(
      (Math.random() - 0.5) * 28,
      0.02,
      -6 - depth * 45
    );
    const s = 0.28 + Math.random() * (0.85 + (1 - depth) * 0.8);
    dome.scale.set(s * (0.8 + Math.random() * 0.5), s * (0.55 + Math.random() * 0.45), s);
    domes.push({
      mesh: dome,
      baseX: dome.position.x,
      baseZ: dome.position.z,
      phase: Math.random() * Math.PI * 2,
      speed: 0.35 + Math.random() * 0.75,
      amp: 0.12 + Math.random() * 0.35,
      depth
    });
    scene.add(dome);
  }

  // Soft glow sprites underneath some domes.
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const gc = glowCanvas.getContext('2d');
  const gradient = gc.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,0.7)');
  gradient.addColorStop(0.15, 'rgba(255,255,255,0.24)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.06)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  gc.fillStyle = gradient;
  gc.fillRect(0, 0, 128, 128);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);

  domes.forEach((d, i) => {
    if (i % 2 !== 0) return;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture,
      color: d.mesh.material.color,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    const s = d.mesh.scale.x * 3.3;
    glow.scale.set(s, s * 0.6, 1);
    glow.position.set(d.baseX, 0.02, d.baseZ + 0.03);
    scene.add(glow);
    d.glow = glow;
  });

  // ------------------------------------------------------------
  // Flowing contour lines. They undulate across the terrain and converge
  // toward the horizon, producing the long colored paths seen in the video.
  // ------------------------------------------------------------
  const contourLines = [];
  const contourCount = innerWidth < 700 ? 10 : 17;
  const contourPoints = 95;

  for (let i = 0; i < contourCount; i++) {
    const data = new Float32Array(contourPoints * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data, 3));
    const mat = new THREE.LineBasicMaterial({
      color: domeColors[i % domeColors.length],
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    contourLines.push({
      line,
      data,
      lane: (i - (contourCount - 1) / 2) * 0.62,
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 0.65,
      amp: 0.45 + Math.random() * 0.65
    });
  }

  // ------------------------------------------------------------
  // Central luminous beam / cursor trail. The reference repeatedly pulls
  // the viewer's eye toward a bright point on the horizon.
  // ------------------------------------------------------------
  const beamLines = [];
  const beamCount = innerWidth < 700 ? 4 : 8;
  const beamPoints = 34;

  for (let i = 0; i < beamCount; i++) {
    const data = new Float32Array(beamPoints * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data, 3));
    const mat = new THREE.LineBasicMaterial({
      color: i % 3 === 0 ? 0xffffff : (i % 3 === 1 ? 0xffd75a : 0xff9b35),
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    beamLines.push({ line, data, side: i - (beamCount - 1) / 2, phase: Math.random() * 6.28 });
  }

  // ------------------------------------------------------------
  // Scroll controls the travel through the landscape.
  // ------------------------------------------------------------
  let scrollTarget = 0;
  let scrollProgress = 0;
  addEventListener('scroll', () => {
    scrollTarget = THREE.MathUtils.clamp(
      scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight),
      0, 1
    );
  }, { passive: true });

  const clock = new THREE.Clock();

  function waveHeight(x, z, t, layer) {
    const depth = Math.max(0, -z);
    let h =
      Math.sin(x * 0.72 + t * (0.55 + layer * 0.035) + depth * 0.055) * 0.55 +
      Math.sin(x * 0.31 - t * 0.42 + depth * 0.095) * 0.42 +
      Math.sin(depth * 0.23 + t * 0.7 + x * 0.12) * 0.32;

    // Mouse creates a travelling depression/ripple across the landscape.
    const mx = pointer.x * 8.5;
    const mz = -10 - pointer.y * 15;
    const dx = x - mx;
    const dz = z - mz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const ripple = Math.exp(-dist * 0.12) * Math.sin(dist * 1.55 - t * 3.2) * 1.25;
    h += ripple * (0.25 + pointer.speed * 0.9);

    return h;
  }

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    pointer.x += (pointer.tx - pointer.x) * 0.065;
    pointer.y += (pointer.ty - pointer.y) * 0.065;
    pointer.vx *= 0.88;
    pointer.vy *= 0.88;
    const targetSpeed = Math.min(1, Math.hypot(pointer.vx, pointer.vy));
    pointer.speed += (targetSpeed - pointer.speed) * 0.1;
    scrollProgress += (scrollTarget - scrollProgress) * 0.035;

    // Landscape motion.
    layers.forEach((layer) => {
      const { pos, meta } = layer;
      const travel = (t * (1.0 + scrollProgress * 2.2)) % 9;

      for (let i = 0; i < pos.length / 3; i++) {
        const j = i * 3;
        const x = meta[j];
        const z = meta[j + 1];
        const phase = meta[j + 2];
        const localZ = z + travel;
        pos[j + 1] = waveHeight(x, localZ, t + phase * 0.04, layer.layer) - layer.layer * 0.045;
      }
      layer.points.geometry.attributes.position.needsUpdate = true;
      layer.points.rotation.y = pointer.x * 0.025;
      layer.points.position.x = pointer.x * 0.18;
    });

    // Contour paths ride directly over the same wave field.
    contourLines.forEach((c, ci) => {
      const phase = t * c.speed + c.phase;
      for (let i = 0; i < contourPoints; i++) {
        const u = i / (contourPoints - 1);
        const x = (u - 0.5) * 29 + Math.sin(phase * 0.45 + u * 4.0) * 0.7;
        const z = -5 - u * 66;
        const y = waveHeight(x, z, t, ci % layerCount) + 0.035 + Math.sin(u * 8 + phase) * c.amp * 0.15;
        const near = 1 - u;
        const pull = near * (0.25 + pointer.speed * 0.85);
        c.data[i * 3] = x + pointer.x * pull * 1.4;
        c.data[i * 3 + 1] = y + Math.sin(u * 13 + phase) * pull * 0.7;
        c.data[i * 3 + 2] = z + pointer.y * pull * 2.0;
      }
      c.line.geometry.attributes.position.needsUpdate = true;
      c.line.material.opacity = 0.23 + pointer.speed * 0.32;
    });

    // Domes pulse, drift and follow the moving wave surface.
    domes.forEach((d, i) => {
      const wobble = Math.sin(t * d.speed + d.phase) * d.amp;
      const x = d.baseX + Math.sin(t * 0.17 + d.phase) * (0.25 + d.depth * 0.5) + pointer.x * (1 - d.depth) * 1.4;
      const z = d.baseZ + Math.cos(t * 0.11 + d.phase) * 0.3;
      const y = waveHeight(x, z, t, i % layerCount) + 0.12 + wobble * 0.1;
      d.mesh.position.set(x, y, z);
      const pulse = 1 + Math.sin(t * 1.35 + d.phase) * 0.055 + pointer.speed * 0.14;
      d.mesh.scale.x *= 0.98;
      d.mesh.scale.y *= 0.98;
      d.mesh.scale.z *= 0.98;
      const baseScale = 0.28 + d.depth * 0.65;
      d.mesh.scale.set(
        baseScale * (0.95 + Math.sin(d.phase) * 0.15) * pulse,
        baseScale * 0.72 * pulse,
        baseScale * pulse
      );
      d.mesh.material.opacity = 0.58 + pointer.speed * 0.3;
      if (d.glow) {
        d.glow.position.set(x, y - 0.02, z + 0.02);
        const gs = baseScale * 2.8 * pulse;
        d.glow.scale.set(gs, gs * 0.58, 1);
        d.glow.material.opacity = 0.12 + pointer.speed * 0.2;
      }
    });

    // Beam strands bend toward the cursor and flare with movement.
    beamLines.forEach((b, bi) => {
      for (let i = 0; i < beamPoints; i++) {
        const u = i / (beamPoints - 1);
        const z = 2.6 - u * 30;
        const spread = Math.pow(1 - u, 0.72) * 4.2;
        const converge = Math.pow(u, 2.2);
        const baseX = b.side * 0.18 + Math.sin(t * 1.1 + b.phase + u * 5) * 0.06;
        const x = baseX + b.side * spread * 0.22 + pointer.x * spread * 0.38 + Math.sin(u * 7 + t) * pointer.speed * 0.45;
        const y = 0.05 + Math.pow(1 - u, 1.4) * 1.25 + pointer.y * spread * 0.11;
        b.data[i * 3] = x;
        b.data[i * 3 + 1] = y + converge * 0.3;
        b.data[i * 3 + 2] = z;
      }
      b.line.geometry.attributes.position.needsUpdate = true;
      b.line.material.opacity = 0.18 + pointer.speed * 0.42;
    });

    // Cinematic camera: low over the landscape, steering with the cursor.
    const targetCamX = pointer.x * 2.5;
    const targetCamY = 3.1 + pointer.y * 0.95 - scrollProgress * 0.4;
    const targetCamZ = 8.2 - scrollProgress * 5.5;
    camera.position.x += (targetCamX - camera.position.x) * 0.035;
    camera.position.y += (targetCamY - camera.position.y) * 0.035;
    camera.position.z += (targetCamZ - camera.position.z) * 0.035;
    camera.rotation.z += (-pointer.x * 0.028 - camera.rotation.z) * 0.03;

    const lookX = pointer.x * 2.1;
    const lookY = 0.8 + pointer.y * 0.55;
    const lookZ = -19 - scrollProgress * 8;
    const lookTarget = new THREE.Vector3(lookX, lookY, lookZ);
    camera.lookAt(lookTarget);

    // Keep the horizon light alive.
    starMat.opacity = 0.48 + Math.sin(t * 0.7) * 0.12;

    renderer.render(scene, camera);
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
    renderer.setSize(innerWidth, innerHeight);
  });

  animate();
}
