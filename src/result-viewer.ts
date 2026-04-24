import * as fs from 'fs';
import * as path from 'path';
import Table from 'cli-table3';
import type { Database, AlphaRecord } from './db/Database.js';
import * as createCsvWriter from 'csv-writer';

export class ResultViewer {
  private db: Promise<Database>;

  constructor(db: Promise<Database>) {
    this.db = db;
  }

  async showStatistics() {
    const database = await this.db;
    const stats = await database.getAlphaStats();
    console.log('\n=== Alpha记录统计 ===');
    console.log(`总记录数: ${stats.total_alphas}`);
    console.log(`成功: ${stats.success_count}`);
    console.log(`失败: ${stats.failed_count}`);
    if (stats.avg_sharpe) console.log(`平均Sharpe: ${stats.avg_sharpe.toFixed(3)}`);
    if (stats.best_sharpe) console.log(`最佳Sharpe: ${stats.best_sharpe.toFixed(3)}`);
    console.log('='.repeat(20));
  }

  async showRecentRecords(limit: number = 20, status?: string) {
    const database = await this.db;
    const filters: Record<string, string> = {};
    if (status) {
      filters.status = status;
    }
    let records = await database.searchAlphas(filters);
    records = records.slice(0, limit);

    if (records.length === 0) {
      console.log('没有找到记录');
      return;
    }

    const table = new Table({
      head: ['ID', 'Alpha ID', '字段', '状态', '创建时间'],
      colWidths: [5, 12, 35, 10, 22]
    });

    for (const record of records) {
      table.push([
        record.id,
        record.alpha_id || 'N/A',
        record.field.substring(0, 33),
        record.status,
        record.created_at.substring(0, 19)
      ]);
    }

    console.log(`\n=== 最近${records.length}条记录 ===`);
    console.log(table.toString());
  }

  async showSuccessRecords(limit: number = 20) {
    await this.showRecentRecords(limit, 'success');
  }

  async exportToCsv(filename?: string) {
    if (!filename) {
      filename = `alpha_records_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    }

    const database = await this.db;
    await database.exportAlphasToCsv(path.join(process.cwd(), filename));
    console.log(`已导出到: ${filename}`);
  }

  async exportToJson(filename?: string) {
    if (!filename) {
      filename = `alpha_records_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    }

    const database = await this.db;
    const records = await database.searchAlphas({});
    fs.writeFileSync(path.join(process.cwd(), filename), JSON.stringify(records, null, 2), 'utf-8');
    console.log(`已导出到: ${filename}`);
  }
}
