#!/usr/bin/env node

/**
 * 简单的 Qwen API Key 验证脚本
 * 用于快速验证 API Key 是否有效
 */

console.warn('🔍 Qwen API Key 验证开始...\n');

// 检查环境变量
const qwenKey = process.env.TEST_QWEN_KEY;

if (!qwenKey) {
  console.warn('❌ 未检测到 TEST_QWEN_KEY 环境变量');
  console.warn('请设置：export TEST_QWEN_KEY="your-qwen-key"');
  process.exit(1);
}

console.warn(`✅ 检测到 Qwen Key`);
console.warn(`🔑 Key 格式：${qwenKey.substring(0, 8)}...${qwenKey.substring(qwenKey.length - 4)}`);
console.warn(`📏 Key 长度：${qwenKey.length} 字符`);

// 验证 Key 格式
if (!qwenKey.startsWith('sk-')) {
  console.warn('⚠️  警告：Key 格式可能不正确，应该以 "sk-" 开头');
}

if (qwenKey.length < 20) {
  console.warn('⚠️  警告：Key 长度较短，可能不是有效的 API Key');
}

console.warn('\n🧪 开始 API Key 验证...');

// 简单的 API 调用测试
async function testApiKey() {
  try {
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${qwenKey}`
      },
      body: JSON.stringify({
        model: 'qwen-mt-turbo',
        input: {
          messages: [
            {
              role: 'user',
              content: 'hello'
            }
          ]
        },
        parameters: {
          temperature: 0.3,
          max_tokens: 100,
          result_format: 'message'
        }
      })
    });

    console.warn(`📡 API 响应状态: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.warn('✅ API Key 验证成功！');
      console.warn(`📝 翻译结果: ${data.choices[0].message.content}`);
      return true;
    } else {
      const errorData = await response.text();
      console.warn(`❌ API 调用失败: ${response.status}`);
      console.warn(`📄 错误详情: ${errorData}`);
      
      if (response.status === 401) {
        console.warn('🔑 问题：API Key 无效或过期');
      } else if (response.status === 403) {
        console.warn('🚫 问题：API Key 权限不足');
      } else if (response.status === 429) {
        console.warn('⏱️  问题：API 调用频率限制');
      }
      return false;
    }
  } catch (error) {
    console.warn(`💥 网络错误: ${error.message}`);
    return false;
  }
}

// 执行测试
testApiKey()
  .then(success => {
    if (success) {
      console.warn('\n🎉 API Key 验证成功！');
      process.exit(0);
    } else {
      console.warn('\n❌ API Key 验证失败');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 验证过程中发生错误:', error);
    process.exit(1);
  });
