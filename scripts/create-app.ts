import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg?.startsWith('--')) {
      const key = arg.slice(2);
      const val = args[i + 1];
      if (val && !val.startsWith('--')) {
        result[key] = val;
        i++;
      }
    }
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));
const slug = args['slug'];
const name = args['name'];
const modulesArg = args['modules'];

if (!slug || !name) {
  console.error('Usage: node --experimental-strip-types scripts/create-app.ts --slug <slug> --name "<App Name>" [--modules m1,m2]');
  process.exit(1);
}

if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error(`Invalid slug: "${slug}". Must be lowercase alphanumeric separated by single hyphens.`);
  process.exit(1);
}

const rootDir = resolve(import.meta.dirname, '..');
const appId = `app_${slug.replace(/-/g, '_')}`;

// 1. Update root package.json name
const pkgPath = resolve(rootDir, 'package.json');
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.name = slug;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

// 2. Read registry from platform if accessible, or default to ^0.1.0
const platformModulesPath = resolve(rootDir, '../platform/core/registry/modules.json');
let registryModules: Record<string, { contractVersion: string }> = {};
if (existsSync(platformModulesPath)) {
  try {
    const reg = JSON.parse(readFileSync(platformModulesPath, 'utf8'));
    registryModules = reg.modules ?? {};
  } catch {
    // ignore
  }
}

const requestedModules = modulesArg ? modulesArg.split(',').map((s) => s.trim()).filter(Boolean) : [];
const modulesList = requestedModules.map((mod) => ({
  id: mod,
  version: `^${registryModules[mod]?.contractVersion ?? '0.1.0'}`,
}));

// 3. Fill platform.app.json
const manifestPath = resolve(rootDir, 'platform.app.json');
const manifest = {
  manifestVersion: 1,
  appId,
  slug,
  displayName: name,
  modules: modulesList,
  entities: [],
  identityClients: {
    dev: [
      {
        provider: 'dev',
        poolId: 'dev',
        clientId: `dev-${slug}`,
      },
    ],
  },
};
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

// 4. Update index.html and README.md
const htmlPath = resolve(rootDir, 'apps/web/index.html');
if (existsSync(htmlPath)) {
  const html = readFileSync(htmlPath, 'utf8').replace(/<title>.*?<\/title>/, `<title>${name}</title>`);
  writeFileSync(htmlPath, html);
}

const readmePath = resolve(rootDir, 'README.md');
if (existsSync(readmePath)) {
  let readme = readFileSync(readmePath, 'utf8');
  readme = readme.replace(/spoke-template/g, slug).replace(/# Spoke Template/g, `# ${name}`);
  writeFileSync(readmePath, readme);
}

// 5. Delete this script
try {
  unlinkSync(resolve(import.meta.dirname, 'create-app.ts'));
} catch {
  // ignore
}

console.log(`\nCreated app "${name}" (${slug}) successfully.`);
console.log(`App ID: ${appId}`);
console.log('\nNext steps:');
console.log('  1. pnpm run platform:validate');
console.log('  2. pnpm run platform:plan');
console.log('  3. pnpm run platform:sync');
console.log('  4. pnpm run platform:seed-dev');
console.log('  5. pnpm --filter web dev\n');
