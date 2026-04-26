/**
 * OpenAI streaming AI analysis module.
 *
 * Implements the filter-then-describe prompt strategy (D-05):
 * AI receives user comment + element metadata, identifies relevant CSS
 * properties, and generates a concise issue title + description with
 * only the pertinent property values.
 *
 * Streaming relays chunks to the content script via port-based messaging
 * (AI_CHUNK / AI_DONE / AI_ERROR).
 */

import OpenAI from 'openai';
import type { ElementMetadata, AreaMetadata, BrowserMetadata, DevRevPart, DevRevUser } from '../shared/types';
import { getSettings } from './storage';
import { getScreenshots } from './screenshot-store';

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

interface ParsedAIResponse {
  title: string;
  description: string;
  suggestedPart?: string;
  suggestedOwner?: string;
}

/**
 * Parse structured sections from AI output.
 *
 * Expected format:
 *   TITLE: ...
 *   DESCRIPTION:
 *   ...
 *   PART: ...
 *   OWNER: ...
 */
export function parseAIResponse(content: string): ParsedAIResponse {
  const titleMatch = content.match(/TITLE:\s*(.+?)(?:\n|$)/);
  const descMatch = content.match(/DESCRIPTION:\s*\n([\s\S]*?)(?=\nPART:|$)/);
  const partMatch = content.match(/PART:\s*(.+?)(?:\n|$)/);
  const ownerMatch = content.match(/OWNER:\s*(.+?)(?:\n|$)/);

  const suggestedPart = partMatch?.[1]?.trim();
  const suggestedOwner = ownerMatch?.[1]?.trim();

  return {
    title: titleMatch?.[1]?.trim() || content.split('\n')[0]?.trim() || 'Untitled Issue',
    description: descMatch?.[1]?.trim() || content.split('\n').slice(1).join('\n').trim() || content.trim(),
    suggestedPart: suggestedPart && suggestedPart !== 'none' ? suggestedPart : undefined,
    suggestedOwner: suggestedOwner && suggestedOwner !== 'none' ? suggestedOwner : undefined,
  };
}

function buildRawIdentifiersBlock(metadata: ElementMetadata | AreaMetadata): string {
  if ('elements' in metadata) return '';

  const sections: string[] = [];

  // --- Search identifiers (ordered by grep priority) ---
  const searchIds: string[] = [];

  // 1. data-drid / data-testid (highest priority — unique, one-grep-to-source)
  const allDataAttrs = { ...metadata.dataAttributes };
  for (const ancestor of metadata.ancestorChain) {
    for (const [k, v] of Object.entries(ancestor.dataAttributes)) {
      if (!allDataAttrs[k]) allDataAttrs[k] = v;
    }
  }
  for (const child of metadata.childContext) {
    for (const [k, v] of Object.entries(child.dataAttributes)) {
      if (!allDataAttrs[k]) allDataAttrs[k] = `${v} (child)`;
    }
  }
  const drid = allDataAttrs['data-drid'];
  const testid = allDataAttrs['data-testid'];
  if (drid) searchIds.push(`data-drid: ${drid}`);
  if (testid) searchIds.push(`data-testid: ${testid}`);

  // 2. React component names (element + ancestors — map to filenames)
  const reactNames: string[] = [];
  if (metadata.reactComponentName) reactNames.push(metadata.reactComponentName);
  for (const a of metadata.ancestorChain) {
    if (a.reactComponentName) reactNames.push(a.reactComponentName);
  }
  for (const c of metadata.childContext) {
    if (c.reactComponentName) reactNames.push(`${c.reactComponentName} (child)`);
  }
  if (reactNames.length > 0) {
    searchIds.push(`React components: ${reactNames.join(' → ')}`);
  }

  // 3. Specific Tailwind classes (directly greppable, ultra-common ones filtered out)
  const TOO_COMMON = new Set(['overflow-hidden', 'overflow-auto', 'overflow-scroll', 'overflow-visible', 'truncate', 'whitespace-nowrap', 'whitespace-normal']);
  const isUsefulConstraint = (cls: string) =>
    /^(max-w-|max-h-|min-w-|min-h-|truncate|line-clamp-|overflow-|whitespace-|text-ellipsis|px-|py-|p-|pt-|pr-|pb-|pl-)/.test(cls)
    && !TOO_COMMON.has(cls);
  const constrainingTw = metadata.childContext
    .flatMap((c) => c.classList)
    .filter(isUsefulConstraint);
  const siblingTw = metadata.siblingContext
    .flatMap((s) => s.classList)
    .filter(isUsefulConstraint);
  const elementTw = metadata.classList.filter(isUsefulConstraint);
  const ancestorTw = metadata.ancestorChain
    .flatMap((a) => a.classList)
    .filter(isUsefulConstraint);
  const allConstrainingTw = [...new Set([...elementTw, ...ancestorTw, ...constrainingTw, ...siblingTw])];
  if (allConstrainingTw.length > 0) {
    searchIds.push(`Tailwind (constraining): ${allConstrainingTw.join(', ')}`);
  }

  if (searchIds.length > 0) {
    sections.push(`**Search identifiers** (grep these in order):\n${searchIds.map((s) => `1. \`${s}\``).join('\n')}`);
  }

  // --- HTML attributes on element ---
  if (Object.keys(metadata.htmlAttributes).length > 0) {
    sections.push(`**HTML attributes:** ${Object.entries(metadata.htmlAttributes).map(([k, v]) => `\`${k}="${v}"\``).join(', ')}`);
  }

  // --- Other data-* attributes ---
  const otherDataAttrs = Object.entries(allDataAttrs)
    .filter(([k]) => k !== 'data-drid' && k !== 'data-testid')
    .slice(0, 8);
  if (otherDataAttrs.length > 0) {
    sections.push(`**Data attributes:** ${otherDataAttrs.map(([k, v]) => `\`${k}="${v}"\``).join(', ')}`);
  }

  // --- DOM path ---
  sections.push(`**DOM path:** \`${metadata.domPath}\``);

  // --- Ancestor layout context (spacing, dimensions, overflow, positioning) ---
  const ancestorsWithLayout = metadata.ancestorChain.filter((a) => {
    const styles = a.computedStyles;
    const isPositioned = styles['position'] === 'relative' || styles['position'] === 'absolute' || styles['position'] === 'fixed';
    return isPositioned
      || styles['padding-top'] || styles['padding-right'] || styles['padding-bottom'] || styles['padding-left']
      || styles['margin-top'] || styles['margin-right'] || styles['margin-bottom'] || styles['margin-left']
      || styles['gap'] || styles['overflow'] || styles['max-width'] || styles['max-height'];
  });
  if (ancestorsWithLayout.length > 0) {
    const ancestorLines = ancestorsWithLayout.map((a) => {
      const parts = [`<${a.tagName}>`];
      if (a.reactComponentName) parts.push(`React: ${a.reactComponentName}`);
      const layoutClasses = a.classList.filter((cls) =>
        /^(p-|px-|py-|pt-|pr-|pb-|pl-|m-|mx-|my-|mt-|mr-|mb-|ml-|gap-|overflow-|max-w-|max-h-)/.test(cls));
      if (layoutClasses.length > 0) parts.push(`classes: ${layoutClasses.join(' ')}`);
      const styles = Object.entries(a.computedStyles)
        .filter(([, v]) => v && v !== '0px' && v !== 'visible' && v !== 'none' && v !== 'auto')
        .map(([k, v]) => `${k}: ${v}`);
      if (styles.length > 0) parts.push(styles.join('; '));
      return `- ${parts.join(' | ')}`;
    });
    sections.push(`**Ancestors with layout styles (parent → up):**\n${ancestorLines.join('\n')}`);
  }

  // --- Child element summary (with constraining styles or positioned overlays) ---
  const constrainingChildren = metadata.childContext.filter((c) => {
    const hasConstraint = Object.entries(c.computedStyles).some(([k]) =>
      ['max-width', 'max-height', 'min-width', 'min-height', 'overflow', 'text-overflow', 'white-space'].includes(k)
    );
    const isPositioned = c.computedStyles['position'] === 'absolute' || c.computedStyles['position'] === 'fixed';
    return hasConstraint || isPositioned || c.classList.some((cls) => /^(max-w-|truncate|line-clamp-|overflow-|whitespace-)/.test(cls));
  });
  if (constrainingChildren.length > 0) {
    const childLines = constrainingChildren.map((c) => {
      const parts = [`<${c.tagName}>`];
      if (c.reactComponentName) parts.push(`React: ${c.reactComponentName}`);
      const tw = c.classList.filter((cls) => /^(max-w-|max-h-|min-w-|min-h-|truncate|line-clamp-|overflow-|whitespace-|absolute|fixed|h-|w-)/.test(cls));
      if (tw.length > 0) parts.push(`classes: ${tw.join(' ')}`);
      const styles = Object.entries(c.computedStyles)
        .filter(([k]) => ['width', 'height', 'max-width', 'max-height', 'min-width', 'min-height', 'position', 'overflow', 'text-overflow', 'white-space'].includes(k))
        .filter(([, v]) => v && v !== 'auto' && v !== 'none' && v !== 'visible' && v !== 'static' && v !== 'normal')
        .map(([k, v]) => `${k}: ${v}`);
      if (styles.length > 0) parts.push(styles.join('; '));
      return `- ${parts.join(' | ')}`;
    });
    sections.push(`**Children with constraints:**\n${childLines.join('\n')}`);
  }

  // --- Sibling elements with layout significance (positioned overlays, decorators) ---
  const layoutSiblings = metadata.siblingContext.filter((s) => {
    const isPositioned = s.computedStyles['position'] === 'absolute' || s.computedStyles['position'] === 'fixed';
    const hasConstraint = Object.entries(s.computedStyles).some(([k]) =>
      ['max-width', 'max-height', 'min-width', 'min-height', 'overflow', 'text-overflow', 'white-space'].includes(k)
    );
    return isPositioned || hasConstraint;
  });
  if (layoutSiblings.length > 0) {
    const sibLines = layoutSiblings.map((s) => {
      const parts = [`<${s.tagName}>`];
      if (s.reactComponentName) parts.push(`React: ${s.reactComponentName}`);
      const tw = s.classList.filter((cls) => /^(max-w-|max-h-|min-w-|min-h-|h-|w-|absolute|fixed|overflow-|whitespace-)/.test(cls));
      if (tw.length > 0) parts.push(`classes: ${tw.join(' ')}`);
      const styles = Object.entries(s.computedStyles)
        .filter(([k]) => ['width', 'height', 'max-width', 'max-height', 'min-width', 'min-height', 'position', 'overflow'].includes(k))
        .filter(([, v]) => v && v !== 'auto' && v !== 'none' && v !== 'visible' && v !== 'static' && v !== 'normal')
        .map(([k, v]) => `${k}: ${v}`);
      if (styles.length > 0) parts.push(styles.join('; '));
      return `- ${parts.join(' | ')}`;
    });
    sections.push(`**Siblings with layout significance (positioned overlays, decorators):**\n${sibLines.join('\n')}`);
  }

  if (sections.length <= 1) return '';
  return '\n\n---\n### Code identifiers (auto-captured from DOM)\n' + sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

/**
 * Build the system prompt with filter-then-describe instructions (D-05, D-07, D-09).
 * Includes available Parts and Team Members for AI suggestions (D-08).
 */
function buildSystemPrompt(
  parts: DevRevPart[],
  users: DevRevUser[],
): string {
  const partsContext = parts
    .map((p) => `- ${p.name} (${p.id})${p.description ? ': ' + p.description : ''}`)
    .join('\n');

  const usersContext = users
    .map((u) => `- ${u.display_name} (${u.id})`)
    .join('\n');

  return `You are a senior QA engineer writing bug reports for a web application. You write precise, actionable JIRA-style issue titles and descriptions.

TASK: Given a user's plain-language bug description, an element's CSS/DOM metadata, and optionally a screenshot of the selected area, generate:
1. A JIRA-style issue title: "[Component/Area] Specific problem description" (max 80 chars). Examples:
   - "[Tabs] Selected tab text misaligned with container bounds"
   - "[Sidebar] Chat list items overlap at narrow viewport widths"
   - "[Button] Primary CTA color does not match design system token"
   The title MUST immediately convey what is wrong and where.
2. A description with:
   - A 1-2 sentence diagnosis explaining WHY the problem occurs based on the DOM data (don't just restate the complaint)
   - 3-5 bullet points listing ONLY the CSS/DOM properties relevant to the user's complaint, with actual computed values
3. A suggested Part (from the list below) — match by page URL or component area
4. A suggested Owner (from the list below)

RULES:
- FILTER first: read the user's complaint, then identify which properties from the metadata explain that specific problem. You receive extensive DOM data — most of it is irrelevant to any given bug. Your job is triage, not transcription.
- Reference ONLY the properties that explain or contribute to the user's complaint. Ignore everything else, even if it looks unusual.
- Do NOT dump all CSS properties — 3-5 targeted bullets is the goal
- Format property values clearly: "font-size: 12px"
- If you can infer expected values from context, note them: "font-size: 12px (expected: 14px based on sibling elements)"
- Keep the description under 200 words
- If a screenshot is provided, use visual context to be more precise about the problem
- When reporting affected properties, include BOTH computed CSS values AND the raw HTML/component attribute values that likely control them. For example, if a button's size comes from a size="M" attribute, report that alongside the computed CSS.
- If a Tailwind class like \`max-w-32\` or \`truncate\` is the likely cause, include it alongside the computed value — Tailwind classes are directly greppable in source code.
- IMPORTANT: The root cause is often on a CHILD or SIBLING element, not the selected element itself. Check children AND siblings carefully:
  - Children: their computed styles (max-width, min-width, overflow, white-space, text-overflow) and Tailwind classes often contain the actual constraint.
  - Siblings: absolutely-positioned siblings are often visual overlays, backgrounds, or decorators (e.g., active-tab highlight pills, selection indicators). When you see a sibling with position: absolute, its width/height mismatching the parent's inner dimensions is a common root cause for alignment bugs. Report THAT element's properties.
  - When a positioned sibling's height/width doesn't fit inside the parent's content area (parent size minus padding), flag the mismatch explicitly.
- Do NOT include a "Code identifiers" section — that is auto-appended separately. Focus only on the human-readable analysis.

OUTPUT FORMAT (use exactly these section markers on their own line):
TITLE: [title here]
DESCRIPTION:
[Write in Markdown format. Use **bold** for property names, \`code\` for values.]

[1-2 sentence diagnosis: combine the user's complaint with the DOM data to explain WHY the problem occurs. Don't restate what the user said — add what the data reveals. If you can identify the specific mismatch or conflict causing the issue, state it here.]

**What's wrong:**
- [element] **property:** \`actual-value\` — expected \`expected-value\` [reason]
- (3-5 bullets max, each naming which element the property is on: "selected element", "child <button>", "sibling <span>", "parent <div>")

**Root cause element:** [which element — selected / child / sibling / ancestor] with [its key class or identifier]
(Skip this line if the root cause IS the selected element itself)

**Environment:**
| Property | Value |
|----------|-------|
| Browser | [e.g. Chrome 145.0.0.0] |
| OS | [e.g. macOS 10.15.7, Windows 11, etc — extract from user agent] |
| Viewport | [e.g. 1723x994] |
| DPR | [device pixel ratio if available] |
| Page | [clickable markdown link: [page title](url)]  |

PART: [part_id or "none"]
OWNER: [user_id or "none"]

AVAILABLE PARTS:
${partsContext || '(no parts available)'}

AVAILABLE TEAM MEMBERS:
${usersContext || '(no users available)'}`;
}

// ---------------------------------------------------------------------------
// User message builder
// ---------------------------------------------------------------------------

/**
 * Build the user message from the comment, element/area metadata, and browser context.
 *
 * For area selections, limits to top 5 elements (Research Pitfall 7).
 */
function parseUserAgent(ua: string): { browser: string; os: string } {
  let browser = 'Unknown';
  let os = 'Unknown';

  const chromeMatch = ua.match(/Chrome\/(\d+[\d.]*)/);
  const firefoxMatch = ua.match(/Firefox\/(\d+[\d.]*)/);
  const safariMatch = ua.match(/Version\/(\d+[\d.]*).*Safari/);
  if (chromeMatch) browser = `Chrome ${chromeMatch[1]}`;
  else if (firefoxMatch) browser = `Firefox ${firefoxMatch[1]}`;
  else if (safariMatch) browser = `Safari ${safariMatch[1]}`;

  if (ua.includes('Mac OS X')) {
    const v = ua.match(/Mac OS X ([\d_]+)/);
    os = `macOS ${v ? v[1].replace(/_/g, '.') : ''}`.trim();
  } else if (ua.includes('Windows NT')) {
    const v = ua.match(/Windows NT ([\d.]+)/);
    const winMap: Record<string, string> = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' };
    os = `Windows ${v ? winMap[v[1]] || v[1] : ''}`.trim();
  } else if (ua.includes('Linux')) {
    os = 'Linux';
  } else if (ua.includes('Android')) {
    os = 'Android';
  } else if (ua.includes('iOS') || ua.includes('iPhone')) {
    os = 'iOS';
  }

  return { browser, os };
}

function buildEnvironmentBlock(bm: BrowserMetadata): string {
  const { browser, os } = parseUserAgent(bm.userAgent || '');
  return `ENVIRONMENT (copy this table verbatim into the description):
| Property | Value |
|----------|-------|
| Browser | ${browser} |
| OS | ${os} |
| Viewport | ${bm.viewportWidth}x${bm.viewportHeight} |
| DPR | ${bm.devicePixelRatio || 1} |
| Page | [${bm.title || 'Page'}](${bm.url}) |`;
}

function buildUserMessage(
  comment: string,
  metadata: ElementMetadata | AreaMetadata,
  browserMetadata: BrowserMetadata,
): string {
  const envBlock = buildEnvironmentBlock(browserMetadata);

  if ('elements' in metadata) {
    const topElements = metadata.elements.slice(0, 5);
    return `User's complaint: "${comment}"

${envBlock}

Selected area: ${metadata.selectionRect.width}x${metadata.selectionRect.height}px
Elements in area (${metadata.elements.length} total, showing top ${topElements.length}):

${topElements
  .map(
    (el, i) => `Element ${i + 1}: <${el.tagName}> "${el.textContent.slice(0, 50)}"
  Path: ${el.domPath}
  Key styles: ${JSON.stringify(el.computedStyles, null, 2)}`,
  )
  .join('\n\n')}`;
  }

  const dataAttrsBlock = Object.keys(metadata.dataAttributes).length > 0
    ? `Data attributes:\n${Object.entries(metadata.dataAttributes).map(([k, v]) => `  ${k}="${v}"`).join('\n')}`
    : 'Data attributes: (none)';

  const htmlAttrsBlock = Object.keys(metadata.htmlAttributes).length > 0
    ? `HTML attributes:\n${Object.entries(metadata.htmlAttributes).map(([k, v]) => `  ${k}="${v}"`).join('\n')}`
    : '';

  const reactBlock = metadata.reactComponentName
    ? `React component: ${metadata.reactComponentName}`
    : 'React component: (not detected)';

  const ancestorBlock = metadata.ancestorChain.length > 0
    ? `Ancestor chain (parent → great-grandparent):\n${metadata.ancestorChain.map((a, i) => {
        const parts = [`  ${i + 1}. <${a.tagName}>`];
        if (a.reactComponentName) parts.push(`React: ${a.reactComponentName}`);
        if (a.classList.length > 0) parts.push(`classes: ${a.classList.join(' ')}`);
        const dAttrs = Object.entries(a.dataAttributes);
        if (dAttrs.length > 0) parts.push(dAttrs.map(([k, v]) => `${k}="${v}"`).join(' '));
        return parts.join(' | ');
      }).join('\n')}`
    : '';

  const siblingBlock = metadata.siblingContext.length > 0
    ? `Sibling elements in same container:\n${metadata.siblingContext.map((s) => {
        const parts = [`  - <${s.tagName}> "${s.textContent.slice(0, 50)}"`];
        if (s.reactComponentName) parts.push(`React: ${s.reactComponentName}`);
        if (s.classList.length > 0) parts.push(`classes: ${s.classList.join(' ')}`);
        const dAttrs = Object.entries(s.dataAttributes);
        if (dAttrs.length > 0) parts.push(dAttrs.map(([k, v]) => `${k}="${v}"`).join(' '));
        const hAttrs = Object.entries(s.htmlAttributes);
        if (hAttrs.length > 0) parts.push(hAttrs.map(([k, v]) => `${k}="${v}"`).join(' '));
        const styles = Object.entries(s.computedStyles)
          .filter(([, v]) => v && v !== '0px' && v !== 'auto' && v !== 'none' && v !== 'visible' && v !== 'static' && v !== 'normal')
          .map(([k, v]) => `${k}: ${v}`);
        if (styles.length > 0) parts.push(`styles: ${styles.join('; ')}`);
        return parts.join(' | ');
      }).join('\n')}`
    : '';

  const childBlock = metadata.childContext.length > 0
    ? `Child elements (direct children of selected element):\n${metadata.childContext.map((c) => {
        const parts = [`  - <${c.tagName}> "${c.textContent.slice(0, 50)}"`];
        if (c.reactComponentName) parts.push(`React: ${c.reactComponentName}`);
        if (c.classList.length > 0) parts.push(`classes: ${c.classList.join(' ')}`);
        const dAttrs = Object.entries(c.dataAttributes);
        if (dAttrs.length > 0) parts.push(dAttrs.map(([k, v]) => `${k}="${v}"`).join(' '));
        const hAttrs = Object.entries(c.htmlAttributes);
        if (hAttrs.length > 0) parts.push(hAttrs.map(([k, v]) => `${k}="${v}"`).join(' '));
        const styles = Object.entries(c.computedStyles)
          .filter(([, v]) => v && v !== '0px' && v !== 'auto' && v !== 'none' && v !== 'visible' && v !== 'static' && v !== 'normal')
          .map(([k, v]) => `${k}: ${v}`);
        if (styles.length > 0) parts.push(`styles: ${styles.join('; ')}`);
        return parts.join(' | ');
      }).join('\n')}`
    : '';

  return `User's complaint: "${comment}"

${envBlock}

Element: <${metadata.tagName}> "${metadata.textContent.slice(0, 100)}"
${reactBlock}
Path: ${metadata.domPath}
Classes: ${metadata.classList.join(' ')}
${dataAttrsBlock}
${htmlAttrsBlock ? htmlAttrsBlock + '\n' : ''}Dimensions: ${metadata.boundingRect.width}x${metadata.boundingRect.height}px at (${metadata.boundingRect.x}, ${metadata.boundingRect.y})
Contrast ratio: ${metadata.contrastRatio ?? 'N/A'}
${childBlock ? '\n' + childBlock : ''}
${ancestorBlock ? '\n' + ancestorBlock : ''}
${siblingBlock ? '\n' + siblingBlock : ''}
Computed styles:
${JSON.stringify(metadata.computedStyles, null, 2)}

CSS variables:
${JSON.stringify(metadata.cssVariables, null, 2)}`;
}

// ---------------------------------------------------------------------------
// Streaming analysis
// ---------------------------------------------------------------------------

/**
 * Stream AI analysis results to the content script via port-based messaging.
 *
 * Uses the OpenAI Responses API (required for GPT-5.5) with streaming.
 * Relays each text delta as an AI_CHUNK message. On completion, parses
 * the accumulated response and sends AI_DONE. On any error, sends AI_ERROR.
 *
 * Uses dangerouslyAllowBrowser: true because the service worker is an
 * extension context (not a web page) -- safe per Research Pitfall 4.
 */
export async function streamAnalysis(
  port: chrome.runtime.Port,
  comment: string,
  metadata: ElementMetadata | AreaMetadata,
  browserMetadata: BrowserMetadata,
): Promise<void> {
  try {
    const settings = await getSettings();

    if (!settings.openaiKey) {
      port.postMessage({
        action: 'AI_ERROR',
        message: 'OpenAI API key not configured. Please set it in the extension settings.',
      });
      return;
    }

    const client = new OpenAI({
      apiKey: settings.openaiKey,
      dangerouslyAllowBrowser: true,
    });

    const parts: import('../shared/types').DevRevPart[] = [];
    const users: import('../shared/types').DevRevUser[] = [];

    const systemPrompt = buildSystemPrompt(parts, users);
    const userMessage = buildUserMessage(comment, metadata, browserMetadata);

    const screenshots = getScreenshots();
    const userContent: OpenAI.Responses.ResponseInputContent[] = [
      { type: 'input_text', text: userMessage },
    ];

    if (screenshots.cropped) {
      userContent.push({
        type: 'input_image',
        image_url: screenshots.cropped,
        detail: 'low',
      });
    }

    const stream = client.responses.stream({
      model: 'gpt-5.5',
      instructions: systemPrompt,
      input: [
        { role: 'user', content: userContent },
      ],
      reasoning: { effort: 'low' },
      max_output_tokens: 1200,
    });

    let fullContent = '';

    stream.on('response.output_text.delta', (event) => {
      fullContent += event.delta;
      try {
        port.postMessage({ action: 'AI_CHUNK', delta: event.delta, snapshot: fullContent });
      } catch {
        // Port may have disconnected -- stream will end naturally
      }
    });

    stream.on('response.output_text.done', () => {
      const parsed = parseAIResponse(fullContent);
      const rawBlock = buildRawIdentifiersBlock(metadata);
      try {
        port.postMessage({
          action: 'AI_DONE',
          title: parsed.title,
          description: parsed.description + rawBlock,
          suggestedPart: parsed.suggestedPart,
          suggestedOwner: parsed.suggestedOwner,
        });
      } catch {
        // Port may have disconnected
      }
    });

    stream.on('error', (error: unknown) => {
      try {
        port.postMessage({
          action: 'AI_ERROR',
          message: error instanceof Error ? error.message : 'AI analysis failed',
        });
      } catch {
        // Port may have disconnected
      }
    });

    await stream.finalResponse();
  } catch (error) {
    try {
      port.postMessage({
        action: 'AI_ERROR',
        message: error instanceof Error ? error.message : 'AI analysis failed',
      });
    } catch {
      // Port may have disconnected
    }
  }
}
