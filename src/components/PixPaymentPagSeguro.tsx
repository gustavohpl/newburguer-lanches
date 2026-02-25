import React, { useState, useEffect } from 'react';
import { Copy, Check, Loader, CheckCircle, X, Clock } from 'lucide-react';
import * as api from '../utils/api';

interface PixPaymentPagSeguroProps {
  amount: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  deliveryType: 'delivery' | 'pickup' | 'dine-in';
  address?: string;
  orderId?: string;
  onPaymentConfirmed: (orderId: string) => void;
  onClose: () => void;
}

export function PixPaymentPagSeguro({
  amount,
  customerName,
  customerPhone,
  customerEmail,
  items,
  deliveryType,
  address,
  orderId,
  onPaymentConfirmed,
  onClose
}: PixPaymentPagSeguroProps) {
  const [qrCode, setQrCode] = useState('');
  const [copyPaste, setCopyPaste] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'expired'>('pending');

  // Tempo restante
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutos em segundos

  useEffect(() => {
    createPayment();
  }, []);

  // Verificar status do pagamento a cada 5 segundos
  useEffect(() => {
    if (!referenceId || paymentStatus !== 'pending') return;

    const interval = setInterval(async () => {
      console.log('🔍 Verificando status do pagamento...');
      const response = await api.checkPaymentStatus(referenceId);
      
      if (response.success) {
        if (response.status === 'paid' && response.orderId) {
          console.log('✅ Pagamento confirmado! Pedido:', response.orderId);
          setPaymentStatus('paid');
          clearInterval(interval);
          
          // Chamar callback de confirmação
          setTimeout(() => {
            onPaymentConfirmed(response.orderId);
          }, 1500);
        }
      }
    }, 5000); // Verificar a cada 5 segundos

    return () => clearInterval(interval);
  }, [referenceId, paymentStatus, onPaymentConfirmed]);

  // Contador de tempo
  useEffect(() => {
    if (paymentStatus !== 'pending') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setPaymentStatus('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [paymentStatus]);

  const createPayment = async () => {
    try {
      setIsLoading(true);
      setError('');

      console.log('💳 Criando pagamento PIX...');

      const response = await api.createPixPayment({
        amount,
        customerName,
        customerPhone,
        customerEmail,
        items,
        deliveryType,
        address,
        orderId // Passando ID do pedido existente
      });

      if (!response.success) {
        throw new Error(response.error || 'Erro ao criar pagamento');
      }

      console.log('✅ Pagamento PIX criado:', response);

      // Verificar se está em modo manual
      if (response.mode === 'manual') {
        // Modo PIX Manual - Apenas mostrar a chave
        setCopyPaste(response.pixKey);
        setIsLoading(false);
        return;
      }

      // Modo Automático (PagSeguro API)
      setQrCode(response.qrCode);
      setCopyPaste(response.copyPaste);
      setReferenceId(response.referenceId);
      setExpiresAt(response.expiresAt);
      setIsLoading(false);

    } catch (err: any) {
      console.error('❌ Erro ao criar pagamento:', err);
      setError(err.message || 'Erro ao processar pagamento. Tente novamente.');
      setIsLoading(false);
    }
  };

  const handleCopyPaste = () => {
    navigator.clipboard.writeText(copyPaste);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Tela de Carregamento
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl p-8 max-w-md w-full text-center">
          <Loader className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            Gerando pagamento PIX...
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Aguarde enquanto preparamos o QR Code
          </p>
        </div>
      </div>
    );
  }

  // Tela de Erro
  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="bg-red-100 dark:bg-red-900/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              Erro ao gerar PIX
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {error}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-gray-600 hover:bg-gray-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white py-3 rounded-lg font-bold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  // Tela de Pagamento Confirmado
  if (paymentStatus === 'paid') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-500">
          <div className="bg-gradient-to-r from-green-500 to-green-600 p-8 text-center">
            <div className="bg-white dark:bg-zinc-800 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Pagamento Confirmado!
            </h2>
            <p className="text-green-50">
              ✅ Processando seu pedido...
            </p>
          </div>
          <div className="p-6">
            <div className="animate-pulse text-center text-gray-600 dark:text-gray-400">
              Redirecionando...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Tela de PIX Expirado
  if (paymentStatus === 'expired') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="bg-amber-100 dark:bg-amber-900/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              Tempo Expirado
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              O PIX expirou. Por favor, gere um novo QR Code.
            </p>
          </div>
          <button
            onClick={() => {
              setPaymentStatus('pending');
              setTimeLeft(30 * 60);
              createPayment();
            }}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold transition-colors mb-2"
          >
            Gerar Novo PIX
          </button>
          <button
            onClick={onClose}
            className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 py-2 rounded-lg font-medium transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // ✅ MODO MANUAL - Sem QR Code, apenas chave PIX
  if (!qrCode && copyPaste) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-md">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Pagamento PIX Manual</h2>
              <button
                onClick={onClose}
                className="text-white hover:bg-green-800 p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Valor */}
            <div className="text-center bg-green-50 dark:bg-zinc-800 p-4 rounded-lg border-2 border-green-200 dark:border-zinc-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Valor a pagar:</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-500">
                R$ {amount.toFixed(2)}
              </p>
            </div>

            {/* Instruções */}
            <div className="bg-blue-50 dark:bg-zinc-800 border border-blue-200 dark:border-zinc-700 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-400 font-medium mb-2">
                📋 Instruções:
              </p>
              <ol className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-decimal list-inside">
                <li>Copie a chave PIX abaixo</li>
                <li>Abra o app do seu banco</li>
                <li>Cole a chave e faça o pagamento</li>
                <li>Envie o comprovante via WhatsApp</li>
              </ol>
            </div>

            {/* Chave PIX */}
            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 font-medium text-center">
                🔑 Chave PIX:
              </p>
              <div className="bg-white dark:bg-zinc-900 p-3 rounded border border-gray-300 dark:border-zinc-700 mb-3">
                <p className="text-center font-mono text-sm break-all text-gray-800 dark:text-gray-200">
                  {copyPaste}
                </p>
              </div>
              <button
                onClick={handleCopyPaste}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5" />
                    Chave Copiada!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copiar Chave PIX
                  </>
                )}
              </button>
            </div>

            {/* Aviso */}
            <div className="bg-amber-50 dark:bg-zinc-800 border border-amber-200 dark:border-zinc-700 rounded-lg p-3">
              <p className="text-xs text-amber-900 dark:text-amber-400 text-center">
                ⚠️ Após realizar o pagamento, envie o comprovante via WhatsApp para confirmarmos seu pedido.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Tela Principal - QR Code PIX (Modo Automático)
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Pagamento PIX</h2>
            <button
              onClick={onClose}
              className="text-white hover:bg-green-800 p-2 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Valor */}
          <div className="text-center bg-green-50 dark:bg-zinc-800 p-4 rounded-lg border-2 border-green-200 dark:border-zinc-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Valor a pagar:</p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-500">
              R$ {amount.toFixed(2)}
            </p>
          </div>

          {/* Tempo Restante */}
          <div className="bg-amber-50 dark:bg-zinc-800 border border-amber-200 dark:border-zinc-700 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-amber-900 dark:text-amber-400 font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Tempo restante:
              </span>
              <span className="text-lg font-bold text-amber-700 dark:text-amber-500">
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>

          {/* QR Code */}
          <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 font-medium">
              📱 Escaneie o QR Code
            </p>
            {qrCode && (
              <div className="bg-white p-4 rounded-lg inline-block border-2 border-gray-200 dark:border-zinc-700">
                <img
                  src={`data:image/png;base64,${qrCode}`}
                  alt="QR Code PIX"
                  className="w-64 h-64 mx-auto"
                />
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-zinc-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-zinc-900 text-gray-500 dark:text-gray-400">ou</span>
            </div>
          </div>

          {/* Copia e Cola */}
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 font-medium text-center">
              💳 Copie o código PIX:
            </p>
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-50 dark:bg-zinc-800 border-2 border-gray-300 dark:border-zinc-700 rounded-lg p-3 overflow-hidden">
                <p className="font-mono text-xs text-gray-800 dark:text-gray-200 break-all">
                  {copyPaste}
                </p>
              </div>
              <button
                onClick={handleCopyPaste}
                className={`px-4 rounded-lg transition-all font-medium ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
                title="Copiar código PIX"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5 mx-auto" />
                    <span className="text-xs block mt-1">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5 mx-auto" />
                    <span className="text-xs block mt-1">Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Instruções */}
          <div className="bg-blue-50 dark:bg-zinc-800 border border-blue-200 dark:border-zinc-700 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-400 font-semibold mb-2">
              📋 Como pagar:
            </p>
            <ol className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-decimal list-inside">
              <li>Abra o app do seu banco</li>
              <li>Escolha pagar com PIX</li>
              <li>Escaneie o QR Code ou cole o código</li>
              <li>Confirme o pagamento</li>
            </ol>
          </div>

          {/* Status */}
          <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-zinc-800 dark:to-zinc-900 border-2 border-green-300 dark:border-zinc-700 rounded-lg p-4">
            <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-500">
              <Loader className="w-5 h-5 animate-spin" />
              <p className="font-semibold">
                Aguardando pagamento...
              </p>
            </div>
            <p className="text-xs text-green-600 dark:text-green-500 text-center mt-2">
              ✨ Confirmaremos automaticamente quando você pagar
            </p>
          </div>

          {/* Nota */}
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Referência: {referenceId}
          </p>
        </div>
      </div>
    </div>
  );
}
