import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const BLINK_MS = 2000;        // intervalo do ecrã a ligar/desligar
const SCREEN_INTENSITY = 12;  // intensidade da luz do ecrã quando ligado

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d12);

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 50);
camera.position.set(0.7, 1.35, 1.3);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.95, 0);
controls.enablePan = false;
controls.enableDamping = true;
controls.minDistance = 0.7;
controls.maxDistance = 2.5;
controls.maxPolarAngle = Math.PI / 2.1;

scene.add(new THREE.HemisphereLight(0x8899bb, 0x332211, 1.2));

const mat = (color, roughness = 0.6) => new THREE.MeshStandardMaterial({ color, roughness });
const box = (w, h, d, material, x, y, z, parent = scene) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};

// Chão
const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), mat(0x1a1c22, 0.9));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Mesa
const wood = mat(0x8b5a2b, 0.75);
const TOP = 0.75; // altura do tampo
box(1.6, 0.05, 0.8, wood, 0, TOP, 0);
for (const [x, z] of [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]]) {
  box(0.05, TOP - 0.025, 0.05, wood, x, (TOP - 0.025) / 2, z);
}
const DESK = TOP + 0.025; // superfície do tampo

// Monitor: único objeto clicável
const computer = new THREE.Group();
scene.add(computer);
const dark = mat(0x16181d, 0.4);
box(0.24, 0.015, 0.16, dark, 0, DESK + 0.0075, -0.2, computer);                // base
box(0.04, 0.2, 0.03, dark, 0, DESK + 0.1, -0.23, computer);                    // pescoço
box(0.64, 0.39, 0.03, dark, 0, DESK + 0.27, -0.2, computer);                   // moldura
const screenMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x1e6fff });
const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.35), screenMat);
screen.position.set(0, DESK + 0.27, -0.184);
computer.add(screen);

// Ecrã como fonte de luz
RectAreaLightUniformsLib.init();
const screenLight = new THREE.RectAreaLight(0x1e6fff, SCREEN_INTENSITY, 0.6, 0.35);
screenLight.position.copy(screen.position);
screenLight.lookAt(0, DESK + 0.27, 1);
scene.add(screenLight);

let on = true;
setInterval(() => {
  on = !on;
  screenLight.intensity = on ? SCREEN_INTENSITY : 0;
  screenMat.emissiveIntensity = on ? 1 : 0;
}, BLINK_MS);

// Teclado-computador (estilo Raspberry Pi 500): base vermelha, topo e teclas brancas
const red = mat(0xc8102e, 0.5);
const white = mat(0xf2f2f2, 0.5);
const KB = { x: -0.05, z: 0.15, w: 0.29, d: 0.12 };
box(KB.w, 0.012, KB.d, red, KB.x, DESK + 0.006, KB.z);
box(KB.w, 0.014, KB.d, white, KB.x, DESK + 0.019, KB.z);
const KEY = 0.0165, GAP = 0.0025, keyTop = DESK + 0.029;
const rowZ = (r) => KB.z - KB.d / 2 + 0.014 + r * (KEY + GAP);
for (let r = 0; r < 5; r++) {
  for (let c = 0; c < 14; c++) {
    box(KEY, 0.006, KEY, white, KB.x - KB.w / 2 + 0.012 + c * (KEY + GAP) + KEY / 2, keyTop, rowZ(r));
  }
}
box(0.11, 0.006, KEY, white, KB.x, keyTop, rowZ(5));                          // barra de espaço
for (let i = 0; i < 6; i++) {
  box(0.014, 0.008, 0.004, dark, KB.x - 0.09 + i * 0.03, DESK + 0.012, KB.z - KB.d / 2 - 0.001); // portas traseiras
}

// Cabo do teclado ao monitor
const cable = new THREE.CatmullRomCurve3([
  new THREE.Vector3(KB.x, DESK + 0.012, KB.z - KB.d / 2),
  new THREE.Vector3(KB.x + 0.02, DESK + 0.004, 0.0),
  new THREE.Vector3(0.0, DESK + 0.004, -0.16),
  new THREE.Vector3(0.0, DESK + 0.04, -0.245),
]);
scene.add(new THREE.Mesh(new THREE.TubeGeometry(cable, 32, 0.003, 6), dark));

// Rato
const mouse = new THREE.Group();
mouse.position.set(0.22, DESK, 0.16);
scene.add(mouse);
const mouseBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.04, 6, 12), white);
mouseBody.rotation.x = Math.PI / 2;
mouseBody.scale.set(1, 1, 0.5);
mouseBody.position.y = 0.011;
mouse.add(mouseBody);
box(0.03, 0.006, 0.07, red, 0, 0.003, 0, mouse);

// Raycasting: clicar no monitor abre o modal (arrastar a câmara não conta)
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const hitsComputer = (e) => {
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObject(scene, true)[0]?.object.parent === computer;
};
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  const dragged = !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5;
  if (!dragged && hitsComputer(e)) bootstrap.Modal.getOrCreateInstance('#projectsModal').show();
});
canvas.addEventListener('pointermove', (e) => { canvas.style.cursor = hitsComputer(e) ? 'pointer' : ''; });

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
