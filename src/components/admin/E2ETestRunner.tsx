import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Play, CheckCircle2, XCircle, Clock, Loader2, Package, ShoppingCart,
  ChevronDown, ChevronRight, Copy, Check, Truck, CreditCard, Banknote,
  QrCode, UtensilsCrossed, MapPin, Store, History, TrendingUp,
  TrendingDown, Minus, RotateCcw, Download, Sparkles, Tag,
  Star, Search, XOctagon, Warehouse, FolderOpen, Settings, ShieldCheck
} from 'lucide-react';
import { masterFetch } from '../../utils/api';

interface E2ETestResult {
  name: string;
  category: string;
  passed: boolean;
  error?: string;
  durationMs: number;
  steps?: string[];
}

interface E2ESummary {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
}

interface E2ERun {
  id: string;
  timestamp: string;
  summary: E2ESummary;
  results: E2ETestResult[];
}

// Categorias visuais
const CATEGORIES = [
  { id: 'Produto', icon: Package, color: 'blue', emoji: '📦' },
  { id: 'Estoque', icon: Warehouse, color: 'orange', emoji: '📦' },
  { id: 'Cupom', icon: Tag, color: 'purple', emoji: '🎫' },
  { id: 'Fluxo Pedido', icon: ShoppingCart, color: 'emerald', emoji: '🛒' },
  { id: 'Busca', icon: Search, color: 'cyan', emoji: '🔍' },
  { id: 'Cancelamento', icon: XOctagon, color: 'red', emoji: '❌' },
  { id: 'Avaliação', icon: Star, color: 'amber', emoji: '⭐' },
  { id: 'Entregador', icon: Truck, color: 'teal', emoji: '🏍️' },
  { id: 'Categorias', icon: FolderOpen, color: 'indigo', emoji: '📂' },
  { id: 'Config', icon: Settings, color: 'gray', emoji: '⚙️' },
  { id: 'Validação', icon: ShieldCheck, color: 'pink', emoji: '✅' },
] as const;

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string; badgeFail: string }> = {
  blue:    { bg: 'bg-blue-50 dark:bg-blue-900/20',    border: 'border-blue-200 dark:border-blue-800',    text: 'text-blue-700 dark:text-blue-300',    badge: 'bg-blue-100 text-blue-700',       badgeFail: 'bg-red-100 text-red-700' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-100 text-emerald-700', badgeFail: 'bg-red-100 text-red-700' },
  purple:  { bg: 'bg-purple-50 dark:bg-purple-900/20',  border: 'border-purple-200 dark:border-purple-800',  text: 'text-purple-700 dark:text-purple-300',  badge: 'bg-purple-100 text-purple-700',   badgeFail: 'bg-red-100 text-red-700' },
  red:     { bg: 'bg-red-50 dark:bg-red-900/20',     border: 'border-red-200 dark:border-red-800',     text: 'text-red-700 dark:text-red-300',     badge: 'bg-red-100 text-red-700',         badgeFail: 'bg-red-200 text-red-800' },
  amber:   { bg: 'bg-amber-50 dark:bg-amber-900/20',   border: 'border-amber-200 dark:border-amber-800',   text: 'text-amber-700 dark:text-amber-300',   badge: 'bg-amber-100 text-amber-700',     badgeFail: 'bg-red-100 text-red-700' },
  cyan:    { bg: 'bg-cyan-50 dark:bg-cyan-900/20',    border: 'border-cyan-200 dark:border-cyan-800',    text: 'text-cyan-700 dark:text-cyan-300',    badge: 'bg-cyan-100 text-cyan-700',       badgeFail: 'bg-red-100 text-red-700' },
  orange:  { bg: 'bg-orange-50 dark:bg-orange-900/20',  border: 'border-orange-200 dark:border-orange-800',  text: 'text-orange-700 dark:text-orange-300',  badge: 'bg-orange-100 text-orange-700',   badgeFail: 'bg-red-100 text-red-700' },
  teal:    { bg: 'bg-teal-50 dark:bg-teal-900/20',    border: 'border-teal-200 dark:border-teal-800',    text: 'text-teal-700 dark:text-teal-300',    badge: 'bg-teal-100 text-teal-700',       badgeFail: 'bg-red-100 text-red-700' },
  indigo:  { bg: 'bg-indigo-50 dark:bg-indigo-900/20',  border: 'border-indigo-200 dark:border-indigo-800',  text: 'text-indigo-700 dark:text-indigo-300',  badge: 'bg-indigo-100 text-indigo-700',   badgeFail: 'bg-red-100 text-red-700' },
  gray:    { bg: 'bg-gray-50 dark:bg-gray-800/30',    border: 'border-gray-200 dark:border-gray-700',    text: 'text-gray-700 dark:text-gray-300',    badge: 'bg-gray-100 text-gray-700',       badgeFail: 'bg-red-100 text-red-700' },
  pink:    { bg: 'bg-pink-50 dark:bg-pink-900/20',    border: 'border-pink-200 dark:border-pink-800',    text: 'text-pink-700 dark:text-pink-300',    badge: 'bg-pink-100 text-pink-700',       badgeFail: 'bg-red-100 text-red-700' },
};

function getCategoryMeta(catId: string) {
  return CATEGORIES.find(c => c.id === catId) || { id: catId, icon: Package, color: 'gray', emoji: '📋' };
}

// Payment + delivery icons
function getPaymentIcon(label: string) {
  if (label.includes('PIX')) return QrCode;
  if (label.includes('Cartão')) return CreditCard;
  return Banknote;
}
function getDeliveryIcon(label: string) {
  if (label.includes('Entrega')) return Truck;
  if (label.includes('Retirada')) return Store;
  return UtensilsCrossed;
}

export function E2ETestRunner() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<E2ETestResult[] | null>(null);
  const [summary, setSummary] = useState<E2ESummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<E2ERun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await masterFetch('/master/e2e-tests/history');
      const data = await res.json();
      if (data.success && data.runs) setHistory(data.runs);
    } catch (e) { console.error('Erro ao carregar histórico E2E:', e); }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const runTests = async () => {
    setRunning(true); setResults(null); setSummary(null); setError(null);
    setProgress(0); setCollapsed(new Set()); setExpandedTests(new Set()); setShowCelebration(false);

    const progressInterval = setInterval(() => {
      setProgress(prev => prev >= 92 ? prev : prev + Math.random() * 4);
    }, 400);

    try {
      const res = await masterFetch('/master/e2e-tests/run', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setResults(data.results); setSummary(data.summary); setProgress(100);
        if (data.summary?.failed === 0) {
          setShowCelebration(true);
          setTimeout(() => setShowCelebration(false), 4000);
        }
        setTimeout(loadHistory, 500);
      } else {
        setError(data.error || 'Erro desconhecido');
      }
    } catch (e: any) {
      setError(e?.message || 'Erro de conexão');
    } finally {
      clearInterval(progressInterval); setProgress(100);
      setTimeout(() => setRunning(false), 300);
    }
  };

  const toggleCategory = (catId: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  };

  const toggleTestExpand = (testName: string) => {
    setExpandedTests(prev => {
      const next = new Set(prev);
      if (next.has(testName)) next.delete(testName); else next.add(testName);
      return next;
    });
  };

  const grouped = useMemo(() => {
    if (!results) return [];
    const catMap = new Map<string, E2ETestResult[]>();
    for (const r of results) {
      if (!catMap.has(r.category)) catMap.set(r.category, []);
      catMap.get(r.category)!.push(r);
    }
    const groups: { catId: string; tests: E2ETestResult[] }[] = [];
    // Ordem: Produto, Estoque, Cupom, Fluxo Pedido, Busca, Cancelamento, Avaliação, Entregador, Categorias, Config, Validação
    for (const cat of CATEGORIES) {
      if (catMap.has(cat.id)) groups.push({ catId: cat.id, tests: catMap.get(cat.id)! });
    }
    // Qualquer categoria extra
    for (const [k, v] of catMap.entries()) {
      if (!CATEGORIES.find(c => c.id === k)) groups.push({ catId: k, tests: v });
    }
    return groups;
  }, [results]);

  const copyResults = async () => {
    if (!results || !summary) return;
    const lines = [
      `=== E2E Flow Tests (${new Date().toLocaleDateString('pt-BR')}) ===`,
      `Total: ${summary.total} | Passou: ${summary.passed} | Falhou: ${summary?.failed} | Tempo: ${summary.durationMs}ms`,
      '', ...results.map(r =>
        `${r.passed ? 'PASS' : 'FAIL'} [${r.category}] ${r.name} (${r.durationMs}ms)${r.error ? ` | ${r.error}` : ''}`
      )
    ];
    try { await navigator.clipboard.writeText(lines.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  const exportJSON = () => {
    if (!results || !summary) return;
    const blob = new Blob([JSON.stringify({ summary, results, timestamp: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `e2e-tests-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const passRate = summary ? Math.round((summary.passed / summary.total) * 100) : 0;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Celebration */}
      {showCelebration && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="animate-bounce">
            <div className="bg-emerald-500 text-white rounded-2xl px-8 py-4 shadow-2xl flex items-center gap-3">
              <Sparkles className="w-6 h-6" />
              <span className="text-xl font-bold">Todos os fluxos E2E passaram!</span>
              <Sparkles className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-emerald-600" />
            Testes E2E — Fluxos Completos
          </h2>
        </div>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          Testa todos os fluxos do delivery: 3 pagamentos (PIX, Cartão, Dinheiro) &times; 3 tipos (Entrega, Retirada, No Local) = 9 cenários completos + estoque, cupons, cancelamento, avaliação, entregador e validações.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={runTests}
          disabled={running}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          {running ? (
            <><Loader2 className="w-5 h-5 animate-spin" />Executando E2E...</>
          ) : (
            <><Play className="w-5 h-5" />Executar Todos os Fluxos</>
          )}
        </button>

        {results && (
          <div className="flex items-center gap-1 ml-auto">
            <button onClick={copyResults} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all cursor-pointer" title="Copiar">
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button onClick={exportJSON} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all cursor-pointer" title="Exportar JSON">
              <Download className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs transition-all cursor-pointer ${showHistory ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-700'}`} title="Histórico">
              <History className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Progress */}
      {running && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Simulando fluxos completos do delivery...
            </span>
            <span className="text-xs text-gray-400 font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 rounded-full transition-all duration-300 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300">
          <p className="font-semibold flex items-center gap-2"><XCircle className="w-4 h-4" />Erro ao executar E2E</p>
          <p className="text-sm mt-1">{error}</p>
          <button onClick={runTests} className="mt-3 flex items-center gap-1.5 text-xs font-medium bg-red-100 hover:bg-red-200 dark:bg-red-900/30 px-3 py-1.5 rounded-lg transition-all cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" />Tentar novamente
          </button>
        </div>
      )}

      {/* History */}
      {showHistory && (
        <div className="mb-6 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <History className="w-4 h-4" />Histórico E2E
            </h3>
            {historyLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhuma execução anterior</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {[...history].reverse().map((run, i) => {
                const prev = history.length > 1 ? [...history].reverse()[i + 1] : undefined;
                const allPassed = run.summary?.failed === 0;
                const diff = prev ? run.summary.passed - prev.summary.passed : 0;
                return (
                  <div key={run.id} className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-xs ${allPassed ? 'bg-green-50/50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50/50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                    <div className="flex items-center gap-2">
                      {allPassed ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                      <span className="text-gray-600 dark:text-gray-400 font-mono">
                        {new Date(run.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${allPassed ? 'text-green-600' : 'text-red-600'}`}>
                        {run.summary.passed}/{run.summary.total}
                      </span>
                      <span className="text-gray-400 font-mono">{run.summary.durationMs}ms</span>
                      {diff !== 0 && (
                        <span className={`flex items-center gap-0.5 ${diff > 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          <span className="text-[10px] font-bold">{diff > 0 ? `+${diff}` : diff}</span>
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
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-3.5 text-center">
            <div className="text-2xl font-bold text-gray-800 dark:text-white">{summary.total}</div>
            <div className="text-[11px] text-gray-500 font-medium">Total</div>
          </div>
          <div className={`border rounded-xl p-3.5 text-center ${summary.passed === summary.total ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 ring-2 ring-green-200 dark:ring-green-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'}`}>
            <div className="text-2xl font-bold text-green-600">{summary.passed}</div>
            <div className="text-[11px] text-green-600 font-medium">Passaram</div>
          </div>
          <div className={`border rounded-xl p-3.5 text-center ${summary?.failed > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700'}`}>
            <div className={`text-2xl font-bold ${summary?.failed > 0 ? 'text-red-600' : 'text-gray-400'}`}>{summary?.failed}</div>
            <div className={`text-[11px] font-medium ${summary?.failed > 0 ? 'text-red-600' : 'text-gray-400'}`}>Falharam</div>
          </div>
          <div className={`border rounded-xl p-3.5 text-center ${passRate === 100 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700' : passRate >= 80 ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
            <div className={`text-2xl font-bold ${passRate === 100 ? 'text-emerald-600' : passRate >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>{passRate}%</div>
            <div className="text-[11px] text-gray-500 font-medium">{summary.durationMs}ms</div>
          </div>
        </div>
      )}

      {/* Category badges */}
      {summary && grouped.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {grouped.map(g => {
            const meta = getCategoryMeta(g.catId);
            const colors = COLOR_MAP[meta.color] || COLOR_MAP.gray;
            const passed = g.tests.filter(t => t.passed).length;
            const failed = g.tests.filter(t => !t.passed).length;
            const allOk = failed === 0;
            return (
              <button
                key={g.catId}
                onClick={() => {
                  const el = document.getElementById(`e2e-cat-${g.catId}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer hover:shadow-sm ${allOk ? `${colors.bg} ${colors.border} ${colors.text}` : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'}`}
              >
                <meta.icon className="w-3.5 h-3.5" />
                {meta.id}
                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${allOk ? colors.badge : colors.badgeFail}`}>
                  {passed}/{g.tests.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Results */}
      {results && grouped.map(g => {
        const meta = getCategoryMeta(g.catId);
        const colors = COLOR_MAP[meta.color] || COLOR_MAP.gray;
        const passed = g.tests.filter(t => t.passed).length;
        const isCatCollapsed = collapsed.has(g.catId);

        return (
          <div key={g.catId} id={`e2e-cat-${g.catId}`} className={`mb-4 border rounded-xl overflow-hidden ${colors.border}`}>
            {/* Category header */}
            <button
              onClick={() => toggleCategory(g.catId)}
              className={`w-full flex items-center justify-between px-4 py-3 ${colors.bg} cursor-pointer hover:opacity-90 transition-all`}
            >
              <div className="flex items-center gap-2">
                {isCatCollapsed ? <ChevronRight className={`w-4 h-4 ${colors.text}`} /> : <ChevronDown className={`w-4 h-4 ${colors.text}`} />}
                <meta.icon className={`w-4 h-4 ${colors.text}`} />
                <span className={`font-semibold text-sm ${colors.text}`}>{meta.id}</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${passed === g.tests.length ? colors.badge : colors.badgeFail}`}>
                  {passed}/{g.tests.length}
                </span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">
                {g.tests.reduce((s, t) => s + t.durationMs, 0)}ms
              </span>
            </button>

            {/* Tests */}
            {!isCatCollapsed && (
              <div className="divide-y divide-gray-100 dark:divide-zinc-700">
                {g.tests.map((test, i) => {
                  const isExpanded = expandedTests.has(test.name);
                  const isFlowTest = test.category === 'Fluxo Pedido';
                  
                  return (
                    <div key={i} className="px-4 py-2.5 bg-white dark:bg-zinc-900">
                      <div
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => test.steps && test.steps.length > 0 && toggleTestExpand(test.name)}
                      >
                        {test.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                        )}
                        
                        {/* Flow test icons */}
                        {isFlowTest && (
                          <div className="flex items-center gap-1 shrink-0">
                            {(() => {
                              const PayIcon = getPaymentIcon(test.name);
                              const DelIcon = getDeliveryIcon(test.name);
                              return (
                                <>
                                  <PayIcon className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="text-gray-300">+</span>
                                  <DelIcon className="w-3.5 h-3.5 text-gray-400" />
                                </>
                              );
                            })()}
                          </div>
                        )}
                        
                        <span className={`text-sm flex-1 ${test.passed ? 'text-gray-700 dark:text-gray-300' : 'text-red-600 dark:text-red-400 font-medium'}`}>
                          {test.name}
                        </span>
                        
                        <span className="text-[10px] text-gray-400 font-mono shrink-0">{test.durationMs}ms</span>
                        
                        {test.steps && test.steps.length > 0 && (
                          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        )}
                      </div>
                      
                      {/* Error */}
                      {!test.passed && test.error && (
                        <div className="mt-1.5 ml-6 text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md px-2.5 py-1.5 font-mono">
                          {test.error}
                        </div>
                      )}
                      
                      {/* Steps (expanded) */}
                      {isExpanded && test.steps && (
                        <div className="mt-2 ml-6 space-y-1">
                          {test.steps.map((step, si) => (
                            <div key={si} className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <span className="text-gray-300 dark:text-zinc-600 shrink-0 mt-0.5">
                                {si === test.steps!.length - 1 ? '└' : '├'}
                              </span>
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Flow Matrix Visual (when results available) */}
      {results && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">Matriz de Fluxos Testados</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium"></th>
                  {[{ icon: Truck, label: 'Entrega' }, { icon: Store, label: 'Retirada' }, { icon: UtensilsCrossed, label: 'No Local' }].map(d => (
                    <th key={d.label} className="text-center py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">
                      <div className="flex items-center justify-center gap-1">
                        <d.icon className="w-3.5 h-3.5" />{d.label}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[{ icon: QrCode, label: 'PIX' }, { icon: CreditCard, label: 'Cartão' }, { icon: Banknote, label: 'Dinheiro' }].map((p, pi) => (
                  <tr key={p.label}>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400 font-medium">
                      <div className="flex items-center gap-1.5">
                        <p.icon className="w-3.5 h-3.5" />{p.label}
                      </div>
                    </td>
                    {['Entrega', 'Retirada', 'No Local'].map((d, di) => {
                      const testIdx = pi * 3 + di + 1;
                      const test = results.find(r => r.name.includes(`#${testIdx}:`));
                      return (
                        <td key={d} className="py-2 px-3 text-center">
                          {test ? (
                            test.passed ? (
                              <span className="inline-flex items-center gap-1 text-green-600 font-bold">
                                <CheckCircle2 className="w-4 h-4" /> OK
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-600 font-bold">
                                <XCircle className="w-4 h-4" /> FAIL
                              </span>
                            )
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
