// ==========================================
// 🎯 IP REPUTATION SCORE SYSTEM
// Pontuação de ameaça 0-100 por IP, baseada em sinais agregados
// ==========================================

import * as kv from "./kv_retry.tsx";
import type { IpReputationRecord, ReputationTier } from "./types.tsx";
import { dispatchWebhook } from "./webhooks.tsx";

export const REPUTATION_SIGNAL_POINTS: Record<string, number> = {
  'failed_login': 10,
  'vpn_detected': 25,
  'proxy_detected': 20,
  'webrtc_leak': 20,
  'geo_mismatch': 15,
  'timezone_mismatch': 12,
  'language_mismatch': 8,
  'fingerprint_hopping': 18,
  'brute_force_lockout': 30,
  'blacklisted': 50,
  'hosting_ip': 15,
  'successful_login': -5,
};

export function getReputationTier(score: number): ReputationTier {
  if (score <= 10) return 'trusted';
  if (score <= 30) return 'neutral';
  if (score <= 55) return 'suspicious';
  if (score <= 80) return 'dangerous';
  return 'critical';
}

export async function getIpReputation(ip: string): Promise<IpReputationRecord | null> {
  if (!ip || ip === 'unknown') return null;
  try {
    const record = await kv.get(`ip_reputation:${ip}`) as IpReputationRecord | null;
    return record || null;
  } catch { return null; }
}

export async function updateIpReputation(ip: string, signalType: string, detail?: string): Promise<IpReputationRecord> {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { ip, score: 0, signals: [], firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(), totalEvents: 0, isVpn: false, isBlacklisted: false, tier: 'trusted' };
  }
  
  const key = `ip_reputation:${ip}`;
  const existing: IpReputationRecord = (await kv.get(key) as IpReputationRecord) || {
    ip,
    score: 0,
    signals: [],
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    totalEvents: 0,
    isVpn: false,
    isBlacklisted: false,
    tier: 'trusted' as const,
  };
  
  const points = REPUTATION_SIGNAL_POINTS[signalType] || 5;
  const signal = { type: signalType, points, at: new Date().toISOString(), detail: detail || '' };
  existing.signals = [...(existing.signals || []).slice(-50), signal];
  existing.lastSeen = new Date().toISOString();
  existing.totalEvents = (existing.totalEvents || 0) + 1;
  
  // Recalcular score: soma com decaimento temporal
  const now = Date.now();
  const DECAY_WINDOW = 72 * 60 * 60 * 1000;
  let rawScore = 0;
  for (const s of existing.signals) {
    const age = now - new Date(s.at).getTime();
    const decay = Math.max(0.2, 1 - (age / DECAY_WINDOW));
    rawScore += s.points * decay;
  }
  existing.score = Math.max(0, Math.min(100, Math.round(rawScore)));
  
  if (signalType === 'vpn_detected' || signalType === 'proxy_detected') existing.isVpn = true;
  if (signalType === 'blacklisted') existing.isBlacklisted = true;
  
  existing.tier = getReputationTier(existing.score);
  
  await kv.set(key, { ...existing, _key: key });
  
  // Se score > 80, disparar webhook de alta ameaça
  if (existing.score > 80) {
    await dispatchWebhook('high_threat_score', {
      ip,
      score: existing.score,
      tier: existing.tier,
      latestSignal: signalType,
      detail: detail || '',
    });
  }
  
  console.log(`🎯 [REPUTATION] IP ${ip}: score=${existing.score} tier=${existing.tier} signal=${signalType}(${points>0?'+':''}${points})`);
  return existing;
}

export async function getTopThreats(limit = 20): Promise<IpReputationRecord[]> {
  try {
    const allReps = (await kv.getByPrefix('ip_reputation:') || []) as IpReputationRecord[];
    return allReps
      .filter(r => r && r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (e) {
    console.error('❌ [REPUTATION] Erro ao buscar top threats:', e);
    return [];
  }
}
