import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ChevronDown } from 'lucide-react';
import { original, semMovimento } from './primeArte';
import { SocialIcons } from '../Header';

gsap.registerPlugin(ScrollTrigger);

const BASE = '/prime/abertura';

function rgb(hex: string) {
  const h = (hex || '').replace('#', '');
  const c = h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6);
  const v = parseInt(c, 16);
  return Number.isNaN(v) ? [22, 22, 23] : [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

interface Props {
  nome: string;
  logo: string;
  logoOriginal?: string;
  aberta: boolean;
  horario: string;
  cor: string;
  redes: Array<{ rede: string; url: string; cor: string }>;
  fundo: string;
  parede: string;
  onCardapio: () => void;
  aoPronta?: (ok: boolean) => void;
}

export function PrimeAbertura({ nome, logo, logoOriginal, aberta, horario, cor, redes, fundo, parede, onCardapio, aoPronta }: Props) {
  const secao = useRef<HTMLElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const [info, setInfo] = useState<{ n: number; v?: string; corteCel?: [number, number]; tam: number[]; util: number[] }>({ n: 0, tam: [], util: [] });
  const reduzido = semMovimento();
  const n = info.n;

  // sem quadros.json (com área útil) não há abertura e o Prime usa a capa
  useEffect(() => {
    fetch(`${BASE}/quadros.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((d) => {
      const ok = d?.n > 0 && d.tam && d.util;
      setInfo(ok ? { n: d.n, v: d.v, corteCel: d.corteCel, tam: d.tam, util: d.util } : { n: 0, tam: [], util: [] });
      aoPronta?.(!!ok);
    }).catch(() => aoPronta?.(false));
  }, [aoPronta]);

  useEffect(() => {
    const c = tela.current;
    if (!c || !n) return;
    const g = c.getContext('2d')!;
    const [er, eg, eb] = rgb(fundo);   // escuro = fundo da animação (atrás do lanche)
    const [vr, vg, vb] = rgb(parede);  // verde escuro = papel de parede (atrás do header)
    const esc = (a: number) => `rgba(${er},${eg},${eb},${a})`;
    const vrd = (a: number) => `rgba(${vr},${vg},${vb},${a})`;
    // 'lighten' troca o preto do estúdio do vídeo pela cor do fundo sem tocar no lanche
    const clarear = (0.2126 * er + 0.7152 * eg + 0.0722 * eb) / 255 < 0.3;
    const emPe = window.innerWidth < 768 && window.innerHeight > window.innerWidth;
    const corte = emPe && info.corteCel ? info.corteCel : null;
    const pasta = `${BASE}/${corte ? 'cel' : 'pc'}`;
    // só a área útil do quadro (o resto é preto puro); cel = recorte central do quadro do pc
    const [tw, th] = info.tam;
    const [ux, uy, uw, uh] = info.util;
    const ox = corte ? Math.round(corte[0] * tw) : 0;
    const memPouca = ((navigator as { deviceMemory?: number }).deviceMemory ?? 8) <= 2;
    // decodificar 1× fora da thread principal: drawImage de <img> redecodifica o webp ao rolar (~1 GB não cabe no cache) = trava
    const imgs: Array<ImageBitmap | HTMLImageElement | undefined> = new Array(n);
    let vivo = true;
    const chegou = (i: number, q: ImageBitmap | HTMLImageElement) => {
      if (!vivo) { if (q instanceof ImageBitmap) q.close(); return; }
      imgs[i] = q; ultimo = -1; desenhar(atual);
    };
    const carregar = (i: number, prioridade: 'high' | 'auto' = 'auto') => {
      // ?v= muda a cada vídeo novo: o cache do app nunca mistura quadros de versões diferentes
      const src = `${pasta}/${String(i + 1).padStart(3, '0')}.webp${info.v ? `?v=${info.v}` : ''}`;
      return fetch(src, { priority: prioridade } as RequestInit).then((r) => r.blob())
        .then((b) => createImageBitmap(b, ux - ox, uy, uw, uh, memPouca ? { resizeWidth: Math.round(uw * 0.7), resizeHeight: Math.round(uh * 0.7), resizeQuality: 'high' } : {}))
        .then((q) => chegou(i, q))
        .catch(() => { const im = new Image(); im.onload = () => chegou(i, im); im.src = src; });
    };

    let dpr = 1, W = 0, H = 0, desce = 0, caixa = { x: 0, y: 0, w: 0, h: 0 };
    const medir = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 4);
      W = c.clientWidth; H = c.clientHeight;
      c.width = W * dpr; c.height = H * dpr;
      const r = 16 / 9;
      let w = W, h = W / r;
      if (h < H && W / H > 0.9) { h = H; w = H * r; }
      if (W / H <= 0.9) { w = W * 1.9; h = w / r; }
      // em pé: lanche acima do meio (botão final embaixo); computador: à direita (textos na esquerda)
      const largo = W / H > 0.9 && W >= 900;
      if (largo) { w *= 1.08; h *= 1.08; }
      caixa = { x: (W - w) / 2 + (largo ? W * 0.13 : 0), y: (H - h) / 2 + (W / H <= 0.9 ? H * 0.16 : 0), w, h };
      // em pé o lanche fechado começa abaixo da logo/status e sobe enquanto abre (fechado ocupa 16,5%–78% do quadro)
      const intro = secao.current?.querySelector<HTMLElement>('.ab-intro');
      desce = W / H <= 0.9 && intro ? Math.max(0, Math.min(intro.offsetTop + intro.offsetHeight + 10 - (caixa.y + 0.165 * caixa.h),
                                                             H - 14 - (caixa.y + 0.82 * caixa.h))) : 0;
      ultimo = -1;
      desenhar(atual);
    };
    let atual = 0, alvo = 0, raf = 0, ultimo = -1, rapido = false;
    const desenhar = (f: number) => {
      const i = Math.max(0, Math.min(n - 1, Math.floor(f)));
      let a = imgs[i];
      for (let d = 1; d < n && !a; d++) a = imgs[i - d] || imgs[i + d];
      if (!a) return;
      const chave = Math.round(f * 50) * 2 + (rapido ? 1 : 0);
      if (chave === ultimo) return;
      ultimo = chave;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.imageSmoothingEnabled = true;
      // scroll rápido = suavização leve (mais fluido); parado/devagar = alta (nítido)
      g.imageSmoothingQuality = rapido ? 'low' : 'high';
      const p = Math.min(1, f / ((n - 1) * 0.45));
      const prog = n > 1 ? f / (n - 1) : 0;
      // sobe o tempo todo (rolagem contínua), além da subida inicial do fechado e de abrir
      const y = caixa.y + desce * (1 - p * p * (3 - 2 * p)) - H * 0.26 * prog;
      // papel de parede VERDE do lado do header -> ESCURO do lado do lanche (degradê direcional):
      // o lanche fica todo no escuro (lighten não encosta no verde = sem borda verde)
      const cx = caixa.x + caixa.w / 2;
      const largo = W / H > 0.9 && W >= 900;
      let grad: CanvasGradient;
      let verdeTopo = vrd(1);
      if (largo) {
        const xEsc = cx - caixa.w * 0.22;            // borda esquerda do lanche (com folga)
        grad = g.createLinearGradient(Math.max(0, xEsc - W * 0.12), 0, xEsc, 0);
      } else {
        const yEsc = y + caixa.h * 0.08;             // topo do lanche
        grad = g.createLinearGradient(0, Math.max(0, yEsc - H * 0.16), 0, yEsc);
        // em pé o lanche sobe pra dentro do verde ao abrir -> some o verde conforme abre (sem borda verde no ingrediente)
        const abriu = Math.min(1, f / ((n - 1) * 0.5));
        verdeTopo = `rgb(${Math.round(vr + (er - vr) * abriu)},${Math.round(vg + (eg - vg) * abriu)},${Math.round(vb + (eb - vb) * abriu)})`;
      }
      grad.addColorStop(0, verdeTopo);
      grad.addColorStop(1, esc(1));
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      // caminho único e leve: desenha o quadro direto com lighten (sem offscreen nem mistura) -> FPS máximo em qualquer velocidade
      g.globalCompositeOperation = clarear ? 'lighten' : 'source-over';
      const X = caixa.x + caixa.w * ux / tw, Y = y + caixa.h * uy / th, DW = caixa.w * uw / tw, DH = caixa.h * uh / th;
      if (a instanceof HTMLImageElement) g.drawImage(a, ux - ox, uy, uw, uh, X, Y, DW, DH);
      else g.drawImage(a, X, Y, DW, DH);
      g.globalCompositeOperation = 'source-over';
    };
    const laco = () => {
      const d = alvo - atual;
      // parado = laço dorme (rAF contínuo força a página toda a re-renderizar todo quadro)
      if (Math.abs(d) < 0.02) { atual = alvo; rapido = false; desenhar(atual); raf = 0; return; }
      // amortecimento adaptativo: acompanha de perto no scroll rápido, suave no devagar
      atual += d * (0.45 + 0.5 * Math.min(1, Math.abs(d) / 14));
      rapido = Math.abs(d) > 4; // rolando rápido -> caminho leve
      desenhar(atual);
      raf = requestAnimationFrame(laco);
    };
    medir();
    window.addEventListener('resize', medir);
    // 1º quadro sozinho (senão divide a banda com os 121 e a tela fica preta no 4G); depois todos, do grosso ao fino
    const ordem: number[] = [];
    for (const passo of [8, 4, 2, 1]) for (let i = 0; i < n; i += passo) if (!ordem.includes(i)) ordem.push(i);
    carregar(0, 'high').finally(() => { if (vivo) ordem.slice(1).forEach((i) => carregar(i)); });
    const soltar = () => { vivo = false; window.removeEventListener('resize', medir); imgs.forEach((q) => q instanceof ImageBitmap && q.close()); };

    if (reduzido) {
      atual = alvo = n - 1;
      return soltar;
    }
    const acordar = () => { if (!raf) raf = requestAnimationFrame(laco); };
    acordar();
    const ctx = gsap.context(() => {
      const st = { trigger: secao.current, start: 'top top', end: 'bottom bottom', scrub: true };
      ScrollTrigger.create({ ...st, onUpdate: (s) => { alvo = s.progress * (n - 1); acordar(); } });
      const tl = gsap.timeline({ scrollTrigger: { ...st, scrub: 0.5 } });
      // posições = fração da ROLAGEM (padding força a duração total da timeline p/ 1.0)
      tl.to('.ab-dica', { opacity: 0, duration: 0.06 }, 0.02)
        // logo + infos SOBEM (rolagem natural) e saem pelo topo
        .fromTo('.ab-intro', { yPercent: 0 }, { yPercent: -175, ease: 'none', duration: 0.52 }, 0)
        .to('.ab-intro', { opacity: 0, duration: 0.12, ease: 'power1.in' }, 0.4)
        // "Montado do seu jeito" sobe de baixo (a partir de ~metade da logo) e NÃO trava: segue subindo até o fim
        .fromTo('.ab-final', { yPercent: 135 }, { yPercent: -85, ease: 'none', duration: 0.7 }, 0.3)
        .fromTo('.ab-final', { opacity: 0 }, { opacity: 1, ease: 'power1.out', duration: 0.16 }, 0.33)
        .to({}, { duration: 0.01 }, 1);
      gsap.from('.ab-intro > *', { y: 30, opacity: 0, duration: 1, stagger: 0.1, ease: 'power3.out', delay: 0.2 });
    }, secao);
    return () => { cancelAnimationFrame(raf); soltar(); ctx.revert(); };
  }, [n, info, fundo, reduzido]);

  if (!n) return null;
  return (
    <section ref={secao} className="ab" style={{ height: reduzido ? '100vh' : '134vh', background: fundo, ['--ab-fundo' as string]: parede, ['--ab-escuro' as string]: fundo } as React.CSSProperties} aria-label={`Abertura ${nome}`}>
      <div className="ab-tela">
        <canvas ref={tela} aria-hidden />
        <div className="ab-sombra" />
        <div className="ab-intro">
          <div className="ab-logo"><i style={{ background: cor }} /><img src={logo} onError={original(logoOriginal)} alt={nome} /></div>
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
