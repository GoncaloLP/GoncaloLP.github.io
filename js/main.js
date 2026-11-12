import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import screenImage from '../assets/Computer_Face.png';

const SCREEN_INTENSITY = 12;  // intensidade da luz do ecrã quando ligado
// Padrão de piscar (ms): ligado (FIRST_ON_MS na 1.ª vez, depois CYCLE_ON_MS) → desliga FIRST_OFF_MS
// → volta a ligar durante GAP_MS → 3 rajadas (BURST_ON_MS ligado, 100–200 ms desligado)
const FIRST_ON_MS = 3000, CYCLE_ON_MS = 60000, FIRST_OFF_MS = 500, GAP_MS = 800, BURST_ON_MS = 120;
const FLY_MS = 1200;          // duração das animações da câmara (entrar/sair do monitor)
const ROOM_H = 2.8;           // altura do teto

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
controls.maxDistance = 1.8; // mantém a câmara dentro da sala
controls.maxPolarAngle = Math.PI / 2.1;

scene.add(new THREE.HemisphereLight(0xffffff, 0x332211, 1.0));

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

// Paredes e teto brancos: caixa vista por dentro (fundo 1 cm abaixo do chão para não sobrepor)
box(4.4, ROOM_H + 0.01, 3, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.BackSide }),
  0, (ROOM_H - 0.01) / 2, 0.9);

// LED circular no teto + spotlight amarelada
const led = new THREE.Mesh(
  new THREE.CylinderGeometry(0.12, 0.12, 0.02, 32),
  new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd89a, emissiveIntensity: 2 }),
);
led.position.set(0, ROOM_H - 0.01, 0);
scene.add(led);
const spot = new THREE.SpotLight(0xffd89a, 12, 0, Math.PI / 4, 0.6, 2);
spot.position.set(0, ROOM_H - 0.03, 0);
spot.target.position.set(0, 0, 0);
scene.add(spot, spot.target);

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
// Ecrã com as proporções da imagem (1138×766) para não a deformar
const SCREEN_H = 0.35, SCREEN_W = SCREEN_H * 1138 / 766;
box(SCREEN_W + 0.04, SCREEN_H + 0.04, 0.03, dark, 0, DESK + 0.27, -0.2, computer); // moldura
const screenTexture = new THREE.TextureLoader().load(screenImage);
screenTexture.colorSpace = THREE.SRGBColorSpace;
const screenMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: screenTexture });
const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), screenMat);
screen.position.set(0, DESK + 0.27, -0.184);
computer.add(screen);

// Ecrã como fonte de luz
RectAreaLightUniformsLib.init();
const screenLight = new THREE.RectAreaLight(0xffffff, SCREEN_INTENSITY, SCREEN_W, SCREEN_H);
screenLight.position.copy(screen.position);
screenLight.lookAt(0, DESK + 0.27, 1);
scene.add(screenLight);

const setScreen = (on) => {
  screenLight.intensity = on ? SCREEN_INTENSITY : 0;
  screenMat.emissiveIntensity = on ? 1 : 0;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let first = true; ; first = false) {
    await wait(first ? FIRST_ON_MS : CYCLE_ON_MS);
    setScreen(false);
    await wait(FIRST_OFF_MS);
    setScreen(true);
    await wait(GAP_MS);
    for (let i = 0; i < 3; i++) {
      setScreen(true);
      await wait(BURST_ON_MS);
      setScreen(false);
      await wait(100 + Math.random() * 100);
    }
    setScreen(true);
  }
})();

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
  if (!fly && !dragged && hitsComputer(e)) flyToScreen();
});

// Animações da câmara: até à frente do monitor (abre o modal ao chegar) e de volta ao fechar
let fly = null;
let back = null; // posição de onde a câmara veio, para regressar ao fechar o modal
function flyTo(toPos, toTarget, onDone) {
  fly = { start: performance.now(), fromPos: camera.position.clone(), fromTarget: controls.target.clone(), toPos, toTarget, onDone };
  controls.enabled = false;
}
function flyToScreen() {
  back = { pos: camera.position.clone(), target: controls.target.clone() };
  // 0.75 de distância e ligeiramente acima: respeita minDistance e maxPolarAngle dos controlos
  const toTarget = screen.position.clone();
  flyTo(toTarget.clone().add(new THREE.Vector3(0, 0.1, 0.75)), toTarget,
    () => bootstrap.Modal.getOrCreateInstance('#menuModal').show());
}
// Ao passar do menu para uma secção, o novo modal abre antes de o anterior fechar:
// conta os modais abertos e só volta atrás quando o último fecha.
let openModals = 0;
document.addEventListener('show.bs.modal', () => openModals++);
document.addEventListener('hidden.bs.modal', () => {
  if (--openModals > 0 || !back) return;
  flyTo(back.pos, back.target);
  back = null;
});
function updateFly(now) {
  const t = Math.min((now - fly.start) / FLY_MS, 1);
  const k = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2; // easeInOutCubic
  camera.position.lerpVectors(fly.fromPos, fly.toPos, k);
  controls.target.lerpVectors(fly.fromTarget, fly.toTarget, k);
  if (t === 1) {
    const { onDone } = fly;
    fly = null;
    controls.enabled = true;
    onDone?.();
  }
}
canvas.addEventListener('pointermove', (e) => { canvas.style.cursor = hitsComputer(e) ? 'pointer' : ''; });

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

renderer.setAnimationLoop((now) => {
  if (fly) updateFly(now);
  controls.update();
  renderer.render(scene, camera);
});
