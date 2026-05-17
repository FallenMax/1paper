# Editor 页面重设计

分支: `editor-redesign`

## 设计目标

接住 in-tool 设计稿的"信息架构升级"，但保留 1paper 的 paper character。

- Sidebar 升级为 layout 一等公民（不再 absolute overlay）
- Breadcrumb 入主，顶部 toolbar 不再拥挤
- Editor 直接坐在 page bg 上，删掉 main 双层 ::before/::after 装饰
- 配色 / 字体跟 landing 完全对齐（landing 已对齐编辑器，再 audit 一遍闭环）
- Add / delete / move 用 inline UI 替代 `prompt()` / `confirm()`
- Mobile sidebar 改 drawer

## 关键决策 (已与用户对齐)

1. **去掉** sidebar header (`Notes in "_fallen"`)，只保留 note list
2. **保留 UI 入口** for theme / view mode / layout（不靠 keyboard shortcut，新用户找得到）
3. **note title 用 mono**，且不另设大字——breadcrumb 末段就是 title
4. **Inline UI**: 点击现场出现的小型 widget，跟页面其他部分风格契合

## 阶段拆解

### Phase 1: Layout 重构 (核心)

- `app.css`: `#app > main` 改成 row flex，sidebar 占 column（不再 absolute overlay）
- 删除 `main::before` / `main::after` 双层装饰
- Editor 不再是 card——直接在 page bg 上，去掉 border / 圆角
- 顶部 header 重新结构化：
  - 左: sidebar toggle (`SidebarToggle`)
  - 中: breadcrumb（新组件，可点击导航上级）
  - 右: settings cluster (ViewModePicker, ThemePicker, LayoutToggle)
- Sidebar 内容：去掉 h3，只列 note items；底部 add note inline

### Phase 2: Inline 交互

- Add note: 点 + 按钮 → sidebar 底部出现 inline input，type + enter 创建
- Delete: 点 ellipsis → 在 item 旁出现 inline confirmation panel
- Move: 同样 inline panel 输入新 path

### Phase 3: Mobile drawer

- Sidebar 改 drawer (slide from left + overlay backdrop)
- mobile-toolbar (indent/deindent/toggle-list) 保留但视觉跟 drawer 统一

### Phase 4: 配色和字体 audit

- 确认 light = landing light = `rgb(237, 238, 240)` + bg.png
- 确认 dark = landing dark = `rgb(34, 34, 34)`
- 字体: editor / breadcrumb / sidebar 全 mono
- ::selection 跟 landing 一致 (neutral ink tint)

## 实施顺序

先做 Phase 1 出 baseline，让用户视觉评估，再迭代 Phase 2-4。
