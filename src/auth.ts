import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const TOKEN_FILE = path.join(process.cwd(), '.wq_token.json');

interface TokenCache {
  username: string;
  cookie: string;
  token: string;
  expiryTime: number;
  userId: string;
}

function extractCookie(setCookieHeaders: any): string {
  if (!setCookieHeaders) return '';
  const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  return cookies.map((c: string) => c.split(';')[0]).join('; ');
}

export class Authenticator {
  private session: AxiosInstance | null = null;
  private isAuthenticated = false;
  private currentUser: string = '';

  constructor() {}

  private loadCachedToken(): TokenCache | null {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        const raw = fs.readFileSync(TOKEN_FILE, 'utf-8');
        const cache: TokenCache = JSON.parse(raw);
        
        const now = Date.now();
        if (cache.expiryTime > now) {
          console.log('✅ 发现有效Token，自动登录中...');
          return cache;
        } else {
          console.log('⚠️ Token已过期，需要重新登录');
          fs.unlinkSync(TOKEN_FILE);
          return null;
        }
      }
    } catch (e) {
      console.log('⚠️ Token缓存读取失败');
    }
    return null;
  }

  private saveToken(username: string, tokenData: any, cookie?: string): void {
    try {
      const cache: TokenCache = {
        username,
        cookie: cookie || '',
        token: tokenData.token || '',
        expiryTime: Date.now() + (tokenData.expiry || 14400) * 1000,
        userId: tokenData.user?.id || ''
      };
      
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(cache, null, 2));
      console.log('💾 Token已保存到本地缓存');
    } catch (e) {
      console.log('⚠️ Token保存失败（不影响正常使用）');
    }
  }

  async login(username: string, password: string): Promise<boolean> {
    try {
      this.currentUser = username;
      console.log('正在登录WorldQuant BRAIN平台...');
      
      this.session = axios.create({
        baseURL: 'https://api.worldquantbrain.com',
        timeout: 30000,
        auth: {
          username: username,
          password: password
        }
      });

      const response = await this.session.post('/authentication');

      if (response.status === 200 || response.status === 201) {
        this.isAuthenticated = true;
        console.log('✅ 登录成功!');
        
        const userData = response.data;
        console.log(`   用户ID: ${userData.user?.id || 'N/A'}`);
        console.log(`   权限: ${Array.isArray(userData.permissions) ? userData.permissions.join(', ') : 'N/A'}`);
        
        const cookie = extractCookie(response.headers['set-cookie']);
        this.saveToken(username, userData, cookie);
        return true;
      } else {
        console.log(`❌ 登录失败: HTTP ${response.status}`);
        return false;
      }
    } catch (e: any) {
      console.log(`❌ 登录异常: ${e.message}`);
      if (e.response) {
        console.log(`   响应状态: ${e.response.status}`);
        if (e.response.data?.message) {
          console.log(`   错误信息: ${e.response.data.message}`);
        }
      }
      return false;
    }
  }

  async autoLogin(): Promise<boolean> {
    const cached = this.loadCachedToken();
    if (!cached) {
      return false;
    }

    try {
      this.currentUser = cached.username;
      console.log('使用缓存Token自动登录...');
      
      this.session = axios.create({
        baseURL: 'https://api.worldquantbrain.com',
        timeout: 30000
      });

      const response = await this.session.get('/users/me', {
        headers: { 'Cookie': cached.cookie }
      });

      if (response.status === 200) {
        this.isAuthenticated = true;
        console.log('✅ 自动登录成功!');
        return true;
      } else {
        console.log('⚠️ Token失效，需要重新登录');
        return false;
      }
    } catch (e: any) {
      console.log('⚠️ 自动登录失败，需要手动登录');
      return false;
    }
  }

  static async loginWithCookie(username: string, password: string): Promise<{ session: AxiosInstance; cookie: string }> {
    const session = axios.create({
      baseURL: 'https://api.worldquantbrain.com',
      timeout: 60000
    });

    const response = await session.post('/authentication', {}, {
      auth: { username, password }
    });

    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`登录失败: HTTP ${response.status}`);
    }

    const cookie = extractCookie(response.headers['set-cookie']);
    if (!cookie) {
      throw new Error('登录失败: 未获取到认证Cookie');
    }

    const userData = response.data;
    const expiry = userData.token?.expiry || 14400;
    
    try {
      const cache: TokenCache = {
        username,
        cookie,
        token: userData.token || '',
        expiryTime: Date.now() + expiry * 1000,
        userId: userData.user?.id || ''
      };
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(cache, null, 2));
    } catch (e) {
      // ignore
    }

    return { session, cookie };
  }

  static async getSessionWithCookie(username: string): Promise<{ session: AxiosInstance; cookie: string } | null> {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        const raw = fs.readFileSync(TOKEN_FILE, 'utf-8');
        const cache: TokenCache = JSON.parse(raw);
        
        if (cache.expiryTime > Date.now() && cache.username === username && cache.cookie) {
          const session = axios.create({
            baseURL: 'https://api.worldquantbrain.com',
            timeout: 60000
          });

          await session.get('/users/me', {
            headers: { 'Cookie': cache.cookie }
          });

          return { session, cookie: cache.cookie };
        }
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  getSession(): AxiosInstance | null {
    return this.session;
  }

  getIsAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  getCurrentUser(): string {
    return this.currentUser;
  }
}
