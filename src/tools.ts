import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { loadConfig, getDefaultSettings } from './config.js';
import { info, warn, error as logError, debug } from './logger.js';
import { getDatabase, closeDatabase } from './db/index.js';
import { Authenticator } from './auth.js';
import type { AlphaRecord as DbAlphaRecord, FieldAnalysis, AlphaStatsOptions } from './db/Database.js';

export interface AlphaMetrics {
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
}

export interface ISCheck {
  name: string;
  result: 'PASS' | 'FAIL' | 'PENDING';
  limit?: number;
  value?: number;
}

export interface AlphaResult extends AlphaMetrics {
  alpha_id: string | null;
  expression: string;
  field: string;
  status: 'success' | 'failed' | 'error';
  error?: string;
  submittedAt: string;
  completedAt?: string;
  
  checks?: ISCheck[];
  stage?: string;
  grade?: string;
  submitStatus?: string;
  
  correlationMax?: number;
  correlationMin?: number;
  
  rejectReason?: string;
  
  canSubmit?: boolean;
}

export interface BatchSubmitParams {
  /** Alpha表达式列表（必填），每条为完整的alpha表达式 */
  expressions: string[];
  username?: string;
  password?: string;
  autoConfirm?: boolean;
  enableCheckDuplicate?: boolean;
  /** 并发数 1-3，默认1 */
  concurrency?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function settingsHash(settings: any): string {
  const key = JSON.stringify({
    instrumentType: settings.instrumentType,
    region: settings.region,
    universe: settings.universe,
    neutralization: settings.neutralization,
    decay: settings.decay,
    truncation: settings.truncation
  });
  return crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
}

function getToday(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function calculateSubmitStatus(checks?: ISCheck[]): string {
  if (!checks || checks.length === 0) return '未提交';
  
  const failedChecks = checks.filter(c => c.result === 'FAIL');
  
  if (failedChecks.length > 0) return '未提交';
  
  const passCount = checks.filter(c => c.result === 'PASS').length;
  if (passCount >= 5) {
    return '可提交(待查)';
  }
  
  return '未提交';
}

async function saveResult(result: AlphaResult, settingsHashValue?: string): Promise<void> {
  try {
    const db: any = await getDatabase();
    const id = await db.insertAlpha({
      alpha_id: result.alpha_id,
      expression: result.expression,
      field: result.field,
      status: result.status,
      error_message: result.error || null,
      created_at: getToday(),
      updated_at: getToday(),
      settings_hash: settingsHashValue,
      sharpe: result.sharpe,
      turnover: result.turnover,
      margin: result.margin,
      returns: result.returns,
      drawdown: result.drawdown,
      fitness: result.fitness,
      pnl: result.pnl,
      bookSize: result.bookSize,
      longCount: result.longCount,
      shortCount: result.shortCount,
      
      checks: result.checks,
      stage: result.stage,
      grade: result.grade,
      submitStatus: result.submitStatus || calculateSubmitStatus(result.checks),
      
      correlationMax: result.correlationMax,
      correlationMin: result.correlationMin,
      
      rejectReason: result.rejectReason,
      
      canSubmit: calculateSubmitStatus(result.checks) === '可提交(待查)'
    });
    info(`结果已保存到SQLite: ID=${id} | ${result.alpha_id || 'FAILED'} | ${result.field}`);
  } catch (e: any) {
    logError('数据库保存失败', e.message);
  }
}

async function getAlphaInfo(session: AxiosInstance, cookie: string, alphaId: string): Promise<AlphaMetrics & { checks?: ISCheck[]; stage?: string; grade?: string; submitStatus?: string }> {
  try {
    let attempts = 0;
    let delayMs = 1000;
    const maxDelay = 30000;
    while (attempts < 30) {
      try {
        const response = await session.get(`/alphas/${alphaId}`, {
          headers: { 'Cookie': cookie }
        });

        if (response.headers['retry-after']) {
          await sleep(parseFloat(response.headers['retry-after']) * 1000);
          attempts++;
          continue;
        }

        const data = response.data;
        const metrics = data.is || {};
        
        const checks: ISCheck[] = (metrics.checks || []).map((c: any) => ({
          name: c.name,
          result: c.result,
          limit: c.limit,
          value: c.value
        }));

        debug('获取Alpha完整指标', {
          alphaId,
          sharpe: metrics.sharpe,
          turnover: metrics.turnover,
          margin: metrics.margin,
          returns: metrics.returns,
          drawdown: metrics.drawdown,
          fitness: metrics.fitness,
          pnl: metrics.pnl,
          bookSize: metrics.bookSize,
          longCount: metrics.longCount,
          shortCount: metrics.shortCount,
          stage: data.stage,
          grade: data.grade,
          status: data.status,
          checksCount: checks.length
        });

        return {
          sharpe: metrics.sharpe,
          turnover: metrics.turnover,
          margin: metrics.margin,
          returns: metrics.returns,
          drawdown: metrics.drawdown,
          fitness: metrics.fitness,
          pnl: metrics.pnl,
          bookSize: metrics.bookSize,
          longCount: metrics.longCount,
          shortCount: metrics.shortCount,
          
          checks,
          stage: data.stage,
          grade: data.grade,
          submitStatus: data.status
        };
      } catch (e: any) {
        attempts++;
        if (attempts >= 30) break;
        await sleep(delayMs);
        delayMs = Math.min(delayMs * 2, maxDelay);
      }
    }
  } catch (e: any) {
    warn('获取Alpha指标失败', e.message);
  }
  return {};
}

async function getSession(username: string, password: string): Promise<{ session: AxiosInstance; cookie: string }> {
  const cached = await Authenticator.getSessionWithCookie(username);
  if (cached) {
    info('使用缓存的Token登录');
    return cached;
  }

  info('正在登录...');
  const result = await Authenticator.loginWithCookie(username, password);
  info('登录成功');
  return result;
}

export async function checkDuplicate(expression: string, hash?: string): Promise<{ isDuplicate: boolean; existingRecord?: DbAlphaRecord }> {
  const db = await getDatabase();
  const records = await db.searchAlphas({ expression });
  
  const existing = records.find((r: DbAlphaRecord) => {
    if (r.status !== 'success') return false;
    if (hash && r.settings_hash && r.settings_hash !== hash) return false;
    return true;
  });
  
  if (existing) {
    return { isDuplicate: true, existingRecord: existing };
  }
  
  return { isDuplicate: false };
}

async function submitSingleAlpha(
  session: AxiosInstance,
  cookie: string,
  alphaExpr: string,
  field: string,
  settings: any,
  settingsHashValue: string,
  enableCheckDuplicate: boolean
): Promise<AlphaResult> {
  const submittedAt = new Date().toISOString();

  if (enableCheckDuplicate) {
    const check = await checkDuplicate(alphaExpr, settingsHashValue);
    if (check.isDuplicate && check.existingRecord) {
      info(`[跳过] 表达式+设置已存在: ${field} (Alpha: ${check.existingRecord.alpha_id})`);
      return {
        alpha_id: check.existingRecord.alpha_id,
        expression: alphaExpr,
        field,
        status: 'success',
        submittedAt,
        completedAt: getToday(),
        sharpe: check.existingRecord.sharpe,
        turnover: check.existingRecord.turnover,
        margin: check.existingRecord.margin,
        returns: check.existingRecord.returns,
        drawdown: check.existingRecord.drawdown,
        fitness: check.existingRecord.fitness,
        pnl: check.existingRecord.pnl,
        bookSize: check.existingRecord.bookSize,
        longCount: check.existingRecord.longCount,
        shortCount: check.existingRecord.shortCount
      };
    }
  }

  info(`提交表达式: ${field}`);
  debug('表达式内容', alphaExpr);

  try {
    const simulationData = {
      type: 'REGULAR',
      settings: {
        instrumentType: settings.instrumentType,
        region: settings.region,
        universe: settings.universe,
        delay: settings.delay,
        decay: settings.decay,
        neutralization: settings.neutralization,
        truncation: settings.truncation,
        pasteurization: settings.pasteurization,
        unitHandling: settings.unitHandling,
        nanHandling: settings.nanHandling,
        language: settings.language,
        visualization: false
      },
      regular: alphaExpr
    };

    const response = await session.post(
      '/simulations',
      simulationData,
      { headers: { 'Cookie': cookie } }
    );

    if (response.status !== 200 && response.status !== 201) {
      const result: AlphaResult = {
        alpha_id: null,
        expression: alphaExpr,
        field,
        status: 'failed',
        error: `HTTP ${response.status}`,
        submittedAt
      };
      await saveResult(result, settingsHashValue);
      return result;
    }

    const location = response.headers['location'];
    if (!location) {
      const result: AlphaResult = {
        alpha_id: null,
        expression: alphaExpr,
        field,
        status: 'failed',
        error: 'No Location header',
        submittedAt
      };
      await saveResult(result, settingsHashValue);
      return result;
    }
    debug('回测进度URL', location);

    while (true) {
      await sleep(1000);

      const progressResp = await session.get(location, {
        headers: { 'Cookie': cookie }
      });

      const retryAfter = parseFloat(progressResp.headers['retry-after'] || '0');
      if (retryAfter > 0) {
        await sleep(retryAfter * 1000);
        continue;
      }

      const result = progressResp.data;
      const completedAt = new Date().toISOString();

      let alphaMetrics: AlphaMetrics & { checks?: ISCheck[]; stage?: string; grade?: string; submitStatus?: string } = {};
      let errorMessage: string | undefined;

      if (result.status !== 'COMPLETE') {
        errorMessage = result.message || `Status: ${result.status}`;
        warn('回测失败', errorMessage);
      } else if (result.alpha) {
        info('回测完成，获取指标...');
        alphaMetrics = await getAlphaInfo(session, cookie, result.alpha);
      }

      const alphaResult: AlphaResult = {
        alpha_id: result.alpha || null,
        expression: alphaExpr,
        field,
        status: result.status === 'COMPLETE' ? 'success' : 'failed',
        error: errorMessage,
        submittedAt,
        completedAt,
        ...alphaMetrics,
        
        submitStatus: calculateSubmitStatus(alphaMetrics.checks),
        
        canSubmit: calculateSubmitStatus(alphaMetrics.checks) === '可提交(待查)'
      };

      info(`${result.status === 'COMPLETE' ? '✅' : '❌'} Alpha ID: ${result.alpha || 'N/A'} | ${field}`);

      await saveResult(alphaResult, settingsHashValue);
      return alphaResult;
    }
  } catch (e: any) {
    logError('回测异常', e.message);
    const result: AlphaResult = {
      alpha_id: null,
      expression: alphaExpr,
      field,
      status: 'error',
      error: e.message,
      submittedAt
    };
    await saveResult(result, settingsHashValue);
    return result;
  }
}

export async function alphaBatchSubmit(params: BatchSubmitParams): Promise<{
  success: boolean;
  results: AlphaResult[];
  summary: {
    total: number;
    successCount: number;
    failedCount: number;
    duplicateCount: number;
  };
  duplicates: { field: string; expression: string; existingId: string }[];
}> {
  const { expressions, username, password, enableCheckDuplicate = false, concurrency = 1 } = params;

  // 校验表达式列表
  if (!expressions || expressions.length === 0) {
    throw new Error('表达式列表不能为空');
  }

  // 过滤空表达式
  const validExpressions = expressions.filter(e => e.trim().length > 0);
  if (validExpressions.length === 0) {
    throw new Error('没有有效的表达式');
  }

  const validConcurrency = Math.min(3, Math.max(1, concurrency));
  if (validConcurrency !== concurrency) {
    warn(`并发数已调整为有效范围: ${concurrency} -> ${validConcurrency}`);
  }

  const config = loadConfig();
  if (!config) {
    throw new Error('配置文件加载失败');
  }

  const creds = config.credentials;
  const user = username || creds.username;
  const pass = password || creds.password;

  if (!user || !pass) {
    throw new Error('请在 config.json 中配置账号密码，或提供 username/password 参数');
  }

  info('开始批量回测', { user, count: validExpressions.length, concurrency: validConcurrency });
  const { session, cookie } = await getSession(user, pass);

  const settings = getDefaultSettings(config);
  const settingsHashValue = settingsHash(settings);
  const results: AlphaResult[] = [];
  const duplicates: { field: string; expression: string; existingId: string }[] = [];

  if (validConcurrency === 1) {
    // 串行模式：逐条提交，失败跳过继续
    for (let i = 0; i < validExpressions.length; i++) {
      const alphaExpr = validExpressions[i];
      // field 用表达式自身（截取前50字符作为标识）
      const field = alphaExpr.length > 50 ? alphaExpr.substring(0, 50) + '...' : alphaExpr;

      try {
        const result = await submitSingleAlpha(session, cookie, alphaExpr, field, settings, settingsHashValue, enableCheckDuplicate);
        results.push(result);

        if (enableCheckDuplicate && result.status === 'success' && result.alpha_id) {
          const db = await getDatabase();
          const existingRecords = await db.searchAlphas({ alpha_id: result.alpha_id });
          if (existingRecords.length > 1) {
            duplicates.push({ field, expression: alphaExpr, existingId: result.alpha_id });
          }
        }
      } catch (e: any) {
        // 失败跳过继续，不中断整体
        warn(`表达式回测异常，跳过: ${field}`, e.message);
        results.push({
          alpha_id: null,
          expression: alphaExpr,
          field,
          status: 'error',
          error: e.message,
          submittedAt: new Date().toISOString()
        });
      }

      if (i < validExpressions.length - 1) {
        await sleep(3000);
      }
    }
  } else {
    // 并发模式：分批提交
    for (let i = 0; i < validExpressions.length; i += validConcurrency) {
      const batch = validExpressions.slice(i, i + validConcurrency);
      const batchNum = Math.floor(i / validConcurrency) + 1;
      const totalBatches = Math.ceil(validExpressions.length / validConcurrency);
      
      info(`提交批次 ${batchNum}/${totalBatches}，共 ${batch.length} 个任务`);

      const promises = batch.map(async (alphaExpr) => {
        const field = alphaExpr.length > 50 ? alphaExpr.substring(0, 50) + '...' : alphaExpr;
        try {
          return await submitSingleAlpha(session, cookie, alphaExpr, field, settings, settingsHashValue, enableCheckDuplicate);
        } catch (e: any) {
          // 失败跳过继续
          warn(`表达式回测异常，跳过: ${field}`, e.message);
          return {
            alpha_id: null,
            expression: alphaExpr,
            field,
            status: 'error' as const,
            error: e.message,
            submittedAt: new Date().toISOString()
          } as AlphaResult;
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);

      if (i + validConcurrency < validExpressions.length) {
        await sleep(5000);
      }
    }
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status !== 'success').length;

  info('批量回测完成', { total: validExpressions.length, successCount, failedCount, duplicateCount: duplicates.length });

  await closeDatabase();

  return {
    success: successCount > 0,
    results,
    duplicates,
    summary: {
      total: validExpressions.length,
      successCount,
      failedCount,
      duplicateCount: duplicates.length
    }
  };
}

export function formatResults(results: AlphaResult[]): string {
  let output = '📊 **批量回测结果**\n\n';

  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status !== 'success').length;
  const canSubmitCount = results.filter(r => r.canSubmit).length;

  output += `**总计**: ${results.length} 个 | **成功**: ${successCount} 个 | **失败**: ${failedCount} 个`;
  
  const pendingCount = results.filter(r => r.submitStatus === '可提交(待查)').length;
  const passedCount = results.filter(r => r.submitStatus === '已通过').length;
  const failedSubmitCount = results.filter(r => r.submitStatus === '提交失败').length;
  
  if (pendingCount > 0) output += ` | **可提交(待查)**: ${pendingCount} 个 🎯`;
  if (passedCount > 0) output += ` | **已通过**: ${passedCount} 个 ✅`;
  if (failedSubmitCount > 0) output += ` | **提交失败**: ${failedSubmitCount} 个 ❌`;
  
  output += '\n\n';

  output += '**详细结果**:\n';
  output += '─'.repeat(60) + '\n';

  for (const r of results) {
    const icon = r.status === 'success' ? '✅' : '❌';
    const alphaId = r.alpha_id || '-';
    
    const submitStatusMap: Record<string, string> = {
      '未提交': '⏳',
      '可提交(待查)': '🎯',
      '已通过': '✅',
      '提交失败': '❌'
    };
    const statusIcon = submitStatusMap[r.submitStatus || '未提交'] || '';
    const submitTag = r.submitStatus ? ` ${statusIcon}${r.submitStatus}` : '';
    
    output += `${icon} **Alpha ID**: ${alphaId}${submitTag}\n`;
    output += `   表达式: \`${r.field.substring(0, 50)}${r.field.length > 50 ? '...' : ''}\`\n`;

    if (r.status === 'success') {
      output += `   ┌─────────────────────────────────────────────┐\n`;
      output += `   │ 夏普比率: ${(r.sharpe?.toFixed(3) || '-').padStart(8)} │ 换手率: ${(r.turnover ? (r.turnover * 100).toFixed(2) + '%' : '-').padStart(8)} │ 保证金: ${(r.margin?.toFixed(4) || '-').padStart(8)} │\n`;
      output += `   │ 收益率: ${(r.returns ? (r.returns * 100).toFixed(2) + '%' : '-').padStart(8)} │ 回撤: ${(r.drawdown ? (r.drawdown * 100).toFixed(2) + '%' : '-').padStart(8)} │ 适应度: ${(r.fitness?.toFixed(3) || '-').padStart(8)} │\n`;
      output += `   │ 做多: ${(r.longCount ?? '-').toString().padStart(6)} 只 │ 做空: ${(r.shortCount ?? '-').toString().padStart(6)} 只 │\n`;
      output += `   └─────────────────────────────────────────────┘\n`;
      
      if (r.stage || r.grade || r.submitStatus) {
        const stageMap: Record<string, string> = { 'IS': '样本内', 'OOS': '样本外', 'PROD': '生产' };
        const gradeMap: Record<string, string> = { 
          'INFERIOR': '较差', 'GOOD': '良好', 'EXCELLENT': '优秀', 'AVERAGE': '平均' 
        };
        
        output += `   📋 阶段: ${stageMap[r.stage || ''] || r.stage || '-'} | `;
        output += `等级: ${gradeMap[r.grade || ''] || r.grade || '-'}`;
        output += `\n`;
      }
      
      if (r.rejectReason) {
        output += `   ⚠️ **原因**: ${r.rejectReason}\n`;
      }
      
      if (r.checks && r.checks.length > 0) {
        const passCount = r.checks.filter(c => c.result === 'PASS').length;
        const failCount = r.checks.filter(c => c.result === 'FAIL').length;
        const pendingCount = r.checks.filter(c => c.result === 'PENDING').length;
        
        output += `   🔬 IS检查: ✅通过${passCount}项 ❌失败${failCount}项 ⏳待定${pendingCount}项\n`;
        
        const failedChecks = r.checks.filter(c => c.result === 'FAIL');
        if (failedChecks.length > 0) {
          const checkNameMap: Record<string, string> = {
            'LOW_SHARPE': '夏普比率过低',
            'LOW_FITNESS': '适应度过低',
            'LOW_TURNOVER': '换手率过低',
            'HIGH_TURNOVER': '换手率过高',
            'CONCENTRATED_WEIGHT': '权重过于集中',
            'LOW_SUB_UNIVERSE_SHARPE': '子集夏普过低',
            'SELF_CORRELATION': '自相关性过高',
            'MATCHES_COMPETITION': '不符合比赛要求'
          };
          
          output += `      ❌ 失败项:`;
          for (const fc of failedChecks) {
            output += ` ${checkNameMap[fc.name] || fc.name}`;
          }
          output += `\n`;
        }
      }
      
      if (r.correlationMax !== undefined && r.correlationMin !== undefined) {
        output += `   🔗 自相关性: 最高 ${(r.correlationMax * 100).toFixed(2)}% | 最低 ${(r.correlationMin * 100).toFixed(2)}%\n`;
      }
    }

    if (r.error) {
      output += `   ❌ 错误: ${r.error}\n`;
    }
    output += '─'.repeat(60) + '\n';
  }

  return output;
}

export async function alphaStats(options?: AlphaStatsOptions): Promise<string> {
  const db = await getDatabase();
  const result = await db.getAlphaStatsAdvanced(options);

  const o = result.overallStats;
  const limit = options?.limit ?? 100;

  let output = `📊 回测统计报告（最近${limit}条）\n\n`;

  const canSubmit = o.submitStatusCounts['可提交(待查)'] || 0;
  const passed = o.submitStatusCounts['已通过'] || 0;

  output += `总览: ${o.totalCount}条 | 成功${o.successCount} | 失败${o.failCount}`;
  if (canSubmit > 0) output += ` | 可提交${canSubmit}`;
  if (passed > 0) output += ` | 已通过${passed}`;
  output += '\n\n';

  const formatDistribution = (dist: { label: string; count: number; percentage: number }[], usePercentLabels?: boolean): string => {
    return dist.map(d => {
      let label = d.label;
      if (usePercentLabels) {
        label = d.label
          .replace(/≤(\d+\.?\d*)/, (_, v) => `≤${Math.round(parseFloat(v) * 100)}%`)
          .replace(/(\d+\.?\d*)~(\d+\.?\d*)/, (_, a, b) => `${Math.round(parseFloat(a) * 100)}~${Math.round(parseFloat(b) * 100)}%`)
          .replace(/>(\d+\.?\d*)/, (_, v) => `>${Math.round(parseFloat(v) * 100)}%`);
      }
      return `${label}: ${d.count}个(${d.percentage}%)`;
    }).join(' | ');
  };

  const formatMetricBlock = (
    name: string,
    stats: { avg: number; median: number; best: number; distribution: { label: string; count: number; percentage: number }[] },
    opts?: { usePercentLabels?: boolean; showBest?: boolean; bestFormat?: (v: number) => string }
  ): string => {
    const showBest = opts?.showBest !== false;
    const bestFormat = opts?.bestFormat || ((v: number) => v.toFixed(2));
    let block = `${name}分布:\n`;
    block += `  ${formatDistribution(stats.distribution, opts?.usePercentLabels)}\n`;
    block += `  平均: ${stats.avg.toFixed(2)} | 中位数: ${stats.median.toFixed(2)}`;
    if (showBest) {
      block += ` | 最佳: ${bestFormat(stats.best)}`;
    }
    block += '\n';
    return block;
  };

  output += formatMetricBlock('Sharpe', o.sharpe, {
    bestFormat: (v) => v.toFixed(2)
  });
  output += '\n';

  output += formatMetricBlock('Turnover', o.turnover, {
    usePercentLabels: true,
    showBest: false
  });
  output += '\n';

  output += formatMetricBlock('Fitness', o.fitness, {
    bestFormat: (v) => v.toFixed(2)
  });
  output += '\n';

  output += formatMetricBlock('Returns', o.returns, {
    usePercentLabels: true,
    bestFormat: (v) => (v * 100).toFixed(2) + '%'
  });
  output += '\n';

  output += formatMetricBlock('Drawdown', o.drawdown, {
    usePercentLabels: true,
    showBest: true,
    bestFormat: (v) => (v * 100).toFixed(2) + '%'
  });

  if (result.groupStats.length > 0) {
    const groupLabelMap: Record<string, string> = {
      'field': '字段',
      'expression': '表达式',
      'status': '状态',
      'submit_status': '提交状态'
    };
    const groupLabel = groupLabelMap[result.groupStats[0].groupKey] || result.groupStats[0].groupKey;

    output += `\n按${groupLabel}分组:\n`;

    for (const g of result.groupStats) {
      const successRate = g.totalCount > 0 ? Math.round(g.successCount / g.totalCount * 100) : 0;
      output += `  ${g.groupValue}: ${g.totalCount}条 | 成功率${successRate}% | 中位Sharpe ${g.sharpe.median.toFixed(2)} | 中位Turnover ${g.turnover.median.toFixed(2)}`;
      if (g.sharpe.best > 0) {
        output += ` | 最佳Sharpe ${g.sharpe.best.toFixed(2)}`;
      }
      output += '\n';
    }
  }

  return output;
}

export default {
  alphaBatchSubmit,
  formatResults,
  alphaStats
};
