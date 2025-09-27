# Story S3 — 翻译服务抽象

## 背景
插件需支持多个高质量模型，统一翻译接口以便管理和扩展。

## 用户价值
- 用户可根据成本与效果选择不同模型。
- 插件获得可扩展的翻译能力和错误处理机制。

## 需求要点
1. 支持模型：DeepSeek V3、Qwen MT Turbo、Qwen MT Plus、gpt-4o-mini。
2. 设置页面保存 `apiBaseUrl`、`apiKey`、`model`。
3. 提供统一函数 `translateText`，根据模型分派请求。
4. 实现基础错误处理、超时控制，可选重试逻辑。
5. 与词库/右键流程对接，返回译文或错误状态。

## 验收标准
- 四种模型均可配置并完成翻译请求。
- 错误时在 UI/通知中提示原因。
- API Key 未配置或失效时能阻止调用并提示。
- QA 覆盖正常调用、错误、超时与重复请求场景。

## QA Results
- Gate: PASS — 统一翻译服务与错误处理已通过单测与代码审查。
- Tests: `npm run validate`
- MCP: 2025-09-27 — options 流程通过 stub 模型验证保存/测试，参考 `test-artifacts/mcp/2025-09-27T10-24-40-280Z/smoke/smoke.json.log` 与 `.../storage/options/storage-after-save.json`。

### Review Date: 2025-09-18

### Reviewed By: Quinn (Test Architect)

### Code Quality Assessment

实现 `src/services/translator.js` 提供统一入口与标准化错误，结构清晰、可测试性好；单测覆盖成功/错误/超时/重试路径，符合故事验收标准。

### Compliance Check

- Coding Standards: ✓
- Project Structure: ✓
- Testing Strategy: ✓
- All ACs Met: ✓

### Files Verified

- src/services/translator.js
- tests/translator.test.js

### Gate Status

Gate: PASS → docs/qa/gates/e1.s3-translation-service.yml

NFR assessment: docs/qa/assessments/e1.s3-nfr-20250918.md
Risk profile: docs/qa/assessments/e1.s3-risk-20250918.md
Trace matrix: docs/qa/assessments/e1.s3-trace-20250918.md
Test design matrix: docs/qa/assessments/e1.s3-test-design-20250918.md
