import { useState, useContext, useCallback } from 'react';
import { AppContext, IAppContext } from '../store/AppContext';
import { searchTorrents } from '../services/searchService';
import debounce from 'lodash.debounce';
import './SearchPage.css';

function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const { playTrack, addToQueue } = useContext(AppContext) as IAppContext;

  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.length > 2) {
        const sugg = await searchTorrents(searchQuery, true);
        setSuggestions(sugg);
      } else {
        setSuggestions([]);
      }
    }, 300),
    []
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setResults([]); // Clear results when typing
    debouncedSearch(newQuery);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() === '') return;
    const res = await searchTorrents(query);
    setResults(res);
    setSuggestions([]);
  };
  
  const handleSuggestionClick = (suggestion: any) => {
    setQuery(suggestion.title);
    setSuggestions([]);
    // Trigger a full search for the selected suggestion
    searchTorrents(suggestion.title).then(res => setResults(res));
  };

  return (
    <div className="search-page">
      <h1>Search</h1>
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-container">
          <input 
            type="text" 
            value={query} 
            onChange={handleInputChange} 
            placeholder="Artists, albums, or tracks" 
            className="search-input"
            autoComplete="off"
          />
        </div>
        <button type="submit" className="search-button">Search</button>
      </form>

      {suggestions.length > 0 && (
        <div className="suggestions-container">
          <h3>Suggestions</h3>
          {suggestions.map((s) => (
            <div className="suggestion-card" key={s.id || s.title} onClick={() => handleSuggestionClick(s)}>
              <div className="card-title">{s.title}</div>
              <div className="card-meta">{s.size} | Seeders: {s.seeds}</div>
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <div className="results-container">
          <h3>Results</h3>
          {results.map((r: any) => (
            <div className="result-card" key={r.id || r.title}>
              <div className="card-info">
                <div className="card-title">{r.title}</div>
                <div className="card-meta">{r.size} | Seeders: {r.seeds}</div>
              </div>
              <div className="card-actions">
                <button onClick={() => playTrack(r)}>Play</button>
                <button onClick={() => addToQueue(r)}>+</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchPage;
