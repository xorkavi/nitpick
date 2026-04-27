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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
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

  const client = new OpenAI({ apiKey });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.responses.stream({
      model: 'gpt-5.5',
      instructions: body.instructions,
      input: body.input,
      reasoning: { effort: 'low' },
      max_output_tokens: 1200,
    });

    stream.on('response.output_text.delta', (event: any) => {
      res.write(`data: ${JSON.stringify({ delta: event.delta })}\n\n`);
    });

    stream.on('response.output_text.done', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });

    stream.on('error', (error: any) => {
      const message = error instanceof Error ? error.message : 'AI analysis failed';
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    });

    await stream.finalResponse();
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
