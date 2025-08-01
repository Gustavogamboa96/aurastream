import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useContext } from 'react';
import qs from 'qs';
import { AppContext } from '../store/AppContext';
import axios from 'axios';
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
  const [links, setLinks] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const downloadFile = async (fileId: number) => {
    if (!torrentId || processing) return;
    
    setProcessing(true);
    try {
      const res = await axios.post('/api/debrid/stream', 
        { torrentId, fileId },
        { headers: { Authorization: `Bearer ${debridKey}` } }
      );
      
      setLinks(prev => ({ ...prev, [fileId]: res.data.streamUrl }));
    } catch (error: any) {
      console.error('Failed to process file', error);
      alert('Failed to process file for streaming');
    } finally {
      setProcessing(false);
    }
  };

  const handleTrackSelect = async (fileId: number) => {
    if (!links[fileId]) {
      await downloadFile(fileId);
    }
  };

  const handleTrackPlay = (file: any) => {
    if (!links[file.id]) {
      alert('Please wait for the track to be processed');
      return;
    }
    
    playTrack({
      title: file.path.split('/').pop() || 'Unknown Track',
      artist: albumInfo.title || 'Unknown Artist',
      album: albumInfo.title || 'Unknown Album',
      url: links[file.id]
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
        const res = await axios.post('/api/debrid/info', 
          { magnet: albumInfo.magnet || albumInfo.link },
          { headers: { Authorization: `Bearer ${debridKey}` } }
        );
        setFiles(res.data.files.sort((a: any, b: any) => a.path.localeCompare(b.path)));
        setTorrentId(res.data.torrentId);
        setAlbumInfo((prev: any) => ({ ...prev, title: res.data.filename || prev.title }));
      } catch (error: any) {
        console.error('Failed to fetch album files', error);
        const errorMessage = error.response?.data?.error || 'Could not load album details.';
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
          </div>
        </header>
      )}
      <div className="track-list">
        {loading ? (
          <p>Loading tracks...</p>
        ) : (
          files
            .filter(file => file.path.toLowerCase().endsWith('.flac') || file.path.toLowerCase().endsWith('.mp3'))
            .map((file, index) => (
              <button 
                className={`track-item ${links[file.id] ? 'ready' : ''}`}
                key={file.id}
                onClick={() => handleTrackPlay(file)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleTrackPlay(file);
                  }
                }}
                disabled={processing && !links[file.id]}
              >
                <span className="track-number">{index + 1}</span>
                <div className="track-info">
                  <span className="track-title">{file.path.split('/').pop()}</span>
                  {!links[file.id] && (
                    <button 
                      className="download-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTrackSelect(file.id);
                      }}
                      disabled={processing}
                    >
                      {processing ? 'Processing...' : 'Download'}
                    </button>
                  )}
                </div>
              </button>
          ))
        )}
      </div>
    </div>
  );
}

export default AlbumPage;
