'use client'

import { useEffect, useState } from 'react'
import { Trans } from 'react-i18next/TransWithoutContext'
import { useSearchParams } from 'next/navigation'
import { Temporal } from '@js-temporal/polyfill'

import Content from '/src/components/Content/Content'
import Copyable from '/src/components/Copyable/Copyable'
import { EventResponse, eventShareUrl, getEvent } from '/src/config/api'
import { useTranslation } from '/src/i18n/client'
import { makeClass, relativeTimeFormat } from '/src/utils'

import EventAvailabilities from './EventAvailabilities'
import EventNotFound from './EventNotFound'
import styles from './page.module.scss'

export const EventLoading = () => <>
  <Content>
    <h1 className={styles.name}><span className={styles.bone} /></h1>
    <div className={styles.date}><span className={styles.bone} /></div>
    <div className={styles.info}><span className={styles.bone} style={{ width: '20em' }} /></div>
    <div className={styles.info}><span className={styles.bone} style={{ width: '20em' }} /></div>
  </Content>

  <EventAvailabilities />
</>

const EventPage = () => {
  const id = useSearchParams().get('id')
  const { t, i18n } = useTranslation(['common', 'event'])

  // undefined while loading, null if the event doesn't exist
  const [event, setEvent] = useState<EventResponse | null>()

  useEffect(() => {
    setEvent(undefined)
    if (!id) return setEvent(null)
    getEvent(id)
      .then(setEvent)
      .catch(() => setEvent(null))
  }, [id])

  useEffect(() => {
    document.title = `${event?.name ?? (event === null ? t('event:error.title') : 'Event')} - Crab Fit`
  }, [event, t])

  if (event === undefined) return <EventLoading />
  if (event === null) return <EventNotFound id={id} />

  return <>
    <Content>
      <h1 className={styles.name}>{event.name}</h1>
      <span
        className={styles.date}
        title={Temporal.Instant.fromEpochSeconds(event.created_at).toLocaleString(i18n.language, { dateStyle: 'long' })}
      >{t('common:created', { date: relativeTimeFormat(Temporal.Instant.fromEpochSeconds(event.created_at), i18n.language) })}</span>

      <Copyable className={styles.info}>
        {eventShareUrl(event.id)}
      </Copyable>
      <p className={makeClass(styles.info, styles.noPrint)}>
        <Trans i18nKey="event:nav.shareinfo" t={t} i18n={i18n}>_<a href={`mailto:?subject=${encodeURIComponent(t('event:nav.email_subject', { event_name: event.name }))}&body=${encodeURIComponent(`${t('event:nav.email_body')} ${eventShareUrl(event.id)}`)}`}>_</a>_</Trans>
      </p>
    </Content>

    <EventAvailabilities event={event} />
  </>
}

export default EventPage
