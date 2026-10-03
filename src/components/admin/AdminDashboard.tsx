import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  Users, 
  LogOut,
  Settings as SettingsIcon,
  Megaphone,
  Truck,
  Warehouse,
  Building2
} from 'lucide-react';
import { useConfig } from '../../ConfigContext';
import { BarraCelular } from '../BarraCelular';
import { useFranchise } from '../../FranchiseContext';
import defaultLogo from 'figma:asset/2217307d23df7779a3757aa35c01d81549336b8b.png';
import { DashboardHome } from './DashboardHome';
import { ProductsManagement } from './ProductsManagement';
import { OrderManager } from './OrderManager';
import { CustomerList } from './CustomerList';
import { Settings } from './Settings';
import { AnunciosMeta } from './AnunciosMeta';
import { DeliveryArea } from './DeliveryArea';
import { StockManager } from './StockManager';

interface AdminDashboardProps {
  onLogout: () => void;
  onProductsChange?: () => void;
}

type MenuOption = 'dashboard' | 'products' | 'orders' | 'delivery' | 'customers' | 'settings' | 'ads' | 'stock';

export function AdminDashboard({ onLogout, onProductsChange }: AdminDashboardProps) {
  const { config } = useConfig();
  const { franchiseEnabled, selectedCity, selectedUnit, resetSelection } = useFranchise();
  const themeColor = config.themeColor || '#d97706';
  const logoUrl = config.logoUrl || defaultLogo;
  const siteName = config.siteName || 'NewBurguer Lanches';
  
  const [currentMenu, setCurrentMenu] = useState<MenuOption>('dashboard');
  
  const handleProductsChange = () => {
    // Notificar o App.tsx que produtos mudaram (atualiza homepage)
    if (onProductsChange) {
      onProductsChange();
    }
    // NÃO usar refreshKey/key para forçar remount — isso destruía o estado do 
    // CategoryManager (color picker, emoji picker) e causava loop de re-fetch
  };

  const menuItems = [
    { id: 'dashboard' as MenuOption, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products' as MenuOption, label: 'Produtos', icon: Package },
    { id: 'orders' as MenuOption, label: 'Pedidos', icon: ShoppingBag },
    ...(config.features?.stockControl ? [{ id: 'stock' as MenuOption, label: 'Estoque', icon: Warehouse }] : []),
    ...(config.features?.paidTraffic !== false ? [{ id: 'ads' as MenuOption, label: 'Meta Ads', icon: Megaphone }] : []),
    ...(config.features?.deliverySystem !== false ? [{ id: 'delivery' as MenuOption, label: 'Área de Entrega', icon: Truck }] : []),
    { id: 'customers' as MenuOption, label: 'Clientes', icon: Users },
    { id: 'settings' as MenuOption, label: 'Configurações', icon: SettingsIcon },
  ];

  const handleLogout = () => {
    if (confirm('Tem certeza que deseja sair?')) {
      if (franchiseEnabled) resetSelection();
      onLogout();
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar Desktop */}
      <aside 
        className="hidden md:flex md:flex-col w-64 text-white transition-colors duration-300"
        style={{ background: `linear-gradient(to bottom, ${themeColor}, #000)` }}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img 
              src={logoUrl} 
              alt={siteName}
              className="h-12 w-12 rounded-full bg-white p-1 shadow-lg object-contain"
            />
            <div>
              <h2 className="font-bold text-lg leading-tight">{siteName}</h2>
              {franchiseEnabled && selectedUnit ? (
                <p className="text-xs text-white/70">{selectedUnit.name}</p>
              ) : (
                <p className="text-xs text-white/70">Painel Admin</p>
              )}
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-4 space-y-2">
          {/* Franchise indicator */}
          {franchiseEnabled && selectedUnit && (
            <div className="mb-3 p-3 rounded-lg bg-white/10 border border-white/10">
              <div className="flex items-center gap-2 mb-1.5">
                <Building2 className="w-4 h-4 text-white/70" />
                <span className="text-xs font-bold text-white/90 uppercase tracking-wide">Franquia</span>
              </div>
              <p className="text-sm font-bold text-white leading-tight">{selectedUnit.name}</p>
              <p className="text-[10px] text-white/50">{selectedCity?.name}</p>
            </div>
          )}
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = currentMenu === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentMenu(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-white text-black shadow-lg font-bold'
                    : 'text-white hover:bg-white/10'
                }`}
                style={isActive ? { color: themeColor } : {}}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white hover:bg-red-600/80 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div 
        className="md:hidden fixed top-0 left-0 right-0 text-white p-4 z-30 shadow-lg"
        style={{ background: `linear-gradient(to right, ${themeColor}, #000)` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={logoUrl} 
              alt={siteName} 
              className="h-10 w-10 rounded-full bg-white p-1 object-contain"
            />
            <div>
              <h2 className="font-bold">{siteName}</h2>
              {franchiseEnabled && selectedUnit ? (
                <p className="text-xs text-white/70">
                  {selectedUnit.name} • {selectedCity?.name}
                </p>
              ) : (
                <p className="text-xs text-white/70">Admin</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="painel flex-1 overflow-y-auto md:pt-0 pt-20 pb-24 md:pb-0 min-w-0">
        <div className="p-4 md:p-6">
          {currentMenu === 'dashboard' && <DashboardHome />}
          {currentMenu === 'products' && <ProductsManagement onProductsChange={handleProductsChange} />}
          {currentMenu === 'orders' && <OrderManager />}
          {currentMenu === 'ads' && config.features?.paidTraffic !== false && <AnunciosMeta />}
          {currentMenu === 'delivery' && config.features?.deliverySystem !== false && <DeliveryArea />}
          {currentMenu === 'stock' && config.features?.stockControl && <StockManager />}
          {currentMenu === 'customers' && <CustomerList />}
          {currentMenu === 'settings' && <Settings />}
        </div>
      </main>

      <BarraCelular
        itens={['orders', 'products', 'delivery', 'dashboard', 'stock', 'ads', 'customers', 'settings'].map((id) => menuItems.find((m) => m.id === id)).filter(Boolean).map((m) => ({ ...m!, label: m!.id === 'delivery' ? 'Entregas' : m!.id === 'dashboard' ? 'Painel' : m!.id === 'settings' ? 'Ajustes' : m!.label }))}
        ativo={currentMenu}
        aoEscolher={(id) => { setCurrentMenu(id as MenuOption); window.scrollTo(0, 0); }}
        cor={themeColor}
        extras={<button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" />Sair</button>}
      />
    </div>
  );
}
