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

// logo/fotos do Supabase são PNG de até 3 MB: no ar a Vercel entrega webp do tamanho da tela (local = original)
export function leve(url: string | null | undefined, w: 96 | 256 | 480 | 828 | 1080) {
  if (!url || !/^https:\/\/[^/]+\.supabase\.co\/storage\//.test(url) || /^(localhost|127\.)/.test(location.hostname)) return url || '';
  return `/_vercel/image?url=${encodeURIComponent(url)}&w=${w}&q=78`;
}

// se a otimização falhar, cai no arquivo original (uma vez só)
export const original = (url: string | null | undefined) => (e: { currentTarget: HTMLImageElement }) => {
  const im = e.currentTarget;
  if (url && !im.dataset.orig) { im.dataset.orig = '1'; im.src = url; }
};

export const dinheiro = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

export function legivelSobre(hex: string) {
  const h = (hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return '#ffffff';
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6 ? '#1d1d1f' : '#ffffff';
}

export function misturarHex(a: string, b: string, t: number) {
  const px = (h: string) => {
    const s = (h || '').replace('#', '');
    const f = s.length === 3 ? s.split('').map((c) => c + c).join('') : s.slice(0, 6);
    const n = parseInt(f, 16);
    return Number.isNaN(n) ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [ar, ag, ab] = px(a), [br, bg, bb] = px(b);
  const m = (x: number, y: number) => Math.round(x * t + y * (1 - t));
  const h = (x: number) => x.toString(16).padStart(2, '0');
  return `#${h(m(ar, br))}${h(m(ag, bg))}${h(m(ab, bb))}`;
}

export const semMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
