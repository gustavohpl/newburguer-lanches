import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { Search, ShoppingBag, MapPin, Clock, Phone, ChevronRight, Bike, Plus, Instagram, MessageCircle, Truck, ClipboardList, Download } from 'lucide-react';
import logoPadrao from 'figma:asset/2217307d23df7779a3757aa35c01d81549336b8b.png';
import type { Product } from '../../App';
import { useConfig } from '../../ConfigContext';
import { useInstalar } from '../../pwa';
import { HORARIO_PADRAO } from '../StatusBar';
import { useFranchise } from '../../FranchiseContext';
import { SocialBrandColors } from '../Header';
import { PrimeSheet } from './PrimeSheet';
import { PrimeAbertura } from './PrimeAbertura';
import { ARTE, ilustracaoDaCategoria, dinheiro, legivelSobre, leve, misturarHex, original, semMovimento } from './primeArte';
import './prime.css';

gsap.registerPlugin(ScrollTrigger, SplitText);

interface PrimeLayoutProps {
  products: Product[];
  onAddToCart: (product: Product, notes?: string, quantity?: number, selectedAddons?: Array<{ id: string; name: string; price: number }>) => void;
  cartCount: number;
  onOpenCart: () => void;
  isStoreOpen: boolean;
  onMeusPedidos?: () => void;
}

type Secao = { id: string; titulo: string; ilustracao: string | null; emoji?: string; itens: Product[] };

const fotoDe = (p: Product) => p.imageUrl || p.image || null;

export function PrimeLayout({ products, onAddToCart, cartCount, onOpenCart, isStoreOpen, onMeusPedidos }: PrimeLayoutProps) {
  const { config } = useConfig();
  const instalar = useInstalar();
  const cfg = config as any;
  const { unitOverrides } = useFranchise();
  const raiz = useRef<HTMLDivElement>(null);
  const capa = useRef<HTMLDivElement>(null);
  const sacolaBtn = useRef<HTMLButtonElement>(null);
  const lenis = useRef<Lenis | null>(null);
  const [busca, setBusca] = useState('');
  const [ativa, setAtiva] = useState<string>('');
  const [topo, setTopo] = useState(false);
  const [aberto, setAberto] = useState<Product | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [celular, setCelular] = useState(() => window.innerWidth < 768);
  const [abertura, setAbertura] = useState<boolean | null>(null);   // null = ainda vendo se há quadros
  const reduzido = semMovimento();

  const cor = config.themeColor || '#04af06';
  const nome = config.siteName || 'NewBurguer Lanches';
  const titulo = cfg.primeHeroTitle || nome;
  const frase = cfg.primeHeroTagline || config.siteSubtitle || '';
  const endereco = unitOverrides.address || config.address || '';
  const horario = unitOverrides.openingHours || config.openingHours || HORARIO_PADRAO;
  const telefone = unitOverrides.phone || config.phone || '';
  const taxa = unitOverrides.deliveryFee ?? config.deliveryFee;
  const whats = (config.whatsappNumber || telefone || '').replace(/\D/g, '');
  const fundoSite = config.backgroundColor || '#161617';
  const verdeEscuro = misturarHex(cor, fundoSite, 0.5); // papel de parede: verde do site escurecido
  const redes = Object.entries((cfg.socialMedia || {}) as Record<string, string>).filter(([, url]) => url && url.trim())
    .map(([rede, url]) => ({ rede, url, cor: cfg.socialMediaColors?.[rede] || SocialBrandColors[rede] || cor }));
  const capaPropria = celular ? cfg.primeHeroMobileUrl || cfg.primeHeroUrl : cfg.primeHeroUrl;

  const secoes = useMemo<Secao[]>(() => {
    const cats: Array<{ id: string; label?: string; emoji?: string }> = (config.categories as any[]) || [];
    const lista: Secao[] = [];
    const usados = new Set<string>();
    for (const c of cats) {
      const itens = products.filter((p) => p.category === c.id);
      if (!itens.length) continue;
      usados.add(c.id);
      lista.push({ id: c.id, titulo: c.label || c.id, emoji: c.emoji, ilustracao: ilustracaoDaCategoria(c.id, c.label), itens });
    }
    for (const p of products) {
      if (usados.has(p.category)) continue;
      usados.add(p.category);
      lista.push({ id: p.category, titulo: p.category, ilustracao: ilustracaoDaCategoria(p.category),
                   itens: products.filter((x) => x.category === p.category) });
    }
    return lista;
  }, [products, config.categories]);

  const ilustracaoDo = useCallback((p: Product) => secoes.find((s) => s.id === p.category)?.ilustracao || ARTE.destaques, [secoes]);

  const destaques = useMemo(() => {
    const disp = products.filter((p) => p.available !== false);
    const marcados = disp.filter((p) => p.featuredRating);
    const comFoto = disp.filter((p) => fotoDe(p) && !p.featuredRating);
    return [...marcados, ...comFoto].slice(0, 10);
  }, [products]);

  const resultado = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return null;
    return products.filter((p) => `${p.name} ${p.description || ''}`.toLowerCase().includes(q));
  }, [busca, products]);

  const banners = useMemo(() => {
    const doMaster = ((cfg.bannerCards as any[]) || []).map((b) => ({ img: b.imageUrl, link: b.link || '', titulo: '', acao: '', alvo: null as RegExp | null }));
    const nossos = ARTE.promos.map((p) => ({ img: p.img, link: '', titulo: p.titulo, acao: p.acao, alvo: p.alvo }));
    return [...doMaster, ...nossos.filter((p) => secoes.some((s) => p.alvo?.test(`${s.id} ${s.titulo}`)))];
  }, [cfg.bannerCards, secoes]);

  useEffect(() => {
    const r = () => setCelular(window.innerWidth < 768);
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);

  useEffect(() => {
    // toque já rola nativo (smoothWheel só age na roda); sem Lenis o ticker não força quadro na thread principal todo vsync
    if (reduzido || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const l = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      // modais rolam por conta própria
      prevent: (no: HTMLElement) => !!no.closest?.('[data-lenis-prevent], [role="dialog"], .overflow-y-auto, .overflow-auto'),
    } as any);
    lenis.current = l;
    l.on('scroll', ScrollTrigger.update);
    const tick = (t: number) => l.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => { gsap.ticker.remove(tick); l.destroy(); lenis.current = null; };
  }, [reduzido]);

  useEffect(() => {
    if (!raiz.current || reduzido) return;
    raiz.current.classList.add('anima');
    const ctx = gsap.context(() => {
      const tit = raiz.current!.querySelector('.pr-capa .pr-titulo');
      if (tit) {
        const st = new SplitText(tit, { type: 'words,lines', linesClass: 'linha' });
        gsap.from(st.words, { yPercent: 115, opacity: 0, rotate: 4, duration: 1, ease: 'power4.out', stagger: 0.07, delay: 0.15 });
      }
      if (raiz.current!.querySelector('.pr-capa-texto')) {
        gsap.from('.pr-capa-texto .pr-logo', { scale: 0.6, opacity: 0, duration: 0.9, ease: 'back.out(1.8)' });
        gsap.from('.pr-capa-texto .pr-subtitulo, .pr-capa-texto .pr-selo', { y: 18, opacity: 0, duration: 0.9, stagger: 0.12, delay: 0.55, ease: 'power3.out' });
      }
      gsap.from('.pr-loja-card', { y: 40, opacity: 0, duration: 1, delay: 0.5, ease: 'power3.out' });
      gsap.from('.pr-chip', { y: 20, opacity: 0, duration: 0.7, stagger: 0.05, delay: 0.7, ease: 'back.out(1.6)' });
      if (raiz.current!.querySelector('.pr-capa')) {
        const gatilho = { trigger: capa.current, start: 'top top', end: 'bottom top', scrub: true };
        gsap.to('.pr-capa .fundo', { yPercent: 16, ease: 'none', scrollTrigger: gatilho });
        if (raiz.current!.querySelector('.pr-capa .frente')) gsap.to('.pr-capa .frente', { yPercent: -7, scale: 1.07, ease: 'none', scrollTrigger: gatilho });
        gsap.to('.pr-capa-texto', { y: -70, opacity: 0, ease: 'none', scrollTrigger: { ...gatilho, end: '70% top' } });
      }
    }, raiz);
    const frente = raiz.current.querySelector('.pr-capa .frente');
    const mx = frente ? gsap.quickTo(frente, 'x', { duration: 1.2, ease: 'power3.out' }) : null;
    const my = frente ? gsap.quickTo(frente, 'rotationY', { duration: 1.2, ease: 'power3.out' }) : null;
    const mover = (e: PointerEvent) => {
      if (!mx || !my || window.scrollY > window.innerHeight) return;
      const dx = e.clientX / window.innerWidth - 0.5;
      mx(dx * 26);
      my(dx * 4);
    };
    window.addEventListener('pointermove', mover);
    return () => { window.removeEventListener('pointermove', mover); ctx.revert(); };
  }, [reduzido, secoes.length, abertura]);

  // refeito quando surgem itens novos (busca, abertura carregada)
  useEffect(() => {
    if (reduzido || !raiz.current) return;
    const ctx = gsap.context(() => {
      ScrollTrigger.batch('.pr-revela:not(.revelado)', {
        start: 'top 92%',
        onEnter: (lote) => {
          gsap.to(lote, { opacity: 1, y: 0, duration: 0.8, stagger: 0.07, ease: 'power3.out', overwrite: true });
          lote.forEach((e) => e.classList.add('revelado'));
        },
      });
    }, raiz);
    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, [reduzido, secoes, resultado === null, abertura]);

  useEffect(() => {
    if (!capa.current) return;
    const io = new IntersectionObserver(([e]) => setTopo(!e.isIntersecting), { rootMargin: '-60px 0px 0px 0px' });
    io.observe(capa.current);
    return () => io.disconnect();
  }, [abertura]);

  useEffect(() => {
    const els = secoes.map((s) => document.getElementById(`pr-sec-${s.id}`)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver((ents) => {
      const vis = ents.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setAtiva(vis[0].target.id.replace('pr-sec-', ''));
    }, { rootMargin: '-180px 0px -55% 0px' });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [secoes, resultado]);

  const irPara = (id: string) => {
    setBusca('');
    setAtiva(id);
    requestAnimationFrame(() => {
      const alvo = document.getElementById(`pr-sec-${id}`);
      if (!alvo) return;
      if (lenis.current) lenis.current.scrollTo(alvo, { offset: -160, duration: 1.1 });
      else alvo.scrollIntoView({ behavior: reduzido ? 'auto' : 'smooth' });
    });
  };

  const adicionar = (p: Product, notes: string, qtd: number, addons: any, origem: HTMLElement | null) => {
    onAddToCart(p, notes, qtd, addons);
    setAberto(null);
    setAviso(`${qtd}× ${p.name} na sacola`);
    window.setTimeout(() => setAviso(null), 2400);
    if (reduzido || !origem) return;
    const de = origem.getBoundingClientRect();
    const img = origem.querySelector('img');
    const voo = document.createElement('div');
    voo.className = 'pr-voo';
    Object.assign(voo.style, { left: `${de.left}px`, top: `${de.top}px`, width: `${de.width}px`, height: `${de.height}px` });
    if (img) voo.appendChild(img.cloneNode(true));
    document.body.appendChild(voo);
    requestAnimationFrame(() => {
      const alvo = sacolaBtn.current?.getBoundingClientRect() || { left: window.innerWidth / 2 - 30, top: window.innerHeight - 70, width: 60, height: 40 };
      gsap.to(voo, {
        left: alvo.left + 18, top: alvo.top + 6, width: 44, height: 44, borderRadius: 22, rotate: 12,
        duration: 0.85, ease: 'power3.inOut',
        onComplete: () => {
          voo.remove();
          if (sacolaBtn.current) gsap.fromTo(sacolaBtn.current, { scale: 1 }, { scale: 1.08, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });
        },
      });
    });
  };

  const inclinar = (e: React.PointerEvent<HTMLElement>) => {
    if (reduzido || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    gsap.to(e.currentTarget, { rotateY: x * 12, rotateX: -y * 12, transformPerspective: 700, duration: 0.5, ease: 'power2.out' });
  };
  const soltar = (e: React.PointerEvent<HTMLElement>) => gsap.to(e.currentTarget, { rotateY: 0, rotateX: 0, duration: 0.7, ease: 'elastic.out(1, 0.5)' });

  const trilho = useRef<HTMLDivElement>(null);
  const [banner, setBanner] = useState(0);
  useEffect(() => {
    if (reduzido || banners.length < 2) return;
    let parado = false;
    const t = trilho.current;
    const parar = () => { parado = true; };
    const seguir = () => { parado = false; };
    t?.addEventListener('pointerenter', parar);
    t?.addEventListener('pointerleave', seguir);
    t?.addEventListener('touchstart', parar, { passive: true });
    const id = window.setInterval(() => {
      if (parado || !t) return;
      const r = t.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const prox = (Math.round(t.scrollLeft / (t.firstElementChild as HTMLElement).offsetWidth) + 1) % banners.length;
      t.scrollTo({ left: prox * ((t.firstElementChild as HTMLElement).offsetWidth + 14), behavior: 'smooth' });
    }, 4500);
    return () => { window.clearInterval(id); t?.removeEventListener('pointerenter', parar); t?.removeEventListener('pointerleave', seguir); };
  }, [banners.length, reduzido]);

  const itemDaLista = (p: Product, revela = true) => {
    const foto = fotoDe(p);
    const off = p.available === false;
    const promo = p.originalTotal && p.originalTotal > p.price;
    return (
      <button key={p.id} className={`pr-item ${revela ? 'pr-revela' : ''} ${off ? 'off' : ''}`} onClick={() => setAberto(p)} aria-label={`${p.name}, ${dinheiro(p.price)}`}>
        <div>
          <h3>{p.name}</h3>
          {p.description && <p>{p.description}</p>}
          <span className={`pr-preco ${promo ? 'promo' : ''}`}>
            {dinheiro(p.price)}{promo && <s>{dinheiro(p.originalTotal!)}</s>}
          </span>
        </div>
        <div className="foto">
          <ImagemComBrilho src={foto || ilustracaoDo(p)} ilustra={!foto} w={480} />
          {off ? <span className="pr-tag">Indisponível</span> : isStoreOpen && <span className="pr-mais" aria-hidden><Plus size={20} strokeWidth={3} /></span>}
        </div>
      </button>
    );
  };

  return (
    <div className="prime" ref={raiz} style={{ ['--ac' as any]: cor, ['--ac-ink' as any]: legivelSobre(cor) }}>
      <div className={`pr-topo ${topo ? 'visivel' : ''}`} aria-hidden={!topo}>
        <div className="pr-topo-in">
          {config.logoUrl && <img src={leve(config.logoUrl, 96)} onError={original(config.logoUrl)} alt="" />}
          <b>{nome}</b>
          <span className={`pr-selo ${isStoreOpen ? 'aberto' : ''}`} style={{ marginTop: 0, marginLeft: 'auto', background: 'var(--chip)', color: 'var(--ink)' }}>
            <i />{isStoreOpen ? 'Aberto' : 'Fechado'}
          </span>
          {instalar && <button className="pr-instalar" onClick={instalar}><Download size={16} />Instalar app</button>}
        </div>
      </div>

      {/* sem quadros ou com capa própria no Master, vale a capa em camadas */}
      {!capaPropria && abertura !== false && (
        <div ref={abertura ? capa : undefined}>
          <PrimeAbertura nome={titulo} logo={leve(config.logoUrl, 828) || logoPadrao} logoOriginal={config.logoUrl} aberta={isStoreOpen} horario={horario} cor={cor} redes={redes} fundo="#000000" parede={verdeEscuro} aoPronta={setAbertura} onCardapio={() => secoes[0] && irPara(secoes[0].id)} />
          <div className="pr-degrade" style={{ ['--fundo-site' as string]: '#000000' } as React.CSSProperties} />
        </div>
      )}
      {(capaPropria || abertura === false) && (
      <header className="pr-capa" ref={capa}>
        {capaPropria ? (
          <div className="camada fundo"><img src={leve(capaPropria, 1080)} onError={original(capaPropria)} alt="" /></div>
        ) : (
          <>
            <div className="camada fundo"><img src={celular ? ARTE.capaCelular : ARTE.capa} alt="" /></div>
            <div className="brilho" />
            <div className="camada frente" style={{ zIndex: 2 }}><img src={celular ? ARTE.capaFrenteCelular : ARTE.capaFrente} alt="" /></div>
            {!reduzido && <Vapor />}
          </>
        )}
        <div className="vinheta" />
        <div className="pr-capa-texto">
          {config.logoUrl && <img className="pr-logo" src={leve(config.logoUrl, 480)} onError={original(config.logoUrl)} alt={nome} />}
          <h1 className="pr-titulo">{titulo}</h1>
          {frase && <p className="pr-subtitulo">{frase}</p>}
          <span className={`pr-selo ${isStoreOpen ? 'aberto' : ''}`}><i />{isStoreOpen ? 'Aberto agora' : 'Fechado agora'}{horario ? ` · ${horario}` : ''}</span>
        </div>
      </header>
      )}


      <section className="pr-loja">
        <div className="pr-loja-card">
          {endereco && <span className="pr-info"><MapPin size={17} />{endereco}</span>}
          {horario && <span className="pr-info"><Clock size={17} />{horario}</span>}
          {typeof taxa === 'number' && <span className="pr-info"><Bike size={17} />{taxa > 0 ? `Entrega ${dinheiro(taxa)}` : 'Entrega grátis'}</span>}
          <span className="pr-acoes">
            {whats && <a className="pr-btn-sec" href={`https://wa.me/${whats.length <= 11 ? '55' + whats : whats}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} />WhatsApp</a>}
            {config.instagramUrl && <a className="pr-btn-sec" href={config.instagramUrl} target="_blank" rel="noopener noreferrer"><Instagram size={17} />Instagram</a>}
            {telefone && !whats && <a className="pr-btn-sec" href={`tel:${telefone.replace(/\D/g, '')}`}><Phone size={17} />Ligar</a>}
          </span>
        </div>
      </section>

      {!isStoreOpen && (
        <div className="pr-fechada"><div><Clock size={20} />A loja está fechada agora{horario ? ` — ${horario}` : ''}. Dá pra olhar o cardápio à vontade.</div></div>
      )}

      <div className={`pr-gruda ${topo ? 'com-topo' : ''}`}>
        <div className="pr-busca">
          <label>
            <Search size={19} color="var(--soft)" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar em ${nome}`} aria-label="Buscar no cardápio" />
          </label>
        </div>
        <LayoutGroup>
          <nav className="pr-chips" aria-label="Categorias">
            {secoes.map((s) => (
              <button key={s.id} className={`pr-chip ${ativa === s.id && !resultado ? 'ativo' : ''}`} onClick={() => irPara(s.id)}>
                {ativa === s.id && !resultado && <motion.span layoutId="pr-marca" className="marca" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <span className="bola">{s.ilustracao ? <img src={s.ilustracao} alt="" /> : <span>{s.emoji || '🍽️'}</span>}</span>
                <b>{s.titulo}</b>
              </button>
            ))}
          </nav>
        </LayoutGroup>
      </div>

      <main className="pr-conteudo">
        {resultado ? (
          <section className="pr-secao">
            <div className="pr-secao-cab"><h2>Resultados</h2><small>{resultado.length} {resultado.length === 1 ? 'item' : 'itens'}</small></div>
            {resultado.length ? <div className="pr-lista">{resultado.map((p) => itemDaLista(p, false))}</div> : (
              <div className="pr-vazio"><img src={ARTE.sacola} alt="" /><b>Nada com “{busca}”</b><p>Tente outro nome, ou navegue pelas categorias.</p></div>
            )}
          </section>
        ) : (
          <>
            {banners.length > 0 && (
              <section className="pr-secao pr-revela" style={{ paddingTop: 18 }}>
                <div className="pr-banners" ref={trilho}
                  onScroll={(e) => { const t = e.currentTarget; const w = (t.firstElementChild as HTMLElement)?.offsetWidth || 1; setBanner(Math.round(t.scrollLeft / (w + 14))); }}>
                  {banners.map((b, i) => {
                    const destino = b.alvo ? secoes.find((s) => b.alvo!.test(`${s.id} ${s.titulo}`)) : null;
                    const conteudo = (
                      <>
                        <img src={leve(b.img, 1080)} onError={original(b.img)} alt={b.titulo || `Promoção ${i + 1}`} loading={i ? 'lazy' : 'eager'} />
                        {b.titulo && <div className="txt"><b>{b.titulo}</b><span>{b.acao} →</span></div>}
                      </>
                    );
                    return b.link ? (
                      <a key={i} className="pr-banner" href={b.link} target="_blank" rel="noopener noreferrer">{conteudo}</a>
                    ) : (
                      <button key={i} className="pr-banner" onClick={() => destino && irPara(destino.id)}>{conteudo}</button>
                    );
                  })}
                </div>
                {banners.length > 1 && <div className="pr-pontos">{banners.map((_, i) => <i key={i} className={i === banner ? 'on' : ''} />)}</div>}
              </section>
            )}

            {destaques.length > 0 && (
              <section className="pr-secao">
                <div className="pr-secao-cab pr-revela"><img src={ARTE.destaques} alt="" /><h2>Destaques da casa</h2></div>
                <div className="pr-destaques">
                  {destaques.map((p) => {
                    const foto = fotoDe(p);
                    return (
                      <button key={p.id} className="pr-dcard pr-revela" onClick={() => setAberto(p)} onPointerMove={inclinar} onPointerLeave={soltar}>
                        <div className="foto"><ImagemComBrilho src={foto || ilustracaoDo(p)} ilustra={!foto} w={828} /></div>
                        <div className="corpo"><b>{p.name}</b><span>{dinheiro(p.price)}</span></div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {secoes.map((s) => (
              <section key={s.id} id={`pr-sec-${s.id}`} className="pr-secao">
                <div className="pr-secao-cab pr-revela">
                  {s.ilustracao ? <img src={s.ilustracao} alt="" /> : <span style={{ fontSize: 30 }}>{s.emoji}</span>}
                  <h2>{s.titulo}</h2><small>{s.itens.length} {s.itens.length === 1 ? 'item' : 'itens'}</small>
                </div>
                <div className="pr-lista">{s.itens.map((p) => itemDaLista(p))}</div>
              </section>
            ))}
          </>
        )}
      </main>

      <footer className="pr-rodape" style={{ ['--fundo-site' as string]: verdeEscuro } as React.CSSProperties}>
        <div>
          {typeof taxa === 'number' && <span className="taxa"><Truck size={20} />Taxa de Entrega: <em>{dinheiro(taxa)}</em></span>}
          <img className="logo" src={leve(config.logoUrl, 256) || logoPadrao} onError={original(config.logoUrl)} alt={nome} />
          <b>{nome}</b>
          {endereco && <span className="linha"><MapPin size={15} />{endereco}</span>}
          {horario && <span className="linha"><Clock size={15} />{horario}</span>}
          {telefone && <span className="linha"><Phone size={15} />{telefone}</span>}
          {instalar && <button className="pr-instalar" onClick={instalar}><Download size={16} />Instalar o app {nome}</button>}
          <small>© {new Date().getFullYear()} {nome} · Todos os direitos reservados</small>
        </div>
      </footer>

      {onMeusPedidos && (
        <button className={`pr-meus ${cartCount > 0 ? 'sobe' : ''}`} onClick={onMeusPedidos} aria-label="Meus pedidos" title="Meus pedidos">
          <ClipboardList size={24} />
        </button>
      )}

      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div className="pr-sacola" initial={{ y: 120, x: '-50%' }} animate={{ y: 0, x: '-50%' }} exit={{ y: 120, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
            <button ref={sacolaBtn} onClick={onOpenCart}>
              <ShoppingBag size={20} />
              <motion.span key={cartCount} className="conta" initial={{ scale: 1.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>{cartCount}</motion.span>
              Ver sacola
              <span className="ir">Finalizar <ChevronRight size={18} /></span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {aviso && (
          <motion.div className="pr-aviso" role="status" initial={{ y: -80, x: '-50%', opacity: 0 }} animate={{ y: 0, x: '-50%', opacity: 1 }}
            exit={{ y: -80, x: '-50%', opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 30 }}>
            <img src={ARTE.sacola} alt="" />{aviso}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {aberto && (
          <PrimeSheet key={aberto.id} product={aberto} ilustracao={ilustracaoDo(aberto)} lojaAberta={isStoreOpen}
            onClose={() => setAberto(null)} onAdd={adicionar} />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Imagem com brilho de carregamento (skeleton) e entrada suave. */
function ImagemComBrilho({ src, ilustra, w }: { src: string; ilustra?: boolean; w: 480 | 828 }) {
  const [ok, setOk] = useState(false);
  return (
    <>
      {!ok && <span className="pr-carrega" aria-hidden />}
      <img src={leve(src, w)} alt="" loading="lazy" decoding="async" className={ilustra ? 'ilustra' : ''}
        style={{ opacity: ok ? 1 : 0 }} onLoad={() => setOk(true)}
        onError={(e) => { if (!e.currentTarget.dataset.orig && leve(src, w) !== src) original(src)(e); else setOk(true); }} />
    </>
  );
}

/** Vapor subindo do lanche da capa (canvas leve, pausa fora da tela). */
function Vapor() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    let w = 0, h = 0, raf = 0, visivel = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const medir = () => { w = c.clientWidth; h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
    medir();
    const fios = Array.from({ length: 26 }, () => novo(true));
    function novo(inicio = false) {
      return { x: 0.55 + Math.random() * 0.3, y: inicio ? Math.random() : 1.05, r: 20 + Math.random() * 46, v: 0.0009 + Math.random() * 0.0016,
               o: 0, f: Math.random() * Math.PI * 2 };
    }
    const desenhar = () => {
      raf = requestAnimationFrame(desenhar);
      if (!visivel) return;
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < fios.length; i++) {
        const p = fios[i];
        p.y -= p.v; p.f += 0.012;
        const vida = 1 - Math.abs(p.y - 0.55) / 0.55;
        p.o = Math.max(0, Math.min(0.13, vida * 0.13));
        const x = (p.x + Math.sin(p.f) * 0.015) * w, y = p.y * h * 0.75 + h * 0.08;
        const grad = g.createRadialGradient(x, y, 0, x, y, p.r * (1.6 - p.y * 0.6));
        grad.addColorStop(0, `rgba(255,255,255,${p.o})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.beginPath(); g.arc(x, y, p.r * (1.6 - p.y * 0.6), 0, Math.PI * 2); g.fill();
        if (p.y < -0.05) fios[i] = novo();
      }
    };
    desenhar();
    const io = new IntersectionObserver(([e]) => { visivel = e.isIntersecting; });
    io.observe(c);
    window.addEventListener('resize', medir);
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener('resize', medir); };
  }, []);
  return <canvas ref={ref} className="pr-vapor" aria-hidden style={{ width: '100%', height: '100%' }} />;
}
