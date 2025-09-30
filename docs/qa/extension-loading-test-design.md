# Chrome扩展加载测试设计

## 测试设计概述

本文档详细设计了Chrome扩展加载阶段的测试方案，包括Service Worker验证、Manifest检查、模块导入测试等关键测试场景。

## 测试设计架构

### 1. Service Worker注册测试设计

#### 1.1 测试目标
验证Service Worker能够正确注册并正常运行，检测常见的注册失败原因。

#### 1.2 测试场景

**场景1: Service Worker注册状态检查**
```javascript
// 测试用例: TC-SW-001
describe('Service Worker Registration', () => {
  it('should register service worker successfully', async () => {
    // 检查Service Worker是否注册成功
    const registration = await navigator.serviceWorker.getRegistration();
    expect(registration).toBeTruthy();
    expect(registration.active).toBeTruthy();
  });
});
```

**场景2: Service Worker模块导入检查**
```javascript
// 测试用例: TC-SW-002
describe('Service Worker Module Imports', () => {
  it('should resolve all import paths', async () => {
    // 检查background.js中的所有import路径
    const importPaths = extractImportPaths('dist/background.js');
    for (const path of importPaths) {
      expect(fs.existsSync(`dist/${path}`)).toBe(true);
    }
  });
});
```

**场景3: Service Worker语法兼容性检查**
```javascript
// 测试用例: TC-SW-003
describe('Service Worker Syntax Compatibility', () => {
  it('should use compatible JavaScript syntax', () => {
    // 检查是否使用了Service Worker不支持的语法
    const backgroundCode = fs.readFileSync('dist/background.js', 'utf8');
    expect(backgroundCode).not.toMatch(/import\s+.*from\s+['"]\.\.\/src/);
    expect(backgroundCode).not.toMatch(/class\s+\w+/);
  });
});
```

### 2. Manifest验证测试设计

#### 2.1 测试目标
验证manifest.json的语法正确性和配置完整性，确保扩展能够正确加载。

#### 2.2 测试场景

**场景1: Manifest语法验证**
```javascript
// 测试用例: TC-MF-001
describe('Manifest Syntax Validation', () => {
  it('should have valid JSON syntax', () => {
    const manifestPath = 'dist/manifest.json';
    expect(() => JSON.parse(fs.readFileSync(manifestPath, 'utf8'))).not.toThrow();
  });
});
```

**场景2: Manifest必需字段检查**
```javascript
// 测试用例: TC-MF-002
describe('Manifest Required Fields', () => {
  it('should contain all required fields', () => {
    const manifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf8'));
    const requiredFields = ['manifest_version', 'name', 'version', 'permissions'];
    
    requiredFields.forEach(field => {
      expect(manifest[field]).toBeDefined();
    });
  });
});
```

**场景3: Service Worker配置检查**
```javascript
// 测试用例: TC-MF-003
describe('Service Worker Configuration', () => {
  it('should have valid service worker configuration', () => {
    const manifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf8'));
    
    expect(manifest.background).toBeDefined();
    expect(manifest.background.service_worker).toBeDefined();
    expect(fs.existsSync(`dist/${manifest.background.service_worker}`)).toBe(true);
  });
});
```

### 3. 模块导入路径测试设计

#### 3.1 测试目标
验证所有模块导入路径的正确性，防止因路径错误导致的加载失败。

#### 3.2 测试场景

**场景1: 相对路径解析检查**
```javascript
// 测试用例: TC-MI-001
describe('Module Import Path Resolution', () => {
  it('should resolve all relative import paths', () => {
    const backgroundCode = fs.readFileSync('dist/background.js', 'utf8');
    const importMatches = backgroundCode.match(/import\s+.*from\s+['"]([^'"]+)['"]/g);
    
    if (importMatches) {
      importMatches.forEach(match => {
        const path = match.match(/from\s+['"]([^'"]+)['"]/)[1];
        if (!path.startsWith('chrome:')) {
          expect(fs.existsSync(`dist/${path}`)).toBe(true);
        }
      });
    }
  });
});
```

**场景2: 模块依赖完整性检查**
```javascript
// 测试用例: TC-MI-002
describe('Module Dependency Integrity', () => {
  it('should have all required module files', () => {
    const requiredModules = [
      'services/context-menu.js',
      'services/translator.js',
      'services/ai-api-client.js',
      'config/model-providers.js'
    ];
    
    requiredModules.forEach(module => {
      expect(fs.existsSync(`dist/${module}`)).toBe(true);
    });
  });
});
```

### 4. 扩展加载状态测试设计

#### 4.1 测试目标
验证扩展在Chrome中的加载状态，确保扩展能够正常启用和运行。

#### 4.2 测试场景

**场景1: 扩展加载状态检查**
```javascript
// 测试用例: TC-EL-001
describe('Extension Loading Status', () => {
  it('should load extension successfully in Chrome', async () => {
    // 通过Chrome DevTools Protocol检查扩展状态
    const extensions = await chrome.management.getAll();
    const miniTranslate = extensions.find(ext => ext.name === 'Mini Translate');
    
    expect(miniTranslate).toBeDefined();
    expect(miniTranslate.enabled).toBe(true);
    expect(miniTranslate.installType).toBe('development');
  });
});
```

**场景2: 扩展错误日志检查**
```javascript
// 测试用例: TC-EL-002
describe('Extension Error Logs', () => {
  it('should not have critical errors in console', async () => {
    // 检查Chrome扩展控制台是否有错误
    const logs = await chrome.runtime.getLastError();
    expect(logs).toBeUndefined();
  });
});
```

## 测试执行策略

### 1. 测试执行顺序
1. **文件完整性检查** - 验证所有必需文件存在
2. **Manifest语法验证** - 检查JSON语法和必需字段
3. **模块导入检查** - 验证所有import路径正确
4. **Service Worker测试** - 检查注册和运行状态
5. **扩展加载验证** - 确认扩展在Chrome中正常加载

### 2. 失败处理策略
- **P0失败**: 立即停止测试，必须修复
- **P1失败**: 记录问题，评估影响范围
- **P2失败**: 记录改进建议

### 3. 测试数据管理
- **测试输入**: 使用真实的dist/目录
- **测试环境**: 隔离的Chrome实例
- **测试输出**: 详细的错误报告和修复建议

## 质量保证

### 1. 测试覆盖率
- **基础加载测试**: 100%覆盖所有关键路径
- **错误场景测试**: 覆盖常见失败模式
- **边界条件测试**: 验证极端情况处理

### 2. 测试维护
- **定期更新**: 根据代码变更更新测试用例
- **用例审查**: 每月审查测试用例的有效性
- **工具升级**: 保持测试工具和框架的更新

### 3. 持续改进
- **错误分析**: 分析测试失败的根本原因
- **最佳实践**: 总结测试执行的最佳实践
- **知识分享**: 为团队提供测试培训和支持
