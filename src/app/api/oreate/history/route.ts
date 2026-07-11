import { NextRequest, NextResponse } from 'next/server';
import { parseCookies, getHistory } from '@/lib/oreate-client';

export async function POST(request: NextRequest) {
  try {
    const { cookie, pageNo = 1, pageSize = 20 } = await request.json();
    const cookies = parseCookies(cookie);

    if (cookies.length === 0) {
      return NextResponse.json({ error: 'Invalid cookie' }, { status: 400 });
    }

    const result = await getHistory(cookies, pageNo, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    console.error('History error:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}