import { Metadata } from 'next'
import { Karla } from 'next/font/google'

import Settings from '/src/components/Settings/Settings'
import { fallbackLng } from '/src/i18n/options'
import { useTranslation } from '/src/i18n/server'

import './global.css'

const karla = Karla({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://rickrothbart.com/scheduling/'),
  title: {
    absolute: "Ricky Dicky's Schedule Time",
    template: "%s - Ricky Dicky's Schedule Time",
  },
  description: 'Enter your availability to find a time that works for everyone!',
  themeColor: '#F79E00',
  manifest: '/scheduling/manifest.json',
  openGraph: {
    title: "Ricky Dicky's Schedule Time",
    description: 'Enter your availability to find a time that works for everyone!',
    url: '/',
  },
  icons: {
    icon: '/scheduling/favicon.ico',
    apple: '/scheduling/logo192.png',
  },
}

const RootLayout = async ({ children }: { children: React.ReactNode }) => {
  const { resolvedLanguage } = await useTranslation([])

  return <html lang={resolvedLanguage ?? fallbackLng}>
    <body className={karla.className}>
      <Settings />

      {children}
    </body>
  </html>
}

export default RootLayout
