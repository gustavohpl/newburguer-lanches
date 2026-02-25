import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as thermalPrinter from '../utils/thermalPrinter';
import type { PrinterConnection, OrderPrintData } from '../utils/thermalPrinter';

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
  const [printerConnection, setPrinterConnection] = useState<PrinterConnection | null>(null);
  const [printerName, setPrinterName] = useState<string | null>(null);

  const connectPrinter = useCallback(async (): Promise<boolean> => {
    try {
      console.log('🖨️ [PRINTER] Iniciando conexão USB...');
      
      // Verificar se Web Serial API está disponível
      if (!('serial' in navigator)) {
        alert('❌ Seu navegador não suporta conexão USB Serial.\n\nUse Google Chrome, Edge ou Opera.');
        return false;
      }

      const connection = await thermalPrinter.connectToPrinter();
      
      if (connection) {
        setPrinterConnection(connection);
        setPrinterName('Impressora USB'); // Você pode obter mais info da porta se necessário
        console.log('✅ [PRINTER] Impressora USB conectada com sucesso!');
        alert('✅ Impressora USB conectada com sucesso!');
        return true;
      } else {
        alert('❌ Falha ao conectar a impressora USB.');
        return false;
      }
    } catch (error) {
      console.error('❌ [PRINTER] Erro ao conectar:', error);
      alert('❌ Erro ao conectar impressora USB. Verifique a conexão.');
      return false;
    }
  }, []);

  const disconnectPrinter = useCallback(() => {
    if (printerConnection) {
      console.log('🖨️ [PRINTER] Desconectando impressora USB...');
      thermalPrinter.disconnectPrinter(printerConnection);
      setPrinterConnection(null);
      setPrinterName(null);
      console.log('✅ [PRINTER] Impressora desconectada');
      alert('🖨️ Impressora desconectada');
    }
  }, [printerConnection]);

  const testPrint = useCallback(async (): Promise<boolean> => {
    if (!printerConnection) {
      console.error('❌ [PRINTER] Impressora não conectada');
      return false;
    }

    try {
      console.log('🖨️ [PRINTER] Testando impressão...');
      const result = await thermalPrinter.testPrint(printerConnection);
      
      if (result) {
        console.log('✅ [PRINTER] Teste de impressão bem-sucedido!');
      } else {
        console.error('❌ [PRINTER] Falha no teste de impressão');
      }
      
      return result;
    } catch (error) {
      console.error('❌ [PRINTER] Erro no teste de impressão:', error);
      return false;
    }
  }, [printerConnection]);

  const printOrder = useCallback(async (order: any): Promise<boolean> => {
    if (!printerConnection) {
      console.error('❌ [PRINTER] Impressora não conectada');
      alert('⚠️ Impressora não conectada! Vá em Configurações para conectar.');
      return false;
    }

    try {
      // 🆕 Buscar o nome do setor antes de imprimir se tivermos o ID
      let sectorName = '';
      if (order.deliverySector) {
        try {
          const response = await api.getDeliverySectors();
          if (response.success && response.sectors) {
            const sector = response.sectors.find((s: any) => s.id === order.deliverySector);
            if (sector) sectorName = sector.name;
          }
        } catch (e) {
          console.error('Erro ao buscar nome do setor para impressão', e);
        }
      }

      console.log('🖨️ [PRINTER] Formatando pedido para impressão...', order);
      
      // Formatar o pedido do banco para o formato OrderPrintData
      const now = new Date(order.createdAt);
      const printData: OrderPrintData = {
        orderId: order.orderId,
        date: now.toLocaleDateString('pt-BR'),
        time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        items: order.items.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price * item.quantity,
        })),
        subtotal: order.total - (order.deliveryType === 'delivery' ? 5 : 0),
        deliveryFee: order.deliveryType === 'delivery' ? 5 : 0,
        total: order.total,
        paymentMethod: order.paymentMethod?.toUpperCase() || 'N/A',
        cardType: order.cardType, // Crédito ou Débito
        changeFor: order.changeFor, // Troco
        deliveryAddress: order.deliveryType === 'delivery' ? order.address : undefined,
        deliverySector: sectorName || order.deliverySector, // Usa o nome real do setor
        reference: order.reference, // Ponto de referência
        pickupLocation: order.deliveryType !== 'delivery' ? 'Praça Lucio Prado - Goiatuba/GO' : undefined,
        isDelivery: order.deliveryType === 'delivery',
        orderType: order.deliveryType, 
        estimatedTime: order.estimatedTime,
      };
      
      console.log('🖨️ [PRINTER] Dados formatados:', printData);
      console.log('🖨️ [PRINTER] Imprimindo pedido:', printData.orderId);
      const result = await thermalPrinter.printOrder(printerConnection, printData);
      
      if (result) {
        console.log('✅ [PRINTER] Pedido impresso com sucesso!');
        alert('✅ Cupom impresso com sucesso!');
      } else {
        console.error('❌ [PRINTER] Falha ao imprimir pedido');
        alert('❌ Falha ao imprimir cupom. Verifique a impressora.');
      }
      
      return result;
    } catch (error) {
      console.error('❌ [PRINTER] Erro ao imprimir pedido:', error);
      alert('❌ Erro ao imprimir cupom. Verifique a conexão.');
      return false;
    }
  }, [printerConnection]);

  const value: PrinterContextType = {
    isConnected: !!printerConnection,
    printerName,
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