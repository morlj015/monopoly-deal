interface Props {
  count: number;
}

/** Facedown deck of cards sitting in the center */
export function DeckPile({ count }: Props) {
  if (count === 0) return null;
  const height = Math.min(count * 0.008, 0.4);

  return (
    <group position={[-1, 0, 0]}>
      {/* Stack of cards as a box */}
      <mesh position={[0, height / 2 + 0.001, 0]} castShadow>
        <boxGeometry args={[0.76, height, 1.06]} />
        <meshStandardMaterial color="#1a237e" roughness={0.5} />
      </mesh>
      {/* Card back pattern on top */}
      <mesh
        position={[0, height + 0.003, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.74, 1.04]} />
        <meshStandardMaterial color="#1565c0" roughness={0.7} />
      </mesh>
    </group>
  );
}
