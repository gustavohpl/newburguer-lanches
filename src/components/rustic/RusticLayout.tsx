import React, { useState, useEffect, useMemo } from 'react';
import { Menu, ShoppingCart, Award, Bike, CreditCard, Clock, MapPin, Shield, ArrowRight, Star, UtensilsCrossed } from 'lucide-react';
import type { Product } from '../../App';
import { useConfig } from '../../ConfigContext';
import { useFranchise } from '../../FranchiseContext';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import * as api from '../../utils/api';

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

interface RusticLayoutProps {
  products: Product[];
  onAddToCart: (product: Product, notes?: string, quantity?: number, selectedAddons?: Array<{ id: string; name: string; price: number }>) => void;
  cartCount: number;
  onOpenCart: () => void;
  isStoreOpen: boolean;
}

// Ícones de fallback para categorias (usados quando a categoria não tem emoji)
const CATEGORY_FALLBACK_EMOJI = ['🍔', '🥤', '🍟', '🥗', '🍽️', '🍰', '🌭', '🍗'];

export function RusticLayout({ products, onAddToCart, cartCount, onOpenCart, isStoreOpen }: RusticLayoutProps) {
  const { config } = useConfig();
  const { unitOverrides } = useFranchise();
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [categories, setCategories] = useState<any[]>([]);
  const [currentCategory, setCurrentCategory] = useState<string | null>(null);

  const gold = config.themeColor || '#d97706';
  const logo = config.logoUrl;
  const siteName = config.siteName || 'NewBurguer Lanches';
  const subtitle = config.siteSubtitle || 'Experimente nosso hambúrguer artesanal e sinta a diferença a cada mordida.';

  const effectiveAddress = unitOverrides.address || config.address || '';
  const effectiveHours = unitOverrides.openingHours || config.openingHours || '';
  const effectiveMapsUrl = unitOverrides.googleMapsUrl || (config as any).googleMapsUrl;
  const whatsappNumber = (config.whatsappNumber || '5564993392970').replace(/\D/g, '');

  // Imagem de fundo escura (textura madeira) e imagem do hero (produto)
  const bgImage = (config as any).headerBackgroundUrl || (config as any).contentBackgroundUrl;
  const heroImage = (isMobile && (config as any).contentBackgroundMobileUrl)
    ? (config as any).contentBackgroundMobileUrl
    : (config as any).contentBackgroundUrl;

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
        console.error('Erro ao carregar categorias (rustic)', e);
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

  const scrollToMenu = () => {
    const el = document.getElementById('rustic-menu');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const money = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  // Estilos reutilizados
  const cardBg = 'rgba(28, 22, 18, 0.85)';
  const goldBorder = { borderColor: `${gold}55` };

  return (
    <div className="min-h-screen text-amber-50 flex flex-col relative" style={{ backgroundColor: '#140f0c' }}>
      {/* Textura de fundo (madeira escura) */}
      {bgImage && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <img src={bgImage} alt="" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(20,15,12,0.85), rgba(20,15,12,0.95))' }} />
        </div>
      )}

      <div className="relative z-10 flex flex-col flex-1">
        {/* ============ BARRA DE TOPO ============ */}
        <header className="sticky top-0 z-30 backdrop-blur-md border-b" style={{ backgroundColor: 'rgba(20,15,12,0.9)', ...goldBorder }}>
          <div className="container mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
            <button onClick={scrollToMenu} className="p-2 -ml-2 rounded-lg transition-colors hover:bg-white/5" aria-label="Menu">
              <Menu className="w-6 h-6" style={{ color: gold }} />
            </button>

            {/* Logo centralizada */}
            <div className="absolute left-1/2 -translate-x-1/2">
              {logo ? (
                <img src={logo} alt={siteName} className="h-11 w-auto object-contain drop-shadow-lg" />
              ) : (
                <span className="font-extrabold text-lg tracking-wide" style={{ color: gold }}>{siteName}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl border flex items-center justify-center transition-colors hover:bg-white/5"
                style={{ color: gold, ...goldBorder }}
                aria-label="WhatsApp"
              >
                <WhatsAppIcon className="w-5 h-5" />
              </a>
              <button
                onClick={onOpenCart}
                className="relative w-10 h-10 rounded-xl border flex items-center justify-center transition-colors hover:bg-white/5"
                style={{ color: gold, ...goldBorder }}
                aria-label="Carrinho"
              >
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full text-[11px] font-bold text-black flex items-center justify-center" style={{ backgroundColor: gold }}>
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* ============ HERO ============ */}
        <section className="container mx-auto max-w-6xl px-4 pt-8 pb-6">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="font-extrabold tracking-widest text-2xl sm:text-3xl uppercase">UM SABOR</p>
              <h1 className="font-black uppercase leading-none my-1" style={{ color: gold, fontSize: 'clamp(3rem, 12vw, 5.5rem)', textShadow: '0 2px 20px rgba(217,119,6,0.4)' }}>
                Incrível
              </h1>
              <p className="font-extrabold tracking-wide text-xl sm:text-2xl uppercase">Que você vai amar!</p>

              <p className="mt-5 text-amber-100/70 text-base max-w-sm leading-relaxed">
                {subtitle}
              </p>

              <button
                onClick={scrollToMenu}
                className="mt-7 inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-extrabold uppercase tracking-wide text-black shadow-lg hover:brightness-110 transition-all"
                style={{ background: `linear-gradient(135deg, ${gold}, ${gold}dd)`, boxShadow: `0 6px 24px ${gold}55` }}
              >
                <UtensilsCrossed className="w-5 h-5" />
                Faça seu pedido
              </button>
            </div>

            <div className="relative">
              {heroImage ? (
                <div className="rounded-3xl overflow-hidden" style={{ boxShadow: `0 10px 50px ${gold}33` }}>
                  <ImageWithFallback src={heroImage} alt={siteName} className="w-full h-72 sm:h-96 object-cover" />
                </div>
              ) : logo ? (
                <div className="flex justify-center">
                  <img src={logo} alt={siteName} className="h-72 w-auto object-contain drop-shadow-2xl" />
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* ============ FAIXA DE BENEFÍCIOS ============ */}
        <section className="container mx-auto max-w-6xl px-4 py-4">
          <div className="rounded-2xl border p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:divide-x" style={{ backgroundColor: cardBg, ...goldBorder, borderColor: `${gold}44` }}>
            {[
              { icon: <Award className="w-7 h-7" />, t1: 'Ingredientes', t2: 'de qualidade' },
              { icon: <Bike className="w-7 h-7" />, t1: 'Retirada no local', t2: 'ou delivery' },
              { icon: <CreditCard className="w-7 h-7" />, t1: 'Pagamento via', t2: 'Pix ou cartão' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-3 justify-center sm:justify-start">
                <span style={{ color: gold }}>{f.icon}</span>
                <div className="leading-tight">
                  <p className="font-bold uppercase text-sm tracking-wide">{f.t1}</p>
                  <p className="text-amber-100/60 uppercase text-sm tracking-wide">{f.t2}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============ NOSSAS CATEGORIAS ============ */}
        <section id="rustic-menu" className="container mx-auto max-w-6xl px-4 py-6">
          <div className="rounded-2xl border p-6" style={{ backgroundColor: cardBg, borderColor: `${gold}44` }}>
            <div className="flex items-center justify-center gap-3 mb-6">
              <Star className="w-4 h-4" style={{ color: gold }} fill={gold} />
              <h2 className="font-black uppercase tracking-widest text-lg" style={{ color: gold }}>Nossas Categorias</h2>
              <Star className="w-4 h-4" style={{ color: gold }} fill={gold} />
            </div>

            <div className="flex flex-wrap justify-center gap-5">
              {/* Mais Pedidos (início) */}
              <CategoryCircle
                emoji="⭐"
                label="Mais Pedidos"
                active={currentCategory === null}
                gold={gold}
                onClick={() => setCurrentCategory(null)}
              />
              {categories.map((cat, idx) => (
                <CategoryCircle
                  key={cat.id}
                  emoji={cat.emoji || CATEGORY_FALLBACK_EMOJI[idx % CATEGORY_FALLBACK_EMOJI.length]}
                  label={cat.label}
                  active={currentCategory === cat.id}
                  gold={gold}
                  onClick={() => setCurrentCategory(cat.id)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ============ MAIS PEDIDOS / PRODUTOS ============ */}
        <section className="container mx-auto max-w-6xl px-4 pb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black uppercase tracking-wide text-2xl" style={{ color: gold }}>
              {currentCategory === null ? 'Mais Pedidos' : (categories.find((c) => c.id === currentCategory)?.label || 'Cardápio')}
            </h2>
            {currentCategory !== null && (
              <button onClick={() => setCurrentCategory(null)} className="flex items-center gap-1 font-bold uppercase text-sm tracking-wide hover:brightness-125 transition-all" style={{ color: gold }}>
                Voltar <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {displayedProducts.length === 0 ? (
            <p className="text-amber-100/50 py-10 text-center">Nenhum produto nesta categoria ainda.</p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {displayedProducts.map((product) => {
                const img = product.imageUrl || product.image;
                return (
                  <div key={product.id} className="rounded-2xl overflow-hidden border flex flex-col" style={{ backgroundColor: cardBg, borderColor: `${gold}44` }}>
                    {img && (
                      <div className="aspect-square overflow-hidden">
                        <ImageWithFallback src={img} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-3 flex flex-col flex-1">
                      <h3 className="font-black uppercase text-sm leading-snug text-amber-50">{product.name}</h3>
                      {product.description && (
                        <p className="text-amber-100/50 text-xs mt-1 leading-snug line-clamp-3">{product.description}</p>
                      )}
                      <div className="mt-auto pt-3 flex items-center justify-between">
                        <span className="font-black text-lg" style={{ color: gold }}>{money(product.price)}</span>
                        <button
                          onClick={() => onAddToCart(product)}
                          disabled={!isStoreOpen}
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-black shadow-md hover:brightness-110 transition-all disabled:opacity-40"
                          style={{ backgroundColor: gold }}
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
        </section>

        {/* ============ FAIXA DE INFORMAÇÕES ============ */}
        <section className="container mx-auto max-w-6xl px-4 py-4">
          <div className="rounded-2xl border p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:divide-x" style={{ backgroundColor: cardBg, borderColor: `${gold}44` }}>
            {[
              { icon: <Clock className="w-6 h-6" />, t1: 'Horário de atendimento', t2: effectiveHours || 'Consulte' },
              { icon: <MapPin className="w-6 h-6" />, t1: 'Retirada no local', t2: effectiveAddress || 'Consulte' },
              { icon: <Shield className="w-6 h-6" />, t1: 'Pagamento seguro', t2: 'Pix ou cartão de crédito/débito' },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-3 px-3">
                <span style={{ color: gold }} className="mt-0.5 flex-shrink-0">{f.icon}</span>
                <div className="leading-tight">
                  <p className="font-bold uppercase text-xs tracking-wide" style={{ color: gold }}>{f.t1}</p>
                  <p className="text-amber-100/70 text-sm mt-0.5">{f.t2}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============ BANNER MONTE SEU COMBO ============ */}
        {(() => {
          const combo = categories.find((c) => {
            const l = (c.label || '').toLowerCase();
            return l.includes('combo');
          });
          if (!combo) return null;
          return (
            <section className="container mx-auto max-w-6xl px-4 py-4">
              <div className="rounded-2xl border p-6 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ background: `linear-gradient(135deg, rgba(28,22,18,0.95), rgba(20,15,12,0.9))`, borderColor: `${gold}55` }}>
                <div>
                  <p className="font-extrabold uppercase text-xl">Monte seu</p>
                  <p className="font-black uppercase text-4xl leading-none" style={{ color: gold }}>Combo</p>
                  <p className="font-extrabold uppercase text-lg">do seu jeito!</p>
                </div>
                <button
                  onClick={() => setCurrentCategory(combo.id)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-extrabold uppercase tracking-wide text-black shadow-lg hover:brightness-110 transition-all"
                  style={{ backgroundColor: gold }}
                >
                  Ver combos <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </section>
          );
        })()}

        {/* ============ RODAPÉ ============ */}
        <footer className="mt-6 py-8 border-t text-center" style={{ borderColor: `${gold}33` }}>
          {logo && <img src={logo} alt={siteName} className="h-12 w-auto object-contain mx-auto mb-3 opacity-90" />}
          <p className="text-amber-100/40 text-sm">{siteName} — Todos os direitos reservados</p>
        </footer>
      </div>
    </div>
  );
}

// Botão de categoria circular estilo "barril"
function CategoryCircle({ emoji, label, active, gold, onClick }: { emoji: string; label: string; active: boolean; gold: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 w-20 group">
      <span
        className="w-16 h-16 rounded-full flex items-center justify-center text-2xl border-2 transition-all group-hover:scale-105"
        style={{
          backgroundColor: 'rgba(40,30,22,0.9)',
          borderColor: active ? gold : `${gold}44`,
          boxShadow: active ? `0 0 20px ${gold}88` : 'none',
        }}
      >
        {emoji}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-wide text-center leading-tight" style={{ color: active ? gold : 'rgba(255,240,220,0.7)' }}>
        {label}
      </span>
    </button>
  );
}
