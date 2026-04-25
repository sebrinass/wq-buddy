/**
 * Alpha Workbench 搜索工具
 * 用于搜索 WorldQuant BRAIN 数据字段
 */

import { AxiosInstance } from 'axios';
import { loadConfig } from './config.js';
import { info } from './logger.js';
import { Authenticator } from './auth.js';

export interface DataField {
  id: string;
  name?: string;
  description?: string;
  type?: string;
  datasetId?: string;
}

export interface SearchResult {
  fields: DataField[];
  totalCount: number;
  searchKeyword: string;
  datasetId?: string;
}

async function getSession(username: string, password: string): Promise<{ session: AxiosInstance; cookie: string }> {
  const cached = await Authenticator.getSessionWithCookie(username);
  if (cached) {
    info('搜索工具使用缓存的Token登录');
    return cached;
  }

  info('搜索工具正在登录...');
  const result = await Authenticator.loginWithCookie(username, password);
  info('搜索工具登录成功');
  return result;
}

export async function searchFields(
  keyword: string,
  options?: {
    datasetId?: string;
    dataType?: string;
    limit?: number;
    username?: string;
    password?: string;
  }
): Promise<SearchResult> {
  const config = loadConfig();
  if (!config) {
    throw new Error('配置文件加载失败');
  }

  const creds = config.credentials;
  const user = options?.username || creds.username;
  const pass = options?.password || creds.password;

  if (!user || !pass) {
    throw new Error('请在 config.json 中配置账号密码');
  }

  info('搜索工具登录', { user });
  const { session, cookie } = await getSession(user, pass);

  const limit = options?.limit || 50;
  const dataType = options?.dataType || '';
  const datasetId = options?.datasetId || '';

  const params = new URLSearchParams({
    instrumentType: 'EQUITY',
    region: 'USA',
    delay: '1',
    universe: 'TOP3000',
    limit: limit.toString()
  });

  if (keyword) {
    params.append('search', keyword);
  }

  if (datasetId) {
    params.append('dataset.id', datasetId);
  }

  if (dataType) {
    params.append('type', dataType);
  }

  const url = `https://api.worldquantbrain.com/data-fields?${params.toString()}`;

  info('搜索字段', { keyword: keyword || '(无)', dataset: datasetId || '(无)', limit });

  const response = await session.get(url, {
    headers: { 'Cookie': cookie }
  });

  if (response.status !== 200) {
    throw new Error(`搜索失败: HTTP ${response.status}`);
  }

  const data = response.data;
  const results = data.results || [];

  const fields: DataField[] = results.map((item: any) => ({
    id: item.id || '',
    name: item.name || '',
    description: item.description || '',
    type: item.type || '',
    datasetId: item.dataset?.id || datasetId
  }));

  return {
    fields,
    totalCount: fields.length,
    searchKeyword: keyword,
    datasetId: datasetId || undefined
  };
}

export async function getFieldsByDataset(
  datasetId: string,
  options?: {
    dataType?: string;
    limit?: number;
    username?: string;
    password?: string;
  }
): Promise<SearchResult> {
  return searchFields('', {
    datasetId,
    dataType: options?.dataType || 'MATRIX',
    limit: options?.limit || 200,
    username: options?.username,
    password: options?.password
  });
}

export function formatSearchResults(result: SearchResult): string {
  let output = `📊 **搜索结果**\n\n`;
  output += `**关键词**: ${result.searchKeyword || '(无)'}\n`;
  output += `**数据集**: ${result.datasetId || '(无)'}\n`;
  output += `**找到**: ${result.totalCount} 个字段\n\n`;

  if (result.fields.length === 0) {
    output += '未找到匹配的字段';
    return output;
  }

  output += '**字段列表**:\n\n';

  for (const field of result.fields.slice(0, 20)) {
    output += `- \`${field.id}\``;
    if (field.description) {
      const shortDesc = field.description.length > 100 ? field.description.substring(0, 100) + '...' : field.description;
      output += `\n  > ${shortDesc}`;
    }
    output += '\n\n';
  }

  if (result.fields.length > 20) {
    output += `\n... 还有 ${result.fields.length - 20} 个字段`;
  }

  return output;
}

export default {
  searchFields,
  getFieldsByDataset,
  formatSearchResults
};
