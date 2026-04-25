import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import axios, { AxiosInstance } from 'axios';
import { loadConfig, getDefaultSettings } from './config.js';
import { Authenticator } from './auth.js';
import { getDatabase } from './db/index.js';
import type { Database } from './db/Database.js';
import { SimulationSettings } from './types.js';
import { WORK_DIR, ensureWorkDir } from './paths.js';
import * as path from 'path';

interface SimResult {
  field: string;
  alpha_id: string | null;
  status: 'success' | 'failed' | 'error';
  error?: string;
  submittedAt: string;
  completedAt?: string;
}

class AlphaWorkbench {
  private config!: NonNullable<ReturnType<typeof loadConfig>>;
  private db!: Promise<Database>;
  private auth!: Authenticator;
  private defaultSettings!: SimulationSettings;
  private session: AxiosInstance | null = null;

  constructor() {
    const loadedConfig = loadConfig();
    if (!loadedConfig) {
      console.error(chalk.red('配置文件加载失败,请检查config.json'));
      process.exit(1);
    }
    this.config = loadedConfig;

    this.db = getDatabase();
    this.auth = new Authenticator();
    this.defaultSettings = getDefaultSettings(this.config);

    console.log(chalk.cyan('='.repeat(60)));
    console.log(chalk.cyan('WQBuddy v1.0.0'));
    console.log(chalk.cyan('WorldQuant BRAIN Alpha挖掘伙伴'));
    console.log(chalk.cyan('='.repeat(60)));
  }

  async login(): Promise<boolean> {
    console.log(chalk.cyan('\n[登录流程]'));

    const autoSuccess = await this.auth.autoLogin();
    if (autoSuccess) {
      this.session = this.auth.getSession();
      return true;
    }

    console.log(chalk.yellow('\n需要手动登录，请输入账号密码:'));

    const { username } = await inquirer.prompt([
      {
        type: 'input',
        name: 'username',
        message: '邮箱/用户名:',
        validate: (input: string) => input.length > 0 || '用户名不能为空'
      }
    ]);

    const { password } = await inquirer.prompt([
      {
        type: 'password',
        name: 'password',
        message: '密码:',
        mask: '*',
        validate: (input: string) => input.length > 0 || '密码不能为空'
      }
    ]);

    const success = await this.auth.login(username, password);
    if (success) {
      this.session = this.auth.getSession();
      return true;
    }

    return false;
  }

  async autoBatchMode(): Promise<void> {
    console.log(chalk.yellow('\n=== 全自动批量回测模式 ==='));
    console.log('此模式将批量提交Alpha回测任务\n');

    const { expressionsInput } = await inquirer.prompt([
      {
        type: 'input',
        name: 'expressionsInput',
        message: 'Alpha表达式列表 (每行一条，或用逗号分隔)\n示例: rank(cash_flow), ts_delta(earnings,5), abs(revenue)',
        validate: (input: string) => input.length > 0 || '表达式不能为空'
      }
    ]);

    // 支持逗号分隔或换行分隔
    const expressions = expressionsInput
      .split(/[,\n]/)
      .map((e: string) => e.trim())
      .filter((e: string) => e.length > 0);

    if (expressions.length === 0) {
      console.log(chalk.yellow('没有有效的表达式，返回主菜单'));
      return;
    }

    console.log(chalk.cyan('\n' + '='.repeat(60)));
    console.log(chalk.cyan('回测预览'));
    console.log(chalk.cyan('='.repeat(60)));

    console.log(chalk.yellow('\n表达式列表:'));
    console.log(`   共 ${expressions.length} 条表达式`);
    if (expressions.length <= 5) {
      expressions.forEach((e: string, i: number) => console.log(`   ${i + 1}. ${e}`));
    } else {
      expressions.slice(0, 3).forEach((e: string, i: number) => console.log(`   ${i + 1}. ${e}`));
      console.log(`   ... 还有 ${expressions.length - 3} 条表达式`);
    }

    console.log(chalk.yellow('\n当前配置设置:'));
    console.log(`   instrumentType: ${this.defaultSettings.instrumentType || 'EQUITY'}`);
    console.log(`   region: ${this.defaultSettings.region || 'USA'}`);
    console.log(`   universe: ${this.defaultSettings.universe || 'TOP3000'}`);
    console.log(`   delay: ${this.defaultSettings.delay || 1}`);
    console.log(`   decay: ${this.defaultSettings.decay || 0}`);
    console.log(`   neutralization: ${this.defaultSettings.neutralization || 'INDUSTRY'}`);
    console.log(`   truncation: ${this.defaultSettings.truncation || 0.08}`);
    console.log(`   pasteurization: ${this.defaultSettings.pasteurization || 'ON'}`);
    console.log(`   unitHandling: ${this.defaultSettings.unitHandling || 'VERIFY'}`);
    console.log(`   nanHandling: ${this.defaultSettings.nanHandling || 'ON'}`);
    console.log(`   language: ${this.defaultSettings.language || 'FASTEXPR'}`);

    console.log(chalk.cyan('\n' + '='.repeat(60)));

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `确认开始回测 ${expressions.length} 条Alpha表达式?`,
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.yellow('已取消，返回主菜单'));
      return;
    }

    console.log(chalk.green(`\n开始批量回测，共 ${expressions.length} 条表达式...\n`));

    const results: SimResult[] = [];

    for (let i = 0; i < expressions.length; i++) {
      const alphaExpr = expressions[i];
      const field = alphaExpr.length > 50 ? alphaExpr.substring(0, 50) + '...' : alphaExpr;

      console.log(`[${i + 1}/${expressions.length}] 提交: ${alphaExpr}`);

      try {
        const result = await this.submitAndWait(alphaExpr, field);
        results.push(result);

        if (result.status === 'success') {
          console.log(chalk.green(`  Alpha ID: ${result.alpha_id}`));

          this.db.then(db => {
            db.insertAlpha({
              alpha_id: result.alpha_id!,
              expression: alphaExpr,
              field: field,
              status: 'success',
              error_message: null,
              created_at: result.submittedAt,
              updated_at: result.completedAt || new Date().toISOString()
            }).catch((e: any) => {
              console.error(chalk.red(`数据库保存失败: ${e.message}`));
            });
          });
        } else {
          console.log(chalk.red(`  失败: ${result.error || result.status}`));
        }

        if (i < expressions.length - 1) {
          await this.sleep(2000);
        }

      } catch (e: any) {
        // 失败跳过继续，不中断整体
        console.log(chalk.red(`  异常，跳过: ${e.message}`));
        results.push({
          field,
          alpha_id: null,
          status: 'error',
          error: e.message,
          submittedAt: new Date().toISOString()
        });
      }
    }

    console.log(chalk.cyan('\n' + '='.repeat(60)));
    console.log(chalk.cyan('批量回测完成'));
    console.log(chalk.cyan('='.repeat(60)));

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status !== 'success').length;

    console.log(`\n总计: ${results.length} 条`);
    console.log(chalk.green(`  成功: ${successCount}`));
    console.log(chalk.red(`  失败: ${failedCount}`));

    const { viewResults } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'viewResults',
        message: '查看结果详情?',
        default: false
      }
    ]);

    if (viewResults) {
      console.log('\n详细结果:');
      for (const r of results) {
        const icon = r.status === 'success' ? 'OK' : 'FAIL';
        const alphaId = r.alpha_id || '-';
        console.log(`  [${icon}] ${r.field}: ${alphaId}`);
      }
    }
  }

  private async submitAndWait(alphaExpr: string, field: string): Promise<SimResult> {
    if (!this.session) {
      throw new Error('未登录');
    }

    const simulationData = {
      type: 'REGULAR',
      settings: {
        instrumentType: this.defaultSettings.instrumentType || 'EQUITY',
        region: this.defaultSettings.region || 'USA',
        universe: this.defaultSettings.universe || 'TOP3000',
        delay: this.defaultSettings.delay || 1,
        decay: this.defaultSettings.decay || 0,
        neutralization: this.defaultSettings.neutralization || 'INDUSTRY',
        truncation: this.defaultSettings.truncation || 0.08,
        pasteurization: this.defaultSettings.pasteurization || 'ON',
        unitHandling: this.defaultSettings.unitHandling || 'VERIFY',
        nanHandling: this.defaultSettings.nanHandling || 'ON',
        language: this.defaultSettings.language || 'FASTEXPR',
        visualization: false
      },
      regular: alphaExpr
    };

    const submittedAt = new Date().toISOString();

    const response = await this.session.post(
      'https://api.worldquantbrain.com/simulations',
      simulationData
    );

    if (response.status !== 200 && response.status !== 201) {
      return {
        field,
        alpha_id: null,
        status: 'failed',
        error: `HTTP ${response.status}`,
        submittedAt
      };
    }

    const location = response.headers['location'];
    if (!location) {
      return {
        field,
        alpha_id: null,
        status: 'failed',
        error: 'No Location header',
        submittedAt
      };
    }

    let retryCount = 0;
    const maxRetries = 60;

    while (retryCount < maxRetries) {
      await this.sleep(1000);

      const progressResp = await this.session.get(location);
      const retryAfter = parseFloat(progressResp.headers['retry-after'] || '0');

      if (retryAfter > 0) {
        retryCount++;
        continue;
      }

      const result = progressResp.data;
      const completedAt = new Date().toISOString();

      return {
        field,
        alpha_id: result.alpha || null,
        status: result.status === 'COMPLETE' ? 'success' : 'failed',
        error: result.status !== 'COMPLETE' ? `Status: ${result.status}` : undefined,
        submittedAt,
        completedAt
      };
    }

    return {
      field,
      alpha_id: null,
      status: 'failed',
      error: 'Timeout waiting for completion',
      submittedAt
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async viewResults(): Promise<void> {
    console.log(chalk.yellow('\n=== 查看结果 ==='));

    const db = await this.db;
    const records = await db.searchAlphas({});

    if (records.length === 0) {
      console.log(chalk.gray('暂无记录'));
      return;
    }

    const successRecords = records.filter((r: any) => r.status === 'success');
    console.log(chalk.green(`\n成功: ${successRecords.length} 个`));
    console.log(chalk.red(`失败: ${records.length - successRecords.length} 个`));

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '选择操作',
        choices: [
          { name: '显示最近20条', value: 'recent' },
          { name: '显示成功的', value: 'success' },
          { name: '导出CSV', value: 'csv' },
          { name: '返回主菜单', value: 'back' }
        ]
      }
    ]);

    switch (action) {
      case 'recent':
        this.showRecentRecords(records.slice(0, 20));
        break;
      case 'success':
        this.showRecentRecords(successRecords);
        break;
      case 'csv':
        const filename = `alpha_records_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
        ensureWorkDir();
        await db.exportAlphasToCsv(path.join(WORK_DIR, filename));
        console.log(chalk.green(`已导出到: ${filename}`));
        break;
      case 'back':
        return;
    }
  }

  private showRecentRecords(records: any[]): void {
    const table = new Table({
      head: ['ID', 'Alpha ID', '字段', '状态', '创建时间'],
      colWidths: [5, 12, 35, 10, 22]
    });

    for (const r of records) {
      table.push([
        r.id,
        r.alpha_id || 'N/A',
        r.field.substring(0, 33),
        r.status,
        r.created_at.substring(0, 19)
      ]);
    }

    console.log(`\n=== ${records.length} 条记录 ===`);
    console.log(table.toString());
  }

  async showMainMenu(): Promise<void> {
    while (true) {
      const { choice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'choice',
          message: '请选择操作',
          choices: [
            { name: '1. 全自动批量回测', value: '1' },
            { name: '2. 查看结果/导出', value: '2' },
            { name: '3. 退出', value: '3' }
          ]
        }
      ]);

      switch (choice) {
        case '1':
          await this.autoBatchMode();
          break;
        case '2':
          await this.viewResults();
          break;
        case '3':
          console.log(chalk.green('\n感谢使用,再见!\n'));
          return;
      }
    }
  }

  async run(): Promise<void> {
    const loggedIn = await this.login();
    if (!loggedIn) {
      console.log(chalk.red('登录失败,程序退出'));
      return;
    }

    await this.showMainMenu();
  }
}

const program = new Command();
program
  .name('wq-buddy')
  .description('WQBuddy - WorldQuant BRAIN Alpha挖掘伙伴')
  .version('1.0.0');

program
  .action(async () => {
    const workbench = new AlphaWorkbench();
    await workbench.run();
  });

program.parse();
