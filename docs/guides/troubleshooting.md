# 故障排除指南

## 🚨 紧急问题

### 1. 扩展无法加载
**症状**: Chrome 显示扩展加载错误
**原因**: 通常是由于手动修改 dist 文件导致
**解决方案**:
```bash
# 重新构建扩展
npm run build

# 检查构建保护
bash scripts/protect-build.sh

# 重新加载扩展
```

### 2. Service Worker 失效
**症状**: 后台功能不工作
**原因**: import 路径错误或模块缺失
**解决方案**:
```bash
# 检查 import 路径
grep -r "from.*src" dist/background.js

# 重新构建
npm run build

# 验证模块存在
ls -la dist/services/
```

### 3. QA API 不可用
**症状**: 测试失败，API 方法不存在
**原因**: qa-bridge.js 缺少新方法
**解决方案**:
```bash
# 检查 QA API 方法
grep -r "applyTerm" dist/qa-bridge.js

# 重新构建
npm run build

# 验证 API 可用性
```

## 🔧 常见问题

### 构建问题

#### 问题: 构建失败
```bash
# 检查依赖
npm install

# 清理缓存
npm run clean

# 重新构建
npm run build
```

#### 问题: 文件缺失
```bash
# 检查源文件
ls -la src/services/

# 重新复制
cp -r src/services dist/

# 验证文件
ls -la dist/services/
```

### 测试问题

#### 问题: Chrome 测试失败
```bash
# 检查测试环境
npm run test:chrome

# 查看测试日志
find test-artifacts -name "*.log" -exec tail -20 {} \;

# 清理测试环境
rm -rf test-artifacts/
```

#### 问题: API 模拟失败
```bash
# 检查模拟文件
ls -la tests/qa-api-mock.js

# 验证模拟加载
grep -r "qa-api-mock" tests/
```

### 开发问题

#### 问题: 手动修改 dist 文件
```bash
# 重置 dist 目录
git checkout HEAD -- dist/

# 重新构建
npm run build

# 检查保护机制
bash scripts/protect-build.sh
```

#### 问题: Git 提交被阻止
```bash
# 检查修改的文件
git status

# 重置 dist 修改
git reset HEAD dist/

# 重新构建并提交
npm run build
git add dist/
git commit
```

## 🧪 测试环境问题

### 问题: 扩展无法在测试中加载
**症状**: 测试显示 "Extension not loaded"
**解决方案**:
1. 检查扩展是否正确构建
2. 验证 manifest.json 配置
3. 检查 Chrome 调试模式

### 问题: API 调用失败
**症状**: 测试显示 "API not available"
**解决方案**:
1. 检查 qa-bridge.js 是否正确加载
2. 验证 API 模拟是否工作
3. 检查消息传递机制

### 问题: 测试超时
**症状**: 测试执行超时
**解决方案**:
1. 增加测试超时时间
2. 优化测试脚本
3. 检查网络连接

## 🔍 调试技巧

### 1. 使用 Chrome DevTools
```javascript
// 在 Console 中检查扩展状态
chrome.runtime.getManifest()

// 检查 Service Worker 状态
chrome.runtime.getBackgroundPage()

// 检查存储数据
chrome.storage.local.get(console.log)
```

### 2. 检查扩展日志
```bash
# 查看 Chrome 日志
tail -f /tmp/mini-translate-chrome.log

# 检查扩展错误
grep -i error /tmp/mini-translate-chrome.log
```

### 3. 验证文件完整性
```bash
# 检查关键文件
ls -la dist/background.js
ls -la dist/content.js
ls -la dist/qa-bridge.js

# 检查服务文件
ls -la dist/services/

# 验证 import 路径
grep -r "from.*services" dist/background.js
```

## 📋 检查清单

### 开发前检查
- [ ] 确认在正确的分支上
- [ ] 拉取最新代码
- [ ] 检查依赖是否完整
- [ ] 运行构建保护检查

### 开发中检查
- [ ] 只修改源文件 (src/ 或 public/)
- [ ] 定期运行构建
- [ ] 运行测试验证
- [ ] 检查 Git 状态

### 开发后检查
- [ ] 运行完整测试套件
- [ ] 检查构建产物
- [ ] 验证功能正常
- [ ] 提交代码变更

## 🆘 获取帮助

### 内部资源
- 技术文档: `docs/`
- 开发指南: `docs/DEVELOPMENT_WORKFLOW.md`
- 架构文档: `docs/TECHNICAL_ARCHITECTURE.md`

### 外部资源
- Chrome Extension 文档
- Chrome 测试框架文档
- JavaScript 调试指南

### 联系支持
- 技术问题: 查看项目 Issues
- 紧急问题: 联系开发团队
- 文档问题: 更新相关文档


