// AI Tool definitions for function calling
import Searcher from '../search/search.js';

// Initialize search instance
const searchFields = ["filename", "category", "type", "region"];
const searcher = new Searcher(searchFields);

// Default search settings
const defaultSearchSettings = {
  boost: {
    filename: 2,
    category: 1,
    type: 1,
    region: 1
  },
  combineWith: "AND",
  fields: searchFields,
  fuzzy: 0,
  prefix: true,
  hideNonGame: true,
  useOldResults: false,
  pageSize: 10,
  page: 0,
  sort: ""
};

/**
 * Available tools for the AI assistant
 */
export const tools = [
  {
    type: "function",
    function: {
      name: "search_games",
      description: "Search for retro games and ROMs in the Myrient database. Use simple, flexible text searches for best results. The search is fuzzy and will find partial matches.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query - game name or title. Examples: 'Super Mario', 'The Last of Us', 'Final Fantasy'. Keep it simple for best results."
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (1-50, default 10)",
            minimum: 1,
            maximum: 50
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_search_suggestions",
      description: "Get search suggestions based on a partial query. Useful for helping users discover games or correct typos.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Partial search query to get suggestions for"
          }
        },
        required: ["query"]
      }
    }
  }
];

/**
 * Execute a tool call
 */
export async function executeToolCall(toolCall) {
  const { name, arguments: argsString } = toolCall.function;

  try {
    // Parse arguments from JSON string
    let args;
    try {
      args = typeof argsString === 'string' ? JSON.parse(argsString) : argsString;
    } catch (parseError) {
      throw new Error(`Invalid JSON arguments for ${name}: ${parseError.message}`);
    }

    switch (name) {
      case 'search_games':
        return await searchGames(args);
      case 'get_search_suggestions':
        return await getSearchSuggestions(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`Tool execution error for ${name}:`, error);
    return {
      error: `Failed to execute ${name}: ${error.message}`
    };
  }
}

/**
 * Search for games using the existing search infrastructure
 */
async function searchGames(args) {
  const { query, limit = 10 } = args;

  if (!query || typeof query !== 'string') {
    throw new Error('Query is required and must be a string');
  }

  // Build search options - simplified for fuzzy/flexible search
  const searchOptions = { ...defaultSearchSettings };
  searchOptions.pageSize = Math.min(Math.max(1, limit), 50);

  // Enable fuzzy search for better matching
  searchOptions.fuzzy = 1; // Allow some typos/variations
  searchOptions.prefix = true; // Allow partial matches

  try {
    const results = await searcher.findAllMatches(query.trim(), searchOptions);

    // Use results as-is without strict filtering
    let filteredItems = results.items;

    // Format results for the AI
    const formattedResults = filteredItems.slice(0, searchOptions.pageSize).map(item => ({
      id: item.file.id,
      filename: item.file.filename,
      category: item.file.category,
      type: item.file.type,
      region: item.file.region,
      size: item.file.size,
      score: item.score,
      // Add URLs for linking to games
      urls: {
        info: `/info/${item.file.id}`,
        play: `/play/${item.file.id}`, // For emulator (if compatible)
        download: item.file.path // Direct download link
      },
      metadata: item.metadata ? {
        title: item.metadata.title,
        description: item.metadata.summary,
        releaseDate: item.metadata.first_release_date,
        rating: item.metadata.rating,
        genres: item.metadata.genres
      } : null
    }));

    return {
      query,
      results: formattedResults,
      total_found: results.count,
      total_returned: formattedResults.length,
      search_time: results.elapsed
    };

  } catch (error) {
    throw new Error(`Search failed: ${error.message}`);
  }
}

/**
 * Get search suggestions
 */
async function getSearchSuggestions(args) {
  const { query } = args;

  if (!query || typeof query !== 'string') {
    throw new Error('Query is required and must be a string');
  }

  try {
    const suggestions = await searcher.getSuggestions(query.trim(), defaultSearchSettings);

    return {
      query,
      suggestions: suggestions || []
    };

  } catch (error) {
    throw new Error(`Failed to get suggestions: ${error.message}`);
  }
}
