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
  if (!data || !data.length) return 'No relevant data found in the database.';
  
  // Check if this is an assignee query
  const isAssigneeQuery = data.some(item => 
    item.type === 'task' && item.data.assignee
  );
  
  if (isAssigneeQuery) {
    // Group tasks by assignee
    const tasksByAssignee = data.reduce((acc, item) => {
      if (item.type === 'task' && item.data.assignee) {
        const assignee = item.data.assignee;
        if (!acc[assignee]) {
          acc[assignee] = [];
        }
        acc[assignee].push(item.data);
      }
      return acc;
    }, {});
    
    // Format the response for assignee query
    return Object.entries(tasksByAssignee).map(([assignee, tasks]) => {
      const taskList = tasks.map(task => {
        const status = task.column?.name ? ` (${task.column.name})` : '';
        const dueDate = task.dueDate ? ` - Due: ${new Date(task.dueDate).toLocaleDateString()}` : '';
        return `- ${task.title}${status}${dueDate}`;
      }).join('\n');
      
      return `## ${tasks.length} ${tasks.length === 1 ? 'Task' : 'Tasks'} assigned to ${assignee}\n\n${taskList}`;
    }).join('\n\n');
  }
  
  // Default formatting for other queries
  const formattedData = data.map(item => {
    if (item.type === 'task') {
      const task = item.data;
      const status = task.column?.name ? `\n\nStatus: ${task.column.name}` : '';
      
      // Choose emoji based on task type or first word of title
      let emoji = '📌'; // Default emoji
      const title = task.title || '';
      
      if (title.toLowerCase().includes('chatbot') || title.toLowerCase().includes('chat bot')) {
        emoji = '🤖';
      } else if (title.toLowerCase().includes('margin') || title.toLowerCase().includes('calculator')) {
        emoji = '🔧';
      } else if (title.toLowerCase().includes('bug') || title.toLowerCase().includes('fix')) {
        emoji = '🐛';
      } else if (title.toLowerCase().includes('feature')) {
        emoji = '✨';
      } else if (title.toLowerCase().includes('meeting')) {
        emoji = '📅';
      }
      
      return `${emoji} **${task.title}**${status}`;
    } else if (item.type === 'board') {
      const board = item.data;
      const columns = board.columns?.map(col => `- ${col.name} (${col.tasks?.length || 0} tasks)`).join('\n') || 'No columns';
      return `### 🏁 Board: ${board.name}\n\n**Columns:**\n${columns}`;
    } else if (item.type === 'column') {
      const column = item.data;
      const tasks = column.tasks?.map(task => `- ${task.title}`).join('\n') || 'No tasks';
      return `### 📋 Column: ${column.name}\n\n**Tasks:**\n${tasks}`;
    }
    return `### 📄 ${item.type}\n\`\`\`json\n${JSON.stringify(item.data, null, 2)}\n\`\`\``;
  }).join('\n\n---\n\n');
  
  return `## 📊 Relevant Data\n\n${formattedData}`;
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

# Response Formatting Guidelines
1. **Always format your response in clear, well-structured Markdown**
   - Use proper line breaks between paragraphs and sections
   - Leave a blank line between different sections
   - Keep related content together with single line breaks

2. **For task lists or multiple items**:
   - Use bullet points (•) for simple lists
   - Use numbered lists for steps or priorities
   - Group related items under clear section headers
   - Add a blank line before and after lists

3. **For task details**:
   - Start with a clear title/heading
   - Include key metadata (status, due date, assignee)
   - Add a brief description if needed
   - Use emojis for better visual scanning
   - Separate different task details with line breaks

4. **For code or technical content**:
   \`\`\`language
   // Code goes here
   \`\`\`
   - Always add a blank line before and after code blocks

5. **For important notes or warnings**:
   > ⚠️ **Note:** Important information goes here
   
   - Add a blank line before and after blockquotes

6. **For success/error messages**:
   - ✅ Success: Action completed successfully
   - ❌ Error: Something went wrong
   - Add a blank line before status messages

# Current Context
## Board Information
${board ? formatBoardData(board) : 'No board data available.'}

## Relevant Data
${dataContext}

# Response Rules
- Be concise but helpful
- Use clear section headers (##, ###)
- Format all responses in Markdown
- Use emojis for better visual hierarchy
- Include all relevant details but keep it scannable
- Always use proper line breaks for better readability
- Separate different ideas or sections with blank lines
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
 * Clean up and enhance the response from the AI
 * @private
 * @param {string} text - The raw response text from the AI
 * @returns {string} Cleaned and formatted response
 */
function cleanResponse(text) {
  if (!text) return '';
  
  // Remove any leading/trailing whitespace
  let cleaned = text.trim();
  
  // Add line breaks after headings
  cleaned = cleaned.replace(/^(#{1,6})\s+(.*)$/gm, '\n$1 $2\n');
  
  // Add line breaks before and after lists
  cleaned = cleaned.replace(/(^|\n)([-*+]|\d+\.)\s+/g, '\n$1$2 ');
  cleaned = cleaned.replace(/(\n[-*+]\s+.*)(\n\s*\n)/g, '$1\n$2');
  
  // Add line breaks around code blocks
  cleaned = cleaned.replace(/(\n)?```(\w*)([\s\S]*?)```(\n)?/g, (match, p1, lang, code, p4) => {
    return `\n\n\`\`\`${lang || ''}${code}\`\`\`\n\n`;
  });
  
  // Add line breaks after paragraphs
  cleaned = cleaned.replace(/([.!?])\s+(?=[A-Z])/g, '$1\n\n');
  
  // Clean up multiple consecutive line breaks
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Add spacing around bold and italic text
  cleaned = cleaned
    .replace(/\*\*([^*]+)\*\*/g, ' **$1** ')
    .replace(/\*([^*]+)\*/g, ' *$1* ');
  
  // Ensure proper spacing after sentences
  cleaned = cleaned.replace(/([.!?])([A-Z])/g, '$1 $2');
  
  // Split into lines and clean up each line
  const lines = cleaned.split('\n').map(line => {
    // Remove extra spaces
    line = line.trim();
    // Add a space after list markers if missing
    line = line.replace(/^(-|\d+\.)([^\s])/, '$1 $2');
    return line;
  }).filter(line => line.length > 0);
  
  // Join lines with proper spacing
  cleaned = lines.join('\n');
  
  // Add proper spacing between sections
  cleaned = cleaned
    // Add space after headings
    .replace(/(^#+ .+$)\n(?!\n)/gm, '$1\n\n')
    // Add space before headings
    .replace(/([^\n])\n(#+ )/g, '$1\n\n$2')
    // Ensure two newlines between paragraphs
    .replace(/([^\n])\n([^\n])/g, '$1\n\n$2');
  
  // Ensure the response ends with proper punctuation
  if (!/[.!?]$/.test(cleaned)) {
    cleaned = cleaned.replace(/[,.!?]*$/, '') + '.';
  }
  
  // Final cleanup of any remaining issues
  cleaned = cleaned
    .replace(/\s+([.,!?])/g, '$1')  // Remove spaces before punctuation
    .replace(/\s{2,}/g, ' ')         // Remove multiple spaces
    .replace(/\n\s+\n/g, '\n\n')    // Clean up line breaks
    .trim();
  
  return cleaned;
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
