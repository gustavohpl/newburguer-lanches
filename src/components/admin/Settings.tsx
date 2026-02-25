import React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle, RefreshCw, Printer, CheckCircle, XCircle, Clock, Save, Tag, Store, Phone, MapPin, MessageSquare, Smile, Plus, Edit2, Globe } from 'lucide-react';
import * as api from '../../utils/api';
import { usePrinter } from '../PrinterManager';
import { CouponsManager } from './CouponsManager';
import { useConfig } from '../../ConfigContext';
import { toast } from 'sonner@2.0.3';

export function Settings() {
  const { config, refreshConfig } = useConfig();
  const [isClearing, setIsClearing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  // Estados para Informações da Loja
  const [basicSettings, setBasicSettings] = useState({
    openingHours: ''
  });
  const [isSavingBasic, setIsSavingBasic] = useState(false);

  // Estados para estimativas de tempo
  const [estimates, setEstimates] = useState<api.TimeEstimates>({
    delivery: { min: 30, max: 50 },
    pickup: { min: 15, max: 25 },
    dineIn: { min: 20, max: 30 }
  });
  
  // Estados para taxa de entrega
  const [deliveryFee, setDeliveryFee] = useState<number>(5.00);
  const [isLoadingFee, setIsLoadingFee] = useState(true);
  const [isSavingFee, setIsSavingFee] = useState(false);

  const [isLoadingEstimates, setIsLoadingEstimates] = useState(true);
  const [isSavingEstimates, setIsSavingEstimates] = useState(false);
  
  // Estado para descobrir IP do servidor
  const [isDiscoveringIP, setIsDiscoveringIP] = useState(false);
  
  const { isConnected, connectPrinter, disconnectPrinter, testPrint } = usePrinter();

  // 🔄 Atualização: Janeiro 2026 - Adicionado toggle "Consumir no Local"
  
  // Atualizar form quando config mudar
  useEffect(() => {
    setBasicSettings({
      openingHours: config.openingHours || ''
    });
    
    // 🔍 DEBUG: Verificar se o toggle aparece
    console.log('🍽️ [SETTINGS] Config dineIn:', config.features?.dineIn);
  }, [config]);

  const handleSaveBasic = async () => {
    try {
      setIsSavingBasic(true);
      const response = await api.updateBasicSettings(basicSettings);
      
      if (response.success) {
        alert('✅ Informações atualizadas com sucesso!');
        await refreshConfig();
      } else {
        alert('❌ Erro ao atualizar informações: ' + (response.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Erro ao salvar info:', error);
      alert('❌ Erro ao salvar informações');
    } finally {
      setIsSavingBasic(false);
    }
  };

  // Carregar estimativas ao iniciar
  useEffect(() => {
    loadEstimates();
    loadDeliveryFee();
  }, []);

  const loadDeliveryFee = async () => {
    try {
      setIsLoadingFee(true);
      const response = await api.getDeliveryFee();
      if (response.success) {
        setDeliveryFee(response.fee);
      }
    } catch (error) {
      console.error('Erro ao carregar taxa de entrega:', error);
    } finally {
      setIsLoadingFee(false);
    }
  };

  const handleSaveFee = async () => {
    try {
      setIsSavingFee(true);
      await api.updateDeliveryFee(deliveryFee);
      alert('✅ Taxa de entrega atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar taxa:', error);
      alert('❌ Erro ao salvar taxa de entrega');
    } finally {
      setIsSavingFee(false);
    }
  };

  const loadEstimates = async () => {
    try {
      setIsLoadingEstimates(true);
      const response = await api.getEstimates();
      if (response.success && response.estimates) {
        setEstimates(response.estimates);
      }
    } catch (error) {
      console.error('Erro ao carregar estimativas:', error);
    } finally {
      setIsLoadingEstimates(false);
    }
  };

  const handleSaveEstimates = async () => {
    try {
      setIsSavingEstimates(true);
      await api.saveEstimates(estimates);
      alert('✅ Estimativas de tempo salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar estimativas:', error);
      alert('❌ Erro ao salvar estimativas');
    } finally {
      setIsSavingEstimates(false);
    }
  };

  const handleClearOrders = async () => {
    try {
      setIsClearing(true);
      console.log('🗑️ [SETTINGS] Limpando todos os pedidos...');
      
      const response = await api.clearAllOrders();
      
      if (response.success) {
        // Limpar localStorage também
        localStorage.removeItem('faroeste_orders');
        
        alert(`✅ ${response.deletedCount || 'Todos os'} pedidos foram deletados com sucesso!`);
        setShowConfirm(false);
        // Recarregar a página para atualizar o dashboard
        window.location.reload();
      } else {
        // Se falhar no servidor, tentar limpar apenas localStorage
        console.log('⚠️ [SETTINGS] Servidor offline - limpando apenas localStorage');
        localStorage.removeItem('faroeste_orders');
        alert('✅ Pedidos locais foram deletados com sucesso! (Modo offline)');
        setShowConfirm(false);
        window.location.reload();
      }
    } catch (error) {
      console.error('❌ [SETTINGS] Erro ao limpar pedidos:', error);
      
      // Fallback: limpar localStorage mesmo com erro no servidor
      try {
        localStorage.removeItem('faroeste_orders');
        alert('✅ Pedidos locais foram deletados! (Modo offline - servidor indisponível)');
        setShowConfirm(false);
        window.location.reload();
      } catch (localError) {
        alert('❌ Erro ao limpar pedidos. Tente novamente.');
        setIsClearing(false);
      }
    } finally {
      setIsClearing(false);
    }
  };

  const handleConnectPrinter = async () => {
    try {
      setIsConnecting(true);
      console.log('🔌 [SETTINGS] Conectando à impressora...');
      
      const success = await connectPrinter();
      
      if (!success) {
        // O alert já foi mostrado pelo PrinterManager
        console.log('⚠️ [SETTINGS] Falha ao conectar');
      }
    } catch (error) {
      console.error('❌ [SETTINGS] Erro ao conectar à impressora:', error);
      alert('❌ Erro ao conectar à impressora USB. Certifique-se de que ela está ligada e conectada via cabo USB.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTestPrint = async () => {
    if (!isConnected) {
      alert('❌ Conecte a impressora primeiro!');
      return;
    }
    
    try {
      setIsTesting(true);
      console.log('🖨️ [SETTINGS] Testando impressão...');
      
      const success = await testPrint();
      
      if (success) {
        alert('✅ Teste de impressão bem-sucedido! Verifique o cupom impresso.');
      } else {
        alert('❌ Falha no teste de impressão. Verifique a conexão.');
      }
    } catch (error) {
      console.error('❌ [SETTINGS] Erro no teste de impressão:', error);
      alert('❌ Erro no teste de impressão');
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnectPrinter = () => {
    try {
      console.log('🔌 [SETTINGS] Desconectando impressora...');
      disconnectPrinter();
      alert('✅ Impressora desconectada com sucesso!');
    } catch (error) {
      console.error('❌ [SETTINGS] Erro ao desconectar impressora:', error);
      alert('❌ Erro ao desconectar impressora');
    }
  };

  // Funções de Setores removidas (movidas para Master)
  
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Configurações</h1>
        <p className="text-gray-600">Gerencie configurações do sistema</p>
      </div>

      {/* Basic Info Settings */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Store className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl font-bold text-gray-800">Informações da Loja</h2>
        </div>
        
        <p className="text-sm text-gray-600 mb-6">
          Personalize as informações principais exibidas no seu site.
        </p>

        <div className="space-y-6 max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                Horário de Funcionamento
              </label>
              <textarea
                value={basicSettings.openingHours}
                onChange={(e) => setBasicSettings({ ...basicSettings, openingHours: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                placeholder={"Ex: Seg a Sex: 18h30 às 23h\nSáb e Dom: 11h às 23h"}
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">Exibido no topo do site. Use Enter para quebrar linha.</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveBasic}
              disabled={isSavingBasic}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSavingBasic ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Salvar Informações
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Payment Settings */}
      {(config.features?.automaticPaymentAllowed !== false) ? (
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-emerald-100 p-2 rounded-lg">
            <span className="text-xl">💳</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800">Pagamentos</h2>
        </div>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-800 text-lg">Pagamento Automático</h3>
              <p className="text-sm text-gray-600 max-w-md mt-1">
                Quando ativado, o sistema gera QR Codes PIX dinâmicos e confirma o pagamento automaticamente.
                <br />
                <span className="text-xs text-amber-600 font-medium">
                  {config.automaticPayment 
                    ? '⚠️ Ativado: O cliente paga no site e o pedido chega como "PAGO".' 
                    : 'ℹ️ Desativado: O cliente envia o comprovante via WhatsApp.'}
                </span>
              </p>
            </div>
            
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={!!config.automaticPayment}
                onChange={async (e) => {
                  try {
                    const newValue = e.target.checked;
                    
                    // Validação de Token PagSeguro antes de ativar
                    if (newValue) {
                        // Verifica se o token existe no backend (flag segura enviada pela rota /config/public)
                        // Se estiver no Master Dashboard, pode ter o pagSeguroToken direto.
                        // Se estiver no Admin Dashboard (público), usa hasPagSeguroToken.
                        const hasToken = config.pagSeguroToken || config.hasPagSeguroToken;
                        
                        if (!hasToken) {
                            alert('🚫 Ação Bloqueada!\n\nPara ativar o Pagamento Automático, você deve primeiro configurar o Token do PagSeguro no Painel Master.\n\nSem o token, não é possível processar pagamentos.');
                            e.target.checked = false; // Reverter visualmente
                            return;
                        }
                    }

                    await api.updateConfig({ automaticPayment: newValue });
                    await refreshConfig();
                    
                    if (newValue) {
                      alert('✅ Pagamento Automático ATIVADO!\n\nAgora o sistema cobrará via PIX/Cartão automaticamente.');
                    } else {
                      alert('ℹ️ Pagamento Automático DESATIVADO.\n\nAgora o sistema usará o modo manual (Envio de comprovante).');
                    }
                  } catch (err) {
                    console.error('Erro ao atualizar config', err);
                    alert('Erro ao atualizar configuração');
                  }
                }}
              />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {!config.automaticPayment && (
            <div className="mt-4 pt-4 border-t border-gray-200 animate-in fade-in">
              <p className="text-sm font-bold text-gray-700 mb-2">Chave PIX Manual (Configurada no Master):</p>
              <div className="bg-white p-3 rounded border border-gray-300 font-mono text-sm text-gray-600 flex items-center justify-between">
                <span>{config.manualPixKey || 'Nenhuma chave configurada'}</span>
                <span className="text-xs text-gray-400 italic">Somente leitura</span>
              </div>
            </div>
          )}
          
          {/* 🌐 Botão para descobrir IP do servidor */}
          {config.automaticPayment && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-2">
                  <Globe className="w-5 h-5" />
                  Configurar Whitelist do PagSeguro
                </h3>
                <p className="text-sm text-blue-700 mb-3">
                  Se você recebeu o erro <span className="font-mono bg-blue-100 px-2 py-1 rounded">ACCESS_DENIED - whitelist required</span>, 
                  você precisa adicionar o IP do servidor Supabase na whitelist do PagSeguro.
                </p>
                <button
                  onClick={async () => {
                    setIsDiscoveringIP(true);
                    try {
                      const response = await api.getServerIP();
                      if (response.success && response.ip) {
                        toast.success(
                          `IP do Servidor: ${response.ip}\n\nCopiado para área de transferência!`,
                          { duration: 10000, icon: '📋' }
                        );
                        
                        // Copiar para clipboard
                        navigator.clipboard.writeText(response.ip);
                        
                        // Mostrar instruções detalhadas
                        alert(
                          `✅ IP DO SERVIDOR SUPABASE:\n\n` +
                          `${response.ip}\n\n` +
                          `📋 PRÓXIMOS PASSOS:\n\n` +
                          `1️⃣ O IP foi copiado para sua área de transferência\n\n` +
                          `2️⃣ Acesse: https://pagseguro.uol.com.br/\n\n` +
                          `3️⃣ Vá em: Integração > Tokens > Configurações de Segurança\n\n` +
                          `4️⃣ Cole o IP: ${response.ip}\n\n` +
                          `5️⃣ Aguarde até 24h para a whitelist propagar\n\n` +
                          `⚠️ IMPORTANTE:\n` +
                          `- Use token de PRODUÇÃO (não sandbox)\n` +
                          `- Configure PAGSEGURO_ENVIRONMENT=production no Supabase`
                        );
                      } else {
                        toast.error('Erro ao descobrir IP do servidor');
                      }
                    } catch (err) {
                      console.error('Erro ao descobrir IP:', err);
                      toast.error('Erro ao descobrir IP do servidor');
                    } finally {
                      setIsDiscoveringIP(false);
                    }
                  }}
                  disabled={isDiscoveringIP}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {isDiscoveringIP ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Descobrindo...
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4" />
                      Descobrir IP do Servidor
                    </>
                  )}
                </button>
                
                <div className="mt-3 text-xs text-blue-600">
                  <p><strong>💡 Dica:</strong> Se você está apenas testando, use o ambiente SANDBOX do PagSeguro (não precisa de whitelist).</p>
                  <p className="mt-1">Configure no Supabase: <span className="font-mono bg-blue-100 px-1 rounded">PAGSEGURO_ENVIRONMENT=sandbox</span></p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 border-l-4 border-red-500">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-red-100 p-2 rounded-lg">
              <span className="text-xl">🚫</span>
            </div>
            <h2 className="text-xl font-bold text-gray-800">Pagamentos</h2>
          </div>
          <div className="bg-red-50 p-4 rounded-lg border border-red-100">
            <h3 className="font-bold text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Pagamento Automático Desativado pelo Administrador
            </h3>
            <p className="text-sm text-red-700 mt-2">
              O administrador do sistema desativou a opção de pagamentos automáticos (Online/PIX Automático) para esta loja. 
              Somente o modo manual (envio de comprovante) está disponível.
            </p>
          </div>
        </div>
      )}

      {/* Delivery Fee Settings */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-green-100 p-2 rounded-lg">
            <span className="text-xl">🛵</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800">Taxa de Entrega</h2>
        </div>
        
        <p className="text-sm text-gray-600 mb-6">
          Defina o valor da taxa de entrega cobrada aos clientes.
        </p>

        {isLoadingFee ? (
          <div className="flex justify-center p-4">
            <RefreshCw className="w-6 h-6 animate-spin text-green-600" />
          </div>
        ) : (
          <div className="flex items-end gap-4 max-w-md">
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Valor da Taxa (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">R$</span>
                <input
                  type="number"
                  min="0"
                  step="0.50"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-lg font-bold focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            </div>
            
            <button
              onClick={handleSaveFee}
              disabled={isSavingFee}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold transition-colors flex items-center gap-2 disabled:opacity-50 h-[52px]"
            >
              {isSavingFee ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Salvar
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Time Estimates Settings */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-800">Estimativas de Tempo (Minutos)</h2>
        </div>
        
        <p className="text-sm text-gray-600 mb-6">
          Defina o tempo médio estimado para cada tipo de pedido. Esses valores serão exibidos para os clientes.
        </p>

        {isLoadingEstimates ? (
          <div className="flex justify-center p-8">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Delivery */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <label className="block text-sm font-bold text-blue-800 mb-2">
                🛵 Entrega (Delivery)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={estimates.delivery.min}
                  onChange={(e) => setEstimates(prev => ({ ...prev, delivery: { min: parseInt(e.target.value) || 0, max: prev.delivery.max } }))}
                  className="w-full p-2 border border-blue-200 rounded text-lg font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <span className="text-blue-700 font-medium">min</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={estimates.delivery.max}
                  onChange={(e) => setEstimates(prev => ({ ...prev, delivery: { min: prev.delivery.min, max: parseInt(e.target.value) || 0 } }))}
                  className="w-full p-2 border border-blue-200 rounded text-lg font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <span className="text-blue-700 font-medium">max</span>
              </div>
            </div>

            {/* Pickup */}
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
              <label className="block text-sm font-bold text-orange-800 mb-2">
                🥡 Retirada no Balcão
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={estimates.pickup.min}
                  onChange={(e) => setEstimates(prev => ({ ...prev, pickup: { min: parseInt(e.target.value) || 0, max: prev.pickup.max } }))}
                  className="w-full p-2 border border-orange-200 rounded text-lg font-bold text-center focus:ring-2 focus:ring-orange-500 outline-none"
                />
                <span className="text-orange-700 font-medium">min</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={estimates.pickup.max}
                  onChange={(e) => setEstimates(prev => ({ ...prev, pickup: { min: prev.pickup.min, max: parseInt(e.target.value) || 0 } }))}
                  className="w-full p-2 border border-orange-200 rounded text-lg font-bold text-center focus:ring-2 focus:ring-orange-500 outline-none"
                />
                <span className="text-orange-700 font-medium">max</span>
              </div>
            </div>

            {/* Dine In */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-100">
              <label className="block text-sm font-bold text-green-800 mb-2">
                🍽️ Consumo no Local
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={estimates.dineIn.min}
                  onChange={(e) => setEstimates(prev => ({ ...prev, dineIn: { min: parseInt(e.target.value) || 0, max: prev.dineIn.max } }))}
                  className="w-full p-2 border border-green-200 rounded text-lg font-bold text-center focus:ring-2 focus:ring-green-500 outline-none"
                />
                <span className="text-green-700 font-medium">min</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={estimates.dineIn.max}
                  onChange={(e) => setEstimates(prev => ({ ...prev, dineIn: { min: prev.dineIn.min, max: parseInt(e.target.value) || 0 } }))}
                  className="w-full p-2 border border-green-200 rounded text-lg font-bold text-center focus:ring-2 focus:ring-green-500 outline-none"
                />
                <span className="text-green-700 font-medium">max</span>
              </div>
            </div>
            
            <div className="md:col-span-3 flex justify-end mt-2">
              <button
                onClick={handleSaveEstimates}
                disabled={isSavingEstimates}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSavingEstimates ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 🆕 TOGGLE CONSUMIR NO LOCAL */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-orange-100 p-2 rounded-lg">
            <span className="text-xl">🍽️</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800">Opções de Entrega</h2>
        </div>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-800 text-lg">Permitir "Consumir no Local"</h3>
              <p className="text-sm text-gray-600 max-w-md mt-1">
                Quando ativado, os clientes poderão escolher a opção "Consumir no Local" (Dine-in) no momento do pedido.
                <br />
                <span className="text-xs text-amber-600 font-medium">
                  {config.features?.dineIn !== false
                    ? '✅ Ativado: Clientes podem pedir para consumir no restaurante.' 
                    : '❌ Desativado: Apenas Entrega e Retirada disponíveis.'}
                </span>
              </p>
            </div>
            
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={config.features?.dineIn !== false}
                onChange={async (e) => {
                  try {
                    const newValue = e.target.checked;
                    
                    console.log('🍽️ [SETTINGS] Toggle clicado:', {
                      newValue,
                      currentFeatures: config.features,
                      currentDineIn: config.features?.dineIn
                    });
                    
                    const updatePayload = { 
                      features: { 
                        ...config.features, 
                        dineIn: newValue 
                      } 
                    };
                    
                    console.log('📤 [SETTINGS] Enviando para API:', updatePayload);
                    
                    await api.updateConfig(updatePayload);
                    await refreshConfig();
                    
                    console.log('✅ [SETTINGS] Config atualizada, nova config:', config);
                    
                    if (newValue) {
                      alert('✅ "Consumir no Local" ATIVADO!\n\nOs clientes agora podem escolher esta opção.');
                    } else {
                      alert('❌ "Consumir no Local" DESATIVADO.\n\nApenas Entrega e Retirada estarão disponíveis.');
                    }
                  } catch (err) {
                    console.error('Erro ao atualizar config', err);
                    alert('Erro ao atualizar configuração');
                  }
                }}
              />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-orange-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Cupons Settings - Integrado */}
      {(config.features?.coupons !== false) && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Tag className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold text-gray-800">Cupons de Desconto</h2>
          </div>
          
          <p className="text-sm text-gray-600 mb-6">
            Crie e gerencie cupons de desconto para seus clientes aplicarem no checkout.
          </p>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-6">
            <CouponsManager />
          </div>
        </div>
      )}

      {/* Printer Settings */}
      {(config.features?.thermalPrinter !== false) && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Printer className="w-6 h-6 text-gray-600" />
            <h2 className="text-xl font-bold text-gray-800">Configurações de Impressão</h2>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="font-bold text-gray-800 mb-2">🔌 Conectar Impressora USB</h3>
            <p className="text-sm text-gray-700 mb-4">
              Conecte sua impressora térmica via cabo USB para imprimir pedidos automaticamente.
              <br />
              <strong>Requisitos:</strong> Google Chrome, Edge ou Opera (Web Serial API)
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleConnectPrinter}
                disabled={isConnecting || isConnected}
                className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Conectando...
                  </>
                ) : isConnected ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Impressora Conectada
                  </>
                ) : (
                  <>
                    <Printer className="w-5 h-5" />
                    🔌 Conectar Impressora USB
                  </>
                )}
              </button>
              <button
                onClick={handleDisconnectPrinter}
                disabled={!isConnected}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <XCircle className="w-5 h-5" />
                Desconectar
              </button>
            </div>

            <div className="mt-4">
              <h3 className="font-bold text-gray-800 mb-2">🧪 Testar Impressão</h3>
              <p className="text-sm text-gray-700 mb-4">
                Imprima um cupom de teste para verificar se a impressora está funcionando corretamente.
              </p>

              <button
                onClick={handleTestPrint}
                disabled={!isConnected || isTesting}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Testando...
                  </>
                ) : (
                  <>
                    <Printer className="w-5 h-5" />
                    🧪 Imprimir Teste
                  </>
                )}
              </button>
            </div>

            {isConnected && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <strong>✅ Impressora conectada!</strong> Os pedidos serão impressos automaticamente.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="bg-white rounded-lg shadow-md p-6 border-2 border-red-200">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <h2 className="text-xl font-bold text-red-800">Zona de Perigo</h2>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="font-bold text-red-800 mb-2">Limpar Todos os Pedidos</h3>
          <p className="text-sm text-red-700 mb-4">
            Esta ação irá deletar TODOS os pedidos do banco de dados. Isso zerará todas as estatísticas
            de vendas, pedidos e clientes. <strong>Esta ação NÃO pode ser desfeita!</strong>
          </p>

          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-5 h-5" />
              Limpar Todos os Pedidos
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-white border-2 border-red-400 rounded-lg p-4">
                <p className="text-red-800 font-bold mb-2">⚠️ TEM CERTEZA?</p>
                <p className="text-sm text-red-700 mb-4">
                  Todos os pedidos serão deletados permanentemente. Digite "CONFIRMAR" abaixo:
                </p>
                <input
                  type="text"
                  id="confirm-input"
                  placeholder="Digite CONFIRMAR"
                  className="w-full p-3 border border-red-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const input = (e.target as HTMLInputElement).value;
                      if (input === 'CONFIRMAR') {
                        handleClearOrders();
                      } else {
                        alert('❌ Digite exatamente "CONFIRMAR" para continuar');
                      }
                    }
                  }}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      const input = document.getElementById('confirm-input') as HTMLInputElement;
                      if (input.value === 'CONFIRMAR') {
                        handleClearOrders();
                      } else {
                        alert('❌ Digite exatamente "CONFIRMAR" para continuar');
                      }
                    }}
                    disabled={isClearing}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isClearing ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Deletando...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-5 h-5" />
                        Sim, Deletar Tudo
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    disabled={isClearing}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>💡 Dica:</strong> Use esta função apenas quando quiser começar do zero ou limpar
            dados de teste. Os produtos NÃO serão afetados.
          </p>
        </div>
      </div>

      {/* 🆕 Setores de Entrega - REMOVIDO E MOVIDO PARA MASTER */}
      
    </div>
  );
}