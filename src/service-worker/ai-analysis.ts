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
import { getCachedParts, getCachedUsers } from './devrev-api';
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
   - One summary paragraph (2-3 sentences) explaining the visual defect
   - 3-5 bullet points listing ONLY the CSS/DOM properties relevant to the user's complaint, with actual computed values
3. A suggested Part (from the list below) — match by page URL or component area
4. A suggested Owner (from the list below)

RULES:
- FILTER first: identify which properties relate to the user's complaint
- Reference ONLY relevant properties with their actual values
- Do NOT dump all CSS properties
- Format property values clearly: "font-size: 12px"
- If you can infer expected values from context, note them: "font-size: 12px (expected: 14px based on sibling elements)"
- Keep the description under 200 words
- If a screenshot is provided, use visual context to be more precise about the problem

OUTPUT FORMAT (use exactly these section markers on their own line):
TITLE: [title here]
DESCRIPTION:
[Write in Markdown format. Use **bold** for property names, \`code\` for values.]

[summary paragraph]

**Affected properties:**
- **property-name:** \`actual-value\` (expected: \`expected-value\`)
- **property-name:** \`actual-value\`

**Environment:** [browser, viewport]
**Page:** [page URL as a clickable markdown link: [title](url)]

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
function buildUserMessage(
  comment: string,
  metadata: ElementMetadata | AreaMetadata,
  browserMetadata: BrowserMetadata,
): string {
  // Area selection
  if ('elements' in metadata) {
    const topElements = metadata.elements.slice(0, 5);
    return `User's complaint: "${comment}"

Page: ${metadata.pageContext.url} - ${metadata.pageContext.title}
Browser: ${browserMetadata.viewportWidth}x${browserMetadata.viewportHeight}
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

  // Single element
  return `User's complaint: "${comment}"

Page: ${metadata.pageContext.url} - ${metadata.pageContext.title}
Browser: ${browserMetadata.viewportWidth}x${browserMetadata.viewportHeight}, ${browserMetadata.userAgent}
Element: <${metadata.tagName}> "${metadata.textContent.slice(0, 100)}"
Path: ${metadata.domPath}
Classes: ${metadata.classList.join(' ')}
Dimensions: ${metadata.boundingRect.width}x${metadata.boundingRect.height}px at (${metadata.boundingRect.x}, ${metadata.boundingRect.y})
Contrast ratio: ${metadata.contrastRatio ?? 'N/A'}

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
 * Opens an OpenAI streaming chat completion and relays each content delta
 * as an AI_CHUNK message. On completion, parses the accumulated response
 * and sends AI_DONE. On any error, sends AI_ERROR.
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

    const parts = getCachedParts();
    const users = getCachedUsers();

    const systemPrompt = buildSystemPrompt(parts, users);
    const userMessage = buildUserMessage(comment, metadata, browserMetadata);

    const screenshots = getScreenshots();
    const userContent: OpenAI.ChatCompletionContentPart[] = [
      { type: 'text', text: userMessage },
    ];

    if (screenshots.cropped) {
      userContent.push({
        type: 'image_url',
        image_url: { url: screenshots.cropped, detail: 'low' },
      });
    }

    const stream = client.chat.completions.stream({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    let fullContent = '';

    stream.on('content.delta', ({ delta }) => {
      fullContent += delta;
      try {
        port.postMessage({ action: 'AI_CHUNK', delta, snapshot: fullContent });
      } catch {
        // Port may have disconnected -- stream will end naturally
      }
    });

    stream.on('content.done', () => {
      const parsed = parseAIResponse(fullContent);
      try {
        port.postMessage({
          action: 'AI_DONE',
          title: parsed.title,
          description: parsed.description,
          suggestedPart: parsed.suggestedPart,
          suggestedOwner: parsed.suggestedOwner,
        });
      } catch {
        // Port may have disconnected
      }
    });

    stream.on('error', (error: Error) => {
      try {
        port.postMessage({
          action: 'AI_ERROR',
          message: error instanceof Error ? error.message : 'AI analysis failed',
        });
      } catch {
        // Port may have disconnected
      }
    });

    // Wait for stream to complete -- keeps service worker alive (Research Pitfall 3)
    await stream.done();
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
