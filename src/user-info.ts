/**
 * 获取用户信息
 */

import { AxiosInstance } from 'axios';
import { info, warn } from './logger.js';

export interface UserInfo {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  organization?: string;
  permissions?: string[];
}

/**
 * 获取当前登录用户信息
 * 调用 GET /users/self
 */
export async function getUserInfo(
  session: AxiosInstance,
  cookie: string
): Promise<UserInfo | null> {
  try {
    const response = await session.get('/users/self', {
      headers: { 'Cookie': cookie }
    });

    if (response.status !== 200) {
      throw new Error(`获取用户信息失败: HTTP ${response.status}`);
    }

    const data = response.data;

    const userInfo: UserInfo = {
      id: data.id || '',
      username: data.username || '',
      email: data.email || undefined,
      firstName: data.firstName || data.first_name || undefined,
      lastName: data.lastName || data.last_name || undefined,
      organization: data.organization || data.organization_name || undefined,
      permissions: Array.isArray(data.permissions) ? data.permissions : undefined
    };

    info(`获取用户信息成功: ${userInfo.username} (${userInfo.id})`);

    return userInfo;
  } catch (e: any) {
    warn(`获取用户信息失败: ${e.message}`);
    return null;
  }
}

/**
 * 格式化用户信息
 */
export function formatUserInfo(user: UserInfo | null): string {
  if (!user) {
    return '❌ 未获取到用户信息\n';
  }

  let output = `👤 **用户信息**\n\n`;
  output += `用户名: ${user.username}\n`;
  output += `用户ID: ${user.id}\n`;
  if (user.email) output += `邮箱: ${user.email}\n`;
  if (user.firstName || user.lastName) {
    output += `姓名: ${[user.firstName, user.lastName].filter(Boolean).join(' ')}\n`;
  }
  if (user.organization) output += `组织: ${user.organization}\n`;
  if (user.permissions && user.permissions.length > 0) {
    output += `权限: ${user.permissions.join(', ')}\n`;
  }

  return output;
}
