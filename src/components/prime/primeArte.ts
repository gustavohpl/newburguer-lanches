// Artes do PRIME (geradas na fal.ai e editadas por gerador-3d/preparar_prime.py → public/prime/*.webp)
export const ARTE = {
  capa: '/prime/capa.webp',
  capaCelular: '/prime/capa-celular.webp',
  capaFrente: '/prime/capa-frente.webp',
  capaFrenteCelular: '/prime/capa-frente-celular.webp',
  sacola: '/prime/sacola.webp',
  destaques: '/prime/cat-destaques.webp',
  promos: [
    { img: '/prime/promo-combo.webp', titulo: 'Combos que matam a fome', acao: 'Ver lanches', alvo: /artesan|tradicion|lanche|burger/i },
    { img: '/prime/promo-omelete.webp', titulo: 'Omeletes caprichadas', acao: 'Ver omeletes', alvo: /omelet/i },
  ],
};

// Ilustração de cada categoria pelo nome/id (as categorias vêm do Master; o que não casar usa o emoji dela)
const ILUSTRACOES: Array<[RegExp, string]> = [
  [/omelet/i, '/prime/cat-omeletes.webp'],
  [/artesan|gourmet|smash/i, '/prime/cat-artesanais.webp'],
  [/tradicion|lanche|sandu|x-|burg/i, '/prime/cat-tradicionais.webp'],
  [/bebida|drink|refri|suco|cerve/i, '/prime/cat-bebidas.webp'],
];

export function ilustracaoDaCategoria(...nomes: Array<string | undefined>): string | null {
  const texto = nomes.filter(Boolean).join(' ');
  for (const [re, url] of ILUSTRACOES) if (re.test(texto)) return url;
  return null;
}

export const dinheiro = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

// Texto legível sobre a cor de destaque
export function legivelSobre(hex: string) {
  const h = (hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return '#ffffff';
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6 ? '#1d1d1f' : '#ffffff';
}

export const semMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
