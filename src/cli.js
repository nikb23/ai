#!/usr/bin/env node

const yargs = require('yargs');
const path = require('path');
const fs = require('fs');
const { generateSite } = require('./generator');

const argv = yargs
  .option('prompt', {
    alias: 'p',
    description: 'Prompt describing the site to build (e.g., "Recreate homepage from https://example.com")',
    type: 'string',
    demandOption: true
  })
  .option('url', {
    alias: 'u',
    description: 'Source URL(s) to crawl (space-separated or comma-separated)',
    type: 'string',
    demandOption: true
  })
  .option('out', {
    alias: 'o',
    description: 'Output directory for generated site',
    type: 'string',
    default: './build/site'
  })
  .option('site-name', {
    alias: 's',
    description: 'Site name for reporting and branch naming (default: sanitized prompt)',
    type: 'string'
  })
  .option('llm', {
    alias: 'l',
    description: 'LLM provider for alt-text generation: openai | gemini | anthropic (default: local)',
    type: 'string',
    default: 'local'
  })
  .help()
  .argv;

async function main() {
  try {
    const urls = argv.url.split(/[\s,]+/).filter(Boolean);
    const siteName = argv['site-name'] || argv.prompt.slice(0, 20).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const outDir = path.resolve(argv.out);

    console.log(`\n🚀 Starting site generation...`);
    console.log(`   Prompt: ${argv.prompt}`);
    console.log(`   URLs: ${urls.join(', ')}`);
    console.log(`   Site name: ${siteName}`);
    console.log(`   Output: ${outDir}`);
    console.log(`   LLM: ${argv.llm}`);

    // Ensure output directory exists
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const result = await generateSite({
      prompt: argv.prompt,
      urls,
      outDir,
      siteName,
      llmProvider: argv.llm
    });

    console.log(`\n✅ Site generation complete!`);
    console.log(`   Output directory: ${result.outDir}`);
    console.log(`   Assets: ${result.assetCount} files`);
    console.log(`   Pages: ${result.pageCount} HTML files`);
    console.log(`   Image mapping: ${result.imageMappingPath}`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Preview locally: npx serve ${outDir}`);
    console.log(`   2. Review image mapping: ${result.imageMappingPath}`);
    console.log(`   3. Deploy: node ./src/publisher/ssh-deploy.js --build ${outDir}`);
  } catch (error) {
    console.error(`\n❌ Error during site generation:`, error.message);
    process.exit(1);
  }
}

main();
