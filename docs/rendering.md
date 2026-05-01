# 图片渲染（satori + resvg-wasm）

## 选型

296×152 单色卡片（最终经设备 dither 成黑白）不需要真浏览器：

- **satori** 把对象树转 SVG（flex 子集、纯黑白文字）
- **@resvg/resvg-wasm** 把 SVG 渲染成 PNG（纯 wasm，无 native binding）

整条链路常驻内存只占几 MB，单次渲染几十 ms。

## 渲染管线

```
UsageData
   │
   ▼  buildTree(data)  —— 普通 JS 对象树（非 JSX，不依赖 React）
{ type, props: { style, children } }
   │
   ▼  satori(tree, { width:296, height:152, fonts })
SVG 字符串
   │
   ▼  new Resvg(svg, { background:'white', fitTo:{ mode:'width', value:296 } })
   .render().asPng() → Uint8Array
```

## 关键约束

- **尺寸**：`CARD_WIDTH=296`、`CARD_HEIGHT=152`（在 `src/render.ts`）
- **字体**：必须**静态 TTF**（satori 不接受 variable font）。命名固定为
  `assets/fonts/Regular.ttf`（weight 400），全局统一字重
- **flex 布局**：所有有子节点的容器都要显式 `display: 'flex'`，satori 用
  yoga 子集，不会回退 block
- **纯黑白**：屏幕最终经 dither，灰度信息会丢失。当前模板靠字号 / 字距
  区分层级，不依赖颜色、opacity 或字重

## 当前模板

```
┌──────────────────────────────────────┐
│ TODAY · CLI USAGE       (10px, +1.2)  │
│                                      │
│ $50.28                  (38px, 700)  │
│ Claude $50.28 · Codex Plus  (11px)   │
│                                      │
│  CC TOK     CDX TOK      5H          │
│  13.0M       0           —    11:27  │
└──────────────────────────────────────┘
```

`UsageData` 字段：

```ts
interface UsageData {
  title: string;          // 顶部小字
  primary: string;        // 主数字（USD）
  secondary?: string;     // 副标题（分项）
  stats?: { label: string; value: string }[];  // 底部一排
  updatedAt?: string;     // 右下时间
}
```

## 调优点

- **Codex 用量百分比**用粗体可能更醒目；当前与 token 数同字号
- **多模型 / 多窗口**：可以把 stats 改成"今日 / 7 天"或"Sonnet / Opus"切换
  cards，配合 Dot API 的 `taskKey` 字段做多模板
- **Dither 算法**：默认 `FLOYD_STEINBERG`，对小字号偶有噪点；可换 `ATKINSON`
  对比效果

模板代码全部集中在 `src/render.ts` 的 `buildTree()`，改起来很短。
