export interface ElementMetadata {
  tagName: string;
  id: string;
  classList: string[];
  textContent: string; // Truncated to 200 chars
  domPath: string; // e.g. "body > div.app > header > nav > a.logo"
  boundingRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  computedStyles: Record<string, string>;
  cssVariables: Record<string, string>;
  contrastRatio: number | null;
  pageContext: {
    url: string;
    title: string;
  };
}

export interface AreaMetadata {
  selectionRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  elements: ElementMetadata[];
  pageContext: {
    url: string;
    title: string;
  };
}

export interface NitpickSettings {
  pat: string;
  openaiKey: string;
  domains: string[];
}

export type NitpickMode = 'idle' | 'inspecting';
