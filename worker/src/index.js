const REAL_DEBRID_BASE = 'https://api.real-debrid.com/rest/1.0';
const POLL_INTERVAL = 2000;
const MAX_POLL_ATTEMPTS = 30;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-RD-Key',
};

// Helper to create JSON responses with CORS
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// Helper to extract magnet hash for logging
function extractMagnetHash(magnet) {
  const match = magnet.match(/xt=urn:btih:([A-Fa-f0-9]+)/);
  return match ? match[1] : 'unknown';
}

// Helper to get filename from path
function getFilename(path) {
  return path.split('/').pop() || path;
}

// Helper to check if a file is an audio file
function isAudioFile(filename) {
  const audioExtensions = ['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.wma', '.alac'];
  const lowerFilename = filename.toLowerCase();
  return audioExtensions.some(ext => lowerFilename.endsWith(ext));
}

// Helper to wait
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Real-Debrid API functions
async function rdAddMagnet(magnet, apiKey) {
  const formData = new URLSearchParams();
  formData.append('magnet', magnet);

  const response = await fetch(`${REAL_DEBRID_BASE}/torrents/addMagnet`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`RD addMagnet failed: ${error}`);
  }

  return response.json();
}

async function rdSelectFiles(torrentId, apiKey) {
  const formData = new URLSearchParams();
  formData.append('files', 'all');

  const response = await fetch(`${REAL_DEBRID_BASE}/torrents/selectFiles/${torrentId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`RD selectFiles failed: ${error}`);
  }

  return response.status;
}

async function rdGetTorrentInfo(torrentId, apiKey) {
  const response = await fetch(`${REAL_DEBRID_BASE}/torrents/info/${torrentId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`RD getTorrentInfo failed: ${error}`);
  }

  return response.json();
}

async function rdUnrestrictLink(link, apiKey) {
  const formData = new URLSearchParams();
  formData.append('link', link);

  const response = await fetch(`${REAL_DEBRID_BASE}/unrestrict/link`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`RD unrestrict failed: ${error}`);
  }

  return response.json();
}

// Main handler for /magnet endpoint
function getRdApiKeyFromRequest(request) {
  const auth = request.headers.get('authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  const headerKey = request.headers.get('x-rd-key');
  if (headerKey && headerKey.trim()) return headerKey.trim();
  return '';
}

async function handleMagnet(request, env) {
  const apiKey = getRdApiKeyFromRequest(request);
  if (!apiKey) {
    return jsonResponse({ error: 'Missing Real-Debrid API key. Provide Authorization: Bearer <token> or X-RD-Key header.' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    console.warn('Invalid JSON body', e && e.message ? e.message : e);
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { magnet } = body;

  if (!magnet) {
    return jsonResponse({ error: 'Missing magnet link in request body' }, 400);
  }

  if (typeof magnet !== 'string' || !magnet.startsWith('magnet:?')) {
    return jsonResponse({ error: 'Invalid magnet link format' }, 400);
  }

  const magnetHash = extractMagnetHash(magnet);
  console.log(`[${new Date().toISOString()}] Processing magnet hash: ${magnetHash}`);

  try {
    // Step 1: Add magnet
    console.log(`[${new Date().toISOString()}] [1/4] Adding magnet to Real-Debrid...`);
    const addResult = await rdAddMagnet(magnet, apiKey);
    const torrentId = addResult.id;

    if (!torrentId) {
      throw new Error('No torrent ID returned from Real-Debrid');
    }

    console.log(`[${new Date().toISOString()}] [2/4] Torrent added with ID: ${torrentId}`);

    // Step 2: Select all files
    console.log(`[${new Date().toISOString()}] [2/4] Selecting all files...`);
    await rdSelectFiles(torrentId, apiKey);

    console.log(`[${new Date().toISOString()}] [3/4] Polling for download links...`);

    // Step 3: Poll for completion
    let torrentInfo;
    let attempts = 0;

    while (attempts < MAX_POLL_ATTEMPTS) {
      torrentInfo = await rdGetTorrentInfo(torrentId, apiKey);

      console.log(
        `[${new Date().toISOString()}] Attempt ${attempts + 1}/${MAX_POLL_ATTEMPTS} - ` +
        `Status: ${torrentInfo.status}, Progress: ${torrentInfo.progress}%, ` +
        `Links: ${torrentInfo.links?.length || 0}`
      );

      // Check if download is complete (status is 'downloaded' and progress is 100%)
      if (torrentInfo.status === 'downloaded' && torrentInfo.progress === 100) {
        console.log(`[${new Date().toISOString()}] [4/4] Download complete! Building response...`);
        break;
      }

      // Check for error status
      if (torrentInfo.status === 'error') {
        throw new Error('Real-Debrid reported an error processing the torrent');
      }

      // For cached torrents that are already available
      if (torrentInfo.links && torrentInfo.links.length > 0 && torrentInfo.status === 'downloaded') {
        console.log(`[${new Date().toISOString()}] [4/4] Cached torrent - links available immediately!`);
        break;
      }

      attempts++;
      if (attempts < MAX_POLL_ATTEMPTS) {
        await wait(POLL_INTERVAL);
      }
    }

    // Check if we timed out or have no links
    if (!torrentInfo?.links || torrentInfo.links.length === 0) {
      return jsonResponse(
        { error: 'Timeout waiting for Real-Debrid to process the magnet. Please try again.' },
        408
      );
    }

    // Verify download is complete before unrestricting
    if (torrentInfo.status !== 'downloaded') {
      return jsonResponse(
        { error: `Torrent not fully downloaded. Status: ${torrentInfo.status}, Progress: ${torrentInfo.progress}%` },
        408
      );
    }

    // Step 4: Unrestrict all links to get direct download URLs
    console.log(`[${new Date().toISOString()}] [4/4] Unrestricting ${torrentInfo.links.length} links...`);
    
    const files = [];

    for (let i = 0; i < torrentInfo.links.length; i++) {
      const file = torrentInfo.files[i];
      const restrictedLink = torrentInfo.links[i];

      if (file && restrictedLink) {
        const filename = getFilename(file.path);
        
        try {
          // Unrestrict the link to get the actual download URL
          const unrestrictedData = await rdUnrestrictLink(restrictedLink, apiKey);
          
          console.log(`[${new Date().toISOString()}]   Restricted: ${restrictedLink}`);
          console.log(`[${new Date().toISOString()}]   Unrestricted: ${unrestrictedData.download}`);
          
          files.push({
            filename: filename,
            path: file.path,
            size: file.bytes,
            link: unrestrictedData.download, // Direct download link
            isAudio: isAudioFile(filename),
            isArchive: filename.toLowerCase().endsWith('.rar') || filename.toLowerCase().endsWith('.zip'),
          });
          
          console.log(`[${new Date().toISOString()}]   Added: ${filename} (${formatBytes(file.bytes)}) - Audio: ${isAudioFile(filename)}, Archive: ${filename.toLowerCase().endsWith('.rar') || filename.toLowerCase().endsWith('.zip')}`);
        } catch (error) {
          console.error(`[${new Date().toISOString()}]   Failed to unrestrict ${filename}:`, error.message);
          // Continue with other files even if one fails
        }
      }
    }

    console.log(`[${new Date().toISOString()}] [DONE] Returning ${files.length} files`);

    return jsonResponse({ 
      files,
      torrentInfo: {
        name: torrentInfo.filename,
        hash: magnetHash,
        status: torrentInfo.status,
        progress: torrentInfo.progress
      }
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error:`, error.message);

    if (error.message.includes('quota')) {
      return jsonResponse({ error: 'Real-Debrid quota exceeded' }, 429);
    }

    if (error.message.includes('401') || error.message.includes('unauthorized')) {
      return jsonResponse({ error: 'Invalid Real-Debrid API key' }, 401);
    }

    if (error.message.includes('403') || error.message.includes('forbidden')) {
      return jsonResponse({ error: 'Real-Debrid access forbidden' }, 403);
    }

    return jsonResponse(
      { error: error.message || 'Failed to process magnet link' },
      500
    );
  }
}

// Get magnet link from 1337x torrent page
async function handleGetMagnet(request) {
  const url = new URL(request.url);
  const torrentPath = url.pathname.replace('/magnet/', '');
  
  if (!torrentPath) {
    return jsonResponse({ error: 'Missing torrent path' }, 400);
  }

  console.log(`[${new Date().toISOString()}] Fetching magnet for: ${torrentPath}`);

  try {
    const torrentUrl = `https://1337x.to${torrentPath}`;
    
    const response = await fetch(torrentUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch torrent page');
    }

    const html = await response.text();
    
    // Extract magnet link
    const magnetMatch = html.match(/href="(magnet:\?xt=urn:btih:[^"]+)"/);
    
    if (!magnetMatch) {
      throw new Error('Magnet link not found on page');
    }

    const magnet = magnetMatch[1];

    return jsonResponse({ magnet });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Magnet fetch error:`, error.message);
    return jsonResponse({ error: 'Failed to get magnet link' }, 500);
  }
}

// Proxy download endpoint to bypass CORS
async function handleDownload(request) {
  const url = new URL(request.url);
  const downloadUrl = url.searchParams.get('url');

  if (!downloadUrl) {
    return jsonResponse({ error: 'Missing url parameter' }, 400);
  }

  console.log(`[${new Date().toISOString()}] Proxying download: ${downloadUrl.substring(0, 50)}...`);

  try {
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    // Return the file with CORS headers
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
        'Content-Length': response.headers.get('Content-Length') || '0',
        'Content-Disposition': response.headers.get('Content-Disposition') || 'attachment',
      },
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Download error:`, error.message);
    return jsonResponse({ error: 'Failed to download file' }, 500);
  }
}

// Search torrents endpoint using public API
async function handleSearch(request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  if (!query) {
    return jsonResponse({ error: 'Missing query parameter: q' }, 400);
  }

  console.log(`[${new Date().toISOString()}] Searching for: ${query}`);

  try {
    // Use The Pirate Bay API proxy (more reliable)
    const searchUrl = `https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=100`; // cat=100 for audio
    
    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch from torrent API');
    }

    const data = await response.json();
    
    // Parse and format results
    const results = parsePirateBayResults(data, query);

    console.log(`[${new Date().toISOString()}] Found ${results.length} results`);

    return jsonResponse({ results });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Search error:`, error.message);
    return jsonResponse({ error: 'Failed to search torrents' }, 500);
  }
}

// Parser for PirateBay API results
function parsePirateBayResults(data, query) {
  const results = [];
  
  // Filter out the "No results" response
  if (!data || !Array.isArray(data) || data.length === 0) {
    return results;
  }

  for (const item of data) {
    // Skip if it's the "no results" indicator
    if (item.id === '0' || item.name === 'No results returned') {
      continue;
    }

    const title = item.name || 'Unknown';
    const seeds = Number.parseInt(item.seeders) || 0;
    const leeches = Number.parseInt(item.leechers) || 0;
    
    // Convert size from bytes to human-readable format
    const sizeBytes = Number.parseInt(item.size) || 0;
    const size = formatBytes(sizeBytes);
    
    // Build magnet link
    const infoHash = item.info_hash;
    const magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(title)}`;
    
    if (title && infoHash && seeds > 0) {
      results.push({
        title,
        seeds,
        leeches,
        size,
        torrentPath: null, // Not needed since we have magnet directly
        magnet, // Return magnet directly
      });
    }
  }
  
  // Sort by seeds (highest first) and limit to 20 results
  return results
    .sort((a, b) => b.seeds - a.seeds)
    .slice(0, 20);
}

// Helper to format bytes to human-readable size
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Main Worker export
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    // Route: POST /magnet
    if (url.pathname === '/magnet' && request.method === 'POST') {
      return handleMagnet(request, env);
    }

    // Route: GET /search
    if (url.pathname === '/search' && request.method === 'GET') {
      return handleSearch(request);
    }

    // Route: GET /download - Proxy download to bypass CORS
    if (url.pathname === '/download' && request.method === 'GET') {
      return handleDownload(request);
    }

    // Route: GET /magnet/:torrentPath - Get magnet link from torrent page
    if (url.pathname.startsWith('/magnet/') && request.method === 'GET') {
      return handleGetMagnet(request);
    }

    // 404 for unknown routes
    return jsonResponse({ error: 'Not found' }, 404);
  },
};
