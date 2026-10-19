'use client'

import { useEffect, useState } from 'react'
import { Trans } from 'react-i18next/TransWithoutContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { Temporal } from '@js-temporal/polyfill'

import Button from '/src/components/Button/Button'
import Content from '/src/components/Content/Content'
import Copyable from '/src/components/Copyable/Copyable'
import CreateForm from '/src/components/CreateForm/CreateForm'
import { eventEditUrl, eventPath, EventResponse, eventShareUrl, getEvent } from '/src/config/api'
import { useTranslation } from '/src/i18n/client'
import { useStore } from '/src/stores'
import useEditKeysStore from '/src/stores/editKeysStore'
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
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const { t, i18n } = useTranslation(['common', 'event'])
  const { replace } = useRouter()

  // undefined while loading, null if the event doesn't exist
  const [event, setEvent] = useState<EventResponse | null>()
  const [isEditing, setIsEditing] = useState(false)

  // The creator's edit key, remembered from creating the event or from their private edit link
  const editKey = useStore(useEditKeysStore, state => id ? state.editKeys[id] : undefined)
  const setEditKey = useEditKeysStore(state => state.setEditKey)
  useEffect(() => {
    const key = searchParams.get('key')
    if (id && key) {
      setEditKey(id, key)
      // Keep the key out of the address bar so it isn't shared by accident
      replace(eventPath(id))
    }
  }, [id, searchParams, setEditKey, replace])

  useEffect(() => {
    setEvent(undefined)
    if (!id) return setEvent(null)
    getEvent(id)
      .then(setEvent)
      .catch(() => setEvent(null))
  }, [id])

  useEffect(() => {
    document.title = `${event?.name ?? (event === null ? t('event:error.title') : 'Event')} - Ricky Dicky's Schedule Time`
  }, [event, t])

  if (event === undefined) return <EventLoading />
  if (event === null) return <EventNotFound id={id} />

  return <>
    {isEditing && editKey ? <Content>
      <CreateForm
        event={event}
        editKey={editKey}
        onCancel={() => setIsEditing(false)}
        onSaved={updated => {
          setEvent(updated)
          setIsEditing(false)
        }}
      />
    </Content> : <Content>
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
      {editKey && <div className={makeClass(styles.info, styles.noPrint)}>
        <Button isSmall onClick={() => setIsEditing(true)}>{t('event:edit.button')}</Button>
        <p>{t('event:edit.link_info')}</p>
        <Copyable>{eventEditUrl(event.id, editKey)}</Copyable>
      </div>}
    </Content>}

    <EventAvailabilities event={event} />
  </>
}

export default EventPage
