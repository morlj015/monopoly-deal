import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { GameState, PlayerId } from "../../domain/types/game.types";
import type { PropertyColor } from "../../domain/types/card.types";
import { buildCardTexture, buildFaceDownTexture } from "./card-texture";
import { PROP_COLOR } from "../components/CardFace";
import { isComplete, SET_SIZES } from "../../domain/rules/set.rules";

const COLOR_ORDER: PropertyColor[] = [
  "brown", "lightblue", "pink", "orange",
  "red", "yellow", "green", "darkblue",
  "railroad", "utility",
];

// ── Scene builder ──────────────────────────────────────────────────────────

function buildScene(state: GameState, names?: { you: string; opponent: string }) {
  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setClearColor("#0d1b2a");
  renderer.shadowMap.enabled = true;

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const scene = new THREE.Scene();

  // Lights
  scene.add(new THREE.AmbientLight("#fffbe8", 0.55));
  const sun = new THREE.DirectionalLight("#ffffff", 1.6);
  sun.position.set(5, 10, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 30;
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  sun.shadow.bias = -0.001;
  scene.add(sun);
  const fill = new THREE.PointLight("#ffd580", 0.5);
  fill.position.set(-4, 6, -4);
  scene.add(fill);

  // Felt table
  const feltGeo = new THREE.CircleGeometry(4.5, 64);
  const feltMat = new THREE.MeshStandardMaterial({ color: "#1b5e20", roughness: 0.95 });
  const felt = new THREE.Mesh(feltGeo, feltMat);
  felt.rotation.x = -Math.PI / 2;
  felt.receiveShadow = true;
  scene.add(felt);

  const rimGeo = new THREE.RingGeometry(4.5, 5.0, 64);
  const rimMat = new THREE.MeshStandardMaterial({ color: "#4e342e", roughness: 0.7 });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = -0.01;
  scene.add(rim);

  // Zone dividers (subtle lines on felt)
  addDivider(scene, 0, 0.001, -0.9);
  addDivider(scene, 0, 0.001,  0.9);

  // Deck pile
  const deckTex = buildFaceDownTexture();
  const deckH = Math.max(0.02, state.deckSize * 0.003);
  addBox(scene, "#1a237e", 0.65, deckH, 0.9, -0.6, deckH / 2, 0);
  addFlatCard(scene, deckTex, -0.6, deckH + 0.001, 0, 0);

  // Discard pile
  const discardTop = state.discardPile[0];
  if (discardTop) {
    addFlatCard(scene, buildCardTexture(discardTop), 0.6, 0.002, 0, 0.2);
  } else {
    // Empty slot indicator
    addRing(scene, 0.6, 0, 0.3, 0.32, "rgba(255,255,255,0.1)", 0.1);
  }

  // Property sets
  addPropertyZone(scene, state, "player",  2.2, false);
  addPropertyZone(scene, state, "ai",     -2.2, true);

  // Bank piles
  addBankPile(scene, state, "player",  3.6,  2.0);
  addBankPile(scene, state, "ai",      3.6, -2.0);

  // Player name labels
  addTextLabel(scene, names?.you ?? "You", 0, 3.7);
  addTextLabel(scene, names?.opponent ?? "Opponent", 0, -3.7);

  return { scene, camera, renderer, canvas };
}

// ── Scene helpers ──────────────────────────────────────────────────────────

function addDivider(scene: THREE.Scene, x: number, y: number, z: number) {
  const geo = new THREE.PlaneGeometry(8, 0.02);
  const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.08 });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  scene.add(m);
}

function addBox(scene: THREE.Scene, color: string, w: number, h: number, d: number, x: number, y: number, z: number) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  scene.add(m);
}

const CARD_THICKNESS = 0.05;
const CARD_EDGE_COLOR = "#f5f0e8";

function addFlatCard(scene: THREE.Scene, tex: THREE.Texture, x: number, y: number, z: number, rotZ: number, backTex?: THREE.Texture) {
  const geo = new THREE.BoxGeometry(0.63, 0.88, CARD_THICKNESS);
  const edge = new THREE.MeshStandardMaterial({ color: CARD_EDGE_COLOR, roughness: 0.5 });
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 });
  const back = new THREE.MeshStandardMaterial({ map: backTex ?? tex, roughness: 0.35 });
  // BoxGeometry face order: +x, -x, +y, -y, +z (front), -z (back)
  const m = new THREE.Mesh(geo, [edge, edge, edge, edge, face, back]);
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = rotZ;
  m.position.set(x, y + CARD_THICKNESS / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
}

function addRing(scene: THREE.Scene, x: number, z: number, inner: number, outer: number, color: string, opacity: number) {
  const geo = new THREE.RingGeometry(inner, outer, 32);
  const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.001, z);
  scene.add(m);
}

function addTextLabel(scene: THREE.Scene, text: string, x: number, z: number) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.roundRect(8, 20, 496, 88, 18);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "bold 56px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c);
  const geo = new THREE.PlaneGeometry(2.2, 0.55);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.005, z);
  scene.add(m);
}

function addPropertyZone(
  scene: THREE.Scene,
  state: GameState,
  playerId: PlayerId,
  zBase: number,
  flipped: boolean,
) {
  const player = state.players[playerId];
  const activeColors = COLOR_ORDER.filter(c => (player.sets[c]?.length ?? 0) > 0);

  // Empty zone placeholder
  if (activeColors.length === 0) {
    const geo = new THREE.PlaneGeometry(3.5, 0.95);
    const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.03 });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 0.001, zBase);
    scene.add(m);
    return;
  }

  const totalW = activeColors.length * 0.78;
  const startX = -totalW / 2 + 0.39;
  const yaw = flipped ? Math.PI : 0;

  activeColors.forEach((color, ci) => {
    const cards = player.sets[color] ?? [];
    const complete = isComplete(player.sets, color);
    const hasHotel = !!player.hotels[color];
    const setSize = SET_SIZES[color];
    const cx = startX + ci * 0.78;

    // Color header with X/Y progress label
    const hc = document.createElement("canvas");
    hc.width = 256; hc.height = 96;
    const hCtx = hc.getContext("2d")!;
    hCtx.fillStyle = PROP_COLOR[color];
    hCtx.fillRect(0, 0, 256, 96);
    if (complete) {
      hCtx.fillStyle = "rgba(255,255,255,0.18)";
      hCtx.fillRect(0, 0, 256, 96);
    }
    hCtx.fillStyle = "#fff";
    hCtx.font = "bold 46px monospace";
    hCtx.textAlign = "center";
    hCtx.textBaseline = "middle";
    hCtx.fillText(`${cards.length}/${setSize}`, 128, 58);
    hCtx.font = "bold 16px sans-serif";
    hCtx.fillStyle = "rgba(255,255,255,0.75)";
    hCtx.fillText(color.toUpperCase(), 128, 22);
    const headerTex = new THREE.CanvasTexture(hc);
    const headerGeo = new THREE.PlaneGeometry(0.72, 0.22);
    const headerMat = new THREE.MeshBasicMaterial({ map: headerTex, transparent: true, depthWrite: false });
    const header = new THREE.Mesh(headerGeo, headerMat);
    header.rotation.x = -Math.PI / 2;
    header.rotation.z = yaw;
    header.position.set(cx, 0.003, zBase + (flipped ? -0.52 : 0.52));
    scene.add(header);

    // Upgrade indicator
    if (hasHotel || player.houses[color]) {
      addRing(scene, cx, zBase + (flipped ? -0.52 : 0.52), 0.04, 0.06, hasHotel ? "#e53935" : "#43a047", 1);
    }

    // Card stack — fanned with generous spread so names are visible
    const spread = Math.min(0.9, 2.2 / Math.max(cards.length, 1));
    const fanStep = cards.length > 1 ? 0.025 : 0;

    cards.forEach((card, i) => {
      const tex = buildCardTexture(card);
      const backTex = buildFaceDownTexture();
      const yPos = 0.002 + i * 0.002;
      const zPos = zBase + i * spread * (flipped ? -1 : 1);
      const fanAngle = (i - (cards.length - 1) / 2) * fanStep * (flipped ? -1 : 1);
      const geo = new THREE.BoxGeometry(0.63, 0.88, CARD_THICKNESS);
      const edge = new THREE.MeshStandardMaterial({ color: CARD_EDGE_COLOR, roughness: 0.5 });
      const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 });
      const back = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.35 });
      const mesh = new THREE.Mesh(geo, [edge, edge, edge, edge, face, back]);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = yaw + fanAngle;
      mesh.position.set(cx, yPos + CARD_THICKNESS / 2, zPos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (complete) mesh.scale.setScalar(1.03);
      scene.add(mesh);
    });
  });
}

function addBankPile(
  scene: THREE.Scene,
  state: GameState,
  playerId: PlayerId,
  xBase: number,
  zBase: number,
) {
  const bank = state.players[playerId].bank;
  if (bank.length === 0) return;

  const h = Math.max(0.012, bank.length * 0.004);
  // Stack of cards
  addBox(scene, playerId === "player" ? "#1b5e20" : "#7f0000", 0.55, h, 0.78, xBase, h / 2, zBase);
  // Top card texture
  const topCard = bank[bank.length - 1];
  addFlatCard(scene, buildCardTexture(topCard), xBase, h + 0.001, zBase, 0);
  // Total badge (small circle)
}

// ── Orbit controls ─────────────────────────────────────────────────────────

function attachOrbit(canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera) {
  let dragging = false, lastX = 0, lastY = 0;
  let theta = 0.1, phi = 1.0, radius = 9;

  function update() {
    camera.position.set(
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.cos(theta),
    );
    camera.lookAt(0, 0, 0);
  }
  update();

  const onDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    theta -= (e.clientX - lastX) * 0.008;
    phi = Math.max(0.3, Math.min(1.4, phi + (e.clientY - lastY) * 0.006));
    lastX = e.clientX; lastY = e.clientY;
    update();
  };
  const onUp = () => { dragging = false; };
  const onWheel = (e: WheelEvent) => { radius = Math.max(5, Math.min(16, radius + e.deltaY * 0.01)); update(); };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: true });
  return () => {
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("wheel", onWheel);
  };
}

// ── React component ────────────────────────────────────────────────────────

interface Props {
  state: GameState;
  names?: { you: string; opponent: string };
}

export function TableScene({ state, names }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scene, camera, renderer, canvas } = buildScene(state, names);
    const detachOrbit = attachOrbit(canvas, camera);

    const resize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h);
      renderer.setPixelRatio(window.devicePixelRatio);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    container.appendChild(canvas);
    canvas.style.cssText = "display:block;width:100%;height:100%;";

    let raf = 0;
    const loop = () => { raf = requestAnimationFrame(loop); renderer.render(scene, camera); };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      detachOrbit();
      canvas.parentNode?.removeChild(canvas);
      renderer.dispose();
    };
  }, [state, names]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
