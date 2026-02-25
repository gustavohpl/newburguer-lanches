import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, Truck, CheckCircle, Lock, X, AlertTriangle } from 'lucide-react';
import * as api from '../utils/api';

interface CardPaymentOptionsProps {
  amount: number;
  customerName: string;
  customerPhone: string;
  items: any[];
  deliveryType: string;
  address?: string;
  onClose: () => void;
  onConfirmOnline: () => void;
  onConfirmMachine: () => void;
}

export function CardPaymentOptions({ 
  amount, 
  customerName,
  customerPhone,
  items,
  deliveryType,
  address,
  onClose, 
  onConfirmOnline, 
  onConfirmMachine 
}: CardPaymentOptionsProps) {
  const [view, setView] = useState<'selection' | 'form'>('selection');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Card Form State
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  
  // Basic validation helpers
  const validateLuhn = (num: string) => {
    let sum = 0;
    let isEven = false;
    // Loop through values starting from the rightmost
    for (let i = num.length - 1; i >= 0; i--) {
      let digit = parseInt(num.charAt(i));
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      isEven = !isEven;
    }
    return sum % 10 === 0;
  };

  const handleOnlinePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate inputs
    const cleanNumber = cardNumber.replace(/\D/g, '');
    const cleanCvv = cvv.replace(/\D/g, '');
    
    if (cleanNumber.length < 13 || !validateLuhn(cleanNumber)) {
      setError('Número de cartão inválido.');
      return;
    }
    
    if (cleanCvv.length < 3) {
      setError('CVV inválido.');
      return;
    }
    
    if (!cardName.trim()) {
      setError('Nome do titular é obrigatório.');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Create payment payload
      const paymentData = {
        amount,
        customerName,
        customerPhone,
        items,
        deliveryType,
        address,
        card: {
          number: cleanNumber,
          name: cardName,
          expiry,
          cvv: cleanCvv
        }
      };

      console.log('💳 [CARD] Processing payment...', { ...paymentData, card: { ...paymentData.card, number: '****', cvv: '***' } });
      
      const response = await api.processCardPayment(paymentData);
      
      if (response.success) {
         onConfirmOnline();
      } else {
         throw new Error(response.error || 'Erro desconhecido');
      }
      
    } catch (err: any) {
      console.error('❌ [CARD] Payment failed:', err);
      setError(err.message || 'Erro ao processar pagamento. Verifique os dados e tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return `${v.substring(0, 2)}/${v.substring(2, 4)}`;
    }
    return v;
  };

  const getCardBrand = (number: string) => {
    const n = number.replace(/\D/g, '');
    if (/^4/.test(n)) return 'Visa';
    if (/^5[1-5]/.test(n)) return 'Mastercard';
    if (/^3[47]/.test(n)) return 'Amex';
    if (/^6/.test(n)) return 'Elo'; // Simplified Elo check
    return 'Cartão';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="bg-gray-900 dark:bg-zinc-950 text-white p-4 flex justify-between items-center">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Pagamento com Cartão de Crédito ou Débito
          </h2>
          <button onClick={onClose} className="hover:bg-gray-800 dark:hover:bg-gray-700 p-1 rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {view === 'selection' ? (
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400 text-center mb-4">Como você deseja realizar o pagamento?</p>
              
              <button
                onClick={() => setView('form')}
                className="w-full p-4 border-2 border-blue-100 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 hover:border-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-xl transition-all flex items-center gap-4 group"
              >
                <div className="bg-blue-200 dark:bg-blue-800 p-3 rounded-full group-hover:bg-blue-500 group-hover:text-white transition-colors">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-gray-800 dark:text-white">Pagar Online (Crédito/Débito)</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Pagamento seguro e imediato</p>
                </div>
              </button>

              <button
                onClick={onConfirmMachine}
                className="w-full p-4 border-2 border-amber-100 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 hover:border-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-xl transition-all flex items-center gap-4 group"
              >
                <div className="bg-amber-200 dark:bg-amber-800 p-3 rounded-full group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <Truck className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-gray-800 dark:text-white">Pagar na Entrega</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Levamos a maquininha até você</p>
                </div>
              </button>
            </div>
          ) : (
            <form onSubmit={handleOnlinePay} className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-700 dark:text-gray-300">Dados do Cartão</h3>
                <div className="flex items-center gap-2">
                   {cardNumber.length > 4 && (
                     <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                       {getCardBrand(cardNumber)}
                     </span>
                   )}
                   <div className="flex gap-1">
                      <div className="w-8 h-5 bg-gray-200 dark:bg-zinc-700 rounded"></div>
                      <div className="w-8 h-5 bg-gray-200 dark:bg-zinc-700 rounded"></div>
                   </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 ml-1">NÚMERO DO CARTÃO</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={cardNumber}
                    onChange={(e) => {
                      const formatted = formatCardNumber(e.target.value);
                      if (formatted.length <= 19) setCardNumber(formatted);
                    }}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono bg-white dark:bg-zinc-800 dark:text-white"
                    placeholder="0000 0000 0000 0000"
                  />
                  <CreditCard className="w-5 h-5 text-gray-400 dark:text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 ml-1">NOME IMPRESSO</label>
                <input
                  type="text"
                  required
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-800 dark:text-white"
                  placeholder="NOME COMO NO CARTÃO"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 ml-1">VALIDADE</label>
                  <input
                    type="text"
                    required
                    value={expiry}
                    onChange={(e) => {
                      const formatted = formatExpiry(e.target.value);
                      if (formatted.length <= 5) setExpiry(formatted);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center bg-white dark:bg-zinc-800 dark:text-white"
                    placeholder="MM/AA"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 ml-1">CVV</label>
                  <input
                    type="text"
                    required
                    value={cvv}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 4) setCvv(val);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center bg-white dark:bg-zinc-800 dark:text-white"
                    placeholder="123"
                  />
                </div>
              </div>

              <div className="pt-2">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-4 justify-center bg-gray-50 dark:bg-zinc-800 p-2 rounded">
                  <Lock className="w-3 h-3" />
                  Pagamento processado com segurança via SSL
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-green-200 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Pagar R$ {amount.toFixed(2).replace('.', ',')}
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => setView('selection')}
                  disabled={isProcessing}
                  className="w-full mt-3 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-700 dark:hover:text-gray-200 py-2"
                >
                  Voltar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}