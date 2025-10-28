/**
 * Package extension for specific platform with only necessary sharp binaries
 * Usage: node scripts/package-platform.js <platform|target>
 * Examples:
 *   - node scripts/package-platform.js darwin            (legacy: packs generic darwin, not recommended)
 *   - node scripts/package-platform.js darwin-x64        (recommended: platform-specific)
 *   - node scripts/package-platform.js darwin-arm64
 *   - node scripts/package-platform.js win32-x64
 *   - node scripts/package-platform.js linux-x64
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const arg = process.argv[2] || process.platform;
// Support targets like darwin-x64, darwin-arm64, win32-x64, linux-x64, linux-arm64
const validPlatforms = ['win32', 'darwin', 'linux'];
const validTargets = [
  'darwin-x64', 'darwin-arm64',
  'win32-x64', 'win32-ia32', 'win32-arm64',
  'linux-x64', 'linux-arm64', 'linux-arm'
];

// Determine platform and optional arch from arg
let platform = arg;
let target = null;
if (validTargets.includes(arg)) {
  const [plat] = arg.split('-');
  platform = plat;
  target = arg; // full target string for vsce --target
}

if (!validPlatforms.includes(platform)) {
  console.error(`❌ Invalid platform: ${platform}`);
  console.error(`   Valid platforms: ${validPlatforms.join(', ')}`);
  console.error(`   Or full targets: ${validTargets.join(', ')}`);
  process.exit(1);
}

const packagingFor = target ? 'target: ' + target : 'platform: ' + platform;
console.log('📦 Packaging Cappy for ' + packagingFor);

// Define which sharp binaries to keep for each platform
const platformBinaries = {
  win32: [
    '@img/sharp-win32-x64',
    '@img/sharp-win32-ia32',
    '@img/sharp-win32-arm64',
    '@img/sharp-libvips-win32-x64',
  ],
  darwin: [
    '@img/sharp-darwin-x64',
    '@img/sharp-darwin-arm64',
    '@img/sharp-libvips-darwin-x64',
    '@img/sharp-libvips-darwin-arm64',
  ],
  linux: [
    '@img/sharp-linux-x64',
    '@img/sharp-linux-arm64',
    '@img/sharp-linux-arm',
    '@img/sharp-libvips-linux-x64',
    '@img/sharp-libvips-linux-arm64',
    '@img/sharp-libvips-linux-arm',
    '@img/sharp-linuxmusl-x64',
    '@img/sharp-linuxmusl-arm64',
    '@img/sharp-libvips-linuxmusl-x64',
    '@img/sharp-libvips-linuxmusl-arm64',
  ],
};

// Get all sharp platform packages
const sharpPackages = [
  '@img/sharp-darwin-arm64',
  '@img/sharp-darwin-x64',
  '@img/sharp-linux-arm64',
  '@img/sharp-linux-arm',
  '@img/sharp-linux-x64',
  '@img/sharp-linuxmusl-arm64',
  '@img/sharp-linuxmusl-x64',
  '@img/sharp-win32-arm64',
  '@img/sharp-win32-ia32',
  '@img/sharp-win32-x64',
  '@img/sharp-libvips-darwin-arm64',
  '@img/sharp-libvips-darwin-x64',
  '@img/sharp-libvips-linux-arm',
  '@img/sharp-libvips-linux-arm64',
  '@img/sharp-libvips-linux-x64',
  '@img/sharp-libvips-linuxmusl-arm64',
  '@img/sharp-libvips-linuxmusl-x64',
];

const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
// If an architecture-specific target is provided, further narrow binaries
const keepBinaries = (() => {
  const base = platformBinaries[platform];
  if (!target) return base;
  const arch = target.split('-')[1];
  const filters = {
    darwin: {
      x64: ['@img/sharp-darwin-x64', '@img/sharp-libvips-darwin-x64'],
      arm64: ['@img/sharp-darwin-arm64', '@img/sharp-libvips-darwin-arm64']
    },
    win32: {
      x64: ['@img/sharp-win32-x64', '@img/sharp-libvips-win32-x64'],
      ia32: ['@img/sharp-win32-ia32'],
      arm64: ['@img/sharp-win32-arm64']
    },
    linux: {
      x64: ['@img/sharp-linux-x64', '@img/sharp-libvips-linux-x64'],
      arm64: ['@img/sharp-linux-arm64', '@img/sharp-libvips-linux-arm64'],
      arm: ['@img/sharp-linux-arm', '@img/sharp-libvips-linux-arm']
    }
  };
  const allow = filters[platform]?.[arch];
  if (allow && Array.isArray(allow)) return allow;
  return base;
})();

console.log(`🗑️  Removing sharp binaries for other platforms...`);

let removedCount = 0;
for (const pkg of sharpPackages) {
  if (!keepBinaries.includes(pkg)) {
    const pkgPath = path.join(nodeModulesPath, pkg);
    if (fs.existsSync(pkgPath)) {
      console.log(`  Removing ${pkg}...`);
      fs.rmSync(pkgPath, { recursive: true, force: true });
      removedCount++;
    }
  }
}

console.log(`✅ Removed ${removedCount} unnecessary sharp binaries`);
console.log(`📦 Building extension package...`);

// Get package version
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const version = packageJson.version;
const vsixName = target ? `cappy-${version}-${target}.vsix` : `cappy-${version}-${platform}.vsix`;

// Package with vsce
try {
  // If target specified, embed it so Marketplace accepts platform-specific uploads for same version
  const cmd = target
    ? `vsce package --dependencies --target ${target} --out ${vsixName}`
    : `vsce package --dependencies --out ${vsixName}`;
  execSync(cmd, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
  
  console.log(`\n✅ Package created: ${vsixName}`);
  console.log(`\n📥 To install: code --install-extension ${vsixName} --force`);
  
} catch (error) {
  console.error('❌ Failed to package extension:', error.message);
  process.exit(1);
}
