# Google同步功能测试设计

## 概述

本文档详细描述了Google账号同步功能的测试策略，包括认证、数据同步、冲突解决和存储管理的全面测试方案。

## 测试范围

### 1. Google账号认证测试

#### 1.1 登录流程测试
- **正常登录流程**：用户点击登录按钮 → Chrome Identity API调用 → 获取访问令牌 → 保存认证状态
- **登录失败处理**：网络错误、用户取消、权限拒绝等场景
- **多账号切换**：用户在不同Google账号间切换的处理

#### 1.2 登出流程测试
- **正常登出**：清除本地认证信息 → 停止同步 → 更新UI状态
- **强制登出**：Chrome检测到账号在其他地方登出时的处理

#### 1.3 认证状态管理
- **状态持久化**：浏览器重启后认证状态保持
- **状态同步**：认证状态变化时UI实时更新
- **错误恢复**：认证令牌过期时的自动刷新

### 2. 数据同步测试

#### 2.1 基础同步功能
- **增量同步**：只同步发生变化的数据项
- **全量同步**：首次登录或数据损坏时的完整同步
- **双向同步**：本地修改同步到云端，云端修改同步到本地

#### 2.2 同步触发机制
- **自动触发**：数据变化时自动启动同步
- **手动触发**：用户点击同步按钮
- **定时同步**：定期检查并同步数据
- **网络状态变化**：从离线到在线时的自动同步

#### 2.3 同步性能测试
- **同步延迟**：数据变化到同步完成的时间
- **数据量测试**：大量数据（接近100KB限制）的同步性能
- **网络条件**：不同网络环境下的同步表现

### 3. 冲突解决测试

#### 3.1 冲突检测
- **时间戳冲突**：同一数据项在不同设备上同时修改
- **版本冲突**：数据版本号不匹配
- **完整性冲突**：数据在传输过程中损坏

#### 3.2 自动解决策略
- **时间戳优先**：保留最新修改的版本
- **完整性优先**：合并不同版本的有效信息
- **用户偏好**：根据用户设置选择解决策略

#### 3.3 手动解决界面
- **冲突展示**：清晰显示冲突的数据项和版本差异
- **选择界面**：允许用户选择保留哪个版本或合并
- **批量处理**：同时处理多个冲突项

### 4. 存储管理测试

#### 4.1 配额管理
- **100KB限制**：接近存储限制时的处理
- **数据压缩**：自动压缩数据以节省空间
- **清理策略**：删除过期或重复数据

#### 4.2 数据完整性
- **备份恢复**：数据损坏时的恢复机制
- **校验和验证**：确保数据传输的完整性
- **版本控制**：数据版本的管理和回滚

## 测试用例详细设计

### 测试用例1：Google账号登录

```javascript
describe('Google Account Login', () => {
  beforeEach(() => {
    // 模拟Chrome Identity API
    mockChrome.identity.getAuthToken = jest.fn();
    mockChrome.identity.getProfileUserInfo = jest.fn();
  });

  it('should successfully login with valid Google account', async () => {
    // 准备测试数据
    const mockToken = 'mock-auth-token';
    const mockUserInfo = {
      email: 'test@example.com',
      id: '123456789'
    };

    // 模拟API响应
    mockChrome.identity.getAuthToken.mockResolvedValue(mockToken);
    mockChrome.identity.getProfileUserInfo.mockResolvedValue(mockUserInfo);

    // 执行登录
    const result = await googleAuth.authenticate();

    // 验证结果
    expect(result.success).toBe(true);
    expect(result.userInfo).toEqual(mockUserInfo);
    expect(mockChrome.identity.getAuthToken).toHaveBeenCalled();
  });

  it('should handle login failure gracefully', async () => {
    // 模拟登录失败
    mockChrome.identity.getAuthToken.mockRejectedValue(
      new Error('User cancelled login')
    );

    // 执行登录
    const result = await googleAuth.authenticate();

    // 验证错误处理
    expect(result.success).toBe(false);
    expect(result.error).toContain('User cancelled login');
  });
});
```

### 测试用例2：数据同步

```javascript
describe('Data Synchronization', () => {
  beforeEach(() => {
    // 模拟chrome.storage.sync API
    mockChrome.storage.sync.get = jest.fn();
    mockChrome.storage.sync.set = jest.fn();
    mockChrome.storage.sync.onChanged = {
      addListener: jest.fn(),
      removeListener: jest.fn()
    };
  });

  it('should sync vocabulary data to cloud storage', async () => {
    // 准备本地数据
    const localData = {
      vocabulary: [
        { word: 'hello', translation: '你好', lastModified: Date.now() }
      ],
      lastModified: Date.now(),
      version: 1
    };

    // 执行同步
    const syncResult = await cloudSync.syncData(localData);

    // 验证同步结果
    expect(syncResult.success).toBe(true);
    expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(
      expect.objectContaining({
        vocabulary: expect.any(Array),
        lastModified: expect.any(Number)
      })
    );
  });

  it('should handle sync conflicts', async () => {
    // 准备冲突数据
    const localData = {
      vocabulary: [{ word: 'test', translation: '测试', version: 1 }]
    };
    const remoteData = {
      vocabulary: [{ word: 'test', translation: '试验', version: 2 }]
    };

    // 模拟远程数据
    mockChrome.storage.sync.get.mockResolvedValue({ data: remoteData });

    // 执行同步
    const result = await cloudSync.syncData(localData);

    // 验证冲突处理
    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts).toHaveLength(1);
  });
});
```

### 测试用例3：冲突解决

```javascript
describe('Conflict Resolution', () => {
  it('should resolve conflicts using timestamp priority', async () => {
    // 准备冲突数据
    const conflicts = [{
      word: 'hello',
      local: { translation: '你好', lastModified: 1000 },
      remote: { translation: '您好', lastModified: 2000 }
    }];

    // 执行冲突解决
    const resolution = await conflictResolver.resolveConflicts(conflicts);

    // 验证解决结果
    expect(resolution.strategy).toBe('timestamp_priority');
    expect(resolution.resolvedData[0].translation).toBe('您好');
  });

  it('should show manual resolution UI for complex conflicts', async () => {
    // 准备复杂冲突
    const complexConflict = {
      word: 'test',
      local: { translation: '测试', notes: '本地笔记', lastModified: 1000 },
      remote: { translation: '试验', notes: '远程笔记', lastModified: 1000 }
    };

    // 执行冲突解决
    const result = await conflictResolver.resolveConflicts([complexConflict]);

    // 验证需要手动解决
    expect(result.requiresManualResolution).toBe(true);
    expect(result.conflictUI).toBeDefined();
  });
});
```

### 测试用例4：存储配额管理

```javascript
describe('Storage Quota Management', () => {
  it('should compress data when approaching quota limit', async () => {
    // 生成接近100KB的数据
    const largeData = generateLargeVocabularyData(95 * 1024); // 95KB

    // 执行数据压缩
    const compressedData = await cloudSync.compressData(largeData);

    // 验证压缩结果
    expect(compressedData.size).toBeLessThan(100 * 1024);
    expect(compressedData.compressionRatio).toBeGreaterThan(0.5);
  });

  it('should handle quota exceeded error', async () => {
    // 模拟存储配额超限
    mockChrome.storage.sync.set.mockRejectedValue(
      new Error('QUOTA_BYTES_PER_ITEM quota exceeded')
    );

    // 执行同步
    const result = await cloudSync.syncData(largeData);

    // 验证错误处理
    expect(result.success).toBe(false);
    expect(result.error).toContain('quota exceeded');
    expect(result.suggestedAction).toBe('compress_data');
  });
});
```

## 测试环境设置

### 1. 模拟环境配置

```javascript
// tests/setup/google-sync-mocks.js
export const setupGoogleSyncMocks = () => {
  // 模拟Chrome Identity API
  global.chrome = {
    identity: {
      getAuthToken: jest.fn(),
      getProfileUserInfo: jest.fn(),
      onSignInChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn()
      }
    },
    storage: {
      sync: {
        get: jest.fn(),
        set: jest.fn(),
        clear: jest.fn(),
        onChanged: {
          addListener: jest.fn(),
          removeListener: jest.fn()
        }
      },
      local: {
        get: jest.fn(),
        set: jest.fn()
      }
    }
  };
};
```

### 2. 测试数据生成

```javascript
// tests/utils/test-data-generator.js
export const generateTestVocabulary = (count = 100) => {
  return Array.from({ length: count }, (_, i) => ({
    word: `test-word-${i}`,
    translation: `测试翻译-${i}`,
    lastModified: Date.now() - Math.random() * 86400000, // 随机时间
    version: Math.floor(Math.random() * 10) + 1,
    deviceId: `device-${Math.floor(Math.random() * 3) + 1}`
  }));
};

export const generateLargeVocabularyData = (targetSize) => {
  const data = [];
  let currentSize = 0;
  
  while (currentSize < targetSize) {
    const item = generateTestVocabulary(1)[0];
    item.notes = 'x'.repeat(1000); // 添加大量文本
    data.push(item);
    currentSize += JSON.stringify(item).length;
  }
  
  return data;
};
```

## 性能测试

### 1. 同步性能基准

```javascript
describe('Sync Performance Benchmarks', () => {
  it('should sync 1000 vocabulary items within 5 seconds', async () => {
    const startTime = Date.now();
    const largeDataset = generateTestVocabulary(1000);
    
    const result = await cloudSync.syncData({ vocabulary: largeDataset });
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000); // 5秒内完成
    expect(result.success).toBe(true);
  });

  it('should handle concurrent sync operations', async () => {
    const datasets = Array.from({ length: 5 }, () => 
      generateTestVocabulary(100)
    );
    
    const syncPromises = datasets.map(data => 
      cloudSync.syncData({ vocabulary: data })
    );
    
    const results = await Promise.all(syncPromises);
    
    // 验证所有同步都成功
    results.forEach(result => {
      expect(result.success).toBe(true);
    });
  });
});
```

## 错误处理测试

### 1. 网络错误处理

```javascript
describe('Network Error Handling', () => {
  it('should retry sync on network failure', async () => {
    let attemptCount = 0;
    mockChrome.storage.sync.set.mockImplementation(() => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error('Network error');
      }
      return Promise.resolve();
    });

    const result = await cloudSync.syncData(testData);
    
    expect(attemptCount).toBe(3);
    expect(result.success).toBe(true);
  });

  it('should handle offline mode gracefully', async () => {
    // 模拟离线状态
    mockChrome.storage.sync.set.mockRejectedValue(
      new Error('Offline mode')
    );

    const result = await cloudSync.syncData(testData);
    
    expect(result.success).toBe(false);
    expect(result.offlineMode).toBe(true);
    expect(result.pendingChanges).toBeDefined();
  });
});
```

## 测试执行计划

### 1. 单元测试执行

```bash
# 运行Google同步功能单元测试
npx vitest run tests/google-sync.test.js

# 运行特定测试套件
npx vitest run tests/google-sync.test.js --grep "Authentication"
npx vitest run tests/google-sync.test.js --grep "Conflict Resolution"
```

### 2. 集成测试执行

```bash
# 运行端到端同步测试
npx vitest run tests/e2e-google-sync.test.js

# 运行性能测试
npx vitest run tests/google-sync-performance.test.js
```

### 3. 持续集成配置

```yaml
# .github/workflows/google-sync-tests.yml
name: Google Sync Tests
on: [push, pull_request]
jobs:
  google-sync-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Run Google Sync Tests
        run: |
          npx vitest run tests/google-sync.test.js
          npx vitest run tests/e2e-google-sync.test.js
      - name: Run Performance Tests
        run: npx vitest run tests/google-sync-performance.test.js
```

## 测试覆盖率目标

- **单元测试覆盖率**: ≥ 90%
- **集成测试覆盖率**: ≥ 80%
- **端到端测试覆盖率**: ≥ 70%
- **关键路径覆盖率**: 100%

## 总结

通过实施这个全面的Google同步功能测试策略，我们能够：

1. **确保认证安全**：验证Google账号登录/登出的安全性
2. **保证数据一致性**：确保数据在不同设备间正确同步
3. **处理冲突智能**：提供自动和手动冲突解决机制
4. **优化存储使用**：在Chrome存储限制内高效管理数据
5. **提升用户体验**：确保同步过程对用户透明且可靠

这个测试设计为Google同步功能提供了完整的质量保证，确保功能的稳定性和可靠性。
