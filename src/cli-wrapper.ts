#!/usr/bin/env node

/**
 * WQBuddy CLI
 * 支持两种模式：
 * 1. 交互模式：不带参数运行，进入交互式菜单
 * 2. 命令模式：带参数运行，直接执行工具函数
 *
 * 用法：
 *   node cli-wrapper.js                              # 交互模式
 *   node cli-wrapper.js preview "模板" "字段1,字段2"  # 预览模式
 *   node cli-wrapper.js submit "模板" "字段1,字段2"  # 提交模式
 */

import { alphaPreview, alphaBatchSubmit, formatResults } from './tools.js';
import { OPERATORS_REFERENCE } from './operators.js';

interface ParseResult {
  mode: 'interactive' | 'preview' | 'submit' | 'docs';
  template?: string;
  fields?: string[];
  enableCheckDuplicate?: boolean;
}

function parseArgs(): ParseResult {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    return { mode: 'interactive' };
  }

  const [mode, template, fieldsStr, ...restArgs] = args;
  const enableCheckDuplicate = restArgs.includes('--enable-duplicate-check');

  if (mode === 'preview' && template) {
    return {
      mode: 'preview',
      template,
      fields: fieldsStr ? fieldsStr.split(',').map(f => f.trim()) : [],
      enableCheckDuplicate
    };
  }

  if (mode === 'submit' && template) {
    if (fieldsStr) {
      return {
        mode: 'submit',
        template,
        fields: fieldsStr.split(',').map(f => f.trim()),
        enableCheckDuplicate
      };
    } else {
      return {
        mode: 'submit',
        template,
        fields: [template],
        enableCheckDuplicate
      };
    }
  }

  if (mode === 'help') {
    console.log(`
WQBuddy CLI

用法:
  node cli-wrapper.js                              # 交互模式
  node cli-wrapper.js preview "模板" "字段1,字段2"  # 预览模式
  node cli-wrapper.js submit "模板" "字段1,字段2"  # 提交模式

示例:
  # 预览
  node cli-wrapper.js preview "rank({field})" "fnd6_fopo,sales"

  # 提交
  node cli-wrapper.js submit "rank({field})" "fnd6_fopo,sales"

  # 单个表达式
  node cli-wrapper.js submit "rank(fnd6_fopo/debt_lt)" "fnd6_fopo"
`);
    process.exit(0);
  }

  if (mode === 'docs') {
    return { mode: 'docs' };
  }

  console.error('未知参数。运行 "npm run docs" 查看运算符文档。');
  process.exit(1);
  return { mode: 'interactive' };
}

async function main() {
  const opts = parseArgs();

  if (opts.mode === 'interactive') {
    console.log('请使用交互模式: npm run dev');
    console.log('或查看运算符文档: npm run docs');
    process.exit(1);
  }

  if (opts.mode === 'docs') {
    console.log(OPERATORS_REFERENCE);
    return;
  }

  if (opts.mode === 'preview' && opts.template && opts.fields) {
    console.log('📋 生成预览...\n');
    const preview = await alphaPreview({
      template: opts.template,
      fields: opts.fields
    });
    console.log(preview);
    return;
  }

  if (opts.mode === 'submit' && opts.template && opts.fields) {
    console.log(`🚀 开始批量回测，共 ${opts.fields.length} 个任务...\n`);
    if (opts.enableCheckDuplicate) {
      console.log('🔍 查重模式已开启，将检查重复表达式...\n');
    }

    const result = await alphaBatchSubmit({
      template: opts.template,
      fields: opts.fields,
      enableCheckDuplicate: opts.enableCheckDuplicate
    });

    console.log('\n' + formatResults(result.results));
    console.log(`\n📋 重复检查: ${result.summary.duplicateCount} 个已存在的alpha`);
    console.log('\n✅ 批量回测完成!');
    return;
  }
}

main().catch(e => {
  console.error('❌ 错误:', e.message);
  process.exit(1);
});
