import { NextRequest, NextResponse } from 'next/server';
import { parseCookies, getModelConfig, getSceneConfig } from '@/lib/oreate-client';

export async function POST(request: NextRequest) {
  try {
    const { cookie } = await request.json();
    const cookies = parseCookies(cookie);

    if (cookies.length === 0) {
      return NextResponse.json({ error: 'Invalid cookie' }, { status: 400 });
    }

    const [modelResp, sceneResp] = await Promise.all([
      getModelConfig(cookies),
      getSceneConfig(cookies),
    ]);

    return NextResponse.json({
      models: modelResp.data?.models ?? [],
      scenes: sceneResp.data?.scenes ?? [],
    });
  } catch (error) {
    console.error('Models error:', error);
    return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
  }
}