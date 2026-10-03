// ==========================================
// KV Store Retry Wrapper
// Wraps all kv_store functions with automatic retry on transient errors
// (TLS handshake EOF, connection reset, etc.)
// ==========================================

import * as kvOriginal from "./kv_store.tsx";
import { AsyncLocalStorage } from "node:async_hooks";

// Franquia: cada unidade é uma loja isolada; chaves fora de GLOBAIS ganham o prefixo unit:<id>:
const escopo = new AsyncLocalStorage<{ unidade: string | null }>();
const GLOBAIS = [
  'system_config', 'admin_password', 'admin_senha_unidade:', 'admin_session:', 'master_session:', 'driver_session:',
  'rate_limit:', 'ip_blacklist', 'ip_whitelist', 'ip_reputation:', 'audit_logs', 'security_alert', 'webhook_logs',
  'webhook_configs', 'test_run_history', 'e2e_test_history', 'mp_segredos', 'order_unit:', 'unit:',
];
export const comEscopo = <T>(unidade: string | null, fn: () => Promise<T>) => escopo.run({ unidade }, fn);
export const definirUnidade = (unidade: string | null) => { const e = escopo.getStore(); if (e) e.unidade = unidade; };
export const unidadeAtual = () => escopo.getStore()?.unidade || null;
const k = (key: string) => {
  const u = unidadeAtual();
  return u && !GLOBAIS.some((g) => key.startsWith(g)) ? `unit:${u}:${key}` : key;
};

const MAX_RETRIES = 4;
const BASE_DELAY_MS = 500; // 500ms base with jitter — 502/503 need longer delays

// Check if an error is transient and worth retrying
function isTransientError(err: unknown): boolean {
  if (!err) return false;
  const msg = String(err).toLowerCase();
  return (
    msg.includes('tls handshake') ||
    msg.includes('connection reset') ||
    msg.includes('connection refused') ||
    msg.includes('eof') ||
    msg.includes('broken pipe') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('socket hang up') ||
    msg.includes('fetch failed') ||
    msg.includes('error sending request') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('bad gateway') ||
    msg.includes('service unavailable') ||
    msg.includes('gateway timeout') ||
    msg.includes('internal server error') ||
    msg.includes('cloudflare')
  );
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES && isTransientError(err)) {
        const jitter = Math.random() * 200; // Random jitter 0-200ms to prevent thundering herd
        const delay = BASE_DELAY_MS * Math.pow(2, attempt) + jitter;
        console.warn(
          `⚠️ [KV_RETRY] ${label} falhou (tentativa ${attempt + 1}/${MAX_RETRIES + 1}), ` +
          `retentando em ${delay}ms: ${String(err).slice(0, 120)}`
        );
        await new Promise((r) => setTimeout(r, delay));
      } else {
        // Non-transient error or max retries reached — rethrow
        throw err;
      }
    }
  }
  throw lastError;
}

// Re-export all kv functions with retry logic

export async function get(key: string): Promise<any> {
  return withRetry(() => kvOriginal.get(k(key)), `get(${key})`);
}

export async function set(key: string, value: any): Promise<void> {
  return withRetry(() => kvOriginal.set(k(key), value), `set(${key})`);
}

export async function del(key: string): Promise<void> {
  return withRetry(() => kvOriginal.del(k(key)), `del(${key})`);
}

export async function mget(keys: string[]): Promise<any[]> {
  return withRetry(() => kvOriginal.mget(keys.map(k)), `mget(${keys.length} keys)`);
}

export async function mset(keys: string[], values: any[]): Promise<void> {
  return withRetry(() => kvOriginal.mset(keys.map(k), values), `mset(${keys.length} keys)`);
}

export async function mdel(keys: string[]): Promise<void> {
  return withRetry(() => kvOriginal.mdel(keys.map(k)), `mdel(${keys.length} keys)`);
}

export async function getByPrefix(prefix: string): Promise<any[]> {
  return withRetry(() => kvOriginal.getByPrefix(k(prefix)), `getByPrefix(${prefix})`);
}

export async function atomicStockDecrement(key: string, amount: number, updatedAt: string): Promise<any> {
  return withRetry(() => kvOriginal.atomicStockDecrement(k(key), amount, updatedAt), `atomicStockDecrement(${key}, ${amount})`);
}
export async function inserir(key: string, value: any): Promise<boolean> {
  return withRetry(() => kvOriginal.inserir(k(key), value), `inserir(${key})`);
}
