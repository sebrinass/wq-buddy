/**
 * Alpha Workbench 数据库管理工具 (SQLite版本)
 * 支持搜索、排序、导出等功能
 */

import { getDatabase, closeDatabase } from './db/index.js';
import { migrateFromJson } from './migrate.js';
import { analyzeField, formatAnalysisResult } from './analyze-field.js';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
📊 Alpha Workbench 数据库管理 (SQLite)

用法:
  npm run db -- migrate              # 从JSON迁移到SQLite
  npm run db -- search [条件]        # 搜索alpha记录
  npm run db -- sort [选项]          # 排序alpha记录
  npm run db -- stats                # 查看统计信息
  npm run db -- export [type]        # 导出CSV (alpha/field)
  npm run db -- field analyze <字段名>  # 分析数据字段
  npm run db -- field search <关键词>   # 搜索已分析的字段
  npm run db -- field update <id> <总结> # 更新AI总结

搜索示例:
  npm run db -- search --sharpe ">1.0"
  npm run db -- search --status "success"
  npm run db -- search --expression "rank"

排序示例:
  npm run db -- sort --by sharpe
  npm run db -- sort --by sharpe --desc
  npm run db -- sort --by turnover --asc

字段分析示例:
  npm run db -- field analyze fnd2_ebitdm
  npm run db -- field search ebit
  npm run db -- field update 1 "该字段覆盖率良好，适合使用"
`);
    process.exit(0);
  }

  const command = args[0];

  try {
    // 迁移命令不需要初始化数据库
    if (command === 'migrate') {
      await migrateFromJson();
      return;
    }

    // 初始化数据库
    const db = await getDatabase();

    if (command === 'search') {
      await handleSearch(db, args.slice(1));
    } else if (command === 'sort') {
      await handleSort(db, args.slice(1));
    } else if (command === 'stats') {
      await handleStats(db);
    } else if (command === 'export') {
      await handleExport(db, args.slice(1));
    } else if (command === 'field') {
      await handleField(db, args.slice(1));
    } else {
      console.log(`未知命令: ${command}`);
      console.log('运行 "npm run db" 查看帮助');
    }

    await closeDatabase();
  } catch (e: any) {
    console.error(`错误: ${e.message}`);
    process.exit(1);
  }
}

async function handleSearch(db: any, args: string[]) {
  const filters: Record<string, string> = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const value = args[i + 1] || '';
      filters[key] = value;
      i++;
    }
  }

  if (Object.keys(filters).length === 0) {
    console.log('请提供搜索条件，例如:');
    console.log('  npm run db -- search --sharpe ">1.0"');
    return;
  }

  const results = await db.searchAlphas(filters);
  
  if (results.length === 0) {
    console.log('未找到匹配的记录');
    return;
  }

  console.log(`找到 ${results.length} 条记录:\n`);
  for (const r of results) {
    console.log(formatAlphaRecord(r));
    console.log('-'.repeat(50));
  }
}

async function handleSort(db: any, args: string[]) {
  let sortBy = 'sharpe';
  let order: 'asc' | 'desc' = 'desc';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--by' && args[i + 1]) {
      sortBy = args[i + 1];
      i++;
    } else if (args[i] === '--order' && args[i + 1]) {
      order = args[i + 1] as 'asc' | 'desc';
      i++;
    }
  }

  console.log(`按 ${sortBy} ${order === 'desc' ? '降序' : '升序'}排序\n`);

  const sorted = await db.sortAlphas(sortBy, order);
  
  console.log(`共 ${sorted.length} 条记录:\n`);
  for (const r of sorted) {
    console.log(formatAlphaRecord(r));
    console.log('-'.repeat(50));
  }
}

async function handleStats(db: any) {
  const stats = await db.getAlphaStats();
  
  console.log('📊 Alpha统计信息\n');
  console.log(`总记录数: ${stats.total_alphas}`);
  console.log(`成功: ${stats.success_count}`);
  console.log(`失败: ${stats.failed_count}`);
  console.log(`成功率: ${stats.total_alphas > 0 ? ((stats.success_count / stats.total_alphas) * 100).toFixed(1) : 0}%`);
  
  if (stats.avg_sharpe !== undefined) {
    console.log(`\n平均Sharpe: ${stats.avg_sharpe.toFixed(3)}`);
  }
  if (stats.best_sharpe !== undefined) {
    console.log(`最佳Sharpe: ${stats.best_sharpe.toFixed(3)}`);
  }
}

async function handleExport(db: any, args: string[]) {
  const type = args[0] || 'alpha';
  const outputPath = args[1] || `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;

  if (type === 'alpha') {
    await db.exportAlphasToCsv(outputPath);
    console.log(`Alpha数据已导出到: ${outputPath}`);
  } else if (type === 'field') {
    await db.exportFieldAnalysisToCsv(outputPath);
    console.log(`字段分析数据已导出到: ${outputPath}`);
  } else {
    console.log(`未知导出类型: ${type} (支持: alpha, field)`);
  }
}

async function handleField(db: any, args: string[]) {
  const subCommand = args[0];

  if (subCommand === 'analyze') {
    const fieldName = args[1];
    if (!fieldName) {
      console.log('请提供字段名: npm run db -- field analyze <字段名>');
      return;
    }

    console.log(`开始分析字段: ${fieldName}\n`);
    const result = await analyzeField(fieldName, true);
    console.log(formatAnalysisResult(result));
  } else if (subCommand === 'search') {
    const keyword = args[1];
    if (!keyword) {
      console.log('请提供关键词: npm run db -- field search <关键词>');
      return;
    }

    const results = await db.searchFieldAnalysis({ field_name: keyword });
    
    if (results.length === 0) {
      console.log('未找到匹配的字段分析');
      return;
    }

    console.log(`找到 ${results.length} 条字段分析记录:\n`);
    for (const r of results) {
      console.log(`ID: ${r.id}`);
      console.log(`字段: ${r.field_name}`);
      if (r.coverage) console.log(`覆盖率: ${(r.coverage * 100).toFixed(1)}%`);
      if (r.ai_summary) console.log(`AI总结: ${r.ai_summary}`);
      console.log('-'.repeat(50));
    }
  } else if (subCommand === 'update') {
    const id = parseInt(args[1]);
    const summary = args.slice(2).join(' ');
    
    if (!id || !summary) {
      console.log('用法: npm run db -- field update <id> <AI总结>');
      return;
    }

    await db.updateFieldAnalysis(id, { ai_summary: summary });
    console.log(`字段分析 #${id} 已更新`);
  } else {
    console.log(`未知字段命令: ${subCommand}`);
    console.log('支持: analyze, search, update');
  }
}

function formatAlphaRecord(r: any): string {
  const icon = r.status === 'success' ? '✅' : '❌';
  let output = `${icon} [${r.id}] Alpha ID: ${r.alpha_id || 'N/A'}\n`;
  output += `   表达式: ${r.expression}\n`;
  output += `   日期: ${r.created_at}\n`;

  if (r.status === 'success') {
    const sharpe = r.sharpe?.toFixed(3) || 'N/A';
    const turnover = r.turnover?.toFixed(4) || 'N/A';
    const margin = r.margin ? r.margin.toFixed(4) : 'N/A';
    const returns = r.returns ? (r.returns * 100).toFixed(2) + '%' : 'N/A';
    const drawdown = r.drawdown ? (r.drawdown * 100).toFixed(2) + '%' : 'N/A';
    const fitness = r.fitness?.toFixed(3) || 'N/A';
    const longCount = r.longCount ?? 'N/A';
    const shortCount = r.shortCount ?? 'N/A';

    output += `   sharpe: ${sharpe} | turnover: ${turnover} | margin: ${margin}\n`;
    output += `   returns: ${returns} | drawdown: ${drawdown} | fitness: ${fitness}\n`;
    output += `   long: ${longCount} | short: ${shortCount}`;
  }

  if (r.error_message) {
    output += `\n   错误: ${r.error_message}`;
  }

  return output;
}

main();
