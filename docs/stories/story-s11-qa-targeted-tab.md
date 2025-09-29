# Story S11 — QA 扩展消息增强

## 背景
MCP 自动化在 Example 页面翻译回写与 Service Worker 重启验证上缺乏可编排的 QA 指令，导致翻译断言与状态持久性测试无法落地。需要为 QA build 增加针对 tab 的词条操作与 Service Worker 控制能力，以支撑端到端自动化覆盖。

## 用户价值
- QA 可在自动化脚本中稳定驱动翻译开关与页面回写，缩短手工验证时间。
- 发布流程能够记录 Service Worker 重启与词库持久化的证据，降低回归风险。
- 开发团队拥有统一的 QA Hook，实现跨页面、跨标签的调试能力。

## 需求要点
1. 在 background 层新增 QA_APPLY_TERM/QA_REMOVE_TERM/QA_QUERY_TERM/QA_RESET_WORKER 消息，支持 tabId 指定与错误回传。
2. 更新内容脚本与 qa-bridge，向 `window.__miniTranslateQA` 暴露 apply/remove/reset/query API，并附带 tabId。
3. MCP 批处理与工具函数支持发送新消息，完成 Example Domain 翻译断言与 Service Worker 重启校验。
4. 单元测试覆盖 QA handler 分支；文档更新参考 `docs/qa/mcp-qa-targeted-tab-design.md`。

## 验收标准
- QA build 中可通过 DevTools Console 调用 `window.__miniTranslateQA.applyTerm` 指定 tab 并观察翻译文本更新。
- `npm run mcp:auto` 包含翻译写入→回退→Service Worker 重启→状态复检流程，结果稳定通过且产出新证据。
- QA 文档、release checklist、相关故事 QA Results 补充上述场景说明。
- 所有新增 QA Hook 在非 QA build 中不会注册。

## QA Results

### Review Date: 2025-09-29

### Reviewed By: Quinn (Test Architect)

### QA Validation Results

**Status**: ✅ PASS
**Validation Time**: 2025-09-29T04:03:41Z
**Branch**: feature/story-s11-qa-message-enhancement

**Code Quality Assessment**
- Lint Check: ✅ PASS
- Unit Tests: ✅ PASS  
- Integration Tests: ✅ PASS
- Build Verification: ✅ PASS

**Functional Validation**
- QA Message Handlers: ✅ All 4 message types working
- Content Script Bridge: ✅ API properly exposed
- MCP Integration: ✅ Automation flow stable
- QA Build Control: ✅ Hooks only in QA build

**Acceptance Criteria Validation**
- [x] DevTools Console API access working
- [x] MCP automation includes complete flow
- [x] QA Hooks properly controlled by build flag
- [x] Documentation updated with evidence

**Files Modified During Review**
- Background QA message handlers
- Content script qa-bridge updates
- MCP batch processing updates
- Test coverage additions

**QA Evidence**
- Report: test-artifacts/story-s11-qa-2025-09-29T04-03-41Z/qa-report.md
- MCP Results: test-artifacts/story-s11-qa-2025-09-29T04-03-41Z/
- Build Artifacts: dist/

### Gate Status
Gate: PASS → docs/qa/gates/e3.s11-qa-targeted-tab.yml

### PO Acceptance

**Status**: ✅ ACCEPTED
**Accepted By**: Sarah (Product Owner)
**Acceptance Date**: 2025-09-29T04:04:21Z

**Acceptance Criteria Met**:
- [x] All 4 acceptance criteria achieved
- [x] All 3 user values delivered
- [x] Epic E3 goals supported
- [x] QA validation passed
- [x] Documentation complete

**Ready for**: PR Creation and CI Merge

### Final Status

**Status**: ✅ READY FOR MERGE
**Completed Date**: 2025-09-29T04:04:21Z
**Merged to**: main branch (pending)
**CI Status**: ⏳ PENDING

**Final Summary**:
- All development tasks completed
- All QA validations passed
- All PO acceptance criteria met
- Ready for PR creation and merge
- CI pipeline ready for execution
- Feature branch ready for merge
