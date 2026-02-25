// ==========================================
// 🛡️ ROTAS: IP Reputation, Webhooks, Security Analytics
// Sub-router Hono extraído do index.tsx monolítico
// ==========================================

import { Hono } from "npm:hono";
import * as kv from "./kv_retry.tsx";
import { success, error } from "./server_utils.tsx";
import { requireAdmin, requireMaster } from "./middleware.tsx";
import { getIpReputation, getTopThreats } from "./reputation.tsx";
import { getWebhookConfigs, saveWebhookConfigs, dispatchWebhook, WEBHOOK_EVENTS } from "./webhooks.tsx";
import { generateSecurityAnalytics } from "./analytics.tsx";
import type { IpReputationRecord, WebhookConfig, SecurityMetrics } from "./types.tsx";

const router = new Hono();

// ==========================================
// 🎯 IP Reputation
// ==========================================

router.get('/admin/ip-reputation/:ip', requireAdmin, async (c) => {
  try {
    const ip = c.req.param('ip');
    const rep = await getIpReputation(ip);
    return success(c, { reputation: rep || { ip, score: 0, tier: 'trusted', signals: [], totalEvents: 0 } });
  } catch (e) {
    return error(c, `Erro ao buscar reputação: ${e}`, 500);
  }
});

router.get('/master/ip-reputation/:ip', requireMaster, async (c) => {
  try {
    const ip = c.req.param('ip');
    const rep = await getIpReputation(ip);
    return success(c, { reputation: rep || { ip, score: 0, tier: 'trusted', signals: [], totalEvents: 0 } });
  } catch (e) {
    return error(c, `Erro ao buscar reputação: ${e}`, 500);
  }
});

router.get('/admin/ip-reputation/top-threats', requireAdmin, async (c) => {
  try {
    const threats = await getTopThreats(20);
    return success(c, { threats, count: threats.length });
  } catch (e) {
    return error(c, `Erro ao buscar top threats: ${e}`, 500);
  }
});

router.get('/master/ip-reputation/top-threats', requireMaster, async (c) => {
  try {
    const threats = await getTopThreats(20);
    return success(c, { threats, count: threats.length });
  } catch (e) {
    return error(c, `Erro ao buscar top threats: ${e}`, 500);
  }
});

// ==========================================
// 📡 Webhooks
// ==========================================

router.get('/master/webhooks/config', requireMaster, async (c) => {
  try {
    const configs = await getWebhookConfigs();
    return success(c, { webhooks: configs, availableEvents: WEBHOOK_EVENTS });
  } catch (e) {
    return error(c, `Erro ao buscar webhooks: ${e}`, 500);
  }
});

router.put('/master/webhooks/config', requireMaster, async (c) => {
  try {
    const body = await c.req.json();
    if (!Array.isArray(body.webhooks)) return error(c, 'Campo webhooks deve ser um array');
    await saveWebhookConfigs(body.webhooks);
    return success(c, { message: 'Webhooks atualizados' });
  } catch (e) {
    return error(c, `Erro ao salvar webhooks: ${e}`, 500);
  }
});

router.post('/master/webhooks/test', requireMaster, async (c) => {
  try {
    const body = await c.req.json();
    await dispatchWebhook('test_webhook', { message: 'Teste de webhook', timestamp: new Date().toISOString(), ...body });
    return success(c, { message: 'Webhook de teste disparado' });
  } catch (e) {
    return error(c, `Erro ao testar webhook: ${e}`, 500);
  }
});

router.get('/master/webhooks/logs', requireMaster, async (c) => {
  try {
    const logs: WebhookConfig[] = (await kv.get('webhook_logs') || []) as WebhookConfig[];
    return success(c, { logs: logs.slice(-50).reverse(), count: logs.length });
  } catch (e) {
    return error(c, `Erro ao buscar logs de webhook: ${e}`, 500);
  }
});

// ==========================================
// 📊 Security Analytics
// ==========================================

router.get('/admin/security/analytics', requireAdmin, async (c) => {
  try {
    const metrics = await generateSecurityAnalytics();
    return success(c, { metrics });
  } catch (e) {
    console.error('❌ [ANALYTICS] Erro:', e);
    return error(c, `Erro ao gerar analytics: ${e}`, 500);
  }
});

router.get('/master/security/analytics', requireMaster, async (c) => {
  try {
    const metrics = await generateSecurityAnalytics();
    return success(c, { metrics });
  } catch (e) {
    console.error('❌ [ANALYTICS] Erro:', e);
    return error(c, `Erro ao gerar analytics: ${e}`, 500);
  }
});

export default router;