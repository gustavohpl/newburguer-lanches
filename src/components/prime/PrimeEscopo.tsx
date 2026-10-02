import React from 'react';
import { createPortal } from 'react-dom';
import { useConfig } from '../../ConfigContext';
import { legivelSobre } from './primeArte';
import './prime.css';

// modais compartilhados no Prime: portal fora do #client-app (que tem .dark) + tokens/fonte do Prime
export function PrimeEscopo({ ativo, children }: { ativo: boolean; children: React.ReactNode }) {
  const { config } = useConfig();
  if (!ativo) return <>{children}</>;
  const cor = config.themeColor || '#04af06';
  return createPortal(
    <div className="prime-mod prime-ck" style={{ ['--ac' as string]: cor, ['--ac-ink' as string]: legivelSobre(cor) } as React.CSSProperties}>
      {children}
    </div>,
    document.body,
  );
}
