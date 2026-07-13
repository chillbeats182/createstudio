import { NextRequest, NextResponse } from 'next/server';
import { uploadToGCS } from '@/lib/oreate-client';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const bucket = formData.get('bucket') as string;
    const objectPath = formData.get('objectPath') as string;
    const sessionkey = formData.get('sessionkey') as string;

    if (!file || !bucket || !objectPath || !sessionkey) {
      return NextResponse.json(
        { error: 'file, bucket, objectPath, and sessionkey are required' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const contentType = file.type || 'application/octet-stream';
    const result = await uploadToGCS(arrayBuffer, bucket, objectPath, sessionkey, contentType);

    if (result.data === '') {
      return NextResponse.json(
        { error: 'GCS upload failed', debug: result.debug },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: result.data,
      debug: result.debug,
    });
  } catch (error) {
    console.error('Upload file error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}