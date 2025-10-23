/**
 * Package extension for specific platform with only necessary sharp binaries
 * Usage: node scripts/package-platform.js <platform>
 * Platforms: win32, darwin, linux
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const platform = process.argv[2] || process.platform;
const validPlatforms = ['win32', 'darwin', 'linux'];

if (!validPlatforms.includes(platform)) {
  console.error(`❌ Invalid platform: ${platform}`);
  console.error(`   Valid platforms: ${validPlatforms.join(', ')}`);
  process.exit(1);
}

console.log(`📦 Packaging Cappy for platform: ${platform}`);

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
const keepBinaries = platformBinaries[platform];

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
const vsixName = `cappy-${version}-${platform}.vsix`;

// Package with vsce
try {
  execSync('vsce package --dependencies --out ' + vsixName, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
  
  console.log(`\n✅ Package created: ${vsixName}`);
  console.log(`\n📥 To install: code --install-extension ${vsixName} --force`);
  
} catch (error) {
  console.error('❌ Failed to package extension:', error.message);
  process.exit(1);
}
