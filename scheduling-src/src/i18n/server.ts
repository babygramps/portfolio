import { createInstance } from 'i18next'
import resourcesToBackend from 'i18next-resources-to-backend'

import { fallbackLng, getOptions } from './options'

const initI18next = async (language: string, ns: string | string []) => {
  const i18nInstance = createInstance()
  await i18nInstance
    .use(resourcesToBackend((language: string, namespace: string) =>
      import(`./locales/${language}/${namespace}.json`)
    ))
    .init(getOptions(language, ns))
  return i18nInstance
}

export const useTranslation = async (ns: string | string[], options: { keyPrefix?: string } = {}) => {
  // Pages are prerendered for the static export, so there is no request to
  // read a language from; client components switch to the visitor's language.
  const language = fallbackLng

  const i18nextInstance = await initI18next(language, ns)
  return {
    t: i18nextInstance.getFixedT(language, Array.isArray(ns) ? ns[0] : ns, options.keyPrefix),
    i18n: i18nextInstance,
    resolvedLanguage: language,
  }
}
