  /**
 * Background Service Worker - Media Downloader Pro
 * Handle downloads dan network monitoring
 */

/**
 * Helper function to download M3U8 streams
 */
async function handleM3U8Download(request, sendResponse) {
  const { url, filename, type } = request;
  
  console.log('[M3U8] Starting download:', { url, filename });

  try {
    // Validate M3U8 URL
    if (!url.includes('.m3u8')) {
      throw new Error('Invalid M3U8 URL');
    }

    console.log('[M3U8] Fetching playlist from:', url);
    
    // Fetch and parse M3U8 playlist
    const playlistResponse = await fetch(url);
    if (!playlistResponse.ok) {
      throw new Error(`Failed to fetch M3U8: ${playlistResponse.statusText}`);
    }

    const playlistText = await playlistResponse.text();
    console.log('[M3U8] Playlist fetched, length:', playlistText.length);
    
    const segments = parseM3U8Playlist(playlistText, url);

    if (segments.length === 0) {
      throw new Error('No video segments found in M3U8 playlist');
    }

    console.log('[M3U8] Found segments:', segments.length);
    console.log('[M3U8] First segment URL:', segments[0]);

    // Download all segments
    const videoBlobs = [];
    let completedSegments = 0;

    for (let i = 0; i < segments.length; i++) {
      const segmentUrl = segments[i];
      try {
        const segmentResponse = await fetch(segmentUrl);
        if (segmentResponse.ok) {
          const blob = await segmentResponse.blob();
          videoBlobs.push(blob);
          completedSegments++;

          console.log(`[M3U8] Downloaded segment ${i + 1}/${segments.length} (${blob.size} bytes)`);

          // Notify progress
          const percentage = Math.round((completedSegments / segments.length) * 100);
          console.log(`[M3U8] Progress: ${percentage}%`);
          
          chrome.runtime.sendMessage({
            action: 'm3u8Progress',
            downloaded: completedSegments,
            total: segments.length,
            percentage: percentage,
          }).catch(() => {}); // Ignore errors if popup closed
        }
      } catch (error) {
        console.warn(`[M3U8] Failed to download segment ${i + 1}:`, segmentUrl, error);
      }
    }

    if (videoBlobs.length === 0) {
      throw new Error('Failed to download any video segments');
    }

    console.log('[M3U8] Downloaded segments:', videoBlobs.length);
    console.log('[M3U8] Total size:', videoBlobs.reduce((sum, b) => sum + b.size, 0), 'bytes');

    // Combine all segments
    console.log('[M3U8] Combining blobs...');
    const combinedBlob = new Blob(videoBlobs, { type: 'video/mp2t' });
    console.log('[M3U8] Combined blob size:', combinedBlob.size, 'bytes');

    // Convert blob to base64 data URL (service workers don't have URL.createObjectURL)
    console.log('[M3U8] Converting blob to base64 data URL...');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result; // This is base64 data URL
      console.log('[M3U8] Data URL created, length:', dataUrl.length);

      // Use sanitized filename and convert extension to mp4
      let sanitizedFilename = filename
        .replace(/[<>:"/\\|?*]/g, '_')
        .substring(0, 200);
      
      // Convert .m3u8 to .mp4
      sanitizedFilename = sanitizedFilename.replace(/\.m3u8$/i, '.mp4');
      
      const fullFilename = `MediaDownloader/Videos/${sanitizedFilename}`;

      console.log('[M3U8] Downloading as:', fullFilename);

      // Download combined file using data URL
      chrome.downloads.download(
        {
          url: dataUrl,
          filename: fullFilename,
          saveAs: false,
        },
        (downloadId) => {
          console.log('[M3U8] chrome.downloads.download callback, downloadId:', downloadId);
          
          if (downloadId) {
            console.log('[M3U8] Download started, ID:', downloadId);
            
            sendResponse({
              success: true,
              message: 'M3U8 download started',
              downloadId: downloadId,
              totalSegments: segments.length,
              fileSize: combinedBlob.size,
            });
          } else {
            console.error('[M3U8] Download failed - no ID returned');
            console.error('[M3U8] Last error:', chrome.runtime.lastError);
            sendResponse({
              success: false,
              message: chrome.runtime.lastError?.message || 'Download failed - no download ID returned',
            });
          }
        }
      );
    };
    reader.onerror = () => {
      console.error('[M3U8] FileReader error:', reader.error);
      sendResponse({
        success: false,
        message: 'Failed to read blob: ' + reader.error,
      });
    };
    reader.readAsDataURL(combinedBlob);
  } catch (error) {
    console.error('[M3U8] Error:', error);
    sendResponse({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Parse M3U8 playlist and extract segment URLs
 */
function parseM3U8Playlist(playlistText, baseUrl) {
  const segments = [];
  const lines = playlistText.split('\n');
  const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf('/'));
  const baseUrlObj = new URL(baseUrl);

  console.log('[M3U8] Parsing playlist, total lines:', lines.length);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    if (line.endsWith('.ts') || line.endsWith('.m4s') || line.endsWith('.vtt')) {
      try {
        const segmentUrl = line.startsWith('http')
          ? line
          : line.startsWith('/')
            ? baseUrlObj.origin + line
            : baseDir + '/' + line;
        segments.push(segmentUrl);
      } catch (error) {
        console.warn(`[M3U8] Failed to parse segment URL: ${line}`, error);
      }
    }
  }

  console.log('[M3U8] Parsed segments:', segments.length);
  return segments;
}

// Handle download request
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received message:', request.action);
  
  if (request.action === 'downloadFile') {
    const { url, filename, type } = request;
    console.log('[Background] Download request - URL:', url.substring(0, 50), 'Filename:', filename);

    // Check if M3U8 stream
    if (url.includes('.m3u8')) {
      console.log('[Background] Detected M3U8 stream, routing to M3U8 handler');
      handleM3U8Download(request, sendResponse);
      return true;
    }

    // Regular file download
    console.log('[Background] Regular file download');
    const sanitizedFilename = filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .substring(0, 200);

    const folder = type === 'image' ? 'Images' : type === 'video' ? 'Videos' : 'Downloads';
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
            message: 'Download started',
            downloadId: downloadId,
          });
        } else {
          sendResponse({
            success: false,
            message: chrome.runtime.lastError?.message || 'Download failed',
          });
        }
      }
    );

    return true;
  }

  if (request.action === 'downloadMultiple') {
    const { urls, filenames, type } = request;
    let completed = 0;
    const results = [];

    urls.forEach((url, index) => {
      const filename = filenames[index] || `media_${index}`;
      const folder = type === 'image' ? 'Images' : 'Videos';
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
  if (delta.state && delta.state.current === 'complete') {
    console.log('✅ Download completed:', delta.id);
  }
});

// Install event - setup default storage
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      downloadCount: 0,
      downloadHistory: [],
      settings: {
        autoDownload: false,
        openFolder: false,
        notifyComplete: true,
      },
    });
    console.log('✅ Media Downloader Pro installed!');
  }
});

console.log('✅ Background Service Worker Loaded');
