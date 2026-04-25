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

// Phase 2: DevRev entities

export interface DevRevPart {
  id: string;
  display_id: string;
  name: string;
  description?: string;
  owned_by?: Array<{ id: string; display_name: string }>;
}

export interface DevRevUser {
  id: string;
  display_id: string;
  display_name: string;
  email?: string;
  full_name?: string;
  thumbnail?: string;
}

export interface CreateIssuePayload {
  title: string;
  description: string;
  partId: string;
  ownerId: string;
  priority: 'p0' | 'p1' | 'p2' | 'p3';
  reportedById: string;
  artifactIds?: string[];
}

export interface BrowserMetadata {
  url: string;
  title: string;
  viewportWidth: number;
  viewportHeight: number;
  userAgent: string;
  devicePixelRatio: number;
  platform: string;
}

export type PriorityLevel = 'p0' | 'p1' | 'p2' | 'p3';

export interface PriorityOption {
  id: PriorityLevel;
  label: string;
}
