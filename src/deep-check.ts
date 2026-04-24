import axios from 'axios';
import * as fs from 'fs';

async function deepCheckAlphaData() {
  const tokenCache = JSON.parse(fs.readFileSync('.wq_token.json', 'utf-8'));
  
  const session = axios.create({
    baseURL: 'https://api.worldquantbrain.com',
    timeout: 60000
  });

  const alphaId = 'j2dPWOn5';
  
  console.log(`🔍 深度检查 Alpha: ${alphaId}\n`);
  
  try {
    const response = await session.get(`/alphas/${alphaId}`, {
      headers: { 'Cookie': tokenCache.cookie }
    });
    
    const data = response.data;
    
    // 查找所有包含 correlation / self 相关的字段
    const jsonStr = JSON.stringify(data);
    
    console.log('=== 查找 correlation/self 相关字段 ===');
    
    // 用正则找相关key
    const patterns = [
      /"[^"]*correl[^"]*"\s*:/gi,
      /"[^"]*self[^"]*"\s*:/gi,
      /"[^"]*similar[^"]*"\s*:/gi,
      /"[^"]*check[^"]*"\s*:/gi
    ];
    
    for (const pattern of patterns) {
      const matches = jsonStr.match(pattern);
      if (matches && matches.length > 0) {
        console.log(`\n匹配到 (${pattern.source}):`);
        matches.forEach(m => {
          // 提取完整键值对
          const idx = jsonStr.indexOf(m.replace(':', ''));
          if (idx !== -1) {
            const snippet = jsonStr.substring(idx, idx + 200);
            console.log(`  ${snippet}`);
          }
        });
      }
    }
    
    // 特别检查 is.checks 数组
    if (data.is && data.is.checks) {
      console.log('\n=== 完整 IS Checks ===');
      for (const check of data.is.checks) {
        if (check.name === 'SELF_CORRELATION') {
          console.log('\n🎯 SELF_CORRELATION 详情:');
          console.log(JSON.stringify(check, null, 2));
          
          // 检查有没有额外字段
          console.log('\n所有字段:', Object.keys(check));
        }
      }
    }
    
    // 检查顶层是否有其他相关性字段
    console.log('\n=== 所有顶层字段 ===');
    Object.keys(data).forEach(key => {
      const value = data[key];
      if (typeof value === 'object' && value !== null) {
        console.log(`${key}: [object] (keys: ${Object.keys(value).slice(0,5).join(', ')})`);
      } else {
        console.log(`${key}: ${value}`);
      }
    });
    
  } catch (e: any) {
    console.error('❌ 失败:', e.message);
  }
}

deepCheckAlphaData();
