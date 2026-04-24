# 开发日志

## v1.0.0 (2026-04-25)

### 正式版：安全加固 + Skill v1.0.0 + 统计功能

#### 安全修复
- .gitignore补全9项缺失规则（config.json、.wq_token.json、alpha_workbench.db等）
- 创建config.example.json作为配置模板，密码替换为占位符
- Token缓存不再存储密码
- 统一认证系统：tools.ts使用auth.ts的loginWithCookie()

#### 代码修复
- settingsHash改用crypto.createHash('sha256')
- getAlphaInfo轮询添加指数退避（1s→2s→4s→...→30s）
- CSV导出补全12个缺失字段
- getAlphaStats改用SQL聚合查询，不再全表扫描
- 去重逻辑修正为按alpha_id查重

#### 新增功能
- alphaStats()：5指标分布统计（Sharpe/Turnover/Fitness/Returns/Drawdown）+ 分组统计

#### Skill v1.0.0
- SKILL.md重写：10章节，融合操作规则+AI协作框架
- 新增references/operators-reference.md：7大类运算符速查
- 新增references/strategy-patterns.md：8大策略模式+论文索引
- 新增references/data-type-strategy.md：数据策略+回测参数速查
- 新增references/optimization-guide.md：10种症状诊断+断舍离+IS Testing
- 新增references/README.md：知识库维护指引+3阶段扩展路线图
- 更新references/field-analysis.md、submission-workflow.md、tool-reference.md

---

## v1.4.0 (2026-04-23)

### 重大更新：并发提交 + 状态管理 + Skill构建

#### 新增功能
- **并发提交**：alphaBatchSubmit支持concurrency参数(1-3)，并行提交Alpha
- **IS测试结果追踪**：记录checks、stage、grade字段
- **4状态提交管理**：未提交 → 可提交(待查) → 已通过/提交失败
- **相关性追踪**：correlation_max、correlation_min字段，手动填写
- **失败原因记录**：reject_reason字段
- **去重机制**：checkDuplicate()函数，基于表达式+settings_hash判断重复
- **Skill规范构建**：按Anthropic官方规范重构SKILL.md，拆分为references/子文件

#### 重构文件
- 重构 `src/tools.ts` - 新增并发提交、去重检查、IS结果追踪
- 重构 `src/db/SQLiteAdapter.ts` - 新增correlation、submit_status、reject_reason字段
- 新增 `SKILL.md` - 按规范重构，精简核心+渐进式披露
- 新增 `references/field-analysis.md` - 字段分析方法论
- 新增 `references/submission-workflow.md` - 提交流程与状态管理
- 新增 `references/tool-reference.md` - 工具集成指南

---

## v1.3.0-plus1 (2026-04-23)

### 重大更新：SQLite数据库迁移

#### 新增功能
- **SQLite数据库替代JSON**：使用better-sqlite3 + drizzle-orm实现SQLite数据库
- **多表支持**：
  - `alphas` 表：存储Alpha回测记录
  - `field_analyses` 表：存储字段分析结果
  - `data_fields` 表：存储数据字段元信息
  - `batches` 表：存储批量提交记录
- **数据库抽象层**：定义统一Database接口，支持未来迁移到其他数据库
- **CSV导出**：支持Alpha和字段分析数据导出为CSV
- **字段分析工具**：analyze-field.ts，复用回测接口分析字段特性

#### 迁移功能
- **JSON迁移工具**：migrate.ts，自动将旧JSON数据迁移到SQLite
- **迁移备份**：自动备份原JSON文件为.bak格式

#### 重构文件
- 新增 `src/db/Database.ts` - 数据库接口定义
- 新增 `src/db/SQLiteAdapter.ts` - SQLite实现
- 新增 `src/db/index.ts` - 数据库工厂
- 新增 `src/migrate.ts` - 迁移工具
- 新增 `src/analyze-field.ts` - 字段分析工具
- 重构 `src/tools.ts` - 使用SQLite替代JSON
- 重构 `src/cli.ts` - 使用SQLite替代JSON
- 重构 `src/batch-submit.ts` - 使用SQLite替代JSON
- 重构 `src/result-viewer.ts` - 使用SQLite替代JSON
- 重构 `src/db-cli.ts` - 新增数据库CLI管理工具
- 删除 `src/database.ts` - 旧JSON数据库实现

#### CLI命令
```bash
npm run db -- migrate              # 从JSON迁移到SQLite
npm run db -- search --status success  # 搜索alpha记录
npm run db -- sort --by sharpe     # 排序alpha记录
npm run db -- stats                # 查看统计信息
npm run db -- export alpha         # 导出CSV
npm run db -- field analyze <字段名>  # 分析数据字段
```

---

## v1.2.0 (之前的版本)
- 初始版本，使用JSON文件存储
