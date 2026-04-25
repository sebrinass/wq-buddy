---
name: wq-buddy
description: "WorldQuant BRAIN Alpha挖掘协作专家。引导用户从模糊想法到可提交Alpha的全流程：字段勘探、表达式构建、回测分析、优化迭代和提交管理。使用当用户需要回测Alpha、搜索BRAIN平台字段、批量测试表达式时。"
metadata:
  openclaw:
    emoji: "📊"
    requires:
      bins: ["wq-buddy"]
      config:
        - path: "~/.wq-buddy/config.json"
          access: "read"
          purpose: "读取BRAIN账号配置"
      filesystem:
        - path: "~/.wq-buddy/alpha_workbench.db"
          access: "read-write"
          purpose: "存储Alpha回测结果和字段分析数据"
        - path: "~/.wq-buddy/references"
          access: "read-write"
          purpose: "读取和更新策略知识库文档"
        - path: "~/.wq-buddy/.wq_token.json"
          access: "read-write"
          purpose: "缓存BRAIN平台登录会话Token"
    install:
      - id: npm
        kind: node
        package: "wq-buddy"
        label: "Install via npm"
      - id: clawhub
        kind: clawhub
        slug: wq-buddy
        label: "Install via ClawHub"
---

# WQBuddy - WorldQuant BRAIN Alpha挖掘协作专家

## 安装步骤

**第一步：安装插件**

```bash
npm install -g wq-buddy
```

**第二步：创建配置文件**

创建 `~/.wq-buddy/config.json`：

```json
{
  "version": "v1.0.1",
  "credentials": {
    "username": "你的BRAIN账号",
    "password": "你的BRAIN密码"
  },
  "default_settings": {
    "instrument_type": "EQUITY",
    "region": "USA",
    "universe": "TOP3000",
    "delay": 1,
    "decay": 0,
    "neutralization": "INDUSTRY",
    "truncation": 0.08,
    "pasteurization": "ON",
    "unit_handling": "VERIFY",
    "nan_handling": "ON",
    "language": "FASTEXPR"
  },
  "database": { "type": "sqlite", "path": "alpha_workbench.db" },
  "batch_settings": { "sleep_between_requests": 10, "max_retries": 3, "timeout_seconds": 300 }
}
```

**第三步：更新配置**

在 `~/.openclaw/openclaw.json` 的 `plugins.load.paths` 中添加：

```json
"~/.npm-global/lib/node_modules/wq-buddy"
```

**第四步：重启 Gateway**

```bash
openclaw gateway restart
```

---

## 快速开始

```bash
# 1. 回测一条Alpha
wq backtest "rank(cash_flow)"

# 2. 搜索数据字段
wq search "operating cash flow"

# 3. 分析字段特性
wq analyze fnd2_ebitdm
```

---

## 工具决策指南

```
用户需要什么？
│
├─ 回测Alpha表达式
│  ├─ 单条 → wq backtest "expr" / alphaBatchSubmit({expressions: ["expr"]})
│  ├─ 多条 → wq backtest "e1" "e2" "e3" / alphaBatchSubmit({expressions: [...]})
│  ├─ 从文件 → wq backtest --file ./expressions.txt
│  └─ 需要并发/查重 → 加 --concurrency / --enable-duplicate-check
│
├─ 找数据字段
│  ├─ 关键词搜索 → wq search "earnings" / searchFields({query: "earnings"})
│  ├─ 限定数据集 → wq search "earnings" --dataset fundamental6
│  └─ 浏览整个数据集 → wq search --dataset pv13
│
├─ 了解字段特性
│  └─ wq analyze 字段名 / analyzeField({fieldName: "fnd2_ebitdm"})
│     → 6项测试：覆盖率/非零覆盖率/更新频率/数据范围/中位数/数据分布
│
├─ 查看回测统计
│  └─ wq stats / alphaStats()
│
├─ 更新提交状态
│  └─ updateSubmitStatus({id, status, reason?})
│
├─ 更新相关性
│  └─ updateCorrelation({id, correlationMax?, correlationMin?})
│
└─ 导出/文档
   ├─ wq export [alpha|field] [路径]
   └─ wq docs
```

---

## 各工具详细用法

### alphaBatchSubmit / wq backtest — 回测Alpha表达式

**注册工具**: `alphaBatchSubmit({expressions, concurrency?, neutralization?, delay?, decay?, universe?, region?})`
**CLI**: `wq backtest "expr1" "expr2" --concurrency 2`

| 参数 | 必填 | 默认 | 说明 |
|------|------|------|------|
| expressions | 是 | - | Alpha表达式列表 |
| concurrency | 否 | 1 | 并发数，范围1-3 |
| neutralization | 否 | config | 中和方式: NONE/MARKET/INDUSTRY/SUBINDUSTRY |
| delay | 否 | config | 延迟天数 |
| decay | 否 | config | 衰减天数 |
| universe | 否 | config | 股票池 |
| region | 否 | config | 区域 |

**回测前确认**: 执行前必须向用户展示确认单，等待确认后再运行

**回测后闭环**: 完成后检查空字段，有可提交Alpha时强制提醒用户查平台

详见 [submission-workflow.md](references/submission-workflow.md)

---

### searchFields / wq search — 搜索数据字段

**注册工具**: `searchFields({query, dataset?, limit?})`
**CLI**: `wq search "earnings" --dataset fundamental6 --limit 100`

| 参数 | 必填 | 默认 | 说明 |
|------|------|------|------|
| query | 是 | - | 搜索关键词 |
| dataset | 否 | - | 限定数据集ID |
| limit | 否 | 50 | 返回结果数量上限 |

认证由工具内部自动处理（Cookie认证，缓存4小时）

---

### analyzeField / wq analyze — 分析字段特性

**注册工具**: `analyzeField({fieldName, save?})`
**CLI**: `wq analyze fnd2_ebitdm`

| 参数 | 必填 | 默认 | 说明 |
|------|------|------|------|
| fieldName | 是 | - | 字段名 |
| save | 否 | true | 是否保存分析结果 |

分析配置: 自动使用 Neutralization=None, Decay=0

详见 [field-analysis.md](references/field-analysis.md)

---

### alphaStats / wq stats — 回测统计

**注册工具**: `alphaStats({status?, limit?})`
**CLI**: `wq stats`

| 参数 | 必填 | 默认 | 说明 |
|------|------|------|------|
| status | 否 | - | 按状态过滤 |
| limit | 否 | 100 | 统计最近N条记录 |

---

### updateSubmitStatus — 更新提交状态

**注册工具**: `updateSubmitStatus({id, status, reason?})`

| 参数 | 必填 | 说明 |
|------|------|------|
| id | 是 | Alpha记录ID |
| status | 是 | 新状态: 已通过 / 提交失败 |
| reason | 否 | 失败原因（提交失败时填写） |

---

### updateCorrelation — 更新相关性

**注册工具**: `updateCorrelation({id, correlationMax?, correlationMin?})`

| 参数 | 必填 | 说明 |
|------|------|------|
| id | 是 | Alpha记录ID |
| correlationMax | 否 | Self Correlation最大值 (0-1) |
| correlationMin | 否 | Self Correlation最小值 (0-1) |

至少提供 correlationMax 或 correlationMin 之一

---

## 禁止模式

```
❌ 禁止：自己写JavaScript脚本调用内部模块
❌ 禁止：自己import Authenticator/BatchSubmitter等类
❌ 禁止：自己处理登录、Cookie、认证
❌ 禁止：自己写循环和并发逻辑
❌ 禁止：使用Bearer Token认证（平台只支持Cookie）
❌ 禁止：自动将"可提交(待查)"改为"已通过"
❌ 禁止：猜测或编造correlation数值
❌ 禁止：在用户未确认前修改reject_reason

✅ 正确：直接调用 wq 命令或注册工具
✅ 正确：填入表达式列表 → 设并发数 → 启动
✅ 正确：让工具内部处理一切认证和并发
✅ 正确：等用户告知平台结果后再更新状态
```

---

## 向量字段处理（硬规则）

```
⚠️ 向量字段必须先用Vector运算符压缩为标量，否则回测报错

正确: vec_avg(returns) + ts_mean(volume, 10)
错误: returns + ts_mean(volume, 10)   ← returns是向量，直接运算报错

可用压缩算子: vec_avg / vec_sum / vec_max / ts_前缀算子
```

详见 [data-type-strategy.md](references/data-type-strategy.md)

---

## 提交状态工作流

```
未提交 → 可提交(待查) → 已通过 / 提交失败
                          ↑
                    失败原因记录在reject_reason
```

| 状态 | 触发条件 | 谁操作 | Agent做什么 |
|------|----------|--------|-------------|
| 未提交 | 回测失败 / IS有FAIL | 自动 | 显示结果，不提醒 |
| 可提交(待查) | IS全PASS | 自动判断 | 强制提醒用户查平台 |
| 已通过 | 用户确认OK | 手动 | updateSubmitStatus(id, "已通过") |
| 提交失败 | 用户告知失败+原因 | 手动 | updateSubmitStatus(id, "提交失败", reason) |

详见 [submission-workflow.md](references/submission-workflow.md)

---

## Alpha构建决策树

```
用户想法
  │
确认信号方向（正向/反向）
  │
选择数据类型
  |-- 基本面 → 低频策略 → 高Decay(10-20) → 低换手率
  |-- 量价   → 高频策略 → 低Decay(0-5)   → 高换手率
  |-- 情绪   → 中频策略 → 中Decay(5-10)
  │
选择算子组合
  |-- 信号提取: rank, zscore, ts_zscore
  |-- 时间序列: ts_decay_linear, ts_mean, ts_delta
  |-- 截面处理: group_neutralize, scale
  │
套用模板 → 变异优化（每次只改一个变量）
```

详见 [strategy-patterns.md](references/strategy-patterns.md)

---

## 优化诊断速查

| 症状 | 可能原因 | 建议方向 |
|------|----------|----------|
| Sharpe低 | 信号弱或噪声大 | 换rank/zscore增强；加ts_decay平滑 |
| 换手率过高 | 信号不稳定 | 增大Decay；用ts_decay_linear；换低频数据 |
| 换手率过低 | 信号太稳定 | 降低Decay；混合量价数据 |
| FAIL-LOW_SHARPE | Sharpe<1.25 | 优化信号方向或换数据源 |
| FAIL-HIGH_TURNOVER | 换手率超限 | 增大Decay或用group_neutralize |
| FAIL-SELF_CORRELATION | 与已有Alpha太相似 | 换数据源或改算子组合 |

详见 [optimization-guide.md](references/optimization-guide.md)

---

## 知识库维护

- 论文处理: 接收 → 精读提炼 → 转化为平台可执行内容 → 用户确认 → 写入知识库
- 策略标注: 已验证 / 待验证 / 无效（保留原因供参考）

---

## 参考资料

- [字段分析方法论](references/field-analysis.md) — 6种标准测试 + 判断流程
- [提交流程与状态管理](references/submission-workflow.md) — 状态转换图 + 特殊场景
- [工具集成指南](references/tool-reference.md) — 函数列表 + 工作流示例
- [策略模式库](references/strategy-patterns.md) — 已验证/待验证的Alpha构建模式
- [数据类型策略](references/data-type-strategy.md) — 基本面/量价/情绪数据策略
- [优化指南](references/optimization-guide.md) — 诊断方法 + 优化路径
- [运算符速查](references/operators-reference.md) — 6大类运算符语法+用法+示例
