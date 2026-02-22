const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Explicitly set project root so Metro never falls back to the monorepo root
config.projectRoot = projectRoot;

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Let Metro know where to resolve packages from
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(monorepoRoot, 'node_modules'),
];

// Ensure react-native condition is used for package exports (e.g., axios)
config.resolver.unstable_conditionNames = [
    'react-native',
    'browser',
    'require',
    'import',
];

// Enable package.json exports field resolution
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
