import React, { useState, useEffect } from 'react';
import { X, MapPin, Home, UtensilsCrossed, Copy, Check, CheckCircle, ChevronLeft, User, LogOut, Clock, RotateCcw, Trash2, Phone, CreditCard, Banknote, Ticket, ReceiptText, Droplets } from 'lucide-react';
import type { CartItem } from '../App';
import * as api from '../utils/api';
import { sanitizeName, sanitizePhone, sanitizeText, sanitizeAddress } from '../utils/sanitize';
import { PixPayment } from './PixPayment';
import { PixPaymentPagSeguro } from './PixPaymentPagSeguro';
import { CardPaymentOptions } from './CardPaymentOptions';
import { PaymentConfirmed } from './PaymentConfirmed';
import { usePrinter } from './PrinterManager';
import type { OrderPrintData } from '../utils/thermalPrinter';
import { useCustomer } from '../hooks/useCustomer';
import { useConfig } from '../ConfigContext';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  totalPrice: number;
  onOrderComplete: () => void;
  onOrderCreated?: (orderId: string) => void;
  isStoreOpen: boolean;
  deliveryFee: number;
  allProducts?: Array<{ id: string; recipe?: any; promoItems?: any[] }>;
}

type DeliveryType = 'delivery' | 'pickup' | 'dine-in';
type PaymentMethod = 'pix' | 'card' | 'cash';

export function CheckoutModal({
  isOpen,
  onClose,
  items,
  totalPrice,
  onOrderComplete,
  onOrderCreated,
  isStoreOpen,
  deliveryFee,
  allProducts = []
}: CheckoutModalProps) {
  const { config } = useConfig();
  const [step, setStep] = useState(1);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('delivery');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  
  // Modais de Pagamento
  const [showPixPayment, setShowPixPayment] = useState(false); // Manual
  const [showPixPaymentPagSeguro, setShowPixPaymentPagSeguro] = useState(false); // Automático
  const [showCardPaymentOptions, setShowCardPaymentOptions] = useState(false); // Cartão Automático
  const [showPaymentConfirmed, setShowPaymentConfirmed] = useState(false);
  
  const [currentOrderId, setCurrentOrderId] = useState<string>('');
  
  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState(''); // Rua
  const [houseNumber, setHouseNumber] = useState(''); // Número
  const [neighborhood, setNeighborhood] = useState(''); // Bairro/Setor
  const [address, setAddress] = useState(''); // Computed: rua + número + bairro (backward compat)
  const [reference, setReference] = useState('');
  const [deliverySector, setDeliverySector] = useState(''); // 🆕 Setor de entrega
  const [changeFor, setChangeFor] = useState(''); // 🆕 Troco para quanto?
  const [cardType, setCardType] = useState<'credit' | 'debit' | ''>(''); // 🆕 Tipo de cartão (crédito/débito)
  
  // 🆕 Pagamento misto (duas formas)
  const [splitPayment, setSplitPayment] = useState(false);
  const [splitMethod1, setSplitMethod1] = useState<PaymentMethod>('pix');
  const [splitMethod2, setSplitMethod2] = useState<PaymentMethod>('cash');
  const [splitAmount1, setSplitAmount1] = useState('');
  
  // 🆕 Setores disponíveis
  const [availableSectors, setAvailableSectors] = useState<Array<{id: string, name: string, color: string}>>([]);
  
  // Cupom de desconto
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<api.Coupon | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Acompanhamentos (molhos) selecionados pelo cliente
  const [selectedAcompanhamentos, setSelectedAcompanhamentos] = useState<string[]>([]);

  // Estimates
  const [estimates, setEstimates] = useState<api.TimeEstimates | null>(null);

  // Printer integration
  const { isConnected, printOrderReceipt } = usePrinter();
  
  // Customer Hook
  const { customer, fetchCustomer, loading: loadingCustomer, logout } = useCustomer();
  const [useSavedAddress, setUseSavedAddress] = useState(false);

  useEffect(() => {
    loadEstimates();
    loadSectors(); // 🆕 Carregar setores disponíveis na montagem
    
    // Check for auto-applied coupon from URL
    const savedCoupon = localStorage.getItem('faroeste_cupom_ativo');
    if (savedCoupon) {
      setCouponCode(savedCoupon);
    }

    // Auto-fill from localStorage (Backup se useCustomer não tiver dados ainda ou for fallback)
    const storedInfo = localStorage.getItem('faroeste_customer_info');
    if (storedInfo) {
       try {
         const parsed = JSON.parse(storedInfo);
         if (parsed.name && !name) setName(parsed.name);
         if (parsed.phone && !phone) setPhone(parsed.phone);
         // Auto-fill address info if available and not set
         if (parsed.street && !street) setStreet(parsed.street);
         if (parsed.houseNumber && !houseNumber) setHouseNumber(parsed.houseNumber);
         if (parsed.neighborhood && !neighborhood) setNeighborhood(parsed.neighborhood);
         // Backward compat: old format had single address field
         if (!parsed.street && parsed.address && !street) setStreet(parsed.address);
         if (parsed.reference && !reference) setReference(parsed.reference);
         if (parsed.deliverySector && !deliverySector) setDeliverySector(parsed.deliverySector);
       } catch (e) {
         console.error('Erro ao ler dados locais do cliente', e);
       }
    }
  }, []);

  // Computar endereço completo a partir de rua + número + bairro
  useEffect(() => {
    const parts = [street.trim(), houseNumber.trim(), neighborhood.trim()].filter(Boolean);
    setAddress(parts.join(', '));
  }, [street, houseNumber, neighborhood]);

  useEffect(() => {
    // Auto-fill if customer exists (Tem prioridade sobre localStorage cru)
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone);
      if (customer.addresses.length > 0) {
        setUseSavedAddress(true);
        // Default to first address - try to split if comma-separated
        const fullAddr = customer.addresses[0].street || '';
        const commaIdx = fullAddr.indexOf(',');
        if (commaIdx > 0) {
          setStreet(fullAddr.substring(0, commaIdx).trim());
          setHouseNumber(fullAddr.substring(commaIdx + 1).trim());
        } else {
          setStreet(fullAddr);
        }
        setReference(customer.addresses[0].reference || '');
      }
    }
  }, [customer]); // Re-run when customer loads

  const loadEstimates = async () => {
    try {
      const response = await api.getEstimates();
      if (response.success && response.estimates) {
        setEstimates(response.estimates);
      }
    } catch (error) {
      console.error('Erro ao carregar estimativas:', error);
    }
  };

  // 🆕 Carregar setores disponíveis
  const loadSectors = async () => {
    try {
      const response = await api.getDeliverySectors();
      if (response.success && response.sectors) {
        setAvailableSectors(response.sectors);
        console.log('📍 [SETORES] Setores carregados:', response.sectors);
      }
    } catch (error) {
      console.error('❌ [SETORES] Erro ao carregar setores:', error);
    }
  };

  const getEstimateForType = (type: DeliveryType) => {
    if (!estimates) return null;
    switch (type) {
      case 'delivery': return estimates.delivery;
      case 'pickup': return estimates.pickup;
      case 'dine-in': return estimates.dineIn;
      default: return null;
    }
  };

  // Coletar acompanhamentos disponíveis dos produtos no carrinho (incluindo sub-produtos de promoções)
  const availableAcompanhamentos = React.useMemo(() => {
    const acompMap = new Map<string, { id: string; name: string; defaultQty: number }>();
    
    const collectFromRecipe = (recipe: any) => {
      if (!recipe?.ingredients) return;
      for (const ri of recipe.ingredients) {
        if (ri.category === 'acompanhamento' && !acompMap.has(ri.ingredientId)) {
          acompMap.set(ri.ingredientId, {
            id: ri.ingredientId,
            name: ri.ingredientName || 'Acompanhamento',
            defaultQty: ri.defaultQuantityPerOrder || ri.quantityUsed || 1,
          });
        }
      }
    };
    
    for (const item of items) {
      // Coletar da receita do próprio item
      collectFromRecipe(item.recipe);
      
      // Se for promoção, coletar dos sub-produtos
      if (item.promoItems && item.promoItems.length > 0 && allProducts.length > 0) {
        for (const promoItem of item.promoItems) {
          const subProduct = allProducts.find(p => p.id === promoItem.productId);
          if (subProduct) {
            collectFromRecipe(subProduct.recipe);
          }
        }
      }
    }
    return Array.from(acompMap.values());
  }, [items, allProducts]);

  // Verificar se algum produto tem acompanhamentos e não é dine-in
  const showAcompanhamentos = availableAcompanhamentos.length > 0 && deliveryType !== 'dine-in';

  const toggleAcompanhamento = (id: string) => {
    setSelectedAcompanhamentos(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const PICKUP_ADDRESS = config.address || 'Praça Lucio Prado - Goiatuba/GO';
  const WHATSAPP_NUMBER = config.whatsappNumber || '5564993392970';
  // const DELIVERY_FEE = 5.00; // Removed hardcoded fee

  // Calcular total com taxa de entrega
  const getFinalTotal = () => {
    return deliveryType === 'delivery' ? totalPrice + deliveryFee : totalPrice;
  };
  
  // Calcular total com desconto do cupom
  // O cupom desconta APENAS do subtotal dos produtos, a taxa de entrega NÃO é afetada
  const getTotalWithDiscount = () => {
    const discountedProducts = Math.max(0, totalPrice - couponDiscount);
    const delivery = deliveryType === 'delivery' ? deliveryFee : 0;
    return discountedProducts + delivery;
  };
  
  // Validar cupom
  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Digite um código de cupom');
      return;
    }
    
    setIsValidatingCoupon(true);
    setCouponError('');
    
    try {
      // Enviar apenas o subtotal dos produtos (sem taxa de entrega) para cálculo do desconto
      const response = await api.validateCoupon(couponCode.toUpperCase().trim(), totalPrice);
      
      if (response.success && response.valid && response.coupon && response.discount !== undefined) {
        setAppliedCoupon(response.coupon);
        setCouponDiscount(response.discount);
        setCouponError('');
      } else {
        setCouponError(response.error || 'Cupom inválido ou expirado');
        setAppliedCoupon(null);
        setCouponDiscount(0);
      }
    } catch (error) {
      setCouponError('Erro ao validar cupom');
      setAppliedCoupon(null);
      setCouponDiscount(0);
    } finally {
      setIsValidatingCoupon(false);
    }
  };
  
  // Remover cupom aplicado
  const handleRemoveCoupon = () => {
    setCouponCode('');
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponError('');
    localStorage.removeItem('faroeste_cupom_ativo'); // Clear from storage too
  };

  if (!isOpen) return null;

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formatted = formatPhone(rawValue);
    setPhone(formatted);
    
    // Tentar identificar cliente quando terminar de digitar
    const numbers = rawValue.replace(/\D/g, '');
    if (numbers.length >= 10 && !customer) {
      // Debounce simples ou check direto
      // Para UX melhor, vamos fazer apenas quando sair do campo ou clicar em botão
    }
  };

  const handleIdentifyCustomer = () => {
    if (phone.replace(/\D/g, '').length >= 10) {
      fetchCustomer(phone);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Verificar se a loja está aberta
    if (!isStoreOpen) {
      alert('🕒 Desculpe, a loja está fechada no momento!\n\n⏰ Horário de funcionamento: A partir das 18h30\n\nAguardamos você!');
      return;
    }
    
    // Validações
    if (!name.trim() || !phone.trim()) {
      alert('Por favor, preencha nome e telefone');
      return;
    }

    if (deliveryType === 'delivery' && !street.trim()) {
      alert('Por favor, preencha a rua');
      return;
    }

    if (deliveryType === 'delivery' && !houseNumber.trim()) {
      alert('Por favor, preencha o número');
      return;
    }

    if (deliveryType === 'delivery' && !neighborhood.trim()) {
      alert('Por favor, preencha o bairro/setor');
      return;
    }

    // 🆕 Validação de setor (obrigatório quando há setores disponíveis)
    if (deliveryType === 'delivery' && availableSectors.length > 0 && !deliverySector) {
      alert('📍 Por favor, selecione o setor de entrega');
      return;
    }

    // 🆕 Validação de tipo de cartão
    if (!splitPayment && paymentMethod === 'card' && !cardType) {
      alert('Por favor, selecione se o pagamento será no Crédito ou Débito');
      return;
    }

    // 🆕 Validação de pagamento misto
    if (splitPayment) {
      const total = getTotalWithDiscount();
      const amt1 = parseFloat(splitAmount1) || 0;
      const amt2 = parseFloat((total - amt1).toFixed(2));
      if (amt1 <= 0 || amt2 <= 0) {
        alert('Os valores do pagamento misto devem ser maiores que zero');
        return;
      }
      if (splitMethod1 === splitMethod2) {
        alert('Selecione duas formas de pagamento diferentes');
        return;
      }
    }

    // 🚀 IMPORTANTE: Sistema SEMPRE aceita pedidos, mesmo sem entregadores online
    // Quando não há entregadores, o admin gerencia manualmente os status
    // Isso garante que o negócio nunca perca vendas por falta de entregadores cadastrados
    
    console.log('✅ [CHECKOUT] Sistema aceita pedidos independente de entregadores online');

    try {
      setIsSubmitting(true);
      
      // Montar info de pagamento
      const paymentInfo = splitPayment ? {
        paymentMethod: 'split' as any,
        splitPayment: true,
        splitMethod1,
        splitMethod2,
        splitAmount1: parseFloat(splitAmount1) || 0,
        splitAmount2: parseFloat((getTotalWithDiscount() - (parseFloat(splitAmount1) || 0)).toFixed(2)),
      } : {
        paymentMethod,
        cardType: paymentMethod === 'card' ? cardType : null,
        changeFor: paymentMethod === 'cash' && changeFor ? parseFloat(changeFor) : null,
      };
      
      // Salvar pedido no banco de dados
      const orderData = {
        customerName: sanitizeName(name),
        customerPhone: sanitizePhone(phone),
        deliveryType,
        address: deliveryType === 'delivery' ? sanitizeAddress(address) : PICKUP_ADDRESS,
        reference: reference ? sanitizeText(reference, 300) : null,
        deliverySector: deliveryType === 'delivery' && deliverySector ? deliverySector : null,
        ...paymentInfo,
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          notes: item.notes ? sanitizeText(item.notes, 300) : undefined,
        })),
        total: getTotalWithDiscount(),
        totalBeforeDiscount: getFinalTotal(),
        deliveryFee: deliveryType === 'delivery' ? deliveryFee : 0,
        estimatedTime: getEstimateForType(deliveryType),
        couponCode: appliedCoupon?.code || null,
        couponDiscount: couponDiscount || 0,
        // Acompanhamentos selecionados pelo cliente (para desconto no estoque e exibição no admin)
        selectedAcompanhamentos: deliveryType !== 'dine-in'
          ? selectedAcompanhamentos.map(aId => {
              const acomp = availableAcompanhamentos.find(a => a.id === aId);
              return { id: aId, name: acomp?.name || aId };
            })
          : [],
        // Se for automático e PIX, status inicial é pending (aguardando pagamento)
        // Se for manual, status é pending (aguardando admin confirmar)
        status: 'pending' 
      };

      console.log('📦 [CHECKOUT] Criando pedido...', orderData);
      const response = await api.createOrder(orderData);
      
      if (!response.success) {
        console.error('❌ [CHECKOUT] Erro ao criar pedido:', response.error);
        alert('Erro ao criar pedido. Tente novamente.');
        setIsSubmitting(false);
        return;
      }

      const orderId = response.order.orderId;
      console.log('✅ [CHECKOUT] Pedido criado com sucesso! ID:', orderId);
      setCurrentOrderId(orderId);
      
      // 🎫 NOTA: O incremento do uso do cupom é feito pelo SERVIDOR durante POST /orders
      // para evitar race conditions. NÃO incrementar novamente aqui.
      
      // 🔔 REGISTRAR PEDIDO PARA POLLING DE CONFIRMAÇÃO
      // Salvar telefone do cliente para polling
      localStorage.setItem('faroeste_customer_phone', phone);
      
      // Adicionar pedido à lista de pendentes
      const pendingOrdersKey = 'faroeste_pending_orders';
      const pendingOrders = JSON.parse(localStorage.getItem(pendingOrdersKey) || '{}');
      pendingOrders[orderId] = 'pending';
      localStorage.setItem(pendingOrdersKey, JSON.stringify(pendingOrders));
      console.log('🔔 [CHECKOUT] Pedido registrado para polling:', orderId);
      
      // Chamar callback com orderId se fornecido (para tracking analytics etc)
      if (onOrderCreated) {
        onOrderCreated(orderId);
      }

      // FLUXO DE PAGAMENTO
      
      // 1. PIX
      if (paymentMethod === 'pix') {
        const isAutoPaymentEnabled = config.automaticPayment && config.features?.automaticPaymentAllowed !== false;
        
        if (isAutoPaymentEnabled) {
           console.log('💳 [CHECKOUT] Usando PIX Automático');
           setShowPixPaymentPagSeguro(true);
        } else {
           console.log('💳 [CHECKOUT] Usando PIX Manual');
           setShowPixPayment(true);
        }
        return; // Pára aqui e espera o modal resolver
      }

      // 2. CARTÃO
      if (paymentMethod === 'card') {
        const isAutoPaymentEnabled = config.automaticPayment && config.features?.automaticPaymentAllowed !== false;

        if (isAutoPaymentEnabled) {
          console.log('💳 [CHECKOUT] Cartão Automático - Abrindo opções');
          setShowCardPaymentOptions(true);
          return; // Pára aqui e espera escolha (Online ou Maquininha)
        } else {
          // Modo Manual: Cartão = Levar Maquininha
          console.log('💳 [CHECKOUT] Cartão Manual - Perguntar antes de enviar WhatsApp');
          
          // 🆕 PERGUNTAR ANTES DE ENVIAR WHATSAPP
          const shouldSendWhatsApp = window.confirm(
            '✅ Pedido confirmado com sucesso!\n\n' +
            '💳 Pagamento: Cartão na Entrega\n\n' +
            'Deseja enviar os detalhes do pedido para o WhatsApp da loja?'
          );
          
          if (shouldSendWhatsApp) {
            finishOrderAndNotify(orderId, 'Cartão (Levar Maquininha)');
          } else {
            finishOrderWithoutWhatsApp(orderId);
          }
          return;
        }
      }

      // 3. DINHEIRO
      if (paymentMethod === 'cash') {
        console.log('💵 [CHECKOUT] Dinheiro - Perguntar antes de enviar WhatsApp');
        
        // 🆕 PERGUNTAR ANTES DE ENVIAR WHATSAPP
        const shouldSendWhatsApp = window.confirm(
          '✅ Pedido confirmado com sucesso!\n\n' +
          '💵 Pagamento: Dinheiro na Entrega\n\n' +
          'Deseja enviar os detalhes do pedido para o WhatsApp da loja?'
        );
        
        if (shouldSendWhatsApp) {
          finishOrderAndNotify(orderId, 'Dinheiro (Troco?)');
        } else {
          finishOrderWithoutWhatsApp(orderId);
        }
        return;
      }

    } catch (error) {
      console.error('❌ [CHECKOUT] Erro ao processar pedido:', error);
      alert('Erro ao processar pedido. Tente novamente.');
      setIsSubmitting(false);
    }
  };

  // Função auxiliar para finalizar fluxo e notificar
  const finishOrderAndNotify = async (orderId: string, paymentDetails: string) => {
    // Salvar no histórico local
    saveOrderToLocalHistory({
      orderId: orderId,
      customerName: name,
      customerPhone: phone,
      total: getTotalWithDiscount(),
      deliveryType: deliveryType,
      status: 'pending',
      createdAt: new Date().toISOString(),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    });

    // Tentar imprimir
    if (isConnected) {
        // Lógica de impressão (simplificada aqui, reutiliza a existente se possível)
        // ... (código de impressão existente seria chamado aqui)
    }

    // ✅ RESETAR isSubmitting ANTES de enviar WhatsApp
    setIsSubmitting(false);

    // Enviar WhatsApp
    sendWhatsAppMessage(orderId);
  };

  // 🆕 Função para finalizar pedido SEM enviar WhatsApp (mas mostra modal de confirmação)
  const finishOrderWithoutWhatsApp = async (orderId: string) => {
    console.log('✅ [CHECKOUT] Finalizando pedido sem WhatsApp:', orderId);
    
    // Salvar no histórico local
    saveOrderToLocalHistory({
      orderId: orderId,
      customerName: name,
      customerPhone: phone,
      total: getTotalWithDiscount(),
      deliveryType: deliveryType,
      status: 'pending',
      createdAt: new Date().toISOString(),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    });

    // Salvar dados básicos no localStorage para auto-preenchimento futuro
    localStorage.setItem('faroeste_customer_info', JSON.stringify({ 
      name, 
      phone,
      address: deliveryType === 'delivery' ? address : undefined,
      reference: deliveryType === 'delivery' ? reference : undefined,
      deliverySector: deliveryType === 'delivery' ? deliverySector : undefined
    }));
    
    // Salvar pedido concluído no localStorage para mostrar modal quando cliente voltar
    const completedOrder = {
      orderId: orderId,
      total: getTotalWithDiscount(),
      phone: phone,
      timestamp: Date.now()
    };
    localStorage.setItem('faroeste_completed_order', JSON.stringify(completedOrder));
    console.log('💾 [CHECKOUT] Pedido salvo no localStorage para exibir modal:', completedOrder);

    // Incrementar uso do cupom (REMOVIDO: Agora feito no Backend ao criar pedido)
    // if (appliedCoupon) { ... }

    // ✅ RESETAR isSubmitting
    setIsSubmitting(false);
    
    // Complete order e fechar modal
    onOrderComplete();
    resetForm();
    onClose(); // Fecha o modal de checkout e vai exibir o modal de confirmação
  };

  // Callbacks para o Modal de Cartão
  const handleCardOnlineSuccess = async () => {
    console.log('✅ [CARTÃO] Pagamento Online Confirmado!');
    setShowCardPaymentOptions(false);
    
    // Atualizar status do pedido para 'paid' (endpoint público com transição restrita)
    try {
      await api.confirmPayment(currentOrderId);
    } catch (e) {
      console.error('Erro ao confirmar pagamento:', e);
    }

    // Mostrar modal de sucesso final (PaymentConfirmed)
    // Para simplificar, vamos usar o fluxo padrão de envio pro WhatsApp com status PAGO
    finishOrderAndNotify(currentOrderId, 'Cartão (PAGO ONLINE)');
  };

  const handleCardMachineChoice = () => {
    console.log('✅ [CARTÃO] Escolheu Maquininha');
    setShowCardPaymentOptions(false);
    finishOrderAndNotify(currentOrderId, 'Cartão (Levar Maquininha)');
  };

  const sendWhatsAppMessage = async (orderId: string) => {
    console.log('📱 [WHATSAPP] Gerando mensagem para pedido:', orderId);
    
    if (!orderId) {
      console.error('❌ [WHATSAPP] Erro: orderId está vazio!');
      alert('Erro: ID do pedido não encontrado. Tente novamente.');
      return;
    }
    
    // Gerar mensagem do WhatsApp usando template literals normais
    const nl = '\n'; // quebra de linha
    let message = '🍔 *NOVO PEDIDO - NEWBURGUER LANCHES*' + nl + nl;
    message += '📋 *Código do Pedido:* #' + orderId + nl;
    message += '👤 *Nome:* ' + name + nl;
    message += '📱 *Telefone:* ' + phone + nl + nl;
    
    // Tipo de pedido
    if (deliveryType === 'delivery') {
      message += '🛵 *Tipo:* Entrega' + nl;
      message += '📍 *Endereço:* ' + address + nl;
      // 🆕 Setor de Entrega
      if (deliverySector && availableSectors.length > 0) {
        const sector = availableSectors.find(s => s.id === deliverySector);
        if (sector) {
          message += '🗺️ *Setor:* ' + sector.name + nl;
        }
      }
      if (reference) {
        message += '🔖 *Referência:* ' + reference + nl;
      }
    } else if (deliveryType === 'pickup') {
      message += '🏪 *Tipo:* Retirada no Local' + nl;
      message += '📍 *Local de Retirada:* ' + PICKUP_ADDRESS + nl;
    } else if (deliveryType === 'dine-in') {
      message += '🍽️ *Tipo:* Consumir no Local' + nl;
      message += '📍 *Endereço:* ' + PICKUP_ADDRESS + nl;
    }
    
    // Adicionar estimativa de tempo
    const estimate = getEstimateForType(deliveryType);
    if (estimate && typeof estimate === 'object' && 'min' in estimate && 'max' in estimate) {
      message += '⏱️ *Tempo Estimado:* ~' + estimate.min + '-' + estimate.max + ' min' + nl;
    }
    
    message += nl + '🛒 *ITENS DO PEDIDO:*' + nl;
    message += '━━━━━━━━━━━━━━━━━━' + nl;
    
    items.forEach((item, index) => {
      message += nl + (index + 1) + '. *' + item.name + '*' + nl;
      message += '   📦 Quantidade: ' + item.quantity + 'x' + nl;
      message += '   💵 Preço Unit.: R$ ' + item.price.toFixed(2).replace('.', ',') + nl;
      message += '   💰 Subtotal: R$ ' + (item.price * item.quantity).toFixed(2).replace('.', ',') + nl;
      
      if (item.notes) {
        message += '   🗒️ *Observação:* ' + item.notes + nl;
      }
      
      if (item.description && !item.notes) {
        message += '   📝 ' + item.description + nl;
      }
    });
    
    message += nl + '━━━━━━━━━━━━━━━━━━' + nl;

    // Acompanhamentos selecionados
    if (selectedAcompanhamentos.length > 0 && deliveryType !== 'dine-in') {
      message += nl + '🍟 *ACOMPANHAMENTOS:*' + nl;
      selectedAcompanhamentos.forEach(aId => {
        const acomp = availableAcompanhamentos.find(a => a.id === aId);
        if (acomp) {
          message += '   • ' + acomp.name + nl;
        }
      });
      message += nl;
    }
    
    // Detalhamento de valores
    message += '💵 *Subtotal:* R$ ' + totalPrice.toFixed(2).replace('.', ',') + nl;
    
    // Cupom de desconto (aplicado apenas no subtotal, não na entrega)
    if (appliedCoupon && couponDiscount > 0) {
      message += '🎫 *Cupom (' + appliedCoupon.code + '):* - R$ ' + couponDiscount.toFixed(2).replace('.', ',') + nl;
    }
    
    if (deliveryType === 'delivery') {
      message += '🛵 *Taxa de Entrega:* R$ ' + deliveryFee.toFixed(2).replace('.', ',') + nl;
    }
    
    message += '💰 *TOTAL:* R$ ' + getTotalWithDiscount().toFixed(2).replace('.', ',') + nl;
    
    // Forma de pagamento atualizada
    let paymentText = '';
    if (splitPayment) {
      const amt1 = parseFloat(splitAmount1) || 0;
      const amt2 = parseFloat((getTotalWithDiscount() - amt1).toFixed(2));
      const m1Name = splitMethod1 === 'pix' ? 'PIX' : splitMethod1 === 'card' ? 'Cartão' : 'Dinheiro';
      const m2Name = splitMethod2 === 'pix' ? 'PIX' : splitMethod2 === 'card' ? 'Cartão' : 'Dinheiro';
      paymentText = `Misto: ${m1Name} R$ ${amt1.toFixed(2).replace('.', ',')} + ${m2Name} R$ ${amt2.toFixed(2).replace('.', ',')}`;
    } else if (paymentMethod === 'pix') {
      paymentText = 'PIX (Comprovante enviado)';
    } else if (paymentMethod === 'card') {
      paymentText = 'Cartão (Maquininha na entrega/retirada)';
    } else if (paymentMethod === 'cash') {
      paymentText = 'Dinheiro (Pagar na entrega/retirada)';
    }
    message += '💳 *Pagamento:* ' + paymentText + nl;
    
    message += nl + '━━━━━━━━━━━━━━━━━━' + nl;
    message += '_📱 Guarde o código do pedido para acompanhamento:_' + nl;
    message += '*#' + orderId + '*';

    // Encode message for WhatsApp URL
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;

    console.log('📱 [WHATSAPP] Abrindo WhatsApp com URL:', whatsappUrl);
    console.log('📱 [WHATSAPP] Mensagem completa:', message);

    // Open WhatsApp
    try {
      window.open(whatsappUrl, '_blank');
      console.log('✅ [WHATSAPP] WhatsApp aberto com sucesso!');
    } catch (error) {
      console.error('❌ [WHATSAPP] Erro ao abrir WhatsApp:', error);
      alert('Erro ao abrir WhatsApp. Por favor, tente novamente.');
    }

    // Salvar dados básicos no localStorage para auto-preenchimento futuro (backup)
    localStorage.setItem('faroeste_customer_info', JSON.stringify({ 
      name, 
      phone,
      street: deliveryType === 'delivery' ? street : undefined,
      houseNumber: deliveryType === 'delivery' ? houseNumber : undefined,
      neighborhood: deliveryType === 'delivery' ? neighborhood : undefined,
      address: deliveryType === 'delivery' ? address : undefined,
      reference: deliveryType === 'delivery' ? reference : undefined,
      deliverySector: deliveryType === 'delivery' ? deliverySector : undefined
    }));
    
    // Salvar pedido concluído no localStorage para mostrar modal quando cliente voltar
    const completedOrder = {
      orderId: orderId,
      total: getTotalWithDiscount(), // Usar total com desconto
      phone: phone,
      timestamp: Date.now()
    };
    localStorage.setItem('faroeste_completed_order', JSON.stringify(completedOrder));
    console.log('💾 [CHECKOUT] Pedido salvo no localStorage para exibir modal ao voltar:', completedOrder);

    // Incrementar uso do cupom (REMOVIDO: Agora feito no Backend ao criar pedido)
    // if (appliedCoupon) { ... }

    // Complete order e fechar modal
    onOrderComplete();
    resetForm();
    onClose(); // Fechar o modal de checkout sem mostrar o success modal ainda
  };

  const handlePixPaymentComplete = () => {
    console.log('💳 [PIX] Pagamento PIX concluído - enviando para WhatsApp');
    console.log('💳 [PIX] Order ID atual:', currentOrderId);
    
    // Após o cliente pagar via PIX e enviar o comprovante,
    // enviar a mensagem de confirmação do pedido
    if (!currentOrderId) {
      console.error('❌ [PIX] Erro: currentOrderId está vazio!');
      alert('Erro: ID do pedido não encontrado. Por favor, entre em contato conosco.');
      return;
    }
    
    sendWhatsAppMessage(currentOrderId);
    setShowPixPayment(false);
  };

  const resetForm = () => {
    setStep(1);
    setIsSubmitting(false);
    setName('');
    setPhone('');
    setStreet('');
    setHouseNumber('');
    setNeighborhood('');
    setAddress('');
    setReference('');
    setDeliveryType('delivery');
    setPaymentMethod('pix');
    setShowPixPayment(false);
    // Limpar cupom
    setCouponCode('');
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponError('');
    // Limpar acompanhamentos
    setSelectedAcompanhamentos([]);
    // Limpar pagamento misto
    setSplitPayment(false);
    setSplitMethod1('pix');
    setSplitMethod2('cash');
    setSplitAmount1('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <>
      {/* PIX Payment Modal (Manual) */}
      {showPixPayment && (
        <PixPayment
          amount={getTotalWithDiscount()}
          onClose={() => {
            setShowPixPayment(false);
            // Após fechar, limpar e fechar o checkout
            onOrderComplete();
            resetForm();
            onClose();
          }}
          onSendMessage={() => sendWhatsAppMessage(currentOrderId)}
        />
      )}

      {/* PIX Payment Modal (PagSeguro Automático) */}
      {showPixPaymentPagSeguro && (
        <PixPaymentPagSeguro
          amount={getTotalWithDiscount()}
          customerName={name}
          customerEmail={`${phone.replace(/\D/g, '')}@temp.com`} // Email temporário
          customerPhone={phone}
          items={items.map(item => ({
             name: item.name,
             quantity: item.quantity,
             price: item.price
          }))}
          deliveryType={deliveryType}
          address={address}
          orderId={currentOrderId} // Passando o ID do pedido criado
          onPaymentConfirmed={(orderId) => {
            console.log('✅ [PAGSEGURO] Pagamento confirmado!', orderId);
            setShowPixPaymentPagSeguro(false);
            // Enviar para WhatsApp agora que pagou (com status PAGO)
            finishOrderAndNotify(currentOrderId, 'PIX (PAGO AUTOMÁTICO)');
          }}
          onClose={() => {
            setShowPixPaymentPagSeguro(false);
            // Se fechar sem pagar, manter pedido pendente mas notificar admin de abandono?
            // Por enquanto, permite fechar e o pedido fica pendente.
          }}
        />
      )}

      {/* Opções de Pagamento com Cartão (Automático) */}
      {showCardPaymentOptions && (
        <CardPaymentOptions
          amount={getTotalWithDiscount()}
          customerName={name}
          customerPhone={phone}
          items={items.map(item => ({
             name: item.name,
             quantity: item.quantity,
             price: item.price
          }))}
          deliveryType={deliveryType}
          address={address}
          onClose={() => setShowCardPaymentOptions(false)}
          onConfirmOnline={handleCardOnlineSuccess}
          onConfirmMachine={handleCardMachineChoice}
        />
      )}

      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
        <div className="bg-white dark:bg-zinc-900 rounded-none sm:rounded-lg shadow-2xl w-full sm:max-w-2xl min-h-screen sm:min-h-0 sm:max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="bg-amber-600 text-white p-4 flex items-center justify-between sticky top-0">
            <div className="flex items-center gap-2">
              {step > 1 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="hover:bg-amber-700 p-2 rounded transition-colors flex items-center gap-1"
                  title="Voltar"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="text-sm font-medium">Voltar</span>
                </button>
              )}
              <h2 className="text-lg font-semibold">Finalizar Pedido</h2>
            </div>
            <button
              onClick={handleClose}
              className="hover:bg-amber-700 p-1 rounded transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="px-4 py-5 sm:p-6">
            {/* Progress Steps */}
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-amber-600 text-white' : 'bg-gray-300 dark:bg-zinc-700'}`}>
                  1
                </div>
                <div className={`w-12 h-1 ${step >= 2 ? 'bg-amber-600' : 'bg-gray-300 dark:bg-zinc-700'}`} />
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-amber-600 text-white' : 'bg-gray-300 dark:bg-zinc-700'}`}>
                  2
                </div>
                <div className={`w-12 h-1 ${step >= 3 ? 'bg-amber-600' : 'bg-gray-300 dark:bg-zinc-700'}`} />
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-amber-600 text-white' : 'bg-gray-300 dark:bg-zinc-700'}`}>
                  3
                </div>
              </div>
            </div>

            {/* Step 1: Customer Info */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-3 rounded-lg text-center mb-6 flex justify-between items-center border border-zinc-200 dark:border-zinc-700 shadow-sm">
                  <h3 className="text-lg text-zinc-900 dark:text-zinc-100 font-bold mx-auto flex items-center gap-2">
                    <User className="w-5 h-5 text-amber-600" />
                    Seus Dados
                  </h3>
                  {customer && (
                    <button 
                      onClick={logout}
                      className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-red-600 flex items-center gap-1 absolute right-8"
                    >
                      <LogOut className="w-3 h-3" /> Sair
                    </button>
                  )}
                </div>
                
                {customer ? (
                  <div className="bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-xl p-5 mb-6">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-4">
                        <div className="bg-green-100 dark:bg-green-800/50 p-3 rounded-full shadow-inner">
                          <User className="w-6 h-6 text-green-700 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">{customer.name}</p>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">{customer.phone}</p>
                        </div>
                      </div>
                      <button 
                        onClick={logout}
                        className="bg-white dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Alterar
                      </button>
                    </div>
                    {customer.lastOrderDate && (
                        <p className="text-xs text-green-600 dark:text-green-500 mt-4 pt-3 border-t border-green-100 dark:border-green-900/30 flex items-center gap-1.5 opacity-80">
                          <Clock className="w-3.5 h-3.5" /> Último pedido em {new Date(customer.lastOrderDate).toLocaleDateString('pt-BR')}
                        </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block ml-1 flex items-center gap-1.5">
                        <Phone className="w-4 h-4 text-amber-600" />
                        Telefone/WhatsApp *
                      </label>
                      <div className="relative group">
                        <input
                          type="tel"
                          value={phone}
                          onChange={handlePhoneChange}
                          onBlur={handleIdentifyCustomer}
                          maxLength={15}
                          autoComplete="tel"
                          className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-all group-hover:border-amber-400/50"
                          placeholder="(00) 00000-0000"
                        />
                        {loadingCustomer && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                      {!customer && phone.length > 10 && (
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-1.5 ml-1 italic">
                          Identificando seu cadastro...
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block ml-1 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-amber-600" />
                        Nome Completo *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                        className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-all hover:border-amber-400/50"
                        placeholder="Como podemos te chamar?"
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setStep(2)}
                  disabled={!name.trim() || !phone.trim()}
                  className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-lg transition-colors mt-4 font-bold shadow-lg shadow-amber-200"
                >
                  Continuar
                </button>
              </div>
            )}

            {/* Step 2: Delivery Type */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-3 rounded-lg text-center mb-6 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                  <h3 className="text-lg text-zinc-900 dark:text-zinc-100 font-bold">Tipo de Pedido</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => setDeliveryType('delivery')}
                    className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-3 ${
                      deliveryType === 'delivery'
                        ? 'border-amber-600 bg-amber-50/50 dark:bg-zinc-800 ring-2 ring-amber-500/20'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-amber-400/50 bg-white dark:bg-zinc-900/50'
                    }`}
                  >
                    <div className={`p-3 rounded-full transition-colors ${deliveryType === 'delivery' ? 'bg-amber-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                      <MapPin className="w-8 h-8" />
                    </div>
                    <div className="text-center">
                      <p className={`font-bold text-lg ${deliveryType === 'delivery' ? 'text-amber-700 dark:text-amber-500' : 'text-zinc-700 dark:text-zinc-300'}`}>Entrega</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">Receba em casa</p>
                      {estimates && estimates.delivery && (
                        <div className="mt-2 text-[10px] bg-zinc-200/50 dark:bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-600 dark:text-zinc-400 font-medium">
                          🕒 ~{estimates.delivery.min}-{estimates.delivery.max} min
                        </div>
                      )}
                    </div>
                  </button>

                  <button
                    onClick={() => setDeliveryType('pickup')}
                    className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-3 ${
                      deliveryType === 'pickup'
                        ? 'border-amber-600 bg-amber-50/50 dark:bg-zinc-800 ring-2 ring-amber-500/20'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-amber-400/50 bg-white dark:bg-zinc-900/50'
                    }`}
                  >
                    <div className={`p-3 rounded-full transition-colors ${deliveryType === 'pickup' ? 'bg-amber-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                      <Home className="w-8 h-8" />
                    </div>
                    <div className="text-center">
                      <p className={`font-bold text-lg ${deliveryType === 'pickup' ? 'text-amber-700 dark:text-amber-500' : 'text-zinc-700 dark:text-zinc-300'}`}>Retirada</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">Busque no local</p>
                      {estimates && estimates.pickup && (
                        <div className="mt-2 text-[10px] bg-zinc-200/50 dark:bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-600 dark:text-zinc-400 font-medium">
                          🕒 ~{estimates.pickup.min}-{estimates.pickup.max} min
                        </div>
                      )}
                    </div>
                  </button>

                  {/* 🆕 Botão "Consumir no Local" */}
                  {(config.features?.dineIn !== false) && (
                    <button
                      onClick={() => setDeliveryType('dine-in')}
                      className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-3 sm:col-span-2 ${
                        deliveryType === 'dine-in'
                          ? 'border-amber-600 bg-amber-50/50 dark:bg-zinc-800 ring-2 ring-amber-500/20'
                          : 'border-zinc-200 dark:border-zinc-800 hover:border-amber-400/50 bg-white dark:bg-zinc-900/50'
                      }`}
                    >
                      <div className={`p-3 rounded-full transition-colors ${deliveryType === 'dine-in' ? 'bg-amber-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                        <UtensilsCrossed className="w-8 h-8" />
                      </div>
                      <div className="text-center">
                        <p className={`font-bold text-lg ${deliveryType === 'dine-in' ? 'text-amber-700 dark:text-amber-500' : 'text-zinc-700 dark:text-zinc-300'}`}>Jantar no Local</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-500">Junte-se a nós</p>
                      </div>
                    </button>
                  )}
                </div>

                {deliveryType === 'delivery' ? (
                  <div className="mt-8 space-y-6">
                    {/* Saved Addresses Selection */}
                    {customer && customer.addresses.length > 0 && (
                      <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-inner">
                        <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-amber-600" /> Endereços Salvos
                        </p>
                        <div className="space-y-3">
                          {customer.addresses.map((addr) => (
                            <label key={addr.id} className={`flex items-start gap-4 p-3 rounded-lg border transition-all cursor-pointer ${useSavedAddress && address === addr.street ? 'bg-amber-50/50 border-amber-500/50 dark:bg-amber-900/10' : 'bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 hover:border-amber-200 dark:hover:border-zinc-600'}`}>
                              <input 
                                type="radio" 
                                name="savedAddress" 
                                checked={useSavedAddress && address === addr.street}
                                onChange={() => {
                                  setUseSavedAddress(true);
                                  const fullAddr = addr.street || '';
                                  const commaIdx = fullAddr.indexOf(',');
                                  if (commaIdx > 0) {
                                    setStreet(fullAddr.substring(0, commaIdx).trim());
                                    setHouseNumber(fullAddr.substring(commaIdx + 1).trim());
                                  } else {
                                    setStreet(fullAddr);
                                    setHouseNumber('');
                                  }
                                  setReference(addr.reference || '');
                                }}
                                className="mt-1.5 text-amber-600 focus:ring-amber-500 bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600"
                              />
                              <div className="text-sm">
                                <div className="font-bold text-zinc-900 dark:text-zinc-100">{addr.street}</div>
                                {addr.reference && <div className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">{addr.reference}</div>}
                              </div>
                            </label>
                          ))}
                          <label className={`flex items-center gap-4 p-3 rounded-lg border transition-all cursor-pointer ${!useSavedAddress ? 'bg-amber-50/50 border-amber-500/50 dark:bg-amber-900/10' : 'bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 hover:border-amber-200 dark:hover:border-zinc-600'}`}>
                            <input 
                              type="radio" 
                              name="savedAddress" 
                              checked={!useSavedAddress}
                              onChange={() => {
                                setUseSavedAddress(false);
                                setStreet('');
                                setHouseNumber('');
                                setNeighborhood('');
                                setReference('');
                              }}
                              className="text-amber-600 focus:ring-amber-500 bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600"
                            />
                            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Usar outro endereço</span>
                          </label>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block ml-1">Rua *</label>
                        <input
                          type="text"
                          value={street}
                          onChange={(e) => {
                            setStreet(e.target.value);
                            if (useSavedAddress) setUseSavedAddress(false);
                          }}
                          className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all ${useSavedAddress ? 'bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-500' : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'}`}
                          placeholder="Nome da rua"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block ml-1">Nº *</label>
                        <input
                          type="text"
                          value={houseNumber}
                          onChange={(e) => {
                            setHouseNumber(e.target.value);
                            if (useSavedAddress) setUseSavedAddress(false);
                          }}
                          className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all ${useSavedAddress ? 'bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-500' : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'}`}
                          placeholder="123"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block ml-1">Bairro/Setor *</label>
                      <input
                        type="text"
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        placeholder="Ex: Centro, Setor Sul..."
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block ml-1">Referência (opcional)</label>
                      <input
                        type="text"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        placeholder="Ex: Próximo ao mercado"
                      />
                    </div>

                    {/* Setor de Entrega */}
                    {availableSectors.length > 0 && (
                      <div>
                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block ml-1">Setor de Entrega *</label>
                        <select
                          value={deliverySector}
                          onChange={(e) => setDeliverySector(e.target.value)}
                          className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-all"
                        >
                          <option value="">Selecione o setor...</option>
                          {availableSectors.map((sector) => (
                            <option key={sector.id} value={sector.id}>{sector.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-8 p-6 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200 dark:border-zinc-700/50">
                    <div className="flex items-center gap-3 mb-3 text-amber-600">
                      <MapPin className="w-5 h-5" />
                      <p className="text-sm font-bold uppercase tracking-wider">Endereço para retirada</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-100 dark:border-zinc-700 shadow-sm">
                      <p className="text-zinc-800 dark:text-zinc-200 font-medium leading-relaxed">{PICKUP_ADDRESS}</p>
                    </div>
                  </div>
                )}

                {/* Seleção de Molhos / Acompanhamentos */}
                {showAcompanhamentos && (
                  <div className="mt-8 bg-indigo-50/50 dark:bg-indigo-900/10 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800/30">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-indigo-100 dark:bg-indigo-800/50 rounded-lg">
                        <Droplets className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-indigo-900 dark:text-indigo-300">Deseja adicionar molhos?</p>
                        <p className="text-[10px] text-indigo-600 dark:text-indigo-500">Selecione os acompanhamentos desejados</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {availableAcompanhamentos.map(acomp => {
                        const isSelected = selectedAcompanhamentos.includes(acomp.id);
                        return (
                          <button
                            key={acomp.id}
                            type="button"
                            onClick={() => toggleAcompanhamento(acomp.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                              isSelected
                                ? 'border-indigo-500 bg-indigo-100/80 dark:bg-indigo-800/30'
                                : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:border-indigo-300'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600'
                                : 'border-zinc-300 dark:border-zinc-600'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className={`text-sm font-medium ${
                              isSelected
                                ? 'text-indigo-900 dark:text-indigo-200'
                                : 'text-zinc-700 dark:text-zinc-300'
                            }`}>
                              {acomp.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {selectedAcompanhamentos.length > 0 && (
                      <p className="text-[10px] text-indigo-500 dark:text-indigo-400 mt-3 font-medium">
                        {selectedAcompanhamentos.length} molho(s) selecionado(s)
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-4 mt-10">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 py-4 rounded-xl font-bold transition-all border border-zinc-200 dark:border-zinc-700"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={deliveryType === 'delivery' && (!street.trim() || !houseNumber.trim() || !neighborhood.trim())}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Payment & Confirmation */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-3 rounded-lg text-center mb-6 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                  <h3 className="text-lg text-zinc-900 dark:text-zinc-100 font-bold">Forma de Pagamento</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button
                    onClick={() => setPaymentMethod('pix')}
                    className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-3 ${
                      paymentMethod === 'pix'
                        ? 'border-amber-600 bg-amber-50/50 dark:bg-zinc-800 ring-2 ring-amber-500/20'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-amber-400/50 bg-white dark:bg-zinc-900/50'
                    }`}
                  >
                    <div className={`p-3 rounded-full transition-colors ${paymentMethod === 'pix' ? 'bg-amber-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                      <span className="text-xl font-bold">Pix</span>
                    </div>
                    <div className="text-center">
                      <p className={`font-bold ${paymentMethod === 'pix' ? 'text-amber-700 dark:text-amber-500' : 'text-zinc-700 dark:text-zinc-300'}`}>Pix</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-500">Instantâneo</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('card')}
                    className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-3 ${
                      paymentMethod === 'card'
                        ? 'border-amber-600 bg-amber-50/50 dark:bg-zinc-800 ring-2 ring-amber-500/20'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-amber-400/50 bg-white dark:bg-zinc-900/50'
                    }`}
                  >
                    <div className={`p-3 rounded-full transition-colors ${paymentMethod === 'card' ? 'bg-amber-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <p className={`font-bold ${paymentMethod === 'card' ? 'text-amber-700 dark:text-amber-500' : 'text-zinc-700 dark:text-zinc-300'}`}>Cartão</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-500">
                        {config.automaticPayment ? 'Online (Crédito/Débito)' : 'Maquininha na entrega'}
                      </p>
                    </div>
                  </button>

                {/* Opções de Cartão (Crédito/Débito) */}
                {paymentMethod === 'card' && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <button
                      onClick={() => setCardType('credit')}
                      className={`py-3 px-4 rounded-xl border-2 transition-all font-bold ${
                        cardType === 'credit'
                          ? 'border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                          : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-amber-300'
                      }`}
                    >
                      Crédito
                    </button>
                    <button
                      onClick={() => setCardType('debit')}
                      className={`py-3 px-4 rounded-xl border-2 transition-all font-bold ${
                        cardType === 'debit'
                          ? 'border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                          : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-amber-300'
                      }`}
                    >
                      Débito
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setPaymentMethod('cash')}
                    className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-3 ${
                      paymentMethod === 'cash'
                        ? 'border-amber-600 bg-amber-50/50 dark:bg-zinc-800 ring-2 ring-amber-500/20'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-amber-400/50 bg-white dark:bg-zinc-900/50'
                    }`}
                  >
                    <div className={`p-3 rounded-full transition-colors ${paymentMethod === 'cash' ? 'bg-amber-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                      <Banknote className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <p className={`font-bold ${paymentMethod === 'cash' ? 'text-amber-700 dark:text-amber-500' : 'text-zinc-700 dark:text-zinc-300'}`}>Dinheiro</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-500">Na entrega</p>
                    </div>
                  </button>
                </div>

                {/* Toggle Pagamento Misto */}
                <div className="mt-4">
                  <button
                    onClick={() => {
                      setSplitPayment(!splitPayment);
                      if (!splitPayment) {
                        setSplitAmount1('');
                        setSplitMethod1('pix');
                        setSplitMethod2('cash');
                      }
                    }}
                    className={`w-full py-3 px-4 rounded-xl border-2 transition-all font-bold text-sm flex items-center justify-center gap-2 ${
                      splitPayment
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-purple-300'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    {splitPayment ? '✓ Pagamento Misto Ativado' : 'Pagar com duas formas'}
                  </button>
                </div>

                {/* Pagamento Misto UI */}
                {splitPayment && (
                  <div className="mt-4 bg-purple-50/50 dark:bg-purple-900/10 p-5 rounded-2xl border border-purple-200 dark:border-purple-800/30 space-y-4">
                    <p className="text-sm font-bold text-purple-800 dark:text-purple-400 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> Dividir pagamento em duas formas
                    </p>
                    
                    {/* Forma 1 */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">1ª Forma de Pagamento</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['pix', 'card', 'cash'] as PaymentMethod[]).map(m => (
                          <button
                            key={`s1-${m}`}
                            onClick={() => setSplitMethod1(m)}
                            className={`py-2 px-3 rounded-lg border-2 text-xs font-bold transition-all ${
                              splitMethod1 === m
                                ? 'border-purple-600 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'
                            }`}
                          >
                            {m === 'pix' ? 'Pix' : m === 'card' ? 'Cartão' : 'Dinheiro'}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={splitAmount1}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                          setSplitAmount1(v);
                        }}
                        placeholder="R$ 0,00"
                        className="w-full px-4 py-3 border border-purple-300 dark:border-purple-800/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-lg font-bold bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                      />
                    </div>

                    {/* Forma 2 */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">2ª Forma de Pagamento</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['pix', 'card', 'cash'] as PaymentMethod[]).map(m => (
                          <button
                            key={`s2-${m}`}
                            onClick={() => setSplitMethod2(m)}
                            className={`py-2 px-3 rounded-lg border-2 text-xs font-bold transition-all ${
                              splitMethod2 === m
                                ? 'border-purple-600 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'
                            }`}
                          >
                            {m === 'pix' ? 'Pix' : m === 'card' ? 'Cartão' : 'Dinheiro'}
                          </button>
                        ))}
                      </div>
                      <div className="w-full px-4 py-3 border border-purple-200 dark:border-purple-800/30 rounded-xl bg-purple-50 dark:bg-zinc-800/50 text-lg font-bold text-purple-700 dark:text-purple-400">
                        R$ {(Math.max(0, getTotalWithDiscount() - (parseFloat(splitAmount1) || 0))).toFixed(2).replace('.', ',')}
                      </div>
                    </div>

                    {/* Aviso se valores não batem */}
                    {splitAmount1 && parseFloat(splitAmount1) > 0 && parseFloat(splitAmount1) < getTotalWithDiscount() && (
                      <div className="text-xs text-center text-purple-600 dark:text-purple-400 font-medium">
                        ✓ Total: R$ {(parseFloat(splitAmount1) || 0).toFixed(2).replace('.', ',')} + R$ {(getTotalWithDiscount() - (parseFloat(splitAmount1) || 0)).toFixed(2).replace('.', ',')} = R$ {getTotalWithDiscount().toFixed(2).replace('.', ',')}
                      </div>
                    )}
                    {splitMethod1 === splitMethod2 && (
                      <div className="text-xs text-center text-red-500 font-medium">
                        ⚠ Selecione duas formas diferentes
                      </div>
                    )}
                  </div>
                )}

                {/* Campo de Troco */}
                {!splitPayment && paymentMethod === 'cash' && (
                  <div className="mt-6 bg-emerald-50/30 dark:bg-emerald-900/10 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/30">
                    <label className="text-sm font-bold text-emerald-800 dark:text-emerald-400 mb-3 block flex items-center gap-2">
                      <Banknote className="w-4 h-4" /> Precisa de troco?
                    </label>
                    <input
                      type="text"
                      value={changeFor}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        setChangeFor(value);
                      }}
                      placeholder="Ex: 50 (para R$ 50,00)"
                      className="w-full px-4 py-3 border border-emerald-300 dark:border-emerald-800/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-lg font-bold bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    />
                    {changeFor && parseFloat(changeFor) > 0 && (
                      <div className="mt-4 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-zinc-500">Troco para:</span>
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">R$ {parseFloat(changeFor).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm mt-1">
                          <span className="text-zinc-500">Você receberá:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">R$ {(parseFloat(changeFor) - getTotalWithDiscount()).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Cupom de Desconto */}
                {(config.features?.coupons !== false) && (
                  <div className="mt-6">
                    {!appliedCoupon ? (
                      <div className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                        <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-3 block flex items-center gap-2">
                          <Ticket className="w-4 h-4 text-amber-600" /> Cupom de desconto?
                        </label>
                        <div className="flex gap-2">
                            <input
                              type="text"
                              value={couponCode}
                              onChange={(e) => {
                                setCouponCode(e.target.value.toUpperCase());
                                setCouponError('');
                              }}
                              placeholder="CÓDIGO"
                              className="flex-1 px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 uppercase text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold tracking-widest"
                              maxLength={20}
                            />
                            <button
                              onClick={handleValidateCoupon}
                              disabled={isValidatingCoupon || !couponCode.trim()}
                              className="px-6 py-3 bg-zinc-900 dark:bg-zinc-700 hover:bg-black dark:hover:bg-zinc-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white text-sm font-bold rounded-xl transition-all shadow-sm"
                            >
                              {isValidatingCoupon ? '...' : 'Aplicar'}
                            </button>
                        </div>
                        {couponError && (
                          <p className="text-[10px] text-red-600 dark:text-red-400 mt-2 font-medium flex items-center gap-1.5 ml-1">
                            ⚠️ {couponError}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/30 flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <div className="bg-emerald-100 dark:bg-emerald-800/50 p-2 rounded-lg">
                            <Ticket className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-emerald-900 dark:text-emerald-300 font-bold text-sm tracking-tight">{appliedCoupon.code}</p>
                            <p className="text-emerald-600 dark:text-emerald-500 text-[10px] font-medium">
                              {appliedCoupon.type === 'percentage' 
                                ? `${appliedCoupon.value}% de desconto`
                                : `R$ ${appliedCoupon.value.toFixed(2)} OFF`}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={handleRemoveCoupon}
                          className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Resumo do Pedido */}
                <div className="mt-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-inner">
                  <div className="bg-zinc-200/50 dark:bg-zinc-800 p-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest flex items-center gap-2">
                      <ReceiptText className="w-4 h-4" /> Resumo do Pedido
                    </h4>
                  </div>
                  
                  <div className="p-3 sm:p-5 space-y-6">
                    {/* Dados do Cliente */}
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/50 shadow-sm">
                      <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <User className="w-3 h-3" /> Dados do Cliente
                      </p>
                      <div className="grid grid-cols-2 gap-y-2 text-sm">
                        <span className="text-zinc-500">Nome:</span>
                        <span className="text-zinc-900 dark:text-zinc-100 font-bold text-right">{name || '-'}</span>
                        <span className="text-zinc-500">Telefone:</span>
                        <span className="text-zinc-900 dark:text-zinc-100 font-bold text-right">{phone || '-'}</span>
                        <span className="text-zinc-500">Local:</span>
                        <span className="text-zinc-900 dark:text-zinc-100 font-bold text-right">
                          {deliveryType === 'delivery' ? 'Entrega' : deliveryType === 'pickup' ? 'Retirada' : 'No Local'}
                        </span>
                        {deliveryType === 'delivery' && (
                          <>
                            <span className="text-zinc-500">Endereço:</span>
                            <span className="text-zinc-900 dark:text-zinc-100 font-bold text-right text-[11px] leading-tight mt-1">{address || '-'}</span>
                            {reference && (
                              <>
                                <span className="text-zinc-500 text-[10px] italic">Referência:</span>
                                <span className="text-zinc-500 text-right text-[10px] italic leading-tight">{reference}</span>
                              </>
                            )}
                            {deliverySector && (
                              <>
                                <span className="text-zinc-500 text-[10px] font-bold">Setor:</span>
                                <span className="text-amber-600 dark:text-amber-500 text-right text-[10px] font-bold">
                                  {availableSectors.find(s => s.id === deliverySector)?.name || deliverySector}
                                </span>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Itens */}
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Itens Selecionados</p>
                      {items.map(item => (
                        <div key={item.id} className="flex justify-between items-center text-sm bg-white dark:bg-zinc-900 px-4 py-3 rounded-xl border border-zinc-50 dark:border-zinc-800/30">
                          <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                            <span className="text-amber-600 font-bold mr-2">{item.quantity}x</span> {item.name}
                          </span>
                          <span className="text-zinc-900 dark:text-zinc-100 font-bold">
                            R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Acompanhamentos selecionados */}
                    {selectedAcompanhamentos.length > 0 && deliveryType !== 'dine-in' && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Droplets className="w-3 h-3" /> Molhos / Acompanhamentos
                        </p>
                        {selectedAcompanhamentos.map(aId => {
                          const acomp = availableAcompanhamentos.find(a => a.id === aId);
                          return acomp ? (
                            <div key={aId} className="flex items-center text-sm bg-indigo-50/50 dark:bg-indigo-900/10 px-4 py-2 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                              <Droplets className="w-3 h-3 text-indigo-500 mr-2 flex-shrink-0" />
                              <span className="text-indigo-800 dark:text-indigo-300 font-medium text-xs">{acomp.name}</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    )}
                    
                    {/* Totais */}
                    <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Subtotal</span>
                        <span className="text-zinc-900 dark:text-zinc-100 font-medium">R$ {totalPrice.toFixed(2).replace('.', ',')}</span>
                      </div>
                      
                      {appliedCoupon && couponDiscount > 0 && (
                        <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                          <span className="flex items-center gap-1">Cupom ({appliedCoupon.code})</span>
                          <span className="font-bold">- R$ {couponDiscount.toFixed(2).replace('.', ',')}</span>
                        </div>
                      )}
                      
                      {deliveryType === 'delivery' && (
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Taxa de Entrega</span>
                          <span className="text-zinc-900 dark:text-zinc-100 font-medium">R$ {deliveryFee.toFixed(2).replace('.', ',')}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-4 mt-2">
                        <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Total</span>
                        <div className="bg-amber-600 text-white px-5 py-2 rounded-xl shadow-lg shadow-amber-500/20">
                          <span className="text-xl font-black">
                            R$ {getTotalWithDiscount().toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 py-4 rounded-xl font-bold transition-all border border-zinc-200 dark:border-zinc-700 text-center"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-[2] bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <CheckCircle className="w-5 h-5" />
                    )}
                    {isSubmitting ? 'Processando...' : 'Finalizar Pedido'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Função para salvar o pedido no histórico local do dispositivo
function saveOrderToLocalHistory(order: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  total: number;
  deliveryType: DeliveryType;
  status: string;
  createdAt: string;
  itemCount: number;
}) {
  try {
    const historyKey = 'faroeste_my_orders';
    const currentHistory = JSON.parse(localStorage.getItem(historyKey) || '[]') as typeof order[];
    
    // Adicionar novo pedido ao histórico
    currentHistory.push(order);
    
    // Limitar histórico a 50 entradas mais recentes
    if (currentHistory.length > 50) {
      currentHistory.shift();
    }
    
    // Salvar histórico atualizado no localStorage
    localStorage.setItem(historyKey, JSON.stringify(currentHistory));
    console.log('💾 [HISTÓRICO] Pedido salvo no histórico local:', order.orderId);
  } catch (error) {
    console.error('❌ [HISTÓRICO] Erro ao salvar pedido no histórico:', error);
  }
}