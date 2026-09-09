import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/+esm';
import { ScrollTrigger } from 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/ScrollTrigger.js';
import { SplitText } from 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/SplitText.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const style = document.createElement('style');
style.textContent = `
  #three-stage {
    position: fixed;
    inset: 0;
    z-index: -8;
    pointer-events: none;
    overflow: hidden;
    perspective: 1200px;
  }
  #three-canvas { width: 100%; height: 100%; display: block; }
  .three-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 42%, transparent 0 25%, rgba(3,5,10,.12) 55%, rgba(3,5,10,.72) 100%);
    pointer-events: none;
  }
  .three-noise {
    position: absolute;
    inset: 0;
    opacity: .035;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.7'/%3E%3C/svg%3E");
    pointer-events: none;
  }
  .three-shard { transform-style: preserve-3d; }
  @media (max-width: 760px) {
    #three-stage { opacity: .72; }
  }
`;
document.head.appendChild(style);

const stage = document.createElement('div');
stage.id = 'three-stage';
stage.innerHTML = '<canvas id="three-canvas"></canvas><div class="three-vignette"></div><div class="three-noise"></div>';
document.body.prepend(stage);

const canvas = document.getElementById('three-canvas');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x06070a, 0.055);

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0.25, 9.5);

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

scene.add(new THREE.AmbientLight(0x7dd3fc, 1.25));
const key = new THREE.PointLight(0x8b5cf6, 55, 18);
key.position.set(4, 4, 5);
scene.add(key);
const rim = new THREE.PointLight(0x00f2fe, 45, 15);
rim.position.set(-5, -2, 4);
scene.add(rim);

const world = new THREE.Group();
scene.add(world);

const core = new THREE.Group();
world.add(core);

const coreGeo = new THREE.IcosahedronGeometry(1.55, 2);
const coreMat = new THREE.MeshPhysicalMaterial({
  color: 0x111827,
  metalness: 0.65,
  roughness: 0.18,
  transmission: 0.25,
  transparent: true,
  opacity: 0.55,
  clearcoat: 1,
  clearcoatRoughness: 0.08,
  emissive: 0x3b82f6,
  emissiveIntensity: 0.18
});
core.add(new THREE.Mesh(coreGeo, coreMat));

const wire = new THREE.LineSegments(
  new THREE.EdgesGeometry(coreGeo),
  new THREE.LineBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.38 })
);
core.add(wire);

const ringGroup = new THREE.Group();
core.add(ringGroup);
for (let i = 0; i < 3; i++) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.05 + i * 0.32, 0.012 + i * 0.006, 8, 128),
    new THREE.MeshBasicMaterial({ color: [0x00f2fe, 0x8b5cf6, 0xec4899][i], transparent: true, opacity: 0.62 - i * 0.12 })
  );
  ring.rotation.set(i * 0.55, i * 0.9, i * 0.35);
  ringGroup.add(ring);
}

const shards = [];
const shardGeometry = new THREE.TetrahedronGeometry(0.18, 0);
const shardColors = [0x00f2fe, 0x4facfe, 0x8b5cf6, 0xec4899, 0x67e8f9];
for (let i = 0; i < 34; i++) {
  const holder = new THREE.Group();
  holder.userData.base = new THREE.Vector3();
  const material = new THREE.MeshPhysicalMaterial({
    color: shardColors[i % shardColors.length],
    emissive: shardColors[i % shardColors.length],
    emissiveIntensity: 0.4,
    metalness: 0.75,
    roughness: 0.2,
    transparent: true,
    opacity: 0.72
  });
  const mesh = new THREE.Mesh(shardGeometry, material);
  mesh.scale.setScalar(0.55 + Math.random() * 1.5);
  holder.add(mesh);
  const angle = (i / 34) * Math.PI * 2 + Math.random() * 0.3;
  const radius = 2.8 + Math.random() * 2.3;
  holder.position.set(Math.cos(angle) * radius, (Math.random() - 0.5) * 4.6, Math.sin(angle) * radius * 0.52);
  holder.userData.base.copy(holder.position);
  holder.userData.angle = angle;
  holder.userData.radius = radius;
  holder.userData.speed = 0.25 + Math.random() * 0.75;
  holder.userData.spin = (Math.random() - 0.5) * 0.025;
  world.add(holder);
  shards.push(holder);
}

const particles = new THREE.BufferGeometry();
const count = 650;
const positions = new Float32Array(count * 3);
for (let i = 0; i < count; i++) {
  const r = 7 + Math.random() * 10;
  const a = Math.random() * Math.PI * 2;
  positions[i * 3] = Math.cos(a) * r;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
}
particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const particleField = new THREE.Points(particles, new THREE.PointsMaterial({ color: 0x8b5cf6, size: 0.018, transparent: true, opacity: 0.6 }));
world.add(particleField);

const mouse = { x: 0, y: 0 };
const target = { x: 0, y: 0 };
addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / innerWidth - 0.5) * 2;
  mouse.y = (e.clientY / innerHeight - 0.5) * 2;
});

let scrollProgress = 0;
if (!reduceMotion) {
  gsap.to(world.rotation, {
    y: Math.PI * 2,
    x: Math.PI * 0.22,
    ease: 'none',
    scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 1.4 }
  });
  gsap.to(core.scale, {
    x: 0.72, y: 0.72, z: 0.72,
    scrollTrigger: { trigger: '#projects', start: 'top 85%', end: 'bottom 15%', scrub: 1 }
  });
  gsap.to(shards.map(s => s.position), {
    x: '+=1',
    scrollTrigger: { trigger: '#experience', start: 'top 90%', end: 'bottom 20%', scrub: 1.1 }
  });

  document.querySelectorAll('.section-title').forEach((heading) => {
    try {
      const split = new SplitText(heading, { type: 'chars,words' });
      gsap.from(split.chars, {
        y: 70,
        z: -100,
        opacity: 0,
        rotationX: -75,
        transformOrigin: '50% 100% -50',
        stagger: 0.018,
        duration: 0.9,
        ease: 'back.out(1.7)',
        scrollTrigger: { trigger: heading, start: 'top 88%' }
      });
    } catch (_) {}
  });
}

const clock = new THREE.Clock();
function animate() {
  const elapsed = clock.getElapsedTime();
  target.x += (mouse.x * 0.16 - target.x) * 0.035;
  target.y += (mouse.y * 0.10 - target.y) * 0.035;

  world.rotation.y += reduceMotion ? 0.0005 : 0.0014;
  world.rotation.x += (target.y - world.rotation.x) * 0.008;
  world.rotation.z += (-target.x * 0.08 - world.rotation.z) * 0.008;

  core.rotation.x = elapsed * 0.12;
  core.rotation.y = elapsed * 0.18;
  ringGroup.rotation.x = elapsed * 0.14;
  ringGroup.rotation.y = -elapsed * 0.22;
  particleField.rotation.y = elapsed * 0.006;

  shards.forEach((shard, i) => {
    const d = shard.userData;
    const wobble = Math.sin(elapsed * d.speed + i) * 0.18;
    shard.position.x = d.base.x + Math.cos(elapsed * d.speed * 0.45 + d.angle) * wobble;
    shard.position.y = d.base.y + Math.sin(elapsed * d.speed * 0.65 + i) * 0.28;
    shard.position.z = d.base.z + Math.cos(elapsed * d.speed * 0.35 + i) * 0.22;
    shard.rotation.x += d.spin;
    shard.rotation.y += d.spin * 1.4;
  });

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight);
});

window.addEventListener('load', () => ScrollTrigger.refresh());
