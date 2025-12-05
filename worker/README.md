# Real-Debrid Magnet Worker

Production-grade Cloudflare Worker that processes torrent magnet links through Real-Debrid and returns direct download links.

## What It Does

- **POST /magnet** - Converts magnet links to Real-Debrid direct links
- **GET /search** - Search for music album torrents (placeholder endpoint)

## Features

✅ Full Real-Debrid integration  
✅ Automatic file selection  
✅ Polling with timeout (60 seconds)  
✅ CORS enabled  
✅ Structured logging  
✅ Clean error handling  

## Deployment

### 1. Install Dependencies

```bash
cd worker
npm install
```

### 2. Configure Real-Debrid API Key

```bash
wrangler secret put REAL_DEBRID_API_KEY
# Enter your Real-Debrid API key when prompted
```

### 3. Deploy

```bash
npm run deploy
```

Your worker will be deployed to: `https://realdebrid-magnet-worker.<your-subdomain>.workers.dev`

## Local Development

```bash
# Start local dev server
npm run dev

# Test locally
curl -X POST http://localhost:8787/magnet \
  -H "Content-Type: application/json" \
  -d '{"magnet":"magnet:?xt=urn:btih:..."}'
```

## API Usage

### POST /magnet

Convert a magnet link to Real-Debrid direct links.

**Request:**
```json
POST /magnet
Content-Type: application/json

{
  "magnet": "magnet:?xt=urn:btih:..."
}
```

**Response:**
```json
{
  "album": [
    {
      "filename": "01. Track Name.flac",
      "link": "https://real-debrid.com/d/..."
    },
    {
      "filename": "02. Another Track.flac",
      "link": "https://real-debrid.com/d/..."
    }
  ]
}
```

**Error Response:**
```json
{
  "error": "Error message"
}
```

### GET /search

Search for torrents (placeholder - integrate your preferred torrent search).

**Request:**
```
GET /search?q=coldplay+parachutes
```

**Response:**
```json
{
  "results": [
    {
      "title": "Coldplay - Parachutes (2000)",
      "magnet": "magnet:?xt=urn:btih:...",
      "seeds": 100,
      "size": "500 MB"
    }
  ]
}
```

## Real-Debrid Flow

1. **Add Magnet** - `POST /torrents/addMagnet`
2. **Select Files** - `POST /torrents/selectFiles/{id}` with `files=all`
3. **Poll Status** - `GET /torrents/info/{id}` every 2 seconds (max 60s)
4. **Return Links** - Map files to direct download URLs

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Invalid request (missing/invalid magnet) |
| 401 | Invalid Real-Debrid API key |
| 403 | Real-Debrid access forbidden |
| 408 | Timeout (Real-Debrid took too long) |
| 429 | Real-Debrid quota exceeded |
| 500 | Server error |

## Example Usage

### JavaScript/Fetch

```javascript
const response = await fetch('https://your-worker.workers.dev/magnet', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    magnet: 'magnet:?xt=urn:btih:...'
  })
});

const { album } = await response.json();
// album = [{ filename, link }, ...]
```

### cURL

```bash
curl -X POST https://your-worker.workers.dev/magnet \
  -H "Content-Type: application/json" \
  -d '{
    "magnet": "magnet:?xt=urn:btih:D5F3B918C0A1FA44B87F54E99F1D7C1FC7210AFB"
  }'
```

## Logs

The worker logs detailed progress:

```
[2025-12-04T...] Processing magnet hash: D5F3B918C0A1FA44B87F54E99F1D7C1FC7210AFB
[2025-12-04T...] [1/4] Adding magnet to Real-Debrid...
[2025-12-04T...] [2/4] Torrent added with ID: ABC123
[2025-12-04T...] [2/4] Selecting all files...
[2025-12-04T...] [3/4] Polling for download links...
[2025-12-04T...] Attempt 1/30 - Status: downloading, Progress: 50%, Links: 0
[2025-12-04T...] [4/4] Links available! Building response...
[2025-12-04T...] [DONE] Returning 10 files
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REAL_DEBRID_API_KEY` | Yes | Your Real-Debrid API key (set via `wrangler secret put`) |

## Scaling Considerations

For future enhancements:

- **KV Storage** - Cache magnet → links mapping to reduce RD API calls
- **Queues** - Offload long-running magnet processing
- **Durable Objects** - Track processing state for large torrents

## Integration with Frontend

Update your frontend to use this worker:

```javascript
// SearchPage.tsx - search torrents
const results = await fetch('https://your-worker.workers.dev/search?q=' + query);

// AlbumPage.tsx - process magnet
const response = await fetch('https://your-worker.workers.dev/magnet', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ magnet: albumInfo.magnet })
});

const { album } = await response.json();
// album = [{ filename, link }, ...]
```

## License

MIT
