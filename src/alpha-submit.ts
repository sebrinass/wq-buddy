/**
 * Alpha正式提交
 */

import { AxiosInstance } from 'axios';
import { info, warn } from './logger.js';
import type { Database } from './db/Database.js';

export interface SubmitResult {
  alphaId: string;
  success: boolean;
  message: string;
  reason?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 正式提交Alpha到BRAIN平台
 * - 必须用户确认后才能执行（confirmed === true）
 * - 调用 POST /alphas/{alphaId}/submit
 * - 轮询 GET /alphas/{alphaId}/submit 等待结果
 */
export async function submitAlpha(
  alphaId: string,
  confirmed: boolean,
  session: AxiosInstance,
  cookie: string,
  db?: Database
): Promise<SubmitResult> {
  if (!confirmed) {
    return {
      alphaId,
      success: false,
      message: '必须用户确认后才能提交'
    };
  }

  try {
    // 发起提交请求
    info(`正在提交Alpha ${alphaId}...`);
    const submitResp = await session.post(`/alphas/${alphaId}/submit`, {}, {
      headers: { 'Cookie': cookie },
      validateStatus: (status) => status < 500
    });

    if (submitResp.status !== 200 && submitResp.status !== 201 && submitResp.status !== 202) {
      const errMsg = submitResp.data?.message || submitResp.data?.error || `HTTP ${submitResp.status}`;
      warn(`Alpha ${alphaId} 提交请求失败: ${errMsg}`);
      return {
        alphaId,
        success: false,
        message: '提交请求失败',
        reason: errMsg
      };
    }

    // 轮询等待提交结果
    info(`Alpha ${alphaId} 提交请求已发送，等待结果...`);
    const maxRetries = 60;
    const pollInterval = 3000; // 3秒

    for (let i = 0; i < maxRetries; i++) {
      await sleep(pollInterval);

      try {
        const pollResp = await session.get(`/alphas/${alphaId}/submit`, {
          headers: { 'Cookie': cookie }
        });

        // 检查是否还在处理中
        const retryAfter = parseFloat(pollResp.headers['retry-after'] || '0');
        if (retryAfter > 0) {
          info(`Alpha ${alphaId} 提交仍在处理中... (${i + 1}/${maxRetries})`);
          await sleep(retryAfter * 1000);
          continue;
        }

        const data = pollResp.data;

        // 判断提交结果
        if (data.status === 'DONE' || data.result === 'SUCCESS') {
          info(`Alpha ${alphaId} 提交成功!`);

          // 更新数据库提交状态
          if (db) {
            try {
              await db.updateAlphaSubmitStatusByAlphaId(alphaId, '已提交');
              info(`已更新Alpha ${alphaId} 数据库状态为已提交`);
            } catch (dbErr: any) {
              warn(`更新数据库提交状态失败: ${dbErr.message}`);
            }
          }

          return {
            alphaId,
            success: true,
            message: '提交成功'
          };
        }

        if (data.status === 'ERROR' || data.result === 'FAIL' || data.result === 'REJECTED') {
          const reason = data.message || data.reason || data.error || '未知原因';
          warn(`Alpha ${alphaId} 提交失败: ${reason}`);

          // 更新数据库提交状态
          if (db) {
            try {
              await db.updateAlphaSubmitStatusByAlphaId(alphaId, '提交失败', reason);
            } catch (dbErr: any) {
              warn(`更新数据库提交状态失败: ${dbErr.message}`);
            }
          }

          return {
            alphaId,
            success: false,
            message: '提交失败',
            reason
          };
        }

        // 其他状态继续轮询
        info(`Alpha ${alphaId} 提交状态: ${data.status || data.result || '未知'} (${i + 1}/${maxRetries})`);
      } catch (pollErr: any) {
        warn(`轮询提交状态异常: ${pollErr.message}`);
      }
    }

    // 超时
    warn(`Alpha ${alphaId} 提交轮询超时`);
    return {
      alphaId,
      success: false,
      message: '提交轮询超时，请稍后在BRAIN平台查看结果'
    };
  } catch (e: any) {
    warn(`Alpha ${alphaId} 提交异常: ${e.message}`);
    return {
      alphaId,
      success: false,
      message: '提交异常',
      reason: e.message
    };
  }
}

/**
 * 格式化提交结果
 */
export function formatSubmitResult(result: SubmitResult): string {
  let output = `📤 **Alpha提交结果** — ${result.alphaId}\n\n`;

  if (!result.success) {
    output += `❌ 提交失败\n`;
    output += `原因: ${result.reason || result.message}\n`;
  } else {
    output += `✅ 提交成功\n`;
  }

  return output;
}
