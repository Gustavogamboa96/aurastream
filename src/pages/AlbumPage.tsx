import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useContext, useMemo } from 'react';
import { AppContext } from '../store/AppContext';
import { RealDebridService } from '../services/realDebridService';
import { RealDebridInfo } from '../types/realdebrid';
import './AlbumPage.css';

interface TrackFile {
  id: number;
  path: string;
  bytes: number;
  selected: number;
}

function AlbumPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { playTrack, debridKey } = useContext(AppContext);
  const [albumInfo, setAlbumInfo] = useState(location.state?.torrent);
  const [files, setFiles] = useState<TrackFile[]>([]);
  const [torrentId, setTorrentId] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const pollTorrentStatus = async (id: string) => {
    const response = await fetch(`/api/debrid/info?id=${id}`, {
      headers: {
        'Authorization': `Bearer ${debridKey}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to get torrent status');
    }
    
    return response.json();
  };

  const handleDownloadAll = async () => {
    if (!albumInfo?.magnet || !debridKey || downloading) return;

    setDownloading(true);
    setDownloadProgress(0);
    
    let statusCheckInterval: NodeJS.Timeout;

    try {
      // 1. Add magnet and start processing
      const response = await fetch('/api/debrid/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${debridKey}`
        },
        body: JSON.stringify({ magnet: albumInfo.magnet })
      });

      if (!response.ok) {
        throw new Error('Failed to add magnet');
      }

      const initialInfo = await response.json();
      setTorrentId(initialInfo.torrentId);
      setFiles(initialInfo.files.sort((a, b) => a.path.localeCompare(b.path)));

      // 2. Start polling for status
      statusCheckInterval = setInterval(async () => {
        try {
          const status = await pollTorrentStatus(initialInfo.torrentId);
          setDownloadProgress(status.progress || 0);

          // When download is complete and we have links
          if (status.status === 'downloaded' && status.links?.length > 0) {
            clearInterval(statusCheckInterval);
            
            // 3. Unrestrict all links at once
            const unrestrict = await fetch('/api/debrid/unrestrict', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${debridKey}`
              },
              body: JSON.stringify({
                links: status.links,
                files: status.files
              })
            });

            if (unrestrict.ok) {
              const { streamUrls } = await unrestrict.json();
              setLinks(streamUrls);
            } else {
              throw new Error('Failed to get streaming URLs');
            }
            
            setDownloading(false);
          }
        } catch (error) {
          console.error('Failed to check status:', error);
        }
      }, 2000);

      // Clean up after 5 minutes to prevent infinite polling
      setTimeout(() => {
        clearInterval(statusCheckInterval);
        if (downloading) {
          setDownloading(false);
          alert('Process timed out. Please try again.');
        }
      }, 300000);

    } catch (error: any) {
      console.error('Failed to process files:', error);
      alert('Failed to process files for streaming');
      setDownloading(false);
    }

    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
    };
  };

  const handleTrackPlay = (file: TrackFile) => {
    const fileName = file.path.split('/').pop();
    if (!fileName || !links[fileName]) {
      alert('Please wait for all tracks to be processed');
      return;
    }

    playTrack({
      title: fileName,
      artist: albumInfo.title || 'Unknown Artist',
      album: albumInfo.title || 'Unknown Album',
      url: links[fileName]
    });
  };

  useEffect(() => {
    if (!albumInfo) {
      navigate('/search');
      return;
    }
    if (!debridKey) {
      alert('Please set your Real-Debrid API key in Settings.');
      navigate('/settings');
      return;
    }
    setLoading(false);
  }, [albumInfo, navigate, debridKey]);

  return (
    <div className="album-page">
      <button onClick={() => navigate(-1)} className="back-button">← Back to Search</button>
      {albumInfo && (
        <header className="album-header">
          <img src="https://via.placeholder.com/300" alt="Album Cover" className="album-cover-art" />
          <div className="album-meta">
            <h1>{albumInfo.title}</h1>
            <p>{albumInfo.size} | Seeders: {albumInfo.seeds}</p>
            {Object.keys(links).length === 0 && (
              <button
                className="download-button"
                onClick={handleDownloadAll}
                disabled={downloading || loading}
              >
                {downloading ? 'Processing...' : 'Process Album'}
              </button>
            )}
          </div>
        </header>
      )}
      {downloading && (
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{ width: `${downloadProgress}%` }}
          />
          <div className="progress-text">{downloadProgress}%</div>
        </div>
      )}
      <div className="track-list">
        {loading ? (
          <p>Loading tracks...</p>
        ) : (
          files
            .filter(file => file.path.toLowerCase().endsWith('.flac') || file.path.toLowerCase().endsWith('.mp3'))
            .map((file, index) => {
              const fileName = file.path.split('/').pop();
              const isReady = fileName && links[fileName];
              return (
                <button
                  className={`track-item ${isReady ? 'ready' : ''}`}
                  key={file.id}
                  onClick={() => handleTrackPlay(file)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleTrackPlay(file);
                    }
                  }}
                  disabled={!isReady}
                >
                  <span className="track-number">{index + 1}</span>
                  <div className="track-info">
                    <span className="track-title">{fileName}</span>
                    {!isReady && downloading && <span className="status">Processing...</span>}
                    {!isReady && !downloading && <span className="status">Click "Process Album" to enable</span>}
                  </div>
                </button>
              );
            })
        )}
      </div>
    </div>
  )
}

export default AlbumPage;
