import axios, { AxiosInstance } from 'axios';

export interface DataField {
  id: string;
  name?: string;
  description?: string;
  type?: string;
  datasetId?: string;
  [key: string]: any;
}

export class DataSearcher {
  private session: AxiosInstance;

  constructor(session: AxiosInstance) {
    this.session = session;
  }

  async searchDatafields(params: {
    instrumentType?: string;
    region?: string;
    delay?: number;
    universe?: string;
    datasetId?: string;
    dataType?: string;
    search?: string;
  }): Promise<DataField[]> {
    const {
      instrumentType = 'EQUITY',
      region = 'USA',
      delay = 1,
      universe = 'TOP3000',
      datasetId = '',
      dataType = 'MATRIX',
      search = ''
    } = params;

    let offset = 0;
    const allDatafields: DataField[] = [];

    while (true) {
      let url = `/data-fields?` +
        `&instrumentType=${instrumentType}` +
        `&region=${region}&delay=${delay}&universe=${universe}&dataset.id=${datasetId}&limit=50` +
        `&offset=${offset}` +
        `&type=${dataType}`;

      if (search) {
        url += `&search=${search}`;
      }

      try {
        const resp = await this.session.get(url);
        const results = resp.data;

        if (!results.results) {
          console.log(`获取到意外响应: ${JSON.stringify(results).substring(0, 200)}`);
          break;
        }

        console.log(`已获取 ${results.results.length} 个数据字段 (偏移量: ${offset})`);
        allDatafields.push(...results.results);

        if (results.results.length < 50) {
          console.log('已获取最后一批数据字段');
          break;
        }

        offset += 50;
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (e: any) {
        console.log(`获取数据字段时出错: ${e.message}`);
        break;
      }
    }

    return allDatafields;
  }

  getFieldIds(datafields: DataField[]): string[] {
    return datafields.filter(df => df.id).map(df => df.id);
  }

  getFieldInfo(datafields: DataField[]): Array<{id: string; name: string; description: string; type: string}> {
    return datafields.map(df => ({
      id: df.id || '',
      name: df.name || '',
      description: df.description || '',
      type: df.type || ''
    }));
  }

  async fuzzySearch(searchTerm: string, dataType?: string, limit: number = 50): Promise<DataField[]> {
    let offset = 0;
    const allDatafields: DataField[] = [];

    console.log(`正在模糊搜索: "${searchTerm}"...`);

    while (true) {
      let url = `/data-fields?` +
        `&search=${encodeURIComponent(searchTerm)}` +
        `&limit=${limit}` +
        `&offset=${offset}`;

      if (dataType && dataType !== 'ALL') {
        url += `&type=${dataType}`;
      }

      try {
        const resp = await this.session.get(url);
        const results = resp.data;

        if (!results.results || results.results.length === 0) {
          break;
        }

        console.log(`已获取 ${results.results.length} 个结果 (偏移量: ${offset})`);
        allDatafields.push(...results.results);

        if (results.results.length < limit) {
          break;
        }

        offset += limit;
        // 增加间隔避免429
        await new Promise(resolve => setTimeout(resolve, 10000));
      } catch (e: any) {
        console.log(`搜索时出错: ${e.message}`);
        if (e.response && e.response.status === 429) {
          console.log('请求过于频繁,等待30秒后重试...');
          await new Promise(resolve => setTimeout(resolve, 30000));
          continue;
        }
        break;
      }
    }

    return allDatafields;
  }
}
