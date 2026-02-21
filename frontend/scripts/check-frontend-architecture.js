/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const SRC_ROOT = path.resolve(__dirname, '../src');
const EXTS = ['.js', '.jsx', '.ts', '.tsx'];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
      continue;
    }
    if (EXTS.includes(path.extname(entry.name))) {
      out.push(fullPath);
    }
  }
  return out;
}

function domainOf(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  const match = normalized.match(/^domains\/([^/]+)\//);
  return match ? match[1] : null;
}

function parseImports(source) {
  const specs = [];
  const fromRe = /(?:import|export)\s+[^'"\n]*?from\s*['"]([^'"]+)['"]/g;
  const sideEffectRe = /import\s*['"]([^'"]+)['"]/g;

  for (const re of [fromRe, sideEffectRe]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(source)) !== null) {
      specs.push(match[1]);
    }
  }
  return specs;
}

function resolveLocalImport(filePath, spec) {
  let basePath;
  if (spec.startsWith('@/')) {
    basePath = path.join(SRC_ROOT, spec.slice(2));
  } else if (spec.startsWith('./') || spec.startsWith('../')) {
    basePath = path.resolve(path.dirname(filePath), spec);
  } else {
    return null;
  }

  const candidates = [
    basePath,
    ...EXTS.map((ext) => `${basePath}${ext}`),
    ...EXTS.map((ext) => path.join(basePath, `index${ext}`))
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function main() {
  const files = walk(SRC_ROOT);
  const errors = [];
  const cssImports = new Map();

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const relFile = path.relative(SRC_ROOT, file).replace(/\\/g, '/');
    const sourceDomain = domainOf(relFile);
    const specs = parseImports(content);

    for (const spec of specs) {
      if (spec.endsWith('.css')) {
        const key = spec.startsWith('./') || spec.startsWith('../')
          ? path.normalize(path.resolve(path.dirname(file), spec))
          : spec;
        const prev = cssImports.get(key) || [];
        prev.push(relFile);
        cssImports.set(key, prev);
      }

      if (spec.startsWith('../')) {
        errors.push(`${relFile}: parent-relative import is forbidden -> ${spec}`);
      }

      if (sourceDomain && spec.includes('/pages/')) {
        errors.push(`${relFile}: domain file cannot import pages layer -> ${spec}`);
      }

      if (sourceDomain && spec.startsWith('@/domains/')) {
        const m = spec.match(/^@\/domains\/([^/]+)\//);
        const targetDomain = m ? m[1] : null;
        const allowCrossDomainToHrum = targetDomain === 'hrum';
        if (targetDomain && targetDomain !== sourceDomain && !allowCrossDomainToHrum) {
          errors.push(`${relFile}: cross-domain import ${sourceDomain} -> ${m[1]} (${spec})`);
        }
      }

      if (spec.startsWith('@/') || spec.startsWith('./') || spec.startsWith('../')) {
        const resolved = resolveLocalImport(file, spec);
        if (!resolved) {
          errors.push(`${relFile}: unresolved local import -> ${spec}`);
        }
      }
    }
  }

  for (const [spec, importers] of cssImports.entries()) {
    if (importers.length > 1) {
      errors.push(`duplicate CSS side-effect import: ${spec} <- ${importers.join(', ')}`);
    }
  }

  if (errors.length > 0) {
    console.error(`Architecture check failed (${errors.length}):`);
    for (const err of errors) {
      console.error(`- ${err}`);
    }
    process.exit(1);
  }

  console.log('Architecture check passed.');
}

main();
