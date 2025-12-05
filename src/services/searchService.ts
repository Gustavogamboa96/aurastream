const WORKER_URL = (import.meta as any).env?.VITE_WORKER_URL || 'http://localhost:8787';

export const searchTorrents = async (query: string, suggestions = false) => {
  try {
    const response = await fetch(`${WORKER_URL}/search?q=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error('Search failed');
    }

    const data = await response.json();
    
    // Format results to match expected structure
    const formattedResults = data.results.map((result: any) => ({
      title: result.title,
      seeds: result.seeds,
      leeches: result.leeches,
      size: result.size,
      magnet: result.magnet, // Magnet is now included directly in search results
      info_hash: result.magnet?.match(/btih:([A-Fa-f0-9]+)/)?.[1] || '',
    }));

    return suggestions ? formattedResults.slice(0, 5) : formattedResults;
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
};

// No longer needed - magnet is included in search results
export const getMagnetLink = async (magnetLink: string) => {
  // Just return the magnet link directly since it's already in the search results
  return magnetLink;
};

// Legacy function for backward compatibility
export const _getMagnetFromPath = async (torrentPath: string) => {
  try {
    const response = await fetch(`${WORKER_URL}/magnet${torrentPath}`);
    
    if (!response.ok) {
      throw new Error('Failed to get magnet link');
    }

    const data = await response.json();
    return data.magnet;
  } catch (error) {
    console.error('Magnet fetch error:', error);
    return null;
  }
};
