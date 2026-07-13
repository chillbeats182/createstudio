import { NextRequest, NextResponse } from 'next/server';
import { parseCookies, submitSSEGeneration } from '@/lib/oreate-client';

export async function POST(request: NextRequest) {
  try {
    const { cookie, sseRequest } = await request.json() as {
      cookie: string;
      sseRequest: Record<string, unknown>;
    };

    if (!cookie || !sseRequest) {
      return NextResponse.json({ error: 'cookie and sseRequest are required' }, { status: 400 });
    }

    const cookies = parseCookies(cookie);
    if (cookies.length === 0) {
      return NextResponse.json({ error: 'Invalid cookie' }, { status: 400 });
    }

    // Log the exact SSE request being sent (mask cookie for security)
    console.log('[Generate API] SSE Request payload:', JSON.stringify(sseRequest, null, 2));

    const result = await submitSSEGeneration(cookies, sseRequest);

    // Log the FULL SSE response body for debugging
    console.log('[Generate API] SSE Response status:', result.debug.responseStatus);
    console.log('[Generate API] SSE Response body (first 3000 chars):', result.debug.responseBody?.substring(0, 3000));
    console.log('[Generate API] Parsed events:', result.events.length, '| docId:', result.docId, '| chatId:', result.chatId, '| error:', result.error);

    return NextResponse.json({
      success: result.success,
      docId: result.docId,
      chatId: result.chatId,
      events: result.events,
      error: result.error,
      debug: result.debug,
      rawResponsePreview: result.debug.responseBody?.substring(0, 2000),
    });
  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json(
      { error: 'Generation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}