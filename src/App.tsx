
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import SearchPage from './pages/SearchPage';
import LibraryPage from './pages/LibraryPage';
import SettingsPage from './pages/SettingsPage';
import * as Context from './store/AppContext';
import './App.css';
import { AppContextProvider } from './store/AppContext';

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
          </Routes>
        </main>
        <PlayerBar />
      </div>
    </AppContextProvider>
  );
}

export default App;
