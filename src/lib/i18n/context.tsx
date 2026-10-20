"use client";

import React, { createContext, useContext, useState } from "react";
import { translations, SupportedLanguage, Translations } from "./translations";

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: translations.en,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("preferred_lang") as SupportedLanguage;
      if (saved === "en" || saved === "km") {
        return saved;
      }
    }
    return "en";
  });

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("preferred_lang", lang);
      if (lang === "km") {
        document.documentElement.classList.add("font-khmer");
      } else {
        document.documentElement.classList.remove("font-khmer");
      }
    }
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t: translations[language],
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
