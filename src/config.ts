import * as fs from 'fs';
import { AppConfig, Credentials, SimulationSettings } from './types.js';
import { CONFIG_PATH, ensureWorkDir } from './paths.js';

export function loadConfig(): AppConfig | null {
  try {
    ensureWorkDir();
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (e: any) {
    console.error(`配置文件加载失败: ${e.message}`);
    return null;
  }
}

export function getCredentials(config: AppConfig): Credentials {
  return config.credentials;
}

export function getDefaultSettings(config: AppConfig): SimulationSettings {
  const settings = config.default_settings as any;
  return {
    instrumentType: settings.instrument_type || 'EQUITY',
    region: settings.region || 'USA',
    universe: settings.universe || 'TOP3000',
    delay: settings.delay || 1,
    decay: settings.decay || 0,
    neutralization: settings.neutralization || 'INDUSTRY',
    truncation: settings.truncation || 0.08,
    pasteurization: settings.pasteurization || 'ON',
    unitHandling: settings.unit_handling || 'VERIFY',
    nanHandling: settings.nan_handling || 'ON',
    language: settings.language || 'FASTEXPR',
    visualization: settings.visualization || false
  };
}

export function getBatchSettings(config: AppConfig) {
  return config.batch_settings;
}
