import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ChevronDown } from 'lucide-react';
import { semMovimento } from './primeArte';

gsap.registerPlugin(ScrollTrigger);

const BASE = '/prime/abertura';
// posição de cada camada no último quadro (fração da altura), para os rótulos
const CAMADAS = [
  { y: 0.145, texto: 'Pão com gergelim', lado: 'esq' },
  { y: 0.30, texto: 'Bacon crocante', lado: 'dir' },
  { y: 0.41, texto: 'Queijo cheddar', lado: 'esq' },
  { y: 0.52, texto: 'Hambúrguer bovino', lado: 'dir' },
  { y: 0.64, texto: 'Tomate e alface', lado: 'esq' },
  { y: 0.77, texto: 'Pão selado', lado: 'dir' },
] as const;

interface Props {
  nome: string;
  logo?: string;
  aberta: boolean;
  horario: string;
  onCardapio: () => void;
  aoPronta?: (ok: boolean) => void;
}

export function PrimeAbertura({ nome, logo, aberta, horario, onCardapio, aoPronta }: Props) {
  const secao = useRef<HTMLElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const [n, setN] = useState(0);
  const [posRotulos, setPosRotulos] = useState<Array<{ y: number; esq: number; dir: number }>>([]);
  const reduzido = semMovimento();

  // sem quadros.json não há abertura e o Prime usa a capa
  useEffect(() => {
    fetch(`${BASE}/quadros.json`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      const total = d?.n || 0;
      setN(total);
      aoPronta?.(total > 0);
    }).catch(() => aoPronta?.(false));
  }, [aoPronta]);

  useEffect(() => {
    const c = tela.current;
    if (!c || !n) return;
    const g = c.getContext('2d')!;
    const celular = window.innerWidth < 768;
    const pasta = `${BASE}/${celular ? 'cel' : 'pc'}`;
    const imgs: HTMLImageElement[] = new Array(n);
    const carregar = (i: number) => {
      if (imgs[i]) return;
      const im = new Image();
      im.decoding = 'async';
      im.src = `${pasta}/${String(i + 1).padStart(3, '0')}.webp`;
      imgs[i] = im;
    };
    carregar(0); carregar(n - 1);
    let k = 1;
    const fila = () => { for (let j = 0; j < 6 && k < n - 1; j++, k++) carregar(k); if (k < n - 1) setTimeout(fila, 60); };
    setTimeout(fila, 200);

    let dpr = 1, W = 0, H = 0, caixa = { x: 0, y: 0, w: 0, h: 0 };
    const medir = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = c.clientWidth; H = c.clientHeight;
      c.width = W * dpr; c.height = H * dpr;
      const r = 16 / 9;
      let w = W, h = W / r;
      if (h < H && W / H > 0.9) { h = H; w = H * r; }
      if (W / H <= 0.9) { w = W * 1.55; h = w / r; }
      // em pé: lanche acima do meio (botão final embaixo); computador: à direita (textos na esquerda)
      const largo = W / H > 0.9 && W >= 900;
      if (largo) { w *= 0.9; h *= 0.9; }
      caixa = { x: (W - w) / 2 + (largo ? W * 0.13 : 0), y: (H - h) / 2 - (W / H <= 0.9 ? H * 0.07 : 0), w, h };
      const centro = caixa.x + caixa.w / 2, afasta = caixa.w * 0.16;
      setPosRotulos(CAMADAS.map((cm) => ({ y: caixa.y + cm.y * caixa.h, esq: W - (centro - afasta),
                                            dir: Math.min(centro + afasta, W - 230) })));
      desenhar(atual, true);
    };
    let atual = 0, alvo = 0, raf = 0, ultimo = -1;
    const desenhar = (f: number, forca = false) => {
      const i = Math.max(0, Math.min(n - 1, Math.round(f)));
      let im = imgs[i];
      if (!im?.complete || !im.naturalWidth) {
        for (let d = 1; d < n; d++) {
          const a = imgs[i - d], b = imgs[i + d];
          if (a?.complete && a.naturalWidth) { im = a; break; }
          if (b?.complete && b.naturalWidth) { im = b; break; }
        }
      }
      if (!im?.complete || !im.naturalWidth || (i === ultimo && !forca)) return;
      ultimo = i;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = '#161617';
      g.fillRect(0, 0, W, H);
      g.drawImage(im, caixa.x, caixa.y, caixa.w, caixa.h);
      const fundir = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
        const f = g.createLinearGradient(x0, y0, x1, y1);
        f.addColorStop(0, '#161617'); f.addColorStop(1, 'rgba(22,22,23,0)');
        g.fillStyle = f; g.fillRect(rx, ry, rw, rh);
      };
      const fx = caixa.w * 0.16, fy = caixa.h * 0.12;
      if (caixa.x > 0) fundir(caixa.x, 0, caixa.x + fx, 0, caixa.x - 1, 0, fx + 1, H);
      if (caixa.x + caixa.w < W) fundir(caixa.x + caixa.w, 0, caixa.x + caixa.w - fx, 0, caixa.x + caixa.w - fx, 0, fx + 1, H);
      if (caixa.y > 0) fundir(0, caixa.y, 0, caixa.y + fy, 0, caixa.y - 1, W, fy + 1);
      if (caixa.y + caixa.h < H) fundir(0, caixa.y + caixa.h, 0, caixa.y + caixa.h - fy, 0, caixa.y + caixa.h - fy, W, fy + 1);
    };
    const laco = () => {
      atual += (alvo - atual) * 0.14;
      desenhar(atual);
      raf = requestAnimationFrame(laco);
    };
    medir();
    window.addEventListener('resize', medir);
    imgs[0].onload = () => desenhar(atual, true);

    if (reduzido) {
      atual = alvo = n - 1;
      imgs[n - 1].onload = () => desenhar(n - 1, true);
      return () => window.removeEventListener('resize', medir);
    }
    raf = requestAnimationFrame(laco);
    const ctx = gsap.context(() => {
      const st = { trigger: secao.current, start: 'top top', end: 'bottom bottom', scrub: true };
      ScrollTrigger.create({ ...st, onUpdate: (s) => { alvo = Math.min(1, s.progress / 0.78) * (n - 1); } });
      const tl = gsap.timeline({ scrollTrigger: { ...st, scrub: 0.6 } });
      tl.to('.ab-intro', { opacity: 0, y: -60, duration: 0.16, ease: 'power2.in' }, 0.04)
        .to('.ab-dica', { opacity: 0, duration: 0.08 }, 0.02)
        .fromTo('.ab-rotulo', { opacity: 0, x: (i, el) => ((el as HTMLElement).dataset.lado === 'esq' ? -40 : 40) },
          { opacity: 1, x: 0, stagger: 0.035, duration: 0.12, ease: 'power3.out' }, 0.5)
        .to('.ab-rotulo', { opacity: 0, duration: 0.06 }, 0.8)
        .fromTo('.ab-final', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.12, ease: 'power3.out' }, 0.84);
      gsap.from('.ab-intro > *', { y: 30, opacity: 0, duration: 1, stagger: 0.1, ease: 'power3.out', delay: 0.2 });
    }, secao);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', medir); ctx.revert(); };
  }, [n, reduzido]);

  if (!n) return null;
  return (
    <section ref={secao} className="ab" style={{ height: reduzido ? '100vh' : '340vh' }} aria-label={`Abertura ${nome}`}>
      <div className="ab-tela">
        <canvas ref={tela} aria-hidden />
        <div className="ab-sombra" />
        <div className="ab-intro">
          {logo && <img src={logo} alt="" />}
          <span className={`pr-selo ${aberta ? 'aberto' : ''}`}><i />{aberta ? 'Aberto agora' : 'Fechado agora'}{horario ? ` · ${horario}` : ''}</span>
          <h1>{nome}</h1>
          <p>Cada camada feita na hora.</p>
        </div>
        {CAMADAS.map((cm, i) => (
          <div key={cm.texto} className={`ab-rotulo ${cm.lado}`} data-lado={cm.lado}
            style={{ top: posRotulos[i]?.y ?? 0, opacity: reduzido ? 1 : 0,
                     ...(window.innerWidth >= 768 && posRotulos[i] ? (cm.lado === 'esq' ? { right: posRotulos[i].esq } : { left: posRotulos[i].dir }) : {}) }}>
            <span className="traco" /><b>{cm.texto}</b>
          </div>
        ))}
        <div className="ab-final" style={{ opacity: reduzido ? 1 : 0 }}>
          <b>Montado do seu jeito.</b>
          <button onClick={onCardapio}>Ver o cardápio</button>
        </div>
        {!reduzido && <div className="ab-dica"><span>Role para abrir</span><ChevronDown size={20} /></div>}
      </div>
    </section>
  );
}
