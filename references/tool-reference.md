# 工具集成指南

## 目录

- 可用工具函数
- 工具分类说明
- 典型工作流

---

## 可用工具函数

### 回测与提交

| 函数 | 用途 | 关键参数 | 返回内容 |
|------|------|----------|----------|
| `alphaBatchSubmit()` | 批量回测 | template, fields[], concurrency(1-3) | 中文结果 + IS Checks |
| `alphaPreview()` | 预览模式（不保存） | template, fields[] | 表达式预览 + 配置展示 |
| `alphaStats()` | 回测统计报告 | options?(limit, groupBy, statusFilter, dateFrom, dateTo) | 中文统计报告 |
| `checkDuplicate()` | 检查重复表达式 | expression, settingsHash? | {isDuplicate, existingRecord?} |

### 格式化与显示

| 函数 | 用途 | 关键参数 | 返回内容 |
|------|------|----------|----------|
| `formatResults()` | 格式化回测结果 | results[] | 中文表格 |
| `formatAnalysisResult()` | 格式化字段分析结果 | result | 中文分析报告 |
| `formatSearchResults()` | 格式化搜索结果 | SearchResult | 中文字段列表 |

### 字段搜索（平台API）

| 函数 | 用途 | 关键参数 | 返回内容 |
|------|------|----------|----------|
| `searchFields()` | 按关键词搜索数据字段 | keyword, options?(datasetId, dataType, limit) | SearchResult{fields, totalCount, searchKeyword, datasetId} |
| `getFieldsByDataset()` | 获取指定数据集全部字段 | datasetId, options?(dataType, limit) | SearchResult（内部调用searchFields） |

### 字段分析

| 函数 | 用途 | 关键参数 | 返回内容 |
|------|------|----------|----------|
| `analyzeField()` | 字段分析（6种标准测试） | fieldName, autoSave? | FieldAnalysisResult |

### 数据库操作 - Alpha

| 函数 | 用途 | 关键参数 | 返回内容 |
|------|------|----------|----------|
| `db.insertAlpha()` | 插入Alpha记录 | Omit\<AlphaRecord, 'id'\> | 新记录ID |
| `db.updateAlphaStatus()` | 更新回测状态 | id, status, alphaId?, errorMessage? | 无 |
| `db.updateSubmitStatus()` | 更新提交状态 | id, status, reason? | 无 |
| `db.updateCorrelation()` | 更新相关性 | id, max, min | 无 |
| `db.getAlpha()` | 获取单条记录 | id | AlphaRecord \| null |
| `db.searchAlphas()` | 查询Alpha | filters{} | 记录列表 |
| `db.sortAlphas()` | 排序Alpha | sortBy, order? | 记录列表 |
| `db.getAlphaStats()` | 基础统计 | 无 | DbStats{total, success, failed, avg_sharpe, best_sharpe} |
| `db.getAlphaStatsAdvanced()` | 高级统计 | AlphaStatsOptions? | AlphaStatsResult（含分组、分布） |
| `db.exportAlphasToCsv()` | 导出CSV | path | 无 |

### 数据库操作 - 字段分析

| 函数 | 用途 | 关键参数 | 返回内容 |
|------|------|----------|----------|
| `db.insertFieldAnalysis()` | 插入字段分析 | Omit\<FieldAnalysis, 'id'\|'created_at'\> | 新记录ID |
| `db.updateFieldAnalysis()` | 更新字段分析 | id, updates | 无 |
| `db.getFieldAnalysis()` | 获取字段分析 | fieldName | FieldAnalysis \| null |
| `db.searchFieldAnalysis()` | 搜索字段分析 | filters{} | 记录列表 |
| `db.exportFieldAnalysisToCsv()` | 导出CSV | path | 无 |

### 数据库操作 - 数据字段

| 函数 | 用途 | 关键参数 | 返回内容 |
|------|------|----------|----------|
| `db.insertDataField()` | 插入数据字段 | Omit\<DataField, 'id'\> | 新记录ID |
| `db.getDataFields()` | 获取字段列表 | datasetId? | DataField[] |
| `db.getDataField()` | 获取单个字段 | fieldId | DataField \| null |

### 数据库操作 - 批次

| 函数 | 用途 | 关键参数 | 返回内容 |
|------|------|----------|----------|
| `db.insertBatch()` | 插入批次记录 | Omit\<BatchRecord, 'id'\> | 新记录ID |
| `db.updateBatchStatus()` | 更新批次状态 | batchId, updates | 无 |
| `db.getBatch()` | 获取批次 | batchId | BatchRecord \| null |
| `db.getAllBatches()` | 获取所有批次 | 无 | BatchRecord[] |

### 数据库操作 - 生命周期

| 函数 | 用途 | 关键参数 | 返回内容 |
|------|------|----------|----------|
| `getDatabase()` | 获取数据库实例 | config? | db对象 |
| `closeDatabase()` | 关闭数据库连接 | 无 | 无 |
| `db.init()` | 初始化数据库 | 无 | 无 |
| `db.close()` | 关闭连接 | 无 | 无 |

---

## 工具分类说明

### 自动调用 vs 手动调用

**自动调用**（AI在流程中自动使用，无需用户指定）：
- `checkDuplicate()`: 在 `alphaBatchSubmit()` 内部自动调用（当enableCheckDuplicate=true时）
- `formatResults()`: 回测完成后自动格式化
- `getDatabase()`: 需要数据库操作时自动获取

**手动调用**（AI根据用户意图选择使用）：
- `alphaBatchSubmit()`: 用户要求回测时
- `alphaPreview()`: 用户想先看结果不保存时
- `alphaStats()`: 用户想看整体统计时
- `analyzeField()`: 用户要求分析字段时
- `searchFields()` / `getFieldsByDataset()`: 用户想查找可用数据字段时
- `db.updateSubmitStatus()`: 用户告知提交结果时
- `db.updateCorrelation()`: 用户告知相关性数值时

### alphaStats() 详解

**用途**：生成回测统计报告，了解整体挖掘进展。

**参数**（AlphaStatsOptions，均可选）：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| limit | number | 100 | 统计最近N条记录 |
| offset | number | 0 | 偏移量 |
| groupBy | string | 'none' | 分组方式：field / expression / status / submit_status / none |
| statusFilter | string | '' | 按状态过滤 |
| dateFrom | string | '' | 起始日期 |
| dateTo | string | '' | 截止日期 |

**输出内容**：
- 总览：总条数、成功/失败数、可提交/已通过数
- Sharpe/Turnover/Fitness/Returns/Drawdown分布（平均/中位数/最佳/分段统计）
- 按分组字段的分组统计（当groupBy不为none时）

### searchFields() 详解

**用途**：通过关键词搜索BRAIN平台的数据字段。

**⚠️ 调用规范（重要！）**

```
❌ 错误：AI自己写HTTP请求、手动处理Cookie、用Bearer Token认证
✅ 正确：直接调用 searchFields() 函数，内部已处理所有认证逻辑

原因：
- 平台搜索API必须用Cookie认证（Bearer Token会返回401）
- URL必须带完整参数（instrumentType/region/delay/universe）
- 缺少参数会返回400错误
- searchFields() 内部已处理：登录 → Cookie缓存 → 参数拼接 → 请求发送
```

**参数**：

| 参数 | 类型 | 必选 | 说明 |
|------|------|------|------|
| keyword | string | 是 | 搜索关键词 |
| options.datasetId | string | 否 | 限定数据集（如fundamental6、pv1、scl12） |
| options.dataType | string | 否 | 数据类型（如MATRIX、VECTOR） |
| options.limit | number | 否 | 返回数量上限，默认50 |

**返回**：SearchResult{fields[], totalCount, searchKeyword, datasetId}

**典型用法**：
- `searchFields("ebit")` — 搜索含ebit的字段
- `searchFields("earnings", {datasetId: "fundamental6"})` — 在基本面数据集中搜索
- `searchFields("", {datasetId: "scl12", limit: 200})` — 获取scl12全部字段

**认证机制**：
- 自动读取 config.json 的账号密码
- Cookie缓存4小时，过期自动重新登录
- AI不需要手动处理任何认证逻辑

### getFieldsByDataset() 详解

**用途**：获取指定数据集的全部可用字段，是searchFields的快捷方式。

**参数**：

| 参数 | 类型 | 必选 | 说明 |
|------|------|------|------|
| datasetId | string | 是 | 数据集ID |
| options.dataType | string | 否 | 默认MATRIX |
| options.limit | number | 否 | 默认200 |

**返回**：与searchFields相同（SearchResult）

**典型用法**：
- `getFieldsByDataset("fundamental6")` — 获取基本面数据集全部字段
- `getFieldsByDataset("scl12", {dataType: "VECTOR"})` — 获取scl12的向量字段

### 去重机制

`checkDuplicate()` 的工作方式：
1. 根据表达式内容搜索已有记录
2. 如果找到相同表达式 + 相同settings_hash的成功记录 → 判定为重复
3. 重复时跳过提交，返回已有记录信息
4. settings_hash不同 = 配置不同 = 不算重复（允许同一表达式不同配置测试）

---

## 典型工作流

### 工作流A：批量回测

```
输入: 基础Alpha + 字段列表
  ↓
调用: alphaBatchSubmit({template, fields, concurrency: 2})
  ↓
输出: 中文结果表格（含状态标签）
  ↓
检查: 有无"可提交(待查)"？
  ├── 有 → 提醒用户查相关性
  └── 无 → 任务结束
```

### 工作流B：字段勘探

```
输入: 字段名
  ↓
第一步: 查本地 db.searchFieldAnalysis({field_name: keyword})
  ├── 已有 → 直接使用
  └── 无 → 继续
  ↓
第二步: 搜平台 searchFields({keyword})
  ↓
调用: analyzeField(fieldName)
  ↓
输出: 结构化字段分析报告
  ↓
询问: 用户是否保存/继续深入测试
```

字段分析方法论详见 [field-analysis.md](field-analysis.md)

### 工作流C：状态更新

```
输入: "Alpha j2dPWOn5 相关性太高了 0.9696 不能提交"
  ↓
解析: alphaId, max, status, reason
  ↓
调用:
  - db.updateSubmitStatus(id, '提交失败', reason)
  - db.updateCorrelation(id, max, min)
  ↓
确认: "已更新！状态: 提交失败 | 原因: ..."
```

提交流程详见 [submission-workflow.md](submission-workflow.md)

### 工作流D：统计查看

```
输入: "看看最近回测的整体情况"
  ↓
调用: alphaStats({limit: 100})
  ↓
输出: 统计报告（总览 + 指标分布）
  ↓
可选: 按字段分组查看
  - alphaStats({groupBy: 'field'})
  - alphaStats({groupBy: 'submit_status'})
```

### 工作流E：数据集探索

```
输入: "scl12数据集有哪些字段"
  ↓
调用: getFieldsByDataset("scl12")
  ↓
输出: 字段列表（ID + 描述）
  ↓
可选: 按关键词在数据集内搜索
  - searchFields("sentiment", {datasetId: "scl12"})
```

数据集经验详见 [data-type-strategy.md](data-type-strategy.md)
