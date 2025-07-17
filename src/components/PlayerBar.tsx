import { useContext } from 'react';
import { FaPlay, FaPause, FaStepForward, FaStepBackward } from 'react-icons/fa';
import { AppContext, IAppContext } from '../store/AppContext';
import './PlayerBar.css';

function PlayerBar() {
  const { player, currentTrack, togglePlay, seek } = useContext(AppContext) as IAppContext;

  const formatTime = (seconds: number) => {
    const date = new Date(0);
    date.setSeconds(seconds || 0);
    return date.toISOString().substr(14, 5);
  };

  if (!currentTrack) {
    return null; // Don't render the player if nothing is loaded
  }

  return (
    <div className="player-bar">
      <div className="player-bar-content">
        <div className="track-info">
          <div className="track-title">{currentTrack.title}</div>
          <div className="track-artist">Streaming from Real-Debrid</div>
        </div>
        <div className="player-controls">
          <button><FaStepBackward /></button>
          <button onClick={togglePlay}>{player.isPlaying ? <FaPause /> : <FaPlay />}</button>
          <button><FaStepForward /></button>
        </div>
        <div className="progress-bar-container">
          <span>{formatTime(player.currentTime)}</span>
          <input
            type="range"
            min="0"
            max={player.duration || 100}
            value={player.currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            className="progress-bar"
          />
          <span>{formatTime(player.duration)}</span>
        </div>
      </div>
    </div>
  );
}

export default PlayerBar;
