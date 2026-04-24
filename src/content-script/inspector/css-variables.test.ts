import { describe, it, expect, vi } from 'vitest';
import { extractCSSVariables } from './css-variables';

describe('extractCSSVariables', () => {
  it('extracts CSS custom properties from inline styles', () => {
    // Create a mock element with inline style containing custom properties
    const mockStyle = {
      length: 2,
      0: '--color-primary',
      1: '--font-size-base',
      getPropertyValue: vi.fn((prop: string) => {
        const values: Record<string, string> = {
          '--color-primary': '#0D99FF',
          '--font-size-base': '16px',
        };
        return values[prop] || '';
      }),
    };

    const mockElement = {
      style: mockStyle,
    } as unknown as Element;

    const mockComputedStyle = {
      getPropertyValue: vi.fn(() => ''),
    } as unknown as CSSStyleDeclaration;

    // Mock document.styleSheets as empty
    Object.defineProperty(document, 'styleSheets', {
      value: [],
      writable: true,
      configurable: true,
    });

    const result = extractCSSVariables(mockElement, mockComputedStyle);

    expect(result['--color-primary']).toBe('#0D99FF');
    expect(result['--font-size-base']).toBe('16px');
  });

  it('ignores non-custom properties from inline styles', () => {
    const mockStyle = {
      length: 2,
      0: 'color',
      1: '--custom-var',
      getPropertyValue: vi.fn((prop: string) => {
        const values: Record<string, string> = {
          'color': 'red',
          '--custom-var': 'blue',
        };
        return values[prop] || '';
      }),
    };

    const mockElement = {
      style: mockStyle,
    } as unknown as Element;

    const mockComputedStyle = {
      getPropertyValue: vi.fn(() => ''),
    } as unknown as CSSStyleDeclaration;

    Object.defineProperty(document, 'styleSheets', {
      value: [],
      writable: true,
      configurable: true,
    });

    const result = extractCSSVariables(mockElement, mockComputedStyle);

    expect(result).not.toHaveProperty('color');
    expect(result['--custom-var']).toBe('blue');
  });

  it('returns empty object when no custom properties exist', () => {
    const mockStyle = {
      length: 0,
      getPropertyValue: vi.fn(() => ''),
    };

    const mockElement = {
      style: mockStyle,
    } as unknown as Element;

    const mockComputedStyle = {
      getPropertyValue: vi.fn(() => ''),
    } as unknown as CSSStyleDeclaration;

    Object.defineProperty(document, 'styleSheets', {
      value: [],
      writable: true,
      configurable: true,
    });

    const result = extractCSSVariables(mockElement, mockComputedStyle);
    expect(result).toEqual({});
  });

  it('handles cross-origin stylesheet errors gracefully', () => {
    const mockStyle = {
      length: 0,
      getPropertyValue: vi.fn(() => ''),
    };

    const mockElement = {
      style: mockStyle,
    } as unknown as Element;

    const mockComputedStyle = {
      getPropertyValue: vi.fn(() => ''),
    } as unknown as CSSStyleDeclaration;

    // Simulate a cross-origin stylesheet that throws on cssRules access
    const crossOriginSheet = {
      get cssRules(): never {
        throw new DOMException('SecurityError');
      },
    };

    Object.defineProperty(document, 'styleSheets', {
      value: [crossOriginSheet],
      writable: true,
      configurable: true,
    });

    // Should not throw
    expect(() => extractCSSVariables(mockElement, mockComputedStyle)).not.toThrow();
    const result = extractCSSVariables(mockElement, mockComputedStyle);
    expect(result).toEqual({});
  });
});
