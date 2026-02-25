import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../utils/supabase/client';

// ==========================================
// HOOK: useRealtime
// Migra polling → Supabase Realtime com fallback gracioso
// 
// Se Realtime funcionar: polling a cada 30s (safety net)
// Se Realtime falhar:   polling a cada 3s (comportamento anterior)
// ==========================================

interface UseRealtimeOptions {
  /** Prefixo da key no KV para filtrar (ex: 'order:', 'archive:', 'driver:') */
  keyPrefixes: string[];
  /** Callback chamado quando dados mudam */
  onDataChange: () => void;
  /** Se o hook deve estar ativo (default: true) */
  enabled?: boolean;
  /** Intervalo de polling com Realtime ativo (ms, default: 30000) */
  realtimePollingInterval?: number;
  /** Intervalo de polling sem Realtime (ms, default: 3000) */
  fallbackPollingInterval?: number;
  /** Nome único do channel (para debug) */
  channelName?: string;
}

export function useRealtime({
  keyPrefixes,
  onDataChange,
  enabled = true,
  realtimePollingInterval = 30000,
  fallbackPollingInterval = 3000,
  channelName = 'kv-changes',
}: UseRealtimeOptions) {
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const channelRef = useRef<any>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval>>();
  const onDataChangeRef = useRef(onDataChange);
  const mountedRef = useRef(true);

  // Manter referência atualizada do callback
  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  // Debounce para evitar muitos refreshes simultâneos
  const lastRefreshRef = useRef(0);
  const debouncedRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshRef.current < 1000) return; // Min 1s entre refreshes
    lastRefreshRef.current = now;
    if (mountedRef.current) {
      onDataChangeRef.current();
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    mountedRef.current = true;

    let realtimeActive = false;

    // ---- 1. Tentar conectar ao Supabase Realtime ----
    const setupRealtime = () => {
      try {
        console.log(`[Realtime] Iniciando conexao do canal "${channelName}"...`);
        console.log(`[Realtime] Supabase client disponivel:`, !!supabase);
        console.log(`[Realtime] Prefixos monitorados:`, keyPrefixes);

        const channel = supabase
          .channel(channelName, {
            config: { broadcast: { self: false } }
          })
          .on(
            'postgres_changes' as any,
            {
              event: '*',
              schema: 'public',
              table: 'kv_store_dfe23da2',
            },
            (payload: any) => {
              // Filtrar por prefixo — apenas reagir a keys relevantes
              const key = payload?.new?.key || payload?.old?.key || '';
              const isRelevant = keyPrefixes.some(prefix => key.startsWith(prefix));

              if (isRelevant) {
                console.log(`[Realtime] Mudanca detectada: ${key}`);
                debouncedRefresh();
              }
            }
          )
          .subscribe((status: string) => {
            console.log(`[Realtime] Status do canal "${channelName}":`, status);
            if (!mountedRef.current) return;

            if (status === 'SUBSCRIBED') {
              console.log(`[Realtime] Canal "${channelName}" conectado com sucesso`);
              realtimeActive = true;
              setIsRealtimeConnected(true);
              // Mudar polling para intervalo lento (safety net)
              setupPolling(realtimePollingInterval);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.warn(`[Realtime] Canal "${channelName}" falhou (${status}) — usando polling rapido`);
              realtimeActive = false;
              setIsRealtimeConnected(false);
              setupPolling(fallbackPollingInterval);
            } else if (status === 'CLOSED') {
              console.log(`[Realtime] Canal "${channelName}" fechado`);
              realtimeActive = false;
              setIsRealtimeConnected(false);
            }
          });

        channelRef.current = channel;
        console.log(`[Realtime] Canal "${channelName}" criado, aguardando subscribe...`);

        // Timeout: se em 10s o subscribe nunca responder, logar aviso
        setTimeout(() => {
          if (mountedRef.current && !realtimeActive) {
            console.warn(`[Realtime] Canal "${channelName}" nao conectou em 10s — mantendo polling rapido (${fallbackPollingInterval}ms)`);
          }
        }, 10000);
      } catch (err) {
        console.warn('[Realtime] Erro ao criar canal — usando polling:', err);
        setIsRealtimeConnected(false);
        setupPolling(fallbackPollingInterval);
      }
    };

    // ---- 2. Polling como fallback ----
    const setupPolling = (interval: number) => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      pollingRef.current = setInterval(() => {
        if (mountedRef.current) {
          onDataChangeRef.current();
        }
      }, interval);
    };

    // Iniciar: primeiro configura polling rápido, depois tenta Realtime
    setupPolling(fallbackPollingInterval);
    setupRealtime();

    // Cleanup
    return () => {
      mountedRef.current = false;

      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }

      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch {}
        channelRef.current = null;
      }
    };
  }, [enabled, channelName, keyPrefixes.join(','), realtimePollingInterval, fallbackPollingInterval, debouncedRefresh]);

  return { isRealtimeConnected };
}

/**
 * Hook simplificado para pedidos (admin/OrderManager usa).
 * Escuta mudanças em order: e archive:.
 */
export function useOrdersRealtime(onRefresh: () => void, enabled = true) {
  return useRealtime({
    keyPrefixes: ['order:', 'archive:'],
    onDataChange: onRefresh,
    enabled,
    channelName: 'orders-realtime',
    realtimePollingInterval: 15000, // Admin precisa de refresh mais frequente
    fallbackPollingInterval: 3000,
  });
}

/**
 * Hook simplificado para delivery (DeliverymanPage usa).
 * Escuta mudanças em order:, archive: e driver:.
 */
export function useDeliveryRealtime(onRefresh: () => void, enabled = true) {
  return useRealtime({
    keyPrefixes: ['order:', 'archive:', 'driver:'],
    onDataChange: onRefresh,
    enabled,
    channelName: 'delivery-realtime',
    realtimePollingInterval: 15000,
    fallbackPollingInterval: 3000,
  });
}

/**
 * Hook simplificado para o cliente (tracking de pedido individual).
 * Polling mais lento porque o cliente não precisa de atualização instantânea.
 */
export function useClientOrderRealtime(onRefresh: () => void, enabled = true) {
  return useRealtime({
    keyPrefixes: ['order:', 'archive:'],
    onDataChange: onRefresh,
    enabled,
    channelName: 'client-order-realtime',
    realtimePollingInterval: 30000,
    fallbackPollingInterval: 5000,
  });
}