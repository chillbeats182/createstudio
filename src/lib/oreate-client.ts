// ====================================================================
//  OreateAI Client — matches Go desktop app (api_client.go) EXACTLY
// ====================================================================

const BASE_URL = 'https://www.oreateai.com';
const GCS_BASE = 'https://storage.googleapis.com';

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.oreateai.com/home/vertical/aiVideo',
  'Origin': 'https://www.oreateai.com',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
};

// ====================================================================
//  Types
// ====================================================================

export interface CookieEntry {
  domain: string;
  name: string;
  value: string;
  path: string;
  httpOnly?: boolean;
  secure?: boolean;
}

export interface DebugInfo {
  requestUrl: string;
  requestMethod: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseStatus: number;
  responseBody: string;
  timestamp: number;
}

interface ApiResult<T = unknown> {
  data: T;
  debug: DebugInfo;
}

// SSE event types
export interface SSEEvent {
  event: string;
  data: Record<string, unknown>;
  raw: string;
}

// ====================================================================
//  Cookie Parsing
// ====================================================================

export function parseCookies(cookieInput: string): CookieEntry[] {
  if (!cookieInput || typeof cookieInput !== 'string') return [];
  const trimmed = cookieInput.trim();
  if (trimmed === '') return [];

  // Try JSON array first
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // Not valid JSON, try other formats below
  }

  // Try semicolon-separated cookie string (name=value; name2=value2)
  if (trimmed.includes(';')) {
    const cookies: CookieEntry[] = [];
    const parts = trimmed.split(';');
    for (const part of parts) {
      const p = part.trim();
      const eqIdx = p.indexOf('=');
      if (eqIdx === -1) continue;
      const name = p.substring(0, eqIdx).trim();
      const value = p.substring(eqIdx + 1).trim();
      if (!name) continue;
      cookies.push({ domain: '.oreateai.com', name, value, path: '/' });
    }
    if (cookies.length > 0) return cookies;
  }

  return [];
}

export function buildCookieHeader(cookies: CookieEntry[]): string {
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

// ====================================================================
//  Generic Fetch with Debug
// ====================================================================

export async function oreateFetch(
  path: string,
  cookies: CookieEntry[],
  options: RequestInit = {}
): Promise<ApiResult> {
  const cookieHeader = buildCookieHeader(cookies);
  const url = `${BASE_URL}${path}`;
  const startTime = Date.now();

  const mergedHeaders: Record<string, string> = {
    ...DEFAULT_HEADERS,
    Cookie: cookieHeader,
    ...(options.headers as Record<string, string> || {}),
  };

  const resp = await fetch(url, {
    ...options,
    headers: mergedHeaders,
  });

  const responseBody = await resp.text();

  return {
    data: safeJSONParse(responseBody),
    debug: {
      requestUrl: url,
      requestMethod: options.method || 'GET',
      requestHeaders: mergedHeaders,
      requestBody: options.body as string | undefined,
      responseStatus: resp.status,
      responseBody,
      timestamp: Date.now(),
    },
  };
}

function safeJSONParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ====================================================================
//  Chat ID Generation (matches Go's generateChatID)
// ====================================================================

export function generateChatID(): string {
  const ts = Date.now() * 1e6;
  const rnd = Math.floor(Math.random() * 1e6);
  return (ts + rnd).toString(36);
}

// ====================================================================
//  Authenticate — /oreate/user/getuserinfo + /bizapi/point/getrestpoints
// ====================================================================

export async function authenticate(cookies: CookieEntry[]) {
  const [userResult, pointsResult] = await Promise.all([
    oreateFetch('/oreate/user/getuserinfo', cookies),
    oreateFetch('/bizapi/point/getrestpoints', cookies),
  ]);

  const userData = userResult.data as Record<string, unknown>;
  const userStatus = (userData?.status as Record<string, unknown>) || {};
  const userRespData = (userData?.data as Record<string, unknown>) || {};

  const pointsData = pointsResult.data as Record<string, unknown>;
  const pointsRespData = (pointsData?.data as Record<string, unknown>) || {};

  return {
    success: (userStatus.code as number) === 0,
    userInfo: (userRespData.basicInfo as Record<string, unknown>) || null,
    vipInfo: (userRespData.vipInfo as Record<string, unknown>) || null,
    restPoint: ((pointsRespData.restPoint as number) ?? 0),
    userDebug: userResult.debug,
    pointsDebug: pointsResult.debug,
  };
}

// ====================================================================
//  Get Model Config — /oreate/aivideo/getmodelconfigv3
// ====================================================================

export async function getModelConfig(cookies: CookieEntry[]) {
  return oreateFetch('/oreate/aivideo/getmodelconfigv3', cookies);
}

// ====================================================================
//  Get Scene Config — /oreate/aivideo/getsceneconfig
// ====================================================================

export async function getSceneConfig(cookies: CookieEntry[]) {
  return oreateFetch('/oreate/aivideo/getsceneconfig', cookies);
}

// ====================================================================
//  Get Upload Token — POST /oreate/convert/getuploadbostoken
//  MUST include source: "aiImage"
// ====================================================================

export async function getUploadToken(
  cookies: CookieEntry[],
  fileMetas: Array<{ filename: string; fileExt: string; size: number }>
) {
  return oreateFetch('/oreate/convert/getuploadbostoken', cookies, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mFileList: fileMetas,
      source: 'aiImage',
    }),
  });
}

// ====================================================================
//  Upload to GCS — DIRECT PUT (not resumable)
//  URL: https://storage.googleapis.com/{bucket}/{objectPath}
//  Headers: Authorization: Bearer {sessionkey}, Content-Type
// ====================================================================

export async function uploadToGCS(
  file: Buffer | ArrayBuffer,
  bucket: string,
  objectPath: string,
  sessionkey: string,
  contentType: string
): Promise<ApiResult<string>> {
  const url = `${GCS_BASE}/${bucket}/${objectPath}`;
  const startTime = Date.now();

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${sessionkey}`,
    'Content-Type': contentType,
  };

  const resp = await fetch(url, {
    method: 'PUT',
    headers,
    body: file,
  });

  const responseBody = await resp.text();
  const finalUrl = `${GCS_BASE}/${bucket}/${objectPath}`;

  return {
    data: resp.status === 200 ? finalUrl : '',
    debug: {
      requestUrl: url,
      requestMethod: 'PUT',
      requestHeaders: { ...headers, 'Authorization': `Bearer ${sessionkey.substring(0, 20)}...` },
      requestBody: `[Binary file data: ${typeof file === 'number' ? (file as unknown as ArrayBuffer).byteLength : (file as Buffer).length} bytes]`,
      responseStatus: resp.status,
      responseBody: responseBody.substring(0, 1000),
      timestamp: Date.now(),
    },
  };
}

// ====================================================================
//  Submit SSE Generation — POST /oreate/sse/stream
//  Headers: Content-Type, Accept: text/event-stream, Client-Type: PC, locale: en-US
// ====================================================================

export async function submitSSEGeneration(
  cookies: CookieEntry[],
  sseRequest: Record<string, unknown>
): Promise<{ success: boolean; docId: string; chatId: string; events: SSEEvent[]; debug: DebugInfo; error?: string }> {
  const cookieHeader = buildCookieHeader(cookies);
  const url = `${BASE_URL}/oreate/sse/stream`;
  const body = JSON.stringify(sseRequest);
  const startTime = Date.now();

  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
    Cookie: cookieHeader,
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream, */*',
    'Client-Type': 'PC',
    'locale': 'en-US',
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  const responseBody = await resp.text();

  const debug: DebugInfo = {
    requestUrl: url,
    requestMethod: 'POST',
    requestHeaders: headers,
    requestBody: body,
    responseStatus: resp.status,
    responseBody: responseBody.substring(0, 5000),
    timestamp: Date.now(),
  };

  if (resp.status !== 200) {
    return {
      success: false,
      docId: '',
      chatId: '',
      events: [],
      debug,
      error: `HTTP ${resp.status}: ${responseBody.substring(0, 500)}`,
    };
  }

  // Parse SSE events — each line is "data: {json}"
  const events: SSEEvent[] = [];
  for (const line of responseBody.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const data = trimmed.replace(/^data:\s*/, '');
    if (data === '' || data === '[DONE]') continue;

    try {
      const parsed = JSON.parse(data) as Record<string, unknown>;
      events.push({
        event: (parsed.event as string) || '',
        data: (parsed.data as Record<string, unknown>) || {},
        raw: data,
      });
    } catch {
      // not JSON
    }
  }

  if (events.length === 0) {
    return {
      success: false,
      docId: '',
      chatId: '',
      events: [],
      debug,
      error: `No SSE events parsed. Response preview: ${responseBody.substring(0, 500)}`,
    };
  }

  // Process events
  let chatId = '';
  let docId = '';
  let hasError = false;
  let errorMsg = '';

  for (const ev of events) {
    // Try to extract docId/chatId from ANY event (defensive)
    const tryExtract = (data: Record<string, unknown>) => {
      if (!docId) {
        docId = (data.docId as string) || (data.id as string) || '';
      }
      if (!chatId) {
        chatId = (data.chatId as string) || '';
      }
    };

    switch (ev.event) {
      case 'setattr': {
        tryExtract(ev.data);
        break;
      }
      case 'start': {
        tryExtract(ev.data);
        break;
      }
      case 'error': {
        hasError = true;
        const code = ev.data.code as number;
        const msg = (ev.data.msg as string) || '';
        errorMsg = msg ? `error code ${code}: ${msg}` : `error code ${code}`;
        break;
      }
      case 'generating': {
        tryExtract(ev.data);
        break;
      }
      case 'end': {
        tryExtract(ev.data);
        break;
      }
    }
  }

  if (hasError) {
    return { success: false, docId, chatId, events, debug, error: errorMsg };
  }

  // Use chatId for polling if no docId
  if (!docId && chatId) docId = chatId;

  return { success: true, docId, chatId, events, debug };
}

// ====================================================================
//  Get Task Status — POST /oreate/doc/getstatus (NOT GET!)
//  Body: { docIdList: ["<docId>"] }
// ====================================================================

export async function getTaskStatus(cookies: CookieEntry[], docId: string) {
  return oreateFetch('/oreate/doc/getstatus', cookies, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ docIdList: [docId] }),
  });
}

// ====================================================================
//  Get History — GET /oreate/memory/getchatlist?pn=&rn= (NOT pageNo/pageSize!)
// ====================================================================

export async function getHistory(cookies: CookieEntry[], pn = 1, rn = 20) {
  return oreateFetch(`/oreate/memory/getchatlist?pn=${pn}&rn=${rn}`, cookies);
}