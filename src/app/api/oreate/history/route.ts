import { NextRequest, NextResponse } from 'next/server';
import { parseCookies, getHistory } from '@/lib/oreate-client';

export async function POST(request: NextRequest) {
  try {
    const { cookie, pn = 1, rn = 20 } = await request.json();

    if (!cookie) {
      return NextResponse.json({ error: 'cookie is required' }, { status: 400 });
    }

    const cookies = parseCookies(cookie);
    if (cookies.length === 0) {
      return NextResponse.json({ error: 'Invalid cookie' }, { status: 400 });
    }

    // Use pn/rn (not pageNo/pageSize!)
    const result = await getHistory(cookies, pn, rn);
    const data = result.data as Record<string, unknown>;
    const respData = (data?.data as Record<string, unknown>) || {};

    const chatList = (respData.chatList as Array<Record<string, unknown>>) || [];
    const total = (respData.total as number) ?? 0;

    const items = chatList.map((c) => ({
      docId: c.docId || '',
      chatId: c.chatId || '',
      title: c.title || '',
      createTime: c.createTime || 0,
      status: c.status || 0,
      videoUrl: c.videoUrl || '',
      thumbnailUrl: c.thumbnailUrl || '',
      prompt: c.prompt || '',
      modelName: c.modelName || '',
    }));

    return NextResponse.json({
      success: true,
      items,
      total,
      debug: result.debug,
    });
  } catch (error) {
    console.error('History error:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}