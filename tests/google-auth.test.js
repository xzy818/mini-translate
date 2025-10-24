// tests/google-auth.test.js
import { googleAuthService } from '../src/services/google-auth.js';

describe('GoogleAuthService', () => {
  beforeEach(() => {
    // Mock chrome.identity API
    global.chrome = {
      identity: {
        getAuthToken: jest.fn(),
        removeCachedAuthToken: jest.fn(),
        onSignInChanged: {
          addListener: jest.fn()
        }
      },
      runtime: {
        lastError: null
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should resolve with token when authentication succeeds', async () => {
      const mockToken = 'mock-access-token';
      chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        callback(mockToken);
      });

      const result = await googleAuthService.authenticate();
      expect(result).toBe(mockToken);
      expect(chrome.identity.getAuthToken).toHaveBeenCalledWith(
        { interactive: true },
        expect.any(Function)
      );
    });

    it('should reject when authentication fails', async () => {
      const mockError = new Error('Authentication failed');
      chrome.runtime.lastError = mockError;
      chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        callback(null);
      });

      await expect(googleAuthService.authenticate()).rejects.toThrow('Authentication failed');
    });
  });

  describe('getAuthStatus', () => {
    it('should return true when user is authenticated', async () => {
      const mockToken = 'mock-access-token';
      chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        callback(mockToken);
      });

      const result = await googleAuthService.getAuthStatus();
      expect(result).toBe(true);
      expect(chrome.identity.getAuthToken).toHaveBeenCalledWith(
        { interactive: false },
        expect.any(Function)
      );
    });

    it('should return false when user is not authenticated', async () => {
      chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        callback(null);
      });

      const result = await googleAuthService.getAuthStatus();
      expect(result).toBe(false);
    });
  });

  describe('logout', () => {
    it('should revoke token and clear cache on successful logout', async () => {
      const mockToken = 'mock-access-token';
      chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        callback(mockToken);
      });
      chrome.identity.removeCachedAuthToken.mockImplementation((options, callback) => {
        callback();
      });

      // Mock fetch for token revocation
      global.fetch = jest.fn().mockResolvedValue({ ok: true });

      const result = await googleAuthService.logout();
      expect(result).toBe(true);
      expect(chrome.identity.removeCachedAuthToken).toHaveBeenCalledWith(
        { token: mockToken },
        expect.any(Function)
      );
      expect(fetch).toHaveBeenCalledWith(
        `https://accounts.google.com/o/oauth2/revoke?token=${mockToken}`
      );
    });

    it('should return false when no token to revoke', async () => {
      chrome.identity.getAuthToken.mockImplementation((options, callback) => {
        callback(null);
      });

      const result = await googleAuthService.logout();
      expect(result).toBe(false);
    });
  });

  describe('onSignInChanged', () => {
    it('should add listener for sign in changes', () => {
      const mockCallback = jest.fn();
      googleAuthService.onSignInChanged(mockCallback);
      expect(chrome.identity.onSignInChanged.addListener).toHaveBeenCalledWith(mockCallback);
    });
  });
});
