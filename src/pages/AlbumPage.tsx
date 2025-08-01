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
  const rdService = useMemo(() => new RealDebridService(debridKey || ''), [debridKey]);

  const handleDownloadAll = async () => {
    if (!torrentId || !debridKey || downloading) return;
    
    setDownloading(true);
    setDownloadProgress(0);
    try {
      const streamUrls = await rdService.processDownload(
        { torrentId },
        (info: RealDebridInfo) => {
          setDownloadProgress(info.progress || 0);
        }
      );
      setLinks(streamUrls);
    } catch (error: any) {
      console.error('Failed to process files', error);
      alert('Failed to process files for streaming');
    } finally {
      setDownloading(false);
    }
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

    const fetchAlbumFiles = async () => {
      try {
        const id = await rdService.addMagnet(albumInfo.magnet || albumInfo.link);
        const info = await rdService.getTorrentInfo(id);
        
        setFiles(info.files.sort((a, b) => a.path.localeCompare(b.path)));
        setTorrentId(id);
        setAlbumInfo((prev: any) => ({ ...prev, title: info.filename || prev.title }));
      } catch (error: any) {
        console.error('Failed to fetch album files', error);
        const errorMessage = error.message || 'Could not load album details.';
        alert(`Error: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    fetchAlbumFiles();
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
            <button
              className="download-button"
              onClick={handleDownloadAll}
              disabled={downloading}
            >
              {downloading ? `Downloading... ${downloadProgress}%` : 'Download All Tracks'}
            </button>
          </div>
        </header>
      )}
      <div className="track-list">
        {loading ? (
          <p>Loading tracks...</p>
        ) : (
          files
            .filter(file => file.path.toLowerCase().endsWith('.flac') || file.path.toLowerCase().endsWith('.mp3'))
            .map((file, index) => {
              const fileName = file.path.split('/').pop();
              return (
                <button 
                  className={`track-item ${fileName && links[fileName] ? 'ready' : ''}`}
                  key={file.id}
                  onClick={() => handleTrackPlay(file)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleTrackPlay(file);
                    }
                  }}
                  disabled={downloading || !fileName || !links[fileName]}
                >
                  <span className="track-number">{index + 1}</span>
                  <div className="track-info">
                    <span className="track-title">{fileName}</span>
                  </div>
                </button>
              );
            })
        )}
      </div>
      {downloading && (
        <div className="progress-bar">
          <div 
            className="progress-bar-fill"
            style={{ width: `${downloadProgress}%` }}
          />
        </div>
      )}
      </div>
  )
}

export default AlbumPage;
