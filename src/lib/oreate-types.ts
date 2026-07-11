export interface CookieEntry {
  domain: string;
  name: string;
  value: string;
  path: string;
  httpOnly?: boolean;
  secure?: boolean;
  expirationDate?: number;
}

export interface UserInfo {
  email: string;
  avatar: string;
  isLogin: boolean;
  way: number;
  createTime: number;
  isNewUser: boolean;
}

export interface VipInfo {
  etime: number;
  hasContractPay: boolean;
  hasEverBoughtExpCard: boolean;
  stime: number;
  vipType: number;
}

export interface AuthResponse {
  userInfo: UserInfo;
  vipInfo: VipInfo;
  restPoint: number;
}

export interface DurationOption {
  icon: string;
  value: number;
}

export interface VideoSizeOption {
  icon: string;
  ratio: string;
}

export interface PointCost {
  audio?: boolean;
  duration?: number;
  motDuration?: number;
  point: number;
  resolution: string;
  aiType: number;
}

export interface ModelConfig {
  duration: DurationOption[];
  modelIcon: string;
  modelName: string;
  description: Record<string, string>;
  pointCostImage?: PointCost[];
  pointCostMotion?: PointCost[];
  pointCostReference?: PointCost[];
  supportAudio?: boolean;
  supportModifySize?: boolean;
  videoResolution?: string[];
  videoSize?: VideoSizeOption[];
}

export interface ModelConfigResponse {
  models: ModelConfig[];
}

export interface SceneModel {
  modelName: string;
  restrictions: string;
}

export interface SceneFactory {
  modelFactoryName: string;
  modelIcon: string;
  models: SceneModel[];
}

export interface Scene {
  sceneId: string;
  sceneName: Record<string, string>;
  sceneIcon: string;
  description: Record<string, string>;
  factory: SceneFactory[];
}

export interface SceneConfigResponse {
  scenes: Scene[];
}

export interface UploadFileInfo {
  name: string;
  size: number;
  fileExt: string;
  fileName: string;
}

export interface UploadCredential {
  bucket: string;
  objectPath: string;
  sessionkey: string;
}

export interface UploadTokenResponse {
  KeyList: Record<string, UploadCredential>;
}

export interface Attachment {
  bos_url: string;
  fileName: string;
  fileExt: string;
  size: number;
  doc_title: string;
  doc_type: string;
  originSize: number;
}

export interface VideoConfig {
  sceneId: string;
  modelName: string;
  duration: number;
  resolution: string;
  videoSize: string;
  aiType: number;
}

export interface MotionConfig {
  characterImage: string;
  motionVideo: string;
  motDuration: string;
  keepOriginalSound: boolean;
}

export interface GenerateRequest {
  cookie: string;
  mode: string;
  query: string;
  attachments: Attachment[];
  motion?: MotionConfig;
  videoConfig: VideoConfig;
  sceneId: string;
}

export interface TaskStatusEvent {
  status: string;
  data?: Record<string, unknown>;
  progress?: number;
  videoUrl?: string;
  error?: string;
}

export interface HistoryItem {
  docId: string;
  chatId: string;
  title: string;
  createTime: number;
  status: number;
  videoUrl?: string;
  thumbnailUrl?: string;
  prompt?: string;
  modelName?: string;
}