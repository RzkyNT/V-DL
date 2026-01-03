/**
 * Popup Script - Media Downloader Pro
 */

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
            ? `<button class="btn-icon btn-m3u8" data-type="video" data-index="${index}" title="Convert M3U8">
                 <i class="fas fa-film"></i>
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

  // Use extension from media data if available, otherwise infer
  const ext = media.ext || (type === "image" ? "jpg" : "mp4");

  return `${name}.${ext}`;
}

// ===========================
// M3U8 HLS Streaming Handler
// ===========================

/**
 * Show dialog untuk M3U8 streaming file
 * @param {object} media - Media object
 */
function showM3U8Dialog(media) {
  const dialogHtml = `
    <div class="m3u8-dialog-overlay" id="m3u8Dialog">
      <div class="m3u8-dialog-content">
        <div class="m3u8-dialog-header">
          <h2><i class="fas fa-info-circle"></i> M3U8 Streaming File</h2>
          <button class="m3u8-dialog-close" id="m3u8CloseBtn">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="m3u8-dialog-body">
          <p class="m3u8-warning">
            <i class="fas fa-exclamation-triangle"></i>
            <strong>Format HLS Streaming</strong><br>
            File M3U8 adalah playlist streaming yang berisi banyak segment video. 
            Format ini tidak bisa langsung di-download seperti video biasa.
          </p>

          <div class="m3u8-info-box">
            <div class="info-item">
              <span class="info-label">File:</span>
              <span class="info-value">${media.filename}</span>
            </div>
            <div class="info-item">
              <span class="info-label">URL:</span>
              <span class="info-value url-value" id="m3u8Url">${media.src}</span>
            </div>
          </div>

          <div class="m3u8-steps">
            <h3>Cara Download:</h3>
            <ol>
              <li>Klik button <strong>"Open Converter"</strong> di bawah</li>
              <li>URL playlist akan otomatis di-copy ke converter</li>
              <li>Tunggu konversi selesai</li>
              <li>Download file MP4 yang sudah jadi</li>
            </ol>
          </div>
        </div>

        <div class="m3u8-dialog-actions">
          <button class="btn-primary" id="m3u8CopyBtn">
            <i class="fas fa-copy"></i> Copy URL
          </button>
          <button class="btn-primary" id="m3u8OpenBtn">
            <i class="fas fa-external-link-alt"></i> Open Converter
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
  const copyBtn = document.getElementById("m3u8CopyBtn");
  const openBtn = document.getElementById("m3u8OpenBtn");

  closeBtn.addEventListener("click", () => closeM3U8Dialog());
  closeBtnAlt.addEventListener("click", () => closeM3U8Dialog());
  copyBtn.addEventListener("click", () => copyM3U8Url(media.src));
  openBtn.addEventListener("click", () => openM3U8Converter(media.src));

  // Close dialog when clicking outside
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      closeM3U8Dialog();
    }
  });
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

/**
 * Copy M3U8 URL ke clipboard
 * @param {string} url - M3U8 URL
 */
function copyM3U8Url(url) {
  navigator.clipboard.writeText(url)
    .then(() => {
      showNotification("URL copied to clipboard!");
    })
    .catch(err => {
      console.error("Failed to copy:", err);
    });
}


/**
 * Open M3U8 converter dengan pre-filled URL
 * @param {string} url - M3U8 URL
 */
function openM3U8Converter(url) {
  const converterUrl = "https://www.m3u8-to-mp4-converter.com/";
  const encodedUrl = encodeURIComponent(url);
  
  // Open converter in new tab
  chrome.tabs.create({
    url: converterUrl,
  });

  // Show notification
  showNotification("✅ Converter opened! Paste the URL there.");
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
  console.log(message);

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
