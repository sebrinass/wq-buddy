/**
 * WorldQuant BRAIN 运算符快速参考
 * 供 Agent/AI 阅读，快速了解平台运算符用法
 */

export const OPERATORS_REFERENCE = `# WorldQuant BRAIN 运算符快速参考

## 一、时间序列运算符（ts_*）
| 运算符 | 用法 | 说明 |
|--------|------|------|
| ts_rank(x, d) | ts_rank(close, 20) | 过去d天窗口内x的排名 |
| ts_mean(x, d) | ts_mean(volume, 5) | 过去d天移动平均 |
| ts_delta(x, d) | ts_delta(close, 1) | 过去d天的差分 |
| ts_sum(x, d) | ts_sum(returns, 10) | 过去d天累计求和 |
| ts_std_dev(x, d) | ts_std_dev(close, 20) | 过去d天标准差 |
| ts_corr(x, y, d) | ts_corr(close, volume, 20) | 过去d天与y的相关性 |
| ts_rank(x, d) | ts_rank(volume, 10) | 窗口内x的排名 |
| ts_delay(x, d) | ts_delay(close, 1) | 延迟d天的值 |
| ts_zscore(x, d) | ts_zscore(returns, 20) | 窗口内Z分数 |
| ts_decay_linear(x, d) | ts_decay_linear(returns, 5) | 线性衰减，越近权重越大 |

## 二、截面运算符（rank/scale/zscore）
| 运算符 | 用法 | 说明 |
|--------|------|------|
| rank(x) | rank(close) | 截面排名，最低=0，最高=1 |
| scale(x, s) | scale(x, 4) | 缩放使绝对值之和=s |
| zscore(x) | zscore(returns) | 截面Z分数 |
| quantile(x, d, dist) | quantile(x, driver=cauchy) | 分位数映射到分布 |
| normalize(x, u, l) | normalize(x, 0.1, 0.9) | 中心化到[u,l]范围 |
| winsorize(x, std) | winsorize(x, 4) | 超出均值±std倍标准差的值 |

## 三、分组运算符（group_*）
| 运算符 | 用法 | 说明 |
|--------|------|------|
| group_rank(x, g) | group_rank(ebit, industry) | 组内排名0-1 |
| group_neutralize(x, g) | group_neutralize(alpha, sector) | 组内中性化(减均值) |
| group_zscore(x, g) | group_zscore(pe, industry) | 组内Z分数 |
| group_mean(x, w, g) | group_mean(pe, 1, industry) | 组内调和均值 |
| group_scale(x, g) | group_scale(revenue, sector) | 组内缩放到0-1 |
| group_backfill(x, g, d) | group_backfill(ebit, sector, 21) | 组内NaN回填 |

## 四、逻辑运算符
| 运算符 | 用法 | 说明 |
|--------|------|------|
| if_else(c, a, b) | if_else(returns>0, 1, -1) | 条件选择 |
| and(a, b) | and(cond1, cond2) | 逻辑与 |
| or(a, b) | or(cond1, cond2) | 逻辑或 |
| not(x) | not(is_nan(x)) | 逻辑非 |
| is_nan(x) | is_nan(ebit) | 是否为NaN |

## 五、算术运算符
| 运算符 | 用法 | 说明 |
|--------|------|------|
| abs(x) | abs(returns) | 绝对值 |
| log(x) | log(sales) | 自然对数 |
| sign(x) | sign(delta) | 符号函数 |
| sqrt(x) | sqrt(volume) | 平方根 |
| power(x, y) | power(x, 2) | 幂运算 |
| max(x, y) | max(a, b) | 最大值 |
| min(x, y) | min(a, b) | 最小值 |

## 六、常用数据字段前缀
| 前缀 | 含义 | 示例 |
|------|------|------|
| fnd* | 财务数据 | fnd6_fopo(营业利润), fnd2_ebitdm(EBIT市值比) |
| fn_* | 通用财务 | fn_assets(资产), fn_revenue(收入) |
| close | 收盘价 | close |
| open/high/low | OHLC | open, high, low |
| volume | 成交量 | volume |
| returns | 收益率 | returns |
| industry/sector | 行业分类 | industry, subindustry |
| country/region | 国家/地区 | country, region |
| cap | 市值 | cap |

## 七、常用表达式模板
\`\`\`
# 简单动量
rank(returns)

# 均值回归
-rank(ts_mean(close, 20) - close)

# 行业相对强弱
group_rank(ebit, industry)

# 复合信号
rank(ts_rank(volume, 10) * ts_rank(returns, 20))

# 条件信号
if_else(volume > ts_mean(volume, 5), rank(returns), 0)

# 风险中性
group_neutralize(rank(returns), industry)
\`\`\`

## 八、常见错误
- staff_costs: 平台无此字段，应用 fnd2_a_dbplctrbyemp 等
- 变量名拼写错误：仔细核对平台字段名
- NaN处理：if_else(is_nan(x), 替代值, x)
`;

export default OPERATORS_REFERENCE;
