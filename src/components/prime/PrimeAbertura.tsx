import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ChevronDown } from 'lucide-react';
import { semMovimento } from './primeArte';
import { SocialIcons } from '../Header';

gsap.registerPlugin(ScrollTrigger);

const BASE = '/prime/abertura';

interface Props {
  nome: string;
  logo: string;
  aberta: boolean;
  horario: string;
  cor: string;
  redes: Array<{ rede: string; url: string; cor: string }>;
  fundo: string;
  onCardapio: () => void;
  aoPronta?: (ok: boolean) => void;
}

export function PrimeAbertura({ nome, logo, aberta, horario, cor, redes, fundo, onCardapio, aoPronta }: Props) {
  const secao = useRef<HTMLElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const [info, setInfo] = useState<{ n: number; corteCel?: [number, number] }>({ n: 0 });
  const reduzido = semMovimento();
  const n = info.n;

  // sem quadros.json não há abertura e o Prime usa a capa
  useEffect(() => {
    fetch(`${BASE}/quadros.json`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      setInfo({ n: d?.n || 0, corteCel: d?.corteCel });
      aoPronta?.((d?.n || 0) > 0);
    }).catch(() => aoPronta?.(false));
  }, [aoPronta]);

  useEffect(() => {
    const c = tela.current;
    if (!c || !n) return;
    const g = c.getContext('2d')!;
    const quadro = document.createElement('canvas');
    const q = quadro.getContext('2d')!;
    // máscara em baixa resolução p/ achar SÓ o fundo (região escura/neutra ligada à borda)
    const masc = document.createElement('canvas');
    const mc = masc.getContext('2d', { willReadFrequently: true })!;
    let mw = 0, mh = 0, bg = new Uint8Array(0), vis = new Uint8Array(0), pilha = new Int32Array(0);
    const emPe = window.innerWidth < 768 && window.innerHeight > window.innerWidth;
    const corte = emPe && info.corteCel ? info.corteCel : null;
    const pasta = `${BASE}/${corte ? 'cel' : 'pc'}`;
    const imgs: HTMLImageElement[] = new Array(n);
    const carregar = (i: number) => {
      if (imgs[i]) return;
      const im = new Image();
      im.decoding = 'async';
      im.src = `${pasta}/${String(i + 1).padStart(3, '0')}.webp`;
      imgs[i] = im;
    };
    // do grosso ao fino: qualquer ponto da rolagem logo tem um quadro próximo
    const ordem: number[] = [];
    for (const passo of [8, 4, 2, 1]) for (let i = 0; i < n; i += passo) if (!ordem.includes(i)) ordem.push(i);
    carregar(0); carregar(n - 1);
    let k = 0;
    const fila = () => { for (let j = 0; j < 6 && k < ordem.length; j++, k++) carregar(ordem[k]); if (k < ordem.length) setTimeout(fila, 50); };
    setTimeout(fila, 150);

    let dpr = 1, W = 0, H = 0, desce = 0, caixa = { x: 0, y: 0, w: 0, h: 0 };
    const medir = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = c.clientWidth; H = c.clientHeight;
      c.width = W * dpr; c.height = H * dpr;
      const r = 16 / 9;
      let w = W, h = W / r;
      if (h < H && W / H > 0.9) { h = H; w = H * r; }
      if (W / H <= 0.9) { w = W * 1.9; h = w / r; }
      // em pé: lanche acima do meio (botão final embaixo); computador: à direita (textos na esquerda)
      const largo = W / H > 0.9 && W >= 900;
      if (largo) { w *= 1.08; h *= 1.08; }
      caixa = { x: (W - w) / 2 + (largo ? W * 0.13 : 0), y: (H - h) / 2 - (W / H <= 0.9 ? H * 0.07 : 0), w, h };
      if (corte) caixa = { ...caixa, x: caixa.x + corte[0] * caixa.w, w: corte[1] * caixa.w };
      // em pé o lanche fechado começa abaixo da logo/status e sobe enquanto abre (fechado ocupa 16,5%–78% do quadro)
      const intro = secao.current?.querySelector<HTMLElement>('.ab-intro');
      desce = W / H <= 0.9 && intro ? Math.max(0, Math.min(intro.offsetTop + intro.offsetHeight + 12 - (caixa.y + 0.165 * caixa.h),
                                                             H - 70 - (caixa.y + 0.78 * caixa.h))) : 0;
      ultimo = -1;
      desenhar(atual);
    };
    const pronta = (im?: HTMLImageElement) => !!im && im.complete && im.naturalWidth > 0;
    // máscara do fundo: escuro E neutro, ligado à borda (flood-fill). Sombras internas do lanche fechado ficam de fora.
    const mascararFundo = () => {
      if (!mw) return;
      mc.imageSmoothingEnabled = true;
      mc.clearRect(0, 0, mw, mh);
      mc.drawImage(quadro, 0, 0, mw, mh);
      const d = mc.getImageData(0, 0, mw, mh);
      const px = d.data, N = mw * mh;
      for (let i2 = 0; i2 < N; i2++) {
        const r = px[i2 * 4], gg = px[i2 * 4 + 1], b = px[i2 * 4 + 2];
        const mx = r > gg ? (r > b ? r : b) : (gg > b ? gg : b);
        const mn = r < gg ? (r < b ? r : b) : (gg < b ? gg : b);
        bg[i2] = ((r * 77 + gg * 151 + b * 28) >> 8) < 74 && mx - mn < 34 ? 1 : 0;
        vis[i2] = 0;
      }
      let sp = 0;
      const semear = (idx: number) => { if (bg[idx] && !vis[idx]) { vis[idx] = 1; pilha[sp++] = idx; } };
      for (let x = 0; x < mw; x++) { semear(x); semear((mh - 1) * mw + x); }
      for (let yy = 0; yy < mh; yy++) { semear(yy * mw); semear(yy * mw + mw - 1); }
      while (sp) {
        const idx = pilha[--sp], x = idx % mw, yy = (idx / mw) | 0;
        if (x > 0) semear(idx - 1);
        if (x < mw - 1) semear(idx + 1);
        if (yy > 0) semear(idx - mw);
        if (yy < mh - 1) semear(idx + mw);
      }
      for (let i2 = 0; i2 < N; i2++) { px[i2 * 4] = px[i2 * 4 + 1] = px[i2 * 4 + 2] = 0; px[i2 * 4 + 3] = vis[i2] ? 255 : 0; }
      mc.putImageData(d, 0, 0);
    };
    let atual = 0, alvo = 0, raf = 0, ultimo = -1;
    const desenhar = (f: number) => {
      const i = Math.max(0, Math.min(n - 1, Math.floor(f)));
      let a = imgs[i];
      if (!pronta(a)) {
        a = undefined;
        for (let d = 1; d < n && !a; d++) a = pronta(imgs[i - d]) ? imgs[i - d] : pronta(imgs[i + d]) ? imgs[i + d] : undefined;
      }
      if (!a) return;
      const t = f - i, b = imgs[i + 1];
      const chave = Math.round(f * 50) * 4 + (a === imgs[i] ? 2 : 0) + (pronta(b) ? 1 : 0);
      if (chave === ultimo) return;
      ultimo = chave;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      if (quadro.width !== a.naturalWidth) {
        quadro.width = a.naturalWidth; quadro.height = a.naturalHeight;
        mw = 320; mh = Math.max(1, Math.round(mw * quadro.height / quadro.width));
        masc.width = mw; masc.height = mh;
        bg = new Uint8Array(mw * mh); vis = new Uint8Array(mw * mh); pilha = new Int32Array(mw * mh);
      }
      q.globalCompositeOperation = 'source-over';
      q.globalAlpha = 1;
      q.clearRect(0, 0, quadro.width, quadro.height);
      q.drawImage(a, 0, 0);
      // mistura com o próximo quadro: movimento contínuo entre os quadros do vídeo
      if (a === imgs[i] && t > 0.02 && pronta(b)) { q.globalAlpha = t; q.drawImage(b, 0, 0); }
      const p = Math.min(1, f / ((n - 1) * 0.45));
      const y = caixa.y + desce * (1 - p * p * (3 - 2 * p));
      // desenha o lanche e apaga só o fundo ligado à borda -> a parede verde (fundo do .ab) aparece atrás
      g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
      g.drawImage(quadro, caixa.x, y, caixa.w, caixa.h);
      mascararFundo();
      g.globalCompositeOperation = 'destination-out';
      g.drawImage(masc, caixa.x, y, caixa.w, caixa.h);
      g.globalCompositeOperation = 'source-over';
    };
    const laco = () => {
      atual += (alvo - atual) * 0.14;
      desenhar(atual);
      raf = requestAnimationFrame(laco);
    };
    medir();
    window.addEventListener('resize', medir);
    imgs[0].onload = () => { ultimo = -1; desenhar(atual); };

    if (reduzido) {
      atual = alvo = n - 1;
      imgs[n - 1].onload = () => { ultimo = -1; desenhar(n - 1); };
      return () => window.removeEventListener('resize', medir);
    }
    raf = requestAnimationFrame(laco);
    const ctx = gsap.context(() => {
      const st = { trigger: secao.current, start: 'top top', end: 'bottom bottom', scrub: true };
      ScrollTrigger.create({ ...st, onUpdate: (s) => { alvo = Math.min(1, s.progress / 0.65) * (n - 1); } });
      const tl = gsap.timeline({ scrollTrigger: { ...st, scrub: 0.5 } });
      tl.to('.ab-intro', { opacity: 0, y: -60, duration: 0.14, ease: 'power2.in' }, 0.03)
        .to('.ab-dica', { opacity: 0, duration: 0.08 }, 0.02)
        .fromTo('.ab-final', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.14, ease: 'power3.out' }, 0.66);
      gsap.from('.ab-intro > *', { y: 30, opacity: 0, duration: 1, stagger: 0.1, ease: 'power3.out', delay: 0.2 });
    }, secao);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', medir); ctx.revert(); };
  }, [n, info.corteCel, fundo, reduzido]);

  if (!n) return null;
  return (
    <section ref={secao} className="ab" style={{ height: reduzido ? '100vh' : '150vh', background: fundo, ['--ab-fundo' as string]: fundo } as React.CSSProperties} aria-label={`Abertura ${nome}`}>
      <div className="ab-tela">
        <canvas ref={tela} aria-hidden />
        <div className="ab-sombra" />
        <div className="ab-intro">
          <div className="ab-logo"><i style={{ background: cor }} /><img src={logo} alt={nome} /></div>
          <div className="ab-classico">
            {redes.length > 0 && (
              <div className="ab-redes">
                {redes.map(({ rede, url, cor: fundoRede }) => {
                  const Icone = SocialIcons[rede];
                  return Icone && (
                    <a key={rede} href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noopener noreferrer" style={{ background: fundoRede }}>
                      <Icone />{rede.charAt(0).toUpperCase() + rede.slice(1)}
                    </a>
                  );
                })}
              </div>
            )}
            <span className={`ab-selo ${aberta ? 'aberto' : ''}`}>{aberta && <i />}{aberta ? 'ABERTO AGORA' : 'FECHADO'}</span>
            {horario && <span className="ab-horario" style={{ background: `linear-gradient(to right, ${cor}, ${cor}dd)` }}><span>🕐</span>{horario}</span>}
          </div>
          <p>Cada camada feita na hora.</p>
        </div>
        <div className="ab-final" style={{ opacity: reduzido ? 1 : 0 }}>
          <b>Montado do seu jeito.</b>
          <button onClick={onCardapio}>Ver o cardápio</button>
        </div>
        {!reduzido && <div className="ab-dica"><span>Role para abrir</span><ChevronDown size={20} /></div>}
      </div>
    </section>
  );
}
