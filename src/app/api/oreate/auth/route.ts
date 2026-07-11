import { NextRequest, NextResponse } from 'next/server';
import { parseCookies, getUserInfo, getRestPoints } from '@/lib/oreate-client';

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

    // Fetch user info and points in parallel
    const [userResp, pointsResp] = await Promise.all([
      getUserInfo(cookies),
      getRestPoints(cookies),
    ]);

    if (userResp.status?.code !== 0) {
      return NextResponse.json(
        { error: 'Authentication failed', details: userResp.status },
        { status: 401 }
      );
    }

    return NextResponse.json({
      userInfo: userResp.data.basicInfo,
      vipInfo: userResp.data.vipInfo,
      restPoint: pointsResp.data?.restPoint ?? 0,
    });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Failed to authenticate', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}