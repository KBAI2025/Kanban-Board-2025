import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ReactMarkdown from 'react-markdown';
import { 
  faRobot, 
  faPaperPlane, 
  faTimes, 
  faMinus, 
  faExpand, 
  faEllipsisH 
} from '@fortawesome/free-solid-svg-icons';
import { useBoard } from '../contexts/BoardContext';
import { sendMessageToOllama, checkOllamaStatus } from '../services/ollamaService';
import './ChatButton.css';

// Avatar component for messages
const MessageAvatar = ({ type }) => {
  const getIcon = () => {
    switch(type) {
      case 'bot':
        return <FontAwesomeIcon icon={faRobot} size="xs" />;
      case 'error':
        return <span>!</span>;
      default:
        return <span>U</span>;
    }
  };

  return (
    <div className="message-avatar">
      {getIcon()}
    </div>
  );
};

// Typing indicator component
const TypingIndicator = () => (
  <div className="typing-indicator">
    <div className="typing-dot"></div>
    <div className="typing-dot"></div>
    <div className="typing-dot"></div>
  </div>
);

// Status badge component
const StatusBadge = ({ isOnline }) => (
  <span className={`status-badge ${isOnline ? 'online' : 'offline'}`}>
    {isOnline ? 'Online' : 'Offline'}
  </span>
);

// Chat message component with typing effect
const ChatMessage = React.memo(({ message, type = 'bot', isTyping = false, id }) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const messageRef = useRef(null);

  // Typing effect for bot messages
  useEffect(() => {
    if (type !== 'bot' || !message || isTyping === false) {
      setDisplayText(message || '');
      return;
    }
    
    setDisplayText('');
    setCurrentIndex(0);
    
    const timer = setInterval(() => {
      if (currentIndex < message.length) {
        setDisplayText(prev => prev + message[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      } else {
        clearInterval(timer);
      }
    }, 10); // Typing speed (lower = faster)
    
    return () => clearInterval(timer);
  }, [message, type, isTyping, currentIndex]);

  // Auto-scroll when message updates
  useEffect(() => {
    if (messageRef.current) {
      messageRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [displayText]);

  // Don't render empty messages
  if (!message) return null;

  return (
    <div 
      ref={messageRef}
      className={`chat-message ${type}-message`}
      data-message-id={id}
    >
      {type !== 'user' && <MessageAvatar type={type} />}
      <div className="message-content">
        {type === 'bot' && isTyping && currentIndex < message.length 
          ? displayText 
          : message}
      </div>
      {type === 'user' && <MessageAvatar type="user" />}
    </div>
  );
});

// Welcome message component
const WelcomeMessage = ({ onExampleClick }) => (
  <div className="welcome-message">
    <h3>Welcome to Kanban AI Assistant</h3>
    <p>I can help you manage your tasks and answer questions about your Kanban board.</p>
    <div className="examples">
      <p>Try asking:</p>
      <ul>
        <li>
          <button onClick={() => onExampleClick('What tasks are assigned to me?')}>
            What tasks are assigned to me?
          </button>
        </li>
        <li>
          <button onClick={() => onExampleClick('Show me high priority tasks')}>
            Show me high priority tasks
          </button>
        </li>
        <li>
          <button onClick={() => onExampleClick('What are the tasks in progress?')}>
            What are the tasks in progress?
          </button>
        </li>
      </ul>
    </div>
  </div>
);

const ChatButton = () => {
  // State management
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState({ 
    isRunning: false, 
    models: [],
    isLoading: true
  });
  
  // Messages state with unique IDs and timestamps
  const [messages, setMessages] = useState(() => [
    { 
      id: 'welcome',
      text: 'Hello! I\'m your Kanban AI assistant. How can I help you today?',
      type: 'bot',
      timestamp: new Date().toISOString()
    }
  ]);
  
  // Refs
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);
  
  // Get board data from context
  const { board } = useBoard();
  
  // Generate a unique ID for messages
  const generateId = useCallback(() => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);
  
  // Add a new message to the chat
  const addMessage = useCallback((text, type = 'bot', isTyping = false) => {
    const newMessage = {
      id: generateId(),
      text,
      type,
      timestamp: new Date().toISOString(),
      isTyping
    };
    
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, [generateId]);
  
  // Handle example click from welcome message
  const handleExampleClick = useCallback((exampleText) => {
    setInputValue(exampleText);
    // Auto-submit after a short delay to ensure input is updated
    setTimeout(() => {
      const submitEvent = new Event('submit', { cancelable: true });
      document.querySelector('.chat-input-form')?.dispatchEvent(submitEvent);
    }, 50);
  }, []);

  // Check Ollama status when chat is opened
  const checkOllamaConnection = useCallback(async () => {
    try {
      setOllamaStatus(prev => ({ ...prev, isLoading: true }));
      const { isRunning, models, error } = await checkOllamaStatus();
      
      setOllamaStatus(prev => ({
        ...prev,
        isRunning,
        models,
        isLoading: false,
        error: isRunning ? null : error
      }));
      
      if (!isRunning) {
        const errorMsg = error || 'Ollama is not running. Please make sure Ollama is installed and running on your system.';
        addMessage(
          `⚠️ ${errorMsg}\n\n` +
          'You can download Ollama from: https://ollama.ai/download',
          'error'
        );
        return { isRunning: false, hasModel: false };
      }
      
      const modelName = 'deepseek-coder:6.7b';
      const hasModel = models.some(model => 
        model.includes('deepseek-coder') || 
        model.includes('deepseek') ||
        model.includes('coder')
      );
      
      if (!hasModel) {
        const installMsg = `ℹ️ The ${modelName} model is not installed.\n` +
          'Please run this command in your terminal to install it:\n\n' +
          '```bash\nollama pull deepseek-coder:6.7b\n```';
        
        addMessage(
          installMsg,
          'bot'
        );
        return { isRunning: true, hasModel: false };
      }
      
      // If we get here, everything is working
      return { isRunning: true, hasModel: true };
      
    } catch (error) {
      console.error('Error checking Ollama status:', error);
      
      setOllamaStatus(prev => ({
        ...prev,
        isRunning: false,
        isLoading: false,
        error: error.message
      }));
      
      addMessage(
        `❌ Error connecting to Ollama: ${error.message || 'Unknown error'}\n\n` +
        'Please make sure Ollama is installed and running.\n' +
        'You can download it from: https://ollama.ai/download',
        'error'
      );
      
      return { isRunning: false, hasModel: false };
    }
  }, [addMessage]);
  
  // Check Ollama status when chat is opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      checkOllamaConnection();
    }
  }, [isOpen, isMinimized, checkOllamaConnection]);

  // Toggle chat window
  const handleToggleChat = useCallback(() => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    
    if (newIsOpen) {
      // Focus input when chat is opened
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);
  
  // Toggle minimize/restore chat window
  const handleMinimize = useCallback(() => {
    setIsMinimized(prev => !prev);
    
    // If we're un-minimizing, focus the input after animation
    if (isMinimized) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isMinimized]);
  
  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const userInput = inputValue.trim();
    if (!userInput) return;
    
    // Add user message to chat
    const userMessage = addMessage(userInput, 'user');
    setInputValue('');
    
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    
    // Check if Ollama is running before processing
    const { isRunning } = await checkOllamaConnection();
    if (!isRunning) {
      return; // Error message already shown by checkOllamaConnection
    }
    
    // Show typing indicator
    setIsTyping(true);
    const botMessage = addMessage('', 'bot', true);
    
    try {
      // Prepare board data for context (only include necessary fields to reduce token usage)
      const boardContext = board ? {
        id: board._id,
        name: board.name,
        columns: board.columns?.map(column => ({
          id: column._id,
          title: column.title,
          tasks: column.tasks?.map(task => ({
            id: task._id || task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: column.title, // Add status from column
            epicLabel: task.epicLabel,
            assignee: task.assignee ? {
              id: task.assignee.id || task.assignee._id,
              name: task.assignee.name
            } : null,
            dueDate: task.dueDate,
            createdAt: task.createdAt
          })) || []
        })) || []
      } : null;
      
      // Convert messages to the format expected by the API
      const chatHistory = messages
        .filter(msg => (msg.type === 'user' || msg.type === 'bot') && msg.id !== botMessage.id)
        .map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.text
        }));
      
      // Send message to Ollama
      const response = await sendMessageToOllama({
        message: userInput,
        messages: chatHistory,
        board: boardContext,
        model: 'deepseek-coder:6.7b',
        options: {
          temperature: 0.7,
          max_tokens: 2000
        }
      });
      
      // Update the bot message with the response
      setMessages(prev => 
        prev.map(msg => 
          msg.id === botMessage.id 
            ? { ...msg, text: response, isTyping: false }
            : msg
        )
      );
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Update with error message
      setMessages(prev => 
        prev.map(msg => 
          msg.id === botMessage.id 
            ? { 
                ...msg, 
                text: `I'm sorry, I encountered an error: ${error.message || 'Unknown error'}.\n\n` +
                      'Please make sure Ollama is running and the model is installed correctly.',
                type: 'error',
                isTyping: false 
              }
            : msg
        )
      );
    } finally {
      setIsTyping(false);
      
      // Scroll to bottom after message is added
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [inputValue, board, messages, addMessage]);
  
  // Handle input key down (for Enter key without Shift)
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);
  
  // Handle input change
  const handleInputChange = useCallback((e) => {
    setInputValue(e.target.value);
  }, []);
  
  // Auto-resize textarea as user types
  const handleInput = useCallback((e) => {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current && !isMinimized) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isScrolledToBottom = scrollHeight - (scrollTop + clientHeight) < 100;
      
      if (isScrolledToBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, isTyping, isMinimized]);
  
  // Focus input when chat is opened or restored
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  return (
    <div className="chat-widget">
      {/* Chat Toggle Button */}
      <button 
        className={`chat-toggle-button ${isOpen ? 'active' : ''}`} 
        onClick={handleToggleChat}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        title="AI Assistant"
        aria-expanded={isOpen}
      >
        <FontAwesomeIcon 
          icon={isOpen ? faTimes : faRobot} 
          className="chat-icon" 
          aria-hidden="true"
        />
        {!isOpen && messages.some(m => m.type === 'user') && (
          <span className="chat-badge" aria-label="You have unread messages">
            {messages.filter(m => m.type === 'user').length}
          </span>
        )}
      </button>
      
      {/* Chat Popup */}
      {isOpen && (
        <div 
          className={`chat-popup ${isMinimized ? 'minimized' : ''}`}
          role="dialog"
          aria-labelledby="chat-header-title"
          aria-describedby="chat-description"
        >
          <div className="chat-header">
            <div className="header-left">
              <FontAwesomeIcon 
                icon={faRobot} 
                className="header-icon" 
                aria-hidden="true"
              />
              <h3 id="chat-header-title">Kanban AI Assistant</h3>
              {ollamaStatus.isLoading ? (
                <span className="status-badge">Connecting...</span>
              ) : (
                <StatusBadge isOnline={ollamaStatus.isRunning} />
              )}
            </div>
            <div className="header-actions">
              <button 
                onClick={handleMinimize} 
                className="minimize-button"
                title={isMinimized ? 'Restore chat' : 'Minimize chat'}
                aria-label={isMinimized ? 'Restore chat' : 'Minimize chat'}
              >
                {isMinimized ? (
                  <FontAwesomeIcon icon={faExpand} />
                ) : (
                  <FontAwesomeIcon icon={faMinus} />
                )}
              </button>
              <button 
                onClick={handleToggleChat} 
                className="close-button"
                title="Close chat"
                aria-label="Close chat"
              >
                <FontAwesomeIcon icon={faTimes} aria-hidden="true" />
              </button>
            </div>
          </div>
          
          {!isMinimized && (
            <>
              <div 
                className="chat-messages" 
                ref={chatContainerRef}
                role="log"
                aria-live="polite"
              >
                {/* Welcome message for new chats */}
                {messages.length <= 1 && (
                  <WelcomeMessage onExampleClick={handleExampleClick} />
                )}
                
                {/* Render chat messages */}
                {messages.map((message) => (
                  <ChatMessage 
                    key={message.id}
                    id={message.id}
                    message={message.text} 
                    type={message.type}
                    isTyping={message.isTyping}
                  />
                ))}
                
                {/* Auto-scroll anchor */}
                <div ref={messagesEndRef} style={{ height: '1px' }} aria-hidden="true" />
                
                {/* Loading indicator when Ollama is connecting */}
                {ollamaStatus.isLoading && (
                  <div className="typing-indicator">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </div>
                )}
                
                {/* Typing indicator for bot response */}
                {isTyping && messages[messages.length - 1]?.type === 'user' && (
                  <div className="typing-indicator">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </div>
                )}
                
                {/* Ollama status message */}
                {!ollamaStatus.isLoading && !ollamaStatus.isRunning && (
                  <div className="ollama-status">
                    <span className="status-icon">⚠️</span>
                    <span>
                      {ollamaStatus.error 
                        ? `Error: ${ollamaStatus.error}` 
                        : 'Ollama is not running. Some features may be limited.'}
                    </span>
                  </div>
                )}
              </div>
              
              <form 
                onSubmit={handleSubmit} 
                className="chat-input-form"
                aria-label="Chat input form"
              >
                <div className="chat-input-container">
                  <div className="input-wrapper">
                    <textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      onInput={handleInput}
                      placeholder="Ask me anything about your tasks..."
                      className="chat-input"
                      disabled={isTyping || ollamaStatus.isLoading}
                      rows={1}
                      aria-label="Type your message"
                      aria-multiline="true"
                      aria-required="true"
                    />
                    <button 
                      type="submit" 
                      className="send-button"
                      disabled={!inputValue.trim() || isTyping || ollamaStatus.isLoading}
                      aria-label="Send message"
                      title="Send message"
                    >
                      <FontAwesomeIcon 
                        icon={isTyping ? faEllipsisH : faPaperPlane} 
                        className="send-icon" 
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                  
                  {/* Character counter */}
                  {inputValue.length > 0 && (
                    <div className="character-counter">
                      {inputValue.length}/1000
                    </div>
                  )}
                  
                  {/* Status indicator */}
                  {ollamaStatus.isLoading ? (
                    <div className="ollama-status">
                      <span className="status-icon">🔍</span>
                      <span>Connecting to Ollama...</span>
                    </div>
                  ) : !ollamaStatus.isRunning ? (
                    <div className="ollama-status">
                      <span className="status-icon">⚠️</span>
                      <span>Ollama is not running. Some features may be limited.</span>
                    </div>
                  ) : null}
                </div>
                
                {/* Help text */}
                <div className="help-text">
                  <small>
                    Press <kbd>Enter</kbd> to send, <kbd>Shift+Enter</kbd> for new line
                  </small>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatButton;
