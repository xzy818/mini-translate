/**
 * 本地测试代理功能
 * 模拟扩展的请求来验证代理是否正常工作
 */

const API_KEY = process.env.DASHSCOPE_API_KEY || '';
const PROXY_URL = 'https://mini-translate-proxy.your-subdomain.workers.dev/compatible-mode/v1/chat/completions';

async function testProxy() {
  console.log('🧪 测试代理功能...');
  
  const payload = {
    model: 'qwen-mt-turbo',
    messages: [
      {
        role: 'user',
        content: 'diagnostic check'
      }
    ],
    max_tokens: 100,
    temperature: 0.1
  };

  try {
    console.log('📤 发送请求到代理...');
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    console.log('📊 响应状态:', response.status);
    console.log('📋 响应头:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const data = await response.json();
      console.log('✅ 代理测试成功！');
      console.log('📝 翻译结果:', data.choices?.[0]?.message?.content || '无内容');
    } else {
      const errorText = await response.text();
      console.log('❌ 代理测试失败:', errorText);
    }
  } catch (error) {
    console.log('💥 请求异常:', error.message);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  testProxy();
}

export { testProxy };
