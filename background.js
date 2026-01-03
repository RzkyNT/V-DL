/**
 * Background Service Worker - Media Downloader Pro
 * Handle downloads dan network monitoring
 */

// Handle download request
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "downloadFile") {
    const { url, filename, type } = request;

    // Sanitize filename
    const sanitizedFilename = filename
      .replace(/[<>:"/\\|?*]/g, "_")
      .substring(0, 200);

    // Create folder berdasarkan tipe
    const folder = type === "image" ? "Images" : type === "video" ? "Videos" : "Downloads";
    const fullFilename = `MediaDownloader/${folder}/${sanitizedFilename}`;

    chrome.downloads.download(
      {
        url: url,
        filename: fullFilename,
        saveAs: false,
      },
      (downloadId) => {
        if (downloadId) {
          sendResponse({
            success: true,
            message: "Download started",
            downloadId: downloadId,
          });
        } else {
          sendResponse({
            success: false,
            message: chrome.runtime.lastError?.message || "Download failed",
          });
        }
      }
    );

    return true; // Indicates asynchronous response
  }

  if (request.action === "downloadMultiple") {
    const { urls, filenames, type } = request;
    let completed = 0;
    const results = [];

    urls.forEach((url, index) => {
      const filename = filenames[index] || `media_${index}`;
      const folder = type === "image" ? "Images" : "Videos";
      const fullFilename = `MediaDownloader/${folder}/${filename}`;

      chrome.downloads.download(
        {
          url: url,
          filename: fullFilename,
          saveAs: false,
        },
        (downloadId) => {
          completed++;
          if (downloadId) {
            results.push({ success: true, index });
          } else {
            results.push({ success: false, index });
          }

          if (completed === urls.length) {
            sendResponse({
              success: true,
              message: `Batch download started: ${completed} file(s)`,
              results: results,
            });
          }
        }
      );
    });

    return true;
  }
});

// Monitor untuk download completion
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state && delta.state.current === "complete") {
    console.log("✅ Download completed:", delta.id);
    // Bisa tambah notifikasi di sini
  }
});

// Install event - setup default storage
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.local.set({
      downloadCount: 0,
      downloadHistory: [],
      settings: {
        autoDownload: false,
        openFolder: false,
        notifyComplete: true,
      },
    });
    console.log("✅ Media Downloader Pro installed!");
  }
});

console.log("✅ Background Service Worker Loaded");
