import {
  translations as baseTranslations,
} from "@/lib/i18n-base";

import {
  zhBaseOverrides,
} from "@/lib/i18n-zh";

export {
  normalizeLocale,
} from "@/lib/i18n-base";

export type {
  Locale,
} from "@/lib/i18n-base";

export const translations = {
  en: baseTranslations.en,

  zh: {
    ...baseTranslations.zh,

    global: {
      ...baseTranslations.zh.global,
      ...zhBaseOverrides.global,
    },

    home: {
      ...baseTranslations.zh.home,
      ...zhBaseOverrides.home,
    },

    market: {
      ...baseTranslations.zh.market,
      ...zhBaseOverrides.market,
    },

    agents: {
      ...baseTranslations.zh.agents,
      ...zhBaseOverrides.agents,
    },
  },
} as const;
