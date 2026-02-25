import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Play, CheckCircle2, XCircle, Clock, Loader2, Shield, Database,
  Globe, Lock, ChevronDown, ChevronRight, Filter, Copy, Check,
  Zap, FileText, Fingerprint, AlertTriangle, ClipboardList,
  History, TrendingUp, TrendingDown, Minus, RotateCcw,
  ChevronsDown, ChevronsUp, Download, Sparkles, Wrench, Gauge,
  Crosshair, Bell, BarChart3
} from 'lucide-react';
import { adminFetch } from '../../utils/api';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
}

interface TestRun {
  id: string;
  timestamp: string;
  summary: TestSummary;
  results: TestResult[];
  version: string;
}

interface TestRunnerProps {
  fetchFn?: (endpoint: string, options?: RequestInit) => Promise<Response>;
  endpoint?: string;
  historyEndpoint?: string;
}

// Definicao das 11 categorias com metadados visuais
const CATEGORIES = [
  { id: 'Core',        label: 'Core',                 icon: Database,      color: 'blue',    prefix: 'Core:',        expectedCount: 14 },
  { id: 'Geo',         label: 'Precision Engine v4.1',  icon: Globe,         color: 'emerald', prefix: 'Geo:',         expectedCount: 15 },
  { id: 'Seguranca',   label: 'Seguranca',            icon: Shield,        color: 'purple',  prefix: 'Seguranca:',   expectedCount: 6 },
  { id: 'Blacklist',   label: 'Blacklist / Whitelist', icon: AlertTriangle, color: 'red',     prefix: 'Blacklist:',   expectedCount: 4 },
  { id: 'CSRF',        label: 'CSRF Avancado',        icon: Lock,          color: 'amber',   prefix: 'CSRF:',        expectedCount: 3 },
  { id: 'Audit',       label: 'Audit Logs',           icon: ClipboardList, color: 'cyan',     prefix: 'Audit:',       expectedCount: 3 },
  { id: 'Resiliencia', label: 'Resiliencia',          icon: Wrench,        color: 'orange',  prefix: 'Resiliencia:', expectedCount: 8 },
  { id: 'Perf',        label: 'Performance',          icon: Gauge,         color: 'pink',    prefix: 'Perf:',        expectedCount: 7 },
  { id: 'Reputation',  label: 'IP Reputation',        icon: Crosshair,     color: 'indigo',  prefix: 'Reputation:',  expectedCount: 7 },
  { id: 'Webhook',     label: 'Webhooks',             icon: Bell,          color: 'teal',    prefix: 'Webhook:',     expectedCount: 6 },
  { id: 'Analytics',   label: 'Analytics',            icon: BarChart3,     color: 'rose',    prefix: 'Analytics:',   expectedCount: 7 },
] as const;

type CategoryId = typeof CATEGORIES[number]['id'] | 'Outros';

function getTestCategory(name: string): CategoryId {
  for (const cat of CATEGORIES) {
    if (name.startsWith(cat.prefix)) return cat.id;
  }
  return 'Outros';
}

function getCategoryMeta(catId: CategoryId) {
  return CATEGORIES.find(c => c.id === catId) || {
    id: 'Outros', label: 'Outros', icon: FileText, color: 'gray', prefix: '', expectedCount: 0
  };
}

// Cores por categoria
const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string; badgeFail: string; ring: string }> = {
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700',       badgeFail: 'bg-red-100 text-red-700',   ring: 'ring-blue-500' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', badgeFail: 'bg-red-100 text-red-700',   ring: 'ring-emerald-500' },
  purple:  { bg: 'bg-purple-50',  border: 'border-purple-200',  text: 'text-purple-700',  badge: 'bg-purple-100 text-purple-700',   badgeFail: 'bg-red-100 text-red-700',   ring: 'ring-purple-500' },
  red:     { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     badge: 'bg-red-100 text-red-700',         badgeFail: 'bg-red-200 text-red-800',   ring: 'ring-red-500' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',     badgeFail: 'bg-red-100 text-red-700',   ring: 'ring-amber-500' },
  cyan:    { bg: 'bg-cyan-50',    border: 'border-cyan-200',    text: 'text-cyan-700',    badge: 'bg-cyan-100 text-cyan-700',       badgeFail: 'bg-red-100 text-red-700',   ring: 'ring-cyan-500' },
  orange:  { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',  badge: 'bg-orange-100 text-orange-700',   badgeFail: 'bg-red-100 text-red-700',   ring: 'ring-orange-500' },
  pink:    { bg: 'bg-pink-50',    border: 'border-pink-200',    text: 'text-pink-700',    badge: 'bg-pink-100 text-pink-700',       badgeFail: 'bg-red-100 text-red-700',   ring: 'ring-pink-500' },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-700',  badge: 'bg-indigo-100 text-indigo-700',   badgeFail: 'bg-red-100 text-red-700',   ring: 'ring-indigo-500' },
  teal:    { bg: 'bg-teal-50',    border: 'border-teal-200',    text: 'text-teal-700',    badge: 'bg-teal-100 text-teal-700',       badgeFail: 'bg-red-100 text-red-700',   ring: 'ring-teal-500' },
  rose:    { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700',    badge: 'bg-rose-100 text-rose-700',       badgeFail: 'bg-red-100 text-red-700',   ring: 'ring-rose-500' },
  gray:    { bg: 'bg-gray-50',    border: 'border-gray-200',    text: 'text-gray-700',    badge: 'bg-gray-100 text-gray-700',       badgeFail: 'bg-red-100 text-red-700',   ring: 'ring-gray-500' },
};

type FilterMode = 'all' | 'passed' | 'failed';

export function TestRunner({ fetchFn, endpoint, historyEndpoint }: TestRunnerProps = {}) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [summary, setSummary] = useState<TestSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterMode>('all');
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<TestRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [runVersion, setRunVersion] = useState<string>('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [previousRun, setPreviousRun] = useState<TestRun | null>(null);

  // Carregar historico
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const doFetch = fetchFn || adminFetch;
      const url = historyEndpoint || '/admin/tests/history';
      const response = await doFetch(url);
      const data = await response.json();
      if (data.success && data.runs) {
        setHistory(data.runs);
        if (data.runs.length > 0) {
          setPreviousRun(data.runs[data.runs.length - 1]);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar historico:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [fetchFn, historyEndpoint]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const runTests = async () => {
    setRunning(true);
    setResults(null);
    setSummary(null);
    setError(null);
    setProgress(0);
    setCollapsed(new Set());
    setShowCelebration(false);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 92) return prev;
        return prev + Math.random() * 6;
      });
    }, 250);

    try {
      const doFetch = fetchFn || adminFetch;
      const url = endpoint || '/admin/tests/run';
      const response = await doFetch(url, { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        setResults(data.results);
        setSummary(data.summary);
        setRunVersion(data.version || '');
        setProgress(100);

        // Celebracao se todos passaram
        if (data.summary?.failed === 0) {
          setShowCelebration(true);
          setTimeout(() => setShowCelebration(false), 4000);
        }

        // Recarregar historico
        setTimeout(loadHistory, 500);
      } else {
        setError(data.error || 'Erro desconhecido ao executar testes');
      }
    } catch (err) {
      console.error('Erro ao executar testes:', err);
      setError('Erro de conexao com o servidor');
    } finally {
      clearInterval(progressInterval);
      setProgress(100);
      setTimeout(() => setRunning(false), 300);
    }
  };

  const toggleCategory = (catId: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const collapseAll = () => {
    if (!results) return;
    const allCats = new Set(results.map(r => getTestCategory(r.name)));
    setCollapsed(allCats as Set<string>);
  };

  const expandAll = () => setCollapsed(new Set());

  // Copiar resultados para clipboard
  const copyResults = async () => {
    if (!results || !summary) return;
    const lines = [
      `=== Testes Automatizados v8 (${new Date().toLocaleDateString('pt-BR')}) ===`,
      `Total: ${summary.total} | Passou: ${summary.passed} | Falhou: ${summary?.failed} | Tempo: ${summary.durationMs}ms`,
      `Versao: ${runVersion}`,
      '',
      ...results.map(r =>
        `${r.passed ? 'PASS' : 'FAIL'} | ${r.name} (${r.durationMs}ms)${r.error ? ` | Erro: ${r.error}` : ''}`
      )
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = lines.join('\n');
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Exportar JSON
  const exportJSON = () => {
    if (!results || !summary) return;
    const blob = new Blob([JSON.stringify({ summary, results, version: runVersion, timestamp: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tests-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Agrupar resultados por categoria
  const grouped = useMemo(() => {
    if (!results) return [];
    const groups: { catId: CategoryId; tests: TestResult[] }[] = [];
    const catMap = new Map<CategoryId, TestResult[]>();
    for (const r of results) {
      const cat = getTestCategory(r.name);
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(r);
    }
    for (const cat of CATEGORIES) {
      if (catMap.has(cat.id)) groups.push({ catId: cat.id, tests: catMap.get(cat.id)! });
    }
    if (catMap.has('Outros')) groups.push({ catId: 'Outros', tests: catMap.get('Outros')! });
    return groups;
  }, [results]);

  // Filtrar resultados
  const filteredGroups = useMemo(() => {
    if (filter === 'all') return grouped;
    return grouped.map(g => ({
      ...g,
      tests: g.tests.filter(t => filter === 'passed' ? t.passed : !t.passed)
    })).filter(g => g.tests.length > 0);
  }, [grouped, filter]);

  // Detectar regressoes comparando com run anterior
  const regressions = useMemo(() => {
    if (!results || !previousRun?.results) return new Set<string>();
    const prevMap = new Map(previousRun.results.map(r => [r.name, r.passed]));
    const regSet = new Set<string>();
    for (const r of results) {
      if (!r.passed && prevMap.get(r.name) === true) {
        regSet.add(r.name);
      }
    }
    return regSet;
  }, [results, previousRun]);

  // Detectar testes novos (nao existiam no run anterior)
  const newTests = useMemo(() => {
    if (!results || !previousRun?.results) return new Set<string>();
    const prevNames = new Set(previousRun.results.map(r => r.name));
    const newSet = new Set<string>();
    for (const r of results) {
      if (!prevNames.has(r.name)) newSet.add(r.name);
    }
    return newSet;
  }, [results, previousRun]);

  // Limpar prefixo da categoria do nome
  const cleanTestName = (name: string) => {
    for (const cat of CATEGORIES) {
      if (name.startsWith(cat.prefix)) return name.slice(cat.prefix.length).trim();
    }
    return name;
  };

  // Trend badge por run
  const getTrendBadge = (run: TestRun, prevRun?: TestRun) => {
    if (!prevRun) return null;
    const diff = run.summary.passed - prevRun.summary.passed;
    if (diff > 0) return { icon: TrendingUp, color: 'text-green-500', text: `+${diff}` };
    if (diff < 0) return { icon: TrendingDown, color: 'text-red-500', text: `${diff}` };
    return { icon: Minus, color: 'text-gray-400', text: '=' };
  };

  const failedCount = summary?.failed || 0;
  const passRate = summary ? Math.round((summary.passed / summary.total) * 100) : 0;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Celebration Overlay */}
      {showCelebration && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="animate-bounce">
            <div className="bg-green-500 text-white rounded-2xl px-8 py-4 shadow-2xl flex items-center gap-3">
              <Sparkles className="w-6 h-6" />
              <span className="text-xl font-bold">80/80 - Todos os testes passaram!</span>
              <Sparkles className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Shield className="w-7 h-7 text-blue-600" />
            Testes Automatizados v8
          </h2>
          {runVersion && (
            <span className="text-[11px] font-mono bg-gray-100 text-gray-500 px-2.5 py-1 rounded-lg border border-gray-200">
              {runVersion}
            </span>
          )}
        </div>
        <p className="text-gray-500 mt-1 text-sm">
          80 testes em 11 categorias: Core, Precision Engine v4.1, Seguranca, Blacklist/Whitelist, CSRF, Audit, Resiliencia, Performance, IP Reputation, Webhooks e Analytics.
        </p>
      </div>

      {/* Actions Row */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={runTests}
          disabled={running}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          {running ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Executando...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Executar 80 Testes
            </>
          )}
        </button>

        {/* Filter Buttons */}
        {results && (
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setFilter('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${filter === 'all' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Filter className="w-3.5 h-3.5" />
              Todos
            </button>
            <button
              onClick={() => setFilter('passed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${filter === 'passed' ? 'bg-green-50 shadow-sm text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Passou
            </button>
            <button
              onClick={() => setFilter('failed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${filter === 'failed' ? 'bg-red-50 shadow-sm text-red-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <XCircle className="w-3.5 h-3.5" />
              Falhou{failedCount > 0 && ` (${failedCount})`}
            </button>
          </div>
        )}

        {/* Action Buttons */}
        {results && (
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={expandAll}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
              title="Expandir tudo"
            >
              <ChevronsDown className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={collapseAll}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
              title="Colapsar tudo"
            >
              <ChevronsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={copyResults}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
              title="Copiar resultados"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={exportJSON}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
              title="Exportar JSON"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs transition-all cursor-pointer ${showHistory ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              title="Historico de execucoes"
            >
              <History className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {running && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-blue-600 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Executando 80 testes em 11 categorias...
            </span>
            <span className="text-xs text-gray-400 font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 rounded-full transition-all duration-300 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <p className="font-semibold flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            Erro ao executar testes
          </p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={runTests}
            className="mt-3 flex items-center gap-1.5 text-xs font-medium bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* History Panel */}
      {showHistory && (
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
              <History className="w-4 h-4" />
              Historico de Execucoes
            </h3>
            {historyLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhuma execucao anterior registrada</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {[...history].reverse().map((run, i) => {
                const prevRun = history.length > 1 ? [...history].reverse()[i + 1] : undefined;
                const trend = getTrendBadge(run, prevRun);
                const allPassed = run.summary?.failed === 0;
                return (
                  <div
                    key={run.id}
                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-xs ${
                      allPassed ? 'bg-green-50/50 border-green-200' : 'bg-red-50/50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {allPassed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      )}
                      <span className="text-gray-600 font-mono">
                        {new Date(run.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${allPassed ? 'text-green-600' : 'text-red-600'}`}>
                        {run.summary.passed}/{run.summary.total}
                      </span>
                      <span className="text-gray-400 font-mono">{run.summary.durationMs}ms</span>
                      {trend && (
                        <span className={`flex items-center gap-0.5 ${trend.color}`}>
                          <trend.icon className="w-3 h-3" />
                          <span className="text-[10px] font-bold">{trend.text}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-bold text-gray-800">{summary.total}</div>
            <div className="text-[11px] text-gray-500 font-medium">Total</div>
          </div>
          <div className={`border rounded-xl p-3.5 text-center ${summary.passed === summary.total ? 'bg-green-50 border-green-300 ring-2 ring-green-200' : 'bg-green-50 border-green-200'}`}>
            <div className="text-2xl font-bold text-green-600">{summary.passed}</div>
            <div className="text-[11px] text-green-600 font-medium">Passaram</div>
          </div>
          <div className={`border rounded-xl p-3.5 text-center ${summary?.failed > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className={`text-2xl font-bold ${summary?.failed > 0 ? 'text-red-600' : 'text-gray-400'}`}>{summary?.failed}</div>
            <div className={`text-[11px] font-medium ${summary?.failed > 0 ? 'text-red-600' : 'text-gray-400'}`}>Falharam</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-bold text-blue-600">{summary.durationMs}<span className="text-sm">ms</span></div>
            <div className="text-[11px] text-blue-500 font-medium">Duracao</div>
          </div>
          <div className={`border rounded-xl p-3.5 text-center ${passRate === 100 ? 'bg-green-50 border-green-300' : passRate >= 90 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
            <div className={`text-2xl font-bold ${passRate === 100 ? 'text-green-600' : passRate >= 90 ? 'text-yellow-600' : 'text-red-600'}`}>{passRate}%</div>
            <div className="text-[11px] text-gray-500 font-medium">Taxa</div>
          </div>
        </div>
      )}

      {/* Regression Warning */}
      {regressions.size > 0 && (
        <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="font-semibold text-sm text-orange-700 flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4" />
            {regressions.size} Regressao{regressions.size > 1 ? 'es' : ''} Detectada{regressions.size > 1 ? 's' : ''}
          </p>
          <p className="text-xs text-orange-600">
            Estes testes passavam no run anterior mas falharam agora:
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {[...regressions].map(name => (
              <li key={name} className="text-xs text-orange-700 flex items-center gap-1.5">
                <XCircle className="w-3 h-3 shrink-0" />
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* New Tests Info */}
      {newTests.size > 0 && (
        <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <p className="font-semibold text-sm text-indigo-700 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            {newTests.size} teste{newTests.size > 1 ? 's' : ''} novo{newTests.size > 1 ? 's' : ''} nesta versao
          </p>
        </div>
      )}

      {/* Category Summary Badges */}
      {summary && grouped.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {grouped.map(g => {
            const meta = getCategoryMeta(g.catId);
            const colors = COLOR_MAP[meta.color] || COLOR_MAP.gray;
            const passed = g.tests.filter(t => t.passed).length;
            const failed = g.tests.filter(t => !t.passed).length;
            const allPassed = failed === 0;
            return (
              <button
                key={g.catId}
                onClick={() => {
                  const el = document.getElementById(`cat-${g.catId}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer hover:shadow-sm ${allPassed ? `${colors.bg} ${colors.border} ${colors.text}` : 'bg-red-50 border-red-200 text-red-700'}`}
              >
                <meta.icon className="w-3.5 h-3.5" />
                {meta.label}
                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${allPassed ? colors.badge : colors.badgeFail}`}>
                  {passed}/{g.tests.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Results by Category */}
      {results && filteredGroups.length > 0 && (
        <div className="space-y-4">
          {filteredGroups.map(g => {
            const meta = getCategoryMeta(g.catId);
            const colors = COLOR_MAP[meta.color] || COLOR_MAP.gray;
            const Icon = meta.icon;
            const isCollapsed = collapsed.has(g.catId);
            const passed = g.tests.filter(t => t.passed).length;
            const failed = g.tests.filter(t => !t.passed).length;
            const totalMs = g.tests.reduce((s, t) => s + t.durationMs, 0);
            const allPassed = failed === 0;
            const catRegressions = g.tests.filter(t => regressions.has(t.name)).length;
            const catNew = g.tests.filter(t => newTests.has(t.name)).length;

            return (
              <div key={g.catId} id={`cat-${g.catId}`} className="rounded-2xl border border-gray-200 overflow-hidden bg-white shadow-sm">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(g.catId)}
                  className={`w-full flex items-center gap-3 px-4 py-3 ${colors.bg} ${colors.border} border-b transition-all cursor-pointer hover:brightness-95`}
                >
                  <div className={`p-1.5 rounded-lg ${allPassed ? colors.badge : 'bg-red-100 text-red-600'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`font-bold text-sm ${colors.text}`}>{meta.label}</span>
                  <div className="flex items-center gap-2 ml-auto">
                    {catNew > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                        {catNew} NOVO{catNew > 1 ? 'S' : ''}
                      </span>
                    )}
                    {catRegressions > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                        {catRegressions} REG
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${allPassed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {passed}/{g.tests.length} OK
                    </span>
                    {failed > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        {failed} FAIL
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 font-mono">{totalMs}ms</span>
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Tests List */}
                {!isCollapsed && (
                  <div className="divide-y divide-gray-100">
                    {g.tests.map((result, index) => {
                      const isRegression = regressions.has(result.name);
                      const isNew = newTests.has(result.name);
                      return (
                        <div
                          key={`${g.catId}-${index}`}
                          className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                            isRegression
                              ? 'bg-orange-50/50 hover:bg-orange-50'
                              : result.passed
                                ? 'hover:bg-green-50/50'
                                : 'bg-red-50/30 hover:bg-red-50/60'
                          }`}
                        >
                          <div className={`p-1 rounded-md ${result.passed ? 'text-green-500' : 'text-red-500'}`}>
                            {result.passed ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`font-medium text-sm ${result.passed ? 'text-gray-700' : 'text-red-800'}`}>
                                {cleanTestName(result.name)}
                              </p>
                              {isNew && (
                                <span className="text-[9px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full uppercase">
                                  novo
                                </span>
                              )}
                              {isRegression && (
                                <span className="text-[9px] font-bold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full uppercase flex items-center gap-0.5">
                                  <TrendingDown className="w-2.5 h-2.5" />
                                  regressao
                                </span>
                              )}
                            </div>
                            {result.error && (
                              <p className="text-xs text-red-500 mt-0.5 break-words leading-tight" title={result.error}>
                                {result.error}
                              </p>
                            )}
                          </div>

                          {/* Timing bar */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden md:block">
                              <div
                                className={`h-full rounded-full ${
                                  result.durationMs < 50 ? 'bg-green-400' :
                                  result.durationMs < 200 ? 'bg-yellow-400' :
                                  result.durationMs < 500 ? 'bg-orange-400' : 'bg-red-400'
                                }`}
                                style={{ width: `${Math.min(100, (result.durationMs / Math.max(...g.tests.map(t => t.durationMs), 1)) * 100)}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-gray-400 font-mono w-12 text-right">
                              {result.durationMs}ms
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!results && !running && !error && (
        <div className="text-center py-16 text-gray-400">
          <div className="relative mx-auto w-20 h-20 mb-5">
            <Shield className="w-20 h-20 opacity-10 absolute inset-0" />
            <Zap className="w-8 h-8 opacity-20 absolute bottom-0 right-0" />
          </div>
          <p className="text-lg font-medium text-gray-500">Nenhum teste executado</p>
          <p className="text-sm mt-1">Clique no botao acima para executar a suite completa de 80 testes</p>
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            {CATEGORIES.map(cat => {
              const colors = COLOR_MAP[cat.color] || COLOR_MAP.gray;
              return (
                <span key={cat.id} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium ${colors.bg} ${colors.text} ${colors.border} border`}>
                  <cat.icon className="w-3 h-3" />
                  {cat.label}
                  <span className="text-[9px] opacity-60">({cat.expectedCount})</span>
                </span>
              );
            })}
          </div>
          {/* Show last run if available */}
          {previousRun && (
            <div className="mt-8 inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-xs text-gray-500">
              <History className="w-3.5 h-3.5" />
              Ultimo run: {new Date(previousRun.timestamp).toLocaleString('pt-BR')} -
              <span className={previousRun.summary?.failed === 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                {previousRun.summary.passed}/{previousRun.summary.total}
              </span>
              em {previousRun.summary.durationMs}ms
            </div>
          )}
        </div>
      )}
    </div>
  );
}