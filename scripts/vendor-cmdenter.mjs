/**
 * Vendors kit/components/useCmdEnter.ts into every app's src/components/ directory.
 * Run: node scripts/vendor-cmdenter.mjs
 * CI checks that vendored copies match the canonical source.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, dirname, basename } from 'path';

const ROOT = resolve(import.meta.dirname, "..");
const CANONICAL = resolve(ROOT, "kit/components/useCmdEnter.ts");

// Get app directories
const allItems = readdirSync(resolve(ROOT, "apps"), { withFileTypes: true });
const appDirs = allItems
  .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
  .map(dirent => `apps/${dirent.name}/`);

for (const dir of appDirs) {
  const target = resolve(ROOT, dir, "src/components/useCmdEnter.ts");
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(CANONICAL, target);
}

console.log(`Vendored useCmdEnter.ts into ${appDirs.length} apps`);
