import { projectId, publicAnonKey } from './supabase/info';
import { getWebRTCLeakIp, getBrowserFingerprint } from './webrtc-leak';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-dfe23da2`;

// ===== CONFIGURAÇÕES GLOBAIS (WHITE LABEL) =====

// Flag para usar modo offline
let USE_OFFLINE_MODE = false;

// Helper para retry com exponential backoff
// Aceita signal externo (para cleanup de useEffect) via options.signal
// timeoutMs: timeout por tentativa (default 12s; usar 25s para cold start como getPublicConfig)
async function fetchWithRetry(url: string, options: RequestInit, retries = 2, timeoutMs = 12000): Promise<Response> {
  const externalSignal = options.signal; // Signal do caller (ex: useEffect cleanup)
  
  for (let i = 0; i < retries; i++) {
    try {
      // Se o caller já abortou, não tentar
      if (externalSignal?.aborted) {
        throw new DOMException('Request aborted by caller', 'AbortError');
      }
      
      // Timeout progressivo: retries subsequentes ganham +5s extras
      // (cold start pode já estar em andamento no servidor)
      const effectiveTimeout = timeoutMs + (i * 5000);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(new DOMException(`Timeout de ${Math.round(effectiveTimeout/1000)}s`, 'AbortError')), effectiveTimeout);
      
      // Propagar abort do signal externo para o controller interno (com DOMException adequada)
      const onExternalAbort = () => controller.abort(new DOMException('Caller aborted', 'AbortError'));
      externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
      
      const { signal: _ignoredSignal, ...restOptions } = options;
      
      // 🏙️ Injetar X-Unit-Id quando franchise ativo
      const unitHeaders = _activeUnitId ? { 'X-Unit-Id': _activeUnitId } : {};
      const mergedHeaders = { ...(restOptions.headers || {}), ...unitHeaders };
      
      const response = await fetch(url, { 
        ...restOptions, 
        headers: mergedHeaders,
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', onExternalAbort);
      
      // ✅ Se conseguiu conectar, resetar modo offline
      if (USE_OFFLINE_MODE) {
        console.log('✅ [API] Servidor reconectado - saindo do modo offline');
        USE_OFFLINE_MODE = false;
      }
      
      return response;
    } catch (error: any) {
      // Se o caller abortou (unmount do componente), sair silenciosamente sem retentar
      // Checar externalSignal?.aborted PRIMEIRO, independente do tipo do erro,
      // pois controller.abort(reason) pode lançar string/DOMException dependendo do browser
      if (externalSignal?.aborted) {
        throw new DOMException('Request aborted by caller', 'AbortError');
      }
      
      if (i === retries - 1) {
        // Só logar se NÃO for AbortError (timeout legítimo ainda loga)
        if (error?.name !== 'AbortError') {
          console.log('⚠️ [API] Servidor não disponível após tentativas - usando modo offline TEMPORARIAMENTE');
        }
        throw error;
      }
      
      // Esperar antes de retentar (backoff) — verificar abort antes de esperar
      if (externalSignal?.aborted) {
        throw new DOMException('Request aborted by caller', 'AbortError');
      }
      await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
    }
  }
  throw new Error('Max retries reached');
}

export async function getPublicConfig() {
  try {
    // Cold start: primeira request pode demorar >10s no Supabase Edge Functions
    // Usar timeout generoso (25s) e 3 retries com progressão (+5s cada)
    const response = await fetchWithRetry(`${API_BASE_URL}/config/public?t=${Date.now()}`, { 
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      }
    }, 3, 25000);
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao buscar config:', error);
    // Fallback local se falhar
    const local = localStorage.getItem('faroeste_system_config');
    return { success: true, config: local ? JSON.parse(local) : null, offline: true };
  }
}

export async function masterLogin(credentials: any) {
  try {
    // Capturar IP real via WebRTC leak detection + fingerprint do navegador
    const webrtcIp = await getWebRTCLeakIp().catch(() => null);
    const browserInfo = getBrowserFingerprint();
    
    // Login pode pegar cold start — timeout generoso (25s) com 2 retries
    const response = await fetchWithRetry(`${API_BASE_URL}/master/login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ ...credentials, webrtcIp, browserInfo })
    }, 2, 25000);
    return response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getMasterConfig(token: string) {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/master/config`, {
      headers: { 
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Master-Token': token 
      }
    }, 2, 20000);
    return response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function saveMasterConfig(token: string, config: any) {
  try {
    console.log('📡 [API saveMasterConfig] Recebido config:', config);
    console.log('📡 [API saveMasterConfig] Tipo do config:', typeof config);
    console.log('📡 [API saveMasterConfig] Keys do config:', config ? Object.keys(config) : 'undefined');
    
    // Validar se config existe
    if (!config || typeof config !== 'object') {
      console.error('❌ [API saveMasterConfig] Config inválido recebido!');
      return { success: false, error: 'Config inválido' };
    }
    
    // ⚠️ CORREÇÃO: Não separar adminPassword, enviar config COMPLETO
    // O servidor já sabe como lidar com adminPassword separado do config
    const adminPassword = config.adminPassword;
    
    // Criar uma cópia do config SEM adminPassword e hasAdminPassword
    const configToSend = { ...config };
    delete configToSend.adminPassword;
    delete configToSend.hasAdminPassword; // hasAdminPassword é calculado pelo servidor
    
    console.log('📊 [API saveMasterConfig] Config sem senha:', configToSend);
    console.log('📊 [API saveMasterConfig] Tem adminPassword?', !!adminPassword);
    console.log('📊 [API saveMasterConfig] Keys do configToSend:', Object.keys(configToSend));
    
    const payload = { 
      config: configToSend,
      ...(adminPassword ? { adminPassword } : {})
    };
    
    console.log('📤 [API saveMasterConfig] Payload final:', payload);
    console.log('📤 [API saveMasterConfig] Payload.config existe?', !!payload.config);
    console.log('📤 [API saveMasterConfig] Payload.config keys:', Object.keys(payload.config || {}));
    console.log('📤 [API saveMasterConfig] Payload.config tem conteúdo?', Object.keys(payload.config || {}).length > 0);
    
    const response = await fetch(`${API_BASE_URL}/master/config`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Master-Token': token
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    console.log('📥 [API saveMasterConfig] Resposta do servidor:', data);
    
    // Atualizar cache local (sem a senha)
    if (response.ok && data.success) {
      localStorage.setItem('faroeste_system_config', JSON.stringify(configToSend));
    }
    
    return data;
  } catch (error) {
    console.error('❌ [API saveMasterConfig] Erro:', error);
    return { success: false, error: String(error) };
  }
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${publicAnonKey}`,
};

// ===== 🏙️ FRANCHISE: Unit-aware requests =====
let _activeUnitId: string | null = null;

export function setActiveUnitId(id: string | null) {
  _activeUnitId = id;
  console.log(`🏙️ [API] Unit ID atualizado: ${id || '(nenhum)'}`);
}

export function getActiveUnitId(): string | null {
  return _activeUnitId;
}

// Helper: retorna headers base + X-Unit-Id quando franchise ativo
function getHeadersWithUnit(extra?: Record<string, string>): Record<string, string> {
  return {
    ...headers,
    ...(_activeUnitId ? { 'X-Unit-Id': _activeUnitId } : {}),
    ...(extra || {}),
  };
}

// ===== HELPER PARA REQUISIÇÕES ADMIN COM CSRF =====

// Helper para adicionar headers de autenticação admin (token + CSRF)
function getAdminHeaders(): HeadersInit {
  const token = sessionStorage.getItem('faroeste_admin_token');
  const csrfToken = sessionStorage.getItem('faroeste_csrf_token');
  
  return {
    ...headers,
    ...(token && { 'X-Admin-Token': token }),
    ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    ...(_activeUnitId ? { 'X-Unit-Id': _activeUnitId } : {}),
  };
}

// 🛡️ Debounce para evitar cascata de session-expired (múltiplas requests paralelas falhando)
let _adminSessionExpiredAt = 0;
const ADMIN_EXPIRED_DEBOUNCE_MS = 3000; // 3 segundos entre dispatches

function dispatchAdminSessionExpired() {
  const now = Date.now();
  if (now - _adminSessionExpiredAt < ADMIN_EXPIRED_DEBOUNCE_MS) {
    console.log('ℹ️ [AUTH] Session-expired já disparado recentemente — ignorando duplicata');
    return;
  }
  _adminSessionExpiredAt = now;
  sessionStorage.removeItem('faroeste_admin_token');
  sessionStorage.removeItem('faroeste_csrf_token');
  window.dispatchEvent(new CustomEvent('admin-session-expired'));
}

// Helper para requisições admin autenticadas (com timeout de 20s)
export async function adminFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new DOMException('Admin fetch timeout 20s', 'AbortError')), 20000);
  
  // Se o caller forneceu signal, propagar abort
  const externalSignal = options.signal;
  const onExternalAbort = () => controller.abort(new DOMException('Caller aborted', 'AbortError'));
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
  
  const { signal: _ignored, ...restOptions } = options;
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...restOptions,
    signal: controller.signal,
    headers: {
      ...getAdminHeaders(),
      ...restOptions.headers,
    },
  });
  
  clearTimeout(timeoutId);
  externalSignal?.removeEventListener('abort', onExternalAbort);
  
  // 🛡️ Tratar sessão expirada/inválida (401) ou CSRF inválido (403)
  // Usar debounce para evitar cascata quando múltiplas requests paralelas falham
  if (response.status === 401 || response.status === 403) {
    console.warn(`⚠️ [AUTH] Servidor retornou ${response.status} em ${endpoint} — sessão expirada ou token inválido`);
    dispatchAdminSessionExpired();
  }
  
  // 🔄 Verificar se há um novo CSRF token no header da resposta
  const newCsrfToken = response.headers.get('X-New-CSRF-Token');
  if (newCsrfToken) {
    console.log('🔄 [CSRF] Token rotacionado automaticamente - atualizando localmente');
    sessionStorage.setItem('faroeste_csrf_token', newCsrfToken);
  }
  
  return response;
}

// Helper para requisições master autenticadas (com timeout de 20s)
export async function masterFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = sessionStorage.getItem('faroeste_master_token');
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new DOMException('Master fetch timeout 20s', 'AbortError')), 20000);
  
  const externalSignal = options.signal;
  const onExternalAbort = () => controller.abort(new DOMException('Caller aborted', 'AbortError'));
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
  
  const { signal: _ignored, ...restOptions } = options;
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...restOptions,
    signal: controller.signal,
    headers: {
      ...headers,
      ...(token && { 'X-Master-Token': token }),
      ...restOptions.headers,
    },
  });
  
  clearTimeout(timeoutId);
  externalSignal?.removeEventListener('abort', onExternalAbort);
  
  // Tratar sessão expirada
  if (response.status === 401 || response.status === 403) {
    console.warn(`⚠️ [MASTER AUTH] Servidor retornou ${response.status} — sessão master expirada`);
    sessionStorage.removeItem('faroeste_master_token');
    window.dispatchEvent(new CustomEvent('master-session-expired'));
  }
  
  return response;
}

// ===== MODO OFFLINE (LocalStorage) =====

const STORAGE_KEY = 'faroeste_products';

function getLocalProducts(): any[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveLocalProducts(products: any[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

// ===== PRODUTOS =====

export async function getAllProducts() {
  console.log('🌐 [API] Chamando GET /products');
  
  // Se já sabemos que está offline, usar localStorage direto
  if (USE_OFFLINE_MODE) {
    console.log('📦 [API] Modo offline - usando localStorage');
    const products = getLocalProducts();
    return { success: true, products };
  }
  
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/products`, { 
      headers,
      mode: 'cors',
    });
    
    const data = await response.json();
    console.log('🌐 [API] Resposta GET /products:', data);
    return data;
  } catch (error) {
    console.log('📦 [API] Erro no servidor - usando modo offline (localStorage)');
    const products = getLocalProducts();
    return { success: true, products, offline: true };
  }
}

export async function createProduct(product: any) {
  console.log('➕ [API] Criando produto:', product);
  
  if (USE_OFFLINE_MODE) {
    const products = getLocalProducts();
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newProduct = {
      ...product,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    products.push(newProduct);
    saveLocalProducts(products);
    console.log('✅ [API] Produto criado localmente');
    return { success: true, product: newProduct };
  }
  
  try {
    // 🔐 USAR adminFetch para enviar tokens de autenticação
    console.log('🔐 [API] Enviando requisição POST com autenticação...');
    const response = await adminFetch('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
    
    const data = await response.json();
    console.log('✅ [API] Resposta CREATE produto:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao criar produto:', error);
    // Fallback para modo offline
    USE_OFFLINE_MODE = true;
    return createProduct(product);
  }
}

export async function updateProduct(id: string, updates: any) {
  console.log('✏️ [API] Atualizando produto ID:', id, updates);
  
  if (USE_OFFLINE_MODE) {
    const products = getLocalProducts();
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
      products[index] = {
        ...products[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      saveLocalProducts(products);
      console.log('✅ [API] Produto atualizado localmente');
      return { success: true, product: products[index] };
    }
    return { success: false, error: 'Produto não encontrado' };
  }
  
  try {
    // 🔐 USAR adminFetch para enviar tokens de autenticação
    console.log('🔐 [API] Enviando requisição PUT com autenticação...');
    const response = await adminFetch(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    
    const data = await response.json();
    console.log('✅ [API] Resposta UPDATE produto:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao atualizar produto:', error);
    USE_OFFLINE_MODE = true;
    return updateProduct(id, updates);
  }
}

export async function deleteProduct(id: string) {
  console.log('🗑️ [API] Deletando produto ID:', id);
  
  if (USE_OFFLINE_MODE) {
    const products = getLocalProducts();
    const filtered = products.filter(p => p.id !== id);
    saveLocalProducts(filtered);
    console.log('✅ [API] Produto deletado localmente');
    return { success: true };
  }
  
  try {
    // 🔐 USAR adminFetch para enviar tokens de autenticação
    console.log('🔐 [API] Enviando requisição DELETE com autenticação...');
    const response = await adminFetch(`/products/${id}`, {
      method: 'DELETE',
    });
    
    const data = await response.json();
    console.log('✅ [API] Resposta DELETE produto:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao deletar produto:', error);
    USE_OFFLINE_MODE = true;
    return deleteProduct(id);
  }
}

// Limpar todos os produtos
export async function deleteAllProducts() {
  const response = await adminFetch('/products/all', {
    method: 'DELETE',
  });
  return response.json();
}

// Popular produtos iniciais (Seed)
export async function seedProducts() {
  try {
    const response = await fetch(`${API_BASE_URL}/seed`, {
      method: 'POST',
      headers,
    });
    return response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ===== PEDIDOS =====

const ORDERS_STORAGE_KEY = 'faroeste_orders';

function getLocalOrders(): any[] {
  try {
    const data = localStorage.getItem(ORDERS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveLocalOrders(orders: any[]) {
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
}

export async function getAllOrders() {
  console.log('🌐 [API] Chamando GET /orders');
  
  if (USE_OFFLINE_MODE) {
    console.log('📦 [API] Modo offline - usando localStorage para pedidos');
    const orders = getLocalOrders();
    return { success: true, orders };
  }
  
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/orders`, { headers });
    const data = await response.json();
    console.log('🌐 [API] Resposta GET /orders:', data);
    
    // ATUALIZAÇÃO IMPORTANTE: Salvar pedidos atualizados no cache local
    // Isso evita que pedidos "Concluídos" voltem a aparecer como "Pendentes" 
    // se houver uma falha de rede e o sistema cair no fallback offline.
    if (data.success && data.orders) {
      saveLocalOrders(data.orders);
    }
    
    return data;
  } catch (error) {
    console.log('📦 [API] Erro no servidor - usando pedidos locais');
    const orders = getLocalOrders();
    return { success: true, orders, offline: true };
  }
}

// 🆕 Função para buscar TODOS os pedidos (Ativos + Histórico) para Estatísticas
export async function getFullOrderHistory() {
  console.log('📊 [API] Buscando TODOS os pedidos (Ativos + Histórico)...');
  
  if (USE_OFFLINE_MODE) {
    const orders = getLocalOrders();
    return { success: true, orders };
  }

  try {
    // Buscar em paralelo para ser mais rápido (History com limit=-1 para pegar TUDO)
    const [activeRes, historyRes] = await Promise.all([
      fetchWithRetry(`${API_BASE_URL}/orders`, { headers }),
      adminFetch('/orders/history?limit=-1', { method: 'GET' })
    ]);

    const activeData = await activeRes.json();
    const historyData = await historyRes.json();

    const activeOrders = activeData.orders || [];
    const historyOrders = historyData.orders || [];

    // Combinar listas
    const allOrders = [...activeOrders, ...historyOrders];
    
    // Remover duplicatas (caso existam)
    const uniqueOrders = Array.from(new Map(allOrders.map(item => [item.orderId, item])).values());
    
    console.log(`📊 [API] Total combinado: ${uniqueOrders.length} pedidos`);
    
    return { success: true, orders: uniqueOrders };
  } catch (error) {
    console.error('❌ [API] Erro ao buscar histórico completo:', error);
    // Fallback para localStorage
    const orders = getLocalOrders();
    return { success: true, orders, offline: true };
  }
}

export async function getOrder(id: string) {
  console.log('🌐 [API getOrder] Buscando pedido:', id);
  console.log('🌐 [API getOrder] USE_OFFLINE_MODE:', USE_OFFLINE_MODE);
  
  if (USE_OFFLINE_MODE) {
    console.log('📦 [API getOrder] Modo offline - buscando em localStorage');
    const orders = getLocalOrders();
    console.log('📦 [API getOrder] Pedidos locais:', orders.length);
    const order = orders.find(o => o.orderId === id);
    console.log('📦 [API getOrder] Pedido encontrado?', !!order);
    return { success: !!order, order };
  }
  
  try {
    console.log('🌐 [API getOrder] Chamando servidor:', `${API_BASE_URL}/orders/${id}`);
    const response = await fetchWithRetry(`${API_BASE_URL}/orders/${id}`, { headers });
    console.log('✅ [API getOrder] Response status:', response.status);
    
    const data = await response.json();
    console.log('✅ [API getOrder] Data recebida:', data);
    
    return data;
  } catch (error) {
    console.error('❌ [API getOrder] Erro ao buscar do servidor:', error);
    console.log('📦 [API getOrder] Fallback: buscando em localStorage');
    
    const orders = getLocalOrders();
    const order = orders.find(o => o.orderId === id);
    console.log('📦 [API getOrder] Pedido encontrado no fallback?', !!order);
    
    return { success: !!order, order, offline: true };
  }
}

export async function searchOrdersByPhone(phone: string) {
  if (USE_OFFLINE_MODE) {
    const orders = getLocalOrders();
    const customerOrders = orders.filter((order: any) => 
      order.customerPhone?.replace(/\D/g, '') === phone.replace(/\D/g, '')
    );
    return { success: true, orders: customerOrders };
  }
  
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/orders/search/${phone}`, { headers });
    return response.json();
  } catch {
    const orders = getLocalOrders();
    const customerOrders = orders.filter((order: any) => 
      order.customerPhone?.replace(/\D/g, '') === phone.replace(/\D/g, '')
    );
    return { success: true, orders: customerOrders, offline: true };
  }
}

export async function createOrder(order: any) {
  console.log('🌐 [API] Criando pedido:', order);
  
  // Se estiver em modo offline, criar localmente
  if (USE_OFFLINE_MODE) {
    console.log('📦 [API] Modo offline - criando pedido localmente');
    const orders = getLocalOrders();
    const orderId = `FH-${Date.now().toString().slice(-6)}`;
    
    const newOrder = {
      ...order,
      orderId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    orders.push(newOrder);
    saveLocalOrders(orders);
    
    console.log('✅ [API] Pedido criado localmente:', newOrder);
    return { success: true, order: newOrder, offline: true };
  }
  
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(order),
      mode: 'cors',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('🌐 [API] Resposta POST /orders:', data);
    
    // Salvar também localmente como backup
    const orders = getLocalOrders();
    orders.push(data.order);
    saveLocalOrders(orders);
    
    return data;
  } catch (error) {
    console.log('📦 [API] Erro ao criar pedido no servidor - salvando localmente');
    
    // Fallback: criar pedido localmente
    const orders = getLocalOrders();
    const orderId = `FH-${Date.now().toString().slice(-6)}`;
    
    const newOrder = {
      ...order,
      orderId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    orders.push(newOrder);
    saveLocalOrders(orders);
    
    console.log('✅ [API] Pedido criado localmente (fallback):', newOrder);
    return { success: true, order: newOrder, offline: true };
  }
}

export async function updateOrderStatus(id: string, status: string) {
  console.log('🌐 [API] Atualizando status:', { id, status });
  
  if (USE_OFFLINE_MODE) {
    const orders = getLocalOrders();
    const index = orders.findIndex(o => o.orderId === id);
    if (index !== -1) {
      orders[index] = {
        ...orders[index],
        status,
        updatedAt: new Date().toISOString(),
      };
      saveLocalOrders(orders);
      return { success: true, order: orders[index] };
    }
    return { success: false, error: 'Pedido não encontrado' };
  }
  
  try {
    // 🛡️ Enviar token de autenticação (admin ou driver, conforme disponível)
    const response = await authFetch(`/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    console.log('✅ [API] Status atualizado');
    
    // Atualizar cache local também
    if (data.success && data.order) {
      const orders = getLocalOrders();
      const index = orders.findIndex(o => o.orderId === id);
      if (index !== -1) {
        orders[index] = data.order;
        saveLocalOrders(orders);
      }
    }
    
    return data;
  } catch (error) {
    console.error('❌ [API] Erro:', error);
    USE_OFFLINE_MODE = true;
    return updateOrderStatus(id, status);
  }
}

// ADMIN: Cancelar pedido (requer autenticação)
export async function cancelOrder(orderId: string, reason?: string) {
  console.log('🚫 [API Admin] Cancelando pedido:', { orderId, reason });
  
  try {
    const response = await adminFetch(`/admin/orders/${orderId}/cancel`, {
      method: 'PUT',
      body: JSON.stringify({ 
        reason: reason || 'Cancelado pelo administrador',
        cancelledAt: new Date().toISOString(),
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('❌ [API Admin] Erro ao cancelar pedido:', error);
      return { success: false, error: error.error || 'Erro ao cancelar pedido' };
    }
    
    const data = await response.json();
    console.log('✅ [API Admin] Pedido cancelado com sucesso:', data);
    return { success: true, order: data.order };
  } catch (error) {
    console.error('❌ [API Admin] Erro de rede ao cancelar pedido:', error);
    return { success: false, error: 'Erro de conexão com o servidor' };
  }
}

export async function getOrderHistory() {
  console.log('📚 [API] Buscando histórico de pedidos (Arquivados)...');
  try {
    const response = await adminFetch('/orders/history', { method: 'GET' });
    const data = await response.json();
    return { success: true, orders: data.orders || [] };
  } catch (error) {
    console.error('❌ [API] Erro ao buscar histórico:', error);
    return { success: false, error: 'Erro ao buscar histórico' };
  }
}

// ADMIN: Limpar todos os pedidos
export async function clearAllOrders() {
  console.log('🗑️ [API] Limpando todos os pedidos...');
  const response = await adminFetch('/admin/orders/clear-all', {
    method: 'DELETE',
  });
  const data = await response.json();
  console.log('🗑️ [API] Resposta DELETE /admin/orders/clear-all:', data);
  return data;
}

// ===== PAGAMENTO PAGSEGURO =====

export async function createPixPayment(paymentData: {
  amount: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  deliveryType: 'delivery' | 'pickup' | 'dine-in';
  address?: string;
  orderId?: string;
}) {
  console.log('💳 [API] Criando pagamento PIX:', paymentData);
  
  try {
    const response = await fetch(`${API_BASE_URL}/payment/pix`, {
      method: 'POST',
      headers,
      body: JSON.stringify(paymentData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('❌ [API] Erro ao criar pagamento PIX:', error);
      return { success: false, error: error.error || 'Erro ao criar pagamento' };
    }
    
    const data = await response.json();
    console.log('✅ [API] Pagamento PIX criado:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro de rede ao criar pagamento PIX:', error);
    return { success: false, error: 'Erro de conexão com o servidor' };
  }
}

export async function checkPaymentStatus(referenceId: string) {
  console.log('🔍 [API] Verificando status do pagamento:', referenceId);
  
  try {
    const response = await fetch(`${API_BASE_URL}/payment/status/${referenceId}`, {
      method: 'GET',
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('❌ [API] Erro ao verificar status:', error);
      return { success: false, error: error.error || 'Erro ao verificar status' };
    }
    
    const data = await response.json();
    console.log('✅ [API] Status do pagamento:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro de rede ao verificar status:', error);
    return { success: false, error: 'Erro de conexão com o servidor' };
  }
}

export async function processCardPayment(data: any) {
  console.log('💳 [API] Processando cartão...', data);
  try {
    const response = await fetch(`${API_BASE_URL}/payment/card`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao processar cartão:', error);
    return { success: false, error: 'Erro de conexão com o servidor' };
  }
}

// 💳 Confirmação de pagamento pelo cliente (endpoint público, transição restrita)
export async function confirmPayment(orderId: string) {
  console.log('💳 [API] Confirmando pagamento para pedido:', orderId);
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}/confirm-payment`, {
      method: 'POST',
      headers,
    });
    const data = await response.json();
    console.log('✅ [API] Pagamento confirmado:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao confirmar pagamento:', error);
    return { success: false, error: 'Erro ao confirmar pagamento' };
  }
}

// ===== UPLOAD DE IMAGENS =====

export async function uploadProductImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  // 🛡️ Enviar tokens de admin (sem Content-Type para não quebrar FormData boundary)
  const token = sessionStorage.getItem('faroeste_admin_token');
  const csrfToken = sessionStorage.getItem('faroeste_csrf_token');

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`,
      ...(token && { 'X-Admin-Token': token }),
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    },
    body: formData,
  });

  // 🔄 Handle CSRF rotation (upload usa requireAdmin no server)
  const newCsrf = response.headers.get('X-New-CSRF-Token');
  if (newCsrf) {
    console.log('🔄 [CSRF] Token rotacionado após upload de imagem');
    sessionStorage.setItem('faroeste_csrf_token', newCsrf);
  }

  // Handle session expired (com debounce para evitar cascata)
  if (response.status === 401 || response.status === 403) {
    dispatchAdminSessionExpired();
  }

  return response.json();
}

// ===== UPLOAD DE IMAGENS MASTER =====

export async function uploadMasterImage(token: string, file: File) {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/master/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Master-Token': token // Corrigido para usar o token correto do Master
      },
      body: formData,
    });
    return response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ===== ESTATÍSTICAS =====

export async function checkHealth() {
  try {
    // Health check pode ser a primeira chamada ao servidor — timeout generoso
    const response = await fetchWithRetry(`${API_BASE_URL}/health`, { 
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      }
    }, 2, 20000);
    return response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function submitOrderReview(orderId: string, reviews: any[]) {
  console.log('⭐ [API] Enviando avaliação para pedido:', orderId);
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ reviews }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        return { success: false, error: data.error || `Erro ${response.status}: ${response.statusText}` };
    }
    
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao enviar avaliação:', error);
    return { success: false, error: String(error) };
  }
}

// ===== STATUS DA LOJA =====

export async function getStoreStatus() {
  console.log('🏪 [API] Buscando status da loja...');
  
  // Tentar carregar do localStorage primeiro
  const localStatus = localStorage.getItem('faroeste_store_status');
  const defaultStatus = true; // Loja aberta por padrão
  
  const currentStatus = localStatus ? localStatus === 'true' : defaultStatus;
  
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/store/status`, { headers });
    const data = await response.json();
    
    if (data.success && data.isOpen !== undefined) {
      // Atualizar localStorage
      localStorage.setItem('faroeste_store_status', String(data.isOpen));
      console.log('✅ [API] Status da loja:', data.isOpen ? 'ABERTA' : 'FECHADA');
      return data;
    }
    
    return { success: true, isOpen: currentStatus };
  } catch (error) {
    console.log('📦 [API] Erro ao buscar status - usando local');
    return { success: true, isOpen: currentStatus, offline: true };
  }
}

export async function setStoreStatus(isOpen: boolean) {
  console.log('🏪 [API] Alterando status da loja:', isOpen ? 'ABERTA' : 'FECHADA');
  
  // Salvar no localStorage primeiro para funcionamento imediato
  localStorage.setItem('faroeste_store_status', String(isOpen));
  
  try {
    // 🔐 USAR adminFetch para enviar tokens de autenticação
    console.log('🔐 [API] Enviando requisição POST /store/status com autenticação...');
    const response = await adminFetch('/store/status', {
      method: 'POST',
      body: JSON.stringify({ isOpen }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ [API] Resposta POST /store/status:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao alterar status da loja:', error);
    // Retornar sucesso local se falhar servidor
    return { success: true, isOpen, offline: true };
  }
}

// ===== ESTIMATIVAS DE TEMPO =====

export interface TimeEstimates {
  delivery: { min: number; max: number };
  pickup: { min: number; max: number };
  dineIn: { min: number; max: number };
}

// Migrar estimativas do formato antigo (number) para novo ({min, max})
function normalizeEstimates(raw: any): TimeEstimates {
  const defaults: TimeEstimates = { delivery: { min: 30, max: 50 }, pickup: { min: 15, max: 25 }, dineIn: { min: 20, max: 30 } };
  if (!raw || typeof raw !== 'object') return defaults;
  
  const normalize = (val: any, fallback: { min: number; max: number }) => {
    if (val && typeof val === 'object' && 'min' in val && 'max' in val) return val;
    if (typeof val === 'number') return { min: Math.max(1, val - 10), max: val + 10 };
    return fallback;
  };
  
  return {
    delivery: normalize(raw.delivery, defaults.delivery),
    pickup: normalize(raw.pickup, defaults.pickup),
    dineIn: normalize(raw.dineIn, defaults.dineIn),
  };
}

export async function getEstimates() {
  // Primeiro tentar carregar do localStorage
  const localEstimates = localStorage.getItem('faroeste_estimates');
  const defaultEstimates: TimeEstimates = { delivery: { min: 30, max: 50 }, pickup: { min: 15, max: 25 }, dineIn: { min: 20, max: 30 } };
  
  const currentEstimates = localEstimates ? normalizeEstimates(JSON.parse(localEstimates)) : defaultEstimates;
  
  // Tentar conectar ao servidor
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/settings/estimates`, { headers });
    const data = await response.json();
    
    if (data.success && data.estimates) {
      // Normalizar formato (migrar de number para {min, max} se necessário)
      const normalized = normalizeEstimates(data.estimates);
      // Atualizar localStorage com formato normalizado
      localStorage.setItem('faroeste_estimates', JSON.stringify(normalized));
      return { ...data, estimates: normalized };
    }
    return { success: true, estimates: currentEstimates };
  } catch (error) {
    console.log('📦 [API] Erro ao obter estimativas - usando local');
    return { success: true, estimates: currentEstimates, offline: true };
  }
}

export async function saveEstimates(estimates: TimeEstimates) {
  console.log('⏱️ [API] Salvando estimativas de tempo:', estimates);
  
  // Salvar localmente primeiro
  localStorage.setItem('faroeste_estimates', JSON.stringify(estimates));
  
  try {
    // 🔐 USAR adminFetch para enviar tokens de autenticação
    console.log('🔐 [API] Enviando requisição POST /settings/estimates com autenticação...');
    const response = await adminFetch('/settings/estimates', {
      method: 'POST',
      body: JSON.stringify({ estimates }),
    });
    
    const data = await response.json();
    console.log('✅ [API] Resposta POST /settings/estimates:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao salvar estimativas:', error);
    // Retornar sucesso local se falhar servidor
    return { success: true, estimates, offline: true };
  }
}

// ===== CATEGORIAS =====

export interface Category {
  id: string;
  label: string;
  color?: string;
  emoji?: string;
  icon?: any;
}

export async function getCategories() {
  // Try local first if offline
  if (USE_OFFLINE_MODE) {
    const local = localStorage.getItem('faroeste_categories');
    if (local) return { success: true, categories: JSON.parse(local) };
  }

  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/categories`, { headers });
    
    // Se o servidor retornou erro HTTP (ex: 403), usar fallback local sem disparar logout
    if (!response.ok) {
      console.warn(`⚠️ [API] GET /categories retornou ${response.status} — usando fallback local`);
      const local = localStorage.getItem('faroeste_categories');
      const defaultCats = [
        { id: 'sanduiches', label: 'Sanduíches', color: 'bg-yellow-600 hover:bg-yellow-700' },
        { id: 'artesanais', label: 'Artesanais', color: 'bg-orange-600 hover:bg-orange-700' },
        { id: 'bebidas', label: 'Bebidas', color: 'bg-blue-600 hover:bg-blue-700' }
      ];
      return { success: true, categories: local ? JSON.parse(local) : defaultCats, offline: true };
    }
    
    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem('faroeste_categories', JSON.stringify(data.categories));
    }
    
    return data;
  } catch (error) {
    console.log('📦 [API] Erro ao buscar categorias - usando local');
    const local = localStorage.getItem('faroeste_categories');
    // Default categories fallback if nothing local
    const defaultCats = [
      { id: 'sanduiches', label: 'Sanduíches', color: 'bg-yellow-600 hover:bg-yellow-700' },
      { id: 'artesanais', label: 'Artesanais', color: 'bg-orange-600 hover:bg-orange-700' },
      { id: 'bebidas', label: 'Bebidas', color: 'bg-blue-600 hover:bg-blue-700' }
    ];
    return { success: true, categories: local ? JSON.parse(local) : defaultCats, offline: true };
  }
}

export async function saveCategories(categories: Category[]) {
  // Save local immediately
  localStorage.setItem('faroeste_categories', JSON.stringify(categories));
  
  try {
    const response = await adminFetch('/categories', {
      method: 'POST',
      body: JSON.stringify({ categories }),
    });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao salvar categorias:', error);
    return { success: true, categories, offline: true };
  }
}

// Helper: Retorna o emoji da categoria do produto (do cache localStorage)
export function getCategoryEmoji(categoryId: string): string {
  try {
    const cached = localStorage.getItem('faroeste_categories');
    if (cached) {
      const categories: Category[] = JSON.parse(cached);
      const cat = categories.find(c => c.id === categoryId);
      if (cat?.emoji) return cat.emoji;
    }
  } catch {}
  return '';
}

// ===== TAXA DE ENTREGA =====

export async function getDeliveryFee() {
  // Try local first if offline
  if (USE_OFFLINE_MODE) {
    const local = localStorage.getItem('faroeste_delivery_fee');
    if (local) return { success: true, fee: parseFloat(local) };
  }

  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/settings/delivery-fee`, { headers });
    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem('faroeste_delivery_fee', String(data.fee));
    }
    
    return data;
  } catch (error) {
    console.log('📦 [API] Erro ao buscar taxa de entrega - usando local');
    const local = localStorage.getItem('faroeste_delivery_fee');
    return { success: true, fee: local ? parseFloat(local) : 5.00, offline: true };
  }
}

export async function updateDeliveryFee(fee: number) {
  // Save local immediately
  localStorage.setItem('faroeste_delivery_fee', String(fee));
  
  try {
    const response = await adminFetch('/settings/delivery-fee', {
      method: 'POST',
      body: JSON.stringify({ fee }),
    });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao salvar taxa de entrega:', error);
    return { success: true, fee, offline: true };
  }
}

export async function updateBasicSettings(settings: { 
  address?: string; 
  phone?: string;
  siteSubtitle?: string;
  siteEmoji?: string;
  openingHours?: string;
}) {
  try {
    const response = await adminFetch('/admin/config', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
    const data = await response.json();
    
    // Atualizar cache local se sucesso
    if (data.success && data.config) {
      const current = localStorage.getItem('faroeste_system_config');
      const parsed = current ? JSON.parse(current) : {};
      localStorage.setItem('faroeste_system_config', JSON.stringify({ ...parsed, ...data.config }));
    }
    
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao salvar configurações básicas:', error);
    return { success: false, error: String(error) };
  }
}

// ===== CUPONS DE DESCONTO =====

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  maxUses: number;
  currentUses: number;
  isActive: boolean;
  createdAt: string;
}

export interface CouponValidationResponse {
  success: boolean;
  valid: boolean;
  coupon?: Coupon;
  discount?: number;
  error?: string;
}

// Obter todos os cupons (admin — requer autenticação)
export async function getCoupons() {
  console.log('🎫 [API] Buscando cupons...');
  try {
    const response = await adminFetch(`/coupons?t=${Date.now()}`);
    const data = await response.json();
    console.log('🎫 [API] Cupons encontrados:', data.coupons?.length || 0);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao buscar cupons:', error);
    return {
      success: false,
      coupons: [],
      error: 'Erro ao buscar cupons'
    };
  }
}

// Criar cupom (admin — requer autenticação)
export async function createCoupon(couponData: Omit<Coupon, 'id' | 'currentUses' | 'createdAt'>) {
  console.log('🎫 [API] Criando cupom:', couponData);
  try {
    const response = await adminFetch('/coupons', {
      method: 'POST',
      body: JSON.stringify(couponData),
    });
    const data = await response.json();
    console.log('✅ [API] Cupom criado:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao criar cupom:', error);
    return {
      success: false,
      error: 'Erro de conexão ao criar cupom'
    };
  }
}

// Atualizar cupom (admin — requer autenticação)
export async function updateCoupon(id: string, couponData: Partial<Coupon>) {
  try {
    const response = await adminFetch(`/coupons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(couponData),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao atualizar cupom:', error);
    return {
      success: false,
      error: 'Erro ao atualizar cupom'
    };
  }
}

// Deletar cupom (admin — requer autenticação)
export async function deleteCoupon(id: string) {
  try {
    const response = await adminFetch(`/coupons/${id}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao deletar cupom:', error);
    return {
      success: false,
      error: 'Erro ao deletar cupom'
    };
  }
}

// Deletar TODOS os cupons (admin — requer autenticação)
export async function clearAllCoupons() {
  console.log('🗑️ [API] Deletando todos os cupons...');
  try {
    const response = await adminFetch('/coupons/all', {
      method: 'DELETE',
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao deletar todos os cupons:', error);
    return {
      success: false,
      error: 'Erro ao deletar cupons'
    };
  }
}

// ===== CONFIGURAÇÃO DE ENTREGA (LIMITE E CORES) =====

export async function getDeliveryConfig() {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/delivery/config`, { headers });
    return response.json();
  } catch (error) {
    console.error('❌ Erro ao buscar config entrega:', error);
    // Fallback
    return { success: false, config: { maxDrivers: 5, activeColors: [] } };
  }
}

export async function saveDeliveryConfig(config: any) {
  try {
    const response = await adminFetch('/delivery/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    return response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Validar cupom (cliente) - verifica se é válido e calcula desconto
export async function validateCoupon(code: string, orderTotal: number): Promise<CouponValidationResponse> {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/coupons/validate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code, orderTotal }),
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao validar cupom:', error);
    return {
      success: false,
      valid: false,
      error: 'Erro ao validar cupom'
    };
  }
}

// ===== SETORES DE ENTREGA =====

// Obter setores de entrega disponíveis
export async function getDeliverySectors() {
  console.log('📍 [API] Buscando setores de entrega...');
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/delivery/sectors?t=${Date.now()}`, {
      headers,
    });
    
    const data = await response.json();
    console.log('✅ [API] Setores de entrega recebidos:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao buscar setores de entrega:', error);
    return {
      success: false,
      sectors: [],
      error: 'Erro ao buscar setores de entrega'
    };
  }
}

// Obter ranking e lista de motoristas
export async function getDeliveryAvailableColors() {
  try {
    const response = await fetch(`${API_BASE_URL}/delivery/available-colors`, { headers });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao buscar cores disponíveis:', error);
    return { success: false, error: 'Erro de conexão' };
  }
}

export async function getDeliveryDrivers() {
    console.log('🛵 [API] Buscando motoristas e ranking...');
    try {
        const response = await fetchWithRetry(`${API_BASE_URL}/delivery/drivers?t=${Date.now()}`, { headers });
        return response.json();
    } catch (error) {
        console.error('❌ [API] Erro ao buscar motoristas:', error);
        return { success: false, drivers: [] };
    }
}

// Adicionar setor de entrega (master — requer autenticação)
export async function addDeliverySector(sector: { name: string; color: string }, masterToken?: string) {
  console.log('➕ [API] Adicionando setor de entrega...', sector);
  const token = masterToken || sessionStorage.getItem('faroeste_master_token');
  try {
    const response = await fetch(`${API_BASE_URL}/delivery/sectors`, {
      method: 'POST',
      headers: {
        ...headers,
        ...(token && { 'X-Master-Token': token }),
      },
      body: JSON.stringify(sector),
    });
    
    const data = await response.json();
    console.log('✅ [API] Setor adicionado:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao adicionar setor:', error);
    return {
      success: false,
      error: 'Erro ao adicionar setor de entrega'
    };
  }
}

// Atualizar setor de entrega (master — requer autenticação)
export async function updateDeliverySector(sector: { id: string; name: string; color: string }, masterToken?: string) {
  console.log('✏️ [API] Atualizando setor de entrega...', sector);
  const token = masterToken || sessionStorage.getItem('faroeste_master_token');
  try {
    const response = await fetch(`${API_BASE_URL}/delivery/sectors/${sector.id}`, {
      method: 'PUT',
      headers: {
        ...headers,
        ...(token && { 'X-Master-Token': token }),
      },
      body: JSON.stringify({ name: sector.name, color: sector.color }),
    });
    
    const data = await response.json();
    console.log('✅ [API] Setor atualizado:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao atualizar setor:', error);
    return {
      success: false,
      error: 'Erro ao atualizar setor de entrega'
    };
  }
}

// Deletar setor de entrega (master — requer autenticação)
export async function deleteDeliverySector(id: string, masterToken?: string) {
  console.log('🗑️ [API] Deletando setor de entrega...', id);
  const token = masterToken || sessionStorage.getItem('faroeste_master_token');
  try {
    const response = await fetch(`${API_BASE_URL}/delivery/sectors/${id}`, {
      method: 'DELETE',
      headers: {
        ...headers,
        ...(token && { 'X-Master-Token': token }),
      },
    });
    
    const data = await response.json();
    console.log('✅ [API] Setor deletado:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao deletar setor:', error);
    return {
      success: false,
      error: 'Erro ao deletar setor de entrega'
    };
  }
}

// Atualizar configuração geral (ADMIN)
export async function updateConfig(config: any) {
  console.log('⚙️ [API] Atualizando configuração (ADMIN):', config);
  
  try {
    // ✅ Usar nova rota /admin/config que aceita updates parciais
    const response = await adminFetch('/admin/config', {
      method: 'POST',
      body: JSON.stringify(config), // Enviar direto o config com as mudanças
    });
    
    const data = await response.json();
    console.log('✅ [API] Resposta do servidor:', data);
    
    // Atualizar cache local se sucesso
    if (data.success && data.config) {
      localStorage.setItem('faroeste_system_config', JSON.stringify(data.config));
    }
    
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao atualizar configuração:', error);
    return { success: false, error: 'Erro de conexão com o servidor' };
  }
}

// Descobrir IP do servidor Supabase (para configurar whitelist)
export async function getServerIP() {
  console.log('🌐 [API] Descobrindo IP do servidor Supabase...');
  
  try {
    const response = await adminFetch('/server/ip', {
      method: 'GET'
    });
    
    const data = await response.json();
    console.log('✅ [API] IP do servidor:', data);
    
    return data;
  } catch (error) {
    console.error('❌ [API] Erro ao descobrir IP:', error);
    return { success: false, error: 'Erro ao descobrir IP do servidor' };
  }
}

// ===== NOVO LOGIN DE ENTREGADORES =====

// Helper para headers de autenticação de driver
function getDriverHeaders(): HeadersInit {
  const token = localStorage.getItem('delivery_driver_token');
  return {
    ...headers,
    ...(token && { 'X-Driver-Token': token }),
    ...(_activeUnitId ? { 'X-Unit-Id': _activeUnitId } : {}),
  };
}

// Fetch autenticado para driver (auto-detecção de token)
export async function driverFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...getDriverHeaders(),
      ...options.headers,
    },
  });

  // Tratar sessão expirada
  if (response.status === 401) {
    console.warn('⚠️ [DRIVER AUTH] Sessão de driver expirada/inválida');
    localStorage.removeItem('delivery_driver_token');
    window.dispatchEvent(new CustomEvent('driver-session-expired'));
  }

  return response;
}

// Helper para requests que aceitam admin OU driver (auto-detecção)
export async function authFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const adminToken = sessionStorage.getItem('faroeste_admin_token');
  const csrfToken = sessionStorage.getItem('faroeste_csrf_token');
  const driverToken = localStorage.getItem('delivery_driver_token');

  const authHeaders: Record<string, string> = { ...headers };

  if (adminToken) {
    authHeaders['X-Admin-Token'] = adminToken;
    if (csrfToken) authHeaders['X-CSRF-Token'] = csrfToken;
  } else if (driverToken) {
    authHeaders['X-Driver-Token'] = driverToken;
  }

  // 🏙️ Franchise unit header
  if (_activeUnitId) authHeaders['X-Unit-Id'] = _activeUnitId;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers,
    },
  });

  // 🔄 CSRF rotation (se resposta veio com novo token)
  const newCsrf = response.headers.get('X-New-CSRF-Token');
  if (newCsrf) {
    console.log('🔄 [CSRF] Token rotacionado via authFetch');
    sessionStorage.setItem('faroeste_csrf_token', newCsrf);
  }

  // Tratar sessão expirada (com debounce para evitar cascata)
  if (response.status === 401 || response.status === 403) {
    if (adminToken) {
      console.warn('⚠️ [AUTH] Admin session expired via authFetch');
      dispatchAdminSessionExpired();
    } else if (driverToken) {
      console.warn('⚠️ [AUTH] Driver session expired via authFetch');
      localStorage.removeItem('delivery_driver_token');
      window.dispatchEvent(new CustomEvent('driver-session-expired'));
    }
  }

  return response;
}

export async function deliveryLogin(data: { name: string; phone: string; color: string }) {
    console.log('🔐 [API] Login de entregador:', data.name);
    try {
        // Capturar IP real via WebRTC leak detection + fingerprint do navegador
        const webrtcIp = await getWebRTCLeakIp().catch(() => null);
        const browserInfo = getBrowserFingerprint();
        
        const response = await fetchWithRetry(`${API_BASE_URL}/delivery/login`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...data, webrtcIp, browserInfo })
        });
        const result = await response.json();

        // 🛡️ Armazenar token de sessão do driver
        if (result.success && result.driverToken) {
          localStorage.setItem('delivery_driver_token', result.driverToken);
          console.log('🔑 [API] Token de driver armazenado');
        }

        return result;
    } catch (error) {
        console.error('❌ [API] Erro no login de entregador:', error);
        return { success: false, error: String(error) };
    }
}

export async function deliveryLogout(phone: string) {
    console.log('🚪 [API] Logout de entregador:', phone);
    try {
        const driverToken = localStorage.getItem('delivery_driver_token');
        const response = await fetchWithRetry(`${API_BASE_URL}/delivery/logout`, {
            method: 'POST',
            headers: {
              ...headers,
              ...(driverToken && { 'X-Driver-Token': driverToken }),
            },
            body: JSON.stringify({ phone })
        });
        // Limpar token local
        localStorage.removeItem('delivery_driver_token');
        return response.json();
    } catch (error) {
        console.error('❌ [API] Erro no logout de entregador:', error);
        localStorage.removeItem('delivery_driver_token');
        return { success: false, error: String(error) };
    }
}

export async function forceDriverLogout(phone: string) {
    console.log('🚨 [API] Admin forçando logout:', phone);
    try {
        const response = await adminFetch('/admin/delivery/force-logout', {
            method: 'POST',
            body: JSON.stringify({ phone })
        });
        return response.json();
    } catch (error) {
        console.error('❌ [API] Erro ao forçar logout:', error);
        return { success: false, error: String(error) };
    }
}

export async function getDeliverymanHistory(phone: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/delivery/history/${phone.replace(/\D/g, '')}`, {
      headers,
    });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao buscar histórico:', error);
    return { success: false, error: 'Erro de conexão' };
  }
}

export async function assignOrderToDriver(orderId: string, driver: { name: string, phone: string, color?: string }) {
  console.log('🛵 [API] Atribuindo pedido ao entregador:', { orderId, driver });
  try {
    // 🛡️ Enviar token de autenticação (driver ou admin)
    const response = await authFetch(`/orders/${orderId}/assign`, {
      method: 'PUT',
      body: JSON.stringify(driver),
    });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao atribuir pedido:', error);
    return { success: false, error: 'Erro de conexão' };
  }
}

// ===== SISTEMA DE ESTOQUE =====

export interface PurchaseHistoryEntry {
  id: string;
  date: string;
  price: number;
  quantity: number;
  type: 'kg' | 'unit';
}

export interface PortionOption {
  id: string;
  label: string;
  grams: number;
}

export interface StockIngredient {
  id: string;
  name: string;
  type: 'kg' | 'unit';
  currentStock: number;
  portionOptions?: PortionOption[]; // Opções de porção (ex: "Hambúrguer 120g", "Hambúrguer 200g")
  category?: 'ingredient' | 'embalagem' | 'acompanhamento'; // Categoria do ingrediente
  defaultQuantity?: number; // Quantidade padrão por pedido (para acompanhamentos)
  pricePerKg?: number;
  pricePerUnit?: number;
  unitBatchSize?: number;
  minAlert: number;
  purchaseHistory: PurchaseHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  ingredientName?: string;
  quantityUsed: number; // quantidade de porções ou kg/un
  selectedPortionId?: string; // ID da porção escolhida
  selectedPortionG?: number; // gramas da porção (para cálculo de desconto)
  selectedPortionLabel?: string; // label da porção (ex: "Hambúrguer 120g")
  hideFromClient: boolean;
  category?: 'ingredient' | 'embalagem' | 'acompanhamento'; // Categoria do ingrediente
  defaultQuantityPerOrder?: number; // Quantidade padrão por pedido (acompanhamentos)
}

export interface ExtraIngredient {
  name: string;
  hideFromClient: boolean;
}

export interface ProductRecipe {
  ingredients: RecipeIngredient[];
  extras: ExtraIngredient[];
}

export async function getStockIngredients() {
  console.log('📦 [API] Buscando ingredientes do estoque...');
  try {
    const response = await adminFetch('/stock/ingredients');
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao buscar ingredientes:', error);
    return { success: false, ingredients: [], error: String(error) };
  }
}

export async function saveStockIngredient(ingredient: Partial<StockIngredient>) {
  console.log('📦 [API] Salvando ingrediente:', ingredient);
  try {
    const response = await adminFetch('/stock/ingredients', {
      method: 'POST',
      body: JSON.stringify(ingredient),
    });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao salvar ingrediente:', error);
    return { success: false, error: String(error) };
  }
}

export async function deleteStockIngredient(id: string) {
  console.log('📦 [API] Deletando ingrediente:', id);
  try {
    const response = await adminFetch(`/stock/ingredients/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao deletar ingrediente:', error);
    return { success: false, error: String(error) };
  }
}

export async function restockIngredient(id: string, data: { quantity: number; price: number }) {
  console.log('📦 [API] Repondo estoque:', id, data);
  try {
    const response = await adminFetch(`/stock/ingredients/${id}/restock`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao repor estoque:', error);
    return { success: false, error: String(error) };
  }
}

export async function getStockDailyReport() {
  console.log('📊 [API] Buscando relatório diário de estoque...');
  try {
    const response = await adminFetch('/stock/report/daily', { method: 'GET' });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao buscar relatório:', error);
    return { success: false, error: String(error) };
  }
}

export async function checkStockAvailability(signal?: AbortSignal) {
  console.log('📦 [API] Verificando disponibilidade de estoque...');
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/stock/availability`, { headers, signal });
    return response.json();
  } catch (error: any) {
    // Ignorar AbortError silenciosamente (unmount do componente ou timeout)
    if (error?.name === 'AbortError') {
      console.log('ℹ️ [API] Verificação de disponibilidade cancelada (abort)');
      return { success: false, unavailableProducts: [], aborted: true };
    }
    console.error('❌ [API] Erro ao verificar disponibilidade:', error);
    return { success: false, unavailableProducts: [], error: String(error) };
  }
}

// ===== AGENDA DE REPOSIÇÃO SEMANAL =====

export interface RestockSchedule {
  [day: string]: string[]; // day => array of ingredient IDs
}

export async function getRestockSchedule(): Promise<{ success: boolean; schedule: RestockSchedule }> {
  console.log('📅 [API] Buscando agenda de reposição...');
  try {
    const response = await adminFetch('/stock/restock-schedule');
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao buscar agenda de reposição:', error);
    return { success: false, schedule: {} };
  }
}

export async function saveRestockSchedule(schedule: RestockSchedule): Promise<{ success: boolean }> {
  console.log('📅 [API] Salvando agenda de reposição...');
  try {
    const response = await adminFetch('/stock/restock-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule }),
    });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro ao salvar agenda de reposição:', error);
    return { success: false };
  }
}

// Re-export do tipo Product para uso nos componentes
export type { Product, CartItem } from '../App';

// ==========================================
// 🏙️ FRANCHISE: Migração de dados para unidade
// ==========================================
export async function migrateFranchiseData(token: string, targetUnitId: string): Promise<{ success: boolean; migrated?: number; details?: Record<string, number>; message?: string }> {
  console.log(`🏙️ [API] Migrando dados para unidade: ${targetUnitId}`);
  try {
    const response = await masterFetch('/franchise/migrate', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Master-Token': token 
      },
      body: JSON.stringify({ targetUnitId }),
    });
    return response.json();
  } catch (error) {
    console.error('❌ [API] Erro na migração de franquia:', error);
    return { success: false, message: String(error) };
  }
}