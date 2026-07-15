'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Film, CreditCard, LogOut, Upload, X, Play, Loader2, Sparkles,
  History, ImagePlus, Video, Clock, Zap, Menu, Crown, User,
  CheckCircle2, XCircle, LayoutDashboard, Wand2, Timer, Monitor,
  LayoutGrid, Settings2, ChevronDown,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { useAppStore } from '@/lib/store';
import type { ModelOption, SceneOption, HistoryItem as HistoryItemType } from '@/lib/store';
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

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ====================================================================
//  Connect Logic (shared)
// ====================================================================

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
      const models = modelData.models || [];
      if (models.length > 0) {
        const firstModel = models[0];
        store.setModel(firstModel.modelName);
        if (firstModel.videoResolution?.length > 0) {
          store.setResolution(firstModel.videoResolution[0]);
        }
        if (firstModel.videoSize?.length > 0) {
          store.setVideoSize(firstModel.videoSize[0].ratio);
        }
        if (firstModel.duration?.length > 0) {
          store.setDuration(firstModel.duration[0].value);
        }
      }
    }
  } catch {
    toast.error('Connection failed');
  }
}

// ====================================================================
//  Main Page
// ====================================================================

export default function DashboardPage() {
  const store = useAppStore();

  const handleTabChange = (val: string) => {
    store.setActiveTab(val);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <Tabs value={store.activeTab} onValueChange={handleTabChange} className="h-full">
          <div className="hidden">
            <TabsList>
              <TabsTrigger value="dashboard" />
              <TabsTrigger value="create" />
              <TabsTrigger value="history" />
            </TabsList>
          </div>
          <TabsContent value="dashboard" className="mt-0">
            <DashboardTab />
          </TabsContent>
          <TabsContent value="create" className="mt-0">
            <CreateTab />
          </TabsContent>
          <TabsContent value="history" className="mt-0">
            <HistoryTab />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}

// ====================================================================
//  Header
// ====================================================================

function Header() {
  const store = useAppStore();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'create', label: 'Create', icon: Wand2 },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: Logo + Desktop Nav */}
          <div className="flex items-center gap-6">
            {/* Mobile hamburger */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetHeader className="p-4 border-b border-border">
                  <SheetTitle className="flex items-center gap-2">
                    <Film className="h-5 w-5 text-emerald-600" />
                    OreateAI Studio
                  </SheetTitle>
                </SheetHeader>
                <nav className="p-3 space-y-1">
                  {navItems.map((item) => (
                    <Button
                      key={item.id}
                      variant={store.activeTab === item.id ? 'secondary' : 'ghost'}
                      className={`w-full justify-start gap-3 ${store.activeTab === item.id ? 'bg-emerald-50 text-emerald-700' : ''}`}
                      onClick={() => {
                        store.setActiveTab(item.id);
                      }}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  ))}
                  {store.isAuthenticated && (
                    <>
                      <Separator className="my-2" />
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => store.reset()}
                      >
                        <LogOut className="h-4 w-4" />
                        Disconnect
                      </Button>
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <button
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
              onClick={() => store.setActiveTab('dashboard')}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600 text-white">
                <Film className="h-4 w-4" />
              </div>
              <span className="font-bold text-lg text-foreground hidden sm:inline">
                OreateAI <span className="text-emerald-600">Studio</span>
              </span>
            </button>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  size="sm"
                  className={`gap-2 rounded-lg ${store.activeTab === item.id ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => store.setActiveTab(item.id)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              ))}
            </nav>
          </div>

          {/* Right: Credits + User */}
          <div className="flex items-center gap-3">
            {store.isAuthenticated && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 cursor-default">
                      <Zap className="h-3 w-3" />
                      {formatNumber(store.restPoint)}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{store.restPoint} credits remaining</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {store.isAuthenticated && (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    {store.userInfo?.avatar ? (
                      <AvatarImage src={store.userInfo.avatar} alt={store.userInfo.email} />
                    ) : null}
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                      {(store.userInfo?.email || 'U')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground leading-tight truncate max-w-[140px]">
                      {store.userInfo?.email || 'User'}
                    </span>
                    {store.vipInfo && store.vipInfo.vipType > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-300 text-amber-700 bg-amber-50 mt-0.5 w-fit">
                        <Crown className="h-2.5 w-2.5 mr-0.5" /> VIP
                      </Badge>
                    )}
                  </div>
                </div>
                <Separator orientation="vertical" className="h-8 hidden sm:block" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-red-600"
                  onClick={() => store.reset()}
                >
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only">Disconnect</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// ====================================================================
//  Footer
// ====================================================================

function Footer() {
  return (
    <footer className="border-t border-border bg-background mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} OreateAI Studio
          </p>
          <p className="text-xs text-muted-foreground">
            AI Video Generation Dashboard
          </p>
        </div>
      </div>
    </footer>
  );
}

// ====================================================================
//  Dashboard Tab
// ====================================================================

function DashboardTab() {
  const store = useAppStore();

  // Not authenticated: hero connect card
  if (!store.isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-lg rounded-xl border-border shadow-sm">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-100">
                <Film className="h-8 w-8 text-emerald-600" />
              </div>
              <CardTitle className="text-2xl">Connect to Get Started</CardTitle>
              <CardDescription className="text-muted-foreground mt-2">
                Paste your OreateAI session cookie to authenticate and start generating AI videos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder='Paste cookie JSON array or "name=value; ..." string'
                className="min-h-[120px] resize-none rounded-lg"
                value={store.cookie}
                onChange={(e) => store.setCookie(e.target.value)}
              />
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg h-11"
                onClick={handleConnect}
                disabled={!store.cookie.trim()}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Connect & Authenticate
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Authenticated dashboard
  const planName = store.vipInfo && store.vipInfo.vipType > 0 ? 'VIP' : 'Free';
  const currentModel = store.models.find((m) => m.modelName === store.selectedModelName);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Welcome Banner */}
      <Card className="rounded-xl border-border shadow-sm bg-gradient-to-r from-emerald-600 to-emerald-500 text-white border-0">
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">
              Welcome back, {store.userInfo?.email?.split('@')[0] || 'User'}!
            </h1>
            <p className="text-emerald-100 mt-1 text-sm">
              You have <span className="font-semibold text-white">{store.restPoint} credits</span> remaining. Start creating amazing AI videos.
            </p>
          </div>
          <Button
            variant="secondary"
            className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm rounded-lg"
            onClick={() => store.setActiveTab('create')}
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Create Video
          </Button>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Zap}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          label="Credits"
          value={String(store.restPoint)}
          sublabel="Remaining"
        />
        <StatCard
          icon={LayoutGrid}
          iconBg="bg-teal-50"
          iconColor="text-teal-600"
          label="Models"
          value={String(store.models.length)}
          sublabel="Available"
        />
        <StatCard
          icon={History}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          label="History"
          value={String(store.history.length)}
          sublabel="Items loaded"
        />
        <StatCard
          icon={Crown}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
          label="Plan"
          value={planName}
          sublabel={store.vipInfo?.vipType ? `Type ${store.vipInfo.vipType}` : 'Upgrade for more'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Generate (2/3 width) */}
        <Card className="lg:col-span-2 rounded-xl border-border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Quick Generate
            </CardTitle>
            <CardDescription>Enter a prompt and click generate, or switch to the Create tab for advanced options.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Describe the video you want to generate..."
              className="min-h-[100px] resize-none rounded-lg"
              value={store.prompt}
              onChange={(e) => store.setPrompt(e.target.value)}
            />

            {/* Compact selectors row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Scene */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Scene</Label>
                <Select value={store.selectedSceneId} onValueChange={(v) => store.setScene(v)}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {store.scenes.length > 0 ? store.scenes.map((s) => (
                      <SelectItem key={s.sceneId} value={s.sceneId}>
                        {s.sceneName.en || s.sceneName.zh || s.sceneId}
                      </SelectItem>
                    )) : (
                      <>
                        <SelectItem value="text_or_image">Text or Image</SelectItem>
                        <SelectItem value="motion">Motion</SelectItem>
                        <SelectItem value="reference">Reference</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Model */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Model</Label>
                <Select value={store.selectedModelName} onValueChange={(v) => {
                  store.setModel(v);
                  const model = store.models.find((m) => m.modelName === v);
                  if (model) {
                    const isMotion = store.selectedSceneId === 'motion';
                    const costs = isMotion ? model.pointCostMotion : store.selectedSceneId === 'reference' ? model.pointCostReference : model.pointCostImage;
                    const match = costs?.find((c) => c.resolution === store.selectedResolution);
                    if (match) store.setAiType(match.aiType);
                  }
                }}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {store.models.map((m) => (
                      <SelectItem key={m.modelName} value={m.modelName}>{m.modelName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Resolution */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Resolution</Label>
                <div className="flex gap-1.5">
                  {(currentModel?.videoResolution || ['720', '1080']).map((r) => (
                    <Button
                      key={r}
                      variant={store.selectedResolution === r ? 'default' : 'outline'}
                      size="sm"
                      className={`flex-1 rounded-lg ${store.selectedResolution === r ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                      onClick={() => store.setResolution(r)}
                    >
                      {r}p
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Duration + Ratio row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Duration</Label>
                <div className="flex gap-1.5">
                  {(currentModel?.duration || [{ icon: '5s', value: 5 }, { icon: '10s', value: 10 }]).map((d) => (
                    <Button
                      key={d.value}
                      variant={store.selectedDuration === d.value ? 'default' : 'outline'}
                      size="sm"
                      className={`flex-1 rounded-lg ${store.selectedDuration === d.value ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                      onClick={() => store.setDuration(d.value)}
                    >
                      {d.icon || `${d.value}s`}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Ratio</Label>
                <div className="flex gap-1.5">
                  {(currentModel?.videoSize || [{ icon: '1:1', ratio: '1:1' }, { icon: '16:9', ratio: '16:9' }, { icon: '9:16', ratio: '9:16' }]).map((s) => (
                    <Button
                      key={s.ratio}
                      variant={store.selectedVideoSize === s.ratio ? 'default' : 'outline'}
                      size="sm"
                      className={`flex-1 rounded-lg ${store.selectedVideoSize === s.ratio ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                      onClick={() => store.setVideoSize(s.ratio)}
                    >
                      {s.icon || s.ratio}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                For file uploads and advanced options, use the{' '}
                <button
                  className="text-emerald-600 font-medium hover:underline"
                  onClick={() => store.setActiveTab('create')}
                >
                  Create tab
                </button>
              </p>
              <QuickGenerateButton />
            </div>

            {/* Progress */}
            {store.isGenerating && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{store.taskStatus}</span>
                  <span className="text-emerald-600 font-medium">{store.taskProgress}%</span>
                </div>
                <Progress value={store.taskProgress} className="h-2 [&>div]:bg-emerald-500" />
              </div>
            )}

            {/* Video Player */}
            {store.taskVideoUrl && (
              <div className="pt-2">
                <video
                  src={store.taskVideoUrl}
                  controls
                  className="w-full rounded-lg border border-border"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent History (1/3 width) */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-600" />
                Recent History
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-emerald-600 hover:text-emerald-700"
                onClick={() => store.setActiveTab('history')}
              >
                View all
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {store.history.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No history yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Generated videos will appear here</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[480px]">
                <div className="space-y-3 pr-3">
                  {store.history.slice(0, 6).map((item) => (
                    <div
                      key={item.docId || item.chatId}
                      className="group flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div className="w-16 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        ) : item.videoUrl ? (
                          <video src={item.videoUrl} className="w-full h-full object-cover" muted />
                        ) : (
                          <Film className="h-4 w-4 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              item.status === 2
                                ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                                : item.status === 3
                                  ? 'border-red-300 text-red-700 bg-red-50'
                                  : 'border-border text-muted-foreground'
                            }`}
                          >
                            {item.status === 2 ? 'Done' : item.status === 3 ? 'Failed' : 'Processing'}
                          </Badge>
                          {item.createTime && (
                            <span className="text-[10px] text-muted-foreground">{timeAgo(item.createTime)}</span>
                          )}
                        </div>
                        <p className="text-xs text-foreground truncate">
                          {item.prompt || item.title || 'Untitled'}
                        </p>
                      </div>
                      {item.videoUrl && (
                        <a
                          href={item.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1"
                        >
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Play className="h-3.5 w-3.5 text-emerald-600" />
                          </Button>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ====================================================================
//  Stat Card
// ====================================================================

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  sublabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <Card className="rounded-xl border-border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
            <p className="text-[11px] text-muted-foreground/70">{sublabel}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ====================================================================
//  Quick Generate Button (used in Dashboard Tab)
// ====================================================================

function QuickGenerateButton() {
  const store = useAppStore();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scene = store.selectedSceneId;
  const currentModel = store.models.find((m) => m.modelName === store.selectedModelName);
  const isMotion = scene === 'motion';

  // Point cost
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

  const canGenerate = store.isAuthenticated && !store.isGenerating && store.restPoint >= pointCost;

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleClick = async () => {
    if (!canGenerate) return;
    const hasImage = !!store.imageFile;
    const hasVideo = !!store.videoFile;
    const isTextOnly = !hasImage && !hasVideo;
    const isMot = scene === 'motion';

    if (isMot && !hasVideo) {
      toast.error('Motion mode requires a video file. Use the Create tab to upload files.');
      return;
    }

    store.setGenerating(true);
    store.setTaskProgress(0);
    store.setTaskStatus(isTextOnly ? 'generating' : 'uploading');
    store.setTaskVideoUrl(null);
    store.setTaskId(null);

    try {
      let imageUrl = '';
      let videoUrl = '';

      if (!isTextOnly) {
        store.setTaskStatus('uploading');
        const filesToUpload: Array<{ filename: string; fileExt: string; size: number; file: File }> = [];

        const imageNoExt = getFilenameNoExt(store.imageFile!.name);
        const imageExt = getExt(store.imageFile!.name);
        filesToUpload.push({ filename: imageNoExt, fileExt: imageExt, size: store.imageFile!.size, file: store.imageFile! });

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

        store.setTaskStatus('uploading');
        const keyList: Record<string, { bucket: string; objectPath: string; sessionkey: string }> = tokenData.KeyList;
        const uploadedUrls: string[] = [];
        const keys = Object.keys(keyList);

        for (let i = 0; i < filesToUpload.length; i++) {
          const f = filesToUpload[i];
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

        imageUrl = uploadedUrls[0] || '';
        if (isMot && uploadedUrls.length > 1) {
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
      }

      // Build SSE request
      store.setTaskStatus('generating');
      const chatId = generateChatID();

      const attachments: Array<Record<string, unknown>> = [];
      if (isMot && videoUrl) {
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
        });
      }
      if (hasImage && imageUrl) {
        attachments.push({
          bos_url: imageUrl,
          bosUrl: imageUrl,
          docId: '',
          doc_title: getFilenameNoExt(store.imageFile!.name),
          doc_type: getExt(store.imageFile!.name),
          size: store.imageFile!.size,
          flag: 'upload',
          type: 'file',
          status: 1,
        });
      }

      const curModel = store.models.find((m) => m.modelName === store.selectedModelName);
      const isMotScene = scene === 'motion';
      const isRefScene = scene === 'reference';
      const costs = isMotScene
        ? (curModel?.pointCostMotion || [])
        : isRefScene
          ? (curModel?.pointCostReference || [])
          : (curModel?.pointCostImage || []);
      const genDuration = Number(store.selectedDuration) || 5;
      const genResolution = store.selectedResolution || '';
      const matchedCost = costs.find((c: { resolution?: string; duration?: number }) => {
        const resOk = !c.resolution || c.resolution === genResolution;
        const durOk = c.duration === undefined || c.duration === genDuration;
        return resOk && durOk;
      });
      const genAiType = matchedCost?.aiType ?? 0;

      const hasDur = !!(curModel?.duration && curModel.duration.length > 0);
      const videoConfig: Record<string, unknown> = {
        modelName: store.selectedModelName,
        ratio: store.selectedVideoSize || '',
        resolution: genResolution,
        ...(hasDur ? { duration: genDuration } : {}),
        isAudio: false,
        aiType: genAiType,
        scene: store.selectedSceneId,
      };

      if (scene === 'text_or_image') {
        videoConfig.textOrImage = { image: imageUrl || '' };
      } else if (scene === 'motion') {
        let motDurVal: number | string = '';
        if (store.motDuration) {
          const n = parseInt(store.motDuration);
          motDurVal = isNaN(n) ? '' : n;
        }
        videoConfig.motion = {
          characterImage: imageUrl,
          motionVideo: videoUrl,
          motDuration: motDurVal,
          keepOriginalSound: false,
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
          keepOriginalSound: false,
        };
      } else if (scene === 'frame_based') {
        videoConfig.frameBased = { firstFrame: imageUrl || '', lastFrame: '' };
      }

      const cookies = parseCookies(store.cookie);

      const sseRequest = buildSSERequest({
        chatId,
        prompt: store.prompt || '',
        attachments: attachments as Array<Record<string, unknown>>,
        videoConfig: videoConfig as unknown as Record<string, unknown>,
        cookies,
        userInfo: store.userInfo as Record<string, unknown> | null,
      });

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

          store.setTaskProgress(Math.max(progress, Math.min(pollCount * 2, 95)));
        } catch {
          // continue polling
        }
      }, 3000);
    } catch {
      store.setGenerating(false);
      store.setTaskStatus('idle');
      toast.error('Generation failed');
    }
  };

  return (
    <Button
      size="lg"
      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-6"
      disabled={!canGenerate}
      onClick={handleClick}
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
  );
}

// ====================================================================
//  Create Tab
// ====================================================================

function CreateTab() {
  const store = useAppStore();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string>('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scene = store.selectedSceneId;
  const isMotion = scene === 'motion';

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

  // Find point costs
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

  const canGenerate = store.isAuthenticated && !store.isGenerating && store.restPoint >= pointCost;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    const hasImage = !!store.imageFile;
    const hasVideo = !!store.videoFile;
    const isTextOnly = !hasImage && !hasVideo;
    const isMot = scene === 'motion';

    if (isMot && !hasVideo) {
      toast.error('Motion mode requires a video file');
      return;
    }

    store.setGenerating(true);
    store.setTaskProgress(0);
    store.setTaskStatus(isTextOnly ? 'generating' : 'uploading');
    store.setTaskVideoUrl(null);
    store.setTaskId(null);

    try {
      let imageUrl = '';
      let videoUrl = '';

      if (!isTextOnly) {
        store.setTaskStatus('uploading');
        const filesToUpload: Array<{ filename: string; fileExt: string; size: number; file: File }> = [];

        const imageNoExt = getFilenameNoExt(store.imageFile!.name);
        const imageExt = getExt(store.imageFile!.name);
        filesToUpload.push({ filename: imageNoExt, fileExt: imageExt, size: store.imageFile!.size, file: store.imageFile! });

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

        store.setTaskStatus('uploading');
        const keyList: Record<string, { bucket: string; objectPath: string; sessionkey: string }> = tokenData.KeyList;
        const uploadedUrls: string[] = [];
        const keys = Object.keys(keyList);

        for (let i = 0; i < filesToUpload.length; i++) {
          const f = filesToUpload[i];
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

        imageUrl = uploadedUrls[0] || '';
        if (isMot && uploadedUrls.length > 1) {
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
      }

      setUploadedImageUrl(imageUrl);
      setUploadedVideoUrl(videoUrl);

      // Build SSE request
      store.setTaskStatus('generating');
      const chatId = generateChatID();

      const attachments: Array<Record<string, unknown>> = [];
      if (isMot && videoUrl) {
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
        });
      }
      if (hasImage && imageUrl) {
        attachments.push({
          bos_url: imageUrl,
          bosUrl: imageUrl,
          docId: '',
          doc_title: getFilenameNoExt(store.imageFile!.name),
          doc_type: getExt(store.imageFile!.name),
          size: store.imageFile!.size,
          flag: 'upload',
          type: 'file',
          status: 1,
        });
      }

      const curModel = store.models.find((m) => m.modelName === store.selectedModelName);
      const isMotScene = scene === 'motion';
      const isRefScene = scene === 'reference';
      const costs = isMotScene
        ? (curModel?.pointCostMotion || [])
        : isRefScene
          ? (curModel?.pointCostReference || [])
          : (curModel?.pointCostImage || []);
      const genDuration = Number(store.selectedDuration) || 5;
      const genResolution = store.selectedResolution || '';
      const matchedCost = costs.find((c: { resolution?: string; duration?: number }) => {
        const resOk = !c.resolution || c.resolution === genResolution;
        const durOk = c.duration === undefined || c.duration === genDuration;
        return resOk && durOk;
      });
      const genAiType = matchedCost?.aiType ?? 0;

      const hasDur = !!(curModel?.duration && curModel.duration.length > 0);
      const videoConfig: Record<string, unknown> = {
        modelName: store.selectedModelName,
        ratio: store.selectedVideoSize || '',
        resolution: genResolution,
        ...(hasDur ? { duration: genDuration } : {}),
        isAudio: false,
        aiType: genAiType,
        scene: store.selectedSceneId,
      };

      if (scene === 'text_or_image') {
        videoConfig.textOrImage = { image: imageUrl || '' };
      } else if (scene === 'motion') {
        let motDurVal: number | string = '';
        if (store.motDuration) {
          const n = parseInt(store.motDuration);
          motDurVal = isNaN(n) ? '' : n;
        }
        videoConfig.motion = {
          characterImage: imageUrl,
          motionVideo: videoUrl,
          motDuration: motDurVal,
          keepOriginalSound: false,
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
          keepOriginalSound: false,
        };
      } else if (scene === 'frame_based') {
        videoConfig.frameBased = { firstFrame: imageUrl || '', lastFrame: '' };
      }

      const cookies = parseCookies(store.cookie);

      const sseRequest = buildSSERequest({
        chatId,
        prompt: store.prompt || '',
        attachments: attachments as Array<Record<string, unknown>>,
        videoConfig: videoConfig as unknown as Record<string, unknown>,
        cookies,
        userInfo: store.userInfo as Record<string, unknown> | null,
      });

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

          store.setTaskProgress(Math.max(progress, Math.min(pollCount * 2, 95)));
        } catch {
          // continue polling
        }
      }, 3000);
    } catch {
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center min-h-[40vh]">
          <Card className="max-w-md rounded-xl border-border shadow-sm">
            <CardContent className="py-12 text-center">
              <Film className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-lg font-medium text-foreground">Not Connected</p>
              <p className="text-sm text-muted-foreground mt-1">Go to Dashboard and connect first</p>
              <Button
                className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                onClick={() => store.setActiveTab('dashboard')}
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prompt */}
          <Card className="rounded-xl border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Prompt</CardTitle>
              <CardDescription>Describe the video you want to generate</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="A cinematic shot of a futuristic city at sunset, with flying cars and neon lights reflecting off glass buildings..."
                className="min-h-[120px] resize-none rounded-lg"
                value={store.prompt}
                onChange={(e) => store.setPrompt(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* File Uploads */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Image Upload */}
            <Card className="rounded-xl border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-emerald-600" />
                  Image Upload
                  {scene === 'text_or_image' && (
                    <Badge variant="outline" className="text-[10px] ml-auto text-muted-foreground">Optional</Badge>
                  )}
                  {scene === 'motion' && (
                    <Badge variant="outline" className="text-[10px] ml-auto text-amber-700 border-amber-300 bg-amber-50">Required</Badge>
                  )}
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
                    <img src={store.imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-lg border border-border" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                      onClick={() => {
                        store.setImageFile(null, null);
                        setUploadedImageUrl('');
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <button
                    className="w-full h-36 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-emerald-400 hover:text-emerald-600 transition-colors cursor-pointer bg-muted/30"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <Upload className="h-6 w-6" />
                    <span className="text-sm font-medium">Drop image or click to upload</span>
                    <span className="text-xs text-muted-foreground/60">PNG, JPG, WEBP</span>
                  </button>
                )}
              </CardContent>
            </Card>

            {/* Video Upload (motion only) */}
            {isMotion && (
              <Card className="rounded-xl border-border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Video className="h-4 w-4 text-emerald-600" />
                    Video Upload
                    <Badge variant="outline" className="text-[10px] ml-auto text-amber-700 border-amber-300 bg-amber-50">Required</Badge>
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
                      <video src={store.videoPreview} className="w-full h-40 object-cover rounded-lg border border-border" muted />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                        onClick={() => {
                          store.setVideoFile(null, null);
                          setUploadedVideoUrl('');
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      className="w-full h-36 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-emerald-400 hover:text-emerald-600 transition-colors cursor-pointer bg-muted/30"
                      onClick={() => videoInputRef.current?.click()}
                    >
                      <Video className="h-6 w-6" />
                      <span className="text-sm font-medium">Drop video or click to upload</span>
                      <span className="text-xs text-muted-foreground/60">MP4, MOV, AVI</span>
                    </button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Scene Selector */}
          <Card className="rounded-xl border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Scene Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: 'text_or_image', label: 'Text or Image', desc: 'Generate from text or with a reference image' },
                  { id: 'motion', label: 'Motion', desc: 'Animate a character using a motion video' },
                  { id: 'reference', label: 'Reference', desc: 'Use reference images/videos as style guide' },
                ].map((s) => (
                  <Button
                    key={s.id}
                    variant={store.selectedSceneId === s.id ? 'default' : 'outline'}
                    className={`rounded-lg h-auto py-2.5 px-4 ${store.selectedSceneId === s.id ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                    onClick={() => {
                      store.setScene(s.id);
                      setUploadedImageUrl('');
                      setUploadedVideoUrl('');
                    }}
                  >
                    <div className="text-left">
                      <div className="font-medium text-sm">{s.label}</div>
                      <div className={`text-[11px] mt-0.5 ${store.selectedSceneId === s.id ? 'text-emerald-100' : 'text-muted-foreground'}`}>
                        {s.desc}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Selectors Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Model */}
            <Card className="rounded-xl border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Model</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={store.selectedModelName} onValueChange={(v) => {
                  store.setModel(v);
                  const model = store.models.find((m) => m.modelName === v);
                  if (model) {
                    const costs = isMotion ? model.pointCostMotion : scene === 'reference' ? model.pointCostReference : model.pointCostImage;
                    const match = costs?.find((c) => c.resolution === store.selectedResolution);
                    if (match) store.setAiType(match.aiType);
                  }
                }}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.length > 0
                      ? availableModels.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))
                      : store.models.map((m) => (
                          <SelectItem key={m.modelName} value={m.modelName}>{m.modelName}</SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Duration */}
            <Card className="rounded-xl border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  Duration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {(currentModel?.duration || [{ icon: '5s', value: 5 }, { icon: '10s', value: 10 }]).map((d) => (
                    <Button
                      key={d.value}
                      variant={store.selectedDuration === d.value ? 'default' : 'outline'}
                      size="sm"
                      className={`flex-1 rounded-lg ${store.selectedDuration === d.value ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                      onClick={() => store.setDuration(d.value)}
                    >
                      {d.icon || `${d.value}s`}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Resolution */}
            <Card className="rounded-xl border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  Resolution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {(currentModel?.videoResolution || ['720', '1080']).map((r) => (
                    <Button
                      key={r}
                      variant={store.selectedResolution === r ? 'default' : 'outline'}
                      size="sm"
                      className={`flex-1 rounded-lg ${store.selectedResolution === r ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                      onClick={() => store.setResolution(r)}
                    >
                      {r}p
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Video Size / Ratio */}
            <Card className="rounded-xl border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                  Aspect Ratio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {(currentModel?.videoSize || [{ icon: '1:1', ratio: '1:1' }, { icon: '16:9', ratio: '16:9' }, { icon: '9:16', ratio: '9:16' }]).map((s) => (
                    <Button
                      key={s.ratio}
                      variant={store.selectedVideoSize === s.ratio ? 'default' : 'outline'}
                      size="sm"
                      className={`flex-1 rounded-lg ${store.selectedVideoSize === s.ratio ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                      onClick={() => store.setVideoSize(s.ratio)}
                    >
                      {s.icon || s.ratio}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Motion Options */}
          {isMotion && (
            <Card className="rounded-xl border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  Motion Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Motion Duration</Label>
                  <div className="flex gap-2 mt-2">
                    {['3', '4', '5'].map((d) => (
                      <Button
                        key={d}
                        variant={store.motDuration === d ? 'default' : 'outline'}
                        size="sm"
                        className={`rounded-lg ${store.motDuration === d ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                        onClick={() => store.setMotDuration(d)}
                      >
                        {d}s
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Keep Original Sound</Label>
                  <Switch
                    checked={store.keepOriginalSound}
                    onCheckedChange={store.setKeepOriginalSound}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cost & Generate */}
          <Card className="rounded-xl border-border shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">Cost: </span>
                  <span className="text-emerald-600 font-bold text-lg">{pointCost}</span>
                  <span className="text-muted-foreground ml-1">credits</span>
                  {store.restPoint < pointCost && (
                    <Badge variant="outline" className="ml-2 border-red-300 text-red-700 bg-red-50 text-xs">
                      Insufficient credits
                    </Badge>
                  )}
                </div>
                <Button
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-8"
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
                      Generate Video
                    </>
                  )}
                </Button>
              </div>

              {/* Progress */}
              {store.isGenerating && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground capitalize">{store.taskStatus}</span>
                    <span className="text-emerald-600 font-medium">{store.taskProgress}%</span>
                  </div>
                  <Progress value={store.taskProgress} className="h-2.5 [&>div]:bg-emerald-500" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Video Player */}
          {store.taskVideoUrl && (
            <Card className="rounded-xl border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Play className="h-5 w-5 text-emerald-600" />
                  Generated Video
                </CardTitle>
              </CardHeader>
              <CardContent>
                <video
                  src={store.taskVideoUrl}
                  controls
                  className="w-full rounded-lg border border-border"
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Panel (1/3) - Config Summary */}
        <div className="space-y-6">
          <Card className="rounded-xl border-border shadow-sm sticky top-24">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-emerald-600" />
                Configuration Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <ConfigRow label="Scene" value={store.selectedSceneId} />
                <ConfigRow label="Model" value={store.selectedModelName || 'None'} />
                <ConfigRow label="Resolution" value={store.selectedResolution ? `${store.selectedResolution}p` : 'None'} />
                <ConfigRow label="Duration" value={`${store.selectedDuration}s`} />
                <ConfigRow label="Ratio" value={store.selectedVideoSize || 'Default'} />
                {isMotion && (
                  <>
                    <ConfigRow label="Motion Duration" value={`${store.motDuration}s`} />
                    <ConfigRow label="Keep Sound" value={store.keepOriginalSound ? 'Yes' : 'No'} />
                  </>
                )}
                <Separator />
                <ConfigRow label="Image" value={store.imageFile ? store.imageFile.name : 'None'} />
                {isMotion && (
                  <ConfigRow label="Video" value={store.videoFile ? store.videoFile.name : 'None'} />
                )}
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Est. Cost</span>
                  <span className="text-lg font-bold text-emerald-600">{pointCost}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Balance</span>
                  <span className="text-sm font-medium text-foreground">{store.restPoint} credits</span>
                </div>
              </div>

              {/* Status */}
              {store.isGenerating && (
                <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Loader2 className="h-4 w-4 text-emerald-600 animate-spin" />
                    <span className="text-sm font-medium text-emerald-700 capitalize">{store.taskStatus}</span>
                  </div>
                  <Progress value={store.taskProgress} className="h-1.5 mt-2 [&>div]:bg-emerald-500" />
                  <p className="text-xs text-emerald-600 mt-1">{store.taskProgress}% complete</p>
                </div>
              )}

              {store.taskStatus === 'complete' && (
                <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">Generation complete!</span>
                  </div>
                </div>
              )}

              {store.taskStatus === 'failed' && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-700">Generation failed</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ====================================================================
//  Config Row (helper for Create Tab sidebar)
// ====================================================================

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground truncate max-w-[160px]">{value}</span>
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

  if (!store.isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center min-h-[40vh]">
          <Card className="max-w-md rounded-xl border-border shadow-sm">
            <CardContent className="py-12 text-center">
              <History className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-lg font-medium text-foreground">Not Connected</p>
              <p className="text-sm text-muted-foreground mt-1">Go to Dashboard and connect first</p>
              <Button
                className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                onClick={() => store.setActiveTab('dashboard')}
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Generation History</h2>
          <p className="text-sm text-muted-foreground mt-1">View all your previously generated videos</p>
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
          onClick={fetchHistory}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <History className="h-4 w-4 mr-2" />
              Load History
            </>
          )}
        </Button>
      </div>

      {store.history.length === 0 ? (
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex items-center justify-center w-16 h-16 rounded-2xl bg-muted">
              <History className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-lg font-medium text-foreground">No history yet</p>
            <p className="text-sm text-muted-foreground mt-1">Click &quot;Load History&quot; to fetch your generation history from OreateAI.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {store.history.map((item) => (
            <Card
              key={item.docId || item.chatId}
              className="rounded-xl border-border shadow-sm hover:shadow-md transition-shadow group"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-muted rounded-t-xl overflow-hidden">
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : item.videoUrl ? (
                  <video src={item.videoUrl} className="w-full h-full object-cover" muted />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
                {/* Status overlay */}
                <div className="absolute top-2 left-2">
                  <Badge
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      item.status === 2
                        ? 'bg-emerald-600 text-white border-0'
                        : item.status === 3
                          ? 'bg-red-600 text-white border-0'
                          : 'bg-yellow-500 text-white border-0'
                    }`}
                  >
                    {item.status === 2 ? 'Complete' : item.status === 3 ? 'Failed' : 'Processing'}
                  </Badge>
                </div>
                {/* Play button overlay */}
                {item.videoUrl && (
                  <a
                    href={item.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                      <Play className="h-5 w-5 text-emerald-600 ml-0.5" />
                    </div>
                  </a>
                )}
              </div>

              {/* Info */}
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  {item.modelName && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                      {item.modelName}
                    </Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground ml-auto flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {item.createTime ? timeAgo(item.createTime) : ''}
                  </span>
                </div>
                <p className="text-sm text-foreground line-clamp-2">
                  {item.prompt || item.title || 'Untitled'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}