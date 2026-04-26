# 优化诊断指南

## 目录

- 症状→原因→建议方向速查表
- 渐进式优化原则
- 断舍离判断
- 优化方向推荐顺序
- 从失败中学习

---

## 症状→原因→建议方向速查表

| 症状 | 可能原因 | 建议方向 |
|------|----------|----------|
| Sharpe低(<0.7) | 信号太弱，数据无预测力 | 换数据源 / 加rank增强信号 / 调时间窗口 / 换策略模式 |
| Turnover过高(>70%) | 信号变化太快，日频噪声 | 加ts_decay_linear / 加trade_when / 提高Decay配置 / 用hump限幅 |
| Turnover过低(<5%) | 数据更新太慢，持仓几乎不变 | 检查字段更新频率 / 混合日更新数据 / 降低Decay / 缩短ts_decay_linear窗口 |
| CONCENTRATED_WEIGHT | 权重集中在少数股票 | 加rank分散 / 检查覆盖率（低覆盖导致权重集中）/ 设Truncation=0.08 / 加scale |
| LOW_SUB_UNIVERSE_SHARPE | 子集表现差，行业拖累 | 换Neutralization（试试INDUSTRY或SUBINDUSTRY）/ 检查哪个行业拖累 / 加group_neutralize |
| SELF_CORRELATION过高 | 与已有Alpha太像 | 换数据源 / 换算子（rank→group_rank）/ 换分组方式 / 换时间窗口 / 组合新信号 |
| IS全PASS但OOS差 | 过拟合 | 减少参数微调 / 简化表达式 / 检查Decay是否过大 / 用IS Testing提前验证 |
| 回测报错 "too much resources" | 向量字段未压缩 | 用vec_avg/vec_sum压缩向量字段 |
| Long Count异常小 | 数据更新频率极低 | 用ts_backfill / group_backfill补救 / 换更新频率高的字段 |
| Fitness低 | Sharpe和Turnover组合不佳 | 参考上方Sharpe低和Turnover过高的方案 / 两者需要平衡 |

---

## 渐进式优化原则

**核心规则：每次只改一个变量**

```
初始Alpha → 回测 → 记录结果
  ↓
改一个变量 → 回测 → 对比变化
  ↓
有改善 → 继续微调同一方向
无改善 → 回退，换一个变量改
```

**为什么每次只改一个**：
- 改多个变量时无法判断哪个有效
- 容易陷入参数搜索的过拟合陷阱
- 保持对每个变量影响的清晰认知

**可改变的变量优先级**：
1. 配置参数（Decay / Neutralization / Truncation）
2. 表达式参数（时间窗口d / 衰减窗口d）
3. 算子替换（rank → group_rank / ts_mean → ts_decay_linear）
4. 数据字段替换（同数据集换字段 / 换数据集）

---

## 断舍离判断

**3次无改善 → 建议转向**

- 同一个策略方向修改3次，Sharpe仍<0.7 → 换策略模式
- 同一个数据集测试3个字段都无效 → 换数据集
- 同一组配置微调3次无进展 → 回退到上一步

**5次无改善 → 建议放弃**

- 一个思路总共尝试5次优化仍无法通过IS Checks → 完全放弃
- 不要"重复做同样的事情却期望得到不同的结果"
- 好的Alpha逻辑应该是稍微一测就有好结果

**转向方向**：
- 策略模式 → 参考 [strategy-patterns.md](strategy-patterns.md) 换一个模式
- 数据源 → 参考 [data-type-strategy.md](data-type-strategy.md) 换数据集
- 算子 → 参考 [tool-reference.md](tool-reference.md) 换算子组合

---

## 提交前预检

### IS Testing

提交前建议在BRAIN网页端点击IS Testing，预检样本外(OOS)表现。
IS Testing可提前发现过拟合问题，避免浪费提交次数。
⚠️ OOS数据仅Consultant可见，非Consultant无法查看样本外表现。
（此功能仅网页端可用，API暂不支持）

### Consultant质量分机制

- 初始分0.5，每个通过的Alpha加分
- 高度雷同的Alpha会互相拖累质量分（1+1<2法则）
- 宁缺毋滥：1个独特高质量Alpha > 10个同质化Alpha

---

## 优化方向推荐顺序

```
调配置（最快，风险最低）
  ├── Decay: 0 → 5 → 10 → 15
  ├── Neutralization: None → MARKET → SECTOR → INDUSTRY → SUBINDUSTRY
  └── Truncation: 0.08（默认）
  ↓ 无改善
调参数（中等速度）
  ├── 时间窗口: d=5 → d=10 → d=21 → d=63
  ├── 衰减窗口: ts_decay_linear的d
  └── 条件阈值: trade_when的阈值
  ↓ 无改善
换算子（需要理解算子语义）
  ├── rank → group_rank → ts_rank
  ├── ts_mean → ts_decay_linear
  ├── correlation → covariance → ts_regression
  └── 加group_neutralize / 加trade_when
  ↓ 无改善
换数据（最慢，但可能突破最大）
  ├── 同数据集换字段
  ├── 换数据集（fundamental6 → analyst111 → scl12）
  └── 跨数据集组合（量价+基本面 / 情绪+量价）
```

---

## 从失败中学习

### 分类归因

每次失败的Alpha记录以下信息：

| 归因类别 | 识别特征 | 下次避免 |
|----------|----------|----------|
| 数据问题 | 覆盖率低 / 更新太慢 / 值域异常 | 先做字段分析再写Alpha |
| 逻辑问题 | Sharpe接近0 / 正负方向都无效 | 换策略模式，不要死磕 |
| 过拟合 | IS好OOS差 / 参数微调才过 | 简化表达式，减少参数 |
| 重复问题 | SELF_CORRELATION高 | 换数据源或换算子组合 |
| 配置问题 | 指标差但逻辑合理 | 先调配置再调表达式 |

### 模式识别

积累足够多的失败案例后，识别重复出现的模式：

- 某数据集总是失败 → 该数据集可能已被过度挖掘
- 某类算子组合总是高相关 → 该组合已被大量使用
- 某配置总是导致OOS差 → 该配置是过拟合信号

将这些模式记录到 [data-type-strategy.md](data-type-strategy.md) 的经验表中，避免重复踩坑。
