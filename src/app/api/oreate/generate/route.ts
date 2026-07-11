import { NextRequest, NextResponse } from 'next/server';
import { parseCookies, submitGeneration } from '@/lib/oreate-client';

interface Attachment {
  bos_url: string;
  fileName: string;
  fileExt: string;
  size: number;
  doc_title: string;
  doc_type: string;
  originSize: number;
}

interface VideoConfig {
  sceneId: string;
  modelName: string;
  duration: number;
  resolution: string;
  videoSize: string;
  aiType: number;
}

interface MotionConfig {
  characterImage: string;
  motionVideo: string;
  motDuration: string;
  keepOriginalSound: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cookie, mode, query, attachments, motion, videoConfig, sceneId } = body as {
      cookie: string;
      mode: string;
      query: string;
      attachments: Attachment[];
      motion?: MotionConfig;
      videoConfig: VideoConfig;
      sceneId: string;
    };

    if (!cookie) {
      return NextResponse.json({ error: 'Cookie is required' }, { status: 400 });
    }

    const cookies = parseCookies(cookie);
    if (cookies.length === 0) {
      return NextResponse.json({ error: 'Invalid cookie' }, { status: 400 });
    }

    // Build the payload for OreateAI
    const payload: Parameters<typeof submitGeneration>[1] = {
      mode: 'chat_video',
      query: query || '',
      attachments: attachments || [],
      videoConfig: {
        sceneId: videoConfig?.sceneId || sceneId || 'text_or_image',
        modelName: videoConfig?.modelName || 'Kling 2.6',
        duration: videoConfig?.duration || 5,
        resolution: videoConfig?.resolution || '720',
        videoSize: videoConfig?.videoSize || '16:9',
        aiType: videoConfig?.aiType || 14068,
      },
    };

    // Add motion config if present
    if (motion && (sceneId === 'motion' || videoConfig?.sceneId === 'motion')) {
      payload.motion = {
        characterImage: motion.characterImage || '',
        motionVideo: motion.motionVideo || '',
        motDuration: motion.motDuration || '3',
        keepOriginalSound: motion.keepOriginalSound || false,
      };
    }

    // Submit to OreateAI
    const submitResp = await submitGeneration(cookies, payload);
    const contentType = submitResp.headers.get('content-type') || '';

    let result: Record<string, unknown> = {};

    if (contentType.includes('text/event-stream')) {
      const text = await submitResp.text();
      const events = text.split('\n').filter((l) => l.startsWith('data:'));
      for (const event of events) {
        const data = event.replace(/^data:\s*/, '');
        try {
          result = JSON.parse(data);
          if (result.status) break;
        } catch {
          // not JSON
        }
      }
    } else {
      try {
        result = await submitResp.json();
      } catch {
        result = { raw: text };
      }
    }

    // Extract docId / taskId
    let docId = '';
    let taskId = '';

    if (result.data && typeof result.data === 'object') {
      const d = result.data as Record<string, unknown>;
      docId = (d.docId || d.docID || '') as string;
      taskId = (d.taskId || d.chatId || docId) as string;
    }

    return NextResponse.json({
      success: true,
      docId,
      taskId,
      submitResult: result,
    });
  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json(
      { error: 'Generation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}