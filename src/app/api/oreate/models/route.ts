import { NextRequest, NextResponse } from 'next/server';
import { parseCookies, getModelConfig, getSceneConfig } from '@/lib/oreate-client';

export async function POST(request: NextRequest) {
  try {
    const { cookie } = await request.json();

    if (!cookie) {
      return NextResponse.json({ error: 'cookie is required' }, { status: 400 });
    }

    const cookies = parseCookies(cookie);
    if (cookies.length === 0) {
      return NextResponse.json({ error: 'Invalid cookie' }, { status: 400 });
    }

    const [modelResult, sceneResult] = await Promise.all([
      getModelConfig(cookies),
      getSceneConfig(cookies),
    ]);

    const modelData = modelResult.data as Record<string, unknown>;
    const modelRespData = (modelData?.data as Record<string, unknown>) || {};
    const sceneData = sceneResult.data as Record<string, unknown>;
    const sceneRespData = (sceneData?.data as Record<string, unknown>) || {};

    return NextResponse.json({
      success: true,
      models: modelRespData.models ?? [],
      scenes: sceneRespData.scenes ?? [],
      debug: { models: modelResult.debug, scenes: sceneResult.debug },
    });
  } catch (error) {
    console.error('Models error:', error);
    return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
  }
}