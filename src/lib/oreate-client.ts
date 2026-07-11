import { CookieEntry } from './oreate-types';

const BASE_URL = 'https://www.oreateai.com';
const GCS_BASE = 'https://storage.googleapis.com';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.oreateai.com/home/vertical/aiVideo',
  'Origin': 'https://www.oreateai.com',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
};

export function parseCookies(cookieInput: string): CookieEntry[] {
  if (!cookieInput || typeof cookieInput !== 'string') return [];
  const trimmed = cookieInput.trim();

  // Try JSON array first
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Not valid JSON, try other formats below
  }

  // Try semicolon-separated cookie string (name=value; name2=value2)
  if (trimmed.includes(';')) {
    return trimmed.split(';')
      .map(c => {
        const eqIdx = c.indexOf('=');
        if (eqIdx === -1) return null;
        const name = c.substring(0, eqIdx).trim();
        const value = c.substring(eqIdx + 1).trim();
        if (!name) return null;
        return { domain: '.oreateai.com', name, value, path: '/' } as CookieEntry;
      })
      .filter((c): c is CookieEntry => c !== null);
  }

  return [];
}

export function buildCookieHeader(cookies: CookieEntry[]): string {
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

export function getOussCookie(cookies: CookieEntry[]): string {
  const ouss = cookies.find(c => c.name === 'ouss');
  return ouss?.value || '';
}

export async function oreateFetch(
  path: string,
  cookies: CookieEntry[],
  options: RequestInit = {}
): Promise<Response> {
  const cookieHeader = buildCookieHeader(cookies);
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...DEFAULT_HEADERS,
      Cookie: cookieHeader,
      ...(options.headers || {}),
    },
  });
}

export async function getUserInfo(cookies: CookieEntry[]) {
  const resp = await oreateFetch('/oreate/user/getuserinfo', cookies);
  const data = await resp.json();
  return data;
}

export async function getRestPoints(cookies: CookieEntry[]) {
  const resp = await oreateFetch('/bizapi/point/getrestpoints', cookies);
  const data = await resp.json();
  return data;
}

export async function getModelConfig(cookies: CookieEntry[]) {
  const resp = await oreateFetch('/oreate/aivideo/getmodelconfigv3', cookies);
  const data = await resp.json();
  return data;
}

export async function getSceneConfig(cookies: CookieEntry[]) {
  const resp = await oreateFetch('/oreate/aivideo/getsceneconfig', cookies);
  const data = await resp.json();
  return data;
}

export async function getUploadToken(
  cookies: CookieEntry[],
  fileList: Array<{ name: string; size: number; fileExt: string; fileName: string }>
) {
  const resp = await oreateFetch('/oreate/convert/getuploadbostoken', cookies, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mFileList: fileList }),
  });
  const data = await resp.json();
  return data;
}

export async function uploadToGCS(
  file: Buffer | ArrayBuffer,
  bucket: string,
  objectPath: string,
  sessionkey: string,
  contentType: string
): Promise<string> {
  const encodedPath = encodeURIComponent(objectPath);
  const uploadUrl = `${GCS_BASE}/upload/storage/v1/b/${bucket}/o?uploadType=resumable&name=${encodedPath}`;

  // Step 1: Initiate resumable upload
  const initResp = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionkey}`,
      'Content-Type': 'application/json',
      'Content-Length': '0',
      'x-goog-user-project': 'iron-area-433903-r2',
    },
  });

  if (initResp.status !== 200 && initResp.status !== 201) {
    const text = await initResp.text();
    throw new Error(`GCS init failed: ${initResp.status} - ${text}`);
  }

  const location = initResp.headers.get('Location') || '';
  const fileData = Buffer.from(file);
  const fileSize = fileData.length;

  // Step 2: Upload file data
  const uploadResp = await fetch(location, {
    method: 'PUT',
    headers: {
      'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`,
      'Authorization': `Bearer ${sessionkey}`,
      'x-goog-user-project': 'iron-area-433903-r2',
      'Content-Type': contentType,
    },
    body: fileData,
  });

  if (uploadResp.status === 200 || uploadResp.status === 201) {
    return `https://storage.googleapis.com/${bucket}/${objectPath}`;
  }

  throw new Error(`GCS upload failed: ${uploadResp.status}`);
}

export async function submitGeneration(
  cookies: CookieEntry[],
  payload: {
    mode: string;
    query: string;
    attachments: Array<{
      bos_url: string;
      fileName: string;
      fileExt: string;
      size: number;
      doc_title: string;
      doc_type: string;
      originSize: number;
    }>;
    motion?: {
      characterImage: string;
      motionVideo: string;
      motDuration: string;
      keepOriginalSound: boolean;
    };
    htmlTplId?: string;
    videoConfig: {
      sceneId: string;
      modelName: string;
      duration: number;
      resolution: string;
      videoSize: string;
      aiType: number;
    };
  }
): Promise<Response> {
  const cookieHeader = buildCookieHeader(cookies);
  return fetch(`${BASE_URL}/oreate/create/chat`, {
    method: 'POST',
    headers: {
      ...DEFAULT_HEADERS,
      Cookie: cookieHeader,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(payload),
  });
}

export async function getTaskStatus(cookies: CookieEntry[], docId: string) {
  const resp = await oreateFetch(`/oreate/doc/getstatus?docIdList=${docId}`, cookies);
  const data = await resp.json();
  return data;
}

export async function getHistory(cookies: CookieEntry[], pageNo = 1, pageSize = 20) {
  const resp = await oreateFetch(
    `/oreate/memory/getchatlist?pageNo=${pageNo}&pageSize=${pageSize}&chatType=aiVideo`,
    cookies
  );
  const data = await resp.json();
  return data;
}