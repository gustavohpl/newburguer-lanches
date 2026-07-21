import React from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CameraRigProps {
  /** Progresso do scroll (0 a 1). */
  progress: React.MutableRefObject<number>;
  /** No mobile a câmera fica mais longe para o modelo caber na tela estreita. */
  isMobile?: boolean;
}

/**
 * Move a CÂMERA em uma órbita discreta ao redor do hambúrguer
 * (em vez de só girar o modelo), criando a sensação premium de profundidade.
 * A interpolação é suave (lerp) para manter 60fps e evitar "pulos".
 */
export function CameraRig({ progress, isMobile = false }: CameraRigProps) {
  const { camera } = useThree();
  const target = new THREE.Vector3(0, 0.2, 0);
  // Raio base maior no mobile → modelo cabe na tela estreita e não estoura.
  const baseRadius = isMobile ? 5.7 : 6;

  useFrame(() => {
    const p = progress.current;

    // Órbita horizontal discreta (~70°) + leve subida vertical
    const angle = (p - 0.5) * 1.2; // varia de -0.6 a 0.6 rad
    const radius = baseRadius - p * 0.8; // aproxima um pouco ao rolar
    const desiredX = Math.sin(angle) * radius;
    const desiredZ = Math.cos(angle) * radius;
    const desiredY = 1.6 + p * 1.2;

    // Lerp suave para a posição desejada
    camera.position.x += (desiredX - camera.position.x) * 0.08;
    camera.position.y += (desiredY - camera.position.y) * 0.08;
    camera.position.z += (desiredZ - camera.position.z) * 0.08;

    camera.lookAt(target);
  });

  return null;
}
