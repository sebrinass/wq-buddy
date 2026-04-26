/**
 * Alpha列表管理
 */

import { AxiosInstance } from 'axios';
import { info, warn } from './logger.js';

export interface AlphaListItem {
  id: string;
  code?: string;
  status?: string;
  sharpe?: number;
  turnover?: number;
  fitness?: number;
  returns?: number;
  drawdown?: number;
  grade?: string;
  stage?: string;
  dateSubmitted?: string;
}

export interface ListAlphasOptions {
  status?: string;
  limit?: number;
  offset?: number;
  order_by?: string;
}

export interface ListAlphasResult {
  alphas: AlphaListItem[];
  totalCount: number;
  limit: number;
  offset: number;
}

/**
 * 获取用户的Alpha列表
 * 调用 GET /users/self/alphas
 */
export async function listAlphas(
  options: ListAlphasOptions,
  session: AxiosInstance,
  cookie: string
): Promise<ListAlphasResult> {
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;

  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    });

    if (options.status) {
      params.append('status', options.status);
    }

    const response = await session.get(`/users/self/alphas?${params.toString()}`, {
      headers: { 'Cookie': cookie }
    });

    if (response.status !== 200) {
      throw new Error(`获取Alpha列表失败: HTTP ${response.status}`);
    }

    const data = response.data;
    const results = data.results || data || [];
    const totalCount = data.count || results.length;

    const alphas: AlphaListItem[] = results.map((item: any) => ({
      id: item.id || '',
      code: item.regular?.code || item.code || '',
      status: item.status || '',
      sharpe: item.is?.sharpe ?? item.sharpe ?? undefined,
      turnover: item.is?.turnover ?? item.turnover ?? undefined,
      fitness: item.is?.fitness ?? item.fitness ?? undefined,
      returns: item.is?.returns ?? item.returns ?? undefined,
      drawdown: item.is?.drawdown ?? item.drawdown ?? undefined,
      grade: item.grade || '',
      stage: item.stage || '',
      dateSubmitted: item.dateSubmitted || item.date_submitted || ''
    }));

    info(`获取Alpha列表: ${alphas.length}条 (共${totalCount}条)`);

    return {
      alphas,
      totalCount,
      limit,
      offset
    };
  } catch (e: any) {
    warn(`获取Alpha列表失败: ${e.message}`);
    return {
      alphas: [],
      totalCount: 0,
      limit,
      offset
    };
  }
}

/**
 * 格式化Alpha列表为表格输出
 */
export function formatAlphaList(result: ListAlphasResult): string {
  let output = `📊 **Alpha列表**\n\n`;
  output += `共 ${result.totalCount} 个Alpha (显示 ${result.offset + 1}-${result.offset + result.alphas.length})\n\n`;

  if (result.alphas.length === 0) {
    output += '暂无Alpha数据\n';
    return output;
  }

  // 表头
  output += '| ID | 表达式 | 状态 | Sharpe | Turnover | Fitness | 等级 |\n';
  output += '|----|--------|------|--------|----------|---------|------|\n';

  for (const alpha of result.alphas) {
    const id = alpha.id.substring(0, 12);
    const code = (alpha.code || '-').substring(0, 30);
    const status = alpha.status || '-';
    const sharpe = alpha.sharpe !== undefined ? alpha.sharpe.toFixed(3) : '-';
    const turnover = alpha.turnover !== undefined ? (alpha.turnover * 100).toFixed(1) + '%' : '-';
    const fitness = alpha.fitness !== undefined ? alpha.fitness.toFixed(3) : '-';
    const grade = alpha.grade || '-';

    output += `| ${id} | ${code} | ${status} | ${sharpe} | ${turnover} | ${fitness} | ${grade} |\n`;
  }

  return output;
}
