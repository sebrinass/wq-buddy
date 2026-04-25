/**
 * 数据库工厂
 * 根据配置创建对应的数据库实例
 */

import { Database, DatabaseType, DbConfig } from './Database.js';
import { SQLiteAdapter } from './SQLiteAdapter.js';
import { DB_PATH, ensureWorkDir } from '../paths.js';
import * as fs from 'fs';

let dbInstance: Database | null = null;

export async function getDatabase(config?: DbConfig): Promise<Database> {
  if (dbInstance) return dbInstance;

  ensureWorkDir();

  const dbConfig: DbConfig = config || {
    type: process.env.DB_TYPE as DatabaseType || 'sqlite',
    path: process.env.DB_PATH || DB_PATH
  };

  switch (dbConfig.type) {
    case 'sqlite':
      const dbPath = dbConfig.path || DB_PATH;
      dbInstance = new SQLiteAdapter(dbPath);
      await dbInstance.init();
      break;
    default:
      throw new Error(`不支持的数据库类型: ${dbConfig.type}`);
  }

  return dbInstance;
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}
