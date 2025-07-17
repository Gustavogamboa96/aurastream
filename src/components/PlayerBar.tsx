import { useContext } from 'react';
import { FaPlay, FaPause, FaStepForward, FaStepBackward } from 'react-icons/fa';
import * as Context from '../store/AppContext';
import './PlayerBar.css';

function PlayerBar() {
  const { player, queue, playNext, playPrev, togglePlay } = useContext(Context.AppContext) as any;

  return (
    <div className="player-bar">
      <div className="player-bar-content">
        <div className="track-info">
          <div className="track-title">Track Title</div>
          <div className="track-artist">Artist Name</div>
        </div>
        <div className="player-controls">
          <button onClick={playPrev}><FaStepBackward /></button>
          <button onClick={togglePlay}>{player.isPlaying ? <FaPause /> : <FaPlay />}</button>
          <button onClick={playNext}><FaStepForward /></button>
        </div>
      </div>
    </div>
  );
}

export default PlayerBar;
