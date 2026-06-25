#!/usr/bin/env node
// Font codemod: Inter → Roboto, JetBrains Mono → Roboto Mono across all apps/*/
// Run from the junkyard worktree root with: bun run scripts/font-codemod.mjs

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

const ROBOTO_VERSION = "^5.2.10";
const ROBOTO_MONO_VERSION = "^5.2.9";

// Weight remap: old inter weight → new roboto weight
const WEIGHT_REMAP = { "600": "500", "800": "700" };

// Import remap (dedup handled after)
const IMPORT_MAP = {
  '@fontsource/inter/400.css': '@fontsource/roboto/400.css',
  '@fontsource/inter/500.css': '@fontsource/roboto/500.css',
  '@fontsource/inter/600.css': '@fontsource/roboto/500.css',
  '@fontsource/inter/800.css': '@fontsource/roboto/700.css',
  '@fontsource/jetbrains-mono/400.css': '@fontsource/roboto-mono/400.css',
  '@fontsource/jetbrains-mono/500.css': '@fontsource/roboto-mono/500.css',
};

function getApps() {
  return readdirSync("apps").filter(d => statSync(join("apps", d)).isDirectory());
}

function processImports(content) {
  // Replace each import (handles both single and double quotes)
  for (const [from, to] of Object.entries(IMPORT_MAP)) {
    const escaped = from.replace(/\//g, '\\/').replace(/\./g, '\\.');
    content = content.replace(new RegExp(`import ["']${escaped}["'];?`, 'g'), `import "${to}";`);
  }
  
  // Deduplicate consecutive identical import lines
  const lines = content.split('\n');
  const deduped = [];
  for (let i = 0; i < lines.length; i++) {
    if (i > 0 && lines[i] === lines[i-1] && lines[i].trim().startsWith('import "@fontsource/')) {
      // skip duplicate
      continue;
    }
    deduped.push(lines[i]);
  }
  return deduped.join('\n');
}

function processCSS(content) {
  // CSS vars
  content = content.replace(/"Inter",/g, '"Roboto",');
  content = content.replace(/"JetBrains Mono",/g, '"Roboto Mono",');
  // Also handle single-quoted
  content = content.replace(/'Inter',/g, "'Roboto',");
  content = content.replace(/'JetBrains Mono',/g, "'Roboto Mono',");
  
  // Font-weight remap (600 → 500, 800 → 700)
  content = content.replace(/font-weight:\s*600\b/g, 'font-weight: 500');
  content = content.replace(/font-weight:\s*800\b/g, 'font-weight: 700');
  
  return content;
}

function processTS(content) {
  // Replace literal font family references in JS/TS
  content = content.replace(/"Inter"/g, '"Roboto"');
  content = content.replace(/'Inter'/g, "'Roboto'");
  // "Inter, system-ui..." without quotes around just Inter
  content = content.replace(/Inter, system-ui/g, 'Roboto, system-ui');
  content = content.replace(/"JetBrains Mono"/g, '"Roboto Mono"');
  content = content.replace(/'JetBrains Mono'/g, "'Roboto Mono'");
  return content;
}

function processHTMLOrMixed(content) {
  // For make-og.html and similar - replace Google Fonts URL and direct CSS refs
  content = content.replace(
    /family=Inter:wght@[^&"']*/g,
    'family=Roboto:wght@400;500;700'
  );
  content = content.replace(
    /family=JetBrains\+Mono:wght@[^&"']*/g,
    'family=Roboto+Mono:wght@400;500;700'
  );
  content = content.replace(/'Inter'/g, "'Roboto'");
  content = content.replace(/"Inter"/g, '"Roboto"');
  content = content.replace(/'JetBrains Mono'/g, "'Roboto Mono'");
  content = content.replace(/"JetBrains Mono"/g, '"Roboto Mono"');
  content = content.replace(/font-weight:\s*600\b/g, 'font-weight: 500');
  content = content.replace(/font-weight:\s*800\b/g, 'font-weight: 700');
  return content;
}

// Find the entry file(s) that have @fontsource imports for an app
function findEntryFiles(appDir) {
  const srcDir = join(appDir, "src");
  if (!existsSync(srcDir)) return [];
  
  const candidates = [];
  function walk(dir) {
    for (const f of readdirSync(dir)) {
      const full = join(dir, f);
      const st = statSync(full);
      if (st.isDirectory() && !['node_modules', 'dist', 'build', '.svelte-kit'].includes(f)) {
        walk(full);
      } else if (st.isFile() && /\.(ts|tsx|js|jsx|css|svelte)$/.test(f)) {
        const content = readFileSync(full, 'utf8');
        if (content.includes('@fontsource/inter') || content.includes('@fontsource/jetbrains')) {
          candidates.push(full);
        }
      }
    }
  }
  walk(srcDir);
  return candidates;
}

// Walk all source files (non-node_modules/dist)
function walkSrc(appDir, callback) {
  const srcDir = join(appDir, "src");
  if (!existsSync(srcDir)) return;
  function walk(dir) {
    for (const f of readdirSync(dir)) {
      const full = join(dir, f);
      const st = statSync(full);
      if (st.isDirectory() && !['node_modules', 'dist', 'build'].includes(f)) {
        walk(full);
      } else if (st.isFile()) {
        callback(full);
      }
    }
  }
  walk(srcDir);
  
  // Also check scripts/ subdirectory in app
  const scriptsDir = join(appDir, "scripts");
  if (existsSync(scriptsDir)) {
    function walkScripts(dir) {
      for (const f of readdirSync(dir)) {
        const full = join(dir, f);
        const st = statSync(full);
        if (st.isDirectory()) {
          walkScripts(full);
        } else if (st.isFile()) {
          callback(full);
        }
      }
    }
    walkScripts(scriptsDir);
  }
}

function transformFile(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  let content = readFileSync(filePath, 'utf8');
  const original = content;
  
  if (ext === 'css') {
    content = processCSS(content);
    // Also handle imports in CSS files
    content = processImports(content);
  } else if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
    content = processImports(content);
    content = processTS(content);
  } else if (['svelte'].includes(ext)) {
    content = processImports(content);
    content = processTS(content);
    content = processCSS(content);
  } else if (ext === 'html') {
    content = processHTMLOrMixed(content);
  }
  
  if (content !== original) {
    writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

function updatePackageJson(appDir) {
  const pkgPath = join(appDir, "package.json");
  if (!existsSync(pkgPath)) return false;
  
  let pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  let changed = false;
  
  // Check if any remaining inter/jetbrains references exist after transform
  let hasInter = false, hasJetbrains = false;
  walkSrc(appDir, (f) => {
    if (/node_modules|\/dist\//.test(f)) return;
    const c = readFileSync(f, 'utf8');
    if (c.includes('@fontsource/inter')) hasInter = true;
    if (c.includes('@fontsource/jetbrains-mono')) hasJetbrains = true;
  });
  
  // Add roboto
  if (!pkg.dependencies?.['@fontsource/roboto']) {
    pkg.dependencies = pkg.dependencies || {};
    pkg.dependencies['@fontsource/roboto'] = ROBOTO_VERSION;
    changed = true;
  }
  if (!pkg.dependencies?.['@fontsource/roboto-mono']) {
    pkg.dependencies = pkg.dependencies || {};
    pkg.dependencies['@fontsource/roboto-mono'] = ROBOTO_MONO_VERSION;
    changed = true;
  }
  
  // Remove inter/jetbrains if no longer referenced
  if (!hasInter && pkg.dependencies?.['@fontsource/inter']) {
    delete pkg.dependencies['@fontsource/inter'];
    changed = true;
    console.log(`  Removed @fontsource/inter from ${appDir}`);
  }
  if (!hasJetbrains && pkg.dependencies?.['@fontsource/jetbrains-mono']) {
    delete pkg.dependencies['@fontsource/jetbrains-mono'];
    changed = true;
    console.log(`  Removed @fontsource/jetbrains-mono from ${appDir}`);
  }
  
  if (changed) {
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    return true;
  }
  return false;
}

// Main
const apps = getApps();
console.log(`Processing ${apps.length} apps...`);

let totalChanged = 0;
const appSummary = [];

for (const app of apps) {
  const appDir = join("apps", app);
  let filesChanged = [];
  
  walkSrc(appDir, (filePath) => {
    if (/node_modules|\/dist\/|\/build\//.test(filePath)) return;
    if (transformFile(filePath)) {
      filesChanged.push(filePath.replace(appDir + '/', ''));
    }
  });
  
  const pkgChanged = updatePackageJson(appDir);
  
  if (filesChanged.length > 0 || pkgChanged) {
    totalChanged++;
    appSummary.push({ app, filesChanged: filesChanged.length + (pkgChanged ? 1 : 0) });
    console.log(`✓ ${app}: ${filesChanged.length} source files + ${pkgChanged ? 'package.json' : 'no pkg change'}`);
  } else {
    console.log(`- ${app}: no changes`);
  }
}

console.log(`\nDone: ${totalChanged}/${apps.length} apps changed`);
