// ====================================================================
//  API Adapter — Routes calls between Desktop (direct) and Web (proxy)
// ====================================================================
//
// In Web mode:  fetch('/api/oreate/...') → Next.js API routes (server-side)
// In Desktop mode (Wails/Tauri): call oreate-client.ts directly (no CORS)
// ====================================================================

import type { ModelOption, SceneOption } from '@/lib/store';

// ====================================================================
//  Desktop Detection (Wails or Tauri)
// ====================================================================

function isDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  // Wails v2 injects window.runtime
  if ((w['runtime'] as Record<string, unknown>)?.['EventsOn']) return true;
  // Tauri
  if (w['__TAURI__'] || w['__TAURI_INTERNALS__']) return true;
  return false;
}

// ====================================================================
//  Shared Types (matching API route response shapes)
// ====================================================================

interface AuthResult {
  success: boolean;
  userInfo: Record<string, unknown> | null;
  vipInfo: Record<string, unknown> | null;
  restPoint: number;
  error?: string;
}

interface ModelsResult {
  success: boolean;
  models: ModelOption[];
  scenes: SceneOption[];
  error?: string;
}

interface UploadTokenResult {
  success: boolean;
  KeyList: Record<string, { bucket: string; objectPath: string; sessionkey: string }> | null;
  error?: string;
}

interface UploadFileResult {
  success: boolean;
  url: string;
  error?: string;
}

interface GenerateResult {
  success: boolean;
  docId: string;
  chatId: string;
  events: unknown[];
  error?: string;
}

interface TaskStatusResult {
  success: boolean;
  status: number;
  progress: number;
  videoUrl: string;
  doc: Record<string, unknown>;
}

interface HistoryResult {
  success: boolean;
  items: Array<{
    docId: string;
    chatId: string;
    title: string;
    createTime: number;
    status: number;
    videoUrl: string;
    thumbnailUrl: string;
    prompt: string;
    modelName: string;
  }>;
  total: number;
}

// ====================================================================
//  Web-mode helpers (proxy through Next.js API routes)
// ====================================================================

async function webFetch(url: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return resp.json();
}

// ====================================================================
//  Exported Adapter Functions
// ====================================================================

/**
 * Authenticate user via cookie.
 * Web: POST /api/oreate/auth
 * Tauri: calls authenticate() from oreate-client directly
 */
export async function apiAuth(cookie: string): Promise<AuthResult> {
  if (isDesktop()) {
    // Dynamic import to avoid bundling in web mode
    const { parseCookies, authenticate } = await import('@/lib/oreate-client');
    const cookies = parseCookies(cookie);
    if (cookies.length === 0) {
      return { success: false, userInfo: null, vipInfo: null, restPoint: 0, error: 'Invalid cookie format' };
    }
    try {
      const result = await authenticate(cookies);
      if (!result.success) {
        return { success: false, userInfo: null, vipInfo: null, restPoint: 0, error: 'Authentication failed' };
      }
      return {
        success: true,
        userInfo: result.userInfo,
        vipInfo: result.vipInfo,
        restPoint: result.restPoint,
      };
    } catch (err) {
      return { success: false, userInfo: null, vipInfo: null, restPoint: 0, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  // Web mode: proxy through API route
  const data = await webFetch('/api/oreate/auth', { cookie });
  if (data.error) {
    return { success: false, userInfo: null, vipInfo: null, restPoint: 0, error: data.error as string };
  }
  return {
    success: true,
    userInfo: data.userInfo as Record<string, unknown> | null,
    vipInfo: data.vipInfo as Record<string, unknown> | null,
    restPoint: (data.restPoint as number) ?? 0,
  };
}

/**
 * Fetch available models and scenes.
 * Web: POST /api/oreate/models
 * Tauri: calls getModelConfig + getSceneConfig directly
 */
export async function apiModels(cookie: string): Promise<ModelsResult> {
  if (isDesktop()) {
    const { parseCookies, getModelConfig, getSceneConfig } = await import('@/lib/oreate-client');
    const cookies = parseCookies(cookie);
    if (cookies.length === 0) {
      return { success: false, models: [], scenes: [], error: 'Invalid cookie' };
    }
    try {
      const [modelResult, sceneResult] = await Promise.all([
        getModelConfig(cookies),
        getSceneConfig(cookies),
      ]);
      const modelData = modelResult.data as Record<string, unknown>;
      const modelRespData = (modelData?.data as Record<string, unknown>) || {};
      const sceneData = sceneResult.data as Record<string, unknown>;
      const sceneRespData = (sceneData?.data as Record<string, unknown>) || {};
      return {
        success: true,
        models: (modelRespData.models ?? []) as ModelOption[],
        scenes: (sceneRespData.scenes ?? []) as SceneOption[],
      };
    } catch (err) {
      return { success: false, models: [], scenes: [], error: err instanceof Error ? err.message : 'Failed to fetch models' };
    }
  }

  // Web mode
  const data = await webFetch('/api/oreate/models', { cookie });
  if (data.error) {
    return { success: false, models: [], scenes: [], error: data.error as string };
  }
  return {
    success: true,
    models: (data.models ?? []) as ModelOption[],
    scenes: (data.scenes ?? []) as SceneOption[],
  };
}

/**
 * Get upload token for GCS upload.
 * Web: POST /api/oreate/upload-token
 * Tauri: calls getUploadToken directly
 */
export async function apiUploadToken(
  cookie: string,
  files: Array<{ filename: string; fileExt: string; size: number }>
): Promise<UploadTokenResult> {
  if (isDesktop()) {
    const { parseCookies, getUploadToken } = await import('@/lib/oreate-client');
    const cookies = parseCookies(cookie);
    if (cookies.length === 0) {
      return { success: false, KeyList: null, error: 'Invalid cookie' };
    }
    try {
      const fileMetas = files.map(f => ({ filename: f.filename, fileExt: f.fileExt, size: f.size }));
      const result = await getUploadToken(cookies, fileMetas);
      const data = result.data as Record<string, unknown>;
      const status = (data?.status as Record<string, unknown>) || {};
      if ((status.code as number) !== 0) {
        return { success: false, KeyList: null, error: 'Failed to get upload token' };
      }
      const respData = (data?.data as Record<string, unknown>) || {};
      return {
        success: true,
        KeyList: (respData.KeyList ?? {}) as Record<string, { bucket: string; objectPath: string; sessionkey: string }>,
      };
    } catch (err) {
      return { success: false, KeyList: null, error: err instanceof Error ? err.message : 'Failed to get upload token' };
    }
  }

  // Web mode
  const data = await webFetch('/api/oreate/upload-token', { cookie, files });
  if (data.error || !data.KeyList) {
    return { success: false, KeyList: null, error: (data.error as string) || 'No KeyList' };
  }
  return {
    success: true,
    KeyList: data.KeyList as Record<string, { bucket: string; objectPath: string; sessionkey: string }>,
  };
}

/**
 * Upload a file to GCS.
 * Web: POST /api/oreate/upload-file (FormData)
 * Tauri: calls uploadToGCS directly
 */
export async function apiUploadFile(
  file: File,
  bucket: string,
  objectPath: string,
  sessionkey: string
): Promise<UploadFileResult> {
  if (isDesktop()) {
    const { uploadToGCS } = await import('@/lib/oreate-client');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const contentType = file.type || 'application/octet-stream';
      const result = await uploadToGCS(arrayBuffer, bucket, objectPath, sessionkey, contentType);
      if (result.data === '') {
        return { success: false, url: '', error: 'GCS upload failed' };
      }
      return { success: true, url: result.data };
    } catch (err) {
      return { success: false, url: '', error: err instanceof Error ? err.message : 'Upload failed' };
    }
  }

  // Web mode: use FormData (API route expects it)
  const formData = new FormData();
  formData.append('file', file);
  formData.append('bucket', bucket);
  formData.append('objectPath', objectPath);
  formData.append('sessionkey', sessionkey);

  const resp = await fetch('/api/oreate/upload-file', { method: 'POST', body: formData });
  const data = await resp.json();
  if (!data.success || !data.url) {
    return { success: false, url: '', error: data.error || 'Unknown' };
  }
  return { success: true, url: data.url as string };
}

/**
 * Submit SSE generation request.
 * Web: POST /api/oreate/generate
 * Tauri: calls submitSSEGeneration directly
 */
export async function apiGenerate(
  cookie: string,
  sseRequest: Record<string, unknown>
): Promise<GenerateResult> {
  if (isDesktop()) {
    const { parseCookies, submitSSEGeneration } = await import('@/lib/oreate-client');
    const cookies = parseCookies(cookie);
    if (cookies.length === 0) {
      return { success: false, docId: '', chatId: '', events: [], error: 'Invalid cookie' };
    }
    try {
      const result = await submitSSEGeneration(cookies, sseRequest);
      if (!result.success) {
        return { success: false, docId: result.docId, chatId: result.chatId, events: result.events, error: result.error };
      }
      return {
        success: true,
        docId: result.docId,
        chatId: result.chatId,
        events: result.events,
      };
    } catch (err) {
      return { success: false, docId: '', chatId: '', events: [], error: err instanceof Error ? err.message : 'Generation failed' };
    }
  }

  // Web mode
  const data = await webFetch('/api/oreate/generate', { cookie, sseRequest });
  if (!data.success) {
    return { success: false, docId: '', chatId: '', events: [], error: (data.error as string) || 'Unknown error' };
  }
  return {
    success: true,
    docId: (data.docId || data.chatId || '') as string,
    chatId: (data.chatId || '') as string,
    events: (data.events ?? []) as unknown[],
  };
}

/**
 * Poll task status.
 * Web: POST /api/oreate/task-status
 * Tauri: calls getTaskStatus directly
 */
export async function apiTaskStatus(
  cookie: string,
  taskId: string
): Promise<TaskStatusResult> {
  if (isDesktop()) {
    const { parseCookies, getTaskStatus } = await import('@/lib/oreate-client');
    const cookies = parseCookies(cookie);
    if (cookies.length === 0) {
      return { success: false, status: -1, progress: 0, videoUrl: '', doc: {} };
    }
    try {
      const result = await getTaskStatus(cookies, taskId);
      const data = result.data as Record<string, unknown>;
      const status = (data?.status as Record<string, unknown>) || {};
      const respData = (data?.data as Record<string, unknown>) || {};
      const docList = (respData.docList as Array<Record<string, unknown>>) || [];
      const doc = docList[0] || {};
      return {
        success: (status.code as number) === 0,
        status: (doc.status as number) ?? -1,
        progress: (doc.progress as number) ?? 0,
        videoUrl: (doc.videoUrl as string) || '',
        doc,
      };
    } catch (err) {
      return { success: false, status: -1, progress: 0, videoUrl: '', doc: {} };
    }
  }

  // Web mode
  const data = await webFetch('/api/oreate/task-status', { cookie, taskId });
  return {
    success: data.success as boolean,
    status: (data.status as number) ?? -1,
    progress: (data.progress as number) ?? 0,
    videoUrl: (data.videoUrl as string) || '',
    doc: (data.doc ?? {}) as Record<string, unknown>,
  };
}

/**
 * Fetch generation history.
 * Web: POST /api/oreate/history
 * Tauri: calls getHistory directly
 */
export async function apiHistory(
  cookie: string,
  pn = 1,
  rn = 20
): Promise<HistoryResult> {
  if (isDesktop()) {
    const { parseCookies, getHistory } = await import('@/lib/oreate-client');
    const cookies = parseCookies(cookie);
    if (cookies.length === 0) {
      return { success: false, items: [], total: 0 };
    }
    try {
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
      return { success: true, items, total };
    } catch (err) {
      return { success: false, items: [], total: 0 };
    }
  }

  // Web mode
  const data = await webFetch('/api/oreate/history', { cookie, pn, rn });
  return {
    success: data.success as boolean,
    items: (data.items ?? []) as HistoryResult['items'],
    total: (data.total as number) ?? 0,
  };
}