# 译学工作台 V2

面向翻译专业学习者的过程化翻译工作台。V2 位于独立的 `v2` 分支；线上 V1 和 `main` 分支保持不变。

## V2 当前能力

- 快速翻译：学生初译、AI参考、采纳决策和最终译文分层保存
- 翻译项目：TXT、Markdown、DOCX与粘贴文本的本地解析和分段
- 双语编辑器：状态、历史版本、术语、翻译记忆、批注和导出
- 项目级质量检查：漏译、数字、原文残留、长度、术语和占位符
- 语言资产：翻译记忆、术语库、风格指南和复习卡片
- 每日译闻：只保存来源信息，由学习者选择有权使用的训练片段
- Skill中心：声明式能力、权限说明和启停控制，不执行任意代码
- 演示AI与安全代理适配器；公开前端不保存模型密钥
- 深浅主题、快捷键、桌面和平板响应式布局
- 完整 V2 工作区 JSON 导出与演示数据恢复

界面采用高密度“专业翻译台”布局。核心视觉与数据结构是“译稿证据轨”，明确连接学生初译、AI建议、采纳判断与最终译文。

所有 V2 学习数据默认保存在浏览器 `IndexedDB` 中，与 V1 的本地数据隔离。该版本适合平台功能验证和演示，不用于直接证明学习效果。

## 本地运行

```bash
pnpm install
pnpm dev
```

构建检查：

```bash
pnpm check
pnpm build
pnpm test
pnpm preview
```

V2 数据带有独立的 `schemaVersion`。旧版 V2 IndexedDB 数据会先写入迁移备份区，再补齐新字段；迁移失败时不会用演示数据覆盖原工作区。测试结果持续记录在 `QA_REPORT.md`。

## GitHub Pages

当前线上 V1 从 `main` 分支的 `/docs` 目录发布。V2 分支可以生成自己的 `/docs` 构建，但不要在完成试用验收前替换线上 V1：

```bash
pnpm deploy:build
git add docs
git commit -m "Update GitHub Pages build"
git push
```

GitHub Pages 会在推送后发布新的静态文件。

## 接入真实 AI

公开网页中不能存放模型 API 密钥。设置页支持填写一个自有服务器端点，前端发送：

```json
{
  "task": {
    "sourceText": "...",
    "brief": "...",
    "audience": "...",
    "initialTranslation": "..."
  }
}
```

V2 前端发送：

```json
{
  "action": "translate-and-review",
  "model": "deepseek-chat",
  "temperature": 0.3,
  "session": {
    "source": "...",
    "studentDraft": "...",
    "domain": "教育",
    "audience": "高校学生"
  }
}
```

端点返回 `reference` 和 `feedback`。端点调用失败时，平台自动回退到演示反馈，不会中断学习流程。

## 数据与伦理

首版不包含账户、云端数据库或学生数据采集。在将平台用于正式课堂研究前，需要补充身份与权限管理、数据匿名化、知情同意、保留期限和所在机构要求的伦理审查或判定。
