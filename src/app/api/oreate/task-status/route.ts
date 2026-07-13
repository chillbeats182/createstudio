import { NextRequest, NextResponse } from 'next/server';
import { parseCookies, getTaskStatus } from '@/lib/oreate-client';

export async function POST(request: NextRequest) {
  try {
    const { cookie, taskId } = await request.json();

    if (!cookie || !taskId) {
      return NextResponse.json({ error: 'cookie and taskId are required' }, { status: 400 });
    }

    const cookies = parseCookies(cookie);
    if (cookies.length === 0) {
      return NextResponse.json({ error: 'Invalid cookie' }, { status: 400 });
    }

    // POST to /oreate/doc/getstatus (not GET!)
    const result = await getTaskStatus(cookies, taskId);
    const data = result.data as Record<string, unknown>;
    const status = (data?.status as Record<string, unknown>) || {};
    const respData = (data?.data as Record<string, unknown>) || {};

    // Extract video info from docList
    const docList = (respData.docList as Array<Record<string, unknown>>) || [];
    const doc = docList[0] || {};
    const videoUrl = (doc.videoUrl as string) || '';
    const progress = (doc.progress as number) ?? 0;
    const docStatus = (doc.status as number) ?? -1;

    return NextResponse.json({
      success: (status.code as number) === 0,
      status: docStatus,
      progress,
      videoUrl,
      doc: doc,
      debug: result.debug,
    });
  } catch (error) {
    console.error('Task status error:', error);
    return NextResponse.json({ error: 'Failed to get task status' }, { status: 500 });
  }
}