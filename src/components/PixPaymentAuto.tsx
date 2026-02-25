import React, { useState, useEffect } from 'react';
import { Copy, Check, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import * as api from '../utils/api';

interface PixPaymentAutoProps {
  orderId: string;
  amount: number;
  customerName: string;
  customerPhone: string;
  onPaymentConfirmed: () => void;
  onClose: () => void;
}

export function PixPaymentAuto({ 
  orderId, 
  amount, 
  customerName, 
  customerPhone,
  onPaymentConfirmed,
  onClose 
}: PixPaymentAutoProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  // Gerar QR Code ao montar
  useEffect(() => {
    generatePayment();
  }, []);

  // Polling para verificar status do pagamento
  useEffect(() => {
    if (paymentStatus === 'pending' && qrCode) {
      const interval = setInterval(async () => {
        await checkPaymentStatus();
      }, 3000); // Verificar a cada 3 segundos

      return () => clearInterval(interval);
    }
  }, [paymentStatus, qrCode]);

  const generatePayment = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.createPixPayment({
        orderId,
        amount,
        customerName,
        customerPhone,
      });

      if (response.success && response.payment) {
        setQrCode(response.payment.qrCode);
        setQrCodeImage(response.payment.qrCodeImage);
        setExpiresAt(response.payment.expiresAt);
      } else {
        setError(response.error || 'Erro ao gerar pagamento');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async () => {
    try {
      const response = await api.checkPaymentStatus(orderId);
      
      if (response.success && response.paymentStatus === 'approved') {
        setPaymentStatus('approved');
        // Aguardar 1 segundo para mostrar mensagem de sucesso
        setTimeout(() => {
          onPaymentConfirmed();
        }, 1500);
      } else if (response.paymentStatus === 'rejected') {
        setPaymentStatus('rejected');
      }
    } catch (err) {
      console.error('Erro ao verificar status:', err);
    }
  };

  const handleCopyQrCode = () => {
    if (qrCode) {
      navigator.clipboard.writeText(qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const formatTimeRemaining = () => {
    if (!expiresAt) return '';
    
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes <= 0) return 'Expirado';
    return `Expira em ${minutes} min`;
  };

  // Estado de carregamento
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-md p-8">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-700 dark:text-gray-200 font-medium">Gerando QR Code PIX...</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Aguarde um momento</p>
          </div>
        </div>
      </div>
    );
  }

  // Estado de erro
  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-md p-6">
          <div className="text-center">
            <div className="bg-red-100 dark:bg-red-900/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Erro</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
            <button
              onClick={onClose}
              className="w-full bg-gray-600 hover:bg-gray-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white py-2 rounded-lg font-medium transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pagamento aprovado
  if (paymentStatus === 'approved') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-md p-6">
          <div className="text-center">
            <div className="bg-green-100 dark:bg-green-900/30 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Pagamento Confirmado!</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Seu pedido foi confirmado e já está sendo preparado
            </p>
            <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-800 rounded-lg p-3 mb-4">
              <p className="text-green-800 dark:text-green-400 text-sm">
                ✅ Pedido #{orderId} confirmado automaticamente
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pagamento rejeitado
  if (paymentStatus === 'rejected') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-md p-6">
          <div className="text-center">
            <div className="bg-red-100 dark:bg-red-900/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Pagamento Não Confirmado</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              O pagamento foi cancelado ou recusado. Tente novamente.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-gray-600 hover:bg-gray-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white py-2 rounded-lg font-medium transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Aguardando pagamento
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-green-600 text-white p-4 rounded-t-lg">
          <h2 className="text-xl font-bold text-center">Pagamento via PIX</h2>
          <p className="text-center text-green-100 text-sm mt-1">
            Pedido #{orderId}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Valor */}
          <div className="text-center bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-2 border-green-200 dark:border-green-800">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Valor a pagar:</p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-500">
              R$ {amount.toFixed(2).replace('.', ',')}
            </p>
          </div>

          {/* QR Code */}
          {qrCodeImage && (
            <div className="text-center">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 font-medium">
                📱 Escaneie o QR Code com o app do seu banco:
              </p>
              <div className="bg-white p-4 rounded-lg border-2 border-gray-300 dark:border-zinc-700 inline-block">
                <img 
                  src={qrCodeImage} 
                  alt="QR Code PIX" 
                  className="w-64 h-64 mx-auto"
                />
              </div>
            </div>
          )}

          {/* Código PIX Copia e Cola */}
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 font-medium text-center">
              💳 Ou copie o código PIX:
            </p>
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-50 dark:bg-zinc-800 border-2 border-gray-300 dark:border-zinc-700 rounded-lg p-3 overflow-hidden">
                <p className="font-mono text-xs text-gray-800 dark:text-gray-200 break-all">
                  {qrCode?.substring(0, 60)}...
                </p>
              </div>
              <button
                onClick={handleCopyQrCode}
                className={`px-4 py-2 rounded-lg transition-all flex-shrink-0 ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
                title="Copiar código PIX"
              >
                {copied ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
            {copied && (
              <p className="text-green-600 dark:text-green-400 text-sm mt-2 text-center font-medium">
                ✓ Código PIX copiado!
              </p>
            )}
          </div>

          {/* Tempo de Expiração */}
          {expiresAt && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-300 dark:border-amber-800 rounded-lg p-3 flex items-center gap-2 justify-center">
              <Clock className="w-4 h-4 text-amber-700 dark:text-amber-500" />
              <p className="text-sm text-amber-800 dark:text-amber-500 font-medium">
                {formatTimeRemaining()}
              </p>
            </div>
          )}

          {/* Status de Aguardando */}
          <div className="bg-blue-50 dark:bg-blue-900/10 border-2 border-blue-300 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center gap-3 justify-center mb-2">
              <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
              <p className="text-blue-900 dark:text-blue-300 font-bold">Aguardando pagamento...</p>
            </div>
            <p className="text-xs text-blue-800 dark:text-blue-400 text-center">
              Assim que confirmarmos o pagamento, você será notificado automaticamente
            </p>
          </div>

          {/* Instruções */}
          <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
            <p className="text-sm text-gray-900 dark:text-gray-100 font-medium mb-2">
              📋 Como pagar:
            </p>
            <ol className="text-sm text-gray-700 dark:text-gray-400 space-y-1 list-decimal list-inside">
              <li>Abra o app do seu banco</li>
              <li>Escolha pagar com PIX</li>
              <li>Escaneie o QR Code ou cole o código</li>
              <li>Confirme o pagamento de R$ {amount.toFixed(2).replace('.', ',')}</li>
            </ol>
          </div>

          {/* Botão Fechar */}
          <button
            onClick={onClose}
            className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 py-3 rounded-lg font-medium transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}