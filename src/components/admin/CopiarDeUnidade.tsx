import React, { useState } from 'react';
import { Copy, X } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '../../utils/api';
import { useFranchise } from '../../FranchiseContext';

const PARTES = [['produtos', 'Produtos'], ['categorias', 'Categorias'], ['estoque', 'Estoque (ingredientes)']] as const;

// franquia: traz o cadastro de outra unidade da mesma cidade; depois de copiado, a unidade edita à vontade
export function CopiarDeUnidade({ onCopiado }: { onCopiado: () => void }) {
  const { franchiseEnabled, selectedCity, selectedUnit } = useFranchise();
  const [aberto, setAberto] = useState(false);
  const [de, setDe] = useState('');
  const [partes, setPartes] = useState<string[]>(PARTES.map(([p]) => p));
  const [copiando, setCopiando] = useState(false);
  const outras = (selectedCity?.units || []).filter((u) => u.id !== selectedUnit?.id);
  if (!franchiseEnabled || !outras.length) return null;

  const copiar = async () => {
    if (!de || !partes.length) return;
    const nome = outras.find((u) => u.id === de)?.name;
    if (!confirm(`Copiar ${partes.join(', ')} da unidade ${nome}?\n\nItens com o mesmo cadastro serão substituídos; o resto desta unidade continua.`)) return;
    setCopiando(true);
    const r = await api.copiarDeUnidade(de, partes).catch(() => null);
    setCopiando(false);
    if (!r?.success) return toast.error(r?.error || 'Não foi possível copiar');
    toast.success(`Copiado: ${Object.entries(r.copiados || {}).map(([k, n]) => `${n} ${k}`).join(', ')}`);
    setAberto(false);
    onCopiado();
  };

  return (
    <>
      <button onClick={() => setAberto(true)} className="px-4 py-2 rounded-lg bg-white border text-gray-700 hover:bg-gray-50 flex items-center gap-2">
        <Copy className="w-4 h-4" />
        Copiar de outra unidade
      </button>
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAberto(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Copiar de outra unidade</h3>
              <button onClick={() => setAberto(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <select value={de} onChange={(e) => setDe(e.target.value)} className="mb-3 w-full rounded-lg border border-gray-300 p-2.5 text-sm">
              <option value="">Escolha a unidade de {selectedCity?.name}</option>
              {outras.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <div className="mb-4 space-y-2">
              {PARTES.map(([p, rotulo]) => (
                <label key={p} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={partes.includes(p)} onChange={() => setPartes(partes.includes(p) ? partes.filter((x) => x !== p) : [...partes, p])} className="h-4 w-4 accent-amber-600" />
                  {rotulo}
                </label>
              ))}
            </div>
            <button onClick={copiar} disabled={!de || !partes.length || copiando} className="w-full rounded-lg bg-amber-600 py-2.5 font-bold text-white hover:bg-amber-700 disabled:opacity-50">
              {copiando ? 'Copiando...' : 'Copiar'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
