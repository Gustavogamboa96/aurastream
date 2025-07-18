import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useContext } from 'react';
import qs from 'qs';
import { AppContext, IAppContext } from '../store/AppContext';
import axios from 'axios';
import './AlbumPage.css';

function AlbumPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { playTrack, debridKey } = useContext(AppContext) as IAppContext;
  const [albumInfo, setAlbumInfo] = useState<any>(location.state?.torrent);
  const [files, setFiles] = useState<any[]>([]);
  const [torrentId, setTorrentId] = useState<string | null>(null);
  const [links, setLinks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

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
        console.log('magnet:', albumInfo.magnet);
        console.log('debrdidKey:', debridKey);
        setFiles(res.data.files);
        setTorrentId(res.data.torrentId);
        setLinks(res.data.links);
        setAlbumInfo((prev: any) => ({ ...prev, title: res.data.filename || prev.title }));
      } catch (error: any) {
        console.error('Failed to fetch album files', error);
        // Display the specific error from the backend
        const errorMessage = error.response?.data?.error || 'Could not load album details.';
        alert(`Error: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    fetchAlbumFiles();
  }, [albumInfo, navigate, debridKey]);

  const handleTrackClick = async (file: any) => {
    if (!torrentId || !debridKey) return;
    try {
      // Call backend to handle all Real-Debrid logic (select, poll, unrestrict)
      const streamRes = await axios.post(
        '/api/debrid/stream',
        {
          torrentId: torrentId,
          fileId: file.id,
        },
        {
          headers: {
            Authorization: `Bearer ${debridKey}`,
          },
        }
      );
      const streamUrl = streamRes.data.streamLink;
      if (!streamUrl) {
        alert('Could not get a direct stream link.');
        return;
      }

      // Play the track using the direct stream URL
      playTrack({
        title: albumInfo.title,
        selectedFile: file,
        torrentId: torrentId,
        streamUrl: streamUrl,
      });
    } catch (err: any) {
      console.error('Error streaming track:', err);
      alert('Error streaming track: ' + (err.response?.data?.error || err.message));
    }
  };

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
              <div className="track-item" key={file.id} onClick={() => handleTrackClick(file)}>
                <span className="track-number">{index + 1}</span>
                <span className="track-title">{file.path}</span>
              </div>
          ))
        )}
      </div>
    </div>
  );
}

export default AlbumPage;
