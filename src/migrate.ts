/**
 * 数据库迁移工具
 * 从JSON迁移到SQLite
 */

import * as fs from 'fs';
import * as path from 'path';
import { getDatabase } from './db/index.js';
import { info } from './logger.js';
import { WORK_DIR, ensureWorkDir } from './paths.js';

export async function migrateFromJson(): Promise<void> {
  const JSON_FILE = path.join(WORK_DIR, 'alpha_records.json');
  
  if (!fs.existsSync(JSON_FILE)) {
    info('JSON文件不存在，跳过迁移');
    return;
  }

  info('开始从JSON迁移数据到SQLite...');
  
  const jsonDb = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
  const records = jsonDb.alpha_records || [];
  const dataFields = jsonDb.data_fields || [];
  const batches = jsonDb.batches || [];
  
  if (records.length === 0 && dataFields.length === 0 && batches.length === 0) {
    info('JSON数据库为空，跳过迁移');
    return;
  }

  const db = await getDatabase();
  let migratedAlphas = 0;
  let migratedFields = 0;
  let migratedBatches = 0;

  // 迁移Alpha记录
  for (const record of records) {
    try {
      await db.insertAlpha({
        alpha_id: record.alpha_id,
        expression: record.expression,
        field: record.field,
        status: record.status,
        error_message: record.error_message,
        created_at: record.created_at,
        updated_at: record.updated_at,
        settings_hash: record.settings_hash,
        sharpe: record.sharpe,
        turnover: record.turnover,
        margin: record.margin,
        returns: record.returns,
        drawdown: record.drawdown,
        fitness: record.fitness,
        pnl: record.pnl,
        bookSize: record.bookSize,
        longCount: record.longCount,
        shortCount: record.shortCount
      });
      migratedAlphas++;
    } catch (e: any) {
      // 跳过重复的记录
    }
  }

  // 迁移数据字段
  for (const field of dataFields) {
    try {
      await db.insertDataField({
        field_id: field.field_id,
        name: field.name,
        description: field.description,
        dataset_id: field.dataset_id,
        data_type: field.data_type,
        region: field.region,
        fetched_at: field.fetched_at
      });
      migratedFields++;
    } catch (e: any) {
      // 跳过重复的字段
    }
  }

  // 迁移批次
  for (const batch of batches) {
    try {
      await db.insertBatch({
        batch_name: batch.batch_name,
        description: batch.description,
        total_count: batch.total_count,
        success_count: batch.success_count,
        fail_count: batch.fail_count,
        created_at: batch.created_at,
        status: batch.status
      });
      migratedBatches++;
    } catch (e: any) {
      // 跳过重复的批次
    }
  }

  info(`迁移完成: Alpha ${migratedAlphas}/${records.length} | 字段 ${migratedFields}/${dataFields.length} | 批次 ${migratedBatches}/${batches.length}`);
  
  // 备份JSON文件
  const backupFile = path.join(WORK_DIR, `alpha_records.json.bak.${Date.now()}`);
  fs.copyFileSync(JSON_FILE, backupFile);
  info(`JSON文件已备份到: ${backupFile}`);
}
