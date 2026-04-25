import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export const WORK_DIR = path.join(os.homedir(), '.wq-buddy');
export const CONFIG_PATH = path.join(WORK_DIR, 'config.json');
export const TOKEN_PATH = path.join(WORK_DIR, '.wq_token.json');
export const DB_PATH = path.join(WORK_DIR, 'alpha_workbench.db');

export function ensureWorkDir(): void {
  if (!fs.existsSync(WORK_DIR)) {
    fs.mkdirSync(WORK_DIR, { recursive: true });
  }
}
