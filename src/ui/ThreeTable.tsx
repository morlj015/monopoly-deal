import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  isActionCard,
  isPropertyCard,
  isPropertyWildCard,
  isRentCard,
  PROPERTY_CONFIG,
  type Card
} from "../domain/cards";
import type { GameState } from "../domain/state";
import {
  CARD_DEPTH,
  CARD_WIDTH,
  TABLE_HALF_DEPTH,
  TABLE_HALF_WIDTH,
  layoutTableCards,
  layoutTableLabels,
  type TableLabelPlacement,
  type TableCardPlacement
} from "./tableLayout";

interface ThreeTableProps {
  state: GameState;
}

const cardGeometry = new THREE.BoxGeometry(CARD_WIDTH, 0.032, CARD_DEPTH);
const faceGeometry = new THREE.PlaneGeometry(CARD_WIDTH - 0.04, CARD_DEPTH - 0.06);

const disposeObject = (object: THREE.Object3D) => {
  if (object instanceof THREE.Mesh) {
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      const mapped = material as THREE.MeshStandardMaterial;
      mapped.map?.dispose();
      material.dispose();
    }
  }
  if (object instanceof THREE.Sprite) {
    object.material.map?.dispose();
    object.material.dispose();
  }
  for (const child of object.children) {
    disposeObject(child);
  }
};

const disposeGroup = (group: THREE.Group) => {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    disposeObject(child);
  }
};

const cardAccent = (card?: Card) => {
  if (!card) {
    return { accent: "#24376f", text: "#eef4ff", label: "Hidden" };
  }
  if (isPropertyCard(card)) {
    return {
      accent: PROPERTY_CONFIG[card.color].hex,
      text: PROPERTY_CONFIG[card.color].text,
      label: PROPERTY_CONFIG[card.color].label
    };
  }
  if (isPropertyWildCard(card)) {
    return {
      accent: card.anyColor ? "#f7f7f2" : PROPERTY_CONFIG[card.colors[0] ?? "railroad"].hex,
      text: "#111923",
      label: card.anyColor
        ? "Any Property"
        : card.colors.map((color) => PROPERTY_CONFIG[color].label).join(" / ")
    };
  }
  if (isRentCard(card)) {
    return {
      accent: "#f0c344",
      text: "#211b08",
      label: card.scope === "all" ? "All Rent" : "Wild Rent"
    };
  }
  if (isActionCard(card)) {
    return {
      accent: "#57a0d8",
      text: "#061321",
      label: card.action === "justSayNo" ? "Defense" : "Action"
    };
  }
  return { accent: "#6fbf73", text: "#07160a", label: "Money" };
};

const makeTexture = (card?: Card) => {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const { accent, text, label } = cardAccent(card);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, canvas.width, 92);
  ctx.strokeStyle = "#111923";
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  ctx.fillStyle = text;
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label.toUpperCase(), canvas.width / 2, 46, 220);

  ctx.fillStyle = "#111923";
  ctx.font = "bold 24px system-ui, sans-serif";
  const words = (card?.name ?? "Monopoly Deal").split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = `${line} ${word}`.trim();
    if (ctx.measureText(next).width > 205 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) {
    lines.push(line);
  }
  lines.slice(0, 4).forEach((part, index) => {
    ctx.fillText(part, canvas.width / 2, 158 + index * 30, 215);
  });

  ctx.font = "900 34px system-ui, sans-serif";
  ctx.fillStyle = "#1a613a";
  ctx.fillText(card ? `$${card.value}M` : "MD", canvas.width / 2, 310);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
};

const makeLabelTexture = (text: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(6, 10, 16, 0.82)";
  ctx.fillStyle = "#f8fafc";
  ctx.font = "900 84px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2 + 4, canvas.width - 36);
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2, canvas.width - 72);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
};

const addCard = (group: THREE.Group, place: TableCardPlacement) => {
  const { accent } = cardAccent(place.card);
  const holder = new THREE.Group();
  holder.position.set(place.x, place.y + place.layer, place.z);
  holder.rotation.y = place.rotation;

  const cardBody = new THREE.Group();
  cardBody.rotation.x = place.pitch;

  const base = new THREE.Mesh(
    cardGeometry,
    new THREE.MeshStandardMaterial({
      color: accent,
      roughness: 0.58,
      metalness: 0.06
    })
  );
  base.castShadow = true;
  base.receiveShadow = true;
  cardBody.add(base);

  const texture = makeTexture(place.card);
  const face = new THREE.Mesh(
    faceGeometry,
    new THREE.MeshStandardMaterial({
      color: "#ffffff",
      map: texture ?? undefined,
      roughness: 0.48
    })
  );
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.022;
  cardBody.add(face);
  holder.add(cardBody);
  group.add(holder);
};

const addLabel = (group: THREE.Group, place: TableLabelPlacement) => {
  const texture = makeLabelTexture(place.text);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture ?? undefined,
      transparent: true,
      depthTest: false
    })
  );
  sprite.position.set(place.x, place.y, place.z);
  sprite.scale.set(1.55, 0.42, 1);
  sprite.renderOrder = 3;
  group.add(sprite);
};

export const ThreeTable = ({ state }: ThreeTableProps) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cardsRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return undefined;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#12171d");
    scene.fog = new THREE.Fog("#12171d", 10, 22);

    const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 9.8, 10.8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 6.5;
    controls.maxDistance = 16.5;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.target.set(0, 0, 0);

    const table = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE_HALF_WIDTH * 2, 0.16, TABLE_HALF_DEPTH * 2),
      new THREE.MeshStandardMaterial({ color: "#1f6a4a", roughness: 0.82 })
    );
    table.position.y = -0.04;
    table.receiveShadow = true;
    scene.add(table);

    const railRadius = TABLE_HALF_WIDTH - 0.25;
    const rail = new THREE.Mesh(
      new THREE.TorusGeometry(railRadius, 0.035, 8, 128),
      new THREE.MeshStandardMaterial({ color: "#d9b45b", roughness: 0.42, metalness: 0.28 })
    );
    rail.scale.z = (TABLE_HALF_DEPTH - 0.25) / railRadius;
    rail.rotation.x = Math.PI / 2;
    rail.position.y = 0.07;
    scene.add(rail);

    scene.add(new THREE.AmbientLight("#e9f6ff", 1.4));

    const key = new THREE.DirectionalLight("#fff0d3", 2.6);
    key.position.set(-3, 7, 4);
    key.castShadow = true;
    scene.add(key);

    const fill = new THREE.PointLight("#84d6ff", 16, 12);
    fill.position.set(3, 3, -4);
    scene.add(fill);

    const cards = new THREE.Group();
    scene.add(cards);
    cardsRef.current = cards;

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    let frame = 0;
    let animationId = 0;
    const animate = () => {
      frame += 0.01;
      cards.rotation.y = Math.sin(frame) * 0.004;
      controls.update();
      renderer.render(scene, camera);
      animationId = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(animationId);
      window.removeEventListener("resize", onResize);
      disposeGroup(cards);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const group = cardsRef.current;
    if (!group) {
      return;
    }

    disposeGroup(group);
    for (const place of layoutTableCards(state)) {
      addCard(group, place);
    }
    for (const place of layoutTableLabels(state)) {
      addLabel(group, place);
    }
  }, [state.version, state.deck.length, state.players, state.playerOrder, state.currentTurn]);

  return <div className="three-table" ref={mountRef} aria-hidden="true" />;
};
