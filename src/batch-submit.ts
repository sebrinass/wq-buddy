import { AxiosInstance } from 'axios';
import type { Database } from './db/Database.js';
import { SimulationData } from './types.js';

export class BatchSubmitter {
  private session: AxiosInstance;
  private db: Promise<Database>;
  private sleepSeconds: number;

  constructor(session: AxiosInstance, db: Promise<Database>, sleepSeconds: number = 10) {
    this.session = session;
    this.db = db;
    this.sleepSeconds = sleepSeconds;
  }

  async submitAlpha(alphaData: SimulationData): Promise<string | null> {
    try {
      const resp = await this.session.post('/simulations', alphaData, {
        maxRedirects: 0,
        validateStatus: (status) => status < 400
      });

      const location = resp.headers['location'];
      if (location) {
        return await this.waitForResult(location);
      } else {
        console.log(`提交失败,无Location Header: ${JSON.stringify(resp.data).substring(0, 200)}`);
        return null;
      }
    } catch (e: any) {
      console.log(`提交异常: ${e.message}`);
      return null;
    }
  }

  private async waitForResult(progressUrl: string, timeout: number = 300): Promise<string | null> {
    const startTime = Date.now();

    while (true) {
      if (Date.now() - startTime > timeout * 1000) {
        console.log('等待超时');
        return null;
      }

      try {
        const resp = await this.session.get(progressUrl);
        const retryAfter = parseFloat(resp.headers['retry-after'] || '0');

        if (retryAfter === 0) {
          const result = resp.data;
          return result.alpha || null;
        }

        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      } catch (e: any) {
        console.log(`等待结果时出错: ${e.message}`);
        return null;
      }
    }
  }

  async submitBatch(alphas: SimulationData[], batchName?: string): Promise<{ success: number; failed: number; details: any[] }> {
    if (!batchName) {
      batchName = `batch_${Date.now()}`;
    }

    const db = await this.db;
    const batchId = await db.insertBatch({
      batch_name: batchName,
      description: `批量提交 ${alphas.length} 个Alpha`,
      total_count: alphas.length,
      success_count: 0,
      fail_count: 0,
      created_at: new Date().toISOString(),
      status: 'running'
    });

    const results = {
      success: 0,
      failed: 0,
      details: [] as any[]
    };

    console.log(`\n开始批量提交 ${alphas.length} 个Alpha...`);

    for (let i = 0; i < alphas.length; i++) {
      const alphaData = alphas[i];
      const expression = alphaData.regular || 'N/A';
      const field = this.extractField(expression);

      console.log(`\n[${i + 1}/${alphas.length}] 提交: ${expression.substring(0, 80)}...`);

      const recordId = await db.insertAlpha({
        alpha_id: null,
        expression,
        field,
        status: 'pending',
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const alphaId = await this.submitAlpha(alphaData);

      if (alphaId) {
        console.log(`成功! Alpha ID: ${alphaId}`);
        await db.updateAlphaStatus(recordId, 'success', alphaId);
        results.success++;
        results.details.push({
          field,
          expression,
          alpha_id: alphaId,
          status: 'success'
        });
      } else {
        console.log('失败!');
        await db.updateAlphaStatus(recordId, 'failed', undefined, '提交失败或无结果');
        results.failed++;
        results.details.push({
          field,
          expression,
          alpha_id: null,
          status: 'failed'
        });
      }

      await db.updateBatchStatus(batchId, {
        success_count: results.success,
        fail_count: results.failed
      });

      if (i < alphas.length - 1) {
        await new Promise(resolve => setTimeout(resolve, this.sleepSeconds * 1000));
      }
    }

    const finalStatus = results.failed === 0 ? 'completed' : 'partial';
    await db.updateBatchStatus(batchId, { status: finalStatus });

    console.log(`\n批量提交完成!`);
    console.log(`成功: ${results.success}, 失败: ${results.failed}`);

    return results;
  }

  private extractField(expression: string): string {
    const match = expression.match(/\((\w+),/);
    if (match) {
      return match[1];
    }
    return expression.substring(0, 50);
  }
}
