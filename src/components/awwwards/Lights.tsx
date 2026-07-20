import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface LightsProps {
  /** Progresso do scroll (0 a 1), usado para reagir ao movimento da câmera. */
  progress: React.MutableRefObject<number>;
}

/**
 * Iluminação de estúdio:
 * - key light (principal) quente
 * - fill light (preenchimento) frio e suave
 * - rim light (contorno) que se move conforme o scroll para destacar os ingredientes
 */
export function Lights({ progress }: LightsProps) {
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const keyRef = useRef<THREE.SpotLight>(null);

  useFrame(() => {
    const p = progress.current;
    // A rim light orbita levemente para acompanhar a câmera e "acender" as bordas
    if (rimRef.current) {
      const angle = p * Math.PI * 2;
      rimRef.current.position.set(Math.sin(angle) * 5, 3, Math.cos(angle) * 5);
    }
    // A key light ganha um leve pulso de intensidade ao longo do movimento
    if (keyRef.current) {
      keyRef.current.intensity = 18 + Math.sin(p * Math.PI) * 6;
    }
  });

  return (
    <>
      {/* Ambiente base suave */}
      <ambientLight intensity={0.35} />

      {/* Key light — principal, quente, com sombra */}
      <spotLight
        ref={keyRef}
        position={[4, 6, 4]}
        angle={0.5}
        penumbra={1}
        intensity={18}
        color="#fff4e6"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      />

      {/* Fill light — preenchimento frio para não deixar sombras duras */}
      <directionalLight position={[-5, 2, -2]} intensity={1.2} color="#cfe3ff" />

      {/* Rim light — contorno que reage ao scroll */}
      <directionalLight ref={rimRef} position={[0, 3, -5]} intensity={2.5} color="#ffd9a0" />
    </>
  );
}
