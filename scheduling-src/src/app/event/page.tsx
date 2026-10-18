import { Suspense } from 'react'
import { Metadata } from 'next'

import EventPage, { EventLoading } from './EventPage'

export const metadata: Metadata = {
  title: 'Event',
}

// Events live at /event/?id=<event id>: the site is a static export, so the
// event is looked up in the browser rather than at a dynamic /<id> route.
const Page = () => <Suspense fallback={<EventLoading />}>
  <EventPage />
</Suspense>

export default Page
