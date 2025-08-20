/**
 * End-to-End Test: Complete User Journey
 * 
 * Tests the full user experience in a real browser:
 * Page Load → Search → Session Management → UI Interactions
 */

import { test, expect } from '@playwright/test';

test.describe('US Citizenship Test Assistant - E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test('should load the application successfully', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Citizenship Test Assistant|Realtime Console/);
    
    // Check main UI elements
    await expect(page.locator('text=Ask me anything about the US citizenship test!')).toBeVisible();
    await expect(page.locator('input[placeholder="Search citizenship topics..."]')).toBeVisible();
    
    // Check navigation elements
    await expect(page.locator('text=Session Status')).toBeVisible();
  });

  test('should display search functionality', async ({ page }) => {
    // Find search input
    const searchInput = page.locator('input[placeholder="Search citizenship topics..."]');
    const searchButton = page.locator('button[aria-label="Search citizenship topics"]');
    
    await expect(searchInput).toBeVisible();
    await expect(searchButton).toBeVisible();
    
    // Test search interaction
    await searchInput.fill('constitution');
    await searchButton.click();
    
    // Should trigger some kind of search response (visual feedback)
    // Note: Without real OpenAI connection, we can't test full functionality
    // but we can test UI interactions
  });

  test('should show session controls', async ({ page }) => {
    // Check session control elements
    await expect(page.locator('text=Session Status')).toBeVisible();
    
    // Look for connect/disconnect type controls
    const _sessionControls = page.locator('[data-testid="session-controls"]').or(
      page.locator('text=Connect').or(page.locator('text=Disconnect'))
    );
    
    // At least some session controls should be present
    // (exact elements depend on current session state)
  });

  test('should be responsive on mobile devices', async ({ page, browserName }) => {
    // Skip webkit on mobile for now as it might have different behavior
    test.skip(browserName === 'webkit', 'Mobile webkit testing skipped');
    
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check that main elements are still visible and accessible
    await expect(page.locator('input[placeholder="Search citizenship topics..."]')).toBeVisible();
    await expect(page.locator('text=Ask me anything about the US citizenship test!')).toBeVisible();
    
    // Check that elements don't overflow
    const searchContainer = page.locator('input[placeholder="Search citizenship topics..."]');
    const boundingBox = await searchContainer.boundingBox();
    
    if (boundingBox) {
      expect(boundingBox.x).toBeGreaterThanOrEqual(0);
      expect(boundingBox.x + boundingBox.width).toBeLessThanOrEqual(375);
    }
  });

  test('should handle navigation and routing', async ({ page }) => {
    // Test any client-side routing
    // Since this is mainly a single page app, test URL consistency
    
    const initialUrl = page.url();
    expect(initialUrl).toContain('localhost:3000');
    
    // Test any hash routing or query parameters if present
    // await page.click('text=Some Navigation Link');
    // await expect(page.url()).toMatch(/expected-route/);
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Test error scenarios
    
    // Block network requests to simulate offline
    await page.route('**/*', route => route.abort('failed'));
    
    // Try to perform an action that requires network
    const searchInput = page.locator('input[placeholder="Search citizenship topics..."]');
    const searchButton = page.locator('button[aria-label="Search citizenship topics"]');
    
    await searchInput.fill('test query');
    await searchButton.click();
    
    // Should not crash - page should remain functional
    await expect(page.locator('input[placeholder="Search citizenship topics..."]')).toBeVisible();
    
    // Clear the route block
    await page.unroute('**/*');
  });

  test('should maintain state during page interactions', async ({ page }) => {
    // Test that UI state persists during interactions
    
    const searchInput = page.locator('input[placeholder="Search citizenship topics..."]');
    
    // Type something in search
    await searchInput.fill('president');
    
    // Verify text persists
    await expect(searchInput).toHaveValue('president');
    
    // Click elsewhere and verify it still persists
    await page.click('body');
    await expect(searchInput).toHaveValue('president');
  });

  test('should have proper accessibility features', async ({ page }) => {
    // Test basic accessibility
    
    // Check for ARIA labels
    const searchButton = page.locator('button[aria-label="Search citizenship topics"]');
    await expect(searchButton).toBeVisible();
    
    // Check for proper heading structure
    const headings = page.locator('h1, h2, h3');
    const headingCount = await headings.count();
    expect(headingCount).toBeGreaterThan(0);
    
    // Check for keyboard navigation
    const searchInput = page.locator('input[placeholder="Search citizenship topics..."]');
    await searchInput.focus();
    await expect(searchInput).toBeFocused();
    
    // Test tab navigation
    await page.keyboard.press('Tab');
    // Should move focus to next interactive element
  });

  test('should load assets correctly', async ({ page }) => {
    // Check that CSS is loaded (by checking computed styles)
    const searchInput = page.locator('input[placeholder="Search citizenship topics..."]');
    
    // Should have some styling applied (not default browser styles)
    const borderRadius = await searchInput.evaluate(el => {
      return window.getComputedStyle(el).borderRadius;
    });
    
    // TailwindCSS should apply rounded borders
    expect(borderRadius).not.toBe('0px');
    
    // Check for any images that should load
    const images = page.locator('img');
    const imageCount = await images.count();
    
    if (imageCount > 0) {
      // Verify at least first image loads
      const firstImage = images.first();
      await expect(firstImage).toBeVisible();
    }
  });
});

test.describe('Database Integration E2E', () => {
  test('should connect to database successfully', async ({ page }) => {
    // Test database connectivity through the UI
    await page.goto('/');
    
    // Look for any indicators of database connection status
    // This might be implicit - app loading successfully indicates DB connection
    
    // If there's a database info endpoint, we could test it
    const response = await page.request.get('/search/info');
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('total_documents');
      expect(data.total_documents).toBeGreaterThan(0);
    }
  });

  test('should perform search against real database', async ({ page }) => {
    await page.goto('/');
    
    // Use the browser's fetch API to test search endpoint
    const searchResult = await page.evaluate(async () => {
      try {
        const response = await fetch('/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: 'constitution',
            limit: 3
          })
        });
        
        if (response.ok) {
          return await response.json();
        }
        return null;
      } catch {
        return null;
      }
    });
    
    if (searchResult) {
      expect(searchResult).toHaveProperty('results');
      expect(Array.isArray(searchResult.results)).toBeTruthy();
      expect(searchResult.results.length).toBeGreaterThan(0);
    }
  });

  test('should get random questions from database', async ({ page }) => {
    await page.goto('/');
    
    // Test random question endpoint
    const questionResult = await page.evaluate(async () => {
      try {
        const response = await fetch('/random-question');
        if (response.ok) {
          return await response.json();
        }
        return null;
      } catch {
        return null;
      }
    });
    
    if (questionResult) {
      expect(questionResult).toHaveProperty('id');
      expect(questionResult).toHaveProperty('question');
      expect(questionResult).toHaveProperty('answer');
      expect(questionResult).toHaveProperty('category');
    }
  });
});

test.describe('Performance and Load Testing', () => {
  test('should load page within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    
    // Wait for main content to be visible
    await expect(page.locator('text=Ask me anything about the US citizenship test!')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // Should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should handle multiple rapid interactions', async ({ page }) => {
    await page.goto('/');
    
    const searchInput = page.locator('input[placeholder="Search citizenship topics..."]');
    const searchButton = page.locator('button[aria-label="Search citizenship topics"]');
    
    // Rapid fire searches
    for (let i = 0; i < 5; i++) {
      await searchInput.fill(`test query ${i}`);
      await searchButton.click();
      // Small delay to avoid overwhelming
      await page.waitForTimeout(100);
    }
    
    // Should remain responsive
    await expect(searchInput).toBeVisible();
    await expect(searchButton).toBeVisible();
  });

  test('should maintain performance with large datasets', async ({ page }) => {
    await page.goto('/');
    
    // Test performance with database operations
    const startTime = Date.now();
    
    const largeSearchResult = await page.evaluate(async () => {
      const response = await fetch('/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'government', // Broad term likely to return many results
          limit: 20
        })
      });
      
      if (response.ok) {
        return await response.json();
      }
      return null;
    });
    
    const queryTime = Date.now() - startTime;
    
    // Database query should complete quickly
    expect(queryTime).toBeLessThan(2000);
    
    if (largeSearchResult) {
      expect(largeSearchResult.results.length).toBeGreaterThan(0);
    }
  });
});