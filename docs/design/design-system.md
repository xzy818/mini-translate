# Mini Translate 设计系统

## 📋 概述

Mini Translate 设计系统提供统一的设计语言和组件库，确保所有界面的一致性和可维护性。

## 🎨 设计原则

### 1. 一致性 (Consistency)
- 统一的颜色、字体、间距和组件样式
- 跨界面的一致体验
- 可预测的交互模式

### 2. 可访问性 (Accessibility)
- 符合 WCAG 2.1 AA 标准
- 良好的对比度和可读性
- 键盘导航支持

### 3. 响应式 (Responsive)
- 移动优先的设计方法
- 灵活的布局系统
- 适配不同屏幕尺寸

### 4. 可维护性 (Maintainability)
- CSS 变量驱动的主题系统
- 模块化的组件设计
- 清晰的命名规范

## 🎨 颜色系统

### 主色调
```css
--bg: #f5f7fb;           /* 背景色 */
--panel: #ffffff;        /* 面板色 */
--border: #e2e8f0;       /* 边框色 */
--text-main: #1f2937;    /* 主文本色 */
--text-secondary: #475569; /* 次要文本色 */
```

### 功能色
```css
--accent: #2563eb;       /* 主色调 */
--danger: #dc2626;       /* 危险色 */
--success: #16a34a;      /* 成功色 */
--warning: #f59e0b;      /* 警告色 */
```

### 使用指南
- **主色调**: 用于按钮、链接、强调元素
- **功能色**: 用于状态指示、警告、错误信息
- **中性色**: 用于文本、背景、边框

## 📏 间距系统

### 间距变量
```css
--spacing-xs: 4px;       /* 超小间距 */
--spacing-sm: 8px;       /* 小间距 */
--spacing-md: 12px;      /* 中等间距 */
--spacing-lg: 16px;      /* 大间距 */
--spacing-xl: 20px;      /* 超大间距 */
--spacing-2xl: 24px;     /* 2倍大间距 */
--spacing-3xl: 32px;     /* 3倍大间距 */
```

### 使用规则
- **组件内间距**: 使用 `--spacing-sm` 到 `--spacing-lg`
- **组件间间距**: 使用 `--spacing-xl` 到 `--spacing-2xl`
- **页面边距**: 使用 `--spacing-2xl` 到 `--spacing-3xl`

## 🔄 圆角系统

### 圆角变量
```css
--radius-sm: 6px;        /* 小圆角 */
--radius-md: 10px;       /* 中等圆角 */
--radius-lg: 12px;       /* 大圆角 */
--radius-xl: 18px;       /* 超大圆角 */
--radius-full: 999px;    /* 完全圆角 */
```

### 使用场景
- **按钮**: `--radius-full` (完全圆角)
- **输入框**: `--radius-md` (中等圆角)
- **面板**: `--radius-xl` (大圆角)
- **徽章**: `--radius-full` (完全圆角)

## 🌟 阴影系统

### 阴影变量
```css
--shadow-sm: 0 2px 8px rgba(15, 23, 42, 0.08);   /* 小阴影 */
--shadow-md: 0 8px 24px rgba(15, 23, 42, 0.08);  /* 中等阴影 */
--shadow-lg: 0 12px 32px rgba(15, 23, 42, 0.08); /* 大阴影 */
```

### 使用场景
- **卡片**: `--shadow-lg` (大阴影)
- **按钮悬停**: `--shadow-md` (中等阴影)
- **输入框聚焦**: `--shadow-sm` (小阴影)

## 🔤 字体系统

### 字体族
```css
--font-family: "Segoe UI", system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
```

### 字体大小
```css
--font-size-xs: 12px;    /* 超小字体 */
--font-size-sm: 13px;    /* 小字体 */
--font-size-base: 14px;  /* 基础字体 */
--font-size-lg: 16px;    /* 大字体 */
--font-size-xl: 18px;    /* 超大字体 */
--font-size-2xl: 20px;   /* 2倍大字体 */
--font-size-3xl: 24px;   /* 3倍大字体 */
--font-size-4xl: 26px;   /* 4倍大字体 */
```

### 字重
```css
--font-weight-normal: 400;   /* 正常字重 */
--font-weight-medium: 500;  /* 中等字重 */
--font-weight-semibold: 600; /* 半粗字重 */
--font-weight-bold: 700;    /* 粗字重 */
```

## 🧩 组件系统

### 按钮组件

#### 基础按钮
```html
<button class="btn btn--primary">主要按钮</button>
<button class="btn btn--secondary">次要按钮</button>
<button class="btn btn--danger">危险按钮</button>
<button class="btn btn--success">成功按钮</button>
```

#### 按钮变体
- `btn--primary`: 主要操作按钮
- `btn--secondary`: 次要操作按钮
- `btn--danger`: 危险操作按钮
- `btn--success`: 成功操作按钮

### 表单组件

#### 输入框
```html
<div class="form-group">
    <label for="input">标签</label>
    <input type="text" id="input" placeholder="请输入内容">
</div>
```

#### 选择框
```html
<div class="form-group">
    <label for="select">选择</label>
    <select id="select">
        <option value="">请选择...</option>
    </select>
</div>
```

### 信息框组件

#### 状态信息框
```html
<div class="info-box info-box--info">信息提示</div>
<div class="info-box info-box--success">成功提示</div>
<div class="info-box info-box--warning">警告提示</div>
<div class="info-box info-box--error">错误提示</div>
```

### 面板组件

#### 基础面板
```html
<div class="panel">
    <h2>面板标题</h2>
    <p>面板内容</p>
</div>
```

#### 紧凑面板
```html
<div class="panel panel--compact">
    <h3>紧凑面板</h3>
    <p>紧凑内容</p>
</div>
```

## 📱 响应式设计

### 断点系统
```css
/* 移动设备 */
@media (max-width: 768px) {
    /* 移动端样式 */
}

/* 平板设备 */
@media (min-width: 769px) and (max-width: 1024px) {
    /* 平板端样式 */
}

/* 桌面设备 */
@media (min-width: 1025px) {
    /* 桌面端样式 */
}
```

### 响应式规则
- **移动优先**: 从移动端开始设计
- **渐进增强**: 逐步添加桌面端功能
- **灵活布局**: 使用 Flexbox 和 Grid

## 🛠️ 工具类

### 间距工具类
```css
.mt-0, .mt-sm, .mt-md, .mt-lg, .mt-xl    /* 上边距 */
.mb-0, .mb-sm, .mb-md, .mb-lg, .mb-xl    /* 下边距 */
```

### 布局工具类
```css
.flex, .flex-col                          /* Flexbox */
.items-center, .justify-center            /* 对齐 */
.gap-sm, .gap-md, .gap-lg                 /* 间距 */
```

### 显示工具类
```css
.hidden, .visible                         /* 显示/隐藏 */
.text-center, .text-left, .text-right     /* 文本对齐 */
```

## 📋 使用指南

### 1. 引入设计系统
```html
<link rel="stylesheet" href="design-system.css">
```

### 2. 使用组件类
```html
<div class="container">
    <div class="panel">
        <h1>标题</h1>
        <div class="form-group">
            <label>标签</label>
            <input type="text">
        </div>
        <div class="button-group">
            <button class="btn btn--primary">保存</button>
            <button class="btn btn--secondary">取消</button>
        </div>
    </div>
</div>
```

### 3. 自定义样式
```css
/* 使用设计系统变量 */
.custom-component {
    background: var(--panel);
    border-radius: var(--radius-lg);
    padding: var(--spacing-lg);
    box-shadow: var(--shadow-md);
}
```

## 🔄 更新日志

### v1.0.0 (2025-09-29)
- 初始设计系统发布
- 统一颜色、字体、间距系统
- 基础组件库
- 响应式设计支持

## 📚 参考资料

- [CSS 变量文档](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [响应式设计指南](https://web.dev/responsive-web-design-basics/)
- [可访问性指南](https://www.w3.org/WAI/WCAG21/quickref/)
