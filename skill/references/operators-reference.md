# 运算符速查手册

## 目录

- [一、时间序列运算符（ts_*）](#一时间序列运算符ts_)
- [二、截面运算符](#二截面运算符)
- [三、分组运算符（group_*）](#三分组运算符group_)
- [四、逻辑运算符](#四逻辑运算符)
- [五、算术运算符](#五算术运算符)
- [六、向量运算符](#六向量运算符)
- [七、变换运算符](#七变换运算符)

---

## 一、时间序列运算符（ts_*）

| 运算符 | 语法 | 说明 | 典型用法 |
|--------|------|------|----------|
| ts_rank | `ts_rank(x, d, constant=0)` | 过去d天窗口内x的归一化排名(0-1) | `ts_rank(close, 20)` — 收盘价在20日内的历史百分位 |
| ts_mean | `ts_mean(x, d)` | 过去d天移动平均 | `ts_mean(volume, 5)` — 5日均量 |
| ts_delta | `ts_delta(x, d)` | 当前值与d天前的差分 | `ts_delta(close, 1)` — 日价格变动 |
| ts_sum | `ts_sum(x, d)` | 过去d天累计求和 | `ts_sum(returns, 10)` — 10日累计收益 |
| ts_std_dev | `ts_std_dev(x, d)` | 过去d天标准差 | `ts_std_dev(close, 20)` — 20日波动率 |
| ts_corr | `ts_corr(x, y, d)` | 过去d天x与y的Pearson相关系数 | `ts_corr(close, volume, 20)` — 量价相关性 |
| ts_delay | `ts_delay(x, d)` | 延迟d天的值 | `ts_delay(close, 1)` — 昨日收盘价 |
| ts_zscore | `ts_zscore(x, d)` | 窗口内Z分数，距均值几个标准差 | `ts_zscore(returns, 20)` — 收益率标准化 |
| ts_decay_linear | `ts_decay_linear(x, d, dense=false)` | 线性衰减加权，越近权重越大 | `ts_decay_linear(returns, 5)` — 平滑信号 |
| ts_av_diff | `ts_av_diff(x, d)` | 当前值与d天均值之差(忽略NaN) | `ts_av_diff(close, 20)` — 偏离均线程度 |
| ts_arg_max | `ts_arg_max(x, d)` | 过去d天最大值出现距今天数 | `ts_arg_max(close, 10)` — 高点距今天数 |
| ts_arg_min | `ts_arg_min(x, d)` | 过去d天最小值出现距今天数 | `ts_arg_min(close, 10)` — 低点距今天数 |
| ts_product | `ts_product(x, d)` | 过去d天连乘积 | `ts_product(returns, 10)` — 复合收益率 |
| ts_covariance | `ts_covariance(y, x, d)` | 过去d天y与x的协方差 | `ts_covariance(close, volume, 20)` |
| ts_scale | `ts_scale(x, d, constant=0)` | 根据d天最值缩放到0-1 | `ts_scale(close, 20)` — 价格在区间内位置 |
| ts_count_nans | `ts_count_nans(x, d)` | 过去d天NaN数量 | `ts_count_nans(ebit, 63)` — 数据缺失程度 |
| ts_step | `ts_step(1)` | 每日递增1的计数器 | `ts_regression(y, ts_step(1), 60, rettype=0)` — 时间趋势 |
| ts_backfill | `ts_backfill(x, lookback=d, k=1)` | 用回望窗口内最近有效值替换NaN | `ts_backfill(fnd6_newqv1300_xrdq, 252)` — 基本面数据回填 |
| ts_quantile | `ts_quantile(x, d, driver="gaussian")` | ts_rank后通过指定分布的逆CDF变换 | `ts_quantile(returns, 63, driver="cauchy")` — 分位数归一化 |
| ts_regression | `ts_regression(y, x, d, lag=0, rettype=0)` | 最小二乘回归，rettype控制返回值 | `ts_regression(est_netprofit, est_netdebt, 252, rettype=2)` — 回归斜率 |
| hump | `hump(x, hump=0.01)` | 限制变化幅度和频率，降低Turnover（换手率） | `hump(rank(-returns), 0.01)` — 降换手率 |
| kth_element | `kth_element(x, d, k, ignore="NaN")` | 回望窗口内第k个值，比ts_backfill更高效 | `kth_element(dividend, 63, k=1, ignore="NaN 0")` — 高效回填 |
| days_from_last_change | `days_from_last_change(x)` | 值自上次变化以来经过的天数 | `days_from_last_change(ern2_earnrelease_d1_calendar_prev)` — 财报间隔 |
| last_diff_value | `last_diff_value(x, d)` | 过去d天中最近一个与当前不同的值 | `last_diff_value(eps, 63)` — 上一次EPS值 |

**ts_regression的rettype参数速查：**

| rettype | 返回值 |
|---------|--------|
| 0 | 残差项 |
| 1 | 截距 |
| 2 | 斜率 |
| 3 | 预测值 |
| 4 | 误差平方和SSE |
| 5 | 总平方和SST |
| 6 | 决定系数R^2 |
| 7 | 均方误差MSE |
| 8 | 斜率标准误 |
| 9 | 截距标准误 |

---

## 二、截面运算符

| 运算符 | 语法 | 说明 | 典型用法 |
|--------|------|------|----------|
| rank | `rank(x, rate=2)` | 截面排名，最低=0，最高=1 | `rank(close)` — 全市场收盘价排名 |
| scale | `scale(x, scale=1, longscale=1, shortscale=1)` | 缩放使绝对值之和=目标值 | `scale(returns, 4)` — 仓位缩放 |
| zscore | `zscore(x)` | 截面Z分数 | `zscore(returns)` — 标准化收益率 |
| quantile | `quantile(x, driver=gaussian, sigma=1.0)` | 排名后映射到指定分布 | `quantile(iv_call-iv_put, driver=cauchy)` — 重尾变换 |
| normalize | `normalize(x, useStd=false, limit=0.0)` | 截面中心化(减均值)，可选除以标准差 | `normalize(rank(returns), useStd=true, limit=3)` |
| winsorize | `winsorize(x, std=4)` | 超出均值±std倍标准差的值钳制到边界 | `winsorize(x, 4)` — 去极值 |
| scale_down | `scale_down(x)` | 归一化到[-1,1]范围 | `scale_down(alpha)` — 信号归一化 |

---

## 三、分组运算符（group_*）

| 运算符 | 语法 | 说明 | 典型用法 |
|--------|------|------|----------|
| group_rank | `group_rank(x, group)` | 组内排名0-1 | `group_rank(ebit, industry)` — 行业内排名 |
| group_neutralize | `group_neutralize(x, group)` | 组内Neutralization（中性化），减组均值 | `group_neutralize(alpha, sector)` — 消除行业偏差 |
| group_zscore | `group_zscore(x, group)` | 组内Z分数 | `group_zscore(pe, industry)` — 行业内标准化 |
| group_mean | `group_mean(x, weight, group)` | 组内调和均值 | `group_mean(pe, 1, industry)` — 行业P/E调和均值 |
| group_scale | `group_scale(x, group)` | 组内缩放到0-1 | `group_scale(revenue, sector)` — 行业内归一化 |
| group_backfill | `group_backfill(x, group, d, std=4.0)` | 组内NaN回填(缩尾均值) | `group_backfill(ebit, sector, 21)` — 组内补缺 |

**性能提示**：group算子前用 `densify()` 压缩分组分桶数，可显著提升性能。

示例：`group_zscore(alpha, densify(asset_group))`

---

## 四、逻辑运算符

| 运算符 | 语法 | 说明 | 典型用法 |
|--------|------|------|----------|
| if_else | `if_else(cond, a, b)` | 条件为真返回a，否则返回b | `if_else(returns>0, 1, -1)` |
| and | `and(a, b)` | 逻辑与 | `and(cond1, cond2)` |
| or | `or(a, b)` | 逻辑或 | `or(cond1, cond2)` |
| not | `not(x)` | 逻辑非 | `not(is_nan(x))` |
| is_nan | `is_nan(x)` | 是否为NaN | `is_nan(ebit)` |
| 比较 | `x < y`, `x > y`, `x == y`等 | 比较运算符 | `volume > adv20` |

---

## 五、算术运算符

| 运算符 | 语法 | 说明 | 典型用法 |
|--------|------|------|----------|
| abs | `abs(x)` | 绝对值 | `abs(returns)` |
| log | `log(x)` | 自然对数 | `log(sales)` |
| sign | `sign(x)` | 符号函数(+1/-1/0) | `sign(delta)` |
| sqrt | `sqrt(x)` | 平方根 | `sqrt(volume)` |
| power | `power(x, y)` | 幂运算x^y | `power(x, 2)` |
| signed_power | `signed_power(x, y)` | 保符号幂运算：sign(x)*abs(x)^y | `signed_power(x, 0.5)` — 保符号开方 |
| max | `max(x, y, ...)` | 最大值 | `max(close, vwap)` |
| min | `min(x, y, ...)` | 最小值 | `min(close, vwap)` |
| add | `add(x, y, filter=false)` | 逐元素加法，filter=true时NaN视为0 | `add(rank(close), rank(volume), filter=true)` |
| subtract | `subtract(x, y, filter=false)` | 逐元素减法，filter=true时NaN视为0 | `subtract(a, b, filter=true)` |
| multiply | `multiply(x, y, filter=false)` | 逐元素乘法，filter=true时NaN视为1 | `multiply(rank(-returns), rank(volume/adv20), filter=true)` |
| divide | `divide(x, y)` 或 `x / y` | 除法 | `close / open` |
| inverse | `inverse(x)` 或 `1/x` | 倒数 | `inverse(cap)` |
| reverse | `reverse(x)` 或 `-x` | 取反 | `reverse(returns)` |
| densify | `densify(x)` | 压缩分组分桶数，group算子前用可提升性能 | `densify(bucket(rank(cap), range="0,1,0.2"))` |

**filter参数技巧**：

`add(x, y, filter=true)` / `multiply(x, y, filter=true)`：
- 当filter=true时，add将NaN视为0，multiply将NaN视为1
- 用途：保留NaN标记的同时提高覆盖率，无需回填数据
- 示例：`add(rank(close), rank(volume), filter=true)` — 任一字段有NaN时仍可计算

---

## 六、向量运算符

| 运算符 | 语法 | 说明 | 典型用法 |
|--------|------|------|----------|
| vec_avg | `vec_avg(x)` | 向量字段取均值，压缩为标量 | `vec_avg(scl12_alltype_buzzvec)` — 情绪均值 |
| vec_sum | `vec_sum(x)` | 向量字段取总和，压缩为标量 | `vec_sum(scl12_alltype_buzzvec)` — 热度总和 |

**硬规则**：向量字段（一只股票一天有多个值）必须先用vec_avg或vec_sum压缩为标量，否则回测报错。

---

## 七、变换运算符

| 运算符 | 语法 | 说明 | 典型用法 |
|--------|------|------|----------|
| bucket | `bucket(rank(x), range="start,end,step")` 或 `bucket(rank(x), buckets="n1,n2,...")` | 基于排名值创建自定义分桶，配合group算子使用 | `bucket(rank(assets), range="0,1,0.1")` — 10等分资产组 |
| trade_when | `trade_when(x, y, z)` | 条件交易：x为真时Alpha=y，否则保持上一值，z为真时Alpha=NaN | `trade_when(volume>=ts_mean(volume,5), rank(-returns), -1)` — 量增时交易 |

**bucket参数说明**：
- `range="start,end,step"` — 等宽分桶，如 `range="0,1,0.1"` 分10桶
- `buckets="n1,n2,...,nN"` — 自定义边界，如 `buckets="0.2,0.5,0.7"` 分4桶
- `skipBoth=True` — 移除两端无穷分桶
- `NaNGroup=True` — 将NaN放入独立分桶

**trade_when逻辑**：

| 条件 | 结果 |
|------|------|
| z(退出)为真 | Alpha=NaN（关闭头寸） |
| z为假，x(触发)为真 | Alpha=y（更新值） |
| z和x都为假 | Alpha保持上一值（持有） |
