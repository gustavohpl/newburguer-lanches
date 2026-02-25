import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, ShieldAlert, ShieldCheck, Globe, Wifi, WifiOff, Activity,
  TrendingUp, TrendingDown, Users, Lock, Eye, AlertTriangle, BarChart3,
  RefreshCw, Clock, MapPin, Zap, Bell, BellOff, Plus, Trash2, Save,
  CheckCircle2, XCircle, Send, ChevronDown, ChevronUp, ExternalLink,
  Loader2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from 'recharts';

interface SecurityMetrics {
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
  uniqueIps: number;
  vpnDetections: number;
  webrtcLeaks: number;
  blacklistedIps: number;
  whitelistedIps: number;
  avgReputationScore: number;
  topThreats: { ip: string; score: number; tier: string }[];
  eventTimeline: { hour: string; success: number; failure: number; vpn: number }[];
  geoDistribution: { country: string; count: number }[];
  threatDistribution: { tier: string; count: number }[];
  securityHealthScore: number;
  generatedAt: string;
}

interface WebhookConfig {
  id: string;
  type: 'generic' | 'telegram' | 'discord';
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
  lastTriggered?: string;
  failCount: number;
  telegramChatId?: string;
}

interface WebhookLog {
  id: string;
  webhookId: string;
  event: string;
  status: 'success' | 'failure';
  statusCode?: number;
  error?: string;
  timestamp: string;
}

interface SecurityDashboardProps {
  fetchFn: (endpoint: string, options?: RequestInit) => Promise<Response>;
}

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  trusted:    { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300' },
  neutral:    { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300' },
  suspicious: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  dangerous:  { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  critical:   { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300' },
};

const PIE_COLORS = ['#22c55e', '#3b82f6', '#eab308', '#f97316', '#ef4444'];
const TIER_LABELS: Record<string, string> = {
  trusted: 'Confiavel', neutral: 'Neutro', suspicious: 'Suspeito', dangerous: 'Perigoso', critical: 'Critico'
};

const EVENT_LABELS: Record<string, string> = {
  vpn_detected: 'VPN Detectada',
  brute_force: 'Forca Bruta',
  ip_blocked: 'IP Bloqueado',
  high_threat_score: 'Ameaca Alta',
  webrtc_leak: 'WebRTC Leak',
  fingerprint_hopping: 'Fingerprint Hopping',
  login_failure: 'Login Falhou',
  auto_blacklist: 'Auto-Blacklist',
  timezone_mismatch: 'Timezone Mismatch',
  new_ip_critical: 'IP Critico Novo',
  test_webhook: 'Teste',
};

export function SecurityDashboard({ fetchFn }: SecurityDashboardProps) {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'webhooks' | 'threats'>('overview');
  
  // Webhook state
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [newWebhook, setNewWebhook] = useState({ type: 'generic' as const, url: '', events: [] as string[], telegramChatId: '' });
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFn('/master/security/analytics');
      const data = await res.json();
      if (data.success && data.metrics) {
        setMetrics(data.metrics);
      } else {
        setError(data.error || 'Erro ao carregar metricas');
      }
    } catch (e: any) {
      setError(e?.message || 'Erro de conexao');
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  const loadWebhooks = useCallback(async () => {
    setWebhookLoading(true);
    try {
      const [configRes, logsRes] = await Promise.all([
        fetchFn('/master/webhooks/config'),
        fetchFn('/master/webhooks/logs'),
      ]);
      const configData = await configRes.json();
      const logsData = await logsRes.json();
      if (configData.success) {
        setWebhooks(configData.webhooks || []);
        setAvailableEvents(configData.availableEvents || []);
      }
      if (logsData.success) {
        setWebhookLogs(logsData.logs || []);
      }
    } catch (e) {
      console.error('Erro ao carregar webhooks:', e);
    } finally {
      setWebhookLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    if (activeSection === 'webhooks') loadWebhooks();
  }, [activeSection, loadWebhooks]);

  const saveWebhooks = async (updated: WebhookConfig[]) => {
    setWebhookSaving(true);
    try {
      const res = await fetchFn('/master/webhooks/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhooks: updated }),
      });
      const data = await res.json();
      if (data.success) {
        setWebhooks(updated);
      }
    } catch (e) {
      console.error('Erro ao salvar webhooks:', e);
    } finally {
      setWebhookSaving(false);
    }
  };

  const addWebhook = async () => {
    if (!newWebhook.url || newWebhook.events.length === 0) return;
    const wh: WebhookConfig = {
      id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: newWebhook.type,
      url: newWebhook.url,
      events: newWebhook.events,
      enabled: true,
      createdAt: new Date().toISOString(),
      failCount: 0,
      telegramChatId: newWebhook.telegramChatId || undefined,
    };
    const updated = [...webhooks, wh];
    await saveWebhooks(updated);
    setNewWebhook({ type: 'generic', url: '', events: [], telegramChatId: '' });
    setShowAddWebhook(false);
  };

  const removeWebhook = async (id: string) => {
    const updated = webhooks.filter(w => w.id !== id);
    await saveWebhooks(updated);
  };

  const toggleWebhook = async (id: string) => {
    const updated = webhooks.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w);
    await saveWebhooks(updated);
  };

  const testWebhook = async (id: string) => {
    setTestingWebhook(id);
    try {
      await fetchFn('/master/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookId: id }),
      });
    } catch (e) {
      console.error('Erro ao testar webhook:', e);
    } finally {
      setTimeout(() => setTestingWebhook(null), 1000);
    }
  };

  const toggleEvent = (event: string) => {
    setNewWebhook(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-500">Carregando analytics de seguranca...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-700 font-semibold">{error}</p>
        <button onClick={loadMetrics} className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition">
          Tentar Novamente
        </button>
      </div>
    );
  }

  if (!metrics) return null;

  const healthColor = metrics.securityHealthScore >= 80 ? 'text-green-600' :
    metrics.securityHealthScore >= 50 ? 'text-yellow-600' : 'text-red-600';
  const healthBg = metrics.securityHealthScore >= 80 ? 'bg-green-500' :
    metrics.securityHealthScore >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex gap-2 bg-white rounded-xl p-2 shadow-sm border border-gray-200">
        {[
          { id: 'overview' as const, label: 'Visao Geral', icon: BarChart3 },
          { id: 'threats' as const, label: 'Top Ameacas', icon: ShieldAlert },
          { id: 'webhooks' as const, label: 'Webhooks', icon: Bell },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all ${
              activeSection === tab.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW SECTION ===== */}
      {activeSection === 'overview' && (
        <>
          {/* Health Score Hero */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Security Health Score
              </h3>
              <button onClick={loadMetrics} className="text-gray-400 hover:text-gray-600 transition">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative w-28 h-28">
                <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke={metrics.securityHealthScore >= 80 ? '#22c55e' : metrics.securityHealthScore >= 50 ? '#eab308' : '#ef4444'}
                    strokeWidth="8"
                    strokeDasharray={`${metrics.securityHealthScore * 2.64} 264`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-2xl font-black ${healthColor}`}>{metrics.securityHealthScore}</span>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricCard icon={Users} label="IPs Unicos" value={metrics.uniqueIps} color="blue" />
                <MetricCard icon={Lock} label="Logins OK" value={metrics.successfulLogins} color="green" />
                <MetricCard icon={AlertTriangle} label="Logins Falhos" value={metrics.failedLogins} color="red" />
                <MetricCard icon={WifiOff} label="VPNs" value={metrics.vpnDetections} color="orange" />
              </div>
            </div>
          </div>

          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard icon={Eye} label="WebRTC Leaks" value={metrics.webrtcLeaks} color="purple" />
            <KpiCard icon={ShieldAlert} label="IPs Bloqueados" value={metrics.blacklistedIps} color="red" />
            <KpiCard icon={ShieldCheck} label="IPs Whitelist" value={metrics.whitelistedIps} color="green" />
            <KpiCard icon={Activity} label="Score Medio" value={metrics.avgReputationScore} color="blue" suffix="/100" />
          </div>

          {/* Timeline Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Timeline de Eventos (24h)
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={metrics.eventTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Legend />
                <Area type="monotone" dataKey="success" name="Sucesso" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
                <Area type="monotone" dataKey="failure" name="Falha" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                <Area type="monotone" dataKey="vpn" name="VPN" stackId="2" stroke="#f97316" fill="#f97316" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Geo + Threat Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Geo Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-600" />
                Distribuicao Geografica (7d)
              </h3>
              {metrics.geoDistribution.length > 0 ? (
                <div className="space-y-2">
                  {metrics.geoDistribution.slice(0, 8).map((geo, i) => {
                    const max = metrics.geoDistribution[0].count || 1;
                    return (
                      <div key={geo.country} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-5 text-right">{i + 1}.</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="font-medium text-gray-700">{geo.country}</span>
                            <span className="text-gray-400">{geo.count}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${(geo.count / max) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">Sem dados geograficos</p>
              )}
            </div>

            {/* Threat Distribution Pie */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                Distribuicao de Ameacas
              </h3>
              {metrics.threatDistribution.some(t => t.count > 0) ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={metrics.threatDistribution.filter(t => t.count > 0)}
                      dataKey="count"
                      nameKey="tier"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      label={({ tier, count }: any) => `${TIER_LABELS[tier] || tier}: ${count}`}
                    >
                      {metrics.threatDistribution.filter(t => t.count > 0).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px]">
                  <div className="text-center">
                    <ShieldCheck className="w-10 h-10 text-green-400 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Nenhuma ameaca registrada</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-400 text-right">
            Gerado em: {new Date(metrics.generatedAt).toLocaleString('pt-BR')}
          </p>
        </>
      )}

      {/* ===== THREATS SECTION ===== */}
      {activeSection === 'threats' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            Top IPs por Ameaca
          </h3>
          {metrics.topThreats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-gray-500 font-semibold">#</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-semibold">IP</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-semibold">Score</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-semibold">Tier</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-semibold">Barra</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.topThreats.map((threat, i) => {
                    const tc = TIER_COLORS[threat.tier] || TIER_COLORS.neutral;
                    return (
                      <tr key={threat.ip} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2.5 px-3 text-gray-400 font-mono">{i + 1}</td>
                        <td className="py-2.5 px-3 font-mono text-gray-800">{threat.ip}</td>
                        <td className="py-2.5 px-3">
                          <span className={`font-bold ${threat.score >= 80 ? 'text-red-600' : threat.score >= 50 ? 'text-orange-600' : 'text-yellow-600'}`}>
                            {threat.score}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tc.bg} ${tc.text} border ${tc.border}`}>
                            {TIER_LABELS[threat.tier] || threat.tier}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 w-40">
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                threat.score >= 80 ? 'bg-red-500' : threat.score >= 50 ? 'bg-orange-500' : 'bg-yellow-500'
                              }`}
                              style={{ width: `${threat.score}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <ShieldCheck className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-500 font-semibold">Nenhuma ameaca detectada</p>
              <p className="text-gray-400 text-sm mt-1">Todos os IPs estao com reputacao normal</p>
            </div>
          )}
        </div>
      )}

      {/* ===== WEBHOOKS SECTION ===== */}
      {activeSection === 'webhooks' && (
        <div className="space-y-6">
          {/* Configured Webhooks */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600" />
                Webhooks Configurados
              </h3>
              <button
                onClick={() => setShowAddWebhook(!showAddWebhook)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            </div>

            {/* Add Webhook Form */}
            {showAddWebhook && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    value={newWebhook.type}
                    onChange={e => setNewWebhook(prev => ({ ...prev, type: e.target.value as any }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="generic">Generic POST</option>
                    <option value="telegram">Telegram Bot</option>
                    <option value="discord">Discord</option>
                  </select>
                  <input
                    type="url"
                    placeholder={newWebhook.type === 'telegram' ? 'https://api.telegram.org/bot.../sendMessage' : 'URL do Webhook'}
                    value={newWebhook.url}
                    onChange={e => setNewWebhook(prev => ({ ...prev, url: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm col-span-2"
                  />
                </div>
                {newWebhook.type === 'telegram' && (
                  <input
                    type="text"
                    placeholder="Chat ID do Telegram"
                    value={newWebhook.telegramChatId}
                    onChange={e => setNewWebhook(prev => ({ ...prev, telegramChatId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                )}
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">Eventos:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableEvents.map(ev => (
                      <button
                        key={ev}
                        onClick={() => toggleEvent(ev)}
                        className={`px-2 py-1 text-xs rounded-full border font-medium transition ${
                          newWebhook.events.includes(ev)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {EVENT_LABELS[ev] || ev}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAddWebhook(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
                    Cancelar
                  </button>
                  <button
                    onClick={addWebhook}
                    disabled={!newWebhook.url || newWebhook.events.length === 0}
                    className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Salvar
                  </button>
                </div>
              </div>
            )}

            {/* Webhook List */}
            {webhookLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : webhooks.length > 0 ? (
              <div className="space-y-3">
                {webhooks.map(wh => (
                  <div key={wh.id} className={`border rounded-lg p-3 transition ${wh.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleWebhook(wh.id)}
                          className={`w-9 h-5 rounded-full transition-colors relative ${wh.enabled ? 'bg-blue-500' : 'bg-gray-300'}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${wh.enabled ? 'left-4.5' : 'left-0.5'}`} />
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase ${
                              wh.type === 'telegram' ? 'bg-blue-100 text-blue-700' :
                              wh.type === 'discord' ? 'bg-purple-100 text-purple-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {wh.type}
                            </span>
                            <span className="text-xs text-gray-500 font-mono truncate max-w-[200px]">{wh.url}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            {wh.events.slice(0, 3).map(ev => (
                              <span key={ev} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                {EVENT_LABELS[ev] || ev}
                              </span>
                            ))}
                            {wh.events.length > 3 && (
                              <span className="text-[10px] text-gray-400">+{wh.events.length - 3}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {wh.failCount > 0 && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">
                            {wh.failCount} falhas
                          </span>
                        )}
                        <button
                          onClick={() => testWebhook(wh.id)}
                          disabled={testingWebhook === wh.id}
                          className="p-1.5 text-gray-400 hover:text-blue-600 transition"
                          title="Testar"
                        >
                          {testingWebhook === wh.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => removeWebhook(wh.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition"
                          title="Remover"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <BellOff className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Nenhum webhook configurado</p>
                <p className="text-gray-300 text-xs mt-1">Clique em "Adicionar" para configurar notificacoes</p>
              </div>
            )}
          </div>

          {/* Webhook Logs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-600" />
              Historico de Dispatches
            </h3>
            {webhookLogs.length > 0 ? (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {webhookLogs.slice(0, 30).map(log => (
                  <div key={log.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-xs">
                    <div className="flex items-center gap-2">
                      {log.status === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                      )}
                      <span className="font-medium text-gray-700">{EVENT_LABELS[log.event] || log.event}</span>
                      {log.statusCode && <span className="text-gray-400">HTTP {log.statusCode}</span>}
                    </div>
                    <span className="text-gray-400">{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-6">Nenhum dispatch registrado</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    orange: 'bg-orange-100 text-orange-600',
  };
  return (
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.blue}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-lg font-black text-gray-800">{value}</p>
        <p className="text-[10px] text-gray-400 font-medium">{label}</p>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color, suffix }: { icon: any; label: string; value: number; color: string; suffix?: string }) {
  const colorMap: Record<string, { bg: string; icon: string; border: string }> = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-500',   border: 'border-blue-200' },
    green:  { bg: 'bg-green-50',  icon: 'text-green-500',  border: 'border-green-200' },
    red:    { bg: 'bg-red-50',    icon: 'text-red-500',    border: 'border-red-200' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-500', border: 'border-purple-200' },
    orange: { bg: 'bg-orange-50', icon: 'text-orange-500', border: 'border-orange-200' },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4`}>
      <Icon className={`w-5 h-5 ${c.icon} mb-2`} />
      <p className="text-xl font-black text-gray-800">{value}{suffix || ''}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
