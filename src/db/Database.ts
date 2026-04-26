/**
 * 数据库抽象层
 * 定义统一接口，支持未来更换数据库实现
 */

export interface AlphaRecord {
  id: number;
  alpha_id: string | null;
  expression: string;
  field: string;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  settings_hash?: string;
  sharpe?: number;
  turnover?: number;
  margin?: number;
  returns?: number;
  drawdown?: number;
  fitness?: number;
  pnl?: number;
  bookSize?: number;
  longCount?: number;
  shortCount?: number;
  
  // IS测试相关字段
  checks?: any[];       // IS检查结果数组（JSON格式存储）
  stage?: string;        // IS / OOS / PROD
  grade?: string;        // INFERIOR / GOOD / EXCELLENT / AVERAGE
  submitStatus?: string; // 未提交 | 可提交(待查) | 已通过 | 提交失败
  
  // 自相关性（手动填写）
  correlationMax?: number;   // Maximum相关性
  correlationMin?: number;   // Minimum相关性
  
  // 失败原因/备注（手动填写）
  rejectReason?: string;     // 提交失败的原因说明
  
  // 表达式模板和相似组
  expression_template?: string;  // 表达式模板
  similarity_group?: string;     // 相似组标识
  
  // 计算属性：是否可提交（基于IS Checks）
  canSubmit?: boolean;
}

export interface FieldAnalysis {
  id: number;
  field_name: string;
  coverage?: number;
  update_freq?: string;
  data_range?: string;
  ai_summary?: string;
  last_tested?: string;
  created_at: string;
}

export interface DataField {
  id: number;
  field_id: string;
  name: string;
  description: string;
  dataset_id: string;
  data_type: string;
  region: string;
  fetched_at: string;
}

export interface BatchRecord {
  id: number;
  batch_name: string;
  description: string;
  total_count: number;
  success_count: number;
  fail_count: number;
  created_at: string;
  status: string;
}

export interface DbStats {
  total_alphas: number;
  success_count: number;
  failed_count: number;
  avg_sharpe?: number;
  best_sharpe?: number;
}

export interface MetricDistribution {
  label: string;
  count: number;
  percentage: number;
}

export interface MetricStats {
  avg: number;
  median: number;
  best: number;
  distribution: MetricDistribution[];
}

export interface GroupStats {
  groupKey: string;
  groupValue: string;
  totalCount: number;
  successCount: number;
  failCount: number;
  submitStatusCounts: Record<string, number>;
  sharpe: MetricStats;
  turnover: MetricStats;
  fitness: MetricStats;
  returns: MetricStats;
  drawdown: MetricStats;
}

export interface AlphaStatsResult {
  totalGroups: number;
  overallStats: GroupStats;
  groupStats: GroupStats[];
}

export interface AlphaStatsOptions {
  limit?: number;
  offset?: number;
  groupBy?: 'field' | 'expression' | 'status' | 'submit_status' | 'none';
  statusFilter?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface Database {
  // Alpha操作
  insertAlpha(record: Omit<AlphaRecord, 'id'>): Promise<number>;
  updateAlphaStatus(id: number, status: string, alphaId?: string, errorMessage?: string): Promise<void>;
  updateCorrelation(id: number, max: number, min: number): Promise<void>;  // 更新自相关性
  updateSubmitStatus(id: number, status: string, rejectReason?: string): Promise<void>;  // 更新提交状态
  updateAlphaCorrelation(alphaId: string, correlationMax?: number, correlationMin?: number): Promise<void>;  // 按alpha_id更新相关性
  updateAlphaSubmitStatusByAlphaId(alphaId: string, status: string, rejectReason?: string): Promise<void>;  // 按alpha_id更新提交状态
  getAlphaByAlphaId(alphaId: string): Promise<AlphaRecord | null>;  // 按alpha_id查询记录
  saveDataFields(fields: Omit<DataField, 'id'>[]): Promise<void>;  // 批量保存数据字段缓存
  getAlpha(id: number): Promise<AlphaRecord | null>;
  searchAlphas(filters: Record<string, string>): Promise<AlphaRecord[]>;
  sortAlphas(sortBy: string, order?: 'asc' | 'desc'): Promise<AlphaRecord[]>;
  getAlphaStats(): Promise<DbStats>;
  getAlphaStatsAdvanced(options?: AlphaStatsOptions): Promise<AlphaStatsResult>;
  exportAlphasToCsv(path: string): Promise<void>;

  // 字段分析操作
  insertFieldAnalysis(analysis: Omit<FieldAnalysis, 'id' | 'created_at'>): Promise<number>;
  updateFieldAnalysis(id: number, updates: Partial<FieldAnalysis>): Promise<void>;
  getFieldAnalysis(fieldName: string): Promise<FieldAnalysis | null>;
  searchFieldAnalysis(filters: Record<string, string>): Promise<FieldAnalysis[]>;
  exportFieldAnalysisToCsv(path: string): Promise<void>;

  // 数据字段操作
  insertDataField(field: Omit<DataField, 'id'>): Promise<number>;
  getDataFields(datasetId?: string): Promise<DataField[]>;
  getDataField(fieldId: string): Promise<DataField | null>;

  // 批次操作
  insertBatch(batch: Omit<BatchRecord, 'id'>): Promise<number>;
  updateBatchStatus(batchId: number, updates: Partial<BatchRecord>): Promise<void>;
  getBatch(batchId: number): Promise<BatchRecord | null>;
  getAllBatches(): Promise<BatchRecord[]>;

  // 初始化
  init(): Promise<void>;
  close(): Promise<void>;
}

export type DatabaseType = 'sqlite' | 'json';

export interface DbConfig {
  type: DatabaseType;
  path?: string; // SQLite文件路径
}
