import * as THREE from 'three';
import './style-fixed.css';

const app = document.getElementById('app');
app.innerHTML = `
  <div id="hud">
    <div class="panel brand">AHMAD<span>X</span> • TACTICAL COURTYARD</div>
    <div class="panel score">SCORE <b id="score">0</b> • WAVE <b id="wave">1</b></div>
    <div class="panel help">WASD move • Mouse look • Click fire • 1–6 weapons • R reload • H heal</div>
    <div id="msg"></div>
    <div class="panel health">HEALTH <b id="hp">100</b><div class="bar"><div id="hpFill"></div></div><div class="heal">Healing drink: <b id="heals">3</b> • H</div></div>
    <div class="panel weapon"><div class="eyebrow">CURRENT WEAPON</div><div id="weaponName">Glock 17</div><div id="ammo">17 <small>/ 85</small></div></div>
    <div id="slots"></div><div id="cross"></div><div id="damage"></div>
  </div>
  <div id="menu" class="menu"><div class="card"><div class="logo">AHMAD<span>X</span></div>
    <div class="sub">Hosted WebGL tactical FPS. Press Start. If your browser allows it, the mouse will lock for FPS aiming. If not, the game still starts and you can click the arena to try again.</div>
    <div class="grid"><div class="key"><b>W A S D</b> — move</div><div class="key"><b>Mouse</b> — look / aim</div><div class="key"><b>Left click</b> — fire</div><div class="key"><b>1–6</b> — knife to bazooka</div><div class="key"><b>R</b> — reload</div><div class="key"><b>H</b> — healing drink</div></div>
    <button id="startBtn">START AHMADX</button>
  </div></div>`;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x91a8bd);
scene.fog = new THREE.Fog(0x91a8bd, 30, 100);

const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.05, 180);
camera.position.set(0, 1.7, 18);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
app.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xd6eaff, 0x59463a, 2.4));
const sun = new THREE.DirectionalLight(0xffe1bd, 3.8);
sun.position.set(-16, 28, 14); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); scene.add(sun);

const mat = (color, rough=.75, metal=0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
const makeBox = (x,y,z,w,h,d,color,rough=.78) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(color, rough));
  m.position.set(x, y + h/2, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
};

const floor = new THREE.Mesh(new THREE.PlaneGeometry(72,72), mat(0xa68f77,.92));
floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; scene.add(floor);
const grid = new THREE.GridHelper(72, 36, 0x6f5a46, 0x8f7964); grid.position.y=.01; scene.add(grid);
makeBox(0,0,-27,48,10,2,0x9f654a); makeBox(-25,0,-5,2,10,46,0xc9a583); makeBox(25,0,-5,2,10,46,0xc9a583);
makeBox(-13,0,-11,5,3,4,0x73543f); makeBox(12,0,-8,6,2.6,4,0x76563f); makeBox(-5,0,1,4,2.3,3,0x89674e); makeBox(8,0,5,5,2.8,3,0x89674e);
for(let i=0;i<8;i++) makeBox(-21+i*6,0,-24,1.1,8,1.1,0xd5ae88,.62);
makeBox(-5.7,0,-25,3.5,8,2.2,0xd9ad86); makeBox(5.7,0,-25,3.5,8,2.2,0xd9ad86); makeBox(0,6.1,-25,8,2,2.2,0xd9ad86);
for(const [px,pz,sx] of [[-10,-4,10],[2,-8,12],[12,-1,8]]){
  const p = new THREE.Mesh(new THREE.PlaneGeometry(sx,5), new THREE.MeshStandardMaterial({color:0xb7435e,side:THREE.DoubleSide,roughness:.8}));
  p.rotation.x = Math.PI/2 + .16; p.position.set(px,7.5,pz); p.castShadow = true; scene.add(p);
}

const weapons = [
 {name:'Combat Knife',mag:999,ammo:999,res:999,damage:70,rate:420,range:2.2,type:'melee'},
 {name:'Glock 17',mag:17,ammo:17,res:85,damage:34,rate:220,range:90,type:'gun'},
 {name:'MX-4 Rifle',mag:30,ammo:30,res:150,damage:25,rate:95,range:120,type:'gun'},
 {name:'Pump Shotgun',mag:8,ammo:8,res:40,damage:17,rate:650,range:40,type:'shotgun'},
 {name:'SR-1 Sniper',mag:5,ammo:5,res:25,damage:125,rate:1050,range:160,type:'gun'},
 {name:'BX-9 Bazooka',mag:1,ammo:1,res:6,damage:175,rate:1600,range:130,type:'rocket'}
];
let wi=1, score=0, wave=1, hp=100, heals=3, lastShot=0, reloading=false, started=false, locked=false;
let yaw=Math.PI, pitch=0, keys={}, enemies=[], rockets=[];

const slots = document.getElementById('slots');
weapons.forEach((w,i)=>{ const s=document.createElement('div'); s.id='slot'+i; s.className='slot'; s.textContent=(i+1)+' '+w.name; slots.appendChild(s); });
const el = id => document.getElementById(id);
function hud(){
  const w=weapons[wi]; el('weaponName').textContent=w.name; el('ammo').innerHTML=(w.type==='melee'?'∞':w.ammo)+` <small>/ ${w.type==='melee'?'∞':w.res}</small>`;
  el('score').textContent=score; el('wave').textContent=wave; el('hp').textContent=Math.ceil(hp); el('hpFill').style.width=Math.max(0,hp)+'%'; el('heals').textContent=heals;
  weapons.forEach((_,i)=>el('slot'+i).className='slot'+(i===wi?' active':''));
}
hud();
function say(t,ms=900){ const m=el('msg'); m.textContent=t; setTimeout(()=>{if(m.textContent===t)m.textContent='';},ms); }

const weaponGroup = new THREE.Group(); camera.add(weaponGroup); scene.add(camera);
function part(group, geometry, color, pos, rot=[0,0,0], metal=.25){
  if(!Array.isArray(rot)) rot=[0,0,0];
  const mesh=new THREE.Mesh(geometry, mat(color,.38,metal)); mesh.position.set(...pos); mesh.rotation.set(...rot); mesh.castShadow=true; group.add(mesh); return mesh;
}
function rebuildWeapon(){
  weaponGroup.clear(); const w=weapons[wi];
  if(w.type==='melee'){
    part(weaponGroup,new THREE.BoxGeometry(.09,.09,.65),0x5a3823,[.42,-.34,-.65],[.1,0,-.25]);
    part(weaponGroup,new THREE.ConeGeometry(.055,.75,4),0xc9d2da,[.42,-.1,-.95],[Math.PI/2,0,-.25],.7); return;
  }
  if(w.name==='Glock 17'){
    part(weaponGroup,new THREE.BoxGeometry(.30,.18,.80),0x15191d,[.38,-.28,-.72]);
    part(weaponGroup,new THREE.BoxGeometry(.18,.40,.24),0x202832,[.34,-.49,-.55],[.15,0,0]);
    part(weaponGroup,new THREE.BoxGeometry(.08,.07,.45),0x0b0d10,[.38,-.29,-1.18],[0,0,0],.8);
  } else if(w.name==='MX-4 Rifle'){
    part(weaponGroup,new THREE.BoxGeometry(.34,.22,1.45),0x151a20,[.34,-.28,-.95]);
    part(weaponGroup,new THREE.BoxGeometry(.18,.5,.25),0x1c242c,[.31,-.52,-.78],[.12,0,0]);
    part(weaponGroup,new THREE.BoxGeometry(.08,.08,.9),0x0a0c0f,[.34,-.28,-1.95],[0,0,0],.8);
  } else if(w.name==='Pump Shotgun'){
    part(weaponGroup,new THREE.BoxGeometry(.28,.2,1.4),0x14191e,[.34,-.3,-.95]);
    part(weaponGroup,new THREE.BoxGeometry(.34,.18,.42),0x664b39,[.34,-.3,-1.35]);
    part(weaponGroup,new THREE.BoxGeometry(.07,.07,1),0x0a0c0e,[.34,-.3,-2.0],[0,0,0],.8);
  } else if(w.name==='SR-1 Sniper'){
    part(weaponGroup,new THREE.BoxGeometry(.28,.18,1.6),0x12171d,[.34,-.3,-1.0]);
    part(weaponGroup,new THREE.CylinderGeometry(.08,.08,.65,16),0x0a0d11,[.34,-.17,-.9],[Math.PI/2,0,0],.8);
    part(weaponGroup,new THREE.BoxGeometry(.06,.06,1.2),0x0a0c0e,[.34,-.3,-2.35],[0,0,0],.8);
  } else {
    part(weaponGroup,new THREE.CylinderGeometry(.22,.22,1.7,24),0x2f3a43,[.34,-.28,-1.1],[Math.PI/2,0,0],.45);
    part(weaponGroup,new THREE.BoxGeometry(.16,.4,.18),0x1a232c,[.34,-.51,-.85],[.1,0,0]);
  }
}
rebuildWeapon();

function spawnEnemy(x,z){
  const g=new THREE.Group(), skin=mat(0xc79572,.9), cloth=mat(0x596f81,.72), dark=mat(0x1a222b,.6,.12);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.27,20,16),skin); head.position.y=1.7; g.add(head);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.33,.72,6,14),cloth); torso.position.y=1.08; g.add(torso);
  for(const sx of [-1,1]){ const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.12,.72,5,10),dark); leg.position.set(.18*sx,.3,0); g.add(leg); const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.09,.58,5,10),skin); arm.position.set(.39*sx,1.13,-.05); arm.rotation.z=.18*sx; g.add(arm); }
  const gun=new THREE.Mesh(new THREE.BoxGeometry(.48,.1,.12),dark); gun.position.set(0,1.08,-.35); g.add(gun);
  g.position.set(x,0,z); g.userData={hp:100,lastAttack:0,speed:1.15+Math.random()*.5,dead:false};
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.userData.enemy=g;}}); scene.add(g); enemies.push(g);
}
function spawnWave(){ const n=4+wave*2; for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2,r=15+Math.random()*12; spawnEnemy(Math.cos(a)*r,Math.sin(a)*r-6); } say('WAVE '+wave,1200); }
spawnWave();

const ray=new THREE.Raycaster();
function aimDir(spread=0){ const d=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(pitch,yaw,0,'YXZ')); d.x+=(Math.random()-.5)*spread; d.y+=(Math.random()-.5)*spread; d.z+=(Math.random()-.5)*spread; return d.normalize(); }
function hitScan(dmg,range,spread){
  ray.set(camera.position,aimDir(spread)); ray.far=range; const meshes=[]; enemies.forEach(e=>e.traverse(o=>{if(o.isMesh)meshes.push(o);})); const h=ray.intersectObjects(meshes,false)[0];
  if(h&&h.object.userData.enemy){ const e=h.object.userData.enemy; e.userData.hp-=dmg*(h.object.geometry.type==='SphereGeometry'?1.7:1); if(e.userData.hp<=0&&!e.userData.dead){e.userData.dead=true;score+=100;scene.remove(e);enemies=enemies.filter(v=>v!==e);if(!enemies.length){wave++;setTimeout(spawnWave,700);}hud();} }
}
function fire(){
  if(!started||reloading)return; const w=weapons[wi], now=performance.now(); if(now-lastShot<w.rate)return; lastShot=now;
  if(w.type!=='melee'&&w.ammo<=0){reloadWeapon();return;} if(w.type!=='melee')w.ammo--; weaponGroup.position.z=.06; pitch+=w.type==='rocket'?.012:.004;
  if(w.type==='rocket'){ const m=new THREE.Mesh(new THREE.SphereGeometry(.09,12,8),new THREE.MeshBasicMaterial({color:0xffa21a})); const dir=aimDir(.005); m.position.copy(camera.position).add(dir.clone().multiplyScalar(.8)); scene.add(m); rockets.push({m,v:dir.multiplyScalar(26),life:4}); }
  else if(w.type==='shotgun') for(let i=0;i<8;i++)hitScan(w.damage,w.range,.11); else hitScan(w.damage,w.range,w.type==='melee'?0:.012); hud();
}
function reloadWeapon(){ const w=weapons[wi]; if(reloading||w.type==='melee'||w.ammo===w.mag||w.res<=0)return; reloading=true;say('RELOADING...',950);setTimeout(()=>{const n=Math.min(w.mag-w.ammo,w.res);w.ammo+=n;w.res-=n;reloading=false;hud();},950); }
function heal(){ if(heals<=0||hp>=100)return;heals--;hp=Math.min(100,hp+45);say('HEALING +45');hud(); }
function hurt(v){ hp=Math.max(0,hp-v);el('damage').style.background='rgba(255,0,0,.22)';setTimeout(()=>el('damage').style.background='rgba(255,0,0,0)',90);if(hp<=0){hp=100;heals=3;camera.position.set(0,1.7,18);say('RESPAWNED');}hud(); }

const menu=el('menu'), startBtn=el('startBtn');
startBtn.addEventListener('click',()=>{
  started=true; menu.style.display='none'; say('MISSION START',900);
  try{ const p=renderer.domElement.requestPointerLock?.(); if(p&&typeof p.catch==='function')p.catch(()=>{}); }catch(_){ }
});
renderer.domElement.addEventListener('click',()=>{ if(started&&!locked){try{renderer.domElement.requestPointerLock?.();}catch(_){}} });
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===renderer.domElement;});
document.addEventListener('mousemove',e=>{ if(!started)return; if(locked){yaw-=e.movementX*.0022;pitch-=e.movementY*.0022;} else {const nx=e.clientX/innerWidth-.5, ny=e.clientY/innerHeight-.5; yaw-=nx*.0025; pitch-=ny*.0015;} pitch=Math.max(-1.25,Math.min(1.25,pitch)); });
document.addEventListener('mousedown',e=>{if(e.button===0&&started)fire();});
document.addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyR')reloadWeapon();if(e.code==='KeyH')heal();if(/^Digit[1-6]$/.test(e.code)){wi=+e.code.slice(-1)-1;reloading=false;rebuildWeapon();hud();}});
document.addEventListener('keyup',e=>{keys[e.code]=false;});

let prev=performance.now();
function animate(t){
  requestAnimationFrame(animate); const dt=Math.min(.033,(t-prev)/1000); prev=t;
  if(started){
    const f=new THREE.Vector3(Math.sin(yaw),0,-Math.cos(yaw)), r=new THREE.Vector3(Math.cos(yaw),0,Math.sin(yaw)), m=new THREE.Vector3();
    if(keys.KeyW)m.add(f);if(keys.KeyS)m.sub(f);if(keys.KeyD)m.add(r);if(keys.KeyA)m.sub(r);
    if(m.lengthSq())m.normalize().multiplyScalar((keys.ShiftLeft?8.5:5.5)*dt); camera.position.add(m); camera.position.x=Math.max(-22,Math.min(22,camera.position.x));camera.position.z=Math.max(-21,Math.min(21,camera.position.z));camera.position.y=1.7;camera.rotation.set(pitch,yaw,0,'YXZ');weaponGroup.position.lerp(new THREE.Vector3(),.18);
    enemies.forEach(e=>{ const d=camera.position.clone().sub(e.position);d.y=0;const dist=d.length();if(dist>2.8)e.position.addScaledVector(d.normalize(),e.userData.speed*dt);e.lookAt(camera.position.x,e.position.y,camera.position.z);if(dist<13&&t-e.userData.lastAttack>1050+Math.random()*500){e.userData.lastAttack=t;if(Math.random()<.5)hurt(3+Math.random()*5);} });
    for(let i=rockets.length-1;i>=0;i--){const p=rockets[i];p.m.position.addScaledVector(p.v,dt);p.life-=dt;let boom=p.life<=0;for(const e of enemies)if(p.m.position.distanceTo(e.position)<1)boom=true;if(boom){for(const e of [...enemies]){const d=e.position.distanceTo(p.m.position);if(d<6){e.userData.hp-=Math.max(30,175*(1-d/6));if(e.userData.hp<=0&&!e.userData.dead){e.userData.dead=true;score+=100;scene.remove(e);enemies=enemies.filter(v=>v!==e);}}}scene.remove(p.m);rockets.splice(i,1);if(!enemies.length){wave++;setTimeout(spawnWave,700);}hud();}}
  }
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
