import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { StatusBar } from './components/StatusBar';
import { CategoryNav } from './components/CategoryNav';
import { CategoryPage } from './components/CategoryPage';
import { HomePage } from './components/HomePage';
import { Footer } from './components/Footer';
import { Cart } from './components/Cart';
import { MiniCart } from './components/MiniCart';
import { CheckoutModal } from './components/CheckoutModal';
import { OrderTracking } from './components/OrderTracking';
import { OrderSearchModal } from './components/OrderSearchModal';
import { OrderSuccessModal } from './components/OrderSuccessModal';
import { OrderConfirmedModal } from './components/OrderConfirmedModal';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { PrinterProvider } from './components/PrinterManager';
import { Toaster, toast } from 'sonner';
import * as api from './utils/api';
import { projectId, publicAnonKey } from './utils/supabase/info';
import { MetaPixel } from './components/MetaPixel';
import { ConfigProvider, useConfig } from './ConfigContext';
import { FranchiseProvider, useFranchise } from './FranchiseContext';
import { FranchiseSelectionModal } from './components/FranchiseSelectionModal';
import { MasterDashboard } from './components/master/MasterDashboard';
import { DeliverymanPage } from './components/delivery/DeliverymanPage';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string | null;
  image?: string | null; // Alias legado para imageUrl
  available?: boolean;
  featuredRating?: boolean; // Se true, aparece fixo no Top 3 Avaliados
  ingredientsText?: string; // Ingredientes digitados manualmente (quando stockControl OFF)
  // Promoções (combos)
  promoItems?: Array<{ productId: string; productName: string; originalPrice: number }>;
  originalTotal?: number;
  recipe?: {
    ingredients: Array<{
      ingredientId: string;
      ingredientName?: string;
      quantityUsed: number;
      hideFromClient: boolean;
      category?: 'ingredient' | 'embalagem' | 'acompanhamento';
      defaultQuantityPerOrder?: number;
      selectedPortionId?: string;
      selectedPortionG?: number;
      selectedPortionLabel?: string;
    }>;
    extras: Array<{
      name: string;
      hideFromClient: boolean;
    }>;
  };
}

export interface CartItem extends Product {
  quantity: number;
  notes?: string; // Campo de observações
  selectedAcompanhamentos?: string[]; // IDs dos acompanhamentos selecionados pelo cliente
}

import { useCustomer } from './hooks/useCustomer';

function AppContent() {
  const { config, updateConfigLocal } = useConfig();
  const { unitOverrides, franchiseEnabled, selectedUnit, needsSelection } = useFranchise();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  
  // Hook de cliente
  const { customer, isAuthenticated } = useCustomer();
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<string | null>(null);
  const [orderHistory, setOrderHistory] = useState<Product[]>([]);
  const [isOrderSearchOpen, setIsOrderSearchOpen] = useState(false);
  const [isOrderTrackingOpen, setIsOrderTrackingOpen] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string>('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [showMaster, setShowMaster] = useState(false); // Estado para painel master
  const [showDelivery, setShowDelivery] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [serverError, setServerError] = useState(false);
  const [isInitializingServer, setIsInitializingServer] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isStoreOpen, setIsStoreOpen] = useState(true);
  const [deliveryFee, setDeliveryFee] = useState(5.00);
  
  // 🏙️ Valores efetivos: quando franquia ativa, unidade override config global
  const effectiveIsOpen = unitOverrides.isOpen !== undefined ? unitOverrides.isOpen : isStoreOpen;
  const effectiveDeliveryFee = unitOverrides.deliveryFee !== undefined ? unitOverrides.deliveryFee : deliveryFee;
  
  // 🌓 DETECÇÃO DE MODO ESCURO PARA O CLIENTE
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  useEffect(() => {
    // 1. Se houver configuração explícita no banco, ela ganha de tudo
    if (config.forceDarkMode !== undefined) {
      console.log('🌓 [THEME] Forçando modo:', config.forceDarkMode ? 'DARK' : 'LIGHT');
      setIsDarkMode(config.forceDarkMode);
      return;
    }

    // 2. Se não houver, verificar se a cor de fundo configurada é escura
    if (config.backgroundColor) {
      const hex = config.backgroundColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      
      console.log('[THEME] Brilho do fundo:', brightness);
      if (brightness < 128) {
        setIsDarkMode(true);
        return;
      }
    }

    // 3. Fallback final: Preferência do Sistema
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = () => {
      if (config.forceDarkMode === undefined) {
        setIsDarkMode(mediaQuery.matches);
      }
    };
    
    updateTheme();
    mediaQuery.addEventListener('change', updateTheme);
    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, [config.forceDarkMode, config.backgroundColor]);

  // Estados para modal de sucesso do pedido
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [completedOrderData, setCompletedOrderData] = useState<{orderId: string; total: number; phone?: string} | null>(null);

  // 🏥 HEALTH CHECK - Testar conectividade com o servidor
  useEffect(() => {
    const testServerConnection = async () => {
      const response = await api.checkHealth();
      
      if (response.success) {
        console.log('✅ [HEALTH CHECK] Servidor respondendo!', response);
        if (response.version) console.log('🚀 [HEALTH CHECK] Versão do servidor:', response.version);
      } else {
        console.log('⚠️ [HEALTH CHECK] Servidor indisponível ou iniciando (Offline Mode Ativo)');
      }
    };
    
    testServerConnection();
  }, []); // Executa apenas uma vez ao carregar

  // 🔔 POLLING PARA DETECTAR CONFIRMAÇÃO DE PAGAMENTO PELO ADMIN
  useEffect(() => {
    // 🛡️ Não rodar polling de cliente em rotas admin/master/entrega
    const path = window.location.pathname;
    if (path === '/admin' || path === '/master' || path === '/entrega') {
      console.log('⚠️ [POLLING] Polling de cliente desativado - rota administrativa ativa');
      return;
    }

    // Só fazer polling se tiver telefone do cliente (identificado)
    const customerPhone = localStorage.getItem('faroeste_customer_phone');
    console.log('🔔 [POLLING] Iniciando sistema de polling - Telefone:', customerPhone);
    
    if (!customerPhone) {
      console.log('⚠️ [POLLING] Polling desativado - sem telefone do cliente');
      return;
    }

    const checkPendingOrders = async () => {
      try {
        console.log('🔍 [POLLING] Verificando pedidos...');
        // Buscar pedidos do cliente
        const response = await api.searchOrdersByPhone(customerPhone);
        console.log('📦 [POLLING] Resposta da API:', response);
        
        if (response.success && response.orders) {
          console.log('📋 [POLLING] Total de pedidos encontrados:', response.orders.length);
          
          // Verificar se existe algum pedido que mudou de pending para preparing
          const pendingOrdersKey = 'faroeste_pending_orders';
          const previousPendingOrders = JSON.parse(localStorage.getItem(pendingOrdersKey) || '{}');
          
          response.orders.forEach((order: any) => {
            const wasTracking = previousPendingOrders[order.orderId];
            
            // LÓGICA DE DETECÇÃO DE CONFIRMAÇÃO MELHORADA
            // O modal deve aparecer se:
            // 1. O pedido está "preparing" (confirmado)
            // 2. É um pedido recente (menos de 4 horas)
            // 3. O modal ainda não foi mostrado para este ID OU a página acabou de recarregar
            
            const isRecent = (Date.now() - new Date(order.createdAt).getTime()) < 14400000; // 4 horas
            const isConfirmedStatus = order.status === 'preparing' || 
                                      order.status === 'ready_for_pickup' || 
                                      order.status === 'ready_for_delivery' || 
                                      order.status === 'out_for_delivery';
            
            // 🔥 CORREÇÃO: Se a página foi recarregada (showSuccessModal = false e modal não está aberto),
            // permitir mostrar o modal novamente para pedidos confirmados recentes
            const modalKey = `modal_shown_${order.orderId}`;
            const hasShownModal = localStorage.getItem(modalKey) === 'true';
            const modalClosedManually = localStorage.getItem(`${modalKey}_closed`) === 'true';
            
            // 🚀 NOVA LÓGICA: Só resetar a flag se:
            // 1. O pedido foi confirmado recentemente
            // 2. O modal não está sendo exibido
            // 3. O usuário NÃO fechou manualmente o modal (evita loop infinito)
            if (isConfirmedStatus && isRecent && !showSuccessModal && !modalClosedManually) {
              // Limpar a flag se o modal não está sendo exibido no momento
              // Isso permite que após reload, o modal apareça novamente
              if (hasShownModal) {
                console.log(`🔄 [POLLING] Resetando flag de modal para pedido ${order.orderId} (página recarregada)`);
                localStorage.removeItem(modalKey);
              }
            }
            
            const shouldShowModal = localStorage.getItem(modalKey) !== 'true' && !modalClosedManually;
            
            console.log(`🔍 [POLLING] Verificando pedido ${order.orderId}:`, {
              status: order.status,
              isRecent,
              isConfirmedStatus,
              shouldShowModal,
              showSuccessModal
            });
            
            if (isConfirmedStatus && isRecent && shouldShowModal && !showSuccessModal) {
              
              console.log('🎉 [POLLING] Pedido confirmado detectado:', order.orderId);
              
              // Marcar que mostramos para não repetir
              localStorage.setItem(modalKey, 'true');
              
              // Disparar modal de sucesso com TODOS os dados necessários
              setCompletedOrderData({
                orderId: order.orderId,
                customerName: order.customerName,
                total: order.total,
                paymentMethod: order.paymentMethod,
                deliveryType: order.deliveryType, // ✅ Adicionado
                address: order.address, // ✅ Adicionado
                isAutomatic: false,
                timestamp: Date.now()
              });
              setShowSuccessModal(true);
              console.log('✅ [POLLING] Modal disparado com sucesso!');
              console.log('📊 [POLLING] showSuccessModal agora é:', true);
              console.log('📦 [POLLING] completedOrderData:', {
                orderId: order.orderId,
                customerName: order.customerName,
                total: order.total,
                deliveryType: order.deliveryType,
                address: order.address
              });
              
              // Sincronizar histórico de PRODUTOS (para "Peça de Novo")
              if (order.items && order.items.length > 0) {
                  const historyKey = 'faroeste_order_history';
                  const currentHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
                  
                  // Adicionar itens do pedido ao histórico se não existirem
                  const newItems = order.items.map((item: any) => ({
                      id: item.id || `hist_${Date.now()}_${Math.random()}`, // Fallback ID
                      name: item.name,
                      description: item.notes || '',
                      price: item.price,
                      category: 'Histórico',
                      imageUrl: null
                  }));
                  
                  // Mesclar e manter únicos por nome
                  const merged = [...newItems, ...currentHistory];
                  const uniqueHistory = Array.from(new Map(merged.map(item => [item.name, item])).values()).slice(0, 12);
                  
                  localStorage.setItem(historyKey, JSON.stringify(uniqueHistory));
                  setOrderHistory(uniqueHistory);
              }

              // Salvar também em faroeste_my_orders para histórico de pedidos
              const myOrdersKey = 'faroeste_my_orders';
              const myOrders = JSON.parse(localStorage.getItem(myOrdersKey) || '[]');
              const orderExists = myOrders.some((o: any) => o.orderId === order.orderId);
              
              if (!orderExists) {
                  myOrders.unshift({
                      orderId: order.orderId,
                      customerName: order.customerName,
                      customerPhone: order.customerPhone,
                      total: order.total,
                      deliveryType: order.deliveryType,
                      status: order.status,
                      createdAt: order.createdAt,
                      itemCount: order.items.length
                  });
                  localStorage.setItem(myOrdersKey, JSON.stringify(myOrders.slice(0, 50)));
              }
            }
            
            // Atualizar tracking de pedidos pendentes
            if (order.status === 'pending') {
              previousPendingOrders[order.orderId] = 'pending';
            }
          });
          
          // Salvar lista atualizada
          localStorage.setItem(pendingOrdersKey, JSON.stringify(previousPendingOrders));
        }
      } catch (error) {
        console.error('❌ [POLLING] Erro ao verificar pedidos:', error);
      }
    };

    // Verificar imediatamente
    console.log('▶️ [POLLING] Primeira verificação...');
    checkPendingOrders();
    
    // Verificar a cada 5 segundos
    console.log('⏱️ [POLLING] Configurando intervalo de 5 segundos');
    const interval = setInterval(checkPendingOrders, 5000);
    
    return () => clearInterval(interval);
  }, [customer]); // Dependência: customer

  // Verificar parâmetros de URL (Cupons e UTMs)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cupomURL = params.get('cupom');
    const utmSource = params.get('utm_source');
    
    if (cupomURL) {
      // 1. Salvar cupom no localStorage ou estado (para aplicar no checkout)
      localStorage.setItem('faroeste_cupom_ativo', cupomURL);
      
      // 2. Mostrar notificação ao usuário
      toast.success(`Cupom ${cupomURL} aplicado com sucesso! 🎉`, {
        duration: 5000,
        position: 'top-center'
      });
      
      // 3. Limpar URL (para não reaplicar no refresh)
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
    
    // 4. Salvar UTMs no sessionStorage para usar depois no checkout
    if (utmSource) {
      sessionStorage.setItem('utm_tracking', JSON.stringify({
        utm_source: utmSource,
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
        utm_content: params.get('utm_content'),
        utm_term: params.get('utm_term')
      }));
    }
  }, []);

  // Update Title
  useEffect(() => {
    if (config.siteName) {
      document.title = config.siteName?.replace(/\p{Emoji}/gu, '').trim() || 'NewBurguer';
    }
  }, [config.siteName]);

  // Verificar rota /master
  useEffect(() => {
    if (window.location.pathname === '/master') {
      setShowMaster(true);
    }
  }, []);

  // Verificar rota /entrega
  useEffect(() => {
    if (window.location.pathname === '/entrega' && config.features?.deliverySystem !== false) {
      setShowDelivery(true);
    }
  }, [config.features]);

  // Verificar rota /admin (pathname-based, como /master e /entrega)
  useEffect(() => {
    const checkRoute = () => {
      const isAdminRoute = window.location.pathname === '/admin';
      setShowAdmin(isAdminRoute);
      
      // Limpar erro do servidor quando entrar no admin
      if (isAdminRoute) {
        setServerError(false);
      }
      
      // APENAS restaurar autenticação se:
      // 1. Estiver na rota /admin
      // 2. Houver autenticação salva no sessionStorage
      if (isAdminRoute) {
        const savedAuth = sessionStorage.getItem('faroeste_admin_auth') === 'true';
        setIsAdminAuthenticated(savedAuth);
      } else {
        // Se sair da rota /admin, limpar autenticação
        setIsAdminAuthenticated(false);
      }
    };
    
    // Executar na inicialização
    checkRoute();
    
    // Escutar mudanças de navegação (botão voltar/avançar do navegador)
    window.addEventListener('popstate', checkRoute);
    
    // 🛡️ Escutar expiração de sessão admin (disparado por adminFetch ao receber 401/403)
    // Guard: processar apenas uma vez para evitar loops de re-render
    let sessionExpiredHandled = false;
    const handleSessionExpired = () => {
      if (sessionExpiredHandled) {
        console.log('ℹ️ [APP] Session-expired já tratado — ignorando duplicata');
        return;
      }
      sessionExpiredHandled = true;
      console.warn('⚠️ [APP] Sessão admin expirada — forçando logout');
      sessionStorage.removeItem('faroeste_admin_auth');
      setIsAdminAuthenticated(false);
      // Reset guard após 5 segundos (permite re-processar se necessário após novo login)
      setTimeout(() => { sessionExpiredHandled = false; }, 5000);
    };
    window.addEventListener('admin-session-expired', handleSessionExpired);
    
    return () => {
      window.removeEventListener('popstate', checkRoute);
      window.removeEventListener('admin-session-expired', handleSessionExpired);
    };
  }, []);

  // Salvar autenticação no sessionStorage
  useEffect(() => {
    if (isAdminAuthenticated && showAdmin) {
      sessionStorage.setItem('faroeste_admin_auth', 'true');
    } else if (!isAdminAuthenticated) {
      sessionStorage.removeItem('faroeste_admin_auth');
    }
  }, [isAdminAuthenticated, showAdmin]);

  // Carregar produtos do banco de dados
  // 🏙️ Quando franchise ativo, só carrega quando unidade estiver selecionada
  useEffect(() => {
    if (franchiseEnabled && !selectedUnit) {
      // Franchise ativo mas sem unidade: não carregar dados
      return;
    }

    loadProducts();
    loadStoreStatus();
    loadDeliveryFee();
    
    // 🔄 Auto-refresh dos produtos a cada 30 segundos (apenas se não estiver no admin)
    const productRefreshInterval = setInterval(() => {
      if (!showAdmin) {
        console.log('🔄 [AUTO-REFRESH] Atualizando produtos...');
        loadProducts();
        loadDeliveryFee(); // 🆕 Atualizar taxa de entrega também
      }
    }, 30000); // 30 segundos
    
    // Exibir boas-vindas se cliente for reconhecido
    if (customer?.name) {
       const hasWelcomed = sessionStorage.getItem(`welcome_${customer.phone}`);
       if (!hasWelcomed) {
         toast.success(`Bem-vindo de volta, ${customer.name.split(' ')[0]}!`, {
           duration: 3000,
           position: 'top-center',
         });
         sessionStorage.setItem(`welcome_${customer.phone}`, 'true');
       }
    }
    
    // Cleanup: limpar interval quando componente desmontar ou showAdmin mudar
    return () => clearInterval(productRefreshInterval);
  }, [customer, showAdmin, selectedUnit]); // 🏙️ Recarrega ao trocar unidade

  // Carregar status da loja
  const loadStoreStatus = async () => {
    const response = await api.getStoreStatus();
    if (response.success) {
      setIsStoreOpen(response.isOpen);
    }
  };

  const loadDeliveryFee = async () => {
    const response = await api.getDeliveryFee();
    if (response.success) {
      setDeliveryFee(response.fee);
      updateConfigLocal({ deliveryFee: response.fee });
    }
  };

  const loadProducts = async () => {
    try {
      setIsLoadingProducts(true);
      
      const response = await api.getAllProducts();
      
      if (response.success && response.products) {
        let loadedProducts = response.products;
        
        // Se stockControl está ativo, filtrar produtos sem estoque (apenas para o cliente)
        if (config.features?.stockControl && !showAdmin) {
          try {
            const stockRes = await api.checkStockAvailability();
            if (stockRes.success && stockRes.unavailableProducts?.length > 0) {
              console.log('📦 [STOCK] Ocultando produtos sem estoque:', stockRes.unavailableProducts);
              loadedProducts = loadedProducts.filter(
                (p: Product) => !stockRes.unavailableProducts.includes(p.id)
              );
            }
          } catch (stockErr) {
            console.error('⚠️ [STOCK] Erro ao verificar estoque (mostrando todos):', stockErr);
          }
        }
        
        setProducts(loadedProducts);
        setServerError(false);
        setIsOfflineMode(!!response.offline);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('❌ [LOAD PRODUCTS] Erro ao carregar produtos:', error);
      console.error('❌ [LOAD PRODUCTS] Detalhes do erro:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      // Tentar verificar se é problema de CORS ou servidor
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error('❌ [LOAD PRODUCTS] Problema de conexão - Servidor pode estar offline ou problema de CORS');
        setServerError(true);
      }
      
      setProducts([]);
    } finally {
      console.log('🏁 [LOAD PRODUCTS] Finalizado');
      setIsLoadingProducts(false);
    }
  };

  // Carregar histórico de compras do localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('faroeste_order_history');
    if (savedHistory) {
      setOrderHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Bloquear acesso via domínio .figma.site - Redirecionar apenas para o domínio principal
  /* 
  useEffect(() => {
    const hostname = window.location.hostname;
    
    // Se estiver acessando via .figma.site, redirecionar para .com
    if (hostname.includes('figma.site')) {
      // window.location.replace('https://faroestelanches.com' + window.location.pathname + window.location.search + window.location.hash);
    }
  }, []);
  */

  // Detectar pedido concluído ao voltar do WhatsApp
  useEffect(() => {
    
    const timer = setTimeout(() => {
      const completedOrderStr = localStorage.getItem('faroeste_completed_order');
      
      if (completedOrderStr) {
        try {
          const orderData = JSON.parse(completedOrderStr);
          
          // Validar dados
          if (!orderData.orderId || !orderData.total) {
            console.error('❌ [APP] Dados do pedido inválidos:', orderData);
            localStorage.removeItem('faroeste_completed_order');
            return;
          }
          
          // Verificar se o pedido é recente (última 1 hora)
          const isRecent = (Date.now() - orderData.timestamp) < 3600000; // 1 hora em ms
          
          if (isRecent && !showSuccessModal) { // Verificar se modal já não está aberto
            setCompletedOrderData({
              orderId: orderData.orderId,
              customerName: orderData.customerName,
              total: orderData.total,
              paymentMethod: orderData.paymentMethod,
              isAutomatic: orderData.isAutomatic
            });
            
            // Pequeno delay para garantir que renderizou
            setTimeout(() => {
              setShowSuccessModal(true);
            }, 100);
            
            // Limpar localStorage IMEDIATAMENTE após exibir
            localStorage.removeItem('faroeste_completed_order');
          } else if (!isRecent) {
            // Se não é recente, apenas limpar
            localStorage.removeItem('faroeste_completed_order');
          }
        } catch (error) {
          console.error('❌ [APP] Erro ao processar pedido concluído:', error);
          localStorage.removeItem('faroeste_completed_order');
        }
      }
    }, 1000); // Aguardar 1 segundo
    
    return () => clearTimeout(timer);
  }, []); // Executar apenas uma vez na montagem do componente

  const handleAdminExit = () => {
    setShowAdmin(false);
    setIsAdminAuthenticated(false);
    window.history.pushState({}, '', '/');
  };

  const addToCart = (product: Product, notes?: string, quantity?: number) => {
    const qty = quantity || 1;
    setCartItems(prev => {
      const existingItem = prev.find(item => item.id === product.id && item.notes === notes);
      
      if (existingItem) {
        // Se já existe item idêntico (mesmo produto e mesmas observações), incrementa quantidade
        return prev.map(item =>
          item.id === product.id && item.notes === notes
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
      }
      
      // Se não existe ou tem observações diferentes, adiciona como novo item
      return [...prev, { ...product, quantity: qty, notes }];
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity === 0) {
      setCartItems(prev => prev.filter(item => item.id !== productId));
    } else {
      setCartItems(prev =>
        prev.map(item =>
          item.id === productId ? { ...item, quantity } : item
        )
      );
    }
  };

  const removeFromCart = (productId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== productId));
  };

  const getTotalItems = () => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getTotalPrice = () => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handleCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleOrderComplete = () => {
    // Salvar produtos do pedido no histórico
    const newHistoryItems = cartItems.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      imageUrl: item.imageUrl // Incluir imageUrl no histórico
    }));

    const updatedHistory = [...newHistoryItems, ...orderHistory];
    // Manter apenas os últimos 12 itens únicos
    const uniqueHistory = Array.from(
      new Map(updatedHistory.map(item => [item.id, item])).values()
    ).slice(0, 12);

    setOrderHistory(uniqueHistory);
    localStorage.setItem('faroeste_order_history', JSON.stringify(uniqueHistory));

    setCartItems([]);
    setIsCheckoutOpen(false);
    
    // NÃO mostrar modal aqui - ele será mostrado quando voltar do WhatsApp
    // O modal é controlado pelo localStorage no useEffect
  };

  const handleOrderCreated = () => {
    // Aqui você pode adicionar lógica para lidar com a criação do pedido
    // Por exemplo, enviar uma notificação ou atualizar o status do pedido
  };

  if (showMaster) {
    return <MasterDashboard />;
  }

  return (
    <PrinterProvider>
      <Toaster richColors position="bottom-center" />
      <MetaPixel />
      {!showAdmin && <FranchiseSelectionModal />}
      {showAdmin ? (
        <div className="min-h-screen bg-gray-100">
          {!isAdminAuthenticated ? (
            <AdminLogin onLogin={() => setIsAdminAuthenticated(true)} />
          ) : (
            <AdminDashboard onLogout={handleAdminExit} onProductsChange={loadProducts} />
          )}
        </div>
      ) : (
        <div 
          id="client-app" 
          className={`min-h-screen bg-background text-foreground flex flex-col transition-colors duration-300 ${isDarkMode ? 'dark' : ''}`}
          style={{ position: 'relative' }}
        >
          {/* Imagem de fundo fixa com zoom suave (Ken Burns) */}
          {(config.contentBackgroundUrl || config.contentBackgroundMobileUrl) && (
            <>
              {/* Preload da imagem em alta qualidade */}
              <link 
                rel="preload" 
                as="image" 
                href={(isMobile && config.contentBackgroundMobileUrl) ? config.contentBackgroundMobileUrl : config.contentBackgroundUrl} 
              />
              {config.bgAnimationEnabled !== false && (
                <style>{`
                  @keyframes kenBurns {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.06); }
                    100% { transform: scale(1); }
                  }
                `}</style>
              )}
              <div 
                className="fixed inset-0 z-0"
                style={{
                  backgroundImage: `url(${(isMobile && config.contentBackgroundMobileUrl) ? config.contentBackgroundMobileUrl : config.contentBackgroundUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center top',
                  backgroundRepeat: 'no-repeat',
                  pointerEvents: 'none',
                  imageRendering: 'auto',
                  WebkitBackfaceVisibility: 'hidden',
                  backfaceVisibility: 'hidden',
                  ...(config.bgAnimationEnabled !== false 
                    ? { animation: 'kenBurns 25s ease-in-out infinite', willChange: 'transform' } 
                    : {}),
                }}
              />
            </>
          )}
          {showDelivery ? (
            <DeliverymanPage />
          ) : (
            <div className="relative flex flex-col flex-1 z-[1]">
              <Header />

              <StatusBar 
                isStoreOpen={effectiveIsOpen}
              />

              <CategoryNav
                currentCategory={currentCategory}
                onCategoryChange={setCurrentCategory}
              />

              <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
                {currentCategory === null ? (
                  <HomePage
                    products={products}
                    onAddToCart={addToCart}
                    orderHistory={orderHistory}
                  />
                ) : (
                  <CategoryPage
                    category={currentCategory}
                    products={products.filter(p => p.category === currentCategory)}
                    onAddToCart={addToCart}
                  />
                )}
              </main>

              {/* Banner Cards antes do Footer */}
              {config.bannerCards && config.bannerCards.length > 0 && (
                <section className="w-full py-8 px-4">
                  <div className="container mx-auto max-w-6xl">
                    <div className={`grid gap-4 ${config.bannerCards.length === 1 ? 'grid-cols-1' : config.bannerCards.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                      {config.bannerCards.map((card, i) => (
                        <div key={i} className="rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all hover:scale-[1.02] cursor-pointer">
                          {card.link ? (
                            <a href={card.link} target="_blank" rel="noopener noreferrer">
                              <img src={card.imageUrl} alt={`Banner ${i + 1}`} className="w-full h-auto object-contain" />
                            </a>
                          ) : (
                            <img src={card.imageUrl} alt={`Banner ${i + 1}`} className="w-full h-auto object-contain" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              <Footer />

              <Cart
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                items={cartItems}
                onUpdateQuantity={updateQuantity}
                onRemove={removeFromCart}
                totalPrice={getTotalPrice()}
                onCheckout={handleCheckout}
              />

              <MiniCart
                items={cartItems}
                totalPrice={getTotalPrice()}
                onOpenFullCart={() => setIsCartOpen(true)}
                onRemove={removeFromCart}
                onUpdateQuantity={updateQuantity}
              />

              {/* 📋 Botão flutuante — Meus Pedidos (canto inferior esquerdo) */}
              <button
                onClick={() => setIsOrderSearchOpen(true)}
                className="fixed bottom-6 left-4 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all text-white font-bold text-sm"
                style={{ 
                  backgroundColor: config.themeColor || '#d97706',
                  boxShadow: `0 4px 20px ${config.themeColor || '#d97706'}66`
                }}
                title="Meus Pedidos"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <span className="hidden sm:inline">Meus Pedidos</span>
              </button>

              <CheckoutModal
                isOpen={isCheckoutOpen}
                onClose={() => setIsCheckoutOpen(false)}
                items={cartItems}
                totalPrice={getTotalPrice()}
                onOrderComplete={handleOrderComplete}
                onOrderCreated={handleOrderCreated}
                isStoreOpen={effectiveIsOpen}
                deliveryFee={effectiveDeliveryFee}
                allProducts={products}
              />

              <OrderSearchModal
                isOpen={isOrderSearchOpen}
                onClose={() => setIsOrderSearchOpen(false)}
                onOrderFound={(orderId) => {
                  setCurrentOrderId(orderId);
                  setIsOrderTrackingOpen(true);
                }}
              />

              <OrderTracking
                isOpen={isOrderTrackingOpen}
                onClose={() => setIsOrderTrackingOpen(false)}
                orderId={currentOrderId}
              />
              
              {/* Modal de Pedido Confirmado - Aparece quando admin confirma o pagamento */}
              {showSuccessModal && completedOrderData && (
                <OrderConfirmedModal
                  orderId={completedOrderData.orderId}
                  customerName={completedOrderData.customerName || 'Cliente'}
                  total={completedOrderData.total}
                  estimatedTime={45} // Tempo padrão, pode ser dinâmico no futuro
                  deliveryType={completedOrderData.deliveryType || 'delivery'}
                  address={completedOrderData.address}
                  enableTracking={config.features?.orderTracking !== false}
                  onClose={() => {
                    console.log('🚪 [MODAL] Usuário fechou o modal manualmente para pedido:', completedOrderData.orderId);
                    // Marcar que o usuário fechou manualmente para não reabrir
                    localStorage.setItem(`modal_shown_${completedOrderData.orderId}_closed`, 'true');
                    setShowSuccessModal(false);
                    setCompletedOrderData(null);
                  }}
                />
              )}
            </div>
          )}
        </div>
      )}
    </PrinterProvider>
  );
}

export default function App() {
  return (
    <ConfigProvider>
      <FranchiseProvider>
        <AppContent />
      </FranchiseProvider>
    </ConfigProvider>
  );
}