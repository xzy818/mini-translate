# Mini Translate 组件库

## 📋 概述

Mini Translate 组件库提供可复用的 UI 组件，基于统一设计系统构建。

## 🧩 组件列表

### 1. 按钮组件 (Button)

#### 基础用法
```html
<button class="btn btn--primary">主要按钮</button>
<button class="btn btn--secondary">次要按钮</button>
<button class="btn btn--danger">危险按钮</button>
<button class="btn btn--success">成功按钮</button>
```

#### 按钮组
```html
<div class="button-group">
    <button class="btn btn--primary">保存</button>
    <button class="btn btn--secondary">取消</button>
</div>
```

#### 属性说明
- `btn`: 基础按钮类
- `btn--primary`: 主要操作按钮
- `btn--secondary`: 次要操作按钮
- `btn--danger`: 危险操作按钮
- `btn--success`: 成功操作按钮

### 2. 表单组件 (Form)

#### 输入框
```html
<div class="form-group">
    <label for="username">用户名</label>
    <input type="text" id="username" placeholder="请输入用户名">
</div>
```

#### 选择框
```html
<div class="form-group">
    <label for="provider">服务商</label>
    <select id="provider">
        <option value="">请选择服务商</option>
        <option value="openai">OpenAI</option>
        <option value="deepseek">DeepSeek</option>
    </select>
</div>
```

#### 密码框
```html
<div class="form-group">
    <label for="password">密码</label>
    <input type="password" id="password" placeholder="请输入密码">
</div>
```

### 3. 信息框组件 (Alert)

#### 基础信息框
```html
<div class="info-box info-box--info">
    这是一条信息提示
</div>
```

#### 成功信息框
```html
<div class="info-box info-box--success">
    操作成功完成
</div>
```

#### 警告信息框
```html
<div class="info-box info-box--warning">
    请注意相关设置
</div>
```

#### 错误信息框
```html
<div class="info-box info-box--error">
    操作失败，请重试
</div>
```

### 4. 面板组件 (Panel)

#### 基础面板
```html
<div class="panel">
    <h2>面板标题</h2>
    <p>面板内容描述</p>
</div>
```

#### 紧凑面板
```html
<div class="panel panel--compact">
    <h3>紧凑面板</h3>
    <p>紧凑内容</p>
</div>
```

### 5. 状态徽章 (Badge)

#### 基础徽章
```html
<span class="status-badge">默认状态</span>
<span class="status-badge status-badge--active">激活状态</span>
<span class="status-badge status-badge--error">错误状态</span>
```

#### 带点的徽章
```html
<span class="status-badge">
    <span class="status-dot"></span>
    在线状态
</span>
```

### 6. 容器组件 (Container)

#### 标准容器
```html
<div class="container">
    <div class="panel">
        <!-- 内容 -->
    </div>
</div>
```

#### 窄容器
```html
<div class="container container--narrow">
    <div class="panel">
        <!-- 内容 -->
    </div>
</div>
```

## 🎨 样式定制

### 使用 CSS 变量
```css
.custom-button {
    background: var(--accent);
    color: var(--panel);
    border-radius: var(--radius-full);
    padding: var(--spacing-md) var(--spacing-xl);
}
```

### 覆盖组件样式
```css
/* 自定义按钮样式 */
.btn--custom {
    background: linear-gradient(45deg, var(--accent), var(--success));
    border: none;
    box-shadow: var(--shadow-lg);
}
```

## 📱 响应式组件

### 响应式按钮组
```html
<div class="button-group">
    <button class="btn btn--primary">主要操作</button>
    <button class="btn btn--secondary">次要操作</button>
</div>
```

### 响应式表单
```html
<div class="form-group">
    <label for="input">标签</label>
    <input type="text" id="input" class="responsive-input">
</div>
```

## 🔧 工具类

### 间距工具类
```html
<div class="mt-lg mb-xl">上下边距</div>
<div class="gap-md">内部间距</div>
```

### 布局工具类
```html
<div class="flex items-center justify-between">
    <span>左侧内容</span>
    <span>右侧内容</span>
</div>
```

### 显示工具类
```html
<div class="hidden">隐藏元素</div>
<div class="visible">显示元素</div>
```

## 🎯 最佳实践

### 1. 组件组合
```html
<div class="container">
    <div class="panel">
        <h2>设置面板</h2>
        <div class="form-group">
            <label for="setting">设置项</label>
            <input type="text" id="setting">
        </div>
        <div class="button-group">
            <button class="btn btn--primary">保存</button>
            <button class="btn btn--secondary">重置</button>
        </div>
    </div>
</div>
```

### 2. 状态管理
```html
<!-- 加载状态 -->
<button class="btn btn--primary" disabled>
    <span class="loading">加载中...</span>
</button>

<!-- 错误状态 -->
<div class="info-box info-box--error">
    操作失败，请重试
</div>
```

### 3. 可访问性
```html
<!-- 正确的标签关联 -->
<label for="input-id">标签文本</label>
<input type="text" id="input-id" aria-describedby="help-text">
<div id="help-text" class="info-box info-box--info">
    帮助文本
</div>
```

## 📋 组件检查清单

### 开发前检查
- [ ] 是否使用了设计系统变量
- [ ] 是否遵循了命名规范
- [ ] 是否考虑了响应式设计
- [ ] 是否包含了可访问性属性

### 开发后检查
- [ ] 是否在不同浏览器中测试
- [ ] 是否在不同屏幕尺寸中测试
- [ ] 是否测试了键盘导航
- [ ] 是否测试了屏幕阅读器

## 🔄 更新日志

### v1.0.0 (2025-09-29)
- 初始组件库发布
- 基础组件实现
- 响应式设计支持
- 可访问性优化
