/**
 * Offscreen Document 管理器
 * 负责创建和管理Chrome扩展的Offscreen Document
 */

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
const OFFSCREEN_REASON = 'DOM_SCRAPING';

/**
 * 检查Offscreen Document是否已创建
 */
async function hasOffscreenDocument() {
  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    return existingContexts.length > 0;
  } catch (error) {
    console.log('❌ 检查Offscreen Document失败:', error);
    return false;
  }
}

/**
 * 创建Offscreen Document
 */
async function createOffscreenDocument() {
  try {
    console.log('🔍 创建Offscreen Document...');
    
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH),
      reasons: [OFFSCREEN_REASON],
      justification: 'Handle network requests for translation APIs in a secure context'
    });
    
    console.log('✅ Offscreen Document 创建成功');
    return true;
  } catch (error) {
    console.log('❌ 创建Offscreen Document失败:', error);
    return false;
  }
}

/**
 * 关闭Offscreen Document
 */
async function closeOffscreenDocument() {
  try {
    console.log('🔍 关闭Offscreen Document...');
    await chrome.offscreen.closeDocument();
    console.log('✅ Offscreen Document 关闭成功');
  } catch (error) {
    console.log('❌ 关闭Offscreen Document失败:', error);
  }
}

/**
 * 确保Offscreen Document存在
 */
async function ensureOffscreenDocument() {
  const hasOffscreen = await hasOffscreenDocument();
  
  if (!hasOffscreen) {
    const created = await createOffscreenDocument();
    if (!created) {
      throw new Error('Failed to create offscreen document');
    }
  }
  
  return true;
}

/**
 * 通过Offscreen Document发送网络请求
 */
async function sendOffscreenRequest(url, options) {
  return new Promise(async (resolve, reject) => {
    try {
      // 确保Offscreen Document存在
      await ensureOffscreenDocument();
      
      // 生成唯一的请求ID
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log('🔍 发送Offscreen请求:', { requestId, url, options });
      
      // 设置超时处理
      const timeout = setTimeout(() => {
        reject(new Error('Offscreen request timeout'));
      }, options.timeout || 30000);
      
      // 监听响应消息
      const messageListener = (message, sender, sendResponse) => {
        if (message.type === 'FETCH_RESPONSE' && message.requestId === requestId) {
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(messageListener);
          
          if (message.success) {
            // 创建一个模拟的Response对象
            const mockResponse = {
              ok: message.data.ok,
              status: message.data.status,
              statusText: message.data.statusText,
              headers: new Map(Object.entries(message.data.headers || {})),
              json: () => Promise.resolve(message.data.json),
              text: () => Promise.resolve(message.data.text)
            };
            resolve(mockResponse);
          } else {
            reject(new Error(message.error));
          }
        }
      };
      
      // 添加消息监听器
      chrome.runtime.onMessage.addListener(messageListener);
      
      // 发送请求到Offscreen Document
      chrome.runtime.sendMessage({
        type: 'FETCH_REQUEST',
        requestId: requestId,
        url: url,
        options: options
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

export {
  hasOffscreenDocument,
  createOffscreenDocument,
  closeOffscreenDocument,
  ensureOffscreenDocument,
  sendOffscreenRequest
};
