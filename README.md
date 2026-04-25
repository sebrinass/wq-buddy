# WQBuddy <img src="icon.png" width="40" />

> 你的 WorldQuant BRAIN Alpha 挖掘伙伴

WQBuddy 让 AI 成为你挖 Alpha 的搭档——不只是执行回测，而是陪你从模糊想法出发，探索数据、构建表达式、分析结果、优化迭代，直到提交一个经得起检验的 Alpha。

## 它能做什么

- 🔍 **字段搜索** — 关键词搜索 BRAIN 平台数据字段
- 🔬 **字段分析** — 6 种标准测试摸清数据底细
- 📊 **回测验证** — 单条/批量回测，支持 1-3 并发
- 📈 **统计分析** — Sharpe/Turnover 等指标分布一目了然
- 📤 **导出数据** — Alpha 和字段分析结果导出 CSV
- 🎯 **提交管理** — 4 状态流转，闭环追踪
- 🧠 **AI 协作** — Skill 引导思考，不只是帮你做，还教你挖

## 快速开始

### 方式一：OpenClaw 插件（推荐）

```bash
npm install -g wq-buddy
```

创建 `~/.wq-buddy/config.json`：

```json
{
  "credentials": {
    "username": "你的BRAIN账号",
    "password": "你的BRAIN密码"
  },
  "default_settings": {
    "neutralization": "INDUSTRY",
    "delay": 1,
    "decay": 0,
    "universe": "TOP3000",
    "region": "USA"
  }
}
```

在 `~/.openclaw/openclaw.json` 的 `plugins.load.paths` 中添加插件路径，重启 Gateway。

### 方式二：CLI 工具

```bash
npm install -g wq-buddy
wq backtest "rank(close)"                    # 单条回测
wq backtest "expr1" "expr2" "expr3" --concurrency 3  # 批量并发
wq search "operating cash flow"              # 搜索字段
wq analyze fnd2_ebitdm                       # 字段分析
wq stats                                     # 查看统计
wq export                                    # 导出 CSV
wq docs                                      # 运算符文档
```

### 方式三：从源码

```bash
git clone https://github.com/sebrinass/wq-buddy.git
cd wq-buddy
npm install && npm run build
cp config.example.json ~/.wq-buddy/config.json
```

前提：Node.js >= 18

## AI 协作

安装 Skill 后，AI 可以：

- 引导你从想法到可提交 Alpha
- 推荐策略模式和算子组合
- 诊断回测结果并建议优化方向
- 帮你提炼论文思路转化为可测试的表达式
- 随使用积累经验，越来越懂你的数据偏好

详见 [skill/SKILL.md](skill/SKILL.md)

## CLI 命令速查

| 命令 | 说明 |
|------|------|
| `wq backtest "expr"` | 单条回测 |
| `wq backtest "e1" "e2" "e3" -c 3` | 批量回测，3 并发 |
| `wq backtest --file ./exprs.txt` | 从文件批量回测 |
| `wq search "关键词"` | 搜索字段 |
| `wq search --dataset pv13` | 浏览数据集 |
| `wq analyze 字段名` | 字段分析 |
| `wq stats` | 查看统计 |
| `wq export` | 导出 Alpha CSV |
| `wq export field` | 导出字段分析 CSV |
| `wq docs` | 运算符文档 |

## 文档

深度文档在 references/ 目录：

- [运算符速查](references/operators-reference.md) — 6 大类算子语法+用法
- [策略模式库](references/strategy-patterns.md) — 策略分析框架模板
- [数据策略](references/data-type-strategy.md) — 数据类型+回测参数
- [优化诊断](references/optimization-guide.md) — 症状速查+优化路径
- [提交流程](references/submission-workflow.md) — 状态流转+闭环管理
- [工具参考](references/tool-reference.md) — 注册工具+CLI 双模式说明
- [更多...](references/README.md)

## 许可

MIT
