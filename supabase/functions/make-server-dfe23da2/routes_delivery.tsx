// ==========================================
// 🛵 ROTAS: Entregadores, Setores, Configuração de Delivery
// Sub-router Hono extraído do index.tsx monolítico
// ==========================================

import { Hono } from "npm:hono";
import * as kv from "./kv_retry.tsx";
import {
  success, error,
  sanitizeName, sanitizePhone,
  getClientIp,
  DELIVERY_RATE_LIMIT_MAX, DELIVERY_RATE_LIMIT_WINDOW_MS,
  DRIVER_SESSION_DURATION_MS,
} from "./server_utils.tsx";
import { requireAdmin, requireMaster, requireAdminOrDriver } from "./middleware.tsx";
import { writeAuditLogWithGeo, checkIpBlacklist } from "./security_helpers.tsx";
import type { DeliveryConfig, DeliverySector } from "./types.tsx";

const router = new Hono();

// ==========================================
// 🛵 LOGIN ENTREGADOR
// ==========================================

router.post('/delivery/login', async (c) => {
  try {
    const ip = getClientIp(c);
    const userAgent = c.req.header('user-agent') || 'unknown';

    // Blacklist check
    const blacklisted = await checkIpBlacklist(ip);
    if (blacklisted) {
      console.warn(`🛑 [BLACKLIST] IP ${ip} bloqueado — tentou login delivery`);
      writeAuditLogWithGeo({
        action: 'LOGIN_BLACKLISTED', username: 'delivery (blacklist)',
        ip, details: `IP bloqueado tentou login delivery. Motivo: ${blacklisted.reason || '?'}. User-Agent: ${userAgent}`,
        status: 'failure', userAgent
      });
      return c.json({ success: false, error: 'Acesso negado.' }, 403);
    }

    // Rate limiting leve
    const rateKey = 'delivery_login';
    const rlRecord: any = await kv.get(`rate_limit:${rateKey}:${ip}`);
    if (rlRecord?.lockedUntil && new Date(rlRecord.lockedUntil).getTime() > Date.now()) {
      const remaining = Math.ceil((new Date(rlRecord.lockedUntil).getTime() - Date.now()) / 1000);
      return c.json({ success: false, error: `Muitas tentativas. Tente em ${Math.ceil(remaining / 60)} minutos.`, retryAfterSec: remaining }, 429);
    }
    if (rlRecord && !rlRecord.lockedUntil) {
      const windowAge = Date.now() - new Date(rlRecord.windowStart || 0).getTime();
      if (windowAge < DELIVERY_RATE_LIMIT_WINDOW_MS && (rlRecord.attempts || 0) >= DELIVERY_RATE_LIMIT_MAX) {
        const lockedUntil = new Date(Date.now() + DELIVERY_RATE_LIMIT_WINDOW_MS).toISOString();
        await kv.set(`rate_limit:${rateKey}:${ip}`, { ...rlRecord, _key: `rate_limit:${rateKey}:${ip}`, lockedUntil });
        console.warn(`🚫 [RATE LIMIT] IP ${ip} bloqueado no delivery/login`);
        return c.json({ success: false, error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' }, 429);
      }
    }

    const rawBody = await c.req.json();
    const name = sanitizeName(rawBody.name);
    const phone = sanitizePhone(rawBody.phone);
    const color = rawBody.color;
    const webrtcIp = rawBody.webrtcIp || null;
    const browserInfo = rawBody.browserInfo || null;
    if (webrtcIp) console.log(`🔓 [WEBRTC] Delivery login recebeu webrtcIp: ${webrtcIp} (request IP: ${ip})`);
    if (browserInfo) console.log(`🌐 [BROWSER] Delivery login: tz=${browserInfo.timezone}, lang=${browserInfo.language}`);

    // Blacklist check do IP real (WebRTC)
    if (webrtcIp && webrtcIp !== ip) {
      const webrtcBlacklisted = await checkIpBlacklist(webrtcIp);
      if (webrtcBlacklisted) {
        console.warn(`🛑 [BLACKLIST] IP real (WebRTC) ${webrtcIp} está na blacklist — tentou login delivery via VPN ${ip}`);
        writeAuditLogWithGeo({
          action: 'LOGIN_BLACKLISTED', username: `entregador (WebRTC IP blacklist)`,
          ip, details: `IP real (WebRTC: ${webrtcIp}) está na blacklist. Bloqueado apesar de usar VPN ${ip}. Motivo original: ${webrtcBlacklisted.reason || '?'}. User-Agent: ${userAgent}`,
          status: 'failure', userAgent, webrtcIp, browserInfo
        });
        return c.json({ success: false, error: 'Acesso negado.' }, 403);
      }
    }

    if (!name || !phone) return error(c, 'Nome e telefone obrigatórios');

    const deliveryConfig: DeliveryConfig = await kv.get('delivery_config') || {};
    const maxDrivers = deliveryConfig.maxDrivers || 999;
    const activeColors = deliveryConfig.activeColors || [];

    const drivers = await kv.getByPrefix('driver:');
    const onlineDrivers = drivers.filter((d: any) => d.status === 'online');
    const normalizedPhone = phone.replace(/\D/g, '');
    const existingDriver = drivers.find((d: any) => d.phone.replace(/\D/g, '') === normalizedPhone);

    if (!existingDriver) {
      if (onlineDrivers.length >= maxDrivers) {
        return error(c, `Limite de entregadores online (${maxDrivers}) atingido.`, 403);
      }
    }

    let assignedColor = color || existingDriver?.color || '#F97316';
    if (activeColors.length > 0) {
      if (existingDriver && activeColors.includes(existingDriver.color)) {
        assignedColor = existingDriver.color;
      } else {
        const usedColors = onlineDrivers.map((d: any) => d.color);
        const availableColors = activeColors.filter((clr: string) => !usedColors.includes(clr));
        if (availableColors.length > 0) {
          assignedColor = availableColors[0];
        } else if (!existingDriver) {
          return error(c, 'Todas as cores de entregadores estão ocupadas.', 403);
        }
      }
    }

    const driverData = {
      name, phone, color: assignedColor,
      lastLogin: new Date().toISOString(),
      status: 'online',
      stats: existingDriver?.stats
    };
    await kv.set(`driver:${normalizedPhone}`, driverData);

    const driverToken = `driver_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const driverSessionKey = `driver_session:${driverToken}`;
    await kv.set(driverSessionKey, {
      _key: driverSessionKey, phone: normalizedPhone, name, color: assignedColor,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + DRIVER_SESSION_DURATION_MS).toISOString(),
    });

    await kv.del(`rate_limit:delivery_login:${ip}`);

    writeAuditLogWithGeo({
      action: 'DELIVERY_LOGIN_SUCCESS', username: `entregador: ${name}`,
      ip, details: `Entregador "${name}" (${phone}) logou com sucesso. Cor: ${assignedColor}. User-Agent: ${userAgent}`,
      status: 'success', userAgent, webrtcIp, browserInfo
    });

    console.log('✅ [LOGIN] Driver logado com sucesso:', name, '- Token emitido');
    return success(c, { driver: driverData, driverToken });
  } catch (e: any) {
    const ip = getClientIp(c);
    const userAgent = c.req.header('user-agent') || 'unknown';
    const webrtcIp = null;
    const browserInfo = null;
    const rlKey = `rate_limit:delivery_login:${ip}`;
    const rl: any = await kv.get(rlKey);
    if (!rl || Date.now() - new Date(rl?.windowStart || 0).getTime() > DELIVERY_RATE_LIMIT_WINDOW_MS) {
      await kv.set(rlKey, { _key: rlKey, attempts: 1, windowStart: new Date().toISOString() });
    } else {
      await kv.set(rlKey, { ...rl, _key: rlKey, attempts: (rl.attempts || 0) + 1 });
    }
    writeAuditLogWithGeo({
      action: 'DELIVERY_LOGIN_FAILED', username: 'entregador (erro)',
      ip, details: `Erro no login de entregador. User-Agent: ${userAgent}. Erro: ${e}`,
      status: 'failure', userAgent, webrtcIp, browserInfo
    });
    console.error('❌ [LOGIN] Erro:', e);
    return error(c, `Erro no login: ${e}`);
  }
});

// ==========================================
// 🛵 LOGOUT
// ==========================================

router.post('/delivery/logout', async (c) => {
  try {
    const { phone } = await c.req.json();
    if (!phone) return error(c, 'Telefone obrigatório');
    const normalizedPhone = phone.replace(/\D/g, '');
    const driver: any = await kv.get(`driver:${normalizedPhone}`);
    const driverToken = c.req.header('X-Driver-Token');
    if (driverToken) {
      await kv.del(`driver_session:${driverToken}`);
      console.log(`🛡️ [LOGOUT] Sessão de driver invalidada: ${driverToken.slice(0, 20)}...`);
    }
    if (driver) {
      const updatedDriver = { ...driver, status: 'offline', lastLogout: new Date().toISOString() };
      await kv.set(`driver:${normalizedPhone}`, updatedDriver);
      console.log(`🔴 [LOGOUT] Entregador ${driver.name} (${phone}) marcado como offline`);
      return success(c, { message: 'Logout realizado com sucesso' });
    }
    return error(c, 'Entregador não encontrado', 404);
  } catch (e) {
    console.error('❌ [LOGOUT] Erro:', e);
    return error(c, `Erro no logout: ${e}`);
  }
});

// Force logout (admin)
router.post('/admin/delivery/force-logout', async (c) => {
  try {
    const { phone } = await c.req.json();
    if (!phone) return error(c, 'Telefone obrigatório');
    const normalizedPhone = phone.replace(/\D/g, '');
    const driver: any = await kv.get(`driver:${normalizedPhone}`);
    if (driver) {
      const updatedDriver = { ...driver, status: 'offline', lastLogout: new Date().toISOString(), forcedLogout: true };
      await kv.set(`driver:${normalizedPhone}`, updatedDriver);
      const allDriverSessions = await kv.getByPrefix('driver_session:');
      for (const s of allDriverSessions) {
        if (s?.phone === normalizedPhone && s._key) {
          await kv.del(s._key);
          console.log(`🛡️ [FORCE LOGOUT] Sessão invalidada: ${s._key.slice(0, 30)}...`);
        }
      }
      console.log(`🔴 [ADMIN FORCE LOGOUT] Entregador ${driver.name} (${phone}) forçado a sair pelo admin`);
      return success(c, { message: 'Entregador desconectado com sucesso' });
    }
    return error(c, 'Entregador não encontrado', 404);
  } catch (e) {
    console.error('❌ [FORCE LOGOUT] Erro:', e);
    return error(c, `Erro ao forçar logout: ${e}`);
  }
});

// ==========================================
// ⚙️ CONFIG DELIVERY
// ==========================================

router.get('/delivery/config', async (c) => {
  const config = await kv.get('delivery_config') || { maxDrivers: 5, activeColors: [] };
  return success(c, config as Record<string, unknown>);
});

router.post('/delivery/config', requireAdmin, async (c) => {
  const body = await c.req.json();
  await kv.set('delivery_config', body);
  return success(c, body);
});

router.get('/delivery/available-colors', async (c) => {
  try {
    const deliveryConfig: any = await kv.get('delivery_config') || {};
    const activeColors = deliveryConfig.activeColors || [];
    const drivers = await kv.getByPrefix('driver:');
    const todayStr = new Date().toISOString().split('T')[0];
    const usedColors = drivers
      .filter((d: any) => d.lastLogin && d.lastLogin.split('T')[0] === todayStr)
      .map((d: any) => d.color);
    return success(c, { activeColors, usedColors });
  } catch (e) {
    return error(c, `Erro ao buscar cores: ${e}`);
  }
});

// ==========================================
// 🛵 LISTAR ENTREGADORES
// ==========================================

router.get('/delivery/drivers', requireAdmin, async (c) => {
  try {
    const drivers = await kv.getByPrefix('driver:');
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMonthStr = todayStr.substring(0, 7);
    const driversWithCleanStats = drivers.map((d: any) => {
      const stats = d.stats || { today: { count: 0 }, month: { count: 0 }, total: 0 };
      const todayCount = (stats.today?.date === todayStr) ? stats.today.count : 0;
      const monthCount = (stats.month?.month === currentMonthStr) ? stats.month.count : 0;
      return {
        ...d,
        computedStats: { today: todayCount, month: monthCount, total: stats.total || 0 }
      };
    });
    driversWithCleanStats.sort((a: any, b: any) => new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime());
    return success(c, { drivers: driversWithCleanStats });
  } catch (e) {
    return error(c, `Erro ao listar drivers: ${e}`);
  }
});

// Histórico do entregador
router.get('/delivery/history/:phone', requireAdminOrDriver, async (c) => {
  const phone = c.req.param('phone');
  const soDigitos = (t: unknown) => String(t || '').replace(/\D/g, '');
  if (c.get('authType' as never) === 'driver' && soDigitos(c.get('driverPhone' as never)) !== soDigitos(phone)) {
    return error(c, 'Entregador só pode ver o próprio histórico', 403);
  }
  console.log('📋 [DELIVERYMAN] Buscando histórico do entregador:', phone);
  try {
    const activeOrders = await kv.getByPrefix('order:');
    const archivedOrders = await kv.getByPrefix('archive:');
    const allOrders = [...activeOrders, ...archivedOrders];
    const history = allOrders.filter((o: any) => {
      const driverPhone = o.driver?.phone?.replace(/\D/g, '');
      const driverPhone2 = o.driverPhone?.replace(/\D/g, '');
      return (driverPhone === phone || driverPhone2 === phone) && o.status === 'completed';
    });
    history.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return success(c, { history });
  } catch (e) {
    console.error('❌ [DELIVERYMAN] Erro ao buscar histórico:', e);
    return error(c, `Erro ao buscar histórico: ${e}`);
  }
});

// ==========================================
// 📍 SETORES DE ENTREGA
// ==========================================

router.get('/delivery/sectors', async (c) => {
  const sectors = await kv.getByPrefix('sector:');
  return success(c, { sectors });
});

router.post('/delivery/sectors', requireMaster, async (c) => {
  const body = await c.req.json();
  const id = body.id || `sector_${Date.now()}`;
  const sector: DeliverySector = { ...body, id };
  await kv.set(`sector:${id}`, sector);
  return success(c, { sector });
});

router.put('/delivery/sectors/:id', requireMaster, async (c) => {
  const id = c.req.param('id');
  try {
    const body = await c.req.json();
    const existing = await kv.get(`sector:${id}`);
    if (!existing) return error(c, 'Setor não encontrado', 404);
    const updated = { ...existing, ...body };
    await kv.set(`sector:${id}`, updated);
    return success(c, { sector: updated });
  } catch (e) {
    return error(c, `Erro ao atualizar setor: ${e}`);
  }
});

router.delete('/delivery/sectors/:id', requireMaster, async (c) => {
  const id = c.req.param('id');
  try {
    await kv.del(`sector:${id}`);
    return success(c, { message: 'Setor deletado com sucesso' });
  } catch (e) {
    return error(c, `Erro ao deletar setor: ${e}`);
  }
});

// ==========================================
// 💰 TAXA DE ENTREGA
// ==========================================

router.get('/settings/delivery-fee', async (c) => {
  try {
    const fee = await kv.get('delivery_fee') || 0;
    return success(c, { fee });
  } catch (e) {
    return error(c, `Erro ao buscar taxa de entrega: ${e}`);
  }
});

router.post('/settings/delivery-fee', requireAdmin, async (c) => {
  try {
    const { fee } = await c.req.json();
    await kv.set('delivery_fee', fee);
    return success(c, { fee });
  } catch (e) {
    return error(c, `Erro ao salvar taxa de entrega: ${e}`);
  }
});

export default router;