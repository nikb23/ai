const sharp = require('sharp');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * Download and optimize images from crawled pages.
 * Returns array of image metadata with SEO-friendly filenames and srcset.
 */
async function downloadAndOptimizeImages(crawledPages, outDir) {
  const imagesDir = path.join(outDir, 'assets', 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const imageMetadata = [];
  const seenUrls = new Set();

  for (const page of crawledPages) {
    if (!page.resources || !page.resources.images) continue;

    for (const img of page.resources.images) {
      if (!img.src || seenUrls.has(img.src)) continue;
      seenUrls.add(img.src);

      try {
        const absoluteUrl = resolveUrl(img.src, page.url);
        const buffer = await fetch(absoluteUrl).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.buffer();
        });

        // Generate SEO filename from alt text or URL
        const seoName = generateSeoFilename(img.alt || img.src);

        // Optimize to WebP and original format
        const metadata = await sharp(buffer).metadata();
        const width = metadata.width || 800;
        const height = metadata.height || 600;

        // Generate responsive sizes
        const sizes = [width, Math.round(width * 0.75), Math.round(width * 0.5)];
        const srcsetParts = [];

        for (const size of sizes) {
          const webpName = `${seoName}-${size}w.webp`;
          const webpPath = path.join(imagesDir, webpName);
          await sharp(buffer).resize(size, Math.round((height / width) * size), { fit: 'cover' }).webp({ quality: 80 }).toFile(webpPath);
          srcsetParts.push(`./assets/images/${webpName} ${size}w`);
        }

        // Also save original format as fallback
        const origName = `${seoName}-${width}w.jpg`;
        const origPath = path.join(imagesDir, origName);
        await sharp(buffer).resize(width, height, { fit: 'cover' }).jpeg({ quality: 80 }).toFile(origPath);

        imageMetadata.push({
          originalUrl: absoluteUrl,
          newFilename: origName,
          alt: img.alt,
          srcset: srcsetParts.join(', ')
        });

        console.log(`  ✓ Optimized: ${seoName}`);
      } catch (error) {
        console.warn(`  ✗ Failed to download ${img.src}: ${error.message}`);
      }
    }
  }

  return imageMetadata;
}

/**
 * Generate SEO-friendly filename from alt text or URL.
 */
function generateSeoFilename(source) {
  let name = source
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

  // Add hash suffix for uniqueness
  const hash = crypto.randomBytes(3).toString('hex');
  return `${name}-${hash}`;
}

/**
 * Resolve relative URLs to absolute.
 */
function resolveUrl(url, baseUrl) {
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  const base = new URL(baseUrl);
  if (url.startsWith('/')) return `${base.origin}${url}`;
  return new URL(url, baseUrl).href;
}

module.exports = { downloadAndOptimizeImages };
