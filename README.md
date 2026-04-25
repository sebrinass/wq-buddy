# WQBuddy <img src="icon.png" width="40" />

> 你的 WorldQuant BRAIN Alpha 挖掘伙伴（新手版）

WQBuddy 让 AI 成为你挖 Alpha 的搭档——不只是执行回测，而是陪你从模糊想法出发，探索数据、构建表达式、分析结果、优化迭代，直到提交一个经得起检验的 Alpha。不会用代码没关系，记不住运算符也没关系。只需要把skill丢给你的AI伙伴，让他陪你一起成为顾问！

## 它能做什么

- 🔍 **字段勘探** — 6种标准测试摸清数据底细
- 📊 **批量回测** — 模板+字段自动展开，并发执行
- 📈 **统计分析** — Sharpe/Turnover等5指标分布一目了然
- 🎯 **提交管理** — 4状态流转，闭环追踪
- 🧠 WQBuddy**协作** — Skill引导思考，不只是帮你做，还教你挖

## 快速开始

```bash
# 方式一：npm安装（推荐）
npm install wq-buddy

# 方式二：从源码
git clone https://github.com/sebrinass/wq-buddy.git
cd wq-buddy
npm install && npm run build
cp config.example.json config.json   # 填入BRAIN账号密码
npm run dev                          # 交互模式
```

前提：Node.js >= 18

## WQBuddy协作

安装 Skill 后，WQBuddy 可以：

- 引导你从想法到可提交 Alpha
- 推荐策略模式和算子组合
- 诊断回测结果并建议优化方向
- 帮你提炼论文思路转化为可测试的表达式
- 随使用积累经验，越来越懂你的数据偏好

详见 [SKILL.md](skill/SKILL.md)

## 命令速查

| 命令                        | 说明    |
| ------------------------- | ----- |
| `npm run dev`             | 交互模式  |
| `npm run docs`            | 运算符参考 |
| `npm run build`           | 编译    |
| `npm run search -- -k 盈利` | 搜索字段  |

## 文档

深度文档在 references/ 目录：

- [运算符速查](references/operators-reference.md) — 7大类算子语法+用法
- [策略模式库](references/strategy-patterns.md) — 8大策略+变异方向
- [数据策略](references/data-type-strategy.md) — 数据类型+回测参数
- [优化诊断](references/optimization-guide.md) — 症状速查+断舍离
- [更多...](references/README.md)

## 许可

MIT
