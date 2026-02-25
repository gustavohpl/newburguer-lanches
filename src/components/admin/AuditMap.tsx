import { useEffect, useRef, useState, useCallback } from 'react';
import { Map, Maximize2, Minimize2, Trash2, Layers, Eye, EyeOff, Crosshair } from 'lucide-react';

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
  // Multi-source
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
  // v3
  geoZipConfirmed?: boolean;
  geoConfirmedZip?: string | null;
  geoIspType?: string;
  geoRansacRefined?: number;
  geoCountryFiltered?: number;
  // v4.1 — precisao em metros
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
  // WebRTC Leak
  realIp?: string | null;
  realGeo?: GeoInfo | null;
  webrtcLeak?: boolean;
}

interface AuditMapProps {
  logs: AuditLog[];
}

// Injetar CSS do Leaflet globalmente (uma vez)
let leafletCssInjected = false;
function injectLeafletCss() {
  if (leafletCssInjected) return;
  leafletCssInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  link.crossOrigin = '';
  document.head.appendChild(link);
  
  // Fix icone padrao do Leaflet (URLs quebradas com bundlers)
  const style = document.createElement('style');
  style.textContent = `
    .leaflet-default-icon-path { background-image: none !important; }
    .audit-map-container { z-index: 1; }
    .audit-map-container .leaflet-popup-content-wrapper {
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    }
    .audit-map-container .leaflet-popup-content {
      margin: 0;
      min-width: 240px;
      max-width: 360px;
    }
    .audit-popup { padding: 12px 14px; font-family: system-ui, sans-serif; }
    .audit-popup-header { font-weight: 700; font-size: 13px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
    .audit-popup-row { font-size: 11px; color: #555; line-height: 1.6; display: flex; gap: 4px; }
    .audit-popup-row b { color: #1f2937; font-weight: 600; }
    .audit-popup-badge {
      display: inline-block; padding: 2px 8px; border-radius: 9999px;
      font-size: 10px; font-weight: 600; margin-top: 6px;
    }
    .audit-popup-badge.success { background: #dcfce7; color: #166534; }
    .audit-popup-badge.failure { background: #fee2e2; color: #991b1b; }
    .audit-popup-badge.rate-limited { background: #f3e8ff; color: #6b21a8; }
    .audit-accuracy-badge {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700;
      margin-top: 4px; margin-bottom: 2px;
    }
    .source-table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9px; }
    .source-table th { background: #f3f4f6; padding: 3px 5px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; }
    .source-table td { padding: 2.5px 5px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
    .source-table tr:hover td { background: #f9fafb; }
    .source-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 3px; vertical-align: middle; }
    .source-weight-bar { display: inline-block; height: 4px; border-radius: 2px; vertical-align: middle; }
    .convergence-badge { display: inline-flex; align-items: center; gap: 2px; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; }
  `;
  document.head.appendChild(style);
}

// Formatar precisao em metros/km
function formatAccuracy(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

// Cores por nome de fonte
const SOURCE_COLORS: Record<string, string> = {
  'ip-api.com':         '#3b82f6',
  'ipwho.is':           '#8b5cf6',
  'ipapi.co':           '#06b6d4',
  'ipwhois.app':        '#10b981',
  'freeipapi.com':      '#f59e0b',
  'reallyfreegeoip.org':'#ef4444',
  'geoplugin.net':      '#ec4899',
  'iplocate.io':        '#6366f1',
};

function getSourceColor(source: string): string {
  return SOURCE_COLORS[source] || '#6b7280';
}

// Criar SVG marker customizado
function createMarkerSvg(color: string, pulse: boolean = false): string {
  const pulseCircle = pulse ? `<circle cx="12" cy="12" r="10" fill="${color}" opacity="0.3"><animate attributeName="r" from="10" to="20" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.3" to="0" dur="1.5s" repeatCount="indefinite"/></circle>` : '';
  return `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">${pulseCircle}<path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z" fill="${color}" stroke="white" stroke-width="2"/><circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/><circle cx="14" cy="14" r="3" fill="${color}"/></svg>`)}`;
}

// Criar SVG para mini-marker de fonte individual
function createSourceDotSvg(color: string, inCluster: boolean, refined: boolean): string {
  const r = inCluster ? (refined ? 5 : 6) : 4;
  const stroke = inCluster ? 'white' : '#ef4444';
  const strokeW = inCluster ? 1.5 : 2;
  const opacity = refined ? 0.6 : 1;
  const dashArray = refined ? 'stroke-dasharray="2 1"' : '';
  return `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="${r}" fill="${color}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="${strokeW}" ${dashArray}/>${!inCluster ? '<line x1="5" y1="5" x2="11" y2="11" stroke="#ef4444" stroke-width="1.5"/><line x1="11" y1="5" x2="5" y2="11" stroke="#ef4444" stroke-width="1.5"/>' : ''}</svg>`)}`;
}

export function AuditMap({ logs }: AuditMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const leafletLibRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const sourceLayersRef = useRef<any[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'success' | 'failure'>('all');
  const [isCleared, setIsCleared] = useState(false);
  const [showSourceDots, setShowSourceDots] = useState(false);
  const [showLegend, setShowLegend] = useState(true);

  // Filtrar logs que tem coordenadas
  const geoLogs = logs.filter(l => l.geo?.lat != null && l.geo?.lon != null);
  
  const filteredLogs = selectedFilter === 'all' 
    ? geoLogs 
    : geoLogs.filter(l => {
        if (selectedFilter === 'failure') return l.status === 'failure';
        return l.status === 'success';
      });

  // Agrupar por IP para mostrar contagem
  const ipCounts = geoLogs.reduce((acc, log) => {
    acc[log.ip] = (acc[log.ip] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Stats de precisao
  const avgAccuracy = (() => {
    const vals = geoLogs.map(l => l.geo?.geoEstimatedAccuracyM).filter((v): v is number => v != null && v > 0);
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  })();

  // Limpar mapa
  const clearMap = useCallback(() => {
    if (!leafletMapRef.current || !mapReady) return;
    const map = leafletMapRef.current;
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    sourceLayersRef.current.forEach(m => map.removeLayer(m));
    sourceLayersRef.current = [];
    map.setView([-14.235, -51.9253], 4);
    setIsCleared(true);
  }, [mapReady]);

  // Restaurar markers
  const restoreMarkers = useCallback(() => {
    setIsCleared(false);
  }, []);

  // Toggle source dots
  const toggleSourceDots = useCallback(() => {
    const map = leafletMapRef.current;
    if (!map) return;
    const newState = !showSourceDots;
    setShowSourceDots(newState);
    sourceLayersRef.current.forEach(layer => {
      if (newState) map.addLayer(layer);
      else map.removeLayer(layer);
    });
  }, [showSourceDots]);

  useEffect(() => {
    injectLeafletCss();
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    
    let L: any;
    let map: any;

    const initMap = async () => {
      try {
        L = await import('leaflet');
        
        if (leafletMapRef.current) {
          leafletMapRef.current.remove();
          leafletMapRef.current = null;
        }

        map = L.map(mapRef.current, {
          center: [-14.235, -51.9253],
          zoom: 4,
          zoomControl: true,
          attributionControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);

        leafletMapRef.current = map;
        leafletLibRef.current = L;
        setMapReady(true);
      } catch (err) {
        console.error('Erro ao inicializar mapa Leaflet:', err);
      }
    };

    initMap();

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        setMapReady(false);
      }
    };
  }, [isExpanded]);

  // Atualizar markers quando logs ou filtro mudar
  useEffect(() => {
    if (!leafletMapRef.current || !mapReady || isCleared) return;

    const L = leafletLibRef.current;
    if (!L) return;

    const map = leafletMapRef.current;

    // Limpar markers anteriores
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    sourceLayersRef.current.forEach(m => map.removeLayer(m));
    sourceLayersRef.current = [];

    if (filteredLogs.length === 0) return;

    // Agrupar por IP+coordenada
    const grouped: Record<string, { logs: AuditLog[]; lat: number; lon: number }> = {};
    
    filteredLogs.forEach(log => {
      const key = `${log.geo!.lat},${log.geo!.lon}`;
      if (!grouped[key]) {
        grouped[key] = { logs: [], lat: log.geo!.lat!, lon: log.geo!.lon! };
      }
      grouped[key].logs.push(log);
    });

    const bounds: [number, number][] = [];

    Object.values(grouped).forEach(({ logs: groupLogs, lat, lon }) => {
      bounds.push([lat, lon]);
      
      const hasFailure = groupLogs.some(l => l.status === 'failure');
      const hasRateLimited = groupLogs.some(l => l.action === 'LOGIN_RATE_LIMITED');
      const hasVpn = groupLogs.some(l => l.geo?.isVpn);
      const hasBlacklisted = groupLogs.some(l => l.action === 'LOGIN_BLACKLISTED');
      
      const color = hasVpn ? '#eab308' : hasRateLimited ? '#7c3aed' : hasFailure ? '#dc2626' : '#16a34a';
      const pulse = hasFailure || hasRateLimited || hasVpn;

      const icon = L.icon({
        iconUrl: createMarkerSvg(color, pulse),
        iconSize: [28, 40],
        iconAnchor: [14, 40],
        popupAnchor: [0, -42],
      });

      // Montar popup HTML
      const firstLog = groupLogs[0];
      const geo = firstLog.geo!;
      const locationParts = [geo.district, geo.city, geo.region, geo.country].filter(Boolean);
      
      // Badge de precisao em metros (v4.1)
      const accuracyM = geo.geoEstimatedAccuracyM;
      const p68M = geo.geoP68RadiusM;
      const p95M = geo.geoP95RadiusM;
      const maxM = geo.geoMaxRadiusM;
      const hasMetersData = accuracyM != null && accuracyM > 0;
      const accuracyBadgeColor = !hasMetersData ? '#6b7280'
        : accuracyM! <= 200 ? '#1d4ed8'
        : accuracyM! <= 500 ? '#059669'
        : accuracyM! <= 2000 ? '#16a34a'
        : accuracyM! <= 5000 ? '#ca8a04'
        : '#dc2626';
      
      const accuracyBadgeHtml = hasMetersData
        ? `<div class="audit-accuracy-badge" style="background:${accuracyBadgeColor}15;color:${accuracyBadgeColor};border:1px solid ${accuracyBadgeColor}30;">
             <span style="font-size:12px;">&#127919;</span>
             <span>&plusmn;${formatAccuracy(accuracyM!)}</span>
             ${p95M != null ? `<span style="opacity:0.6;font-size:9px;">(p95: ${formatAccuracy(p95M)})</span>` : ''}
           </div>
           ${p68M != null && p95M != null && maxM != null ? `
           <div style="display:flex;gap:6px;margin-top:3px;font-size:9px;color:#6b7280;">
             <span title="Raio p68 (1 sigma)">p68: ${formatAccuracy(p68M)}</span>
             <span title="Raio p95 (2 sigma)">p95: ${formatAccuracy(p95M)}</span>
             <span title="Raio maximo">max: ${formatAccuracy(maxM)}</span>
             ${(geo.geoIwcrConvergenceDeltaM != null) ? `<span class="convergence-badge" style="background:#dbeafe;color:#1d4ed8;" title="Delta de convergencia IWCR">&delta;${geo.geoIwcrConvergenceDeltaM < 1 ? '<1' : Math.round(geo.geoIwcrConvergenceDeltaM)}m</span>` : ''}
           </div>` : ''}`
        : '';

      const vpnBadge = hasVpn 
        ? '<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:700;background:#fbbf24;color:#000;margin-right:4px;">VPN/PROXY</span>' 
        : '';
      const blacklistBadge = hasBlacklisted
        ? '<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:700;background:#1f2937;color:#fff;margin-right:4px;">BLACKLIST</span>'
        : '';
      
      const statusBadge = hasRateLimited 
        ? '<span class="audit-popup-badge rate-limited">BLOQUEADO</span>'
        : hasFailure 
          ? '<span class="audit-popup-badge failure">INVASAO DETECTADA</span>'
          : '<span class="audit-popup-badge success">ACESSO AUTORIZADO</span>';

      const logsList = groupLogs.slice(0, 5).map(l => {
        const date = new Date(l.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const icon = l.status === 'failure' ? '&#10060;' : '&#9989;';
        return `<div class="audit-popup-row">${icon} <b>${l.username}</b> - ${date}</div>`;
      }).join('');

      const extraCount = groupLogs.length > 5 ? `<div class="audit-popup-row" style="color:#6b7280;margin-top:4px;">... +${groupLogs.length - 5} registros</div>` : '';

      // Confidence display
      const confDisplay = (() => {
        const conf = geo.geoConfidence;
        const sources = `${geo.geoSourcesAgree || geo.geoSources || '?'}/${geo.geoSources || '?'}`;
        const divKm = geo.geoMaxDivergence ?? '?';
        const metersStr = hasMetersData ? ` &mdash; &plusmn;${formatAccuracy(accuracyM!)} do alvo` : '';
        const iwcrStr = geo.geoIwcrRounds ? `, IWCR ${geo.geoIwcrRounds}r` : '';
        
        if (conf === 'exata') {
          return `<div class="audit-popup-row" style="color:#1d4ed8;font-weight:bold;margin-bottom:4px;">&#128205; Localizacao EXATA &mdash; ${sources} fontes (&Delta;${divKm}km${iwcrStr})${metersStr}</div>`;
        } else if (conf === 'muito-alta') {
          return `<div class="audit-popup-row" style="color:#059669;margin-bottom:4px;">&#127919; Triangulada por ${sources} fontes (&Delta;${divKm}km${iwcrStr})${metersStr}</div>`;
        } else if (conf === 'alta') {
          return `<div class="audit-popup-row" style="color:#16a34a;margin-bottom:4px;">&#9989; Confirmada por ${sources} fontes (&Delta;${divKm}km)${metersStr}</div>`;
        } else if (conf === 'media') {
          return `<div class="audit-popup-row" style="color:#ca8a04;margin-bottom:4px;">&#9888; Parcialmente confirmada (&Delta;${divKm}km)${metersStr}</div>`;
        } else {
          return `<div class="audit-popup-row" style="color:#b45309;margin-bottom:4px;">Localizacao aproximada &mdash; baseada no hub do ISP</div>`;
        }
      })();

      // Source details table (v4.1 — scatter breakdown)
      const sourceDetailsHtml = (() => {
        const details = geo.geoSourceDetails;
        if (!details || details.length === 0) return '';
        
        const rows = details.map(s => {
          const srcColor = getSourceColor(s.source);
          const clusterIcon = s.countryFiltered ? '&#127760;' : !s.inCluster ? '&#10060;' : s.refined ? '&#128269;' : '&#9989;';
          const weightPct = Math.round((s.effectiveWeight ?? s.weight) * 100);
          const weightBarWidth = Math.round(weightPct * 0.4);
          const distStr = s.distToAvg < 1 ? `${Math.round(s.distToAvg * 1000)}m` : `${s.distToAvg.toFixed(1)}km`;
          const vpnIcon = s.vpn ? ' <span style="color:#eab308;">&#128737;</span>' : '';
          const zipIcon = s.zip ? ` <span style="color:#4338ca;font-size:8px;">${s.zip}</span>` : '';
          
          return `<tr>
            <td><span class="source-dot" style="background:${srcColor};"></span>${s.source.replace('.com','').replace('.io','').replace('.org','').replace('.net','')}</td>
            <td style="text-align:right;font-family:monospace;font-size:8px;">${distStr}</td>
            <td><span class="source-weight-bar" style="width:${weightBarWidth}px;background:${srcColor};opacity:${s.refined ? 0.4 : 0.8};"></span> <span style="font-size:8px;">${weightPct}%</span></td>
            <td style="text-align:center;">${clusterIcon}${vpnIcon}${zipIcon}</td>
          </tr>`;
        }).join('');

        return `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;">
          <div style="font-size:10px;font-weight:700;color:#374151;margin-bottom:3px;display:flex;align-items:center;gap:4px;">
            &#128225; Detalhes por Fonte (${details.length})
            <span style="font-weight:400;color:#9ca3af;font-size:9px;">Precision Engine v4.1</span>
          </div>
          <table class="source-table">
            <thead><tr><th>Fonte</th><th style="text-align:right;">Dist</th><th>Peso</th><th style="text-align:center;">St</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      })();

      const popupHtml = `
        <div class="audit-popup">
          <div class="audit-popup-header">
            <span style="font-size:16px;">${hasFailure ? '&#128308;' : '&#128994;'}</span>
            ${locationParts.join(', ') || 'Local desconhecido'}
          </div>
          ${confDisplay}
          ${accuracyBadgeHtml}
          ${geo.geoZipConfirmed ? `<div class="audit-popup-row" style="color:#4338ca;font-size:10px;margin-bottom:2px;font-weight:600;">&#128238; CEP ${geo.geoConfirmedZip} confirmado por multiplas fontes</div>` : ''}
          ${geo.geoRansacRefined && geo.geoRansacRefined > 0 ? `<div class="audit-popup-row" style="color:#7c3aed;font-size:10px;margin-bottom:2px;">&#128300; RANSAC+IWCR: ${geo.geoRansacRefined} fonte(s) refinada(s)${geo.geoIwcrRounds ? `, ${geo.geoIwcrRounds} rodadas` : ''}</div>` : ''}
          ${geo.geoOutliers && geo.geoOutliers > 0 ? `<div class="audit-popup-row" style="color:#d97706;font-size:10px;margin-bottom:2px;">&#9888; ${geo.geoOutliers} outlier(s) descartado(s)${geo.geoOutlierSources ? `: ${geo.geoOutlierSources}` : ''}</div>` : ''}
          ${geo.geoCountryFiltered && geo.geoCountryFiltered > 0 ? `<div class="audit-popup-row" style="color:#6b7280;font-size:10px;margin-bottom:2px;">&#127760; ${geo.geoCountryFiltered} fonte(s) filtrada(s) por pais diferente</div>` : ''}
          <div class="audit-popup-row"><b>IP:</b> <span style="font-family:monospace;font-size:10px;">${firstLog.ip}</span></div>
          ${geo.district ? `<div class="audit-popup-row"><b>Bairro:</b> ${geo.district}</div>` : ''}
          ${geo.zip ? `<div class="audit-popup-row"><b>CEP:</b> ${geo.zip}${geo.geoZipConfirmed ? ' &#10003;' : ''}</div>` : ''}
          ${geo.isp ? `<div class="audit-popup-row"><b>Provedor:</b> ${geo.isp}${geo.geoIspType === 'mobile' ? ' <span style="color:#ea580c;font-weight:600;">&#128241; Mobile</span>' : ''}</div>` : ''}
          ${geo.asn ? `<div class="audit-popup-row"><b>ASN:</b> ${geo.asn}</div>` : ''}
          ${geo.timezone ? `<div class="audit-popup-row"><b>Fuso:</b> ${geo.timezone}</div>` : ''}
          ${sourceDetailsHtml}
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;">
            <div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:4px;">
              ${groupLogs.length} acesso${groupLogs.length > 1 ? 's' : ''} deste IP:
            </div>
            ${logsList}
            ${extraCount}
          </div>
          ${vpnBadge}${blacklistBadge}${statusBadge}
        </div>
      `;

      const marker = L.marker([lat, lon], { icon })
        .addTo(map)
        .bindPopup(popupHtml, { maxWidth: 360, closeButton: true });

      markersRef.current.push(marker);

      // === Source scatter dots (mini markers para cada fonte individual) ===
      const sourceDetails = geo.geoSourceDetails;
      if (sourceDetails && sourceDetails.length > 0) {
        sourceDetails.forEach(s => {
          if (s.lat == null || s.lon == null) return;
          const srcColor = getSourceColor(s.source);
          
          const dotIcon = L.icon({
            iconUrl: createSourceDotSvg(srcColor, s.inCluster, !!s.refined),
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });
          
          const dotMarker = L.marker([s.lat, s.lon], { icon: dotIcon, interactive: true })
            .bindTooltip(`<div style="font-size:10px;font-weight:600;padding:2px 4px;">
              <span style="color:${srcColor};">${s.source}</span><br/>
              <span style="color:#666;">Dist: ${s.distToAvg < 1 ? `${Math.round(s.distToAvg * 1000)}m` : `${s.distToAvg.toFixed(1)}km`}</span>
              ${s.zip ? `<br/><span style="color:#4338ca;">CEP: ${s.zip}</span>` : ''}
              ${s.refined ? '<br/><span style="color:#f59e0b;">RANSAC refinado</span>' : ''}
              ${!s.inCluster ? '<br/><span style="color:#ef4444;">OUTLIER</span>' : ''}
            </div>`, { direction: 'top', offset: [0, -8] });

          sourceLayersRef.current.push(dotMarker);
          
          // Linha do source dot ao centroide
          const lineOpacity = s.inCluster ? (s.refined ? 0.15 : 0.25) : 0.1;
          const lineDash = !s.inCluster ? '3 4' : s.refined ? '2 3' : undefined;
          const line = L.polyline(
            [[s.lat, s.lon], [lat, lon]],
            { color: srcColor, weight: 1, opacity: lineOpacity, dashArray: lineDash }
          );
          sourceLayersRef.current.push(line);
        });

        // Adicionar ao mapa se showSourceDots esta ativo
        if (showSourceDots) {
          sourceLayersRef.current.forEach(layer => map.addLayer(layer));
        }
      }

      // Circulo de raio de precisao adaptativo
      const conf = geo?.geoConfidence;
      const serverAccuracyM = geo?.geoEstimatedAccuracyM;
      const serverP95M = geo?.geoP95RadiusM;
      const divKm = geo?.geoMaxDivergence ?? null;
      const zipBoost = geo?.geoZipConfirmed ? 0.6 : 1;
      const mobileBoost = geo?.geoIspType === 'mobile' ? 1.5 : 1;
      
      let radiusM: number;
      if (serverP95M != null && serverP95M > 0) {
        radiusM = Math.round(Math.max(serverP95M, 80) * zipBoost * mobileBoost);
      } else if (serverAccuracyM != null && serverAccuracyM > 0) {
        radiusM = Math.round(Math.max(serverAccuracyM * 1.5, 100) * zipBoost * mobileBoost);
      } else {
        let baseRadiusM: number;
        if (conf === 'exata' && divKm != null) {
          baseRadiusM = Math.max(300, Math.min(divKm * 500, 1500));
        } else if (conf === 'exata') {
          baseRadiusM = 400;
        } else if (conf === 'muito-alta' && divKm != null) {
          baseRadiusM = Math.max(500, Math.min(divKm * 400, 3000));
        } else if (conf === 'muito-alta') {
          baseRadiusM = 1500;
        } else if (conf === 'alta') {
          baseRadiusM = divKm != null ? Math.max(1000, Math.min(divKm * 350, 8000)) : 5000;
        } else if (conf === 'media') {
          baseRadiusM = divKm != null ? Math.max(3000, Math.min(divKm * 300, 20000)) : 15000;
        } else {
          baseRadiusM = 0;
        }
        radiusM = Math.round(baseRadiusM * zipBoost * mobileBoost);
      }
      
      if (radiusM > 0 && !hasVpn) {
        const circleColor = conf === 'exata' ? '#3b82f6' : conf === 'muito-alta' ? '#059669' : conf === 'alta' ? '#16a34a' : '#ca8a04';
        
        // Circulo principal (p95)
        const circle = L.circle([lat, lon], {
          radius: radiusM,
          color: circleColor,
          fillColor: circleColor,
          fillOpacity: 0.05,
          weight: 1.5,
          dashArray: conf === 'media' ? '4 4' : undefined,
        }).addTo(map);
        
        // Tooltip no circulo externo com label
        circle.bindTooltip(`<span style="font-size:9px;font-weight:600;color:${circleColor};">p95: &plusmn;${formatAccuracy(radiusM)}</span>`, {
          permanent: false, direction: 'right', offset: [10, 0], className: 'leaflet-tooltip-precision',
        });
        markersRef.current.push(circle as any);

        // Circulo interno (p68)
        if (serverAccuracyM != null && serverAccuracyM > 0 && serverAccuracyM < radiusM * 0.8) {
          const innerRadius = Math.round(Math.max(serverAccuracyM, 50) * zipBoost * mobileBoost);
          const innerCircle = L.circle([lat, lon], {
            radius: innerRadius,
            color: circleColor,
            fillColor: circleColor,
            fillOpacity: 0.10,
            weight: 1,
            dashArray: '3 4',
          }).addTo(map);
          innerCircle.bindTooltip(`<span style="font-size:9px;font-weight:600;color:${circleColor};">p68: &plusmn;${formatAccuracy(innerRadius)}</span>`, {
            permanent: false, direction: 'left', offset: [-10, 0], className: 'leaflet-tooltip-precision',
          });
          markersRef.current.push(innerCircle as any);
        }
      }
    });

    // Marcadores de IP Real (WebRTC Leak)
    const leakLogs = filteredLogs.filter(l => l.webrtcLeak && l.realIp && l.realGeo?.lat && l.realGeo?.lon);
    const leakGrouped: Record<string, { logs: AuditLog[]; lat: number; lon: number }> = {};
    leakLogs.forEach(log => {
      const key = `real_${log.realGeo!.lat},${log.realGeo!.lon}`;
      if (!leakGrouped[key]) {
        leakGrouped[key] = { logs: [], lat: log.realGeo!.lat!, lon: log.realGeo!.lon! };
      }
      leakGrouped[key].logs.push(log);
    });

    Object.values(leakGrouped).forEach(({ logs: groupLogs, lat, lon }) => {
      bounds.push([lat, lon]);

      const realIcon = L.icon({
        iconUrl: createMarkerSvg('#dc2626', true),
        iconSize: [32, 44],
        iconAnchor: [16, 44],
        popupAnchor: [0, -46],
      });

      const realIp = groupLogs[0].realIp;
      const rGeo = groupLogs[0].realGeo;
      const vpnIp = groupLogs[0].ip;
      const vpnGeo = groupLogs[0].geo;

      const realPopup = `
        <div style="min-width:220px">
          <div style="background:linear-gradient(135deg,#dc2626,#991b1b);color:white;padding:8px 12px;margin:-13px -20px 10px;border-radius:10px 10px 0 0;font-weight:bold;font-size:13px">
            IP REAL VAZADO (WebRTC)
          </div>
          <div style="font-size:11px;line-height:1.6;padding:0 2px">
            <div><b>IP Real:</b> <span style="color:#dc2626;font-family:monospace;font-weight:bold">${realIp}</span></div>
            ${rGeo?.city ? `<div><b>Local Real:</b> ${[rGeo.city, rGeo.region, rGeo.country].filter(Boolean).join(', ')}</div>` : ''}
            ${rGeo?.isp ? `<div><b>ISP Real:</b> ${rGeo.isp}</div>` : ''}
            ${rGeo?.timezone ? `<div><b>Fuso:</b> ${rGeo.timezone}</div>` : ''}
            <hr style="margin:6px 0;border-color:#fecaca"/>
            <div style="color:#666"><b>IP da VPN:</b> <span style="font-family:monospace">${vpnIp}</span></div>
            ${vpnGeo?.city ? `<div style="color:#666"><b>Local VPN:</b> ${[vpnGeo.city, vpnGeo.region, vpnGeo.country].filter(Boolean).join(', ')}</div>` : ''}
            <div style="margin-top:6px;padding:4px 8px;background:#fef2f2;border-radius:6px;font-size:10px;color:#991b1b;font-weight:600">
              ${groupLogs.length} acesso(s) com IP real vazado
            </div>
          </div>
        </div>
      `;

      const realMarker = L.marker([lat, lon], { icon: realIcon })
        .addTo(map)
        .bindPopup(realPopup, { maxWidth: 320, closeButton: true });

      markersRef.current.push(realMarker);

      if (vpnGeo?.lat && vpnGeo?.lon) {
        const polyline = L.polyline(
          [[vpnGeo.lat, vpnGeo.lon], [lat, lon]],
          { color: '#dc2626', weight: 2, dashArray: '8, 6', opacity: 0.7 }
        ).addTo(map);
        markersRef.current.push(polyline);
      }
    });

    // Ajustar zoom
    if (bounds.length === 1) {
      map.setView(bounds[0], 13);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }, [filteredLogs, mapReady, isCleared, showSourceDots]);

  // Invalidar tamanho do mapa quando expandir
  useEffect(() => {
    if (leafletMapRef.current && mapReady) {
      setTimeout(() => {
        leafletMapRef.current.invalidateSize();
      }, 100);
    }
  }, [isExpanded, mapReady]);

  if (geoLogs.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
        <Map className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-500">
          Nenhum log com dados de geolocalizacao disponivel ainda.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Novos acessos serao rastreados automaticamente no mapa.
        </p>
      </div>
    );
  }

  const failureCount = geoLogs.filter(l => l.status === 'failure').length;
  const successCount = geoLogs.filter(l => l.status === 'success').length;
  const hasSourceDetails = geoLogs.some(l => l.geo?.geoSourceDetails && l.geo.geoSourceDetails.length > 0);

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 ${
      isExpanded ? 'fixed inset-4 z-50' : ''
    }`}>
      {/* Overlay escuro quando expandido */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black/40 z-40" 
          onClick={() => setIsExpanded(false)} 
        />
      )}
      
      <div className={`relative ${isExpanded ? 'z-50 h-full flex flex-col' : ''}`}>
        {/* Header do mapa */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Map className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">
                Mapa de Acessos em Tempo Real
              </h3>
              <p className="text-xs text-gray-500">
                {geoLogs.length} acesso{geoLogs.length > 1 ? 's' : ''} de {Object.keys(ipCounts).length} IP{Object.keys(ipCounts).length > 1 ? 's' : ''}
                {avgAccuracy != null && <span className="ml-1.5 text-blue-600 font-medium">&middot; Precisao media: &plusmn;{formatAccuracy(avgAccuracy)}</span>}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            {/* Filtros rapidos */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => { setSelectedFilter('all'); setIsCleared(false); }}
                className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer ${
                  selectedFilter === 'all' && !isCleared ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Todos ({geoLogs.length})
              </button>
              <button
                onClick={() => { setSelectedFilter('success'); setIsCleared(false); }}
                className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer ${
                  selectedFilter === 'success' && !isCleared ? 'bg-green-100 text-green-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                OK ({successCount})
              </button>
              <button
                onClick={() => { setSelectedFilter('failure'); setIsCleared(false); }}
                className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer ${
                  selectedFilter === 'failure' && !isCleared ? 'bg-red-100 text-red-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Falhas ({failureCount})
              </button>
            </div>

            {/* Toggle source scatter dots */}
            {hasSourceDetails && (
              <button
                onClick={toggleSourceDots}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer border ${
                  showSourceDots 
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-transparent hover:border-gray-200'
                }`}
                title={showSourceDots ? 'Ocultar fontes individuais' : 'Mostrar fontes individuais no mapa'}
              >
                {showSourceDots ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Fontes</span>
              </button>
            )}

            {/* Botao Limpar Mapa */}
            {!isCleared ? (
              <button
                onClick={clearMap}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer border border-transparent hover:border-red-200"
                title="Limpar todos os marcadores do mapa"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Limpar</span>
              </button>
            ) : (
              <button
                onClick={restoreMarkers}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer border border-blue-200"
                title="Restaurar marcadores no mapa"
              >
                <Map className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Restaurar</span>
              </button>
            )}
            
            {/* Toggle legenda */}
            <button
              onClick={() => setShowLegend(!showLegend)}
              className={`p-1.5 rounded-lg transition cursor-pointer ${showLegend ? 'bg-gray-100 text-gray-700' : 'hover:bg-gray-100 text-gray-400'}`}
              title={showLegend ? 'Ocultar legenda' : 'Mostrar legenda'}
            >
              <Layers className="w-4 h-4" />
            </button>

            {/* Expandir/recolher */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition cursor-pointer"
              title={isExpanded ? 'Recolher mapa' : 'Expandir mapa'}
            >
              {isExpanded ? (
                <Minimize2 className="w-4 h-4 text-gray-600" />
              ) : (
                <Maximize2 className="w-4 h-4 text-gray-600" />
              )}
            </button>
          </div>
        </div>

        {/* Legenda melhorada */}
        {showLegend && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-3 text-xs text-gray-600 flex-wrap">
            <span className="font-semibold text-gray-500 mr-1">Marcadores:</span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
              Autorizado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
              Invasao
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-purple-500 inline-block"></span>
              Rate limit
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block"></span>
              VPN
            </span>
            <span className="text-gray-300">|</span>
            <span className="font-semibold text-gray-500">Circulos:</span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-2.5 rounded border border-blue-400 border-dashed inline-block" style={{ borderWidth: 1 }}></span>
              <span>p68</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-2.5 rounded border border-blue-400 inline-block" style={{ borderWidth: 1.5 }}></span>
              <span>p95</span>
            </span>
            {showSourceDots && (
              <>
                <span className="text-gray-300">|</span>
                <span className="font-semibold text-gray-500">Fontes:</span>
                {Object.entries(SOURCE_COLORS).slice(0, 4).map(([name, c]) => (
                  <span key={name} className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: c }}></span>
                    <span style={{ fontSize: 9 }}>{name.replace('.com', '').replace('.io', '')}</span>
                  </span>
                ))}
                <span style={{ fontSize: 9 }} className="text-gray-400">+{Object.keys(SOURCE_COLORS).length - 4}</span>
              </>
            )}
            <span className="ml-auto text-blue-600 italic font-medium flex items-center gap-1" title="Precision Engine v4.1: 8 provedores em paralelo + IWCR (Iterative Weighted Centroid Refinement, ate 5 rodadas + early convergence) + RANSAC + validacao CEP + estimativa em metros (weighted percentile).">
              <Crosshair className="w-3 h-3" />
              Precision v4.1
            </span>
          </div>
        )}

        {/* Container do mapa */}
        <div 
          ref={mapRef}
          className={`audit-map-container w-full ${isExpanded ? 'flex-1' : 'h-[420px]'}`}
          style={{ minHeight: isExpanded ? undefined : 420 }}
        />
      </div>
    </div>
  );
}