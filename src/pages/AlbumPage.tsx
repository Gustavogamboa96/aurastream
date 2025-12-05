import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useContext } from 'react';
import { AppContext } from '../store/AppContext';
import { createExtractorFromData } from 'node-unrar-js';
import { openDB, IDBPDatabase } from 'idb';
import './AlbumPage.css';

const WORKER_URL = (import.meta as any).env?.VITE_WORKER_URL || 'http://localhost:8787';
const DB_NAME = 'AuraStreamDB';
const DB_VERSION = 1;

interface AlbumDB {
  albums: {
    key: string;
    value: {
      id: string;
      title: string;
      magnet: string;
      addedAt: number;
    };
  };
  tracks: {
    key: number;
    value: {
      id?: number;
      albumId: string;
      filename: string;
      blob: Blob;
    };
    indexes: { 'by-album': string };
  };
}

interface ProcessedFile {
  filename: string;
  path: string;
  size: number;
  link: string;
  isAudio: boolean;
  isArchive: boolean;
}

interface AlbumTrack {
  filename: string;
  blob: Blob;
  url: string;
}

// Initialize IndexedDB
async function initDB(): Promise<IDBPDatabase<AlbumDB>> {
  return openDB<AlbumDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create albums store
      if (!db.objectStoreNames.contains('albums')) {
        db.createObjectStore('albums', { keyPath: 'id' });
      }
      
      // Create tracks store
      if (!db.objectStoreNames.contains('tracks')) {
        const trackStore = db.createObjectStore('tracks', { keyPath: 'id', autoIncrement: true });
        trackStore.createIndex('by-album', 'albumId');
      }
    },
  });
}

function AlbumPage() {
  const navigate = useNavigate();
  const { albumId: routeAlbumIdParam, id: routeIdParam } = useParams();
  const routeAlbumId = routeAlbumIdParam || routeIdParam;
  const { playTrack, debridKey } = useContext(AppContext);
  const [albumInfo, setAlbumInfo] = useState<any>(() => {
    try {
      const cached = globalThis.localStorage.getItem('lastAlbum');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [tracks, setTracks] = useState<AlbumTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | undefined>(undefined);

  const loadAlbumFromIDB = async (albumId: string) => {
    setLoading(true);
    const db = await initDB();
    const albumMeta = await db.get('albums', albumId);
    if (albumMeta && !albumInfo) {
      setAlbumInfo({ title: albumMeta.title, size: '', seeds: 0, magnet: albumMeta.magnet } as any);
      try { globalThis.localStorage.setItem('lastAlbum', JSON.stringify({ title: albumMeta.title, magnet: albumMeta.magnet })); } catch {}
    }
    const index = db.transaction('tracks').store.index('by-album');
    const storedTracks = await index.getAll(albumId);
    if (storedTracks && storedTracks.length > 0) {
      const audioTracks = storedTracks.filter(t => t.filename !== '__cover__');
      const coverTrack = storedTracks.find(t => t.filename === '__cover__');
      const playable = audioTracks.map(t => ({ filename: t.filename, blob: t.blob, url: URL.createObjectURL(t.blob) }));
      setTracks(playable);
      if (coverTrack) setCoverUrl(URL.createObjectURL(coverTrack.blob));
    }
    setLoading(false);
  };

  const hydrateFromLocal = () => {
    if (!albumInfo) {
      try {
        const cached = globalThis.localStorage.getItem('lastAlbum');
        if (cached) setAlbumInfo(JSON.parse(cached));
      } catch {}
    }
  };

  const handleProcessAlbum = async () => {
    if (!albumInfo?.magnet || processing) return;

    if (!debridKey) {
      alert('Please set your Real-Debrid API key in Settings.');
      return;
    }

    setProcessing(true);
    setDownloadProgress(0);
    try {
      // Magnet is already available from search results
      const magnet = albumInfo.magnet;
      
      if (!magnet) {
        throw new Error('Magnet link not available');
      }

      setCurrentFile('Processing with Real-Debrid...');
      
      // Process magnet through worker
      const response = await fetch(`${WORKER_URL}/magnet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${debridKey}`,
        },
        body: JSON.stringify({ magnet })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process magnet');
      }

      const data = await response.json();
      console.log('Received files from worker:', data);
      
      const processedFiles: ProcessedFile[] = data.files;
      
      if (!processedFiles || processedFiles.length === 0) {
        throw new Error('No files received from Real-Debrid');
      }
      
      // Use the first file - it's typically the one with the valid download link
      const firstFile = processedFiles[0];
      
      console.log('Using first file:', firstFile);
      
      // Download RAR with streaming
      setCurrentFile(`Downloading ${firstFile.filename}...`);
      setDownloadProgress(0);
      
      const proxyUrl = `${WORKER_URL}/download?url=${encodeURIComponent(firstFile.link)}`;
      const rarBlob = await downloadFileWithProgress(proxyUrl, (progress) => {
        setDownloadProgress(progress);
      });
      
      // Extract RAR
      setExtracting(true);
      setCurrentFile('Extracting audio files...');
      console.log('Extracting RAR...');
      
      const { tracks: extractedTracks, cover } = await extractRarFile(rarBlob);
      console.log(`Extracted ${extractedTracks.length} tracks`);
      
      // Save to IndexedDB
      setCurrentFile('Saving to library...');
      const albumId = data.torrentInfo.hash;
      await saveAlbumToIndexedDB(albumId, albumInfo.title, magnet, extractedTracks, cover || undefined);
      
      console.log('Saved to IndexedDB');
      setTracks(extractedTracks);
      
    } catch (error: any) {
      console.error('Failed to process album:', error);
      alert(error.message || 'Failed to process album');
    } finally {
      setProcessing(false);
      setExtracting(false);
      setCurrentFile('');
      setDownloadProgress(0);
    }
  };

  const downloadFileWithProgress = async (
    url: string,
    onProgress: (progress: number) => void
  ): Promise<Blob> => {
    const response = await fetch(url);
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? Number.parseInt(contentLength, 10) : 0;
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Failed to get reader');
    
    const chunks: BlobPart[] = [];
    let receivedLength = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value as BlobPart);
      receivedLength += value.length;
      
      if (total > 0) {
        onProgress(Math.round((receivedLength / total) * 100));
      }
    }
    
    return new Blob(chunks);
  };

  const extractRarFile = async (rarBlob: Blob): Promise<{ tracks: AlbumTrack[]; cover: Blob | null; }> => {
    const arrayBuffer = await rarBlob.arrayBuffer();
    // Load the WASM binary from same-origin to avoid bundling issues
    const wasmResp = await fetch('/unrar.wasm');
    if (!wasmResp.ok) throw new Error('Failed to load unrar.wasm');
    const wasmBinary = await wasmResp.arrayBuffer();
    const extractor = await createExtractorFromData({ data: arrayBuffer, wasmBinary });
    const extracted = extractor.extract();
    
    const audioExtensions = ['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg'];
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const extractedTracks: AlbumTrack[] = [];
    let coverBlob: Blob | null = null;
    
    for (const file of extracted.files) {
      const filename = file.fileHeader.name;
      const lower = filename.toLowerCase();
      const isAudio = audioExtensions.some(ext => lower.endsWith(ext));
      const isImage = imageExtensions.some(ext => lower.endsWith(ext));
      
      if (isAudio && file.extraction) {
        const blob = new Blob([file.extraction as BlobPart]);
        extractedTracks.push({
          filename,
          blob,
          url: URL.createObjectURL(blob)
        });
      }
      // Try to capture a cover image (prefer common names)
      if (isImage && file.extraction) {
        const blob = new Blob([file.extraction as BlobPart]);
        const preferred = /(^|\/)cover\.|(^|\/)folder\.|(^|\/)front\./.test(lower);
        if (!coverBlob || preferred) coverBlob = blob;
      }
    }
    
    extractedTracks.sort((a, b) => a.filename.localeCompare(b.filename));
    return { tracks: extractedTracks, cover: coverBlob };
  };

  const saveAlbumToIndexedDB = async (
    albumId: string,
    title: string,
    magnet: string,
    tracks: AlbumTrack[],
    cover?: Blob
  ) => {
    const db = await initDB();
    
    // Save album info
    await db.put('albums', {
      id: albumId,
      title,
      magnet,
      addedAt: Date.now()
    });
    
    // Save tracks
    for (const track of tracks) {
      await db.add('tracks', {
        albumId,
        filename: track.filename,
        blob: track.blob
      });
    }
    // Save cover if available
    if (cover) {
      await db.put('albums', {
        id: albumId,
        title,
        magnet,
        addedAt: Date.now(),
        // store cover in a separate tracks entry to keep schema simple
      } as any);
      await db.add('tracks', {
        albumId,
        filename: '__cover__',
        blob: cover
      });
    }
  };

  const handleTrackPlay = (track: AlbumTrack) => {
    console.log('Playing track:', track);
    playTrack({
      title: track.filename.replace(/\\.(mp3|flac|wav|m4a|aac|ogg)$/i, ''),
      artist: albumInfo.title || 'Unknown Artist',
      album: albumInfo.title || 'Unknown Album',
      url: track.url
    });
  };

  useEffect(() => {
    const run = async () => {
      if (routeAlbumId) {
        await loadAlbumFromIDB(routeAlbumId);
        return;
      }
      hydrateFromLocal();
      if (!albumInfo) {
        navigate('/search');
        return;
      }
      setLoading(false);
    };
    run();
  }, [albumInfo, navigate, routeAlbumId]);


  return (
    <div className="album-page">
      <button onClick={() => navigate(-1)} className="back-button">← Back to Search</button>
      {albumInfo && (
        <header className="album-header">
          <img src={coverUrl || 'https://via.placeholder.com/300'} alt="Album Cover" className="album-cover-art" />
          <div className="album-meta">
            <h1>{albumInfo.title}</h1>
            <p>{albumInfo.size} | Seeders: {albumInfo.seeds}</p>
            {tracks.length === 0 && !processing && (
              <button
                className="download-button"
                onClick={handleProcessAlbum}
                disabled={processing || loading}
              >
                {processing ? 'Processing Album...' : 'Process Album'}
              </button>
            )}
          </div>
        </header>
      )}
      {(processing || extracting) && (
        <div className="download-progress">
          <div className="progress-info">
            <span className="progress-file">{currentFile}</span>
            {!extracting && <span className="progress-percentage">{downloadProgress}%</span>}
          </div>
          <div className="progress-bar">
            <div 
              className="progress-bar-fill" 
              style={{ width: extracting ? '100%' : `${downloadProgress}%` }} 
            />
          </div>
          {extracting && <p className="extracting-text">This may take a moment...</p>}
        </div>
      )}
      <div className="track-list">
        {(() => {
          if (loading) return <p>Loading...</p>;
          if (tracks.length === 0 && !processing) return <p>Click "Process Album" to load tracks</p>;
          return tracks.map((track, index) => {
            const fmt = /\.(mp3|flac|wav|m4a|aac|ogg)$/i.exec(track.filename)?.[1]?.toUpperCase();
            return (
              <button
                className="track-item ready"
                key={track.url}
                onClick={() => handleTrackPlay(track)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleTrackPlay(track);
                  }
                }}
              >
                <span className="track-number">{String(index + 1).padStart(2, '0')}</span>
                <div className="track-info">
                  <span className="track-title">{track.filename.replace(/\.(mp3|flac|wav|m4a|aac|ogg)$/i, '')}</span>
                  <span className="track-format">{fmt}</span>
                </div>
              </button>
            );
          });
        })()}
      </div>
    </div>
  )
}

export default AlbumPage;
