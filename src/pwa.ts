import { useEffect, useState } from 'react';

type PedidoInstalar = Event & { prompt: () => Promise<void> };
let adiado: PedidoInstalar | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

export function iniciarPwa() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); adiado = e as PedidoInstalar; avisar(); });
  window.addEventListener('appinstalled', () => { adiado = null; avisar(); });
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
}

// null enquanto o Chrome não liberar a instalação (ou já instalado)
export function useInstalar() {
  const [pode, setPode] = useState(!!adiado);
  useEffect(() => {
    const f = () => setPode(!!adiado);
    ouvintes.add(f);
    f();
    return () => { ouvintes.delete(f); };
  }, []);
  if (!pode) return null;
  return async () => { const e = adiado; adiado = null; avisar(); await e?.prompt(); };
}
