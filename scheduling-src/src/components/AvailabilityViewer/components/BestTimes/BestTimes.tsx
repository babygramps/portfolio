import { useMemo } from 'react'

import { useTranslation } from '/src/i18n/client'
import { useStore } from '/src/stores'
import useSettingsStore from '/src/stores/settingsStore'
import { calculateBestTimes, calculateTable, convertTimesToDates } from '/src/utils'

import styles from './BestTimes.module.scss'

interface BestTimesProps {
  table?: ReturnType<typeof calculateTable>
  availabilities: { date: string, people: string[] }[]
  /** Names of everyone being counted */
  people: string[]
  timezone: string
}

const BestTimes = ({ table, availabilities, people, timezone }: BestTimesProps) => {
  const { t, i18n } = useTranslation('event')
  const timeFormat = useStore(useSettingsStore, state => state.timeFormat) ?? '12h'

  const bestTimes = useMemo(() => {
    if (!table) return []
    const isSpecificDates = availabilities[0]?.date.length === 13
    const timeRange = new Intl.DateTimeFormat(i18n.language, { hour: 'numeric', minute: '2-digit', hour12: timeFormat === '12h', timeZone: timezone })
    const names = new Intl.ListFormat(i18n.language)

    return calculateBestTimes(table.columns, availabilities).map(best => {
      const [start, last] = convertTimesToDates([best.times[0], best.times[best.times.length - 1]], timezone)
      const end = last.add({ minutes: 15 })
      const missing = people.filter(p => !best.people.includes(p))

      // Name who's missing when that's shorter than a count
      let who = `${best.people.length}/${people.length} ${t('available')}`
      if (missing.length === 0) {
        who = t('group.best_times_everyone')
      } else if (missing.length <= 2 && missing.length < best.people.length) {
        who = t('group.best_times_all_but', { names: names.format(missing) })
      }

      return {
        key: best.times[0],
        day: start.toLocaleString(i18n.language, isSpecificDates ? { weekday: 'short', month: 'short', day: 'numeric' } : { weekday: 'long' }),
        // formatRange adds both dates when a window ends at midnight, so join the times instead
        time: start.toPlainDate().equals(end.toPlainDate())
          ? timeRange.formatRange(new Date(start.epochMilliseconds), new Date(end.epochMilliseconds))
          : `${timeRange.format(new Date(start.epochMilliseconds))} – ${timeRange.format(new Date(end.epochMilliseconds))}`,
        who,
        people: best.people,
      }
    })
  }, [table, availabilities, people, timezone, timeFormat, i18n.language, t])

  if (bestTimes.length === 0) return null

  return <section className={styles.wrapper} aria-labelledby="best-times-heading">
    <h2 className={styles.heading} id="best-times-heading">{t('group.best_times')}</h2>
    <ol className={styles.list}>
      {bestTimes.map(best => <li key={best.key} className={styles.item} title={best.people.join(', ')}>
        <span className={styles.day}>{best.day}</span>{' '}
        <span>{best.time}</span>{' '}
        <span className={styles.who}>{best.who}</span>
      </li>)}
    </ol>
  </section>
}

export default BestTimes
