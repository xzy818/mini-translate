/**
 * Google认证服务
 * 处理Google OAuth认证和用户状态管理
 */

import oauthConfig from '../config/oauth-config.js';

class GoogleAuthService {
  constructor() {
    this.isAuthenticated = false;
    this.accessToken = null;
    this.userInfo = null;
    this.authListeners = [];
    
    // 绑定方法
    this.authenticate = this.authenticate.bind(this);
    this.getAuthStatus = this.getAuthStatus.bind(this);
    this.logout = this.logout.bind(this);
    this.onSignInChanged = this.onSignInChanged.bind(this);
    
    // 初始化
    this.init();
  }

  /**
   * 初始化认证服务
   */
  async init() {
    try {
      // 检查现有认证状态
      await this.checkAuthStatus();
      
      // 设置认证状态监听器
      this.setupAuthListeners();
      
      console.warn('Google认证服务已初始化');
    } catch (error) {
      console.error('初始化Google认证服务失败:', error);
    }
  }

  /**
   * 执行Google认证
   */
  async authenticate() {
    try {
      console.warn('开始Google认证...');
      
      // 检查OAuth配置
      const config = oauthConfig.getOAuthConfig();
      if (!config.client_id || config.client_id === 'YOUR_CLIENT_ID') {
        throw new Error('OAuth client_id 未配置，请在manifest.json中设置正确的client_id');
      }
      
      // 使用Chrome Identity API进行认证
      const token = await this.getAuthToken(true);
      
      if (token) {
        this.accessToken = token;
        this.isAuthenticated = true;
        
        // 获取用户信息
        await this.fetchUserInfo();
        
        // 保存认证状态
        await this.saveAuthState();
        
        // 通知认证状态变化
        this.notifyAuthStateChange(true);
        
        console.warn('Google认证成功');
        return true;
      } else {
        throw new Error('认证失败：未获取到访问令牌');
      }
      
    } catch (error) {
      console.error('Google认证失败:', error);
      this.isAuthenticated = false;
      this.accessToken = null;
      this.userInfo = null;
      
      // 通知认证状态变化
      this.notifyAuthStateChange(false);
      
      throw error;
    }
  }

  /**
   * 获取认证令牌
   */
  async getAuthToken(interactive = false) {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive }, (token) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        resolve(token);
      });
    });
  }

  /**
   * 获取用户信息
   */
  async fetchUserInfo() {
    try {
      if (!this.accessToken) {
        throw new Error('无访问令牌，无法获取用户信息');
      }
      
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`获取用户信息失败: ${response.status}`);
      }
      
      this.userInfo = await response.json();
      console.warn('用户信息已获取:', this.userInfo);
      
    } catch (error) {
      console.error('获取用户信息失败:', error);
      throw error;
    }
  }

  /**
   * 检查认证状态
   */
  async checkAuthStatus() {
    try {
      const token = await this.getAuthToken(false);
      
      if (token) {
        this.accessToken = token;
        this.isAuthenticated = true;
        
        // 获取用户信息
        await this.fetchUserInfo();
        
        console.warn('用户已认证');
      } else {
        this.isAuthenticated = false;
        this.accessToken = null;
        this.userInfo = null;
        
        console.warn('用户未认证');
      }
      
    } catch (error) {
      console.error('检查认证状态失败:', error);
      this.isAuthenticated = false;
      this.accessToken = null;
      this.userInfo = null;
    }
  }

  /**
   * 获取认证状态
   */
  async getAuthStatus() {
    return this.isAuthenticated;
  }

  /**
   * 用户登出
   */
  async logout() {
    try {
      console.warn('开始用户登出...');
      
      if (this.accessToken) {
        // 撤销访问令牌
        await this.revokeToken(this.accessToken);
      }
      
      // 清除本地状态
      this.isAuthenticated = false;
      this.accessToken = null;
      this.userInfo = null;
      
      // 清除存储的认证状态
      await this.clearAuthState();
      
      // 通知认证状态变化
      this.notifyAuthStateChange(false);
      
      console.warn('用户登出成功');
      return true;
      
    } catch (error) {
      console.error('用户登出失败:', error);
      throw error;
    }
  }

  /**
   * 撤销访问令牌
   */
  async revokeToken(token) {
    try {
      // 从Chrome Identity API中移除缓存的令牌
      await new Promise((resolve, reject) => {
        chrome.identity.removeCachedAuthToken({ token }, () => {
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          resolve();
        });
      });
      
      // 从Google服务器撤销令牌
      const revokeUrl = `https://accounts.google.com/o/oauth2/revoke?token=${token}`;
      await fetch(revokeUrl);
      
      console.warn('访问令牌已撤销');
      
    } catch (error) {
      console.error('撤销访问令牌失败:', error);
      throw error;
    }
  }

  /**
   * 设置认证状态监听器
   */
  setupAuthListeners() {
    try {
      // 监听Chrome Identity API的认证状态变化
      chrome.identity.onSignInChanged.addListener((account, signedIn) => {
        console.warn('认证状态变化:', { account, signedIn });
        
        if (signedIn) {
          this.checkAuthStatus();
        } else {
          this.isAuthenticated = false;
          this.accessToken = null;
          this.userInfo = null;
          this.notifyAuthStateChange(false);
        }
      });
      
    } catch (error) {
      console.error('设置认证状态监听器失败:', error);
    }
  }

  /**
   * 添加认证状态变化监听器
   */
  onSignInChanged(callback) {
    if (typeof callback === 'function') {
      this.authListeners.push(callback);
    }
  }

  /**
   * 通知认证状态变化
   */
  notifyAuthStateChange(isAuthenticated) {
    this.authListeners.forEach(callback => {
      try {
        callback(isAuthenticated, this.userInfo);
      } catch (error) {
        console.error('执行认证状态变化回调失败:', error);
      }
    });
  }

  /**
   * 保存认证状态
   */
  async saveAuthState() {
    try {
      const authState = {
        isAuthenticated: this.isAuthenticated,
        accessToken: this.accessToken,
        userInfo: this.userInfo,
        timestamp: Date.now()
      };
      
      await chrome.storage.local.set({ authState });
      
    } catch (error) {
      console.error('保存认证状态失败:', error);
    }
  }

  /**
   * 清除认证状态
   */
  async clearAuthState() {
    try {
      await chrome.storage.local.remove(['authState']);
      
    } catch (error) {
      console.error('清除认证状态失败:', error);
    }
  }

  /**
   * 加载认证状态
   */
  async loadAuthState() {
    try {
      const result = await chrome.storage.local.get(['authState']);
      
      if (result.authState) {
        const { isAuthenticated, accessToken, userInfo, timestamp } = result.authState;
        
        // 检查状态是否过期（24小时）
        const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000;
        
        if (!isExpired && accessToken) {
          this.isAuthenticated = isAuthenticated;
          this.accessToken = accessToken;
          this.userInfo = userInfo;
          
          console.warn('认证状态已加载');
        } else {
          console.warn('认证状态已过期，需要重新认证');
          await this.clearAuthState();
        }
      }
      
    } catch (error) {
      console.error('加载认证状态失败:', error);
    }
  }

  /**
   * 获取访问令牌
   */
  getAccessToken() {
    return this.accessToken;
  }

  /**
   * 获取用户信息
   */
  getUserInfo() {
    return this.userInfo;
  }

  /**
   * 检查用户是否已认证
   */
  isUserAuthenticated() {
    return this.isAuthenticated;
  }

  /**
   * 刷新访问令牌
   */
  async refreshToken() {
    try {
      console.warn('刷新访问令牌...');
      
      // 获取新的访问令牌
      const newToken = await this.getAuthToken(true);
      
      if (newToken && newToken !== this.accessToken) {
        this.accessToken = newToken;
        
        // 保存新的认证状态
        await this.saveAuthState();
        
        console.warn('访问令牌已刷新');
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('刷新访问令牌失败:', error);
      throw error;
    }
  }

  /**
   * 验证访问令牌
   */
  async validateToken() {
    try {
      if (!this.accessToken) {
        return false;
      }
      
      const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });
      
      return response.ok;
      
    } catch (error) {
      console.error('验证访问令牌失败:', error);
      return false;
    }
  }

  /**
   * 获取认证URL
   */
  getAuthUrl() {
    const config = oauthConfig.getOAuthConfig();
    const scopes = config.scopes.join(' ');
    
    return `https://accounts.google.com/oauth/authorize?` +
           `client_id=${config.client_id}&` +
           `scope=${encodeURIComponent(scopes)}&` +
           `response_type=token&` +
           `redirect_uri=${chrome.identity.getRedirectURL()}`;
  }

  /**
   * 处理认证回调
   */
  async handleAuthCallback(url) {
    try {
      const urlObj = new URL(url);
      const token = urlObj.searchParams.get('access_token');
      
      if (token) {
        this.accessToken = token;
        this.isAuthenticated = true;
        
        // 获取用户信息
        await this.fetchUserInfo();
        
        // 保存认证状态
        await this.saveAuthState();
        
        // 通知认证状态变化
        this.notifyAuthStateChange(true);
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('处理认证回调失败:', error);
      return false;
    }
  }
}

// 创建单例实例
const googleAuthService = new GoogleAuthService();

// 导出服务实例
export default googleAuthService;