import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useConfig } from '../../ConfigContext';

/** Ids de efeito válidos (mesmos usados no Master → Aparência). */
export const HERO_EFFECT_IDS = ['sparkles', 'ring', 'orbiters', 'stars'] as const;
export type HeroEffectId = (typeof HERO_EFFECT_IDS)[number];

/** Padrão quando o Master ainda não configurou nada. */
const DEFAULT_EFFECTS: HeroEffectId[] = ['sparkles'];

/** Anel de luz emissivo girando lentamente sob o modelo. */
function LightRing({ color }: { color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * 0.25;
  });
  return (
    <mesh ref={ref} position={[0, -1.32, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[1.8, 0.025, 12, 96]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2.2}
        toneMapped={false}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

/** Pequenas esferas douradas orbitando o modelo em alturas diferentes. */
function Orbiters({ color, count = 7 }: { color: string; count?: number }) {
  const group = useRef<THREE.Group>(null);
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        radius: 2.1 + (i % 3) * 0.45,
        height: -0.6 + ((i * 0.37) % 1.4),
        speed: 0.15 + (i % 4) * 0.06,
        phase: (i / count) * Math.PI * 2,
        size: 0.035 + (i % 3) * 0.02,
      })),
    [count]
  );
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.children.forEach((child, i) => {
      const s = seeds[i];
      child.position.set(
        Math.cos(t * s.speed + s.phase) * s.radius,
        s.height + Math.sin(t * 0.6 + s.phase) * 0.12,
        Math.sin(t * s.speed + s.phase) * s.radius
      );
    });
  });
  return (
    <group ref={group}>
      {seeds.map((s, i) => (
        <mesh key={i}>
          <sphereGeometry args={[s.size, 12, 12]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Efeitos extras da cena 3D do hero, ligáveis pelo Master
 * (Aparência & Cores → Efeitos 3D do Hero). Todos usam a cor do tema.
 * No mobile as contagens caem para manter fluidez.
 */
export function HeroEffects({ isMobile }: { isMobile: boolean }) {
  const { config } = useConfig();
  const gold = config.themeColor || '#fbbf24';
  const enabled = (config.heroEffects && config.heroEffects.length > 0
    ? config.heroEffects
    : DEFAULT_EFFECTS) as HeroEffectId[];

  return (
    <>
      {enabled.includes('sparkles') && (
        <Sparkles
          count={isMobile ? 40 : 90}
          scale={[6, 4, 6]}
          position={[0, 0.2, 0]}
          size={isMobile ? 2.5 : 3.5}
          speed={0.3}
          opacity={0.55}
          color={gold}
        />
      )}
      {enabled.includes('ring') && <LightRing color={gold} />}
      {enabled.includes('orbiters') && <Orbiters color={gold} count={isMobile ? 5 : 8} />}
      {enabled.includes('stars') && (
        <Stars radius={40} depth={20} count={isMobile ? 800 : 2000} factor={3} saturation={0} fade speed={0.6} />
      )}
    </>
  );
}
