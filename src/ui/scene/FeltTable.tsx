import { useRef } from "react";
import * as THREE from "three";

/** Circular felt table with a wooden rim */
export function FeltTable() {
  const feltRef = useRef<THREE.Mesh>(null);

  return (
    <group>
      {/* Felt surface */}
      <mesh
        ref={feltRef}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[4.2, 96]} />
        <meshStandardMaterial
          color="#0c5018"
          roughness={0.95}
          metalness={0.0}
        />
      </mesh>

      {/* Subtle grid lines via a second mesh on top */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <circleGeometry args={[4.18, 96]} />
        <meshStandardMaterial
          color="#0e5a1e"
          roughness={1}
          metalness={0}
          transparent
          opacity={0.18}
          wireframe={false}
        />
      </mesh>

      {/* Wooden rim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
        <ringGeometry args={[4.2, 4.75, 96]} />
        <meshStandardMaterial color="#5d3a1a" roughness={0.7} metalness={0.08} />
      </mesh>

      {/* Outer dark trim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.72, 4.85, 96]} />
        <meshStandardMaterial color="#3b2008" roughness={0.8} />
      </mesh>

      {/* Table leg pedestal (cylinder) */}
      <mesh position={[0, -0.5, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.9, 1, 32]} />
        <meshStandardMaterial color="#4a2f10" roughness={0.75} />
      </mesh>

      {/* Table shadow receiver plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.01, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <shadowMaterial transparent opacity={0.35} />
      </mesh>
    </group>
  );
}
