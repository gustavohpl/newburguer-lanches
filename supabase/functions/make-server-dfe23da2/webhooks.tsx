// ==========================================
// 📡 WEBHOOK NOTIFICATION SYSTEM
// Dispatch de eventos de segurança para webhooks externos
// Suporte: Generic POST, Telegram Bot, Discord
// ==========================================

import * as kv from "./kv_retry.tsx";
import type { WebhookConfig, WebhookLog } from "./types.tsx";

export const WEBHOOK_EVENTS = [
  'vpn_detected', 'brute_force', 'ip_blocked', 'high_threat_score',
  'webrtc_leak', 'fingerprint_hopping', 'login_failure', 'auto_blacklist',
  'timezone_mismatch', 'new_ip_critical',
];

export async function getWebhookConfigs(): Promise<WebhookConfig[]> {
  try {
    return await kv.get('webhook_configs') || [];
  } catch { return []; }
}

export async function saveWebhookConfigs(configs: WebhookConfig[]): Promise<void> {
  await kv.set('webhook_configs', configs);
}

export async function logWebhookDispatch(log: WebhookLog): Promise<void> {
  try {
    const logs: WebhookLog[] = await kv.get('webhook_logs') || [];
    logs.push(log);
    await kv.set('webhook_logs', logs.slice(-200));
  } catch (e) {
    console.error('❌ [WEBHOOK] Erro ao logar dispatch:', e);
  }
}

export async function dispatchWebhook(event: string, data: Record<string, unknown>): Promise<void> {
  try {
    const configs = await getWebhookConfigs();
    const active = configs.filter(c => c.enabled && c.events.includes(event));
    if (active.length === 0) return;

    const timestamp = new Date().toISOString();
    const payload = { event, data, timestamp, source: 'delivery-security-v8-precision-v4.1' };

    for (const config of active) {
      const logEntry: WebhookLog = {
        id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        webhookId: config.id,
        event,
        status: 'success',
        timestamp,
        payload,
      };

      try {
        let res: Response;

        if (config.type === 'telegram' && config.telegramChatId) {
          const text = `🚨 *Security Alert*\n\n*Event:* ${event}\n*Time:* ${timestamp}\n*Details:*\n\`\`\`\n${JSON.stringify(data, null, 2)}\n\`\`\``;
          res = await fetch(config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: config.telegramChatId, text, parse_mode: 'Markdown' }),
            signal: AbortSignal.timeout(5000),
          });
        } else if (config.type === 'discord') {
          const embed = {
            title: `🚨 ${event}`,
            description: JSON.stringify(data, null, 2).slice(0, 2000),
            color: 0xFF0000,
            timestamp,
          };
          res = await fetch(config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] }),
            signal: AbortSignal.timeout(5000),
          });
        } else {
          res = await fetch(config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(5000),
          });
        }

        logEntry.statusCode = res.status;
        if (!res.ok) {
          logEntry.status = 'failure';
          logEntry.error = `HTTP ${res.status}`;
          config.failCount = (config.failCount || 0) + 1;
        } else {
          config.lastTriggered = timestamp;
          config.failCount = 0;
        }
      } catch (e: unknown) {
        logEntry.status = 'failure';
        logEntry.error = e instanceof Error ? e.message : String(e);
        config.failCount = (config.failCount || 0) + 1;
      }

      await logWebhookDispatch(logEntry);
      
      if (config.failCount >= 10) {
        config.enabled = false;
        console.warn(`⚠️ [WEBHOOK] ${config.id} desativado após 10 falhas consecutivas`);
      }
    }

    await saveWebhookConfigs(configs);
  } catch (e) {
    console.error('❌ [WEBHOOK] Erro geral no dispatch:', e);
  }
}
