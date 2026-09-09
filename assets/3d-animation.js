import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/+esm';
import { ScrollTrigger } from 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/ScrollTrigger.js';

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const style = document.createElement('style');
style.textContent = `
  #three-stage{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;opacity:0;transition:opacity 1.2s ease}
  #three-stage.is-ready{opacity:1}
  #three-stage canvas{display:block;width:100%;height:100%}
  #three-stage .three-vignette{position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,transparent 20%,rgba(2,5,12,.22) 55%,rgba(2,5,12,.82) 100%)}
  #three-stage .three-scan{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 0%,rgba(255,255,255,.025) 50%,transparent 51%);background-size:100% 8px;mix-blend-mode:screen;opacity:.2}
  @media(max-width:700px){#three-stage{opacity:.72}.three-vignette{opacity:.85}}
  @media(prefers-reduced-motion:reduce){#three-stage{display:none}}
`;
document.head.appendChild(style);

if (reduceMotion) {
  // Keep the page static for accessibility and performance.
} else {
  const stage = document.createElement('div');
  stage.id = 'three-stage';
  stage.innerHTML = '<div class="three-vignette"></div><div class="three-scan"></div>';
  document.body.prepend(stage);

  // The old blueprint particle animation is intentionally disabled so the new
  // 3D scene becomes the visual system instead of competing with it.
  const blueprint = document.getElementById('blueprint-canvas');
  if (blueprint) blueprint.style.display = 'none';

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050812, 0.035);

  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0.25, 10.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  stage.prepend(renderer.domElement);

  const world = new THREE.Group();
  scene.add(world);

  scene.add(new THREE.AmbientLight(0x6d7cff, 1.0));
  const key = new THREE.PointLight(0x76e8ff, 85, 28, 2);
  key.position.set(4, 4, 6);
  scene.add(key);
  const rim = new THREE.PointLight(0xb66cff, 100, 24, 2);
  rim.position.set(-5, -2, 2);
  scene.add(rim);
  const top = new THREE.PointLight(0xffffff, 35, 18, 2);
  top.position.set(0, 6, 1);
  scene.add(top);

  const core = new THREE.Group();
  world.add(core);

  const coreGeo = new THREE.IcosahedronGeometry(1.48, 5);
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0x6ee7ff,
    metalness: 0.72,
    roughness: 0.16,
    transmission: 0.12,
    transparent: true,
    opacity: 0.96,
    emissive: 0x172a75,
    emissiveIntensity: 1.7
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  core.add(coreMesh);

  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(coreGeo, 12),
    new THREE.LineBasicMaterial({ color: 0xbff8ff, transparent: true, opacity: 0.52 })
  );
  core.add(wire);

  // Three independent orbital bands create a mechanical/astronomical silhouette.
  const orbitGroup = new THREE.Group();
  world.add(orbitGroup);
  [2.05, 2.45, 2.9].forEach((radius, i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, i === 1 ? 0.018 : 0.012, 10, 180),
      new THREE.MeshBasicMaterial({ color: i === 1 ? 0xb978ff : 0x66e7ff, transparent: true, opacity: i === 1 ? 0.62 : 0.42 })
    );
    ring.rotation.set(i * 0.45, i === 1 ? 0.8 : 0.25, i * 0.22);
    orbitGroup.add(ring);
  });

  // Hundreds of micro-particles give the object depth without becoming a generic starfield.
  const particleCount = innerWidth < 700 ? 320 : 850;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const r = 4.5 + Math.random() * 8;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    particlePositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    particlePositions[i * 3 + 1] = r * Math.cos(phi) * 0.7;
    particlePositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particleMat = new THREE.PointsMaterial({ color: 0x9bdcff, size: 0.025, transparent: true, opacity: 0.7, depthWrite: false });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // Hero shards: these are deliberately asymmetrical so the split feels like an
  // engineered object breaking apart rather than a standard spinning sphere.
  const shards = [];
  const shardGroup = new THREE.Group();
  world.add(shardGroup);
  const shardColors = [0x5ee7ff, 0x9b7bff, 0xd2f9ff, 0x5b8cff];
  const shardCount = 44;

  for (let i = 0; i < shardCount; i++) {
    const size = 0.075 + Math.random() * 0.17;
    const geo = new THREE.TetrahedronGeometry(size, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: shardColors[i % shardColors.length],
      metalness: 0.7,
      roughness: 0.2,
      emissive: shardColors[i % shardColors.length],
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.9
    });
    const mesh = new THREE.Mesh(geo, mat);
    const a = (i / shardCount) * Math.PI * 2 + Math.random() * 0.35;
    const radius = 1.75 + Math.random() * 1.5;
    const base = new THREE.Vector3(
      Math.cos(a) * radius,
      (Math.random() - 0.5) * 3.3,
      Math.sin(a) * radius * 0.75
    );
    mesh.position.copy(base).multiplyScalar(0.35);
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    shardGroup.add(mesh);
    shards.push({
      mesh,
      base,
      phase: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.018
    });
  }

  // Thin energy traces around the core.
  const traceGroup = new THREE.Group();
  world.add(traceGroup);
  for (let i = 0; i < 8; i++) {
    const pts = [];
    const y = (Math.random() - 0.5) * 3.2;
    for (let j = 0; j < 60; j++) {
      const t = j / 59;
      const angle = t * Math.PI * 2 + i * 0.7;
      const radius = 1.7 + Math.sin(t * Math.PI * 6 + i) * 0.07;
      pts.push(new THREE.Vector3(Math.cos(angle) * radius, y + Math.sin(angle * 3) * 0.12, Math.sin(angle) * radius));
    }
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: i % 2 ? 0x9d7cff : 0x62efff, transparent: true, opacity: 0.16 })
    );
    traceGroup.add(line);
  }

  const state = { split: 0, reveal: 0, mouseX: 0, mouseY: 0 };
  let targetX = 0, targetY = 0;
  addEventListener('pointermove', e => {
    targetX = (e.clientX / innerWidth - 0.5) * 2;
    targetY = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });

  // Cinematic entrance: the object materializes from a tight compressed state.
  gsap.fromTo(world.scale, { x: 0.18, y: 0.18, z: 0.18 }, { x: 1, y: 1, z: 1, duration: 2.2, ease: 'expo.out', delay: 0.15 });
  gsap.fromTo(core.rotation, { x: -1.5, y: -2.5 }, { x: 0.1, y: 0.4, duration: 2.5, ease: 'power4.out', delay: 0.15 });
  gsap.to(stage, { opacity: 1, duration: 1.2, delay: 0.1 });

  const hero = document.getElementById('home');
  const projects = document.getElementById('projects');
  const experience = document.getElementById('experience');
  const skills = document.getElementById('skills');

  // The signature effect: scrolling toward projects causes the core to split,
  // orbiting fragments away from the center. Scrolling back reverses it naturally.
  if (hero && projects) {
    ScrollTrigger.create({
      trigger: projects,
      start: 'top 82%',
      end: 'bottom 18%',
      scrub: 1.15,
      onUpdate: self => { state.split = self.progress; }
    });
  }

  if (experience) {
    ScrollTrigger.create({
      trigger: experience,
      start: 'top bottom',
      end: 'bottom top',
      scrub: 1,
      onUpdate: self => { state.reveal = self.progress; }
    });
  }

  // Keep the 3D layer tied to the page without hijacking scrolling.
  gsap.to(camera.position, {
    z: 8.4,
    scrollTrigger: { trigger: skills || projects, start: 'top bottom', end: 'bottom top', scrub: 1.4 }
  });

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    state.mouseX += (targetX - state.mouseX) * 0.035;
    state.mouseY += (targetY - state.mouseY) * 0.035;

    world.rotation.y += 0.0019;
    core.rotation.x += 0.0024;
    core.rotation.y += 0.0032;
    orbitGroup.rotation.z -= 0.0022;
    orbitGroup.rotation.y += 0.0014;
    particles.rotation.y -= 0.00035;

    world.rotation.y += state.mouseX * 0.0007;
    world.rotation.x += state.mouseY * 0.00025;

    const split = state.split;
    core.scale.setScalar(1 + Math.sin(t * 1.8) * 0.025 - split * 0.32);
    wire.material.opacity = 0.52 - split * 0.25;
    coreMat.emissiveIntensity = 1.7 + split * 2.2;
    orbitGroup.scale.setScalar(1 + split * 0.22);
    traceGroup.rotation.y = t * 0.08 + split * 1.2;

    shards.forEach((item, i) => {
      const p = item.base.clone();
      const pulse = Math.sin(t * 1.7 + item.phase) * 0.06;
      p.multiplyScalar(0.35 + split * 0.95 + pulse);
      p.y += Math.sin(t * 0.9 + item.phase) * 0.06;
      item.mesh.position.lerp(p, 0.075);
      item.mesh.rotation.x += item.spin + split * 0.002;
      item.mesh.rotation.y += item.spin * 1.6 + split * 0.003;
      item.mesh.rotation.z += item.spin * 0.8;
      item.mesh.material.emissiveIntensity = 0.55 + split * 1.25;
    });

    camera.position.x += (state.mouseX * 0.42 - camera.position.x) * 0.025;
    camera.position.y += (-state.mouseY * 0.25 + 0.25 - camera.position.y) * 0.025;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animate();

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    renderer.setSize(innerWidth, innerHeight);
  });
}
