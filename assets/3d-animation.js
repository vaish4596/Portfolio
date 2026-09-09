import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/+esm';
import { ScrollTrigger } from 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/ScrollTrigger.js';

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage = document.getElementById('three-stage');
if (!stage || reduceMotion) {
  if (stage) stage.style.display = 'none';
} else {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x02040a, 0.045);
  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 80);
  camera.position.set(0, 0.2, 10.5);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  stage.appendChild(renderer.domElement);

  const world = new THREE.Group();
  scene.add(world);
  scene.add(new THREE.AmbientLight(0x7187ff, 0.45));
  const cyanLight = new THREE.PointLight(0x5fe8ff, 80, 25, 2); cyanLight.position.set(4, 3, 5); scene.add(cyanLight);
  const violetLight = new THREE.PointLight(0x9b72ff, 95, 24, 2); violetLight.position.set(-5, -2, 3); scene.add(violetLight);
  const pinkLight = new THREE.PointLight(0xff5fba, 45, 18, 2); pinkLight.position.set(1, -4, -2); scene.add(pinkLight);

  // Architectural glass frames create depth like a small virtual showroom.
  const frameGroup = new THREE.Group(); world.add(frameGroup);
  for (let i = 0; i < 3; i++) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(5.2 + i * 1.8, 3.4 + i * 1.2, 0.12), new THREE.MeshBasicMaterial({ color: 0x73dfff, transparent: true, opacity: 0.09 - i * 0.018, wireframe: true }));
    frame.position.z = -1.8 - i * 0.8; frame.rotation.z = (i - 1) * 0.08; frameGroup.add(frame);
  }

  // Flow field: curved additive neon ribbons inspired by fluid WebGL experiments.
  const ribbons = [], colors = [0x55eaff,0x8e7bff,0xd56dff,0x6fffd5,0x5d9cff];
  const ribbonCount = innerWidth < 650 ? 7 : 11, pointCount = 90;
  for (let n=0;n<ribbonCount;n++) {
    const positions = new Float32Array(pointCount*3), geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const line = new THREE.Line(geometry,new THREE.LineBasicMaterial({color:colors[n%colors.length],transparent:true,opacity:.2+Math.random()*.18,blending:THREE.AdditiveBlending,depthWrite:false}));
    line.position.y=(n-(ribbonCount-1)/2)*.42; line.position.z=-.4+Math.random()*.8; world.add(line);
    ribbons.push({line,positions,phase:Math.random()*10,speed:.3+Math.random()*.35,amp:.55+Math.random()*.65,twist:.45+Math.random()*.45});
  }

  const dots=[]; const dotGeo=new THREE.SphereGeometry(.045,8,8);
  for(let i=0;i<34;i++){const dot=new THREE.Mesh(dotGeo,new THREE.MeshBasicMaterial({color:colors[i%colors.length],transparent:true,opacity:.9}));world.add(dot);dots.push({dot,ribbon:i%ribbonCount,t:Math.random(),offset:Math.random()*4});}

  // Small illuminated pedestal/orb: a subtle showroom object rather than a giant centerpiece.
  const pedestal=new THREE.Group(); pedestal.position.set(0,-2.25,-.4); world.add(pedestal);
  pedestal.add(new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.45,.12,64),new THREE.MeshPhysicalMaterial({color:0x0c1525,metalness:.7,roughness:.16,transparent:true,opacity:.62})));
  const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(.62,4),new THREE.MeshPhysicalMaterial({color:0x74eaff,metalness:.4,roughness:.08,transmission:.2,transparent:true,opacity:.75,emissive:0x173a70,emissiveIntensity:2})); orb.position.y=.42; pedestal.add(orb);

  const particleCount=innerWidth<650?260:650, particlePositions=new Float32Array(particleCount*3);
  for(let i=0;i<particleCount;i++){particlePositions[i*3]=(Math.random()-.5)*18;particlePositions[i*3+1]=(Math.random()-.5)*11;particlePositions[i*3+2]=-1-Math.random()*11;}
  const particleGeo=new THREE.BufferGeometry(); particleGeo.setAttribute('position',new THREE.BufferAttribute(particlePositions,3));
  scene.add(new THREE.Points(particleGeo,new THREE.PointsMaterial({color:0x9bcfff,size:.018,transparent:true,opacity:.48,depthWrite:false})));

  const mouse={x:0,y:0,tx:0,ty:0};
  addEventListener('pointermove',e=>{mouse.tx=(e.clientX/innerWidth-.5)*2;mouse.ty=(e.clientY/innerHeight-.5)*2},{passive:true});
  world.scale.setScalar(.78); world.rotation.y=-.32;
  gsap.to(world.scale,{x:1,y:1,z:1,duration:2.4,ease:'expo.out'});
  gsap.to(world.rotation,{y:0,duration:2.8,ease:'power4.out'});

  const scrollState={progress:0};
  gsap.to(scrollState,{progress:1,ease:'none',scrollTrigger:{trigger:document.body,start:'top top',end:'bottom bottom',scrub:1}});
  const clock=new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate); const t=clock.getElapsedTime();
    mouse.x+=(mouse.tx-mouse.x)*.025; mouse.y+=(mouse.ty-mouse.y)*.025;
    ribbons.forEach((r,ri)=>{const pos=r.positions;for(let i=0;i<pointCount;i++){const u=i/(pointCount-1),x=(u-.5)*13,w=t*r.speed+r.phase;pos[i*3]=x;pos[i*3+1]=Math.sin(u*Math.PI*2.5+w)*r.amp+Math.sin(u*Math.PI*5-w*.6)*.18;pos[i*3+2]=Math.cos(u*Math.PI*2+w*r.twist)*.75+Math.sin(u*8+ri)*.08;}r.line.geometry.attributes.position.needsUpdate=true;r.line.rotation.z=Math.sin(t*.18+ri)*.025;r.line.rotation.y=mouse.x*.035;});
    dots.forEach((d,i)=>{d.t=(d.t+.0018*(1+d.offset*.04))%1;const r=ribbons[d.ribbon],idx=Math.min(pointCount-1,Math.floor(d.t*(pointCount-1))),p=r.positions;d.dot.position.set(p[idx*3],p[idx*3+1]+r.line.position.y,p[idx*3+2]+r.line.position.z);d.dot.scale.setScalar(.65+Math.sin(t*4+i)*.2);});
    orb.rotation.x+=.002;orb.rotation.y+=.004;orb.position.y=.42+Math.sin(t*1.4)*.08;pedestal.rotation.y+=.0009;frameGroup.rotation.y=mouse.x*.045+Math.sin(t*.16)*.025;frameGroup.rotation.x=mouse.y*.025;
    const p=scrollState.progress;camera.position.x+=(mouse.x*.5-camera.position.x)*.018;camera.position.y+=(-mouse.y*.28+.2-camera.position.y)*.018;camera.position.z+=((10.5-p*2)-camera.position.z)*.018;world.position.y+=((p*-.55)-world.position.y)*.015;world.rotation.x+=((p*.16)-world.rotation.x)*.01;
    renderer.render(scene,camera);
  }
  animate();
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);});
}
