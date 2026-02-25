// ==========================================
// 🛠️ UTILITÁRIOS COMPARTILHADOS DO SERVIDOR
// Funções de sanitização, helpers de resposta, etc.
// ==========================================

import type { Context } from "npm:hono";
import * as kv from "./kv_retry.tsx";

// ---- Response Helpers ----

export const success = (c: Context, data: Record<string, unknown>) =>
  c.json({ success: true, ...data });

export const error = (c: Context, msg: string, status = 400) =>
  c.json({ success: false, error: msg }, status as 400);

// ---- Sanitização de Inputs (XSS Prevention) ----

export function stripTags(str: string): string {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '');
}

export function stripDangerousPatterns(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/expression\s*\(/gi, '');
}

export function sanitizeText(str: string, maxLen = 500): string {
  if (typeof str !== 'string') return '';
  let c = stripTags(str);
  c = stripDangerousPatterns(c);
  c = c.trim();
  return maxLen > 0 && c.length > maxLen ? c.slice(0, maxLen) : c;
}

export function sanitizeName(str: string, maxLen = 100): string {
  if (typeof str !== 'string') return '';
  let c = stripTags(str);
  c = stripDangerousPatterns(c);
  c = c.replace(/[^\p{L}\p{N}\s.\-']/gu, '').trim();
  return maxLen > 0 && c.length > maxLen ? c.slice(0, maxLen) : c;
}

export function sanitizePhone(str: string): string {
  if (typeof str !== 'string') return '';
  return str.replace(/[^\d\s()\-+]/g, '').trim().slice(0, 20);
}

export function sanitizeObjectDeep(obj: unknown, maxDepth = 5): unknown {
  if (maxDepth <= 0 || !obj || typeof obj !== 'object') return obj;
  const result: Record<string, unknown> = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof v === 'string') {
      result[k] = sanitizeText(v);
    } else if (Array.isArray(v)) {
      result[k] = v.map((item: unknown) => {
        if (typeof item === 'string') return sanitizeText(item);
        if (typeof item === 'object' && item !== null) return sanitizeObjectDeep(item, maxDepth - 1);
        return item;
      });
    } else if (typeof v === 'object' && v !== null) {
      result[k] = sanitizeObjectDeep(v, maxDepth - 1);
    } else {
      result[k] = v;
    }
  }
  return result;
}

export function sanitizeReviews(reviews: unknown[]): Array<{ productId: string; productName: string; rating: number; comment: string }> | null {
  if (!Array.isArray(reviews)) return null;
  if (reviews.length === 0 || reviews.length > 50) return null;
  return reviews.map((r: Record<string, unknown>) => ({
    productId: typeof r.productId === 'string' ? sanitizeText(r.productId, 100) : '',
    productName: typeof r.productName === 'string' ? sanitizeText(r.productName, 200) : '',
    rating: typeof r.rating === 'number' ? Math.max(1, Math.min(5, Math.round(r.rating))) : 5,
    comment: typeof r.comment === 'string' ? sanitizeText(r.comment, 500) : '',
  })).filter(r => r.productId);
}

// ---- Helpers ----

export function getClientIp(c: Context): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('x-real-ip')
    || 'unknown';
}

// ---- Constants ----

export const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas
export const DRIVER_SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 horas

export const RATE_LIMIT_MAX_ATTEMPTS = 5;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;  // 15 minutos
export const RATE_LIMIT_LOCKOUT_MS = 15 * 60 * 1000;  // 15 minutos de bloqueio

export const DELIVERY_RATE_LIMIT_MAX = 10;
export const DELIVERY_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

// ---- Audit Log ----

/** Gravar audit log no KV (usado por writeAuditLogWithGeo e rotas de auditoria) */
export async function writeAuditLog(params: {
  action: string;
  username: string;
  ip: string;
  details: string;
  status: 'success' | 'failure';
  userAgent?: string;
  geo?: unknown;
  realIp?: string | null;
  realGeo?: unknown;
  browserInfo?: unknown;
  timezoneMismatch?: boolean;
  languageMismatch?: boolean;
  mismatchDetails?: string;
  whitelisted?: boolean;
}): Promise<Record<string, unknown> | null> {
  try {
    const logs: Array<Record<string, unknown>> = await kv.get('audit_logs') || [];

    const newLog: Record<string, unknown> = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      action: params.action,
      username: params.username,
      ip: params.ip,
      details: params.details,
      status: params.status,
      userAgent: params.userAgent || 'unknown',
      geo: params.geo || null,
      timestamp: new Date().toISOString()
    };

    if (params.whitelisted) newLog.whitelisted = true;

    if (params.realIp && params.realIp !== params.ip) {
      newLog.realIp = params.realIp;
      newLog.realGeo = params.realGeo || null;
      newLog.webrtcLeak = true;
      console.log(`🔓 [WEBRTC LEAK] IP real detectado: ${params.realIp} (IP visível: ${params.ip})`);
    }

    if (params.browserInfo) newLog.browserInfo = params.browserInfo;
    if (params.timezoneMismatch) newLog.timezoneMismatch = true;
    if (params.languageMismatch) newLog.languageMismatch = true;
    if (params.mismatchDetails) newLog.mismatchDetails = params.mismatchDetails;

    logs.push(newLog);
    const trimmedLogs = logs.slice(-1000);
    await kv.set('audit_logs', trimmedLogs);

    const mismatchTag = (params.timezoneMismatch || params.languageMismatch) ? ' | MISMATCH' : '';
    const whitelistTag = params.whitelisted ? ' | ✅ WHITELISTED' : '';
    console.log(`📋 [AUDIT] ${params.action} | ${params.username} | IP: ${params.ip}${newLog.realIp ? ` | IP Real: ${newLog.realIp}` : ''}${mismatchTag}${whitelistTag} | ${params.status}`);
    return newLog;
  } catch (e) {
    console.error('❌ [AUDIT] Erro ao gravar log:', e);
    return null;
  }
}

// ---- Helpers de Data/Hora (Fuso Horário Brasília) ----

/** Obter data/hora de Brasília como ISO string */
export function getBrasiliaISOString(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts: Record<string, string> = {};
  formatter.formatToParts(now).forEach(({ type, value }) => { parts[type] = value; });
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}-03:00`;
}

/** Obter início do "dia operacional" (4h da manhã em Brasília) */
export function getBusinessDayStart(): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: false,
  });
  const parts: Record<string, string> = {};
  formatter.formatToParts(now).forEach(({ type, value }) => { parts[type] = value; });

  const brasiliaHour = parseInt(parts.hour);
  const brasiliaDate = new Date(
    parseInt(parts.year),
    parseInt(parts.month) - 1,
    parseInt(parts.day),
    4, 0, 0, 0
  );

  // Se antes das 4h, o dia operacional começou ontem às 4h
  if (brasiliaHour < 4) {
    brasiliaDate.setDate(brasiliaDate.getDate() - 1);
  }

  return brasiliaDate;
}