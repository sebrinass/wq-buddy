# 策略模式库

## 目录

- 1. 动量类（Momentum）
- 2. 反转类（Reversal）
- 3. 量价背离类（Volume-Price Divergence）
- 4. 波动率类（Volatility）
- 5. 行业中性类（Industry-Neutral）
- 6. 条件触发类（Conditional）
- 7. 衰减加权类（Decay-Weighted）
- 8. 复合信号类（Composite Signal）
- 论文启发索引

---

## 1. 动量类（Momentum）— 追涨杀跌

**核心逻辑**：过去表现好的股票未来继续好，用正方向信号追踪趋势。

**基础模板**：
```
rank(ts_delta(close, d))
rank(returns)
rank(ts_mean(returns, d))
```

**变异方向**：
- 换时间窗口：d=5（周动量）/ d=21（月动量）/ d=63（季动量）
- 换排名方式：rank → group_rank → ts_rank
- 加衰减：ts_decay_linear(rank(returns), d)
- 加条件：trade_when(volume > adv20, rank(returns), -1)
- 加负号反转：反向即变反转类
- 换数据源：close → vwap → 基本面字段

**适用数据类型**：量价数据（pv1），日更新数据

**反例**：市场剧烈反转期（如2008金融危机），动量策略会持续亏损

**来源标注**：101个Alpha论文（Alpha#3, Alpha#8, Alpha#43）/ 第1课（动量策略定义）

**状态**：✅已验证

---

## 2. 反转类（Reversal）— 均值回归

**核心逻辑**：涨多了必跌，跌多了必涨，用负方向信号做逆向交易。

**基础模板**：
```
-rank(ts_delta(close, d))
rank(vwap - close)
-rank(close - ts_mean(close, d))
```

**变异方向**：
- 换时间窗口：d=1（日内反转）/ d=5（周反转）/ d=21（月反转）
- 换基准价：close vs vwap / open vs close / high vs low
- 加rank分散：rank(-ts_delta(close, d))
- 加条件过滤：trade_when(abs(returns) > threshold, -rank(returns), -1)
- 组合信号：rank(vwap - close) * rank(volume)
- 换分组：group_neutralize(-rank(returns), industry)

**适用数据类型**：量价数据（pv1），日内或短期数据

**反例**：强趋势行情中反转策略持续亏损；数据更新太慢时信号无意义

**来源标注**：101个Alpha论文（Alpha#2, Alpha#5, Alpha#42）/ 第1课（反转策略定义）

**状态**：✅已验证

---

## 3. 量价背离类（Volume-Price Divergence）

**核心逻辑**：价格和成交量的变化方向不一致时，预示趋势可能反转或加速。

**基础模板**：
```
-correlation(rank(close), rank(volume), d)
rank(ts_delta(close, d)) * -rank(ts_delta(volume, d))
sign(ts_delta(volume, 1)) * (-ts_delta(close, 1))
```

**变异方向**：
- 换相关性窗口：d=5 / d=10 / d=20
- 换价格代理：close → vwap → open
- 换成交量代理：volume → volume/adv20 → ts_delta(volume, d)
- 加排名：rank(correlation(close, volume, d))
- 加分组中性：group_neutralize(correlation(close, volume, d), industry)
- 用协方差替代：-rank(covariance(rank(close), rank(volume), d))

**适用数据类型**：量价数据（pv1），需要同时有价格和成交量

**反例**：成交量数据缺失严重的标的；低流动性标的成交量信号不可靠

**来源标注**：101个Alpha论文（Alpha#2, Alpha#3, Alpha#6, Alpha#12, Alpha#13, Alpha#15, Alpha#16）

**状态**：✅已验证

---

## 4. 波动率类（Volatility）

**核心逻辑**：波动率的变化或水平本身包含信息，低波动率往往伴随更高风险调整收益。

**基础模板**：
```
-rank(ts_std_dev(returns, d))
rank(ts_std_dev(close, d1) / ts_std_dev(close, d2))
rank(abs(close - open) / (high - low + 0.001))
```

**变异方向**：
- 换窗口比例：d1/d2 = 5/20 / 10/50 / 21/63（短期/长期波动率比）
- 换波动率代理：std_dev → range(high-low) → ts_zscore
- 加排名分散：rank(-ts_std_dev(returns, d))
- 加条件：trade_when(ts_std_dev(returns, 5) > ts_std_dev(returns, 20), alpha, -1)
- 用回归残差：ts_regression(close, ts_step(1), 60, rettype=0)

**适用数据类型**：量价数据（pv1），需要high/low/close/open

**反例**：数据缺失导致波动率计算不准；极端行情下波动率信号失真

**来源标注**：101个Alpha论文（Alpha#18, Alpha#22, Alpha#34, Alpha#40）/ Alpha#101

**状态**：✅已验证

---

## 5. 行业中性类（Industry-Neutral）

**核心逻辑**：在行业/板块内部做排名和比较，消除行业系统性影响，赚取行业内相对收益。

**基础模板**：
```
group_neutralize(rank({field}), industry)
group_rank({field}, subindustry)
group_zscore({field}, sector)
```

**变异方向**：
- 换分组粒度：market → sector → industry → subindustry
- 自定义分组：bucket(rank(cap), range="0,1,0.2") 替代行业分组
- 加时间序列：group_rank(ts_rank({field}, d), industry)
- 加中性化组合：先group_neutralize再rank
- 混合分组：bucket(rank(cap), range="0,1,0.2") + industry 双重中性化
- 用group_mean做基准：{field} / group_mean({field}, 1, industry)

**适用数据类型**：所有数据类型，尤其基本面数据（fundamental6）必须配合行业中性

**反例**：行业内部股票数量太少（<5只）时中性化无意义；分组过细导致信号分散

**来源标注**：101个Alpha论文（Alpha#48, Alpha#58, Alpha#59, Alpha#63, Alpha#100）/ 第3课（中性化原理）/ 新手课代码分享（group_ops模板）

**状态**：✅已验证

---

## 6. 条件触发类（Conditional）

**核心逻辑**：只在特定条件满足时才交易，其余时间持仓不变，降低换手率或捕捉事件驱动机会。

**基础模板**：
```
trade_when(condition, alpha, exit_condition)
if_else(condition, alpha_strong, alpha_weak)
```

**变异方向**：
- 换触发条件：volume > adv20 / abs(returns) > threshold / days_from_last_change(field) == 0
- 换退出条件：-1（永不退出）/ returns < -threshold / is_nan(field)
- 加衰减：trade_when + ts_decay_linear 组合
- 多条件组合：trade_when(and(cond1, cond2), alpha, exit)
- 事件驱动：days_from_last_change(ern2_earnrelease_d1_calendar_prev) == 0
- 用if_else做分段：if_else(volume > adv20, 2*alpha, alpha)

**适用数据类型**：所有数据类型，尤其低频更新的基本面数据需要条件触发

**反例**：条件太严格导致几乎不交易（Turnover过低）；条件太宽松等于没加条件

**来源标注**：101个Alpha论文（Alpha#7, Alpha#21, Alpha#23, Alpha#46）/ 第2课（trade_when详解）/ 第3课（条件触发开关）

**状态**：✅已验证

---

## 7. 衰减加权类（Decay-Weighted）

**核心逻辑**：对历史信号施加线性衰减权重，近期信号权重大、远期小，平滑信号降低换手率。

**基础模板**：
```
ts_decay_linear(rank({field}), d)
ts_decay_linear(alpha, d)
```

**变异方向**：
- 换衰减窗口：d=5 / d=10 / d=20（与数据更新频率匹配）
- 换衰减方式：ts_decay_linear → hump(x, 0.01) → 配置Decay参数
- 加rank：rank(ts_decay_linear({field}, d))
- 嵌套衰减：ts_decay_linear(ts_decay_linear({field}, d1), d2)
- 与trade_when组合：trade_when + ts_decay_linear 双重降换手
- 注意Decay参数与ts_decay_linear的区别：Decay是全局配置，ts_decay_linear是表达式内局部衰减

**适用数据类型**：所有数据类型，基本面数据推荐较长衰减窗口（10-20），量价数据推荐较短（3-10）

**反例**：衰减窗口远大于信号有效周期（如5天信号配20天衰减=过拟合）；Decay参数盲目调大凑分数

**来源标注**：101个Alpha论文（Alpha#31, Alpha#57, Alpha#58, Alpha#72）/ 第4课（Decay的正确使用）/ 新手课代码分享（decay_linear模板）

**状态**：✅已验证

---

## 8. 复合信号类（Composite Signal）

**核心逻辑**：将多个独立信号通过乘法、加法或条件逻辑组合，利用信号间的互补性提升稳定性。

**基础模板**：
```
rank(signal1) * rank(signal2)
rank(signal1) + rank(signal2)
rank(signal1) ^ rank(signal2)
```

**变异方向**：
- 换组合方式：乘法（互斥增强）/ 加法（独立叠加）/ 幂运算（非线性组合）
- 换信号来源：量价+基本面 / 情绪+量价 / 波动率+动量
- 加权重：w1*rank(s1) + w2*rank(s2)
- 用ts_corr做信号：correlation(signal1, signal2, d) 本身也是信号
- 用回归残差：ts_regression(y, x, d, rettype=0) 去除共线性
- 分层组合：group_rank(signal1, industry) * rank(signal2)

**适用数据类型**：跨数据类型组合效果最佳

**反例**：两个高度相关的信号组合无增量价值；组合后表达式过于复杂导致过拟合

**来源标注**：101个Alpha论文（Alpha#11, Alpha#17, Alpha#36, Alpha#83, Alpha#101）/ 第4课（鲁棒性与独特性）/ 新闻情绪论文（情绪+基本面组合）

**状态**：✅已验证

---

## 论文启发索引

### 101 Formulaic Alphas

来源: Zura Kakushadze / Quantigic Solutions LLC / 2015

核心发现: 论文给出了101个真实交易Alpha的显式公式，平均持仓期0.6-6.4天，Alpha间平均相关性仅15.9%。收益与波动率强相关（R ~ V^0.76），但与换手率无显著关系。换手率对Alpha间相关性的解释力很弱。大部分Alpha基于量价数据（open/close/high/low/volume/vwap），部分使用基本面（cap）和行业分类（IndClass）。Alpha可粗分为动量和反转两大类，复杂Alpha中两者可混合。rank和correlation是最常用的算子。

可复用模式:
- [动量类](#1-动量类momentum--追涨杀跌)：Alpha#3, Alpha#8, Alpha#43
- [反转类](#2-反转类reversal--均值回归)：Alpha#2, Alpha#5, Alpha#42
- [量价背离类](#3-量价背离类volume-price-divergence)：Alpha#2, Alpha#6, Alpha#12, Alpha#13
- [波动率类](#4-波动率类volatility)：Alpha#18, Alpha#22, Alpha#34, Alpha#40
- [行业中性类](#5-行业中性类industry-neutral)：Alpha#48, Alpha#58, Alpha#59, Alpha#63, Alpha#100
- [条件触发类](#6-条件触发类conditional)：Alpha#7, Alpha#21, Alpha#23, Alpha#46
- [衰减加权类](#7-衰减加权类decay-weighted)：Alpha#31, Alpha#57, Alpha#72
- [复合信号类](#8-复合信号类composite-signal)：Alpha#11, Alpha#17, Alpha#36, Alpha#83, Alpha#101

适用条件: 量价数据为主的高频交易场景；需要rank做归一化；需要correlation/covariance捕捉量价关系

局限: 论文Alpha基于2010-2013年数据，市场结构已变化；大量Alpha使用非整数参数（如Alpha#58的3.92795），这些参数可能是过拟合的产物；直接复制论文公式在当前平台上大概率因SELF_CORRELATION被拒

标签: #量价 #动量 #反转 #rank #correlation #高频

---

### The Momentum of News（新闻情绪动量）

来源: Ying Wang, Bohui Zhang, Xiaoneng Zhu / 2018

核心发现: 基于RavenPack新闻数据构建月度公司级新闻情绪分数，发现"新闻动量"现象——过去正面新闻多的公司未来继续产生正面新闻，反之亦然。三种假说中，"基本面持续性假说"获得支持：新闻动量由公司基本面（盈利）的持续性驱动，而非陈旧信息或策略性披露。做多好新闻组合+做空坏新闻组合，年化风险调整收益7.45%。该收益在短期显著、长期消失，且在信息环境差的公司（小市值、低分析师覆盖、低机构持仓）中更强，支持误定价解释。新闻日和非新闻日均有收益，说明投资者既对新闻动量本身反应不足，也对当期新闻反应不足。硬新闻（营收/盈利/分析师评级/信用评级）比软新闻预测力更强。

可复用模式:
- [动量类](#1-动量类momentum--追涨杀跌)：新闻情绪的持续性=动量信号
- [反转类](#2-反转类reversal--均值回归)：新闻过度反应后的反转
- [行业中性类](#5-行业中性类industry-neutral)：信息环境差的股票新闻动量更强，可按信息环境分组
- [条件触发类](#6-条件触发类conditional)：在新闻发布日触发交易
- [复合信号类](#8-复合信号类composite-signal)：新闻情绪+基本面组合

适用条件: 有新闻情绪数据（如scl12数据集）；月度或更低频率交易；信息环境差的公司效果更好

局限: 新闻数据覆盖率有限（约27.4%公司月度无新闻）；情绪分数算法不透明（RavenPack黑盒）；短期效应为主，长期消失；平台上的情绪数据字段可能与论文使用的RavenPack数据不同

标签: #情绪 #新闻 #动量 #误定价 #基本面 #硬新闻 #scl12
