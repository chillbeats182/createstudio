'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  Film,
  CreditCard,
  LogOut,
  Upload,
  X,
  Play,
  Loader2,
  Sparkles,
  History,
  ImagePlus,
  Video,
  Clock,
  Zap,
  ChevronDown,
  Menu,
  Crown,
  User,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

import { useAppStore } from '@/lib/store';
import type { ModelOption, SceneOption, HistoryItem as HistoryItemType } from '@/lib/store';
import type { Attachment } from '@/lib/oreate-types';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(ts: number) {
  return new Date(ts).toLocaleString();
}

function truncate(str: string, n = 60) {
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function statusLabel(status: number) {
  switch (status) {
    case 0: return 'Pending';
    case 1: return 'Processing';
    case 2: return 'Completed';
    case 3: return 'Failed';
    default: return 'Unknown';
  }
}

function statusVariant(status: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 0: return 'secondary';
    case 1: return 'default';
    case 2: return 'outline';
    case 3: return 'destructive';
    default: return 'secondary';
  }
}

function vipLabel(vipType: number) {
  switch (vipType) {
    case 1: return 'Free';
    case 2: return 'Basic';
    case 3: return 'Pro';
    case 4: return 'Premium';
    default: return 'Free';
  }
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  // Force dark mode on the root element for shadcn CSS variable theming
  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => {
      document.documentElement.classList.remove('dark');
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <Header />
      <main className="flex-1">
        <AppBody />
      </main>
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Header                                                             */
/* ------------------------------------------------------------------ */

function Header() {
  const { isAuthenticated, restPoint } = useAppStore();

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Film className="h-5 w-5 text-emerald-500" />
          <span className="text-lg font-bold tracking-tight">OreateAI Studio</span>
        </div>
        {isAuthenticated && (
          <Badge variant="outline" className="border-emerald-600 text-emerald-400 gap-1.5 px-3">
            <Zap className="h-3 w-3" />
            {restPoint} credits
          </Badge>
        )}
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Footer                                                             */
/* ------------------------------------------------------------------ */

function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-800 py-4 text-center text-xs text-zinc-500">
      OreateAI Studio — Educational Purpose Only
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  App Body (auth gate)                                               */
/* ------------------------------------------------------------------ */

function AppBody() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <ConnectCard />;
  return <AuthenticatedView />;
}

/* ------------------------------------------------------------------ */
/*  Connect Card (unauthenticated)                                     */
/* ------------------------------------------------------------------ */

function ConnectCard() {
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setCookie, setAuth, setModels, setScene, setModel } = useAppStore();

  const handleConnect = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error('Input must be a JSON array of cookie objects');
      }
      const cookieStr = parsed
        .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
        .join('; ');

      // Auth check
      const authRes = await fetch('/api/oreate/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: cookieStr }),
      });
      if (!authRes.ok) {
        const errBody = await authRes.json().catch(() => ({}));
        throw new Error(errBody.error || 'Authentication failed');
      }
      const authData = await authRes.json();

      setCookie(cookieStr);
      setAuth(
        {
          email: authData.userInfo.email,
          avatar: authData.userInfo.avatar,
          isLogin: authData.userInfo.isLogin,
          isNewUser: authData.userInfo.isNewUser,
        },
        {
          etime: authData.vipInfo.etime,
          hasContractPay: authData.vipInfo.hasContractPay,
          vipType: authData.vipInfo.vipType,
        },
        authData.restPoint,
      );

      // Load models & scenes (combined endpoint)
      try {
        const modelRes = await fetch('/api/oreate/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cookie: cookieStr }),
        });

        if (modelRes.ok) {
          const modelData = await modelRes.json();
          const models: ModelOption[] = modelData.models ?? [];
          const scenes: SceneOption[] = modelData.scenes ?? [];
          setModels(models, scenes);
          if (models.length > 0) setModel(models[0].modelName);
          if (scenes.length > 0) setScene(scenes[0].sceneId);
        }
      } catch {
        // Non-critical — models will be empty
      }

      toast.success('Connected successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid cookie data';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [raw, setCookie, setAuth, setModels, setScene, setModel]);

  return (
    <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center px-4">
      <Card className="w-full max-w-lg border-zinc-800 bg-zinc-900 text-zinc-100">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
            <Film className="h-6 w-6 text-emerald-500" />
          </div>
          <CardTitle className="text-xl">Connect Your Account</CardTitle>
          <CardDescription className="text-zinc-400">
            Paste your browser cookies from OreateAI.com
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cookie-input">Cookie JSON</Label>
            <Textarea
              id="cookie-input"
              rows={6}
              placeholder={'[\n  {\n    "domain": ".oreateai.com",\n    "name": "session_id",\n    "value": "abc123..."\n  }\n]'}
              className="resize-none border-zinc-700 bg-zinc-800 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-emerald-600"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleConnect}
            disabled={loading || !raw.trim()}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Connecting…' : 'Connect'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Authenticated View                                                 */
/* ------------------------------------------------------------------ */

function AuthenticatedView() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Desktop sidebar */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <SidebarContent />
        </aside>

        {/* Mobile sidebar (Sheet) */}
        <div className="lg:hidden">
          <MobileSidebar />
        </div>

        {/* Main area */}
        <div className="min-w-0 flex-1">
          <MainTabs />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar Content                                                    */
/* ------------------------------------------------------------------ */

function SidebarContent() {
  const { userInfo, vipInfo, restPoint, history, reset } = useAppStore();
  const handleDisconnect = useCallback(() => {
    reset();
    toast.info('Disconnected');
  }, [reset]);

  const completedCount = history.filter((h) => h.status === 2).length;

  return (
    <div className="sticky top-20 space-y-4">
      {/* Account card */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              {userInfo?.avatar ? (
                <img
                  src={userInfo.avatar}
                  alt="avatar"
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <User className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{userInfo?.email ?? 'User'}</p>
              <div className="flex items-center gap-1.5">
                {vipInfo && vipInfo.vipType > 1 && (
                  <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/30 text-[10px] px-1.5">
                    <Crown className="mr-0.5 h-2.5 w-2.5" />
                    {vipLabel(vipInfo.vipType)}
                  </Badge>
                )}
                {vipInfo && vipInfo.vipType === 1 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5">Free</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick stats */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Credits</span>
            <span className="text-sm font-semibold text-emerald-400">{restPoint}</span>
          </div>
          <Separator className="bg-zinc-800" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Completed</span>
            <span className="text-sm font-medium">{completedCount}</span>
          </div>
          <Separator className="bg-zinc-800" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Total in History</span>
            <span className="text-sm font-medium">{history.length}</span>
          </div>
        </CardContent>
      </Card>

      <Separator className="bg-zinc-800" />

      <Button
        variant="outline"
        className="w-full border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-400/50"
        onClick={handleDisconnect}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Disconnect
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile Sidebar                                                     */
/* ------------------------------------------------------------------ */

function MobileSidebar() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300">
          <Menu className="mr-2 h-4 w-4" />
          Account
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-zinc-800 bg-zinc-900 p-0">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle className="text-zinc-100">Account</SheetTitle>
        </SheetHeader>
        <div className="p-4 pt-2">
          <SidebarContent />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Tabs                                                          */
/* ------------------------------------------------------------------ */

function MainTabs() {
  const { activeTab, setActiveTab } = useAppStore();

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="w-full"
    >
      <TabsList className="mb-6 w-full bg-zinc-900 border border-zinc-800">
        <TabsTrigger
          value="generate"
          className="flex-1 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=inactive]:text-zinc-400"
        >
          <Sparkles className="mr-1.5 h-4 w-4" />
          Generate
        </TabsTrigger>
        <TabsTrigger
          value="history"
          className="flex-1 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=inactive]:text-zinc-400"
        >
          <History className="mr-1.5 h-4 w-4" />
          History
        </TabsTrigger>
      </TabsList>

      <TabsContent value="generate">
        <GenerateTab />
      </TabsContent>
      <TabsContent value="history">
        <HistoryTab />
      </TabsContent>
    </Tabs>
  );
}

/* ------------------------------------------------------------------ */
/*  Generate Tab                                                       */
/* ------------------------------------------------------------------ */

function GenerateTab() {
  const {
    scenes,
    models,
    selectedSceneId,
    selectedModelName,
    selectedDuration,
    selectedResolution,
    selectedVideoSize,
    motDuration,
    keepOriginalSound,
    prompt,
    imageFile,
    imagePreview,
    videoFile,
    videoPreview,
    isGenerating,
    taskProgress,
    taskStatus,
    taskVideoUrl,
    cookie,
    selectedAiType,
    setScene,
    setModel,
    setDuration,
    setResolution,
    setVideoSize,
    setMotDuration,
    setKeepOriginalSound,
    setPrompt,
    setImageFile,
    setVideoFile,
    setGenerating,
    setTaskId,
    setTaskProgress,
    setTaskStatus,
    setTaskVideoUrl,
    setHistory,
  } = useAppStore();

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isMotion = selectedSceneId === 'motion';
  const currentModel = models.find((m) => m.modelName === selectedModelName);

  const availableDurations = currentModel?.duration?.map((d) => d.value) ?? [5, 10];
  const availableResolutions = currentModel?.videoResolution ?? ['720', '1080'];
  const availableSizes = currentModel?.videoSize?.map((s) => s.ratio) ?? ['1:1', '16:9', '9:16'];

  // Determine mode for API
  const getMode = useCallback(() => {
    if (isMotion) return 'motion';
    if (imageFile) return 'image';
    return 'text';
  }, [isMotion, imageFile]);

  // Upload file: get GCS token then upload via backend proxy
  const uploadFile = useCallback(
    async (file: File, fileName: string, fileExt: string) => {
      // Step 1: Get upload credentials
      const tokenRes = await fetch('/api/oreate/upload-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookie,
          files: [{ name: fileName, size: file.size, fileExt, fileName }],
        }),
      });
      if (!tokenRes.ok) throw new Error('Failed to get upload token');
      const tokenData = await tokenRes.json();
      const cred = tokenData.KeyList?.[fileName];
      if (!cred) throw new Error('No upload credential returned');

      // Step 2: Upload to GCS via backend proxy (avoids CORS)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', cred.bucket);
      formData.append('objectPath', cred.objectPath);
      formData.append('sessionkey', cred.sessionkey);

      const uploadRes = await fetch('/api/oreate/upload-file', {
        method: 'POST',
        body: formData,
      });
      if (!uploadRes.ok) throw new Error('File upload failed');
      const uploadData = await uploadRes.json();

      const bosUrl = uploadData.url || `https://storage.googleapis.com/${cred.bucket}/${cred.objectPath}`;

      return {
        bos_url: bosUrl,
        fileName,
        fileExt,
        size: file.size,
        doc_title: fileName,
        doc_type: fileExt,
        originSize: file.size,
      };
    },
    [cookie],
  );

  // Poll task status
  const startPolling = useCallback(
    (taskId: string) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch('/api/oreate/task-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookie, taskId }),
          });
          if (!res.ok) return;
          const data = await res.json();

          if (data.progress != null) setTaskProgress(data.progress);
          if (data.status) setTaskStatus(data.status);

          if (data.status === 'completed' && data.videoUrl) {
            setTaskVideoUrl(data.videoUrl);
            setGenerating(false);
            setTaskProgress(100);
            if (pollRef.current) clearInterval(pollRef.current);
            toast.success('Video generated successfully!');

            // Add to history
            const newItem: HistoryItemType = {
              docId: taskId,
              chatId: '',
              title: prompt || 'Untitled',
              createTime: Date.now(),
              status: 2,
              videoUrl: data.videoUrl,
              prompt: prompt,
              modelName: selectedModelName,
            };
            setHistory([newItem, ...useAppStore.getState().history]);
          } else if (data.status === 'failed') {
            setGenerating(false);
            setTaskStatus('failed');
            if (pollRef.current) clearInterval(pollRef.current);
            toast.error(data.error || 'Generation failed');
          }
        } catch {
          // ignore polling errors
        }
      }, 3000);
    },
    [cookie, prompt, selectedModelName, setGenerating, setHistory, setTaskProgress, setTaskStatus, setTaskVideoUrl],
  );

  // Generate
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() && !imageFile) {
      toast.error('Please enter a prompt or upload an image');
      return;
    }

    setGenerating(true);
    setTaskProgress(0);
    setTaskStatus('submitting');
    setTaskVideoUrl(null);

    try {
      const attachments: Attachment[] = [];

      // Upload image if present
      if (imageFile) {
        const ext = imageFile.name.split('.').pop() || 'png';
        const imgAtt = await uploadFile(imageFile, imageFile.name, ext);
        attachments.push(imgAtt);
      }

      // Upload video if motion
      let motion: { characterImage: string; motionVideo: string; motDuration: string; keepOriginalSound: boolean } | undefined = undefined;
      if (isMotion && videoFile) {
        const ext = videoFile.name.split('.').pop() || 'mp4';
        const vidAtt = await uploadFile(videoFile, videoFile.name, ext);
        attachments.push(vidAtt);
        motion = {
          characterImage: attachments[0]?.bos_url || '',
          motionVideo: vidAtt.bos_url,
          motDuration,
          keepOriginalSound,
        };
      }

      const mode = getMode();
      const res = await fetch('/api/oreate/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookie,
          mode,
          query: prompt,
          attachments,
          motion,
          videoConfig: {
            sceneId: selectedSceneId,
            modelName: selectedModelName,
            duration: selectedDuration,
            resolution: selectedResolution,
            videoSize: selectedVideoSize,
            aiType: selectedAiType,
          },
          sceneId: selectedSceneId,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Generation request failed');
      }

      const data = await res.json();
      const taskId = data.taskId || data.chatId || data.docId;
      if (taskId) {
        setTaskId(taskId);
        setTaskStatus('processing');
        startPolling(taskId);
      } else {
        setGenerating(false);
        toast.error('No task ID returned');
      }
    } catch (err: unknown) {
      setGenerating(false);
      setTaskStatus('failed');
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(msg);
    }
  }, [
    prompt, imageFile, videoFile, cookie, selectedSceneId, selectedModelName,
    selectedDuration, selectedResolution, selectedVideoSize, selectedAiType,
    isMotion, motDuration, keepOriginalSound, getMode, uploadFile,
    setGenerating, setTaskId, setTaskProgress, setTaskStatus, setTaskVideoUrl,
    setHistory, startPolling,
  ]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // File handlers
  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const preview = URL.createObjectURL(file);
      setImageFile(file, preview);
      toast.success('Image loaded');
    },
    [setImageFile],
  );

  const handleVideoChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const preview = URL.createObjectURL(file);
      setVideoFile(file, preview);
      toast.success('Video loaded');
    },
    [setVideoFile],
  );

  const handleDropImage = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        const preview = URL.createObjectURL(file);
        setImageFile(file, preview);
      }
    },
    [setImageFile],
  );

  const handleDropVideo = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('video/')) {
        const preview = URL.createObjectURL(file);
        setVideoFile(file, preview);
      }
    },
    [setVideoFile],
  );

  const [playingPreview, setPlayingPreview] = useState(false);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  return (
    <div className="space-y-5">
      {/* Scene & Model selectors */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-zinc-400 text-xs">Scene</Label>
          <Select value={selectedSceneId} onValueChange={setScene}>
            <SelectTrigger className="border-zinc-700 bg-zinc-900 text-zinc-100">
              <SelectValue placeholder="Select scene" />
            </SelectTrigger>
            <SelectContent className="border-zinc-700 bg-zinc-900">
              {scenes.map((s) => (
                <SelectItem key={s.sceneId} value={s.sceneId}>
                  {s.sceneName.en || s.sceneName.zh || s.sceneId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-zinc-400 text-xs">Model</Label>
          <Select value={selectedModelName} onValueChange={setModel}>
            <SelectTrigger className="border-zinc-700 bg-zinc-900 text-zinc-100">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent className="border-zinc-700 bg-zinc-900">
              {models.map((m) => (
                <SelectItem key={m.modelName} value={m.modelName}>
                  {m.modelName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Config row */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardContent className="p-4 space-y-4">
          {/* Duration */}
          <div className="space-y-2">
            <Label className="text-zinc-400 text-xs flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> Duration
            </Label>
            <div className="flex gap-2">
              {availableDurations.map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant={selectedDuration === d ? 'default' : 'outline'}
                  className={
                    selectedDuration === d
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'border-zinc-700 text-zinc-300 hover:text-zinc-100'
                  }
                  onClick={() => setDuration(d)}
                >
                  {d}s
                </Button>
              ))}
            </div>
          </div>

          <Separator className="bg-zinc-800" />

          {/* Resolution */}
          <div className="space-y-2">
            <Label className="text-zinc-400 text-xs">Resolution</Label>
            <div className="flex gap-2">
              {availableResolutions.map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={selectedResolution === r ? 'default' : 'outline'}
                  className={
                    selectedResolution === r
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'border-zinc-700 text-zinc-300 hover:text-zinc-100'
                  }
                  onClick={() => setResolution(r)}
                >
                  {r}p
                </Button>
              ))}
            </div>
          </div>

          <Separator className="bg-zinc-800" />

          {/* Video Size */}
          <div className="space-y-2">
            <Label className="text-zinc-400 text-xs">Video Size</Label>
            <div className="flex flex-wrap gap-2">
              {availableSizes.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={selectedVideoSize === s ? 'default' : 'outline'}
                  className={
                    selectedVideoSize === s
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'border-zinc-700 text-zinc-300 hover:text-zinc-100'
                  }
                  onClick={() => setVideoSize(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>

          {/* Motion-specific options */}
          {isMotion && (
            <>
              <Separator className="bg-zinc-800" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-zinc-400 text-xs">Motion Duration</Label>
                  <div className="flex gap-2">
                    {['3', '4', '5'].map((d) => (
                      <Button
                        key={d}
                        size="sm"
                        variant={motDuration === d ? 'default' : 'outline'}
                        className={
                          motDuration === d
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'border-zinc-700 text-zinc-300 hover:text-zinc-100'
                        }
                        onClick={() => setMotDuration(d)}
                      >
                        {d}s
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex items-end gap-3 pb-1">
                  <Switch
                    id="keep-sound"
                    checked={keepOriginalSound}
                    onCheckedChange={setKeepOriginalSound}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                  <Label htmlFor="keep-sound" className="text-zinc-300 text-sm cursor-pointer">
                    Keep Original Sound
                  </Label>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Upload areas */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Image upload */}
        <div
          className="relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900/50 transition-colors hover:border-emerald-600/50"
          onClick={() => imageInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropImage}
        >
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
          {imagePreview ? (
            <div className="relative h-full w-full">
              <img
                src={imagePreview}
                alt="preview"
                className="h-full w-full rounded-lg object-contain"
              />
              <button
                className="absolute right-2 top-2 rounded-full bg-zinc-900/80 p-1 text-zinc-300 hover:text-red-400"
                onClick={(e) => {
                  e.stopPropagation();
                  setImageFile(null, null);
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 p-4 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800">
                <ImagePlus className="h-5 w-5 text-zinc-400" />
              </div>
              <p className="text-sm text-zinc-400">Source Image</p>
              <p className="text-xs text-zinc-600">Drag & drop or click to upload</p>
            </div>
          )}
        </div>

        {/* Video upload (shown for motion) */}
        {isMotion && (
          <div
            className="relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900/50 transition-colors hover:border-emerald-600/50"
            onClick={() => videoInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropVideo}
          >
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleVideoChange}
            />
            {videoPreview ? (
              <div className="relative h-full w-full">
                <video
                  ref={videoPreviewRef}
                  src={videoPreview}
                  className="h-full w-full rounded-lg object-contain"
                  muted
                  loop
                  playsInline
                  onPlay={() => setPlayingPreview(true)}
                  onPause={() => setPlayingPreview(false)}
                />
                <button
                  className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity rounded-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (videoPreviewRef.current) {
                      if (playingPreview) {
                        videoPreviewRef.current.pause();
                      } else {
                        videoPreviewRef.current.play();
                      }
                    }
                  }}
                >
                  <Play className="h-10 w-10 text-white" />
                </button>
                <button
                  className="absolute right-2 top-2 rounded-full bg-zinc-900/80 p-1 text-zinc-300 hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    setVideoFile(null, null);
                    setPlayingPreview(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 p-4 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800">
                  <Video className="h-5 w-5 text-zinc-400" />
                </div>
                <p className="text-sm text-zinc-400">Motion Video</p>
                <p className="text-xs text-zinc-600">Drag & drop or click to upload</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prompt */}
      <div className="space-y-1.5">
        <Label className="text-zinc-400 text-xs">Prompt</Label>
        <Textarea
          rows={4}
          placeholder="Describe the video you want to generate…"
          className="resize-none border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-600"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      {/* Generate button */}
      <Button
        className="w-full bg-emerald-600 py-6 text-base font-semibold hover:bg-emerald-700 text-white"
        size="lg"
        disabled={isGenerating}
        onClick={handleGenerate}
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-5 w-5" />
            Generate Video
          </>
        )}
      </Button>

      {/* Progress */}
      {isGenerating && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Progress</span>
              <span className="text-emerald-400 font-medium">{taskProgress}%</span>
            </div>
            <Progress value={taskProgress} className="h-2 bg-zinc-800 [&>div]:bg-emerald-500" />
            <p className="text-xs text-zinc-500 capitalize">{taskStatus}</p>
          </CardContent>
        </Card>
      )}

      {/* Completed video */}
      {taskVideoUrl && !isGenerating && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="p-4">
            <p className="mb-3 text-sm font-medium text-emerald-400">✨ Video Ready</p>
            <video
              src={taskVideoUrl}
              controls
              className="w-full rounded-lg"
              playsInline
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  History Tab                                                        */
/* ------------------------------------------------------------------ */

function HistoryTab() {
  const { history, historyLoading, cookie, setHistory, setHistoryLoading } = useAppStore();
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState('');
  const hasFetched = useRef(false);

  // Fetch history on first load or tab switch
  const fetchHistory = useCallback(async () => {
    if (!cookie || historyLoading) return;
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/oreate/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie }),
      });
      if (!res.ok) throw new Error('Failed to fetch history');
      const data = await res.json();
      setHistory(data.items ?? data.history ?? []);
    } catch {
      toast.error('Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  }, [cookie, historyLoading, setHistory, setHistoryLoading]);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchHistory();
    }
  }, [fetchHistory]);

  if (historyLoading && history.length === 0) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <Skeleton className="h-20 w-28 shrink-0 rounded-md bg-zinc-800" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4 bg-zinc-800" />
              <Skeleton className="h-3 w-1/2 bg-zinc-800" />
              <Skeleton className="h-3 w-1/3 bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800 mb-4">
          <History className="h-7 w-7 text-zinc-500" />
        </div>
        <p className="text-zinc-400 text-sm">No generation history yet</p>
        <p className="text-zinc-600 text-xs mt-1">Your generated videos will appear here</p>
        <Button
          variant="outline"
          className="mt-4 border-zinc-700 text-zinc-400"
          onClick={fetchHistory}
        >
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-zinc-400">{history.length} items</p>
        <Button
          variant="ghost"
          size="sm"
          className="text-zinc-400 hover:text-zinc-100"
          onClick={fetchHistory}
        >
          Refresh
        </Button>
      </div>
      <ScrollArea className="h-[calc(100vh-22rem)]">
        <div className="space-y-3 pr-2">
          {history.map((item) => (
            <div
              key={item.docId}
              className="group flex cursor-pointer gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-900/80"
              onClick={() => {
                if (item.videoUrl) {
                  setSelectedVideo(item.videoUrl);
                  setSelectedTitle(item.title || item.prompt || 'Untitled');
                }
              }}
            >
              {/* Thumbnail */}
              <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-md bg-zinc-800">
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Video className="h-6 w-6 text-zinc-600" />
                  </div>
                )}
                {item.videoUrl && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Play className="h-6 w-6 text-white" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="truncate text-sm font-medium text-zinc-100">
                  {item.title || 'Untitled'}
                </p>
                {item.prompt && (
                  <p className="truncate text-xs text-zinc-500">{truncate(item.prompt, 80)}</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {item.modelName && (
                    <Badge variant="secondary" className="text-[10px] bg-zinc-800 text-zinc-400">
                      {item.modelName}
                    </Badge>
                  )}
                  <Badge variant={statusVariant(item.status)} className="text-[10px]">
                    {statusLabel(item.status)}
                  </Badge>
                  <span className="text-[10px] text-zinc-600">{formatTime(item.createTime)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Video dialog */}
      <Dialog open={!!selectedVideo} onOpenChange={(open) => !open && setSelectedVideo(null)}>
        <DialogContent className="border-zinc-800 bg-zinc-950 max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-zinc-100">{selectedTitle}</DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-2">
            {selectedVideo && (
              <video
                src={selectedVideo}
                controls
                autoPlay
                className="w-full rounded-lg"
                playsInline
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}