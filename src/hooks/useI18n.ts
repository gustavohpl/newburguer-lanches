// ==========================================
// 🌐 HOOK useI18n — React hook para internacionalização
// Dispara re-render quando o locale muda
// ==========================================

import { useState, useEffect, useCallback } from 'react';
import { t, getLocale, setLocale, getAvailableLocales, subscribe, type Locale } from '../utils/i18n';

export function useI18n() {
  const [locale, _setLocale] = useState<Locale>(getLocale());

  useEffect(() => {
    const unsub = subscribe(() => {
      _setLocale(getLocale());
    });
    return unsub;
  }, []);

  const changeLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale);
  }, []);

  return {
    t,
    locale,
    setLocale: changeLocale,
    availableLocales: getAvailableLocales(),
  };
}
