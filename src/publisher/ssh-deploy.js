#!/usr/bin/env node

const yargs = require('yargs');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const argv = yargs
  .option('build', {
    alias: 'b',
    description: 'Path to built site directory',
    type: 'string',
    demandOption: true
  })
  .option('host', {
    alias: 'h',
    description: 'Deployment host (IP or hostname)',
    type: 'string',
    default: process.env.DEPLOY_HOST || 'localhost'
  })
  .option('user', {
    alias: 'u',
    description: 'SSH user',
    type: 'string',
    default: process.env.DEPLOY_USER || 'deploy'
  })
  .option('path', {
    alias: 'p',
    description: 'Remote path to deploy to',
    type: 'string',
    default: process.env.DEPLOY_PATH || '/var/www/site'
  })
  .option('key', {
    alias: 'k',
    description: 'Path to SSH private key',
    type: 'string',
    default: process.env.SSH_KEY_PATH || path.join(process.env.HOME, '.ssh', 'id_rsa')
  })
  .help()
  .argv;

async function deploy() {
  try {
    const buildDir = path.resolve(argv.build);
    const { host, user, path: remotePath, key } = argv;

    if (!fs.existsSync(buildDir)) {
      throw new Error(`Build directory not found: ${buildDir}`);
    }

    console.log(`\n🚀 Deploying site via SSH...`);
    console.log(`   Build dir: ${buildDir}`);
    console.log(`   Remote: ${user}@${host}:${remotePath}`);
    console.log(`   SSH key: ${key}`);

    // Ensure remote directory exists
    execSync(`ssh -i ${key} ${user}@${host} "mkdir -p ${remotePath}"`);

    // Deploy using rsync
    const rsyncCmd = `rsync -avz --delete -e "ssh -i ${key}" ${buildDir}/ ${user}@${host}:${remotePath}/`;
    console.log(`\n   Running: ${rsyncCmd}`);
    execSync(rsyncCmd, { stdio: 'inherit' });

    console.log(`\n✅ Deployment complete!`);
    console.log(`   Site deployed to: ${remotePath}`);
  } catch (error) {
    console.error(`\n❌ Deployment failed:`, error.message);
    process.exit(1);
  }
}

deploy();
