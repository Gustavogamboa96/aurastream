import { createContext, useState, ReactNode, useRef, useEffect } from 'react';
import axios from 'axios';

export interface IAppContext {
  debridKey: string | null;
  setDebridKey: (key: string) => void;
  currentTrack: any | null;
  streamUrl: string | null;
  queue: any[];
  player: {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
  };
  playTrack: (track: any) => void;
  addToQueue: (track: any) => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
}

export const AppContext = createContext<IAppContext | undefined>(undefined);

export function AppContextProvider({ children }: { children: ReactNode }) {
  const [debridKey, setDebridKey] = useState<string | null>(() => window.localStorage.getItem('debridKey'));
  const [currentTrack, setCurrentTrack] = useState<any | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [player, setPlayer] = useState({ isPlaying: false, currentTime: 0, duration: 0, volume: 1 });

  const audioRef = useRef<HTMLAudioElement>(null);

  const playTrack = async (trackInfo: any) => {
    try {
      // If we already have a direct URL (from worker unrestrict), use it directly
      if (trackInfo.url) {
        setCurrentTrack({
          title: trackInfo.title || 'Unknown Track',
          artist: trackInfo.artist || 'Unknown Artist',
          album: trackInfo.album || 'Unknown Album'
        });
        setStreamUrl(trackInfo.url);
        return;
      }

      // Legacy support for old format - this path shouldn't be used anymore
      if (!debridKey) {
        alert('Please set your Real-Debrid API key in Settings.');
        return;
      }

      // If a specific file is selected, we already have the torrent info
      if (trackInfo.selectedFile) {
        const res = await axios.post('/api/debrid/stream', 
          { 
            torrentId: trackInfo.torrentId,
            fileId: trackInfo.selectedFile.id,
            link: trackInfo.links[0]
          },
          { headers: { Authorization: `Bearer ${debridKey}` } }
        );
        setCurrentTrack({ title: trackInfo.selectedFile.path, album: trackInfo.title });
        setStreamUrl(res.data.streamLink);
      } else {
        // This is for playing a whole torrent, find the largest file
        const infoRes = await axios.post('/api/debrid/info', 
          { magnet: trackInfo.magnet || trackInfo.link },
          { headers: { Authorization: `Bearer ${debridKey}` } }
        );
        const mainFile = infoRes.data.files.reduce((prev: any, current: any) => 
            (prev.bytes > current.bytes) ? prev : current
        );
        const streamRes = await axios.post('/api/debrid/stream', 
          { 
            torrentId: infoRes.data.torrentId,
            fileId: mainFile.id,
            link: infoRes.data.links[0]
          },
          { headers: { Authorization: `Bearer ${debridKey}` } }
        );
        setCurrentTrack({ title: mainFile.path, album: trackInfo.title });
        setStreamUrl(streamRes.data.streamLink);
      }
    } catch (error) {
      console.error('Failed to get stream link', error);
      alert('Failed to get stream link from Real-Debrid.');
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (player.isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setPlayer(p => ({ ...p, isPlaying: !p.isPlaying }));
    }
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const setVolume = (v: number) => {
    if (audioRef.current) {
      audioRef.current.volume = v;
      setPlayer(p => ({ ...p, volume: v }));
    }
  };

  const addToQueue = (track: any) => setQueue(q => [...q, track]);

  useEffect(() => {
    if (streamUrl && audioRef.current) {
      console.log('Setting audio source:', streamUrl);
      audioRef.current.src = streamUrl;
      audioRef.current.play().catch(err => {
        console.error('Failed to play audio:', err);
        alert('Failed to play audio. The file might not be ready yet or there may be a network issue.');
      });
      setPlayer(p => ({ ...p, isPlaying: true }));
    }
  }, [streamUrl]);

  return (
    <AppContext.Provider value={{ debridKey, setDebridKey, currentTrack, streamUrl, queue, player, playTrack, addToQueue, togglePlay, seek, setVolume }}>
      {children}
      <audio 
        ref={audioRef}
        crossOrigin="anonymous"
        preload="metadata"
        onTimeUpdate={() => setPlayer(p => ({ ...p, currentTime: audioRef.current?.currentTime || 0 }))}
        onLoadedMetadata={() => setPlayer(p => ({ ...p, duration: audioRef.current?.duration || 0 }))}
        onEnded={() => setPlayer(p => ({ ...p, isPlaying: false }))}
        onError={(e) => {
          console.error('Audio element error:', e);
          const error = audioRef.current?.error;
          if (error) {
            console.error('Error code:', error.code, 'Message:', error.message);
          }
        }}
      />
    </AppContext.Provider>
  );
}
