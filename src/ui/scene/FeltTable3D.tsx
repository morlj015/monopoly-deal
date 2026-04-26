import * as THREE from "three";
import { useMemo } from "react";

export function FeltTable3D() {
  const feltMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#1b5e20",
    roughness: 0.95,
    metalness: 0,
  }), []);

  const rimMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#8B4513",
    roughness: 0.7,
    metalness: 0.1,
  }), []);

  return (
    <group>
      {/* Table top felt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} material={feltMat}>
        <circleGeometry args={[4.2, 64]} />
      </mesh>

      {/* Rim ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]} material={rimMat}>
        <ringGeometry args={[4.2, 4.6, 64]} />
      </mesh>

      {/* Shadow catcher plane further below */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#111" roughness={1} />
      </mesh>
    </group>
  );
}
