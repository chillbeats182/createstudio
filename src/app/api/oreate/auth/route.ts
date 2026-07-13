import { NextRequest, NextResponse } from 'next/server';
import { parseCookies, authenticate } from '@/lib/oreate-client';

export async function POST(request: NextRequest) {
  try {
    const { cookie } = await request.json();

    if (!cookie || typeof cookie !== 'string') {
      return NextResponse.json({ error: 'Cookie is required' }, { status: 400 });
    }

    const cookies = parseCookies(cookie);

    if (cookies.length === 0) {
      return NextResponse.json({ error: 'Invalid cookie format' }, { status: 400 });
    }

    const result = await authenticate(cookies);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Authentication failed', debug: result.userDebug },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      userInfo: result.userInfo,
      vipInfo: result.vipInfo,
      restPoint: result.restPoint,
      debug: { user: result.userDebug, points: result.pointsDebug },
    });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Failed to authenticate', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}