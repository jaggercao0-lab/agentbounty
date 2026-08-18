import type {
  Locale,
} from "@/lib/i18n";

import {
  extraTranslations as baseExtraTranslations,
} from "@/lib/i18n-extra-base";

import {
  zhExtraOverrides,
} from "@/lib/i18n-zh";

import {
  taskSourceTranslations,
} from "@/lib/i18n-task-source";

export const extraTranslations: Record<Locale, any> = {
  en: {
    ...baseExtraTranslations.en,

    newTask: {
      ...baseExtraTranslations.en.newTask,
      ...taskSourceTranslations.en,
    },
  },

  zh: {
    ...baseExtraTranslations.zh,

    status: {
      ...baseExtraTranslations.zh.status,
      ...zhExtraOverrides.status,
    },

    login: {
      ...baseExtraTranslations.zh.login,
      ...zhExtraOverrides.login,
    },

    newTask: {
      ...baseExtraTranslations.zh.newTask,
      ...zhExtraOverrides.newTask,
      ...taskSourceTranslations.zh,
    },

    newAgent: {
      ...baseExtraTranslations.zh.newAgent,
      ...zhExtraOverrides.newAgent,

      providerHints: {
        ...baseExtraTranslations.zh.newAgent.providerHints,
        ...zhExtraOverrides.newAgent.providerHints,
      },
    },

    task: {
      ...baseExtraTranslations.zh.task,
      ...zhExtraOverrides.task,

      lifecycle: {
        ...baseExtraTranslations.zh.task.lifecycle,
        ...zhExtraOverrides.task.lifecycle,
      },

      machine: {
        ...baseExtraTranslations.zh.task.machine,
        ...zhExtraOverrides.task.machine,
      },

      owner: {
        ...baseExtraTranslations.zh.task.owner,
        ...zhExtraOverrides.task.owner,
      },

      verification: {
        ...baseExtraTranslations.zh.task.verification,
        ...zhExtraOverrides.task.verification,
      },

      activity: {
        ...baseExtraTranslations.zh.task.activity,
        ...zhExtraOverrides.task.activity,

        labels: {
          ...baseExtraTranslations.zh.task.activity.labels,
          ...zhExtraOverrides.task.activity.labels,
        },
      },
    },

    agentDetail: {
      ...baseExtraTranslations.zh.agentDetail,
      ...zhExtraOverrides.agentDetail,

      connect: {
        ...baseExtraTranslations.zh.agentDetail.connect,
        ...zhExtraOverrides.agentDetail.connect,
      },
    },
  },
};
