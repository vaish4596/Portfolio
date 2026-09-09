import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';

const stage = document.getElementById('three-stage');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (stage && !reduced) {
  stage.style.pointerEvents = 'none';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000002);
  scene.fog = new THREE.FogExp2(0x000002, 0.014);

  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 180);
  camera.position.set(0, 3.5, 8);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.65;
  stage.appendChild(renderer.domElement);

  const world = new THREE.Group();
  scene.add(world);

  // ------------------------------------------------------------
  // Cursor = a 360-degree camera controller.
  // Moving from the left edge to the right edge sweeps the camera
  // through a complete 360-degree horizontal orbit. Vertical movement
  // controls the viewing elevation.
  // ------------------------------------------------------------
  const pointer = {
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    vx: 0,
    vy: 0,
    speed: 0
  };

  let lastX = innerWidth * 0.5;
  let lastY = innerHeight * 0.5;

  addEventListener('pointermove', (event) => {
    const nx = THREE.MathUtils.clamp((event.clientX / innerWidth - 0.5) * 2, -1, 1);
    const ny = THREE.MathUtils.clamp(-(event.clientY / innerHeight - 0.5) * 2, -1, 1);

    pointer.vx = THREE.MathUtils.lerp(pointer.vx, (event.clientX - lastX) / innerWidth * 11, 0.42);
    pointer.vy = THREE.MathUtils.lerp(pointer.vy, (event.clientY - lastY) / innerHeight * 11, 0.42);
    pointer.tx = nx;
    pointer.ty = ny;

    lastX = event.clientX;
    lastY = event.clientY;
  }, { passive: true });

  // ------------------------------------------------------------
  // Tiny stars: the background stays alive even when the landscape
  // is moving through another direction.
  // ------------------------------------------------------------
  const starCount = innerWidth < 700 ? 650 : 1400;
  const starPositions = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);

  for (let i = 0; i < starCount; i++) {
    const j = i * 3;
    starPositions[j] = (Math.random() - 0.5) * 105;
    starPositions[j + 1] = 2 + Math.random() * 45;
    starPositions[j + 2] = -Math.random() * 125 - 5;
    starSizes[i] = 0.025 + Math.random() * 0.06;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.045,
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ------------------------------------------------------------
  // Procedural rainbow wave landscape.
  // Dense points form a real 3D surface. The surface never stops
  // moving and the cursor produces travelling ripples.
  // ------------------------------------------------------------
  const cols = innerWidth < 700 ? 90 : 145;
  const rows = innerWidth < 700 ? 75 : 105;
  const pointCount = cols * rows;
  const terrainPositions = new Float32Array(pointCount * 3);
  const terrainColors = new Float32Array(pointCount * 3);
  const terrainMeta = new Float32Array(pointCount * 3);

  const rainbow = [
    new THREE.Color(0xff005d),
    new THREE.Color(0xff3b00),
    new THREE.Color(0xffe500),
    new THREE.Color(0x27ff43),
    new THREE.Color(0x00e7ff),
    new THREE.Color(0x355cff),
    new THREE.Color(0xc928ff)
  ];

  function rainbowAt(value) {
    const x = ((value % 1) + 1) % 1;
    const scaled = x * (rainbow.length - 1);
    const index = Math.min(rainbow.length - 2, Math.floor(scaled));
    return rainbow[index].clone().lerp(rainbow[index + 1], scaled - index);
  }

  const terrainWidth = 34;
  const terrainDepth = 92;

  for (let r = 0; r < rows; r++) {
    const v = r / (rows - 1);
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1);
      const i = r * cols + c;
      const j = i * 3;
      const x = (u - 0.5) * terrainWidth;
      const z = -4 - v * terrainDepth;

      terrainPositions[j] = x;
      terrainPositions[j + 1] = 0;
      terrainPositions[j + 2] = z;

      // Rainbow follows the width and slowly travels through the scene.
      const color = rainbowAt(u * 0.86 + v * 0.12);
      terrainColors[j] = color.r;
      terrainColors[j + 1] = color.g;
      terrainColors[j + 2] = color.b;

      terrainMeta[j] = u;
      terrainMeta[j + 1] = v;
      terrainMeta[j + 2] = Math.random() * Math.PI * 2;
    }
  }

  const terrainGeo = new THREE.BufferGeometry();
  terrainGeo.setAttribute('position', new THREE.BufferAttribute(terrainPositions, 3));
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(terrainColors, 3));

  const terrainMat = new THREE.PointsMaterial({
    size: innerWidth < 700 ? 0.065 : 0.082,
    vertexColors: true,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });

  const terrain = new THREE.Points(terrainGeo, terrainMat);
  world.add(terrain);

  // A second, dimmer point layer makes the waves feel volumetric rather
  // than like a flat grid.
  const underGeo = new THREE.BufferGeometry();
  const underPos = new Float32Array(pointCount * 3);
  const underColor = new Float32Array(pointCount * 3);

  for (let i = 0; i < pointCount; i++) {
    const j = i * 3;
    underPos[j] = terrainPositions[j] * 1.05;
    underPos[j + 1] = -0.18;
    underPos[j + 2] = terrainPositions[j + 2];
    underColor[j] = terrainColors[j] * 0.55;
    underColor[j + 1] = terrainColors[j + 1] * 0.55;
    underColor[j + 2] = terrainColors[j + 2] * 0.55;
  }

  underGeo.setAttribute('position', new THREE.BufferAttribute(underPos, 3));
  underGeo.setAttribute('color', new THREE.BufferAttribute(underColor, 3));
  const underTerrain = new THREE.Points(underGeo, new THREE.PointsMaterial({
    size: 0.13,
    vertexColors: true,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  world.add(underTerrain);

  // ------------------------------------------------------------
  // Glowing domes/blobs. Their vertical position is recalculated from
  // the same wave function, so they actually ride the moving landscape.
  // ------------------------------------------------------------
  function makeDomeGeometry() {
    const segments = 20;
    const rings = 10;
    const vertices = [];
    const indices = [];

    for (let y = 0; y <= rings; y++) {
      const phi = (Math.PI * 0.5) * (y / rings);
      const rr = Math.sin(phi);
      const yy = Math.cos(phi);
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

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  const domeGeo = makeDomeGeometry();
  const domePalette = [0xff075d, 0xff6500, 0xffdf00, 0x23ff42, 0x00dcff, 0x3c4dff, 0xb82cff];
  const domes = [];
  const domeCount = innerWidth < 700 ? 25 : 48;

  for (let i = 0; i < domeCount; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: domePalette[i % domePalette.length],
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const mesh = new THREE.Mesh(domeGeo, material);
    const u = 0.04 + Math.random() * 0.92;
    const v = Math.random() * 0.92;
    const x = (u - 0.5) * terrainWidth;
    const z = -5 - v * terrainDepth;
    const size = 0.24 + Math.random() * 0.9;

    mesh.scale.set(size * (0.7 + Math.random() * 0.5), size * (0.6 + Math.random() * 0.7), size);
    mesh.position.set(x, 0, z);
    world.add(mesh);

    domes.push({
      mesh,
      u,
      v,
      x,
      z,
      phase: Math.random() * Math.PI * 2,
      speed: 0.45 + Math.random() * 0.9,
      lift: 0.08 + Math.random() * 0.28
    });
  }

  // ------------------------------------------------------------
  // Soft colored halos under the domes.
  // ------------------------------------------------------------
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const glowContext = glowCanvas.getContext('2d');
  const glowGradient = glowContext.createRadialGradient(64, 64, 0, 64, 64, 64);
  glowGradient.addColorStop(0, 'rgba(255,255,255,0.75)');
  glowGradient.addColorStop(0.12, 'rgba(255,255,255,0.25)');
  glowGradient.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  glowGradient.addColorStop(1, 'rgba(0,0,0,0)');
  glowContext.fillStyle = glowGradient;
  glowContext.fillRect(0, 0, 128, 128);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);

  domes.forEach((d, index) => {
    if (index % 2) return;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture,
      color: d.mesh.material.color,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    sprite.scale.set(2.2, 1.25, 1);
    world.add(sprite);
    d.glow = sprite;
  });

  // ------------------------------------------------------------
  // Long colored contour streams following the terrain.
  // ------------------------------------------------------------
  const contours = [];
  const contourCount = innerWidth < 700 ? 11 : 19;
  const contourPoints = 125;

  for (let i = 0; i < contourCount; i++) {
    const data = new Float32Array(contourPoints * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data, 3));

    const material = new THREE.LineBasicMaterial({
      color: domePalette[i % domePalette.length],
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const line = new THREE.Line(geometry, material);
    world.add(line);

    contours.push({
      line,
      data,
      lane: (i - (contourCount - 1) / 2) * 0.65,
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 0.8,
      amplitude: 0.4 + Math.random() * 0.65
    });
  }

  // ------------------------------------------------------------
  // Bright horizon rays. These constantly pulse toward the vanishing point.
  // ------------------------------------------------------------
  const rays = [];
  const rayCount = innerWidth < 700 ? 7 : 13;
  const rayPoints = 40;

  for (let i = 0; i < rayCount; i++) {
    const data = new Float32Array(rayPoints * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data, 3));
    const material = new THREE.LineBasicMaterial({
      color: i % 3 === 0 ? 0xffffff : (i % 3 === 1 ? 0xffcc55 : 0xff6a25),
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const line = new THREE.Line(geometry, material);
    world.add(line);
    rays.push({ line, data, side: i - (rayCount - 1) / 2, phase: Math.random() * 6.28 });
  }

  // Large atmospheric glow at the horizon.
  const horizonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffb45a,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  horizonGlow.scale.set(18, 8, 1);
  horizonGlow.position.set(0, 1.4, -62);
  scene.add(horizonGlow);

  // ------------------------------------------------------------
  // Scroll controls travel depth and energy.
  // ------------------------------------------------------------
  let scrollTarget = 0;
  let scrollProgress = 0;
  addEventListener('scroll', () => {
    scrollTarget = THREE.MathUtils.clamp(
      scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight),
      0,
      1
    );
  }, { passive: true });

  const clock = new THREE.Clock();

  function terrainHeight(x, z, time) {
    const depth = Math.max(0, -z);

    let height =
      Math.sin(x * 0.7 + time * 0.9 + depth * 0.055) * 0.58 +
      Math.sin(x * 0.31 - time * 0.55 + depth * 0.1) * 0.4 +
      Math.sin(depth * 0.22 + time * 0.78 + x * 0.14) * 0.28;

    // Moving mouse ripple travels over the terrain.
    const mouseX = pointer.x * 10;
    const mouseZ = -15 - pointer.y * 22;
    const dx = x - mouseX;
    const dz = z - mouseZ;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const ripple = Math.exp(-distance * 0.095) * Math.sin(distance * 1.35 - time * 4.1);
    height += ripple * (0.35 + pointer.speed * 1.2);

    // Cursor speed creates a temporary wave streak.
    height += Math.sin(x * 1.8 + time * 3.0 + pointer.vx * 5) * pointer.speed * 0.16;

    return height;
  }

  function animate() {
    requestAnimationFrame(animate);

    const t = clock.getElapsedTime();

    pointer.x += (pointer.tx - pointer.x) * 0.07;
    pointer.y += (pointer.ty - pointer.y) * 0.07;
    pointer.vx *= 0.88;
    pointer.vy *= 0.88;

    const speedTarget = Math.min(1, Math.hypot(pointer.vx, pointer.vy));
    pointer.speed += (speedTarget - pointer.speed) * 0.1;
    scrollProgress += (scrollTarget - scrollProgress) * 0.035;

    // ----------------------------------------------------------
    // Animate every terrain point. This is the main living motion.
    // ----------------------------------------------------------
    for (let r = 0; r < rows; r++) {
      const v = r / (rows - 1);
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const j = i * 3;
        const x = (v === v ? (c / (cols - 1) - 0.5) * terrainWidth : 0);
        const z = -4 - v * terrainDepth;
        const h = terrainHeight(x, z, t + scrollProgress * 4);

        terrainPositions[j] = x + Math.sin(t * 0.22 + z * 0.04) * 0.07;
        terrainPositions[j + 1] = h;
        terrainPositions[j + 2] = z + Math.sin(t * 0.16 + x * 0.06) * 0.09;

        underPos[j] = terrainPositions[j];
        underPos[j + 1] = h - 0.2;
        underPos[j + 2] = terrainPositions[j + 2];
      }
    }

    terrainGeo.attributes.position.needsUpdate = true;
    underGeo.attributes.position.needsUpdate = true;

    // ----------------------------------------------------------
    // Domes ride the exact same animated wave.
    // ----------------------------------------------------------
    domes.forEach((d) => {
      const y = terrainHeight(d.x, d.z, t + scrollProgress * 4);
      const pulse = 1 + Math.sin(t * d.speed + d.phase) * d.lift;
      d.mesh.position.y = y + 0.05;
      d.mesh.position.x = d.x + Math.sin(t * 0.3 + d.phase) * 0.14;
      d.mesh.rotation.y += 0.004 + pointer.speed * 0.012;
      d.mesh.scale.y = Math.max(0.15, d.mesh.scale.y / pulse * pulse);

      if (d.glow) {
        d.glow.position.set(d.mesh.position.x, y - 0.02, d.z + 0.02);
        d.glow.scale.setScalar(1.7 + pulse * 0.55 + pointer.speed * 0.9);
        d.glow.material.opacity = 0.22 + pulse * 0.08 + pointer.speed * 0.16;
      }
    });

    // ----------------------------------------------------------
    // Flowing colored lines follow the wave surface.
    // ----------------------------------------------------------
    contours.forEach((contour, contourIndex) => {
      for (let i = 0; i < contourPoints; i++) {
        const u = i / (contourPoints - 1);
        const z = -5 - u * terrainDepth;
        const lane = contour.lane + Math.sin(u * 7 + t * contour.speed + contour.phase) * contour.amplitude;
        const x = lane + Math.sin(u * 12 + contour.phase + t * contour.speed) * 0.65;
        const h = terrainHeight(x, z, t);

        const j = i * 3;
        contour.data[j] = x;
        contour.data[j + 1] = h + 0.055 + Math.sin(u * 18 + t * 2 + contourIndex) * 0.025;
        contour.data[j + 2] = z;
      }
      contour.line.geometry.attributes.position.needsUpdate = true;
      contour.line.material.opacity = 0.22 + pointer.speed * 0.2 + Math.sin(t * 1.5 + contourIndex) * 0.035;
    });

    // ----------------------------------------------------------
    // Horizon beams stretch and breathe with the cursor speed.
    // ----------------------------------------------------------
    rays.forEach((ray, index) => {
      for (let i = 0; i < rayPoints; i++) {
        const u = i / (rayPoints - 1);
        const z = -8 - u * 78;
        const spread = (1 - u) * 15;
        const x = ray.side * spread * 0.55 + Math.sin(t * 0.9 + ray.phase + u * 8) * (0.12 + pointer.speed * 0.5);
        const h = 0.9 + (1 - u) * 2.2 + Math.sin(t * 1.2 + u * 9 + ray.phase) * 0.12;
        const j = i * 3;
        ray.data[j] = x;
        ray.data[j + 1] = h;
        ray.data[j + 2] = z;
      }
      ray.line.geometry.attributes.position.needsUpdate = true;
      ray.line.material.opacity = 0.18 + pointer.speed * 0.3 + Math.sin(t * 2 + index) * 0.04;
    });

    // ----------------------------------------------------------
    // 360-degree cursor orbit.
    // Horizontal pointer range [-1, 1] => [-PI, +PI].
    // That is a complete 360-degree sweep across the screen.
    // ----------------------------------------------------------
    const autoOrbit = t * 0.025;
    const yawTarget = pointer.x * Math.PI + autoOrbit;
    const pitchTarget = 0.12 + pointer.y * 0.82;
    const radius = 11.5 - scrollProgress * 2.2;
    const target = new THREE.Vector3(0, 0.7, -28 - scrollProgress * 20);

    const desiredX = target.x + Math.sin(yawTarget) * Math.cos(pitchTarget) * radius;
    const desiredY = target.y + Math.sin(pitchTarget) * radius;
    const desiredZ = target.z + Math.cos(yawTarget) * Math.cos(pitchTarget) * radius;

    camera.position.x += (desiredX - camera.position.x) * 0.055;
    camera.position.y += (desiredY - camera.position.y) * 0.055;
    camera.position.z += (desiredZ - camera.position.z) * 0.055;

    const lookX = pointer.x * 2.4;
    const lookY = 0.8 + pointer.y * 1.7;
    const lookZ = -34 - scrollProgress * 13;
    camera.lookAt(lookX, lookY, lookZ);

    // World sway makes the cursor movement feel like the entire environment
    // is rotating, not merely a camera sliding left and right.
    world.rotation.y += (pointer.x * 0.12 - world.rotation.y) * 0.025;
    world.rotation.x += (pointer.y * -0.055 - world.rotation.x) * 0.025;
    world.position.x += (pointer.x * 0.22 - world.position.x) * 0.035;
    world.position.y += (pointer.y * 0.1 - world.position.y) * 0.035;

    stars.rotation.y += (pointer.x * 0.012 - stars.rotation.y) * 0.015;
    stars.rotation.x += (pointer.y * -0.008 - stars.rotation.x) * 0.015;
    stars.position.x = pointer.x * 0.7;
    stars.position.y = pointer.y * 0.4;

    horizonGlow.material.opacity = 0.27 + pointer.speed * 0.4 + Math.sin(t * 1.5) * 0.04;
    horizonGlow.scale.set(
      17 + pointer.speed * 8,
      7 + pointer.speed * 4,
      1
    );

    terrainMat.size = (innerWidth < 700 ? 0.065 : 0.082) + pointer.speed * 0.028;
    terrainMat.opacity = 0.76 + pointer.speed * 0.18;

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
