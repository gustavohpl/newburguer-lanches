import React, { useState, useEffect, useMemo } from 'react';
import { Menu, ShoppingCart, ArrowRight, ArrowUpRight, Flame, Layers, Clock, MapPin, ShieldCheck } from 'lucide-react';
import type { Product } from '../../App';
import { useConfig } from '../../ConfigContext';
import { useFranchise } from '../../FranchiseContext';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import * as api from '../../utils/api';

// ============================================================
// 🔥 PRIME — estilo editorial/cinematográfico (dark + accent)
// ------------------------------------------------------------
// Inspirado em landing pages de agência (docmo.agency / "PRIME //
// THE STACK"): fundo quase preto, tipografia display gigante,
// seções numeradas (// 01, // 02...), hambúrguer com glow/fumaça,
// cards com "ADICIONAR AO PEDIDO". Mesma LÓGICA do site — muda só
// a aparência. A cor de destaque vem de config.themeColor.
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

const CATEGORY_FALLBACK_EMOJI = ['🍔', '🥤', '🍟', '🥗', '🍽️', '🍰', '🌭', '🍗'];

export function PrimeLayout({ products, onAddToCart, cartCount, onOpenCart, isStoreOpen }: PrimeLayoutProps) {
  const { config } = useConfig();
  const { unitOverrides } = useFranchise();
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [categories, setCategories] = useState<any[]>([]);
  const [currentCategory, setCurrentCategory] = useState<string | null>(null);

  const accent = config.themeColor || '#f5a524';
  const logo = config.logoUrl;
  const siteName = config.siteName || 'Ranch Hamburgueria';
  const subtitle = config.siteSubtitle || 'Camadas selecionadas, ponto certo, montado na hora. O hambúrguer levado a sério.';

  const effectiveAddress = unitOverrides.address || config.address || '';
  const effectiveHours = unitOverrides.openingHours || config.openingHours || '';
  const whatsappNumber = (config.whatsappNumber || '5564993392970').replace(/\D/g, '');

  const heroImage = (isMobile && (config as any).contentBackgroundMobileUrl)
    ? (config as any).contentBackgroundMobileUrl
    : ((config as any).contentBackgroundUrl || (config as any).headerBackgroundUrl);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile((prev) => (prev !== mobile ? mobile : prev));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
        console.error('Erro ao carregar categorias (prime)', e);
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

  // Produto de destaque para o hero (maior preço entre os disponíveis = "the stack")
  const heroProduct = useMemo(() => {
    const avail = products.filter((p) => p.available !== false && (p.imageUrl || p.image));
    if (avail.length === 0) return undefined;
    return [...avail].sort((a, b) => b.price - a.price)[0];
  }, [products]);

  const scrollToMenu = () => {
    const el = document.getElementById('prime-menu');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const money = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  const heroBurger = heroImage || heroProduct?.imageUrl || heroProduct?.image || logo;

  // Card CTA "monte seu combo" -> categoria com "combo" no nome, se existir
  const comboCat = categories.find((c) => (c.label || '').toLowerCase().includes('combo'));

  return (
    <div className="prime-root min-h-screen flex flex-col relative overflow-hidden" style={{ backgroundColor: '#08070a', color: '#f4f1ea', ['--accent' as any]: accent }}>
      {/* keyframes / helpers do estilo PRIME */}
      <style>{`
        .prime-root { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        .prime-display { font-weight: 900; letter-spacing: -0.03em; line-height: 0.86; }
        .prime-kicker { letter-spacing: 0.42em; }
        @keyframes primeRise { 0% { opacity: 0; transform: translateY(26px); filter: blur(8px); } 100% { opacity: 1; transform: translateY(0); filter: blur(0); } }
        @keyframes primeSmoke { 0% { transform: translateY(10px) scale(1); opacity: .0; } 30% { opacity: .5; } 100% { transform: translateY(-60px) scale(1.5); opacity: 0; } }
        @keyframes primeGlowPulse { 0%,100% { opacity: .55; } 50% { opacity: .9; } }
        .prime-anim { animation: primeRise .9s cubic-bezier(.16,1,.3,1) both; }
        .prime-card { transition: transform .35s cubic-bezier(.16,1,.3,1), border-color .35s, box-shadow .35s; }
        .prime-card:hover { transform: translateY(-4px); }
        .prime-hairline { border-color: color-mix(in srgb, var(--accent) 26%, transparent); }
      `}</style>

      {/* brilho ambiente de fundo */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[80vw] h-[80vw] rounded-full" style={{ background: `radial-gradient(circle, ${accent}22, transparent 62%)`, animation: 'primeGlowPulse 6s ease-in-out infinite' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(8,7,10,0) 40%, rgba(8,7,10,0.9) 100%)' }} />
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        {/* ============ HEADER ============ */}
        <header className="sticky top-0 z-30 backdrop-blur-xl border-b prime-hairline" style={{ backgroundColor: 'rgba(8,7,10,0.72)' }}>
          <div className="container mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
            <button onClick={scrollToMenu} className="flex items-center gap-2 p-2 -ml-2 rounded-lg transition-colors hover:bg-white/5" aria-label="Menu">
              <Menu className="w-5 h-5" style={{ color: accent }} />
              <span className="hidden sm:block text-[10px] font-bold uppercase prime-kicker text-white/50">Menu</span>
            </button>

            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
              {logo ? (
                <img src={logo} alt={siteName} className="h-9 w-auto object-contain" />
              ) : (
                <span className="prime-display text-lg uppercase text-white">{siteName}</span>
              )}
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: accent }}>// prime</span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full border prime-hairline flex items-center justify-center transition-colors hover:bg-white/5"
                style={{ color: accent }}
                aria-label="WhatsApp"
              >
                <WhatsAppIcon className="w-4 h-4" />
              </a>
              <button
                onClick={onOpenCart}
                className="relative w-10 h-10 rounded-full border prime-hairline flex items-center justify-center transition-colors hover:bg-white/5"
                style={{ color: accent }}
                aria-label="Carrinho"
              >
                <ShoppingCart className="w-4 h-4" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full text-[11px] font-black text-black flex items-center justify-center" style={{ backgroundColor: accent }}>
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* ============ HERO — // 01 THE STACK ============ */}
        <section className="container mx-auto max-w-6xl px-4 pt-10 sm:pt-16 pb-10">
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-center">
            <div className="prime-anim">
              <div className="flex items-center gap-3 mb-5">
                <span className="text-xs font-black" style={{ color: accent }}>// 01</span>
                <span className="h-px flex-1 max-w-[80px]" style={{ backgroundColor: `${accent}66` }} />
                <span className="text-[11px] font-bold uppercase prime-kicker text-white/50">The Stack</span>
              </div>

              <h1 className="prime-display uppercase text-white" style={{ fontSize: 'clamp(3.4rem, 13vw, 7rem)' }}>
                Prime
              </h1>
              <p className="prime-display uppercase mt-1" style={{ color: accent, fontSize: 'clamp(1.6rem, 6vw, 3rem)' }}>
                // The Stack
              </p>

              <p className="mt-6 text-white/60 text-base sm:text-lg max-w-md leading-relaxed">
                {subtitle}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  onClick={scrollToMenu}
                  className="group inline-flex items-center gap-2 px-8 py-4 rounded-full font-black uppercase tracking-wide text-black shadow-lg hover:brightness-110 transition-all"
                  style={{ backgroundColor: accent, boxShadow: `0 8px 30px ${accent}55` }}
                >
                  Montar meu pedido
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <a
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-4 rounded-full border prime-hairline font-bold uppercase tracking-wide text-white/80 hover:bg-white/5 transition-all text-sm"
                >
                  <WhatsAppIcon className="w-4 h-4" /> Falar no zap
                </a>
              </div>
            </div>

            {/* Hambúrguer com glow + fumaça */}
            <div className="relative flex justify-center items-center min-h-[280px] sm:min-h-[420px] prime-anim" style={{ animationDelay: '.15s' }}>
              <div className="absolute w-[70%] aspect-square rounded-full" style={{ background: `radial-gradient(circle, ${accent}44, transparent 60%)`, filter: 'blur(20px)' }} />
              {/* fumaça */}
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    width: 60, height: 60,
                    left: `${38 + i * 12}%`, top: '30%',
                    background: 'radial-gradient(circle, rgba(255,255,255,0.18), transparent 70%)',
                    filter: 'blur(8px)',
                    animation: `primeSmoke ${4 + i}s ease-in-out ${i * 0.8}s infinite`,
                  }}
                />
              ))}
              {heroBurger ? (
                <ImageWithFallback
                  src={heroBurger}
                  alt={heroProduct?.name || siteName}
                  className="relative z-10 w-[86%] max-w-[420px] aspect-square object-contain drop-shadow-2xl"
                />
              ) : (
                <div className="relative z-10 w-56 h-56 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${accent}, ${accent}44 60%, transparent)`, boxShadow: `0 0 60px ${accent}66` }} />
              )}

              {heroProduct && (
                <div className="absolute bottom-2 right-2 z-20 rounded-2xl border prime-hairline backdrop-blur-md px-4 py-3" style={{ backgroundColor: 'rgba(12,10,14,0.75)' }}>
                  <p className="text-[10px] font-bold uppercase prime-kicker text-white/50">Destaque</p>
                  <p className="font-black uppercase text-sm text-white leading-tight max-w-[140px] truncate">{heroProduct.name}</p>
                  <p className="font-black text-lg" style={{ color: accent }}>{money(heroProduct.price)}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ============ // 02 THE CUT — pilares ============ */}
        <section className="container mx-auto max-w-6xl px-4 py-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs font-black" style={{ color: accent }}>// 02</span>
            <span className="text-[11px] font-bold uppercase prime-kicker text-white/50">The Cut</span>
            <span className="h-px flex-1" style={{ backgroundColor: `${accent}22` }} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: <Flame className="w-6 h-6" />, t: 'Selado na chapa', d: 'Ponto certo, suculento' },
              { icon: <Layers className="w-6 h-6" />, t: 'Camadas premium', d: 'Pão brioche, queijo maturado' },
              { icon: <Clock className="w-6 h-6" />, t: 'Montado na hora', d: 'Do balcão pra você' },
              { icon: <ShieldCheck className="w-6 h-6" />, t: 'Pagamento seguro', d: 'Pix ou cartão' },
            ].map((f, i) => (
              <div
                key={i}
                className="prime-card rounded-2xl border prime-hairline p-4 flex flex-col gap-3"
                style={{ backgroundColor: 'rgba(16,14,19,0.7)' }}
              >
                <span style={{ color: accent }}>{f.icon}</span>
                <div>
                  <p className="font-black uppercase text-sm text-white leading-tight">{f.t}</p>
                  <p className="text-white/45 text-xs mt-1 leading-snug">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============ // 03 THE MENU — categorias + produtos ============ */}
        <section id="prime-menu" className="container mx-auto max-w-6xl px-4 py-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-black" style={{ color: accent }}>// 03</span>
            <span className="text-[11px] font-bold uppercase prime-kicker text-white/50">The Menu</span>
            <span className="h-px flex-1" style={{ backgroundColor: `${accent}22` }} />
          </div>

          {/* Tabs de categoria estilo editorial */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-7 border-b prime-hairline pb-1">
            <CategoryTab label="Mais Pedidos" emoji="⭐" active={currentCategory === null} accent={accent} onClick={() => setCurrentCategory(null)} />
            {categories.map((cat, idx) => (
              <CategoryTab
                key={cat.id}
                label={cat.label}
                emoji={cat.emoji || CATEGORY_FALLBACK_EMOJI[idx % CATEGORY_FALLBACK_EMOJI.length]}
                active={currentCategory === cat.id}
                accent={accent}
                onClick={() => setCurrentCategory(cat.id)}
              />
            ))}
          </div>

          <div className="flex items-end justify-between mb-5">
            <h2 className="prime-display uppercase text-white" style={{ fontSize: 'clamp(1.8rem, 5vw, 2.6rem)' }}>
              {currentCategory === null ? 'Mais Pedidos' : (categories.find((c) => c.id === currentCategory)?.label || 'Cardápio')}
            </h2>
            <span className="text-white/30 text-sm font-mono">{String(displayedProducts.length).padStart(2, '0')} itens</span>
          </div>

          {displayedProducts.length === 0 ? (
            <p className="text-white/40 py-12 text-center">Nenhum produto nesta categoria ainda.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedProducts.map((product, idx) => {
                const img = product.imageUrl || product.image;
                return (
                  <div
                    key={product.id}
                    className="prime-card group rounded-2xl border prime-hairline overflow-hidden flex flex-col"
                    style={{ backgroundColor: 'rgba(16,14,19,0.75)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 50px ${accent}22`; (e.currentTarget as HTMLElement).style.borderColor = `${accent}66`; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.borderColor = ''; }}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      {img ? (
                        <ImageWithFallback src={img} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-5xl" style={{ background: `radial-gradient(circle, ${accent}22, transparent)` }}>🍔</div>
                      )}
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(8,7,10,0.85))' }} />
                      <span className="absolute top-3 left-3 text-[11px] font-black font-mono" style={{ color: accent }}>{String(idx + 1).padStart(2, '0')}</span>
                    </div>

                    <div className="p-4 flex flex-col flex-1">
                      <h3 className="font-black uppercase text-base leading-tight text-white">{product.name}</h3>
                      {product.description && (
                        <p className="text-white/45 text-xs mt-1.5 leading-snug line-clamp-2">{product.description}</p>
                      )}
                      <div className="mt-4 pt-3 flex items-center justify-between border-t prime-hairline">
                        <span className="font-black text-xl" style={{ color: accent }}>{money(product.price)}</span>
                        <button
                          onClick={() => onAddToCart(product)}
                          disabled={!isStoreOpen}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-black font-black uppercase text-xs tracking-wide shadow-md hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ backgroundColor: accent }}
                        >
                          {isStoreOpen ? 'Adicionar' : 'Fechado'}
                          {isStoreOpen && <ArrowUpRight className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ============ // 04 BUILD YOUR PRIME — CTA combo ============ */}
        <section className="container mx-auto max-w-6xl px-4 py-6">
          <div
            className="relative rounded-3xl border prime-hairline overflow-hidden p-8 sm:p-12"
            style={{ background: `linear-gradient(120deg, rgba(16,14,19,0.9), rgba(8,7,10,0.9))` }}
          >
            <div className="absolute -right-10 -top-10 w-64 h-64 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${accent}33, transparent 65%)` }} />
            <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-black" style={{ color: accent }}>// 04</span>
                  <span className="text-[11px] font-bold uppercase prime-kicker text-white/50">Build Your Prime</span>
                </div>
                <h2 className="prime-display uppercase text-white" style={{ fontSize: 'clamp(2rem, 6vw, 3.4rem)' }}>
                  Monte seu <span style={{ color: accent }}>combo</span>
                </h2>
                <p className="text-white/55 mt-2 max-w-md">Escolha as camadas, o acompanhamento e feche do seu jeito.</p>
              </div>
              <button
                onClick={() => (comboCat ? setCurrentCategory(comboCat.id) : scrollToMenu())}
                className="group inline-flex items-center gap-2 px-8 py-4 rounded-full font-black uppercase tracking-wide text-black shadow-lg hover:brightness-110 transition-all whitespace-nowrap"
                style={{ backgroundColor: accent, boxShadow: `0 8px 30px ${accent}55` }}
              >
                {comboCat ? 'Ver combos' : 'Ver cardápio'}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </section>

        {/* ============ INFO ============ */}
        <section className="container mx-auto max-w-6xl px-4 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: <Clock className="w-5 h-5" />, t1: 'Atendimento', t2: effectiveHours || 'Consulte' },
              { icon: <MapPin className="w-5 h-5" />, t1: 'Retirada / entrega', t2: effectiveAddress || 'Consulte' },
              { icon: <ShieldCheck className="w-5 h-5" />, t1: 'Pagamento', t2: 'Pix ou cartão' },
            ].map((f, i) => (
              <div key={i} className="rounded-2xl border prime-hairline p-4 flex items-start gap-3" style={{ backgroundColor: 'rgba(16,14,19,0.6)' }}>
                <span style={{ color: accent }} className="mt-0.5 flex-shrink-0">{f.icon}</span>
                <div className="leading-tight">
                  <p className="font-bold uppercase text-[11px] prime-kicker" style={{ color: accent }}>{f.t1}</p>
                  <p className="text-white/70 text-sm mt-1">{f.t2}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============ FOOTER ============ */}
        <footer className="mt-6 py-10 border-t prime-hairline text-center">
          {logo && <img src={logo} alt={siteName} className="h-11 w-auto object-contain mx-auto mb-3 opacity-90" />}
          <p className="prime-display uppercase text-white/80 text-lg">{siteName} <span style={{ color: accent }}>// prime</span></p>
          <p className="text-white/35 text-xs mt-2">Todos os direitos reservados</p>
        </footer>
      </div>
    </div>
  );
}

// Aba de categoria estilo editorial (underline animado)
function CategoryTab({ label, emoji, active, accent, onClick }: { label: string; emoji: string; active: boolean; accent: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative pb-2 flex items-center gap-1.5 font-black uppercase text-sm tracking-wide transition-colors"
      style={{ color: active ? '#ffffff' : 'rgba(255,255,255,0.45)' }}
    >
      <span className="text-base">{emoji}</span>
      {label}
      <span
        className="absolute -bottom-[5px] left-0 h-0.5 transition-all duration-300"
        style={{ width: active ? '100%' : '0%', backgroundColor: accent }}
      />
    </button>
  );
}
