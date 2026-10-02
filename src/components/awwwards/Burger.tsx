import React, { useRef, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useConfig } from '../../ConfigContext';

// usado se nada for definido no Master. xbacon.glb = X-bacon modelado a partir de fotos (gerador-3d), uma camada
// por ingrediente, otimizado p/ celular com scripts/otimizar-glb.mjs. O burger.glb antigo fica no public p/ voltar.
const DEFAULT_MODEL_PATH = '/xbacon.glb';

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

// Todo modelo entra na cena do mesmo tamanho e no mesmo lugar, seja qual for a escala do arquivo
// (o X-bacon vem em metros; o burger.glb antigo em outra unidade; uploads do Master podem vir de qualquer jeito).
const MODEL_SIZE = 2.0;      // maior dimensão do modelo na cena
const MODEL_CENTER_Y = 0.05; // a câmera (CameraRig) mira em y = 0.2, olhando um pouco de cima
const OPEN_SPREAD = 0.8;     // aberto, a pilha cresce 80% da altura do lanche

/** Carrega o modelo GLB real e anima a "abertura" das camadas ao scroll.
 *
 * Camadas: se o GLB traz um nó por ingrediente (o xbacon.glb do gerador: pao-baixo, tomate, alface, carne,
 * queijo, bacon-1, bacon-2, pao-cima), cada ingrediente sobe INTEIRO. Se não (ex.: burger.glb antigo,
 * fatiado em malhas), cada malha é uma camada, como antes. Fechado no topo da página, aberto no meio do
 * hero e fechando de novo perto do fim. Modelos de uma peça só ficam estáticos.
 */
function GLBModel({ path, progress }: { path: string; progress: React.MutableRefObject<number> }) {
  const { scene } = useGLTF(path);

  const layers = useRef<Array<{ obj: THREE.Object3D; baseY: number; order: number }>>([]);
  const fit = React.useMemo(() => {
    scene.updateMatrixWorld(true);
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    // Desce enquanto a raiz tiver um filho só; com 2+ filhos, cada filho é uma camada
    let root: THREE.Object3D = scene;
    while (root.children.length === 1 && !(root.children[0] as THREE.Mesh).isMesh) root = root.children[0];
    let pieces: THREE.Object3D[] = root.children.length >= 2 ? [...root.children] : [];
    if (pieces.length < 2) {
      pieces = [];
      scene.traverse((obj) => { if ((obj as THREE.Mesh).isMesh) pieces.push(obj); });
    }
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = MODEL_SIZE / Math.max(size.x, size.y, size.z, 1e-6);

    const sorted = pieces
      .map((obj) => ({ obj, y: new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3()).y }))
      .sort((a, b) => a.y - b.y);
    const mid = (sorted.length - 1) / 2;
    layers.current = sorted.map((s, i) => ({ obj: s.obj, baseY: s.obj.position.y, order: i - mid }));
    return {
      scale,
      position: [-center.x * scale, -center.y * scale + MODEL_CENTER_Y, -center.z * scale] as [number, number, number],
      // vão entre camadas vizinhas, em unidades do próprio arquivo
      gap: sorted.length >= 2 ? (size.y * OPEN_SPREAD) / (sorted.length - 1) : 0,
    };
  }, [scene]);

  useFrame(() => {
    if (layers.current.length < 2) return;
    const p = progress.current;
    // Curva sino: 0 no início, pico em p=0.5, 0 no fim → fecha de novo
    const open = Math.sin(Math.min(Math.max(p, 0), 1) * Math.PI);
    for (const layer of layers.current) {
      const target = layer.baseY + layer.order * open * fit.gap;
      layer.obj.position.y += (target - layer.obj.position.y) * 0.12;
    }
  });

  return <primitive object={scene} scale={fit.scale} position={fit.position} />;
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
          <GLBModel path={modelPath} progress={progress} />
        </Suspense>
      </ModelErrorBoundary>
    </RotatingGroup>
  );
}
