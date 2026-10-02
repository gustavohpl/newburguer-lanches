import React, { useState, useEffect, useMemo } from 'react';
import { Menu, ShoppingBag, MapPin, Utensils } from 'lucide-react';
import type { Product } from '../../App';
import { useConfig } from '../../ConfigContext';
import { useFranchise } from '../../FranchiseContext';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import * as api from '../../utils/api';

// SVG do WhatsApp (mesmo traço usado no restante do site)
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

interface CleanLayoutProps {
  products: Product[];
  onAddToCart: (product: Product, notes?: string, quantity?: number, selectedAddons?: Array<{ id: string; name: string; price: number }>) => void;
  cartCount: number;
  onOpenCart: () => void;
  isStoreOpen: boolean;
}

export function CleanLayout({ products, onAddToCart, cartCount, onOpenCart, isStoreOpen }: CleanLayoutProps) {
  const { config } = useConfig();
  const { unitOverrides } = useFranchise();
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [categories, setCategories] = useState<any[]>([]);
  const [currentCategory, setCurrentCategory] = useState<string | null>(null);

  const themeColor = config.themeColor || '#d97706';
  const logo = config.logoUrl;
  const siteName = config.siteName || 'NewBurguer Lanches';
  const subtitle = config.siteSubtitle || 'Hambúrgueres artesanais, ingredientes selecionados e muito sabor em cada mordida.';

  // Valores efetivos (override de unidade > config global)
  const effectiveAddress = unitOverrides.address || config.address || '';
  const effectivePhone = unitOverrides.phone || config.phone || '';
  const effectiveHours = unitOverrides.openingHours || config.openingHours || '';
  const effectiveMapsUrl = unitOverrides.googleMapsUrl || (config as any).googleMapsUrl;
  const whatsappNumber = (config.whatsappNumber || '5564993392970').replace(/\D/g, '');

  // Imagem do hero: reaproveita a imagem de fundo do conteúdo já configurada
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
        console.error('Erro ao carregar categorias (clean)', e);
      }
    })();
  }, []);

  // "Mais Pedidos" a partir de config.popularProducts
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

  // Produtos exibidos: da categoria selecionada, ou "mais pedidos" na home
  const displayedProducts = useMemo(() => {
    if (currentCategory === null) return bestSellers;
    return products.filter((p) => p.category === currentCategory && p.available !== false);
  }, [currentCategory, products, bestSellers]);

  const scrollToMenu = () => {
    const el = document.getElementById('clean-menu');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const money = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col">
      {/* ============ BARRA DE TOPO ============ */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-zinc-200">
        <div className="container mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          {/* Menu (rola até o cardápio) + Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={scrollToMenu}
              className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 transition-colors"
              aria-label="Menu"
            >
              <Menu className="w-6 h-6 text-zinc-700" />
            </button>
            {logo ? (
              <img src={logo} alt={siteName} className="h-9 w-auto object-contain" />
            ) : (
              <span className="font-extrabold text-lg tracking-tight">{siteName}</span>
            )}
          </div>

          {/* WhatsApp + Carrinho */}
          <div className="flex items-center gap-2">
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-600 hover:text-green-600 hover:border-green-300 transition-colors"
              aria-label="WhatsApp"
            >
              <WhatsAppIcon className="w-5 h-5" />
            </a>
            <button
              onClick={onOpenCart}
              className="relative w-10 h-10 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-700 hover:bg-zinc-100 transition-colors"
              aria-label="Carrinho"
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full text-[11px] font-bold text-white flex items-center justify-center"
                  style={{ backgroundColor: themeColor }}
                >
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="container mx-auto max-w-6xl px-4 pt-10 pb-8">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Texto */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="h-px w-8" style={{ backgroundColor: themeColor }} />
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: themeColor }}>
                {siteName}
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight text-zinc-900">
              Sabor de verdade,
              <br />
              feito para <span style={{ color: themeColor }}>você.</span>
            </h1>

            <p className="mt-5 text-zinc-600 text-base sm:text-lg max-w-md leading-relaxed">
              {subtitle}
            </p>

            {/* Botões */}
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <button
                onClick={scrollToMenu}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: themeColor }}
              >
                <Utensils className="w-5 h-5" />
                Ver cardápio
              </button>
              {effectiveMapsUrl && (
                <a
                  href={effectiveMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold border border-zinc-300 text-zinc-800 hover:bg-zinc-100 transition-colors"
                >
                  <MapPin className="w-5 h-5" />
                  Como chegar
                </a>
              )}
            </div>
          </div>

          {/* Imagem do produto (reaproveita imagem de fundo do conteúdo) */}
          <div className="relative">
            {heroImage ? (
              <div className="rounded-3xl overflow-hidden shadow-xl bg-white">
                <ImageWithFallback
                  src={heroImage}
                  alt={siteName}
                  className="w-full h-64 sm:h-80 md:h-96 object-cover"
                />
              </div>
            ) : logo ? (
              <div className="flex justify-center">
                <img src={logo} alt={siteName} className="h-64 w-auto object-contain drop-shadow-xl" />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ============ CATEGORIAS (simples por enquanto — refinado na Etapa 3) ============ */}
      <section id="clean-menu" className="container mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCurrentCategory(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentCategory === null ? 'text-white' : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
            }`}
            style={currentCategory === null ? { backgroundColor: themeColor } : undefined}
          >
            Mais Pedidos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCurrentCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentCategory === cat.id ? 'text-white' : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
              }`}
              style={currentCategory === cat.id ? { backgroundColor: themeColor } : undefined}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* ============ GRADE DE PRODUTOS ============ */}
      <main className="flex-1 container mx-auto max-w-6xl px-4 pb-16">
        {displayedProducts.length === 0 ? (
          <p className="text-zinc-500 py-10 text-center">Nenhum produto nesta categoria ainda.</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {displayedProducts.map((product) => {
              const img = product.imageUrl || product.image;
              return (
                <div
                  key={product.id}
                  className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                >
                  {img && (
                    <div className="aspect-square overflow-hidden bg-zinc-100">
                      <ImageWithFallback src={img} alt={product.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-3 flex flex-col flex-1">
                    <h3 className="font-semibold text-zinc-800 text-sm leading-snug line-clamp-2">{product.name}</h3>
                    <div className="mt-auto pt-3 flex items-center justify-between">
                      <span className="font-bold text-zinc-900">{money(product.price)}</span>
                      <button
                        onClick={() => onAddToCart(product)}
                        disabled={!isStoreOpen}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm hover:opacity-90 transition-opacity disabled:opacity-40"
                        style={{ backgroundColor: themeColor }}
                        aria-label={`Adicionar ${product.name}`}
                      >
                        <span className="text-xl leading-none">+</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
