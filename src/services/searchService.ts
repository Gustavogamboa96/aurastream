import axios from 'axios';

export const searchTorrents = async (query: string, suggestions = false) => {
  const res = await axios.get(`/api/search?query=${encodeURIComponent(query)}&suggestions=${suggestions}`);
  return res.data.results || [];
};
