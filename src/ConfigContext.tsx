import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as api from './utils/api';
import { applyTheme } from './utils/themeUtils';

export interface SystemConfig {
  siteName: string;
  themeColor: string;
  phone: string;
  address: string;
  googleMapsUrl?: string;
  logoUrl?: string;
  headerBackgroundUrl?: string;
  headerBackgroundMobileUrl?: string; // Imagem do header para mobile
  headerEffectShape?: string; // Formato do efeito no header
  headerEffectCount?: number; // Quantidade de efeitos pulsantes (1-15)
  headerEffectRandomPosition?: boolean; // Se true, posiciona aleatoriamente
  headerEffectRandomSeed?: number; // Seed para gerar posições aleatórias diferentes
  siteSubtitle?: string; // Subtítulo do site
  siteEmoji?: string; // Emoji do site (ao lado do nome)
  openingHours?: string; // Texto de horário de funcionamento
  isOpen: boolean;
  deliveryFee: number;
  uiOpacity?: number; // Opacidade dos elementos de UI (0-100)
  useCategoryColorInModals?: boolean; // Usar cor da categoria nos modais de produto
  whatsappNumber?: string;
  instagramUrl?: string;
  automaticPayment?: boolean; // Flag se pagamento automático está ativado pelo ADMIN
  manualPixKey?: string; // Chave PIX manual configurada pelo MASTER
  hasPagSeguro?: boolean; // (Depreciado, usar automaticPayment) Flag pública se tem pagamento ativado
  hasPagSeguroToken?: boolean; // Flag se o TOKEN do PagSeguro está configurado no backend
  categories?: Array<{ id: string; label: string; color?: string; emoji?: string; }>; // Categorias personalizadas (com cor)
  features?: {
    thermalPrinter?: boolean;
    coupons?: boolean;
    reviews?: boolean;
    orderTracking?: boolean;
    paidTraffic?: boolean;
    automaticPaymentAllowed?: boolean;
    deliverySystem?: boolean;
    dineIn?: boolean;
    stockControl?: boolean; // Sistema de controle de estoque
  };
  // Campos privados (só existem no master config, não no public)
  pagSeguroToken?: string;
  pagSeguroEmail?: string; // Email da conta PagSeguro (necessário para API)
  metaPixelId?: string;
  adminUsername?: string;
  // Temas (Modo Escuro / Cores Customizadas)
  backgroundColor?: string;
  cardColor?: string;
  textColor?: string;
  forceDarkMode?: boolean; // 🌓 NOVO: Forçar modo claro ou escuro
  // Fundo da área de conteúdo (produtos)
  contentBackgroundUrl?: string;
  contentBackgroundMobileUrl?: string; // Imagem de fundo para mobile
  bgAnimationEnabled?: boolean; // Ken Burns animation on/off
  // Banner entre boas-vindas e promoções
  homeBannerUrl?: string;
  homeBannerLink?: string;
  homeBanners?: Array<{ imageUrl: string; link?: string }>;
  hiddenBestSellers?: string[]; // IDs de produtos ocultos dos "Mais Pedidos"
  popularProducts?: Array<{ productId: string; count: number }>; // Lista de populares (salva pelo admin)
  popularUpdatedAt?: string;
  noveltyProductIds?: string[]; // IDs de produtos selecionados como "Novidades"
  socialMediaColors?: Record<string, string>; // Cores personalizadas dos ícones de redes sociais
  // Banner cards antes do footer
  bannerCards?: Array<{ imageUrl: string; link?: string }>;
  // Redes sociais
  socialMedia?: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    youtube?: string;
    twitter?: string;
  };
  // Sistema de Franquias (SaaS)
  franchise?: {
    enabled: boolean;
    cities: FranchiseCity[];
    switchPassword?: string; // Senha para admin trocar de franquia
  };
}

// Tipo de cidade no sistema de franquias
export interface FranchiseCity {
  id: string;        // slug: "goiatuba", "jatai"
  name: string;      // "Goiatuba"
  units: FranchiseUnit[]; // Franquias/unidades da cidade
}

// Tipo de unidade/franquia dentro de uma cidade
export interface FranchiseUnit {
  id: string;         // slug: "centro-goiatuba"
  name: string;       // "NewBurguer Centro"
  phone: string;
  address: string;
  googleMapsUrl?: string;
  openingHours?: string;
  deliveryFee?: number;
  isOpen?: boolean;
  sectors?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
}

interface ConfigContextType {
  config: SystemConfig;
  loading: boolean;
  refreshConfig: () => Promise<void>;
  updateConfigLocal: (newConfig: Partial<SystemConfig>) => void;
}

const DEFAULT_CONFIG: SystemConfig = {
  siteName: 'NewBurguer Lanches',
  themeColor: '#d97706', // amber-600
  phone: '(64) 99339-2970',
  address: 'Praça Lucio Prado - Goiatuba/GO',
  isOpen: true,
  deliveryFee: 5.00,
  uiOpacity: 35 // Valor padrão - efeito glass/vidro
};

const ConfigContext = createContext<ConfigContextType>({
  config: DEFAULT_CONFIG,
  loading: true,
  refreshConfig: async () => {},
  updateConfigLocal: () => {}
});

export const useConfig = () => useContext(ConfigContext);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SystemConfig>(() => {
    // Tentar carregar do localStorage SÍNCRONO na inicialização para evitar Flash of Default Content
    try {
      const local = localStorage.getItem('faroeste_system_config');
      if (local) {
        const parsed = JSON.parse(local);
        // Aplicar tema imediatamente se existir no localstorage
        if (parsed.themeColor) {
          applyTheme(parsed.themeColor, {
            backgroundColor: parsed.backgroundColor,
            cardColor: parsed.cardColor,
            textColor: parsed.textColor
          });
        }
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (e) {
      console.error('Erro ao ler config local:', e);
    }
    return DEFAULT_CONFIG;
  });

  const [loading, setLoading] = useState(true);

  const refreshConfig = async () => {
    try {
      const response = await api.getPublicConfig();
      console.log('🔧 [CONFIG CONTEXT] Resposta do servidor:', response);
      console.log('📋 [CONFIG CONTEXT] Categorias recebidas:', response?.config?.categories);
      
      if (response.success && response.config) {
        setConfig(prev => ({ ...prev, ...response.config }));
        
        // Salvar no localStorage para próxima vez ser instantâneo
        localStorage.setItem('faroeste_system_config', JSON.stringify(response.config));

        // Aplicar tema
        if (response.config.themeColor) {
          applyTheme(response.config.themeColor, {
            backgroundColor: response.config.backgroundColor,
            cardColor: response.config.cardColor,
            textColor: response.config.textColor
          });
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateConfigLocal = (newConfig: Partial<SystemConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...newConfig };
      if (newConfig.themeColor || newConfig.backgroundColor || newConfig.cardColor || newConfig.textColor) {
        applyTheme(updated.themeColor || prev.themeColor, {
          backgroundColor: updated.backgroundColor || prev.backgroundColor,
          cardColor: updated.cardColor || prev.cardColor,
          textColor: updated.textColor || prev.textColor
        });
      }
      return updated;
    });
  };

  useEffect(() => {
    refreshConfig();
  }, []);

  // Se estiver carregando e não tivermos nenhuma config salva (está usando default),
  // mostramos um loader para evitar o "Flash of Default Content" (FOUC) com dados incorretos.
  // Se já tiver config do localStorage, mostra ela enquanto atualiza em background (stale-while-revalidate).
  const hasLocalConfig = typeof localStorage !== 'undefined' && !!localStorage.getItem('faroeste_system_config');
  
  if (loading && !hasLocalConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <ConfigContext.Provider value={{ config, loading, refreshConfig, updateConfigLocal }}>
      {children}
    </ConfigContext.Provider>
  );
}