# Chrome扩展加载测试设计 V3.0

## 改进的测试设计架构

### 1. L3扩展加载验证测试设计 [新增核心层]

#### 1.1 Chrome启动和扩展加载测试

**测试目标**: 在真实Chrome环境中验证扩展实际加载和注册

**测试场景**:

**场景1: Chrome启动和扩展加载验证**
```javascript
// 测试用例: TC-L3-001
describe('Chrome Startup and Extension Loading', () => {
  it('should start Chrome and load extension successfully', async () => {
    // 使用正确的Chrome启动参数
    const chromeProcess = await startChromeWithCorrectParams();
    expect(chromeProcess).toBeTruthy();
    
    // 验证Chrome调试端口可用
    const debugPort = await getChromeDebugPort();
    expect(debugPort).toBe(9228);
    
    // 验证扩展已加载
    const extensions = await getChromeExtensions();
    expect(extensions.length).toBeGreaterThan(0);
  });
});
```

**场景2: 扩展ID获取和验证**
```javascript
// 测试用例: TC-L3-002
describe('Extension ID Retrieval', () => {
  it('should retrieve extension ID successfully', async () => {
    const extensionId = await getExtensionId();
    expect(extensionId).toBeDefined();
    expect(extensionId).toMatch(/^[a-z]{32}$/);
    
    // 验证扩展ID格式正确
    expect(extensionId).toBe('acfpkkkhehadjlkdnffdkoilmhchefbl');
  });
});
```

**场景3: Service Worker注册状态检查**
```javascript
// 测试用例: TC-L3-003
describe('Service Worker Registration', () => {
  it('should register service worker successfully', async () => {
    const serviceWorkers = await getChromeServiceWorkers();
    const miniTranslateSW = serviceWorkers.find(sw => 
      sw.url.includes('acfpkkkhehadjlkdnffdkoilmhchefbl')
    );
    
    expect(miniTranslateSW).toBeDefined();
    expect(miniTranslateSW.status).toBe('active');
    expect(miniTranslateSW.type).toBe('service_worker');
  });
});
```

### 2. 环境兼容性测试设计 [关键层]

#### 1.1 Chrome Service Worker环境测试

**测试目标**: 在真实Chrome环境中验证Service Worker注册和运行

**测试场景**:

**场景1: Chrome环境启动测试**
```javascript
// 测试用例: TC-ENV-001
describe('Chrome Environment Startup', () => {
  it('should start Chrome with extension loaded', async () => {
    // 启动Chrome并加载扩展
    const chromeProcess = await startChromeWithExtension();
    expect(chromeProcess).toBeTruthy();
    
    // 验证Chrome调试端口可用
    const debugPort = await getChromeDebugPort();
    expect(debugPort).toBe(9222);
  });
});
```

**场景2: 扩展加载状态验证**
```javascript
// 测试用例: TC-ENV-002
describe('Extension Loading Status', () => {
  it('should load extension successfully in Chrome', async () => {
    // 通过Chrome DevTools Protocol检查扩展状态
    const extensions = await getChromeExtensions();
    const miniTranslate = extensions.find(ext => ext.name === 'Mini Translate');
    
    expect(miniTranslate).toBeDefined();
    expect(miniTranslate.enabled).toBe(true);
    expect(miniTranslate.installType).toBe('development');
  });
});
```

**场景3: Service Worker注册状态检查**
```javascript
// 测试用例: TC-ENV-003
describe('Service Worker Registration', () => {
  it('should register service worker successfully', async () => {
    // 检查Service Worker是否在Chrome中注册
    const serviceWorkers = await getChromeServiceWorkers();
    const miniTranslateSW = serviceWorkers.find(sw => 
      sw.url.includes('acfpkkkhehadjlkdnffdkoilmhchefbl')
    );
    
    expect(miniTranslateSW).toBeDefined();
    expect(miniTranslateSW.status).toBe('active');
  });
});
```

#### 1.2 ES6模块兼容性测试

**测试目标**: 验证ES6模块在Chrome Service Worker环境中的兼容性

**测试场景**:

**场景1: 模块类型兼容性检查**
```javascript
// 测试用例: TC-MOD-001
describe('Module Type Compatibility', () => {
  it('should not use ES6 modules in Service Worker', () => {
    const manifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf8'));
    
    // 检查是否使用了type: module
    expect(manifest.background.type).toBeUndefined();
    
    // 检查background.js是否使用importScripts而不是import
    const backgroundCode = fs.readFileSync('dist/background.js', 'utf8');
    expect(backgroundCode).toMatch(/importScripts/);
    expect(backgroundCode).not.toMatch(/^import\s+/m);
  });
});
```

**场景2: importScripts路径验证**
```javascript
// 测试用例: TC-MOD-002
describe('ImportScripts Path Validation', () => {
  it('should have valid importScripts paths', () => {
    const backgroundCode = fs.readFileSync('dist/background.js', 'utf8');
    const importScriptsMatches = backgroundCode.match(/importScripts\(['"]([^'"]+)['"]\)/g);
    
    if (importScriptsMatches) {
      importScriptsMatches.forEach(match => {
        const path = match.match(/importScripts\(['"]([^'"]+)['"]\)/)[1];
        expect(fs.existsSync(`dist/${path}`)).toBe(true);
      });
    }
  });
});
```

### 2. 增强的Service Worker测试设计

#### 2.1 Service Worker注册验证

**测试目标**: 确保Service Worker在Chrome中正确注册和运行

**测试场景**:

**场景1: Service Worker生命周期测试**
```javascript
// 测试用例: TC-SW-001
describe('Service Worker Lifecycle', () => {
  it('should register and activate service worker', async () => {
    // 启动Chrome并加载扩展
    await startChromeWithExtension();
    
    // 等待Service Worker注册
    await waitForServiceWorkerRegistration();
    
    // 验证Service Worker状态
    const swStatus = await getServiceWorkerStatus();
    expect(swStatus).toBe('active');
  });
});
```

**场景2: Service Worker错误监控**
```javascript
// 测试用例: TC-SW-002
describe('Service Worker Error Monitoring', () => {
  it('should not have service worker errors', async () => {
    // 启动Chrome并监控错误
    const errorLogs = await getChromeErrorLogs();
    const swErrors = errorLogs.filter(log => 
      log.includes('service_worker') || log.includes('background.js')
    );
    
    expect(swErrors).toHaveLength(0);
  });
});
```

### 3. 真实环境集成测试设计

#### 3.1 Chrome DevTools Protocol集成

**测试目标**: 通过Chrome DevTools Protocol进行真实环境测试

**测试场景**:

**场景1: 扩展信息获取**
```javascript
// 测试用例: TC-CDP-001
describe('Chrome DevTools Protocol Integration', () => {
  it('should get extension information via CDP', async () => {
    const debugPort = 9222;
    const response = await fetch(`http://localhost:${debugPort}/json`);
    const tabs = await response.json();
    
    const extensionTabs = tabs.filter(tab => 
      tab.url.includes('chrome-extension://')
    );
    
    expect(extensionTabs.length).toBeGreaterThan(0);
  });
});
```

**场景2: Service Worker状态查询**
```javascript
// 测试用例: TC-CDP-002
describe('Service Worker Status Query', () => {
  it('should query service worker status via CDP', async () => {
    const debugPort = 9222;
    const response = await fetch(`http://localhost:${debugPort}/json`);
    const tabs = await response.json();
    
    const serviceWorkers = tabs.filter(tab => 
      tab.type === 'service_worker'
    );
    
    expect(serviceWorkers.length).toBeGreaterThan(0);
  });
});
```

## 测试执行策略（V2.0）

### 1. 分层测试执行

**L1: 静态分析测试**
- 文件完整性检查
- 语法正确性验证
- 路径有效性检查

**L2: 环境兼容性测试** [新增]
- Chrome环境启动测试
- 扩展加载状态验证
- Service Worker注册检查
- 模块兼容性验证

**L3: 功能集成测试**
- 消息传递测试
- 存储操作测试
- API调用测试

**L4: 端到端测试**
- 用户流程测试
- 跨组件测试
- 性能基准测试

### 2. 失败处理策略

**L1/L2失败**: 立即停止，必须修复
**L3失败**: 记录问题，评估影响
**L4失败**: 记录改进建议

### 3. 测试数据管理

**测试输入**: 使用真实的dist/目录和Chrome环境
**测试环境**: 隔离的Chrome实例，启用调试模式
**测试输出**: 详细的错误报告和修复建议

## 质量保证（V2.0）

### 1. 测试覆盖率
- **静态分析**: 100%覆盖所有关键路径
- **环境兼容性**: 100%覆盖Chrome环境验证 [新增]
- **功能集成**: ≥95%覆盖关键功能
- **端到端**: ≥90%覆盖用户场景

### 2. 测试维护
- **定期更新**: 根据Chrome版本更新测试用例
- **环境同步**: 确保测试环境与生产环境一致
- **工具升级**: 保持Chrome DevTools Protocol工具更新

### 3. 持续改进
- **错误分析**: 分析Chrome扩展常见错误模式
- **最佳实践**: 总结Service Worker测试最佳实践
- **知识分享**: 为团队提供Chrome扩展测试培训
