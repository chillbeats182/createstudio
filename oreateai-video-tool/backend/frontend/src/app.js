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
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = message;
    $('#toast-container').appendChild(el);
    setTimeout(() => el.remove(), 4000);
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
      // Use Wails binding
      let result;
      if (window.go) {
        result = await window.go.main.App.Authenticate(raw);
      } else {
        // Dev fallback (when opened in browser, not Wails)
        toast('Running in browser mode — Wails bindings unavailable', 'error');
        connectText.textContent = 'Connect';
        connectSpinner.style.display = 'none';
        btnConnect.disabled = false;
        return;
      }

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
      let modelsResult;
      try {
        modelsResult = await window.go.main.App.GetModels();
        if (!modelsResult.error) {
          state.models = modelsResult.models || [];
          state.scenes = modelsResult.scenes || [];
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
    // Show/hide video upload & motion controls
    const isMotion = state.sceneId === 'motion';
    const isReference = state.sceneId === 'reference';
    zoneVideo.style.display = (isMotion || isReference) ? 'flex' : 'none';
    motionControls.style.display = isMotion ? 'block' : 'none';

    // Update upload row layout
    if (isMotion || isReference) {
      $('#upload-row').style.display = 'flex';
    } else {
      $('#upload-row').style.display = 'flex';
      zoneVideo.style.display = 'none';
    }
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
  }

  // Keep sound toggle
  chkKeepSound.addEventListener('change', () => {
    state.keepOriginalSound = chkKeepSound.checked;
  });

  // ============================================================
  //  File Upload (using Wails file dialog)
  // ============================================================

  // --- Image Upload ---
  zoneImage.addEventListener('click', () => fileImage.click());
  zoneImage.addEventListener('dragover', (e) => { e.preventDefault(); zoneImage.classList.add('drag-over'); });
  zoneImage.addEventListener('dragleave', () => zoneImage.classList.remove('drag-over'));
  zoneImage.addEventListener('drop', (e) => {
    e.preventDefault();
    zoneImage.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleImageFile(file);
  });
  fileImage.addEventListener('change', (e) => {
    if (e.target.files[0]) handleImageFile(e.target.files[0]);
  });
  btnClearImage.addEventListener('click', (e) => {
    e.stopPropagation();
    clearImage();
  });

  function handleImageFile(file) {
    // In Wails, we get the file path from the native dialog
    // For browser fallback, use URL.createObjectURL
    if (window.runtime) {
      window.runtime.OpenFileDialog({
        Title: 'Select Source Image',
        Filters: [{ Pattern: '*.png;*.jpg;*.jpeg;*.webp', Description: 'Image files' }],
      }).then((path) => {
        if (path) {
          state.imageFilePath = path;
          // Read and preview
          window.go.main.App.ReadFileAsBase64(path).then((data) => {
            if (data) {
              previewImage.src = 'data:image/png;base64,' + btoa(data);
              previewImage.style.display = 'block';
              btnClearImage.style.display = 'flex';
              zoneImage.querySelector('.upload-placeholder').style.display = 'none';
            }
          });
        }
      });
    } else {
      // Browser fallback
      const url = URL.createObjectURL(file);
      previewImage.src = url;
      previewImage.style.display = 'block';
      btnClearImage.style.display = 'flex';
      zoneImage.querySelector('.upload-placeholder').style.display = 'none';
      // Store file reference for later
      state._imageFile = file;
      state.imageFilePath = file.name;
    }
  }

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
  zoneVideo.addEventListener('click', () => fileVideo.click());
  zoneVideo.addEventListener('dragover', (e) => { e.preventDefault(); zoneVideo.classList.add('drag-over'); });
  zoneVideo.addEventListener('dragleave', () => zoneVideo.classList.remove('drag-over'));
  zoneVideo.addEventListener('drop', (e) => {
    e.preventDefault();
    zoneVideo.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) handleVideoFile(file);
  });
  fileVideo.addEventListener('change', (e) => {
    if (e.target.files[0]) handleVideoFile(e.target.files[0]);
  });
  btnClearVideo.addEventListener('click', (e) => {
    e.stopPropagation();
    clearVideo();
  });

  function handleVideoFile(file) {
    if (window.runtime) {
      window.runtime.OpenFileDialog({
        Title: 'Select Motion Video',
        Filters: [{ Pattern: '*.mp4;*.mov;*.avi;*.webm', Description: 'Video files' }],
      }).then((path) => {
        if (path) {
          state.videoFilePath = path;
          previewVideo.src = 'file://' + path;
          previewVideo.style.display = 'block';
          btnClearVideo.style.display = 'flex';
          zoneVideo.querySelector('.upload-placeholder').style.display = 'none';
          previewVideo.play().catch(() => {});
        }
      });
    } else {
      const url = URL.createObjectURL(file);
      previewVideo.src = url;
      previewVideo.style.display = 'block';
      btnClearVideo.style.display = 'flex';
      zoneVideo.querySelector('.upload-placeholder').style.display = 'none';
      previewVideo.play().catch(() => {});
      state._videoFile = file;
      state.videoFilePath = file.name;
    }
  }

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

    // In browser mode, files are blob-based (need FormData upload)
    // In Wails mode, files are local paths (Go reads them directly)
    if (!window.go) {
      toast('Wails bindings required — run as desktop app', 'error');
      return;
    }

    state.isGenerating = true;
    btnGenerate.disabled = true;
    generateText.textContent = 'Generating…';
    generateSpinner.style.display = 'inline-block';
    progressSection.style.display = 'block';
    resultSection.style.display = 'none';
    progressFill.style.width = '0%';
    progressText.textContent = 'Uploading files…';

    try {
      const model = state.models.find((m) => m.modelName === state.modelName);
      selectAiType(model);

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

      if (result.error) {
        toast('Generation failed: ' + result.error, 'error');
        progressText.textContent = 'Failed: ' + result.error;
        return;
      }

      if (result.docId) {
        state.currentDocId = result.docId;
        progressText.textContent = 'Task submitted — processing…';
        progressFill.style.width = '20%';
        startPolling();
        toast('Task submitted!', 'success');
      } else {
        toast('Task submitted (no docId returned)', 'info');
        progressText.textContent = 'Submitted (polling not available)';
      }
    } catch (err) {
      toast('Error: ' + (err.message || 'Unknown error'), 'error');
      progressText.textContent = 'Error: ' + (err.message || 'Unknown');
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
        stopPolling();
        progressText.textContent = 'Polling error: ' + result.error;
        return;
      }

      const statusData = result.data || {};
      const status = statusData.status;

      // Update progress
      if (status === 1) {
        // Processing
        const progress = statusData.progress || 50;
        progressFill.style.width = Math.min(90, 20 + progress * 0.7) + '%';
        progressText.textContent = 'Processing… ' + (progress || '') + '%';
      } else if (status === 2) {
        // Completed
        stopPolling();
        progressFill.style.width = '100%';
        progressText.textContent = 'Completed!';

        const videoUrl = statusData.videoUrl || statusData.video_url || statusData.url;
        if (videoUrl) {
          resultVideo.src = videoUrl;
          resultSection.style.display = 'block';
          toast('Video generated!', 'success');
        } else {
          toast('Completed but no video URL found', 'info');
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
      } else if (status === 3 || status === -1) {
        // Failed
        stopPolling();
        progressFill.style.width = '100%';
        progressFill.style.background = 'var(--danger)';
        progressText.textContent = 'Failed: ' + (statusData.errorMsg || statusData.error || 'Unknown error');
        toast('Generation failed', 'error');
        setTimeout(() => { progressFill.style.background = ''; }, 2000);
      }
    } catch (err) {
      console.error('Poll error:', err);
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

})();