import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Menu, ShoppingBag, ArrowRight, UtensilsCrossed, ChevronDown } from 'lucide-react';
import { Loader } from '@react-three/drei';
import type { Product } from '../../App';
import { useConfig } from '../../ConfigContext';
import { useFranchise } from '../../FranchiseContext';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { BurgerScene } from '../awwwards/BurgerScene';
import { useScrollAnimation } from '../awwwards/useScrollAnimation';
import * as api from '../../utils/api';

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

interface ThreeDLayoutProps {
  products: Product[];
  onAddToCart: (product: Product, notes?: string, quantity?: number, selectedAddons?: Array<{ id: string; name: string; price: number }>) => void;
  cartCount: number;
  onOpenCart: () => void;
  isStoreOpen: boolean;
}

/** Detecta a preferência de menos movimento (reativa a mudanças no SO). */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

/**
 * Design "3D" — hero imersivo com o modelo GLB do hambúrguer girando ao scroll
 * (mesma cena da rota /hero3d), seguido do cardápio real lido do Master.
 * Isolado: não altera os demais designs.
 */
export function ThreeDLayout({ products, onAddToCart, cartCount, onOpenCart, isStoreOpen }: ThreeDLayoutProps) {
  const { config } = useConfig();
  const { unitOverrides } = useFranchise();
  const heroRef = useRef<HTMLDivElement>(null);
  const progress = useScrollAnimation(heroRef);
  const prefersReduced = usePrefersReducedMotion();

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [categories, setCategories] = useState<any[]>([]);
  const [currentCategory, setCurrentCategory] = useState<string | null>(null);

  const gold = config.themeColor || '#fbbf24';
  const logo = config.logoUrl;
  const siteName = config.siteName || 'NewBurguer Lanches';
  const subtitle = config.siteSubtitle || 'Ingredientes selecionados, montados na hora. Um hambúrguer artesanal de verdade.';
  const whatsappNumber = (config.whatsappNumber || '5564993392970').replace(/\D/g, '');

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const response = await api.getCategories();
        if (response.success) {
          const filtered = response.categories.filter((cat: any) => {
            const id = (cat.id || '').toLowerCase();
            const label = (cat.label || '').toLowerCase();
            const isPromo = id === 'promocoes' || id.includes('promo') || label.includes('promo');
            const isBest = id === 'mais-pedidos' || label.includes('mais pedidos') || label.includes('mais vendidos');
            return !isPromo && !isBest;
          });
          setCategories(filtered);
        }
      } catch (e) {
        console.error('Erro ao carregar categorias (3d)', e);
      }
    })();
  }, []);

  const bestSellers = useMemo(() => {
    const popular = (config as any).popularProducts as Array<{ productId: string; count: number }> | undefined;
    const hidden = ((config as any).hiddenBestSellers as string[]) || [];
    if (!popular || popular.length === 0) {
      return products.filter((p) => p.available !== false).slice(0, 8);
    }
    return popular
      .filter((pp) => !hidden.includes(pp.productId))
      .map((pp) => products.find((p) => p.id === pp.productId))
      .filter((p): p is Product => p !== undefined && p.available !== false)
      .slice(0, 8);
  }, [products, config]);

  const displayedProducts = useMemo(() => {
    if (currentCategory === null) return bestSellers;
    return products.filter((p) => p.category === currentCategory && p.available !== false);
  }, [currentCategory, products, bestSellers]);

  // Parallax do bloco de texto ligado ao scroll (lê o progress em rAF,
  // sem re-render). Respeita reduced-motion (fica estático).
  const heroTextRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (prefersReduced) return;
    let raf = 0;
    const tick = () => {
      const el = heroTextRef.current;
      if (el) {
        const p = progress.current; // 0 → 1
        el.style.transform = `translate3d(0, ${p * -80}px, 0)`;
        el.style.opacity = String(Math.max(0, 1 - p * 1.4));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [prefersReduced, progress]);

  const scrollToMenu = () => {
    const el = document.getElementById('threed-menu');
    if (el) el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
  };

  const cardBg = 'rgba(20,15,12,0.92)';

  return (
    <div className="min-h-screen text-white flex flex-col" style={{ backgroundColor: '#0d0b0a' }}>
      {/* Animação de entrada do hero (ease-out, escopada; não afeta o CSS global) */}
      <style>{`
        @keyframes threedEnter {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .threed-enter {
          animation: threedEnter 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .threed-enter-2 { animation-delay: 0.12s; }
        .threed-enter-3 { animation-delay: 0.24s; }
        @media (prefers-reduced-motion: reduce) {
          .threed-enter { animation: none; }
        }
        /* Tipografia display premium (Playfair Display SC) só nos títulos */
        .threed-display { font-family: 'Playfair Display SC', Georgia, serif; }
        /* Cards: hover por cor/sombra (sem layout shift) + zoom sutil na foto */
        .threed-card { transition: border-color 0.22s ease, box-shadow 0.22s ease; }
        .threed-card img { transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1); }
        .threed-card:hover img { transform: scale(1.05); }
        /* Seta do hero: bounce suave */
        @keyframes threedBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
        }
        .threed-bounce { animation: threedBounce 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .threed-card img { transition: none; }
          .threed-card:hover img { transform: none; }
          .threed-bounce { animation: none; }
        }
      `}</style>

      {/* CAMADAS DE PROFUNDIDADE (glow âmbar + vinheta) atrás do modelo 3D.
          Ficam entre o fundo e o canvas; o cardápio (bg sólido) as cobre ao rolar. */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
        {/* Glow radial quente, centralizado no burger */}
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(60% 55% at 50% 42%, ${gold}22, transparent 70%)` }}
        />
        {/* Vinheta: escurece as bordas e dá foco ao centro */}
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,0.65) 100%)' }}
        />
      </div>

      {/* CANVAS FIXO NO FUNDO (só aparece na região do hero; o cardápio cobre com bg sólido) */}
      <div className="fixed inset-0 z-[1]" style={{ pointerEvents: 'none' }} aria-hidden>
        <BurgerScene progress={progress} isMobile={isMobile} />
      </div>

      {/* ============ BARRA DE TOPO ============ */}
      <header
        className="sticky top-0 z-30 backdrop-blur-md border-b"
        style={{ backgroundColor: 'rgba(13,11,10,0.72)', borderColor: `${gold}33` }}
      >
        <div className="container mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <button onClick={scrollToMenu} className="p-2 -ml-2 rounded-lg transition-colors hover:bg-white/5 cursor-pointer" aria-label="Ir para o cardápio">
            <Menu className="w-6 h-6" style={{ color: gold }} />
          </button>

          <div className="absolute left-1/2 -translate-x-1/2">
            {logo ? (
              <img src={logo} alt={siteName} className="h-10 w-auto object-contain drop-shadow-lg" />
            ) : (
              <span className="font-extrabold text-lg tracking-wide" style={{ color: gold }}>{siteName}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-11 h-11 rounded-xl border flex items-center justify-center transition-colors hover:bg-white/5 cursor-pointer"
              style={{ color: gold, borderColor: `${gold}44` }}
              aria-label="WhatsApp"
            >
              <WhatsAppIcon className="w-5 h-5" />
            </a>
            <button
              onClick={onOpenCart}
              className="relative w-11 h-11 rounded-xl border flex items-center justify-center transition-colors hover:bg-white/5 cursor-pointer"
              style={{ color: gold, borderColor: `${gold}44` }}
              aria-label="Carrinho"
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full text-[11px] font-bold text-black flex items-center justify-center" style={{ backgroundColor: gold }}>
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ============ HERO 3D (área de scroll da animação) ============ */}
      <section ref={heroRef} className="relative z-10" style={{ height: prefersReduced ? 'auto' : '200vh' }}>
        <div className={`${prefersReduced ? '' : 'sticky top-16'} ${prefersReduced ? 'pt-16 pb-24' : 'h-[calc(100vh-4rem)]'} flex flex-col justify-between`}>
          <div className="pt-8 px-6 text-center pointer-events-none">
            <p className="uppercase tracking-[0.4em] text-xs" style={{ color: `${gold}cc` }}>{siteName}</p>
          </div>

          <div
            ref={heroTextRef}
            className="px-6 text-center"
            style={{ willChange: prefersReduced ? undefined : 'transform, opacity' }}
          >
            <h1
              className={`threed-display font-bold uppercase leading-none ${prefersReduced ? '' : 'threed-enter'}`}
              style={{ fontSize: 'clamp(2.75rem, 12vw, 7.5rem)', letterSpacing: '0.01em', textShadow: '0 10px 60px rgba(0,0,0,0.6)' }}
            >
              Sabor
              <br />
              <span style={{ color: gold }}>de verdade</span>
            </h1>
            <p className={`mt-5 text-white/60 text-base sm:text-lg max-w-md mx-auto leading-relaxed ${prefersReduced ? '' : 'threed-enter threed-enter-2'}`}>{subtitle}</p>

            <div className={`mt-7 flex justify-center ${prefersReduced ? '' : 'threed-enter threed-enter-3'}`}>
              <button
                onClick={scrollToMenu}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-extrabold uppercase tracking-wide text-black shadow-lg hover:brightness-110 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-4"
                style={{ background: `linear-gradient(135deg, ${gold}, ${gold}dd)`, boxShadow: `0 6px 24px ${gold}55`, ['--tw-ring-color' as any]: `${gold}66` }}
              >
                <UtensilsCrossed className="w-5 h-5" />
                Ver cardápio
              </button>
            </div>
          </div>

          <div className="pb-8 px-6 text-center pointer-events-none flex flex-col items-center gap-1">
            <p className="text-white/50 text-sm uppercase tracking-[0.25em]">role para explorar</p>
            <ChevronDown className={`w-5 h-5 ${prefersReduced ? '' : 'threed-bounce'}`} style={{ color: `${gold}cc` }} aria-hidden />
          </div>
        </div>
      </section>

      {/* ============ CARDÁPIO (bg sólido cobre o canvas) ============ */}
      <div id="threed-menu" className="relative z-10 flex-1 flex flex-col" style={{ backgroundColor: '#0d0b0a' }}>
        {/* Transição suave: o burger "mergulha" no cardápio em vez de ser cortado */}
        <div
          className="absolute left-0 right-0 pointer-events-none"
          style={{ top: '-120px', height: '120px', background: 'linear-gradient(to bottom, transparent, #0d0b0a 60%)' }}
          aria-hidden
        />
        {/* Categorias — sticky abaixo do header para navegar sem voltar ao topo */}
        <section
          className="sticky top-16 z-20 backdrop-blur-md border-b"
          style={{ backgroundColor: 'rgba(13,11,10,0.85)', borderColor: `${gold}22` }}
        >
          <div className="container mx-auto max-w-6xl px-4 py-3 flex flex-wrap gap-2">
            <button
              onClick={() => setCurrentCategory(null)}
              className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-colors cursor-pointer border ${currentCategory === null ? 'text-black' : 'text-white/70 hover:bg-white/5'}`}
              style={currentCategory === null ? { backgroundColor: gold, borderColor: gold } : { borderColor: `${gold}33` }}
            >
              Mais Pedidos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCurrentCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-colors cursor-pointer border ${currentCategory === cat.id ? 'text-black' : 'text-white/70 hover:bg-white/5'}`}
                style={currentCategory === cat.id ? { backgroundColor: gold, borderColor: gold } : { borderColor: `${gold}33` }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </section>

        {/* Grade de produtos */}
        <main className="flex-1 container mx-auto max-w-6xl px-4 pt-8 pb-16">
          <div className="flex items-center justify-between mb-4">
            <h2 className="threed-display font-bold uppercase tracking-wide text-2xl" style={{ color: gold }}>
              {currentCategory === null ? 'Mais Pedidos' : (categories.find((c) => c.id === currentCategory)?.label || 'Cardápio')}
            </h2>
            {currentCategory !== null && (
              <button onClick={() => setCurrentCategory(null)} className="flex items-center gap-1 font-bold uppercase text-sm tracking-wide hover:brightness-125 transition-all cursor-pointer" style={{ color: gold }}>
                Voltar <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {displayedProducts.length === 0 ? (
            <p className="text-white/50 py-10 text-center">Nenhum produto nesta categoria ainda.</p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {displayedProducts.map((product) => {
                const img = product.imageUrl || product.image;
                return (
                  <div
                    key={product.id}
                    className="threed-card rounded-2xl overflow-hidden border flex flex-col"
                    style={{ backgroundColor: cardBg, borderColor: `${gold}33` }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${gold}99`; e.currentTarget.style.boxShadow = '0 16px 38px -18px rgba(0,0,0,0.9)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${gold}33`; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    {img && (
                      <div className="aspect-square overflow-hidden bg-black/40">
                        <ImageWithFallback src={img} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-3 flex flex-col flex-1">
                      <h3 className="font-bold text-sm leading-snug text-white line-clamp-2">{product.name}</h3>
                      {product.description && (
                        <p className="text-white/60 text-xs mt-1 leading-snug line-clamp-2">{product.description}</p>
                      )}
                      <div className="mt-auto pt-3 flex items-center justify-between">
                        <span className="font-black" style={{ color: gold }}>
                          <span className="text-xs font-bold align-top mr-0.5">R$</span>
                          <span className="text-lg">{product.price.toFixed(2).replace('.', ',')}</span>
                        </span>
                        <button
                          onClick={() => onAddToCart(product)}
                          disabled={!isStoreOpen}
                          className="w-11 h-11 rounded-xl flex items-center justify-center border transition-colors disabled:opacity-40 cursor-pointer focus-visible:outline-none focus-visible:ring-4 hover:text-black"
                          style={{ color: gold, borderColor: `${gold}66`, ['--tw-ring-color' as any]: `${gold}66` }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = gold; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          aria-label={`Adicionar ${product.name}`}
                        >
                          <span className="text-2xl leading-none">+</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* Rodapé */}
        <footer className="py-8 border-t text-center" style={{ borderColor: `${gold}22` }}>
          {logo && <img src={logo} alt={siteName} className="h-12 w-auto object-contain mx-auto mb-3 opacity-90" />}
          <p className="text-white/40 text-sm">{siteName} — Todos os direitos reservados</p>
        </footer>
      </div>

      {/* Loader de marca enquanto GLB + HDRI carregam */}
      <Loader
        containerStyles={{ background: '#0d0b0a' }}
        innerStyles={{ background: 'rgba(255,255,255,0.12)', width: '160px', height: '3px' }}
        barStyles={{ background: gold, height: '3px' }}
        dataStyles={{ color: gold, fontSize: '12px', letterSpacing: '0.2em', marginTop: '12px' }}
        dataInterpolation={(p) => `Preparando o pedido… ${p.toFixed(0)}%`}
      />
    </div>
  );
}
