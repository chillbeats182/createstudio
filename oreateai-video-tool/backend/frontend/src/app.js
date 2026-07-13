/* ============================================================
   OreateAI Studio — Frontend Application Logic
   Communicates with Go backend via Wails bindings
   ============================================================ */

(function () {
  'use strict';

  // ============================================================
  //  State
  // ============================================================
  const state = {
    cookieJSON: '',
    authenticated: false,
    userInfo: null,
    vipInfo: null,
    restPoint: 0,
    models: [],
    scenes: [],
    // Generation config
    sceneId: 'text_or_image',
    modelName: '',
    duration: 5,
    resolution: '720',
    videoSize: '16:9',
    aiType: 0,
    motDuration: '3',
    keepOriginalSound: false,
    prompt: '',
    // Files
    imageFilePath: '',
    videoFilePath: '',
    // Task
    isGenerating: false,
    currentDocId: null,
    pollInterval: null,
    // History
    history: [],
  };

  // Detect if running inside Wails
  const isWails = !!window.runtime;

  // ============================================================
  //  DOM References
  // ============================================================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Views
  const viewConnect = $('#view-connect');
  const viewAuth = $('#view-auth');

  // Connect form
  const cookieInput = $('#cookie-input');
  const btnConnect = $('#btn-connect');
  const connectError = $('#connect-error');
  const connectSpinner = $('#connect-spinner');
  const connectText = $('#connect-text');

  // Header
  const headerCredits = $('#header-credits');
  const headerCreditsValue = $('#header-credits-value');

  // Sidebar
  const userEmail = $('#user-email');
  const userVip = $('#user-vip');
  const statCredits = $('#stat-credits');
  const statCompleted = $('#stat-completed');
  const statHistory = $('#stat-history');
  const btnDisconnect = $('#btn-disconnect');

  // Config
  const selScene = $('#sel-scene');
  const selModel = $('#sel-model');
  const groupDuration = $('#group-duration');
  const groupResolution = $('#group-resolution');
  const groupVideoSize = $('#group-videosize');
  const groupMotDuration = $('#group-motduration');
  const motionControls = $('#motion-controls');
  const chkKeepSound = $('#chk-keep-sound');

  // Upload
  const zoneImage = $('#zone-image');
  const zoneVideo = $('#zone-video');
  const fileImage = $('#file-image');
  const fileVideo = $('#file-video');
  const previewImage = $('#preview-image');
  const previewVideo = $('#preview-video');
  const btnClearImage = $('#btn-clear-image');
  const btnClearVideo = $('#btn-clear-video');

  // Generate
  const inputPrompt = $('#input-prompt');
  const btnGenerate = $('#btn-generate');
  const generateText = $('#generate-text');
  const generateSpinner = $('#generate-spinner');
  const progressSection = $('#progress-section');
  const progressFill = $('#progress-fill');
  const progressText = $('#progress-text');
  const resultSection = $('#result-section');
  const resultVideo = $('#result-video');

  // History
  const historyList = $('#history-list');
  const historyEmpty = $('#history-empty');
  const btnRefreshHistory = $('#btn-refresh-history');

  // Dialog
  const videoDialog = $('#video-dialog');
  const dialogVideo = $('#dialog-video');
  const dialogTitle = $('#dialog-title');
  const dialogClose = $('#dialog-close');

  // ============================================================
  //  Toast Notification
  // ============================================================
  function toast(message, type = 'info') {
    console.log(`[Toast] ${type}: ${message}`);
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = message;
    $('#toast-container').appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  // ============================================================
  //  Tab Switching
  // ============================================================
  $$('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      $$('.tab-content').forEach((c) => c.classList.remove('active'));
      const target = tab.dataset.tab;
      $(`#tab-${target}`).classList.add('active');
      if (target === 'history') loadHistory();
    });
  });

  // ============================================================
  //  Connect
  // ============================================================
  cookieInput.addEventListener('input', () => {
    btnConnect.disabled = !cookieInput.value.trim();
  });

  btnConnect.addEventListener('click', async () => {
    const raw = cookieInput.value.trim();
    if (!raw) return;

    connectError.style.display = 'none';
    connectSpinner.style.display = 'inline-block';
    connectText.textContent = 'Connecting…';
    btnConnect.disabled = true;

    try {
      if (!isWails || !window.go) {
        toast('Running in browser mode — Wails bindings unavailable. Run as desktop app.', 'error');
        connectText.textContent = 'Connect';
        connectSpinner.style.display = 'none';
        btnConnect.disabled = false;
        return;
      }

      const result = await window.go.main.App.Authenticate(raw);

      if (result.error) {
        connectError.textContent = result.error;
        connectError.style.display = 'block';
        toast(result.error, 'error');
        return;
      }

      // Store state
      state.cookieJSON = raw;
      state.authenticated = true;
      state.userInfo = result.userInfo;
      state.vipInfo = result.vipInfo;
      state.restPoint = result.restPoint;

      // Load models
      try {
        const modelsResult = await window.go.main.App.GetModels();
        if (!modelsResult.error) {
          state.models = modelsResult.models || [];
          state.scenes = modelsResult.scenes || [];
          console.log(`[Models] Loaded ${state.models.length} models, ${state.scenes.length} scenes`);
        } else {
          console.error('[Models] Error:', modelsResult.error);
        }
      } catch (e) {
        console.error('Failed to load models:', e);
      }

      showAuthenticatedView();
      toast('Connected successfully!', 'success');
    } catch (err) {
      connectError.textContent = err.message || 'Connection failed';
      connectError.style.display = 'block';
      toast(err.message || 'Connection failed', 'error');
    } finally {
      connectText.textContent = 'Connect';
      connectSpinner.style.display = 'none';
      btnConnect.disabled = false;
    }
  });

  // ============================================================
  //  Show Authenticated View
  // ============================================================
  function showAuthenticatedView() {
    viewConnect.style.display = 'none';
    viewAuth.style.display = 'block';

    // Header credits
    headerCredits.style.display = 'inline-flex';
    headerCreditsValue.textContent = state.restPoint;

    // Sidebar
    userEmail.textContent = state.userInfo?.email || '-';
    statCredits.textContent = state.restPoint;

    // VIP badge
    if (state.vipInfo?.vipType && state.vipInfo.vipType > 0) {
      userVip.style.display = 'inline-flex';
      userVip.textContent = 'VIP ' + state.vipInfo.vipType;
    } else {
      userVip.style.display = 'inline-flex';
    }

    // Populate scenes
    populateScenes();
    // Populate models
    populateModels();
    // Set defaults
    if (state.models.length > 0) {
      state.modelName = state.models[0].modelName;
      selModel.value = state.modelName;
      updateModelUI();
    }
    if (state.scenes.length > 0) {
      state.sceneId = state.scenes[0].sceneId;
      selScene.value = state.sceneId;
      updateSceneUI();
    }
  }

  // ============================================================
  //  Populate Scenes
  // ============================================================
  function populateScenes() {
    selScene.innerHTML = '';
    state.scenes.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.sceneId;
      opt.textContent = s.sceneName?.en || s.sceneId;
      selScene.appendChild(opt);
    });
  }

  selScene.addEventListener('change', () => {
    state.sceneId = selScene.value;
    updateSceneUI();
  });

  function updateSceneUI() {
    const isMotion = state.sceneId === 'motion';
    const isReference = state.sceneId === 'reference';
    zoneVideo.style.display = (isMotion || isReference) ? 'flex' : 'none';
    motionControls.style.display = isMotion ? 'block' : 'none';
  }

  // ============================================================
  //  Populate Models
  // ============================================================
  function populateModels() {
    selModel.innerHTML = '';
    state.models.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.modelName;
      opt.textContent = m.modelName;
      selModel.appendChild(opt);
    });
  }

  selModel.addEventListener('change', () => {
    state.modelName = selModel.value;
    updateModelUI();
  });

  function updateModelUI() {
    const model = state.models.find((m) => m.modelName === state.modelName);
    if (!model) return;

    // Duration
    groupDuration.innerHTML = '';
    const durations = model.duration || [{ value: 5 }];
    durations.forEach((d) => {
      const btn = document.createElement('button');
      btn.textContent = d.value + 's';
      if (d.value === state.duration || (!durations.find((x) => x.value === state.duration))) {
        btn.classList.add('active');
        state.duration = d.value;
      }
      btn.addEventListener('click', () => {
        groupDuration.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.duration = d.value;
        selectAiType(model);
      });
      groupDuration.appendChild(btn);
    });

    // Resolution
    groupResolution.innerHTML = '';
    const resolutions = model.videoResolution || ['720', '1080'];
    resolutions.forEach((r) => {
      const btn = document.createElement('button');
      btn.textContent = r + 'p';
      if (r === state.resolution) btn.classList.add('active');
      btn.addEventListener('click', () => {
        groupResolution.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.resolution = r;
        selectAiType(model);
      });
      groupResolution.appendChild(btn);
    });

    // Video Size
    groupVideoSize.innerHTML = '';
    const sizes = model.videoSize || [{ ratio: '16:9' }, { ratio: '9:16' }, { ratio: '1:1' }];
    sizes.forEach((s) => {
      const btn = document.createElement('button');
      btn.textContent = s.ratio;
      if (s.ratio === state.videoSize) btn.classList.add('active');
      btn.addEventListener('click', () => {
        groupVideoSize.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.videoSize = s.ratio;
      });
      groupVideoSize.appendChild(btn);
    });

    // Motion Duration
    if (state.sceneId === 'motion' && model.pointCostMotion) {
      groupMotDuration.innerHTML = '';
      const motDurations = [...new Set(model.pointCostMotion.map((c) => c.motDuration))];
      motDurations.forEach((md) => {
        const btn = document.createElement('button');
        btn.textContent = md + 's';
        if (String(md) === state.motDuration) btn.classList.add('active');
        btn.addEventListener('click', () => {
          groupMotDuration.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          state.motDuration = String(md);
          selectAiType(model);
        });
        groupMotDuration.appendChild(btn);
      });
    }

    // Auto-select AI type
    selectAiType(model);
  }

  function selectAiType(model) {
    state.aiType = 0;
    if (state.sceneId === 'motion') {
      const match = (model.pointCostMotion || []).find(
        (c) => String(c.motDuration) === state.motDuration && c.resolution === state.resolution
      );
      if (match) state.aiType = match.aiType;
    } else if (state.sceneId === 'reference') {
      const match = (model.pointCostReference || []).find(
        (c) => c.duration === state.duration && c.resolution === state.resolution
      );
      if (match) state.aiType = match.aiType;
    } else {
      const match = (model.pointCostImage || []).find(
        (c) => c.duration === state.duration && c.resolution === state.resolution
      );
      if (match) state.aiType = match.aiType;
    }
    console.log(`[Config] aiType=${state.aiType} (scene=${state.sceneId}, duration=${state.duration}, res=${state.resolution})`);
  }

  // Keep sound toggle
  chkKeepSound.addEventListener('change', () => {
    state.keepOriginalSound = chkKeepSound.checked;
  });

  // ============================================================
  //  File Upload — Wails vs Browser
  // ============================================================

  // --- Image Upload ---
  function pickImage() {
    if (isWails && window.go) {
      // Wails v2 mode: use Go-bound native file dialog
      window.go.main.App.PickImageFile().then((path) => {
        if (path) {
          console.log('[Upload] Image selected (Wails v2):', path);
          state.imageFilePath = path;
          // Read file and preview via Go backend (returns data URL)
          window.go.main.App.ReadFileAsDataURL(path).then((dataURL) => {
            if (dataURL) {
              previewImage.src = dataURL; // Already a complete data:image/...;base64,... URL
              previewImage.style.display = 'block';
              btnClearImage.style.display = 'flex';
              zoneImage.querySelector('.upload-placeholder').style.display = 'none';
            } else {
              console.error('[Upload] Failed to read image file for preview');
              toast('Failed to preview image', 'error');
            }
          }).catch((err) => {
            console.error('[Upload] ReadFileAsDataURL error:', err);
          });
        }
      }).catch((err) => {
        console.error('[Upload] PickImageFile error:', err);
      });
    } else {
      // Browser fallback: trigger hidden file input
      fileImage.click();
    }
  }

  zoneImage.addEventListener('click', (e) => {
    // Don't trigger if clicking the clear button
    if (e.target.closest('#btn-clear-image')) return;
    pickImage();
  });

  // Browser fallback: handle file input change
  fileImage.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      const file = e.target.files[0];
      console.log('[Upload] Image selected (browser):', file.name, file.type, file.size);
      // In browser mode we can't get a real file path, store the File object
      state.imageFilePath = ''; // Can't use in Wails GenerateVideo
      state._imageFile = file;
      const url = URL.createObjectURL(file);
      previewImage.src = url;
      previewImage.style.display = 'block';
      btnClearImage.style.display = 'flex';
      zoneImage.querySelector('.upload-placeholder').style.display = 'none';
    }
  });

  // Drag-and-drop (works in both modes)
  zoneImage.addEventListener('dragover', (e) => {
    e.preventDefault();
    zoneImage.classList.add('drag-over');
  });
  zoneImage.addEventListener('dragleave', () => zoneImage.classList.remove('drag-over'));
  zoneImage.addEventListener('drop', (e) => {
    e.preventDefault();
    zoneImage.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      if (isWails) {
        // In Wails, drag-and-drop from OS gives us a file path via a different mechanism
        // For now, use the file object as fallback
        console.log('[Upload] Image dropped (Wails):', file.name);
        // The browser File object won't have a real path, show preview only
        state._imageFile = file;
        state.imageFilePath = file.name; // Note: this is just the name, not a real path
        const url = URL.createObjectURL(file);
        previewImage.src = url;
        previewImage.style.display = 'block';
        btnClearImage.style.display = 'flex';
        zoneImage.querySelector('.upload-placeholder').style.display = 'none';
        toast('Dropped files may not work for upload. Use the file picker button instead.', 'info');
      } else {
        state._imageFile = file;
        const url = URL.createObjectURL(file);
        previewImage.src = url;
        previewImage.style.display = 'block';
        btnClearImage.style.display = 'flex';
        zoneImage.querySelector('.upload-placeholder').style.display = 'none';
      }
    }
  });

  btnClearImage.addEventListener('click', (e) => {
    e.stopPropagation();
    clearImage();
  });

  function clearImage() {
    previewImage.src = '';
    previewImage.style.display = 'none';
    btnClearImage.style.display = 'none';
    zoneImage.querySelector('.upload-placeholder').style.display = '';
    state.imageFilePath = '';
    state._imageFile = null;
    fileImage.value = '';
  }

  // --- Video Upload ---
  function pickVideo() {
    if (isWails && window.go) {
      // Wails v2 mode: use Go-bound native file dialog
      window.go.main.App.PickVideoFile().then((path) => {
        if (path) {
          console.log('[Upload] Video selected (Wails v2):', path);
          state.videoFilePath = path;
          // For video preview, use data URL
          window.go.main.App.ReadFileAsDataURL(path).then((dataURL) => {
            if (dataURL) {
              previewVideo.src = dataURL;
              previewVideo.style.display = 'block';
              btnClearVideo.style.display = 'flex';
              zoneVideo.querySelector('.upload-placeholder').style.display = 'none';
              previewVideo.play().catch(() => {});
            }
          }).catch((err) => {
            console.error('[Upload] ReadFileAsDataURL error:', err);
            // Fallback: just store the path, don't show preview
            btnClearVideo.style.display = 'flex';
            zoneVideo.querySelector('.upload-placeholder').style.display = 'none';
          });
        }
      }).catch((err) => {
        console.error('[Upload] PickVideoFile error:', err);
      });
    } else {
      fileVideo.click();
    }
  }

  zoneVideo.addEventListener('click', (e) => {
    if (e.target.closest('#btn-clear-video')) return;
    pickVideo();
  });

  fileVideo.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      const file = e.target.files[0];
      console.log('[Upload] Video selected (browser):', file.name);
      state.videoFilePath = '';
      state._videoFile = file;
      const url = URL.createObjectURL(file);
      previewVideo.src = url;
      previewVideo.style.display = 'block';
      btnClearVideo.style.display = 'flex';
      zoneVideo.querySelector('.upload-placeholder').style.display = 'none';
      previewVideo.play().catch(() => {});
    }
  });

  zoneVideo.addEventListener('dragover', (e) => {
    e.preventDefault();
    zoneVideo.classList.add('drag-over');
  });
  zoneVideo.addEventListener('dragleave', () => zoneVideo.classList.remove('drag-over'));
  zoneVideo.addEventListener('drop', (e) => {
    e.preventDefault();
    zoneVideo.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      if (isWails) {
        console.log('[Upload] Video dropped (Wails):', file.name);
        state._videoFile = file;
        state.videoFilePath = file.name;
        toast('Dropped files may not work for upload. Use the file picker button instead.', 'info');
      }
      const url = URL.createObjectURL(file);
      previewVideo.src = url;
      previewVideo.style.display = 'block';
      btnClearVideo.style.display = 'flex';
      zoneVideo.querySelector('.upload-placeholder').style.display = 'none';
      previewVideo.play().catch(() => {});
    }
  });

  btnClearVideo.addEventListener('click', (e) => {
    e.stopPropagation();
    clearVideo();
  });

  function clearVideo() {
    previewVideo.src = '';
    previewVideo.style.display = 'none';
    btnClearVideo.style.display = 'none';
    zoneVideo.querySelector('.upload-placeholder').style.display = '';
    state.videoFilePath = '';
    state._videoFile = null;
    fileVideo.value = '';
  }

  // ============================================================
  //  Generate Video
  // ============================================================
  btnGenerate.addEventListener('click', startGeneration);

  async function startGeneration() {
    if (state.isGenerating) return;

    if (!isWails || !window.go) {
      toast('Wails bindings required — run as desktop app', 'error');
      return;
    }

    // Validate inputs
    if (!state.modelName) {
      toast('Please select a model', 'error');
      return;
    }

    const needsImage = state.sceneId === 'text_or_image' || state.sceneId === 'motion';
    const needsVideo = state.sceneId === 'motion';
    const needsAnyFile = state.sceneId === 'reference';

    if (needsImage && !state.imageFilePath) {
      toast('Please upload a source image', 'error');
      return;
    }

    if (needsVideo && !state.videoFilePath) {
      toast('Please upload a motion video', 'error');
      return;
    }

    if (needsAnyFile && !state.imageFilePath && !state.videoFilePath) {
      toast('Please upload at least one image or video', 'error');
      return;
    }

    state.isGenerating = true;
    btnGenerate.disabled = true;
    generateText.textContent = 'Generating…';
    generateSpinner.style.display = 'inline-block';
    progressSection.style.display = 'block';
    resultSection.style.display = 'none';
    progressFill.style.width = '0%';
    progressFill.style.background = '';
    progressText.textContent = 'Uploading files…';

    try {
      const model = state.models.find((m) => m.modelName === state.modelName);
      if (model) selectAiType(model);

      console.log('[Generate] Starting generation with:', {
        sceneId: state.sceneId,
        modelName: state.modelName,
        duration: state.duration,
        resolution: state.resolution,
        videoSize: state.videoSize,
        aiType: state.aiType,
        image: state.imageFilePath || '(none)',
        video: state.videoFilePath || '(none)',
        prompt: inputPrompt.value || '(empty)',
      });

      const result = await window.go.main.App.GenerateVideo(
        state.imageFilePath || '',
        state.videoFilePath || '',
        inputPrompt.value,
        state.sceneId,
        state.modelName,
        state.duration,
        state.resolution,
        state.videoSize,
        state.aiType,
        state.motDuration,
        state.keepOriginalSound
      );

      console.log('[Generate] Result:', result);

      if (result.error) {
        toast('Generation failed: ' + result.error, 'error');
        progressText.textContent = 'Failed: ' + result.error;
        progressFill.style.width = '100%';
        progressFill.style.background = 'var(--danger)';
        return;
      }

      if (result.docId) {
        state.currentDocId = result.docId;
        progressText.textContent = 'Task submitted — processing…';
        progressFill.style.width = '20%';
        startPolling();
        toast('Task submitted! Waiting for result...', 'success');
      } else if (result.chatId) {
        // SSE stream mode: use chatId for history-based polling
        state.currentDocId = result.chatId;
        progressText.textContent = 'Task submitted — processing…';
        progressFill.style.width = '20%';
        startPolling();
        toast('Task submitted! Waiting for result...', 'success');
      } else {
        // No docId/chatId but no error either — check submitResult for clues
        console.warn('[Generate] No docId/chatId returned. submitResult:', result.submitResult);
        toast('Task submitted but no ID received. Check Go console for details.', 'info');
        progressText.textContent = 'Submitted (no ID — check console)';
      }
    } catch (err) {
      console.error('[Generate] Exception:', err);
      toast('Error: ' + (err.message || 'Unknown error'), 'error');
      progressText.textContent = 'Error: ' + (err.message || 'Unknown');
      progressFill.style.width = '100%';
      progressFill.style.background = 'var(--danger)';
    } finally {
      state.isGenerating = false;
      btnGenerate.disabled = false;
      generateText.textContent = 'Generate Video';
      generateSpinner.style.display = 'none';
    }
  }

  // ============================================================
  //  Task Polling
  // ============================================================
  function startPolling() {
    stopPolling();
    state.pollInterval = setInterval(pollTaskStatus, 3000);
    // Poll immediately
    pollTaskStatus();
  }

  function stopPolling() {
    if (state.pollInterval) {
      clearInterval(state.pollInterval);
      state.pollInterval = null;
    }
  }

  async function pollTaskStatus() {
    if (!state.currentDocId || !window.go) return;

    try {
      const result = await window.go.main.App.GetTaskStatus(state.currentDocId);

      if (result.error) {
        // If polling returns error (e.g. params error from server), 
        // try refreshing history instead of giving up immediately
        console.warn('[Poll] Status error:', result.error);
        const pollCount = parseInt(progressText.dataset.pollCount || '0') + 1;
        progressText.dataset.pollCount = pollCount;
        
        if (pollCount >= 5) {
          stopPolling();
          progressText.textContent = 'Task submitted. Check History tab for results.';
          progressFill.style.width = '100%';
          progressFill.style.background = 'var(--warning, #f59e0b)';
          toast('Video may be processing. Check the History tab.', 'info');
          loadHistory();
        }
        return;
      }

      const statusData = result.data || {};
      const status = statusData.status;

      console.log(`[Poll] docId=${state.currentDocId} status=${status} progress=${statusData.progress}`);

      if (status === 1) {
        // Processing
        const progress = statusData.progress || 50;
        progressFill.style.width = Math.min(90, 20 + progress * 0.7) + '%';
        progressText.textContent = 'Processing… ' + (progress ? progress + '%' : '');
      } else if (status === 2) {
        // Completed
        stopPolling();
        progressFill.style.width = '100%';
        progressText.textContent = 'Completed!';

        const videoUrl = statusData.videoUrl || statusData.video_url || statusData.url;
        if (videoUrl) {
          resultVideo.src = videoUrl;
          resultSection.style.display = 'block';
          toast('Video generated successfully!', 'success');
        } else {
          toast('Completed but no video URL in response', 'info');
          console.log('[Poll] Completed status data:', statusData);
        }

        // Update credits
        try {
          const authResult = await window.go.main.App.Authenticate(state.cookieJSON);
          if (!authResult.error) {
            state.restPoint = authResult.restPoint;
            statCredits.textContent = authResult.restPoint;
            headerCreditsValue.textContent = authResult.restPoint;
          }
        } catch (e) { /* ignore */ }

        // Refresh history
        loadHistory();
      } else if (status === 3 || status === -1 || status === 4) {
        // Failed
        stopPolling();
        progressFill.style.width = '100%';
        progressFill.style.background = 'var(--danger)';
        const errMsg = statusData.errorMsg || statusData.error || statusData.errMsg || 'Unknown error';
        progressText.textContent = 'Failed: ' + errMsg;
        toast('Generation failed: ' + errMsg, 'error');
        console.error('[Poll] Failed status data:', statusData);
        setTimeout(() => { progressFill.style.background = ''; }, 3000);
      }
    } catch (err) {
      console.error('[Poll] Error:', err);
    }
  }

  // ============================================================
  //  History
  // ============================================================
  async function loadHistory() {
    if (!window.go) return;

    btnRefreshHistory.disabled = true;
    historyEmpty.style.display = 'none';

    // Remove existing items (not the empty state)
    historyList.querySelectorAll('.history-item').forEach((el) => el.remove());

    try {
      const result = await window.go.main.App.GetHistory(1, 50);

      if (result.error) {
        historyEmpty.style.display = 'block';
        return;
      }

      state.history = result.items || [];

      if (state.history.length === 0) {
        historyEmpty.style.display = 'block';
        statHistory.textContent = '0';
        statCompleted.textContent = '0';
        return;
      }

      statHistory.textContent = state.history.length;
      statCompleted.textContent = state.history.filter((h) => h.status === 2).length;

      state.history.forEach((item) => {
        const el = document.createElement('div');
        el.className = 'history-item';

        const statusClass = item.status === 2 ? 'completed' : item.status === 1 ? 'processing' : 'failed';
        const statusText = item.status === 2 ? 'Done' : item.status === 1 ? 'Processing' : 'Failed';
        const date = new Date(item.createTime * 1000).toLocaleDateString();

        el.innerHTML = `
          <div class="history-thumb">
            ${item.thumbnailUrl ? '<img src="' + item.thumbnailUrl + '" />' : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>'}
          </div>
          <div class="history-info">
            <p class="history-title">${escapeHTML(item.title || item.prompt || 'Untitled')}</p>
            <div class="history-meta">
              <span>${item.modelName || '-'}</span>
              <span>${date}</span>
              <span class="badge-status ${statusClass}">${statusText}</span>
            </div>
          </div>
        `;

        if (item.videoUrl) {
          el.addEventListener('click', () => openVideoDialog(item.videoUrl, item.title || 'Video'));
        }

        historyList.appendChild(el);
      });
    } catch (e) {
      console.error('[History] Error:', e);
      historyEmpty.style.display = 'block';
    } finally {
      btnRefreshHistory.disabled = false;
    }
  }

  btnRefreshHistory.addEventListener('click', loadHistory);

  // ============================================================
  //  Video Dialog
  // ============================================================
  function openVideoDialog(url, title) {
    dialogVideo.src = url;
    dialogTitle.textContent = title;
    videoDialog.style.display = 'flex';
    dialogVideo.play().catch(() => {});
  }

  dialogClose.addEventListener('click', closeDialog);
  videoDialog.addEventListener('click', (e) => {
    if (e.target === videoDialog) closeDialog();
  });

  function closeDialog() {
    videoDialog.style.display = 'none';
    dialogVideo.pause();
    dialogVideo.src = '';
  }

  // ============================================================
  //  Disconnect
  // ============================================================
  btnDisconnect.addEventListener('click', () => {
    stopPolling();
    state.authenticated = false;
    state.cookieJSON = '';
    state.models = [];
    state.scenes = [];
    state.history = [];
    state.imageFilePath = '';
    state.videoFilePath = '';
    state._imageFile = null;
    state._videoFile = null;
    clearImage();
    clearVideo();
    inputPrompt.value = '';
    progressSection.style.display = 'none';
    resultSection.style.display = 'none';

    viewAuth.style.display = 'none';
    viewConnect.style.display = 'flex';
    headerCredits.style.display = 'none';
    toast('Disconnected', 'info');
  });

  // ============================================================
  //  Helpers
  // ============================================================
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Keyboard shortcut for dialog close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && videoDialog.style.display === 'flex') {
      closeDialog();
    }
  });

  console.log('[App] OreateAI Studio frontend loaded. Wails mode:', isWails);
})();