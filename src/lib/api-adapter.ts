// ====================================================================
//  API Adapter — Routes calls between Desktop (Go backend) and Web (proxy)
// ====================================================================
//
// Web mode:  fetch('/api/oreate/...') → Next.js API routes (server-side)
// Desktop mode (Wails): call Go-bound methods via window.go.main.App.*
//                        (Go makes HTTP requests — no CORS from backend)
// ====================================================================

import type { ModelOption, SceneOption } from '@/lib/store';

// ====================================================================
//  Desktop Detection (Wails runtime)
// ====================================================================

function isDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  // Wails v2 injects window.runtime
  if ((w['runtime'] as Record<string, unknown>)?.['EventsOn']) return true;
  return false;
}

// ====================================================================
//  Wails Go App binding accessor
// ====================================================================

type WailsApp = {
  OreateAuth(cookieHeader: string): Promise<Record<string, unknown>>;
  OreateGetModels(cookieHeader: string): Promise<Record<string, unknown>>;
  OreateGetUploadToken(cookieHeader: string, fileMetasJSON: string): Promise<Record<string, unknown>>;
  OreateUploadFileGCS(base64Data: string, bucket: string, objectPath: string, sessionkey: string, contentType: string): Promise<Record<string, unknown>>;
  OreateGenerate(cookieHeader: string, sseRequestJSON: string): Promise<Record<string, unknown>>;
  OreateGetTaskStatus(cookieHeader: string, docId: string): Promise<Record<string, unknown>>;
  OreateGetHistory(cookieHeader: string, pn: number, rn: number): Promise<Record<string, unknown>>;
};

function getWailsApp(): WailsApp | null {
  try {
    const w = window as unknown as Record<string, unknown>;
    const goMain = w['go'] as Record<string, unknown> | undefined;
    const appPkg = goMain?.['main'] as Record<string, unknown> | undefined;
    const app = appPkg?.['App'] as WailsApp | undefined;
    return app ?? null;
  } catch {
    return null;
  }
}

// ====================================================================
//  Shared Types
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
//  Helpers
// ====================================================================

async function webFetch(url: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return resp.json();
}

/** Build cookie header from raw cookie string (JSON array or semicolon-separated) */
async function buildCookieHeader(rawCookie: string): Promise<string> {
  const { parseCookies, buildCookieHeader: _bch } = await import('@/lib/oreate-client');
  const cookies = parseCookies(rawCookie);
  return _bch(cookies);
}

/** Convert ArrayBuffer to base64 string for passing to Go */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ====================================================================
//  Exported Adapter Functions
// ====================================================================

/**
 * Authenticate user via cookie.
 * Desktop: Go OreateAuth (no CORS)
 * Web: POST /api/oreate/auth
 */
export async function apiAuth(cookie: string): Promise<AuthResult> {
  if (isDesktop()) {
    const app = getWailsApp();
    if (!app) return { success: false, userInfo: null, vipInfo: null, restPoint: 0, error: 'Wails runtime not available' };
    try {
      const cookieHeader = await buildCookieHeader(cookie);
      const r = await app.OreateAuth(cookieHeader);
      return {
        success: r.success as boolean,
        userInfo: (r.userInfo as Record<string, unknown>) ?? null,
        vipInfo: (r.vipInfo as Record<string, unknown>) ?? null,
        restPoint: (r.restPoint as number) ?? 0,
      };
    } catch (err) {
      return { success: false, userInfo: null, vipInfo: null, restPoint: 0, error: err instanceof Error ? err.message : 'Auth failed' };
    }
  }

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
 * Desktop: Go OreateGetModels
 * Web: POST /api/oreate/models
 */
export async function apiModels(cookie: string): Promise<ModelsResult> {
  if (isDesktop()) {
    const app = getWailsApp();
    if (!app) return { success: false, models: [], scenes: [], error: 'Wails runtime not available' };
    try {
      const cookieHeader = await buildCookieHeader(cookie);
      const r = await app.OreateGetModels(cookieHeader);
      return {
        success: r.success as boolean,
        models: (r.models ?? []) as ModelOption[],
        scenes: (r.scenes ?? []) as SceneOption[],
      };
    } catch (err) {
      return { success: false, models: [], scenes: [], error: err instanceof Error ? err.message : 'Failed to fetch models' };
    }
  }

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
 * Desktop: Go OreateGetUploadToken
 * Web: POST /api/oreate/upload-token
 */
export async function apiUploadToken(
  cookie: string,
  files: Array<{ filename: string; fileExt: string; size: number }>
): Promise<UploadTokenResult> {
  if (isDesktop()) {
    const app = getWailsApp();
    if (!app) return { success: false, KeyList: null, error: 'Wails runtime not available' };
    try {
      const cookieHeader = await buildCookieHeader(cookie);
      const r = await app.OreateGetUploadToken(cookieHeader, JSON.stringify(files));
      return {
        success: r.success as boolean,
        KeyList: (r.KeyList ?? null) as Record<string, { bucket: string; objectPath: string; sessionkey: string }> | null,
      };
    } catch (err) {
      return { success: false, KeyList: null, error: err instanceof Error ? err.message : 'Failed to get upload token' };
    }
  }

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
 * Desktop: Go OreateUploadFileGCS (base64 encoded)
 * Web: POST /api/oreate/upload-file (FormData)
 */
export async function apiUploadFile(
  file: File,
  bucket: string,
  objectPath: string,
  sessionkey: string
): Promise<UploadFileResult> {
  if (isDesktop()) {
    const app = getWailsApp();
    if (!app) return { success: false, url: '', error: 'Wails runtime not available' };
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      const contentType = file.type || 'application/octet-stream';
      const r = await app.OreateUploadFileGCS(base64, bucket, objectPath, sessionkey, contentType);
      return {
        success: r.success as boolean,
        url: (r.url as string) || '',
        error: r.error as string | undefined,
      };
    } catch (err) {
      return { success: false, url: '', error: err instanceof Error ? err.message : 'Upload failed' };
    }
  }

  // Web mode: use FormData
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
 * Desktop: Go OreateGenerate (parses SSE in Go)
 * Web: POST /api/oreate/generate
 */
export async function apiGenerate(
  cookie: string,
  sseRequest: Record<string, unknown>
): Promise<GenerateResult> {
  if (isDesktop()) {
    const app = getWailsApp();
    if (!app) return { success: false, docId: '', chatId: '', events: [], error: 'Wails runtime not available' };
    try {
      const cookieHeader = await buildCookieHeader(cookie);
      const r = await app.OreateGenerate(cookieHeader, JSON.stringify(sseRequest));
      return {
        success: r.success as boolean,
        docId: (r.docId as string) || '',
        chatId: (r.chatId as string) || '',
        events: (r.events ?? []) as unknown[],
        error: r.error as string | undefined,
      };
    } catch (err) {
      return { success: false, docId: '', chatId: '', events: [], error: err instanceof Error ? err.message : 'Generation failed' };
    }
  }

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
 * Desktop: Go OreateGetTaskStatus
 * Web: POST /api/oreate/task-status
 */
export async function apiTaskStatus(
  cookie: string,
  taskId: string
): Promise<TaskStatusResult> {
  if (isDesktop()) {
    const app = getWailsApp();
    if (!app) return { success: false, status: -1, progress: 0, videoUrl: '', doc: {} };
    try {
      const cookieHeader = await buildCookieHeader(cookie);
      const r = await app.OreateGetTaskStatus(cookieHeader, taskId);
      return {
        success: r.success as boolean,
        status: (r.status as number) ?? -1,
        progress: (r.progress as number) ?? 0,
        videoUrl: (r.videoUrl as string) || '',
        doc: (r.doc ?? {}) as Record<string, unknown>,
      };
    } catch (err) {
      return { success: false, status: -1, progress: 0, videoUrl: '', doc: {} };
    }
  }

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
 * Desktop: Go OreateGetHistory
 * Web: POST /api/oreate/history
 */
export async function apiHistory(
  cookie: string,
  pn = 1,
  rn = 20
): Promise<HistoryResult> {
  if (isDesktop()) {
    const app = getWailsApp();
    if (!app) return { success: false, items: [], total: 0 };
    try {
      const cookieHeader = await buildCookieHeader(cookie);
      const r = await app.OreateGetHistory(cookieHeader, pn, rn);
      return {
        success: r.success as boolean,
        items: (r.items ?? []) as HistoryResult['items'],
        total: (r.total as number) ?? 0,
      };
    } catch (err) {
      return { success: false, items: [], total: 0 };
    }
  }

  const data = await webFetch('/api/oreate/history', { cookie, pn, rn });
  return {
    success: data.success as boolean,
    items: (data.items ?? []) as HistoryResult['items'],
    total: (data.total as number) ?? 0,
  };
}