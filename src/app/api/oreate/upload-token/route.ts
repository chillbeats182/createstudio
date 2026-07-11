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

    const fileList = files.map((f: { name: string; size: number; fileExt: string; fileName: string }) => ({
      name: f.name,
      size: f.size,
      fileExt: f.fileExt,
      fileName: f.fileName,
    }));

    const result = await getUploadToken(cookies, fileList);

    if (result.status?.code !== 0) {
      return NextResponse.json(
        { error: 'Failed to get upload token', details: result.status },
        { status: 500 }
      );
    }

    return NextResponse.json({
      KeyList: result.data?.KeyList ?? {},
    });
  } catch (error) {
    console.error('Upload token error:', error);
    return NextResponse.json({ error: 'Failed to get upload token' }, { status: 500 });
  }
}