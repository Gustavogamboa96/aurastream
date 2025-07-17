

import './LibraryPage.css';

function LibraryPage() {
  // Placeholder data
  const albums = [
    { id: 1, title: 'Album One', artist: 'Artist A', cover: 'https://via.placeholder.com/150' },
    { id: 2, title: 'Album Two', artist: 'Artist B', cover: 'https://via.placeholder.com/150' },
    { id: 3, title: 'Album Three', artist: 'Artist C', cover: 'https://via.placeholder.com/150' },
    { id: 4, title: 'Album Four', artist: 'Artist D', cover: 'https://via.placeholder.com/150' },
  ];

  return (
    <div className="library-page">
      <h1>Library</h1>
      <div className="album-grid">
        {albums.map(album => (
          <div className="album-card" key={album.id}>
            <img src={album.cover} alt={album.title} className="album-cover" />
            <div className="album-title">{album.title}</div>
            <div className="album-artist">{album.artist}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LibraryPage;
