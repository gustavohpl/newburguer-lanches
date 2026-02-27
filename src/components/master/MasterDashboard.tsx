import React, { useState, useEffect } from 'react';
import { hexToRgba } from '../../utils/colorUtils';
import { 
  Palette, 
  Settings, 
  Key, 
  Globe, 
  Save, 
  LogOut, 
  CreditCard, 
  Smartphone,
  Facebook,
  RefreshCw,
  Eye,
  EyeOff,
  LayoutTemplate,
  Image as ImageIcon,
  Upload,
  Star,
  Heart,
  Sparkles,
  Zap,
  Snowflake,
  Flame,
  Music,
  Sun,
  Moon,
  Circle,
  Cloud,
  Package,
  Megaphone,
  Truck,
  Plus,
  Trash2,
  Edit2,
  FlaskConical,
  ShieldAlert,
  BarChart3
} from 'lucide-react';
import * as api from '../../utils/api';
import { masterFetch } from '../../utils/api';
import { useConfig } from '../../ConfigContext';
import { TestRunner } from '../admin/TestRunner';
import { E2ETestRunner } from '../admin/E2ETestRunner';
import { AuditLogs } from '../admin/AuditLogs';
import { SecurityDashboard } from '../admin/SecurityDashboard';

import { applyTheme } from '../../utils/themeUtils';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { warmupWebRTCDetection } from '../../utils/webrtc-leak';

interface DeliverySector {
  id: string;
  name: string;
  color: string;
}

// Componente auxiliar para Input de Imagem com Preview e Upload
function ImageConfig({ label, value, onChange, placeholder, helpText, token }: any) {
  const [showInput, setShowInput] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!token) {
      alert('Sessão expirada. Faça login novamente.');
      return;
    }

    setUploading(true);
    try {
      const response = await api.uploadMasterImage(token, file);
      
      if (response.success && response.url) {
        // Forçar atualização da imagem adicionando timestamp para evitar cache do navegador
        const urlWithCacheBust = `${response.url}?t=${Date.now()}`;
        onChange(response.url); // Salva a URL original
        // Mas podemos usar a urlWithCacheBust para preview se quisermos, 
        // mas aqui estamos passando para o parent component, que renderiza.
      } else {
        alert('Erro ao enviar imagem: ' + (response.error || 'Erro desconhecido no servidor'));
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro ao enviar imagem.');
    } finally {
      setUploading(false);
      // Limpar input para permitir re-selecionar o mesmo arquivo se necessário
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  return (
    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
      <div className="flex justify-between items-start mb-3">
        <label className="block text-sm font-bold text-gray-700">{label}</label>
        <button
          onClick={() => setShowInput(!showInput)}
          className="text-xs bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-50 text-gray-600 flex items-center gap-1"
        >
          {showInput ? 'Ocultar URL' : 'Editar URL Manualmente'}
        </button>
      </div>
      
      {/* Preview Area */}
      <div className="mb-4 flex items-center gap-4">
        <div className="relative w-24 h-24 bg-zinc-800 rounded-lg overflow-hidden border border-gray-600 flex items-center justify-center shrink-0">
          {uploading ? (
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          ) : value ? (
            <img src={value} alt="Preview" className="w-full h-full object-contain" />
          ) : (
            <ImageIcon className="w-8 h-8 text-gray-400" />
          )}
        </div>
        <div className="flex-1">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors mb-2"
          >
            {uploading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Carregar Arquivo
              </>
            )}
          </button>
          
          <p className="text-xs text-gray-500">{helpText}</p>
        </div>
      </div>

      {/* Input de URL (Opcional/Fallback) */}
      {showInput && (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none animate-in fade-in slide-in-from-top-2"
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

export function MasterDashboard() {
  const { refreshConfig, updateConfigLocal } = useConfig();
  // Alterado para sessionStorage para exigir login sempre que fechar o navegador
  const [token, setToken] = useState<string | null>(sessionStorage.getItem('faroeste_master_token'));
  const [verifying, setVerifying] = useState(!!sessionStorage.getItem('faroeste_master_token'));
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'integrations' | 'features' | 'admin' | 'delivery' | 'tests' | 'audit' | 'security' | 'analytics'>('general');
  
  // Login State
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // Config State
  const [config, setConfig] = useState<any>({});
  const [hasAdminPassword, setHasAdminPassword] = useState(false);
  
  // Admin Password Reset
  const [newAdminPass, setNewAdminPass] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);
  
  // Emoji Picker State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Delivery Sectors State
  const [sectors, setSectors] = useState<DeliverySector[]>([]);
  const [isLoadingSectors, setIsLoadingSectors] = useState(false);
  const [newSectorName, setNewSectorName] = useState('');
  const [editingSector, setEditingSector] = useState<DeliverySector | null>(null);
  
  // Estado para descobrir IP do servidor
  const [isDiscoveringIP, setIsDiscoveringIP] = useState(false);
  const [showAdvancedColors, setShowAdvancedColors] = useState(false);

  useEffect(() => {
    if (token) {
      loadConfig();
    } else {
      setVerifying(false);
      // Pre-aquecer deteccao WebRTC enquanto o usuario ve o formulario de login
      warmupWebRTCDetection();
    }
  }, [token]);

  // Load sectors when tab is delivery
  useEffect(() => {
    if (activeTab === 'delivery' && token) {
      loadSectors();
    }
  }, [activeTab, token]);

  const loadSectors = async () => {
    try {
      setIsLoadingSectors(true);
      const response = await api.getDeliverySectors();
      if (response.success && response.sectors) {
        setSectors(response.sectors);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar setores:', error);
    } finally {
      setIsLoadingSectors(false);
    }
  };

  const handleAddSector = async () => {
    if (!newSectorName.trim()) {
      alert('⚠️ Digite o nome do setor');
      return;
    }

    // Auto-assign random color since user can't pick
    const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#F97316', '#14B8A6'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    try {
      const response = await api.addDeliverySector({ name: newSectorName, color: randomColor }, token || undefined);
      if (response.success) {
        alert('✅ Setor adicionado com sucesso!');
        setNewSectorName('');
        await loadSectors();
      } else {
        alert('❌ Erro ao adicionar setor: ' + (response.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('❌ Erro ao adicionar setor:', error);
      alert('❌ Erro ao adicionar setor');
    }
  };

  const handleSaveEditSector = async () => {
    if (!editingSector) return;

    try {
      const response = await api.updateDeliverySector(editingSector, token || undefined);
      if (response.success) {
        alert('✅ Setor atualizado com sucesso!');
        setEditingSector(null);
        await loadSectors();
      } else {
        alert('❌ Erro ao atualizar setor: ' + (response.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar setor:', error);
      alert('❌ Erro ao atualizar setor');
    }
  };

  const handleDeleteSector = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja deletar o setor "${name}"?`)) return;

    try {
      const response = await api.deleteDeliverySector(id, token || undefined);
      if (response.success) {
        alert('✅ Setor deletado com sucesso!');
        await loadSectors();
      } else {
        alert('❌ Erro ao deletar setor: ' + (response.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('❌ Erro ao deletar setor:', error);
      alert('❌ Erro ao deletar setor');
    }
  };

  // Fechar emoji picker ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showEmojiPicker && !target.closest('.emoji-picker-container')) {
        setShowEmojiPicker(false);
      }
    };
    
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const loadConfig = async () => {
    if (!token) return;
    setLoading(true); // Loading interno do dashboard
    
    // Validar token buscando configs
    const response = await api.getMasterConfig(token);
    
    if (response.success) {
      setConfig(response.config);
      setHasAdminPassword(response.config.hasAdminPassword);
    } else {
      // Token inválido ou expirado
      setToken(null);
      sessionStorage.removeItem('faroeste_master_token');
    }
    setLoading(false);
    setVerifying(false); // Fim da verificação inicial
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    const response = await api.masterLogin({ username: loginUser, password: loginPass });
    
    if (response.success) {
      const newToken = response.token;
      setToken(newToken);
      sessionStorage.setItem('faroeste_master_token', newToken);
      // O useEffect vai disparar loadConfig automaticamente
    } else {
      setLoginError(response.error || 'Credenciais inválidas');
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!token) return;
    setLoading(true);
    
    // 🐛 DEBUG: Log do config atual antes de salvar
    console.log('🔍 [MASTER DASHBOARD] Config antes de salvar:', config);
    console.log('🔍 [MASTER DASHBOARD] Novo admin pass?', !!newAdminPass);
    console.log('🔍 [MASTER DASHBOARD] Config keys:', config ? Object.keys(config) : 'undefined');
    
    // Validar se config existe
    if (!config || Object.keys(config).length === 0) {
      console.error('❌ [MASTER DASHBOARD] Config vazio! Não é possível salvar.');
      alert('❌ Erro: Configuração vazia. Tente recarregar a página.');
      setLoading(false);
      return;
    }
    
    // ✅ CORREÇÃO: Enviar apenas o config + adminPassword se houver
    // A função saveMasterConfig já faz o wrap { config: {...}, adminPassword: ... }
    console.log('📤 [MASTER DASHBOARD] Enviando config para API...');

    const response = await api.saveMasterConfig(token, {
      ...config,
      ...(newAdminPass ? { adminPassword: newAdminPass } : {})
    });
    
    if (response.success) {
      alert('✅ Configurações salvas com sucesso!');
      if (newAdminPass) {
        setNewAdminPass('');
        setHasAdminPassword(true);
      }
      refreshConfig(); // Atualiza o site em tempo real
    } else {
      alert('❌ Erro ao salvar: ' + response.error);
    }
    setLoading(false);
  };

  const handleColorChange = (color: string) => {
    setConfig({ ...config, themeColor: color });
    applyTheme(color); // Preview em tempo real
    updateConfigLocal({ themeColor: color });
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-white">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
        <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-900/50">
              <Settings className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Painel do Criador</h1>
            <p className="text-gray-400 text-sm mt-2">Acesso Restrito - Master Admin</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="master-username" className="block text-sm font-medium text-gray-400 mb-2">
                Usuário Master
              </label>
              <input
                id="master-username"
                name="username"
                type="text"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="Usuário"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label htmlFor="master-password" className="block text-sm font-medium text-gray-400 mb-2">
                Senha Master
              </label>
              <input
                id="master-password"
                name="password"
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            {loginError && (
              <div className="bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded-lg text-sm">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-900/50 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Acessando...' : 'Entrar no Painel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white hidden md:flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Master</h1>
              <p className="text-xs text-gray-500">Painel do Criador</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem 
            active={activeTab === 'general'} 
            onClick={() => setActiveTab('general')}
            icon={LayoutTemplate} 
            label="Geral" 
          />
          <SidebarItem 
            active={activeTab === 'appearance'} 
            onClick={() => setActiveTab('appearance')}
            icon={Palette} 
            label="Aparência & Cores" 
          />
          <SidebarItem 
            active={activeTab === 'integrations'} 
            onClick={() => setActiveTab('integrations')}
            icon={Globe} 
            label="Integrações & APIs" 
          />
          <SidebarItem 
            active={activeTab === 'features'} 
            onClick={() => setActiveTab('features')}
            icon={Zap} 
            label="Funcionalidades (SaaS)" 
          />
          <SidebarItem 
            active={activeTab === 'delivery'} 
            onClick={() => setActiveTab('delivery')}
            icon={Truck} 
            label="Setores de Entrega" 
          />
          <SidebarItem 
            active={activeTab === 'admin'} 
            onClick={() => setActiveTab('admin')}
            icon={Key} 
            label="Acesso Admin" 
          />
          <SidebarItem 
            active={activeTab === 'tests'} 
            onClick={() => setActiveTab('tests')}
            icon={FlaskConical} 
            label="Testes" 
          />
          <SidebarItem 
            active={activeTab === 'audit'} 
            onClick={() => setActiveTab('audit')}
            icon={ShieldAlert} 
            label="Logs de Auditoria" 
          />
          <SidebarItem 
            active={activeTab === 'analytics'} 
            onClick={() => setActiveTab('analytics')}
            icon={BarChart3} 
            label="Analytics" 
          />

        </nav>

        <div className="p-4 border-t border-gray-800">
          <button 
            onClick={() => {
              setToken(null);
              sessionStorage.removeItem('faroeste_master_token');
            }}
            className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors w-full px-4 py-2"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white shadow-sm p-6 flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-2xl font-bold text-gray-800">
            {activeTab === 'general' && 'Configurações Gerais'}
            {activeTab === 'appearance' && 'Identidade Visual'}
            {activeTab === 'integrations' && 'Integrações Externas'}
            {activeTab === 'features' && 'Gerenciar Funcionalidades'}
            {activeTab === 'delivery' && 'Gerenciar Setores de Entrega'}
            {activeTab === 'admin' && 'Gerenciar Admin'}
            {activeTab === 'tests' && 'Testes Automatizados'}
            {activeTab === 'audit' && 'Logs de Auditoria'}
            {activeTab === 'analytics' && 'Security Analytics'}
          </h2>
          {activeTab !== 'tests' && activeTab !== 'audit' && activeTab !== 'analytics' && (
            <button
              onClick={handleSave}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Salvar Alterações
            </button>
          )}
        </header>

        <div className={`p-8 mx-auto ${activeTab === 'audit' || activeTab === 'analytics' || activeTab === 'tests' ? 'max-w-6xl' : 'max-w-4xl'}`}>
          {/* TAB: GERAL */}
          {activeTab === 'general' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <LayoutTemplate className="w-5 h-5 text-blue-600" />
                  Dados do Estabelecimento
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Site / Restaurante</label>
                    <input
                      type="text"
                      value={config.siteName || ''}
                      onChange={(e) => setConfig({ ...config, siteName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="Ex: Pizzaria do Zé"
                    />
                    <p className="text-xs text-gray-500 mt-1">Aparece no título da página e no cabeçalho.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo / Slogan</label>
                    <input
                      type="text"
                      value={config.siteSubtitle || ''}
                      onChange={(e) => setConfig({ ...config, siteSubtitle: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="Ex: Os melhores lanches da região!"
                    />
                    <p className="text-xs text-gray-500 mt-1">Aparece abaixo da mensagem de boas-vindas.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Emoji de Boas-vindas</label>
                    <div className="relative emoji-picker-container">
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
                      >
                        <span className="text-3xl">{config.siteEmoji || '🍔'}</span>
                        <span className="text-sm text-gray-500">Clique para escolher</span>
                      </button>
                      
                      {showEmojiPicker && (
                        <div className="absolute z-50 mt-2 w-full bg-white rounded-lg shadow-2xl border-2 border-blue-500 p-4 max-h-96 overflow-y-auto">
                          <div className="flex justify-between items-center mb-3 sticky top-0 bg-white pb-2 border-b">
                            <h4 className="text-sm font-bold text-gray-700">Escolha um Emoji</h4>
                            <button
                              onClick={() => setShowEmojiPicker(false)}
                              className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                            >
                              ×
                            </button>
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-2">🍔 Fast Food</p>
                              <div className="grid grid-cols-7 gap-1">
                                {['🍔', '🍕', '🌭', '🍟', '🥪', '🌮', '🌯', '🥙', '🍗', '🥓', '🍖', '🥩', '🍤', '🍱'].map(e => (
                                  <button key={e} onClick={() => { setConfig({ ...config, siteEmoji: e }); setShowEmojiPicker(false); }} className="text-2xl hover:bg-blue-100 rounded p-1 transition">{e}</button>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-2">🥤 Bebidas</p>
                              <div className="grid grid-cols-7 gap-1">
                                {['🥤', '🧃', '🧋', '☕', '🍵', '🧉', '🍺', '🍻', '🍷', '🥂', '🍹', '🍸', '🥃', '🧊'].map(e => (
                                  <button key={e} onClick={() => { setConfig({ ...config, siteEmoji: e }); setShowEmojiPicker(false); }} className="text-2xl hover:bg-blue-100 rounded p-1 transition">{e}</button>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-2">🍰 Sobremesas</p>
                              <div className="grid grid-cols-7 gap-1">
                                {['🍰', '🎂', '🧁', '🍪', '🍩', '🍨', '🍧', '🍦', '🥧', '🍮', '🍭', '🍬', '🍫', '🍯'].map(e => (
                                  <button key={e} onClick={() => { setConfig({ ...config, siteEmoji: e }); setShowEmojiPicker(false); }} className="text-2xl hover:bg-blue-100 rounded p-1 transition">{e}</button>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-2">🍎 Frutas</p>
                              <div className="grid grid-cols-7 gap-1">
                                {['🍎', '🍏', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🥦', '🥒', '🌶️'].map(e => (
                                  <button key={e} onClick={() => { setConfig({ ...config, siteEmoji: e }); setShowEmojiPicker(false); }} className="text-2xl hover:bg-blue-100 rounded p-1 transition">{e}</button>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-2">🚚 Delivery</p>
                              <div className="grid grid-cols-7 gap-1">
                                {['🏪', '🏬', '🛒', '🛍️', '💳', '💰', '💵', '🚚', '🚛', '🏍️', '🛵', '🚴', '📦', '🎁'].map(e => (
                                  <button key={e} onClick={() => { setConfig({ ...config, siteEmoji: e }); setShowEmojiPicker(false); }} className="text-2xl hover:bg-blue-100 rounded p-1 transition">{e}</button>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-2">😊 Rostos</p>
                              <div className="grid grid-cols-7 gap-1">
                                {['😊', '😃', '😄', '😁', '🤗', '🤩', '😍', '🥰', '😋', '😎', '🤠', '👨‍🍳', '👩‍🍳', '🧑‍🍳', '🥳', '🎉', '👍', '👌', '✌️', '🙌', '👏'].map(e => (
                                  <button key={e} onClick={() => { setConfig({ ...config, siteEmoji: e }); setShowEmojiPicker(false); }} className="text-2xl hover:bg-blue-100 rounded p-1 transition">{e}</button>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-2">🐄 Animais</p>
                              <div className="grid grid-cols-7 gap-1">
                                {['🐄', '🐮', '🐷', '🐖', '🐔', '🐓', '🐣', '🦆', '🐟', '🐠', '🦐', '🦞', '🐙', '🐝', '🦋', '🐶', '🐱', '🦁', '🐯', '🐻', '🐨'].map(e => (
                                  <button key={e} onClick={() => { setConfig({ ...config, siteEmoji: e }); setShowEmojiPicker(false); }} className="text-2xl hover:bg-blue-100 rounded p-1 transition">{e}</button>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-2">✨ Símbolos</p>
                              <div className="grid grid-cols-7 gap-1">
                                {['⭐', '✨', '🌟', '💫', '🔥', '⚡', '💥', '✅', '❤️', '💚', '💛', '🧡', '💜', '💙', '🎯', '🎪', '🎨', '🎭', '🎬', '📱', '📞'].map(e => (
                                  <button key={e} onClick={() => { setConfig({ ...config, siteEmoji: e }); setShowEmojiPicker(false); }} className="text-2xl hover:bg-blue-100 rounded p-1 transition">{e}</button>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-2">🏁 Bandeiras</p>
                              <div className="grid grid-cols-7 gap-1">
                                {['🇧🇷', '🇺🇸', '🇬🇧', '🇪🇸', '🇫🇷', '🇮🇹', '🇩🇪', '🇵🇹', '🇦🇷', '🇲🇽', '🇯🇵', '🇨🇳', '🇰🇷', '🏁'].map(e => (
                                  <button key={e} onClick={() => { setConfig({ ...config, siteEmoji: e }); setShowEmojiPicker(false); }} className="text-2xl hover:bg-blue-100 rounded p-1 transition">{e}</button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Emoji que aparece ao lado do nome na mensagem inicial.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone Principal</label>
                    <input
                      type="text"
                      value={config.phone || ''}
                      onChange={(e) => setConfig({ ...config, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Endereço Completo</label>
                    <input
                      type="text"
                      value={config.address || ''}
                      onChange={(e) => setConfig({ ...config, address: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="Rua, Número, Bairro, Cidade"
                    />
                  </div>
                </div>
              </div>

              {/* REDES SOCIAIS */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  📱 Redes Sociais
                </h3>
                <p className="text-xs text-gray-500 mb-4">Cole o link completo do perfil. Aparecerá no header junto ao contato.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">📸 Instagram</label>
                    <input
                      type="text"
                      value={config.socialMedia?.instagram || ''}
                      onChange={(e) => setConfig({ ...config, socialMedia: { ...config.socialMedia, instagram: e.target.value } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                      placeholder="https://instagram.com/seuperfil"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">📘 Facebook</label>
                    <input
                      type="text"
                      value={config.socialMedia?.facebook || ''}
                      onChange={(e) => setConfig({ ...config, socialMedia: { ...config.socialMedia, facebook: e.target.value } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                      placeholder="https://facebook.com/suapagina"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">🎵 TikTok</label>
                    <input
                      type="text"
                      value={config.socialMedia?.tiktok || ''}
                      onChange={(e) => setConfig({ ...config, socialMedia: { ...config.socialMedia, tiktok: e.target.value } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                      placeholder="https://tiktok.com/@seuperfil"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">▶️ YouTube</label>
                    <input
                      type="text"
                      value={config.socialMedia?.youtube || ''}
                      onChange={(e) => setConfig({ ...config, socialMedia: { ...config.socialMedia, youtube: e.target.value } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                      placeholder="https://youtube.com/@seucanal"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">𝕏 Twitter / X</label>
                    <input
                      type="text"
                      value={config.socialMedia?.twitter || ''}
                      onChange={(e) => setConfig({ ...config, socialMedia: { ...config.socialMedia, twitter: e.target.value } })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                      placeholder="https://x.com/seuperfil"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: APARÊNCIA */}
          {activeTab === 'appearance' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Palette className="w-5 h-5 text-purple-600" />
                  Cores e Identidade
                </h3>
                
                {/* SELEÇÃO DE MODO (CLARO / ESCURO) */}
                <div className="mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
                  <label className="block text-sm font-bold text-gray-800 mb-4">Modo de Exibição (Tema)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => {
                        const updates = { 
                          backgroundColor: '#f9fafb', // Gray-50
                          cardColor: '#ffffff', // White
                          textColor: '#111827', // Gray-900
                          forceDarkMode: false // 🌓 Forçar Modo Claro
                        };
                        setConfig({ ...config, ...updates });
                        updateConfigLocal(updates);
                      }}
                      className={`flex items-center justify-center gap-3 p-4 border-2 rounded-xl transition-all group ${config.forceDarkMode === false ? 'border-blue-500 bg-white' : 'border-gray-200 hover:border-blue-500 hover:bg-white'}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                        <Sun className="w-5 h-5 text-yellow-500" />
                      </div>
                      <div className="text-left">
                        <span className="block font-bold text-gray-800">Modo Claro</span>
                        <span className="text-xs text-gray-500">Fundo branco, visual padrão.</span>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                         const updates = { 
                          backgroundColor: '#202124', // Chrome Dark
                          cardColor: '#292A2D', // Chrome Card
                          textColor: '#E8EAED', // Chrome Text
                          forceDarkMode: true // 🌓 Forçar Modo Escuro
                        };
                        setConfig({ ...config, ...updates });
                        updateConfigLocal(updates);
                      }}
                      className={`flex items-center justify-center gap-3 p-4 border-2 rounded-xl transition-all group ${config.forceDarkMode === true ? 'border-blue-500 bg-[#202124]' : 'border-gray-600 bg-[#202124] hover:border-blue-500'}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-[#303134] border border-gray-600 flex items-center justify-center">
                        <Moon className="w-5 h-5 text-blue-300" />
                      </div>
                      <div className="text-left">
                        <span className="block font-bold text-white">Modo Escuro</span>
                        <span className="text-xs text-gray-400">Estilo Google Chrome Dark.</span>
                      </div>
                    </button>
                  </div>

                  {/* CUSTOMIZAÇÃO AVANÇADA DE CORES */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                     <button 
                        onClick={() => setShowAdvancedColors(!showAdvancedColors)}
                        className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                     >
                        <Settings className="w-3 h-3" />
                        Customizar Cores de Fundo Manualmente
                     </button>
                     
                     {showAdvancedColors && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 animate-in fade-in slide-in-from-top-2">
                           <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Cor do Fundo da Página</label>
                              <div className="flex gap-2">
                                <input 
                                  type="color" 
                                  value={config.backgroundColor || '#f9fafb'} 
                                  onChange={(e) => {
                                      setConfig({...config, backgroundColor: e.target.value});
                                      updateConfigLocal({backgroundColor: e.target.value});
                                  }}
                                  className="h-8 w-8 rounded cursor-pointer border border-gray-300"
                                />
                                <input 
                                  type="text" 
                                  value={config.backgroundColor || ''}
                                  onChange={(e) => {
                                      setConfig({...config, backgroundColor: e.target.value});
                                      updateConfigLocal({backgroundColor: e.target.value});
                                  }}
                                  className="flex-1 text-xs border border-gray-300 rounded px-2"
                                  placeholder="#f9fafb"
                                />
                              </div>
                           </div>
                           
                           <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Cor dos Cartões (Box)</label>
                              <div className="flex gap-2">
                                <input 
                                  type="color" 
                                  value={config.cardColor || '#ffffff'} 
                                  onChange={(e) => {
                                      setConfig({...config, cardColor: e.target.value});
                                      updateConfigLocal({cardColor: e.target.value});
                                  }}
                                  className="h-8 w-8 rounded cursor-pointer border border-gray-300"
                                />
                                <input 
                                  type="text" 
                                  value={config.cardColor || ''}
                                  onChange={(e) => {
                                      setConfig({...config, cardColor: e.target.value});
                                      updateConfigLocal({cardColor: e.target.value});
                                  }}
                                  className="flex-1 text-xs border border-gray-300 rounded px-2"
                                  placeholder="#ffffff"
                                />
                              </div>
                           </div>
                           
                           <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Cor do Texto Principal</label>
                              <div className="flex gap-2">
                                <input 
                                  type="color" 
                                  value={config.textColor || '#111827'} 
                                  onChange={(e) => {
                                      setConfig({...config, textColor: e.target.value});
                                      updateConfigLocal({textColor: e.target.value});
                                  }}
                                  className="h-8 w-8 rounded cursor-pointer border border-gray-300"
                                />
                                <input 
                                  type="text" 
                                  value={config.textColor || ''}
                                  onChange={(e) => {
                                      setConfig({...config, textColor: e.target.value});
                                      updateConfigLocal({textColor: e.target.value});
                                  }}
                                  className="flex-1 text-xs border border-gray-300 rounded px-2"
                                  placeholder="#111827"
                                />
                              </div>
                           </div>
                        </div>
                     )}
                  </div>
                </div>
                
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1 space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cor Base do Tema</label>
                      <div className="flex gap-4 items-center mb-6">
                        <input
                          type="color"
                          value={config.themeColor || '#d97706'}
                          onChange={(e) => handleColorChange(e.target.value)}
                          className="w-16 h-16 rounded-lg border-2 border-gray-200 cursor-pointer p-1 shadow-sm"
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-800">Selecione a cor principal</p>
                          <p className="text-xs text-gray-500 mt-1 max-w-xs">
                            Define a cor de botões, destaques e ícones em todo o site.
                          </p>
                        </div>
                      </div>

                      {/* Controle de Opacidade da UI — Glass Effect */}
                      <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <label className="block text-sm font-bold text-gray-800 mb-2">Efeito Glass — Transparência das Caixas</label>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-medium text-gray-500">🪟 Vidro</span>
                          <input
                            type="range"
                            min="5"
                            max="100"
                            step="5"
                            value={config.uiOpacity ?? 35}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setConfig({ ...config, uiOpacity: val });
                              updateConfigLocal({ uiOpacity: val });
                            }}
                            className="flex-1 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-700"
                          />
                          <span className="text-xs font-medium text-gray-500">🎨 Sólido</span>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <p className="text-xs text-gray-500">
                            Valores baixos = efeito vidro/glass. Valores altos = cor sólida. O texto permanece sempre legível.
                          </p>
                          <span className="text-sm font-bold bg-white px-2 py-1 rounded border border-gray-200 min-w-[3rem] text-center">
                            {config.uiOpacity ?? 35}%
                          </span>
                        </div>
                      </div>

                      {/* Toggle: Usar cor da categoria nos modais */}
                      <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="block text-sm font-bold text-gray-800">Cor da Categoria nos Modais</label>
                            <p className="text-xs text-gray-500 mt-1 max-w-sm">
                              Quando ativado, os modais de produto usarão a cor definida para cada categoria (no painel Admin) em vez da cor tema do site.
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              const val = !config.useCategoryColorInModals;
                              setConfig({ ...config, useCategoryColorInModals: val });
                              updateConfigLocal({ useCategoryColorInModals: val });
                            }}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${
                              config.useCategoryColorInModals ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                                config.useCategoryColorInModals ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                        <div className={`mt-2 text-xs font-semibold ${config.useCategoryColorInModals ? 'text-green-600' : 'text-gray-400'}`}>
                          {config.useCategoryColorInModals ? '✅ Ativado — cada categoria usa sua própria cor nos modais' : '❌ Desativado — todos os modais usam a cor tema do site'}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <ImageConfig 
                          label="Logo do Site (Header e Footer)"
                          value={config.logoUrl}
                          onChange={(val: string) => setConfig({ ...config, logoUrl: val })}
                          placeholder="https://exemplo.com/logo.png"
                          helpText="Aparece no topo e no rodapé. Recomendado: PNG Transparente."
                          token={token}
                        />

                        <ImageConfig 
                          label="Imagem de Fundo do Cabeçalho (Desktop)"
                          value={config.headerBackgroundUrl}
                          onChange={(val: string) => setConfig({ ...config, headerBackgroundUrl: val })}
                          placeholder="https://exemplo.com/fundo.jpg"
                          helpText="Imagem para telas grandes (desktop). Recomendado: 1920x600+."
                          token={token}
                        />
                        <ImageConfig 
                          label="Imagem de Fundo do Cabeçalho (Mobile)"
                          value={config.headerBackgroundMobileUrl}
                          onChange={(val: string) => setConfig({ ...config, headerBackgroundMobileUrl: val })}
                          placeholder="https://exemplo.com/fundo-mobile.jpg"
                          helpText="Imagem para celulares. Recomendado: 750x900 (vertical). Se vazio, usa a do desktop."
                          token={token}
                        />
                      </div>

                      {/* Seção de Efeitos do Cabeçalho - Separada para garantir visibilidade */}
                      <div className="mt-8 p-5 bg-blue-50/50 rounded-xl border border-blue-100">
                        <div className="flex items-center gap-2 mb-4">
                          <Sparkles className="w-5 h-5 text-blue-600" />
                          <label className="text-sm font-bold text-gray-800">Efeito Animado no Cabeçalho</label>
                        </div>
                        
                        {/* Seletor de Formato do Efeito */}
                        <div className="mb-6">
                          <p className="text-xs text-gray-600 mb-3 font-medium">Formato do Efeito:</p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {[
                              { id: 'star', label: 'Estrela', icon: Star },
                              { id: 'heart', label: 'Coração', icon: Heart },
                              { id: 'sparkles', label: 'Brilho', icon: Sparkles },
                              { id: 'zap', label: 'Raio', icon: Zap },
                              { id: 'flame', label: 'Fogo', icon: Flame },
                              { id: 'snowflake', label: 'Neve', icon: Snowflake },
                              { id: 'music', label: 'Música', icon: Music },
                              { id: 'sun', label: 'Sol', icon: Sun },
                              { id: 'moon', label: 'Lua', icon: Moon },
                              { id: 'circle', label: 'Círculo', icon: Circle },
                              { id: 'cloud', label: 'Nuvem', icon: Cloud },
                            ].map((effect) => {
                              const EffectIcon = effect.icon;
                              const isSelected = (config.headerEffectShape || 'star') === effect.id;
                              
                              return (
                                <button
                                  key={effect.id}
                                  onClick={() => {
                                    setConfig({ ...config, headerEffectShape: effect.id });
                                    updateConfigLocal({ headerEffectShape: effect.id });
                                  }}
                                  className={`
                                    flex flex-col items-center justify-center p-3 rounded-lg border transition-all bg-white
                                    ${isSelected 
                                      ? 'border-blue-500 text-blue-700 ring-2 ring-blue-200 shadow-md transform scale-105' 
                                      : 'border-gray-200 hover:border-blue-300 hover:shadow-sm text-gray-600'}
                                  `}
                                >
                                  <EffectIcon className={`w-6 h-6 mb-2 ${isSelected ? 'fill-current' : ''}`} />
                                  <span className="text-xs font-medium">{effect.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Controle de Quantidade de Efeitos */}
                        <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
                          <label className="block text-xs font-bold text-gray-800 mb-2">Quantidade de Efeitos Pulsantes</label>
                          <div className="flex items-center gap-4">
                            <input
                              type="range"
                              min="0"
                              max="15"
                              step="1"
                              value={config.headerEffectCount ?? 3}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setConfig({ ...config, headerEffectCount: val });
                                updateConfigLocal({ headerEffectCount: val });
                              }}
                              className="flex-1 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-700"
                            />
                            <span className="text-sm font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded border border-blue-200 min-w-[3rem] text-center">
                              {config.headerEffectCount ?? 3}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Controle quantos ícones pulsantes aparecem no cabeçalho (0 a 15).
                          </p>
                        </div>

                        {/* Toggle de Posição Aleatória com Botão Refresh */}
                        <div className="p-4 bg-white rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex-1">
                              <label className="block text-xs font-bold text-gray-800 mb-1">Posições Aleatórias</label>
                              <p className="text-xs text-gray-500">
                                Ativa posicionamento aleatório dos efeitos ao invés de posições pré-definidas.
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                const newValue = !(config.headerEffectRandomPosition ?? false);
                                setConfig({ ...config, headerEffectRandomPosition: newValue });
                                updateConfigLocal({ headerEffectRandomPosition: newValue });
                              }}
                              className={`
                                ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                                ${config.headerEffectRandomPosition ? 'bg-blue-600' : 'bg-gray-300'}
                              `}
                            >
                              <span
                                className={`
                                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                  ${config.headerEffectRandomPosition ? 'translate-x-6' : 'translate-x-1'}
                                `}
                              />
                            </button>
                          </div>

                          {/* Botão de Refresh - Só aparece quando modo aleatório está ativado */}
                          {config.headerEffectRandomPosition && (
                            <button
                              onClick={() => {
                                const newSeed = Math.floor(Math.random() * 1000000);
                                setConfig({ ...config, headerEffectRandomSeed: newSeed });
                                updateConfigLocal({ headerEffectRandomSeed: newSeed });
                              }}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium text-sm rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg active:scale-95"
                            >
                              <RefreshCw className="w-4 h-4" />
                              Gerar Novas Posições Aleatórias
                            </button>
                          )}
                        </div>

                        <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                          Esses elementos ficarão pulsando no fundo do cabeçalho do site.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Preview Box */}
                  <div className="flex-1">
                    <div className="sticky top-24 p-6 rounded-2xl border border-gray-200 bg-white shadow-xl">
                      <h4 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Preview em Tempo Real
                      </h4>
                      
                      <div className="space-y-6">
                        {/* Botão */}
                        <div>
                          <p className="text-xs text-gray-400 mb-2">Botões Principais</p>
                          <button 
                            className="w-full py-3 rounded-lg text-white font-bold shadow-lg transition-colors flex items-center justify-center gap-2"
                            style={{ backgroundColor: config.themeColor || '#d97706' }}
                          >
                            Adicionar ao Carrinho
                          </button>
                        </div>
                        
                        {/* Destaque / Info */}
                        <div>
                          <p className="text-xs text-gray-400 mb-2">Caixas de Informação — Glass Effect</p>
                          <div 
                            className="p-3 rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all duration-300 border border-white/20"
                            style={{ 
                              background: `linear-gradient(135deg, ${hexToRgba(config.themeColor || '#d97706', ((config.uiOpacity ?? 35) / 100) * 0.5)} 0%, ${hexToRgba(config.themeColor || '#d97706', ((config.uiOpacity ?? 35) / 100) * 0.3)} 100%)`,
                              backdropFilter: 'blur(16px)',
                              WebkitBackdropFilter: 'blur(16px)',
                            }}
                          >
                            <div className="p-2 rounded-lg bg-white/15 backdrop-blur-sm">
                              <Smartphone className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                            </div>
                            <span className="font-bold text-sm text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                              (00) 00000-0000
                            </span>
                          </div>
                        </div>

                        {/* Input Focus */}
                        <div>
                          <p className="text-xs text-gray-400 mb-2">Campos de Texto</p>
                          <input 
                            type="text" 
                            value="Exemplo de texto digitado..."
                            readOnly
                            className="w-full px-4 py-2 border rounded-lg outline-none shadow-sm" 
                            style={{ 
                              borderColor: config.themeColor || '#d97706',
                              boxShadow: `0 0 0 3px ${config.themeColor || '#d97706'}20`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* FUNDO DA ÁREA DE CONTEÚDO */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  🖼️ Imagem de Fundo do Site
                </h3>
                <p className="text-xs text-gray-500 mb-4">Imagem que aparece como fundo de todo o site. Use imagens separadas para desktop e mobile para melhor resultado.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <ImageConfig
                      label="Fundo Desktop"
                      value={config.contentBackgroundUrl || ''}
                      onChange={(url: string) => setConfig({ ...config, contentBackgroundUrl: url })}
                      placeholder="https://..."
                      helpText="Recomendado: 1920x1080 (paisagem, escura)."
                      token={token}
                    />
                    {config.contentBackgroundUrl && (
                      <button
                        onClick={() => setConfig({ ...config, contentBackgroundUrl: '' })}
                        className="mt-2 text-xs text-red-500 hover:text-red-700 font-bold"
                      >✕ Remover</button>
                    )}
                  </div>
                  <div>
                    <ImageConfig
                      label="Fundo Mobile"
                      value={config.contentBackgroundMobileUrl || ''}
                      onChange={(url: string) => setConfig({ ...config, contentBackgroundMobileUrl: url })}
                      placeholder="https://..."
                      helpText="Recomendado: 750x1334 (vertical). Se vazio, usa a do desktop."
                      token={token}
                    />
                    {config.contentBackgroundMobileUrl && (
                      <button
                        onClick={() => setConfig({ ...config, contentBackgroundMobileUrl: '' })}
                        className="mt-2 text-xs text-red-500 hover:text-red-700 font-bold"
                      >✕ Remover</button>
                    )}
                  </div>
                </div>
              </div>

              {/* BANNER CARDS ANTES DO FOOTER */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  🎯 Banners antes do Footer
                </h3>
                <p className="text-xs text-gray-500 mb-4">Cards com imagens que aparecem entre os produtos e o rodapé. Usam o mesmo fundo da área de produtos. Use PNG para transparência.</p>

                {/* Lista de banners */}
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-3">Banners ({(config.bannerCards || []).length})</label>
                  <div className="space-y-4">
                    {(config.bannerCards || []).map((card: any, i: number) => (
                      <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold text-gray-700">Banner {i + 1}</span>
                          <button
                            onClick={() => {
                              const cards = [...(config.bannerCards || [])];
                              cards.splice(i, 1);
                              setConfig({ ...config, bannerCards: cards });
                            }}
                            className="text-red-500 hover:text-red-700 text-sm font-bold"
                          >✕ Remover</button>
                        </div>
                        <ImageConfig
                          label="Imagem do Banner"
                          value={card.imageUrl || ''}
                          onChange={(url: string) => {
                            const cards = [...(config.bannerCards || [])];
                            cards[i] = { ...cards[i], imageUrl: url };
                            setConfig({ ...config, bannerCards: cards });
                          }}
                          placeholder="https://..."
                          helpText="PNG com fundo transparente recomendado."
                          token={token}
                        />
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Link (opcional)</label>
                          <input
                            type="text"
                            value={card.link || ''}
                            onChange={(e) => {
                              const cards = [...(config.bannerCards || [])];
                              cards[i] = { ...cards[i], link: e.target.value };
                              setConfig({ ...config, bannerCards: cards });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="https://... (clique no banner abre este link)"
                          />
                        </div>
                        {card.imageUrl && (
                          <div className="mt-3 bg-zinc-900 rounded-lg p-3 flex justify-center">
                            <img src={card.imageUrl} alt={`Preview ${i+1}`} className="max-h-32 object-contain" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const cards = [...(config.bannerCards || [])];
                      cards.push({ imageUrl: '', link: '' });
                      setConfig({ ...config, bannerCards: cards });
                    }}
                    className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                  >+ Adicionar Banner</button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: INTEGRAÇÕES */}
          {activeTab === 'integrations' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Domínio */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-600" />
                  Domínio e WhatsApp
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL do Site (Sem https://)</label>
                    <input
                      type="text"
                      value={config.domainUrl || ''}
                      onChange={(e) => setConfig({ ...config, domainUrl: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm"
                      placeholder="www.seusite.com.br"
                    />
                    <p className="text-xs text-gray-500 mt-1">Usado para gerar links de compartilhamento e QRCodes.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número do WhatsApp para Pedidos</label>
                    <div className="relative">
                      <Smartphone className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={config.whatsappNumber || ''}
                        onChange={(e) => {
                          // Permitir apenas números para evitar erros
                          const val = e.target.value.replace(/\D/g, '');
                          setConfig({ ...config, whatsappNumber: val });
                        }}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="5511999999999"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">O número que receberá os pedidos. Use o formato: 55 + DDD + Número (Ex: 5511999999999).</p>
                  </div>
                </div>
              </div>

              {/* Pagamento */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-green-600" />
                  Configurações de Pagamento
                </h3>
                
                <div className="space-y-4">
                  {/* Chave PIX Manual */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Chave PIX (Modo Manual)</label>
                    <input
                      type="text"
                      value={config.manualPixKey || ''}
                      onChange={(e) => setConfig({ ...config, manualPixKey: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm"
                      placeholder="CPF, Email ou Chave Aleatória"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Essa chave aparecerá para o cliente copiar quando o Pagamento Automático estiver <b>desativado</b>.
                    </p>
                  </div>

                  <div className="border-t border-gray-100 my-4 pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Token do PagSeguro (Modo Automático)</label>
                    <input
                      type="password"
                      value={config.pagSeguroToken || ''}
                      onChange={(e) => setConfig({ ...config, pagSeguroToken: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm"
                      placeholder="Cole o token do PagSeguro aqui..."
                    />
                    
                    {/* Campo de Email do PagSeguro - OBRIGATÓRIO para API funcionar */}
                    <label className="block text-sm font-medium text-gray-700 mb-1 mt-4">
                      📧 Email do PagSeguro (Obrigatório)
                    </label>
                    <input
                      type="email"
                      value={config.pagSeguroEmail || ''}
                      onChange={(e) => setConfig({ ...config, pagSeguroEmail: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                      placeholder="92978581gl@gmail.com"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      ⚠️ Use o mesmo email que você faz login no PagSeguro. Ambos (token + email) são necessários para a API funcionar.
                    </p>
                    
                    {/* Botão para descobrir IP do servidor (Whitelist PagSeguro) */}
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        Configurar Whitelist do PagSeguro (Produção)
                      </h4>
                      <p className="text-xs text-gray-700 mb-3">
                        Para usar o PagSeguro em <b>produção</b>, você precisa adicionar o IP do servidor Supabase na whitelist do PagSeguro. 
                        Clique no botão abaixo para descobrir o IP.
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          setIsDiscoveringIP(true);
                          try {
                            const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-dfe23da2/server/ip`, {
                              headers: {
                                'Authorization': `Bearer ${publicAnonKey}`
                              }
                            });
                            const data = await response.json();
                            
                            if (data.success && data.ip) {
                              alert(
                                `🌐 IP do Servidor Supabase:\n\n` +
                                `${data.ip}\n\n` +
                                `📋 PASSO A PASSO:\n\n` +
                                `1. Acesse: https://pagseguro.uol.com.br/\n` +
                                `2. Faça login\n` +
                                `3. Vá em: Integração > Tokens > Configurações de Segurança\n` +
                                `4. Adicione este IP: ${data.ip}\n` +
                                `5. Aguarde até 24h para propagação\n\n` +
                                `⚠️ Sem isso, você receberá erro: ACCESS_DENIED`
                              );
                            } else {
                              alert('❌ Erro ao descobrir IP do servidor');
                            }
                          } catch (err) {
                            console.error('Erro ao descobrir IP:', err);
                            alert('❌ Erro ao descobrir IP do servidor. Verifique os logs do console (F12).');
                          } finally {
                            setIsDiscoveringIP(false);
                          }
                        }}
                        disabled={isDiscoveringIP}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDiscoveringIP ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Descobrindo IP...
                          </>
                        ) : (
                          <>
                            <Globe className="w-4 h-4" />
                            Descobrir IP do Servidor
                          </>
                        )}
                      </button>
                      
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-gray-700">
                        <p className="font-semibold text-yellow-900 mb-1">💡 Alternativas:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li><b>Sandbox:</b> Use ambiente de testes (sem whitelist necessária)</li>
                          <li><b>PIX Manual:</b> Desative "Pagamento Automático" e use sua chave PIX</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="autoPaymentToggle"
                        checked={config.automaticPayment || false}
                        onChange={(e) => setConfig({ ...config, automaticPayment: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="autoPaymentToggle" className="text-sm text-gray-700 font-medium select-none cursor-pointer">
                        Ativar Pagamento Automático na Loja (Habilitar PIX/Cartão no Checkout)
                      </label>
                    </div>

                    <p className="text-xs text-gray-500 mt-1">
                      Necessário apenas se for usar o Pagamento Automático.
                    </p>
                  </div>
                </div>
              </div>


              {/* Meta / Facebook */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Facebook className="w-5 h-5 text-blue-800" />
                  Meta Ads (Facebook & Instagram)
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pixel ID</label>
                    <input
                      type="text"
                      value={config.metaPixelId || ''}
                      onChange={(e) => setConfig({ ...config, metaPixelId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm"
                      placeholder="Ex: 123456789012345"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Access Token (Conversões API)</label>
                    <input
                      type="password"
                      value={config.metaAccessToken || ''}
                      onChange={(e) => setConfig({ ...config, metaAccessToken: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm"
                      placeholder="EAAB..."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: FEATURES (SAAS) */}
          {activeTab === 'features' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-8 rounded-xl shadow-lg text-white mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="w-8 h-8 text-yellow-400" />
                  <h3 className="text-2xl font-bold">Gestão de Funcionalidades</h3>
                </div>
                <p className="text-purple-200">
                  Ative ou desative módulos inteiros da plataforma. Útil para criar planos de assinatura (Básico, Pro, Enterprise).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Módulo: Pagamento Automático */}
                <div className={`p-6 rounded-xl border-2 transition-all ${
                  config.features?.automaticPaymentAllowed !== false ? 'bg-white border-emerald-500 shadow-md' : 'bg-gray-50 border-gray-200 opacity-75'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${config.features?.automaticPaymentAllowed !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                        <CreditCard className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-gray-800">Pagamento Automático</h4>
                        <p className="text-xs text-gray-500">Pix Dinâmico e Cartão Online</p>
                      </div>
                    </div>
                    <label htmlFor="feature-payment" className="relative inline-flex items-center cursor-pointer">
                      <input 
                        id="feature-payment"
                        name="automaticPaymentAllowed"
                        type="checkbox" 
                        className="sr-only peer"
                        checked={config.features?.automaticPaymentAllowed !== false}
                        onChange={(e) => setConfig({
                          ...config,
                          features: { ...config.features, automaticPaymentAllowed: e.target.checked }
                        })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                  <p className="text-sm text-gray-600">
                    Habilita o módulo de checkout transparente (API PagSeguro).
                    <br />
                    <span className="text-xs font-semibold text-red-500 mt-2 block">
                      {config.features?.automaticPaymentAllowed === false 
                        ? '⛔ Desativado: Admin só verá opção de Pagamento Manual.' 
                        : '✅ Ativado: Admin pode ligar/desligar o modo automático.'}
                    </span>
                  </p>
                </div>

                {/* Módulo: Impressora Térmica */}
                <div className={`p-6 rounded-xl border-2 transition-all ${
                  config.features?.thermalPrinter !== false ? 'bg-white border-green-500 shadow-md' : 'bg-gray-50 border-gray-200 opacity-75'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${config.features?.thermalPrinter !== false ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-gray-800">Impressão Térmica</h4>
                        <p className="text-xs text-gray-500">Conexão USB/Bluetooth</p>
                      </div>
                    </div>
                    <label htmlFor="feature-printer" className="relative inline-flex items-center cursor-pointer">
                      <input 
                        id="feature-printer"
                        name="thermalPrinter"
                        type="checkbox" 
                        className="sr-only peer"
                        checked={config.features?.thermalPrinter !== false}
                        onChange={(e) => setConfig({
                          ...config,
                          features: { ...config.features, thermalPrinter: e.target.checked }
                        })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                  </div>
                  <p className="text-sm text-gray-600">
                    Permite conectar impressoras térmicas e imprimir comandas automaticamente.
                    <br />
                    <span className="text-xs font-semibold text-red-500 mt-2 block">
                      {config.features?.thermalPrinter === false ? '⛔ Desativado: Botões de impressão sumirão do painel.' : '✅ Ativado: Painel mostrará controles de impressão.'}
                    </span>
                  </p>
                </div>

                {/* Módulo: Cupons de Desconto */}
                <div className={`p-6 rounded-xl border-2 transition-all ${
                  config.features?.coupons !== false ? 'bg-white border-blue-500 shadow-md' : 'bg-gray-50 border-gray-200 opacity-75'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${config.features?.coupons !== false ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path><path d="M12 12h.01"></path></svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-gray-800">Cupons de Desconto</h4>
                        <p className="text-xs text-gray-500">Gestão e Aplicação</p>
                      </div>
                    </div>
                    <label htmlFor="feature-coupons" className="relative inline-flex items-center cursor-pointer">
                      <input 
                        id="feature-coupons"
                        name="coupons"
                        type="checkbox" 
                        className="sr-only peer"
                        checked={config.features?.coupons !== false}
                        onChange={(e) => setConfig({
                          ...config,
                          features: { ...config.features, coupons: e.target.checked }
                        })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <p className="text-sm text-gray-600">
                    Sistema completo de cupons (fixo e porcentagem).
                    <br />
                    <span className="text-xs font-semibold text-red-500 mt-2 block">
                      {config.features?.coupons === false ? '⛔ Desativado: Some aba "Cupons" e campo no checkout.' : '✅ Ativado: Funcionalidade completa liberada.'}
                    </span>
                  </p>
                </div>

                {/* Módulo: Sistema de Entregas */}
                <div className={`p-6 rounded-xl border-2 transition-all ${
                  config.features?.deliverySystem !== false ? 'bg-white border-orange-500 shadow-md' : 'bg-gray-50 border-gray-200 opacity-75'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${config.features?.deliverySystem !== false ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-500'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-gray-800">Sistema de Entregas</h4>
                        <p className="text-xs text-gray-500">Gestão Completa de Entregadores</p>
                      </div>
                    </div>
                    <label htmlFor="feature-delivery" className="relative inline-flex items-centers cursor-pointer">
                      <input 
                        id="feature-delivery"
                        name="deliverySystem"
                        type="checkbox" 
                        className="sr-only peer"
                        checked={config.features?.deliverySystem !== false}
                        onChange={(e) => setConfig({
                          ...config,
                          features: { ...config.features, deliverySystem: e.target.checked }
                        })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                    </label>
                  </div>
                  <p className="text-sm text-gray-600">
                    Página do entregador (/entrega), área de delivery no admin, status intermediários e sincronização em tempo real.
                    <br />
                    <span className="text-xs font-semibold text-green-600 mt-2 block">
                      ℹ️ Os setores de entrega SEMPRE estarão disponíveis (criados no Master, selecionados pelo cliente no checkout).
                    </span>
                    <br />
                    <span className="text-xs font-semibold text-red-500 mt-1 block">
                      {config.features?.deliverySystem === false 
                        ? '⛔ Desativado: Página /entrega e Área de Delivery somem. Setores continuam funcionando.' 
                        : '✅ Ativado: Sistema completo de gestão de entregas liberado.'}
                    </span>
                  </p>
                </div>

                {/* 🆕 FEATURE: CONSUMIR NO LOCAL (DINE-IN) */}
                <div className={`p-6 rounded-xl border-2 transition-all ${
                  config.features?.dineIn !== false ? 'bg-white border-green-500 shadow-md' : 'bg-gray-50 border-gray-200 opacity-75'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${config.features?.dineIn !== false ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 22h14"/><path d="M5 18h14"/><path d="m12 18-7-6 2-2 5 5 5-5 2 2Z"/></svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-gray-800">Consumir no Local</h4>
                        <p className="text-xs text-gray-500">Opção de Pedido para Mesa</p>
                      </div>
                    </div>
                    <label htmlFor="feature-dinein" className="relative inline-flex items-center cursor-pointer">
                      <input 
                        id="feature-dinein"
                        name="dineIn"
                        type="checkbox" 
                        className="sr-only peer"
                        checked={config.features?.dineIn !== false}
                        onChange={(e) => setConfig({
                          ...config,
                          features: { ...config.features, dineIn: e.target.checked }
                        })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                  </div>
                  <p className="text-sm text-gray-600">
                    Habilita a opção "🍽️ Consumir no Local" no checkout. Ideal para estabelecimentos com mesas.
                    <br />
                    <span className="text-xs font-semibold text-red-500 mt-2 block">
                      {config.features?.dineIn === false 
                        ? '⛔ Desativado: Clientes só podem escolher Delivery ou Retirada.' 
                        : '✅ Ativado: Clientes podem escolher consumir no local.'}
                    </span>
                  </p>
                </div>

                {/* FEATURE: AVALIAÇÕES */}
                <div className={`p-6 rounded-xl border-2 transition-all ${
                  config.features?.reviews !== false ? 'bg-white border-yellow-500 shadow-md' : 'bg-gray-50 border-gray-200 opacity-75'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${config.features?.reviews !== false ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-200 text-gray-500'}`}>
                        <Star className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-gray-800">Sistema de Avaliações</h4>
                        <p className="text-xs text-gray-500">Feedback dos Clientes</p>
                      </div>
                    </div>
                    <label htmlFor="feature-reviews" className="relative inline-flex items-center cursor-pointer">
                      <input 
                        id="feature-reviews"
                        name="reviews"
                        type="checkbox" 
                        className="sr-only peer"
                        checked={config.features?.reviews !== false}
                        onChange={(e) => setConfig({ 
                          ...config, 
                          features: { ...config.features, reviews: e.target.checked } 
                        })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                    </label>
                  </div>
                  <p className="text-sm text-gray-600">
                    Permite que clientes avaliem pedidos e exibe "Top 3 Avaliados" na home.
                    <br />
                    <span className="text-xs font-semibold text-red-500 mt-2 block">
                      {config.features?.reviews === false ? '⛔ Desativado: Some avaliações e ranking.' : '✅ Ativado: Clientes podem avaliar pedidos.'}
                    </span>
                  </p>
                </div>

                {/* FEATURE: ACOMPANHAMENTO DE PEDIDO */}
                <div className={`p-6 rounded-xl border-2 transition-all ${
                  config.features?.orderTracking !== false ? 'bg-white border-blue-500 shadow-md' : 'bg-gray-50 border-gray-200 opacity-75'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${config.features?.orderTracking !== false ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'}`}>
                        <Package className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-gray-800">Status do Pedido</h4>
                        <p className="text-xs text-gray-500">Rastreamento em Tempo Real</p>
                      </div>
                    </div>
                    <label htmlFor="feature-tracking" className="relative inline-flex items-center cursor-pointer">
                      <input 
                        id="feature-tracking"
                        name="orderTracking"
                        type="checkbox" 
                        className="sr-only peer"
                        checked={config.features?.orderTracking !== false}
                        onChange={(e) => setConfig({ 
                          ...config, 
                          features: { ...config.features, orderTracking: e.target.checked } 
                        })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <p className="text-sm text-gray-600">
                    Fluxo completo de status (Preparando, Embalando, etc).
                    <br />
                    <span className="text-xs font-semibold text-red-500 mt-2 block">
                      {config.features?.orderTracking === false ? '⛔ Desativado: Apenas status "Pendente" e "Concluído". Cliente não acompanha.' : '✅ Ativado: Fluxo completo com notificações.'}
                    </span>
                  </p>
                </div>

                {/* FEATURE: TRÁFEGO PAGO */}
                <div className={`p-6 rounded-xl border-2 transition-all ${
                  config.features?.paidTraffic !== false ? 'bg-white border-purple-500 shadow-md' : 'bg-gray-50 border-gray-200 opacity-75'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${config.features?.paidTraffic !== false ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-500'}`}>
                        <Megaphone className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-gray-800">Meta Ads</h4>
                        <p className="text-xs text-gray-500">Gestão de Campanhas e Ads</p>
                      </div>
                    </div>
                    <label htmlFor="feature-traffic" className="relative inline-flex items-center cursor-pointer">
                      <input 
                        id="feature-traffic"
                        name="paidTraffic"
                        type="checkbox" 
                        className="sr-only peer"
                        checked={config.features?.paidTraffic !== false}
                        onChange={(e) => setConfig({ 
                          ...config, 
                          features: { ...config.features, paidTraffic: e.target.checked } 
                        })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                  <p className="text-sm text-gray-600">
                    Painel completo para gestão de campanhas de Facebook e Instagram Ads.
                    <br />
                    <span className="text-xs font-semibold text-red-500 mt-2 block">
                      {config.features?.paidTraffic === false ? '⛔ Desativado: Menu de Meta Ads desaparece.' : '✅ Ativado: Acesso ao dashboard de campanhas.'}
                    </span>
                  </p>
                </div>

                {/* FEATURE: CONTROLE DE ESTOQUE */}
                <div className={`p-6 rounded-xl border-2 transition-all ${
                  config.features?.stockControl ? 'bg-white border-teal-500 shadow-md' : 'bg-gray-50 border-gray-200 opacity-75'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${config.features?.stockControl ? 'bg-teal-100 text-teal-700' : 'bg-gray-200 text-gray-500'}`}>
                        <Package className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-gray-800">Controle de Estoque</h4>
                        <p className="text-xs text-gray-500">Ingredientes, Fichas Técnicas e Relatórios</p>
                      </div>
                    </div>
                    <label htmlFor="feature-stock" className="relative inline-flex items-center cursor-pointer">
                      <input 
                        id="feature-stock"
                        name="stockControl"
                        type="checkbox" 
                        className="sr-only peer"
                        checked={config.features?.stockControl || false}
                        onChange={(e) => setConfig({
                          ...config,
                          features: { ...config.features, stockControl: e.target.checked }
                        })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>
                  <p className="text-sm text-gray-600">
                    Cadastro de ingredientes (kg/unidade), ficha técnica nos produtos, desconto automático por pedido, alertas de estoque baixo e relatório de gastos do dia.
                    <br />
                    <span className="text-xs font-semibold text-red-500 mt-2 block">
                      {config.features?.stockControl
                        ? '✅ Ativado: Aba de Estoque no admin, fichas técnicas nos produtos, desconto automático.'
                        : '⛔ Desativado: Ingredientes são digitados manualmente como texto ao criar produtos.'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DELIVERY SECTORS */}
          {activeTab === 'delivery' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-gradient-to-r from-orange-900 to-amber-900 p-8 rounded-xl shadow-lg text-white mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <Truck className="w-8 h-8 text-orange-400" />
                  <h3 className="text-2xl font-bold">Gestão de Setores de Entrega</h3>
                </div>
                <p className="text-orange-200">
                  Crie os setores que aparecerão para o cliente escolher no checkout.
                  Isso ajuda a organizar as entregas e calcular rotas (futuramente).
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                {isLoadingSectors ? (
                  <div className="flex justify-center p-8">
                    <RefreshCw className="w-8 h-8 animate-spin text-orange-600" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Add New */}
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                      <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-green-600" />
                        Adicionar Novo Setor
                      </h3>
                      <div className="flex items-center gap-4">
                        <input
                          type="text"
                          value={newSectorName}
                          onChange={(e) => setNewSectorName(e.target.value)}
                          className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none shadow-sm"
                          placeholder="Nome do Setor (Ex: Centro, Zona Norte...)"
                        />
                        <button
                          onClick={handleAddSector}
                          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap"
                        >
                          <Plus className="w-5 h-5" />
                          Adicionar
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        A cor do setor será gerada automaticamente.
                      </p>
                    </div>

                    {/* List */}
                    <div className="space-y-3">
                      <h3 className="font-bold text-gray-800 ml-1">Setores Ativos ({sectors.length})</h3>
                      {sectors.length === 0 && (
                        <p className="text-gray-500 italic ml-1">Nenhum setor cadastrado.</p>
                      )}
                      {sectors.map(sector => (
                        <div key={sector.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg shadow-sm flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: sector.color }}>
                                {sector.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="text-gray-800 font-bold text-lg">{sector.name}</p>
                                <p className="text-xs text-gray-400 font-mono">{sector.id}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingSector(sector)}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                              <Edit2 className="w-4 h-4" />
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteSector(sector.id, sector.name)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Excluir
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Edit Modal / Inline */}
                    {editingSector && (
                      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in-95">
                          <h3 className="font-bold text-xl text-gray-800 mb-4">Editar Setor</h3>
                          
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Setor</label>
                          <input
                            type="text"
                            value={editingSector.name}
                            onChange={(e) => setEditingSector({ ...editingSector, name: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-6"
                            placeholder="Nome do Setor"
                          />
                          
                          <div className="flex gap-3">
                            <button
                                onClick={() => setEditingSector(null)}
                                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-bold"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveEditSector}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"
                            >
                                <Save className="w-5 h-5" />
                                Salvar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: ADMIN */}
          {activeTab === 'admin' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-amber-500">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-600" />
                  Credenciais do Restaurante
                </h3>
                <p className="text-gray-600 mb-6 text-sm">
                  Aqui você pode redefinir o acesso do administrador do restaurante. Se ele esquecer a senha, você pode criar uma nova aqui.
                </p>

                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Usuário do Admin</label>
                    <input
                      type="text"
                      value={config.adminUsername || 'admin'}
                      onChange={(e) => setConfig({ ...config, adminUsername: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {hasAdminPassword ? 'Redefinir Senha' : 'Criar Senha'}
                    </label>
                    <div className="relative">
                      <input
                        type={showAdminPass ? 'text' : 'password'}
                        value={newAdminPass}
                        onChange={(e) => setNewAdminPass(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none pr-10"
                        placeholder="Nova senha (deixe em branco para não alterar)"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPass(!showAdminPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {hasAdminPassword && !newAdminPass && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <Key className="w-3 h-3" /> Senha configurada atualmente
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TESTES */}
          {activeTab === 'tests' && (
            <div className="space-y-8">
              <TestRunner 
                fetchFn={masterFetch} 
                endpoint="/master/tests/run"
                historyEndpoint="/master/tests/history"
              />
              <div className="border-t-2 border-dashed border-gray-200 dark:border-zinc-700 pt-8">
                <E2ETestRunner />
              </div>
            </div>
          )}

          {/* TAB: LOGS DE AUDITORIA */}
          {activeTab === 'audit' && (
            <AuditLogs 
              fetchFn={masterFetch} 
              endpoint="/master/audit-logs" 
            />
          )}

          {/* TAB: SECURITY ANALYTICS */}
          {activeTab === 'analytics' && (
            <SecurityDashboard 
              fetchFn={masterFetch}
            />
          )}


        </div>
      </main>


    </div>
  );
}

function SidebarItem({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
        active
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  );
}