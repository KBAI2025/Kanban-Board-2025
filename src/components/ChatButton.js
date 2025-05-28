import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faRobot, 
  faPaperPlane, 
  faTimes, 
  faEllipsisH 
} from '@fortawesome/free-solid-svg-icons';
import DnaSpinner from './DnaSpinner';
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
          <button onClick={() => onExampleClick('What tasks are assigned to Bob Johnson?')}>
            What tasks are assigned to Bob Johnson?
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
  const [isOpen, setIsOpen] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
        models: models || [],
        error: error || null,
        isLoading: false
      }));
      
      return { isRunning, models, error };
    } catch (error) {
      console.error('Error checking Ollama status:', error);
      setOllamaStatus(prev => ({
        ...prev,
        isRunning: false,
        error: error.message,
        isLoading: false
      }));
      return { isRunning: false, models: [], error: error.message };
    }
  }, []);
  
  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const userInput = inputValue.trim();
    if (!userInput || isLoading) return;
    
    setIsLoading(true);
    
    try {
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
        addMessage('Ollama is not running. Please start Ollama to use the AI assistant.', 'error');
        return;
      }
      
      // Show typing indicator
      setIsTyping(true);
      const botMessage = addMessage('', 'bot', true);
      
      try {
        // Prepare board data for context
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
              status: column.title,
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
        
        // Send message to Ollama
        const response = await sendMessageToOllama({
          message: userInput,
          board: boardContext,
          model: 'deepseek-coder:6.7b'
        });
        
        // Update the message with the response
        setMessages(prev => prev.map(msg => 
          msg.id === botMessage.id 
            ? { ...msg, text: response, isTyping: false }
            : msg
        ));
        
      } catch (error) {
        console.error('Error getting AI response:', error);
        setMessages(prev => prev.map(msg => 
          msg.id === botMessage?.id 
            ? { 
                ...msg, 
                text: 'Sorry, I encountered an error processing your request. Please try again later.',
                type: 'error',
                isTyping: false
              } 
            : msg
        ));
      } finally {
        setIsTyping(false);
      }
      
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      addMessage('An unexpected error occurred. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, board, addMessage, checkOllamaConnection]);
  
  // Handle input changes
  const handleInput = useCallback((e) => {
    setInputValue(e.target.value);
    
    // Auto-resize textarea
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, []);
  
  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    // Submit on Cmd+Enter or Ctrl+Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSubmit(e);
    }
  }, [handleSubmit]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Check Ollama status when chat is opened
  useEffect(() => {
    if (isOpen) {
      checkOllamaConnection();
    }
  }, [isOpen, checkOllamaConnection]);
  
  // Focus input when chat is opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <div className="chat-widget">
      {/* Chat Toggle Button */}
      <button 
        className={`chat-toggle-button ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        <FontAwesomeIcon 
          icon={isOpen ? faTimes : faRobot} 
          className="chat-icon" 
          aria-hidden="true" 
        />
      </button>
      
      {/* Chat Popup */}
      {isOpen && (
        <div className="chat-popup">
          {/* Chat Header */}
          <div className="chat-header">
            <div className="chat-header-left">
              <FontAwesomeIcon icon={faRobot} className="header-icon" />
              <h3>Kanban AI Assistant</h3>
              <StatusBadge isOnline={ollamaStatus.isRunning} />
            </div>
            <div className="chat-header-actions">

              <button 
                className="header-button close-button"
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
          </div>
          
          {/* Chat Messages */}
          <div className="chat-messages" ref={chatContainerRef}>
              {messages.length === 1 && (
                <WelcomeMessage onExampleClick={handleExampleClick} />
              )}
              
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg.text}
                  type={msg.type}
                  isTyping={msg.isTyping}
                  id={msg.id}
                />
              ))}
              
              {ollamaStatus.isLoading && (
                <div className="status-message">
                  <DnaSpinner className="small" />
                  <span>Connecting to AI assistant...</span>
                </div>
              )}
              
              {!ollamaStatus.isLoading && !ollamaStatus.isRunning && (
                <div className="status-message error">
                  <span>AI assistant is offline. Please make sure Ollama is running.</span>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            
            {/* Chat Input */}
            <form 
              className="chat-input-form"
              onSubmit={handleSubmit}
              aria-label="Chat input form"
            >
              <div 
                className={`chat-input-container ${inputValue.trim() ? 'has-text' : ''} ${isLoading ? 'loading' : ''}`}
              >
                <div className="input-wrapper">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask me anything about your tasks..."
                    className="chat-input"
                    disabled={isLoading}
                    rows={1}
                    aria-label="Type your message"
                    aria-multiline="true"
                  />
                  <button 
                    type="submit" 
                    className="send-button"
                    disabled={!inputValue.trim() || isLoading}
                    aria-label="Send message"
                  >
                    {isLoading ? (
                      <DnaSpinner />
                    ) : (
                      <FontAwesomeIcon icon={faPaperPlane} className="send-icon" />
                    )}
                  </button>
                </div>
                

              </div>
            </form>
        </div>
      )}
    </div>
  );
};

export default ChatButton;
