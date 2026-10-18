'use client'

import { useEffect, useState } from 'react'

import { getStats, StatsResponse } from '/src/config/api'
import { useTranslation } from '/src/i18n/client'

import styles from './Stats.module.scss'

const Stats = () => {
  const [stats, setStats] = useState<StatsResponse>()
  const { t } = useTranslation('home')

  useEffect(() => {
    getStats().then(setStats).catch(() => undefined)
  }, [])

  return stats ? <div className={styles.wrapper}>
    <div>
      <span className={styles.number}>
        {new Intl.NumberFormat().format(stats.event_count)}
      </span>
      <span className={styles.label}>{t('about.events')}</span>
    </div>
    <div>
      <span className={styles.number}>
        {new Intl.NumberFormat().format(stats.person_count)}
      </span>
      <span className={styles.label}>{t('about.availabilities')}</span>
    </div>
  </div> : null
}

export default Stats
