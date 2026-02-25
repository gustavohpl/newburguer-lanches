import React from 'react';
import { useConfig } from '../ConfigContext';

export function ThemeInjector() {
  const { config } = useConfig();

  // Se não tiver config ainda, não renderiza nada (ou usa default)
  if (!config.themeColor) return null;

  return (
    <style dangerouslySetInnerHTML={{ __html: `
      :root {
        /* As variáveis já são aplicadas pelo ConfigProvider via themeUtils */
        /* Aqui vamos sobrescrever as classes do Tailwind v4 se necessário */
      }
      
      /* Sobrescreve classes amber-* para usar nossas variáveis */
      
      .bg-amber-50 { background-color: var(--color-primary-50); }
      .bg-amber-100 { background-color: var(--color-primary-100); }
      .bg-amber-200 { background-color: var(--color-primary-200); }
      .bg-amber-300 { background-color: var(--color-primary-300); }
      .bg-amber-400 { background-color: var(--color-primary-400); }
      .bg-amber-500 { background-color: var(--color-primary-500); }
      .bg-amber-600 { background-color: var(--color-primary-600); }
      .bg-amber-700 { background-color: var(--color-primary-700); }
      .bg-amber-800 { background-color: var(--color-primary-800); }
      .bg-amber-900 { background-color: var(--color-primary-900); }
      .bg-amber-950 { background-color: var(--color-primary-950); }
      
      .text-amber-50 { color: var(--color-primary-50); }
      .text-amber-100 { color: var(--color-primary-100); }
      .text-amber-200 { color: var(--color-primary-200); }
      .text-amber-300 { color: var(--color-primary-300); }
      .text-amber-400 { color: var(--color-primary-400); }
      .text-amber-500 { color: var(--color-primary-500); }
      .text-amber-600 { color: var(--color-primary-600); }
      .text-amber-700 { color: var(--color-primary-700); }
      .text-amber-800 { color: var(--color-primary-800); }
      .text-amber-900 { color: var(--color-primary-900); }
      .text-amber-950 { color: var(--color-primary-950); }
      
      .border-amber-100 { border-color: var(--color-primary-100); }
      .border-amber-200 { border-color: var(--color-primary-200); }
      .border-amber-300 { border-color: var(--color-primary-300); }
      .border-amber-400 { border-color: var(--color-primary-400); }
      .border-amber-500 { border-color: var(--color-primary-500); }
      .border-amber-600 { border-color: var(--color-primary-600); }
      
      .ring-amber-500 { --tw-ring-color: var(--color-primary-500); }
      
      .from-amber-500 { --tw-gradient-from: var(--color-primary-500); }
      .to-amber-600 { --tw-gradient-to: var(--color-primary-600); }
      .from-amber-600 { --tw-gradient-from: var(--color-primary-600); }
      .to-amber-700 { --tw-gradient-to: var(--color-primary-700); }
      .to-amber-800 { --tw-gradient-to: var(--color-primary-800); }

      /* Ajustes de hover automático */
      .hover\\:bg-amber-600:hover { background-color: var(--color-primary-600) !important; }
      .hover\\:bg-amber-700:hover { background-color: var(--color-primary-700) !important; }
      
    `}} />
  );
}