// ==========================================
// KV Store Retry Wrapper
// Wraps all kv_store functions with automatic retry on transient errors
// (TLS handshake EOF, connection reset, etc.)
// ==========================================

import * as kvOriginal from "./kv_store.tsx";

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
  return withRetry(() => kvOriginal.get(key), `get(${key})`);
}

export async function set(key: string, value: any): Promise<void> {
  return withRetry(() => kvOriginal.set(key, value), `set(${key})`);
}

export async function del(key: string): Promise<void> {
  return withRetry(() => kvOriginal.del(key), `del(${key})`);
}

export async function mget(keys: string[]): Promise<any[]> {
  return withRetry(() => kvOriginal.mget(keys), `mget(${keys.length} keys)`);
}

export async function mset(keys: string[], values: any[]): Promise<void> {
  return withRetry(() => kvOriginal.mset(keys, values), `mset(${keys.length} keys)`);
}

export async function mdel(keys: string[]): Promise<void> {
  return withRetry(() => kvOriginal.mdel(keys), `mdel(${keys.length} keys)`);
}

export async function getByPrefix(prefix: string): Promise<any[]> {
  return withRetry(() => kvOriginal.getByPrefix(prefix), `getByPrefix(${prefix})`);
}

export async function atomicStockDecrement(key: string, amount: number, updatedAt: string): Promise<any> {
  return withRetry(() => kvOriginal.atomicStockDecrement(key, amount, updatedAt), `atomicStockDecrement(${key}, ${amount})`);
}