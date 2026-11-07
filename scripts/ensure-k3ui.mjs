/**
 * GitHub installs of k3ui only ship `files` (dist/) — but dist is not on the
 * remote yet. Fill node_modules/k3ui/dist from a local clone (dev) or by
 * cloning + building (CI / Vercel).
 */
import { existsSync, cpSync, rmSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const nmK3 = join(root, 'node_modules', 'k3ui');
const distJs = join(nmK3, 'dist', 'k3ui.js');

if (!existsSync(join(nmK3, 'package.json'))) {
  console.warn('[ensure-k3ui] k3ui not in node_modules — skip');
  process.exit(0);
}

if (existsSync(distJs)) {
  console.log('[ensure-k3ui] dist already present');
  process.exit(0);
}

function copyDist(fromRoot) {
  const from = join(fromRoot, 'dist');
  if (!existsSync(join(from, 'k3ui.js'))) return false;
  mkdirSync(join(nmK3, 'dist'), { recursive: true });
  cpSync(from, join(nmK3, 'dist'), { recursive: true });
  console.log(`[ensure-k3ui] copied dist from ${fromRoot}`);
  return true;
}

const localCandidates = [
  process.env.K3UI_LOCAL,
  'D:/K3ui',
  'D:\\K3ui',
  join(root, '../K3ui'),
  join(root, '../../K3ui'),
].filter(Boolean);

for (const cand of localCandidates) {
  if (copyDist(cand)) process.exit(0);
}

const tmp = join(root, '.temp', 'k3ui-src');
console.log('[ensure-k3ui] cloning Kam3leoN/k3ui-expressive + build…');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(join(root, '.temp'), { recursive: true });
execSync(
  'git clone --depth 1 https://github.com/Kam3leoN/k3ui-expressive.git "' + tmp + '"',
  { stdio: 'inherit' },
);
execSync('npm install', { cwd: tmp, stdio: 'inherit' });
execSync('npm run build', { cwd: tmp, stdio: 'inherit' });
if (!copyDist(tmp)) {
  console.error('[ensure-k3ui] build finished but dist/k3ui.js missing');
  process.exit(1);
}
rmSync(tmp, { recursive: true, force: true });
