// ==========================================
// 🌍 GEOLOCALIZAÇÃO PRECISION ENGINE v4.1
// Consulta 8 provedores em paralelo, pipeline de 11 passos
// Extraído de index.tsx para modularização
// ==========================================

import type { GeoResult, GeoSourceResult, GeoSourceDetail, GeoCacheEntry } from "./types.tsx";

// 🗄️ Cache de geolocalização em memória (TTL de 10 minutos)
const geoCache = new Map<string, GeoCacheEntry>();
const GEO_CACHE_TTL = 10 * 60 * 1000;

function getCachedGeo(ip: string): GeoResult | null {
  const entry = geoCache.get(ip);
  if (!entry) return null;
  if (Date.now() - entry.ts > GEO_CACHE_TTL) {
    geoCache.delete(ip);
    return null;
  }
  return entry.data;
}

function setCachedGeo(ip: string, data: GeoResult) {
  if (geoCache.size > 500) {
    const oldest = [...geoCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < 100; i++) geoCache.delete(oldest[i][0]);
  }
  geoCache.set(ip, { data, ts: Date.now() });
}

// ---- VPN Detection ----

const vpnKeywords = ['vpn','proxy','tunnel','anonymo','mullvad','nordvpn','expressvpn',
  'surfshark','cyberghost','protonvpn','private internet','torguard','hidemy','windscribe',
  'astrill','purevpn','ivpn','tor exit','tor relay','datacenter','data center',
  'hostinger','digitalocean','amazon','aws','google cloud','azure','linode','vultr','ovh',
  'hetzner','scaleway','contabo','choopa','cogent','m247','quadranet','psychz','leaseweb'];

const vpnAsns = new Set([
  9009, 16276, 20473, 14061, 16509, 15169, 8075, 24940, 63949, 396982,
  13335, 46562, 36352, 54113, 20940,
  30633, 62563, 206264, 212238, 57043, 398101, 44592, 13213,
  197540, 51396, 199524, 132203, 45090, 40676,
  62240, 211680, 399486, 210756, 398493, 212815,
  47583, 399820, 53667, 206216, 63473,
]);

function extractAsnNumber(asn: string): number {
  const m = String(asn).match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

export function detectVpnHeuristic(isp: string, org: string, asn: string): boolean {
  const combined = `${(isp||'').toLowerCase()} ${(org||'').toLowerCase()} ${(asn||'').toLowerCase()}`;
  if (vpnKeywords.some(kw => combined.includes(kw))) return true;
  const asnNum = extractAsnNumber(asn);
  if (asnNum && vpnAsns.has(asnNum)) return true;
  return false;
}

// ---- City Normalization ----

function normalizeCity(city: string): string {
  return (city || '')
    .toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]/g, ' ').replace(/\s+/g, ' ')
    .replace(/^saint /, 'st ')
    .replace(/\s*(city|town|village|municipality|distrito|bairro|metro|metropolitan area)$/i, '')
    .replace(/\s*[\(\[].*?[\)\]]/, '')
    .replace(/\s+-\s*[a-z]{2}$/, '')
    .trim();
}

// ---- Source Weights ----

const SOURCE_WEIGHTS: Record<string, number> = {
  'ip-api.com': 1.0, 'ipwho.is': 0.95, 'ipapi.co': 0.85,
  'ipwhois.app': 0.85, 'freeipapi.com': 0.75, 'reallyfreegeoip.org': 0.70,
  'geoplugin.net': 0.65, 'iplocate.io': 0.70,
};

// ---- Mobile ISP Detection ----

const MOBILE_ISP_KEYWORDS = [
  'claro','vivo','tim ','oi ','nextel','algar','sercomtel',
  't-mobile','vodafone','orange','telefonica','movistar','at&t wireless',
  'mobile','celular','wireless','4g','5g','lte',
];

function detectMobileIsp(isp: string, org: string): boolean {
  const combined = `${(isp||'').toLowerCase()} ${(org||'').toLowerCase()}`;
  return MOBILE_ISP_KEYWORDS.some(kw => combined.includes(kw));
}

// ---- Haversine Distance ----

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ---- 8 Geo Sources ----

async function geoFromIpApi(ip: string, signal: AbortSignal): Promise<GeoSourceResult | null> {
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,district,zip,lat,lon,timezone,isp,org,as,proxy,hosting,query`, { signal });
    if (!res.ok) return null;
    const d = await res.json();
    if (d.status !== 'success') return null;
    return { source: 'ip-api.com', country: d.country||'', region: d.regionName||'', city: d.city||'', district: d.district||'', zip: d.zip||'', lat: d.lat??null, lon: d.lon??null, timezone: d.timezone||'', isp: d.isp||'', org: d.org||'', asn: d.as||'', isProxy: !!d.proxy, isHosting: !!d.hosting, isVpn: !!d.proxy||!!d.hosting||detectVpnHeuristic(d.isp,d.org,d.as) };
  } catch { return null; }
}

async function geoFromIpWhois(ip: string, signal: AbortSignal): Promise<GeoSourceResult | null> {
  try {
    const res = await fetch(`https://ipwho.is/${ip}`, { signal });
    if (!res.ok) return null;
    const d = await res.json();
    if (!d.success) return null;
    return { source: 'ipwho.is', country: d.country||'', region: d.region||'', city: d.city||'', district: '', zip: d.postal||'', lat: d.latitude??null, lon: d.longitude??null, timezone: d.timezone?.id||'', isp: d.connection?.isp||'', org: d.connection?.org||'', asn: d.connection?.asn?`AS${d.connection.asn}`:'', isProxy: !!d.security?.proxy, isHosting: !!d.security?.hosting, isVpn: !!d.security?.vpn||!!d.security?.proxy||!!d.security?.tor||detectVpnHeuristic(d.connection?.isp||'',d.connection?.org||'',d.connection?.asn?`AS${d.connection.asn}`:'') };
  } catch { return null; }
}

async function geoFromIpapiCo(ip: string, signal: AbortSignal): Promise<GeoSourceResult | null> {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal, headers: { 'User-Agent': 'delivery-security/1.0' } });
    if (!res.ok) return null;
    const d = await res.json();
    if (d.error) return null;
    return { source: 'ipapi.co', country: d.country_name||'', region: d.region||'', city: d.city||'', district: '', zip: d.postal||'', lat: d.latitude??null, lon: d.longitude??null, timezone: d.timezone||'', isp: d.org||'', org: d.org||'', asn: d.asn||'', isProxy: false, isHosting: false, isVpn: detectVpnHeuristic(d.org||'',d.org||'',d.asn||'') };
  } catch { return null; }
}

async function geoFromIpWhoisIo(ip: string, signal: AbortSignal): Promise<GeoSourceResult | null> {
  try {
    const res = await fetch(`https://ipwhois.app/json/${ip}?objects=country,region,city,latitude,longitude,postal,timezone,isp,org,asn,security`, { signal });
    if (!res.ok) return null;
    const d = await res.json();
    if (d.success === false) return null;
    return { source: 'ipwhois.app', country: d.country||'', region: d.region||'', city: d.city||'', district: '', zip: d.postal||'', lat: d.latitude!=null?Number(d.latitude):null, lon: d.longitude!=null?Number(d.longitude):null, timezone: d.timezone||'', isp: d.isp||'', org: d.org||'', asn: d.asn?String(d.asn):'', isProxy: !!d.security?.proxy, isHosting: !!d.security?.hosting, isVpn: !!d.security?.vpn||!!d.security?.proxy||!!d.security?.tor||detectVpnHeuristic(d.isp||'',d.org||'',d.asn?String(d.asn):'') };
  } catch { return null; }
}

async function geoFromFreeIpApi(ip: string, signal: AbortSignal): Promise<GeoSourceResult | null> {
  try {
    const res = await fetch(`https://freeipapi.com/api/json/${ip}`, { signal });
    if (!res.ok) return null;
    const d = await res.json();
    if (!d.latitude && !d.longitude) return null;
    return { source: 'freeipapi.com', country: d.countryName||'', region: d.regionName||'', city: d.cityName||'', district: '', zip: d.zipCode||'', lat: d.latitude??null, lon: d.longitude??null, timezone: d.timeZone?.replace('UTC','')||'', isp: '', org: '', asn: '', isProxy: !!d.isProxy, isHosting: false, isVpn: !!d.isProxy };
  } catch { return null; }
}

async function geoFromReallyFreeGeo(ip: string, signal: AbortSignal): Promise<GeoSourceResult | null> {
  try {
    const res = await fetch(`https://reallyfreegeoip.org/json/${ip}`, { signal });
    if (!res.ok) return null;
    const d = await res.json();
    if (!d.latitude && !d.longitude) return null;
    return { source: 'reallyfreegeoip.org', country: d.country_name||'', region: d.region_name||'', city: d.city||'', district: '', zip: d.zip_code||'', lat: d.latitude??null, lon: d.longitude??null, timezone: d.time_zone||'', isp: '', org: '', asn: '', isProxy: false, isHosting: false, isVpn: false };
  } catch { return null; }
}

async function geoFromGeoPlugin(ip: string, signal: AbortSignal): Promise<GeoSourceResult | null> {
  try {
    let res: Response;
    try { res = await fetch(`https://www.geoplugin.net/json.gp?ip=${ip}`, { signal }); }
    catch { res = await fetch(`http://www.geoplugin.net/json.gp?ip=${ip}`, { signal }); }
    if (!res.ok) return null;
    const d = await res.json();
    const lat = parseFloat(d.geoplugin_latitude);
    const lon = parseFloat(d.geoplugin_longitude);
    if (isNaN(lat) || isNaN(lon) || (lat===0 && lon===0)) return null;
    return { source: 'geoplugin.net', country: d.geoplugin_countryName||'', region: d.geoplugin_region||'', city: d.geoplugin_city||'', district: '', zip: '', lat, lon, timezone: d.geoplugin_timezone||'', isp: '', org: '', asn: '', isProxy: false, isHosting: false, isVpn: false };
  } catch { return null; }
}

async function geoFromIpLocate(ip: string, signal: AbortSignal): Promise<GeoSourceResult | null> {
  try {
    const res = await fetch(`https://www.iplocate.io/api/lookup/${ip}`, { signal });
    if (!res.ok) return null;
    const d = await res.json();
    if (d.latitude == null || d.longitude == null) return null;
    return { source: 'iplocate.io', country: d.country||'', region: d.subdivision||'', city: d.city||'', district: '', zip: d.postal_code||'', lat: d.latitude??null, lon: d.longitude??null, timezone: d.time_zone||'', isp: d.org||'', org: d.org||'', asn: d.asn?`AS${d.asn}`:'', isProxy: false, isHosting: false, isVpn: detectVpnHeuristic(d.org||'',d.org||'',d.asn?`AS${d.asn}`:'') };
  } catch { return null; }
}

// ---- Precision Engine: selectBestGeo ----

export function selectBestGeo(results: GeoSourceResult[]): GeoResult {
  const valid = results.filter(r =>
    r && r.lat != null && r.lon != null
    && !(r.lat === 0 && r.lon === 0)
    && Math.abs(r.lat!) <= 90 && Math.abs(r.lon!) <= 180
  );
  if (valid.length === 0) {
    const first = results.find(r => r) || results[0];
    return { ...first, geoSources: 0, geoSourcesAgree: 0, geoConfidence: 'n/a', geoAccuracy: 'no-data' } as GeoResult;
  }
  if (valid.length === 1) {
    const r = valid[0];
    const isMobile = detectMobileIsp(r.isp||'', r.org||'');
    return { ...r, geoSources: 1, geoSourcesAgree: 1, geoConfidence: 'baixa', geoAccuracy: 'single-source', geoIspType: isMobile ? 'mobile' : 'fixed' } as GeoResult;
  }

  // Country pre-filter
  const countryVotes: Record<string, number> = {};
  for (const r of valid) { const c = (r.country||'').toLowerCase().trim(); if (c) countryVotes[c] = (countryVotes[c]||0)+1; }
  const topCountry = Object.entries(countryVotes).sort((a,b) => b[1]-a[1])[0];
  let countryFiltered = valid;
  let countryOutliers: GeoSourceResult[] = [];
  if (topCountry && topCountry[1] >= 2 && valid.length >= 3) {
    const majorityCountry = topCountry[0];
    countryFiltered = valid.filter(r => (r.country||'').toLowerCase().trim() === majorityCountry);
    countryOutliers = valid.filter(r => (r.country||'').toLowerCase().trim() !== majorityCountry && (r.country||'').trim() !== '');
    if (countryFiltered.length < 2) { countryFiltered = valid; countryOutliers = []; }
  }
  const working = countryFiltered;

  // Clustering
  const clusters: GeoSourceResult[][] = [];
  const assigned = new Set<number>();
  for (let i = 0; i < working.length; i++) {
    if (assigned.has(i)) continue;
    const cluster = [working[i]]; assigned.add(i);
    for (let j = i+1; j < working.length; j++) {
      if (assigned.has(j)) continue;
      const cityJ = normalizeCity(working[j].city);
      let matchesAny = false;
      for (const member of cluster) {
        const dist = haversineKm(member.lat!, member.lon!, working[j].lat!, working[j].lon!);
        const memberCity = normalizeCity(member.city);
        const cityMatch = cityJ && memberCity && (memberCity === cityJ || memberCity.includes(cityJ) || cityJ.includes(memberCity));
        if (cityMatch || dist < 25) { matchesAny = true; break; }
      }
      if (matchesAny) { cluster.push(working[j]); assigned.add(j); }
    }
    clusters.push(cluster);
  }

  // Transitive merge
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i+1; j < clusters.length; j++) {
        let shouldMerge = false;
        for (const a of clusters[i]) { for (const b of clusters[j]) { if (haversineKm(a.lat!,a.lon!,b.lat!,b.lon!) < 25) { shouldMerge = true; break; } } if (shouldMerge) break; }
        if (shouldMerge) { clusters[i] = [...clusters[i], ...clusters[j]]; clusters.splice(j,1); merged = true; break; }
      }
      if (merged) break;
    }
  }

  clusters.sort((a,b) => {
    if (b.length !== a.length) return b.length - a.length;
    const wA = a.reduce((s,r) => s + (SOURCE_WEIGHTS[r.source]||0.5), 0);
    const wB = b.reduce((s,r) => s + (SOURCE_WEIGHTS[r.source]||0.5), 0);
    return wB - wA;
  });
  const bestGroup = clusters[0];
  const clusterOutliers = clusters.slice(1).flat();
  const allOutliers = [...clusterOutliers, ...countryOutliers];

  // RANSAC
  const effectiveWeights = new Map<GeoSourceResult, number>();
  let refinedCount = 0;
  for (const r of bestGroup) effectiveWeights.set(r, SOURCE_WEIGHTS[r.source]||0.5);
  if (bestGroup.length >= 3) {
    const pLat = bestGroup.reduce((s,r) => s+r.lat!,0)/bestGroup.length;
    const pLon = bestGroup.reduce((s,r) => s+r.lon!,0)/bestGroup.length;
    const dists = bestGroup.map(r => haversineKm(r.lat!,r.lon!,pLat,pLon));
    const sortedDists = [...dists].sort((a,b) => a-b);
    const medianDist = sortedDists[Math.floor(sortedDists.length/2)];
    const threshold = Math.max(medianDist*2.5, 3);
    for (let i = 0; i < bestGroup.length; i++) {
      if (dists[i] > threshold && dists[i] > 5) {
        effectiveWeights.set(bestGroup[i], (effectiveWeights.get(bestGroup[i])||0.5)*0.4);
        refinedCount++;
      }
    }
  }

  // IWCR
  let avgLat: number, avgLon: number;
  let totalWeight = 0;
  let wLat = 0, wLon = 0;
  for (const r of bestGroup) { const w = effectiveWeights.get(r)||0.5; wLat += r.lat!*w; wLon += r.lon!*w; totalWeight += w; }
  avgLat = wLat/totalWeight; avgLon = wLon/totalWeight;

  const maxIwcrRounds = bestGroup.length >= 3 ? 5 : 1;
  let iwcrRounds = 0;
  let convergenceDeltaM = Infinity;
  for (let round = 0; round < maxIwcrRounds; round++) {
    const prevLat = avgLat, prevLon = avgLon;
    wLat = 0; wLon = 0; totalWeight = 0;
    for (const r of bestGroup) {
      const baseW = effectiveWeights.get(r)||0.5;
      const distKm = haversineKm(r.lat!,r.lon!,avgLat,avgLon);
      const k = 2 + round*3;
      const idw = baseW / (1 + (distKm*distKm)*k);
      wLat += r.lat!*idw; wLon += r.lon!*idw; totalWeight += idw;
    }
    avgLat = wLat/totalWeight; avgLon = wLon/totalWeight;
    iwcrRounds++;
    convergenceDeltaM = haversineKm(prevLat,prevLon,avgLat,avgLon)*1000;
    if (convergenceDeltaM < 1) break;
  }

  // Accuracy estimation
  const sourceDists = bestGroup.map(r => ({ distM: haversineKm(r.lat!,r.lon!,avgLat,avgLon)*1000, weight: effectiveWeights.get(r)||0.5 }));
  sourceDists.sort((a,b) => a.distM-b.distM);
  const totalW = sourceDists.reduce((s,d) => s+d.weight, 0);
  let cumWeight = 0, p68RadiusM = 0, p95RadiusM = 0, p68Found = false, p95Found = false;
  for (const d of sourceDists) {
    cumWeight += d.weight;
    const pct = cumWeight/totalW;
    if (!p68Found && pct >= 0.68) { p68RadiusM = d.distM; p68Found = true; }
    if (!p95Found && pct >= 0.95) { p95RadiusM = d.distM; p95Found = true; break; }
  }
  if (!p68Found) p68RadiusM = sourceDists.length > 0 ? sourceDists[Math.min(sourceDists.length-1,Math.ceil(sourceDists.length*0.68))].distM : 0;
  if (!p95Found) p95RadiusM = sourceDists.length > 0 ? sourceDists[sourceDists.length-1].distM : 0;
  const maxRadiusM = sourceDists.length > 0 ? sourceDists[sourceDists.length-1].distM : 0;
  const estimatedAccuracyM = Math.round(Math.max(p68RadiusM, 50));

  // ZIP validation
  const zipCounts: Record<string,number> = {};
  for (const r of bestGroup) { const z = (r.zip||'').replace(/\D/g,'').trim(); if (z && z.length >= 4) zipCounts[z] = (zipCounts[z]||0)+1; }
  const topZip = Object.entries(zipCounts).sort((a,b) => b[1]-a[1])[0];
  const zipConfirmed = !!(topZip && topZip[1] >= 2);
  const confirmedZip = zipConfirmed ? topZip![0] : null;

  // Distances
  const groupDistances: number[] = [];
  for (let i = 0; i < bestGroup.length; i++) {
    for (let j = i+1; j < bestGroup.length; j++) {
      groupDistances.push(haversineKm(bestGroup[i].lat!,bestGroup[i].lon!,bestGroup[j].lat!,bestGroup[j].lon!));
    }
  }
  const groupMaxDist = groupDistances.length > 0 ? Math.max(...groupDistances) : 0;
  const groupAvgDist = groupDistances.length > 0 ? groupDistances.reduce((a,b) => a+b,0)/groupDistances.length : 0;
  const globalDistances: number[] = [];
  for (let i = 0; i < valid.length; i++) {
    for (let j = i+1; j < valid.length; j++) {
      globalDistances.push(haversineKm(valid[i].lat!,valid[i].lon!,valid[j].lat!,valid[j].lon!));
    }
  }
  const globalMaxDist = globalDistances.length > 0 ? Math.max(...globalDistances) : 0;

  // Confidence
  const agreeSources = bestGroup.length;
  let confidence: string;
  let accuracy: string;
  if (groupMaxDist < 3 && agreeSources >= 5) { confidence = 'exata'; accuracy = 'multi-triangulado'; }
  else if (groupMaxDist < 5 && agreeSources >= 4) { confidence = 'exata'; accuracy = 'triangulado-preciso'; }
  else if (groupMaxDist < 3 && agreeSources >= 3 && zipConfirmed) { confidence = 'exata'; accuracy = 'zip-triangulado'; }
  else if (groupMaxDist < 10 && agreeSources >= 3) { confidence = 'muito-alta'; accuracy = 'triangulado'; }
  else if (groupMaxDist < 10 && agreeSources >= 2) { confidence = 'alta'; accuracy = 'preciso'; }
  else if (groupMaxDist < 25 && agreeSources >= 4) { confidence = 'muito-alta'; accuracy = 'maioria-proxima'; }
  else if (groupMaxDist < 50 && agreeSources >= 3) { confidence = 'alta'; accuracy = 'maioria-confirmada'; }
  else if (groupMaxDist < 50 && agreeSources >= 2) { confidence = 'alta'; accuracy = 'cidade-confirmada'; }
  else if (groupMaxDist < 150) { confidence = 'media'; accuracy = 'regiao-confirmada'; }
  else { confidence = 'baixa'; accuracy = 'divergente'; }

  if (zipConfirmed && confidence !== 'exata') {
    if (confidence === 'muito-alta') { confidence = 'exata'; accuracy += '+zip'; }
    else if (confidence === 'alta') { confidence = 'muito-alta'; accuracy += '+zip'; }
    else if (confidence === 'media') { confidence = 'alta'; accuracy += '+zip'; }
    else if (confidence === 'baixa') { confidence = 'media'; accuracy += '+zip'; }
  }
  if (agreeSources === 1 && valid.length > 1) { confidence = 'baixa'; accuracy = 'sem-consenso'; }

  // Mobile ISP cap
  const allIsps = bestGroup.map(r => [r.isp||'',r.org||'']).flat();
  const isMobileIsp = allIsps.some(v => detectMobileIsp(v,''));
  const strongEvidence = zipConfirmed && groupMaxDist < 0.3;
  if (isMobileIsp && (confidence === 'exata' || confidence === 'muito-alta') && !strongEvidence) {
    confidence = 'alta';
    accuracy = accuracy.replace('exata','alta').replace('muito-alta','alta') + '|mobile-cap';
  }

  // Richest data
  const richest = bestGroup.reduce((best, cur) => {
    const curScore = [cur.district,cur.zip,cur.org,cur.asn,cur.isp,cur.timezone].filter(Boolean).length;
    const bestScore = [best.district,best.zip,best.org,best.asn,best.isp,best.timezone].filter(Boolean).length;
    return curScore > bestScore ? cur : best;
  }, bestGroup[0]);

  const anyVpn = valid.some(r => r.isVpn);
  const anyProxy = valid.some(r => r.isProxy);
  const anyHosting = valid.some(r => r.isHosting);
  const vpnSources = valid.filter(r => r.isVpn).map(r => r.source);

  const cityCount: Record<string,number> = {};
  for (const r of bestGroup) { const c = (r.city||'').trim(); if (c) cityCount[c] = (cityCount[c]||0)+(SOURCE_WEIGHTS[r.source]||0.5); }
  const bestCityName = Object.entries(cityCount).sort((a,b) => b[1]-a[1])[0]?.[0] || richest.city;

  const sourceDetails: GeoSourceDetail[] = valid.map(r => ({
    source: r.source, city: r.city||'?',
    lat: Number((r.lat||0).toFixed(4)), lon: Number((r.lon||0).toFixed(4)),
    distToAvg: Number(haversineKm(r.lat!,r.lon!,avgLat,avgLon).toFixed(1)),
    inCluster: bestGroup.includes(r),
    weight: SOURCE_WEIGHTS[r.source]||0.5,
    effectiveWeight: Number((effectiveWeights.get(r)||SOURCE_WEIGHTS[r.source]||0.5).toFixed(2)),
    refined: effectiveWeights.has(r) && (effectiveWeights.get(r)! < (SOURCE_WEIGHTS[r.source]||0.5)),
    vpn: r.isVpn || false, zip: r.zip||'',
    countryFiltered: countryOutliers.includes(r),
  }));

  return {
    ...richest, city: bestCityName,
    lat: Number(avgLat.toFixed(7)), lon: Number(avgLon.toFixed(7)),
    isVpn: anyVpn, isProxy: anyProxy, isHosting: anyHosting,
    geoSources: valid.length, geoSourcesAgree: agreeSources,
    geoSourceList: valid.map(r => r.source).join(', '),
    geoConfidence: confidence, geoAccuracy: accuracy,
    geoMaxDivergence: Number(groupMaxDist.toFixed(1)),
    geoAvgDivergence: Number(groupAvgDist.toFixed(1)),
    geoGlobalDivergence: Number(globalMaxDist.toFixed(1)),
    geoWeightedAvg: true,
    geoOutliers: allOutliers.length,
    geoOutlierSources: allOutliers.map(r => r.source).join(', ') || null,
    geoVpnSources: vpnSources.length > 0 ? vpnSources.join(', ') : null,
    geoSourceDetails: sourceDetails,
    geoZipConfirmed: zipConfirmed, geoConfirmedZip: confirmedZip,
    geoIspType: isMobileIsp ? 'mobile' : 'fixed',
    geoRansacRefined: refinedCount, geoCountryFiltered: countryOutliers.length,
    geoEstimatedAccuracyM: estimatedAccuracyM,
    geoP68RadiusM: Math.round(p68RadiusM), geoP95RadiusM: Math.round(p95RadiusM),
    geoMaxRadiusM: Math.round(maxRadiusM),
    geoIwcrRounds: iwcrRounds,
    geoIwcrConvergenceDeltaM: Number(convergenceDeltaM.toFixed(1)),
    geoEngineVersion: 'v4.1',
  };
}

// ---- Main Export: enrichIpGeo ----

export async function enrichIpGeo(ip: string): Promise<GeoResult | null> {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { country: 'Local', city: 'Rede Privada', isp: '-', lat: null, lon: null, isVpn: false, isProxy: false, isHosting: false, geoSources: 0, geoConfidence: 'n/a', region: '', district: '', zip: '', timezone: '', org: '', asn: '', source: 'local', geoSourcesAgree: 0, geoAccuracy: 'n/a' };
  }

  const cached = getCachedGeo(ip);
  if (cached) {
    console.log(`🌍 [GEO-CACHE-v4.1] IP ${ip}: cacheado | ${cached.city} | ${cached.geoSourcesAgree}/${cached.geoSources} fontes | Confiança: ${cached.geoConfidence}`);
    return { ...cached, fromCache: true };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new DOMException('GeoIP timeout 8s', 'AbortError')), 8000);

    const settled = await Promise.allSettled([
      geoFromIpApi(ip, controller.signal), geoFromIpWhois(ip, controller.signal),
      geoFromIpapiCo(ip, controller.signal), geoFromIpWhoisIo(ip, controller.signal),
      geoFromFreeIpApi(ip, controller.signal), geoFromReallyFreeGeo(ip, controller.signal),
      geoFromGeoPlugin(ip, controller.signal), geoFromIpLocate(ip, controller.signal),
    ]);
    clearTimeout(timeout);

    const results = settled.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<GeoSourceResult | null>).value).filter(Boolean) as GeoSourceResult[];

    if (results.length === 0) {
      console.warn(`⚠️ [GEO] Nenhuma das 8 fontes retornou dados para IP: ${ip}`);
      return null;
    }

    const best = selectBestGeo(results);
    setCachedGeo(ip, best);

    console.log(`🌍 [GEO-v4.1] IP ${ip}: ${results.length}/8 fontes | ${best.geoSourcesAgree}/${results.length} concordam | ${best.geoConfidence} | ${best.city}${best.geoEstimatedAccuracyM != null ? ` | ±${best.geoEstimatedAccuracyM}m` : ''}`);

    return best;
  } catch (e) {
    console.warn('⚠️ [GEO] Falha ao buscar geolocalização para IP:', ip, e);
    return null;
  }
}
