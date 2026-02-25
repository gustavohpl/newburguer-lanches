import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Users, DollarSign, Target, 
  MoreHorizontal, Pause, Play, Edit2, 
  Clock, CheckCircle2, AlertCircle, ShoppingCart,
  Gift, Percent, Zap, Loader2
} from 'lucide-react';
import * as api from '../../../utils/api';
import { Coupon } from '../CouponsManager';
import { formatBrasiliaDate } from '../../../utils/dateUtils';

interface Campaign {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed';
  coupon: string;
  spent: number;
  revenue: number;
  roas: number;
  used: number;
  total: number;
  daysActive: number;
  audience: string;
}

export function CouponAdsDashboard() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Carregar cupons reais
      const response = await api.getCoupons();
      if (response.success && response.coupons) {
        setCoupons(response.coupons);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Converter cupons em formato de campanha para exibição
  const activeCampaigns: Campaign[] = coupons.map(coupon => {
    const isCompleted = coupon.maxUses !== -1 && coupon.currentUses >= coupon.maxUses;
    const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
    
    let status: 'active' | 'paused' | 'completed' = 'active';
    if (!coupon.isActive) status = 'paused';
    if (isCompleted || isExpired) status = 'completed';

    // Simulação de dados de ad performance baseados no uso real do cupom
    const revenue = 0; // Zerado como solicitado
    const spent = 0; // Zerado como solicitado
    const roas = 0;

    return {
      id: coupon.id,
      name: `Campanha ${coupon.code}`,
      status,
      coupon: coupon.code,
      spent,
      revenue,
      roas,
      used: coupon.currentUses,
      total: coupon.maxUses === -1 ? 9999 : coupon.maxUses,
      daysActive: Math.ceil((new Date().getTime() - new Date(coupon.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      audience: 'Geral'
    };
  });

  const campaigns = activeCampaigns.length > 0 ? activeCampaigns : [];

  const automations: any[] = []; // Removendo dados de exemplo

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-orange-100 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-orange-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full">+12%</span>
          </div>
          <div className="text-gray-500 text-sm mb-1">Receita Gerada</div>
          <div className="text-2xl font-bold text-gray-800">R$ 0,00</div>
          <div className="mt-2 text-xs text-gray-400">Via campanhas de cupom</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-blue-100 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Gift className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full">45 total</span>
          </div>
          <div className="text-gray-500 text-sm mb-1">Cupons Usados</div>
          <div className="text-2xl font-bold text-gray-800">
            {campaigns.reduce((acc, curr) => acc + curr.used, 0)} usos
          </div>
          <div className="mt-2 text-xs text-gray-400">Total acumulado</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-purple-100 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-purple-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-1 rounded-full">--</span>
          </div>
          <div className="text-gray-500 text-sm mb-1">ROAS Médio</div>
          <div className="text-2xl font-bold text-gray-800">0.0x</div>
          <div className="mt-2 text-xs text-gray-400">Retorno sobre ad spend</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-green-100 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-green-50 rounded-lg">
              <Percent className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="text-gray-500 text-sm mb-1">Lucro Líquido</div>
          <div className="text-2xl font-bold text-gray-800">R$ 0,00</div>
          <div className="mt-2 text-xs text-gray-400">Já descontando ads e cupom</div>
        </div>
      </div>

      {/* Campaigns Ranking */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-gray-800 text-lg">Ranking de Campanhas de Cupom</h3>
            <p className="text-sm text-gray-500">Desempenho dos seus cupons anunciados</p>
          </div>
          <button className="text-sm text-orange-600 font-medium hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors">
            Ver Relatório Completo
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Campanha / Cupom</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Investido</th>
                <th className="px-6 py-4 font-medium text-center">Usos</th>
                <th className="px-6 py-4 font-medium text-right">Receita</th>
                <th className="px-6 py-4 font-medium text-right">ROAS</th>
                <th className="px-6 py-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.map((camp, index) => (
                <tr key={camp.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' : 
                        index === 1 ? 'bg-gray-200 text-gray-700' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">{camp.name}</div>
                        <div className="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded inline-block mt-0.5">
                          {camp.coupon}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                      camp.status === 'active' ? 'bg-green-50 text-green-700 border-green-100' :
                      camp.status === 'paused' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                      'bg-gray-50 text-gray-600 border-gray-100'
                    }`}>
                      {camp.status === 'active' && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>}
                      {camp.status === 'active' ? 'Ativa' : camp.status === 'paused' ? 'Pausada' : 'Concluída'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600">
                    R$ {camp.spent.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-medium text-gray-800">
                        {camp.used}/{camp.total === 9999 ? '∞' : camp.total}
                      </span>
                      {camp.total !== 9999 && (
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${camp.used >= camp.total ? 'bg-red-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(100, (camp.used / camp.total) * 100)}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-800">
                    R$ {camp.revenue.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-bold px-2 py-1 rounded ${
                      camp.roas > 10 ? 'bg-green-100 text-green-700' : 
                      camp.roas > 5 ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {camp.roas}x
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Automations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-xl p-6 shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Automações Ativas
            </h3>
            <button className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">
              + Nova Automação
            </button>
          </div>

          <div className="space-y-4">
            {automations.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="mb-3 flex justify-center">
                  <Zap className="w-12 h-12 opacity-20" />
                </div>
                <p>Nenhuma automação ativa no momento.</p>
                <p className="text-xs mt-1 opacity-70">Crie regras automáticas para recuperar clientes.</p>
              </div>
            ) : (
              automations.map((auto) => (
              <div key={auto.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    auto.status ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {auto.status ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
                  </div>
                  <div>
                    <div className="font-bold text-white">{auto.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Se <span className="text-yellow-400">{auto.trigger}</span> → {auto.action}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-gray-300">{auto.stats}</div>
                  <button className="text-xs text-blue-300 hover:text-blue-200 mt-1 flex items-center justify-end gap-1">
                    <Edit2 className="w-3 h-3" /> Editar
                  </button>
                </div>
              </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Tips / Upsell */}
        <div className="bg-orange-50 rounded-xl p-6 border border-orange-100 flex flex-col justify-center">
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <ShoppingCart className="w-6 h-6 text-orange-600" />
          </div>
          <h3 className="font-bold text-gray-900 mb-2">Recuperação de Vendas</h3>
          <p className="text-sm text-gray-600 mb-4">
            Você não tem carrinhos abandonados recentes.
          </p>
          <button className="w-full bg-gray-400 text-white font-medium py-3 rounded-xl cursor-not-allowed shadow-none" disabled>
            Nenhum carrinho para recuperar
          </button>
        </div>
      </div>
    </div>
  );
}
