import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractCSSVariables } from './css-variables';

// Mock document.styleSheets since we are running in node environment
const mockDocument = {
  styleSheets: [] as unknown[],
};

vi.stubGlobal('document', mockDocument);

describe('extractCSSVariables', () => {
  beforeEach(() => {
    mockDocument.styleSheets = [];
  });

  it('extracts CSS custom properties from inline styles', () => {
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
          color: 'red',
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

    mockDocument.styleSheets = [crossOriginSheet];

    // Should not throw
    expect(() =>
      extractCSSVariables(mockElement, mockComputedStyle)
    ).not.toThrow();
    const result = extractCSSVariables(mockElement, mockComputedStyle);
    expect(result).toEqual({});
  });

  it('extracts design token variables from accessible stylesheets', () => {
    const mockStyle = {
      length: 0,
      getPropertyValue: vi.fn(() => ''),
    };

    const mockElement = {
      style: mockStyle,
    } as unknown as Element;

    const mockComputedStyle = {
      getPropertyValue: vi.fn((prop: string) => {
        const values: Record<string, string> = {
          '--color-primary': '#0D99FF',
          '--font-heading': 'Inter',
          '--unrelated-var': 'ignored',
        };
        return values[prop] || '';
      }),
    } as unknown as CSSStyleDeclaration;

    // Simulate a stylesheet with design token variables
    const mockSheet = {
      cssRules: [
        {
          constructor: { name: 'CSSStyleRule' },
          style: {
            length: 3,
            0: '--color-primary',
            1: '--font-heading',
            2: '--unrelated-var', // does not match known prefixes
          },
          [Symbol.hasInstance]: undefined,
        },
      ],
    };

    // We need to override instanceof check since we are mocking
    // The extractCSSVariables function checks `rule instanceof CSSStyleRule`
    // In node environment, CSSStyleRule doesn't exist, so we need to stub it
    const MockCSSStyleRule = function () {} as unknown as typeof CSSStyleRule;
    vi.stubGlobal('CSSStyleRule', MockCSSStyleRule);

    // Make the mock rule pass instanceof check
    Object.setPrototypeOf(mockSheet.cssRules[0], MockCSSStyleRule.prototype);

    mockDocument.styleSheets = [mockSheet];

    const result = extractCSSVariables(mockElement, mockComputedStyle);

    expect(result['--color-primary']).toBe('#0D99FF');
    expect(result['--font-heading']).toBe('Inter');
    // --unrelated-var does not match any known prefix, so should not be included
    expect(result).not.toHaveProperty('--unrelated-var');
  });
});
