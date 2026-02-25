import { useEffect, useState } from 'react';
import { masterFetch } from '../../utils/api';
import { 
  Shield, ShieldCheck, Plus, Trash2, Globe, MapPin, Clock, AlertTriangle,
  Search, RefreshCw, Ban, Eye, EyeOff, Wifi, CheckCircle2, ArrowRightLeft,
  ShieldPlus, X
} from 'lucide-react';

interface GeoData {
  country?: string;
  region?: string;
  city?: string;
  district?: string;
  isp?: string;
  org?: string;
  isVpn?: boolean;
  isProxy?: boolean;
  isHosting?: boolean;
  lat?: number | null;
  lon?: number | null;
}

interface BlacklistEntry {
  ip: string;
  reason: string;
  blockedAt: string;
  blockedBy: string;
  active: boolean;
  geo?: GeoData | null;
}

interface WhitelistEntry {
  ip: string;
  reason: string;
  allowedAt: string;
  allowedBy: string;
  active: boolean;
  geo?: GeoData | null;
}

interface IpBlacklistProps {
  fetchFn?: (url: string, options?: RequestInit) => Promise<Response>;
}

type ViewMode = 'blacklist' | 'whitelist';

export function IpBlacklist({ fetchFn = masterFetch }: IpBlacklistProps) {
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIp, setNewIp] = useState('');
  const [newReason, setNewReason] = useState('');
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<'block' | 'allow'>('block');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [expandedIp, setExpandedIp] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('blacklist');
  const [allowingIp, setAllowingIp] = useState<string | null>(null);
  const [allowReason, setAllowReason] = useState('');
  const [showAllowModal, setShowAllowModal] = useState(false);
  const [pendingAllowIp, setPendingAllowIp] = useState('');

  // ===== FETCH =====
  const fetchBlacklist = async () => {
    try {
      const res = await fetchFn('/master/ip-blacklist');
      const data = await res.json();
      if (data.success) setBlacklist(data.blacklist || []);
    } catch (e) {
      console.error('Erro ao buscar blacklist:', e);
    }
  };

  const fetchWhitelist = async () => {
    try {
      const res = await fetchFn('/master/ip-whitelist');
      const data = await res.json();
      if (data.success) setWhitelist(data.whitelist || []);
    } catch (e) {
      console.error('Erro ao buscar whitelist:', e);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchBlacklist(), fetchWhitelist()]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ===== AÇÕES: BLACKLIST =====
  const addToBlacklist = async () => {
    if (!newIp.trim()) { setError('Informe o endereco IP'); return; }
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(newIp.trim())) { setError('Formato de IP invalido (ex: 192.168.1.1)'); return; }

    setAdding(true);
    setError('');
    try {
      const res = await fetchFn('/master/ip-blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: newIp.trim(), reason: newReason.trim() || 'Bloqueio manual' })
      });
      const data = await res.json();
      if (data.success) {
        setNewIp(''); setNewReason(''); setShowAddForm(false);
        showSuccess(`IP ${newIp} bloqueado com sucesso`);
        fetchAll();
      } else {
        setError(data.error || 'Erro ao bloquear IP');
      }
    } catch (e) {
      setError(`Erro de conexao: ${e}`);
    } finally {
      setAdding(false);
    }
  };

  const removeFromBlacklist = async (ip: string) => {
    if (!confirm(`Desbloquear o IP ${ip}? Ele podera acessar novamente.`)) return;
    try {
      const res = await fetchFn(`/master/ip-blacklist/${encodeURIComponent(ip)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { showSuccess(`IP ${ip} desbloqueado`); fetchAll(); }
    } catch (e) {
      console.error('Erro ao remover da blacklist:', e);
    }
  };

  // ===== AÇÕES: WHITELIST =====
  const addToWhitelist = async (ip?: string, reason?: string) => {
    const targetIp = ip || newIp.trim();
    const targetReason = reason || newReason.trim() || 'Acesso permitido manualmente';

    if (!targetIp) { setError('Informe o endereco IP'); return; }
    if (!ip) {
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(targetIp)) { setError('Formato de IP invalido (ex: 192.168.1.1)'); return; }
    }

    setAdding(true);
    setError('');
    try {
      const res = await fetchFn('/master/ip-whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: targetIp, reason: targetReason, removeFromBlacklist: true })
      });
      const data = await res.json();
      if (data.success) {
        if (!ip) { setNewIp(''); setNewReason(''); setShowAddForm(false); }
        const extra = data.removedFromBlacklist ? ' (removido da blacklist)' : '';
        showSuccess(`IP ${targetIp} adicionado aos IPs permitidos${extra}`);
        fetchAll();
        setShowAllowModal(false);
        setPendingAllowIp('');
        setAllowReason('');
        setAllowingIp(null);
      } else {
        setError(data.error || 'Erro ao permitir IP');
      }
    } catch (e) {
      setError(`Erro de conexao: ${e}`);
    } finally {
      setAdding(false);
    }
  };

  const removeFromWhitelist = async (ip: string) => {
    if (!confirm(`Revogar permissao do IP ${ip}? Ele voltara a ser tratado normalmente.`)) return;
    try {
      const res = await fetchFn(`/master/ip-whitelist/${encodeURIComponent(ip)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { showSuccess(`IP ${ip} removido dos IPs permitidos`); fetchAll(); }
    } catch (e) {
      console.error('Erro ao remover da whitelist:', e);
    }
  };

  // ===== PERMITIR IP (modal) =====
  const openAllowModal = (ip: string) => {
    setPendingAllowIp(ip);
    setAllowReason('');
    setShowAllowModal(true);
    setError('');
  };

  const confirmAllow = () => {
    addToWhitelist(pendingAllowIp, allowReason || `Permitido manualmente (anteriormente bloqueado)`);
  };

  // ===== HELPERS =====
  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const isWhitelisted = (ip: string) => whitelist.some(e => e.ip === ip);

  // Filtrar
  const filteredBlacklist = blacklist.filter(entry => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return entry.ip.includes(term) 
      || (entry.reason || '').toLowerCase().includes(term)
      || (entry.geo?.city || '').toLowerCase().includes(term)
      || (entry.geo?.country || '').toLowerCase().includes(term)
      || (entry.geo?.isp || '').toLowerCase().includes(term);
  });

  const filteredWhitelist = whitelist.filter(entry => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return entry.ip.includes(term) 
      || (entry.reason || '').toLowerCase().includes(term)
      || (entry.geo?.city || '').toLowerCase().includes(term)
      || (entry.geo?.country || '').toLowerCase().includes(term)
      || (entry.geo?.isp || '').toLowerCase().includes(term);
  });

  const vpnCount = blacklist.filter(e => e.geo?.isVpn).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-gray-700" />
            Controle de IPs
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Gerencie IPs bloqueados e IPs com acesso permitido
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => { setShowAddForm(!showAddForm); setAddMode('block'); setError(''); }}
            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-1.5 text-sm font-medium"
          >
            <Ban className="w-4 h-4" />
            Bloquear
          </button>
          <button
            onClick={() => { setShowAddForm(!showAddForm); setAddMode('allow'); setError(''); }}
            className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-1.5 text-sm font-medium"
          >
            <ShieldCheck className="w-4 h-4" />
            Permitir
          </button>
        </div>
      </div>

      {/* Msg sucesso */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          {successMsg}
        </div>
      )}

      {/* Modal: Permitir IP (de dentro da blacklist) */}
      {showAllowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Permitir acesso do IP
              </h3>
              <button onClick={() => { setShowAllowModal(false); setError(''); }} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-emerald-800">
                O IP <span className="font-mono font-bold">{pendingAllowIp}</span> sera movido da blacklist para a whitelist.
                Ele tera acesso permitido a todas as rotas de login e nao podera ser bloqueado automaticamente.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
              <input
                type="text"
                value={allowReason}
                onChange={(e) => setAllowReason(e.target.value)}
                placeholder="Ex: IP do escritorio principal"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              />
            </div>

            {error && (
              <p className="text-red-600 text-xs mb-3 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {error}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={confirmAllow}
                disabled={adding}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition text-sm font-medium flex items-center justify-center gap-2"
              >
                {adding ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                {adding ? 'Permitindo...' : 'Confirmar Permissao'}
              </button>
              <button
                onClick={() => { setShowAllowModal(false); setError(''); }}
                className="px-4 py-2.5 text-gray-600 hover:text-gray-800 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form de adicionar (bloquear ou permitir) */}
      {showAddForm && (
        <div className={`bg-white rounded-xl shadow-sm border p-5 ${addMode === 'block' ? 'border-red-200' : 'border-emerald-200'}`}>
          <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2">
            {addMode === 'block' ? (
              <>
                <Ban className="w-4 h-4 text-red-600" />
                Bloquear novo IP
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Permitir novo IP
              </>
            )}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Endereco IP *</label>
              <input
                type="text"
                value={newIp}
                onChange={(e) => { setNewIp(e.target.value); setError(''); }}
                placeholder="Ex: 203.0.113.42"
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent font-mono ${
                  addMode === 'block' ? 'focus:ring-red-500' : 'focus:ring-emerald-500'
                }`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
              <input
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder={addMode === 'block' ? 'Ex: Tentativas de invasao repetidas' : 'Ex: IP do escritorio'}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent ${
                  addMode === 'block' ? 'focus:ring-red-500' : 'focus:ring-emerald-500'
                }`}
              />
            </div>
          </div>
          
          {error && (
            <p className="text-red-600 text-xs mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {error}
            </p>
          )}
          
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={addMode === 'block' ? addToBlacklist : () => addToWhitelist()}
              disabled={adding}
              className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 transition text-sm font-medium flex items-center gap-2 ${
                addMode === 'block' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {adding ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : addMode === 'block' ? (
                <Ban className="w-4 h-4" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              {adding ? (addMode === 'block' ? 'Bloqueando...' : 'Permitindo...') : (addMode === 'block' ? 'Bloquear IP' : 'Permitir IP')}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setError(''); }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
            >
              Cancelar
            </button>
          </div>
          
          <p className="text-xs text-gray-400 mt-3">
            {addMode === 'block'
              ? 'O IP sera bloqueado imediatamente em todas as rotas de login (admin, master, delivery). A geolocalizacao sera capturada automaticamente.'
              : 'O IP tera acesso garantido. Se estiver na blacklist, sera removido automaticamente. IPs permitidos nao podem ser auto-bloqueados pelo sistema.'
            }
          </p>
        </div>
      )}

      {/* Estatisticas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Ban className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Bloqueados</p>
              <p className="text-xl font-bold text-gray-900">{blacklist.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Permitidos</p>
              <p className="text-xl font-bold text-gray-900">{whitelist.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Wifi className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">VPN/Proxy</p>
              <p className="text-xl font-bold text-gray-900">{vpnCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Paises</p>
              <p className="text-xl font-bold text-gray-900">
                {new Set([...blacklist, ...whitelist].map(e => e.geo?.country).filter(Boolean)).size}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toggle view: Blacklist / Whitelist */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => { setViewMode('blacklist'); setSearchTerm(''); }}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            viewMode === 'blacklist'
              ? 'bg-white text-red-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Ban className="w-4 h-4" />
          Bloqueados ({blacklist.length})
        </button>
        <button
          onClick={() => { setViewMode('whitelist'); setSearchTerm(''); }}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            viewMode === 'whitelist'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Permitidos ({whitelist.length})
        </button>
      </div>

      {/* Busca */}
      {(viewMode === 'blacklist' ? blacklist.length : whitelist.length) > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por IP, cidade, provedor..."
            className={`w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:border-transparent ${
              viewMode === 'blacklist' ? 'focus:ring-red-500' : 'focus:ring-emerald-500'
            }`}
          />
        </div>
      )}

      {/* ===== LISTA: BLACKLIST ===== */}
      {viewMode === 'blacklist' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-900 text-sm flex items-center gap-2">
              <Ban className="w-4 h-4 text-red-500" />
              IPs Bloqueados ({filteredBlacklist.length})
            </h3>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto" />
              <p className="text-gray-600 mt-4 text-sm">Carregando blacklist...</p>
            </div>
          ) : filteredBlacklist.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">
                {blacklist.length === 0 ? 'Nenhum IP bloqueado' : 'Nenhum resultado para a busca'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredBlacklist.map((entry) => (
                <IpEntryCard
                  key={entry.ip}
                  ip={entry.ip}
                  reason={entry.reason}
                  timestamp={entry.blockedAt}
                  by={entry.blockedBy}
                  geo={entry.geo}
                  type="blacklist"
                  isExpanded={expandedIp === entry.ip}
                  onToggleExpand={() => setExpandedIp(expandedIp === entry.ip ? null : entry.ip)}
                  onRemove={() => removeFromBlacklist(entry.ip)}
                  onAllow={() => openAllowModal(entry.ip)}
                  isWhitelisted={isWhitelisted(entry.ip)}
                  allowingIp={allowingIp}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== LISTA: WHITELIST ===== */}
      {viewMode === 'whitelist' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-900 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              IPs com Acesso Permitido ({filteredWhitelist.length})
            </h3>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto" />
              <p className="text-gray-600 mt-4 text-sm">Carregando whitelist...</p>
            </div>
          ) : filteredWhitelist.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">
                {whitelist.length === 0 ? 'Nenhum IP com acesso permitido' : 'Nenhum resultado para a busca'}
              </p>
              {whitelist.length === 0 && (
                <p className="text-xs mt-2 text-gray-400">
                  IPs na whitelist tem acesso garantido e nao podem ser bloqueados automaticamente pelo sistema.
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredWhitelist.map((entry) => (
                <IpEntryCard
                  key={entry.ip}
                  ip={entry.ip}
                  reason={entry.reason}
                  timestamp={entry.allowedAt}
                  by={entry.allowedBy}
                  geo={entry.geo}
                  type="whitelist"
                  isExpanded={expandedIp === entry.ip}
                  onToggleExpand={() => setExpandedIp(expandedIp === entry.ip ? null : entry.ip)}
                  onRemove={() => removeFromWhitelist(entry.ip)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[10px] text-gray-400 text-center">
        A geolocalizacao exibida e aproximada (hub do ISP). IPs na whitelist fazem bypass completo da blacklist e do auto-bloqueio.
      </p>
    </div>
  );
}

// ===== COMPONENTE: Card de IP (reutilizado para blacklist e whitelist) =====
function IpEntryCard({
  ip, reason, timestamp, by, geo, type, isExpanded, onToggleExpand, onRemove, onAllow, isWhitelisted, allowingIp
}: {
  ip: string;
  reason: string;
  timestamp: string;
  by: string;
  geo?: GeoData | null;
  type: 'blacklist' | 'whitelist';
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRemove: () => void;
  onAllow?: () => void;
  isWhitelisted?: boolean;
  allowingIp?: string | null;
}) {
  const location = geo ? [geo.district, geo.city, geo.region, geo.country].filter(Boolean).join(', ') : '';
  const isBlock = type === 'blacklist';

  return (
    <div className={`p-4 transition ${isBlock ? 'hover:bg-red-50/30' : 'hover:bg-emerald-50/30'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isBlock
              ? (geo?.isVpn ? 'bg-yellow-100' : 'bg-red-100')
              : 'bg-emerald-100'
          }`}>
            {isBlock ? (
              geo?.isVpn ? <Wifi className="w-5 h-5 text-yellow-600" /> : <Ban className="w-5 h-5 text-red-600" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-gray-900 text-sm">{ip}</span>
              {isBlock && geo?.isVpn && (
                <span className="bg-yellow-400 text-black px-1.5 py-0.5 rounded text-[9px] font-bold">VPN/PROXY</span>
              )}
              {isBlock && geo?.isHosting && !geo?.isVpn && (
                <span className="bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded text-[9px] font-bold">DATACENTER</span>
              )}
              {!isBlock && (
                <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-bold">PERMITIDO</span>
              )}
            </div>
            
            <p className="text-xs text-gray-600 mt-0.5">{reason}</p>
            
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500 flex-wrap">
              {location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> ~{location} <span className="text-gray-400">(aprox. ISP)</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(timestamp).toLocaleString('pt-BR')}
              </span>
              {by && (
                <span className="text-gray-400">por {by}</span>
              )}
            </div>

            {/* Expandir detalhes */}
            <button
              onClick={onToggleExpand}
              className="text-[10px] text-blue-600 hover:text-blue-800 mt-1.5 flex items-center gap-0.5"
            >
              {isExpanded ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {isExpanded ? 'Menos' : 'Ver detalhes'}
            </button>

            {isExpanded && geo && (
              <div className="mt-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-[11px] grid grid-cols-2 gap-1.5">
                {geo.isp && <div><span className="text-gray-400">ISP:</span> <span className="font-semibold">{geo.isp}</span></div>}
                {geo.org && <div><span className="text-gray-400">Org:</span> <span className="font-semibold">{geo.org}</span></div>}
                {geo.country && <div><span className="text-gray-400">Pais:</span> <span className="font-semibold">{geo.country}</span></div>}
                {geo.district && <div><span className="text-gray-400">Bairro:</span> <span className="font-semibold">{geo.district}</span></div>}
                {(geo.lat != null && geo.lon != null) && (
                  <div className="col-span-2">
                    <span className="text-gray-400">Coord (aprox.):</span>{' '}
                    <span className="font-mono">{geo.lat.toFixed(4)}, {geo.lon.toFixed(4)}</span>
                    {' '}
                    <a 
                      href={`https://www.google.com/maps?q=${geo.lat},${geo.lon}&z=15`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      Abrir mapa
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Ações */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          {isBlock && onAllow && (
            <button
              onClick={onAllow}
              className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
              title="Permitir acesso deste IP"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onRemove}
            className={`p-2 rounded-lg transition ${
              isBlock 
                ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' 
                : 'text-gray-400 hover:text-orange-600 hover:bg-orange-50'
            }`}
            title={isBlock ? 'Desbloquear IP' : 'Revogar permissao'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
