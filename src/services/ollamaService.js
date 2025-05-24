import axios from 'axios';

// Default Ollama API URL
// In a Create React App, environment variables should be prefixed with REACT_APP_
// and defined in .env files or set in the build process
const OLLAMA_API_URL = 
  (typeof process !== 'undefined' && process.env.REACT_APP_OLLAMA_URL) || 
  'http://localhost:11434';

// API URL for MongoDB queries
const API_BASE_URL = 
  (typeof process !== 'undefined' && process.env.REACT_APP_API_URL) || 
  'http://localhost:5002';

// Create an axios instance for Ollama API
const ollamaApi = axios.create({
  baseURL: OLLAMA_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 seconds timeout (increased for slower machines)
});

// Create an axios instance for our API
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

/**
 * Fetch relevant data from MongoDB based on the user's query
 * @param {string} query - The user's query
 * @param {Object} context - Additional context (e.g., current board, column, task)
 * @returns {Promise<Array>} - Array of relevant data from MongoDB
 */
async function fetchRelevantData(query, context = {}) {
  try {
    const response = await api.post('/api/llm/query', {
      query,
      context
    });
    
    if (response.data.success && response.data.results) {
      return response.data.results;
    }
    return [];
  } catch (error) {
    console.error('Error fetching relevant data:', error);
    return [];
  }
}

// Add request interceptor to handle errors
ollamaApi.interceptors.request.use(
  config => {
    // Add timestamp to avoid caching
    if (config.method === 'get') {
      config.params = { ...config.params, _t: Date.now() };
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
ollamaApi.interceptors.response.use(
  response => response,
  error => {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out. Please check your connection and try again.');
    } else if (!error.response) {
      // Network error
      throw new Error('Cannot connect to Ollama. Please make sure it is running.');
    } else if (error.response.status === 404) {
      throw new Error('Ollama API endpoint not found. Please check if the URL is correct.');
    } else if (error.response.status >= 500) {
      throw new Error('Ollama server error. Please try again later.');
    }
    return Promise.reject(error);
  }
);

/**
 * Format MongoDB data for the LLM prompt
 * @param {Array} data - Array of data from MongoDB
 * @returns {string} - Formatted string for the LLM prompt
 */
function formatMongoDBDataForPrompt(data) {
  if (!data || data.length === 0) return '';
  
  return `\n\nRelevant data from the database:\n${data.map((item, index) => {
    const source = item.source ? ` (source: ${item.source})` : '';
    const type = item.type ? `[${item.type}] ` : '';
    const content = JSON.stringify(item.data, null, 2);
    return `--- ${type}${source} ---\n${content}\n`;
  }).join('\n')}\n`;
}

/**
 * Send a message to the Ollama API with MongoDB context
 * @param {Object} options - The message options
 * @param {string} options.message - The user's message
 * @param {Array} options.messages - The conversation history
 * @param {Object} options.board - The current board data for context
 * @param {string} options.model - The model to use (default: deepseek-coder:6.7b)
 * @param {Object} options.options - Additional options for the model
 * @returns {Promise<string>} - The AI's response
 */
export const sendMessageToOllama = async ({
  message,
  messages = [],
  board = null,
  model = 'deepseek-coder:6.7b',
  options = {}
}) => {
  try {
    // Extract relevant context for MongoDB query
    const mongoContext = {
      taskId: board?.currentTaskId,
      columnId: board?.currentColumnId,
      boardId: board?._id
    };

    // Fetch relevant data from MongoDB based on the user's query
    const relevantData = await fetchRelevantData(message, mongoContext);
    
    // Format the data for the prompt
    const dataContext = formatMongoDBDataForPrompt(relevantData);

    // Prepare system prompt with board and MongoDB context
    const systemPrompt = `You are a helpful assistant for a Kanban board application. 
You help users manage their tasks, answer questions, and provide insights about their work.

Board Context:
${board ? formatBoardData(board) : 'No board data available.'}

${dataContext}

Guidelines:
- Be concise but helpful
- Format your responses in Markdown
- Use bullet points and lists for multiple items
- Format code snippets with backticks
- Be polite and professional`;

    // Prepare the conversation context
    const chatMessages = [
      {
        role: 'system',
        content: systemPrompt
      },
      // Add message history
      ...messages,
      // Add the current message
      {
        role: 'user',
        content: message
      }
    ];

    const response = await ollamaApi.post('/api/chat', {
      model: model,
      messages: chatMessages,
      stream: false,
      options: {
        temperature: 0.7,
        max_tokens: 2000,
        top_p: 0.9,
        ...options
      }
    });

    // Extract the response content
    const responseContent = response.data?.message?.content || 
                         response.data?.response ||
                         "I'm sorry, I couldn't process your request at the moment.";

    // Clean up the response
    return cleanResponse(responseContent);
  } catch (error) {
    console.error('Error calling Ollama API:', error);
    throw new Error(
      error.message || 
      'Failed to get response from the AI. Please make sure Ollama is running and the model is loaded.'
    );
  }
};

/**
 * Check if the Ollama server is running and the model is available
 * @returns {Promise<{isRunning: boolean, models: Array<string>, error?: string}>}
 */
export const checkOllamaStatus = async () => {
  try {
    // Check if Ollama is running
    const [tagsResponse, modelsResponse] = await Promise.all([
      ollamaApi.get('/api/tags').catch(() => ({ data: { models: [] } })),
      ollamaApi.get('/api/tags').catch(() => ({ data: { models: [] } }))
    ]);
    
    const models = Array.isArray(tagsResponse.data?.models) 
      ? tagsResponse.data.models.map(m => m.name)
      : [];
    
    return {
      isRunning: true,
      models,
      error: models.length === 0 ? 'No models found. Please install a model first.' : undefined
    };
  } catch (error) {
    console.error('Ollama is not running or not accessible:', error);
    return {
      isRunning: false,
      models: [],
      error: error.message || 'Cannot connect to Ollama. Please make sure it is running.'
    };
  }
};

/**
 * Format board data for the system prompt
 * @private
 */
function formatBoardData(board) {
  if (!board) return 'No board data available.';
  
  try {
    const columns = board.columns?.map(column => {
      const tasks = column.tasks?.map(task => {
        const assignee = task.assignee ? `(Assigned to: ${task.assignee.name})` : '';
        const dueDate = task.dueDate ? `Due: ${new Date(task.dueDate).toLocaleDateString()}` : '';
        return `- ${task.title} ${assignee} ${dueDate}`.trim();
      }).join('\n  ') || 'No tasks';
      
      return `## ${column.name}\n${tasks}`;
    }).join('\n\n') || 'No columns';
    
    return `# ${board.name || 'Untitled Board'}\n\n${columns}`;
  } catch (error) {
    console.error('Error formatting board data:', error);
    return 'Error loading board data.';
  }
}

/**
 * Clean up the response from the AI
 * @private
 */
function cleanResponse(text) {
  if (!text) return '';
  
  // Remove any leading/trailing whitespace
  let cleaned = text.trim();
  
  // Remove any markdown code block markers if they're not properly formatted
  cleaned = cleaned.replace(/^```(?:\w*\n)?([\s\S]*?)\n```$/gm, '$1');
  
  // Trim again after cleaning
  return cleaned.trim();
}

/**
* Pull a model from Ollama
* @param {string} model - The model to pull (e.g., 'deepseek-coder:6.7b')
* @returns {Promise<{success: boolean, message: string}>}
*/
export const pullModel = async (model) => {
try {
  const response = await ollamaApi.post('/api/pull', { name: model });
  return {
    success: true,
    message: `Successfully pulled ${model}`,
    data: response.data
  };
} catch (error) {
  console.error(`Error pulling model ${model}:`, error);
  return {
    success: false,
    message: error.response?.data?.error || `Failed to pull model: ${model}`,
    error: error.message
  };
}
};
