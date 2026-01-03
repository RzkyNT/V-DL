/**
 * Content Script - Media Downloader Pro
 * Scraping media dari halaman web
 */

// ========================
// Helper Functions
// ========================

/**
 * Extract file extension dari URL
 * @param {string} url - URL file
 * @returns {object} {ext: string, name: string, size: string}
 */
function extractFileInfo(url) {
  try {
    // Remove query parameters
    const cleanUrl = url.split("?")[0].split("#")[0];
    
    // Extract filename
    const parts = cleanUrl.split("/");
    const filename = parts[parts.length - 1] || "";
    
    // Extract extension
    const ext = filename.includes(".") 
      ? filename.split(".").pop().toLowerCase()
      : "unknown";
    
    return {
      ext: ext,
      filename: filename,
      url: url
    };
  } catch (error) {
    return { ext: "unknown", filename: "", url: url };
  }
}

/**
 * Validate file extension
 * @param {string} ext - File extension
 * @param {string} type - Media type (image/video/audio)
 * @returns {boolean}
 */
function isValidExtension(ext, type) {
  const validExtensions = {
    image: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff"],
    video: ["mp4", "webm", "m3u8", "mkv", "avi", "mov", "flv", "3gp", "ts"],
    audio: ["mp3", "wav", "m4a", "aac", "flac", "ogg", "opus", "wma"]
  };
  
  const typeExtensions = validExtensions[type] || [];
  return typeExtensions.includes(ext);
}

/**
 * Get human-readable file size
 * @param {number} bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "Unknown";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}

// ========================
// Scraping Functions
// ========================
function getImages() {
  const images = [];

  // Ambil dari <img> tag
  [...document.querySelectorAll("img")].forEach((img) => {
    const src = img.src || img.getAttribute("data-src");
    if (src && src.startsWith("http")) {
      const fileInfo = extractFileInfo(src);
      // Only include if valid image extension
      if (isValidExtension(fileInfo.ext, "image")) {
        images.push({
          type: "image",
          src: src,
          alt: img.alt || "Image",
          title: img.title || "Untitled",
          ext: fileInfo.ext,
          filename: fileInfo.filename,
        });
      }
    }
  });

  // Ambil dari <image> SVG
  [...document.querySelectorAll("image[href], image[xlink\\:href]")].forEach((imgSvg) => {
    const src = imgSvg.getAttribute("href") || imgSvg.getAttribute("xlink:href");
    if (src && src.startsWith("http")) {
      const fileInfo = extractFileInfo(src);
      if (isValidExtension(fileInfo.ext, "image")) {
        images.push({
          type: "image",
          src: src,
          alt: imgSvg.getAttribute("title") || "SVG Image",
          title: imgSvg.getAttribute("alt") || "SVG Image",
          ext: fileInfo.ext,
          filename: fileInfo.filename,
        });
      }
    }
  });

  // Ambil dari picture source
  [...document.querySelectorAll("picture source")].forEach((source) => {
    const srcset = source.getAttribute("srcset");
    if (srcset) {
      const urls = srcset.split(",").map((s) => s.trim().split(" ")[0]);
      urls.forEach((url) => {
        if (url.startsWith("http")) {
          const fileInfo = extractFileInfo(url);
          if (isValidExtension(fileInfo.ext, "image")) {
            images.push({
              type: "image",
              src: url,
              alt: "Picture source",
              title: "Picture element",
              ext: fileInfo.ext,
              filename: fileInfo.filename,
            });
          }
        }
      });
    }
  });

  // Remove duplicates
  const uniqueImages = [];
  const seenUrls = new Set();
  for (const img of images) {
    if (!seenUrls.has(img.src)) {
      seenUrls.add(img.src);
      uniqueImages.push(img);
    }
  }

  return uniqueImages;
}

// Fungsi untuk mengambil semua video
function getVideos() {
  const videos = [];

  // Video dari <video> tag
  [...document.querySelectorAll("video")].forEach((video) => {
    // Get poster/thumbnail
    const poster = video.getAttribute("poster") || 
                   video.getAttribute("data-poster") ||
                   video.querySelector("img")?.src;
    
    [...video.querySelectorAll("source")].forEach((source) => {
      if (source.src) {
        const fileInfo = extractFileInfo(source.src);
        if (isValidExtension(fileInfo.ext, "video")) {
          videos.push({
            type: "video",
            src: source.src,
            format: source.type || "video",
            title: video.title || "Video",
            ext: fileInfo.ext,
            filename: fileInfo.filename,
            poster: poster, // ← NEW: Thumbnail/poster
          });
        }
      }
    });
  });

  // Video src langsung dari video tag
  [...document.querySelectorAll("video[src]")].forEach((video) => {
    if (video.src) {
      // Get poster/thumbnail
      const poster = video.getAttribute("poster") || 
                     video.getAttribute("data-poster") ||
                     video.querySelector("img")?.src;
      
      const fileInfo = extractFileInfo(video.src);
      if (isValidExtension(fileInfo.ext, "video")) {
        videos.push({
          type: "video",
          src: video.src,
          format: "video",
          title: video.title || "Video",
          ext: fileInfo.ext,
          filename: fileInfo.filename,
          poster: poster, // ← NEW: Thumbnail/poster
        });
      }
    }
  });

  // Ambil dari data-playlist attribute (video player custom)
  [...document.querySelectorAll("[data-playlist]")].forEach((el) => {
    const playlistUrl = el.getAttribute("data-playlist");
    if (playlistUrl && playlistUrl.startsWith("http")) {
      // Get poster from various attributes
      const poster = el.getAttribute("poster") || 
                     el.getAttribute("data-poster") ||
                     el.querySelector("img")?.src;
      
      const fileInfo = extractFileInfo(playlistUrl);
      if (isValidExtension(fileInfo.ext, "video")) {
        videos.push({
          type: "video",
          src: playlistUrl,
          format: fileInfo.ext === "m3u8" ? "m3u8 (HLS)" : "video",
          title: el.getAttribute("data-title") || el.title || el.getAttribute("aria-label") || "Video Playlist",
          ext: fileInfo.ext,
          filename: fileInfo.filename,
          poster: poster, // ← NEW: Thumbnail/poster
        });
      }
    }
  });

  // Ambil dari data-src di video element (lazy loading)
  [...document.querySelectorAll("video[data-src]")].forEach((video) => {
    const dataSrc = video.getAttribute("data-src");
    if (dataSrc && dataSrc.startsWith("http")) {
      // Get poster/thumbnail
      const poster = video.getAttribute("poster") || 
                     video.getAttribute("data-poster") ||
                     video.querySelector("img")?.src;
      
      const fileInfo = extractFileInfo(dataSrc);
      if (isValidExtension(fileInfo.ext, "video")) {
        videos.push({
          type: "video",
          src: dataSrc,
          format: "video",
          title: video.title || video.getAttribute("data-title") || "Video",
          ext: fileInfo.ext,
          filename: fileInfo.filename,
          poster: poster, // ← NEW: Thumbnail/poster
        });
      }
    }
  });

  // Remove duplicates berdasarkan URL
  const uniqueVideos = [];
  const seenUrls = new Set();
  for (const video of videos) {
    if (!seenUrls.has(video.src)) {
      seenUrls.add(video.src);
      uniqueVideos.push(video);
    }
  }

  return uniqueVideos.filter((v) => v.src && v.src.startsWith("http"));
}

// Fungsi untuk mengambil background images dari CSS
function getBackgroundImages() {
  const bgImages = [];

  [...document.querySelectorAll("*")].forEach((el) => {
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg.startsWith("url(")) {
      const url = bg.slice(5, -2).replace(/["']/g, "");
      if (url.startsWith("http")) {
        const fileInfo = extractFileInfo(url);
        if (isValidExtension(fileInfo.ext, "image")) {
          bgImages.push({
            type: "image",
            src: url,
            title: el.className || "Background Image",
            ext: fileInfo.ext,
            filename: fileInfo.filename,
          });
        }
      }
    }
  });

  // Remove duplicates
  const uniqueImages = [];
  const seenUrls = new Set();
  for (const img of bgImages) {
    if (!seenUrls.has(img.src)) {
      seenUrls.add(img.src);
      uniqueImages.push(img);
    }
  }

  return uniqueImages;
}

// Fungsi untuk mengambil semua media
function getAllMedia() {
  const images = getImages();
  const videos = getVideos();
  const bgImages = getBackgroundImages();

  return {
    images: images,
    videos: videos,
    backgroundImages: bgImages,
    total: images.length + videos.length + bgImages.length,
  };
}

// Listen untuk pesan dari popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getMedia") {
    const media = getAllMedia();
    sendResponse({
      success: true,
      data: media,
      url: window.location.href,
    });
  }

  if (request.action === "getImages") {
    const images = getImages();
    sendResponse({
      success: true,
      data: { images },
      count: images.length,
    });
  }

  if (request.action === "getVideos") {
    const videos = getVideos();
    sendResponse({
      success: true,
      data: { videos },
      count: videos.length,
    });
  }
});

// Note: Inline script injection tidak diperbolehkan oleh CSP di Manifest V3
// Gunakan Message API untuk komunikasi dengan halaman jika diperlukan
console.log("✅ Media Downloader Content Script Loaded");
