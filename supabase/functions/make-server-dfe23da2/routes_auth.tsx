// ==========================================
// 🔐 ROTAS: Auth (Login Admin/Master), Audit Logs, Blacklist/Whitelist, Security Alert, Server IP
// Sub-router Hono extraído do index.tsx monolítico
// ==========================================

import { Hono } from "npm:hono";
import * as kv from "./kv_retry.tsx";
import {
  success, error, getClientIp,
  SESSION_DURATION_MS,
} from "./server_utils.tsx";
import { requireAdmin, requireMaster, checkRateLimit, recordFailedAttempt, clearRateLimit, cleanupExpiredSessions } from "./middleware.tsx";
import { writeAuditLogWithGeo, checkIpBlacklist } from "./security_helpers.tsx";
import { enrichIpGeo } from "./geo.tsx";
import type { AuditLog, IpBlacklistEntry, IpWhitelistEntry } from "./types.tsx";

const router = new Hono();

// ==========================================
// 🏥 HEALTH CHECK
// ==========================================

router.get('/health', (c) => {
  console.log('✅ [HEALTH] Health check realizado');
  return c.json({
    success: true, status: 'healthy', timestamp: new Date().toISOString(),
    version: '3.3.0-security-v8-80tests-precision-v4.1',
    message: 'Servidor funcionando corretamente!',
    features: ['upload', 'cupons', 'increment-usage']
  });
});

router.get('/', (c) => {
  return c.json({
    success: true, message: 'API Delivery Multi-Tenant - Servidor Online!',
    version: '2.0.0',
    endpoints: ['GET /health', 'GET /products', 'GET /orders', 'GET /store/status', 'GET /config/public', 'GET /settings/estimates', 'GET /delivery/sectors']
  });
});

// ==========================================
// 🌐 DESCOBRIR IP DO SERVIDOR
// ==========================================

router.get('/server/ip', requireAdmin, async (c) => {
  try {
    console.log('🔍 [SERVER IP] Descobrindo IP público do servidor Supabase...');
    const ipResponse = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipResponse.json();
    console.log('✅ [SERVER IP] IP descoberto:', ipData.ip);
    return success(c, {
      ip: ipData.ip, message: 'Este é o IP que você deve adicionar na whitelist do PagSeguro',
      instructions: {
        step1: 'Acesse: https://pagseguro.uol.com.br/',
        step2: 'Vá em: Integração > Tokens > Configurações de Segurança',
        step3: `Adicione o IP: ${ipData.ip}`,
        step4: 'Aguarde até 24h para propagação'
      }
    });
  } catch (e) {
    console.error('❌ [SERVER IP] Erro ao descobrir IP:', e);
    return error(c, `Erro ao descobrir IP: ${e}`, 500);
  }
});

// ==========================================
// 🔐 LOGIN ADMIN
// ==========================================

router.post('/admin/login', async (c) => {
  try {
    const ip = getClientIp(c);
    const userAgent = c.req.header('user-agent') || 'unknown';

    const blacklisted = await checkIpBlacklist(ip);
    if (blacklisted) {
      console.warn(`🛑 [BLACKLIST] IP ${ip} bloqueado permanentemente — tentou login admin`);
      writeAuditLogWithGeo({
        action: 'LOGIN_BLACKLISTED', username: 'admin (blacklist)',
        ip, details: `IP permanentemente bloqueado tentou login admin. Motivo original: ${blacklisted.reason || '?'}. User-Agent: ${userAgent}`,
        status: 'failure', userAgent
      });
      return c.json({ success: false, error: 'Acesso negado.' }, 403);
    }

    const rateCheck = await checkRateLimit('admin_login', ip);
    if (!rateCheck.allowed) {
      console.warn(`🚫 [LOGIN] IP ${ip} bloqueado por rate limit (retry em ${rateCheck.retryAfterSec}s)`);
      writeAuditLogWithGeo({
        action: 'LOGIN_RATE_LIMITED', username: 'admin (bloqueado)',
        ip, details: `Tentativa de login admin bloqueada por rate limit. User-Agent: ${userAgent}`,
        status: 'failure', userAgent
      });
      return c.json({
        success: false,
        error: `Muitas tentativas de login. Tente novamente em ${Math.ceil((rateCheck.retryAfterSec || 900) / 60)} minutos.`,
        retryAfterSec: rateCheck.retryAfterSec,
      }, 429);
    }

    const body = await c.req.json();
    const { password, webrtcIp, browserInfo } = body;
    if (webrtcIp) console.log(`🔓 [WEBRTC] Admin login recebeu webrtcIp: ${webrtcIp} (request IP: ${ip})`);
    if (browserInfo) console.log(`🌐 [BROWSER] Admin login: tz=${browserInfo.timezone}, lang=${browserInfo.language}, platform=${browserInfo.platform}`);

    if (webrtcIp && webrtcIp !== ip) {
      const webrtcBlacklisted = await checkIpBlacklist(webrtcIp);
      if (webrtcBlacklisted) {
        console.warn(`🛑 [BLACKLIST] IP real (WebRTC) ${webrtcIp} está na blacklist — tentou login admin via VPN ${ip}`);
        writeAuditLogWithGeo({
          action: 'LOGIN_BLACKLISTED', username: 'admin (WebRTC IP blacklist)',
          ip, details: `IP real (WebRTC: ${webrtcIp}) está na blacklist. Bloqueado apesar de usar VPN ${ip}. Motivo original: ${webrtcBlacklisted.reason || '?'}. User-Agent: ${userAgent}`,
          status: 'failure', userAgent, webrtcIp, browserInfo
        });
        return c.json({ success: false, error: 'Acesso negado.' }, 403);
      }
    }

    const envPassword = Deno.env.get('ADMIN_PASSWORD');
    const storedPassword = await kv.get('admin_password');
    const adminPassword = storedPassword || envPassword;
    if (!adminPassword) {
      console.error('❌ [LOGIN] Senha de admin não configurada (nem ENV nem KV)');
      return error(c, 'Erro de configuração do servidor', 500);
    }

    if (password === adminPassword) {
      console.log('✅ [LOGIN] Login admin bem-sucedido');
      const token = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const csrfToken = `csrf_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const sessionKey = `admin_session:${token}`;
      await kv.set(sessionKey, {
        _key: sessionKey, csrfToken,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
      });
      console.log('🛡️ [LOGIN] Sessão admin armazenada no KV, expira em 24h');
      await clearRateLimit('admin_login', ip);
      writeAuditLogWithGeo({
        action: 'LOGIN_SUCCESS', username: 'admin',
        ip, details: `Login admin bem-sucedido. User-Agent: ${userAgent}`,
        status: 'success', userAgent, webrtcIp: webrtcIp || null, browserInfo: browserInfo || null
      });
      cleanupExpiredSessions().catch(() => {});
      return success(c, { authenticated: true, message: 'Login realizado com sucesso', token, csrfToken });
    } else {
      console.warn(`⚠️ [LOGIN] Senha incorreta — IP: ${ip}`);
      await recordFailedAttempt('admin_login', ip);
      writeAuditLogWithGeo({
        action: 'LOGIN_FAILED', username: 'admin (tentativa)',
        ip, details: `Tentativa de login admin com senha incorreta. User-Agent: ${userAgent}`,
        status: 'failure', userAgent, webrtcIp: webrtcIp || null, browserInfo: browserInfo || null
      });
      return error(c, 'Senha incorreta', 401);
    }
  } catch (e) {
    console.error('❌ [LOGIN] Erro ao processar login:', e);
    return error(c, `Erro ao fazer login: ${e}`, 500);
  }
});

// ==========================================
// 🔐 LOGIN MASTER
// ==========================================

router.post('/master/login', async (c) => {
  console.log('✅ [SERVER] Rota POST /master/login acessada');
  try {
    const ip = getClientIp(c);
    const userAgent = c.req.header('user-agent') || 'unknown';

    const blacklisted = await checkIpBlacklist(ip);
    if (blacklisted) {
      console.warn(`🛑 [BLACKLIST] IP ${ip} bloqueado permanentemente — tentou login master`);
      writeAuditLogWithGeo({
        action: 'LOGIN_BLACKLISTED', username: 'master (blacklist)',
        ip, details: `IP permanentemente bloqueado tentou login master. Motivo: ${blacklisted.reason || '?'}. User-Agent: ${userAgent}`,
        status: 'failure', userAgent
      });
      return c.json({ success: false, error: 'Acesso negado.' }, 403);
    }

    const rateCheck = await checkRateLimit('master_login', ip);
    if (!rateCheck.allowed) {
      console.warn(`🚫 [MASTER LOGIN] IP ${ip} bloqueado por rate limit`);
      writeAuditLogWithGeo({
        action: 'LOGIN_RATE_LIMITED', username: 'master (bloqueado)',
        ip, details: `Tentativa de login master bloqueada por rate limit. User-Agent: ${userAgent}`,
        status: 'failure', userAgent
      });
      return c.json({
        success: false,
        error: `Muitas tentativas de login. Tente novamente em ${Math.ceil((rateCheck.retryAfterSec || 900) / 60)} minutos.`,
        retryAfterSec: rateCheck.retryAfterSec,
      }, 429);
    }

    const body = await c.req.json();
    const { password, username, webrtcIp, browserInfo } = body;
    if (webrtcIp) console.log(`🔓 [WEBRTC] Master login recebeu webrtcIp: ${webrtcIp} (request IP: ${ip})`);
    if (browserInfo) console.log(`🌐 [BROWSER] Master login: tz=${browserInfo.timezone}, lang=${browserInfo.language}, platform=${browserInfo.platform}`);

    if (webrtcIp && webrtcIp !== ip) {
      const webrtcBlacklisted = await checkIpBlacklist(webrtcIp);
      if (webrtcBlacklisted) {
        console.warn(`🛑 [BLACKLIST] IP real (WebRTC) ${webrtcIp} está na blacklist — tentou login master via VPN ${ip}`);
        writeAuditLogWithGeo({
          action: 'LOGIN_BLACKLISTED', username: username || 'master (WebRTC IP blacklist)',
          ip, details: `IP real (WebRTC: ${webrtcIp}) está na blacklist. Bloqueado apesar de usar VPN ${ip}. Motivo original: ${webrtcBlacklisted.reason || '?'}. User-Agent: ${userAgent}`,
          status: 'failure', userAgent, webrtcIp, browserInfo
        });
        return c.json({ success: false, error: 'Acesso negado.' }, 403);
      }
    }

    console.log('🔍 [MASTER LOGIN] Username recebido:', username);
    const envAdminPass = Deno.env.get('ADMIN_PASSWORD');
    const envMasterPass = Deno.env.get('MASTER_PASSWORD');
    const masterPassword = envMasterPass || envAdminPass;
    if (!masterPassword) {
      console.error('❌ [MASTER LOGIN] MASTER_PASSWORD não configurada no ambiente');
      return error(c, 'Erro de configuração do servidor', 500);
    }

    if (password === masterPassword) {
      console.log('✅ [MASTER LOGIN] Login master bem-sucedido');
      const token = `master_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const sessionKey = `master_session:${token}`;
      await kv.set(sessionKey, {
        _key: sessionKey,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
      });
      console.log('🛡️ [MASTER LOGIN] Sessão master armazenada no KV, expira em 24h');
      await clearRateLimit('master_login', ip);
      writeAuditLogWithGeo({
        action: 'LOGIN_SUCCESS', username: username || 'master',
        ip, details: `Login master bem-sucedido (usuário: ${username || 'master'}). User-Agent: ${userAgent}`,
        status: 'success', userAgent, webrtcIp: webrtcIp || null, browserInfo: browserInfo || null
      });
      cleanupExpiredSessions().catch(() => {});
      return success(c, { authenticated: true, message: 'Login master realizado com sucesso', token });
    } else {
      console.warn(`⚠️ [MASTER LOGIN] Senha incorreta — IP: ${ip}`);
      await recordFailedAttempt('master_login', ip);
      writeAuditLogWithGeo({
        action: 'LOGIN_FAILED', username: username || 'master (tentativa)',
        ip, details: `Tentativa de login master com senha incorreta (usuário: ${username || '?'}). User-Agent: ${userAgent}`,
        status: 'failure', userAgent, webrtcIp: webrtcIp || null, browserInfo: browserInfo || null
      });
      return error(c, 'Senha incorreta', 401);
    }
  } catch (e) {
    console.error('❌ [MASTER LOGIN] Erro ao processar login:', e);
    return error(c, `Erro ao fazer login: ${e}`, 500);
  }
});

// ==========================================
// 🛡️ MIDDLEWARE POR PREFIXO
// ==========================================

router.use('/admin/*', async (c: any, next: any) => {
  const url = new URL(c.req.url);
  if (url.pathname.endsWith('/admin/login')) return await next();
  return await requireAdmin(c, next);
});

router.use('/master/*', async (c: any, next: any) => {
  const url = new URL(c.req.url);
  if (url.pathname.endsWith('/master/login')) return await next();
  return await requireMaster(c, next);
});

// ==========================================
// 📋 AUDIT LOGS
// ==========================================

router.get('/master/audit-logs', async (c) => {
  console.log('✅ [SERVER] Rota GET /master/audit-logs acessada');
  try {
    const daysParam = c.req.query('days') || '7';
    const days = parseInt(daysParam);
    const filterAction = c.req.query('action') || '';
    const filterStatus = c.req.query('status') || '';
    const logs: any[] = await kv.get('audit_logs') || [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    let filteredLogs = logs.filter((log: any) => new Date(log.timestamp) >= cutoffDate);
    if (filterAction) filteredLogs = filteredLogs.filter((log: any) => log.action === filterAction);
    if (filterStatus) filteredLogs = filteredLogs.filter((log: any) => log.status === filterStatus);
    console.log(`📦 [SERVER] Retornando ${filteredLogs.length} logs dos últimos ${days} dias`);
    return success(c, { logs: filteredLogs });
  } catch (e) {
    console.error('❌ [SERVER] Erro ao buscar audit logs:', e);
    return error(c, `Erro ao buscar logs: ${e}`);
  }
});

router.delete('/master/audit-logs/reset', async (c) => {
  console.log('🗑️ [SERVER] Rota DELETE /master/audit-logs/reset acessada');
  try {
    const ip = getClientIp(c);
    const userAgent = c.req.header('user-agent') || 'unknown';
    const blacklist: any[] = await kv.get('ip_blacklist') || [];
    const whitelist: any[] = await kv.get('ip_whitelist') || [];
    const activeBlocked = blacklist.filter((e: any) => e.active !== false);
    const activeAllowed = whitelist.filter((e: any) => e.active !== false);
    const summaryLogs: any[] = [];
    const now = new Date().toISOString();
    for (const entry of activeBlocked) {
      summaryLogs.push({
        id: `log_reset_bl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        action: 'IP_STATUS_BLOCKED', username: 'sistema (reset)', ip: entry.ip,
        details: `[Registro pos-reset] IP bloqueado. Motivo: ${entry.reason || 'Sem motivo informado'}. Bloqueado em: ${entry.blockedAt || entry.createdAt || '?'}.`,
        status: 'failure' as const, userAgent: 'system', geo: entry.geo || null, timestamp: now,
        isResetSummary: true, ipStatus: 'blocked', originalDate: entry.blockedAt || entry.createdAt || null,
      });
    }
    for (const entry of activeAllowed) {
      summaryLogs.push({
        id: `log_reset_wl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        action: 'IP_STATUS_ALLOWED', username: 'sistema (reset)', ip: entry.ip,
        details: `[Registro pos-reset] IP permitido (whitelist). Motivo: ${entry.reason || 'Sem motivo informado'}. Permitido em: ${entry.allowedAt || entry.createdAt || '?'}.`,
        status: 'success' as const, userAgent: 'system', geo: entry.geo || null, timestamp: now,
        isResetSummary: true, ipStatus: 'allowed', whitelisted: true, originalDate: entry.allowedAt || entry.createdAt || null,
      });
    }
    const resetLog = {
      id: `log_reset_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      action: 'AUDIT_LOGS_RESET', username: 'master', ip,
      details: `Logs de auditoria zerados manualmente. ${activeBlocked.length} IP(s) bloqueado(s) e ${activeAllowed.length} IP(s) permitido(s) preservados como resumo.`,
      status: 'success' as const, userAgent, timestamp: now, isResetSummary: true,
    };
    const newLogs = [resetLog, ...summaryLogs];
    await kv.set('audit_logs', newLogs);
    console.log(`🗑️ [AUDIT RESET] Logs zerados. Resumos gerados: ${summaryLogs.length} (${activeBlocked.length} bloqueados + ${activeAllowed.length} permitidos)`);
    return success(c, { message: 'Logs zerados com sucesso', summary: { blockedIps: activeBlocked.length, allowedIps: activeAllowed.length, totalSummaryLogs: newLogs.length }, logs: newLogs });
  } catch (e) {
    console.error('❌ [AUDIT RESET] Erro ao zerar logs:', e);
    return error(c, `Erro ao zerar logs: ${e}`, 500);
  }
});

router.post('/admin/audit-logs', async (c) => {
  console.log('✅ [SERVER] Rota POST /admin/audit-logs acessada');
  try {
    const { action, user, details, status: logStatus } = await c.req.json();
    const ip = getClientIp(c);
    const userAgent = c.req.header('user-agent') || 'unknown';
    const geo = await enrichIpGeo(ip).catch(() => null);
    const logs: any[] = await kv.get('audit_logs') || [];
    const newLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      action, username: user || 'sistema', ip, details,
      status: logStatus || 'success', userAgent, geo, timestamp: new Date().toISOString()
    };
    logs.push(newLog);
    const trimmedLogs = logs.slice(-1000);
    await kv.set('audit_logs', trimmedLogs);
    console.log(`✅ [SERVER] Log de auditoria criado:`, action, `IP: ${ip}`);
    return success(c, { log: newLog });
  } catch (e) {
    console.error('❌ [SERVER] Erro ao criar audit log:', e);
    return error(c, `Erro ao criar log: ${e}`);
  }
});

// ==========================================
// 🛑 IP BLACKLIST
// ==========================================

router.get('/master/ip-blacklist', async (c) => {
  try {
    const blacklist: any[] = await kv.get('ip_blacklist') || [];
    console.log(`🛑 [BLACKLIST] Retornando ${blacklist.length} IPs bloqueados`);
    return success(c, { blacklist });
  } catch (e) {
    console.error('❌ [BLACKLIST] Erro ao listar:', e);
    return error(c, `Erro ao listar blacklist: ${e}`);
  }
});

router.post('/master/ip-blacklist', async (c) => {
  try {
    const { ip, reason } = await c.req.json();
    if (!ip) return error(c, 'IP obrigatório');
    const blacklist: any[] = await kv.get('ip_blacklist') || [];
    const existing = blacklist.find((entry: any) => entry.ip === ip);
    if (existing) return error(c, `IP ${ip} já está na blacklist`);
    const geo = await enrichIpGeo(ip).catch(() => null);
    const entry = { ip, reason: reason || 'Bloqueio manual pelo administrador', blockedAt: new Date().toISOString(), blockedBy: 'master', geo, active: true };
    blacklist.push(entry);
    await kv.set('ip_blacklist', blacklist);
    writeAuditLogWithGeo({
      action: 'IP_BLACKLISTED', username: 'master', ip: getClientIp(c),
      details: `IP ${ip} adicionado à blacklist. Motivo: ${reason || 'Manual'}. Localização: ${geo ? [geo.city, geo.region, geo.country].filter(Boolean).join(', ') : 'N/A'}`,
      status: 'success', userAgent: c.req.header('user-agent') || ''
    });
    console.log(`🛑 [BLACKLIST] IP ${ip} bloqueado. Motivo: ${reason}`);
    return success(c, { entry, message: `IP ${ip} bloqueado com sucesso` });
  } catch (e) {
    console.error('❌ [BLACKLIST] Erro ao adicionar:', e);
    return error(c, `Erro ao bloquear IP: ${e}`);
  }
});

router.delete('/master/ip-blacklist/:ip', async (c) => {
  try {
    const ipToRemove = c.req.param('ip');
    if (!ipToRemove) return error(c, 'IP obrigatório');
    const blacklist: any[] = await kv.get('ip_blacklist') || [];
    const filtered = blacklist.filter((entry: any) => entry.ip !== ipToRemove);
    if (filtered.length === blacklist.length) return error(c, `IP ${ipToRemove} não encontrado na blacklist`);
    await kv.set('ip_blacklist', filtered);
    writeAuditLogWithGeo({
      action: 'IP_UNBLACKLISTED', username: 'master', ip: getClientIp(c),
      details: `IP ${ipToRemove} removido da blacklist`, status: 'success',
      userAgent: c.req.header('user-agent') || ''
    });
    console.log(`✅ [BLACKLIST] IP ${ipToRemove} removido da blacklist`);
    return success(c, { message: `IP ${ipToRemove} desbloqueado` });
  } catch (e) {
    console.error('❌ [BLACKLIST] Erro ao remover:', e);
    return error(c, `Erro ao desbloquear IP: ${e}`);
  }
});

// ==========================================
// ✅ IP WHITELIST
// ==========================================

router.get('/master/ip-whitelist', async (c) => {
  try {
    const whitelist: any[] = await kv.get('ip_whitelist') || [];
    console.log(`✅ [WHITELIST] Retornando ${whitelist.length} IPs permitidos`);
    return success(c, { whitelist });
  } catch (e) {
    console.error('❌ [WHITELIST] Erro ao listar:', e);
    return error(c, `Erro ao listar whitelist: ${e}`);
  }
});

router.post('/master/ip-whitelist', async (c) => {
  try {
    const { ip, reason, removeFromBlacklist } = await c.req.json();
    if (!ip) return error(c, 'IP obrigatório');
    const whitelist: any[] = await kv.get('ip_whitelist') || [];
    const existing = whitelist.find((entry: any) => entry.ip === ip);
    if (existing) return error(c, `IP ${ip} já está na whitelist`);
    const geo = await enrichIpGeo(ip).catch(() => null);
    const entry = { ip, reason: reason || 'Adicionado manualmente pelo administrador', allowedAt: new Date().toISOString(), allowedBy: 'master', geo, active: true };
    whitelist.push(entry);
    await kv.set('ip_whitelist', whitelist);
    let removedFromBlacklistResult = false;
    if (removeFromBlacklist !== false) {
      const blacklist: any[] = await kv.get('ip_blacklist') || [];
      const filteredBlacklist = blacklist.filter((e: any) => e.ip !== ip);
      if (filteredBlacklist.length < blacklist.length) {
        await kv.set('ip_blacklist', filteredBlacklist);
        removedFromBlacklistResult = true;
        console.log(`✅ [WHITELIST] IP ${ip} removido da blacklist automaticamente`);
      }
    }
    writeAuditLogWithGeo({
      action: 'IP_WHITELISTED', username: 'master', ip: getClientIp(c),
      details: `IP ${ip} adicionado à whitelist (acesso permitido). Motivo: ${reason || 'Manual'}.${removedFromBlacklistResult ? ' Removido da blacklist automaticamente.' : ''} Localização: ${geo ? [geo.city, geo.region, geo.country].filter(Boolean).join(', ') : 'N/A'}`,
      status: 'success', userAgent: c.req.header('user-agent') || ''
    });
    console.log(`✅ [WHITELIST] IP ${ip} adicionado à whitelist. Motivo: ${reason}`);
    return success(c, { entry, removedFromBlacklist: removedFromBlacklistResult, message: `IP ${ip} adicionado à lista de acesso permitido` });
  } catch (e) {
    console.error('❌ [WHITELIST] Erro ao adicionar:', e);
    return error(c, `Erro ao adicionar IP à whitelist: ${e}`);
  }
});

router.delete('/master/ip-whitelist/:ip', async (c) => {
  try {
    const ipToRemove = c.req.param('ip');
    if (!ipToRemove) return error(c, 'IP obrigatório');
    const whitelist: any[] = await kv.get('ip_whitelist') || [];
    const filtered = whitelist.filter((entry: any) => entry.ip !== ipToRemove);
    if (filtered.length === whitelist.length) return error(c, `IP ${ipToRemove} não encontrado na whitelist`);
    await kv.set('ip_whitelist', filtered);
    writeAuditLogWithGeo({
      action: 'IP_UNWHITELISTED', username: 'master', ip: getClientIp(c),
      details: `IP ${ipToRemove} removido da whitelist (acesso permitido revogado)`,
      status: 'success', userAgent: c.req.header('user-agent') || ''
    });
    console.log(`🔄 [WHITELIST] IP ${ipToRemove} removido da whitelist`);
    return success(c, { message: `IP ${ipToRemove} removido da lista de acesso permitido` });
  } catch (e) {
    console.error('❌ [WHITELIST] Erro ao remover:', e);
    return error(c, `Erro ao remover IP da whitelist: ${e}`);
  }
});

// ==========================================
// 🚨 SECURITY ALERT
// ==========================================

router.get('/master/security-alert', async (c) => {
  try {
    const alert = await kv.get('security_alert:latest');
    return success(c, { alert: alert || null });
  } catch (e) {
    return error(c, `Erro: ${e}`);
  }
});

export default router;