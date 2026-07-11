import { NextRequest, NextResponse } from 'next/server';
import { parseCookies, getTaskStatus } from '@/lib/oreate-client';

export async function POST(request: NextRequest) {
  try {
    const { cookie, docId } = await request.json();
    const cookies = parseCookies(cookie);

    if (!docId) {
      return NextResponse.json({ error: 'docId is required' }, { status: 400 });
    }

    const result = await getTaskStatus(cookies, docId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Task status error:', error);
    return NextResponse.json({ error: 'Failed to get task status' }, { status: 500 });
  }
}