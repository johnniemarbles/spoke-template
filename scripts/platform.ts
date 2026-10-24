/** Thin wrapper: runs the platform repo's app-sync tool against this app. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const platformDir = resolve(process.env['PLATFORM_DIR'] ?? '../platform');
const cli = resolve(platformDir, 'core/tools/app-sync/src/cli.ts');
if (!existsSync(cli)) {
  console.error(`app-sync not found at ${cli}. Clone johnniemarbles/platform next to this repo or set PLATFORM_DIR.`);
  process.exit(2);
}
const [cmd = 'validate', ...rest] = process.argv.slice(2);
const r = spawnSync(process.execPath,
  ['--experimental-strip-types', '--no-warnings', cli, cmd, '--manifest', resolve('platform.app.json'), '--app-dir', resolve('.'), '--platform', platformDir, ...rest],
  { stdio: 'inherit' });
process.exit(r.status ?? 1);
