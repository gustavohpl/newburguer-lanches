import React, { useRef, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useConfig } from '../../ConfigContext';

const DEFAULT_MODEL_PATH = '/burger.glb'; // usado se nada for definido no Master

interface BurgerProps {
  progress: React.MutableRefObject<number>;
}

/**
 * Grupo que aplica a rotação sincronizada ao scroll:
 * - 360° no eixo Y ao longo da primeira dobra
 * - leve inclinação nos eixos X e Z para dar profundidade
 */
function RotatingGroup({ progress, children }: BurgerProps & { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!group.current) return;
    const p = progress.current;
    // Rotação alvo
    const targetY = p * Math.PI * 2;            // 360° na primeira dobra
    const targetX = Math.sin(p * Math.PI) * 0.18; // inclina e volta
    const targetZ = Math.sin(p * Math.PI * 2) * 0.08;

    // Lerp suave (60fps, sem travar)
    group.current.rotation.y += (targetY - group.current.rotation.y) * 0.1;
    group.current.rotation.x += (targetX - group.current.rotation.x) * 0.1;
    group.current.rotation.z += (targetZ - group.current.rotation.z) * 0.1;
  });

  return <group ref={group}>{children}</group>;
}

/** Carrega o modelo GLB real. */
function GLBModel({ path }: { path: string }) {
  const { scene } = useGLTF(path);
  // Ativa sombras em todas as malhas do modelo
  scene.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return <primitive object={scene} scale={1.6} position={[0, -0.3, 0]} />;
}

/**
 * Placeholder 3D (hambúrguer feito de primitivas) exibido enquanto
 * o /burger.glb não estiver presente. Some sozinho quando o GLB é adicionado.
 */
function PlaceholderBurger() {
  return (
    <group position={[0, -0.15, 0]} scale={1.2}>
      {/* Pão de baixo — assado, leve brilho */}
      <mesh castShadow receiveShadow position={[0, -0.62, 0]}>
        <cylinderGeometry args={[1, 0.92, 0.34, 64]} />
        <meshStandardMaterial color="#d68a3c" roughness={0.55} metalness={0.05} />
      </mesh>
      {/* Carne — grelhada, bem fosca */}
      <mesh castShadow receiveShadow position={[0, -0.32, 0]}>
        <cylinderGeometry args={[1.08, 1.08, 0.3, 64]} />
        <meshStandardMaterial color="#43281a" roughness={0.9} />
      </mesh>
      {/* Queijo — cantos derretendo, tom quente */}
      <mesh castShadow receiveShadow position={[0, -0.12, 0]} rotation={[0, 0.4, 0]}>
        <boxGeometry args={[1.7, 0.07, 1.7]} />
        <meshStandardMaterial
          color="#f4b731"
          roughness={0.35}
          metalness={0.05}
          emissive="#e0821c"
          emissiveIntensity={0.12}
        />
      </mesh>
      {/* Tomate — cor/frescor */}
      <mesh castShadow receiveShadow position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.96, 0.96, 0.08, 48]} />
        <meshStandardMaterial color="#cf3e2d" roughness={0.5} />
      </mesh>
      {/* Alface — folha ondulada */}
      <mesh castShadow receiveShadow position={[0, 0.08, 0]}>
        <torusGeometry args={[1, 0.18, 14, 64]} />
        <meshStandardMaterial color="#6fae3f" roughness={0.8} />
      </mesh>
      {/* Pão de cima (cúpula) */}
      <mesh castShadow receiveShadow position={[0, 0.44, 0]} scale={[1, 0.72, 1]}>
        <sphereGeometry args={[1.05, 64, 40, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#dc9134" roughness={0.5} metalness={0.05} />
      </mesh>
      {/* Gergelim distribuído na cúpula */}
      {Array.from({ length: 18 }).map((_, i) => {
        const a = (i / 18) * Math.PI * 2 * 2.4; // espiral p/ não alinhar
        const t = i / 18;
        const r = 0.18 + t * 0.62;
        const h = 0.72 - t * t * 0.42;
        return (
          <mesh key={i} position={[Math.cos(a) * r, h, Math.sin(a) * r]} scale={[1, 0.6, 1]}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshStandardMaterial color="#f5e6c0" roughness={0.45} />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * ErrorBoundary: se o /burger.glb não existir (404) ou falhar,
 * cai no placeholder sem quebrar a cena.
 */
class ModelErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    // Silencioso: apenas usa o fallback
  }
  render() {
    if (this.state.failed) return <>{this.props.fallback}</>;
    return <>{this.props.children}</>;
  }
}

export function Burger({ progress }: BurgerProps) {
  const { config } = useConfig();
  const modelPath = config.heroModelUrl && config.heroModelUrl.trim() !== ''
    ? config.heroModelUrl
    : DEFAULT_MODEL_PATH;

  return (
    <RotatingGroup progress={progress}>
      {/* key={modelPath}: se o modelo mudar no Master, remonta e tenta carregar de novo */}
      <ModelErrorBoundary key={modelPath} fallback={<PlaceholderBurger />}>
        <Suspense fallback={<PlaceholderBurger />}>
          <GLBModel path={modelPath} />
        </Suspense>
      </ModelErrorBoundary>
    </RotatingGroup>
  );
}
