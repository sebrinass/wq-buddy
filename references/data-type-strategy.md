# 数据策略指南

## 目录

- 向量字段处理规则
- 数据集经验表
- 字段搜索两步走流程
- 低覆盖率字段补救
- 数据集价值评分
- 基本面vs量价配置差异

---

## 向量字段处理规则

**核心规则**：向量字段（Vector Data）**必须**先用 `vec_avg` 或 `vec_sum` 压缩为矩阵字段，否则回测报错。

向量字段特征：一只股票一天有多个值（如新闻情绪一天20条=20个分数）。

**处理方式**：
- `vec_avg({vector_field})`：取均值，适合情绪分数类
- `vec_sum({vector_field})`：取总和，适合计数/热度类

**报错信号**：如果回测报错 "You take too much resources"，大概率是忘记压缩向量字段。

**示例**：
```
vec_avg(scl12_alltype_buzzvec)
vec_sum(scl12_alltype_buzzvec)
```

---

## 数据集经验表

| 数据集 | 类型 | 更新频率 | 经验与注意事项 | 推荐策略模式 |
|--------|------|----------|---------------|-------------|
| fundamental6 | 基本面 | 季度/年度 | 盈利类字段（如ebitdm、operating_income）表现好；资产负债绝对值类字段（如total_assets、total_liabilities）差，需要做比率处理 | 行业中性类、衰减加权类 |
| pv1 | 量价 | 日更新 | 噪声大，需要rank/scale归一化；close/open/high/low/volume/vwap/returns/adv20可用 | 动量类、反转类、量价背离类 |
| scl12 | 情绪向量 | 日更新 | 向量数据，必须先vec_avg/vec_sum；情绪分数范围[-1,1]已归一化 | 动量类、条件触发类、复合信号类 |
| analyst111 | 分析师预测 | 低频 | 更新频率极低，Long Count日均值很小属正常 | 条件触发类、衰减加权类 |

> 此表随使用持续积累，新经验追加到末尾。

---

## 字段搜索两步走流程

```
需要某个含义的字段（如"毛利率"）
  ↓
第一步：查本地 field_analyses 表
  - 调用 db.searchFieldAnalysis({keyword})
  - 如果找到 → 直接使用已有分析结论
  ↓
第二步：搜平台 API
  - 调用 searchFields({keyword, dataset?})
  - 或在平台 Data 页面手动搜索
  - 找到后用6种标准测试分析字段特性
  ↓
可选：保存分析结果到 field_analyses 表
```

**为什么两步走**：避免重复分析已测过的字段，节省回测次数和时间。

---

## 低覆盖率字段补救

**问题**：字段覆盖率低于30%时，直接使用会导致大量NaN，Alpha信号太弱。

**补救方法**：

| 方法 | 表达式 | 适用场景 |
|------|--------|----------|
| 时间回填 | `ts_backfill({field}, lookback=252)` | 基本面数据，季度更新 |
| 分组回填 | `group_backfill({field}, subindustry, 21)` | 同行业有可比性的数据 |
| 第K个有效值 | `kth_element({field}, 63, k=1, ignore="NaN 0")` | 更高效，替代ts_backfill |
| filter模式 | `add(x, y, filter=true)` 或 `multiply(x, y, filter=true)` | 运算时将NaN视为0/1 |

**注意事项**：
- ts_backfill的lookback不宜过长，避免引入过期值
- group_backfill要求同组内字段尺度一致
- 补救后仍需检查覆盖率是否达标

---

## 数据集价值评分

**概念**：衡量数据集未被充分利用程度的指标，分越高说明该数据集的Alpha挖掘潜力越大。

**使用建议**：
- 优先研究高价值评分的数据集
- 低价值评分不代表无用，只是已被大量挖掘，提交时更容易与已有Alpha高相关
- 价值评分是动态变化的，定期重新评估

**获取方式**：平台Data页面可查看（仅顾问可见）

---

## 基本面vs量价配置差异

| 配置项 | 基本面数据 | 量价数据 | 说明 |
|--------|-----------|---------|------|
| Decay | 10-20 | 3-10 | 基本面更新慢，需要更长衰减平滑信号 |
| Neutralization | INDUSTRY / SUBINDUSTRY | MARKET / SECTOR | 基本面必须行业中性化，消除行业系统性差异 |
| Truncation | 0.08 | 0.08 | 默认值，控制单只股票最大权重 |
| 时间窗口 | 63-252 | 5-21 | 基本面用长窗口，量价用短窗口 |
| ts_decay_linear的d | 10-20 | 3-10 | 与Decay配置逻辑一致 |
| trade_when | 建议使用 | 可选 | 基本面数据更新慢，用trade_when降低无效换手 |

**核心原则**：Decay和ts_decay_linear的窗口应与数据更新频率匹配，而非盲目调大凑分数。

---

## 回测参数速查

| 参数 | 含义 | 推荐值 |
|------|------|--------|
| Pasteurize（消毒） | 非池中股票→NaN | ON（默认，保持纯净） |
| NaN Handling | 用均值替换NaN | OFF（保持信号纯净，用filter参数或ts_backfill手动处理） |
| Unit Handling | Verify单位一致性 | Verify（默认） |
| Delay | 数据延迟 | 1（保守，避免未来数据） |
| Truncation | 单股最大权重 | 0.05-0.08 |

### filter参数技巧

add(x, y, filter=true) / multiply(x, y, filter=true)：
当filter=true时，add将NaN视为0，multiply将NaN视为1。
用途：保留NaN标记，提高覆盖率而不需回填。
示例：add(rank(close), rank(volume), filter=true)
