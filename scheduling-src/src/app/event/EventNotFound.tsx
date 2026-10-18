'use client'

import { useEffect } from 'react'

import Content from '/src/components/Content/Content'
import { useTranslation } from '/src/i18n/client'
import useRecentsStore from '/src/stores/recentsStore'

import styles from './page.module.scss'

const EventNotFound = ({ id }: { id: string | null }) => {
  const { t } = useTranslation('event')

  // Remove this event from recents if it was in there
  const removeRecent = useRecentsStore(state => state.removeRecent)
  useEffect(() => {
    if (id) removeRecent(id)
  }, [id, removeRecent])

  return <Content>
    <div style={{ marginBlock: 100 }}>
      <h1 className={styles.name}>{t('error.title')}</h1>
      <p className={styles.info}>{t('error.body')}</p>
    </div>
  </Content>
}

export default EventNotFound
