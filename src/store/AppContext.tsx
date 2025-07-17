import { createContext, useState, ReactNode } from 'react';

export interface IAppContext {
  debridKey: string | null;
  setDebridKey: (key: string) => void;
  library: any[];
  myLikes: any[];
  queue: any[];
  player: {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    seek?: (t: number) => void;
  };
  addToQueue: (track: any) => void;
  playNext: (track: any) => void;
  playPrev: () => void;
  togglePlay: () => void;
  setVolume: (v: number) => void;
  seek: (t: number) => void;
  toggleLike: (item: any) => void;
}

export const AppContext = createContext<IAppContext | undefined>(undefined);

function AppContextProvider({ children }: { children: ReactNode }) {
  const [debridKey, setDebridKey] = useState<string | null>(window.localStorage.getItem('debridKey'));
  const [library, setLibrary] = useState<any[]>(JSON.parse(window.localStorage.getItem('library') || '[]'));
  const [myLikes, setMyLikes] = useState<any[]>(JSON.parse(window.localStorage.getItem('myLikes') || '[]'));
  const [queue, setQueue] = useState<any[]>([]);
  const [player, setPlayer] = useState<{ isPlaying: boolean; currentTime: number; duration: number; volume: number }>({ isPlaying: false, currentTime: 0, duration: 0, volume: 1 });

  const addToQueue = (track: any) => setQueue(q => [...q, track]);
  const playNext = (track: any) => setQueue(q => [track, ...q]);
  const playPrev = () => setQueue(q => q.slice(1));
  const togglePlay = () => setPlayer((p) => ({ ...p, isPlaying: !p.isPlaying }));
  const setVolume = (v: number) => setPlayer((p) => ({ ...p, volume: v }));
  const seek = (t: number) => setPlayer((p) => ({ ...p, currentTime: t }));
  const toggleLike = (item: any) => {
    let updated;
    if (library.find((i: any) => i.id === item.id)) {
      updated = library.filter((i: any) => i.id !== item.id);
    } else {
      updated = [...library, item];
    }
    setLibrary(updated);
    window.localStorage.setItem('library', JSON.stringify(updated));
    if (!myLikes.find((i: any) => i.id === item.id)) {
      const likes = [...myLikes, item];
      setMyLikes(likes);
      window.localStorage.setItem('myLikes', JSON.stringify(likes));
    }
  };

  return (
    <AppContext.Provider value={{ debridKey, setDebridKey, library, myLikes, queue, player, addToQueue, playNext, playPrev, togglePlay, setVolume, seek, toggleLike }}>
      {children}
    </AppContext.Provider>
  );
}

export { AppContextProvider };
