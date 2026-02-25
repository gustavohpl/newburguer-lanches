// Sistema de Impressão Térmica ESC/POS
// Compatível com impressoras térmicas 58mm via USB Serial

export interface PrinterConnection {
  port: SerialPort;
  writer: WritableStreamDefaultWriter | null;
}

export interface OrderPrintData {
  orderId: string;
  date: string;
  time: string;
  customerName: string;
  customerPhone: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    extras?: string;
  }>;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  cardType?: string; // 🆕 Crédito ou Débito
  changeFor?: number; // 🆕 Troco para
  deliveryAddress?: string;
  deliverySector?: string; // 🆕 Nome do setor
  reference?: string; // 🆕 Ponto de referência
  pickupLocation?: string;
  isDelivery: boolean;
  orderType?: 'delivery' | 'pickup' | 'dine-in'; // Tipo do pedido
  estimatedTime?: number; // Tempo estimado em minutos
  selectedAcompanhamentos?: Array<{ id: string; name: string }>; // Molhos selecionados
}

// Comandos ESC/POS para impressoras térmicas
const ESC = '\x1B';
const GS = '\x1D';

const Commands = {
  INIT: ESC + '@',                    // Inicializar impressora
  ALIGN_LEFT: ESC + 'a' + '\x00',     // Alinhar à esquerda
  ALIGN_CENTER: ESC + 'a' + '\x01',   // Alinhar ao centro
  ALIGN_RIGHT: ESC + 'a' + '\x02',    // Alinhar à direita
  BOLD_ON: ESC + 'E' + '\x01',        // Negrito ON
  BOLD_OFF: ESC + 'E' + '\x00',       // Negrito OFF
  FONT_LARGE: GS + '!' + '\x11',      // Fonte grande (2x altura e largura)
  FONT_MEDIUM: GS + '!' + '\x01',     // Fonte média (2x altura)
  FONT_NORMAL: GS + '!' + '\x00',     // Fonte normal
  UNDERLINE_ON: ESC + '-' + '\x01',   // Sublinhado ON
  UNDERLINE_OFF: ESC + '-' + '\x00',  // Sublinhado OFF
  LINE_FEED: '\n',                    // Nova linha
  CUT_PAPER: GS + 'V' + '\x41' + '\x00', // Cortar papel
};

// Converter string para bytes (UTF-8)
function stringToBytes(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

// Conectar à impressora via USB Serial
export async function connectToPrinter(): Promise<PrinterConnection | null> {
  try {
    // Solicitar porta serial (sem filtros para aceitar qualquer impressora)
    const port = await navigator.serial.requestPort();

    console.log('🖨️ Conectando à impressora USB...');

    // Abrir porta serial com configurações padrão para impressoras térmicas
    await port.open({ 
      baudRate: 9600,  // Velocidade padrão (pode variar: 9600, 19200, 38400, 115200)
      dataBits: 8,
      stopBits: 1,
      parity: 'none'
    });

    // Obter writer para enviar dados
    const writer = port.writable?.getWriter();
    
    if (!writer) {
      throw new Error('Não foi possível obter o writer da porta serial');
    }

    console.log('✅ Impressora USB conectada com sucesso!');

    return {
      port,
      writer,
    };
  } catch (error) {
    console.error('❌ Erro ao conectar impressora:', error);
    return null;
  }
}

// Enviar dados para a impressora
async function sendToPrinter(
  writer: WritableStreamDefaultWriter,
  data: string
): Promise<void> {
  const bytes = stringToBytes(data);
  const chunkSize = 512; // Tamanho do chunk (algumas impressoras limitam)

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    await writer.write(chunk);
    // Pequeno delay para não sobrecarregar
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

// Formatar linha com padding (para 58mm = ~32 caracteres)
function formatLine(left: string, right: string, width: number = 32): string {
  const availableSpace = width - left.length - right.length;
  const dots = '.'.repeat(Math.max(0, availableSpace));
  return left + dots + right + '\n';
}

// Centralizar texto
function centerText(text: string, width: number = 32): string {
  const spaces = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(spaces) + text + '\n';
}

// Linha separadora
function separator(char: string = '=', width: number = 32): string {
  return char.repeat(width) + '\n';
}

// Imprimir cupom de pedido
export async function printOrder(
  connection: PrinterConnection,
  order: OrderPrintData
): Promise<boolean> {
  if (!connection.writer) {
    console.error('❌ Impressora não conectada');
    return false;
  }

  try {
    let receipt = '';

    // Inicializar impressora
    receipt += Commands.INIT;

    // CABEÇALHO
    receipt += Commands.ALIGN_CENTER;
    receipt += Commands.FONT_LARGE;
    receipt += Commands.BOLD_ON;
    receipt += separator('=');
    receipt += centerText('🍔 NEWBURGUER LANCHES 🍔');
    receipt += separator('=');
    receipt += Commands.BOLD_OFF;
    receipt += Commands.FONT_NORMAL;

    // Número do pedido e data/hora
    receipt += Commands.ALIGN_CENTER;
    receipt += `PEDIDO #${order.orderId}\n`;
    receipt += `${order.date} - ${order.time}\n`;

    // Estimativa de tempo
    if (order.estimatedTime) {
      receipt += Commands.BOLD_ON;
      receipt += `\n🕒 PREVISÃO: ${order.estimatedTime} min\n`;
      receipt += Commands.BOLD_OFF;
    }
    receipt += '\n';

    // Dados do cliente
    receipt += Commands.ALIGN_LEFT;
    receipt += separator('-');
    receipt += Commands.BOLD_ON;
    receipt += `CLIENTE: ${order.customerName}\n`;
    receipt += `TELEFONE: ${order.customerPhone}\n`;
    receipt += Commands.BOLD_OFF;
    receipt += separator('-');
    receipt += '\n';

    // ITENS DO PEDIDO
    receipt += Commands.BOLD_ON;
    receipt += '🍔 ITENS DO PEDIDO:\n\n';
    receipt += Commands.BOLD_OFF;

    order.items.forEach(item => {
      const itemLine = `${item.quantity}x ${item.name}`;
      const priceLine = `R$ ${item.price.toFixed(2).replace('.', ',')}`;
      receipt += formatLine(itemLine, priceLine, 32);
      
      if (item.extras) {
        receipt += `   + ${item.extras}\n`;
      }
      receipt += '\n';
    });

    // ACOMPANHAMENTOS / MOLHOS
    if (order.selectedAcompanhamentos && order.selectedAcompanhamentos.length > 0) {
      receipt += Commands.BOLD_ON;
      receipt += '🍟 ACOMPANHAMENTOS:\n';
      receipt += Commands.BOLD_OFF;
      order.selectedAcompanhamentos.forEach(a => {
        receipt += `   • ${a.name}\n`;
      });
      receipt += '\n';
    }

    // TOTAIS
    receipt += separator('-');
    receipt += formatLine('SUBTOTAL', `R$ ${order.subtotal.toFixed(2).replace('.', ',')}`, 32);
    
    if (order.isDelivery) {
      receipt += formatLine('ENTREGA', `R$ ${order.deliveryFee.toFixed(2).replace('.', ',')}`, 32);
    }
    
    receipt += separator('-');
    receipt += Commands.BOLD_ON;
    receipt += Commands.FONT_MEDIUM;
    receipt += formatLine('TOTAL', `R$ ${order.total.toFixed(2).replace('.', ',')}`, 32);
    receipt += Commands.FONT_NORMAL;
    receipt += Commands.BOLD_OFF;
    receipt += separator('=');
    receipt += '\n';

    // PAGAMENTO
    receipt += Commands.BOLD_ON;
    receipt += `💳 PAGAMENTO: ${order.paymentMethod}\n`;
    if (order.cardType) {
      receipt += `   Tipo: ${order.cardType.toUpperCase()}\n`;
    }
    receipt += Commands.BOLD_OFF;
    
    if (order.paymentMethod === 'PIX') {
      receipt += `Chave: 64993392970\n`;
    }

    if (order.changeFor && order.changeFor > order.total) {
      receipt += Commands.BOLD_ON;
      receipt += `💵 TROCO PARA: R$ ${order.changeFor.toFixed(2).replace('.', ',')}\n`;
      receipt += `   Devolver: R$ ${(order.changeFor - order.total).toFixed(2).replace('.', ',')}\n`;
      receipt += Commands.BOLD_OFF;
    }
    receipt += '\n';

    // ENDEREÇO DE ENTREGA OU RETIRADA
    if (order.isDelivery && order.deliveryAddress) {
      receipt += Commands.BOLD_ON;
      receipt += '📍 ENTREGA:\n';
      receipt += Commands.BOLD_OFF;
      receipt += `${order.deliveryAddress}\n`;
      if (order.reference) {
        receipt += `Ref: ${order.reference}\n`;
      }
      if (order.deliverySector) {
        receipt += Commands.BOLD_ON;
        receipt += `SETOR: ${order.deliverySector.toUpperCase()}\n`;
        receipt += Commands.BOLD_OFF;
      }
      receipt += '\n';
    } else if (order.orderType === 'dine-in') {
      // CONSUMIR NO LOCAL
      receipt += Commands.BOLD_ON;
      receipt += '🍽️ CONSUMIR NO LOCAL:\n';
      receipt += Commands.BOLD_OFF;
      receipt += `${order.pickupLocation || 'Praça Lucio Prado - Goiatuba/GO'}\n\n`;
    } else if (!order.isDelivery && order.pickupLocation) {
      // RETIRADA
      receipt += Commands.BOLD_ON;
      receipt += '📍 RETIRADA NO LOCAL:\n';
      receipt += Commands.BOLD_OFF;
      receipt += `${order.pickupLocation}\n\n`;
    }

    // HORÁRIO DO PEDIDO
    receipt += `⏰ Pedido feito às ${order.time}\n\n`;

    // RODAPÉ
    receipt += Commands.ALIGN_CENTER;
    receipt += separator('=');
    receipt += 'Obrigado pela preferência!\n';
    receipt += 'Abrimos às 18h30\n';
    receipt += separator('=');
    receipt += '\n\n\n';

    // Cortar papel
    receipt += Commands.CUT_PAPER;

    // Enviar para impressora
    await sendToPrinter(connection.writer, receipt);

    console.log('✅ Cupom impresso com sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro ao imprimir:', error);
    return false;
  }
}

// Testar conexão da impressora
export async function testPrint(connection: PrinterConnection): Promise<boolean> {
  if (!connection.writer) {
    return false;
  }

  try {
    let testReceipt = '';
    testReceipt += Commands.INIT;
    testReceipt += Commands.ALIGN_CENTER;
    testReceipt += Commands.FONT_LARGE;
    testReceipt += Commands.BOLD_ON;
    testReceipt += '🍔 NEWBURGUER LANCHES 🍔\n\n';
    testReceipt += Commands.FONT_NORMAL;
    testReceipt += Commands.BOLD_OFF;
    testReceipt += '✅ Impressora conectada!\n';
    testReceipt += '✅ Teste bem-sucedido!\n\n';
    testReceipt += separator('=');
    testReceipt += `Testado em: ${new Date().toLocaleString('pt-BR')}\n\n\n`;
    testReceipt += Commands.CUT_PAPER;

    await sendToPrinter(connection.writer, testReceipt);
    return true;
  } catch (error) {
    console.error('❌ Erro no teste de impressão:', error);
    return false;
  }
}

// Desconectar impressora
export function disconnectPrinter(connection: PrinterConnection): void {
  if (connection.writer) {
    connection.writer.releaseLock();
    connection.port.close();
    console.log('🖨️ Impressora desconectada');
  }
}