// ==========================================
// 🧪 TESTES UNITÁRIOS — colorUtils
// hexToRgba, resolveColorToHex, darkenHex, TAILWIND_CLASS_TO_HEX
// ==========================================

import {
  hexToRgba,
  resolveColorToHex,
  darkenHex,
  TAILWIND_CLASS_TO_HEX,
} from '../colorUtils';

// ---- Test Runner Simples (sem dependências externas) ----

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, passed: true });
  } catch (e: unknown) {
    results.push({ name, passed: false, error: e instanceof Error ? e.message : String(e) });
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null but got ${JSON.stringify(actual)}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy but got ${JSON.stringify(actual)}`);
      }
    },
    toBeGreaterThan(n: number) {
      if (typeof actual !== 'number' || actual <= n) {
        throw new Error(`Expected ${actual} to be greater than ${n}`);
      }
    },
    toMatch(pattern: RegExp) {
      if (typeof actual !== 'string' || !pattern.test(actual)) {
        throw new Error(`Expected "${actual}" to match ${pattern}`);
      }
    },
  };
}

// ==========================================
// hexToRgba
// ==========================================

test('hexToRgba: converte #ff0000 alpha 1', () => {
  expect(hexToRgba('#ff0000', 1)).toBe('rgba(255, 0, 0, 1)');
});

test('hexToRgba: converte #00ff00 alpha 0.5', () => {
  expect(hexToRgba('#00ff00', 0.5)).toBe('rgba(0, 255, 0, 0.5)');
});

test('hexToRgba: converte sem hash', () => {
  expect(hexToRgba('0000ff', 0.8)).toBe('rgba(0, 0, 255, 0.8)');
});

test('hexToRgba: preto com alpha 0', () => {
  expect(hexToRgba('#000000', 0)).toBe('rgba(0, 0, 0, 0)');
});

test('hexToRgba: branco com alpha 1', () => {
  expect(hexToRgba('#ffffff', 1)).toBe('rgba(255, 255, 255, 1)');
});

test('hexToRgba: cor intermediária #d97706', () => {
  expect(hexToRgba('#d97706', 0.3)).toBe('rgba(217, 119, 6, 0.3)');
});

// ==========================================
// resolveColorToHex
// ==========================================

test('resolveColorToHex: retorna hex direto', () => {
  expect(resolveColorToHex('#ff5500')).toBe('#ff5500');
});

test('resolveColorToHex: resolve classe Tailwind amber', () => {
  expect(resolveColorToHex('bg-amber-600 hover:bg-amber-700')).toBe('#d97706');
});

test('resolveColorToHex: resolve classe Tailwind red', () => {
  expect(resolveColorToHex('bg-red-600 hover:bg-red-700')).toBe('#dc2626');
});

test('resolveColorToHex: resolve classe Tailwind blue', () => {
  expect(resolveColorToHex('bg-blue-600 hover:bg-blue-700')).toBe('#2563eb');
});

test('resolveColorToHex: resolve classe Tailwind green', () => {
  expect(resolveColorToHex('bg-green-600 hover:bg-green-700')).toBe('#16a34a');
});

test('resolveColorToHex: resolve classe Tailwind purple', () => {
  expect(resolveColorToHex('bg-purple-600 hover:bg-purple-700')).toBe('#9333ea');
});

test('resolveColorToHex: resolve classe Tailwind black', () => {
  expect(resolveColorToHex('bg-black hover:bg-gray-900')).toBe('#000000');
});

test('resolveColorToHex: retorna null para classe desconhecida', () => {
  expect(resolveColorToHex('bg-nonexistent-999')).toBeNull();
});

test('resolveColorToHex: retorna null para undefined', () => {
  expect(resolveColorToHex(undefined)).toBeNull();
});

test('resolveColorToHex: retorna null para string vazia', () => {
  expect(resolveColorToHex('')).toBeNull();
});

// ==========================================
// darkenHex
// ==========================================

test('darkenHex: escurece #ffffff em 15% -> ~#d9d9d9', () => {
  const result = darkenHex('#ffffff', 0.15);
  expect(result).toBe('#d9d9d9');
});

test('darkenHex: escurece #ff0000 em 15% -> #d90000', () => {
  const result = darkenHex('#ff0000', 0.15);
  expect(result).toBe('#d90000');
});

test('darkenHex: escurece #000000 em 50% -> #000000 (preto permanece preto)', () => {
  const result = darkenHex('#000000', 0.50);
  expect(result).toBe('#000000');
});

test('darkenHex: escurece #d97706 (amber) em 15%', () => {
  const result = darkenHex('#d97706', 0.15);
  // r=217*0.85=184.45≈184=b8, g=119*0.85=101.15≈101=65, b=6*0.85=5.1≈5=05
  expect(result).toBe('#b86505');
});

test('darkenHex: retorna formato hex válido', () => {
  const result = darkenHex('#abcdef', 0.2);
  expect(result).toMatch(/^#[0-9a-f]{6}$/);
});

test('darkenHex: amount 0 não muda a cor', () => {
  const result = darkenHex('#abcdef', 0);
  expect(result).toBe('#abcdef');
});

test('darkenHex: amount 1 gera preto', () => {
  const result = darkenHex('#abcdef', 1);
  expect(result).toBe('#000000');
});

// ==========================================
// TAILWIND_CLASS_TO_HEX completude
// ==========================================

test('TAILWIND_CLASS_TO_HEX: tem pelo menos 8 entradas', () => {
  expect(Object.keys(TAILWIND_CLASS_TO_HEX).length).toBeGreaterThan(7);
});

test('TAILWIND_CLASS_TO_HEX: todos os valores são hex válidos', () => {
  for (const [cls, hex] of Object.entries(TAILWIND_CLASS_TO_HEX)) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) {
      throw new Error(`Classe "${cls}" tem valor hex inválido: "${hex}"`);
    }
  }
});

// ==========================================
// Exportar resultados
// ==========================================

export function runColorUtilsTests(): { results: TestResult[]; passed: number; failed: number; total: number } {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  return { results, passed, failed, total: results.length };
}

export type { TestResult };
