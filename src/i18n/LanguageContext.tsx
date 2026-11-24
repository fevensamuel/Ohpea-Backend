/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import {
  StandardLanguage,
  LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getInitialLanguage,
  applyHtmlLanguageAttributes,
  LanguageOption,
} from './config.js';
import { translations, TranslationDictionary, TranslationKey } from '../translations.js';
import { api } from '../lib/ophea-api-client.js';

interface LanguageContextType {
  language: StandardLanguage;
  setLanguage: (lang: StandardLanguage) => void;
  currentOption: LanguageOption;
  isRtl: boolean;
  dir: 'ltr' | 'rtl';
  dict: TranslationDictionary;
  languages: typeof LANGUAGES;
  t: (key: TranslationKey | string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<StandardLanguage>(getInitialLanguage);
  const [remoteTranslations, setRemoteTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    api.getTranslations(language).then((data) => {
      if (active && data && typeof data === 'object') setRemoteTranslations(data);
    }).catch(() => { if (active) setRemoteTranslations({}); });
    return () => { active = false; };
  }, [language]);

  useEffect(() => {
    applyHtmlLanguageAttributes(language);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // LocalStorage error ignore
    }
  }, [language]);

  const setLanguage = (newLang: StandardLanguage) => {
    if (LANGUAGES[newLang]) {
      setLanguageState(newLang);
    }
  };

  const currentOption = useMemo(() => LANGUAGES[language] || LANGUAGES[DEFAULT_LANGUAGE], [language]);
  const isRtl = currentOption.dir === 'rtl';
  const dir = currentOption.dir;
  const dict = useMemo(() => ({ ...(translations[language] || translations.en), ...remoteTranslations }), [language, remoteTranslations]);

  const t = (key: TranslationKey | string, fallback?: string): string => {
    const activeDict = (translations[language] || translations.en) as any;
    if (remoteTranslations[key] !== undefined) return remoteTranslations[key];
    if (activeDict && activeDict[key] !== undefined) {
      return activeDict[key];
    }
    const enDict = translations.en as any;
    if (enDict && enDict[key] !== undefined) {
      return enDict[key];
    }
    return fallback !== undefined ? fallback : key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        currentOption,
        isRtl,
        dir,
        dict,
        languages: LANGUAGES,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export function useTranslation() {
  const { t, language, isRtl, dir } = useLanguage();
  return { t, language, isRtl, dir };
}
