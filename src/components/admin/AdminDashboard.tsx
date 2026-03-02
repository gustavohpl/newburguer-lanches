import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  Users, 
  LogOut,
  Menu,
  X,
  Settings as SettingsIcon,
  Megaphone,
  Truck,
  Warehouse,
  Building2,
  Lock,
  ArrowLeftRight
} from 'lucide-react';
import { useConfig } from '../../ConfigContext';
import { useFranchise } from '../../FranchiseContext';
import { FranchiseSelectionModal } from '../FranchiseSelectionModal';
import defaultLogo from 'figma:asset/2217307d23df7779a3757aa35c01d81549336b8b.png';
import { DashboardHome } from './DashboardHome';
import { ProductsManagement } from './ProductsManagement';
import { OrderManager } from './OrderManager';
import { CustomerList } from './CustomerList';
import { Settings } from './Settings';
import { Dashboard as TrafegoPagoDashboard } from './TrafegoPago/Dashboard';
import { DeliveryArea } from './DeliveryArea';
import { StockManager } from './StockManager';

interface AdminDashboardProps {
  onLogout: () => void;
  onProductsChange?: () => void;
}

type MenuOption = 'dashboard' | 'products' | 'orders' | 'delivery' | 'customers' | 'settings' | 'ads' | 'stock';

export function AdminDashboard({ onLogout, onProductsChange }: AdminDashboardProps) {
  const { config } = useConfig();
  const { franchiseEnabled, selectedCity, selectedUnit, needsSelection, resetSelection } = useFranchise();
  const themeColor = config.themeColor || '#d97706';
  const logoUrl = config.logoUrl || defaultLogo;
  const siteName = config.siteName || 'NewBurguer Lanches';
  
  const [currentMenu, setCurrentMenu] = useState<MenuOption>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Franchise switch modal
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switchPassword, setSwitchPassword] = useState('');
  const [switchError, setSwitchError] = useState('');

  const handleSwitchFranchise = () => {
    const requiredPassword = config.franchise?.switchPassword;
    if (!requiredPassword) {
      // Se não há senha configurada, trocar direto
      resetSelection();
      setShowSwitchModal(false);
      setSwitchPassword('');
      return;
    }
    if (switchPassword === requiredPassword) {
      resetSelection();
      setShowSwitchModal(false);
      setSwitchPassword('');
      setSwitchError('');
    } else {
      setSwitchError('Senha incorreta');
    }
  };

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
              <button
                onClick={() => { setShowSwitchModal(true); setSwitchError(''); setSwitchPassword(''); }}
                className="mt-2 w-full flex items-center justify-center gap-1.5 text-[11px] font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/15 rounded-md py-1.5 transition-colors"
              >
                <ArrowLeftRight className="w-3 h-3" />
                Trocar Franquia
              </button>
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
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="mt-4 space-y-2 pb-2">
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = currentMenu === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentMenu(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-white text-black shadow-lg'
                      : 'text-white hover:bg-white/10'
                  }`}
                  style={isActive ? { color: themeColor } : {}}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
            {franchiseEnabled && selectedUnit && (
              <button
                onClick={() => { setShowSwitchModal(true); setSwitchError(''); setSwitchPassword(''); setIsMobileMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white hover:bg-white/10 transition-colors"
              >
                <ArrowLeftRight className="w-5 h-5" />
                <span className="font-medium">Trocar Franquia</span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white hover:bg-red-600/80 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sair</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto md:pt-0 pt-20">
        <div className="p-6">
          {currentMenu === 'dashboard' && <DashboardHome />}
          {currentMenu === 'products' && <ProductsManagement onProductsChange={handleProductsChange} />}
          {currentMenu === 'orders' && <OrderManager />}
          {currentMenu === 'ads' && config.features?.paidTraffic !== false && <TrafegoPagoDashboard />}
          {currentMenu === 'delivery' && config.features?.deliverySystem !== false && <DeliveryArea />}
          {currentMenu === 'stock' && config.features?.stockControl && <StockManager />}
          {currentMenu === 'customers' && <CustomerList />}
          {currentMenu === 'settings' && <Settings />}
        </div>
      </main>

      {/* 🏙️ Franchise Selection Modal (shows when no city/unit selected) */}
      <FranchiseSelectionModal />

      {/* 🔒 Password Modal for switching franchise */}
      {showSwitchModal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 text-center" style={{ backgroundColor: themeColor }}>
              <Lock className="w-8 h-8 text-white mx-auto mb-2" />
              <h3 className="text-lg font-bold text-white">Trocar de Franquia</h3>
              <p className="text-white/70 text-xs mt-1">
                {selectedUnit?.name} • {selectedCity?.name}
              </p>
            </div>
            <div className="p-5">
              {config.franchise?.switchPassword ? (
                <>
                  <p className="text-sm text-gray-600 mb-3">Digite a senha para alternar entre franquias:</p>
                  <input
                    type="password"
                    value={switchPassword}
                    onChange={(e) => { setSwitchPassword(e.target.value); setSwitchError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSwitchFranchise(); }}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    placeholder="Senha de troca"
                    autoFocus
                  />
                  {switchError && (
                    <p className="text-red-500 text-xs mt-2 font-medium">{switchError}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-600">Confirma que deseja trocar de franquia?</p>
              )}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => { setShowSwitchModal(false); setSwitchPassword(''); setSwitchError(''); }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 rounded-lg font-bold text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSwitchFranchise}
                  className="flex-1 text-white py-2.5 rounded-lg font-bold text-sm"
                  style={{ backgroundColor: themeColor }}
                >
                  Trocar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}