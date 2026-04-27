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

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const pat = request.headers.get('Authorization');
  if (!pat) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const valid = await validatePAT(pat);
  if (!valid) {
    return new Response(JSON.stringify({ error: 'Invalid DevRev PAT' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: {
    instructions: string;
    input: Array<{ role: string; content: unknown }>;
    imageUrl?: string;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const client = new OpenAI({ apiKey });

  const stream = client.responses.stream({
    model: 'gpt-5.5',
    instructions: body.instructions,
    input: body.input as OpenAI.Responses.ResponseInput,
    reasoning: { effort: 'low' },
    max_output_tokens: 1200,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      stream.on('response.output_text.delta', (event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: event.delta })}\n\n`));
      });

      stream.on('response.output_text.done', () => {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      });

      stream.on('error', (error: unknown) => {
        const message = error instanceof Error ? error.message : 'AI analysis failed';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
        controller.close();
      });

      try {
        await stream.finalResponse();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'AI analysis failed';
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
          controller.close();
        } catch {
          // Stream already closed
        }
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
