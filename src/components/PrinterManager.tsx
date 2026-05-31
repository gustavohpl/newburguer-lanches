import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as api from '../utils/api';
import { useConfig } from '../ConfigContext';

// 🖨️ URL do servidor de impressão local (roda no PC com a impressora)
const PRINT_SERVER_URL = 'http://localhost:9100';

interface PrinterContextType {
  isConnected: boolean;
  printerName: string | null;
  connectPrinter: () => Promise<boolean>;
  disconnectPrinter: () => void;
  testPrint: () => Promise<boolean>;
  printOrder: (order: any) => Promise<boolean>;
}

const PrinterContext = createContext<PrinterContextType | undefined>(undefined);

export function usePrinter() {
  const context = useContext(PrinterContext);
  if (!context) {
    throw new Error('usePrinter deve ser usado dentro de PrinterProvider');
  }
  return context;
}

export function PrinterProvider({ children }: { children: React.ReactNode }) {
  const { config } = useConfig();
  const [isConnected, setIsConnected] = useState(false);

  // Verifica se o servidor de impressão está online
  const checkServer = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(PRINT_SERVER_URL, { method: 'GET', signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      return data.status === 'online';
    } catch {
      return false;
    }
  }, []);

  // Checa o servidor periodicamente
  useEffect(() => {
    let active = true;
    const check = async () => {
      const online = await checkServer();
      if (active) setIsConnected(online);
    };
    check();
    const interval = setInterval(check, 10000); // a cada 10s
    return () => { active = false; clearInterval(interval); };
  }, [checkServer]);

  const connectPrinter = useCallback(async (): Promise<boolean> => {
    console.log('🖨️ [PRINTER] Verificando servidor de impressão...');
    const online = await checkServer();
    setIsConnected(online);
    if (online) {
      alert('✅ Servidor de impressão conectado!');
    } else {
      alert('❌ Servidor de impressão não encontrado.\n\nVerifique se o print_server.py está rodando no computador da impressora.\n\nNo terminal: python3 ~/print_server.py');
    }
    return online;
  }, [checkServer]);

  const disconnectPrinter = useCallback(() => {
    setIsConnected(false);
  }, []);

  const sendToPrintServer = useCallback(async (payload: any): Promise<boolean> => {
    try {
      const res = await fetch(PRINT_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return data.success === true;
    } catch (error) {
      console.error('❌ [PRINTER] Erro ao enviar para servidor:', error);
      return false;
    }
  }, []);

  const testPrint = useCallback(async (): Promise<boolean> => {
    const result = await sendToPrintServer({
      orderId: 'TESTE-001',
      storeName: config.siteName || 'TESTE',
      date: new Date().toLocaleDateString('pt-BR'),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      customerName: 'Cliente Teste',
      customerPhone: '64999999999',
      isDelivery: false,
      pickupLocation: config.address || 'Loja',
      items: [
        { quantity: 1, name: 'Item de Teste', price: 10.0 },
      ],
      subtotal: 10.0,
      deliveryFee: 0,
      total: 10.0,
      paymentMethod: 'TESTE',
    });
    if (result) alert('✅ Teste impresso com sucesso!');
    else alert('❌ Falha ao imprimir teste. Servidor rodando?');
    return result;
  }, [sendToPrintServer, config]);

  const printOrder = useCallback(async (order: any): Promise<boolean> => {
    // Buscar nome do setor
    let sectorName = '';
    if (order.deliverySector) {
      try {
        const response = await api.getDeliverySectors();
        if (response.success && response.sectors) {
          const sector = response.sectors.find((s: any) => s.id === order.deliverySector);
          if (sector) sectorName = sector.name;
        }
      } catch (e) {
        console.error('Erro ao buscar setor', e);
      }
    }

    const now = new Date(order.createdAt);
    const isDelivery = order.deliveryType === 'delivery';
    const deliveryFee = isDelivery ? (order.deliveryFee ?? 0) : 0;

    // Calcular subtotal incluindo adicionais
    const subtotal = (order.items || []).reduce((sum: number, item: any) => {
      const addonsTotal = (item.selectedAddons || []).reduce((a: number, ad: any) => a + (ad.price || 0), 0);
      return sum + (item.price + addonsTotal) * item.quantity;
    }, 0);

    const payload = {
      orderId: order.orderId,
      storeName: config.siteName || 'PEDIDO',
      date: now.toLocaleDateString('pt-BR'),
      time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      isDelivery,
      orderType: order.deliveryType,
      deliveryAddress: isDelivery ? order.address : undefined,
      deliverySector: sectorName || order.deliverySector,
      reference: order.reference,
      pickupLocation: !isDelivery ? (config.address || 'Loja') : undefined,
      items: (order.items || []).map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        selectedAddons: item.selectedAddons || [],
        notes: item.notes,
      })),
      subtotal,
      deliveryFee,
      discount: order.discount || 0,
      total: order.total,
      paymentMethod: order.paymentMethod?.toUpperCase() || 'N/A',
      cardType: order.cardType,
      changeFor: order.changeFor,
    };

    console.log('🖨️ [PRINTER] Enviando pedido para impressão:', payload.orderId);
    const result = await sendToPrintServer(payload);

    if (result) {
      console.log('✅ [PRINTER] Pedido impresso!');
    } else {
      alert('⚠️ Não foi possível imprimir. Verifique se o servidor de impressão está rodando.');
    }
    return result;
  }, [sendToPrintServer, config]);

  const value: PrinterContextType = {
    isConnected,
    printerName: isConnected ? 'Servidor de Impressão' : null,
    connectPrinter,
    disconnectPrinter,
    testPrint,
    printOrder,
  };

  return (
    <PrinterContext.Provider value={value}>
      {children}
    </PrinterContext.Provider>
  );
}
