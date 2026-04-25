/**
 * SQLite数据库实现
 */

import { Database as DatabaseInterface, AlphaRecord, FieldAnalysis, DbStats, DataField, BatchRecord, AlphaStatsOptions, AlphaStatsResult, GroupStats, MetricStats, MetricDistribution } from './Database.js';
import { info } from '../logger.js';
import { BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { eq, and, desc, asc, like, gt, lt, gte, lte, isNotNull } from 'drizzle-orm';
import * as createCsvWriter from 'csv-writer';

// 定义表结构
const alphas = sqliteTable('alphas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  alpha_id: text('alpha_id'),
  expression: text('expression').notNull(),
  field: text('field').notNull(),
  status: text('status').notNull(),
  error_message: text('error_message'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  settings_hash: text('settings_hash'),
  sharpe: real('sharpe'),
  turnover: real('turnover'),
  margin: real('margin'),
  returns: real('returns'),
  drawdown: real('drawdown'),
  fitness: real('fitness'),
  pnl: real('pnl'),
  bookSize: real('book_size'),
  longCount: integer('long_count'),
  shortCount: integer('short_count'),
  
  // IS测试相关字段
  checks: text('checks'),           // JSON格式的IS检查结果数组
  stage: text('stage'),             // IS / OOS / PROD
  grade: text('grade'),             // INFERIOR / GOOD / EXCELLENT / AVERAGE
  submit_status: text('submit_status'), // 未提交 | 可提交(待查) | 已通过 | 提交失败
  
  // 自相关性（手动填写）
  correlation_max: real('correlation_max'),   // Maximum相关性
  correlation_min: real('correlation_min'),   // Minimum相关性
  
  // 失败原因/备注（手动填写）
  reject_reason: text('reject_reason')        // 提交失败的原因说明
});

const fieldAnalyses = sqliteTable('field_analyses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  field_name: text('field_name').notNull().unique(),
  coverage: real('coverage'),
  update_freq: text('update_freq'),
  data_range: text('data_range'),
  ai_summary: text('ai_summary'),
  last_tested: text('last_tested'),
  created_at: text('created_at').notNull()
});

const dataFields = sqliteTable('data_fields', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  field_id: text('field_id').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  dataset_id: text('dataset_id'),
  data_type: text('data_type'),
  region: text('region'),
  fetched_at: text('fetched_at').notNull()
});

const batches = sqliteTable('batches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  batch_name: text('batch_name').notNull(),
  description: text('description'),
  total_count: integer('total_count').notNull(),
  success_count: integer('success_count').default(0),
  fail_count: integer('fail_count').default(0),
  created_at: text('created_at').notNull(),
  status: text('status').notNull().default('running')
});

export class SQLiteAdapter implements DatabaseInterface {
  private db: BetterSQLite3Database;
  private sqlite: BetterSqlite3.Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.sqlite = new BetterSqlite3(dbPath);
    this.sqlite.pragma('journal_mode = WAL');
    this.db = drizzle(this.sqlite);
  }

  async init(): Promise<void> {
    // 创建表
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS alphas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alpha_id TEXT,
        expression TEXT NOT NULL,
        field TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        settings_hash TEXT,
        sharpe REAL,
        turnover REAL,
        margin REAL,
        returns REAL,
        drawdown REAL,
        fitness REAL,
        pnl REAL,
        book_size REAL,
        long_count INTEGER,
        short_count INTEGER,
        
        -- IS测试相关字段
        checks TEXT,
        stage TEXT,
        grade TEXT,
        submit_status TEXT,
        
        -- 自相关性（手动填写）
        correlation_max REAL,
        correlation_min REAL,
        
        -- 失败原因/备注
        reject_reason TEXT
      );

      CREATE TABLE IF NOT EXISTS field_analyses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        field_name TEXT NOT NULL UNIQUE,
        coverage REAL,
        update_freq TEXT,
        data_range TEXT,
        ai_summary TEXT,
        last_tested TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS data_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        field_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        dataset_id TEXT,
        data_type TEXT,
        region TEXT,
        fetched_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_name TEXT NOT NULL,
        description TEXT,
        total_count INTEGER NOT NULL,
        success_count INTEGER DEFAULT 0,
        fail_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running'
      );

      CREATE INDEX IF NOT EXISTS idx_alphas_expression ON alphas(expression);
      CREATE INDEX IF NOT EXISTS idx_alphas_status ON alphas(status);
      CREATE INDEX IF NOT EXISTS idx_alphas_sharpe ON alphas(sharpe);
      CREATE INDEX IF NOT EXISTS idx_field_analyses_name ON field_analyses(field_name);
      CREATE INDEX IF NOT EXISTS idx_data_fields_field_id ON data_fields(field_id);
      CREATE INDEX IF NOT EXISTS idx_data_fields_dataset ON data_fields(dataset_id);
      CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
    `);
    
    // 数据库升级：为旧数据库添加新列
    try {
      const columns = this.sqlite.prepare("PRAGMA table_info(alphas)").all() as any[];
      const columnNames = columns.map((c: any) => c.name);
      
      if (!columnNames.includes('checks')) {
        this.sqlite.exec("ALTER TABLE alphas ADD COLUMN checks TEXT");
      }
      if (!columnNames.includes('stage')) {
        this.sqlite.exec("ALTER TABLE alphas ADD COLUMN stage TEXT");
      }
      if (!columnNames.includes('grade')) {
        this.sqlite.exec("ALTER TABLE alphas ADD COLUMN grade TEXT");
      }
      if (!columnNames.includes('submit_status')) {
        this.sqlite.exec("ALTER TABLE alphas ADD COLUMN submit_status TEXT");
      }
      if (!columnNames.includes('correlation_max')) {
        this.sqlite.exec("ALTER TABLE alphas ADD COLUMN correlation_max REAL");
      }
      if (!columnNames.includes('correlation_min')) {
        this.sqlite.exec("ALTER TABLE alphas ADD COLUMN correlation_min REAL");
      }
      if (!columnNames.includes('reject_reason')) {
        this.sqlite.exec("ALTER TABLE alphas ADD COLUMN reject_reason TEXT");
      }
    } catch (e) {
      // 忽略升级错误
    }
    
    info('SQLite数据库初始化完成', this.dbPath);
  }

  async close(): Promise<void> {
    this.sqlite.close();
  }

  // Alpha操作
  async insertAlpha(record: Omit<AlphaRecord, 'id'>): Promise<number> {
    const result = this.db.insert(alphas).values({
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
      shortCount: record.shortCount,
      
      // IS测试相关字段
      checks: record.checks ? JSON.stringify(record.checks) : null,
      stage: record.stage || null,
      grade: record.grade || null,
      submit_status: record.submitStatus || null,
      
      // 自相关性（手动填写）
      correlation_max: record.correlationMax || null,
      correlation_min: record.correlationMin || null,
      
      // 失败原因/备注
      reject_reason: record.rejectReason || null
    }).run();

    return result.lastInsertRowid as number;
  }

  async updateAlphaStatus(id: number, status: string, alphaId?: string, errorMessage?: string): Promise<void> {
    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (alphaId !== undefined) updateData.alpha_id = alphaId;
    if (errorMessage !== undefined) updateData.error_message = errorMessage;
    
    this.db.update(alphas).set(updateData).where(eq(alphas.id, id)).run();
  }

  async updateCorrelation(id: number, max: number, min: number): Promise<void> {
    this.db.update(alphas).set({
      correlation_max: max,
      correlation_min: min,
      updated_at: new Date().toISOString()
    }).where(eq(alphas.id, id)).run();
    
    info(`已更新Alpha ID=${id} 的自相关性: Max=${max}, Min=${min}`);
  }

  async updateSubmitStatus(id: number, status: string, rejectReason?: string): Promise<void> {
    const updateData: any = { 
      submit_status: status, 
      updated_at: new Date().toISOString() 
    };
    
    if (rejectReason !== undefined) {
      updateData.reject_reason = rejectReason;
    }
    
    this.db.update(alphas).set(updateData).where(eq(alphas.id, id)).run();
    
    info(`已更新Alpha ID=${id} 的提交状态: ${status}${rejectReason ? ' | 原因: ' + rejectReason : ''}`);
  }

  async getAlpha(id: number): Promise<AlphaRecord | null> {
    const result = this.db.select().from(alphas).where(eq(alphas.id, id)).get();
    return result ? this.mapToAlphaRecord(result) : null;
  }

  async searchAlphas(filters: Record<string, string>): Promise<AlphaRecord[]> {
    let query = this.db.select().from(alphas);
    const conditions: any[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (key in alphas) {
        const isNumeric = !isNaN(parseFloat(value));
        const isComparison = value.startsWith('>') || value.startsWith('<') || value.startsWith('=');

        if (isComparison && isNumeric) {
          const operator = value[0];
          const threshold = parseFloat(value.substring(1));
          const col = (alphas as any)[key];

          switch (operator) {
            case '>': conditions.push(gt(col, threshold)); break;
            case '<': conditions.push(lt(col, threshold)); break;
            case '=': conditions.push(eq(col, threshold)); break;
          }
        } else {
          conditions.push(like((alphas as any)[key], `%${value}%`));
        }
      }
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = query.all();
    return results.map(r => this.mapToAlphaRecord(r));
  }

  async sortAlphas(sortBy: string, order: 'asc' | 'desc' = 'desc'): Promise<AlphaRecord[]> {
    const col = (alphas as any)[sortBy];
    if (!col) return [];

    const orderBy = order === 'desc' ? desc(col) : asc(col);
    const results = this.db.select().from(alphas).orderBy(orderBy).all();
    return results.map(r => this.mapToAlphaRecord(r));
  }

  async getAlphaStats(): Promise<DbStats> {
    const countResult = this.sqlite.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count, SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) as failed_count FROM alphas").get() as any;

    const sharpeResult = this.sqlite.prepare("SELECT AVG(sharpe) as avg_sharpe, MAX(sharpe) as best_sharpe FROM alphas WHERE status = 'success' AND sharpe IS NOT NULL").get() as any;

    return {
      total_alphas: countResult.total || 0,
      success_count: countResult.success_count || 0,
      failed_count: countResult.failed_count || 0,
      avg_sharpe: sharpeResult.avg_sharpe ?? undefined,
      best_sharpe: sharpeResult.best_sharpe ?? undefined
    };
  }

  async getAlphaStatsAdvanced(options?: AlphaStatsOptions): Promise<AlphaStatsResult> {
    const opts = {
      limit: options?.limit ?? 100,
      offset: options?.offset ?? 0,
      groupBy: options?.groupBy ?? 'none',
      statusFilter: options?.statusFilter ?? '',
      dateFrom: options?.dateFrom ?? '',
      dateTo: options?.dateTo ?? ''
    };

    const conditions: string[] = [];
    const params: any[] = [];

    if (opts.statusFilter) {
      conditions.push('status = ?');
      params.push(opts.statusFilter);
    }
    if (opts.dateFrom) {
      conditions.push('created_at >= ?');
      params.push(opts.dateFrom);
    }
    if (opts.dateTo) {
      conditions.push('created_at <= ?');
      params.push(opts.dateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const groupColMap: Record<string, string> = {
      'field': 'field',
      'expression': 'expression',
      'status': 'status',
      'submit_status': 'submit_status',
      'none': ''
    };
    const groupCol = groupColMap[opts.groupBy] || '';

    const limitClause = opts.limit > 0 ? `LIMIT ${opts.limit}` : '';
    const offsetClause = opts.offset > 0 ? `OFFSET ${opts.offset}` : '';

    const rawDataQuery = `
      SELECT field, status, submit_status, sharpe, turnover, fitness, returns, drawdown
      FROM alphas
      ${whereClause}
      ORDER BY id DESC
      ${limitClause}
      ${offsetClause}
    `;
    const rawData = this.sqlite.prepare(rawDataQuery).all(...params) as any[];

    const overallStats = this.computeGroupStats('overall', 'all', rawData);

    let groupStats: GroupStats[] = [];
    if (opts.groupBy !== 'none' && groupCol) {
      const groups = new Map<string, any[]>();
      for (const row of rawData) {
        const key = String(row[groupCol] ?? '(unknown)');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }

      for (const [groupValue, rows] of groups) {
        groupStats.push(this.computeGroupStats(groupCol, groupValue, rows));
      }

      groupStats.sort((a, b) => b.totalCount - a.totalCount);
    }

    return {
      totalGroups: groupStats.length,
      overallStats,
      groupStats
    };
  }

  private computeGroupStats(groupKey: string, groupValue: string, rows: any[]): GroupStats {
    const totalCount = rows.length;
    const successCount = rows.filter(r => r.status === 'success').length;
    const failCount = totalCount - successCount;

    const submitStatusCounts: Record<string, number> = {};
    for (const row of rows) {
      const s = row.submit_status || '未提交';
      submitStatusCounts[s] = (submitStatusCounts[s] || 0) + 1;
    }

    return {
      groupKey,
      groupValue,
      totalCount,
      successCount,
      failCount,
      submitStatusCounts,
      sharpe: this.computeMetricStats(rows, 'sharpe', this.sharpeBuckets, 'max'),
      turnover: this.computeMetricStats(rows, 'turnover', this.turnoverBuckets, 'max'),
      fitness: this.computeMetricStats(rows, 'fitness', this.fitnessBuckets, 'max'),
      returns: this.computeMetricStats(rows, 'returns', this.returnsBuckets, 'max'),
      drawdown: this.computeMetricStats(rows, 'drawdown', this.drawdownBuckets, 'min')
    };
  }

  private computeMetricStats(
    rows: any[],
    column: string,
    buckets: { label: string; test: (v: number) => boolean }[],
    bestDirection: 'max' | 'min'
  ): MetricStats {
    const values = rows
      .map(r => r[column])
      .filter((v: any) => v !== null && v !== undefined) as number[];

    if (values.length === 0) {
      return {
        avg: 0,
        median: 0,
        best: 0,
        distribution: buckets.map(b => ({ label: b.label, count: 0, percentage: 0 }))
      };
    }

    const sum = values.reduce((a: number, b: number) => a + b, 0);
    const avg = sum / values.length;

    const sorted = [...values].sort((a: number, b: number) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    const best = bestDirection === 'max' ? Math.max(...values) : Math.min(...values);

    const distribution: MetricDistribution[] = buckets.map(b => {
      const count = values.filter((v: number) => b.test(v)).length;
      return {
        label: b.label,
        count,
        percentage: values.length > 0 ? Math.round(count / values.length * 100) : 0
      };
    });

    return { avg, median, best, distribution };
  }

  private sharpeBuckets = [
    { label: '≤0', test: (v: number) => v <= 0 },
    { label: '0~0.5', test: (v: number) => v > 0 && v <= 0.5 },
    { label: '0.5~1', test: (v: number) => v > 0.5 && v <= 1 },
    { label: '1~1.5', test: (v: number) => v > 1 && v <= 1.5 },
    { label: '>1.5', test: (v: number) => v > 1.5 }
  ];

  private turnoverBuckets = [
    { label: '≤0.1', test: (v: number) => v <= 0.1 },
    { label: '0.1~0.3', test: (v: number) => v > 0.1 && v <= 0.3 },
    { label: '0.3~0.5', test: (v: number) => v > 0.3 && v <= 0.5 },
    { label: '0.5~0.7', test: (v: number) => v > 0.5 && v <= 0.7 },
    { label: '>0.7', test: (v: number) => v > 0.7 }
  ];

  private fitnessBuckets = [
    { label: '≤0', test: (v: number) => v <= 0 },
    { label: '0~0.5', test: (v: number) => v > 0 && v <= 0.5 },
    { label: '0.5~1', test: (v: number) => v > 0.5 && v <= 1 },
    { label: '1~2', test: (v: number) => v > 1 && v <= 2 },
    { label: '>2', test: (v: number) => v > 2 }
  ];

  private returnsBuckets = [
    { label: '≤0', test: (v: number) => v <= 0 },
    { label: '0~0.05', test: (v: number) => v > 0 && v <= 0.05 },
    { label: '0.05~0.1', test: (v: number) => v > 0.05 && v <= 0.1 },
    { label: '0.1~0.2', test: (v: number) => v > 0.1 && v <= 0.2 },
    { label: '>0.2', test: (v: number) => v > 0.2 }
  ];

  private drawdownBuckets = [
    { label: '≤0.05', test: (v: number) => v <= 0.05 },
    { label: '0.05~0.1', test: (v: number) => v > 0.05 && v <= 0.1 },
    { label: '0.1~0.2', test: (v: number) => v > 0.1 && v <= 0.2 },
    { label: '0.2~0.5', test: (v: number) => v > 0.2 && v <= 0.5 },
    { label: '>0.5', test: (v: number) => v > 0.5 }
  ];

  async exportAlphasToCsv(csvPath: string): Promise<void> {
    const all = await this.searchAlphas({});
    
    const csvWriter = createCsvWriter.createObjectCsvWriter({
      path: csvPath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'alpha_id', title: 'Alpha ID' },
        { id: 'expression', title: 'Expression' },
        { id: 'field', title: 'Field' },
        { id: 'status', title: 'Status' },
        { id: 'sharpe', title: 'Sharpe' },
        { id: 'turnover', title: 'Turnover' },
        { id: 'margin', title: 'Margin' },
        { id: 'returns', title: 'Returns' },
        { id: 'drawdown', title: 'Drawdown' },
        { id: 'fitness', title: 'Fitness' },
        { id: 'pnl', title: 'PnL' },
        { id: 'bookSize', title: 'Book Size' },
        { id: 'longCount', title: 'Long Count' },
        { id: 'shortCount', title: 'Short Count' },
        { id: 'checks', title: 'IS Checks' },
        { id: 'stage', title: 'Stage' },
        { id: 'grade', title: 'Grade' },
        { id: 'submit_status', title: 'Submit Status' },
        { id: 'correlation_max', title: 'Correlation Max' },
        { id: 'correlation_min', title: 'Correlation Min' },
        { id: 'reject_reason', title: 'Reject Reason' },
        { id: 'settings_hash', title: 'Settings Hash' },
        { id: 'error_message', title: 'Error Message' },
        { id: 'created_at', title: 'Created At' },
        { id: 'updated_at', title: 'Updated At' }
      ]
    });

    const records = all.map((r: any) => ({
      ...r,
      checks: r.checks ? (typeof r.checks === 'string' ? r.checks : JSON.stringify(r.checks)) : ''
    }));

    await csvWriter.writeRecords(records);

    const fs = await import('fs');
    const content = fs.readFileSync(csvPath, 'utf-8');
    fs.writeFileSync(csvPath, '\ufeff' + content, 'utf-8');

    info(`Alpha数据已导出到: ${csvPath}`);
  }

  // 字段分析操作
  async insertFieldAnalysis(analysis: Omit<FieldAnalysis, 'id' | 'created_at'>): Promise<number> {
    const result = this.db.insert(fieldAnalyses).values({
      field_name: analysis.field_name,
      coverage: analysis.coverage,
      update_freq: analysis.update_freq,
      data_range: analysis.data_range,
      ai_summary: analysis.ai_summary,
      last_tested: analysis.last_tested || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString().split('T')[0]
    }).run();

    return result.lastInsertRowid as number;
  }

  async updateFieldAnalysis(id: number, updates: Partial<FieldAnalysis>): Promise<void> {
    const updateData: any = {};
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'created_at' && value !== undefined) {
        updateData[key] = value;
      }
    }
    
    if (Object.keys(updateData).length > 0) {
      this.db.update(fieldAnalyses).set(updateData).where(eq(fieldAnalyses.id, id)).run();
    }
  }

  async getFieldAnalysis(fieldName: string): Promise<FieldAnalysis | null> {
    const result = this.db.select().from(fieldAnalyses)
      .where(eq(fieldAnalyses.field_name, fieldName)).get();
    return result ? this.mapToFieldAnalysis(result) : null;
  }

  async searchFieldAnalysis(filters: Record<string, string>): Promise<FieldAnalysis[]> {
    let query = this.db.select().from(fieldAnalyses);
    const conditions: any[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (key in fieldAnalyses) {
        conditions.push(like((fieldAnalyses as any)[key], `%${value}%`));
      }
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = query.all();
    return results.map(r => this.mapToFieldAnalysis(r));
  }

  async exportFieldAnalysisToCsv(csvPath: string): Promise<void> {
    const all = await this.searchFieldAnalysis({});
    
    const csvWriter = createCsvWriter.createObjectCsvWriter({
      path: csvPath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'field_name', title: 'Field Name' },
        { id: 'coverage', title: 'Coverage' },
        { id: 'update_freq', title: 'Update Frequency' },
        { id: 'data_range', title: 'Data Range' },
        { id: 'ai_summary', title: 'AI Summary' },
        { id: 'last_tested', title: 'Last Tested' },
        { id: 'created_at', title: 'Created At' }
      ]
    });

    await csvWriter.writeRecords(all);
    info(`字段分析数据已导出到: ${csvPath}`);
  }

  // 数据字段操作
  async insertDataField(field: Omit<DataField, 'id'>): Promise<number> {
    const result = this.db.insert(dataFields).values({
      field_id: field.field_id,
      name: field.name,
      description: field.description,
      dataset_id: field.dataset_id,
      data_type: field.data_type,
      region: field.region,
      fetched_at: field.fetched_at
    }).run();

    return result.lastInsertRowid as number;
  }

  async getDataFields(datasetId?: string): Promise<DataField[]> {
    if (datasetId) {
      const results = this.db.select().from(dataFields)
        .where(eq(dataFields.dataset_id, datasetId)).all();
      return results.map(r => this.mapToDataField(r));
    }
    const results = this.db.select().from(dataFields).all();
    return results.map(r => this.mapToDataField(r));
  }

  async getDataField(fieldId: string): Promise<DataField | null> {
    const result = this.db.select().from(dataFields)
      .where(eq(dataFields.field_id, fieldId)).get();
    return result ? this.mapToDataField(result) : null;
  }

  // 批次操作
  async insertBatch(batch: Omit<BatchRecord, 'id'>): Promise<number> {
    const result = this.db.insert(batches).values({
      batch_name: batch.batch_name,
      description: batch.description,
      total_count: batch.total_count,
      success_count: batch.success_count,
      fail_count: batch.fail_count,
      created_at: batch.created_at,
      status: batch.status
    }).run();

    return result.lastInsertRowid as number;
  }

  async updateBatchStatus(batchId: number, updates: Partial<BatchRecord>): Promise<void> {
    const updateData: any = {};
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && value !== undefined) {
        updateData[key] = value;
      }
    }
    
    if (Object.keys(updateData).length > 0) {
      this.db.update(batches).set(updateData).where(eq(batches.id, batchId)).run();
    }
  }

  async getBatch(batchId: number): Promise<BatchRecord | null> {
    const result = this.db.select().from(batches)
      .where(eq(batches.id, batchId)).get();
    return result ? this.mapToBatchRecord(result) : null;
  }

  async getAllBatches(): Promise<BatchRecord[]> {
    const results = this.db.select().from(batches).orderBy(desc(batches.id)).all();
    return results.map(r => this.mapToBatchRecord(r));
  }

  private mapToAlphaRecord(r: any): AlphaRecord {
    return {
      ...r,
      settings_hash: r.settings_hash ?? undefined,
      sharpe: r.sharpe ?? undefined,
      turnover: r.turnover ?? undefined,
      margin: r.margin ?? undefined,
      returns: r.returns ?? undefined,
      drawdown: r.drawdown ?? undefined,
      fitness: r.fitness ?? undefined,
      pnl: r.pnl ?? undefined,
      bookSize: r.bookSize ?? undefined,
      longCount: r.long_count ?? undefined,
      shortCount: r.short_count ?? undefined,
      checks: r.checks ? (typeof r.checks === 'string' ? JSON.parse(r.checks) : r.checks) : undefined,
      stage: r.stage ?? undefined,
      grade: r.grade ?? undefined,
      submitStatus: r.submit_status ?? undefined,
      correlationMax: r.correlation_max ?? undefined,
      correlationMin: r.correlation_min ?? undefined,
      rejectReason: r.reject_reason ?? undefined,
      canSubmit: undefined
    };
  }

  private mapToFieldAnalysis(r: any): FieldAnalysis {
    return {
      ...r,
      coverage: r.coverage ?? undefined,
      update_freq: r.update_freq ?? undefined,
      data_range: r.data_range ?? undefined,
      ai_summary: r.ai_summary ?? undefined,
      last_tested: r.last_tested ?? undefined
    };
  }

  private mapToDataField(r: any): DataField {
    return {
      ...r,
      description: r.description ?? '',
      dataset_id: r.dataset_id ?? '',
      data_type: r.data_type ?? '',
      region: r.region ?? ''
    };
  }

  private mapToBatchRecord(r: any): BatchRecord {
    return {
      ...r,
      description: r.description ?? '',
      success_count: r.success_count ?? 0,
      fail_count: r.fail_count ?? 0
    };
  }
}
