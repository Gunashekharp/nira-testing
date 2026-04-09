import { useEffect, useState } from "react";

const STORAGE_KEY = "nira-patient-language";

export function usePatientLanguage(defaultLanguage = "en") {
  const [language, setLanguage] = useState(() => {
    if (typeof window === "undefined") {
      return defaultLanguage;
    }

    return window.localStorage.getItem(STORAGE_KEY) || defaultLanguage;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, language);
    }
  }, [language]);

  return [language, setLanguage];
}
