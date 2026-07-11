import { NextRequest, NextResponse } from 'next/server';
import { parseCookies, getUploadToken, uploadToGCS, submitGeneration, getTaskStatus } from '@/lib/oreate-client';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const cookieStr = formData.get('cookie') as string;
    const imageFile = formData.get('image') as File | null;
    const videoFile = formData.get('video') as File | null;
    const prompt = formData.get('prompt') as string;
    const sceneId = formData.get('sceneId') as string;
    const modelName = formData.get('modelName') as string;
    const duration = parseInt(formData.get('duration') as string) || 5;
    const resolution = formData.get('resolution') as string || '720';
    const videoSize = formData.get('videoSize') as string || '9:16';
    const aiType = parseInt(formData.get('aiType') as string) || 14172;
    const motDuration = formData.get('motDuration') as string || '3';
    const keepOriginalSound = formData.get('keepOriginalSound') === 'true';

    const cookies = parseCookies(cookieStr);
    if (cookies.length === 0) {
      return NextResponse.json({ error: 'Invalid cookie' }, { status: 400 });
    }

    // Step 1: Prepare file list and get upload credentials
    const fileList: Array<{ name: string; size: number; fileExt: string; fileName: string }> = [];

    if (imageFile) {
      const ext = imageFile.name.split('.').pop() || 'png';
      fileList.push({
        name: imageFile.name,
        size: imageFile.size,
        fileExt: ext,
        fileName: imageFile.name.replace(`.${ext}`, ''),
      });
    }

    if (videoFile) {
      const ext = videoFile.name.split('.').pop() || 'mp4';
      fileList.push({
        name: videoFile.name,
        size: videoFile.size,
        fileExt: ext,
        fileName: videoFile.name.replace(`.${ext}`, ''),
      });
    }

    if (fileList.length > 0) {
      const tokenResp = await getUploadToken(cookies, fileList);

      if (tokenResp.status?.code !== 0) {
        return NextResponse.json(
          { error: 'Failed to get upload token', details: tokenResp.status },
          { status: 500 }
        );
      }

      const keyList = tokenResp.data?.KeyList ?? {};

      // Upload files to GCS
      const uploadedUrls: Record<string, string> = {};

      for (const [filename, cred] of Object.entries(keyList)) {
        const file = filename === (imageFile?.name) ? imageFile : videoFile;
        if (!file) continue;

        const arrayBuffer = await file.arrayBuffer();
        const url = await uploadToGCS(
          arrayBuffer,
          cred.bucket,
          cred.objectPath,
          cred.sessionkey,
          file.type || (file.name.endsWith('.mp4') ? 'video/mp4' : 'image/png')
        );
        uploadedUrls[filename] = url;
      }
    }

    // Step 2: Build attachments
    const attachments = [];
    const characterImageUrl = imageFile ? `https://storage.googleapis.com/uploaded/${imageFile.name}` : '';
    const motionVideoUrl = videoFile ? `https://storage.googleapis.com/uploaded/${videoFile.name}` : '';

    if (videoFile) {
      attachments.push({
        bos_url: motionVideoUrl,
        fileName: videoFile.name,
        fileExt: videoFile.name.split('.').pop() || 'mp4',
        size: videoFile.size,
        doc_title: videoFile.name,
        doc_type: videoFile.name.split('.').pop() || 'mp4',
        originSize: videoFile.size,
      });
    }

    if (imageFile) {
      attachments.push({
        bos_url: characterImageUrl,
        fileName: imageFile.name,
        fileExt: imageFile.name.split('.').pop() || 'png',
        size: imageFile.size,
        doc_title: imageFile.name,
        doc_type: imageFile.name.split('.').pop() || 'png',
        originSize: imageFile.size,
      });
    }

    // Step 3: Submit generation
    const payload: Parameters<typeof submitGeneration>[1] = {
      mode: 'chat_video',
      query: prompt || '',
      attachments,
      videoConfig: {
        sceneId: sceneId || 'motion',
        modelName: modelName || 'Kling 2.6',
        duration,
        resolution,
        videoSize,
        aiType,
      },
    };

    if (sceneId === 'motion') {
      payload.motion = {
        characterImage: characterImageUrl,
        motionVideo: motionVideoUrl,
        motDuration,
        keepOriginalSound,
      };
    }

    const submitResp = await submitGeneration(cookies, payload);
    const contentType = submitResp.headers.get('content-type') || '';

    let result: Record<string, unknown> = {};
    
    if (contentType.includes('text/event-stream')) {
      // Parse SSE
      const text = await submitResp.text();
      const events = text.split('\n').filter(l => l.startsWith('data:'));
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
        result = { raw: await submitResp.text() };
      }
    }

    // Step 4: If we got a docId, poll for status
    let docId = '';
    if (result.data && typeof result.data === 'object') {
      const d = result.data as Record<string, unknown>;
      docId = (d.docId || d.docID || '') as string;
    }

    return NextResponse.json({
      success: true,
      submitResult: result,
      docId,
    });
  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json(
      { error: 'Generation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}