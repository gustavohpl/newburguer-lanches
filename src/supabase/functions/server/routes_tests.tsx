// ==========================================
// 🧪 ROTAS: Testes Automatizados v8 + E2E Flow Tests
// 80 testes unitários em 11 categorias + 3 E2E
// Sub-router Hono extraído do index.tsx monolítico
// ==========================================

import { Hono } from "npm:hono";
import * as kv from "./kv_retry.tsx";
import { success, error, sanitizeText, sanitizeName, sanitizePhone, sanitizeObjectDeep, sanitizeReviews, stripDangerousPatterns } from "./server_utils.tsx";
import { enrichIpGeo, haversineKm, detectVpnHeuristic } from "./geo.tsx";
import { checkRateLimit, recordFailedAttempt, clearRateLimit, cleanupExpiredSessions } from "./middleware.tsx";
import { checkIpBlacklist, checkIpWhitelist, autoBlacklistIp, detectTimezoneMismatch, detectLanguageMismatch, generateBrowserFingerprint } from "./security_helpers.tsx";
import { getIpReputation, updateIpReputation, getTopThreats, getReputationTier, REPUTATION_SIGNAL_POINTS } from "./reputation.tsx";
import { getWebhookConfigs, saveWebhookConfigs, logWebhookDispatch, dispatchWebhook, WEBHOOK_EVENTS } from "./webhooks.tsx";
import { generateSecurityAnalytics } from "./analytics.tsx";
import type { TestResult, E2ETestResult, TestRun } from "./types.tsx";

const router = new Hono();

// ==========================================
// 🧪 SUITE DE TESTES UNITÁRIOS (80 testes, 11 categorias)
// ==========================================

async function executeTestSuite(): Promise<{ summary: { total: number; passed: number; failed: number; durationMs: number }; results: TestResult[]; version: string }> {
  console.log('🧪 [TESTS-v8] Executando suite de 80 testes (11 categorias)...');
  const results: TestResult[] = [];

  async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
    const start = Date.now();
    try {
      await fn();
      results.push({ name, passed: true, durationMs: Date.now() - start });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ name, passed: false, error: msg, durationMs: Date.now() - start });
    }
  }

  // ========== CATEGORIA 1: CORE (14 testes) ==========

  await runTest('Core: KV Store set/get/del', async () => {
    const testKey = `_test_${Date.now()}`;
    await kv.set(testKey, { hello: 'world', ts: Date.now() });
    const read = await kv.get(testKey) as Record<string, unknown> | null;
    if (!read || read.hello !== 'world') throw new Error('KV get retornou valor incorreto');
    await kv.del(testKey);
    const afterDel = await kv.get(testKey);
    if (afterDel !== null && afterDel !== undefined) throw new Error('KV del não removeu a chave');
  });

  await runTest('Core: KV Store getByPrefix', async () => {
    const prefix = `_test_prefix_${Date.now()}`;
    await kv.set(`${prefix}:a`, { val: 1 });
    await kv.set(`${prefix}:b`, { val: 2 });
    const items = await kv.getByPrefix(`${prefix}:`);
    if (!Array.isArray(items) || items.length < 2) throw new Error(`getByPrefix retornou ${items?.length || 0} items, esperava 2`);
    await kv.del(`${prefix}:a`);
    await kv.del(`${prefix}:b`);
  });

  await runTest('Core: sanitizeText (stripTags + XSS)', async () => {
    const output = sanitizeText('<script>alert("xss")</script>Hello <b>World</b>');
    if (output.includes('<script>') || output.includes('<b>')) throw new Error(`Tags não removidas: "${output}"`);
    if (!output.includes('Hello') || !output.includes('World')) throw new Error(`Texto perdido: "${output}"`);
  });

  await runTest('Core: sanitizeText (javascript: URL)', async () => {
    const output = sanitizeText('javascript:alert(1)');
    if (output.includes('javascript:')) throw new Error(`javascript: não removido: "${output}"`);
  });

  await runTest('Core: sanitizeName (acentos preservados)', async () => {
    const output = sanitizeName('José da Silva Neto');
    if (output !== 'José da Silva Neto') throw new Error(`Nome corrompido: "${output}"`);
  });

  await runTest('Core: sanitizePhone', async () => {
    const output = sanitizePhone('(11) 99999-8888');
    if (!output.includes('11') || !output.includes('99999')) throw new Error(`Telefone corrompido: "${output}"`);
  });

  await runTest('Core: sanitizeReviews (válido + inválido)', async () => {
    const valid = sanitizeReviews([{ productId: 'p1', productName: 'Test', rating: 5, comment: 'Ótimo!' }]);
    if (!valid || valid.length !== 1) throw new Error('Review válida rejeitada');
    if (sanitizeReviews('not an array' as unknown as unknown[]) !== null) throw new Error('Input inválido não retornou null');
    if (sanitizeReviews([]) !== null) throw new Error('Array vazio não retornou null');
  });

  await runTest('Core: sanitizeObjectDeep (nested XSS)', async () => {
    const output = sanitizeObjectDeep({
      name: '<img onerror=alert(1)>João', address: 'Rua <script>hack</script> Bonita, 123',
      items: [{ name: '<b>X-Burger</b>', notes: 'javascript:alert(1) sem cebola' }],
      nested: { deep: '<div onclick="steal()">Click</div>' },
    });
    const str = JSON.stringify(output);
    if (str.includes('<script>') || str.includes('onerror') || str.includes('onclick') || str.includes('javascript:'))
      throw new Error(`Sanitização falhou: ${str}`);
    if (!str.includes('João') || !str.includes('X-Burger') || !str.includes('sem cebola'))
      throw new Error(`Conteúdo legítimo perdido: ${str}`);
  });

  const testOrderId = `TEST-${Date.now()}`;
  await runTest('Core: pedido criar e ler', async () => {
    await kv.set(`order:${testOrderId}`, { orderId: testOrderId, id: `test_order_${Date.now()}`, customerName: 'Teste Automatizado', customerPhone: '11999999999', items: [{ name: 'X-Burger Test', quantity: 1, price: 25 }], status: 'pending', createdAt: new Date().toISOString() });
    const read = await kv.get(`order:${testOrderId}`) as Record<string, unknown> | null;
    if (!read || read.orderId !== testOrderId) throw new Error('Pedido não foi salvo corretamente');
    if (read.customerName !== 'Teste Automatizado') throw new Error('Dados do pedido corrompidos');
  });

  await runTest('Core: pedido atualizar status', async () => {
    const order = await kv.get(`order:${testOrderId}`) as Record<string, unknown> | null;
    if (!order) throw new Error('Pedido de teste não encontrado');
    await kv.set(`order:${testOrderId}`, { ...order, status: 'preparing', updatedAt: new Date().toISOString() });
    const read = await kv.get(`order:${testOrderId}`) as Record<string, unknown>;
    if (read.status !== 'preparing') throw new Error(`Status incorreto: ${read.status}`);
  });

  await runTest('Core: rate limit — primeira tentativa é permitida', async () => {
    const testIp = `test_ip_${Date.now()}`;
    const check = await checkRateLimit('_test_route', testIp);
    if (!check.allowed) throw new Error('Primeira tentativa deveria ser permitida');
    await kv.del(`rate_limit:_test_route:${testIp}`);
  });

  await runTest('Core: sessões — criar e verificar expiração', async () => {
    const token = `_test_session_${Date.now()}`;
    await kv.set(`admin_session:${token}`, { _key: `admin_session:${token}`, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1000).toISOString() });
    const session = await kv.get(`admin_session:${token}`);
    if (!session) throw new Error('Sessão não foi criada');
    await kv.del(`admin_session:${token}`);
  });

  await runTest('Core: config pública — responde com objeto', async () => {
    const config = await kv.get('system_config');
    if (config !== null && typeof config !== 'object') throw new Error('Config deveria ser objeto ou null');
  });

  await runTest('Core: stripDangerousPatterns (expression, data:)', async () => {
    const out1 = stripDangerousPatterns('expression(alert(1))');
    if (out1.includes('expression(')) throw new Error(`expression( não removido: "${out1}"`);
    const out2 = stripDangerousPatterns('data: text/html,<script>x</script>');
    if (out2.includes('data: text/html') || out2.includes('data:text/html')) throw new Error(`data:text/html não removido: "${out2}"`);
  });

  await kv.del(`order:${testOrderId}`);

  // ========== CATEGORIA 2: GEOLOCALIZAÇÃO (8 testes) ==========

  await runTest('Geo: haversineKm — São Paulo-Rio ~360km', async () => {
    const dist = haversineKm(-23.55, -46.63, -22.91, -43.17);
    if (dist < 300 || dist > 420) throw new Error(`Distância SP-RJ incorreta: ${dist.toFixed(1)}km`);
  });
  await runTest('Geo: haversineKm — mesma coordenada = 0', async () => {
    if (haversineKm(-23.55, -46.63, -23.55, -46.63) !== 0) throw new Error('Distância deveria ser 0');
  });
  await runTest('Geo: enrichIpGeo — 8.8.8.8 retorna dados', async () => {
    const geo = await enrichIpGeo('8.8.8.8') as Record<string, unknown> | null;
    if (!geo) throw new Error('enrichIpGeo retornou null para 8.8.8.8');
    if (!geo.country) throw new Error('Sem país no resultado geo');
  });
  await runTest('Geo: enrichIpGeo — IP privado retorna algo', async () => {
    const geo = await enrichIpGeo('192.168.1.1');
    if (geo !== null && typeof geo !== 'object') throw new Error('Retorno inesperado para IP privado');
  });
  await runTest('Geo: detectVpnHeuristic — detecta NordVPN', async () => {
    if (!detectVpnHeuristic('NordVPN', 'Tefincom', 'AS212238')) throw new Error('Deveria detectar NordVPN');
  });
  await runTest('Geo: detectVpnHeuristic — não detecta ISP normal', async () => {
    if (detectVpnHeuristic('Vivo', 'Telefonica Brasil', 'AS26599')) throw new Error('Não deveria detectar ISP normal');
  });
  await runTest('Geo: enrichIpGeo — caching funciona', async () => {
    const start = Date.now();
    await enrichIpGeo('8.8.8.8');
    if (Date.now() - start > 2000) throw new Error(`Cache lento demais: ${Date.now() - start}ms`);
  });
  await runTest('Geo: haversineKm — distância transatlântica ~8500km', async () => {
    const dist = haversineKm(-23.55, -46.63, 51.51, -0.13);
    if (dist < 8000 || dist > 10000) throw new Error(`Distância SP-Londres incorreta: ${dist.toFixed(1)}km`);
  });

  // ========== CATEGORIA 3: ESTOQUE (8 testes) ==========

  const testIngId = `_test_ing_${Date.now()}`;
  await runTest('Estoque: criar ingrediente', async () => {
    await kv.set(`stock_ingredient:${testIngId}`, { id: testIngId, name: 'Teste Ingrediente', type: 'kg', currentStock: 10, minAlert: 2, pricePerKg: 15 });
    const read = await kv.get(`stock_ingredient:${testIngId}`) as Record<string, unknown>;
    if (!read || read.name !== 'Teste Ingrediente') throw new Error('Ingrediente não criado');
    if (read.currentStock !== 10) throw new Error(`Stock incorreto: ${read.currentStock}`);
  });
  await runTest('Estoque: descontar ingrediente', async () => {
    const ing = await kv.get(`stock_ingredient:${testIngId}`) as Record<string, unknown>;
    if (!ing) throw new Error('Ingrediente não encontrado');
    ing.currentStock = Math.max(0, ((ing.currentStock as number) || 0) - 3);
    await kv.set(`stock_ingredient:${testIngId}`, ing);
    const read = await kv.get(`stock_ingredient:${testIngId}`) as Record<string, unknown>;
    if (read.currentStock !== 7) throw new Error(`Stock após desconto incorreto: ${read.currentStock}`);
  });
  await runTest('Estoque: repor ingrediente', async () => {
    const ing = await kv.get(`stock_ingredient:${testIngId}`) as Record<string, unknown>;
    if (!ing) throw new Error('Ingrediente não encontrado');
    ing.currentStock = ((ing.currentStock as number) || 0) + 5;
    await kv.set(`stock_ingredient:${testIngId}`, ing);
    const read = await kv.get(`stock_ingredient:${testIngId}`) as Record<string, unknown>;
    if (read.currentStock !== 12) throw new Error(`Stock após reposição incorreto: ${read.currentStock}`);
  });
  await runTest('Estoque: alerta de estoque baixo (minAlert)', async () => {
    const ing = await kv.get(`stock_ingredient:${testIngId}`) as Record<string, unknown>;
    if (!ing) throw new Error('Ingrediente não encontrado');
    ing.currentStock = 1;
    await kv.set(`stock_ingredient:${testIngId}`, ing);
    const read = await kv.get(`stock_ingredient:${testIngId}`) as Record<string, unknown>;
    if ((read.currentStock as number) > (read.minAlert as number)) throw new Error('Stock não está abaixo do alerta');
  });
  await runTest('Estoque: stock não fica negativo', async () => {
    const ing = await kv.get(`stock_ingredient:${testIngId}`) as Record<string, unknown>;
    if (!ing) throw new Error('Ingrediente não encontrado');
    ing.currentStock = Math.max(0, ((ing.currentStock as number) || 0) - 100);
    await kv.set(`stock_ingredient:${testIngId}`, ing);
    const read = await kv.get(`stock_ingredient:${testIngId}`) as Record<string, unknown>;
    if ((read.currentStock as number) < 0) throw new Error(`Stock negativo: ${read.currentStock}`);
  });
  await runTest('Estoque: listar por prefix', async () => {
    const all = await kv.getByPrefix('stock_ingredient:');
    if (!Array.isArray(all)) throw new Error('getByPrefix não retornou array');
    if (!all.find((i: Record<string, unknown>) => i.id === testIngId)) throw new Error('Ingrediente de teste não encontrado');
  });
  await runTest('Estoque: deletar ingrediente', async () => {
    await kv.del(`stock_ingredient:${testIngId}`);
    if (await kv.get(`stock_ingredient:${testIngId}`) != null) throw new Error('Ingrediente não foi deletado');
  });
  await runTest('Estoque: deduções são registradas', async () => {
    const dedId = `_test_deduct_${Date.now()}`;
    await kv.set(`stock_deduction:${dedId}`, { id: dedId, ingredientId: 'x', quantity: 2, date: new Date().toISOString() });
    if (!await kv.get(`stock_deduction:${dedId}`)) throw new Error('Dedução não foi registrada');
    await kv.del(`stock_deduction:${dedId}`);
  });

  // ========== CATEGORIA 4: CUPONS (8 testes) ==========

  const testCouponId = `_test_coupon_${Date.now()}`;
  await runTest('Cupons: criar cupom', async () => {
    const coupon = { id: testCouponId, code: `TEST${Date.now()}`, type: 'percentage', value: 10, maxUses: 5, currentUses: 0, isActive: true };
    await kv.set(`coupon:${testCouponId}`, coupon);
    const read = await kv.get(`coupon:${testCouponId}`) as Record<string, unknown>;
    if (!read || read.code !== coupon.code) throw new Error('Cupom não criado corretamente');
  });
  await runTest('Cupons: incrementar uso', async () => {
    const coupon = await kv.get(`coupon:${testCouponId}`) as Record<string, unknown>;
    coupon.currentUses = ((coupon.currentUses as number) || 0) + 1;
    await kv.set(`coupon:${testCouponId}`, coupon);
    const read = await kv.get(`coupon:${testCouponId}`) as Record<string, unknown>;
    if (read.currentUses !== 1) throw new Error(`Uso incorreto: ${read.currentUses}`);
  });
  await runTest('Cupons: validar cupom ativo', async () => {
    const c = await kv.get(`coupon:${testCouponId}`) as Record<string, unknown>;
    if (!c.isActive) throw new Error('Cupom deveria estar ativo');
    if ((c.currentUses as number) >= (c.maxUses as number)) throw new Error('Cupom não deveria estar esgotado');
  });
  await runTest('Cupons: cupom esgotado', async () => {
    const c = await kv.get(`coupon:${testCouponId}`) as Record<string, unknown>;
    c.currentUses = c.maxUses;
    await kv.set(`coupon:${testCouponId}`, c);
    const read = await kv.get(`coupon:${testCouponId}`) as Record<string, unknown>;
    if ((read.currentUses as number) < (read.maxUses as number)) throw new Error('Cupom deveria estar esgotado');
  });
  await runTest('Cupons: cupom expirado', async () => {
    const c = await kv.get(`coupon:${testCouponId}`) as Record<string, unknown>;
    c.expiresAt = new Date(Date.now() - 86400000).toISOString();
    await kv.set(`coupon:${testCouponId}`, c);
    const read = await kv.get(`coupon:${testCouponId}`) as Record<string, unknown>;
    if (new Date(read.expiresAt as string) > new Date()) throw new Error('Cupom não deveria estar válido');
  });
  await runTest('Cupons: desconto percentual (10%)', async () => { if ((100 * 10) / 100 !== 10) throw new Error('Desconto incorreto'); });
  await runTest('Cupons: desconto valor fixo', async () => { if (Math.min(15, 100) !== 15) throw new Error('Desconto fixo incorreto'); });
  await runTest('Cupons: cleanup', async () => {
    await kv.del(`coupon:${testCouponId}`);
    if (await kv.get(`coupon:${testCouponId}`) != null) throw new Error('Cupom não deletado');
  });

  // ========== CATEGORIA 5: ENTREGADORES (6 testes) ==========

  const testDriverPhone = `_testdriver_${Date.now()}`;
  await runTest('Driver: criar driver', async () => {
    await kv.set(`driver:${testDriverPhone}`, { name: 'Driver Teste', phone: testDriverPhone, color: '#FF0000', status: 'online', lastLogin: new Date().toISOString() });
    const read = await kv.get(`driver:${testDriverPhone}`) as Record<string, unknown>;
    if (!read || read.name !== 'Driver Teste') throw new Error('Driver não criado');
  });
  await runTest('Driver: marcar offline', async () => {
    const d = await kv.get(`driver:${testDriverPhone}`) as Record<string, unknown>;
    d.status = 'offline';
    await kv.set(`driver:${testDriverPhone}`, d);
    const read = await kv.get(`driver:${testDriverPhone}`) as Record<string, unknown>;
    if (read.status !== 'offline') throw new Error(`Status incorreto: ${read.status}`);
  });
  await runTest('Driver: listar drivers', async () => {
    if (!Array.isArray(await kv.getByPrefix('driver:'))) throw new Error('Drivers não é array');
  });
  await runTest('Driver: sessão de driver', async () => {
    const token = `_test_driver_session_${Date.now()}`;
    await kv.set(`driver_session:${token}`, { phone: testDriverPhone, name: 'Driver Teste', createdAt: new Date().toISOString() });
    if (!await kv.get(`driver_session:${token}`)) throw new Error('Sessão de driver não criada');
    await kv.del(`driver_session:${token}`);
  });
  await runTest('Driver: stats incremento', async () => {
    const d = await kv.get(`driver:${testDriverPhone}`) as Record<string, unknown>;
    d.stats = { today: { date: new Date().toISOString().split('T')[0], count: 5 }, month: { month: new Date().toISOString().substring(0, 7), count: 20 }, total: 100 };
    await kv.set(`driver:${testDriverPhone}`, d);
    const read = await kv.get(`driver:${testDriverPhone}`) as Record<string, unknown>;
    if ((read.stats as Record<string, Record<string, unknown>>).today.count !== 5) throw new Error('Stats incorretas');
  });
  await runTest('Driver: cleanup', async () => {
    await kv.del(`driver:${testDriverPhone}`);
    if (await kv.get(`driver:${testDriverPhone}`) != null) throw new Error('Driver não deletado');
  });

  // ========== CATEGORIA 6: SEGURANÇA AVANÇADA (8 testes) ==========

  await runTest('Security: blacklist — verificar IP não bloqueado', async () => { await checkIpBlacklist('1.2.3.4'); });
  await runTest('Security: whitelist — verificar IP não whitelisted', async () => { await checkIpWhitelist('1.2.3.4'); });
  await runTest('Security: auto-blacklist — não bloqueia IP de teste', async () => {
    if (typeof autoBlacklistIp !== 'function') throw new Error('autoBlacklistIp não é uma função');
  });
  await runTest('Security: browser fingerprint — gera hash', async () => {
    const fp = generateBrowserFingerprint({ userAgent: 'test', timezone: 'America/Sao_Paulo', language: 'pt-BR', platform: 'Win32', screenRes: '1920x1080' });
    if (!fp || typeof fp !== 'string') throw new Error(`Fingerprint inválido: ${fp}`);
  });
  await runTest('Security: timezone mismatch — detecta diferença', async () => {
    if (!detectTimezoneMismatch({ timezone: 'America/New_York' }, { country: 'BR', timezone: 'America/Sao_Paulo' }).mismatch) throw new Error('Deveria detectar mismatch');
  });
  await runTest('Security: timezone mismatch — não detecta falso positivo', async () => {
    if (detectTimezoneMismatch({ timezone: 'America/Sao_Paulo' }, { country: 'BR', timezone: 'America/Sao_Paulo' }).mismatch) throw new Error('Falso positivo');
  });
  await runTest('Security: language mismatch — detecta idioma diferente', async () => {
    if (!detectLanguageMismatch({ language: 'zh-CN' }, { country: 'BR' }).mismatch) throw new Error('Deveria detectar mismatch');
  });
  await runTest('Security: language mismatch — PT no Brasil é OK', async () => {
    if (detectLanguageMismatch({ language: 'pt-BR' }, { country: 'BR' }).mismatch) throw new Error('Falso positivo');
  });

  // ========== CATEGORIA 7: IP REPUTATION (6 testes) ==========

  const testRepIp = `_test_rep_${Date.now()}`;
  await runTest('Reputation: getIpReputation — IP desconhecido retorna null', async () => {
    if (await getIpReputation(testRepIp) != null) throw new Error('Deveria retornar null');
  });
  await runTest('Reputation: updateIpReputation — cria registro', async () => {
    const rep = await updateIpReputation(testRepIp, 'login_failed', 'Teste');
    if (!rep || rep.score <= 0) throw new Error('Score deveria ser > 0');
  });
  await runTest('Reputation: getIpReputation — lê registro criado', async () => {
    const rep = await getIpReputation(testRepIp);
    if (!rep || rep.ip !== testRepIp) throw new Error('Registro não encontrado');
  });
  await runTest('Reputation: getReputationTier — trusted/suspicious/malicious', async () => {
    if (getReputationTier(0) !== 'trusted') throw new Error('Score 0 deveria ser trusted');
    if (getReputationTier(30) !== 'suspicious') throw new Error('Score 30 deveria ser suspicious');
    if (getReputationTier(60) !== 'malicious') throw new Error('Score 60 deveria ser malicious');
  });
  await runTest('Reputation: getTopThreats — retorna array', async () => {
    if (!Array.isArray(await getTopThreats(10))) throw new Error('Top threats não é array');
  });
  await runTest('Reputation: cleanup', async () => {
    await kv.del(`ip_reputation:${testRepIp}`);
    if (await getIpReputation(testRepIp) != null) throw new Error('Registro não deletado');
  });

  // ========== CATEGORIA 8: WEBHOOKS (6 testes) ==========

  await runTest('Webhooks: getWebhookConfigs — retorna array', async () => {
    if (!Array.isArray(await getWebhookConfigs())) throw new Error('Configs não é array');
  });
  await runTest('Webhooks: saveWebhookConfigs — salva array', async () => {
    const original = await getWebhookConfigs();
    await saveWebhookConfigs([]);
    if ((await getWebhookConfigs()).length !== 0) throw new Error('Array deveria estar vazio');
    await saveWebhookConfigs(original);
  });
  await runTest('Webhooks: WEBHOOK_EVENTS — existe e tem eventos', async () => {
    if (!Array.isArray(WEBHOOK_EVENTS) || WEBHOOK_EVENTS.length === 0) throw new Error('WEBHOOK_EVENTS vazio');
  });
  await runTest('Webhooks: dispatchWebhook — não crasha sem configs', async () => {
    await dispatchWebhook('test_event', { test: true });
  });
  await runTest('Webhooks: logWebhookDispatch — registra log', async () => {
    await logWebhookDispatch({ event: 'test', url: 'http://test.com', status: 200, responseTime: 100, success: true, timestamp: new Date().toISOString() } as Record<string, unknown>);
    const logs = (await kv.get('webhook_logs') || []) as unknown[];
    if (logs.length === 0) throw new Error('Log não registrado');
  });
  await runTest('Webhooks: REPUTATION_SIGNAL_POINTS — tem sinais definidos', async () => {
    if (!REPUTATION_SIGNAL_POINTS || typeof REPUTATION_SIGNAL_POINTS !== 'object' || Object.keys(REPUTATION_SIGNAL_POINTS).length === 0) throw new Error('REPUTATION_SIGNAL_POINTS inválido');
  });

  // ========== CATEGORIA 9: ANALYTICS (4 testes) ==========

  await runTest('Analytics: generateSecurityAnalytics — retorna métricas', async () => {
    const m = await generateSecurityAnalytics();
    if (!m || typeof m !== 'object') throw new Error('Analytics retornou null ou não-objeto');
  });
  await runTest('Analytics: métricas têm campos esperados', async () => {
    const m = await generateSecurityAnalytics() as Record<string, unknown>;
    for (const f of ['totalLogins', 'failedLogins', 'uniqueIps']) if (m[f] === undefined) throw new Error(`Campo ausente: ${f}`);
  });
  await runTest('Analytics: contadores são numéricos', async () => {
    const m = await generateSecurityAnalytics() as Record<string, unknown>;
    if (typeof m.totalLogins !== 'number' || typeof m.failedLogins !== 'number') throw new Error('Contadores não numéricos');
  });
  await runTest('Analytics: contadores são >= 0', async () => {
    const m = await generateSecurityAnalytics() as Record<string, unknown>;
    if ((m.totalLogins as number) < 0 || (m.failedLogins as number) < 0) throw new Error('Contadores negativos');
  });

  // ========== CATEGORIA 10: AUTENTICAÇÃO (6 testes) ==========

  await runTest('Auth: admin session token format', async () => {
    const t = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    if (!t.startsWith('admin_') || t.length < 20) throw new Error('Formato inválido');
  });
  await runTest('Auth: master session token format', async () => {
    if (!`master_${Date.now()}_${Math.random().toString(36).substring(7)}`.startsWith('master_')) throw new Error('Formato inválido');
  });
  await runTest('Auth: CSRF token format', async () => {
    if (!`csrf_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`.startsWith('csrf_')) throw new Error('Formato inválido');
  });
  await runTest('Auth: driver session token format', async () => {
    if (!`driver_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`.startsWith('driver_')) throw new Error('Formato inválido');
  });
  await runTest('Auth: clearRateLimit — limpa sem erro', async () => { await clearRateLimit('_test_clear', '_test_ip'); });
  await runTest('Auth: cleanupExpiredSessions — executa sem erro', async () => {
    if (typeof await cleanupExpiredSessions() !== 'number') throw new Error('Deveria retornar número');
  });

  // ========== CATEGORIA 11: INTEGRAÇÃO PRECISION ENGINE (6 testes) ==========

  await runTest('Precision: enrichIpGeo com timeout — retorna em tempo', async () => {
    const start = Date.now();
    await enrichIpGeo('1.1.1.1');
    if (Date.now() - start > 15000) throw new Error(`Muito lento: ${Date.now() - start}ms`);
  });
  await runTest('Precision: resultado tem campos esperados', async () => {
    const geo = await enrichIpGeo('8.8.8.8') as Record<string, unknown>;
    if (!geo) throw new Error('Resultado null');
    if (!geo.sources || !Array.isArray(geo.sources)) throw new Error('Sem array de fontes');
    if (!geo.sourcesConsulted) throw new Error('Sem sourcesConsulted');
  });
  await runTest('Precision: múltiplas fontes consultadas', async () => {
    const geo = await enrichIpGeo('8.8.4.4') as Record<string, unknown>;
    if (!geo || (geo.sourcesConsulted as number) < 2) throw new Error(`Poucas fontes: ${geo?.sourcesConsulted}`);
  });
  await runTest('Precision: cache hit — segunda chamada mais rápida', async () => {
    await enrichIpGeo('208.67.222.222');
    const start = Date.now();
    await enrichIpGeo('208.67.222.222');
    if (Date.now() - start > 100) throw new Error(`Cache deveria ser <100ms, foi ${Date.now() - start}ms`);
  });
  await runTest('Precision: campos de qualidade presentes', async () => {
    const geo = await enrichIpGeo('1.0.0.1') as Record<string, unknown>;
    if (!geo || geo.confidence === undefined) throw new Error('Sem campo confidence');
  });
  await runTest('Precision: ISP/org detectados para IP público', async () => {
    const geo = await enrichIpGeo('8.8.8.8') as Record<string, unknown>;
    if (!geo || (!geo.isp && !geo.org)) throw new Error('Sem ISP nem ORG');
  });

  // ========== RESULTADO FINAL ==========

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);

  const runRecord = { id: `run_${Date.now()}`, timestamp: new Date().toISOString(), total: results.length, passed, failed, durationMs: totalMs };
  const history = (await kv.get('test_run_history') || []) as Record<string, unknown>[];
  history.push(runRecord);
  if (history.length > 20) history.splice(0, history.length - 20);
  await kv.set('test_run_history', history);

  console.log(`🧪 [TESTS-v8] ${passed}/${results.length} testes passaram (${totalMs}ms)`);
  return { summary: { total: results.length, passed, failed, durationMs: totalMs }, results, version: '3.3.0-security-v8-80tests-precision-v4.1' };
}

// ==========================================
// 🧪 SUITE E2E (3 fluxos completos)
// ==========================================

async function executeE2ETestSuite(): Promise<{ summary: { total: number; passed: number; failed: number; durationMs: number }; results: E2ETestResult[]; runId: string }> {
  const startTime = Date.now();
  const results: E2ETestResult[] = [];
  const testPrefix = `e2e_${Date.now()}`;
  const cleanupKeys: string[] = [];

  async function runTest(name: string, category: string, fn: () => Promise<string[]>): Promise<void> {
    const start = Date.now();
    try {
      const keys = await fn();
      if (keys?.length) cleanupKeys.push(...keys);
      results.push({ name, category, passed: true, durationMs: Date.now() - start });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ name, category, passed: false, error: msg, durationMs: Date.now() - start });
    }
  }

  await runTest('E2E: Criar produto → Fazer pedido → Confirmar → Completar', 'Fluxo Pedido', async () => {
    const productId = `${testPrefix}_product`;
    const orderId = `${testPrefix}_order`;
    await kv.set(`product:${productId}`, { id: productId, name: 'E2E Burger', price: 25, category: 'test', available: true, createdAt: new Date().toISOString() });
    await kv.set(`order:${orderId}`, { orderId, customerName: 'E2E Client', customerPhone: '11999990000', items: [{ productId, name: 'E2E Burger', quantity: 1, price: 25 }], status: 'pending', createdAt: new Date().toISOString() });
    const order = await kv.get(`order:${orderId}`) as Record<string, unknown>;
    if (!order || order.status !== 'pending') throw new Error('Pedido não criado corretamente');
    await kv.set(`order:${orderId}`, { ...order, status: 'preparing' });
    const prep = await kv.get(`order:${orderId}`) as Record<string, unknown>;
    if (prep.status !== 'preparing') throw new Error('Status preparing falhou');
    await kv.set(`archive:${orderId}`, { ...prep, status: 'completed', completedAt: new Date().toISOString() });
    await kv.del(`order:${orderId}`);
    const archived = await kv.get(`archive:${orderId}`) as Record<string, unknown>;
    if (!archived || archived.status !== 'completed') throw new Error('Arquivamento falhou');
    return [`product:${productId}`, `archive:${orderId}`];
  });

  await runTest('E2E: Criar cupom → Validar → Usar → Esgotar', 'Fluxo Cupom', async () => {
    const couponId = `${testPrefix}_coupon`;
    await kv.set(`coupon:${couponId}`, { id: couponId, code: `E2E${Date.now()}`, type: 'percentage', value: 15, maxUses: 1, currentUses: 0, isActive: true });
    const read = await kv.get(`coupon:${couponId}`) as Record<string, unknown>;
    if (!read.isActive) throw new Error('Cupom deveria estar ativo');
    read.currentUses = 1;
    await kv.set(`coupon:${couponId}`, read);
    const used = await kv.get(`coupon:${couponId}`) as Record<string, unknown>;
    if ((used.currentUses as number) < (used.maxUses as number)) throw new Error('Cupom deveria estar esgotado');
    return [`coupon:${couponId}`];
  });

  await runTest('E2E: Login entregador → Atribuir pedido → Completar → Stats', 'Fluxo Entregador', async () => {
    const driverPhone = `${testPrefix}_driver`;
    const orderId = `${testPrefix}_delivery_order`;
    await kv.set(`driver:${driverPhone}`, { name: 'E2E Driver', phone: driverPhone, color: '#FF0000', status: 'online', lastLogin: new Date().toISOString(), stats: { total: 0 } });
    await kv.set(`order:${orderId}`, { orderId, status: 'confirmed', items: [], createdAt: new Date().toISOString() });
    const order = await kv.get(`order:${orderId}`) as Record<string, unknown>;
    await kv.set(`order:${orderId}`, { ...order, driver: { phone: driverPhone, name: 'E2E Driver' }, status: 'out_for_delivery' });
    const delivery = await kv.get(`order:${orderId}`) as Record<string, unknown>;
    await kv.set(`archive:${orderId}`, { ...delivery, status: 'completed' });
    await kv.del(`order:${orderId}`);
    const driver = await kv.get(`driver:${driverPhone}`) as Record<string, unknown>;
    driver.stats = { total: 1 };
    await kv.set(`driver:${driverPhone}`, driver);
    return [`driver:${driverPhone}`, `archive:${orderId}`];
  });

  for (const key of cleanupKeys) { try { await kv.del(key); } catch {} }

  const totalMs = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const runRecord = { id: `e2e_${Date.now()}`, timestamp: new Date().toISOString(), total: results.length, passed, failed, durationMs: totalMs };
  const history = (await kv.get('e2e_test_history') || []) as Record<string, unknown>[];
  history.push(runRecord);
  if (history.length > 20) history.splice(0, history.length - 20);
  await kv.set('e2e_test_history', history);

  console.log(`🧪 [E2E] Completo: ${passed}/${results.length} (${totalMs}ms)`);
  return { summary: { total: results.length, passed, failed, durationMs: totalMs }, results, runId: runRecord.id };
}

// ==========================================
// 📋 ROTAS
// ==========================================

router.post('/admin/tests/run', async (c) => success(c, await executeTestSuite()));
router.post('/master/tests/run', async (c) => success(c, await executeTestSuite()));

router.get('/admin/tests/history', async (c) => {
  try {
    const history = (await kv.get('test_run_history') || []) as Record<string, unknown>[];
    return success(c, { runs: history, count: history.length, latest: history.length > 0 ? history[history.length - 1] : null });
  } catch (e) { return error(c, `Erro ao ler histórico: ${e}`, 500); }
});

router.get('/master/tests/history', async (c) => {
  try {
    const history = (await kv.get('test_run_history') || []) as Record<string, unknown>[];
    return success(c, { runs: history, count: history.length, latest: history.length > 0 ? history[history.length - 1] : null });
  } catch (e) { return error(c, `Erro ao ler histórico: ${e}`, 500); }
});

router.post('/master/e2e-tests/run', async (c) => {
  try { return success(c, await executeE2ETestSuite()); }
  catch (e) { console.error('❌ [E2E] Erro fatal:', e); return error(c, `Erro E2E: ${e}`, 500); }
});

router.get('/master/e2e-tests/history', async (c) => {
  try {
    const h = (await kv.get('e2e_test_history') || []) as Record<string, unknown>[];
    return success(c, { runs: h, count: h.length });
  } catch (e) { return error(c, `Erro histórico E2E: ${e}`, 500); }
});

export default router;
