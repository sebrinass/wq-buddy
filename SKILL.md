---
name: "wq-alpha-mining"
description: "WorldQuant BRAIN平台Alpha挖掘工具集。通过CLI命令回测Alpha表达式、搜索数据字段、分析字段特性。使用当用户需要回测Alpha、搜索BRAIN平台字段、批量测试表达式时。"
version: "1.5.0"
tags: ["worldquant", "alpha", "backtest", "brain"]
---

# WQ Alpha Mining — CLI工具集

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
│  ├─ 单条表达式 → wq backtest "expr"
│  ├─ 多条表达式 → wq backtest "expr1" "expr2" "expr3"
│  ├─ 从文件批量 → wq backtest --file ./expressions.txt
│  └─ 需要并发/查重 → 加 --concurrency / --enable-duplicate-check
│
├─ 找数据字段
│  ├─ 关键词搜索 → wq search "earnings"
│  ├─ 限定数据集 → wq search "earnings" --dataset fundamental6
│  └─ 浏览整个数据集 → wq search --dataset pv13
│
├─ 了解字段特性
│  └─ wq analyze 字段名
│     → 6项测试：覆盖率/非零覆盖率/更新频率/数据范围/中位数/数据分布
│
├─ 查看回测统计
│  └─ wq stats
│
├─ 导出数据
│  ├─ 导出Alpha → wq export [alpha] [路径]
│  └─ 导出字段分析 → wq export field [路径]
│
└─ 查看运算符文档
   └─ wq docs
```

---

## 各工具详细用法

### wq backtest — 回测Alpha表达式

**核心原则**：填入表达式列表，设并发数，启动。工具内部处理一切认证、提交、结果收集。

```bash
wq backtest "rank(cash_flow)"                                    # 单条
wq backtest "rank(cash_flow)" "ts_delta(earnings,5)" "abs(revenue)"  # 批量
wq backtest --file ./expressions.txt                             # 从文件读取
wq backtest --concurrency 3 "expr1" "expr2" "expr3"             # 并发(1-3)
wq backtest --enable-duplicate-check "expr1" "expr2"            # 查重
```

| 参数 | 必填 | 默认 | 说明 |
|------|------|------|------|
| expressions | 是(或--file) | - | 任意alpha表达式列表 |
| --concurrency, -c | 否 | 1 | 并发数，范围1-3 |
| --file, -f | 否 | - | 从文件读取，每行一条，忽略空行和#注释 |
| --enable-duplicate-check, -d | 否 | 关闭 | 开启重复检查 |

**默认配置来源**：config.json（中性化INDUSTRY、延迟1、universe TOP3000等）

**失败策略**：单条失败跳过继续，不中断整体

**回测前确认**：执行前必须向用户展示确认单（表达式、配置、并发数），等待确认后再运行

**回测后闭环**：完成后检查空字段，提醒用户操作

详见 [submission-workflow.md](references/submission-workflow.md)

---

### wq search — 搜索数据字段

```bash
wq search "operating cash flow"                                  # 关键词搜索
wq search "earnings" --dataset fundamental6                      # 限定数据集
wq search --dataset pv13                                         # 获取数据集所有字段
wq search "revenue" --limit 100                                  # 限制结果数量
```

| 参数 | 必填 | 默认 | 说明 |
|------|------|------|------|
| keyword | 否(与--dataset二选一) | - | 搜索关键词 |
| --dataset | 否 | - | 限定数据集ID |
| --limit, -l | 否 | 50 | 限制结果数量 |

**认证机制**：工具内部自动处理Cookie认证（登录→缓存4小时→自动续期），无需手动干预

---

### wq analyze — 分析字段特性

```bash
wq analyze fnd2_ebitdm                                           # 分析字段
```

| 参数 | 必填 | 说明 |
|------|------|------|
| fieldName | 是 | 字段名 |

**执行6项标准测试**：覆盖率 / 非零覆盖率 / 更新频率 / 数据范围 / 中位数 / 数据分布

**分析配置**：自动使用 Neutralization=None, Decay=0（确保看到原始数据特性）

**结果保存**：自动保存到field_analyses表

详见 [field-analysis.md](references/field-analysis.md)

---

### wq stats — 查看回测统计

```bash
wq stats                                                         # 查看统计
```

无参数。返回最近100条回测的统计报告。

---

### wq export — 导出CSV数据

```bash
wq export                                                        # 导出alpha CSV（默认）
wq export field                                                  # 导出字段分析CSV
wq export alpha ./output.csv                                     # 指定输出路径
```

| 参数 | 必填 | 默认 | 说明 |
|------|------|------|------|
| type | 否 | alpha | 导出类型：alpha / field |
| outputPath | 否 | 自动生成 | 输出文件路径 |

---

### wq docs — 查看运算符文档

```bash
wq docs                                                          # 运算符文档
```

无参数。输出6大类运算符的语法、用法和示例。

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

✅ 正确：直接调用 wq 命令
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
| 已通过 | 用户确认OK | 手动 | 更新状态 |
| 提交失败 | 用户告知失败+原因 | 手动 | 更新状态+记录原因 |

详见 [submission-workflow.md](references/submission-workflow.md)

---

## 字段分析流程

```
1. wq search "关键词" → 找到字段
2. wq analyze 字段名 → 分析特性
3. 根据分析结果构建Alpha表达式
4. wq backtest 表达式 → 回测验证
```

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

## 参考资料

- [字段分析方法论](references/field-analysis.md) — 6种标准测试 + 判断流程
- [提交流程与状态管理](references/submission-workflow.md) — 状态转换图 + 特殊场景
- [工具集成指南](references/tool-reference.md) — 函数列表 + 工作流示例
- [策略模式库](references/strategy-patterns.md) — 已验证/待验证的Alpha构建模式
- [数据类型策略](references/data-type-strategy.md) — 基本面/量价/情绪数据策略
- [优化指南](references/optimization-guide.md) — 诊断方法 + 优化路径
- [运算符速查](references/operators-reference.md) — 6大类运算符语法+用法+示例
