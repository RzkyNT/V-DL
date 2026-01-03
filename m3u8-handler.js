/**
 * M3U8 Handler Module for Chrome Extension
 * Handles M3U8 streaming file downloads
 * Works in background service worker context
 */

/**
 * Download M3U8 file by fetching segments
 * @param {string} m3u8Url - URL of the M3U8 playlist
 * @param {string} outputPath - Output file path (for reference)
 * @param {function} onProgress - Callback for progress updates
 * @returns {Promise<Blob>}
 */
async function downloadM3U8(m3u8Url, outputPath, onProgress = null) {
  try {
    // Fetch M3U8 playlist
    const playlistResponse = await fetch(m3u8Url);
    if (!playlistResponse.ok) {
      throw new Error(`Failed to fetch M3U8: ${playlistResponse.statusText}`);
    }

    const playlistText = await playlistResponse.text();
    const segments = parseM3U8Playlist(playlistText, m3u8Url);

    if (segments.length === 0) {
      throw new Error('No video segments found in M3U8 playlist');
    }

    // Download all segments
    const videoBlobs = [];
    let completedSegments = 0;

    for (const segmentUrl of segments) {
      try {
        const segmentResponse = await fetch(segmentUrl);
        if (segmentResponse.ok) {
          const blob = await segmentResponse.blob();
          videoBlobs.push(blob);
          completedSegments++;

          // Report progress
          if (onProgress) {
            const percentage = Math.round((completedSegments / segments.length) * 100);
            onProgress({
              downloaded: completedSegments,
              total: segments.length,
              percentage: percentage,
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to download segment: ${segmentUrl}`, error);
        // Continue with next segment
      }
    }

    if (videoBlobs.length === 0) {
      throw new Error('Failed to download any video segments');
    }

    // Combine all segments into single blob
    const combinedBlob = new Blob(videoBlobs, { type: 'video/mp2t' });

    return {
      success: true,
      message: 'M3U8 download completed',
      blob: combinedBlob,
      filename: generateFilename(outputPath),
      totalSegments: segments.length,
      downloadedSegments: completedSegments,
    };
  } catch (error) {
    return {
      success: false,
      message: 'M3U8 download failed',
      error: error.message,
    };
  }
}

/**
 * Parse M3U8 playlist and extract segment URLs
 * @param {string} playlistText - M3U8 playlist content
 * @param {string} baseUrl - Base URL for resolving relative paths
 * @returns {string[]} Array of segment URLs
 */
function parseM3U8Playlist(playlistText, baseUrl) {
  const segments = [];
  const lines = playlistText.split('\n');
  const baseUrlObj = new URL(baseUrl);
  const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf('/'));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip comments and empty lines
    if (!line || line.startsWith('#')) {
      continue;
    }

    // Check if line is a segment URL
    if (line.endsWith('.ts') || line.endsWith('.m4s') || line.endsWith('.vtt')) {
      try {
        // Handle absolute and relative URLs
        const segmentUrl = line.startsWith('http')
          ? line
          : line.startsWith('/')
            ? baseUrlObj.origin + line
            : baseDir + '/' + line;

        segments.push(segmentUrl);
      } catch (error) {
        console.warn(`Failed to parse segment URL: ${line}`, error);
      }
    }
  }

  return segments;
}

/**
 * Validate M3U8 URL
 * @param {string} url - URL to validate
 * @returns {boolean}
 */
function isValidM3U8Url(url) {
  try {
    new URL(url);
    return url.includes('.m3u8') || url.includes('m3u8');
  } catch {
    return false;
  }
}

/**
 * Get filename from M3U8 URL or output path
 * @param {string} url - M3U8 URL or output path
 * @returns {string}
 */
function getM3U8Filename(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || 'stream';

    // Ensure .ts extension
    if (!filename.includes('.')) {
      return `${filename}_${Date.now()}.ts`;
    }

    const name = filename.replace(/\.[^.]*$/, '');
    return `${name}.ts`;
  } catch {
    // If not a URL, treat as filename
    const name = url.replace(/\.[^.]*$/, '');
    return `${name}.ts`;
  }
}

/**
 * Generate safe filename from output path
 * @param {string} outputPath - Output path
 * @returns {string}
 */
function generateFilename(outputPath) {
  if (!outputPath) {
    return `stream_${Date.now()}.ts`;
  }

  // Extract filename from path
  const parts = outputPath.split(/[\\/]/);
  const filename = parts[parts.length - 1];

  // Ensure proper extension
  if (!filename.includes('.')) {
    return `${filename}.ts`;
  }

  return filename.replace(/\.[^.]*$/, '.ts');
}

/**
 * Module exports for use in background.js
 */
if (typeof window === 'undefined' && typeof module !== 'undefined') {
  // Node.js environment (for testing)
  module.exports = {
    downloadM3U8,
    parseM3U8Playlist,
    isValidM3U8Url,
    getM3U8Filename,
    generateFilename,
  };
}
