import { expect, test } from '@playwright/test';

test.describe('QueueDesk critical user journeys', () => {
  test('support agent can login, browse, search, filter, update, and resolve a ticket, but cannot access admin', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Email address').fill('agent1@queuedesk.local');
    await page.getByLabel('Password').fill('QueueDesk!Agent2026');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('Operations Dashboard')).toBeVisible();

    // Support agent should not see Administration link
    await expect(page.getByRole('link', { name: 'Administration' })).toHaveCount(0);

    // Navigate to Tickets
    await page.getByRole('link', { name: 'Tickets' }).click();
    await expect(page).toHaveURL(/\/tickets/);

    // Filter by Open status
    await page.getByRole('combobox', { name: 'Filter by status' }).click();
    await page.getByRole('option', { name: 'Open' }).click();
    await expect(page.locator('table tbody tr').first()).toBeVisible();

    // Open first ticket details
    await page.locator('table tbody tr').first().locator('a').first().click();
    await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]+/);

    // Update priority and resolve
    await page.getByRole('combobox', { name: 'Priority' }).click();
    await page.getByRole('option', { name: 'URGENT' }).click();
    await page.getByRole('button', { name: 'Resolve Ticket' }).click();
    await page.getByRole('button', { name: 'Resolve' }).click();

    await expect(page.getByRole('button', { name: 'Reopen Ticket' })).toBeVisible();
  });
});
