import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, ShoppingBag, DollarSign, Target, 
  MoreHorizontal, Pause, Play, Eye, MousePointer,
  ArrowUpRight, ArrowDownRight, Award, Megaphone, Loader2
} from 'lucide-react';
import { useTrafegoPago, Campaign } from '../../../hooks/useTrafegoPago';
import { ImageWithFallback } from '../../figma/ImageWithFallback';

interface ProductAd {
  id: string;
  productName: string;
  status: 'active' | 'paused';
  dailyBudget: number;
  spent: number;
  revenue: number;
  roas: number;
  orders: number;
  clicks: number;
  ctr: number;
  image: string;
}

export function ProductAdsDashboard() {
  const { campanhas, loading } = useTrafegoPago();
  const [ads, setAds] = useState<ProductAd[]>([]);

  useEffect(() => {
    // Filter only product campaigns and map to view model
    const productCampaigns = campanhas.filter(c => c.objective === 'PRODUCT_SALES' || c.name.startsWith('Produto:'));
    
    if (productCampaigns.length > 0) {
      const mappedAds: ProductAd[] = productCampaigns.map(c => ({
        id: c.id,
        productName: c.name.replace('Produto: ', ''),
        status: c.status === 'ACTIVE' ? 'active' : 'paused',
        dailyBudget: c.daily_budget,
        spent: c.spend,
        revenue: c.revenue,
        roas: c.spend > 0 ? Number((c.revenue / c.spend).toFixed(2)) : 0,
        orders: c.purchases,
        clicks: c.clicks,
        ctr: c.impressions > 0 ? Number(((c.clicks / c.impressions) * 100).toFixed(2)) : 0,
        image: 'https://placehold.co/100x100?text=Prod' // TODO: Get image from campaign metadata if available
      }));
      setAds(mappedAds);
    } else {
      setAds([]);
    }
  }, [campanhas]);

  const topPerformer = ads.length > 0 
    ? ads.reduce((prev, current) => (prev.revenue > current.revenue) ? prev : current)
    : null;

  if (loading) {
     return (
       <div className="flex justify-center items-center py-12">
         <Loader2 className="w-8 h-8 animate-spin text-red-500" />
       </div>
     );
  }

  if (ads.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Megaphone className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Nenhum produto impulsionado</h3>
        <p className="text-gray-500 max-w-md mx-auto mt-2 mb-6">
          Comece a impulsionar seus produtos mais vendidos para atrair novos clientes.
        </p>
        <button className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-200">
          Impulsionar Agora
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Hero Stats */}
      {topPerformer && (
        <div className="bg-gradient-to-r from-red-600 to-red-800 rounded-2xl p-8 text-white relative overflow-hidden shadow-lg">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Seus Produtos Campeões</h2>
              <p className="text-red-100 max-w-lg">
                Estes são os itens do seu cardápio que mais atraem clientes novos quando anunciados.
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 min-w-[250px] border border-white/20">
              <div className="flex items-center gap-3 mb-3">
                <Award className="w-8 h-8 text-yellow-400" />
                <div>
                  <div className="text-xs text-red-100 uppercase font-bold tracking-wider">Top Performance</div>
                  <div className="font-bold">{topPerformer.productName}</div>
                </div>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-2xl font-bold">R$ {topPerformer.revenue.toFixed(2)}</div>
                  <div className="text-xs text-red-200">em vendas diretas</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-green-300">{topPerformer.roas}x</div>
                  <div className="text-xs text-red-200">ROAS</div>
                </div>
              </div>
            </div>
          </div>

          {/* Background decorative elements */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-red-500 rounded-full opacity-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-black rounded-full opacity-20 blur-3xl"></div>
        </div>
      )}

      {/* Ads List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ads.map((ad) => (
          <div key={ad.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-4 flex items-start justify-between border-b border-gray-50">
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                  <ImageWithFallback src={ad.image} alt={ad.productName} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 line-clamp-1">{ad.productName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                      ad.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {ad.status === 'active' ? <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> : null}
                      {ad.status === 'active' ? 'Rodando' : 'Pausado'}
                    </span>
                    <span className="text-xs text-gray-500">R$ {ad.dailyBudget}/dia</span>
                  </div>
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Gasto
                </div>
                <div className="font-semibold text-gray-900">R$ {ad.spent.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Receita
                </div>
                <div className="font-semibold text-gray-900">R$ {ad.revenue.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <ShoppingBag className="w-3 h-3" /> Pedidos
                </div>
                <div className="font-semibold text-gray-900">{ad.orders}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <Target className="w-3 h-3" /> ROAS
                </div>
                <div className={`font-bold ${ad.roas >= 5 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {ad.roas}x
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-3 flex justify-between items-center text-xs text-gray-500 border-t border-gray-100">
               <div className="flex gap-3">
                 <span className="flex items-center gap-1"><MousePointer className="w-3 h-3" /> {ad.clicks} cliques</span>
                 <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {ad.ctr}% CTR</span>
               </div>
               {ad.status === 'active' ? (
                 <button className="text-red-600 font-medium hover:underline flex items-center gap-1">
                   <Pause className="w-3 h-3" /> Pausar
                 </button>
               ) : (
                  <button className="text-green-600 font-medium hover:underline flex items-center gap-1">
                   <Play className="w-3 h-3" /> Retomar
                 </button>
               )}
            </div>
          </div>
        ))}

        {/* Add New Card */}
        <button className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center p-6 text-gray-400 hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition-all group min-h-[200px]">
          <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-red-100 flex items-center justify-center mb-3 transition-colors">
            <TrendingUp className="w-6 h-6" />
          </div>
          <span className="font-bold">Impulsionar Novo Produto</span>
          <span className="text-xs text-center mt-2 max-w-[200px]">Escolha outro item do cardápio para vender mais</span>
        </button>
      </div>

    </div>
  );
}
