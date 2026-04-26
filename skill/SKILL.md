---
name: wq-buddy
description: "WorldQuant BRAIN Alpha挖掘协作专家。引导用户从模糊想法到可提交Alpha的全流程：字段勘探、表达式构建、回测分析、优化迭代和提交管理。使用当用户需要回测Alpha、搜索BRAIN平台字段、批量测试表达式时。"
metadata:
  openclaw:
    emoji: "📊"
    requires:
      bins: ["wq", "wq-buddy"]
      config:
        - path: "~/.wq-buddy/config.json"
          access: "read-write"
          purpose: "存储BRAIN平台登录凭据和默认回测参数。平台仅支持Cookie会话认证，不支持OAuth/API Key，因此需要存储用户名密码。Token缓存机制减少重复登录。"
        - path: "~/.openclaw/openclaw.json"
          access: "read-write"
          purpose: "添加插件路径并重启Gateway"
      filesystem:
        - path: "~/.wq-buddy/alpha_workbench.db"
          access: "read-write"
          purpose: "存储Alpha回测结果和字段分析数据"
        - path: "~/.wq-buddy/references"
          access: "read-write"
          purpose: "读取和更新策略知识库文档"
        - path: "~/.wq-buddy/.wq_token.json"
          access: "read-write"
          purpose: "缓存BRAIN平台登录会话Token（有效期4小时），避免频繁重新登录。Token自动刷新，用户无需手动管理。"
      credentials:
        - name: "BRAIN账号"
          type: "username_password"
          storage: "file"
          path: "~/.wq-buddy/config.json"
          purpose: "WorldQuant BRAIN平台登录凭据"
          note: "平台不支持OAuth/API Key，仅支持Cookie会话认证"
      install:
        - id: npm
          kind: node
          package: "wq-buddy"
          label: "Install via npm"
        - id: clawhub
          kind: clawhub
          slug: wq-buddy
          label: "Install via ClawHub (OpenClaw官方插件市场)"
---

# WQBuddy - WorldQuant BRAIN Alpha挖掘协作专家

**项目仓库**: https://github.com/sebrinass/wq-buddy
**npm包**: https://www.npmjs.com/package/wq-buddy

## ⚠️ 安全说明

本工具需要您的WorldQuant BRAIN平台凭据才能正常工作：

- **凭据存储**：用户名和密码存储在 `~/.wq-buddy/config.json`，请确保该文件权限安全
- **Token缓存**：登录后会话Token缓存4小时，减少重复登录
- **平台限制**：BRAIN平台不支持OAuth或API Key认证，仅支持Cookie会话认证
- **数据本地**：所有回测数据、Alpha记录均存储在本地SQLite数据库，不上传任何数据
- **代码开源**：https://github.com/sebrinass/wq-buddy

**建议**：
- 使用专用的BRAIN测试账号
- 定期更换密码
- 不要在共享环境中使用

## 安装步骤

**第一步：安装插件**

```bash
npm install -g wq-buddy
```

**第二步：创建配置文件**

创建 `~/.wq-buddy/config.json`：

```json
{
  "version": "v1.0.6",
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
│  ├─ 自动获取 → 回测可提交时自动查询（无需手动）
│  ├─ 手动查询单个 → getAlphaCorrelations({alphaId})
│  └─ 手动补充 → updateCorrelation({id, correlationMax?, correlationMin?})
│
├─ 提交前检查
│  └─ checkSubmission({alphaId}) → 查看所有检查项确定值（含SELF_CORRELATION）
│
├─ 提交Alpha
│  └─ submitAlpha({alphaId, confirmed}) → 确认后提交（单条，需confirmed=true）
│
├─ 查看已有Alpha
│  └─ listAlphas({status?, limit?, offset?}) → 查询平台Alpha列表
│
├─ 查看用户信息
│  └─ getUserInfo() → 显示当前登录账号信息
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

**⚠️ 执行方式（硬规则）**:
- 回测是阻塞式操作，提交后工具会自动等待所有表达式完成再返回结果
- **禁止后台执行+轮询模式**（background + poll），这会浪费大量API额度
- 正确方式：直接调用工具或CLI，等它跑完一次性拿到全部结果
- 如遇429限速，工具内部会自动按retry-after等待重试，无需手动处理
- 冷却等待期间不要反复poll检查进度，等工具自行返回即可

**💡 大批量回测建议用子代理**:
- 10条以上回测建议通过 `sessions_spawn` 开子代理执行，避免长时间卡住主会话
- 子代理内直接阻塞式调用工具即可，无需background+poll
- 子代理完成后自动汇报结果，主会话保持可用
- **子代理必须严格按原始需求回测，禁止擅自修改回测配置**（中性化、延迟、衰减等）
- 回测失败就如实报告失败原因（如Incompatible unit），不要改配置重跑
- 如需调整配置，必须向用户说明原因并等待确认后再执行

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

### updateCorrelation — 手动更新相关性

**注册工具**: `updateCorrelation({id, correlationMax?, correlationMin?})`

| 参数 | 必填 | 说明 |
|------|------|------|
| id | 是 | Alpha记录ID |
| correlationMax | 否 | Self Correlation最大值 (0-1) |
| correlationMin | 否 | Self Correlation最小值 (0-1) |

至少提供 correlationMax 或 correlationMin 之一

---

### checkSubmission — 提交前检查

**注册工具**: `checkSubmission({alphaId})`

| 参数 | 必填 | 说明 |
|------|------|------|
| alphaId | 是 | BRAIN平台的Alpha ID |

返回所有检查项的确定值（PASS/FAIL），包含SELF_CORRELATION等IS阶段为PENDING的项

**与回测IS checks的关系**：回测返回的IS checks中SELF_CORRELATION通常为PENDING，checkSubmission返回确定值，两者互补

---

### submitAlpha — 正式提交Alpha

**注册工具**: `submitAlpha({alphaId, confirmed})`

| 参数 | 必填 | 说明 |
|------|------|------|
| alphaId | 是 | BRAIN平台的Alpha ID |
| confirmed | 是 | 必须为true才执行提交 |

**⚠️ 安全规则（硬规则）**：
- 提交前必须向用户展示确认单（Alpha ID、表达式、指标、检查结果）
- 用户确认后才调用（confirmed=true）
- **单条提交，不做批量**
- 提交低质量Alpha会影响评分，需谨慎
- 建议先调用checkSubmission确认所有检查项PASS后再提交

---

### getAlphaCorrelations — 获取生产相关性

**注册工具**: `getAlphaCorrelations({alphaId})`

| 参数 | 必填 | 说明 |
|------|------|------|
| alphaId | 是 | BRAIN平台的Alpha ID |

从API获取与平台已有Alpha的相关性数据，自动更新到本地数据库

**自动化流程**：回测完成后如果IS检查全PASS（可提交），系统自动调用此工具获取相关性，无需手动操作

---

### listAlphas — Alpha列表管理

**注册工具**: `listAlphas({status?, limit?, offset?})`

| 参数 | 必填 | 默认 | 说明 |
|------|------|------|------|
| status | 否 | - | 按状态筛选 |
| limit | 否 | 20 | 返回数量 |
| offset | 否 | 0 | 分页偏移 |

查询BRAIN平台上的Alpha列表，用于查看已提交/已模拟的Alpha

---

### getUserInfo — 获取用户信息

**注册工具**: `getUserInfo()`

无参数。返回当前登录账号的用户名、ID等信息

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
❌ 禁止：未经用户确认就调用submitAlpha（confirmed必须为true）
❌ 禁止：批量提交Alpha（submitAlpha只支持单条）
❌ 禁止：在用户未确认前修改reject_reason
❌ 禁止：后台执行回测+反复poll轮询进度（浪费API额度）
❌ 禁止：遇429限速时手动sleep+重试（工具内部自动处理）
❌ 禁止：直接修改config.json文件（用CLI参数覆盖，如--neutralization NONE）
❌ 禁止：擅自修改回测配置重跑（失败就报告原因，改配置需用户确认）

✅ 正确：直接调用 wq 命令或注册工具
✅ 正确：填入表达式列表 → 设并发数 → 启动
✅ 正确：让工具内部处理一切认证和并发
✅ 正确：等用户告知平台结果后再更新状态
✅ 正确：阻塞式等待回测完成，一次性获取全部结果
✅ 正确：大批量回测用sessions_spawn开子代理，避免卡主会话
✅ 正确：提交前用checkSubmission确认，用户确认后才submitAlpha
```

---

## 向量字段处理（硬规则）

```
⚠️ 向量字段必须先用Vector运算符压缩为标量，否则回测报错

正确: vec_avg(returns) + ts_mean(volume, 10)
错误: returns + ts_mean(volume, 10)   ← returns是向量，直接运算报错

可用压缩算子: vec_avg / vec_sum
```

详见 [data-type-strategy.md](references/data-type-strategy.md)

---

## 提交状态工作流

**⚠️ IS结果判断标准（核心）**：
- `IS结果：✅ 可提交` = checks数组中没有任何FAIL项（PENDING忽略，SELF_CORRELATION在提交前检查）
- `IS结果：❌ 不可提交` = checks数组中有任何FAIL项
- 提交前必须确认IS结果为"可提交"，否则平台会拒绝

**🔄 自动化流程**：
- 回测完成后，如果IS检查全PASS（可提交），系统自动查询生产相关性
- 相关性数据自动录入数据库，用户无需手动查询
- 手动查询仍可通过getAlphaCorrelations工具

```
未提交 → 可提交(待查) → 提交前检查 → 已提交 → 已通过 / 提交失败
              │              │                        ↑
         自动查相关性    checkSubmission        失败原因记录在reject_reason
         自动录入DB     确认所有项PASS
                            │
                     用户确认后submitAlpha
```

| 状态 | 触发条件 | 谁操作 | Agent做什么 |
|------|----------|--------|-------------|
| 未提交 | 回测失败 / IS有FAIL | 自动 | 显示结果，不提醒 |
| 可提交(待查) | IS全PASS | 自动判断 | 自动查相关性；提醒用户查平台 |
| 提交前检查 | 用户准备提交 | 用户触发 | checkSubmission确认所有项PASS |
| 已提交 | 用户确认后提交 | 用户确认 | submitAlpha(alphaId, confirmed=true) |
| 已通过 | 平台验证通过 | 自动/手动 | 更新submit_status |
| 提交失败 | 平台验证失败 | 自动/手动 | updateSubmitStatus(id, "提交失败", reason) |

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
