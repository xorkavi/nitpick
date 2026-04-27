const DEVREV_API_BASES = [
  'https://api.devrev.ai',
  'https://api.dev.devrev-eng.ai',
];

const MAX_BODY_SIZE = 200_000;

async function validatePAT(pat: string): Promise<boolean> {
  for (const base of DEVREV_API_BASES) {
    try {
      const res = await fetch(`${base}/dev-users.self`, {
        method: 'GET',
        headers: { Authorization: pat },
      });
      if (res.ok) return true;
    } catch {
      continue;
    }
  }
  return false;
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://');
}

export default async function handler(req: any, res: any) {
  const origin = req.headers.origin;

  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const pat = req.headers.authorization;
  if (!pat) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const valid = await validatePAT(pat);
  if (!valid) {
    return res.status(403).json({ error: 'Invalid DevRev PAT' });
  }

  const body = req.body;
  if (!body?.instructions || !body?.input) {
    return res.status(400).json({ error: 'Missing instructions or input' });
  }

  const rawSize = JSON.stringify(body).length;
  if (rawSize > MAX_BODY_SIZE) {
    return res.status(413).json({ error: 'Request too large' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.5',
        instructions: body.instructions,
        input: body.input,
        reasoning: { effort: 'low' },
        max_output_tokens: 1200,
        stream: true,
      }),
    });

    if (!openaiRes.ok) {
      return res.status(502).json({ error: 'AI service unavailable' });
    }

    const reader = openaiRes.body?.getReader();
    if (!reader) {
      return res.status(500).json({ error: 'No stream from AI service' });
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();

        if (payload === '[DONE]') {
          res.write('data: [DONE]\n\n');
          return res.end();
        }

        try {
          const event = JSON.parse(payload);
          if (event.type === 'response.output_text.delta') {
            res.write(`data: ${JSON.stringify({ delta: event.delta })}\n\n`);
          } else if (event.type === 'response.completed' || event.type === 'response.done') {
            res.write('data: [DONE]\n\n');
            return res.end();
          }
        } catch {
          // Skip malformed lines
        }
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'AI analysis failed';
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    } else {
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  }
}
