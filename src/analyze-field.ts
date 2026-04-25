/**
 * 字段分析工具
 * 用于分析数据字段特性，复用回测接口但不自动保存到alpha数据库
 */

import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import { loadConfig, getDefaultSettings } from './config.js';
import { info, warn, error as logError, debug } from './logger.js';
import { getDatabase } from './db/index.js';
import { TOKEN_PATH } from './paths.js';

export interface FieldAnalysisResult {
  field_name: string;
  coverage?: number;
  update_freq?: string;
  data_range?: string;
  ai_summary?: string;
  raw_data: {
    test1?: any; // datafield
    test2?: any; // datafield != 0
    test3?: any; // ts_std_dev
    test4?: any; // abs > X
    test5?: any; // ts_median
    test6?: any; // scale_down distribution
  };
}

const ANALYSIS_TESTS = [
  { name: 'test1', expr: (f: string) => f, desc: '覆盖率' },
  { name: 'test2', expr: (f: string) => `${f} != 0 ? 1 : 0`, desc: '非零覆盖率' },
  { name: 'test3', expr: (f: string) => `ts_std_dev(${f}, 22) != 0 ? 1 : 0`, desc: '更新频率(月)' },
  { name: 'test4', expr: (f: string) => `abs(${f}) > 1`, desc: '数据范围(>1)' },
  { name: 'test5', expr: (f: string) => `ts_median(${f}, 1000) > 0`, desc: '中位数>0' },
  { name: 'test6', expr: (f: string) => `scale_down(${f})`, desc: '数据分布' }
];

async function getSession(username: string, password: string): Promise<{ session: AxiosInstance; cookie: string }> {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const cache = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
      if (cache.expiryTime > Date.now()) {
        const session = axios.create({
          baseURL: 'https://api.worldquantbrain.com',
          timeout: 60000
        });
        await session.get('/users/me', { headers: { 'Cookie': cache.cookie } });
        return { session, cookie: cache.cookie };
      }
    }
  } catch (e) {
    // token无效，重新登录
  }

  const session = axios.create({
    baseURL: 'https://api.worldquantbrain.com',
    timeout: 60000
  });

  const response = await session.post('/authentication', {}, {
    auth: { username, password }
  });

  const setCookie = response.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const cookie = cookies.map((c: any) => String(c).split(';')[0]).join('; ');

  return { session, cookie };
}

async function submitAnalysisTest(session: AxiosInstance, cookie: string, expression: string, settings: any): Promise<any> {
  const simulationData = {
    type: 'REGULAR',
    settings: {
      instrumentType: settings.instrumentType,
      region: settings.region,
      universe: settings.universe,
      delay: settings.delay,
      decay: 0, // 分析用decay=0
      neutralization: 'NONE', // 分析用无中性化
      truncation: settings.truncation,
      pasteurization: settings.pasteurization,
      unitHandling: settings.unitHandling,
      nanHandling: settings.nanHandling,
      language: settings.language,
      visualization: false
    },
    regular: expression
  };

  const response = await session.post('/simulations', simulationData, {
    headers: { 'Cookie': cookie }
  });

  const location = response.headers['location'];
  if (!location) throw new Error('No Location header');

  // 等待完成
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const progressResp = await session.get(location, { headers: { 'Cookie': cookie } });
    const retryAfter = parseFloat(progressResp.headers['retry-after'] || '0');
    
    if (retryAfter > 0) {
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      continue;
    }

    return progressResp.data;
  }
}

export async function analyzeField(fieldName: string, autoSave: boolean = true): Promise<FieldAnalysisResult> {
  info('开始分析字段', fieldName);

  const config = loadConfig();
  if (!config) throw new Error('配置文件加载失败');

  const creds = config.credentials;
  if (!creds.username || !creds.password) {
    throw new Error('请在 config.json 中配置账号密码');
  }

  const { session, cookie } = await getSession(creds.username, creds.password);
  const settings = getDefaultSettings(config);

  const result: FieldAnalysisResult = {
    field_name: fieldName,
    raw_data: {}
  };

  // 执行6个分析测试
  for (const test of ANALYSIS_TESTS) {
    const expression = test.expr(fieldName);
    info(`执行测试: ${test.desc}`, expression);

    try {
      const data = await submitAnalysisTest(session, cookie, expression, settings);
      result.raw_data[test.name as keyof typeof result.raw_data] = data;

      // 解析结果
      if (data.status === 'COMPLETE' && data.alpha) {
        const alphaResp = await session.get(`/alphas/${data.alpha}`, {
          headers: { 'Cookie': cookie }
        });
        const alphaInfo = alphaResp.data.is || {};

        if (test.name === 'test1') {
          // 覆盖率 = (long + short) / universe_size
          const universeSize = 3000; // TOP3000
          result.coverage = ((alphaInfo.longCount || 0) + (alphaInfo.shortCount || 0)) / universeSize;
        }
      }
    } catch (e: any) {
      warn(`测试失败: ${test.desc}`, e.message);
    }

    // 测试间隔
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // 生成AI总结
  result.ai_summary = generateSummary(result);

  info('字段分析完成', {
    field: fieldName,
    coverage: result.coverage
  });

  // 可选：保存到数据库
  if (autoSave) {
    try {
      const db = await getDatabase();
      const existing = await db.getFieldAnalysis(fieldName);
      
      if (existing) {
        await db.updateFieldAnalysis(existing.id, {
          coverage: result.coverage,
          update_freq: result.update_freq,
          data_range: result.data_range,
          ai_summary: result.ai_summary,
          last_tested: new Date().toISOString().split('T')[0]
        });
        info('字段分析已更新', fieldName);
      } else {
        await db.insertFieldAnalysis({
          field_name: result.field_name,
          coverage: result.coverage,
          update_freq: result.update_freq,
          data_range: result.data_range,
          ai_summary: result.ai_summary
        });
        info('字段分析已保存', fieldName);
      }
    } catch (e: any) {
      warn('保存字段分析失败', e.message);
    }
  }

  return result;
}

function generateSummary(result: FieldAnalysisResult): string {
  const parts: string[] = [];
  
  if (result.coverage !== undefined) {
    parts.push(`覆盖率: ${(result.coverage * 100).toFixed(1)}%`);
  }
  
  if (result.update_freq) {
    parts.push(`更新频率: ${result.update_freq}`);
  }
  
  if (result.data_range) {
    parts.push(`数据范围: ${result.data_range}`);
  }

  return parts.length > 0 ? parts.join(', ') : '分析完成，等待更多测试数据';
}

export function formatAnalysisResult(result: FieldAnalysisResult): string {
  let output = `📊 **字段分析报告**\n\n`;
  output += `**字段**: \`${result.field_name}\`\n\n`;

  if (result.coverage !== undefined) {
    output += `- **覆盖率**: ${(result.coverage * 100).toFixed(1)}%\n`;
  }
  if (result.update_freq) {
    output += `- **更新频率**: ${result.update_freq}\n`;
  }
  if (result.data_range) {
    output += `- **数据范围**: ${result.data_range}\n`;
  }

  output += `\n**AI总结**:\n${result.ai_summary}\n`;

  return output;
}
