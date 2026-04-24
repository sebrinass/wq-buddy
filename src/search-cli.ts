#!/usr/bin/env node

/**
 * Alpha Workbench 搜索 CLI
 * 用法：
 *   node dist/search-cli.js "关键词"
 *   node dist/search-cli.js "关键词" --dataset pv13
 *   node dist/search-cli.js --dataset pv13 --limit 50
 */

import { searchFields, getFieldsByDataset, formatSearchResults } from './search.js';

const args = process.argv.slice(2);

async function main() {
  let keyword = '';
  let datasetId = '';
  let limit = 50;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dataset' && args[i + 1]) {
      datasetId = args[i + 1];
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1]);
      i++;
    } else if (!args[i].startsWith('--')) {
      keyword = args[i];
    }
  }

  if (!keyword && !datasetId) {
    console.log(`
Alpha Workbench 搜索工具

用法:
  node dist/search-cli.js "关键词"           # 搜索关键词
  node dist/search-cli.js "关键词" --dataset pv13  # 在数据集中搜索
  node dist/search-cli.js --dataset pv13     # 获取数据集所有字段
  node dist/search-cli.js "earnings" --limit 100  # 限制结果数量

示例:
  node dist/search-cli.js "fnd"
  node dist/search-cli.js "earnings" --dataset fundamental6
  node dist/search-cli.js --dataset pv13 --limit 20
`);
    process.exit(0);
  }

  try {
    console.log('🔍 搜索中...\n');

    const result = await searchFields(keyword, {
      datasetId,
      limit
    });

    console.log(formatSearchResults(result));
  } catch (e: any) {
    console.error('❌ 搜索失败:', e.message);
    process.exit(1);
  }
}

main();
