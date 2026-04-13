import { t as translate } from '../lib/translator.js';

export function useTranslation() {
  const lang = "en";
  const t = (key) => translate(key, lang);
  return { t, lang };
}
