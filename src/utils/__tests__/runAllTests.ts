// ==========================================
// 🧪 RUNNER AGREGADO — Executa todos os testes unitários do frontend
// Importável como: import { runAllFrontendTests } from './utils/__tests__/runAllTests'
// ==========================================

import { runColorUtilsTests } from './colorUtils.test';
import { runIngredientUtilsTests } from './ingredientUtils.test';
import { runI18nTests } from './i18n.test';

export interface TestSuiteResult {
  suite: string;
  passed: number;
  failed: number;
  total: number;
  results: Array<{ name: string; passed: boolean; error?: string }>;
}

export function runAllFrontendTests(): {
  suites: TestSuiteResult[];
  totalPassed: number;
  totalFailed: number;
  totalTests: number;
} {
  const colorResults = runColorUtilsTests();
  const ingredientResults = runIngredientUtilsTests();
  const i18nResults = runI18nTests();

  const suites: TestSuiteResult[] = [
    { suite: 'colorUtils', ...colorResults },
    { suite: 'ingredientUtils', ...ingredientResults },
    { suite: 'i18n', ...i18nResults },
  ];

  const totalPassed = suites.reduce((s, r) => s + r.passed, 0);
  const totalFailed = suites.reduce((s, r) => s + r.failed, 0);
  const totalTests = suites.reduce((s, r) => s + r.total, 0);

  return { suites, totalPassed, totalFailed, totalTests };
}