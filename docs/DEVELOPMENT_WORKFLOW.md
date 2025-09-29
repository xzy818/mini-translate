# 开发工作流程指南

## 🚨 重要规则

### 1. 禁止手动修改 dist 目录
- **绝对禁止**: 直接修改 `dist/` 目录中的任何文件
- **正确做法**: 修改 `src/` 或 `public/` 目录中的源文件，然后运行 `npm run build`
- **原因**: dist 目录是构建产物，会被构建脚本覆盖

### 2. 构建流程
```bash
# 标准构建流程
npm run build

# 构建保护检查
bash scripts/protect-build.sh

# 运行测试
npm run mcp:auto
```

### 3. 开发环境设置
```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建扩展
npm run build

# 运行测试
npm run test
npm run mcp:auto
```

## 🔧 技术架构说明

### 文件结构
```
mini-translate/
├── src/                    # 源代码
│   ├── services/          # 服务模块
│   └── ...
├── public/                # 公共资源
│   ├── background.js      # 后台脚本
│   ├── content.js         # 内容脚本
│   └── ...
├── dist/                  # 构建产物 (禁止手动修改)
└── tests/                 # 测试文件
```

### 关键文件说明
- `dist/background.js`: Service Worker，处理扩展后台逻辑
- `dist/content.js`: 内容脚本，注入到网页中
- `dist/qa-bridge.js`: QA API 桥接，提供测试接口
- `dist/services/`: 服务模块，包含业务逻辑

## 🧪 测试环境

### MCP 自动化测试
- 使用 `npm run mcp:auto` 运行完整测试套件
- 测试脚本位于 `tests/mcp/batches/`
- 测试结果保存在 `test-artifacts/`

### 测试 API 模拟
- 测试环境使用 `tests/mcp/qa-api-mock.js` 模拟扩展 API
- 解决测试环境隔离问题

## 🚀 部署流程

### 1. 开发阶段
```bash
# 修改源代码
vim src/services/translator.js

# 构建扩展
npm run build

# 运行测试
npm run mcp:auto
```

### 2. 发布阶段
```bash
# 构建生产版本
npm run build

# 创建发布包
npm run package

# 验证构建
bash scripts/protect-build.sh
```

## 🐛 故障排除

### 常见问题
1. **Import 路径错误**: 检查 `dist/background.js` 中的 import 路径
2. **QA API 不可用**: 检查 `dist/qa-bridge.js` 是否包含新方法
3. **测试失败**: 检查测试环境是否正确加载扩展

### 调试步骤
1. 检查构建日志
2. 验证文件结构
3. 运行保护检查
4. 查看测试日志

## 📋 检查清单

### 开发前
- [ ] 确认在正确的分支上
- [ ] 拉取最新代码
- [ ] 检查依赖是否完整

### 开发中
- [ ] 只修改 `src/` 或 `public/` 目录
- [ ] 定期运行 `npm run build`
- [ ] 运行测试验证功能

### 开发后
- [ ] 运行完整测试套件
- [ ] 检查构建产物
- [ ] 提交代码变更


