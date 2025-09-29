/**
 * 设计系统测试
 * 验证设计系统CSS变量的正确性和一致性
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('设计系统测试', () => {
  let designSystemCSS;

  beforeAll(() => {
    try {
      designSystemCSS = readFileSync(join(process.cwd(), 'public/design-system.css'), 'utf-8');
    } catch (error) {
      console.warn('无法读取设计系统CSS文件:', error.message);
      designSystemCSS = '';
    }
  });

  describe('CSS变量定义', () => {
    it('应该定义所有必要的颜色变量', () => {
      const requiredColors = [
        '--bg', '--panel', '--border', '--text-main', '--text-secondary',
        '--accent', '--danger', '--success', '--warning'
      ];
      
      requiredColors.forEach(colorVar => {
        expect(designSystemCSS).toContain(colorVar);
      });
    });

    it('应该定义所有必要的间距变量', () => {
      const requiredSpacing = [
        '--spacing-xs', '--spacing-sm', '--spacing-md', '--spacing-lg',
        '--spacing-xl', '--spacing-2xl', '--spacing-3xl'
      ];
      
      requiredSpacing.forEach(spacingVar => {
        expect(designSystemCSS).toContain(spacingVar);
      });
    });

    it('应该定义所有必要的圆角变量', () => {
      const requiredRadius = [
        '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-full'
      ];
      
      requiredRadius.forEach(radiusVar => {
        expect(designSystemCSS).toContain(radiusVar);
      });
    });

    it('应该定义所有必要的阴影变量', () => {
      const requiredShadows = [
        '--shadow-sm', '--shadow-md', '--shadow-lg'
      ];
      
      requiredShadows.forEach(shadowVar => {
        expect(designSystemCSS).toContain(shadowVar);
      });
    });

    it('应该定义所有必要的字体变量', () => {
      const requiredFonts = [
        '--font-family', '--font-size-xs', '--font-size-sm', '--font-size-base',
        '--font-size-lg', '--font-size-xl', '--font-size-2xl', '--font-size-3xl', '--font-size-4xl'
      ];
      
      requiredFonts.forEach(fontVar => {
        expect(designSystemCSS).toContain(fontVar);
      });
    });

    it('应该定义所有必要的字重变量', () => {
      const requiredWeights = [
        '--font-weight-normal', '--font-weight-medium', '--font-weight-semibold', '--font-weight-bold'
      ];
      
      requiredWeights.forEach(weightVar => {
        expect(designSystemCSS).toContain(weightVar);
      });
    });
  });

  describe('组件类定义', () => {
    it('应该定义按钮组件类', () => {
      const buttonClasses = [
        '.btn', '.btn--primary', '.btn--secondary', '.btn--danger', '.btn--success'
      ];
      
      buttonClasses.forEach(buttonClass => {
        expect(designSystemCSS).toContain(buttonClass);
      });
    });

    it('应该定义表单组件类', () => {
      const formClasses = [
        '.form-group', 'label', 'input', 'select', 'textarea'
      ];
      
      formClasses.forEach(formClass => {
        expect(designSystemCSS).toContain(formClass);
      });
    });

    it('应该定义信息框组件类', () => {
      const alertClasses = [
        '.info-box', '.info-box--info', '.info-box--success', '.info-box--warning', '.info-box--error'
      ];
      
      alertClasses.forEach(alertClass => {
        expect(designSystemCSS).toContain(alertClass);
      });
    });

    it('应该定义面板组件类', () => {
      const panelClasses = [
        '.panel', '.panel--compact'
      ];
      
      panelClasses.forEach(panelClass => {
        expect(designSystemCSS).toContain(panelClass);
      });
    });

    it('应该定义状态徽章组件类', () => {
      const badgeClasses = [
        '.status-badge', '.status-badge--active', '.status-badge--error', '.status-dot'
      ];
      
      badgeClasses.forEach(badgeClass => {
        expect(designSystemCSS).toContain(badgeClass);
      });
    });
  });

  describe('工具类定义', () => {
    it('应该定义间距工具类', () => {
      const spacingClasses = [
        '.mt-0', '.mt-sm', '.mt-md', '.mt-lg', '.mt-xl',
        '.mb-0', '.mb-sm', '.mb-md', '.mb-lg', '.mb-xl'
      ];
      
      spacingClasses.forEach(spacingClass => {
        expect(designSystemCSS).toContain(spacingClass);
      });
    });

    it('应该定义布局工具类', () => {
      const layoutClasses = [
        '.flex', '.flex-col', '.items-center', '.justify-center', '.justify-between',
        '.gap-sm', '.gap-md', '.gap-lg'
      ];
      
      layoutClasses.forEach(layoutClass => {
        expect(designSystemCSS).toContain(layoutClass);
      });
    });

    it('应该定义显示工具类', () => {
      const displayClasses = [
        '.hidden', '.visible', '.text-center', '.text-left', '.text-right'
      ];
      
      displayClasses.forEach(displayClass => {
        expect(designSystemCSS).toContain(displayClass);
      });
    });
  });

  describe('响应式设计', () => {
    it('应该包含响应式媒体查询', () => {
      expect(designSystemCSS).toContain('@media (max-width: 768px)');
    });

    it('应该包含移动端样式调整', () => {
      const mobileStyles = [
        'padding: var(--spacing-lg)',
        'flex-direction: column'
      ];
      
      mobileStyles.forEach(style => {
        expect(designSystemCSS).toContain(style);
      });
    });
  });

  describe('CSS变量使用', () => {
    it('按钮应该使用设计系统变量', () => {
      expect(designSystemCSS).toContain('var(--accent)');
      expect(designSystemCSS).toContain('var(--panel)');
      expect(designSystemCSS).toContain('var(--radius-full)');
    });

    it('表单应该使用设计系统变量', () => {
      expect(designSystemCSS).toContain('var(--border)');
      expect(designSystemCSS).toContain('var(--text-main)');
      expect(designSystemCSS).toContain('var(--spacing-md)');
    });

    it('面板应该使用设计系统变量', () => {
      expect(designSystemCSS).toContain('var(--panel)');
      expect(designSystemCSS).toContain('var(--radius-xl)');
      expect(designSystemCSS).toContain('var(--shadow-lg)');
    });
  });

  describe('可访问性支持', () => {
    it('应该包含焦点状态样式', () => {
      expect(designSystemCSS).toContain(':focus');
      expect(designSystemCSS).toContain('outline: none');
    });

    it('应该包含禁用状态样式', () => {
      expect(designSystemCSS).toContain(':disabled');
      expect(designSystemCSS).toContain('cursor: not-allowed');
    });

    it('应该包含悬停状态样式', () => {
      expect(designSystemCSS).toContain(':hover');
    });
  });

  describe('浏览器兼容性', () => {
    it('应该使用现代CSS特性', () => {
      expect(designSystemCSS).toContain('box-sizing: border-box');
      expect(designSystemCSS).toContain('display: flex');
      expect(designSystemCSS).toContain('transition:');
    });

    it('应该包含回退方案', () => {
      // 检查是否有适当的回退值
      expect(designSystemCSS).toContain('font-family:');
    });
  });
});
