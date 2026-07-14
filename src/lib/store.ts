import { create } from 'zustand';

// ====================================================================
//  Types
// ====================================================================

export interface UserInfo {
  email: string;
  avatar: string;
  isLogin: boolean;
  isNewUser: boolean;
}

export interface VipInfo {
  etime: number;
  hasContractPay: boolean;
  vipType: number;
}

export interface ModelOption {
  modelName: string;
  modelIcon: string;
  pointCostImage?: Array<{ duration: number; point: number; resolution: string; aiType: number; audio?: boolean }>;
  pointCostMotion?: Array<{ motDuration: number; point: number; resolution: string; aiType: number }>;
  pointCostReference?: Array<{ duration: number; point: number; resolution: string; aiType: number }>;
  videoSize?: Array<{ icon: string; ratio: string }>;
  videoResolution?: string[];
  duration?: Array<{ icon: string; value: number }>;
  supportAudio?: boolean;
  description?: Record<string, string>;
}

export interface SceneOption {
  sceneId: string;
  sceneName: Record<string, string>;
  sceneIcon: string;
  factory: Array<{
    modelFactoryName: string;
    models: Array<{ modelName: string; restrictions: string }>;
  }>;
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

export interface WorkflowLog {
  id: string;
  step: 'auth' | 'upload' | 'generate' | 'poll';
  action: string;
  request?: { url: string; method: string; headers?: Record<string, string>; body?: string };
  response?: { status: number; body: string; timing: number };
  success: boolean;
  error?: string;
  timestamp: number;
}

// ====================================================================
//  Store
// ====================================================================

interface AppState {
  // Cookie & Auth
  cookie: string;
  isAuthenticated: boolean;
  userInfo: UserInfo | null;
  vipInfo: VipInfo | null;
  restPoint: number;

  // Models
  models: ModelOption[];
  scenes: SceneOption[];

  // Generation config
  selectedSceneId: string;
  selectedModelName: string;
  selectedDuration: number;
  selectedResolution: string;
  selectedVideoSize: string;
  selectedAiType: number;
  motDuration: string;
  keepOriginalSound: boolean;
  prompt: string;

  // Files
  imageFile: File | null;
  imagePreview: string | null;
  videoFile: File | null;
  videoPreview: string | null;

  // Task
  isGenerating: boolean;
  currentTaskId: string | null;
  taskProgress: number;
  taskStatus: string;
  taskVideoUrl: string | null;

  // History
  history: HistoryItem[];
  historyLoading: boolean;

  // UI
  activeTab: string;

  // Workflow Debug
  workflowLogs: WorkflowLog[];
  buildReadiness: Record<string, boolean>;

  // Actions
  setCookie: (cookie: string) => void;
  setAuth: (userInfo: UserInfo, vipInfo: VipInfo, restPoint: number) => void;
  setModels: (models: ModelOption[], scenes: SceneOption[]) => void;
  setScene: (sceneId: string) => void;
  setModel: (modelName: string) => void;
  setDuration: (duration: number) => void;
  setResolution: (resolution: string) => void;
  setVideoSize: (videoSize: string) => void;
  setAiType: (aiType: number) => void;
  setMotDuration: (motDuration: string) => void;
  setKeepOriginalSound: (val: boolean) => void;
  setPrompt: (prompt: string) => void;
  setImageFile: (file: File | null, preview?: string | null) => void;
  setVideoFile: (file: File | null, preview?: string | null) => void;
  setGenerating: (val: boolean) => void;
  setTaskId: (id: string | null) => void;
  setTaskProgress: (progress: number) => void;
  setTaskStatus: (status: string) => void;
  setTaskVideoUrl: (url: string | null) => void;
  setHistory: (items: HistoryItem[]) => void;
  setHistoryLoading: (val: boolean) => void;
  setActiveTab: (tab: string) => void;
  addWorkflowLog: (log: WorkflowLog) => void;
  clearWorkflowLogs: () => void;
  setBuildReadiness: (step: string, passed: boolean) => void;
  reset: () => void;
}

const initialState = {
  cookie: '',
  isAuthenticated: false,
  userInfo: null,
  vipInfo: null,
  restPoint: 0,
  models: [],
  scenes: [],
  selectedSceneId: 'text_or_image',
  selectedModelName: '',
  selectedDuration: 5,
  selectedResolution: '',
  selectedVideoSize: '',
  selectedAiType: 0,
  motDuration: '3',
  keepOriginalSound: false,
  prompt: '',
  imageFile: null,
  imagePreview: null,
  videoFile: null,
  videoPreview: null,
  isGenerating: false,
  currentTaskId: null,
  taskProgress: 0,
  taskStatus: 'idle',
  taskVideoUrl: null,
  history: [],
  historyLoading: false,
  activeTab: 'generate',
  workflowLogs: [] as WorkflowLog[],
  buildReadiness: {} as Record<string, boolean>,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setCookie: (cookie) => set({ cookie }),
  setAuth: (userInfo, vipInfo, restPoint) => set({ isAuthenticated: true, userInfo, vipInfo, restPoint }),
  setModels: (models, scenes) => set({ models, scenes }),
  setScene: (sceneId) => set({ selectedSceneId: sceneId }),
  setModel: (modelName) => set({ selectedModelName: modelName }),
  setDuration: (duration) => set({ selectedDuration: duration }),
  setResolution: (resolution) => set({ selectedResolution: resolution }),
  setVideoSize: (videoSize) => set({ selectedVideoSize: videoSize }),
  setAiType: (aiType) => set({ selectedAiType: aiType }),
  setMotDuration: (motDuration) => set({ motDuration }),
  setKeepOriginalSound: (keepOriginalSound) => set({ keepOriginalSound }),
  setPrompt: (prompt) => set({ prompt }),
  setImageFile: (file, preview) => set({ imageFile: file, imagePreview: preview ?? null }),
  setVideoFile: (file, preview) => set({ videoFile: file, videoPreview: preview ?? null }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setTaskId: (currentTaskId) => set({ currentTaskId }),
  setTaskProgress: (taskProgress) => set({ taskProgress }),
  setTaskStatus: (taskStatus) => set({ taskStatus }),
  setTaskVideoUrl: (taskVideoUrl) => set({ taskVideoUrl }),
  setHistory: (history) => set({ history }),
  setHistoryLoading: (historyLoading) => set({ historyLoading }),
  setActiveTab: (activeTab) => set({ activeTab }),
  addWorkflowLog: (log) => set((s) => ({ workflowLogs: [...s.workflowLogs, log] })),
  clearWorkflowLogs: () => set({ workflowLogs: [] }),
  setBuildReadiness: (step, passed) => set((s) => ({ buildReadiness: { ...s.buildReadiness, [step]: passed } })),
  reset: () => set({ ...initialState, workflowLogs: [], buildReadiness: {} }),
}));