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

  const playTrack = async (track: any) => {
    if (!debridKey) {
      alert('Please set your Real-Debrid API key in Settings.');
      return;
    }
    try {
      const res = await axios.post('/api/debrid', 
        { magnet: track.magnet || track.link }, // Use magnet or link
        { headers: { Authorization: `Bearer ${debridKey}` } }
      );
      setCurrentTrack(track);
      setStreamUrl(res.data.streamLink);
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
      audioRef.current.src = streamUrl;
      audioRef.current.play();
      setPlayer(p => ({ ...p, isPlaying: true }));
    }
  }, [streamUrl]);

  return (
    <AppContext.Provider value={{ debridKey, setDebridKey, currentTrack, streamUrl, queue, player, playTrack, addToQueue, togglePlay, seek, setVolume }}>
      {children}
      <audio 
        ref={audioRef} 
        onTimeUpdate={() => setPlayer(p => ({ ...p, currentTime: audioRef.current?.currentTime || 0 }))}
        onLoadedMetadata={() => setPlayer(p => ({ ...p, duration: audioRef.current?.duration || 0 }))}
        onEnded={() => setPlayer(p => ({ ...p, isPlaying: false }))}
      />
    </AppContext.Provider>
  );
}
