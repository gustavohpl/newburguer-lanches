import { useEffect, useState } from 'react';
import { masterFetch } from '../../utils/api';
import { 
  ShieldAlert, Check, X, FileText, Package, Tag, User, Calendar, 
  Filter, Globe, Monitor, MapPin, ChevronDown, ChevronUp, Truck,
  AlertTriangle, Ban, Wifi, Shield, Clock, Languages, Fingerprint,
  Bell, ShieldCheck, Trash2, RotateCcw, Crosshair, Activity
} from 'lucide-react';
import { AuditMap } from './AuditMap';
import { IpBlacklist } from '../master/IpBlacklist';
import { SecurityAlerts } from '../master/SecurityAlerts';

interface GeoInfo {
  country?: string;
  region?: string;
  city?: string;
  district?: string;
  zip?: string;
  lat?: number | null;
  lon?: number | null;
  timezone?: string;
  isp?: string;
  org?: string;
  asn?: string;
  isVpn?: boolean;
  isProxy?: boolean;
  isHosting?: boolean;
  // Multi-source v3 (Precision Engine)
  geoSources?: number;
  geoSourcesAgree?: number;
  geoSourceList?: string;
  geoConfidence?: string;
  geoAccuracy?: string;
  geoMaxDivergence?: number;
  geoAvgDivergence?: number;
  geoGlobalDivergence?: number;
  geoWeightedAvg?: boolean;
  geoOutliers?: number;
  geoOutlierSources?: string | null;
  geoVpnSources?: string | null;
  geoSourceDetails?: Array<{ source: string; city: string; lat: number; lon: number; distToAvg: number; inCluster: boolean; weight: number; effectiveWeight?: number; refined?: boolean; vpn: boolean; zip?: string; countryFiltered?: boolean }>;
  source?: string;
  // v3 — Precision Engine
  geoZipConfirmed?: boolean;
  geoConfirmedZip?: string | null;
  geoIspType?: string;
  geoRansacRefined?: number;
  geoCountryFiltered?: number;
  // v4.1 — Precisao em metros
  geoEstimatedAccuracyM?: number;
  geoP68RadiusM?: number;
  geoP95RadiusM?: number;
  geoMaxRadiusM?: number;
  geoIwcrRounds?: number;
  geoIwcrConvergenceDeltaM?: number;
  geoEngineVersion?: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  username: string;
  ip: string;
  details: string;
  status: 'success' | 'failure';
  userAgent?: string;
  geo?: GeoInfo | null;
  resource?: string;
  resourceId?: string;
  // WebRTC Leak Detection
  realIp?: string | null;
  realGeo?: GeoInfo | null;
  webrtcLeak?: boolean;
  // Browser Fingerprint (segunda camada)
  browserInfo?: {
    timezone?: string;
    timezoneOffset?: number;
    language?: string;
    languages?: string[];
    screen?: string;
    platform?: string;
    localTime?: string;
  } | null;
  timezoneMismatch?: boolean;
  languageMismatch?: boolean;
  mismatchDetails?: string;
  // Whitelist
  whitelisted?: boolean;
}

interface AuditLogsProps {
  /** Funcao de fetch customizada (default: masterFetch) */
  fetchFn?: (url: string, options?: RequestInit) => Promise<Response>;
  /** Endpoint base (default: /master/audit-logs) */
  endpoint?: string;
}

export function AuditLogs({ fetchFn = masterFetch, endpoint = '/master/audit-logs' }: AuditLogsProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [filterAction, setFilterAction] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'logs' | 'blacklist' | 'alerts'>('logs');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let url = `${endpoint}?days=${days}`;
      if (filterAction) url += `&action=${filterAction}`;
      if (filterStatus) url += `&status=${filterStatus}`;
      
      const response = await fetchFn(url);
      const data = await response.json();
      
      if (data.success) {
        const sorted = (data.logs || []).sort((a: AuditLog, b: AuditLog) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setLogs(sorted);
      }
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [days, filterAction, filterStatus]);

  const getActionIcon = (action: string) => {
    if (action.startsWith('PRODUCT_')) return <Package className="w-4 h-4" />;
    if (action.startsWith('COUPON_')) return <Tag className="w-4 h-4" />;
    if (action.startsWith('DELIVERY_')) return <Truck className="w-4 h-4" />;
    if (action === 'LOGIN_RATE_LIMITED') return <Ban className="w-4 h-4" />;
    if (action === 'LOGIN_BLACKLISTED') return <Shield className="w-4 h-4" />;
    if (action === 'IP_BLACKLISTED' || action === 'IP_UNBLACKLISTED' || action === 'IP_AUTO_BLACKLISTED') return <Shield className="w-4 h-4" />;
    if (action === 'IP_WHITELISTED' || action === 'IP_UNWHITELISTED' || action === 'IP_STATUS_ALLOWED') return <ShieldCheck className="w-4 h-4" />;
    if (action === 'IP_STATUS_BLOCKED') return <Ban className="w-4 h-4" />;
    if (action === 'AUDIT_LOGS_RESET') return <RotateCcw className="w-4 h-4" />;
    if (action === 'FINGERPRINT_MULTI_IP') return <Fingerprint className="w-4 h-4" />;
    if (action === 'BROWSER_MISMATCH_DETECTED') return <Clock className="w-4 h-4" />;
    if (action.startsWith('LOGIN_')) return <ShieldAlert className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'LOGIN_SUCCESS': 'Login bem-sucedido',
      'LOGIN_FAILED': 'Login falhou',
      'LOGIN_RATE_LIMITED': 'Login bloqueado (rate limit)',
      'LOGIN_BLACKLISTED': 'IP blacklist tentou acessar',
      'DELIVERY_LOGIN_SUCCESS': 'Entregador logou',
      'DELIVERY_LOGIN_FAILED': 'Login entregador falhou',
      'PRODUCT_CREATE': 'Produto criado',
      'PRODUCT_UPDATE': 'Produto atualizado',
      'PRODUCT_DELETE': 'Produto deletado',
      'COUPON_CREATE': 'Cupom criado',
      'COUPON_UPDATE': 'Cupom atualizado',
      'COUPON_DELETE': 'Cupom deletado',
      'IP_BLACKLISTED': 'IP adicionado a blacklist',
      'IP_UNBLACKLISTED': 'IP removido da blacklist',
      'IP_AUTO_BLACKLISTED': 'IP auto-bloqueado (WebRTC)',
      'IP_WHITELISTED': 'IP adicionado a whitelist',
      'IP_UNWHITELISTED': 'IP removido da whitelist',
      'IP_STATUS_BLOCKED': 'IP bloqueado (registro preservado)',
      'IP_STATUS_ALLOWED': 'IP permitido (registro preservado)',
      'AUDIT_LOGS_RESET': 'Logs zerados',
      'FINGERPRINT_MULTI_IP': 'Mesmo navegador em multiplos IPs',
      'BROWSER_MISMATCH_DETECTED': 'Timezone/Idioma inconsistente',
      'WEBRTC_LEAK_DETECTED': 'WebRTC Leak detectado',
    };
    return labels[action] || action;
  };

  const getActionColor = (action: string, status: string) => {
    if (action === 'LOGIN_RATE_LIMITED') return 'bg-purple-100 text-purple-800';
    if (action === 'FINGERPRINT_MULTI_IP') return 'bg-indigo-100 text-indigo-800';
    if (action === 'IP_WHITELISTED' || action === 'IP_STATUS_ALLOWED') return 'bg-emerald-100 text-emerald-800';
    if (action === 'IP_UNWHITELISTED') return 'bg-orange-100 text-orange-800';
    if (action === 'IP_STATUS_BLOCKED') return 'bg-red-100 text-red-800';
    if (action === 'AUDIT_LOGS_RESET') return 'bg-gray-200 text-gray-700';
    if (status === 'failure') return 'bg-red-100 text-red-800';
    if (action.includes('DELETE')) return 'bg-orange-100 text-orange-800';
    if (action.includes('CREATE') || action.includes('SUCCESS')) return 'bg-green-100 text-green-800';
    if (action.includes('UPDATE')) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins < 60) return `Ha ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `Ha ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffDays < 7) return `Ha ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
    
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatGeo = (geo: GeoInfo | null | undefined) => {
    if (!geo) return null;
    const parts = [geo.city, geo.region, geo.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  // Helper: confiança alta, muito-alta, ou exata
  const isHighConfidence = (conf?: string) => conf === 'alta' || conf === 'muito-alta' || conf === 'exata';

  const parseBrowser = (ua: string | undefined) => {
    if (!ua || ua === 'unknown') return null;
    if (ua.includes('Firefox/')) return 'Firefox';
    if (ua.includes('Edg/')) return 'Edge';
    if (ua.includes('OPR/') || ua.includes('Opera/')) return 'Opera';
    if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome';
    if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
    return 'Outro';
  };

  const parseDevice = (ua: string | undefined) => {
    if (!ua || ua === 'unknown') return null;
    if (ua.includes('Mobile') || ua.includes('Android')) return 'Mobile';
    if (ua.includes('Tablet') || ua.includes('iPad')) return 'Tablet';
    return 'Desktop';
  };

  // Handler para bloquear IP (usado pela SecurityAlerts)
  const handleBlockIp = async (ip: string, reason: string) => {
    try {
      const res = await fetchFn('/master/ip-blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, reason })
      });
      const data = await res.json();
      if (data.success) {
        alert(`IP ${ip} bloqueado com sucesso!`);
      } else {
        alert(data.error || 'Erro ao bloquear');
      }
    } catch (e) {
      console.error('Erro ao bloquear IP:', e);
    }
  };

  // Handler para permitir IP (whitelist) - usado pela SecurityAlerts
  const handleAllowIp = async (ip: string, reason: string) => {
    try {
      const res = await fetchFn('/master/ip-whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, reason: reason || 'Permitido via Central de Seguranca', removeFromBlacklist: true })
      });
      const data = await res.json();
      if (data.success) {
        const extra = data.removedFromBlacklist ? ' (removido da blacklist)' : '';
        alert(`IP ${ip} adicionado aos IPs permitidos${extra}!`);
      } else {
        alert(data.error || 'Erro ao permitir IP');
      }
    } catch (e) {
      console.error('Erro ao permitir IP:', e);
    }
  };

  // Handler para zerar logs (mantendo resumo de bloqueados/permitidos)
  const handleResetLogs = async () => {
    try {
      setResetting(true);
      const res = await fetchFn('/master/audit-logs/reset', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setShowResetModal(false);
        // Atualizar logs com os resumos retornados
        const sorted = (data.logs || []).sort((a: AuditLog, b: AuditLog) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setLogs(sorted);
        alert(`Logs zerados com sucesso! ${data.summary?.blockedIps || 0} IP(s) bloqueado(s) e ${data.summary?.allowedIps || 0} IP(s) permitido(s) preservados como resumo.`);
      } else {
        alert(data.error || 'Erro ao zerar logs');
      }
    } catch (e) {
      console.error('Erro ao zerar logs:', e);
      alert('Erro ao zerar logs. Veja o console.');
    } finally {
      setResetting(false);
    }
  };

  // Contadores
  const failedLogins = logs.filter(l => l.action === 'LOGIN_FAILED' || l.action === 'LOGIN_RATE_LIMITED').length;
  const successLogins = logs.filter(l => l.action === 'LOGIN_SUCCESS' || l.action === 'DELIVERY_LOGIN_SUCCESS').length;
  const uniqueIps = new Set(logs.map(l => l.ip).filter(ip => ip && ip !== 'unknown')).size;

  return (
    <div className="space-y-6">
      {/* Sub-tabs de navegacao */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveSubTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeSubTab === 'logs'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          Logs de Auditoria
        </button>
        <button
          onClick={() => setActiveSubTab('blacklist')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeSubTab === 'blacklist'
              ? 'bg-white text-red-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Shield className="w-4 h-4" />
          Controle de IPs
        </button>
        <button
          onClick={() => setActiveSubTab('alerts')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeSubTab === 'alerts'
              ? 'bg-white text-orange-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Bell className="w-4 h-4" />
          Central de Seguranca
        </button>
      </div>

      {/* ===== SUB-TAB: BLACKLIST DE IPS ===== */}
      {activeSubTab === 'blacklist' && (
        <IpBlacklist fetchFn={fetchFn} />
      )}

      {/* ===== SUB-TAB: CENTRAL DE SEGURANCA (ALERTAS) ===== */}
      {activeSubTab === 'alerts' && (
        <SecurityAlerts embedded onBlockIp={handleBlockIp} onAllowIp={handleAllowIp} />
      )}

      {/* ===== SUB-TAB: LOGS DE AUDITORIA ===== */}
      {activeSubTab === 'logs' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Logs de Auditoria</h2>
              <p className="text-sm text-gray-600 mt-1">
                Historico completo de acessos e acoes — com rastreamento de IP e geolocalizacao
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowResetModal(true)}
                className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition flex items-center gap-2 text-sm font-medium"
                title="Zerar registros mantendo dados de IPs bloqueados/permitidos"
              >
                <Trash2 className="w-4 h-4" />
                Zerar Registros
              </button>
              <button
                onClick={fetchLogs}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Atualizar
              </button>
            </div>
          </div>

          {/* Modal de confirmacao para zerar logs */}
          {showResetModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !resetting && setShowResetModal(false)}>
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Zerar Registros de Auditoria</h3>
                    <p className="text-xs text-gray-500">Esta acao nao pode ser desfeita</p>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <p className="text-sm text-gray-700">
                    Todos os logs de auditoria serao removidos permanentemente.
                  </p>
                  
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-emerald-800 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      IPs Permitidos serao preservados
                    </p>
                    <p className="text-xs text-emerald-600 mt-1">
                      Registros-resumo serao criados mostrando cada IP permitido (whitelist) atualmente ativo.
                    </p>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-red-800 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      IPs Bloqueados serao preservados
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      Registros-resumo serao criados mostrando cada IP bloqueado (blacklist) atualmente ativo.
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs text-gray-600">
                      As listas de blacklist e whitelist em si nao serao alteradas — apenas os logs de auditoria serao limpos e substituidos por registros-resumo do estado atual.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowResetModal(false)}
                    disabled={resetting}
                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleResetLogs}
                    disabled={resetting}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {resetting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Zerando...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Confirmar Reset
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Alerta de tentativas suspeitas */}
          {failedLogins > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 text-sm">
                  {failedLogins} tentativa{failedLogins > 1 ? 's' : ''} de login falha{failedLogins > 1 ? 's' : ''} detectada{failedLogins > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Verifique os registros abaixo para identificar acessos suspeitos. IPs e localizacoes estao registrados.
                </p>
              </div>
            </div>
          )}

          {/* Filtros */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-gray-600" />
              <span className="font-medium text-gray-900">Filtros</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Periodo</label>
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={1}>Ultimas 24 horas</option>
                  <option value={7}>Ultimos 7 dias</option>
                  <option value={15}>Ultimos 15 dias</option>
                  <option value={30}>Ultimos 30 dias</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Acao</label>
                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Todas</option>
                  <optgroup label="Logins">
                    <option value="LOGIN_SUCCESS">Login bem-sucedido</option>
                    <option value="LOGIN_FAILED">Login falhou</option>
                    <option value="LOGIN_RATE_LIMITED">Login bloqueado (rate limit)</option>
                    <option value="LOGIN_BLACKLISTED">IP blacklist tentou acessar</option>
                  </optgroup>
                  <optgroup label="Entregadores">
                    <option value="DELIVERY_LOGIN_SUCCESS">Entregador logou</option>
                    <option value="DELIVERY_LOGIN_FAILED">Login entregador falhou</option>
                  </optgroup>
                  <optgroup label="Produtos">
                    <option value="PRODUCT_CREATE">Produto criado</option>
                    <option value="PRODUCT_UPDATE">Produto atualizado</option>
                    <option value="PRODUCT_DELETE">Produto deletado</option>
                  </optgroup>
                  <optgroup label="Cupons">
                    <option value="COUPON_CREATE">Cupom criado</option>
                    <option value="COUPON_UPDATE">Cupom atualizado</option>
                    <option value="COUPON_DELETE">Cupom deletado</option>
                  </optgroup>
                  <optgroup label="IPs">
                    <option value="IP_BLACKLISTED">IP adicionado a blacklist</option>
                    <option value="IP_UNBLACKLISTED">IP removido da blacklist</option>
                    <option value="IP_WHITELISTED">IP adicionado a whitelist</option>
                    <option value="IP_UNWHITELISTED">IP removido da whitelist</option>
                  </optgroup>
                  <optgroup label="Seguranca">
                    <option value="IP_AUTO_BLACKLISTED">IP auto-bloqueado (WebRTC)</option>
                    <option value="FINGERPRINT_MULTI_IP">Mesmo navegador em multiplos IPs</option>
                    <option value="BROWSER_MISMATCH_DETECTED">Timezone/Idioma inconsistente</option>
                    <option value="WEBRTC_LEAK_DETECTED">WebRTC Leak detectado</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Todos</option>
                  <option value="success">Sucesso</option>
                  <option value="failure">Falha</option>
                </select>
              </div>
            </div>
          </div>

          {/* Estatisticas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Check className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Logins OK</p>
                  <p className="text-2xl font-bold text-gray-900">{successLogins}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <X className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Logins Falhos</p>
                  <p className="text-2xl font-bold text-gray-900">{failedLogins}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total de Logs</p>
                  <p className="text-2xl font-bold text-gray-900">{logs.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Globe className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">IPs Unicos</p>
                  <p className="text-2xl font-bold text-gray-900">{uniqueIps}</p>
                </div>
              </div>
            </div>
          </div>

          {/* MAPA DE GEOLOCALIZACAO */}
          {!loading && logs.length > 0 && (
            <AuditMap logs={logs} />
          )}

          {/* Lista de Logs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">
                Registros de Atividade ({logs.length})
              </h3>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-gray-600 mt-4">Carregando logs...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <ShieldAlert className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>Nenhum log encontrado para os filtros selecionados</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {logs.map((log) => {
                  const isExpanded = expandedLog === log.id;
                  const geoStr = formatGeo(log.geo);
                  const browser = parseBrowser(log.userAgent);
                  const device = parseDevice(log.userAgent);
                  const hasExtraInfo = log.userAgent || log.geo;

                  return (
                    <div 
                      key={log.id} 
                      className={`p-4 transition ${
                        log.status === 'failure' ? 'hover:bg-red-50/50' : 'hover:bg-gray-50'
                      } ${log.action === 'LOGIN_RATE_LIMITED' ? 'bg-purple-50/30' : ''} ${log.action === 'AUDIT_LOGS_RESET' ? 'bg-gray-50 border-l-4 border-l-gray-400' : ''} ${log.action === 'IP_STATUS_BLOCKED' ? 'bg-red-50/30 border-l-4 border-l-red-400' : ''} ${log.action === 'IP_STATUS_ALLOWED' ? 'bg-emerald-50/30 border-l-4 border-l-emerald-400' : ''} ${log.whitelisted && log.action !== 'IP_STATUS_ALLOWED' ? 'border-l-4 border-l-emerald-400' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          log.action === 'LOGIN_RATE_LIMITED' ? 'bg-purple-100' :
                          log.action === 'FINGERPRINT_MULTI_IP' ? 'bg-indigo-100' :
                          log.action === 'AUDIT_LOGS_RESET' ? 'bg-gray-200' :
                          log.action === 'IP_STATUS_ALLOWED' ? 'bg-emerald-100' :
                          log.action === 'IP_STATUS_BLOCKED' ? 'bg-red-100' :
                          log.status === 'success' ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {log.action === 'LOGIN_RATE_LIMITED' ? (
                            <Ban className="w-5 h-5 text-purple-600" />
                          ) : log.action === 'FINGERPRINT_MULTI_IP' ? (
                            <Fingerprint className="w-5 h-5 text-indigo-600" />
                          ) : log.action === 'AUDIT_LOGS_RESET' ? (
                            <RotateCcw className="w-5 h-5 text-gray-600" />
                          ) : log.action === 'IP_STATUS_ALLOWED' ? (
                            <ShieldCheck className="w-5 h-5 text-emerald-600" />
                          ) : log.action === 'IP_STATUS_BLOCKED' ? (
                            <Ban className="w-5 h-5 text-red-600" />
                          ) : log.status === 'success' ? (
                            <Check className="w-5 h-5 text-green-600" />
                          ) : (
                            <X className="w-5 h-5 text-red-600" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Acao e Badge */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                              getActionColor(log.action, log.status)
                            }`}>
                              {getActionIcon(log.action)}
                              {getActionLabel(log.action)}
                            </span>
                            
                            {log.resource && (
                              <span className="text-xs text-gray-500">
                                {log.resource}
                              </span>
                            )}

                            {/* VPN / Proxy / Datacenter badges */}
                            {log.geo?.isVpn && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-400 text-black">
                                <Wifi className="w-3 h-3" />
                                VPN/PROXY
                              </span>
                            )}
                            {log.geo?.isHosting && !log.geo?.isVpn && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-200 text-purple-800">
                                <Globe className="w-3 h-3" />
                                DATACENTER
                              </span>
                            )}
                            {log.webrtcLeak && log.realIp && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white animate-pulse">
                                <Shield className="w-3 h-3" />
                                IP REAL: {log.realIp}
                              </span>
                            )}
                            {log.timezoneMismatch && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white">
                                <Clock className="w-3 h-3" />
                                TZ MISMATCH
                              </span>
                            )}
                            {log.languageMismatch && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-600 text-white">
                                <Languages className="w-3 h-3" />
                                IDIOMA SUSPEITO
                              </span>
                            )}
                            {/* ✅ Badge PERMITIDO para IPs na whitelist */}
                            {log.whitelisted && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white" title="Este IP esta na whitelist — acesso permitido">
                                <ShieldCheck className="w-3 h-3" />
                                PERMITIDO
                              </span>
                            )}
                            {/* 🚫 Badge BLOQUEADO para registros pos-reset de IPs na blacklist */}
                            {(log as any).ipStatus === 'blocked' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white" title="Este IP esta na blacklist — acesso bloqueado">
                                <Ban className="w-3 h-3" />
                                BLOQUEADO
                              </span>
                            )}
                            {log.browserInfo && !log.timezoneMismatch && !log.languageMismatch && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-100 text-sky-700">
                                <Fingerprint className="w-3 h-3" />
                                FINGERPRINT
                              </span>
                            )}
                          </div>

                          {/* Detalhes */}
                          <p className="text-sm text-gray-900 mt-1 break-words">
                            {log.details}
                          </p>

                          {/* Metadados principais */}
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {log.username}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(log.timestamp)}
                            </span>
                            
                            {/* IP Badge */}
                            {log.ip && log.ip !== 'unknown' ? (
                              <span 
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-xs ${
                                  log.status === 'failure' 
                                    ? 'bg-red-100 text-red-700' 
                                    : 'bg-gray-100 text-gray-700'
                                }`} 
                                title={`Endereco IP: ${log.ip}`}
                              >
                                <Globe className="w-3 h-3" />
                                {log.ip}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-gray-400 italic">
                                <Globe className="w-3 h-3" />
                                IP indisponivel
                              </span>
                            )}

                            {/* Geo inline (resumido) + indicador de confiança */}
                            {geoStr && (
                              <span className="flex items-center gap-1 text-gray-500" title={
                                isHighConfidence(log.geo?.geoConfidence)
                                  ? `Confiança ${log.geo?.geoConfidence === 'exata' ? 'EXATA' : log.geo?.geoConfidence === 'muito-alta' ? 'muito alta' : 'alta'} — ${log.geo?.geoSourcesAgree || log.geo?.geoSources || 1}/${log.geo?.geoSources || 1} fontes concordam (Δ${log.geo?.geoMaxDivergence ?? '?'}km). Fontes: ${log.geo?.geoSourceList || log.geo?.source || 'ip-api.com'}`
                                  : log.geo?.geoConfidence === 'media'
                                    ? `Confiança média — fontes parcialmente concordam (divergência: ${log.geo?.geoMaxDivergence ?? '?'}km)`
                                    : 'Localizacao aproximada baseada no provedor de internet (ISP). Pode indicar o hub regional, nao a cidade exata.'
                              }>
                                <MapPin className="w-3 h-3" />
                                {isHighConfidence(log.geo?.geoConfidence) ? '' : '~'}{geoStr}
                              </span>
                            )}
                            {/* Badge de confiança da geolocalização */}
                            {log.geo?.geoSources && log.geo.geoSources > 1 && (
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                log.geo.geoConfidence === 'exata'
                                  ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-300'
                                  : log.geo.geoConfidence === 'muito-alta'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isHighConfidence(log.geo.geoConfidence)
                                      ? 'bg-green-100 text-green-700'
                                      : log.geo.geoConfidence === 'media'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-gray-100 text-gray-600'
                              }`} title={`${log.geo.geoSources} fontes consultadas (${log.geo.geoSourcesAgree || log.geo.geoSources} concordam): ${log.geo.geoSourceList}. Precisão: ${log.geo.geoAccuracy}${log.geo.geoEstimatedAccuracyM != null ? `. ±${log.geo.geoEstimatedAccuracyM}m (p95: ${log.geo.geoP95RadiusM || '?'}m)` : ''}. Div.grupo: ${log.geo.geoMaxDivergence}km${log.geo.geoGlobalDivergence ? ` (global: ${log.geo.geoGlobalDivergence}km)` : ''}${log.geo.geoOutliers ? `. ${log.geo.geoOutliers} outlier(s): ${log.geo.geoOutlierSources}` : ''}${log.geo.geoZipConfirmed ? `. CEP confirmado: ${log.geo.geoConfirmedZip}` : ''}${log.geo.geoRansacRefined ? `. RANSAC+IWCR: ${log.geo.geoRansacRefined} refinado(s)` : ''}${log.geo.geoIspType === 'mobile' ? '. ISP móvel (cap de precisão)' : ''}${log.geo.geoIwcrRounds ? `. IWCR: ${log.geo.geoIwcrRounds}r` : ''}`}>
                                <Crosshair className="w-2.5 h-2.5" />
                                {log.geo.geoSourcesAgree || log.geo.geoSources}/{log.geo.geoSources} {
                                  log.geo.geoConfidence === 'exata' ? 'EXATO' :
                                  log.geo.geoConfidence === 'muito-alta' ? 'TRIANGULADO' :
                                  isHighConfidence(log.geo.geoConfidence) ? 'PRECISO' :
                                  log.geo.geoConfidence === 'media' ? 'APROX' : 'DIVERG'
                                }
                                {log.geo.geoEstimatedAccuracyM != null && (
                                  <span className="ml-0.5 opacity-80">
                                    ({log.geo.geoEstimatedAccuracyM < 1000 ? `±${log.geo.geoEstimatedAccuracyM}m` : `±${(log.geo.geoEstimatedAccuracyM / 1000).toFixed(1)}km`})
                                  </span>
                                )}
                              </span>
                            )}
                            {/* Badge de CEP confirmado */}
                            {log.geo?.geoZipConfirmed && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-indigo-100 text-indigo-700" title={`CEP ${log.geo.geoConfirmedZip} confirmado por múltiplas fontes independentes`}>
                                CEP ✓
                              </span>
                            )}
                            {/* Badge ISP mobile */}
                            {log.geo?.geoIspType === 'mobile' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-medium bg-orange-50 text-orange-600" title="IP de operadora móvel — precisão limitada ao nível de cidade/região">
                                📱
                              </span>
                            )}

                            {/* Browser inline */}
                            {browser && (
                              <span className="flex items-center gap-1 text-gray-500">
                                <Monitor className="w-3 h-3" />
                                {browser}{device ? ` (${device})` : ''}
                              </span>
                            )}

                            {/* Expandir detalhes */}
                            {hasExtraInfo && (
                              <button
                                onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition ml-auto"
                              >
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                {isExpanded ? 'Menos' : 'Rastrear'}
                              </button>
                            )}
                          </div>

                          {/* Painel expandido com detalhes de rastreamento */}
                          {isExpanded && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs space-y-2 animate-in fade-in slide-in-from-top-2">
                              <p className="font-semibold text-gray-700 flex items-center gap-1.5">
                                <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
                                Informacoes de Rastreamento
                              </p>

                              {/* Indicador de confiança multi-source */}
                              {log.geo?.geoSources && log.geo.geoSources > 1 ? (
                                <div className={`p-2.5 rounded border text-[10px] flex items-start gap-1.5 ${
                                  log.geo.geoConfidence === 'exata'
                                    ? 'bg-blue-50 border-blue-300 text-blue-800'
                                    : isHighConfidence(log.geo.geoConfidence)
                                      ? 'bg-green-50 border-green-200 text-green-700'
                                      : log.geo.geoConfidence === 'media'
                                        ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                                        : 'bg-red-50 border-red-200 text-red-700'
                                }`}>
                                  <Crosshair className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
                                    log.geo.geoConfidence === 'exata' ? 'text-blue-600' :
                                    isHighConfidence(log.geo.geoConfidence) ? 'text-green-500' :
                                    log.geo.geoConfidence === 'media' ? 'text-yellow-500' : 'text-red-500'
                                  }`} />
                                  <div className="space-y-1">
                                    <span>
                                      <b>Precision v4.1 ({log.geo.geoSourcesAgree || log.geo.geoSources}/{log.geo.geoSources} concordam{log.geo.geoWeightedAvg ? ', RANSAC+IWCR' : ''}):</b>{' '}
                                      Fontes: {log.geo.geoSourceList || '?'}. 
                                      Divergência do cluster: <b>{log.geo.geoMaxDivergence ?? '?'}km</b> (média: {log.geo.geoAvgDivergence ?? '?'}km){log.geo.geoGlobalDivergence != null && log.geo.geoGlobalDivergence !== log.geo.geoMaxDivergence ? ` | Global: ${log.geo.geoGlobalDivergence}km` : ''}. 
                                      Precisão: <b>{
                                        log.geo.geoAccuracy?.startsWith('multi-triangulado') ? `Multi-triangulado (${log.geo.geoSourcesAgree}+ fontes < 3km)` :
                                        log.geo.geoAccuracy?.startsWith('triangulado-preciso') ? `Triangulado preciso (${log.geo.geoSourcesAgree}+ fontes < 5km)` :
                                        log.geo.geoAccuracy?.startsWith('zip-triangulado') ? `ZIP + triangulado (CEP ${log.geo.geoConfirmedZip} confirmado)` :
                                        log.geo.geoAccuracy?.startsWith('triangulado') ? 'Triangulado (3+ fontes < 10km)' :
                                        log.geo.geoAccuracy?.startsWith('maioria-proxima') ? `Maioria próxima (${log.geo.geoSourcesAgree}+ fontes < 25km)` :
                                        log.geo.geoAccuracy?.startsWith('maioria-confirmada') ? `Maioria confirmada (${log.geo.geoSourcesAgree || '?'}/${log.geo.geoSources} fontes < 50km)` :
                                        log.geo.geoAccuracy?.startsWith('preciso') ? 'Preciso (< 10km entre fontes)' :
                                        log.geo.geoAccuracy?.startsWith('cidade-confirmada') ? 'Cidade confirmada (< 50km)' :
                                        log.geo.geoAccuracy?.startsWith('regiao-confirmada') ? 'Região confirmada (< 150km)' :
                                        log.geo.geoAccuracy === 'sem-consenso' ? `Sem consenso — ${log.geo.geoSources} fontes divergem` :
                                        'Fontes divergentes (> 150km) — verificar manualmente'
                                      }{log.geo.geoAccuracy?.includes('+zip') ? ' + CEP confirmado' : ''}{log.geo.geoAccuracy?.includes('mobile-cap') ? ' (cap: ISP móvel)' : ''}</b>.
                                      {isHighConfidence(log.geo.geoConfidence) && ` Coordenadas por RANSAC + IWCR (${log.geo.geoIwcrRounds || '?'}r${log.geo.geoIwcrConvergenceDeltaM != null ? `, δ${log.geo.geoIwcrConvergenceDeltaM < 1 ? '<1' : Math.round(log.geo.geoIwcrConvergenceDeltaM)}m` : ''}).`}
                                      {log.geo.geoEstimatedAccuracyM != null && (
                                        <>{' '}<b>Estimativa: &plusmn;{log.geo.geoEstimatedAccuracyM < 1000 ? `${log.geo.geoEstimatedAccuracyM}m` : `${(log.geo.geoEstimatedAccuracyM / 1000).toFixed(1)}km`}</b> (p95: {(log.geo.geoP95RadiusM || 0) < 1000 ? `${log.geo.geoP95RadiusM}m` : `${((log.geo.geoP95RadiusM || 0) / 1000).toFixed(1)}km`}).</>
                                      )}
                                    </span>
                                    {/* Indicadores v3/v4.1 */}
                                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                                      {log.geo.geoZipConfirmed && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                                          CEP {log.geo.geoConfirmedZip} confirmado por múltiplas fontes
                                        </span>
                                      )}
                                      {log.geo.geoRansacRefined != null && log.geo.geoRansacRefined > 0 && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-medium bg-purple-50 text-purple-600 border border-purple-200">
                                          RANSAC+IWCR: {log.geo.geoRansacRefined} fonte(s) refinada(s)
                                        </span>
                                      )}
                                      {log.geo.geoCountryFiltered != null && log.geo.geoCountryFiltered > 0 && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                          {log.geo.geoCountryFiltered} fonte(s) descartada(s) por país inconsistente
                                        </span>
                                      )}
                                      {log.geo.geoIspType === 'mobile' && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-medium bg-orange-50 text-orange-600 border border-orange-200">
                                          📱 ISP móvel — precisão limitada (cap em 'alta')
                                        </span>
                                      )}
                                      {log.geo.geoIwcrRounds != null && log.geo.geoIwcrRounds > 0 && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-medium bg-blue-50 text-blue-600 border border-blue-200">
                                          IWCR: {log.geo.geoIwcrRounds}r{log.geo.geoIwcrConvergenceDeltaM != null && ` δ${log.geo.geoIwcrConvergenceDeltaM < 1 ? '<1' : Math.round(log.geo.geoIwcrConvergenceDeltaM)}m`}
                                        </span>
                                      )}
                                      {log.geo.geoEngineVersion && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                          Engine {log.geo.geoEngineVersion}
                                        </span>
                                      )}
                                    </div>
                                    {/* Outliers */}
                                    {log.geo.geoOutliers != null && log.geo.geoOutliers > 0 && (
                                      <div className="text-orange-600 text-[9px]">
                                        ⚠ {log.geo.geoOutliers} fonte(s) descartada(s) como outlier: {log.geo.geoOutlierSources}
                                      </div>
                                    )}
                                    {/* Detalhe por fonte (v4.1: peso efetivo, flags, IWCR) */}
                                    {log.geo.geoSourceDetails && (
                                      <div className="mt-1 pt-1 border-t border-current/10 grid grid-cols-1 gap-0.5">
                                        {log.geo.geoSourceDetails.map((sd: any, idx: number) => {
                                          const weightPct = Math.round((sd.effectiveWeight ?? sd.weight) * 100);
                                          const distStr = sd.distToAvg < 1 ? `${Math.round(sd.distToAvg * 1000)}m` : `${sd.distToAvg.toFixed(1)}km`;
                                          return (
                                          <div key={idx} className={`flex items-center gap-1.5 text-[9px] ${sd.inCluster ? (sd.refined ? 'opacity-70' : '') : 'opacity-40 line-through'} ${sd.countryFiltered ? 'opacity-30 line-through' : ''}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sd.countryFiltered ? 'bg-gray-400' : sd.inCluster ? (sd.refined ? 'bg-yellow-500' : 'bg-green-500') : 'bg-red-400'}`} />
                                            <span className="font-mono font-medium" style={{ minWidth: 75 }}>{sd.source}</span>
                                            <span className="text-gray-500 truncate" style={{ maxWidth: 150 }}>→ {sd.city}</span>
                                            <span className="text-gray-400 font-mono">{distStr}</span>
                                            <span className="inline-flex items-center gap-0.5">
                                              <span className={`inline-block h-1 rounded-sm ${sd.refined ? 'bg-yellow-400' : sd.inCluster ? 'bg-green-400' : 'bg-red-300'}`} style={{ width: Math.max(2, weightPct * 0.3) }} />
                                              <span className={`${sd.refined ? 'text-yellow-500 font-bold' : 'text-gray-300'}`}>{weightPct}%{sd.refined ? '↓' : ''}</span>
                                            </span>
                                            {sd.zip && <span className="text-indigo-400 font-mono">{sd.zip}</span>}
                                            {sd.vpn && <span className="text-yellow-600 font-bold">VPN</span>}
                                            {sd.countryFiltered && <span className="text-gray-400 font-bold">PAÍS≠</span>}
                                          </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-amber-50 p-2 rounded border border-amber-200 text-[10px] text-amber-700 flex items-start gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                                  <span>
                                    <b>Precisao da geolocalizacao:</b> Fonte unica disponivel. A localizacao por IP e baseada na infraestrutura do provedor de internet (ISP). 
                                    A cidade exibida pode ser o hub/central regional do ISP (ex: capital do estado), nao necessariamente a cidade exata do usuario.
                                  </span>
                                </div>
                              )}
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {/* IP */}
                                <div className="bg-white p-2 rounded border border-gray-100">
                                  <span className="text-gray-500 block mb-0.5">Endereco IP</span>
                                  <span className="font-mono font-semibold text-gray-900">{log.ip || 'N/A'}</span>
                                </div>

                                {/* Timestamp completo */}
                                <div className="bg-white p-2 rounded border border-gray-100">
                                  <span className="text-gray-500 block mb-0.5">Data/Hora Exata</span>
                                  <span className="font-mono font-semibold text-gray-900">
                                    {new Date(log.timestamp).toLocaleString('pt-BR', {
                                      day: '2-digit', month: '2-digit', year: 'numeric',
                                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                                    })}
                                  </span>
                                </div>

                                {/* Geolocalizacao */}
                                {log.geo && (
                                  <>
                                    {log.geo.city && (
                                      <div className="bg-white p-2 rounded border border-gray-100">
                                        <span className="text-gray-500 block mb-0.5">
                                          {isHighConfidence(log.geo.geoConfidence) ? `Cidade (${log.geo.geoConfidence === 'exata' ? 'localização exata — ' + (log.geo.geoSourcesAgree || '?') + ' fontes' : log.geo.geoConfidence === 'muito-alta' ? 'triangulada por multiplas fontes' : 'confirmada por multiplas fontes'})` : 'Regiao do ISP (aprox.)'}
                                        </span>
                                        <span className="font-semibold text-gray-900">
                                          {[log.geo.city, log.geo.region].filter(Boolean).join(', ')}
                                        </span>
                                        {isHighConfidence(log.geo.geoConfidence) ? (
                                          <span className="text-[9px] text-green-600 block mt-0.5 italic">
                                            {log.geo.geoConfidence === 'exata' ? 'Localização exata' : log.geo.geoConfidence === 'muito-alta' ? 'Triangulada' : 'Confirmada'} por {log.geo.geoSources} fontes independentes
                                            {log.geo.geoZipConfirmed ? ` — CEP ${log.geo.geoConfirmedZip} validado` : ''}
                                            {log.geo.geoIspType === 'mobile' ? ' (ISP móvel)' : ''}
                                          </span>
                                        ) : (
                                          <span className="text-[9px] text-amber-600 block mt-0.5 italic">Pode ser hub regional do provedor{log.geo.geoIspType === 'mobile' ? ' (operadora móvel)' : ''}</span>
                                        )}
                                      </div>
                                    )}
                                    {log.geo.district && (
                                      <div className="bg-white p-2 rounded border border-gray-100">
                                        <span className="text-gray-500 block mb-0.5">Bairro / Distrito</span>
                                        <span className="font-semibold text-gray-900">{log.geo.district}</span>
                                      </div>
                                    )}
                                    {log.geo.country && (
                                      <div className="bg-white p-2 rounded border border-gray-100">
                                        <span className="text-gray-500 block mb-0.5">Pais</span>
                                        <span className="font-semibold text-gray-900">{log.geo.country}</span>
                                      </div>
                                    )}
                                    {log.geo.zip && (
                                      <div className="bg-white p-2 rounded border border-gray-100">
                                        <span className="text-gray-500 block mb-0.5">CEP / Codigo Postal</span>
                                        <span className="font-mono font-semibold text-gray-900">{log.geo.zip}</span>
                                      </div>
                                    )}
                                    {log.geo.isp && (
                                      <div className="bg-white p-2 rounded border border-gray-100">
                                        <span className="text-gray-500 block mb-0.5">Provedor (ISP)</span>
                                        <span className="font-semibold text-gray-900">{log.geo.isp}</span>
                                      </div>
                                    )}
                                    {log.geo.org && (
                                      <div className="bg-white p-2 rounded border border-gray-100">
                                        <span className="text-gray-500 block mb-0.5">Organizacao</span>
                                        <span className="font-semibold text-gray-900">{log.geo.org}</span>
                                      </div>
                                    )}
                                    {log.geo.asn && (
                                      <div className="bg-white p-2 rounded border border-gray-100">
                                        <span className="text-gray-500 block mb-0.5">ASN (Rede)</span>
                                        <span className="font-mono font-semibold text-gray-900">{log.geo.asn}</span>
                                      </div>
                                    )}
                                    {log.geo.timezone && (
                                      <div className="bg-white p-2 rounded border border-gray-100">
                                        <span className="text-gray-500 block mb-0.5">Fuso Horario</span>
                                        <span className="font-semibold text-gray-900">{log.geo.timezone}</span>
                                      </div>
                                    )}
                                    {(log.geo.lat != null && log.geo.lon != null) && (
                                      <div className="bg-white p-2 rounded border border-gray-100 md:col-span-2">
                                        <span className="text-gray-500 block mb-0.5">
                                          Coordenadas {isHighConfidence(log.geo.geoConfidence) ? `(${log.geo.geoConfidence === 'exata' ? 'RANSAC-refinadas' : log.geo.geoConfidence === 'muito-alta' ? 'trianguladas' : 'ponderadas'} de ${log.geo.geoSources} fontes${log.geo.geoZipConfirmed ? ', CEP ✓' : ''})` : '(aprox. do roteador/antena)'}
                                        </span>
                                        <div className="flex items-center gap-3">
                                          <span className="font-mono font-semibold text-gray-900">
                                            {log.geo.lat.toFixed(6)}, {log.geo.lon.toFixed(6)}
                                          </span>
                                          <a 
                                            href={`https://www.google.com/maps?q=${log.geo.lat},${log.geo.lon}&z=15`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 underline text-xs flex items-center gap-1"
                                          >
                                            <MapPin className="w-3 h-3" />
                                            Abrir no Google Maps
                                          </a>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}

                                {/* Analise de Rede / VPN */}
                                {log.geo && (log.geo.isVpn || log.geo.isProxy || log.geo.isHosting) && (
                                  <div className="bg-yellow-50 p-2.5 rounded border border-yellow-200 md:col-span-2">
                                    <span className="text-yellow-800 font-semibold block mb-1 flex items-center gap-1.5">
                                      <Wifi className="w-3.5 h-3.5" />
                                      Analise de Rede - IP Suspeito
                                    </span>
                                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                                      {log.geo.isProxy && (
                                        <span className="bg-yellow-400 text-black px-2 py-0.5 rounded-full font-bold">PROXY DETECTADO</span>
                                      )}
                                      {log.geo.isHosting && (
                                        <span className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-bold">IP DE DATACENTER</span>
                                      )}
                                      {log.geo.isVpn && !log.geo.isProxy && !log.geo.isHosting && (
                                        <span className="bg-yellow-400 text-black px-2 py-0.5 rounded-full font-bold">VPN PROVAVEL</span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-yellow-700 mt-1.5">
                                      Este IP pertence a um servico de VPN, proxy ou datacenter. 
                                      A localizacao mostrada e do servidor da VPN, nao do usuario real.
                                      {log.webrtcLeak && log.realIp 
                                        ? ' Porem, o IP real foi vazado via WebRTC (veja abaixo).'
                                        : ' O invasor pode estar em qualquer lugar do mundo.'}
                                    </p>
                                  </div>
                                )}

                                {/* WebRTC Leak — IP Real Detectado */}
                                {log.webrtcLeak && log.realIp && (
                                  <div className="bg-red-50 p-2.5 rounded border-2 border-red-300 md:col-span-2">
                                    <span className="text-red-800 font-bold block mb-1.5 flex items-center gap-1.5">
                                      <Shield className="w-4 h-4" />
                                      IP Real Vazado via WebRTC
                                    </span>
                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                      <div>
                                        <span className="text-red-500 block">IP Real (WebRTC)</span>
                                        <span className="font-mono font-bold text-red-900">{log.realIp}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500 block">IP Visivel (VPN)</span>
                                        <span className="font-mono text-gray-700">{log.ip}</span>
                                      </div>
                                      {log.realGeo?.city && (
                                        <div>
                                          <span className="text-red-500 block">Localizacao Real</span>
                                          <span className="font-bold text-red-900">
                                            {[log.realGeo.city, log.realGeo.region, log.realGeo.country].filter(Boolean).join(', ')}
                                          </span>
                                        </div>
                                      )}
                                      {log.realGeo?.isp && (
                                        <div>
                                          <span className="text-red-500 block">ISP Real</span>
                                          <span className="text-red-900">{log.realGeo.isp}</span>
                                        </div>
                                      )}
                                      {log.realGeo?.timezone && (
                                        <div>
                                          <span className="text-red-500 block">Fuso Horario Real</span>
                                          <span className="text-red-900">{log.realGeo.timezone}</span>
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-red-600 mt-2 font-semibold">
                                      A VPN deste usuario nao bloqueou WebRTC. O IP real ({log.realIp}) foi capturado automaticamente.
                                      {log.realGeo?.city && ` O invasor esta em ${log.realGeo.city}, ${log.realGeo.country}.`}
                                    </p>
                                  </div>
                                )}

                                {/* User Agent */}
                                {log.userAgent && log.userAgent !== 'unknown' && (
                                  <div className="bg-white p-2 rounded border border-gray-100 md:col-span-2">
                                    <span className="text-gray-500 block mb-0.5">Navegador / Dispositivo (User-Agent)</span>
                                    <span className="font-mono text-gray-700 break-all text-[10px] leading-relaxed">
                                      {log.userAgent}
                                    </span>
                                  </div>
                                )}

                                {/* Browser Fingerprint */}
                                {log.browserInfo && (
                                  <div className="bg-white p-2 rounded border border-gray-100 md:col-span-2">
                                    <span className="text-gray-500 block mb-0.5">Fingerprint do Navegador</span>
                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                      {log.browserInfo.timezone && (
                                        <div>
                                          <span className="text-gray-500 block">Fuso Horario</span>
                                          <span className="font-mono text-gray-700">{log.browserInfo.timezone}</span>
                                        </div>
                                      )}
                                      {log.browserInfo.timezoneOffset && (
                                        <div>
                                          <span className="text-gray-500 block">Offset do Fuso Horario</span>
                                          <span className="font-mono text-gray-700">{log.browserInfo.timezoneOffset}</span>
                                        </div>
                                      )}
                                      {log.browserInfo.language && (
                                        <div>
                                          <span className="text-gray-500 block">Idioma</span>
                                          <span className="font-mono text-gray-700">{log.browserInfo.language}</span>
                                        </div>
                                      )}
                                      {log.browserInfo.languages && (
                                        <div>
                                          <span className="text-gray-500 block">Idiomas Disponiveis</span>
                                          <span className="font-mono text-gray-700">{log.browserInfo.languages.join(', ')}</span>
                                        </div>
                                      )}
                                      {log.browserInfo.screen && (
                                        <div>
                                          <span className="text-gray-500 block">Resolucao da Tela</span>
                                          <span className="font-mono text-gray-700">{log.browserInfo.screen}</span>
                                        </div>
                                      )}
                                      {log.browserInfo.platform && (
                                        <div>
                                          <span className="text-gray-500 block">Plataforma</span>
                                          <span className="font-mono text-gray-700">{log.browserInfo.platform}</span>
                                        </div>
                                      )}
                                      {log.browserInfo.localTime && (
                                        <div>
                                          <span className="text-gray-500 block">Hora Local</span>
                                          <span className="font-mono text-gray-700">{log.browserInfo.localTime}</span>
                                        </div>
                                      )}
                                    </div>
                                    {log.timezoneMismatch && (
                                      <div className="bg-red-50 p-2.5 rounded border-2 border-red-300 mt-2">
                                        <span className="text-red-800 font-bold block mb-1.5 flex items-center gap-1.5">
                                          <Clock className="w-4 h-4" />
                                          Mismatch de Fuso Horario
                                        </span>
                                        <p className="text-[10px] text-red-600 mt-2 font-semibold">
                                          O fuso horario do navegador ({log.browserInfo?.timezone}) nao corresponde ao do IP ({log.geo?.timezone}).
                                          {log.mismatchDetails && ` Detalhes: ${log.mismatchDetails}`}
                                        </p>
                                      </div>
                                    )}
                                    {log.languageMismatch && (
                                      <div className="bg-red-50 p-2.5 rounded border-2 border-red-300 mt-2">
                                        <span className="text-red-800 font-bold block mb-1.5 flex items-center gap-1.5">
                                          <Languages className="w-4 h-4" />
                                          Mismatch de Idioma
                                        </span>
                                        <p className="text-[10px] text-red-600 mt-2 font-semibold">
                                          O idioma do navegador ({log.browserInfo?.language}) nao corresponde ao do IP ({log.geo?.country}).
                                          {log.mismatchDetails && ` Detalhes: ${log.mismatchDetails}`}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}