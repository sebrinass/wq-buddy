import axios from 'axios';
import * as fs from 'fs';

async function checkCorrelationAPI() {
  const tokenCache = JSON.parse(fs.readFileSync('.wq_token.json', 'utf-8'));
  
  const session = axios.create({
    baseURL: 'https://api.worldquantbrain.com',
    timeout: 60000
  });

  // 用刚才测试的那个Alpha ID
  const alphaId = 'j2dPWOn5';
  
  console.log(`🔍 查询 Alpha ${alphaId} 的相关性接口\n`);
  
  // 尝试几个可能的API端点
  const endpoints = [
    `/alphas/${alphaId}/correlation`,
    `/alphas/${alphaId}/self-correlation`, 
    `/alphas/${alphaId}/checks`,
    `/alphas/${alphaId}/status`
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\n--- 尝试: ${endpoint} ---`);
    
    try {
      const response = await session.get(endpoint, {
        headers: { 'Cookie': tokenCache.cookie }
      });
      
      console.log(`✅ 状态码: ${response.status}`);
      console.log('返回数据:', JSON.stringify(response.data, null, 2).substring(0, 1000));
      
    } catch (e: any) {
      if (e.response) {
        console.log(`❌ 状态码: ${e.response.status}`);
        console.log('错误:', e.response.data?.message || e.response.statusText);
      } else {
        console.log('❌ 错误:', e.message);
      }
    }
  }
}

checkCorrelationAPI();
