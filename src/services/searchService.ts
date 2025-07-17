import axios from 'axios';

export const searchTorrents = async (query: string, suggestions = false) => {
  // The API key is now required for search, so we get it from local storage.
  const debridKey = window.localStorage.getItem('debridKey');
  if (!debridKey) {
    // If there's no key, we can't search. Return an empty array.
    // The UI should ideally prevent search if the key is not set.
    alert('Please set your Real-Debrid API key in Settings to search.');
    return [];
  }

  const config = {
    headers: {
      Authorization: `Bearer ${debridKey}`
    }
  };

  const res = await axios.get(`/api/search?query=${encodeURIComponent(query)}&suggestions=${suggestions}`, config);
  return res.data.results || [];
};
