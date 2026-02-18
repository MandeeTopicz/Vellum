import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test('displays main content', async ({ page }) => {
    await page.goto('/')

    // Check for main slogan
    await expect(page.locator('text=From rough ideas to real plans')).toBeVisible()

    // Check for site name
    await expect(page.locator('text=Vellum')).toBeVisible()
  })

  test('has working navigation', async ({ page }) => {
    await page.goto('/')

    // Should have login button
    const loginBtn = page.locator('button:has-text("Login"), a:has-text("Login")').first()
    await expect(loginBtn).toBeVisible()
  })

  test('get started and login buttons are present', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('get-started-btn')).toBeVisible()
    await expect(page.getByTestId('login-btn')).toBeVisible()
  })
})
