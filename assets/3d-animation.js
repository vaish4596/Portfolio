import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';

const stage = document.getElementById('three-stage');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (stage && !reduced) {
  stage.style.pointerEvents = 'none';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010207);

  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 180);
  camera.position.set(0, 0, 5);

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  stage.appendChild(renderer.domElement);

  // The scene deliberately has no hero object. It is a living field of light:
  // thousands of points travel through a deep 3D volume while mouse movement
  // bends the field, creates a wake and changes the camera's flight direction.
  const group = new THREE.Group();
  scene.add(group);

  const pointer = {
    x: 0, y: 0,
    targetX: 0, targetY: 0,
    vx: 0, vy: 0,
    energy: 0
  };

  const clock = new THREE.Clock();
  const mouse = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();

  addEventListener('pointermove', (event) => {
    const nx = (event.clientX / innerWidth - 0.5) * 2;
    const ny = -(event.clientY / innerHeight - 0.5) * 2;
    pointer.vx += nx - pointer.targetX;
    pointer.vy += ny - pointer.targetY;
    pointer.targetX = nx;
    pointer.targetY = ny;
    mouse.set(nx, ny);
  }, { passive: true });

  // A large 3D particle volume. Particles are intentionally distributed in
  // layered depth so the viewer feels like they are moving inside the light.
  const count = innerWidth < 700 ? 4200 : 8500;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 4);

  for (let i = 0; i < count; i++) {
    const j = i * 3;
    const depth = Math.random() * 125;
    const spread = 7 + depth * 0.055;

    positions[j] = (Math.random() - 0.5) * spread;
    positions[j + 1] = (Math.random() - 0.5) * spread * 0.62;
    positions[j + 2] = -depth;

    const s = i * 4;
    seeds[s] = Math.random() * Math.PI * 2;
    seeds[s + 1] = 0.45 + Math.random() * 1.4;
    seeds[s + 2] = Math.random();
    seeds[s + 3] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const vertexShader = `
    uniform float uTime;
    uniform float uPixelRatio;
    uniform float uEnergy;
    attribute vec3 position;
    varying float vDepth;
    varying float vSpark;

    void main() {
      vec3 p = position;
      float depth = max(0.0, -p.z);
      float drift = uTime * (0.32 + depth * 0.0015);

      // Long organic waves make the volume feel like illuminated smoke/water.
      p.x += sin(p.z * 0.105 + uTime * 0.72 + p.y * 0.22) * 1.25;
      p.y += cos(p.z * 0.075 - uTime * 0.54 + p.x * 0.18) * 0.75;
      p.x += sin(p.y * 0.42 + drift) * 0.32;

      vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      float perspective = 18.0 / max(2.0, -mvPosition.z);
      gl_PointSize = (1.25 + uEnergy * 1.9) * perspective * uPixelRatio;
      vDepth = smoothstep(125.0, 0.0, depth);
      vSpark = 0.55 + 0.45 * sin(uTime * 2.0 + p.z * 0.12);
    }
  `;

  const fragmentShader = `
    varying float vDepth;
    varying float vSpark;

    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      if (d > 0.5) discard;

      float glow = pow(1.0 - d * 2.0, 3.0);
      vec3 cyan = vec3(0.28, 0.92, 1.0);
      vec3 violet = vec3(0.48, 0.32, 1.0);
      vec3 white = vec3(0.88, 1.0, 1.0);

      vec3 color = mix(violet, cyan, clamp(vDepth * 1.4, 0.0, 1.0));
      color = mix(color, white, glow * 0.55);
      float alpha = glow * (0.18 + vDepth * 0.8) * vSpark;

      gl_FragColor = vec4(color, alpha);
    }
  `;

  const particleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(devicePixelRatio, 1.7) },
      uEnergy: { value: 0 }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const particles = new THREE.Points(geometry, particleMaterial);
  group.add(particles);

  // Hundreds of thin luminous strands create the characteristic light-trail
  // feeling without becoming a collection of rigid ribbons or 3D objects.
  const strandCount = innerWidth < 700 ? 24 : 42;
  const strandPoints = 115;
  const strands = [];
  const colors = [0x7deaff, 0x5c7cff, 0xa978ff, 0xd3fbff, 0x38cfff];

  for (let s = 0; s < strandCount; s++) {
    const data = new Float32Array(strandPoints * 3);
    const strandGeometry = new THREE.BufferGeometry();
    strandGeometry.setAttribute('position', new THREE.BufferAttribute(data, 3));

    const material = new THREE.LineBasicMaterial({
      color: colors[s % colors.length],
      transparent: true,
      opacity: 0.08 + Math.random() * 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const line = new THREE.Line(strandGeometry, material);
    group.add(line);

    strands.push({
      data,
      line,
      offset: Math.random() * Math.PI * 2,
      width: 3 + Math.random() * 4,
      curve: 0.4 + Math.random() * 0.9,
      speed: 0.55 + Math.random() * 0.65
    });
  }

  // A soft volumetric haze gives bright trails a photographic bloom-like halo.
  const hazeCanvas = document.createElement('canvas');
  hazeCanvas.width = hazeCanvas.height = 128;
  const hazeCtx = hazeCanvas.getContext('2d');
  const haze = hazeCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
  haze.addColorStop(0, 'rgba(150,235,255,0.32)');
  haze.addColorStop(0.18, 'rgba(85,155,255,0.13)');
  haze.addColorStop(1, 'rgba(0,0,0,0)');
  hazeCtx.fillStyle = haze;
  hazeCtx.fillRect(0, 0, 128, 128);

  const hazeTexture = new THREE.CanvasTexture(hazeCanvas);
  const hazeMaterial = new THREE.SpriteMaterial({
    map: hazeTexture,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const hazeSprite = new THREE.Sprite(hazeMaterial);
  hazeSprite.scale.set(15, 15, 1);
  hazeSprite.position.z = -8;
  scene.add(hazeSprite);

  // Scroll changes the flight through the light volume rather than moving a
  // static background. Different sections therefore reveal different motion.
  let scrollTarget = 0;
  let scrollProgress = 0;
  addEventListener('scroll', () => {
    scrollTarget = Math.min(1, Math.max(0,
      scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)
    ));
  }, { passive: true });

  function animate() {
    requestAnimationFrame(animate);

    const t = clock.getElapsedTime();
    pointer.x += (pointer.targetX - pointer.x) * 0.055;
    pointer.y += (pointer.targetY - pointer.y) * 0.055;
    pointer.vx *= 0.86;
    pointer.vy *= 0.86;
    pointer.energy += (Math.min(1, Math.hypot(pointer.vx, pointer.vy) * 1.8) - pointer.energy) * 0.08;
    scrollProgress += (scrollTarget - scrollProgress) * 0.045;

    particleMaterial.uniforms.uTime.value = t;
    particleMaterial.uniforms.uEnergy.value = pointer.energy;

    // Camera flight: subtle forward motion plus strong but smooth mouse steering.
    camera.position.x += ((pointer.x * 2.15) - camera.position.x) * 0.035;
    camera.position.y += ((pointer.y * 1.2) - camera.position.y) * 0.035;
    camera.position.z += ((5 - scrollProgress * 11) - camera.position.z) * 0.028;
    camera.rotation.x += ((pointer.y * -0.035) - camera.rotation.x) * 0.03;
    camera.rotation.y += ((pointer.x * 0.055) - camera.rotation.y) * 0.03;
    camera.rotation.z += ((pointer.x * -0.025) - camera.rotation.z) * 0.025;

    // Convert the cursor into a real point in front of the camera. Strands bend
    // toward it, then overshoot slightly to create a wake rather than a cursor halo.
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(interactionPlane, hit);

    const targetX = hit.x * 0.72;
    const targetY = hit.y * 0.52;
    const wake = 0.8 + pointer.energy * 2.8;

    strands.forEach((strand, strandIndex) => {
      const phase = t * strand.speed + strand.offset;

      for (let i = 0; i < strandPoints; i++) {
        const u = i / (strandPoints - 1);
        const depth = -2 - u * 105;
        const centerX = Math.sin(phase * 0.45 + u * 5.4 + strandIndex) * strand.curve;
        const centerY = Math.cos(phase * 0.36 + u * 4.8 + strandIndex * 0.7) * strand.curve * 0.52;
        const fan = (u - 0.5) * strand.width;

        // Cursor attraction gets stronger close to the viewer, producing the
        // same "the light follows me" sensation as the reference experience.
        const near = Math.pow(1 - u, 1.8);
        const pull = near * (0.35 + pointer.energy * 0.9);
        const swirl = Math.sin(u * 14 - phase * 1.6 + strand.offset) * pull * wake;

        strand.data[i * 3] = centerX + fan + targetX * pull + pointer.x * u * 0.9 + swirl;
        strand.data[i * 3 + 1] = centerY + targetY * pull + pointer.y * u * 0.5 + Math.cos(u * 10 + phase) * 0.18;
        strand.data[i * 3 + 2] = depth;
      }

      strand.line.geometry.attributes.position.needsUpdate = true;
      strand.line.material.opacity = 0.055 + pointer.energy * 0.13;
    });

    // The complete particle cloud follows the cursor with a delayed current.
    group.rotation.y += ((pointer.x * 0.07) - group.rotation.y) * 0.025;
    group.rotation.x += ((pointer.y * -0.045) - group.rotation.x) * 0.025;
    group.position.x += (pointer.x * 0.28 - group.position.x) * 0.03;
    group.position.y += (pointer.y * 0.18 - group.position.y) * 0.03;

    hazeSprite.position.x += (pointer.x * 1.8 - hazeSprite.position.x) * 0.045;
    hazeSprite.position.y += (pointer.y * 1.2 - hazeSprite.position.y) * 0.045;
    hazeSprite.material.opacity = 0.2 + pointer.energy * 0.35;
    hazeSprite.scale.setScalar(12 + pointer.energy * 8 + scrollProgress * 3);

    renderer.render(scene, camera);
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    renderer.setSize(innerWidth, innerHeight);
    particleMaterial.uniforms.uPixelRatio.value = Math.min(devicePixelRatio, 1.7);
  });

  animate();
}
