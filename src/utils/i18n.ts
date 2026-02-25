// ==========================================
// 🌐 SISTEMA i18n — Internacionalização
// Suporta pt-BR (padrão) e en-US
// ==========================================

export type Locale = 'pt-BR' | 'en-US';

// Tipo recursivo para o dicionário de strings
type TranslationValue = string | Record<string, TranslationValue>;
export type TranslationDictionary = Record<string, TranslationValue>;

// ---- Localidades disponíveis ----

const ptBR: TranslationDictionary = {
  common: {
    loading: 'Carregando...',
    error: 'Erro',
    success: 'Sucesso',
    save: 'Salvar',
    cancel: 'Cancelar',
    delete: 'Excluir',
    edit: 'Editar',
    add: 'Adicionar',
    close: 'Fechar',
    confirm: 'Confirmar',
    back: 'Voltar',
    search: 'Buscar',
    filter: 'Filtrar',
    noResults: 'Nenhum resultado encontrado',
    yes: 'Sim',
    no: 'Não',
    or: 'ou',
    of: 'de',
    all: 'Todos',
  },
  auth: {
    login: 'Entrar',
    logout: 'Sair',
    password: 'Senha',
    username: 'Usuário',
    loginError: 'Senha incorreta',
    loginSuccess: 'Login realizado com sucesso',
    sessionExpired: 'Sessão expirada. Faça login novamente.',
    tooManyAttempts: 'Muitas tentativas. Tente novamente em {minutes} minutos.',
    accessDenied: 'Acesso negado.',
  },
  nav: {
    home: 'Início',
    menu: 'Cardápio',
    orders: 'Pedidos',
    cart: 'Carrinho',
    profile: 'Perfil',
    admin: 'Painel Admin',
    master: 'Painel Master',
    delivery: 'Entregas',
    settings: 'Configurações',
  },
  products: {
    addToCart: 'Adicionar',
    addToCartWithQty: 'Adicionar ({qty})',
    price: 'Preço',
    description: 'Descrição',
    ingredients: 'Ingredientes',
    unavailable: 'Indisponível',
    outOfStock: 'Sem estoque',
    category: 'Categoria',
    categories: 'Categorias',
    allCategories: 'Todas as categorias',
    topRated: 'Mais bem avaliados',
    promotions: 'Promoções',
    noProducts: 'Nenhum produto encontrado.',
  },
  cart: {
    title: 'Seu Carrinho',
    empty: 'Seu carrinho está vazio',
    subtotal: 'Subtotal',
    deliveryFee: 'Taxa de entrega',
    discount: 'Desconto',
    total: 'Total',
    checkout: 'Finalizar Pedido',
    remove: 'Remover',
    quantity: 'Quantidade',
    coupon: 'Cupom',
    applyCoupon: 'Aplicar cupom',
    couponApplied: 'Cupom aplicado!',
    couponInvalid: 'Cupom inválido ou expirado',
    couponExpired: 'Cupom expirado',
  },
  orders: {
    title: 'Meus Pedidos',
    newOrder: 'Novo Pedido',
    orderId: 'Pedido',
    status: 'Status',
    createdAt: 'Criado em',
    pending: 'Pendente',
    confirmed: 'Confirmado',
    preparing: 'Preparando',
    ready: 'Pronto',
    outForDelivery: 'Saiu para entrega',
    completed: 'Concluído',
    cancelled: 'Cancelado',
    trackOrder: 'Acompanhar',
    noOrders: 'Nenhum pedido encontrado.',
    review: 'Avaliar',
    reviewed: 'Avaliado',
  },
  checkout: {
    title: 'Finalizar Pedido',
    name: 'Nome',
    phone: 'Telefone',
    address: 'Endereço',
    reference: 'Referência',
    notes: 'Observações',
    deliveryType: 'Tipo de entrega',
    delivery: 'Entrega',
    pickup: 'Retirada',
    dineIn: 'No local',
    paymentMethod: 'Forma de pagamento',
    cash: 'Dinheiro',
    card: 'Cartão',
    pix: 'PIX',
    change: 'Troco para',
    placeOrder: 'Confirmar Pedido',
    orderPlaced: 'Pedido realizado com sucesso!',
    orderError: 'Erro ao realizar pedido',
  },
  delivery: {
    driver: 'Entregador',
    drivers: 'Entregadores',
    online: 'Online',
    offline: 'Offline',
    assignDriver: 'Atribuir entregador',
    deliveriesToday: 'Entregas hoje',
    deliveriesMonth: 'Entregas no mês',
    deliveriesTotal: 'Total de entregas',
    estimatedTime: 'Tempo estimado',
    sectors: 'Setores de entrega',
  },
  stock: {
    title: 'Estoque',
    ingredients: 'Ingredientes',
    lowStock: 'Estoque baixo',
    outOfStock: 'Sem estoque',
    restock: 'Reabastecer',
    quantity: 'Quantidade',
    unit: 'Unidade',
    cost: 'Custo',
    report: 'Relatório',
  },
  security: {
    auditLogs: 'Logs de Auditoria',
    blacklist: 'Lista Negra',
    whitelist: 'Lista Branca',
    ipReputation: 'Reputação de IP',
    threats: 'Ameaças',
    analytics: 'Analytics de Segurança',
    webhooks: 'Webhooks',
    vpnDetected: 'VPN Detectada',
    healthScore: 'Score de Saúde',
  },
  tests: {
    title: 'Testes',
    run: 'Executar Testes',
    running: 'Executando...',
    passed: 'Aprovados',
    failed: 'Falharam',
    history: 'Histórico',
    e2e: 'Testes E2E',
  },
  store: {
    open: 'Loja Aberta',
    closed: 'Loja Fechada',
    storeClosed: 'Estamos fechados no momento.',
  },
  time: {
    minutes: 'min',
    hours: 'h',
    days: 'dias',
    ago: 'atrás',
    justNow: 'agora mesmo',
  },
};

const enUS: TranslationDictionary = {
  common: {
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    close: 'Close',
    confirm: 'Confirm',
    back: 'Back',
    search: 'Search',
    filter: 'Filter',
    noResults: 'No results found',
    yes: 'Yes',
    no: 'No',
    or: 'or',
    of: 'of',
    all: 'All',
  },
  auth: {
    login: 'Sign In',
    logout: 'Sign Out',
    password: 'Password',
    username: 'Username',
    loginError: 'Incorrect password',
    loginSuccess: 'Login successful',
    sessionExpired: 'Session expired. Please sign in again.',
    tooManyAttempts: 'Too many attempts. Try again in {minutes} minutes.',
    accessDenied: 'Access denied.',
  },
  nav: {
    home: 'Home',
    menu: 'Menu',
    orders: 'Orders',
    cart: 'Cart',
    profile: 'Profile',
    admin: 'Admin Panel',
    master: 'Master Panel',
    delivery: 'Delivery',
    settings: 'Settings',
  },
  products: {
    addToCart: 'Add',
    addToCartWithQty: 'Add ({qty})',
    price: 'Price',
    description: 'Description',
    ingredients: 'Ingredients',
    unavailable: 'Unavailable',
    outOfStock: 'Out of stock',
    category: 'Category',
    categories: 'Categories',
    allCategories: 'All categories',
    topRated: 'Top rated',
    promotions: 'Promotions',
    noProducts: 'No products found.',
  },
  cart: {
    title: 'Your Cart',
    empty: 'Your cart is empty',
    subtotal: 'Subtotal',
    deliveryFee: 'Delivery fee',
    discount: 'Discount',
    total: 'Total',
    checkout: 'Checkout',
    remove: 'Remove',
    quantity: 'Quantity',
    coupon: 'Coupon',
    applyCoupon: 'Apply coupon',
    couponApplied: 'Coupon applied!',
    couponInvalid: 'Invalid or expired coupon',
    couponExpired: 'Expired coupon',
  },
  orders: {
    title: 'My Orders',
    newOrder: 'New Order',
    orderId: 'Order',
    status: 'Status',
    createdAt: 'Created at',
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    ready: 'Ready',
    outForDelivery: 'Out for delivery',
    completed: 'Completed',
    cancelled: 'Cancelled',
    trackOrder: 'Track',
    noOrders: 'No orders found.',
    review: 'Review',
    reviewed: 'Reviewed',
  },
  checkout: {
    title: 'Checkout',
    name: 'Name',
    phone: 'Phone',
    address: 'Address',
    reference: 'Reference',
    notes: 'Notes',
    deliveryType: 'Delivery type',
    delivery: 'Delivery',
    pickup: 'Pickup',
    dineIn: 'Dine-in',
    paymentMethod: 'Payment method',
    cash: 'Cash',
    card: 'Card',
    pix: 'PIX',
    change: 'Change for',
    placeOrder: 'Place Order',
    orderPlaced: 'Order placed successfully!',
    orderError: 'Error placing order',
  },
  delivery: {
    driver: 'Driver',
    drivers: 'Drivers',
    online: 'Online',
    offline: 'Offline',
    assignDriver: 'Assign driver',
    deliveriesToday: 'Deliveries today',
    deliveriesMonth: 'Deliveries this month',
    deliveriesTotal: 'Total deliveries',
    estimatedTime: 'Estimated time',
    sectors: 'Delivery sectors',
  },
  stock: {
    title: 'Stock',
    ingredients: 'Ingredients',
    lowStock: 'Low stock',
    outOfStock: 'Out of stock',
    restock: 'Restock',
    quantity: 'Quantity',
    unit: 'Unit',
    cost: 'Cost',
    report: 'Report',
  },
  security: {
    auditLogs: 'Audit Logs',
    blacklist: 'Blacklist',
    whitelist: 'Whitelist',
    ipReputation: 'IP Reputation',
    threats: 'Threats',
    analytics: 'Security Analytics',
    webhooks: 'Webhooks',
    vpnDetected: 'VPN Detected',
    healthScore: 'Health Score',
  },
  tests: {
    title: 'Tests',
    run: 'Run Tests',
    running: 'Running...',
    passed: 'Passed',
    failed: 'Failed',
    history: 'History',
    e2e: 'E2E Tests',
  },
  store: {
    open: 'Store Open',
    closed: 'Store Closed',
    storeClosed: 'We are currently closed.',
  },
  time: {
    minutes: 'min',
    hours: 'h',
    days: 'days',
    ago: 'ago',
    justNow: 'just now',
  },
};

// ---- Registry ----

const locales: Record<Locale, TranslationDictionary> = {
  'pt-BR': ptBR,
  'en-US': enUS,
};

// ---- Engine ----

let currentLocale: Locale = 'pt-BR';
let listeners: Array<() => void> = [];

export function setLocale(locale: Locale): void {
  if (locales[locale]) {
    currentLocale = locale;
    listeners.forEach(fn => fn());
  }
}

export function getLocale(): Locale {
  return currentLocale;
}

export function getAvailableLocales(): Locale[] {
  return Object.keys(locales) as Locale[];
}

export function subscribe(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter(l => l !== fn);
  };
}

/**
 * Recupera uma string traduzida por chave "dotted" (ex: "products.addToCart").
 * Suporta interpolação simples: t('auth.tooManyAttempts', { minutes: '5' })
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = locales[currentLocale] || locales['pt-BR'];
  const parts = key.split('.');
  let value: TranslationValue | undefined = dict;

  for (const part of parts) {
    if (typeof value === 'object' && value !== null && part in value) {
      value = (value as Record<string, TranslationValue>)[part];
    } else {
      // Key not found — return the key itself as fallback
      return key;
    }
  }

  if (typeof value !== 'string') return key;

  // Interpolação: substitui {param} pelo valor
  if (params) {
    let result = value;
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
    return result;
  }

  return value;
}
