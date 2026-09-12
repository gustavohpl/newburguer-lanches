import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ShoppingBag, ArrowRight, ArrowDown, Plus, Minus, Check, Clock, MapPin, ShieldCheck } from 'lucide-react';
import type { Product } from '../../App';
import { useConfig } from '../../ConfigContext';
import { useFranchise } from '../../FranchiseContext';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import * as api from '../../utils/api';

// ============================================================
// 🔥 PRIME — cinematográfico / HUD (fiel à referência docmo.agency)
// ------------------------------------------------------------
// Fotos de ponta a ponta dentro de uma moldura de cantoneiras,
// réguas de marcação, rótulos mono e tipografia condensada.
// Seções: // 01 THE STACK (hero) · // 02 THE SEAR (contador de
// temperatura preso ao scroll) · // 03 THE LINE-UP (cardápio) ·
// // 04 BUILD YOUR PRIME (montador com adicionais reais).
// Imagens vêm do Master (primeHeroUrl, primeSearUrl...). A cor de
// destaque vem de config.themeColor.
// ============================================================

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

interface PrimeLayoutProps {
  products: Product[];
  onAddToCart: (product: Product, notes?: string, quantity?: number, selectedAddons?: Array<{ id: string; name: string; price: number }>) => void;
  cartCount: number;
  onOpenCart: () => void;
  isStoreOpen: boolean;
}

const BG = '#0a0a0b';
const PANEL = '#111113';
const LINE = 'rgba(255,255,255,0.09)';

const money = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
const pad = (n: number) => String(n).padStart(2, '0');
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// Texto legível sobre a cor de destaque (tema claro ou escuro)
function readableOn(hex: string) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return '#0a0a0b';
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? '#0a0a0b' : '#ffffff';
}

const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

export function PrimeLayout({ products, onAddToCart, cartCount, onOpenCart, isStoreOpen }: PrimeLayoutProps) {
  const { config } = useConfig();
  const cfg = config as any;
  const { unitOverrides } = useFranchise();
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [scrolled, setScrolled] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [currentCategory, setCurrentCategory] = useState<string | null>(null);
  const [builderBaseId, setBuilderBaseId] = useState<string | null>(null);

  const accent = config.themeColor || '#e8c547';
  const onAccent = readableOn(accent);
  const logo = config.logoUrl;
  const siteName = config.siteName || 'Ranch Hamburgueria';
  const heroTitle = (cfg.primeHeroTitle || siteName.split(' ')[0] || 'Prime').toUpperCase();
  const heroTagline = cfg.primeHeroTagline || 'The Stack';
  const subtitle = config.siteSubtitle || 'Camadas selecionadas, ponto certo, montado na hora.';

  const effectiveAddress = unitOverrides.address || config.address || '';
  const effectiveHours = unitOverrides.openingHours || config.openingHours || '';
  const whatsappNumber = (config.whatsappNumber || '5564993392970').replace(/\D/g, '');

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const response = await api.getCategories();
        if (response.success) {
          setCategories(response.categories.filter((cat: any) => {
            const id = (cat.id || '').toLowerCase();
            const label = (cat.label || '').toLowerCase();
            const isPromo = id === 'promocoes' || id.includes('promo') || label.includes('promo');
            const isBest = id === 'mais-pedidos' || label.includes('mais pedidos') || label.includes('mais vendidos');
            return !isPromo && !isBest;
          }));
        }
      } catch (e) {
        console.error('Erro ao carregar categorias (prime)', e);
      }
    })();
  }, []);

  const available = useMemo(() => products.filter((p) => p.available !== false), [products]);

  const bestSellers = useMemo(() => {
    const popular = cfg.popularProducts as Array<{ productId: string; count: number }> | undefined;
    const hidden = (cfg.hiddenBestSellers as string[]) || [];
    if (!popular || popular.length === 0) return available.slice(0, 8);
    return popular
      .filter((pp) => !hidden.includes(pp.productId))
      .map((pp) => available.find((p) => p.id === pp.productId))
      .filter((p): p is Product => p !== undefined)
      .slice(0, 8);
  }, [available, cfg.popularProducts, cfg.hiddenBestSellers]);

  const displayedProducts = useMemo(() => {
    if (currentCategory === null) return bestSellers;
    return available.filter((p) => p.category === currentCategory);
  }, [currentCategory, available, bestSellers]);

  // Bases do montador: quem tem adicionais; senão categorias de lanche; senão tudo
  const builderBases = useMemo(() => {
    const withAddons = available.filter((p) => (p.addons || []).length > 0);
    if (withAddons.length > 0) return withAddons;
    const burgerCats = categories
      .filter((c) => /burg|lanche|hamb|smash|sandu/i.test(`${c.id} ${c.label}`))
      .map((c) => c.id);
    const burgers = available.filter((p) => burgerCats.includes(p.category));
    return burgers.length > 0 ? burgers : available;
  }, [available, categories]);

  const heroImage = (isMobile && cfg.primeHeroMobileUrl) || cfg.primeHeroUrl || cfg.contentBackgroundUrl || '';
  const heroFallbackProduct = useMemo(
    () => [...available].filter((p) => p.imageUrl || p.image).sort((a, b) => b.price - a.price)[0],
    [available]
  );

  const openInBuilder = (product: Product) => {
    setBuilderBaseId(product.id);
    scrollToId('prime-build');
  };

  const nav = [
    { id: 'prime-top', label: 'Início' },
    { id: 'prime-sear', label: 'A chapa' },
    { id: 'prime-menu', label: 'Cardápio' },
    { id: 'prime-build', label: 'Monte o seu' },
  ];

  return (
    <div
      className="prime-root min-h-screen flex flex-col relative"
      style={{ backgroundColor: BG, color: '#ecebe6', overflowX: 'clip', ['--p-accent' as any]: accent }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .prime-root { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        .p-display { font-family: 'Barlow Condensed', 'Oswald', 'Arial Narrow', sans-serif; font-weight: 700; letter-spacing: -0.01em; line-height: .88; text-transform: uppercase; }
        .p-mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace; text-transform: uppercase; letter-spacing: .14em; }
        .p-ruler { background-image:
            repeating-linear-gradient(90deg, rgba(255,255,255,.55) 0 1px, transparent 1px 80px),
            repeating-linear-gradient(90deg, rgba(255,255,255,.22) 0 1px, transparent 1px 8px);
          background-size: 100% 100%, 100% 45%; background-repeat: no-repeat; background-position: bottom, bottom; }
        .p-vruler { background-image:
            repeating-linear-gradient(180deg, rgba(255,255,255,.5) 0 1px, transparent 1px 60px),
            repeating-linear-gradient(180deg, rgba(255,255,255,.2) 0 1px, transparent 1px 10px);
          background-size: 100% 100%, 45% 100%; background-repeat: no-repeat; background-position: right, right; }
        @keyframes pRise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
        @keyframes pZoom { from { transform: scale(1.12); } to { transform: scale(1.02); } }
        @keyframes pScrollDot { 0% { transform: translateY(0); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(18px); opacity: 0; } }
        @keyframes pEmber { 0% { transform: translate3d(0, 0, 0) scale(1); opacity: 0; } 15% { opacity: 1; } 100% { transform: translate3d(var(--dx), -70vh, 0) scale(.3); opacity: 0; } }
        @keyframes pSmoke { 0% { transform: translate(-50%, 0) scale(.8); opacity: 0; } 35% { opacity: .55; } 100% { transform: translate(-50%, -140px) scale(1.8); opacity: 0; } }
        @keyframes pFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes pSpin { to { transform: rotateX(72deg) rotateZ(360deg); } }
        @keyframes pBlink { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
        .p-rise { animation: pRise 1s cubic-bezier(.16,1,.3,1) both; }
        .p-card .p-corners > span { opacity: 0; transition: opacity .3s; }
        .p-card:hover .p-corners > span { opacity: 1; }
        .p-noscroll::-webkit-scrollbar { display: none; }
        .p-noscroll { scrollbar-width: none; }
        @media (prefers-reduced-motion: reduce) { .prime-root *, .prime-root *::before, .prime-root *::after { animation: none !important; transition: none !important; } }
      `}</style>

      {/* ============ HEADER ============ */}
      <header
        className="fixed top-0 inset-x-0 z-40 transition-colors duration-300"
        style={{
          backgroundColor: scrolled ? 'rgba(10,10,11,0.86)' : 'transparent',
          backdropFilter: scrolled ? 'blur(14px)' : 'none',
          borderBottom: `1px solid ${scrolled ? LINE : 'transparent'}`,
        }}
      >
        <div className="mx-auto max-w-[1400px] px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <button onClick={() => scrollToId('prime-top')} className="flex items-center gap-3 min-w-0" aria-label="Topo">
            {logo ? (
              <img src={logo} alt={siteName} className="h-8 w-auto object-contain" />
            ) : (
              <span className="p-display text-2xl text-white">{heroTitle}</span>
            )}
            <span className="hidden sm:flex flex-col items-start leading-tight">
              <span className="p-mono text-[10px] text-white/80 truncate max-w-[180px]">{siteName}</span>
              <span className="p-mono text-[9px] text-white/35">// Burger lab</span>
            </span>
          </button>

          <nav className="hidden lg:flex items-center gap-8">
            {nav.map((n, i) => (
              <button key={n.id} onClick={() => scrollToId(n.id)} className="p-mono text-[11px] text-white/55 hover:text-white transition-colors">
                <span style={{ color: accent }}>{pad(i + 1)}.</span> {n.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden md:flex items-center gap-2 p-mono text-[10px] text-white/55">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isStoreOpen ? '#4ade80' : '#f87171', animation: 'pBlink 2s infinite' }} />
              {isStoreOpen ? 'Aberto' : 'Fechado'}
            </span>
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 flex items-center justify-center border text-white/70 hover:text-white transition-colors"
              style={{ borderColor: LINE }}
              aria-label="WhatsApp"
            >
              <WhatsAppIcon className="w-4 h-4" />
            </a>
            <button
              onClick={onOpenCart}
              className="h-9 px-3 sm:px-4 flex items-center gap-2 p-mono text-[11px] font-bold transition-all hover:brightness-110"
              style={{ backgroundColor: accent, color: onAccent }}
              aria-label="Carrinho"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Pedido</span>
              <span>[{pad(cartCount)}]</span>
            </button>
          </div>
        </div>
      </header>

      {/* ============ // 01 THE STACK — hero de tela cheia ============ */}
      <section id="prime-top" className="relative h-[100svh] min-h-[600px] overflow-hidden">
        <div className="absolute inset-0" style={{ animation: 'pZoom 2.4s cubic-bezier(.16,1,.3,1) both' }}>
          {heroImage ? (
            <img src={heroImage} alt={siteName} className="w-full h-full object-cover" style={{ objectPosition: isMobile ? '60% center' : 'center' }} />
          ) : heroFallbackProduct ? (
            <ImageWithFallback src={heroFallbackProduct.imageUrl || heroFallbackProduct.image || ''} alt={heroFallbackProduct.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: `radial-gradient(ellipse at 65% 55%, ${accent}55, transparent 55%), ${BG}` }} />
          )}
        </div>
        {/* escurecimento para leitura + vinheta */}
        <div
          className="absolute inset-0"
          style={{
            background: isMobile
              ? 'linear-gradient(180deg, rgba(10,10,11,.35) 0%, rgba(10,10,11,.72) 30%, rgba(10,10,11,.78) 75%)'
              : 'linear-gradient(90deg, rgba(10,10,11,.88) 0%, rgba(10,10,11,.45) 38%, rgba(10,10,11,0) 65%)',
          }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,10,11,.55) 0%, transparent 22%, transparent 70%, rgba(10,10,11,1) 100%)' }} />

        {/* moldura HUD */}
        <div className="absolute left-3 right-3 sm:left-8 sm:right-8 top-20 bottom-6 sm:bottom-8 pointer-events-none">
          <Corners color="rgba(255,255,255,.7)" size={22} />
          <div className="absolute top-3 left-4 p-mono text-[10px] text-white/60 hidden sm:block">{siteName} // Est. na chapa</div>
          <div className="absolute top-3 right-4 p-mono text-[10px] text-white/60 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isStoreOpen ? '#4ade80' : '#f87171' }} />
            {isStoreOpen ? 'Recebendo pedidos' : 'Fechado agora'}
          </div>
          <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 w-3 h-[38%] p-vruler" />
          <div className="absolute left-4 right-4 bottom-3 h-3 p-ruler opacity-80" />
        </div>

        {/* título */}
        <div className="relative z-10 h-full mx-auto max-w-[1400px] px-7 sm:px-16 flex flex-col justify-center">
          <div className="max-w-2xl">
            <p className="p-mono text-[10px] sm:text-[11px] text-white/60 mb-5 p-rise flex items-center gap-3">
              <span style={{ color: accent }}>// 01</span>
              <span className="h-px w-10 bg-white/30" />
              {heroTagline}
            </p>
            <h1 className="p-display text-white p-rise" style={{ fontSize: 'clamp(4rem, 14vw, 10.5rem)', animationDelay: '.08s' }}>
              {heroTitle}
            </h1>
            <p className="p-display p-rise mt-1" style={{ fontSize: 'clamp(2rem, 6.4vw, 4.8rem)', animationDelay: '.16s' }}>
              <span style={{ color: accent }}>//</span> <span className="text-white">{heroTagline}</span>
            </p>
            <p className="mt-6 text-white/65 text-sm sm:text-base max-w-md leading-relaxed p-rise" style={{ animationDelay: '.24s' }}>
              {subtitle}
            </p>
            <div className="mt-8 flex flex-wrap gap-3 p-rise" style={{ animationDelay: '.32s' }}>
              <button
                onClick={() => scrollToId('prime-build')}
                className="group h-12 px-6 flex items-center gap-3 p-mono text-[12px] font-bold transition-all hover:brightness-110"
                style={{ backgroundColor: accent, color: onAccent }}
              >
                Montar meu pedido
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => scrollToId('prime-menu')}
                className="h-12 px-6 flex items-center p-mono text-[12px] font-bold text-white border backdrop-blur-sm hover:bg-white/10 transition-colors"
                style={{ borderColor: 'rgba(255,255,255,.35)' }}
              >
                Ver cardápio
              </button>
            </div>
          </div>
        </div>

        {/* indicador de scroll */}
        <button
          onClick={() => scrollToId('prime-sear')}
          className="absolute z-10 bottom-10 sm:bottom-14 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          aria-label="Rolar"
        >
          <span className="w-6 h-10 rounded-full border border-white/40 flex justify-center pt-2">
            <span className="w-1 h-1.5 rounded-full bg-white" style={{ animation: 'pScrollDot 1.8s infinite' }} />
          </span>
          <span className="p-mono text-[9px] text-white/50">Scroll</span>
        </button>
      </section>

      {/* ============ // 02 THE SEAR — contador preso ao scroll ============ */}
      <PrimeSear
        image={(isMobile && cfg.primeSearMobileUrl) || cfg.primeSearUrl || ''}
        title={cfg.primeSearTitle || 'Selado na chapa'}
        accent={accent}
      />

      {/* ============ // 03 THE LINE-UP — cardápio ============ */}
      <section id="prime-menu" className="relative mx-auto w-full max-w-[1400px] px-4 sm:px-8 pt-24 pb-16">
        <SectionHead index="03" name="The Line-Up" title="O cardápio" accent={accent} aside={`${pad(displayedProducts.length)} itens`} />

        <div className="flex gap-6 overflow-x-auto p-noscroll border-b mb-8 -mx-4 px-4 sm:mx-0 sm:px-0" style={{ borderColor: LINE }}>
          {[{ id: null as string | null, label: 'Mais pedidos' }, ...categories.map((c) => ({ id: c.id as string | null, label: c.label as string }))].map((c, i) => {
            const active = currentCategory === c.id;
            return (
              <button
                key={c.id ?? 'best'}
                onClick={() => setCurrentCategory(c.id)}
                className="relative pb-3 shrink-0 p-mono text-[11px] transition-colors whitespace-nowrap"
                style={{ color: active ? '#fff' : 'rgba(255,255,255,.42)' }}
              >
                <span style={{ color: active ? accent : 'rgba(255,255,255,.28)' }}>{pad(i)}</span> {c.label}
                <span className="absolute left-0 -bottom-px h-[2px] transition-all duration-300" style={{ width: active ? '100%' : '0%', backgroundColor: accent }} />
              </button>
            );
          })}
        </div>

        {displayedProducts.length === 0 ? (
          <p className="p-mono text-[11px] text-white/40 py-16 text-center">// Nenhum produto nesta categoria</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ borderTop: `1px solid ${LINE}`, borderLeft: `1px solid ${LINE}` }}>
            {displayedProducts.map((product, idx) => {
              const img = product.imageUrl || product.image;
              const hasAddons = (product.addons || []).length > 0;
              return (
                <article key={product.id} className="p-card group relative flex flex-col" style={{ backgroundColor: BG, borderRight: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
                  <div className="relative aspect-[4/3] overflow-hidden" style={{ backgroundColor: PANEL }}>
                    {img ? (
                      <ImageWithFallback src={img} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl" style={{ background: `radial-gradient(circle, ${accent}22, transparent 70%)` }}>🍔</div>
                    )}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,10,11,.35), transparent 30%, transparent 60%, rgba(10,10,11,.7))' }} />
                    <div className="p-corners absolute inset-3 pointer-events-none"><Corners color={accent} size={14} /></div>
                    <span className="absolute top-4 left-4 p-mono text-[10px] text-white/80">{pad(idx + 1)}</span>
                    {hasAddons && <span className="absolute top-4 right-4 p-mono text-[9px] px-1.5 py-0.5" style={{ backgroundColor: accent, color: onAccent }}>+ Adicionais</span>}
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="p-display text-white text-[26px]">{product.name}</h3>
                    {product.description && <p className="text-white/45 text-[13px] mt-2 leading-snug line-clamp-2">{product.description}</p>}
                    <div className="mt-auto pt-5 flex items-end justify-between gap-3">
                      <span className="p-display text-[28px]" style={{ color: accent }}>{money(product.price)}</span>
                      <button
                        onClick={() => (hasAddons ? openInBuilder(product) : onAddToCart(product))}
                        disabled={!isStoreOpen}
                        className="h-9 px-3 flex items-center gap-1.5 p-mono text-[10px] font-bold border transition-all disabled:opacity-35 disabled:cursor-not-allowed enabled:hover:brightness-110"
                        style={{ backgroundColor: accent, borderColor: accent, color: onAccent }}
                      >
                        {!isStoreOpen ? 'Fechado' : hasAddons ? 'Montar' : 'Adicionar'}
                        {isStoreOpen && (hasAddons ? <ArrowDown className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />)}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ============ // 04 BUILD YOUR PRIME — montador ============ */}
      <PrimeBuilder
        bases={builderBases}
        baseId={builderBaseId}
        onBaseChange={setBuilderBaseId}
        fallbackImage={cfg.primeBuilderUrl || ''}
        accent={accent}
        onAccent={onAccent}
        isStoreOpen={isStoreOpen}
        onAddToCart={onAddToCart}
        onOpenCart={onOpenCart}
      />

      {/* ============ RODAPÉ HUD ============ */}
      <footer className="mt-10 border-t" style={{ borderColor: LINE }}>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-8 grid grid-cols-1 md:grid-cols-3 gap-px" style={{ backgroundColor: LINE }}>
          {[
            { icon: <Clock className="w-4 h-4" />, k: 'Horário', v: effectiveHours || 'Consulte' },
            { icon: <MapPin className="w-4 h-4" />, k: 'Retirada / entrega', v: effectiveAddress || 'Consulte' },
            { icon: <ShieldCheck className="w-4 h-4" />, k: 'Pagamento', v: 'Pix ou cartão' },
          ].map((f) => (
            <div key={f.k} className="py-7 px-2 md:px-6 flex gap-4" style={{ backgroundColor: BG }}>
              <span style={{ color: accent }} className="mt-0.5">{f.icon}</span>
              <div>
                <p className="p-mono text-[10px] text-white/40">{f.k}</p>
                <p className="text-white/80 text-sm mt-1.5 leading-snug">{f.v}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t" style={{ borderColor: LINE }}>
          <div className="mx-auto max-w-[1400px] px-4 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="p-display text-2xl text-white">{heroTitle} <span style={{ color: accent }}>//</span> <span className="text-white/50">{heroTagline}</span></span>
            <span className="p-mono text-[10px] text-white/35">© {new Date().getFullYear()} {siteName} — Todos os direitos reservados</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ------------------------------------------------------------
// Cantoneiras HUD (quatro "L" nos cantos do pai posicionado)
// ------------------------------------------------------------
function Corners({ color, size = 18, weight = 1.5 }: { color: string; size?: number; weight?: number }) {
  const base: React.CSSProperties = { position: 'absolute', width: size, height: size, borderColor: color, borderStyle: 'solid' };
  return (
    <>
      <span style={{ ...base, top: 0, left: 0, borderWidth: `${weight}px 0 0 ${weight}px` }} />
      <span style={{ ...base, top: 0, right: 0, borderWidth: `${weight}px ${weight}px 0 0` }} />
      <span style={{ ...base, bottom: 0, left: 0, borderWidth: `0 0 ${weight}px ${weight}px` }} />
      <span style={{ ...base, bottom: 0, right: 0, borderWidth: `0 ${weight}px ${weight}px 0` }} />
    </>
  );
}

function SectionHead({ index, name, title, accent, aside }: { index: string; name: string; title: string; accent: string; aside?: string }) {
  return (
    <div className="mb-10">
      <p className="p-mono text-[11px] text-white/55 flex items-center gap-3">
        <span style={{ color: accent }}>// {index}.</span> {name}
        <span className="h-px flex-1" style={{ backgroundColor: LINE }} />
        {aside && <span className="text-white/35">{aside}</span>}
      </p>
      <h2 className="p-display text-white mt-4" style={{ fontSize: 'clamp(2.8rem, 8vw, 5.5rem)' }}>{title}</h2>
    </div>
  );
}

// ------------------------------------------------------------
// // 02 THE SEAR — foto presa na tela, temperatura sobe com o scroll
// ------------------------------------------------------------
const SEAR_TARGET = 230;
const SEAR_PHASES = [
  { at: 0, k: 'Pré-aquecimento', d: 'A chapa de ferro sobe de temperatura' },
  { at: 0.3, k: 'Selagem', d: 'A carne encosta e a crosta começa' },
  { at: 0.6, k: 'Maillard', d: 'Crosta dourada, sabor tostado' },
  { at: 0.88, k: 'Ponto', d: 'Suculento por dentro, pronto pra montar' },
];

function PrimeSear({ image, title, accent }: { image: string; title: string; accent: string }) {
  const ref = useRef<HTMLElement>(null);
  const [p, setP] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      const next = total > 0 ? clamp(-rect.top / total) : 0;
      setP((prev) => (Math.abs(prev - next) > 0.002 ? next : prev));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const temp = Math.round(p * SEAR_TARGET);
  const phaseIdx = SEAR_PHASES.reduce((acc, ph, i) => (p >= ph.at ? i : acc), 0);
  const heat = clamp((p - 0.15) / 0.85);

  const embers = useMemo(
    () => Array.from({ length: 18 }, (_, i) => ({
      left: `${(i * 53) % 100}%`,
      dx: `${((i * 37) % 60) - 30}px`,
      dur: 3.5 + ((i * 7) % 30) / 10,
      delay: ((i * 13) % 40) / 10,
      size: 2 + ((i * 3) % 3),
    })),
    []
  );

  return (
    <section ref={ref} id="prime-sear" className="relative" style={{ height: '260vh' }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {/* foto (ou chapa desenhada quando não há imagem) */}
        <div
          className="absolute inset-0 will-change-transform"
          style={{ transform: `scale(${1.14 - p * 0.12})`, filter: `brightness(${0.42 + heat * 0.55}) saturate(${0.7 + heat * 0.5})` }}
        >
          {image ? (
            <img src={image} alt="" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: `radial-gradient(ellipse at 50% 72%, #ff7a18 0%, #b83a0b 22%, #2a0f06 48%, ${BG} 75%)`,
                backgroundColor: BG,
              }}
            >
              <div className="absolute inset-x-0 bottom-0 h-[62%]" style={{ backgroundImage: 'repeating-linear-gradient(100deg, rgba(0,0,0,.85) 0 14px, rgba(40,20,10,.15) 14px 34px)', transform: 'perspective(600px) rotateX(55deg)', transformOrigin: 'bottom' }} />
            </div>
          )}
        </div>
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(10,10,11,.85) 0%, rgba(10,10,11,.1) 30%, rgba(10,10,11,.2) 65%, rgba(10,10,11,.95) 100%)` }} />
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: heat * 0.55, background: `radial-gradient(ellipse at 50% 100%, ${accent}66, transparent 60%)`, mixBlendMode: 'screen' }} />

        {/* brasas */}
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: heat }}>
          {embers.map((e, i) => (
            <span
              key={i}
              className="absolute bottom-0 rounded-full"
              style={{
                left: e.left, width: e.size, height: e.size,
                background: i % 3 === 0 ? accent : '#ffb347',
                boxShadow: `0 0 8px ${i % 3 === 0 ? accent : '#ff8a00'}`,
                ['--dx' as any]: e.dx,
                animation: `pEmber ${e.dur}s linear ${e.delay}s infinite`,
              }}
            />
          ))}
        </div>

        {/* moldura */}
        <div className="absolute left-3 right-3 sm:left-8 sm:right-8 top-20 bottom-6 sm:bottom-8 pointer-events-none">
          <Corners color="rgba(255,255,255,.6)" size={22} />
          <div className="absolute left-4 right-4 bottom-3 h-3 p-ruler opacity-70" />
        </div>

        {/* fases (topo) */}
        <div className="absolute top-24 sm:top-28 left-7 right-7 sm:left-16 sm:right-16 grid grid-cols-1 md:grid-cols-4 gap-6">
          {SEAR_PHASES.map((ph, i) => {
            const active = i === phaseIdx;
            const done = i < phaseIdx;
            return (
              <div
                key={ph.k}
                className={`transition-opacity duration-500 ${active ? '' : 'hidden md:block'}`}
                style={{ opacity: active ? 1 : done ? 0.55 : 0.28 }}
              >
                <p className="p-mono text-[10px]" style={{ color: active ? accent : 'rgba(255,255,255,.6)' }}>{pad(i + 1)} // {ph.k}</p>
                <p className="text-white/75 text-xs mt-1.5 max-w-[220px] leading-snug">{ph.d}</p>
              </div>
            );
          })}
        </div>

        {/* título (base esquerda) */}
        <div className="absolute left-7 right-7 sm:right-auto sm:left-16 bottom-32 sm:bottom-20 sm:max-w-[60%]">
          <p className="p-mono text-[11px] text-white/60"><span style={{ color: accent }}>// 02.</span> The Sear</p>
          <h2 className="p-display text-white mt-3" style={{ fontSize: 'clamp(2.6rem, 8vw, 6rem)' }}>{title}</h2>
        </div>

        {/* contador + barra (direita) */}
        <div className="absolute right-7 sm:right-16 top-1/2 -translate-y-1/2 flex items-center gap-4 sm:gap-6">
          <div className="text-right">
            <p className="p-mono text-[10px] text-white/50">Temp. da chapa</p>
            <p className="p-display text-white tabular-nums" style={{ fontSize: 'clamp(4.5rem, 13vw, 9rem)', fontWeight: 300, lineHeight: 1 }}>
              {temp}
            </p>
            <p className="p-mono text-[12px]" style={{ color: accent }}>°C / {SEAR_TARGET}</p>
          </div>
          <div className="relative h-[36vh] w-[3px]" style={{ backgroundColor: 'rgba(255,255,255,.15)' }}>
            <div className="absolute bottom-0 inset-x-0" style={{ height: `${p * 100}%`, backgroundColor: accent, boxShadow: `0 0 14px ${accent}` }} />
            {[0, 0.5, 1].map((t) => (
              <span key={t} className="absolute left-3 p-mono text-[9px] text-white/40 -translate-y-1/2" style={{ bottom: `${t * 100}%`, transform: 'translateY(50%)' }}>
                {Math.round(t * SEAR_TARGET)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------
// // 04 BUILD YOUR PRIME — base + adicionais reais -> carrinho
// ------------------------------------------------------------
function PrimeBuilder({
  bases, baseId, onBaseChange, fallbackImage, accent, onAccent, isStoreOpen, onAddToCart, onOpenCart,
}: {
  bases: Product[];
  baseId: string | null;
  onBaseChange: (id: string) => void;
  fallbackImage: string;
  accent: string;
  onAccent: string;
  isStoreOpen: boolean;
  onAddToCart: PrimeLayoutProps['onAddToCart'];
  onOpenCart: () => void;
}) {
  const base = bases.find((b) => b.id === baseId) || bases[0];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [added, setAdded] = useState(false);

  // adicionais são por produto: troca de base zera a escolha
  useEffect(() => { setSelected(new Set()); setQty(1); setNotes(''); }, [base?.id]);
  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 2200);
    return () => clearTimeout(t);
  }, [added]);

  if (!base) return null;

  const addons = base.addons || [];
  const chosen = addons.filter((a) => selected.has(a.id));
  const unit = base.price + chosen.reduce((s, a) => s + a.price, 0);
  const total = unit * qty;
  const img = base.imageUrl || base.image || fallbackImage;

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const add = () => {
    onAddToCart(base, notes.trim() || undefined, qty, chosen.map((a) => ({ id: a.id, name: a.name, price: a.price })));
    setAdded(true);
  };

  return (
    <section id="prime-build" className="relative mx-auto w-full max-w-[1400px] px-4 sm:px-8 pt-16 pb-20">
      <SectionHead index="04" name="Build Your Prime" title="Monte do seu jeito" accent={accent} />

      <div className="grid lg:grid-cols-[1.05fr_1fr] gap-8 lg:gap-12 items-start">
        {/* passos */}
        <div className="flex flex-col gap-10 min-w-0">
          <div>
            <p className="p-mono text-[10px] text-white/50 mb-4"><span style={{ color: accent }}>Step 1</span> — Escolha a base</p>
            <div className="flex gap-3 overflow-x-auto p-noscroll pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              {bases.map((b) => {
                const active = b.id === base.id;
                const bImg = b.imageUrl || b.image;
                return (
                  <button
                    key={b.id}
                    onClick={() => onBaseChange(b.id)}
                    className="relative shrink-0 w-[132px] text-left border transition-colors"
                    style={{ borderColor: active ? accent : LINE, backgroundColor: active ? `${accent}14` : PANEL }}
                  >
                    <div className="aspect-square overflow-hidden" style={{ backgroundColor: BG }}>
                      {bImg ? <ImageWithFallback src={bImg} alt={b.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl">🍔</div>}
                    </div>
                    <div className="p-2.5">
                      <p className="p-display text-[17px] text-white line-clamp-2" style={{ lineHeight: 1 }}>{b.name}</p>
                      <p className="p-mono text-[10px] mt-1.5" style={{ color: active ? accent : 'rgba(255,255,255,.45)' }}>{money(b.price)}</p>
                    </div>
                    {active && <span className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center" style={{ backgroundColor: accent, color: onAccent }}><Check className="w-3.5 h-3.5" /></span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="p-mono text-[10px] text-white/50 mb-4"><span style={{ color: accent }}>Step 2</span> — Adicionais</p>
            {addons.length === 0 ? (
              <p className="p-mono text-[10px] text-white/35 border px-4 py-5" style={{ borderColor: LINE }}>// Esta base não tem adicionais</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ borderTop: `1px solid ${LINE}`, borderLeft: `1px solid ${LINE}` }}>
                {addons.map((a) => {
                  const on = selected.has(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggle(a.id)}
                      className="flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
                      style={{ backgroundColor: on ? `${accent}14` : BG, borderRight: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}
                    >
                      <span className="w-4 h-4 shrink-0 border flex items-center justify-center" style={{ borderColor: on ? accent : 'rgba(255,255,255,.3)', backgroundColor: on ? accent : 'transparent', color: onAccent }}>
                        {on && <Check className="w-3 h-3" />}
                      </span>
                      <span className="flex-1 text-sm text-white/85 leading-tight">{a.name}</span>
                      <span className="p-mono text-[10px]" style={{ color: on ? accent : 'rgba(255,255,255,.45)' }}>
                        {a.price === 0 ? 'Grátis' : `+${money(a.price)}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-[1fr_auto] gap-6 items-end">
            <label className="block">
              <span className="p-mono text-[10px] text-white/50"><span style={{ color: accent }}>Step 3</span> — Observação</span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: sem cebola, ponto mais passado…"
                className="mt-3 w-full bg-transparent border-b py-2.5 text-sm text-white placeholder:text-white/25 outline-none transition-colors"
                style={{ borderColor: 'rgba(255,255,255,.2)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,.2)')}
              />
            </label>
            <div>
              <span className="p-mono text-[10px] text-white/50">Qtd.</span>
              <div className="mt-3 flex items-center border" style={{ borderColor: LINE }}>
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white" aria-label="Menos"><Minus className="w-4 h-4" /></button>
                <span className="w-10 text-center p-mono text-sm text-white">{pad(qty)}</span>
                <button onClick={() => setQty((q) => Math.min(99, q + 1))} className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white" aria-label="Mais"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        </div>

        {/* prévia com holofote + resumo */}
        <div className="lg:sticky lg:top-24">
          <div className="relative overflow-hidden border" style={{ borderColor: LINE, background: `radial-gradient(ellipse at 50% 0%, #1b1a1f, ${BG} 70%)` }}>
            <div className="relative aspect-[5/4]">
              {/* feixe de luz */}
              <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[70%] h-full pointer-events-none" style={{ background: `linear-gradient(180deg, rgba(255,250,235,.28), ${accent}10 55%, transparent 80%)`, clipPath: 'polygon(38% 0, 62% 0, 100% 100%, 0 100%)', filter: 'blur(6px)' }} />
              {/* pedestal */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-[13%] w-[58%] h-[12%] rounded-[50%]" style={{ background: `radial-gradient(ellipse, ${accent}88, ${accent}22 55%, transparent 72%)`, filter: 'blur(4px)' }} />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-[15%] w-[46%] h-[9%] rounded-[50%] border-2" style={{ borderColor: accent, boxShadow: `0 0 28px ${accent}, inset 0 0 18px ${accent}66` }} />
              {/* fumaça */}
              {[0, 1, 2].map((i) => (
                <span key={i} className="absolute rounded-full pointer-events-none" style={{ left: `${36 + i * 14}%`, bottom: '26%', width: 90, height: 90, background: 'radial-gradient(circle, rgba(255,255,255,.16), transparent 70%)', filter: 'blur(10px)', animation: `pSmoke ${5 + i}s ease-out ${i * 1.4}s infinite` }} />
              ))}
              {/* produto */}
              <div key={base.id} className="absolute inset-x-0 top-[10%] bottom-[20%] flex items-center justify-center p-rise">
                <div className="h-full aspect-square max-w-[62%]" style={{ animation: 'pFloat 5s ease-in-out infinite' }}>
                  {img ? (
                    <ImageWithFallback
                      src={img}
                      alt={base.name}
                      className="w-full h-full object-cover"
                      style={{
                        WebkitMaskImage: 'radial-gradient(circle at 50% 50%, #000 42%, transparent 70%)',
                        maskImage: 'radial-gradient(circle at 50% 50%, #000 42%, transparent 70%)',
                        filter: 'contrast(1.08) saturate(1.1) brightness(.95)',
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-8xl">🍔</div>
                  )}
                </div>
              </div>
              <div className="absolute inset-4 pointer-events-none"><Corners color="rgba(255,255,255,.55)" size={16} /></div>
              <span className="absolute top-6 left-7 p-mono text-[10px] text-white/55">Preview // {base.name}</span>
            </div>

            {/* resumo */}
            <div className="border-t px-6 py-5" style={{ borderColor: LINE }}>
              <ul className="flex flex-col gap-2 text-sm">
                <li className="flex items-baseline gap-2">
                  <span className="text-white/85">{base.name}</span>
                  <span className="flex-1 border-b border-dotted border-white/15 translate-y-[-3px]" />
                  <span className="p-mono text-[11px] text-white/60">{money(base.price)}</span>
                </li>
                {chosen.map((a) => (
                  <li key={a.id} className="flex items-baseline gap-2">
                    <span className="text-white/60">+ {a.name}</span>
                    <span className="flex-1 border-b border-dotted border-white/10 translate-y-[-3px]" />
                    <span className="p-mono text-[11px] text-white/45">{a.price === 0 ? 'Grátis' : money(a.price)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex items-end justify-between">
                <span className="p-mono text-[10px] text-white/45">Total {qty > 1 ? `// ${qty}×` : ''}</span>
                <span className="p-display tabular-nums" style={{ color: accent, fontSize: 'clamp(2.4rem, 5vw, 3.4rem)' }}>{money(total)}</span>
              </div>
              <button
                onClick={add}
                disabled={!isStoreOpen}
                className="mt-4 w-full h-14 flex items-center justify-center gap-3 p-mono text-[13px] font-bold transition-all disabled:opacity-35 disabled:cursor-not-allowed enabled:hover:brightness-110"
                style={{ backgroundColor: accent, color: onAccent, boxShadow: `0 10px 40px ${accent}40` }}
              >
                {!isStoreOpen ? 'Loja fechada' : added ? (<><Check className="w-4 h-4" /> Adicionado</>) : (<>Adicionar ao pedido <ArrowRight className="w-4 h-4" /></>)}
              </button>
              {added && (
                <button onClick={onOpenCart} className="mt-3 w-full p-mono text-[10px] text-white/55 hover:text-white transition-colors">
                  Ver pedido →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
