import express from 'express';
import cors from 'cors';
import memjs from 'memjs';
import crypto from 'crypto';
import { chromium } from 'playwright-chromium';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: 'https://roamresearch.com',
  optionsSuccessStatus: 200
}));

const mc = memjs.Client.create(process.env.MEMCACHIER_SERVERS, {
  username: process.env.MEMCACHIER_USERNAME,
  password: process.env.MEMCACHIER_PASSWORD,
  failover: true,
  timeout: 1,
  keepAlive: true,
});

// Helper to compute SHA256 hash of content
function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Main endpoint
app.get('/poem-a-day', async (req, res) => {
  const cacheKey = 'poem-a-day:html';
  const hashKey = 'poem-a-day:hash';
  const forceRefresh = req.query.refresh === '1';

  try {
    // Try to get cached HTML and hash
    const [cachedHtml, cachedHash] = await Promise.all([
      mc.get(cacheKey),
      mc.get(hashKey)
    ]);

    if (cachedHtml && !forceRefresh) {
      // Scrape the page to check for updates
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto('https://poets.org/poem-a-day', { waitUntil: 'networkidle' });
      const html = await page.content();
      await browser.close();

      const newHash = hashContent(html);

      // If hash matches, serve cached HTML
      if (cachedHash && cachedHash.value.toString() === newHash) {
        res.set('X-Cache', 'HIT');
        return res.send(cachedHtml.value.toString());
      } else {
        // Update cache and serve new HTML
        await Promise.all([
          mc.set(cacheKey, html, { expires: 3600 }),
          mc.set(hashKey, newHash, { expires: 3600 })
        ]);
        res.set('X-Cache', 'MISS');
        return res.send(html);
      }
    } else {
      // No cache or forced refresh: scrape and cache
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto('https://poets.org/poem-a-day', { waitUntil: 'networkidle' });
      const html = await page.content();
      await browser.close();

      const newHash = hashContent(html);

      await Promise.all([
        mc.set(cacheKey, html, { expires: 3600 }),
        mc.set(hashKey, newHash, { expires: 3600 })
      ]);
      res.set('X-Cache', 'MISS');
      return res.send(html);
    }
  } catch (err) {
    console.error('Error scraping or caching:', err);
    res.status(500).send('Internal server error');
  }
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
