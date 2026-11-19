# 港深生活指南 · HKSZ Life Guide

在线访问：**https://hksz-life.github.io/**

一个地图主导的港深双城漫游与生活探索静态网页（支持香港 / 深圳一键切换，适配桌面端与手机端浏览器）。基于 React + TypeScript + Vite + MapLibre GL JS + OpenFreeMap 构建，纯前端静态部署，无需后端或 API key。

## 核心功能

- **双城矢量地图**：顶部一键切换「香港 / 深圳」，支持全局搜索、全域回中、浅色/深色底图切换。
- **三组图层细分开关**：右上角「线路」「地铁」「地点」均支持一键开关与下拉多选：
  - **线路**：6 类主题步行路线（109 个片区、501 个地点、110 条路线，含路网步行几何与港岛巴士/离岛渡轮接驳）。
  - **地铁**：覆盖港铁 10 条线路（98 站）与深圳地铁 17 条线路（351 站），支持按单线或多线过滤轨线与站点，点击站点可查看周边路线与去处。
  - **地点**：457 个精选去处（香港 185 + 深圳 272，含吃喝探店、咖啡甜品、艺术看展、户外自然、机位拍照、酒吧饮品、校园设施等）。
- **收藏与足迹**：支持本地 `localStorage` 收藏路线/地点/去处及标记已走过路线，点击顶栏心形按钮即可统一查看。

## 本地开发与校验

需要 Node.js 22.18+。

```sh
npm ci
npm run dev -- --port 5178
```

打开 `http://127.0.0.1:5178` 即可预览。

```sh
npm run check:data       # 校验路线、地点、去处与照片数据完整性
npm run check:recommend  # 校验推荐与排序逻辑
npm run build            # TypeScript 类型检查 + Vite 打包至 dist/
```

## 目录结构

- `src/`：前端交互、MapLibre 图层与样式
- `public/data/`：线上加载的静态 GeoJSON / JSON 数据
- `scripts/`：数据采集、路线生成与完整性校验脚本
- `data/`：本地参考与编辑底稿数据（`data/raw/expansion-sources/` 已忽略不入库）
- `docs/`：项目说明与数据源核验文档
- `.github/workflows/deploy.yml`：推送至 `main` 后自动构建并发布到 GitHub Pages
