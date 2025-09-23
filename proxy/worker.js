/**
 * Mini Translate API Proxy - Cloudflare Worker
 * 解决Chrome扩展MV3的CORS限制，提供统一的API代理服务
 */

// 支持的供应商配置（apiKey 运行时从环境注入）
function getProviders(env) {
  return {
    'dashscope.aliyuncs.com': {
      apiKey: env?.DASHSCOPE_API_KEY || '',
      baseUrl: 'https://dashscope.aliyuncs.com'
    }
    // 可扩展其他供应商
  };
}

// 速率限制配置
const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1分钟窗口
  maxRequests: 30, // 每分钟最多30次请求
  maxBurst: 5 // 突发最多5次
};

// 存储请求计数（生产环境建议使用KV存储）
const requestCounts = new Map();

/**
 * 检查速率限制
 */
function checkRateLimit(clientId) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT.windowMs;
  
  // 清理过期记录
  for (const [key, data] of requestCounts.entries()) {
    if (data.windowStart < windowStart) {
      requestCounts.delete(key);
    }
  }
  
  const clientData = requestCounts.get(clientId) || { count: 0, windowStart: now };
  
  if (clientData.windowStart < windowStart) {
    // 新窗口
    clientData.count = 1;
    clientData.windowStart = now;
  } else {
    clientData.count++;
  }
  
  requestCounts.set(clientId, clientData);
  
  return {
    allowed: clientData.count <= RATE_LIMIT.maxRequests,
    remaining: Math.max(0, RATE_LIMIT.maxRequests - clientData.count),
    resetTime: clientData.windowStart + RATE_LIMIT.windowMs
  };
}

/**
 * 获取客户端标识
 */
function getClientId(request) {
  // 使用IP + User-Agent作为客户端标识
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ua = request.headers.get('User-Agent') || 'unknown';
  return btoa(ip + '|' + ua).slice(0, 16);
}

/**
 * 添加CORS头
 */
function addCorsHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With');
  headers.set('Access-Control-Max-Age', '86400'); // 24小时预检缓存
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * 处理预检请求
 */
function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Requested-With',
      'Access-Control-Max-Age': '86400'
    }
  });
}

/**
 * 代理API请求
 */
async function proxyRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // 只允许 /compatible-mode/v1/* 路径
  if (!path.startsWith('/compatible-mode/v1/')) {
    return new Response('Not Found', { status: 404 });
  }
  
  // 检查速率限制
  const clientId = getClientId(request);
  const rateLimit = checkRateLimit(clientId);
  
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({
      error: {
        message: 'Rate limit exceeded',
        type: 'rate_limit_exceeded'
      }
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': RATE_LIMIT.maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': rateLimit.resetTime.toString()
      }
    });
  }
  
  // 确定目标供应商（这里简化处理，实际可根据请求内容路由）
  const PROVIDERS = getProviders(env);
  const targetProvider = PROVIDERS['dashscope.aliyuncs.com'];
  if (!targetProvider) {
    return new Response('Service Unavailable', { status: 503 });
  }
  if (!targetProvider.apiKey) {
    return new Response(JSON.stringify({ error: { message: 'Server API key not configured', type: 'config_error' } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  
  // 构建目标URL
  const targetUrl = targetProvider.baseUrl + path + url.search;
  
  // 复制请求体
  let body = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.arrayBuffer();
  }
  
  // 构建代理请求
  const proxyRequest = new Request(targetUrl, {
    method: request.method,
    headers: {
      'Content-Type': request.headers.get('Content-Type') || 'application/json',
      'Authorization': `Bearer ${targetProvider.apiKey}`,
      'User-Agent': 'Mini-Translate-Proxy/1.0'
    },
    body
  });
  
  try {
    // 发送代理请求
    const response = await fetch(proxyRequest);
    
    // 复制响应体
    const responseBody = await response.arrayBuffer();
    
    // 创建响应并添加CORS头
    const proxyResponse = new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'X-RateLimit-Limit': RATE_LIMIT.maxRequests.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetTime.toString()
      }
    });
    
    return addCorsHeaders(proxyResponse);
    
  } catch (error) {
    console.error('Proxy request failed:', error);
    
    return new Response(JSON.stringify({
      error: {
        message: 'Proxy service error',
        type: 'proxy_error'
      }
    }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

/**
 * 主处理函数
 */
export default {
  async fetch(request, env, ctx) {
    try {
      // 处理预检请求
      if (request.method === 'OPTIONS') {
        return handleOptions(request);
      }
      
      // 代理API请求
      return await proxyRequest(request, env);
      
    } catch (error) {
      console.error('Worker error:', error);
      
      return new Response(JSON.stringify({
        error: {
          message: 'Internal server error',
          type: 'internal_error'
        }
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }
};
