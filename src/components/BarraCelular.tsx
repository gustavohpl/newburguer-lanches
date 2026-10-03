import React, { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

type Item = { id: string; label: string; icon: React.ComponentType<{ className?: string }> };

// celular: abas embaixo como app (igual ao Engaja Aí); o que não cabe vai para "Mais"
export function BarraCelular({ itens, ativo, aoEscolher, cor, extras }: {
  itens: Item[];
  ativo: string;
  aoEscolher: (id: string) => void;
  cor: string;
  extras?: React.ReactNode;
}) {
  const [maisAberto, setMaisAberto] = useState(false);
  const cabem = itens.length <= 5 ? itens : itens.slice(0, 4);
  const resto = itens.length <= 5 ? [] : itens.slice(4);
  const noResto = resto.some((i) => i.id === ativo);
  const escolher = (id: string) => { aoEscolher(id); setMaisAberto(false); };
  const botao = (item: Item, ligado: boolean, onClick: () => void) => {
    const Icone = item.icon;
    return (
      <button key={item.id} onClick={onClick} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] leading-tight ${ligado ? 'font-semibold' : 'text-gray-400'}`} style={ligado ? { color: cor } : undefined}>
        <Icone className="h-6 w-6" />
        <span className="max-w-full truncate px-1">{item.label}</span>
      </button>
    );
  };
  return (
    <>
      {maisAberto && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMaisAberto(false)}>
          <div className="absolute inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] rounded-t-2xl bg-white p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-4 gap-1">
              {resto.map((item) => botao(item, item.id === ativo, () => escolher(item.id)))}
            </div>
            {extras && <div className="mt-2 border-t border-gray-100 pt-2">{extras}</div>}
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${cabem.length + (resto.length ? 1 : 0)}, minmax(0, 1fr))` }}>
          {cabem.map((item) => botao(item, item.id === ativo, () => escolher(item.id)))}
          {resto.length > 0 && botao({ id: 'mais', label: 'Mais', icon: MoreHorizontal }, noResto || maisAberto, () => setMaisAberto(!maisAberto))}
        </div>
      </nav>
    </>
  );
}
