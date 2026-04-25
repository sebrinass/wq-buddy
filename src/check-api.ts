import axios from 'axios';
import * as fs from 'fs';
import { TOKEN_PATH } from './paths.js';

async function checkAlphaData() {
  const tokenCache = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  
  const session = axios.create({
    baseURL: 'https://api.worldquantbrain.com',
    timeout: 60000
  });

  // 用刚才测试成功的一个Alpha ID
  const alphaId = 'Jj5W0jle'; // sharpe=1.98 那个
  
  console.log(`🔍 检查 Alpha: ${alphaId} 的完整API返回数据\n`);
  
  try {
    const response = await session.get(`/alphas/${alphaId}`, {
      headers: { 'Cookie': tokenCache.cookie }
    });
    
    const data = response.data;
    
    console.log('=== 顶层字段 ===');
    console.log(Object.keys(data));
    
    if (data.is) {
      console.log('\n=== data.is 字段 ===');
      console.log(Object.keys(data.is));
    }
    
    if (data.oos) {
      console.log('\n=== data.oos 字段 (OOS) ===');
      console.log(Object.keys(data.oos));
    }
    
    // 特别查找 testing status 相关
    console.log('\n=== 查找 status/testing 相关字段 ===');
    const allKeys = JSON.stringify(data).match(/"status"|"testing"|"isTesting"/gi);
    console.log('找到的状态相关key:', allKeys);
    
    // 打印完整结构（截断）
    console.log('\n=== 完整数据预览 ===');
    console.log(JSON.stringify(data, null, 2).substring(0, 3000));
    
  } catch (e: any) {
    console.error('❌ 失败:', e.message);
  }
}

checkAlphaData();
