import {
  translations as baseTranslations,
} from "@/lib/i18n-base";

import {
  zhBaseOverrides,
} from "@/lib/i18n-zh";

import {
  marketPositioning,
} from "@/lib/i18n-market-positioning";

export {
  normalizeLocale,
} from "@/lib/i18n-base";

export type {
  Locale,
} from "@/lib/i18n-base";

export const translations = {
  en: {
    ...baseTranslations.en,

    home: {
      ...baseTranslations.en.home,
      ...marketPositioning.en.home,
    },

    market: {
      ...baseTranslations.en.market,
      ...marketPositioning.en.market,
    },

    agents: {
      ...baseTranslations.en.agents,
      ...marketPositioning.en.agents,
    },
  },

  zh: {
    ...baseTranslations.zh,

    global: {
      ...baseTranslations.zh.global,
      ...zhBaseOverrides.global,
    },

    home: {
      ...baseTranslations.zh.home,
      ...zhBaseOverrides.home,
      ...marketPositioning.zh.home,
    },

    market: {
      ...baseTranslations.zh.market,
      ...zhBaseOverrides.market,
      ...marketPositioning.zh.market,
    },

    agents: {
      ...baseTranslations.zh.agents,
      ...zhBaseOverrides.agents,
      ...marketPositioning.zh.agents,
    },
  },
} as const;
