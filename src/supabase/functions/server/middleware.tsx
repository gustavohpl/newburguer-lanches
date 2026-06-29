// ==========================================
// 🛡️ MIDDLEWARE DE AUTENTICAÇÃO
// requireAdmin, requireMaster, requireDriver, requireAdminOrDriver
// ==========================================

import type { Context, Next } from "npm:hono";
import * as kv from "./kv_retry.tsx";
import { error } from "./server_utils.tsx";
import type { AdminSession, MasterSession, DriverSession, RateLimitRecord } from "./types.tsx";
import {
  RATE_LIMIT_MAX_ATTEMPTS,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_LOCKOUT_MS,
} from "./server_utils.tsx";

// ---- Rate Limiting ----

export async function checkRateLimit(route: string, ip: string): Promise<{ allowed: boolean; retryAfterSec?: number }> {
  const key = `rate_limit:${route}:${ip}`;
  const record = await kv.get(key) as RateLimitRecord | null;
  if (!record) return { allowed: true };

  if (record.lockedUntil) {
    const remaining = new Date(record.lockedUntil).getTime() - Date.now();
    if (remaining > 0) return { allowed: false, retryAfterSec: Math.ceil(remaining / 1000) };
    await kv.del(key);
    return { allowed: true };
  }

  if (Date.now() - new Date(record.windowStart).getTime() > RATE_LIMIT_WINDOW_MS) {
    await kv.del(key);
    return { allowed: true };
  }

  if (record.attempts >= RATE_LIMIT_MAX_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + RATE_LIMIT_LOCKOUT_MS).toISOString();
    await kv.set(key, { ...record, lockedUntil });
    return { allowed: false, retryAfterSec: Math.ceil(RATE_LIMIT_LOCKOUT_MS / 1000) };
  }

  return { allowed: true };
}

export async function recordFailedAttempt(route: string, ip: string): Promise<void> {
  const key = `rate_limit:${route}:${ip}`;
  const record = await kv.get(key) as RateLimitRecord | null;

  if (!record || Date.now() - new Date(record.windowStart || 0).getTime() > RATE_LIMIT_WINDOW_MS) {
    await kv.set(key, { _key: key, attempts: 1, windowStart: new Date().toISOString() });
    return;
  }

  const newAttempts = (record.attempts || 0) + 1;
  const update: RateLimitRecord & { _key: string } = { ...record, _key: key, attempts: newAttempts };

  if (newAttempts >= RATE_LIMIT_MAX_ATTEMPTS) {
    update.lockedUntil = new Date(Date.now() + RATE_LIMIT_LOCKOUT_MS).toISOString();
    console.warn(`🚫 [RATE LIMIT] IP ${ip} bloqueado na rota ${route} por ${RATE_LIMIT_LOCKOUT_MS / 1000}s após ${newAttempts} tentativas`);
  }

  await kv.set(key, update);
}

export async function clearRateLimit(route: string, ip: string): Promise<void> {
  await kv.del(`rate_limit:${route}:${ip}`);
}

// ---- Session Cleanup ----

let lastCleanupTime = 0;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export async function cleanupExpiredSessions(): Promise<number> {
  const now = Date.now();
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) return 0;
  lastCleanupTime = now;
  let cleaned = 0;
  const nowDate = new Date();
  console.log('🧹 [CLEANUP] Iniciando limpeza de sessões/rate-limits expirados...');
  try {
    const adminSessions = await kv.getByPrefix('admin_session:');
    for (const s of adminSessions) {
      if (s?.expiresAt && new Date(s.expiresAt) < nowDate && s._key) { await kv.del(s._key); cleaned++; }
    }
    const driverSessions = await kv.getByPrefix('driver_session:');
    for (const s of driverSessions) {
      if (s?.expiresAt && new Date(s.expiresAt) < nowDate && s._key) { await kv.del(s._key); cleaned++; }
    }
    const masterSessions = await kv.getByPrefix('master_session:');
    for (const s of masterSessions) {
      if (s?.expiresAt && new Date(s.expiresAt) < nowDate && s._key) { await kv.del(s._key); cleaned++; }
    }
    const rateLimits = await kv.getByPrefix('rate_limit:');
    for (const r of rateLimits) {
      const windowAge = now - new Date(r?.windowStart || 0).getTime();
      const lockExpired = !r?.lockedUntil || new Date(r.lockedUntil).getTime() < now;
      if (windowAge > RATE_LIMIT_WINDOW_MS * 2 && lockExpired && r._key) { await kv.del(r._key); cleaned++; }
    }
    if (cleaned > 0) console.log(`🧹 [CLEANUP] ${cleaned} entradas expiradas deletadas`);
  } catch (e) {
    console.error('⚠️ [CLEANUP] Erro:', e);
  }
  return cleaned;
}

/** Reseta o throttle de limpeza (usado pela rota master/cleanup-sessions) */
export function resetCleanupThrottle(): void {
  lastCleanupTime = 0;
}

// ---- Auth Middleware ----

export const requireAdmin = async (c: Context, next: Next) => {
  const token = c.req.header('X-Admin-Token');
  if (!token) {
    console.warn('⚠️ [AUTH] Requisição admin sem token:', c.req.method, c.req.url);
    return error(c, 'Autenticação necessária: token de admin não fornecido', 401);
  }

  const session = await kv.get(`admin_session:${token}`) as AdminSession | null;
  if (!session) {
    console.warn('⚠️ [AUTH] Token de admin inválido ou sessão não encontrada');
    return error(c, 'Sessão de admin inválida ou expirada. Faça login novamente.', 401);
  }

  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    await kv.del(`admin_session:${token}`);
    console.warn('⚠️ [AUTH] Sessão de admin expirada em', session.expiresAt);
    return error(c, 'Sessão de admin expirada. Faça login novamente.', 401);
  }

  // CSRF validation for mutation requests
  // Token CSRF é fixo durante a sessão (não rotaciona) para evitar
  // dessincronia em requisições simultâneas que deslogava o admin.
  if (['POST', 'PUT', 'DELETE'].includes(c.req.method)) {
    const csrfToken = c.req.header('X-CSRF-Token');
    if (session.csrfToken && csrfToken !== session.csrfToken) {
      console.warn('⚠️ [AUTH] Token CSRF inválido');
      return error(c, 'Token CSRF inválido. Faça login novamente.', 403);
    }
  }

  console.log('✅ [AUTH] Admin autenticado:', token.slice(0, 20) + '...');
  c.set('authType' as never, 'admin');
  await next();
};

export const requireMaster = async (c: Context, next: Next) => {
  const token = c.req.header('X-Master-Token');
  if (!token) {
    console.warn('⚠️ [AUTH] Requisição master sem token:', c.req.method, c.req.url);
    return error(c, 'Autenticação necessária: token master não fornecido', 401);
  }

  const session = await kv.get(`master_session:${token}`) as MasterSession | null;
  if (!session) {
    console.warn('⚠️ [AUTH] Token master inválido ou sessão não encontrada');
    return error(c, 'Sessão master inválida ou expirada. Faça login novamente.', 401);
  }

  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    await kv.del(`master_session:${token}`);
    console.warn('⚠️ [AUTH] Sessão master expirada em', session.expiresAt);
    return error(c, 'Sessão master expirada. Faça login novamente.', 401);
  }

  console.log('✅ [AUTH] Master autenticado:', token.slice(0, 20) + '...');
  await next();
};

export const requireDriver = async (c: Context, next: Next) => {
  const token = c.req.header('X-Driver-Token');
  if (!token) return error(c, 'Autenticação necessária: token de entregador não fornecido', 401);

  const session = await kv.get(`driver_session:${token}`) as DriverSession | null;
  if (!session) return error(c, 'Sessão de entregador inválida ou expirada. Faça login novamente.', 401);

  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    await kv.del(`driver_session:${token}`);
    return error(c, 'Sessão de entregador expirada. Faça login novamente.', 401);
  }

  c.set('authType' as never, 'driver');
  c.set('driverPhone' as never, session.phone);
  c.set('driverName' as never, session.name);
  await next();
};

export const requireAdminOrDriver = async (c: Context, next: Next) => {
  // Try admin first
  const adminToken = c.req.header('X-Admin-Token');
  if (adminToken) {
    const session = await kv.get(`admin_session:${adminToken}`) as AdminSession | null;
    if (session && (!session.expiresAt || new Date(session.expiresAt) > new Date())) {
      // CSRF for mutations (token fixo na sessão, não rotaciona)
      if (['POST', 'PUT', 'DELETE'].includes(c.req.method)) {
        const csrf = c.req.header('X-CSRF-Token');
        if (session.csrfToken && csrf !== session.csrfToken) {
          return error(c, 'Token CSRF inválido', 403);
        }
      }
      c.set('authType' as never, 'admin');
      await next();
      return;
    }
  }

  // Try driver
  const driverToken = c.req.header('X-Driver-Token');
  if (driverToken) {
    const session = await kv.get(`driver_session:${driverToken}`) as DriverSession | null;
    if (session && (!session.expiresAt || new Date(session.expiresAt) > new Date())) {
      c.set('authType' as never, 'driver');
      c.set('driverPhone' as never, session.phone);
      c.set('driverName' as never, session.name);
      await next();
      return;
    }
  }

  console.warn('⚠️ [AUTH] Requisição sem token válido (admin ou driver):', c.req.method, c.req.url);
  return error(c, 'Autenticação necessária (admin ou entregador)', 401);
};