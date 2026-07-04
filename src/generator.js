const playwright = require('playwright');
const path = require('path');
const fs = require('fs');
const { downloadAndOptimizeImages } = require('./image-optimizer');
const { generateAltTexts } = require('./alt-text');

/**
 * Crawl URLs and capture computed HTML, CSS, and assets.
 */
async function crawlPage(url) {
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.createContext();
    const page = await context.newPage();

    console.log(`  📄 Crawling: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Extract all resources (images, stylesheets, scripts)
    const resources = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src,
        alt: img.alt,
        title: img.title
      }));
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
      return { images, stylesheets: links };
    });

    // Capture rendered HTML
    const html = await page.content();
    const computedCSS = await page.evaluate(() => {
      const sheets = document.styleSheets;
      let css = '';
      try {
        for (const sheet of sheets) {
          for (const rule of sheet.cssRules || []) {
            css += rule.cssText + '\n';
          }
        }
      } catch (e) {
        // CORS or same-origin restrictions
      }
      return css;
    });

    await context.close();
    await browser.close();

    return {
      url,
      html,
      computedCSS,
      resources
    };
  } catch (error) {
    if (browser) await browser.close();
    throw new Error(`Failed to crawl ${url}: ${error.message}`);
  }
}

/**
 * Generate static site from crawled pages and prompt.
 */
async function generateSite(options) {
  const { prompt, urls, outDir, siteName, llmProvider } = options;

  console.log(`\n🔍 Crawling pages...`);
  const crawledPages = [];
  for (const url of urls) {
    const page = await crawlPage(url);
    crawledPages.push(page);
  }

  console.log(`\n📥 Downloading and optimizing images...`);
  const imageData = await downloadAndOptimizeImages(crawledPages, outDir);

  console.log(`\n🏷️  Generating alt texts...`);
  const altTexts = await generateAltTexts(imageData, llmProvider);

  console.log(`\n🎨 Building static site...`);
  const assetsDir = path.join(outDir, 'assets');
  const imagesDir = path.join(assetsDir, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  // Write pages
  let pageCount = 0;
  for (let i = 0; i < crawledPages.length; i++) {
    const page = crawledPages[i];
    const html = buildHTML(page.html, imageData, altTexts, page.computedCSS, siteName);
    const fileName = i === 0 ? 'index.html' : `page-${i}.html`;
    const filePath = path.join(outDir, fileName);
    fs.writeFileSync(filePath, html, 'utf8');
    pageCount++;
  }

  // Write CSS
  const cssPath = path.join(assetsDir, 'style.css');
  const mergedCSS = buildCSS(crawledPages);
  fs.writeFileSync(cssPath, mergedCSS, 'utf8');

  // Write image mapping CSV
  const imageMappingPath = path.join(outDir, 'images-mapping.json');
  const mapping = imageData.map((img, idx) => ({
    index: idx,
    originalUrl: img.originalUrl,
    newFilename: img.newFilename,
    altText: altTexts[idx] || '',
    srcset: img.srcset || ''
  }));
  fs.writeFileSync(imageMappingPath, JSON.stringify(mapping, null, 2), 'utf8');

  // Write robots.txt and sitemap
  writeRobotsTxt(outDir);
  writeSitemap(outDir, urls, siteName);

  return {
    outDir,
    assetCount: imageData.length,
    pageCount,
    imageMappingPath
  };
}

/**
 * Build HTML page with SEO improvements.
 */
function buildHTML(originalHTML, imageData, altTexts, css, siteName) {
  // Parse HTML and update image src and alt attributes
  let html = originalHTML;

  imageData.forEach((img, idx) => {
    // Replace image src with new local path
    const oldSrc = img.originalUrl;
    const newSrc = `./assets/images/${img.newFilename}`;
    const regex = new RegExp(`src="${oldSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g');
    html = html.replace(regex, `src="${newSrc}" srcset="${img.srcset || newSrc}" loading="lazy"`);

    // Update alt text
    const altRegex = new RegExp(`alt="[^"]*"\\s+src="${newSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g');
    html = html.replace(altRegex, `alt="${altTexts[idx] || 'Image'}" src="${newSrc}"`);
  });

  // Inject SEO meta tags
  const seoHead = `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Generated static site: ${siteName}">
    <meta name="robots" content="index, follow">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${siteName}">
    <link rel="canonical" href="https://example.com/">
    <link rel="stylesheet" href="./assets/style.css">
  `;

  // Insert into <head>
  html = html.replace('</head>', `${seoHead}</head>`);

  return html;
}

/**
 * Merge CSS from all crawled pages.
 */
function buildCSS(crawledPages) {
  return crawledPages.map((page, idx) => `/* CSS from page ${idx} */\n${page.computedCSS}`).join('\n\n');
}

/**
 * Write robots.txt.
 */
function writeRobotsTxt(outDir) {
  const content = `User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n`;
  fs.writeFileSync(path.join(outDir, 'robots.txt'), content, 'utf8');
}

/**
 * Write sitemap.xml.
 */
function writeSitemap(outDir, urls, siteName) {
  const pages = ['index.html', ...Array.from({ length: urls.length - 1 }, (_, i) => `page-${i + 1}.html`)];
  const entries = pages.map((page, idx) => `  <url>\n    <loc>https://example.com/${page}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <priority>${idx === 0 ? '1.0' : '0.8'}</priority>\n  </url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
  fs.writeFileSync(path.join(outDir, 'sitemap.xml'), xml, 'utf8');
}

module.exports = { generateSite, crawlPage };
