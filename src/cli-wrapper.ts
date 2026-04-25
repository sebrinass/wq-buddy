#!/usr/bin/env node

/**
 * WQBuddy CLI - 统一命令行入口
 *
 * CLI-first 设计：Agent通过CLI命令调用工具，不写脚本
 * 统一入口：一个 wq 命令 + 子命令
 * 参数设计：最小必填、可选丰富、默认兜底
 * 失败策略：跳过继续，不中断整体
 *
 * 用法：
 *   wq backtest "rank(cash_flow)"                                    # 单条回测
 *   wq backtest "rank(cash_flow)" "ts_delta(earnings,5)" "abs(revenue)"  # 批量回测
 *   wq backtest --file ./expressions.txt                             # 从文件读取表达式列表
 *   wq backtest --concurrency 3 "expr1" "expr2" "expr3"             # 指定并发数
 *   wq search "operating cash flow"                                  # 搜索字段
 *   wq search "earnings" --dataset fundamental6                      # 限定数据集
 *   wq analyze fnd2_ebitdm                                          # 字段分析
 *   wq stats                                                        # 查看统计
 *   wq export                                                       # 导出CSV
 */

import { alphaBatchSubmit, formatResults, alphaStats } from './tools.js';
import { searchFields, formatSearchResults } from './search.js';
import { analyzeField, formatAnalysisResult } from './analyze-field.js';
import { getDatabase, closeDatabase } from './db/index.js';
import { OPERATORS_REFERENCE } from './operators.js';
import * as fs from 'fs';
import * as path from 'path';

// ── 参数解析 ──────────────────────────────────────────────

interface GlobalOptions {
  concurrency: number;
  enableCheckDuplicate: boolean;
  file?: string;
  dataset?: string;
  limit: number;
}

function parseGlobalOptions(args: string[]): { options: GlobalOptions; positional: string[] } {
  const options: GlobalOptions = {
    concurrency: 1,
    enableCheckDuplicate: false,
    limit: 50
  };
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--concurrency' || arg === '-c') {
      const val = parseInt(args[++i]);
      if (!isNaN(val) && val >= 1 && val <= 3) {
        options.concurrency = val;
      } else {
        console.error(`错误: --concurrency 值必须为 1-3，收到 "${args[i]}"`);
        process.exit(1);
      }
    } else if (arg === '--enable-duplicate-check' || arg === '-d') {
      options.enableCheckDuplicate = true;
    } else if (arg === '--file' || arg === '-f') {
      options.file = args[++i];
      if (!options.file) {
        console.error('错误: --file 需要指定文件路径');
        process.exit(1);
      }
    } else if (arg === '--dataset') {
      options.dataset = args[++i];
      if (!options.dataset) {
        console.error('错误: --dataset 需要指定数据集名称');
        process.exit(1);
      }
    } else if (arg === '--limit' || arg === '-l') {
      const val = parseInt(args[++i]);
      if (!isNaN(val) && val > 0) {
        options.limit = val;
      } else {
        console.error(`错误: --limit 值必须为正整数，收到 "${args[i]}"`);
        process.exit(1);
      }
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  return { options, positional };
}

// ── 子命令处理 ──────────────────────────────────────────────

/**
 * backtest 子命令 - 提交Alpha表达式回测
 * 支持直接传入表达式列表或从文件读取
 */
async function handleBacktest(positional: string[], options: GlobalOptions): Promise<void> {
  let expressions: string[] = [];

  // 从文件读取表达式
  if (options.file) {
    const filePath = path.resolve(options.file);
    if (!fs.existsSync(filePath)) {
      console.error(`错误: 文件不存在 - ${filePath}`);
      process.exit(1);
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    // 每行一条表达式，忽略空行和注释行
    expressions = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'));

    if (expressions.length === 0) {
      console.error('错误: 文件中没有有效的表达式');
      process.exit(1);
    }
    console.log(`从文件读取 ${expressions.length} 条表达式: ${options.file}`);
  } else {
    // 直接传入的表达式
    expressions = positional;
  }

  if (expressions.length === 0) {
    console.error('错误: 请提供至少一条Alpha表达式');
    console.error('用法: wq backtest "rank(cash_flow)"');
    console.error('      wq backtest --file ./expressions.txt');
    process.exit(1);
  }

  console.log(`开始批量回测，共 ${expressions.length} 条表达式`);
  console.log(`并发数: ${options.concurrency}`);
  if (options.enableCheckDuplicate) {
    console.log('查重模式: 已开启');
  }
  console.log('');

  const result = await alphaBatchSubmit({
    expressions,
    concurrency: options.concurrency,
    enableCheckDuplicate: options.enableCheckDuplicate
  });

  console.log('\n' + formatResults(result.results));
  console.log(`\n重复检查: ${result.summary.duplicateCount} 个已存在的alpha`);
  console.log(`\n批量回测完成! 成功: ${result.summary.successCount} | 失败: ${result.summary.failedCount}`);
}

/**
 * search 子命令 - 搜索数据字段
 */
async function handleSearch(positional: string[], options: GlobalOptions): Promise<void> {
  const keyword = positional[0];

  if (!keyword && !options.dataset) {
    console.error('错误: 请提供搜索关键词或指定数据集');
    console.error('用法: wq search "operating cash flow"');
    console.error('      wq search "earnings" --dataset fundamental6');
    console.error('      wq search --dataset pv13');
    process.exit(1);
  }

  try {
    console.log('搜索中...\n');

    const result = await searchFields(keyword || '', {
      datasetId: options.dataset,
      limit: options.limit
    });

    console.log(formatSearchResults(result));
  } catch (e: any) {
    console.error(`搜索失败: ${e.message}`);
    process.exit(1);
  }
}

/**
 * analyze 子命令 - 分析数据字段特性
 */
async function handleAnalyze(positional: string[], _options: GlobalOptions): Promise<void> {
  const fieldName = positional[0];

  if (!fieldName) {
    console.error('错误: 请提供字段名');
    console.error('用法: wq analyze fnd2_ebitdm');
    process.exit(1);
  }

  try {
    console.log(`开始分析字段: ${fieldName}\n`);
    const result = await analyzeField(fieldName, true);
    console.log(formatAnalysisResult(result));
  } catch (e: any) {
    console.error(`字段分析失败: ${e.message}`);
    process.exit(1);
  }
}

/**
 * stats 子命令 - 查看回测统计
 */
async function handleStats(_positional: string[], _options: GlobalOptions): Promise<void> {
  try {
    const output = await alphaStats({ limit: 100 });
    console.log(output);
  } catch (e: any) {
    console.error(`统计查询失败: ${e.message}`);
    process.exit(1);
  }
}

/**
 * export 子命令 - 导出CSV
 */
async function handleExport(positional: string[], _options: GlobalOptions): Promise<void> {
  const type = positional[0] || 'alpha';
  const outputPath = positional[1] || `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;

  try {
    const db = await getDatabase();

    if (type === 'alpha') {
      await db.exportAlphasToCsv(outputPath);
      console.log(`Alpha数据已导出到: ${outputPath}`);
    } else if (type === 'field') {
      await db.exportFieldAnalysisToCsv(outputPath);
      console.log(`字段分析数据已导出到: ${outputPath}`);
    } else {
      console.error(`未知导出类型: ${type} (支持: alpha, field)`);
      process.exit(1);
    }

    await closeDatabase();
  } catch (e: any) {
    console.error(`导出失败: ${e.message}`);
    process.exit(1);
  }
}

/**
 * docs 子命令 - 查看运算符文档
 */
async function handleDocs(): Promise<void> {
  console.log(OPERATORS_REFERENCE);
}

// ── 帮助信息 ──────────────────────────────────────────────

function showHelp(): void {
  console.log(`
WQBuddy CLI - Alpha回测工具 (CLI-first)

用法:
  wq <command> [options] [arguments]

命令:
  backtest    提交Alpha表达式回测
  search      搜索数据字段
  analyze     分析字段特性
  stats       查看回测统计
  export      导出CSV数据
  docs        查看运算符文档
  help        显示帮助信息

backtest 用法:
  wq backtest "rank(cash_flow)"                                    # 单条回测
  wq backtest "rank(cash_flow)" "ts_delta(earnings,5)" "abs(revenue)"  # 批量回测
  wq backtest --file ./expressions.txt                             # 从文件读取
  wq backtest --concurrency 3 "expr1" "expr2" "expr3"             # 指定并发数(1-3)
  wq backtest --enable-duplicate-check "expr1" "expr2"            # 开启查重

search 用法:
  wq search "operating cash flow"                                  # 搜索关键词
  wq search "earnings" --dataset fundamental6                      # 限定数据集
  wq search --dataset pv13                                         # 获取数据集所有字段
  wq search "revenue" --limit 100                                  # 限制结果数量

analyze 用法:
  wq analyze fnd2_ebitdm                                          # 分析字段

stats 用法:
  wq stats                                                        # 查看统计

export 用法:
  wq export                                                       # 导出alpha CSV
  wq export field                                                 # 导出字段分析 CSV
  wq export alpha ./output.csv                                    # 指定输出路径

全局选项:
  --concurrency, -c <1-3>     并发数 (默认: 1)
  --enable-duplicate-check, -d  开启重复检查
  --file, -f <path>           从文件读取表达式列表
  --dataset <name>            限定数据集
  --limit, -l <number>        限制结果数量 (默认: 50)
`);
}

// ── 主入口 ──────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // 无参数时显示帮助
  if (args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const command = args[0];
  const remainingArgs = args.slice(1);

  // 解析全局选项和位置参数
  const { options, positional } = parseGlobalOptions(remainingArgs);

  switch (command) {
    case 'backtest':
    case 'bt':
      await handleBacktest(positional, options);
      break;

    case 'search':
    case 's':
      await handleSearch(positional, options);
      break;

    case 'analyze':
    case 'a':
      await handleAnalyze(positional, options);
      break;

    case 'stats':
      await handleStats(positional, options);
      break;

    case 'export':
      await handleExport(positional, options);
      break;

    case 'docs':
      await handleDocs();
      break;

    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;

    default:
      console.error(`未知命令: ${command}`);
      console.error('运行 "wq help" 查看可用命令');
      process.exit(1);
  }
}

main().catch(e => {
  console.error(`错误: ${e.message}`);
  process.exit(1);
});
