
import { useContext, useState } from 'react';
import * as Context from '../store/AppContext';
import './SettingsPage.css';

function SettingsPage() {
  const { debridKey, setDebridKey } = useContext(Context.AppContext);
  const [input, setInput] = useState(debridKey || '');

  const handleSave = () => {
    setDebridKey(input);
    window.localStorage.setItem('debridKey', input);
    alert('Settings saved!');
  };

  return (
    <div className="settings-page">
      <h1>Settings</h1>
      <div className="setting-item">
        <label htmlFor="debrid-key">Debrid Service API Key</label>
        <input 
          id="debrid-key"
          type="password" 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          placeholder="Enter your API key" 
        />
      </div>
      <button onClick={handleSave} className="save-button">Save</button>
    </div>
  );
}

export default SettingsPage;
