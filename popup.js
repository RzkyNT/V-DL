/**
 * Popup Script - Media Downloader Pro
 * with M3U8/HLS Streaming Support
 * @type {HTMLElement}
 */
/* eslint-disable no-undef */

const imageCount = document.getElementById("imageCount");
const videoCount = document.getElementById("videoCount");
const imagesList = document.getElementById("imagesList");
const videosList = document.getElementById("videosList");
const loadingState = document.getElementById("loadingState");
const emptyState = document.getElementById("emptyState");
const downloadAllBtn = document.getElementById("downloadAllBtn");
const scanBtn = document.getElementById("scanBtn");
const tabBtns = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");
const progressModal = document.getElementById("progressModal");

let allMedia = {
  images: [],
  videos: [],
};

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  scanMedia();

  // Tab switching
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const tabName = e.target.dataset.tab;
      switchTab(tabName);
    });
  });

  downloadAllBtn.addEventListener("click", downloadAll);
  scanBtn.addEventListener("click", scanMedia);
});

// Scan media dari halaman
async function scanMedia() {
  showLoading(true);
  imagesList.innerHTML = "";
  videosList.innerHTML = "";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { action: "getMedia" }, (response) => {
      if (response && response.success) {
        allMedia.images = response.data.images || [];
        allMedia.videos = response.data.videos || [];

        renderMedia();
        updateStats();
        showLoading(false);

        if (allMedia.images.length === 0 && allMedia.videos.length === 0) {
          showEmptyState(true);
        } else {
          showEmptyState(false);
        }
      }
    });
  } catch (error) {
    console.error("Error scanning media:", error);
    showLoading(false);
    showEmptyState(true);
  }
}

// Render media items
function renderMedia() {
  // Render images
  imagesList.innerHTML = allMedia.images
    .map(
      (img, index) => `
    <div class="media-item">
      <div class="media-preview">
        <img src="${sanitizeUrl(img.src)}" alt="${img.alt || "Image"}" />
      </div>
      <div class="media-info">
        <div class="media-title">${truncate(img.alt || img.title || "Image", 30)}</div>
        <div class="media-size">${img.ext.toUpperCase()} • ${img.type}</div>
      </div>
      <div class="media-actions">
        <button class="btn-icon" data-type="image" data-index="${index}" title="Download">
          <i class="fas fa-download"></i>
        </button>
      </div>
    </div>
  `
    )
    .join("");

  // Render videos
  videosList.innerHTML = allMedia.videos
    .map(
      (vid, index) => {
        const isM3U8 = vid.ext === "m3u8";
        const hasPoster = vid.poster && vid.poster.startsWith("http");
        
        return `
    <div class="media-item ${isM3U8 ? "media-item-m3u8" : ""}">
      <div class="media-preview video-preview">
        ${hasPoster 
          ? `<img src="${sanitizeUrl(vid.poster)}" alt="Video thumbnail" class="video-thumbnail"/>`
          : `<i class="fas fa-play"></i>`
        }
      </div>
      <div class="media-info">
        <div class="media-title">${truncate(vid.title || "Video", 30)}</div>
        <div class="media-size">${vid.ext.toUpperCase()} • ${vid.format || "Video"}</div>
        ${isM3U8 ? '<div class="media-badge"><i class="fas fa-info-circle"></i> HLS</div>' : ""}
      </div>
      <div class="media-actions">
        ${
          isM3U8
            ? `<button class="btn-icon btn-m3u8" data-type="video" data-index="${index}" title="Download M3U8">
                 <i class="fas fa-download"></i>
               </button>`
            : `<button class="btn-icon" data-type="video" data-index="${index}" title="Download">
                 <i class="fas fa-download"></i>
               </button>`
        }
      </div>
    </div>
  `;
      }
    )
    .join("");

  // Add event listeners to download buttons
  document.querySelectorAll(".btn-icon").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const type = e.target.closest(".btn-icon").dataset.type;
      const index = parseInt(e.target.closest(".btn-icon").dataset.index);
      downloadMedia(index, type);
    });
  });
}

// Update statistics
function updateStats() {
  imageCount.textContent = allMedia.images.length;
  videoCount.textContent = allMedia.videos.length;
}

// Download single media
function downloadMedia(index, type) {
  const media = type === "image" ? allMedia.images[index] : allMedia.videos[index];
  
  // Special handling untuk M3U8 streaming
  if (media.ext === "m3u8") {
    showM3U8Dialog(media);
    return;
  }

  const filename = generateFilename(media, type);

  chrome.runtime.sendMessage(
    {
      action: "downloadFile",
      url: media.src,
      filename: filename,
      type: type,
    },
    (response) => {
      if (response.success) {
        showNotification("✅ Download dimulai: " + filename);
      } else {
        showNotification("❌ Download gagal: " + (response.message || "Unknown error"));
      }
    }
  );
}

// Download all media
function downloadAll() {
  const totalItems = allMedia.images.length + allMedia.videos.length;

  if (totalItems === 0) {
    showNotification("❌ Tidak ada media untuk di-download");
    return;
  }

  if (confirm(`Download ${totalItems} item? Ini akan memakan waktu beberapa saat.`)) {
    const imageUrls = allMedia.images.map((img) => img.src);
    const imageNames = allMedia.images.map((img, i) =>
      generateFilename(img, "image")
    );

    const videoUrls = allMedia.videos.map((vid) => vid.src);
    const videoNames = allMedia.videos.map((vid, i) =>
      generateFilename(vid, "video")
    );

    // Download images
    if (imageUrls.length > 0) {
      chrome.runtime.sendMessage({
        action: "downloadMultiple",
        urls: imageUrls,
        filenames: imageNames,
        type: "image",
      });
    }

    // Download videos
    if (videoUrls.length > 0) {
      chrome.runtime.sendMessage({
        action: "downloadMultiple",
        urls: videoUrls,
        filenames: videoNames,
        type: "video",
      });
    }

    showNotification(`✅ ${totalItems} item mulai di-download`);
  }
}

// Helper functions
function sanitizeUrl(url) {
  try {
    new URL(url);
    return url;
  } catch {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3C/svg%3E";
  }
}

function generateFilename(media, type) {
  let name = media.filename || media.title || media.alt || `media_${Date.now()}`;
  
  // Clean filename
  name = name
    .toLowerCase()
    .replace(/\.[^.]+$/, "") // Remove existing extension
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 100);

  // Determine extension
  let ext = type === "image" ? "jpg" : "mp4";
  
  // For M3U8 videos, convert to mp4
  if (media.ext === "m3u8") {
    ext = "mp4";
  } else if (media.ext) {
    ext = media.ext;
  }

  return `${name}.${ext}`;
}

// ===========================
// M3U8 HLS Streaming Handler
// ===========================

/**
 * Show dialog untuk M3U8 streaming file
 */
function showM3U8Dialog(media) {
  const dialogHtml = `
    <div class="m3u8-dialog-overlay" id="m3u8Dialog">
      <div class="m3u8-dialog-content">
        <div class="m3u8-dialog-header">
          <h2><i class="fas fa-download"></i> M3U8 HLS Stream Download</h2>
          <button class="m3u8-dialog-close" id="m3u8CloseBtn">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="m3u8-dialog-body">
          <p class="m3u8-warning">
            <i class="fas fa-info-circle"></i>
            <strong>HLS Streaming File</strong><br>
            File M3U8 adalah playlist streaming yang berisi banyak video segment. 
            Extension akan download semua segment dan menggabungkannya menjadi satu file video.
          </p>

          <div class="m3u8-info-box">
            <div class="info-item">
              <span class="info-label">File:</span>
              <span class="info-value">${media.filename}</span>
            </div>
            <div class="info-item">
              <span class="info-label">URL:</span>
              <span class="info-value url-value">${media.src}</span>
            </div>
          </div>

          <div id="m3u8ProgressContainer" class="m3u8-progress-container hidden">
            <div class="m3u8-progress-header">
              <h4><i class="fas fa-spinner"></i> Downloading Segments</h4>
              <span class="m3u8-progress-text" id="m3u8ProgressText">0%</span>
            </div>
            <div class="m3u8-progress-bar">
              <div class="m3u8-progress-fill" id="m3u8ProgressFill" style="width: 0%"></div>
            </div>
            <div class="m3u8-progress-details" id="m3u8ProgressDetails">
              <span style="font-weight: 500; color: var(--primary);">0/0</span> segments
            </div>
            <div class="m3u8-progress-status" id="m3u8ProgressStatus" style="margin-top: 8px; font-size: 11px; color: var(--text-muted); text-align: center;">Initializing...</div>
          </div>

          <div class="m3u8-steps" id="m3u8StepsContainer">
            <h3><i class="fas fa-check-circle"></i> Automatic Download</h3>
            <p style="margin: 8px 0; font-size: 13px; color: var(--text-muted);">
              Proses akan berlangsung secara otomatis:
            </p>
            <ul style="margin: 8px 0; padding-left: 20px; font-size: 12px; line-height: 1.8; color: var(--text-muted);">
              <li>Download semua segment video dari server</li>
              <li>Menggabungkan menjadi satu file TS</li>
              <li>Simpan otomatis ke folder Videos</li>
            </ul>
          </div>
        </div>

        <div class="m3u8-dialog-actions">
          <button class="btn-primary" id="m3u8DownloadBtn">
            <i class="fas fa-download"></i> Start Download
          </button>
          <button class="btn-secondary" id="m3u8CloseBtnAlt">
            <i class="fas fa-times"></i> Close
          </button>
        </div>
      </div>
    </div>
  `;

  // Remove existing dialog if any
  const existing = document.getElementById("m3u8Dialog");
  if (existing) existing.remove();

  // Add new dialog
  document.body.insertAdjacentHTML("beforeend", dialogHtml);

  // Attach event listeners
  const dialog = document.getElementById("m3u8Dialog");
  const closeBtn = document.getElementById("m3u8CloseBtn");
  const closeBtnAlt = document.getElementById("m3u8CloseBtnAlt");
  const downloadBtn = document.getElementById("m3u8DownloadBtn");

  closeBtn.addEventListener("click", () => closeM3U8Dialog());
  closeBtnAlt.addEventListener("click", () => closeM3U8Dialog());
  downloadBtn.addEventListener("click", () => startM3U8Download(media));

  // Close dialog when clicking outside
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      closeM3U8Dialog();
    }
  });
}

/**
 * Start M3U8 download with progress tracking
 */
function startM3U8Download(media) {
  const progressContainer = document.getElementById("m3u8ProgressContainer");
  const stepsContainer = document.getElementById("m3u8StepsContainer");
  const downloadBtn = document.getElementById("m3u8DownloadBtn");
  const closeBtnAlt = document.getElementById("m3u8CloseBtnAlt");

  console.log('[M3U8 UI] Starting M3U8 download for:', media.src);

  // Show progress, hide steps
  progressContainer.classList.remove("hidden");
  stepsContainer.classList.add("hidden");
  downloadBtn.disabled = true;
  closeBtnAlt.disabled = true;

  // Reset progress tracking
  window.m3u8StartTime = null;

  // Generate filename
  const filename = generateFilename(media, "video");
  console.log('[M3U8 UI] Generated filename:', filename);

  // Listen for progress messages from background
  const progressListener = (message) => {
    if (message.action === "m3u8Progress") {
      console.log('[M3U8 UI] Progress update:', message);
      
      const progressFill = document.getElementById("m3u8ProgressFill");
      const progressText = document.getElementById("m3u8ProgressText");
      const progressDetails = document.getElementById("m3u8ProgressDetails");
      const progressStatus = document.getElementById("m3u8ProgressStatus");

      progressFill.style.width = message.percentage + "%";
      progressText.textContent = message.percentage + "%";
      progressDetails.innerHTML = `
        <span style="font-weight: 500; color: var(--primary);">${message.downloaded}/${message.total}</span> segments
      `;
      
      const speed = calculateSpeed(message.downloaded);
      progressStatus.textContent = `Speed: ${speed}`;
    }
  };

  chrome.runtime.onMessage.addListener(progressListener);

  console.log('[M3U8 UI] Sending download request to background');

  // Send download request
  chrome.runtime.sendMessage(
    {
      action: "downloadFile",
      url: media.src,
      filename: filename,
      type: "video",
    },
    (response) => {
      console.log('[M3U8 UI] Download response:', response);
      
      // Remove listener
      chrome.runtime.onMessage.removeListener(progressListener);

      if (response.success) {
        console.log('[M3U8 UI] Download successful!');
        showNotification("✅ M3U8 download started! Saving file...");
        setTimeout(() => closeM3U8Dialog(), 3000);
      } else {
        console.error('[M3U8 UI] Download failed:', response.message);
        showNotification("❌ Download failed: " + (response.message || "Unknown error"));
        progressContainer.classList.add("hidden");
        stepsContainer.classList.remove("hidden");
        downloadBtn.disabled = false;
        closeBtnAlt.disabled = false;
      }
    }
  );
}

/**
 * Calculate download speed (segments per second)
 */
function calculateSpeed(downloadedSegments) {
  if (!window.m3u8StartTime) {
    window.m3u8StartTime = Date.now();
    return "measuring...";
  }
  const elapsed = (Date.now() - window.m3u8StartTime) / 1000;
  if (elapsed < 1) return "measuring...";
  const speed = (downloadedSegments / elapsed).toFixed(1);
  return `${speed} seg/s`;
}

/**
 * Close M3U8 dialog
 */
function closeM3U8Dialog() {
  const dialog = document.getElementById("m3u8Dialog");
  if (dialog) {
    dialog.style.animation = "slideOut 0.3s ease";
    setTimeout(() => dialog.remove(), 300);
  }
}

function truncate(str, length) {
  return str.length > length ? str.substring(0, length) + "..." : str;
}

function switchTab(tabName) {
  tabBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  tabContents.forEach((content) => {
    content.classList.toggle("active", content.id === `${tabName}Tab`);
  });
}

function showLoading(show) {
  loadingState.classList.toggle("hidden", !show);
}

function showEmptyState(show) {
  emptyState.classList.toggle("hidden", !show);
}

function showNotification(message) {
  console.log('[NOTIFICATION]', message);

  const notificationEl = document.getElementById("notification");
  notificationEl.innerHTML = `
    <i class="fas fa-check-circle"></i> ${message}
  `;

  // Reset animation by removing and re-adding class
  notificationEl.classList.remove("show", "hide");
  void notificationEl.offsetWidth; // Trigger reflow

  // Show notification
  notificationEl.classList.add("show");

  // Hide after 3 seconds
  setTimeout(() => {
    notificationEl.classList.remove("show");
    notificationEl.classList.add("hide");
  }, 3000);
}
