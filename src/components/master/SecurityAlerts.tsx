import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../../utils/supabase/client';
import { 
  AlertTriangle, Volume2, VolumeX, Bell, BellOff, X, 
  Shield, ShieldCheck, MapPin, Globe, Wifi, WifiOff, Eye, Clock, Languages, Ban, Fingerprint
} from 'lucide-react';

interface SecurityAlert {
  id: string;
  action: string;
  username: string;
  ip: string;
  status: string;
  geo?: any;
  userAgent?: string;
  isVpn?: boolean;
  timestamp: string;
  emittedAt: string;
  // WebRTC Leak
  realIp?: string | null;
  realGeo?: any;
  webrtcLeak?: boolean;
  // Browser Fingerprint (segunda camada)
  browserInfo?: any;
  timezoneMismatch?: boolean;
  languageMismatch?: boolean;
  mismatchDetails?: string;
  // Auto-blacklist
  autoBlacklist?: boolean;
  relatedVpnIp?: string | null;
  // Fingerprint multi-IP (VPN hopping)
  fingerprintId?: string;
  fingerprintIps?: string[];
  fingerprintIpCount?: number;
  fingerprintDetails?: string;
}

interface SecurityAlertsProps {
  onBlockIp?: (ip: string, reason: string) => void;
  onAllowIp?: (ip: string, reason: string) => void;
  /** Quando true, renderiza inline (dentro de uma pagina) em vez de flutuante */
  embedded?: boolean;
}

// Gerar som de alerta usando Web Audio API (sem arquivo externo)
function playAlertSound(type: 'warning' | 'critical' = 'warning') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'critical') {
      // Som urgente: sirene rápida
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.15);
      osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.3);
      osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.45);
      osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.7);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.7);
    } else {
      // Som de aviso: beep duplo
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + 0.18);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    console.warn('Audio API indisponivel:', e);
  }
}

// Enviar notificacao push do navegador
function sendBrowserNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '🚨',
      tag: 'security-alert',
      requireInteraction: true
    });
  }
}

export function SecurityAlerts({ onBlockIp, onAllowIp, embedded = false }: SecurityAlertsProps) {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const lastAlertRef = useRef<string>('');
  const channelRef = useRef<any>(null);
  const mountedRef = useRef(true);
  
  // 🔊 Refs para evitar re-criação do callback e re-subscribe do Realtime
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  const notifEnabledRef = useRef(notifEnabled);
  notifEnabledRef.current = notifEnabled;

  // Pedir permissao de notificacao
  const requestNotifPermission = useCallback(async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotifEnabled(perm === 'granted');
    }
  }, []);

  // Processar novo alerta — usa refs para som/notif para manter callback estavel
  const handleNewAlert = useCallback((alert: SecurityAlert) => {
    if (!mountedRef.current) return;
    if (alert.id === lastAlertRef.current) return; // Evitar duplicata
    
    lastAlertRef.current = alert.id;
    
    setAlerts(prev => [alert, ...prev].slice(0, 50)); // Manter ultimos 50
    setShowPanel(true); // Abrir painel automaticamente

    const isCritical = alert.isVpn || alert.action === 'LOGIN_RATE_LIMITED' || alert.action === 'LOGIN_BLACKLISTED' || alert.webrtcLeak || alert.autoBlacklist || alert.action === 'IP_AUTO_BLACKLISTED' || alert.action === 'FINGERPRINT_MULTI_IP';
    
    // ✅ Usar refs para ler estado atual sem precisar de deps
    if (soundEnabledRef.current) {
      playAlertSound(isCritical ? 'critical' : 'warning');
    }
    
    if (notifEnabledRef.current) {
      const location = alert.geo ? [alert.geo.city, alert.geo.country].filter(Boolean).join(', ') : 'Local desconhecido';
      const vpnTag = alert.isVpn ? ' [VPN DETECTADA]' : '';
      const leakTag = alert.webrtcLeak ? ` [IP REAL: ${alert.realIp}]` : '';
      const mismatchTag = (alert.timezoneMismatch || alert.languageMismatch) ? ' [MISMATCH]' : '';
      const autoBlTag = alert.autoBlacklist ? ' [AUTO-BLOCK]' : '';
      const fpTag = alert.fingerprintId ? ` [FP: ${alert.fingerprintIpCount} IPs]` : '';
      sendBrowserNotification(
        `🚨 Alerta de Seguranca${vpnTag}${leakTag}${mismatchTag}${autoBlTag}${fpTag}`,
        `${getActionLabel(alert.action)} | IP: ${alert.ip} | ${location}`
      );
    }
  }, []); // ← sem dependencias, callback estavel

  // Conectar ao Supabase Realtime para monitorar security_alert:latest
  useEffect(() => {
    mountedRef.current = true;

    const channel = supabase
      .channel('security-alerts-monitor', {
        config: { broadcast: { self: false } }
      })
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'kv_store_dfe23da2',
        },
        (payload: any) => {
          const key = payload?.new?.key || '';
          if (key === 'security_alert:latest') {
            try {
              const value = payload?.new?.value;
              const alertData = typeof value === 'string' ? JSON.parse(value) : value;
              if (alertData && alertData.id) {
                handleNewAlert(alertData);
              }
            } catch (e) {
              console.warn('[SecurityAlerts] Erro ao parsear alerta:', e);
            }
          }
        }
      )
      .subscribe((status: string) => {
        if (!mountedRef.current) return;
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          console.log('[SecurityAlerts] Realtime conectado - monitorando alertas');
        }
      });

    channelRef.current = channel;

    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [handleNewAlert]);

  // Polling de seguranca a cada 10s como safety net
  useEffect(() => {
    if (!mountedRef.current) return;
    
    // Nao importar dynamicamente - usar fetch direto com masterFetch padrao
    const checkAlert = async () => {
      try {
        const token = sessionStorage.getItem('faroeste_master_token');
        if (!token) return;
        
        const { projectId, publicAnonKey } = await import('../../utils/supabase/info');
        const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-dfe23da2`;
        const res = await fetch(`${baseUrl}/master/security-alert`, {
          headers: { 
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-Master-Token': token
          }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.alert?.id && data.alert.id !== lastAlertRef.current) {
          handleNewAlert(data.alert);
        }
      } catch (e) {
        // Silencioso
      }
    };

    const interval = setInterval(checkAlert, 10000);
    checkAlert(); // Primeira verificacao imediata

    return () => clearInterval(interval);
  }, [handleNewAlert]);

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  // Badge com contagem no canto
  const unreadCount = alerts.length;

  // ===== MODO EMBEDDED: renderiza inline dentro da pagina =====
  if (embedded) {
    return (
      <div className="space-y-4">
        {/* Header inline */}
        <div className="bg-gray-900 rounded-xl text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-red-400" />
            <div>
              <h3 className="font-bold text-sm">Central de Seguranca — Alertas em Tempo Real</h3>
              <div className="flex items-center gap-2 text-xs mt-0.5">
                {isConnected ? (
                  <span className="flex items-center gap-1 text-green-400">
                    <Wifi className="w-3 h-3" /> Realtime ativo
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-400">
                    <WifiOff className="w-3 h-3" /> Polling (10s)
                  </span>
                )}
                <span className="text-gray-400">|</span>
                <span className="text-gray-300">{alerts.length} alerta{alerts.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg transition ${soundEnabled ? 'bg-green-600/20 text-green-400' : 'bg-gray-800 text-gray-500'}`}
              title={soundEnabled ? 'Som ativado' : 'Som desativado'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={() => notifEnabled ? setNotifEnabled(false) : requestNotifPermission()}
              className={`p-2 rounded-lg transition ${notifEnabled ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-800 text-gray-500'}`}
              title={notifEnabled ? 'Notificacoes ativadas' : 'Ativar notificacoes'}
            >
              {notifEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Lista de alertas inline */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {alerts.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <Shield className="w-14 h-14 mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium">Nenhum alerta recente</p>
              <p className="text-xs mt-1">Tentativas de login suspeitas aparecerao aqui em tempo real</p>
              <p className="text-xs mt-3 text-gray-300">O sistema monitora via Supabase Realtime + polling a cada 10s</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                {alerts.map((alert) => (
                  <AlertCard 
                    key={alert.id} 
                    alert={alert} 
                    onDismiss={() => dismissAlert(alert.id)}
                    onBlock={onBlockIp}
                    onAllow={onAllowIp}
                  />
                ))}
              </div>
              <div className="p-3 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => setAlerts([])}
                  className="w-full text-xs text-gray-500 hover:text-gray-700 py-1.5 transition"
                >
                  Limpar todos os alertas ({alerts.length})
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ===== MODO FLUTUANTE (original) =====
  return (
    <>
      {/* Botao flutuante */}
      {!embedded && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
          {/* Alerta mais recente (toast) */}
          {alerts.length > 0 && !showPanel && (
            <div 
              className="bg-red-600 text-white rounded-xl shadow-2xl px-4 py-3 max-w-sm cursor-pointer animate-bounce"
              onClick={() => setShowPanel(true)}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="w-4 h-4" />
                {alerts[0].isVpn && <span className="bg-yellow-400 text-black px-1.5 py-0.5 rounded text-[10px] font-bold">VPN</span>}
                {alerts[0].webrtcLeak && <span className="bg-white text-red-600 px-1.5 py-0.5 rounded text-[10px] font-bold">IP REAL VAZADO</span>}
                {getActionLabel(alerts[0].action)}
              </div>
              <div className="text-xs opacity-90 mt-1">
                IP: {alerts[0].ip} | {alerts[0].geo ? [alerts[0].geo.city, alerts[0].geo.country].filter(Boolean).join(', ') : '?'}
                {alerts[0].webrtcLeak && alerts[0].realIp && (
                  <span className="block mt-0.5 font-bold">IP Real (WebRTC): {alerts[0].realIp}</span>
                )}
              </div>
            </div>
          )}

          {/* Botao do sino */}
          <button
            onClick={() => setShowPanel(!showPanel)}
            className={`relative p-3.5 rounded-full shadow-lg transition-all ${
              alerts.length > 0 
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' 
                : 'bg-gray-800 hover:bg-gray-700 text-white'
            }`}
          >
            <Shield className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
            {/* Indicator de conexao */}
            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
              isConnected ? 'bg-green-400' : 'bg-red-400'
            }`} />
          </button>
        </div>
      )}

      {/* Painel lateral */}
      {showPanel && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200">
          {/* Header */}
          <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-red-400" />
              <div>
                <h3 className="font-bold text-sm">Central de Seguranca</h3>
                <div className="flex items-center gap-2 text-xs mt-0.5">
                  {isConnected ? (
                    <span className="flex items-center gap-1 text-green-400">
                      <Wifi className="w-3 h-3" /> Realtime ativo
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-400">
                      <WifiOff className="w-3 h-3" /> Polling (10s)
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {/* Som */}
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-lg transition ${soundEnabled ? 'bg-green-600/20 text-green-400' : 'bg-gray-800 text-gray-500'}`}
                title={soundEnabled ? 'Som ativado' : 'Som desativado'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              
              {/* Notificacoes */}
              <button
                onClick={() => notifEnabled ? setNotifEnabled(false) : requestNotifPermission()}
                className={`p-2 rounded-lg transition ${notifEnabled ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-800 text-gray-500'}`}
                title={notifEnabled ? 'Notificacoes ativadas' : 'Ativar notificacoes'}
              >
                {notifEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </button>
              
              {/* Fechar */}
              <button
                onClick={() => setShowPanel(false)}
                className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lista de alertas */}
          <div className="flex-1 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium">Nenhum alerta recente</p>
                <p className="text-xs mt-1">Tentativas de login suspeitas aparecerao aqui em tempo real</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {alerts.map((alert) => (
                  <AlertCard 
                    key={alert.id} 
                    alert={alert} 
                    onDismiss={() => dismissAlert(alert.id)}
                    onBlock={onBlockIp}
                    onAllow={onAllowIp}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {alerts.length > 0 && (
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setAlerts([])}
                className="w-full text-xs text-gray-500 hover:text-gray-700 py-1.5 transition"
              >
                Limpar todos os alertas ({alerts.length})
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function AlertCard({ alert, onDismiss, onBlock, onAllow }: { 
  alert: SecurityAlert; 
  onDismiss: () => void;
  onBlock?: (ip: string, reason: string) => void;
  onAllow?: (ip: string, reason: string) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const isCritical = alert.isVpn || alert.action === 'LOGIN_BLACKLISTED' || alert.action === 'LOGIN_RATE_LIMITED' || alert.webrtcLeak || alert.autoBlacklist || alert.action === 'IP_AUTO_BLACKLISTED' || alert.action === 'FINGERPRINT_MULTI_IP';
  const geo = alert.geo;
  const location = geo ? [geo.district, geo.city, geo.region, geo.country].filter(Boolean).join(', ') : '';
  const realGeo = alert.realGeo;
  const realLocation = realGeo ? [realGeo.city, realGeo.region, realGeo.country].filter(Boolean).join(', ') : '';

  return (
    <div className={`p-4 transition ${isCritical ? 'bg-red-50' : 'bg-orange-50/50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isCritical ? 'bg-red-100' : 'bg-orange-100'
          }`}>
            <AlertTriangle className={`w-4 h-4 ${isCritical ? 'text-red-600' : 'text-orange-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold ${isCritical ? 'text-red-800' : 'text-orange-800'}`}>
                {getActionLabel(alert.action)}
              </span>
              {alert.isVpn && (
                <span className="bg-yellow-400 text-black px-1.5 py-0.5 rounded text-[9px] font-bold">
                  VPN/PROXY
                </span>
              )}
              {geo?.isHosting && !alert.isVpn && (
                <span className="bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded text-[9px] font-bold">
                  DATACENTER
                </span>
              )}
              {alert.webrtcLeak && alert.realIp && (
                <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[9px] font-bold animate-pulse">
                  IP REAL: {alert.realIp}
                </span>
              )}
              {/* 🌐 Timezone / Language mismatch badges */}
              {alert.timezoneMismatch && (
                <span className="bg-orange-500 text-white px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  TZ MISMATCH
                </span>
              )}
              {alert.languageMismatch && (
                <span className="bg-amber-600 text-white px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5">
                  <Languages className="w-2.5 h-2.5" />
                  IDIOMA
                </span>
              )}
              {alert.autoBlacklist && (
                <span className="bg-black text-white px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 animate-pulse">
                  <Ban className="w-2.5 h-2.5" />
                  AUTO-BLOCK
                </span>
              )}
              {/* 🧬 Fingerprint multi-IP (VPN hopping) badge */}
              {alert.action === 'FINGERPRINT_MULTI_IP' && (
                <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 animate-pulse">
                  <Fingerprint className="w-2.5 h-2.5" />
                  {alert.fingerprintIpCount || '?'} IPs
                </span>
              )}
            </div>
            
            <div className="mt-1 space-y-0.5">
              <p className="text-xs text-gray-700 flex items-center gap-1">
                <Globe className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <span className="font-mono font-semibold">{alert.ip}</span>
                {alert.isVpn && <span className="text-[9px] text-yellow-700">(VPN)</span>}
              </p>
              {location && (
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  {(['exata','muito-alta','alta'].includes(geo?.geoConfidence || '')) ? '' : '~'}{location}
                  {alert.isVpn && <span className="text-[9px] text-yellow-700">(servidor VPN)</span>}
                  {!alert.isVpn && geo?.geoConfidence === 'exata' && <span className="text-[9px] text-blue-700 italic font-bold">(EXATO {geo.geoSourcesAgree || geo.geoSources}/{geo.geoSources} fontes{geo.geoZipConfirmed ? `, CEP ${geo.geoConfirmedZip} ✓` : ''})</span>}
                  {!alert.isVpn && geo?.geoConfidence === 'muito-alta' && <span className="text-[9px] text-emerald-600 italic">(triangulado {geo.geoSourcesAgree || geo.geoSources}/{geo.geoSources} fontes{geo.geoZipConfirmed ? ', CEP ✓' : ''})</span>}
                  {!alert.isVpn && geo?.geoConfidence === 'alta' && <span className="text-[9px] text-green-600 italic">(confirmado {geo.geoSourcesAgree || geo.geoSources}/{geo.geoSources} fontes{geo.geoIspType === 'mobile' ? ' 📱' : ''})</span>}
                  {!alert.isVpn && !['exata','muito-alta','alta'].includes(geo?.geoConfidence || '') && <span className="text-[9px] text-amber-600 italic">(aprox. ISP)</span>}
                </p>
              )}
              {/* IP Real detectado via WebRTC */}
              {alert.webrtcLeak && alert.realIp && (
                <>
                  <p className="text-xs text-red-700 flex items-center gap-1 font-semibold">
                    <Shield className="w-3 h-3 text-red-500 flex-shrink-0" />
                    <span className="font-mono">{alert.realIp}</span>
                    <span className="text-[9px]">(IP real via WebRTC)</span>
                  </p>
                  {realLocation && (
                    <p className="text-xs text-red-600 flex items-center gap-1 font-semibold">
                      <MapPin className="w-3 h-3 text-red-400 flex-shrink-0" />
                      {realLocation}
                      <span className="text-[9px]">(local real)</span>
                    </p>
                  )}
                </>
              )}
              <p className="text-[10px] text-gray-400">
                {new Date(alert.timestamp).toLocaleString('pt-BR')}
              </p>
            </div>

            {/* Acoes */}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
              >
                <Eye className="w-3 h-3" />
                {showDetails ? 'Menos' : 'Detalhes'}
              </button>
              {onBlock && (
                <button
                  onClick={() => onBlock(alert.ip, `Bloqueio automatico: ${alert.action} em ${alert.timestamp}`)}
                  className="text-[10px] text-red-600 hover:text-red-800 font-semibold flex items-center gap-0.5"
                >
                  <Shield className="w-3 h-3" />
                  Bloquear IP
                </button>
              )}
              {/* Permitir IP (whitelist) */}
              {onAllow && (
                <button
                  onClick={() => onAllow(alert.ip, `Permitido via alerta de seguranca: ${alert.action} em ${alert.timestamp}`)}
                  className="text-[10px] text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-0.5"
                >
                  <ShieldCheck className="w-3 h-3" />
                  Permitir IP
                </button>
              )}
              {/* Se tem IP real, oferecer bloquear tambem o IP real */}
              {onBlock && alert.webrtcLeak && alert.realIp && alert.realIp !== alert.ip && (
                <button
                  onClick={() => onBlock(alert.realIp!, `IP real detectado via WebRTC leak: ${alert.action} em ${alert.timestamp}`)}
                  className="text-[10px] text-red-800 hover:text-red-900 font-bold flex items-center gap-0.5 bg-red-100 px-1.5 py-0.5 rounded"
                >
                  <Shield className="w-3 h-3" />
                  Bloquear IP Real
                </button>
              )}
              {/* Se tem IP real, oferecer liberar tambem o IP real */}
              {onAllow && alert.webrtcLeak && alert.realIp && alert.realIp !== alert.ip && (
                <button
                  onClick={() => onAllow(alert.realIp!, `IP real detectado via WebRTC leak: ${alert.action} em ${alert.timestamp}`)}
                  className="text-[10px] text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-0.5 bg-emerald-100 px-1.5 py-0.5 rounded"
                >
                  <ShieldCheck className="w-3 h-3" />
                  Permitir IP Real
                </button>
              )}
            </div>

            {/* Detalhes expandidos */}
            {showDetails && (
              <div className="mt-2 p-2 bg-white rounded-lg border border-gray-200 text-[10px] space-y-1">
                <p><b>Usuario:</b> {alert.username}</p>
                {geo?.isp && <p><b>ISP:</b> {geo.isp}</p>}
                {geo?.org && <p><b>Org:</b> {geo.org}</p>}
                {geo?.asn && <p><b>ASN:</b> {geo.asn}</p>}
                {geo?.timezone && <p><b>Fuso:</b> {geo.timezone}</p>}
                {alert.userAgent && alert.userAgent !== 'unknown' && (
                  <p className="break-all"><b>UA:</b> {alert.userAgent}</p>
                )}
                {(geo?.lat && geo?.lon) && (
                  <p>
                    <b>Coord:</b> {geo.lat.toFixed(4)}, {geo.lon.toFixed(4)}
                    {' '}
                    <a
                      href={`https://www.google.com/maps?q=${geo.lat},${geo.lon}&z=15`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      ver mapa
                    </a>
                  </p>
                )}
                {/* Detalhes do WebRTC Leak */}
                {alert.webrtcLeak && alert.realIp && (
                  <div className="mt-1 pt-1 border-t border-red-200">
                    <p className="font-bold text-red-700">WebRTC Leak Detectado:</p>
                    <p><b>IP Real:</b> <span className="text-red-700 font-mono">{alert.realIp}</span></p>
                    {realGeo?.isp && <p><b>ISP Real:</b> {realGeo.isp}</p>}
                    {realGeo?.org && <p><b>Org Real:</b> {realGeo.org}</p>}
                    {realGeo?.timezone && <p><b>Fuso Real:</b> {realGeo.timezone}</p>}
                    {realLocation && <p><b>Local Real:</b> <span className="text-red-700 font-bold">{realLocation}</span></p>}
                    {(realGeo?.lat && realGeo?.lon) && (
                      <p>
                        <b>Coord Real:</b> {realGeo.lat.toFixed(4)}, {realGeo.lon.toFixed(4)}
                        {' '}
                        <a
                          href={`https://www.google.com/maps?q=${realGeo.lat},${realGeo.lon}&z=15`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-red-600 underline font-bold"
                        >
                          ver local real
                        </a>
                      </p>
                    )}
                  </div>
                )}
                {/* 🌐 Browser Fingerprint */}
                {alert.browserInfo && (
                  <div className="mt-1 pt-1 border-t border-blue-200">
                    <p className="font-bold text-blue-700">Fingerprint do Navegador:</p>
                    {alert.browserInfo.timezone && <p><b>Fuso Horario:</b> {alert.browserInfo.timezone} (UTC{alert.browserInfo.timezoneOffset > 0 ? '-' : '+'}{Math.abs(alert.browserInfo.timezoneOffset / 60)})</p>}
                    {alert.browserInfo.language && <p><b>Idioma:</b> {alert.browserInfo.language}</p>}
                    {alert.browserInfo.languages && <p><b>Idiomas:</b> {alert.browserInfo.languages.join(', ')}</p>}
                    {alert.browserInfo.platform && <p><b>Plataforma:</b> {alert.browserInfo.platform}</p>}
                    {alert.browserInfo.screen && <p><b>Tela:</b> {alert.browserInfo.screen}</p>}
                    {alert.browserInfo.localTime && <p><b>Hora Local:</b> {alert.browserInfo.localTime}</p>}
                  </div>
                )}
                {/* Mismatch Details */}
                {(alert.timezoneMismatch || alert.languageMismatch) && (
                  <div className="mt-1 pt-1 border-t border-orange-300">
                    <p className="font-bold text-orange-700">Divergencia Detectada:</p>
                    {alert.mismatchDetails && <p className="text-orange-700">{alert.mismatchDetails}</p>}
                    <p className="text-[9px] text-orange-600 mt-0.5">A timezone/idioma do navegador nao corresponde ao IP — forte indicativo de VPN.</p>
                  </div>
                )}
                {/* Auto-Blacklist Info */}
                {alert.autoBlacklist && (
                  <div className="mt-1 pt-1 border-t border-gray-900">
                    <p className="font-bold text-gray-900">Auto-Blacklist Aplicado:</p>
                    <p>O IP real <span className="font-mono text-red-700">{alert.realIp || alert.ip}</span> foi bloqueado automaticamente pelo sistema.</p>
                    {alert.relatedVpnIp && <p><b>IP VPN relacionado:</b> <span className="font-mono">{alert.relatedVpnIp}</span></p>}
                  </div>
                )}
                {/* 🧬 Fingerprint Multi-IP (VPN Hopping) */}
                {alert.action === 'FINGERPRINT_MULTI_IP' && alert.fingerprintIps && (
                  <div className="mt-1 pt-1 border-t border-indigo-300">
                    <p className="font-bold text-indigo-700 flex items-center gap-1">
                      <Fingerprint className="w-3 h-3" />
                      VPN Hopping Detectado
                    </p>
                    <p><b>Fingerprint:</b> <span className="font-mono text-indigo-700">{alert.fingerprintId}</span></p>
                    <p><b>IPs utilizados ({alert.fingerprintIpCount}):</b></p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {alert.fingerprintIps.map((fpIp: string, i: number) => (
                        <span key={i} className="font-mono bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded text-[9px]">
                          {fpIp}
                        </span>
                      ))}
                    </div>
                    {alert.fingerprintDetails && <p className="mt-1 text-indigo-600">{alert.fingerprintDetails}</p>}
                    <p className="text-[9px] text-indigo-500 mt-1">O mesmo navegador (timezone + idioma + resolucao + plataforma) foi visto em multiplos IPs nas ultimas 24h. Indica troca de VPN/proxy.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <button onClick={onDismiss} className="p-1 hover:bg-gray-200 rounded transition flex-shrink-0">
          <X className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>
    </div>
  );
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    'LOGIN_FAILED': 'Login falhou',
    'LOGIN_RATE_LIMITED': 'IP bloqueado (rate limit)',
    'LOGIN_BLACKLISTED': 'IP da blacklist tentou acesso',
    'DELIVERY_LOGIN_FAILED': 'Login entregador falhou',
    'WEBRTC_LEAK_DETECTED': 'IP real vazado via WebRTC',
    'BROWSER_MISMATCH_DETECTED': 'Timezone/Idioma inconsistente',
    'IP_AUTO_BLACKLISTED': 'IP real auto-bloqueado',
    'FINGERPRINT_MULTI_IP': 'Multi-IP detectado (VPN hopping)',
  };
  return labels[action] || action;
}