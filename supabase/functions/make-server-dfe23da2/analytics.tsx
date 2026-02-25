// ==========================================
// 📊 SECURITY ANALYTICS ENGINE
// Métricas agregadas, timeline, threat distribution
// ==========================================

import * as kv from "./kv_retry.tsx";
import type { SecurityMetrics } from "./types.tsx";
import { getTopThreats } from "./reputation.tsx";

export async function generateSecurityAnalytics(): Promise<SecurityMetrics> {
  const logs: Array<Record<string, unknown>> = await kv.get('audit_logs') || [];
  const blacklist: Array<Record<string, unknown>> = await kv.get('ip_blacklist') || [];
  const whitelist: Array<Record<string, unknown>> = await kv.get('ip_whitelist') || [];
  
  const now = Date.now();
  const last24h = logs.filter(l => now - new Date(l.timestamp as string).getTime() < 24 * 60 * 60 * 1000);
  const last7d = logs.filter(l => now - new Date(l.timestamp as string).getTime() < 7 * 24 * 60 * 60 * 1000);
  
  const loginLogs = last7d.filter(l => (l.action as string)?.includes('LOGIN') || (l.action as string)?.includes('login'));
  const successLogins = loginLogs.filter(l => l.status === 'success');
  const failedLogins = loginLogs.filter(l => l.status === 'failure');
  
  const uniqueIps = new Set(last7d.map(l => l.ip as string).filter(Boolean));
  const vpnLogs = last7d.filter(l => (l.geo as Record<string, unknown>)?.isVpn || (l.geo as Record<string, unknown>)?.isProxy);
  const leakLogs = last7d.filter(l => l.webrtcLeak);
  
  // Timeline por hora (últimas 24h)
  const hourBuckets: Record<string, { success: number; failure: number; vpn: number }> = {};
  for (let h = 23; h >= 0; h--) {
    const d = new Date(now - h * 60 * 60 * 1000);
    const key = `${d.getUTCHours().toString().padStart(2, '0')}:00`;
    hourBuckets[key] = { success: 0, failure: 0, vpn: 0 };
  }
  for (const log of last24h) {
    const d = new Date(log.timestamp as string);
    const key = `${d.getUTCHours().toString().padStart(2, '0')}:00`;
    if (hourBuckets[key]) {
      if (log.status === 'success') hourBuckets[key].success++;
      else hourBuckets[key].failure++;
      if ((log.geo as Record<string, unknown>)?.isVpn) hourBuckets[key].vpn++;
    }
  }
  const eventTimeline = Object.entries(hourBuckets).map(([hour, data]) => ({ hour, ...data }));
  
  // Distribuição geográfica
  const geoMap: Record<string, number> = {};
  for (const log of last7d) {
    const country = ((log.geo as Record<string, unknown>)?.country as string) || 'Desconhecido';
    geoMap[country] = (geoMap[country] || 0) + 1;
  }
  const geoDistribution = Object.entries(geoMap)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
  
  // Top threats
  const topThreats = await getTopThreats(10);
  
  // Threat tier distribution
  const tierMap: Record<string, number> = { trusted: 0, neutral: 0, suspicious: 0, dangerous: 0, critical: 0 };
  for (const t of topThreats) {
    tierMap[t.tier] = (tierMap[t.tier] || 0) + 1;
  }
  const threatDistribution = Object.entries(tierMap).map(([tier, count]) => ({ tier, count }));
  
  // Avg reputation
  const allReps = topThreats.length > 0 ? topThreats.reduce((s, t) => s + t.score, 0) / topThreats.length : 0;
  
  // Security Health Score
  let healthScore = 100;
  const failRate = loginLogs.length > 0 ? failedLogins.length / loginLogs.length : 0;
  healthScore -= failRate * 30;
  healthScore -= Math.min(20, vpnLogs.length * 2);
  healthScore -= Math.min(15, leakLogs.length * 5);
  healthScore -= Math.min(15, blacklist.filter(b => (b as Record<string, unknown>).active).length * 1.5);
  healthScore -= Math.min(10, topThreats.filter(t => t.score > 80).length * 3);
  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));
  
  return {
    totalLogins: loginLogs.length,
    successfulLogins: successLogins.length,
    failedLogins: failedLogins.length,
    uniqueIps: uniqueIps.size,
    vpnDetections: vpnLogs.length,
    webrtcLeaks: leakLogs.length,
    blacklistedIps: blacklist.filter(b => (b as Record<string, unknown>).active).length,
    whitelistedIps: whitelist.filter(w => (w as Record<string, unknown>).active).length,
    avgReputationScore: Math.round(allReps),
    topThreats: topThreats.map(t => ({ ip: t.ip, score: t.score, tier: t.tier })),
    eventTimeline,
    geoDistribution,
    threatDistribution,
    securityHealthScore: healthScore,
    generatedAt: new Date().toISOString(),
  };
}
