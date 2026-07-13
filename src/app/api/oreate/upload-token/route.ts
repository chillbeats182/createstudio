import { NextRequest, NextResponse } from 'next/server';
import { parseCookies, getUploadToken } from '@/lib/oreate-client';

export async function POST(request: NextRequest) {
  try {
    const { cookie, files } = await request.json();

    if (!cookie || !files || !Array.isArray(files)) {
      return NextResponse.json({ error: 'cookie and files are required' }, { status: 400 });
    }

    const cookies = parseCookies(cookie);
    if (cookies.length === 0) {
      return NextResponse.json({ error: 'Invalid cookie' }, { status: 400 });
    }

    // Map to correct format: filename (no ext), fileExt, size
    const fileMetas = files.map((f: { filename?: string; fileExt: string; size: number }) => ({
      filename: f.filename,
      fileExt: f.fileExt,
      size: f.size,
    }));

    const result = await getUploadToken(cookies, fileMetas);
    const data = result.data as Record<string, unknown>;
    const status = (data?.status as Record<string, unknown>) || {};

    if ((status.code as number) !== 0) {
      return NextResponse.json(
        { error: 'Failed to get upload token', details: status, debug: result.debug },
        { status: 500 }
      );
    }

    const respData = (data?.data as Record<string, unknown>) || {};

    return NextResponse.json({
      success: true,
      KeyList: respData.KeyList ?? {},
      debug: result.debug,
    });
  } catch (error) {
    console.error('Upload token error:', error);
    return NextResponse.json({ error: 'Failed to get upload token' }, { status: 500 });
  }
}