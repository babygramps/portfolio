import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

const mockEvent = {
  id: 'mobile-scroll-test',
  name: 'Mobile Scroll Test',
  times: [
    '1700-25102026', '1800-25102026',
    '1700-26102026', '1800-26102026',
    '1700-27102026', '1800-27102026',
    '1700-28102026', '1800-28102026',
    '1700-29102026', '1800-29102026',
    '1700-30102026', '1800-30102026',
    '1700-31102026', '1800-31102026',
  ],
  timezone: 'America/Los_Angeles',
  created_at: 1792900000,
};

const mockPeople = [
  {
    name: 'Alice',
    availability: ['1700-25102026', '1715-25102026', '1730-25102026', '1745-25102026'],
    created_at: 1792900100,
  },
  {
    name: 'Bob',
    availability: ['1700-25102026', '1715-25102026', '1700-26102026', '1715-26102026'],
    created_at: 1792900200,
  },
];

async function mockEventApi(browser: Parameters<Parameters<typeof test>[1]>[0]['browser']) {
  await browser.route('**/scheduling/config.json', async route => {
    await route.fulfill({ json: { apiUrl: 'http://127.0.0.1:1234/mock-api/' } });
  });
  await browser.route('**/mock-api/event/mobile-scroll-test', async route => {
    await route.fulfill({ json: mockEvent });
  });
  await browser.route('**/mock-api/event/mobile-scroll-test/people', async route => {
    await route.fulfill({ json: mockPeople });
  });
  await browser.route('**/mock-api/event/mobile-scroll-test/people/Alice', async route => {
    await route.fulfill({ json: mockPeople[0] });
  });
}

test('app opens home page', async ({ app, screen }) => {
  await app.open('/scheduling/');
  await expect(screen.getByRole('heading', "Ricky Dicky's Schedule Time")).toBeVisible();
});

test('event page shows a melting clock while the event loads', async ({ app, browser, screen }) => {
  await mockEventApi(browser);
  // Hold the event response so the loading state stays on screen until the clock is checked
  let releaseEvent = () => {};
  const eventReleased = new Promise<void>(resolve => { releaseEvent = resolve; });
  await browser.route('**/mock-api/event/mobile-scroll-test', async route => {
    await eventReleased;
    await route.fulfill({ json: mockEvent });
  });
  await app.open('/scheduling/event/?id=mobile-scroll-test');

  await expect(screen.getByRole('img', 'Loading event')).toBeVisible();
  await screen.getByRole('img', 'Loading event').scrollIntoView();
  await app.screenshot('event-loading');

  releaseEvent();
  await expect(screen.getByRole('heading', 'Mobile Scroll Test')).toBeVisible();
  await expect(screen.getByRole('img', 'Loading event')).toBeHidden();
});

test('melting clock holds still when reduced motion is on', async ({ app, browser, screen }) => {
  await mockEventApi(browser);
  await browser.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  let releaseEvent = () => {};
  const eventReleased = new Promise<void>(resolve => { releaseEvent = resolve; });
  await browser.route('**/mock-api/event/mobile-scroll-test', async route => {
    await eventReleased;
    await route.fulfill({ json: mockEvent });
  });
  await app.open('/scheduling/event/?id=mobile-scroll-test');

  await expect(screen.getByRole('img', 'Loading event')).toBeVisible();
  const shownSrc = await browser.evaluate(() =>
    document.querySelector<HTMLImageElement>('img[alt="Loading event"]')?.currentSrc ?? '');
  expect(shownSrc).toContain('melting-clock-still');
  await screen.getByRole('img', 'Loading event').scrollIntoView();
  await app.screenshot('event-loading-dark-reduced-motion');

  releaseEvent();
  await expect(screen.getByRole('heading', 'Mobile Scroll Test')).toBeVisible();
});

test('availability viewer stacks vertically on mobile and horizontally on desktop', async ({ app, browser, screen }) => {
  await mockEventApi(browser);
  await app.open('/scheduling/event/?id=mobile-scroll-test');

  await expect(screen.getByRole('heading', 'Mobile Scroll Test')).toBeVisible();
  await expect(screen.getByRole('button', 'Alice')).toBeVisible();

  // Wait for the heatmap date columns to render
  await expect(screen.getByText('Oct 25')).toBeVisible();
  await expect(screen.getByText('Oct 31')).toBeVisible();

  const oct25Box = (await screen.getByText('Oct 25').boundingBox())!;
  const oct26Box = (await screen.getByText('Oct 26').boundingBox())!;
  const viewportWidth = await browser.evaluate(() => window.innerWidth);

  if (viewportWidth <= 660) {
    // On mobile, date columns stack vertically by default and the scroll container does not overflow horizontally
    expect(oct26Box.y).toBeGreaterThan(oct25Box.y + 40);
    expect(Math.abs(oct26Box.x - oct25Box.x)).toBeLessThan(5);

    const hasHorizontalOverflow = await browser.evaluate(() => {
      const oct25 = Array.from(document.querySelectorAll('label')).find(l => l.textContent === 'Oct 25');
      const scrollContainer = oct25?.closest('[class*="heatmap"]')?.parentElement;
      return scrollContainer ? scrollContainer.scrollWidth > scrollContainer.clientWidth : true;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Toggle to horizontal layout on mobile
    await screen.getByRole('button', 'Horizontal layout').click();
    const hOct25 = (await screen.getByText('Oct 25').boundingBox())!;
    const hOct26 = (await screen.getByText('Oct 26').boundingBox())!;
    expect(hOct26.x).toBeGreaterThan(hOct25.x + 40);
    expect(Math.abs(hOct26.y - hOct25.y)).toBeLessThan(5);

    // Toggle back to vertical layout
    await screen.getByRole('button', 'Vertical layout').click();
    await screen.getByText('Oct 25').scrollIntoView();
    await app.screenshot('mobile-heatmap');
  } else {
    // On desktop, date columns sit side-by-side in a single row and layout toggle is hidden
    await expect(screen.getByRole('button', 'Vertical layout')).toBeHidden();
    expect(oct26Box.x).toBeGreaterThan(oct25Box.x + 40);
    expect(Math.abs(oct26Box.y - oct25Box.y)).toBeLessThan(5);

    await screen.getByText('Oct 25').scrollIntoView();
    await app.screenshot('desktop-heatmap');
  }
});

test('availability editor can toggle between vertical and horizontal layout on mobile', async ({ app, browser, screen }) => {
  await mockEventApi(browser);
  await app.open('/scheduling/event/?id=mobile-scroll-test');

  await expect(screen.getByRole('heading', 'Mobile Scroll Test')).toBeVisible();
  await screen.getByLabel('Your name').fill('Alice');
  await screen.getByRole('button', 'Login').click();

  await expect(screen.getByText('Click and drag the calendar below to set your availabilities')).toBeVisible();
  await expect(screen.getByText('Oct 25')).toBeVisible();

  const viewportWidth = await browser.evaluate(() => window.innerWidth);

  if (viewportWidth <= 660) {
    await expect(screen.getByRole('button', 'Vertical layout')).toBeVisible();
    await expect(screen.getByRole('button', 'Horizontal layout')).toBeVisible();

    // Defaults to vertical stacking on mobile
    const vOct25 = (await screen.getByText('Oct 25').boundingBox())!;
    const vOct26 = (await screen.getByText('Oct 26').boundingBox())!;
    expect(vOct26.y).toBeGreaterThan(vOct25.y + 40);
    expect(Math.abs(vOct26.x - vOct25.x)).toBeLessThan(5);

    // Switch to horizontal layout on mobile
    await screen.getByRole('button', 'Horizontal layout').click();
    const hOct25 = (await screen.getByText('Oct 25').boundingBox())!;
    const hOct26 = (await screen.getByText('Oct 26').boundingBox())!;
    expect(hOct26.x).toBeGreaterThan(hOct25.x + 40);
    expect(Math.abs(hOct26.y - hOct25.y)).toBeLessThan(5);
  } else {
    await expect(screen.getByRole('button', 'Vertical layout')).toBeHidden();
  }
});


test('event page sums up the best times', async ({ app, browser, screen }) => {
  // Times are stored in UTC: 1700 UTC is 10:00 AM in Los Angeles on these dates
  const event = {
    id: 'best-times-test',
    name: 'Best Times Test',
    times: ['1700-25102026', '1800-25102026', '1700-26102026', '1800-26102026'],
    timezone: 'America/Los_Angeles',
    created_at: 1792900000,
  };
  const slots = (day: string, ...hhmm: string[]) => hhmm.map(t => `${t}-${day}`);
  const people = [
    {
      name: 'Alice',
      availability: [
        ...slots('25102026', '1700', '1715', '1730', '1745', '1800', '1815', '1830', '1845'),
        ...slots('26102026', '1700', '1715', '1730', '1745'),
      ],
      created_at: 1792900100,
    },
    {
      name: 'Bob',
      availability: [
        ...slots('25102026', '1730', '1745', '1800', '1815', '1830', '1845'),
        ...slots('26102026', '1700', '1715', '1730', '1745'),
      ],
      created_at: 1792900200,
    },
    {
      name: 'Cara',
      availability: [
        ...slots('25102026', '1800', '1815', '1830', '1845'),
        ...slots('26102026', '1800', '1815', '1830', '1845'),
      ],
      created_at: 1792900300,
    },
  ];
  await browser.route('**/scheduling/config.json', async route => {
    await route.fulfill({ json: { apiUrl: 'http://127.0.0.1:1234/mock-api/' } });
  });
  await browser.route('**/mock-api/event/best-times-test', async route => {
    await route.fulfill({ json: event });
  });
  await browser.route('**/mock-api/event/best-times-test/people', async route => {
    await route.fulfill({ json: people });
  });

  await app.open('/scheduling/event/?id=best-times-test');
  await expect(screen.getByRole('heading', 'Best Times Test')).toBeVisible();
  await screen.getByLabel('Your time zone').selectOption({ value: 'America/Los_Angeles' });

  // Most people first, then the longest window, then the earliest
  const bestTimes = screen.getByRole('region', 'Best times');
  await expect(bestTimes.getByRole('listitem')).toHaveText([
    /^Sun, Oct 25 11:00\sAM\s–\s12:00\sPM Everyone$/,
    /^Mon, Oct 26 10:00\s–\s11:00\sAM All but Cara$/,
    /^Sun, Oct 25 10:30\s–\s11:00\sAM All but Cara$/,
  ]);

  await bestTimes.scrollIntoView();
  await app.screenshot('best-times');
});

test('best times show a window that ends at midnight without dates', async ({ app, browser, screen }) => {
  // 0600 UTC on Oct 26 is 11:00 PM on Oct 25 in Los Angeles
  const event = {
    id: 'best-times-midnight-test',
    name: 'Midnight Test',
    times: ['0600-26102026'],
    timezone: 'America/Los_Angeles',
    created_at: 1792900000,
  };
  const people = [
    { name: 'Alice', availability: ['0600-26102026', '0615-26102026', '0630-26102026', '0645-26102026'], created_at: 1792900100 },
  ];
  await browser.route('**/scheduling/config.json', async route => {
    await route.fulfill({ json: { apiUrl: 'http://127.0.0.1:1234/mock-api/' } });
  });
  await browser.route('**/mock-api/event/best-times-midnight-test', async route => {
    await route.fulfill({ json: event });
  });
  await browser.route('**/mock-api/event/best-times-midnight-test/people', async route => {
    await route.fulfill({ json: people });
  });

  await app.open('/scheduling/event/?id=best-times-midnight-test');
  await expect(screen.getByRole('heading', 'Midnight Test')).toBeVisible();
  await screen.getByLabel('Your time zone').selectOption({ value: 'America/Los_Angeles' });

  await expect(screen.getByRole('region', 'Best times').getByRole('listitem')).toHaveText([
    /^Sun, Oct 25 11:00\sPM\s–\s12:00\sAM Everyone$/,
  ]);
});
