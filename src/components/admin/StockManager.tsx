import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Package, Plus, Edit, Trash2, X, Save, Loader, RefreshCw,
  AlertTriangle, TrendingDown, DollarSign, Scale, Hash,
  ChevronDown, ChevronUp, History, PackagePlus, BarChart3,
  Volume2, VolumeX, ArrowRight, CalendarDays, Check,
  BoxSelect, Utensils, Tag
} from 'lucide-react';
import * as api from '../../utils/api';
import type { StockIngredient, PurchaseHistoryEntry, PortionOption, RestockSchedule } from '../../utils/api';
import { getCurrentBrasiliaTime, formatBrasiliaDate } from '../../utils/dateUtils';

type TabView = 'ingredients' | 'report' | 'restock-schedule';

// Gerar beep sonoro via Web Audio API (sem arquivos externos)
function playAlertSound(type: 'warning' | 'critical' = 'warning') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'critical') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(0, ctx.currentTime + 0.12);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
      osc.frequency.setValueAtTime(0, ctx.currentTime + 0.32);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.setValueAtTime(0, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);
    }
    setTimeout(() => ctx.close(), 1000);
  } catch (err) {
    console.warn('Nao foi possivel tocar som de alerta:', err);
  }
}

function generatePortionId() {
  return `p_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
}

export function StockManager() {
  const [ingredients, setIngredients] = useState<StockIngredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabView>('ingredients');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'ingredient' | 'embalagem' | 'acompanhamento'>('all');

  // Modal states
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<StockIngredient | null>(null);
  const [restockTarget, setRestockTarget] = useState<StockIngredient | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  // Report state
  const [report, setReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Notificacao sonora
  const [alertsMuted, setAlertsMuted] = useState(() => {
    return localStorage.getItem('stock_alerts_muted') === 'true';
  });
  const hasPlayedInitialAlert = useRef(false);
  const previousAlertIds = useRef<Set<string>>(new Set());

  // Form state
  const [form, setForm] = useState({
    name: '',
    type: 'kg' as 'kg' | 'unit',
    currentStock: '',
    minAlert: '',
    category: 'ingredient' as 'ingredient' | 'embalagem' | 'acompanhamento',
    defaultQuantity: '1',
  });
  const [portionOptions, setPortionOptions] = useState<PortionOption[]>([]);
  const [newPortionLabel, setNewPortionLabel] = useState('');
  const [newPortionGrams, setNewPortionGrams] = useState('');

  // Restock form
  const [restockForm, setRestockForm] = useState({
    quantity: '',
    price: '',
  });

  // Restock schedule state
  const [restockSchedule, setRestockSchedule] = useState<RestockSchedule>({});
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleSelectedDay, setScheduleSelectedDay] = useState<string>('');

  const WEEK_DAYS = [
    { key: 'monday', label: 'Segunda', short: 'Seg' },
    { key: 'tuesday', label: 'Terça', short: 'Ter' },
    { key: 'wednesday', label: 'Quarta', short: 'Qua' },
    { key: 'thursday', label: 'Quinta', short: 'Qui' },
    { key: 'friday', label: 'Sexta', short: 'Sex' },
    { key: 'saturday', label: 'Sábado', short: 'Sáb' },
    { key: 'sunday', label: 'Domingo', short: 'Dom' },
  ];

  // Detectar dia atual da semana
  const getTodayKey = () => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
  };

  const loadRestockSchedule = async () => {
    setScheduleLoading(true);
    try {
      const res = await api.getRestockSchedule();
      if (res.success) {
        setRestockSchedule(res.schedule || {});
      }
    } catch (err) {
      console.error('Erro ao carregar agenda de reposição:', err);
    } finally {
      setScheduleLoading(false);
    }
  };

  const saveSchedule = async (newSchedule: RestockSchedule) => {
    setScheduleSaving(true);
    try {
      const res = await api.saveRestockSchedule(newSchedule);
      if (res.success) {
        setRestockSchedule(newSchedule);
      } else {
        alert('Erro ao salvar agenda');
      }
    } catch (err) {
      console.error('Erro ao salvar agenda:', err);
      alert('Erro ao salvar agenda');
    } finally {
      setScheduleSaving(false);
    }
  };

  const toggleIngredientOnDay = (dayKey: string, ingredientId: string) => {
    const current = restockSchedule[dayKey] || [];
    const newDay = current.includes(ingredientId)
      ? current.filter(id => id !== ingredientId)
      : [...current, ingredientId];
    const newSchedule = { ...restockSchedule, [dayKey]: newDay };
    saveSchedule(newSchedule);
  };

  const getIngredientDays = (ingredientId: string): string[] => {
    return WEEK_DAYS
      .filter(d => (restockSchedule[d.key] || []).includes(ingredientId))
      .map(d => d.short);
  };

  useEffect(() => {
    loadIngredients();
  }, []);

  const loadIngredients = async () => {
    setIsLoading(true);
    try {
      const res = await api.getStockIngredients();
      if (res.success) {
        setIngredients(res.ingredients || []);
      }
    } catch (err) {
      console.error('Erro ao carregar ingredientes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // === Notificacoes sonoras de estoque ===
  useEffect(() => {
    if (isLoading || alertsMuted || ingredients.length === 0) return;

    const currentAlertIds = new Set(
      ingredients.filter(i => getStockStatus(i) !== 'ok').map(i => i.id)
    );

    if (!hasPlayedInitialAlert.current && currentAlertIds.size > 0) {
      hasPlayedInitialAlert.current = true;
      const hasEmpty = ingredients.some(i => i.currentStock <= 0);
      playAlertSound(hasEmpty ? 'critical' : 'warning');
      previousAlertIds.current = currentAlertIds;
      return;
    }

    const newAlerts = [...currentAlertIds].filter(id => !previousAlertIds.current.has(id));
    if (newAlerts.length > 0) {
      const hasNewEmpty = newAlerts.some(id => {
        const ing = ingredients.find(i => i.id === id);
        return ing && ing.currentStock <= 0;
      });
      playAlertSound(hasNewEmpty ? 'critical' : 'warning');
    }

    previousAlertIds.current = currentAlertIds;
  }, [ingredients, isLoading, alertsMuted]);

  // Polling: recarregar estoque a cada 60 segundos
  useEffect(() => {
    const interval = setInterval(() => { loadIngredients(); }, 60000);
    return () => clearInterval(interval);
  }, []);

  const toggleMute = () => {
    const newVal = !alertsMuted;
    setAlertsMuted(newVal);
    localStorage.setItem('stock_alerts_muted', String(newVal));
    if (!newVal) playAlertSound('warning');
  };

  const loadReport = async () => {
    setReportLoading(true);
    try {
      const res = await api.getStockDailyReport();
      if (res.success) setReport(res);
    } catch (err) {
      console.error('Erro ao carregar relatorio:', err);
    } finally {
      setReportLoading(false);
    }
  };

  const handleNewIngredient = () => {
    setEditingIngredient(null);
    setForm({ name: '', type: 'kg', currentStock: '', minAlert: '1', category: 'ingredient', defaultQuantity: '1' });
    setPortionOptions([]);
    setNewPortionLabel('');
    setNewPortionGrams('');
    setShowIngredientModal(true);
  };

  const handleEditIngredient = (ing: StockIngredient) => {
    setEditingIngredient(ing);
    setForm({
      name: ing.name,
      type: ing.type,
      currentStock: String(ing.currentStock || 0),
      minAlert: String(ing.minAlert || 1),
      category: ing.category || 'ingredient',
      defaultQuantity: String(ing.defaultQuantity || 1),
    });
    setPortionOptions(ing.portionOptions || []);
    setNewPortionLabel('');
    setNewPortionGrams('');
    setShowIngredientModal(true);
  };

  const handleAddPortion = () => {
    const grams = parseFloat(newPortionGrams);
    if (!newPortionLabel.trim() || !grams || grams <= 0) {
      alert('Informe o nome e a gramatura da porcao');
      return;
    }
    setPortionOptions([...portionOptions, {
      id: generatePortionId(),
      label: newPortionLabel.trim(),
      grams,
    }]);
    setNewPortionLabel('');
    setNewPortionGrams('');
  };

  const handleRemovePortion = (id: string) => {
    setPortionOptions(portionOptions.filter(p => p.id !== id));
  };

  const handleSaveIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      alert('Informe o nome do ingrediente');
      return;
    }

    const data: Partial<StockIngredient> = {
      ...(editingIngredient ? { id: editingIngredient.id } : {}),
      name: form.name,
      type: form.type,
      currentStock: parseFloat(form.currentStock) || 0,
      minAlert: parseFloat(form.minAlert) || 1,
      category: form.category,
      defaultQuantity: form.category === 'acompanhamento' ? (parseFloat(form.defaultQuantity) || 1) : undefined,
    };

    // Opcoes de porcao so para ingredientes tipo kg
    if (form.type === 'kg') {
      data.portionOptions = portionOptions;
    } else {
      data.portionOptions = [];
    }

    const res = await api.saveStockIngredient(data);
    if (res.success) {
      setShowIngredientModal(false);
      await loadIngredients();
    } else {
      alert('Erro ao salvar: ' + (res.error || 'Erro desconhecido'));
    }
  };

  const handleDeleteIngredient = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este ingrediente?')) return;
    const res = await api.deleteStockIngredient(id);
    if (res.success) {
      await loadIngredients();
    } else {
      alert('Erro ao excluir: ' + (res.error || ''));
    }
  };

  const handleOpenRestock = (ing: StockIngredient) => {
    setRestockTarget(ing);
    setRestockForm({ quantity: '', price: '' });
    setShowRestockModal(true);
  };

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockTarget) return;

    const quantity = parseFloat(restockForm.quantity);
    const price = parseFloat(restockForm.price);

    if (!quantity || quantity <= 0) { alert('Informe uma quantidade valida'); return; }
    if (!price || price <= 0) { alert('Informe o valor pago'); return; }

    const res = await api.restockIngredient(restockTarget.id, { quantity, price });
    if (res.success) {
      setShowRestockModal(false);
      await loadIngredients();
    } else {
      alert('Erro na reposicao: ' + (res.error || ''));
    }
  };

  const handleChangeCategory = async (ing: StockIngredient, newCategory: 'ingredient' | 'embalagem' | 'acompanhamento') => {
    const data: Partial<StockIngredient> = {
      id: ing.id,
      name: ing.name,
      type: ing.type,
      currentStock: ing.currentStock,
      minAlert: ing.minAlert,
      category: newCategory,
      defaultQuantity: newCategory === 'acompanhamento' ? (ing.defaultQuantity || 1) : undefined,
      portionOptions: ing.portionOptions || [],
    };
    const res = await api.saveStockIngredient(data);
    if (res.success) {
      await loadIngredients();
    } else {
      alert('Erro ao alterar categoria: ' + (res.error || ''));
    }
  };

  const getCategoryInfo = (cat?: string) => {
    switch (cat) {
      case 'embalagem':
        return { label: 'Embalagem', icon: BoxSelect, color: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'acompanhamento':
        return { label: 'Acompanhamento', icon: Utensils, color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
      default:
        return { label: 'Ingrediente', icon: Package, color: 'bg-gray-100 text-gray-700 border-gray-200' };
    }
  };

  const getStockStatus = (ing: StockIngredient) => {
    if (ing.currentStock <= 0) return 'empty';
    if (ing.currentStock <= ing.minAlert) return 'low';
    return 'ok';
  };

  const formatStock = (ing: StockIngredient) => {
    if (ing.type === 'kg') {
      return ing.currentStock >= 1
        ? `${ing.currentStock.toFixed(2)} kg`
        : `${(ing.currentStock * 1000).toFixed(0)} g`;
    }
    return `${Math.floor(ing.currentStock)} un`;
  };

  const lowStockCount = ingredients.filter(i => getStockStatus(i) !== 'ok').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Controle de Estoque</h2>
          <p className="text-gray-600">
            {ingredients.length} ingrediente{ingredients.length !== 1 ? 's' : ''} cadastrado{ingredients.length !== 1 ? 's' : ''}
            {lowStockCount > 0 && (
              <span className="ml-2 text-red-600 font-semibold">
                ({lowStockCount} com alerta)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleMute}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 border ${
              alertsMuted
                ? 'bg-gray-100 text-gray-500 border-gray-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
            title={alertsMuted ? 'Ativar alertas sonoros' : 'Silenciar alertas sonoros'}
          >
            {alertsMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="text-xs font-medium hidden sm:inline">
              {alertsMuted ? 'Som OFF' : 'Som ON'}
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('report'); loadReport(); }}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'report'
                ? 'bg-teal-600 text-white'
                : 'bg-white border text-gray-700 hover:bg-gray-50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Gasto do Dia
          </button>
          <button
            onClick={() => { setActiveTab('restock-schedule'); loadRestockSchedule(); }}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'restock-schedule'
                ? 'bg-orange-600 text-white'
                : 'bg-white border text-gray-700 hover:bg-gray-50'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span className="hidden sm:inline">Agenda Reposição</span>
            <span className="sm:hidden">Agenda</span>
          </button>
          <button
            onClick={() => setActiveTab('ingredients')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'ingredients'
                ? 'bg-teal-600 text-white'
                : 'bg-white border text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Package className="w-4 h-4" />
            Ingredientes
          </button>
          <button
            onClick={handleNewIngredient}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo Ingrediente
          </button>
        </div>
      </div>

      {/* Alertas de estoque baixo */}
      {lowStockCount > 0 && activeTab === 'ingredients' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700 font-semibold mb-2">
            <AlertTriangle className="w-5 h-5" />
            Alertas de Estoque
          </div>
          <div className="flex flex-wrap gap-2">
            {ingredients
              .filter(i => getStockStatus(i) !== 'ok')
              .map(ing => (
                <span
                  key={ing.id}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    getStockStatus(ing) === 'empty'
                      ? 'bg-red-200 text-red-800'
                      : 'bg-yellow-200 text-yellow-800'
                  }`}
                >
                  {ing.name}: {getStockStatus(ing) === 'empty' ? 'ZERADO' : formatStock(ing)}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* TAB: Ingredientes */}
      {activeTab === 'ingredients' && (
        <>
          {/* Filtro por categoria */}
          {ingredients.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {([
                { key: 'all' as const, label: 'Todos', icon: Package, count: ingredients.length },
                { key: 'ingredient' as const, label: 'Ingredientes', icon: Tag, count: ingredients.filter(i => !i.category || i.category === 'ingredient').length },
                { key: 'embalagem' as const, label: 'Embalagens', icon: BoxSelect, count: ingredients.filter(i => i.category === 'embalagem').length },
                { key: 'acompanhamento' as const, label: 'Acompanhamentos', icon: Utensils, count: ingredients.filter(i => i.category === 'acompanhamento').length },
              ]).map(f => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.key}
                    onClick={() => setCategoryFilter(f.key)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all border ${
                      categoryFilter === f.key
                        ? f.key === 'embalagem' ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : f.key === 'acompanhamento' ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                        : 'bg-teal-100 text-teal-800 border-teal-300'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {f.label}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      categoryFilter === f.key ? 'bg-white/60' : 'bg-gray-100'
                    }`}>{f.count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {ingredients.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">Nenhum ingrediente cadastrado.</p>
              <button
                onClick={handleNewIngredient}
                className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg"
              >
                Cadastrar Primeiro Ingrediente
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {ingredients
                .filter(ing => {
                  if (categoryFilter === 'all') return true;
                  const cat = ing.category || 'ingredient';
                  return cat === categoryFilter;
                })
                .map(ing => {
                const status = getStockStatus(ing);
                const isExpanded = expandedHistory === ing.id;
                const portions = ing.portionOptions || [];
                const catInfo = getCategoryInfo(ing.category);

                return (
                  <div
                    key={ing.id}
                    className={`bg-white border rounded-lg overflow-hidden transition-all ${
                      status === 'empty' ? 'border-red-300 bg-red-50/30' :
                      status === 'low' ? 'border-yellow-300 bg-yellow-50/30' :
                      'border-gray-200'
                    }`}
                  >
                    <div className="p-4 flex items-center gap-4">
                      {/* Icone tipo */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        ing.type === 'kg' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {ing.type === 'kg' ? <Scale className="w-5 h-5" /> : <Hash className="w-5 h-5" />}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-800 truncate">{ing.name}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            status === 'empty' ? 'bg-red-200 text-red-800' :
                            status === 'low' ? 'bg-yellow-200 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {status === 'empty' ? 'ZERADO' : status === 'low' ? 'BAIXO' : 'OK'}
                          </span>
                          {/* Badge de categoria */}
                          {(ing.category === 'embalagem' || ing.category === 'acompanhamento') && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${catInfo.color}`}>
                              {ing.category === 'embalagem' ? <BoxSelect className="w-3 h-3" /> : <Utensils className="w-3 h-3" />}
                              {catInfo.label}
                              {ing.category === 'acompanhamento' && ing.defaultQuantity && (
                                <span className="opacity-75">({ing.defaultQuantity}/pedido)</span>
                              )}
                            </span>
                          )}
                          {/* Badges de opcoes de porcao */}
                          {portions.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-200">
                              {portions.length} {portions.length === 1 ? 'porcao' : 'porcoes'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                          <span className="font-semibold text-lg text-gray-800">
                            {formatStock(ing)}
                          </span>
                          {/* Mostrar opcoes de porcao inline */}
                          {portions.length > 0 && (
                            <span className="text-xs text-gray-500">
                              ({portions.map(p => `${p.label}: ${p.grams}g`).join(' | ')})
                            </span>
                          )}
                          {ing.type === 'kg' && ing.pricePerKg && (
                            <span className="text-green-600">R$ {ing.pricePerKg.toFixed(2)}/kg</span>
                          )}
                          {ing.type === 'unit' && ing.pricePerUnit && (
                            <span className="text-green-600">R$ {ing.pricePerUnit.toFixed(2)}/un</span>
                          )}
                        </div>
                      </div>

                      {/* Acoes */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleOpenRestock(ing)}
                          className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                          title="Repor Estoque"
                        >
                          <PackagePlus className="w-5 h-5 text-green-600" />
                        </button>
                        <button
                          onClick={() => setExpandedHistory(isExpanded ? null : ing.id)}
                          className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Historico de Compras"
                        >
                          <History className="w-5 h-5 text-blue-600" />
                        </button>
                        <button
                          onClick={() => handleEditIngredient(ing)}
                          className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-5 h-5 text-blue-600" />
                        </button>
                        <button
                          onClick={() => handleDeleteIngredient(ing.id)}
                          className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-5 h-5 text-red-600" />
                        </button>
                      </div>
                    </div>

                    {/* Historico de Compras expandido */}
                    {isExpanded && (
                      <div className="border-t bg-gray-50 p-4">
                        <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <History className="w-4 h-4" />
                          Historico de Compras
                        </h4>
                        {(!ing.purchaseHistory || ing.purchaseHistory.length === 0) ? (
                          <p className="text-sm text-gray-500 italic">Nenhuma compra registrada.</p>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {[...ing.purchaseHistory].reverse().map((entry, idx) => (
                              <div
                                key={entry.id || idx}
                                className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm border"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-gray-500">
                                    {formatBrasiliaDate(entry.date, true)}
                                  </span>
                                  <span className="font-medium text-gray-800">
                                    {ing.type === 'kg'
                                      ? `${entry.quantity >= 1 ? entry.quantity.toFixed(2) + ' kg' : (entry.quantity * 1000).toFixed(0) + ' g'}`
                                      : `${entry.quantity} un`
                                    }
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-bold text-green-700">
                                    R$ {entry.price.toFixed(2)}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    ({ing.type === 'kg'
                                      ? `R$ ${(entry.price / entry.quantity).toFixed(2)}/kg`
                                      : `R$ ${(entry.price / entry.quantity).toFixed(2)}/un`
                                    })
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {ingredients
                .filter(ing => {
                  if (categoryFilter === 'all') return true;
                  const cat = ing.category || 'ingredient';
                  return cat === categoryFilter;
                }).length === 0 && categoryFilter !== 'all' && (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-500 text-sm">
                    Nenhum item na categoria <strong>{categoryFilter === 'embalagem' ? 'Embalagens' : categoryFilter === 'acompanhamento' ? 'Acompanhamentos' : 'Ingredientes'}</strong>.
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Edite um ingrediente para alterar sua categoria.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* TAB: Relatorio do Dia */}
      {activeTab === 'report' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold">Gasto do Dia Operacional</h3>
                <p className="text-teal-200 text-sm">Desde as 4h da manha (horario de Brasilia)</p>
              </div>
              <button
                onClick={loadReport}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${reportLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {report && (
              <div className="text-4xl font-bold">
                R$ {report.totalDayCost?.toFixed(2) || '0.00'}
              </div>
            )}
          </div>

          {reportLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-8 h-8 animate-spin text-teal-600" />
            </div>
          ) : report?.report ? (
            <div className="bg-white rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold text-gray-700">Ingrediente</th>
                    <th className="text-center p-3 font-semibold text-gray-700">Tipo</th>
                    <th className="text-right p-3 font-semibold text-gray-700">Consumido</th>
                    <th className="text-right p-3 font-semibold text-gray-700">Custo</th>
                    <th className="text-right p-3 font-semibold text-gray-700">Restante</th>
                  </tr>
                </thead>
                <tbody>
                  {report.report
                    .filter((r: any) => r.consumed > 0)
                    .map((r: any) => (
                    <tr key={r.ingredientId} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-800">{r.ingredientName}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          r.type === 'kg' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {r.type === 'kg' ? 'Kg' : 'Un'}
                        </span>
                      </td>
                      <td className="p-3 text-right text-red-600 font-semibold">
                        -{r.type === 'kg'
                          ? (r.consumed >= 1 ? `${r.consumed.toFixed(2)} kg` : `${(r.consumed * 1000).toFixed(0)} g`)
                          : `${r.consumed} un`
                        }
                      </td>
                      <td className="p-3 text-right text-red-600 font-bold">
                        R$ {r.cost.toFixed(2)}
                      </td>
                      <td className="p-3 text-right">
                        <span className={`font-semibold ${r.remaining <= 0 ? 'text-red-600' : 'text-gray-800'}`}>
                          {r.type === 'kg'
                            ? (r.remaining >= 1 ? `${r.remaining.toFixed(2)} kg` : `${(r.remaining * 1000).toFixed(0)} g`)
                            : `${Math.floor(r.remaining)} un`
                          }
                        </span>
                      </td>
                    </tr>
                  ))}
                  {report.report.filter((r: any) => r.consumed > 0).length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-gray-500 italic">
                        Nenhum consumo registrado hoje.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Clique em atualizar para carregar o relatorio.
            </div>
          )}
        </div>
      )}

      {/* TAB: Agenda de Reposição Semanal */}
      {activeTab === 'restock-schedule' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <CalendarDays className="w-6 h-6" />
                  Agenda de Reposição Semanal
                </h3>
                <p className="text-orange-100 text-sm mt-1">
                  Defina quais ingredientes devem ser repostos em cada dia da semana
                </p>
              </div>
              <button
                onClick={loadRestockSchedule}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-colors"
                title="Recarregar agenda"
              >
                <RefreshCw className={`w-5 h-5 ${scheduleLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {scheduleSaving && (
              <div className="flex items-center gap-2 text-orange-100 text-sm mt-2">
                <Loader className="w-4 h-4 animate-spin" />
                Salvando...
              </div>
            )}
          </div>

          {scheduleLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-orange-600" />
            </div>
          ) : ingredients.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Cadastre ingredientes primeiro para criar a agenda de reposição.</p>
            </div>
          ) : (
            <>
              {/* Seletor de dias */}
              <div className="grid grid-cols-7 gap-2">
                {WEEK_DAYS.map(day => {
                  const isToday = getTodayKey() === day.key;
                  const count = (restockSchedule[day.key] || []).length;
                  const isSelected = scheduleSelectedDay === day.key;
                  return (
                    <button
                      key={day.key}
                      onClick={() => setScheduleSelectedDay(isSelected ? '' : day.key)}
                      className={`relative p-3 rounded-xl border-2 transition-all text-center ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50 shadow-md'
                          : isToday
                          ? 'border-orange-300 bg-orange-50/50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      {isToday && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                          HOJE
                        </span>
                      )}
                      <div className={`font-bold text-sm ${isSelected ? 'text-orange-700' : 'text-gray-800'}`}>
                        {day.short}
                      </div>
                      <div className={`text-xs mt-0.5 ${isSelected ? 'text-orange-600' : 'text-gray-500'}`}>
                        {day.label}
                      </div>
                      {count > 0 && (
                        <div className={`mt-1.5 text-xs font-bold rounded-full px-2 py-0.5 ${
                          isSelected ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700'
                        }`}>
                          {count} {count === 1 ? 'item' : 'itens'}
                        </div>
                      )}
                      {count === 0 && (
                        <div className="mt-1.5 text-xs text-gray-400">—</div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Painel de ingredientes para o dia selecionado */}
              {scheduleSelectedDay && (
                <div className="bg-white border border-orange-200 rounded-xl overflow-hidden">
                  <div className="bg-orange-50 border-b border-orange-200 px-4 py-3">
                    <h4 className="font-bold text-orange-800 flex items-center gap-2">
                      <CalendarDays className="w-4 h-4" />
                      {WEEK_DAYS.find(d => d.key === scheduleSelectedDay)?.label} — Ingredientes para Repor
                    </h4>
                    <p className="text-xs text-orange-600 mt-0.5">
                      Clique para marcar/desmarcar os ingredientes que precisam ser repostos neste dia
                    </p>
                  </div>
                  <div className="p-3 space-y-1.5 max-h-96 overflow-y-auto">
                    {ingredients.map(ing => {
                      const isOnDay = (restockSchedule[scheduleSelectedDay] || []).includes(ing.id);
                      const status = getStockStatus(ing);
                      const days = getIngredientDays(ing.id);
                      return (
                        <button
                          key={ing.id}
                          onClick={() => toggleIngredientOnDay(scheduleSelectedDay, ing.id)}
                          disabled={scheduleSaving}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                            isOnDay
                              ? 'border-orange-400 bg-orange-50 shadow-sm'
                              : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                          } ${scheduleSaving ? 'opacity-60' : ''}`}
                        >
                          {/* Checkbox visual */}
                          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            isOnDay
                              ? 'border-orange-500 bg-orange-500'
                              : 'border-gray-300 bg-white'
                          }`}>
                            {isOnDay && <Check className="w-4 h-4 text-white" />}
                          </div>

                          {/* Icone tipo */}
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            ing.type === 'kg' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {ing.type === 'kg' ? <Scale className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium text-sm truncate ${isOnDay ? 'text-orange-800' : 'text-gray-800'}`}>
                                {ing.name}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                status === 'empty' ? 'bg-red-200 text-red-800' :
                                status === 'low' ? 'bg-yellow-200 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {status === 'empty' ? 'ZERADO' : status === 'low' ? 'BAIXO' : 'OK'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-500">
                                Estoque: {formatStock(ing)}
                              </span>
                              {days.length > 0 && (
                                <span className="text-[10px] text-orange-600 font-medium">
                                  Repor: {days.join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Resumo geral — mostra todos os ingredientes e seus dias */}
              {!scheduleSelectedDay && (
                <div className="bg-white border rounded-xl overflow-hidden">
                  <div className="bg-gray-50 border-b px-4 py-3">
                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Resumo — Dias de Reposição por Ingrediente
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Selecione um dia acima para editar a agenda
                    </p>
                  </div>
                  <div className="divide-y">
                    {ingredients.map(ing => {
                      const days = getIngredientDays(ing.id);
                      const status = getStockStatus(ing);
                      return (
                        <div key={ing.id} className="flex items-center gap-3 px-4 py-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            ing.type === 'kg' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {ing.type === 'kg' ? <Scale className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800 text-sm truncate">{ing.name}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                status === 'empty' ? 'bg-red-200 text-red-800' :
                                status === 'low' ? 'bg-yellow-200 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {formatStock(ing)}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            {days.length > 0 ? (
                              days.map(d => (
                                <span key={d} className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-md">
                                  {d}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400 italic">Sem agenda</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Visão do dia de hoje — destaque */}
              {(() => {
                const todayKey = getTodayKey();
                const todayIngredients = (restockSchedule[todayKey] || [])
                  .map(id => ingredients.find(i => i.id === id))
                  .filter(Boolean) as StockIngredient[];
                const todayLabel = WEEK_DAYS.find(d => d.key === todayKey)?.label || '';

                if (todayIngredients.length === 0) return null;

                return (
                  <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4">
                    <h4 className="font-bold text-orange-800 flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5" />
                      Reposição de Hoje ({todayLabel})
                    </h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {todayIngredients.map(ing => {
                        const status = getStockStatus(ing);
                        return (
                          <div key={ing.id} className={`flex items-center gap-3 bg-white rounded-lg px-3 py-2.5 border ${
                            status === 'empty' ? 'border-red-300' :
                            status === 'low' ? 'border-yellow-300' : 'border-gray-200'
                          }`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              ing.type === 'kg' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                            }`}>
                              {ing.type === 'kg' ? <Scale className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-gray-800 text-sm">{ing.name}</span>
                              <div className="text-xs text-gray-500">Estoque: {formatStock(ing)}</div>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              status === 'empty' ? 'bg-red-200 text-red-800' :
                              status === 'low' ? 'bg-yellow-200 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {status === 'empty' ? 'ZERADO' : status === 'low' ? 'BAIXO' : 'OK'}
                            </span>
                            <button
                              onClick={() => handleOpenRestock(ing)}
                              className="p-1.5 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
                              title="Repor agora"
                            >
                              <PackagePlus className="w-4 h-4 text-green-700" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Modal: Novo/Editar Ingrediente */}
      {showIngredientModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setShowIngredientModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-teal-600 text-white p-4 flex items-center justify-between">
                <h3 className="text-xl font-bold">
                  {editingIngredient ? 'Editar Ingrediente' : 'Novo Ingrediente'}
                </h3>
                <button onClick={() => setShowIngredientModal(false)} className="hover:bg-teal-700 p-1 rounded">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSaveIngredient} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white text-gray-900"
                    placeholder="Ex: Carne Bovina"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Controle *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: 'kg' })}
                      className={`p-3 rounded-lg border-2 transition-all flex items-center gap-2 ${
                        form.type === 'kg'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <Scale className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-semibold">Por Quilo</div>
                        <div className="text-xs opacity-75">kg, g, porcoes</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: 'unit' })}
                      className={`p-3 rounded-lg border-2 transition-all flex items-center gap-2 ${
                        form.type === 'unit'
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <Hash className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-semibold">Por Unidade</div>
                        <div className="text-xs opacity-75">unidades inteiras</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Categoria */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, category: 'ingredient' })}
                      className={`p-2.5 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                        form.category === 'ingredient'
                          ? 'border-teal-500 bg-teal-50 text-teal-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <Tag className="w-4 h-4" />
                      <div className="text-xs font-semibold">Ingrediente</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, category: 'embalagem' })}
                      className={`p-2.5 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                        form.category === 'embalagem'
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <BoxSelect className="w-4 h-4" />
                      <div className="text-xs font-semibold">Embalagem</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, category: 'acompanhamento' })}
                      className={`p-2.5 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                        form.category === 'acompanhamento'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <Utensils className="w-4 h-4" />
                      <div className="text-xs font-semibold">Acompanhamento</div>
                    </button>
                  </div>
                  {form.category === 'embalagem' && (
                    <p className="text-xs text-amber-600 mt-1">Embalagens são automaticamente ocultadas do cliente e adicionadas em lote aos produtos.</p>
                  )}
                  {form.category === 'acompanhamento' && (
                    <p className="text-xs text-indigo-600 mt-1">Acompanhamentos são automaticamente ocultados do cliente e adicionados com quantidade padrão.</p>
                  )}
                </div>

                {/* Quantidade padrão por pedido — só acompanhamentos */}
                {form.category === 'acompanhamento' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantidade Padrão por Pedido
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={form.defaultQuantity}
                      onChange={e => setForm({ ...form, defaultQuantity: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900"
                      placeholder="1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Ex: 1 sachê de ketchup por pedido, ou 0.05 kg de molho por pedido
                    </p>
                  </div>
                )}

                {/* Estoque e Alerta */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estoque Atual ({form.type === 'kg' ? 'kg' : 'unidades'})
                    </label>
                    <input
                      type="number"
                      step={form.type === 'kg' ? '0.01' : '1'}
                      value={form.currentStock}
                      onChange={e => setForm({ ...form, currentStock: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white text-gray-900"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Alerta Minimo ({form.type === 'kg' ? 'kg' : 'un'})
                    </label>
                    <input
                      type="number"
                      step={form.type === 'kg' ? '0.01' : '1'}
                      value={form.minAlert}
                      onChange={e => setForm({ ...form, minAlert: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white text-gray-900"
                      placeholder="1"
                    />
                  </div>
                </div>

                {/* Opcoes de Porcao — so para tipo kg */}
                {form.type === 'kg' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">
                        Opcoes de Porcao
                        <span className="text-xs text-gray-400 font-normal ml-1">(opcional)</span>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 -mt-1">
                      Defina diferentes tamanhos de porcao. Na ficha tecnica do produto, voce escolhe qual usar.
                    </p>

                    {/* Lista de porcoes existentes */}
                    {portionOptions.length > 0 && (
                      <div className="space-y-2">
                        {portionOptions.map(p => (
                          <div key={p.id} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                            <Scale className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            <span className="flex-1 font-medium text-gray-800 text-sm">{p.label}</span>
                            <span className="text-sm text-blue-600 font-bold">{p.grams}g</span>
                            <span className="text-xs text-gray-400">
                              ({Math.round(1000 / p.grams)} porcoes/kg)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemovePortion(p.id)}
                              className="text-red-500 hover:text-red-700 p-0.5"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Adicionar nova porcao */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newPortionLabel}
                        onChange={e => setNewPortionLabel(e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
                        placeholder="Nome (ex: Hamburguer 120g)"
                      />
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={newPortionGrams}
                          onChange={e => setNewPortionGrams(e.target.value)}
                          className="w-24 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 pr-8"
                          placeholder="120"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">g</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddPortion}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {newPortionGrams && parseFloat(newPortionGrams) > 0 && (
                      <p className="text-xs text-blue-600 flex items-center gap-1">
                        <ArrowRight className="w-3 h-3" />
                        {parseFloat(newPortionGrams)}g por porcao = <b>{Math.round(1000 / parseFloat(newPortionGrams))} porcoes</b> por kg
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowIngredientModal(false)}
                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {editingIngredient ? 'Atualizar' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Modal: Reposicao de Estoque */}
      {showRestockModal && restockTarget && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setShowRestockModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="bg-green-600 text-white p-4 flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <PackagePlus className="w-5 h-5" />
                  Repor Estoque
                </h3>
                <button onClick={() => setShowRestockModal(false)} className="hover:bg-green-700 p-1 rounded">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleRestock} className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-semibold text-gray-800">{restockTarget.name}</p>
                  <p className="text-sm text-gray-600">
                    Estoque atual: <span className="font-bold">{formatStock(restockTarget)}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantidade Comprada ({restockTarget.type === 'kg' ? 'kg' : 'unidades'}) *
                  </label>
                  <input
                    type="number"
                    step={restockTarget.type === 'kg' ? '0.01' : '1'}
                    value={restockForm.quantity}
                    onChange={e => setRestockForm({ ...restockForm, quantity: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white text-gray-900"
                    placeholder={restockTarget.type === 'kg' ? 'Ex: 2.5' : 'Ex: 24'}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor Total Pago (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={restockForm.price}
                    onChange={e => setRestockForm({ ...restockForm, price: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white text-gray-900"
                    placeholder="Ex: 45.00"
                    required
                  />
                  {restockForm.quantity && restockForm.price && (
                    <p className="text-xs text-green-600 mt-1 font-medium">
                      = R$ {(parseFloat(restockForm.price) / parseFloat(restockForm.quantity)).toFixed(2)}/
                      {restockTarget.type === 'kg' ? 'kg' : 'un'}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowRestockModal(false)}
                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <PackagePlus className="w-4 h-4" />
                    Confirmar Reposicao
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}