

import './LibraryPage.css';
import { useEffect, useState } from 'react';
import { openDB, IDBPDatabase } from 'idb';
import { useNavigate } from 'react-router-dom';

const DB_NAME = 'AuraStreamDB';
const DB_VERSION = 2;

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

async function getDB(): Promise<IDBPDatabase<AlbumDB>> {
  return openDB<AlbumDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('albums')) {
        db.createObjectStore('albums', { keyPath: 'id' });
      }
      const hasTracks = db.objectStoreNames.contains('tracks');
      if (hasTracks) {
        // Ensure index exists even if store pre-existed (best-effort check)
        try {
          db.transaction('tracks').store.index('by-album');
        } catch {
          // Cannot create index in upgrade if store already exists; ignore here.
        }
      } else {
        const trackStore = db.createObjectStore('tracks', { keyPath: 'id', autoIncrement: true });
        trackStore.createIndex('by-album', 'albumId');
      }
    }
  });
}

function LibraryPage() {
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<Array<{ id: string; title: string; coverUrl?: string; trackCount: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const db = await getDB();
      const albumCursor = await db.transaction('albums').store.getAll();
      const albumsOut: Array<{ id: string; title: string; coverUrl?: string; trackCount: number }> = [];

      for (const album of albumCursor) {
        // Find cover track if stored as special filename
        const tx = db.transaction('tracks');
        const index = tx.store.index('by-album');
        const allTracks = await index.getAll(album.id);
        const coverTrack = allTracks.find(t => t.filename === '__cover__');
        const audioTracks = allTracks.filter(t => t.filename !== '__cover__');
        const coverUrl = coverTrack ? URL.createObjectURL(coverTrack.blob) : undefined;

        albumsOut.push({ id: album.id, title: album.title, coverUrl, trackCount: audioTracks.length });
      }

      setAlbums(albumsOut);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="library-page">
      <h1>Library</h1>
      {loading ? (
        <p>Loading your albums…</p>
      ) : (
        <div className="album-grid">
          {albums.map(album => (
            <button
              className="album-card"
              key={album.id}
                onClick={() => navigate(`/album/${album.id}`)}
            >
              <img src={album.coverUrl || 'https://via.placeholder.com/300?text=No+Cover'} alt={album.title} className="album-cover" />
              <div className="album-title">{album.title}</div>
              <div className="album-artist">{album.trackCount} tracks</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default LibraryPage;
