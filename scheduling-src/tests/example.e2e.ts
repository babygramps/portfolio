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
}

test('app opens home page', async ({ app, screen }) => {
  await app.open('/scheduling/');
  await expect(screen.getByRole('heading', "Ricky Dicky's Schedule Time")).toBeVisible();
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
    // On mobile, date columns stack vertically and the scroll container does not overflow horizontally
    expect(oct26Box.y).toBeGreaterThan(oct25Box.y + 40);
    expect(Math.abs(oct26Box.x - oct25Box.x)).toBeLessThan(5);

    const hasHorizontalOverflow = await browser.evaluate(() => {
      const oct25 = Array.from(document.querySelectorAll('label')).find(l => l.textContent === 'Oct 25');
      const scrollContainer = oct25?.closest('[class*="heatmap"]')?.parentElement;
      return scrollContainer ? scrollContainer.scrollWidth > scrollContainer.clientWidth : true;
    });
    expect(hasHorizontalOverflow).toBe(false);

    await screen.getByText('Oct 25').scrollIntoView();
    await app.screenshot('mobile-heatmap');
  } else {
    // On desktop, date columns sit side-by-side in a single row
    expect(oct26Box.x).toBeGreaterThan(oct25Box.x + 40);
    expect(Math.abs(oct26Box.y - oct25Box.y)).toBeLessThan(5);

    await screen.getByText('Oct 25').scrollIntoView();
    await app.screenshot('desktop-heatmap');
  }
});
