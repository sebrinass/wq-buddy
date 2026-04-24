/**
 * 数据库工厂
 * 根据配置创建对应的数据库实例
 */

import { Database, DatabaseType, DbConfig } from './Database.js';
import { SQLiteAdapter } from './SQLiteAdapter.js';
import * as fs from 'fs';
import * as path from 'path';

let dbInstance: Database | null = null;

export async function getDatabase(config?: DbConfig): Promise<Database> {
  if (dbInstance) return dbInstance;

  const dbConfig: DbConfig = config || {
    type: process.env.DB_TYPE as DatabaseType || 'sqlite',
    path: process.env.DB_PATH || path.join(process.cwd(), 'alpha_workbench.db')
  };

  switch (dbConfig.type) {
    case 'sqlite':
      const dbPath = dbConfig.path || path.join(process.cwd(), 'alpha_workbench.db');
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
