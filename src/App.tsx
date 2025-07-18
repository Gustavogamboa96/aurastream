
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import SearchPage from './pages/SearchPage';
import LibraryPage from './pages/LibraryPage';
import SettingsPage from './pages/SettingsPage';
import AlbumPage from './pages/AlbumPage'; // Import AlbumPage
import { AppContextProvider } from './store/AppContext';
import './App.css';

function App() {
  return (
    <AppContextProvider>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/search" />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/album/:id" element={<AlbumPage />} /> {/* Add AlbumPage route */}
          </Routes>
        </main>
        <PlayerBar />
      </div>
    </AppContextProvider>
  );
}

export default App;
