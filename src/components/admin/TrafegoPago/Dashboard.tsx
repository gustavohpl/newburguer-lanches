import React, { useState } from 'react';
import { DollarSign, TrendingUp, Target, Megaphone, Plus, Tag, LayoutDashboard, Gift, ShoppingBag } from 'lucide-react';
import { useTrafegoPago } from '../../../hooks/useTrafegoPago';
import { MetricCard } from './MetricCard';
import { CampanhasList } from './CampanhasList';
import { PerformanceChart } from './PerformanceChart';
import { CreateCampaignModal } from './CreateCampaignModal';
import { CreateCouponAdModal } from './CreateCouponAdModal';
import { CreateProductAdModal } from './CreateProductAdModal';
import { CouponAdsDashboard } from './CouponAdsDashboard';
import { ProductAdsDashboard } from './ProductAdsDashboard';
import { toast } from 'sonner@2.0.3';

export function Dashboard() {
  const { campanhas, metricas, loading, carregarDados } = useTrafegoPago();
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [showCreateCouponAd, setShowCreateCouponAd] = useState(false);
  const [showCreateProductAd, setShowCreateProductAd] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'coupons' | 'products'>('general');

  // Calculate aggregates
  const totalInvestido = metricas.reduce((sum, m) => sum + m.spend, 0);
  const totalReceita = metricas.reduce((sum, m) => sum + m.revenue, 0);
  const roasGeral = totalInvestido > 0 ? totalReceita / totalInvestido : 0;

  const handleCouponAdSuccess = (campaignData: any) => {
    toast.success(`Campanha de cupom criada com sucesso!`, {
      description: `O anúncio está em análise e começará em breve.`
    });
    console.log('Coupon Campaign Data:', campaignData);
    carregarDados();
    setActiveTab('coupons'); 
  };

  const handleProductAdSuccess = (campaignData: any) => {
    toast.success(`Impulsionamento de produto iniciado!`, {
      description: `O anúncio do ${campaignData.product.name} está sendo preparado.`
    });
    console.log('Product Campaign Data:', campaignData);
    carregarDados();
    setActiveTab('products');
  };

  return (
    <div className="space-y-8">
      
      {/* Header & Tabs */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto max-w-full">
          <button 
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'general' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LayoutDashboard size={18} />
            Visão Geral
          </button>
          <button 
            onClick={() => setActiveTab('coupons')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'coupons' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Gift size={18} />
            Anúncios de Cupom
          </button>
          <button 
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'products' ? 'bg-white shadow-sm text-red-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ShoppingBag size={18} />
            Produtos Impulsionados
          </button>
        </div>

        <div className="flex gap-2 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0">
          <button 
            onClick={() => setShowCreateProductAd(true)}
            className="flex-1 xl:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg font-bold hover:bg-red-100 transition-colors shadow-sm whitespace-nowrap"
          >
            <ShoppingBag size={18} />
            Impulsionar Produto
          </button>

          <button 
            onClick={() => setShowCreateCouponAd(true)}
            className="flex-1 xl:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg font-bold hover:bg-orange-100 transition-colors shadow-sm whitespace-nowrap"
          >
            <Gift size={18} />
            Anunciar Cupom
          </button>
          
          {activeTab === 'general' && (
            <button 
              onClick={() => setShowCreateCampaign(true)}
              className="flex-1 xl:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus size={18} />
              Nova Campanha
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {activeTab === 'general' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard 
              title="Investimento (7 dias)"
              value={`R$ ${totalInvestido.toFixed(2)}`}
              icon={<DollarSign size={20} />}
              trend={totalInvestido > 0 ? undefined : "0%"}
              trendUp={false}
            />
            <MetricCard 
              title="Receita Gerada"
              value={`R$ ${totalReceita.toFixed(2)}`}
              icon={<TrendingUp size={20} />}
              trend={totalReceita > 0 ? undefined : "0%"}
              trendUp={true}
            />
            <MetricCard 
              title="ROAS Geral"
              value={`${roasGeral.toFixed(2)}x`}
              icon={<Target size={20} />}
              trend={roasGeral > 0 ? undefined : "0.0x"}
              trendUp={true}
            />
            <MetricCard 
              title="Campanhas Ativas"
              value={campanhas.filter(c => c.status === 'ACTIVE').length.toString()}
              icon={<Megaphone size={20} />}
            />
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-6">Performance Financeira</h3>
            <PerformanceChart data={metricas} />
          </div>

          <div>
            <h3 className="font-bold text-gray-800 mb-4 text-lg">Minhas Campanhas</h3>
            <CampanhasList 
              campanhas={campanhas} 
              loading={loading} 
              onRefresh={carregarDados}
            />
          </div>
        </div>
      )}

      {activeTab === 'coupons' && <CouponAdsDashboard />}
      
      {activeTab === 'products' && <ProductAdsDashboard />}

      {/* Modals */}
      <CreateCampaignModal 
        isOpen={showCreateCampaign} 
        onClose={() => setShowCreateCampaign(false)}
        onSuccess={carregarDados}
      />
      
      <CreateCouponAdModal 
        isOpen={showCreateCouponAd} 
        onClose={() => setShowCreateCouponAd(false)}
        onSuccess={handleCouponAdSuccess}
      />

      <CreateProductAdModal 
        isOpen={showCreateProductAd} 
        onClose={() => setShowCreateProductAd(false)}
        onSuccess={handleProductAdSuccess}
      />

    </div>
  );
}