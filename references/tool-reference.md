# 工具集成指南

## 目录

- 调用方式（CLI + 注册工具双模式）
- 可用工具一览
- 注册工具详细参数
- 数据库操作
- 典型工作流

---

## 调用方式（CLI + 注册工具双模式）

WQBuddy 支持两种调用方式：

| 方式 | 适用场景 | 示例 |
|------|----------|------|
| **CLI命令** | 终端直接操作、脚本集成 | `wq backtest "rank(cash_flow)"` |
| **注册工具** | OpenClaw Agent自动调用 | `alphaBatchSubmit({expressions: ["rank(cash_flow)"]})` |

注册工具通过 `openclaw/plugin-sdk/plugin-entry` 的 `definePluginEntry` 注册，Agent根据工具description自动判断何时调用。

---

## 可用工具一览

### 回测与提交

| 注册工具名 | CLI命令 | 用途 | 关键参数 |
|------------|---------|------|----------|
| alphaBatchSubmit | wq backtest | 批量回测 | expressions[], concurrency?(1-3), neutralization?, delay?, decay?, universe?, region? |
| alphaStats | wq stats | 回测统计报告 | status?, limit? |

### 字段搜索与分析

| 注册工具名 | CLI命令 | 用途 | 关键参数 |
|------------|---------|------|----------|
| searchFields | wq search | 搜索数据字段 | query, dataset?, limit? |
| analyzeField | wq analyze | 字段分析(6项测试) | fieldName, save?(默认true) |

### 状态管理

| 注册工具名 | CLI命令 | 用途 | 关键参数 |
|------------|---------|------|----------|
| updateSubmitStatus | (仅注册工具) | 更新提交状态 | id, status, reason? |
| updateCorrelation | (仅注册工具) | 更新相关性 | id, correlationMax?, correlationMin? |

### 格式化与显示（内部自动调用）

| 函数 | 用途 | 返回内容 |
|------|------|----------|
| formatResults() | 格式化回测结果 | 中文表格 |
| formatAnalysisResult() | 格式化字段分析结果 | 中文分析报告 |
| formatSearchResults() | 格式化搜索结果 | 中文字段列表 |

### 其他CLI命令

| CLI命令 | 用途 |
|---------|------|
| wq export [alpha\|field] [路径] | 导出CSV |
| wq docs | 查看运算符文档 |

---

## 注册工具详细参数

### alphaBatchSubmit

批量提交Alpha表达式进行回测。

**注册工具调用**: `alphaBatchSubmit({expressions, concurrency?, neutralization?, delay?, decay?, universe?, region?})`

**CLI调用**: `wq backtest "expr1" "expr2" --concurrency 2`

| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| expressions | string[] | 是 | - | Alpha表达式列表 |
| concurrency | number | 否 | 1 | 并发数，范围1-3 |
| neutralization | string | 否 | config | 中和方式: NONE/MARKET/INDUSTRY/SUBINDUSTRY |
| delay | number | 否 | config | 延迟天数 |
| decay | number | 否 | config | 衰减天数 |
| universe | string | 否 | config | 股票池 |
| region | string | 否 | config | 区域 |

**默认配置来源**: config.json（中性化INDUSTRY、延迟1、universe TOP3000等）

**失败策略**: 单条失败跳过继续，不中断整体

**回测前确认**: 执行前必须向用户展示确认单，等待确认后再运行

**回测后闭环**: 完成后检查空字段，有可提交Alpha时强制提醒用户查平台

**去重机制**: `checkDuplicate()` 在 `alphaBatchSubmit()` 内部自动调用（当enableCheckDuplicate=true时）

### searchFields

搜索BRAIN平台数据字段。

**注册工具调用**: `searchFields({query, dataset?, limit?})`

**CLI调用**: `wq search "earnings" --dataset fundamental6 --limit 100`

| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| query | string | 是 | - | 搜索关键词 |
| dataset | string | 否 | - | 限定数据集ID（如fundamental6、pv1、scl12） |
| limit | number | 否 | 50 | 返回数量上限 |

**认证机制**: 工具内部自动处理Cookie认证（登录→缓存4小时→自动续期），无需手动干预

**典型用法**:
- `searchFields({query: "ebit"})` — 搜索含ebit的字段
- `searchFields({query: "earnings", dataset: "fundamental6"})` — 在基本面数据集中搜索
- `searchFields({query: "", dataset: "scl12", limit: 200})` — 获取scl12全部字段

### analyzeField

对指定字段执行6种标准测试表达式回测。

**注册工具调用**: `analyzeField({fieldName, save?})`

**CLI调用**: `wq analyze fnd2_ebitdm`

| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| fieldName | string | 是 | - | 字段名 |
| save | boolean | 否 | true | 是否保存分析结果到数据库 |

**6项标准测试**: 覆盖率 / 非零覆盖率 / 更新频率 / 数据范围 / 中位数 / 数据分布

**分析配置**: 自动使用 Neutralization=None, Decay=0（确保看到原始数据特性）

### alphaStats

获取Alpha回测统计报告。

**注册工具调用**: `alphaStats({status?, limit?})`

**CLI调用**: `wq stats`

| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| status | string | 否 | - | 按状态过滤 |
| limit | number | 否 | 100 | 统计最近N条记录 |

**输出内容**: 总览、Sharpe/Turnover/Fitness/Returns/Drawdown分布、按分组统计

### updateSubmitStatus

更新Alpha记录的提交状态。

**注册工具调用**: `updateSubmitStatus({id, status, reason?})`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | Alpha记录ID |
| status | string | 是 | 新状态: 已通过 / 提交失败 |
| reason | string | 否 | 失败原因（提交失败时填写） |

### updateCorrelation

更新Alpha记录的Self Correlation数值。

**注册工具调用**: `updateCorrelation({id, correlationMax?, correlationMin?})`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | Alpha记录ID |
| correlationMax | number | 否 | Self Correlation最大值 (0-1) |
| correlationMin | number | 否 | Self Correlation最小值 (0-1) |

至少提供 correlationMax 或 correlationMin 之一。只提供一个时，另一个保持当前值不变。

---

## 数据库操作

### Alpha操作

| 函数 | 用途 | 关键参数 |
|------|------|----------|
| db.insertAlpha() | 插入Alpha记录 | Omit\<AlphaRecord, 'id'\> |
| db.updateAlphaStatus() | 更新回测状态 | id, status, alphaId?, errorMessage? |
| db.updateSubmitStatus() | 更新提交状态 | id, status, reason? |
| db.updateCorrelation() | 更新相关性 | id, max, min |
| db.getAlpha() | 获取单条记录 | id |
| db.searchAlphas() | 查询Alpha | filters{} |
| db.getAlphaStatsAdvanced() | 高级统计 | AlphaStatsOptions? |
| db.exportAlphasToCsv() | 导出CSV | path |

### 字段分析操作

| 函数 | 用途 | 关键参数 |
|------|------|----------|
| db.insertFieldAnalysis() | 插入字段分析 | Omit\<FieldAnalysis, 'id'\|'created_at'\> |
| db.updateFieldAnalysis() | 更新字段分析 | id, updates |
| db.getFieldAnalysis() | 获取字段分析 | fieldName |
| db.exportFieldAnalysisToCsv() | 导出CSV | path |

### 生命周期

| 函数 | 用途 |
|------|------|
| getDatabase() | 获取数据库实例（单例） |
| closeDatabase() | 关闭数据库连接 |

---

## 典型工作流

### 工作流A：批量回测

```
输入: 表达式列表
  ↓
调用: alphaBatchSubmit({expressions, concurrency: 2})
  或: wq backtest "expr1" "expr2" --concurrency 2
  ↓
输出: 中文结果表格（含状态标签）
  ↓
检查: 有无"可提交(待查)"？
  ├── 有 → 提醒用户查相关性
  └── 无 → 任务结束
```

### 工作流B：字段勘探

```
输入: 关键词或字段名
  ↓
第一步: 搜平台 searchFields({query: "keyword"})
  或: wq search "keyword"
  ↓
第二步: 分析字段 analyzeField({fieldName: "fnd2_ebitdm"})
  或: wq analyze fnd2_ebitdm
  ↓
输出: 结构化字段分析报告
  ↓
第三步: 构建表达式并回测
```

### 工作流C：状态更新

```
输入: "Alpha #5 相关性太高了 0.9696 不能提交"
  ↓
调用:
  updateSubmitStatus({id: 5, status: "提交失败", reason: "Self Correlation 0.9696"})
  updateCorrelation({id: 5, correlationMax: 0.9696})
  ↓
确认: "已更新！状态: 提交失败 | 原因: ..."
```

### 工作流D：统计查看

```
输入: "看看最近回测的整体情况"
  ↓
调用: alphaStats({limit: 100})
  或: wq stats
  ↓
输出: 统计报告（总览 + 指标分布）
```

### 工作流E：数据集探索

```
输入: "scl12数据集有哪些字段"
  ↓
调用: searchFields({query: "", dataset: "scl12", limit: 200})
  或: wq search --dataset scl12
  ↓
输出: 字段列表（ID + 描述）
```
