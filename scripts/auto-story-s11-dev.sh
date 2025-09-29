#!/usr/bin/env bash
# Story S11 自动化开发脚本
# 遵循三大铁律：拉分支/本地验证/CI变绿

set -euo pipefail

echo "🚀 开始 Story S11 自动化开发流程"
echo "📋 遵循三大铁律：拉分支 ✅ / 本地验证 ⏳ / CI变绿 ⏳"

# 1. 验证分支状态
echo "🔍 验证分支状态..."
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "feature/story-s11-qa-message-enhancement" ]]; then
    echo "❌ 错误：当前不在正确的开发分支"
    exit 1
fi
echo "✅ 分支状态正确: $CURRENT_BRANCH"

# 2. 确保工作区干净
echo "🧹 检查工作区状态..."
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "❌ 工作区不干净，请先提交或暂存更改"
    exit 1
fi
echo "✅ 工作区干净"

# 3. 拉取最新代码
echo "📥 拉取最新代码..."
git fetch origin
git rebase origin/main

# 4. 本地验证 - 构建测试
echo "🔨 执行本地验证..."
echo "  - 运行 lint 检查..."
npm run lint

echo "  - 运行单元测试..."
npm test

echo "  - 运行构建测试..."
npm run build

echo "✅ 本地验证通过"

# 5. 创建开发任务清单
echo "📝 创建开发任务清单..."
cat > STORY_S11_TASKS.md << 'EOF'
# Story S11 开发任务清单

## 🎯 开发目标
实现 QA 扩展消息增强功能，为 MCP 自动化提供可编排的 QA 指令。

## 📋 开发任务

### Phase 1: Background 层 QA 消息处理
- [ ] 实现 QA_APPLY_TERM 消息处理逻辑
- [ ] 实现 QA_REMOVE_TERM 消息处理逻辑  
- [ ] 实现 QA_QUERY_TERM 消息处理逻辑
- [ ] 实现 QA_RESET_WORKER 消息处理逻辑
- [ ] 添加 tabId 解析与错误处理
- [ ] 添加 QA build 条件控制 (MT_QA_HOOKS)

### Phase 2: 内容脚本 QA Bridge
- [ ] 更新 qa-bridge.js 暴露 window.__miniTranslateQA API
- [ ] 实现 applyTerm/removeTerm/queryTerm/resetWorker 方法
- [ ] 添加 tabId 自动获取机制
- [ ] 实现消息传递错误处理

### Phase 3: MCP 批处理集成
- [ ] 更新 smoke.template.json 添加 QA 消息步骤
- [ ] 更新 storage.template.json 添加 Service Worker 重启验证
- [ ] 更新 MCP 工具函数支持新消息类型
- [ ] 添加 Example Domain 翻译断言

### Phase 4: 测试覆盖
- [ ] 单元测试：QA handler 分支覆盖
- [ ] 集成测试：API 暴露与消息传递
- [ ] E2E 测试：MCP 自动化完整流程
- [ ] 文档更新：测试计划与 QA Results

## 🧪 测试验证
- [ ] 运行 npm run validate
- [ ] 执行 MCP 自动化测试
- [ ] 验证 QA Hook 仅在 QA build 中注册
- [ ] 确认所有验收标准达成

## 📚 文档更新
- [ ] 更新 Story S11 QA Results
- [ ] 更新 release-checklist.md
- [ ] 更新 MCP 测试计划
- [ ] 记录执行证据和截图
EOF

echo "✅ 开发任务清单已创建"

# 6. 设置开发环境
echo "⚙️ 设置开发环境..."
echo "  - 设置 QA build 环境变量..."
export MT_QA_HOOKS=1

echo "  - 创建测试数据目录..."
mkdir -p test-artifacts/story-s11

echo "✅ 开发环境设置完成"

# 7. 启动开发模式
echo "🎯 启动 Story S11 开发模式..."
echo ""
echo "📋 开发指令："
echo "1. 按照 STORY_S11_TASKS.md 执行开发任务"
echo "2. 每完成一个任务，运行: npm run validate"
echo "3. 提交代码: git add . && git commit -m 'feat: [具体功能描述]'"
echo "4. 完成所有任务后运行: ./scripts/auto-story-s11-qa.sh"
echo ""
echo "🔧 开发环境变量:"
echo "  - MT_QA_HOOKS=1 (已设置)"
echo "  - 分支: $CURRENT_BRANCH"
echo ""
echo "✅ Story S11 开发环境准备完成！"
