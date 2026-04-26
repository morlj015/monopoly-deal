import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Card } from "../../domain/types/card.types";
import { buildCardTexture, buildFaceDownTexture } from "./card-texture";

interface Props {
  card: Card;
  faceDown?: boolean;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  selected?: boolean;
  onClick?: () => void;
}

const CARD_W = 0.63;
const CARD_H = 0.88;
const CARD_D = 0.005;

export function CardMesh3D({ card, faceDown, position, rotation = [0, 0, 0], scale = 1, selected, onClick }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const targetY = useRef(position[1]);

  const faceTexture = useMemo(() => buildCardTexture(card), [card.id]);
  const backTexture = useMemo(() => buildFaceDownTexture(), []);

  useFrame(() => {
    if (!meshRef.current) return;
    const goal = selected ? position[1] + 0.12 : position[1];
    targetY.current += (goal - targetY.current) * 0.18;
    meshRef.current.position.y = targetY.current;
  });

  const materials = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ color: "#e8e8e8" });
    const face = new THREE.MeshStandardMaterial({ map: faceDown ? backTexture : faceTexture, roughness: 0.4, metalness: 0 });
    const back = new THREE.MeshStandardMaterial({ map: backTexture, roughness: 0.4, metalness: 0 });
    // BoxGeometry face order: +x, -x, +y, -y, +z (face), -z (back)
    return [side, side, side, side, face, back];
  }, [faceDown, faceTexture, backTexture]);

  return (
    <mesh
      ref={meshRef}
      position={[position[0], position[1], position[2]]}
      rotation={new THREE.Euler(...rotation)}
      scale={scale}
      material={materials}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerOver={() => { document.body.style.cursor = onClick ? "pointer" : "default"; }}
      onPointerOut={() => { document.body.style.cursor = "default"; }}
    >
      <boxGeometry args={[CARD_W, CARD_H, CARD_D]} />
    </mesh>
  );
}
