# AGENTS.md — 网搜开发说明

## 项目目标

网搜是一个中文动漫资源导航，只收录官方、正版或明确授权的入口，并优先标注可免费观看的来源。禁止加入盗版播放、下载、网盘搬运、付费绕过或来源解析功能。

## 技术结构

- React 19 + TypeScript + Vite 8 + Tailwind CSS 4
- 单页静态站点，无后端、账号、数据库或远程 API
- `src/App.tsx` 包含目录数据、搜索、分类和页面结构
- `src/styles/globals.css` 包含完整视觉系统与响应式规则
- `public/hero-anime-night.png` 为原创主视觉
- `dist/` 为构建输出

## 开发规则

- 正文使用中文，来源名称保留官方写法。
- 新增来源前核验官方身份、免费方式和常见地区限制。
- 保持搜索、分类、键盘操作、移动端和减少动态效果支持。
- 修改页面后必须执行 `pnpm build`，并在真实浏览器中验证搜索、分类、桌面端和移动端。
- 发布前保留 Apache-2.0 `LICENSE` 与 `NOTICE` 中的 Aeri 署名。

## 发布

站点由 `.openai/hosting.json` 标识并通过 Sites 发布。GitHub 仓库为 `yue0110-max/网搜`，用户已明确要求公开创建与推送。
