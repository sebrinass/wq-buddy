/**
 * Alpha提交前检查 + 相关性查询
 */

import { AxiosInstance } from 'axios';
import { info, warn } from './logger.js';
import type { Database } from './db/Database.js';

export interface CheckItem {
  name: string;
  result: 'PASS' | 'FAIL' | 'PENDING';
  limit?: number;
  value?: number;
}

export interface CheckResult {
  alphaId: string;
  checks: CheckItem[];
  allPassed: boolean;
  failedChecks: CheckItem[];
}

export interface CorrelationResult {
  alphaId: string;
  correlationMax?: number;
  correlationMin?: number;
  raw?: any;
}

/**
 * 提交前检查Alpha的IS Checks
 * 调用 GET /alphas/{alphaId}/check
 */
export async function checkSubmission(
  alphaId: string,
  session: AxiosInstance,
  cookie: string
): Promise<CheckResult> {
  try {
    const response = await session.get(`/alphas/${alphaId}/check`, {
      headers: { 'Cookie': cookie }
    });

    if (response.status !== 200) {
      throw new Error(`检查请求失败: HTTP ${response.status}`);
    }

    const data = response.data;
    const rawChecks = data.is?.checks || data.checks || [];
    const checks: CheckItem[] = rawChecks.map((c: any) => ({
      name: c.name,
      result: c.result,
      limit: c.limit,
      value: c.value
    }));

    const failedChecks = checks.filter(c => c.result === 'FAIL');
    const allPassed = failedChecks.length === 0 && checks.some(c => c.result === 'PASS');

    info(`Alpha ${alphaId} IS检查完成: ${checks.length}项, 通过${checks.filter(c => c.result === 'PASS').length}项, 失败${failedChecks.length}项`);

    return { alphaId, checks, allPassed, failedChecks };
  } catch (e: any) {
    warn(`Alpha ${alphaId} IS检查失败: ${e.message}`);
    return {
      alphaId,
      checks: [],
      allPassed: false,
      failedChecks: []
    };
  }
}

/**
 * 获取Alpha的相关性数据
 * 调用 GET /alphas/{alphaId}/correlations/power-pool
 * 注意：/correlations/prod 端点仅Consultant可访问，Pre-Consultant返回403
 */
export async function getAlphaCorrelations(
  alphaId: string,
  session: AxiosInstance,
  cookie: string,
  db?: Database
): Promise<CorrelationResult> {
  try {
    const response = await session.get(`/alphas/${alphaId}/correlations/power-pool`, {
      headers: { 'Cookie': cookie }
    });

    if (response.status !== 200) {
      throw new Error(`相关性查询失败: HTTP ${response.status}`);
    }

    const data = response.data;

    let correlationMax: number | undefined;
    let correlationMin: number | undefined;

    if (typeof data === 'string' && data.trim() === '') {
      info(`Alpha ${alphaId} 暂无Power Pool相关性数据（可能尚未提交）`);
    } else if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data)) {
        const values = data.map((c: any) => c.correlation ?? c.value).filter((v: any) => typeof v === 'number');
        if (values.length > 0) {
          correlationMax = Math.max(...values);
          correlationMin = Math.min(...values);
        }
      } else {
        correlationMax = data.correlation_max ?? data.max ?? data.maximum ?? undefined;
        correlationMin = data.correlation_min ?? data.min ?? data.minimum ?? undefined;
      }
    }

    info(`Alpha ${alphaId} 相关性查询完成: Max=${correlationMax ?? 'N/A'}, Min=${correlationMin ?? 'N/A'}`);

    // 自动更新数据库
    if (db && (correlationMax !== undefined || correlationMin !== undefined)) {
      try {
        await db.updateAlphaCorrelation(alphaId, correlationMax, correlationMin);
        info(`已更新Alpha ${alphaId} 的相关性到数据库`);
      } catch (dbErr: any) {
        warn(`更新相关性到数据库失败: ${dbErr.message}`);
      }
    }

    return {
      alphaId,
      correlationMax,
      correlationMin,
      raw: data
    };
  } catch (e: any) {
    warn(`Alpha ${alphaId} 相关性查询失败: ${e.message}`);
    return { alphaId };
  }
}

/**
 * 格式化IS检查结果
 */
export function formatCheckResult(result: CheckResult): string {
  let output = `📋 **IS检查结果** — Alpha ${result.alphaId}\n\n`;

  if (result.checks.length === 0) {
    output += '未获取到检查数据\n';
    return output;
  }

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

  for (const check of result.checks) {
    const icon = check.result === 'PASS' ? '✅' : check.result === 'FAIL' ? '❌' : '⏳';
    const name = checkNameMap[check.name] || check.name;
    let line = `${icon} ${name}: ${check.result}`;
    if (check.name === 'SELF_CORRELATION' && check.value !== undefined) {
      line += ` (值: ${(check.value * 100).toFixed(2)}%, 限制: ${(check.limit ?? 0) * 100}%)`;
    }
    output += line + '\n';
  }

  output += '\n';
  if (result.allPassed) {
    output += '🟢 **综合判断: 全部PASS，可以提交**\n';
  } else if (result.failedChecks.length > 0) {
    output += `🔴 **综合判断: ${result.failedChecks.length}项FAIL，不可提交**\n`;
    output += '失败项: ' + result.failedChecks.map(c => checkNameMap[c.name] || c.name).join(', ') + '\n';
  } else {
    output += '🟡 **综合判断: 检查未完成**\n';
  }

  return output;
}

/**
 * 格式化相关性查询结果
 */
export function formatCorrelationResult(result: CorrelationResult): string {
  let output = `🔗 **相关性数据** — Alpha ${result.alphaId}\n\n`;

  if (result.correlationMax === undefined && result.correlationMin === undefined) {
    output += '未获取到相关性数据\n';
    return output;
  }

  if (result.correlationMax !== undefined) {
    output += `Maximum相关性: ${(result.correlationMax * 100).toFixed(2)}%\n`;
  }
  if (result.correlationMin !== undefined) {
    output += `Minimum相关性: ${(result.correlationMin * 100).toFixed(2)}%\n`;
  }

  return output;
}
