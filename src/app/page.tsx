'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Film, CreditCard, LogOut, Upload, X, Play, Loader2, Sparkles,
  History, ImagePlus, Video, Clock, Zap, Menu, Crown, User,
  CheckCircle2, XCircle, ChevronRight, Bug, Eye, Activity,
  ArrowRight, Shield, RotateCcw, Terminal, Send,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { useAppStore } from '@/lib/store';
import type { ModelOption, SceneOption, HistoryItem as HistoryItemType, WorkflowLog } from '@/lib/store';
import { generateChatID, buildSSERequest, parseCookies } from '@/lib/oreate-client';

// ====================================================================
//  Helpers
// ====================================================================

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'webm'];

function getExt(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.substring(dot + 1).toLowerCase() : '';
}

function getFilenameNoExt(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.substring(0, dot) : filename;
}

function formatJSON(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

// ====================================================================
//  Main Page
// ====================================================================

export default function TestCanvas() {
  const store = useAppStore();

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-72 border-r border-zinc-800 bg-zinc-900/50 p-4 overflow-y-auto flex-shrink-0">
          <SidebarContent />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Tabs value={store.activeTab} onValueChange={store.setActiveTab}>
            <TabsList className="bg-zinc-900 border border-zinc-800 mb-6">
              <TabsTrigger value="generate" className="gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Generate</span>
              </TabsTrigger>
              <TabsTrigger value="debug" className="gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <Bug className="h-4 w-4" />
                <span className="hidden sm:inline">Workflow Debug</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">History</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="generate">
              <GenerateTab />
            </TabsContent>
            <TabsContent value="debug">
              <WorkflowDebugTab />
            </TabsContent>
            <TabsContent value="history">
              <HistoryTab />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}

// ====================================================================
//  Header
// ====================================================================

function Header() {
  const store = useAppStore();

  return (
    <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm px-4 py-3 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden text-zinc-400 hover:text-zinc-100">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="bg-zinc-900 border-zinc-800 p-0 w-72">
            <SheetHeader className="p-4 border-b border-zinc-800">
              <SheetTitle className="text-zinc-100">OreateAI Studio</SheetTitle>
            </SheetHeader>
            <div className="p-4">
              <SidebarContent />
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2">
          <Film className="h-6 w-6 text-emerald-500" />
          <h1 className="text-lg font-bold text-zinc-100">
            OreateAI Studio <span className="text-emerald-500">— Test Canvas</span>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {store.isAuthenticated && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="border-emerald-700 text-emerald-400 bg-emerald-950/50 gap-1.5">
                  <Zap className="h-3 w-3" />
                  {store.restPoint} credits
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="bg-zinc-800 border-zinc-700 text-zinc-200">
                Remaining generation credits
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {store.isAuthenticated && (
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-red-400"
            onClick={() => store.reset()}
          >
            <LogOut className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Disconnect</span>
          </Button>
        )}
      </div>
    </header>
  );
}

// ====================================================================
//  Sidebar Content
// ====================================================================

function SidebarContent() {
  const store = useAppStore();

  if (!store.isAuthenticated) {
    return (
      <div className="space-y-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-zinc-300">Connect</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder='Paste cookie JSON or "name=value; ..." string'
              className="bg-zinc-800 border-zinc-700 text-zinc-100 text-xs min-h-[120px] resize-none placeholder:text-zinc-600"
              value={store.cookie}
              onChange={(e) => store.setCookie(e.target.value)}
            />
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConnect}
              disabled={!store.cookie.trim()}
            >
              <Shield className="h-4 w-4 mr-2" />
              Authenticate
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* User Info */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
            <User className="h-4 w-4" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            {store.userInfo?.avatar ? (
              <img src={store.userInfo.avatar} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white">
                {(store.userInfo?.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <span className="text-sm text-zinc-200 truncate">{store.userInfo?.email || 'Unknown'}</span>
          </div>
          {store.vipInfo && store.vipInfo.vipType > 0 && (
            <Badge className="bg-amber-600 text-white border-0 gap-1">
              <Crown className="h-3 w-3" /> VIP
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Credits */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Credits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-400">{store.restPoint}</div>
          <p className="text-xs text-zinc-500 mt-1">Remaining generation credits</p>
        </CardContent>
      </Card>
    </div>
  );
}

async function handleConnect() {
  const store = useAppStore.getState();
  if (!store.cookie.trim()) return;

  try {
    const resp = await fetch('/api/oreate/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie: store.cookie }),
    });
    const data = await resp.json();

    if (data.error) {
      toast.error(`Auth failed: ${data.error}`);
      return;
    }

    store.setAuth(data.userInfo, data.vipInfo, data.restPoint);
    toast.success(`Connected as ${data.userInfo?.email || 'user'}`);

    // Fetch models
    const modelResp = await fetch('/api/oreate/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie: store.cookie }),
    });
    const modelData = await modelResp.json();
    if (modelData.success) {
      store.setModels(modelData.models, modelData.scenes);
    }
  } catch (err) {
    toast.error('Connection failed');
  }
}

// ====================================================================
//  Generate Tab
// ====================================================================

function GenerateTab() {
  const store = useAppStore();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string>('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scene = store.selectedSceneId;
  const isMotion = scene === 'motion';
  const needsImage = true; // all scenes need at least an image
  const needsVideo = isMotion;

  // Find available models from scenes
  const availableModels: string[] = [];
  for (const s of store.scenes) {
    if (s.sceneId === scene) {
      for (const f of s.factory) {
        for (const m of f.models) {
          if (!availableModels.includes(m.modelName)) {
            availableModels.push(m.modelName);
          }
        }
      }
    }
  }

  // Find point costs for current model/scene
  const currentModel = store.models.find((m) => m.modelName === store.selectedModelName);
  let pointCost = 0;
  if (currentModel) {
    const costs = isMotion ? currentModel.pointCostMotion : scene === 'reference' ? currentModel.pointCostReference : currentModel.pointCostImage;
    const match = costs?.find(
      (c) =>
        (isMotion ? c.motDuration === parseInt(store.motDuration) : c.duration === store.selectedDuration) &&
        c.resolution === store.selectedResolution
    );
    pointCost = match?.point ?? 0;
  }

  const canGenerate = store.isAuthenticated && store.imageFile && !store.isGenerating && store.restPoint >= pointCost;

  const handleGenerate = async () => {
    if (!canGenerate || !store.imageFile) return;

    store.setGenerating(true);
    store.setTaskProgress(0);
    store.setTaskStatus('uploading');
    store.setTaskVideoUrl(null);
    store.setTaskId(null);

    try {
      // Step 1: Get upload token
      store.setTaskStatus('uploading');
      const filesToUpload: Array<{ filename: string; fileExt: string; size: number; file: File }> = [];

      const imageNoExt = getFilenameNoExt(store.imageFile.name);
      const imageExt = getExt(store.imageFile.name);
      filesToUpload.push({ filename: imageNoExt, fileExt: imageExt, size: store.imageFile.size, file: store.imageFile });

      if (store.videoFile) {
        const videoNoExt = getFilenameNoExt(store.videoFile.name);
        const videoExt = getExt(store.videoFile.name);
        filesToUpload.push({ filename: videoNoExt, fileExt: videoExt, size: store.videoFile.size, file: store.videoFile });
      }

      const tokenResp = await fetch('/api/oreate/upload-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookie: store.cookie,
          files: filesToUpload.map((f) => ({ filename: f.filename, fileExt: f.fileExt, size: f.size })),
        }),
      });
      const tokenData = await tokenResp.json();

      if (tokenData.error || !tokenData.KeyList) {
        toast.error(`Upload token failed: ${tokenData.error || 'No KeyList'}`);
        store.setGenerating(false);
        store.setTaskStatus('idle');
        return;
      }

      // Step 2: Upload files to GCS
      store.setTaskStatus('uploading');
      const keyList: Record<string, { bucket: string; objectPath: string; sessionkey: string }> = tokenData.KeyList;
      const uploadedUrls: string[] = [];
      const keys = Object.keys(keyList);

      for (let i = 0; i < filesToUpload.length; i++) {
        const f = filesToUpload[i];
        // Match credential
        let matchedKey = keys.find((k) => k === f.filename || k === f.file || k.toLowerCase() === f.filename.toLowerCase());
        if (matchedKey === undefined && keys.length === 1) matchedKey = keys[0];
        if (matchedKey === undefined && i < keys.length) matchedKey = keys[i];

        if (!matchedKey || !keyList[matchedKey]) {
          toast.error(`No upload credential for ${f.filename}`);
          store.setGenerating(false);
          store.setTaskStatus('idle');
          return;
        }

        const cred = keyList[matchedKey];
        const formData = new FormData();
        formData.append('file', f.file);
        formData.append('bucket', cred.bucket);
        formData.append('objectPath', cred.objectPath);
        formData.append('sessionkey', cred.sessionkey);

        const uploadResp = await fetch('/api/oreate/upload-file', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadResp.json();

        if (!uploadData.success || !uploadData.url) {
          toast.error(`Upload failed: ${uploadData.error || 'Unknown'}`);
          store.setGenerating(false);
          store.setTaskStatus('idle');
          return;
        }
        uploadedUrls.push(uploadData.url);
      }

      // Build URLs
      let imageUrl = uploadedUrls[0] || '';
      let videoUrl = '';
      if (isMotion && uploadedUrls.length > 1) {
        // For motion: video first, then image
        const imgIdx = filesToUpload.findIndex((f) => IMAGE_EXTS.includes(getExt(f.file.name)));
        const vidIdx = filesToUpload.findIndex((f) => VIDEO_EXTS.includes(getExt(f.file.name)));
        if (vidIdx >= 0 && imgIdx >= 0) {
          videoUrl = uploadedUrls[vidIdx];
          imageUrl = uploadedUrls[imgIdx];
        } else {
          imageUrl = uploadedUrls[0];
          videoUrl = uploadedUrls[1] || '';
        }
      }

      setUploadedImageUrl(imageUrl);
      setUploadedVideoUrl(videoUrl);

      // Step 3: Build SSE request
      store.setTaskStatus('generating');
      const chatId = generateChatID();

      // Build attachments
      const attachments: Array<Record<string, unknown>> = [];
      if (isMotion && videoUrl) {
        attachments.push({
          bos_url: videoUrl,
          bosUrl: videoUrl,
          docId: '',
          doc_title: getFilenameNoExt(store.videoFile?.name || ''),
          doc_type: getExt(store.videoFile?.name || ''),
          size: store.videoFile?.size || 0,
          flag: 'upload',
          type: 'file',
          status: 1,
          videoDurationSec: 0,
        });
      }
      attachments.push({
        bos_url: imageUrl,
        bosUrl: imageUrl,
        docId: '',
        doc_title: imageNoExt,
        doc_type: imageExt,
        size: store.imageFile.size,
        flag: 'upload',
        type: 'file',
        status: 1,
        videoDurationSec: 0,
      });

      // Build videoConfig
      const videoConfig: Record<string, unknown> = {
        modelName: store.selectedModelName,
        ratio: store.selectedVideoSize,
        resolution: store.selectedResolution,
        duration: store.selectedDuration,
        isAudio: false,
        aiType: store.selectedAiType,
        scene: store.selectedSceneId,
      };

      if (scene === 'text_or_image') {
        videoConfig.textOrImage = { image: imageUrl };
      } else if (scene === 'motion') {
        const motDur = parseInt(store.motDuration) || 3;
        videoConfig.motion = {
          characterImage: imageUrl,
          motionVideo: videoUrl,
          motDuration: motDur,
          keepOriginalSound: store.keepOriginalSound,
        };
      } else if (scene === 'reference') {
        const refImages: string[] = [];
        const refVideos: string[] = [];
        if (IMAGE_EXTS.includes(getExt(store.imageFile.name))) refImages.push(imageUrl);
        if (videoUrl && VIDEO_EXTS.includes(getExt(store.videoFile?.name || ''))) refVideos.push(videoUrl);
        videoConfig.reference = {
          referenceImages: refImages,
          referenceVideos: refVideos,
          refDuration: '',
          refTotalDuration: '',
          keepOriginalSound: store.keepOriginalSound,
        };
      }

      const cookies = parseCookies(store.cookie);
      const sseRequest = buildSSERequest({
        chatId,
        prompt: store.prompt || '',
        attachments: attachments as Array<Record<string, unknown>>,
        videoConfig: videoConfig as unknown as Record<string, unknown>,
        cookies,
        userInfo: store.userInfo as Record<string, unknown> | undefined,
      });

      // Step 4: Submit generation
      const genResp = await fetch('/api/oreate/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: store.cookie, sseRequest }),
      });
      const genData = await genResp.json();

      if (!genData.success) {
        toast.error(`Generation failed: ${genData.error || 'Unknown error'}`);
        store.setGenerating(false);
        store.setTaskStatus('idle');
        return;
      }

      const docId = genData.docId || genData.chatId;
      if (!docId) {
        toast.error('No docId returned from generation');
        store.setGenerating(false);
        store.setTaskStatus('idle');
        return;
      }

      store.setTaskId(docId);
      store.setTaskStatus('polling');
      toast.success('Generation submitted, polling...');

      // Step 5: Poll for completion
      let pollCount = 0;
      const maxPolls = 120;

      pollRef.current = setInterval(async () => {
        pollCount++;
        if (pollCount > maxPolls) {
          if (pollRef.current) clearInterval(pollRef.current);
          store.setGenerating(false);
          store.setTaskStatus('timeout');
          toast.error('Generation timed out');
          return;
        }

        try {
          const statusResp = await fetch('/api/oreate/task-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookie: store.cookie, taskId: docId }),
          });
          const statusData = await statusResp.json();

          const progress = (statusData.progress as number) ?? 0;
          const videoUrl2 = (statusData.videoUrl as string) || '';
          const docStatus = (statusData.status as number) ?? -1;

          store.setTaskProgress(Math.min(progress, 100));

          // Status: 0=pending, 1=processing, 2=complete, 3=failed
          if (docStatus === 2 || (videoUrl2 && videoUrl2.startsWith('http'))) {
            if (pollRef.current) clearInterval(pollRef.current);
            store.setTaskProgress(100);
            store.setTaskVideoUrl(videoUrl2);
            store.setTaskStatus('complete');
            store.setGenerating(false);
            toast.success('Video generated!');
            return;
          }

          if (docStatus === 3) {
            if (pollRef.current) clearInterval(pollRef.current);
            store.setTaskStatus('failed');
            store.setGenerating(false);
            toast.error('Generation failed on server');
            return;
          }

          // Still processing
          store.setTaskProgress(Math.max(progress, Math.min(pollCount * 2, 95)));
        } catch {
          // continue polling
        }
      }, 3000);
    } catch (err) {
      store.setGenerating(false);
      store.setTaskStatus('idle');
      toast.error('Generation failed');
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  if (!store.isAuthenticated) {
    return (
      <Card className="bg-zinc-900 border-zinc-800 max-w-lg mx-auto mt-20">
        <CardHeader className="text-center">
          <Film className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
          <CardTitle className="text-zinc-100">OreateAI Studio — Test Canvas</CardTitle>
          <CardDescription className="text-zinc-400">
            Connect with your OreateAI cookies to start testing
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Scene Selector */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-zinc-300">Scene</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'text_or_image', label: 'Text or Image' },
              { id: 'motion', label: 'Motion' },
              { id: 'reference', label: 'Reference' },
            ].map((s) => (
              <Button
                key={s.id}
                variant={store.selectedSceneId === s.id ? 'default' : 'outline'}
                size="sm"
                className={
                  store.selectedSceneId === s.id
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                    : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                }
                onClick={() => {
                  store.setScene(s.id);
                  // Reset file selections on scene change
                  setUploadedImageUrl('');
                  setUploadedVideoUrl('');
                }}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Model Selector */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-zinc-300">Model</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={store.selectedModelName} onValueChange={(v) => {
              store.setModel(v);
              // Auto-update aiType
              const model = store.models.find((m) => m.modelName === v);
              if (model) {
                const costs = isMotion ? model.pointCostMotion : scene === 'reference' ? model.pointCostReference : model.pointCostImage;
                const match = costs?.find((c) => c.resolution === store.selectedResolution);
                if (match) store.setAiType(match.aiType);
              }
            }}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {availableModels.length > 0
                  ? availableModels.map((m) => (
                      <SelectItem key={m} value={m} className="text-zinc-100 focus:bg-zinc-700">{m}</SelectItem>
                    ))
                  : store.models.map((m) => (
                      <SelectItem key={m.modelName} value={m.modelName} className="text-zinc-100 focus:bg-zinc-700">{m.modelName}</SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Duration */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-zinc-300">Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {(currentModel?.duration || [{ icon: '5s', value: 5 }, { icon: '10s', value: 10 }]).map((d) => (
                <Button
                  key={d.value}
                  variant={store.selectedDuration === d.value ? 'default' : 'outline'}
                  size="sm"
                  className={
                    store.selectedDuration === d.value
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                      : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                  }
                  onClick={() => store.setDuration(d.value)}
                >
                  {d.icon || `${d.value}s`}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Resolution */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-zinc-300">Resolution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {(currentModel?.videoResolution || ['720', '1080']).map((r) => (
                <Button
                  key={r}
                  variant={store.selectedResolution === r ? 'default' : 'outline'}
                  size="sm"
                  className={
                    store.selectedResolution === r
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                      : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                  }
                  onClick={() => store.setResolution(r)}
                >
                  {r}p
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Video Size */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-zinc-300">Video Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {(currentModel?.videoSize || [{ icon: '1:1', ratio: '1:1' }, { icon: '16:9', ratio: '16:9' }, { icon: '9:16', ratio: '9:16' }]).map((s) => (
                <Button
                  key={s.ratio}
                  variant={store.selectedVideoSize === s.ratio ? 'default' : 'outline'}
                  size="sm"
                  className={
                    store.selectedVideoSize === s.ratio
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                      : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                  }
                  onClick={() => store.setVideoSize(s.ratio)}
                >
                  {s.icon || s.ratio}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Motion-specific options */}
      {isMotion && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-zinc-300">Motion Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-zinc-400 text-xs">Motion Duration</Label>
              <div className="flex gap-2 mt-1">
                {['3', '4', '5'].map((d) => (
                  <Button
                    key={d}
                    variant={store.motDuration === d ? 'default' : 'outline'}
                    size="sm"
                    className={
                      store.motDuration === d
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                        : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                    }
                    onClick={() => store.setMotDuration(d)}
                  >
                    {d}s
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-zinc-400 text-sm">Keep Original Sound</Label>
              <Switch
                checked={store.keepOriginalSound}
                onCheckedChange={store.setKeepOriginalSound}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* File Uploads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Image Upload */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
              <ImagePlus className="h-4 w-4" /> Image Upload
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                if (file) {
                  const url = URL.createObjectURL(file);
                  store.setImageFile(file, url);
                }
              }}
            />
            {store.imagePreview ? (
              <div className="relative group">
                <img src={store.imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-md border border-zinc-700" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => {
                    store.setImageFile(null, null);
                    setUploadedImageUrl('');
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <button
                className="w-full h-32 border-2 border-dashed border-zinc-700 rounded-md flex flex-col items-center justify-center gap-2 text-zinc-500 hover:border-emerald-600 hover:text-emerald-500 transition-colors cursor-pointer"
                onClick={() => imageInputRef.current?.click()}
              >
                <Upload className="h-6 w-6" />
                <span className="text-xs">Drop image or click</span>
              </button>
            )}
          </CardContent>
        </Card>

        {/* Video Upload (motion only) */}
        {isMotion && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
                <Video className="h-4 w-4" /> Video Upload (Motion)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file) {
                    const url = URL.createObjectURL(file);
                    store.setVideoFile(file, url);
                  }
                }}
              />
              {store.videoPreview ? (
                <div className="relative group">
                  <video src={store.videoPreview} className="w-full h-40 object-cover rounded-md border border-zinc-700" muted />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      store.setVideoFile(null, null);
                      setUploadedVideoUrl('');
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <button
                  className="w-full h-32 border-2 border-dashed border-zinc-700 rounded-md flex flex-col items-center justify-center gap-2 text-zinc-500 hover:border-emerald-600 hover:text-emerald-500 transition-colors cursor-pointer"
                  onClick={() => videoInputRef.current?.click()}
                >
                  <Video className="h-6 w-6" />
                  <span className="text-xs">Drop video or click</span>
                </button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Prompt */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-zinc-300">Prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Describe the video you want to generate..."
            className="bg-zinc-800 border-zinc-700 text-zinc-100 min-h-[80px] resize-none placeholder:text-zinc-600"
            value={store.prompt}
            onChange={(e) => store.setPrompt(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Cost & Generate */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-zinc-400">
          Cost: <span className="text-emerald-400 font-bold">{pointCost}</span> credits
          {store.restPoint < pointCost && (
            <span className="text-red-400 ml-2">(Insufficient credits)</span>
          )}
        </div>
        <Button
          size="lg"
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8"
          disabled={!canGenerate}
          onClick={handleGenerate}
        >
          {store.isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {store.taskStatus === 'uploading' ? 'Uploading...' : store.taskStatus === 'generating' ? 'Generating...' : 'Processing...'}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate
            </>
          )}
        </Button>
      </div>

      {/* Progress */}
      {store.isGenerating && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400 capitalize">{store.taskStatus}</span>
              <span className="text-emerald-400">{store.taskProgress}%</span>
            </div>
            <Progress value={store.taskProgress} className="h-2 bg-zinc-800 [&>div]:bg-emerald-500" />
          </CardContent>
        </Card>
      )}

      {/* Video Player */}
      {store.taskVideoUrl && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
              <Play className="h-4 w-4 text-emerald-500" /> Generated Video
            </CardTitle>
          </CardHeader>
          <CardContent>
            <video
              src={store.taskVideoUrl}
              controls
              className="w-full rounded-md border border-zinc-700"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ====================================================================
//  Workflow Debug Tab
// ====================================================================

function WorkflowDebugTab() {
  const store = useAppStore();
  const [activeStep, setActiveStep] = useState(0);
  const [stepResults, setStepResults] = useState<Record<number, { success: boolean; data: unknown; duration: number }>>({});
  const [runningStep, setRunningStep] = useState<number | null>(null);
  const [runningAll, setRunningAll] = useState(false);

  // --- File inputs for debug workflow (independent from Generate tab) ---
  const [debugImageFile, setDebugImageFile] = useState<File | null>(null);
  const [debugImagePreview, setDebugImagePreview] = useState<string | null>(null);
  const [debugVideoFile, setDebugVideoFile] = useState<File | null>(null);
  const [debugVideoPreview, setDebugVideoPreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // --- Chained data between steps ---
  // Upload step stores uploaded file info here so Generate step can use it
  const uploadedAttachmentsRef = useRef<Array<{
    bos_url: string;
    doc_title: string;
    doc_type: string;
    size: number;
    fileRole: 'image' | 'video';
  }>>([]);
  // Generate step stores docId here so Poll step can use it
  const generatedDocIdRef = useRef<string>('');

  const steps = [
    { id: 'auth', label: 'Auth', desc: 'Test cookie & fetch user info + models' },
    { id: 'upload', label: 'Upload', desc: 'Upload token + GCS direct PUT' },
    { id: 'generate', label: 'Generate', desc: 'Submit SSE stream request' },
    { id: 'poll', label: 'Poll', desc: 'Poll task status until complete' },
  ];

  // Helper: get sessionkey from credential (handle both casings)
  const getSessionKey = (cred: Record<string, unknown>): string => {
    return (cred.sessionkey as string) || (cred.sessionKey as string) || (cred.accessToken as string) || '';
  };

  // Helper: upload a single file to GCS and return bos_url
  const uploadOneFile = async (
    file: File,
    logIdBase: string,
    stepLog: (log: Parameters<typeof store.addWorkflowLog>[0]) => void,
  ): Promise<{ bosUrl: string; docTitle: string; docType: string; size: number; fileRole: 'image' | 'video' } | null> => {
    const fileNoExt = getFilenameNoExt(file.name);
    const fileExt = getExt(file.name);
    const isImage = IMAGE_EXTS.includes(fileExt);
    const isVideo = VIDEO_EXTS.includes(fileExt);

    // 1) Get upload token
    const tokenResp = await fetch('/api/oreate/upload-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cookie: store.cookie,
        files: [{ filename: fileNoExt, fileExt, size: file.size }],
      }),
    });
    const tokenData = await tokenResp.json();

    stepLog({
      id: `${logIdBase}-token`,
      step: 'upload',
      action: `POST /oreate/convert/getuploadbostoken (${file.name})`,
      request: { url: '/api/oreate/upload-token', method: 'POST', body: formatJSON({ cookie: '...', files: [{ filename: fileNoExt, fileExt, size: file.size }] }) },
      response: { status: tokenResp.status, body: formatJSON(tokenData), timing: 0 },
      success: !!tokenData.success && !!tokenData.KeyList,
      error: tokenData.error,
      timestamp: Date.now(),
    });

    if (!tokenData.success || !tokenData.KeyList) {
      toast.error(`Upload token failed for ${file.name}: ${tokenData.error}`);
      return null;
    }

    // Find credential
    const keys = Object.keys(tokenData.KeyList);
    if (keys.length === 0) {
      toast.error(`No upload credential returned for ${file.name}`);
      return null;
    }
    const cred = tokenData.KeyList[keys[0]] as Record<string, unknown>;
    const sessionkey = getSessionKey(cred);
    const bucket = cred.bucket as string;
    const objectPath = cred.objectPath as string;

    if (!sessionkey) {
      toast.error(`Empty sessionkey for ${file.name}`);
      return null;
    }

    // 2) Upload to GCS via backend proxy (direct PUT)
    const uploadStart = Date.now();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', bucket);
    formData.append('objectPath', objectPath);
    formData.append('sessionkey', sessionkey);

    const uploadResp = await fetch('/api/oreate/upload-file', {
      method: 'POST',
      body: formData,
    });
    const uploadData = await uploadResp.json();

    const bosUrl = uploadData.url || `https://storage.googleapis.com/${bucket}/${objectPath}`;

    stepLog({
      id: `${logIdBase}-gcs`,
      step: 'upload',
      action: `PUT GCS: ${bucket}/${objectPath} (${file.name})`,
      request: { url: `https://storage.googleapis.com/${bucket}/${objectPath}`, method: 'PUT', body: `[Binary: ${file.size} bytes, Content-Type: ${file.type || 'application/octet-stream'}]` },
      response: { status: uploadResp.status, body: formatJSON(uploadData), timing: Date.now() - uploadStart },
      success: !!uploadData.success,
      error: uploadData.error,
      timestamp: Date.now(),
    });

    if (!uploadData.success) {
      toast.error(`GCS upload failed for ${file.name}`);
      return null;
    }

    toast.success(`Uploaded ${file.name} → GCS`);
    return {
      bosUrl,
      docTitle: fileNoExt,
      docType: fileExt,
      size: file.size,
      fileRole: isVideo ? 'video' : 'image',
    };
  };

  // Helper to update both state and ref for step results
  const setStepRes = useCallback((idx: number, result: { success: boolean; data: unknown; duration: number }) => {
    stepSuccessRef.current[idx] = result.success;
    setStepResults((p) => ({ ...p, [idx]: result }));
  }, []);

  const runStep = async (stepIdx: number) => {
    setRunningStep(stepIdx);
    setActiveStep(stepIdx);

    const logId = `step-${stepIdx}-${Date.now()}`;
    const startTime = Date.now();
    const addLog = (log: Parameters<typeof store.addWorkflowLog>[0]) => store.addWorkflowLog(log);

    try {
      switch (stepIdx) {
        case 0: {
          // === AUTH ===
          const resp = await fetch('/api/oreate/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookie: store.cookie }),
          });
          const data = await resp.json();
          const duration = Date.now() - startTime;

          addLog({
            id: logId,
            step: 'auth',
            action: 'POST /oreate/user/getuserinfo + /bizapi/point/getrestpoints',
            request: { url: '/api/oreate/auth', method: 'POST', body: JSON.stringify({ cookie: `${store.cookie.substring(0, 60)}...` }) },
            response: { status: resp.status, body: formatJSON(data), timing: duration },
            success: data.success || false,
            error: data.error,
            timestamp: Date.now(),
          });

          const authOk = !data.error && data.success;
          setStepRes(0, { success: authOk, data, duration });
          store.setBuildReadiness('auth', authOk);

          if (authOk) {
            store.setAuth(data.userInfo, data.vipInfo, data.restPoint);
            // Also fetch models
            const modelResp = await fetch('/api/oreate/models', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cookie: store.cookie }),
            });
            const modelData = await modelResp.json();
            if (modelData.success || modelData.models) {
              store.setModels(modelData.models || [], modelData.scenes || []);
            }
            store.setBuildReadiness('models', !!(modelData.models || modelData.success));
            toast.success(`Auth OK — ${data.userInfo?.email || 'user'}, ${data.restPoint} credits`);
          } else {
            toast.error(`Auth failed: ${data.error}`);
          }
          break;
        }

        case 1: {
          // === UPLOAD ===
          if (!debugImageFile) {
            toast.error('Select an image file first (use the file picker above)');
            setRunningStep(null);
            setStepRes(1, { success: false, data: { error: 'No image file selected' }, duration: 0 });
            return;
          }

          uploadedAttachmentsRef.current = [];
          const allFiles: File[] = [debugImageFile];
          if (debugVideoFile) allFiles.push(debugVideoFile);

          const results: unknown[] = [];
          let allOk = true;

          for (const file of allFiles) {
            const result = await uploadOneFile(file, logId, addLog);
            if (result) {
              uploadedAttachmentsRef.current.push(result);
              results.push(result);
            } else {
              allOk = false;
            }
          }

          const duration = Date.now() - startTime;
          setStepRes(1, { success: allOk, data: { uploadedFiles: results }, duration });
          store.setBuildReadiness('upload', allOk);
          if (allOk) {
            toast.success(`Upload complete — ${uploadedAttachmentsRef.current.length} file(s)`);
          }
          break;
        }

        case 2: {
          // === GENERATE ===
          const attachments = uploadedAttachmentsRef.current;
          if (attachments.length === 0) {
            toast.error('Run Upload step first to upload files');
            setRunningStep(null);
            setStepRes(2, { success: false, data: { error: 'No uploaded files. Run Upload step first.' }, duration: 0 });
            return;
          }

          const chatId = generateChatID();
          const sceneId = store.selectedSceneId || 'text_or_image';
          const modelName = store.selectedModelName || 'Kling 2.6';
          const isMotion = sceneId === 'motion';

          // Build SSE attachments (matching Go desktop api_client.go exactly)
          const sseAttachments: Array<Record<string, unknown>> = [];
          let characterImageUrl = '';
          let motionVideoUrl = '';

          if (isMotion) {
            // Motion: video first, then image (matches Go buildVideoAttach)
            for (const att of attachments) {
              if (att.fileRole === 'video') {
                motionVideoUrl = att.bos_url;
                sseAttachments.push({
                  bos_url: att.bos_url,
                  bosUrl: att.bos_url,
                  docId: '',
                  doc_title: att.doc_title,
                  doc_type: att.doc_type,
                  size: att.size,
                  flag: 'upload',
                  type: 'file',
                  status: 1,
                });
              }
            }
            for (const att of attachments) {
              if (att.fileRole === 'image') {
                characterImageUrl = att.bos_url;
                sseAttachments.push({
                  bos_url: att.bos_url,
                  bosUrl: att.bos_url,
                  docId: '',
                  doc_title: att.doc_title,
                  doc_type: att.doc_type,
                  size: att.size,
                  flag: 'upload',
                  type: 'file',
                  status: 1,
                });
              }
            }
          } else {
            // text_or_image / reference: images first
            for (const att of attachments) {
              if (att.fileRole === 'image') {
                characterImageUrl = att.bos_url;
              }
              sseAttachments.push({
                bos_url: att.bos_url,
                bosUrl: att.bos_url,
                docId: '',
                doc_title: att.doc_title,
                doc_type: att.doc_type,
                size: att.size,
                flag: 'upload',
                type: 'file',
                status: 1,
              });
            }
          }

          // Build videoConfig (matching Go getVideoConfig())
          const videoConfig: Record<string, unknown> = {
            modelName,
            ratio: store.selectedVideoSize || '16:9',
            resolution: store.selectedResolution || '720',
            duration: store.selectedDuration || 5,
            isAudio: false,
            aiType: store.selectedAiType || 0,
            scene: sceneId,
          };

          if (isMotion) {
            videoConfig.motion = {
              characterImage: characterImageUrl,
              motionVideo: motionVideoUrl,
              motDuration: store.motDuration ? parseInt(store.motDuration) : 3,
              keepOriginalSound: store.keepOriginalSound || false,
            };
          } else if (sceneId === 'text_or_image') {
            videoConfig.textOrImage = { image: characterImageUrl };
          } else if (sceneId === 'reference') {
            const refImages = attachments.filter(a => a.fileRole === 'image').map(a => a.bos_url);
            const refVideos = attachments.filter(a => a.fileRole === 'video').map(a => a.bos_url);
            videoConfig.reference = {
              referenceImages: refImages,
              referenceVideos: refVideos,
              refDuration: '',
              refTotalDuration: '',
              keepOriginalSound: store.keepOriginalSound || false,
            };
          }

          // Build full SSE request using buildSSERequest (matches website format with mirror data)
          const cookies = parseCookies(store.cookie);
          const sseRequest = buildSSERequest({
            chatId,
            prompt: store.prompt || 'test',
            attachments: sseAttachments as Array<Record<string, unknown>>,
            videoConfig: videoConfig as unknown as Record<string, unknown>,
            cookies,
            userInfo: store.userInfo as Record<string, unknown> | undefined,
          });

          const genResp = await fetch('/api/oreate/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookie: store.cookie, sseRequest }),
          });
          const genData = await genResp.json();
          const duration = Date.now() - startTime;

          addLog({
            id: logId,
            step: 'generate',
            action: `POST /oreate/sse/stream (scene=${sceneId}, model=${modelName})`,
            request: { url: '/api/oreate/generate', method: 'POST', body: formatJSON({ cookie: '...', sseRequest }) },
            response: { status: genResp.status, body: formatJSON(genData), timing: duration },
            success: genData.success || false,
            error: genData.error,
            timestamp: Date.now(),
          });

          // Extract docId FIRST — it's the critical output of this step
          let docId = genData.docId || genData.chatId || '';

          // Fallback: scan events for docId if top-level fields are empty
          if (!docId && genData.events && Array.isArray(genData.events)) {
            for (const ev of genData.events) {
              const d = (ev as Record<string, unknown>).data as Record<string, unknown> | undefined;
              if (!d) continue;
              if (d.docId) { docId = d.docId as string; break; }
              if (d.id) { docId = d.id as string; break; }
              if (d.chatId) { docId = d.chatId as string; break; }
            }
          }

          // Store docId for poll step
          if (docId) {
            generatedDocIdRef.current = docId;
            store.setTaskId(docId);
          }

          // Generate is only truly "ok" if we have a docId
          const hasEvents = genData.events && genData.events.length > 0;
          const genOk = !!docId && (genData.success || !!hasEvents);

          setStepRes(2, { success: genOk, data: { ...genData, extractedDocId: docId || '(none)' }, duration });
          store.setBuildReadiness('generate_endpoint', genResp.status === 200);
          store.setBuildReadiness('sse_parsing', !!hasEvents);

          if (genOk) {
            toast.success(`Generate submitted — docId: ${docId}`);
          } else if (!docId && hasEvents) {
            toast.error(`Generate: events received but no docId extracted — check SSE event data`);
          } else {
            toast.error(`Generate failed: ${genData.error || 'No events received'}`);
          }
          break;
        }

        case 3: {
          // === POLL ===
          let docId = generatedDocIdRef.current || store.currentTaskId || '';

          // Fallback: try to extract docId from Generate step results
          if (!docId && stepResults[2]) {
            const genResult = stepResults[2].data as Record<string, unknown>;
            const extracted = (genResult?.extractedDocId as string) || (genResult?.docId as string) || (genResult?.chatId as string) || '';
            if (extracted && extracted !== '(none)') {
              docId = extracted;
              generatedDocIdRef.current = docId;
              store.setTaskId(docId);
            }
          }

          if (!docId) {
            toast.error('Run Generate step first to get a docId');
            setRunningStep(null);
            setStepRes(3, { success: false, data: { error: 'No docId. Run Generate step first — make sure the Generate step succeeded and extracted a docId from SSE events.' }, duration: 0 });
            return;
          }

          let pollSuccess = false;
          let pollCount = 0;
          let lastStatus = -1;
          let videoUrl = '';
          const maxPolls = 20;

          for (let i = 0; i < maxPolls; i++) {
            pollCount++;
            const pollStart = Date.now();

            const statusResp = await fetch('/api/oreate/task-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cookie: store.cookie, taskId: docId }),
            });
            const statusData = await statusResp.json();

            addLog({
              id: `${logId}-poll-${i}`,
              step: 'poll',
              action: `POST /oreate/doc/getstatus (poll ${pollCount}/${maxPolls})`,
              request: { url: '/api/oreate/task-status', method: 'POST', body: formatJSON({ cookie: '...', taskId: docId }) },
              response: { status: statusResp.status, body: formatJSON(statusData), timing: Date.now() - pollStart },
              success: statusData.success !== false,
              timestamp: Date.now(),
            });

            if (statusResp.status === 200 && statusData.success) {
              pollSuccess = true;
              lastStatus = statusData.status ?? -1;
              videoUrl = statusData.videoUrl || '';
              // status 2 = completed, status 3 = failed
              if (lastStatus === 2 || lastStatus === 3 || videoUrl) break;
            }

            // Wait 4 seconds between polls
            if (i < maxPolls - 1) await new Promise((r) => setTimeout(r, 4000));
          }

          const duration = Date.now() - startTime;
          const finalData = {
            docId,
            polls: pollCount,
            finalStatus: lastStatus,
            videoUrl: videoUrl || null,
            completed: lastStatus === 2 || !!videoUrl,
          };

          setStepRes(3, { success: pollSuccess, data: finalData, duration });
          store.setBuildReadiness('polling', pollSuccess);

          if (videoUrl) {
            store.setTaskVideoUrl(videoUrl);
            store.setTaskStatus('completed');
            store.setTaskProgress(100);
            toast.success(`Video ready! Polled ${pollCount} times`);
          } else if (lastStatus === 3) {
            toast.error(`Generation failed (status=3) after ${pollCount} polls`);
          } else {
            toast[pollSuccess ? 'info' : 'error'](`Poll ${pollSuccess ? 'endpoint working' : 'failed'} — ${pollCount} polls, status=${lastStatus}`);
          }
          break;
        }
      }
    } catch (err) {
      addLog({
        id: logId,
        step: ['auth', 'upload', 'generate', 'poll'][stepIdx] as WorkflowLog['step'],
        action: `Step ${stepIdx + 1} exception`,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: Date.now(),
      });
      setStepRes(stepIdx, { success: false, data: { error: String(err) }, duration: Date.now() - startTime });
      toast.error(`Step ${stepIdx + 1} error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    setRunningStep(null);
  };

  // "Run All" — runs steps 0→1→2→3 sequentially
  const stepSuccessRef = useRef<Record<number, boolean>>({});
  const runAll = async () => {
    setRunningAll(true);
    for (let i = 0; i < 4; i++) {
      if (!store.cookie.trim()) {
        toast.error('Cookie required');
        break;
      }
      await runStep(i);
      // Check ref (updated synchronously in runStep)
      if (stepSuccessRef.current[i] === false) {
        toast.error(`Workflow stopped at step ${i + 1} (${steps[i].label}) — check logs below`);
        break;
      }
      // After Generate step, verify docId was extracted before proceeding to Poll
      if (i === 2 && !generatedDocIdRef.current) {
        toast.error('Generate step did not produce a docId — cannot Poll. Check Generate step output for SSE event data.');
        setStepRes(3, { success: false, data: { error: 'No docId from Generate step' }, duration: 0 });
        break;
      }
    }
    setRunningAll(false);
  };

  const readinessChecks = [
    { key: 'auth', label: 'Auth working' },
    { key: 'upload', label: 'Upload working' },
    { key: 'generate_endpoint', label: 'Generate endpoint responding' },
    { key: 'sse_parsing', label: 'SSE parsing working' },
    { key: 'models', label: 'Model config fetched' },
    { key: 'polling', label: 'Task polling working' },
  ];

  const allPassed = readinessChecks.every((c) => store.buildReadiness[c.key]);
  const passedCount = readinessChecks.filter((c) => store.buildReadiness[c.key]).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* File Picker + Run All */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
              <Upload className="h-4 w-4 text-emerald-500" />
              Test Files & Run
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-amber-600 text-amber-400 hover:bg-amber-950 hover:text-amber-300"
                onClick={runAll}
                disabled={runningAll || runningStep !== null || !store.cookie.trim() || !debugImageFile}
              >
                {runningAll ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                {runningAll ? 'Running All…' : 'Run All (Auth→Upload→Generate→Poll)'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Image file picker */}
            <div
              className="relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-950/50 transition-colors hover:border-emerald-600/50"
              onClick={() => imageInputRef.current?.click()}
            >
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setDebugImageFile(file);
                    setDebugImagePreview(URL.createObjectURL(file));
                    toast.success(`Image: ${file.name} (${(file.size / 1024).toFixed(0)}KB)`);
                  }
                }}
              />
              {debugImagePreview ? (
                <div className="relative h-full w-full p-2">
                  <img src={debugImagePreview} alt="preview" className="max-h-[100px] mx-auto rounded object-contain" />
                  <button
                    className="absolute right-1 top-1 rounded-full bg-zinc-900/80 p-0.5 text-zinc-300 hover:text-red-400"
                    onClick={(e) => { e.stopPropagation(); setDebugImageFile(null); setDebugImagePreview(null); }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 p-3 text-center">
                  <ImagePlus className="h-5 w-5 text-zinc-500" />
                  <p className="text-xs text-zinc-400">Source Image *</p>
                  <p className="text-[10px] text-zinc-600">Required — click to select</p>
                </div>
              )}
            </div>

            {/* Video file picker (for motion scene) */}
            <div
              className="relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-950/50 transition-colors hover:border-emerald-600/50"
              onClick={() => videoInputRef.current?.click()}
            >
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setDebugVideoFile(file);
                    setDebugVideoPreview(URL.createObjectURL(file));
                    toast.success(`Video: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
                  }
                }}
              />
              {debugVideoPreview ? (
                <div className="relative h-full w-full p-2">
                  <video src={debugVideoPreview} className="max-h-[100px] mx-auto rounded object-contain" muted />
                  <button
                    className="absolute right-1 top-1 rounded-full bg-zinc-900/80 p-0.5 text-zinc-300 hover:text-red-400"
                    onClick={(e) => { e.stopPropagation(); setDebugVideoFile(null); setDebugVideoPreview(null); }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 p-3 text-center">
                  <Video className="h-5 w-5 text-zinc-500" />
                  <p className="text-xs text-zinc-400">Motion Video</p>
                  <p className="text-[10px] text-zinc-600">Optional — for motion scene</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick config row */}
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-zinc-800">
            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] text-zinc-500">Scene:</Label>
              <Select value={store.selectedSceneId} onValueChange={store.setScene}>
                <SelectTrigger className="h-7 w-[140px] border-zinc-700 bg-zinc-950 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-700 bg-zinc-900">
                  {store.scenes.map((s) => (
                    <SelectItem key={s.sceneId} value={s.sceneId} className="text-xs">
                      {s.sceneName.en || s.sceneName.zh || s.sceneId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] text-zinc-500">Model:</Label>
              <Select value={store.selectedModelName} onValueChange={store.setModel}>
                <SelectTrigger className="h-7 w-[140px] border-zinc-700 bg-zinc-950 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-700 bg-zinc-900">
                  {store.models.map((m) => (
                    <SelectItem key={m.modelName} value={m.modelName} className="text-xs">
                      {m.modelName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] text-zinc-500">Prompt:</Label>
              <Input
                className="h-7 w-[200px] border-zinc-700 bg-zinc-950 text-xs"
                placeholder="Describe the video…"
                value={store.prompt}
                onChange={(e) => store.setPrompt(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step Indicator */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-emerald-500" />
            Workflow Step Tester
          </CardTitle>
          <CardDescription className="text-zinc-500 text-xs">
            Run each step individually to debug the API workflow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {steps.map((step, idx) => (
              <React.Fragment key={step.id}>
                <button
                  className="flex flex-col items-center gap-1 min-w-[80px] group"
                  onClick={() => setActiveStep(idx)}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    stepResults[idx]?.success
                      ? 'border-emerald-500 bg-emerald-950 text-emerald-400'
                      : stepResults[idx] && !stepResults[idx].success
                        ? 'border-red-500 bg-red-950 text-red-400'
                        : runningStep === idx
                          ? 'border-amber-500 bg-amber-950 text-amber-400 animate-pulse'
                          : activeStep === idx
                            ? 'border-emerald-600 bg-zinc-800 text-zinc-200'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-500'
                  }`}>
                    {runningStep === idx ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : stepResults[idx]?.success ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : stepResults[idx] && !stepResults[idx].success ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <span className="text-xs font-bold">{idx + 1}</span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400 group-hover:text-zinc-200">{step.label}</span>
                </button>
                {idx < steps.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-zinc-700 flex-shrink-0 mt-[-16px]" />
                )}
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Step Detail */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm text-zinc-200">
                Step {activeStep + 1}: {steps[activeStep].label}
              </CardTitle>
              <CardDescription className="text-zinc-500 text-xs mt-1">
                {steps[activeStep].desc}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {stepResults[activeStep] && (
                <Badge variant="outline" className="text-xs">
                  {stepResults[activeStep].duration}ms
                </Badge>
              )}
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => runStep(activeStep)}
                disabled={runningStep !== null || !store.cookie.trim()}
              >
                {runningStep === activeStep ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Send className="h-3 w-3 mr-1" />
                )}
                Run
              </Button>
            </div>
          </div>
        </CardHeader>
        {stepResults[activeStep] && (
          <CardContent>
            <div className="rounded-md bg-zinc-950 border border-zinc-800 p-4 overflow-auto max-h-96">
              <pre className="text-xs text-zinc-300 whitespace-pre-wrap break-words font-mono">
                {formatJSON(stepResults[activeStep].data)}
              </pre>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Build Readiness Panel */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-500" />
              Build Readiness
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-500 hover:text-zinc-300"
              onClick={() => {
                store.setBuildReadiness('__reset', false);
                Object.keys(store.buildReadiness).forEach((k) => {
                  if (k !== '__reset') store.setBuildReadiness(k, false);
                });
              }}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {readinessChecks.map((check) => (
              <div key={check.key} className="flex items-center gap-2 text-sm">
                {store.buildReadiness[check.key] ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-zinc-700" />
                )}
                <span className={store.buildReadiness[check.key] ? 'text-emerald-400' : 'text-zinc-500'}>
                  {check.label}
                </span>
              </div>
            ))}
          </div>
          <Separator className="my-4 bg-zinc-800" />
          <div className={`text-sm font-medium ${allPassed ? 'text-emerald-400' : 'text-amber-400'}`}>
            {allPassed ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                All tests passed — Ready to build desktop exe
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                {passedCount}/{readinessChecks.length} tests passed
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Workflow Logs */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
              <Eye className="h-4 w-4 text-emerald-500" />
              API Call Log ({store.workflowLogs.length})
            </CardTitle>
            {store.workflowLogs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-500 hover:text-zinc-300"
                onClick={() => store.clearWorkflowLogs()}
              >
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-96 overflow-y-auto">
            {store.workflowLogs.length === 0 ? (
              <p className="text-zinc-600 text-xs text-center py-4">No API calls logged yet. Run a step above.</p>
            ) : (
              <div className="space-y-3">
                {store.workflowLogs.map((log) => (
                  <WorkflowLogCard key={log.id} log={log} />
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ====================================================================
//  Workflow Log Card
// ====================================================================

function WorkflowLogCard({ log }: { log: WorkflowLog }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-zinc-800 rounded-md overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-3 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-zinc-700 text-zinc-400">
              {log.step}
            </Badge>
            <span className="text-xs text-zinc-300 truncate">{log.action}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {log.response && (
            <span className="text-[10px] text-zinc-600">{log.response.timing}ms</span>
          )}
          <ChevronRight className={`h-3 w-3 text-zinc-600 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>
      {expanded && (
        <div className="border-t border-zinc-800 p-3 space-y-2 bg-zinc-950/50">
          {log.request && (
            <div>
              <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Request</div>
              <div className="text-xs text-zinc-500">
                <span className="text-amber-500 font-mono">{log.request.method}</span>{' '}
                <span className="font-mono">{log.request.url}</span>
              </div>
              {log.request.headers && (
                <pre className="text-[10px] text-zinc-600 mt-1 whitespace-pre-wrap break-all">
                  {formatJSON(log.request.headers)}
                </pre>
              )}
              {log.request.body && (
                <pre className="text-[10px] text-zinc-500 mt-1 whitespace-pre-wrap break-all max-h-32 overflow-y-auto bg-zinc-900 p-2 rounded">
                  {log.request.body}
                </pre>
              )}
            </div>
          )}
          {log.response && (
            <div>
              <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
                Response ({log.response.status})
              </div>
              <pre className="text-[10px] text-zinc-400 whitespace-pre-wrap break-all max-h-48 overflow-y-auto bg-zinc-900 p-2 rounded font-mono">
                {log.response.body}
              </pre>
            </div>
          )}
          {log.error && (
            <div>
              <div className="text-[10px] text-red-500 uppercase tracking-wider mb-1">Error</div>
              <p className="text-xs text-red-400">{log.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ====================================================================
//  History Tab
// ====================================================================

function HistoryTab() {
  const store = useAppStore();
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    if (!store.cookie.trim()) {
      toast.error('Connect first');
      return;
    }

    setLoading(true);
    store.setHistoryLoading(true);
    try {
      const resp = await fetch('/api/oreate/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: store.cookie, pn: 1, rn: 20 }),
      });
      const data = await resp.json();

      if (data.success) {
        store.setHistory(data.items);
        toast.success(`Loaded ${data.items.length} history items`);
      } else {
        toast.error('Failed to fetch history');
      }
    } catch {
      toast.error('Failed to fetch history');
    } finally {
      setLoading(false);
      store.setHistoryLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-200">Generation History</h2>
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={fetchHistory}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4 mr-1" />}
          Refresh
        </Button>
      </div>

      {store.history.length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="py-12 text-center text-zinc-500">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No history yet. Click Refresh to load.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {store.history.map((item) => (
            <Card key={item.docId || item.chatId} className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  <div className="w-24 h-16 rounded-md overflow-hidden bg-zinc-800 flex-shrink-0 flex items-center justify-center">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : item.videoUrl ? (
                      <video src={item.videoUrl} className="w-full h-full object-cover" muted />
                    ) : (
                      <Film className="h-5 w-5 text-zinc-700" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 border-zinc-700 ${
                          item.status === 2 ? 'text-emerald-400 border-emerald-800' :
                          item.status === 3 ? 'text-red-400 border-red-800' :
                          'text-zinc-400'
                        }`}
                      >
                        {item.status === 2 ? 'Complete' : item.status === 3 ? 'Failed' : 'Processing'}
                      </Badge>
                      {item.modelName && (
                        <span className="text-[10px] text-zinc-600">{item.modelName}</span>
                      )}
                      <span className="text-[10px] text-zinc-600 ml-auto">
                        {item.createTime ? timeAgo(item.createTime) : ''}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300 truncate">{item.prompt || item.title || 'Untitled'}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0">
                    {item.videoUrl && (
                      <a href={item.videoUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                          <Play className="h-3 w-3 mr-1" />
                          Play
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}