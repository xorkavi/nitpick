import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const DEVREV_API_BASES = [
  'https://api.devrev.ai',
  'https://api.dev.devrev-eng.ai',
];

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }

  const pat = req.headers.authorization;
  if (!pat) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  const valid = await validatePAT(pat);
  if (!valid) {
    res.status(403).json({ error: 'Invalid DevRev PAT' });
    return;
  }

  const body = req.body as {
    instructions: string;
    input: Array<{ role: string; content: unknown }>;
  };

  if (!body?.instructions || !body?.input) {
    res.status(400).json({ error: 'Missing instructions or input' });
    return;
  }

  const client = new OpenAI({ apiKey });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.responses.stream({
      model: 'gpt-5.5',
      instructions: body.instructions,
      input: body.input as OpenAI.Responses.ResponseInput,
      reasoning: { effort: 'low' },
      max_output_tokens: 1200,
    });

    stream.on('response.output_text.delta', (event) => {
      res.write(`data: ${JSON.stringify({ delta: event.delta })}\n\n`);
    });

    stream.on('response.output_text.done', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });

    stream.on('error', (error: unknown) => {
      const message = error instanceof Error ? error.message : 'AI analysis failed';
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    });

    await stream.finalResponse();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI analysis failed';
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    } else {
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  }
}
