// Après « ng build » : liste les fichiers de l'application (precache.json) pour que le service worker
// les garde hors connexion, et donne au service worker un numéro de version propre à ce build.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const dist = process.argv[2] || 'dist/elearning-frontend/browser';
const skip = new Set(['sw.js', 'precache.json', '3rdpartylicenses.txt']);

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(dist)
  .map(p => '/' + relative(dist, p).split(sep).join('/'))
  .filter(p => !skip.has(p.slice(1)) && !p.endsWith('.map'))
  .sort();

const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(dist, f)));
const version = hash.digest('hex').slice(0, 12);

writeFileSync(join(dist, 'precache.json'), JSON.stringify({ version, files: ['/', ...files] }));
const swPath = join(dist, 'sw.js');
writeFileSync(swPath, readFileSync(swPath, 'utf8').replace('__BUILD_VERSION__', version));
const size = files.reduce((n, f) => n + statSync(join(dist, f)).size, 0);
console.log(`precache : ${files.length} fichiers (${Math.round(size / 1024)} Ko), version ${version}`);
