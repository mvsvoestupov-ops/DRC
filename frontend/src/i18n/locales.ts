export const LOCALES = ["ru", "en", "hi", "zh", "vi"] as const;

export type Locale = (typeof LOCALES)[number];

export const LOCALE_STORAGE_KEY = "drc_locale";

export const LANGUAGES: {
  id: Locale;
  native: string;
  htmlLang: string;
  intl: string;
}[] = [
  { id: "ru", native: "Русский", htmlLang: "ru", intl: "ru-RU" },
  { id: "en", native: "English", htmlLang: "en", intl: "en-GB" },
  { id: "hi", native: "हिन्दी", htmlLang: "hi", intl: "hi-IN" },
  { id: "zh", native: "中文", htmlLang: "zh-CN", intl: "zh-CN" },
  { id: "vi", native: "Tiếng Việt", htmlLang: "vi", intl: "vi-VN" },
];

export function isLocale(value: string | null | undefined): value is Locale {
  return Boolean(value && LOCALES.includes(value as Locale));
}
